// cea-plataforma/web/src/pages/TeacherAttendancePage.tsx
import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useRole } from "../lib/useRole";
import logoCea from "../assets/logo-cea.png";
import type { default as jsPDFType } from "jspdf";

type Level = { id: number; name: string; sort_order: number };
type StudentRow = { id: string; code: string | null; full_name: string | null; last_name_pat: string | null; last_name_mat: string | null; first_names: string | null };
type AttendanceStatus = "P" | "A" | "F" | "L";
type AttendanceMap = Map<string, Map<string, AttendanceStatus>>; // studentId -> dateStr -> status

const STATUS_CYCLE: (AttendanceStatus | null)[] = [null, "P", "A", "F", "L"];
const STATUS_COLOR: Record<AttendanceStatus, string> = {
  P: "bg-emerald-600 text-white",
  A: "bg-amber-500 text-white",
  F: "bg-red-600 text-white",
  L: "bg-blue-600 text-white",
};
const STATUS_LABEL: Record<AttendanceStatus, string> = { P: "P", A: "A", F: "F", L: "L" };
const DAY_LABELS = ["L", "M", "Mi", "J", "V"];

function getWeekdays(year: number, month: number): Date[] {
  const days: Date[] = [];
  const d = new Date(year, month - 1, 1);
  while (d.getMonth() === month - 1) {
    const dow = d.getDay();
    if (dow >= 1 && dow <= 5) days.push(new Date(d));
    d.setDate(d.getDate() + 1);
  }
  return days;
}

function pad2(n: number) { return String(n).padStart(2, "0"); }
function toDateStr(d: Date) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }

function loadLogoBase64(): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject("No canvas context"); return; }
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => reject("Error loading logo");
    img.src = logoCea;
  });
}

async function addPdfHeader(doc: jsPDFType, pageWidth: number) {
  try {
    const logoData = await loadLogoBase64();
    doc.addImage(logoData, "PNG", 15, 8, 28, 28);
  } catch {
    // Si falla el logo, continuar sin él
  }
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text('CEA "MADRE MARIA OLIVA"', pageWidth / 2, 20, { align: "center" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Centro de Educacion Alternativa", pageWidth / 2, 26, { align: "center" });
  doc.setDrawColor(80, 80, 80);
  doc.setLineWidth(0.5);
  doc.line(15, 38, pageWidth - 15, 38);
}

export default function TeacherAttendancePage() {
  const nav = useNavigate();
  const { session, role } = useRole();
  const initDone = useRef(false);

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [levels, setLevels] = useState<Level[]>([]);
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [attendance, setAttendance] = useState<AttendanceMap>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const weekdays = getWeekdays(year, month);

  // Cargar perfil + niveles — solo una vez aunque session cambie de referencia
  useEffect(() => {
    if (!session || initDone.current) return;
    initDone.current = true;

    async function init() {
      setLoading(true);
      const { data: prof } = await supabase
        .from("profiles")
        .select("career_id,shift")
        .eq("id", session!.user.id)
        .single();

      if (!prof?.career_id) { setLoading(false); return; }

      const { data: lvls } = await supabase
        .from("levels")
        .select("id,name,sort_order")
        .eq("career_id", prof.career_id)
        .order("sort_order");

      const loadedLevels = (lvls ?? []) as Level[];
      setLevels(loadedLevels);
      if (loadedLevels.length > 0) setSelectedLevel(loadedLevels[0].id);
      setLoading(false);
    }
    init();
  }, [session]);

  // Cargar estudiantes del nivel seleccionado
  const loadStudentsForLevel = useCallback(async (levelId: number) => {
    if (!session) return;
    const { data: prof } = await supabase
      .from("profiles")
      .select("career_id,shift")
      .eq("id", session.user.id)
      .single();
    if (!prof?.career_id) return;

    const { data: enrolls } = await supabase
      .from("enrollments")
      .select("student_id")
      .eq("level_id", levelId);

    const studentIds = (enrolls ?? []).map((e: any) => e.student_id);
    if (studentIds.length === 0) { setStudents([]); return; }

    const { data: studs } = await supabase
      .from("profiles")
      .select("id,code,full_name,last_name_pat,last_name_mat,first_names")
      .in("id", studentIds)
      .eq("career_id", prof.career_id)
      .eq("shift", prof.shift)
      .eq("role", "student")
      .order("code");

    setStudents((studs ?? []) as StudentRow[]);
  }, [session]);

  useEffect(() => {
    if (selectedLevel !== null) loadStudentsForLevel(selectedLevel);
  }, [selectedLevel, loadStudentsForLevel]);

  // Cargar asistencia del mes
  const loadAttendance = useCallback(async () => {
    if (students.length === 0) { setAttendance(new Map()); return; }
    const firstDay = `${year}-${pad2(month)}-01`;
    const lastDay  = `${year}-${pad2(month)}-${pad2(new Date(year, month, 0).getDate())}`;

    const { data } = await supabase
      .from("attendance")
      .select("student_id,date,status")
      .in("student_id", students.map((s) => s.id))
      .gte("date", firstDay)
      .lte("date", lastDay);

    const map: AttendanceMap = new Map();
    for (const row of data ?? []) {
      if (!map.has(row.student_id)) map.set(row.student_id, new Map());
      map.get(row.student_id)!.set(row.date, row.status as AttendanceStatus);
    }
    setAttendance(map);
  }, [students, year, month]);

  useEffect(() => { loadAttendance(); }, [loadAttendance]);

  async function handleCellClick(studentId: string, dateStr: string) {
    if (saving) return;
    const current = attendance.get(studentId)?.get(dateStr) ?? null;
    const nextIdx = (STATUS_CYCLE.indexOf(current) + 1) % STATUS_CYCLE.length;
    const next = STATUS_CYCLE[nextIdx];

    // Optimistic update
    setAttendance((prev) => {
      const copy = new Map(prev);
      if (!copy.has(studentId)) copy.set(studentId, new Map());
      const inner = new Map(copy.get(studentId)!);
      if (next === null) inner.delete(dateStr);
      else inner.set(dateStr, next);
      copy.set(studentId, inner);
      return copy;
    });

    setSaving(true);
    if (next === null) {
      await supabase.from("attendance").delete().eq("student_id", studentId).eq("date", dateStr);
    } else {
      await supabase.from("attendance").upsert(
        { student_id: studentId, date: dateStr, status: next, recorded_by: session!.user.id },
        { onConflict: "student_id,date" }
      );
    }
    setSaving(false);
  }

  async function exportPdfGrupal() {
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");
    const doc = new jsPDF({ orientation: "landscape" });
    const pageWidth = doc.internal.pageSize.getWidth();

    await addPdfHeader(doc, pageWidth);

    const levelName = levels.find((l) => l.id === selectedLevel)?.name ?? "Nivel";
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text(`REGISTRO DE ASISTENCIA`, pageWidth / 2, 46, { align: "center" });
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`${levelName}  |  ${pad2(month)}/${year}`, pageWidth / 2, 53, { align: "center" });

    const head = [["#", "Codigo", "Apellidos, Nombres", ...weekdays.map((d) => `${d.getDate()}\n${DAY_LABELS[d.getDay() - 1]}`), "F", "%F"]];
    const body = students.map((s, i) => {
      const cells: string[] = [(i + 1).toString(), s.code ?? "-", `${s.last_name_pat ?? ""} ${s.last_name_mat ?? ""}, ${s.first_names ?? ""}`.trim()];
      let faltas = 0; let total = 0;
      for (const d of weekdays) {
        const ds = toDateStr(d);
        const st = attendance.get(s.id)?.get(ds) ?? null;
        cells.push(st ?? "");
        if (st) { total++; if (st === "F") faltas++; }
      }
      cells.push(String(faltas));
      cells.push(total > 0 ? `${Math.round((faltas / total) * 100)}%` : "-");
      return cells;
    });

    autoTable(doc, {
      head,
      body,
      startY: 58,
      styles: { fontSize: 7, cellPadding: 1 },
      headStyles: { fillColor: [30, 58, 95] },
    });
    doc.save(`asistencia_${levelName}_${year}_${pad2(month)}.pdf`);
  }

  async function exportPdfIndividual(student: StudentRow) {
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    await addPdfHeader(doc, pageWidth);

    const name = `${student.last_name_pat ?? ""} ${student.last_name_mat ?? ""}, ${student.first_names ?? ""}`.trim();
    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("ASISTENCIA INDIVIDUAL", pageWidth / 2, 46, { align: "center" });
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Estudiante: ${name}`, 15, 55);
    doc.text(`Codigo: ${student.code ?? "-"}`, 15, 62);
    doc.text(`Mes: ${pad2(month)}/${year}`, 15, 69);

    const rows: string[][] = [];
    let totP = 0, totA = 0, totF = 0, totL = 0;
    for (const d of weekdays) {
      const ds = toDateStr(d);
      const st = attendance.get(student.id)?.get(ds) ?? null;
      if (st === "P") totP++;
      else if (st === "A") totA++;
      else if (st === "F") totF++;
      else if (st === "L") totL++;
      rows.push([ds, DAY_LABELS[d.getDay() - 1], st ?? "-"]);
    }
    const total = totP + totA + totF + totL;

    autoTable(doc, {
      head: [["Fecha", "Dia", "Estado"]],
      body: rows,
      startY: 75,
      styles: { fontSize: 10 },
      headStyles: { fillColor: [30, 58, 95] },
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text("Resumen del mes:", 15, finalY);
    doc.setFont("helvetica", "normal");
    doc.text(`Presentes (P): ${totP}    Atrasados (A): ${totA}    Faltas (F): ${totF}    Licencias (L): ${totL}`, 15, finalY + 8);
    if (total > 0) {
      const pct = Math.round((totF / total) * 100);
      doc.text(`Porcentaje de faltas: ${pct}%${pct > 30 ? "  ** ATENCION: porcentaje alto **" : ""}`, 15, finalY + 16);
    }
    doc.save(`asistencia_${student.code ?? student.id}_${year}_${pad2(month)}.pdf`);
  }

  if (!session || (role !== "teacher" && role !== "admin")) return null;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-700/50 px-4 py-4 flex items-center gap-4">
        <button
          className="text-slate-400 hover:text-white transition-colors"
          onClick={() => nav("/teacher")}
        >
          ← Volver
        </button>
        <h1 className="text-xl font-bold text-white flex-1">📋 Registro de Asistencia</h1>
        {saving && <span className="text-xs text-slate-400 animate-pulse">Guardando...</span>}
      </div>

      <div className="max-w-screen-2xl mx-auto px-4 py-6 space-y-6">
        {/* Controles */}
        <div className="flex flex-wrap gap-3 items-center">
          <select
            className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            value={selectedLevel ?? ""}
            onChange={(e) => setSelectedLevel(e.target.value ? Number(e.target.value) : null)}
          >
            {levels.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>

          <select
            className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          >
            {["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"].map((m, i) => (
              <option key={i+1} value={i+1}>{m}</option>
            ))}
          </select>

          <select
            className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {[2024, 2025, 2026, 2027].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>

          <button
            className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-xl font-medium transition-all"
            onClick={exportPdfGrupal}
            disabled={students.length === 0}
          >
            📄 PDF Grupal
          </button>
        </div>

        {/* Leyenda */}
        <div className="flex flex-wrap gap-2 text-xs">
          {(["P","A","F","L"] as AttendanceStatus[]).map((s) => (
            <span key={s} className={`px-3 py-1 rounded-full ${STATUS_COLOR[s]}`}>
              {s === "P" ? "P - Presente" : s === "A" ? "A - Atrasado" : s === "F" ? "F - Falta" : "L - Licencia"}
            </span>
          ))}
          <span className="px-3 py-1 rounded-full bg-slate-700 text-slate-400">Vacío - Sin clase</span>
        </div>

        {/* Tabla de asistencia */}
        {loading ? (
          <div className="text-center py-12 text-slate-400">Cargando...</div>
        ) : students.length === 0 ? (
          <div className="text-center py-12 text-slate-400">No hay estudiantes en este nivel</div>
        ) : (
          <div className="bg-slate-900 rounded-2xl border border-slate-700/50 overflow-auto shadow-xl">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-800/70">
                <tr>
                  <th className="sticky left-0 z-10 bg-slate-800 px-2 py-2 text-slate-300 text-left w-6">#</th>
                  <th className="sticky left-6 z-10 bg-slate-800 px-2 py-2 text-slate-300 text-left w-20">Código</th>
                  <th className="sticky left-[5rem] z-10 bg-slate-800 px-2 py-2 text-slate-300 text-left min-w-[160px]">Nombre</th>
                  {weekdays.map((d) => (
                    <th key={toDateStr(d)} className="px-1 py-1 text-center text-slate-300 w-8">
                      <div className="flex flex-col items-center">
                        <span className="font-bold">{d.getDate()}</span>
                        <span className="text-slate-500">{DAY_LABELS[d.getDay() - 1]}</span>
                      </div>
                    </th>
                  ))}
                  <th className="px-2 py-2 text-center text-slate-300 w-8">F</th>
                  <th className="px-2 py-2 text-center text-slate-300 w-12">%F</th>
                  <th className="px-2 py-2 text-center text-slate-300 w-16">PDF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {students.map((s, idx) => {
                  const rowMap = attendance.get(s.id) ?? new Map();
                  let faltas = 0; let total = 0;
                  for (const d of weekdays) {
                    const st = rowMap.get(toDateStr(d));
                    if (st) { total++; if (st === "F") faltas++; }
                  }
                  const pct = total > 0 ? Math.round((faltas / total) * 100) : null;
                  const pctColor = pct === null ? "text-slate-600" : pct <= 20 ? "text-emerald-400" : pct <= 30 ? "text-amber-400" : "text-red-400";

                  return (
                    <tr key={s.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="sticky left-0 z-10 bg-slate-900 px-2 py-2 text-slate-500 text-center">{idx + 1}</td>
                      <td className="sticky left-6 z-10 bg-slate-900 px-2 py-2 text-slate-300 font-mono">{s.code ?? "-"}</td>
                      <td className="sticky left-[5rem] z-10 bg-slate-900 px-2 py-2 text-slate-200 whitespace-nowrap">
                        {`${s.last_name_pat ?? ""} ${s.last_name_mat ?? ""}, ${s.first_names ?? ""}`.trim()}
                      </td>
                      {weekdays.map((d) => {
                        const ds = toDateStr(d);
                        const st = (rowMap.get(ds) ?? null) as AttendanceStatus | null;
                        return (
                          <td key={ds} className="px-0.5 py-1 text-center">
                            <button
                              className={`w-7 h-7 rounded text-xs font-bold transition-all ${
                                st ? STATUS_COLOR[st] : "bg-slate-800 text-slate-600 hover:bg-slate-700"
                              }`}
                              onClick={() => handleCellClick(s.id, ds)}
                              title={ds}
                            >
                              {st ? STATUS_LABEL[st] : "·"}
                            </button>
                          </td>
                        );
                      })}
                      <td className="px-2 py-2 text-center text-red-400 font-bold">{faltas}</td>
                      <td className={`px-2 py-2 text-center font-bold ${pctColor}`}>
                        {pct !== null ? `${pct}%` : "-"}
                      </td>
                      <td className="px-2 py-2 text-center">
                        <button
                          className="px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded text-xs transition-colors"
                          onClick={() => exportPdfIndividual(s)}
                          title="PDF individual"
                        >
                          PDF
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

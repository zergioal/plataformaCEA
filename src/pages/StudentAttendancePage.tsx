// cea-plataforma/web/src/pages/StudentAttendancePage.tsx
import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useRole } from "../lib/useRole";

type Level = { id: number; name: string; sort_order: number };
type StudentRow = { id: string; code: string | null; last_name_pat: string | null; last_name_mat: string | null; first_names: string | null };
type AttendanceStatus = "P" | "A" | "F" | "L";
type AttendanceMap = Map<string, Map<string, AttendanceStatus>>;

const STATUS_COLOR: Record<AttendanceStatus, string> = {
  P: "bg-emerald-600 text-white",
  A: "bg-amber-500 text-white",
  F: "bg-red-600 text-white",
  L: "bg-blue-600 text-white",
};
const DAY_LABELS = ["L", "M", "Mi", "J", "V"];
const MONTH_NAMES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

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

function pctColor(pct: number | null): string {
  if (pct === null) return "text-slate-500";
  if (pct >= 80) return "text-emerald-400";
  if (pct >= 60) return "text-amber-400";
  return "text-red-400";
}

export default function StudentAttendancePage() {
  const nav = useNavigate();
  const { session, profile } = useRole();
  const [isBoardMember, setIsBoardMember] = useState(false);
  const initDone = useRef(false);

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [levels, setLevels] = useState<Level[]>([]);
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [attendance, setAttendance] = useState<AttendanceMap>(new Map());
  const [loading, setLoading] = useState(true);

  const weekdays = getWeekdays(year, month);

  // Init único: consulta is_board_member fresh (evita cache) y bifurca
  useEffect(() => {
    if (!session || !profile || initDone.current) return;
    initDone.current = true;

    async function init() {
      setLoading(true);

      // Query fresca para evitar cache desactualizado de sessionStorage
      const { data: bm } = await supabase
        .from("profiles")
        .select("is_board_member")
        .eq("id", session!.user.id)
        .single();
      const isBoard = bm?.is_board_member === true;
      setIsBoardMember(isBoard);

      if (isBoard) {
        // Mesa directiva: cargar todos los niveles de la carrera
        const { data: lvls } = await supabase
          .from("levels")
          .select("id,name,sort_order")
          .eq("career_id", profile!.career_id!)
          .order("sort_order");
        const loadedLevels = (lvls ?? []) as Level[];
        setLevels(loadedLevels);
        if (loadedLevels.length > 0) setSelectedLevel(loadedLevels[0].id);
      } else {
        // Estudiante normal: solo sus propios registros
        setStudents([{
          id: session!.user.id,
          code: profile!.code,
          last_name_pat: profile!.last_name_pat,
          last_name_mat: profile!.last_name_mat,
          first_names: profile!.first_names,
        }]);
      }
      setLoading(false);
    }

    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, profile]);

  // Mesa directiva: cargar estudiantes del nivel seleccionado
  const loadStudentsForLevel = useCallback(async (levelId: number) => {
    if (!session || !profile) return;
    const { data: enrolls } = await supabase
      .from("enrollments")
      .select("student_id")
      .eq("level_id", levelId);

    const ids = (enrolls ?? []).map((e: { student_id: string }) => e.student_id);
    if (ids.length === 0) { setStudents([]); return; }

    const { data: studs } = await supabase
      .from("profiles")
      .select("id,code,last_name_pat,last_name_mat,first_names")
      .in("id", ids)
      .eq("role", "student")
      .order("last_name_pat");

    setStudents((studs ?? []) as StudentRow[]);
  }, [session, profile]);

  useEffect(() => {
    if (isBoardMember && selectedLevel !== null) loadStudentsForLevel(selectedLevel);
  }, [isBoardMember, selectedLevel, loadStudentsForLevel]);

  // Cargar asistencia del mes
  const loadAttendance = useCallback(async () => {
    const targetIds = isBoardMember
      ? students.map((s) => s.id)
      : session ? [session.user.id] : [];

    if (targetIds.length === 0) { setAttendance(new Map()); return; }

    const firstDay = `${year}-${pad2(month)}-01`;
    const lastDay  = `${year}-${pad2(month)}-${pad2(new Date(year, month, 0).getDate())}`;

    const { data } = await supabase
      .from("attendance")
      .select("student_id,date,status")
      .in("student_id", targetIds)
      .gte("date", firstDay)
      .lte("date", lastDay);

    const map: AttendanceMap = new Map();
    for (const row of data ?? []) {
      if (!map.has(row.student_id)) map.set(row.student_id, new Map());
      map.get(row.student_id)!.set(row.date, row.status as AttendanceStatus);
    }
    setAttendance(map);
  }, [isBoardMember, students, session, year, month]);

  useEffect(() => { loadAttendance(); }, [loadAttendance]);

  if (!session) return null;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-700/50 px-4 py-4 flex items-center gap-4">
        <button className="text-slate-400 hover:text-white transition-colors" onClick={() => nav("/student")}>
          ← Volver
        </button>
        <h1 className="text-xl font-bold text-white flex-1">
          📋 Mi Asistencia
          {isBoardMember && <span className="ml-2 text-sm font-normal text-blue-400">(Mesa Directiva — Vista General)</span>}
        </h1>
      </div>

      <div className="max-w-screen-2xl mx-auto px-4 py-6 space-y-6">
        {/* Controles */}
        <div className="flex flex-wrap gap-3 items-center">
          {isBoardMember && (
            <select
              className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              value={selectedLevel ?? ""}
              onChange={(e) => setSelectedLevel(e.target.value ? Number(e.target.value) : null)}
            >
              {levels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          )}

          <select
            className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          >
            {MONTH_NAMES.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
          </select>

          <select
            className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {[2024, 2025, 2026, 2027].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        {/* Leyenda */}
        <div className="flex flex-wrap gap-2 text-xs">
          {(["P","A","F","L"] as AttendanceStatus[]).map((s) => (
            <span key={s} className={`px-3 py-1 rounded-full ${STATUS_COLOR[s]}`}>
              {s === "P" ? "P - Presente" : s === "A" ? "A - Atrasado" : s === "F" ? "F - Falta" : "L - Licencia"}
            </span>
          ))}
          <span className="px-3 py-1 rounded-full bg-slate-700 text-slate-400">Vacío - Sin clase</span>
          <span className="ml-auto text-slate-500 italic">Mínimo EPJA: 60% asistencia</span>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-400">Cargando...</div>
        ) : students.length === 0 ? (
          <div className="text-center py-12 text-slate-400">No hay registros disponibles</div>
        ) : (
          <>
            {/* Grid de asistencia (read-only) */}
            <div className="bg-slate-900 rounded-2xl border border-slate-700/50 overflow-auto shadow-xl">
              <table className="min-w-full text-xs">
                <thead className="bg-slate-800/70">
                  <tr>
                    {isBoardMember && (
                      <>
                        <th className="sticky left-0 z-10 bg-slate-800 px-2 py-2 text-slate-300 text-left w-6">#</th>
                        <th className="sticky left-6 z-10 bg-slate-800 px-2 py-2 text-slate-300 text-left w-20">Código</th>
                        <th className="sticky left-[6.5rem] z-10 bg-slate-800 px-2 py-2 text-slate-300 text-left min-w-[180px]">Nombre</th>
                      </>
                    )}
                    {!isBoardMember && (
                      <th className="sticky left-0 z-10 bg-slate-800 px-2 py-2 text-slate-300 text-left min-w-[180px]">Día</th>
                    )}
                    {weekdays.map((d) => (
                      <th key={toDateStr(d)} className="px-1 py-1 text-center text-slate-300 w-8">
                        <div className="flex flex-col items-center">
                          <span className="font-bold">{d.getDate()}</span>
                          <span className="text-slate-500">{DAY_LABELS[d.getDay() - 1]}</span>
                        </div>
                      </th>
                    ))}
                    <th className="px-2 py-2 text-center text-slate-300 w-8">F</th>
                    <th className="px-2 py-2 text-center text-slate-300 w-16">%As.</th>
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
                    const pct = total > 0 ? Math.round(((total - faltas) / total) * 100) : null;

                    return (
                      <tr key={s.id} className="hover:bg-slate-800/20">
                        {isBoardMember && (
                          <>
                            <td className="sticky left-0 z-10 bg-slate-900 px-2 py-2 text-slate-500 text-center">{idx + 1}</td>
                            <td className="sticky left-6 z-10 bg-slate-900 px-2 py-2 text-slate-300 font-mono">{s.code ?? "-"}</td>
                            <td className="sticky left-[6.5rem] z-10 bg-slate-900 px-2 py-2 text-slate-200 whitespace-nowrap">
                              {`${s.last_name_pat ?? ""} ${s.last_name_mat ?? ""}, ${s.first_names ?? ""}`.trim()}
                            </td>
                          </>
                        )}
                        {!isBoardMember && (
                          <td className="sticky left-0 z-10 bg-slate-900 px-2 py-2 text-slate-200 whitespace-nowrap font-medium">
                            {`${s.last_name_pat ?? ""} ${s.first_names ?? ""}`.trim()}
                          </td>
                        )}
                        {weekdays.map((d) => {
                          const ds = toDateStr(d);
                          const st = (rowMap.get(ds) ?? null) as AttendanceStatus | null;
                          return (
                            <td key={ds} className="px-0.5 py-1 text-center">
                              <div className={`w-7 h-7 rounded text-xs font-bold flex items-center justify-center mx-auto ${
                                st ? STATUS_COLOR[st] : "bg-slate-800 text-slate-700"
                              }`}>
                                {st ?? "·"}
                              </div>
                            </td>
                          );
                        })}
                        <td className="px-2 py-2 text-center text-red-400 font-bold">{faltas}</td>
                        <td className={`px-2 py-2 text-center font-bold ${pctColor(pct)}`}>
                          {pct !== null ? `${pct}%` : "-"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Resumen mensual (solo para estudiante individual) */}
            {!isBoardMember && (() => {
              const myMap = attendance.get(session.user.id) ?? new Map();
              let P = 0, A = 0, F = 0, L = 0;
              for (const d of weekdays) {
                const st = myMap.get(toDateStr(d));
                if (st === "P") P++;
                else if (st === "A") A++;
                else if (st === "F") F++;
                else if (st === "L") L++;
              }
              const tot = P + A + F + L;
              const pct = tot > 0 ? Math.round(((tot - F) / tot) * 100) : null;
              return (
                <div className="bg-slate-900 rounded-2xl border border-slate-700/50 p-5 space-y-4">
                  <h2 className="text-base font-bold text-white">
                    Resumen — {MONTH_NAMES[month - 1]} {year}
                  </h2>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: "Presentes", val: P, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
                      { label: "Atrasados", val: A, color: "text-amber-400",   bg: "bg-amber-500/10 border-amber-500/20" },
                      { label: "Faltas",    val: F, color: "text-red-400",     bg: "bg-red-500/10 border-red-500/20" },
                      { label: "Licencias", val: L, color: "text-blue-400",    bg: "bg-blue-500/10 border-blue-500/20" },
                    ].map((item) => (
                      <div key={item.label} className={`rounded-xl border p-3 text-center ${item.bg}`}>
                        <div className={`text-2xl font-bold ${item.color}`}>{item.val}</div>
                        <div className="text-xs text-slate-400 mt-1">{item.label}</div>
                      </div>
                    ))}
                  </div>
                  {pct !== null && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 bg-slate-700 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full transition-all ${pct >= 80 ? "bg-emerald-500" : pct >= 60 ? "bg-amber-500" : "bg-red-500"}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className={`text-sm font-bold ${pctColor(pct)}`}>{pct}% asistencia</span>
                      </div>
                      {pct < 60 && (
                        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-sm text-red-300">
                          <strong>Atención:</strong> Tu asistencia está por debajo del 60% mínimo requerido por el reglamento EPJA.
                        </div>
                      )}
                      {pct >= 60 && pct < 80 && (
                        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-sm text-amber-300">
                          Tu asistencia está cerca del límite mínimo (60%). Procura no faltar más.
                        </div>
                      )}
                    </div>
                  )}
                  {tot === 0 && (
                    <p className="text-slate-500 text-sm text-center">Aún no hay registros de asistencia para este mes.</p>
                  )}
                </div>
              );
            })()}
          </>
        )}
      </div>
    </div>
  );
}

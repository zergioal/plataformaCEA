// cea-plataforma/web/src/pages/TeacherDimensionGrades.tsx
// Registro de calificaciones por dimensión evaluativa

import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useRole } from "../lib/useRole";
import logoCea from "../assets/logo-cea.png";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ─── Tipos ───────────────────────────────────────────────────────────────────

type DimKey = "ser" | "saber" | "hacer_proceso" | "hacer_producto" | "decidir";

type StudentRow = {
  id: string;
  last_name_pat: string | null;
  last_name_mat: string | null;
  first_names: string | null;
  attendancePct: number; // 0-100
};

function formatName(s: StudentRow): string {
  const pat = s.last_name_pat ?? "";
  const mat = s.last_name_mat ?? "";
  const names = s.first_names ?? "";
  const surnames = [pat, mat].filter(Boolean).join(" ");
  return surnames ? `${surnames}, ${names}` : names;
}

type ActivityCol = {
  section_id: number;
  title: string;
  isAuto: boolean; // para SER/DECIDIR — las que vienen de asistencia
};

// grade por (student_id, section_id)
type CellMap = Map<string, number | null>; // key: `${studentId}_${sectionId}`

// ─── Configuración por dimensión ─────────────────────────────────────────────

const DIM_CONFIG: Record<DimKey, { label: string; max: number; min: number; color: string; moduleField: string }> = {
  ser:           { label: "SER",           max: 10, min: 2,  color: "#38bdf8", moduleField: "ser" },
  saber:         { label: "SABER",         max: 30, min: 6,  color: "#5eead4", moduleField: "saber" },
  hacer_proceso: { label: "HACER Proceso", max: 20, min: 4,  color: "#818cf8", moduleField: "hacer_proceso" },
  hacer_producto:{ label: "HACER Producto",max: 20, min: 4,  color: "#c084fc", moduleField: "hacer_producto" },
  decidir:       { label: "DECIDIR",       max: 10, min: 2,  color: "#fb923c", moduleField: "decidir" },
};

// Indicadores fijos para SER y DECIDIR
const SER_FIXED_COLS: ActivityCol[] = [
  { section_id: -1, title: "Asiste y trabaja con responsabilidad (Asistencia %)", isAuto: true },
  { section_id: -2, title: "Respeta las normas del aula/taller",                  isAuto: false },
];
const DECIDIR_FIXED_COLS: ActivityCol[] = [
  { section_id: -1, title: "Participa en aula (Asistencia %)", isAuto: true },
  { section_id: -2, title: "Corrige errores y mejora su trabajo", isAuto: false },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function cellKey(studentId: string, sectionId: number) {
  return `${studentId}_${sectionId}`;
}

function calcAvg(scores: (number | null)[], max: number, min: number): number {
  const valid = scores.filter((s) => s !== null) as number[];
  if (valid.length === 0) return min;
  const avg = valid.reduce((a, b) => a + b, 0) / valid.length;
  return Math.min(Math.max(Math.round(avg), min), max);
}

// ─── Componente ──────────────────────────────────────────────────────────────

export default function TeacherDimensionGrades() {
  const nav = useNavigate();
  const { moduleId, dimension } = useParams<{ moduleId: string; dimension: string }>();
  const { loading, session, role } = useRole();

  const mid = parseInt(moduleId ?? "", 10);
  const dim = dimension as DimKey;
  const cfg = DIM_CONFIG[dim];

  const isTeacherish = role === "teacher" || role === "admin";
  const invalid = isNaN(mid) || !cfg;
  const loadedRef = useRef(false);

  const [moduleTitle, setModuleTitle] = useState("");
  const [levelName, setLevelName] = useState("");
  const [careerName, setCareerName] = useState("");
  const [facilitator, setFacilitator] = useState("");

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [cols, setCols] = useState<ActivityCol[]>([]);
  const [cells, setCells] = useState<CellMap>(new Map());
  const [averages, setAverages] = useState<Map<string, number>>(new Map()); // studentId -> avg
  const [savingCell, setSavingCell] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(false);

  useEffect(() => {
    if (!session || !isTeacherish || invalid) return;
    if (loadedRef.current) return;
    loadedRef.current = true;
    loadAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, isTeacherish, mid, dim]);

  async function loadAll() {
    setLoadingData(true);
    setMsg(null);

    // Perfil docente
    const { data: prof } = await supabase
      .from("profiles")
      .select("career_id, shift, full_name")
      .eq("id", session!.user.id)
      .single();
    if (!prof) { setMsg("Error cargando perfil"); setLoadingData(false); return; }
    setFacilitator(prof.full_name ? `Lic. ${prof.full_name}` : "");

    // Módulo
    const { data: mod } = await supabase
      .from("modules")
      .select("id, title, level_id")
      .eq("id", mid)
      .single();
    if (!mod) { setMsg("Módulo no encontrado"); setLoadingData(false); return; }
    setModuleTitle(mod.title);

    // Nivel + carrera
    const { data: lv } = await supabase
      .from("levels")
      .select("name, career_id")
      .eq("id", mod.level_id)
      .single();
    if (lv) {
      setLevelName(lv.name);
      const { data: car } = await supabase.from("careers").select("name").eq("id", lv.career_id).single();
      if (car) setCareerName(car.name);
    }

    // Estudiantes del nivel
    const { data: enrolls } = await supabase
      .from("enrollments")
      .select("student_id")
      .eq("level_id", mod.level_id);
    const studentIds = (enrolls ?? []).map((e: { student_id: string }) => e.student_id);

    if (studentIds.length === 0) { setStudents([]); setLoadingData(false); return; }

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, last_name_pat, last_name_mat, first_names")
      .in("id", studentIds)
      .eq("career_id", prof.career_id)
      .eq("shift", prof.shift)
      .order("last_name_pat")
      .order("last_name_mat")
      .order("first_names");

    // Asistencia de cada estudiante (para SER/DECIDIR auto)
    const { data: attendRows } = await supabase
      .from("attendance")
      .select("student_id, status")
      .in("student_id", studentIds);

    const attendMap = new Map<string, { total: number; present: number }>();
    for (const sid of studentIds) attendMap.set(sid, { total: 0, present: 0 });
    for (const a of attendRows ?? []) {
      const cur = attendMap.get(a.student_id) ?? { total: 0, present: 0 };
      cur.total++;
      if (a.status === "P") cur.present++;
      attendMap.set(a.student_id, cur);
    }

    const studentList: StudentRow[] = (profiles ?? []).map((p: { id: string; last_name_pat: string | null; last_name_mat: string | null; first_names: string | null }) => {
      const att = attendMap.get(p.id) ?? { total: 0, present: 0 };
      const pct = att.total > 0 ? Math.round((att.present / att.total) * 100) : 0;
      return { id: p.id, last_name_pat: p.last_name_pat, last_name_mat: p.last_name_mat, first_names: p.first_names, attendancePct: pct };
    });
    setStudents(studentList);

    // Columnas según dimensión
    let columns: ActivityCol[] = [];
    if (dim === "ser") {
      columns = [...SER_FIXED_COLS];
    } else if (dim === "decidir") {
      columns = [...DECIDIR_FIXED_COLS];
    } else {
      // Secciones de esa dimensión en el módulo, ordenadas por lección y luego por sección
      const { data: lessons } = await supabase
        .from("lessons")
        .select("id, sort_order")
        .eq("module_id", mid)
        .order("sort_order");
      const lessonIds = (lessons ?? []).map((l: { id: number }) => l.id);
      const lessonOrder = new Map((lessons ?? []).map((l: { id: number; sort_order: number }) => [l.id, l.sort_order]));

      if (lessonIds.length > 0) {
        const { data: sections } = await supabase
          .from("lesson_sections")
          .select("id, title, dimension, lesson_id, sort_order")
          .in("lesson_id", lessonIds)
          .eq("dimension", dim)
          .eq("is_active", true);
        // Ordenar: primero por sort_order de la lección, luego por sort_order de la sección
        const sorted = (sections ?? []).sort((a: { lesson_id: number; sort_order: number }, b: { lesson_id: number; sort_order: number }) => {
          const lo = (lessonOrder.get(a.lesson_id) ?? 0) - (lessonOrder.get(b.lesson_id) ?? 0);
          return lo !== 0 ? lo : a.sort_order - b.sort_order;
        });
        columns = sorted.map((s: { id: number; title: string }) => ({
          section_id: s.id,
          title: s.title,
          isAuto: false,
        }));
      }
    }
    setCols(columns);

    // Cargar dimension_grades existentes
    const sectionIds = columns.filter((c) => c.section_id > 0).map((c) => c.section_id);
    const existingCells = new Map<string, number | null>();

    if (dim === "ser" || dim === "decidir") {
      // Celda -1: nota automática en escala de la dimensión (0-cfg.max)
      for (const s of studentList) {
        existingCells.set(cellKey(s.id, -1), Math.round((s.attendancePct / 100) * cfg.max));
      }
      // Celda -2: el docente la ingresa manualmente; no pre-poblar para evitar datos inventados
    } else if (sectionIds.length > 0) {
      const { data: dGrades } = await supabase
        .from("dimension_grades")
        .select("student_id, section_id, score")
        .in("section_id", sectionIds)
        .in("student_id", studentList.map((s) => s.id));

      for (const dg of dGrades ?? []) {
        existingCells.set(cellKey(dg.student_id, dg.section_id), dg.score);
      }
    }

    setCells(existingCells);

    // Calcular promedios iniciales
    const avgs = new Map<string, number>();
    for (const s of studentList) {
      const scores = columns.map((c) => existingCells.get(cellKey(s.id, c.section_id)) ?? null);
      avgs.set(s.id, calcAvg(scores, cfg.max, cfg.min));
    }
    setAverages(avgs);

    setLoadingData(false);

    // Sincronizar promedios al registro principal en segundo plano
    // (incluye filas con notas en blanco, usando el mínimo calculado por calcAvg)
    for (const s of studentList) {
      const avg = avgs.get(s.id) ?? cfg.min;
      supabase.from("module_grades").upsert(
        { student_id: s.id, module_id: mid, [cfg.moduleField]: avg },
        { onConflict: "student_id,module_id" },
      ).then(({ error }) => {
        if (error) console.warn(`module_grades sync error (${s.id}):`, error.message);
      });
    }
  }

  async function saveCell(studentId: string, sectionId: number, value: number | null) {
    const key = cellKey(studentId, sectionId);
    setSavingCell(key);

    // Actualizar celda local
    const newCells = new Map(cells);
    newCells.set(key, value);
    setCells(newCells);

    // Recalcular promedio del estudiante
    const scores = cols.map((c) => newCells.get(cellKey(studentId, c.section_id)) ?? null);
    const avg = calcAvg(scores, cfg.max, cfg.min);
    const newAvgs = new Map(averages);
    newAvgs.set(studentId, avg);
    setAverages(newAvgs);

    try {
      if (sectionId > 0) {
        // Guardar en dimension_grades
        if (value === null) {
          await supabase.from("dimension_grades")
            .delete()
            .eq("student_id", studentId)
            .eq("section_id", sectionId);
        } else {
          await supabase.from("dimension_grades").upsert({
            student_id: studentId,
            section_id: sectionId,
            module_id: mid,
            dimension: dim,
            score: value,
            updated_at: new Date().toISOString(),
            updated_by: session!.user.id,
          }, { onConflict: "student_id,section_id" });
        }
      }

      // Copiar promedio al module_grades
      await supabase.from("module_grades").upsert({
        student_id: studentId,
        module_id: mid,
        [cfg.moduleField]: avg,
      }, { onConflict: "student_id,module_id" });

      setMsg(null);
    } catch (err) {
      setMsg("Error guardando: " + String(err));
    }

    setSavingCell(null);
  }

  // ─── PDF ──────────────────────────────────────────────────────────────────

  async function exportPdf() {
    const doc = new jsPDF({ orientation: "landscape" });
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header con logo
    let logoBase64: string | null = null;
    try {
      logoBase64 = await new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth; canvas.height = img.naturalHeight;
          const ctx = canvas.getContext("2d");
          if (!ctx) { reject("no ctx"); return; }
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL("image/png"));
        };
        img.onerror = () => reject("error");
        img.src = logoCea;
      });
    } catch { /* sin logo */ }

    if (logoBase64) doc.addImage(logoBase64, "PNG", 10, 6, 20, 20);
    doc.setFontSize(11); doc.setFont("helvetica", "bold");
    doc.text("C.E.A. Madre María Oliva", pageWidth / 2, 12, { align: "center" });
    doc.setFontSize(9); doc.setFont("helvetica", "normal");
    doc.text(`Registro ${cfg.label} (${cfg.max} pts) — ${moduleTitle}`, pageWidth / 2, 18, { align: "center" });
    doc.text(`${careerName} | ${levelName} | Facilitador/a: ${facilitator}`, pageWidth / 2, 23, { align: "center" });

    const activityColCount = cols.length;
    const head = [["N°", "Estudiante", ...cols.map((c) => c.title), `TOTAL (${cfg.max})`]];
    const body = students.map((s, idx) => {
      return [
        String(idx + 1),
        formatName(s),
        ...cols.map((c) => {
          if (c.isAuto) return String(Math.round((s.attendancePct / 100) * cfg.max));
          const v = cells.get(cellKey(s.id, c.section_id));
          return v !== null && v !== undefined ? String(Math.round(Number(v))) : "-";
        }),
        String(averages.get(s.id) ?? cfg.min),
      ];
    });

    autoTable(doc, {
      head, body, startY: 30,
      theme: "grid",
      styles: { fontSize: 8, textColor: [0, 0, 0], cellPadding: 2, lineColor: [180, 180, 180], lineWidth: 0.2 },
      headStyles: { fillColor: [235, 235, 235], fontSize: 6, textColor: [0, 0, 0], minCellHeight: 50, valign: "bottom", cellPadding: 2, fontStyle: "bold" },
      columnStyles: { 0: { cellWidth: 8 }, 1: { cellWidth: 42 } },
      willDrawCell: (data) => {
        if (data.section === "head" && data.column.index >= 2 && data.column.index < 2 + activityColCount) {
          (data.cell as { text: string[] }).text = [];
        }
      },
      didDrawCell: (data) => {
        if (data.section === "head" && data.column.index >= 2 && data.column.index < 2 + activityColCount) {
          const text = cols[data.column.index - 2]?.title ?? "";
          const x = data.cell.x + data.cell.width / 2;
          const y = data.cell.y + data.cell.height - 3;
          doc.setFontSize(6);
          doc.setTextColor(0, 0, 0);
          doc.text(text, x, y, { angle: 90, align: "left" });
        }
      },
    });

    doc.save(`registro_${dim}_modulo${mid}.pdf`);
  }

  // ─── Guards ──────────────────────────────────────────────────────────────

  if (loading) return <div className="p-6 text-slate-300">Cargando...</div>;
  if (!session || !isTeacherish) return <Navigate to="/login" replace />;
  if (invalid) return <Navigate to="/teacher" replace />;

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg,#111 0%,#1a1a1a 50%,#0d0d0d 100%)", color: "#e4e4e7" }}>
      {/* Header */}
      <div style={{ background: "rgba(20,20,20,0.98)", borderBottom: "1px solid rgba(255,255,255,0.1)", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div>
          <button
            onClick={() => nav(`/teacher/module/${mid}/grades`)}
            style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: 13, marginBottom: 4, display: "flex", alignItems: "center", gap: 6 }}
          >
            ← Registro Principal
          </button>
          <div style={{ fontSize: 18, fontWeight: 700, color: cfg.color }}>
            Registro {cfg.label} ({cfg.max} pts)
          </div>
          <div style={{ fontSize: 12, color: "#71717a" }}>{moduleTitle}</div>
        </div>
        <button
          onClick={exportPdf}
          style={{ background: "rgba(59,130,246,0.2)", border: "1px solid rgba(59,130,246,0.4)", color: "#93c5fd", borderRadius: 8, padding: "8px 16px", cursor: "pointer", fontSize: 13 }}
        >
          📄 Exportar PDF
        </button>
      </div>

      <div style={{ padding: "20px 24px" }}>
        {msg && <div style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "10px 14px", marginBottom: 16, color: "#fca5a5", fontSize: 13 }}>{msg}</div>}

        {loadingData ? (
          <div style={{ color: "#94a3b8", padding: 24 }}>Cargando datos...</div>
        ) : students.length === 0 ? (
          <div style={{ color: "#94a3b8", padding: 24 }}>No hay estudiantes en este nivel.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ minWidth: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "rgba(30,58,95,0.6)" }}>
                  <th style={thStyle}>N°</th>
                  <th style={{ ...thStyle, textAlign: "left", minWidth: 160 }}>Estudiante</th>
                  {cols.map((c) => (
                    <th key={c.section_id} style={{ ...thStyle, verticalAlign: "bottom", padding: "4px 6px", width: 48 }}>
                      <div style={{ display: "flex", justifyContent: "center" }}>
                        <div style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", whiteSpace: "nowrap", fontSize: 11, fontWeight: 600, color: "#cbd5e1", paddingBottom: 4, maxHeight: 140, overflow: "hidden" }}>
                          {c.title}
                          {c.isAuto && <span style={{ color: "#6ee7b7" }}> (auto)</span>}
                        </div>
                      </div>
                    </th>
                  ))}
                  <th style={{ ...thStyle, color: cfg.color }}>
                    TOTAL<br /><span style={{ fontSize: 11, fontWeight: 400, color: "#94a3b8" }}>({cfg.max})</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {students.map((s, idx) => {
                  const avg = averages.get(s.id) ?? cfg.min;
                  return (
                    <tr key={s.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.05)", background: idx % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent" }}>
                      <td style={tdStyle}>{idx + 1}</td>
                      <td style={{ ...tdStyle, textAlign: "left" }}>{formatName(s)}</td>

                      {cols.map((c) => {
                        const key = cellKey(s.id, c.section_id);
                        const val = cells.get(key);
                        const isSaving = savingCell === key;

                        if (c.isAuto) {
                          // Mostrar en escala de la dimensión (e.g. 0-10 para SER)
                          const displayVal = Math.round((s.attendancePct / 100) * cfg.max);
                          return (
                            <td key={c.section_id} style={{ ...tdStyle, color: "#6ee7b7" }}>
                              {displayVal}
                            </td>
                          );
                        }

                        return (
                          <td key={c.section_id} style={tdStyle}>
                            <input
                              type="number"
                              min={0}
                              max={cfg.max}
                              step={1}
                              disabled={isSaving}
                              defaultValue={val !== null && val !== undefined ? String(Math.round(Number(val))) : ""}
                              placeholder="—"
                              className="[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              style={{
                                width: 60,
                                background: "rgba(30,30,30,0.8)",
                                border: "1px solid rgba(255,255,255,0.12)",
                                borderRadius: 6,
                                color: "#e4e4e7",
                                padding: "4px 6px",
                                fontSize: 13,
                                textAlign: "center",
                                outline: "none",
                              } as React.CSSProperties}
                              onBlur={(e) => {
                                const raw = e.target.value.trim();
                                const num = raw === "" ? null : Math.min(Math.round(parseFloat(raw)), cfg.max);
                                saveCell(s.id, c.section_id, num);
                              }}
                            />
                          </td>
                        );
                      })}

                      <td style={{ ...tdStyle, color: cfg.color, fontWeight: 700 }}>
                        {avg}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Nota sobre mínimos */}
        <div style={{ marginTop: 16, fontSize: 12, color: "#52525b" }}>
          Rango de notas: {cfg.min} a {cfg.max}. El promedio de actividades se copia automáticamente al registro principal.
        </div>
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: "10px 12px",
  textAlign: "center",
  verticalAlign: "middle",
  fontSize: 12,
  fontWeight: 600,
  color: "#cbd5e1",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "8px 10px",
  textAlign: "center",
  color: "#e4e4e7",
};

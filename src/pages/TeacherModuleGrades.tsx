// cea-plataforma/web/src/pages/TeacherModuleGrades.tsx
// 🎨 VERSIÓN FINAL: Mejoras UX + Colores dinámicos + Mensajes amigables

import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useRole } from "../lib/useRole";
import logoCea from "../assets/logo-cea.png";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import TeacherDimensionGrades from "./TeacherDimensionGrades";

type DimKey = "ser" | "saber" | "hacer_proceso" | "hacer_producto" | "decidir";

type ModuleRow = {
  id: number;
  level_id: number;
  title: string;
  sort_order: number;
  grades_released: boolean;
};

type LevelRow = {
  id: number;
  name: string;
  sort_order: number;
  career_id: number;
};

type StudentProfile = {
  id: string;
  last_name_pat: string | null;
  last_name_mat: string | null;
  first_names: string | null;
};

function formatName(s: StudentProfile): string {
  const pat = s.last_name_pat ?? "";
  const mat = s.last_name_mat ?? "";
  const names = s.first_names ?? "";
  const surnames = [pat, mat].filter(Boolean).join(" ");
  return surnames ? `${surnames}, ${names}` : names;
}

type ModuleGrade = {
  student_id: string;
  module_id: number;
  ser: number | null;
  saber: number | null;
  hacer_proceso: number | null;
  hacer_producto: number | null;
  decidir: number | null;
  auto_ser: number | null;
  auto_decidir: number | null;
};

type StudentRow = {
  student: StudentProfile;
  grade: ModuleGrade;
  progress: number;
  suggestedHP: number;
  total: number;
  autoEvalFromStudent: { auto_ser: number | null; auto_decidir: number | null } | null;
};

// Límites de cada dimensión editable
const GRADE_LIMITS: Record<string, { min: number; max: number }> = {
  ser:            { min: 1, max: 10 },
  saber:          { min: 1, max: 30 },
  hacer_proceso:  { min: 1, max: 20 },
  hacer_producto: { min: 1, max: 20 },
  decidir:        { min: 1, max: 10 },
  auto_ser:       { min: 0, max: 5 },
  auto_decidir:   { min: 0, max: 5 },
};

function degreePrefix(degree: string | null): string {
  switch (degree) {
    case "ts":  return "T.S.";
    case "lic": return "Lic.";
    case "ing": return "Ing.";
    case "msc": return "M.Sc.";
    case "dr":  return "Dr.";
    default:    return "";
  }
}
function withDegree(name: string | null, degree: string | null): string {
  const p = degreePrefix(degree);
  if (!p || !name) return name ?? "";
  return `${p} ${name}`;
}

export default function TeacherModuleGrades() {
  const nav = useNavigate();
  const { loading, session, role } = useRole();
  const { moduleId } = useParams();

  const [moduleRow, setModuleRow] = useState<ModuleRow | null>(null);
  const [levelRow, setLevelRow] = useState<LevelRow | null>(null);
  const [careerName, setCareerName] = useState<string>("");
  const [teacherShift, setTeacherShift] = useState<string>("");
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [dirtyRows, setDirtyRows] = useState<Set<string>>(new Set());
  const [globalSaving, setGlobalSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [gradesReleased, setGradesReleased] = useState(false);
  const [releasingSaving, setReleasingSaving] = useState(false);
  const [shakingInputs, setShakingInputs] = useState<Set<string>>(new Set());
  const [autoEditingRows, setAutoEditingRows] = useState<Set<string>>(new Set());

  // Centralizador
  type CentralModule = { id: number; title: string; sort_order: number };
  type CentralRow = { student: StudentProfile; totals: (number | null)[]; avg: number | null };
  const [showCentralizador, setShowCentralizador] = useState(false);
  const [activeDim, setActiveDim] = useState<DimKey | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [centralizadorLoading, setCentralizadorLoading] = useState(false);
  const [centralizadorModules, setCentralizadorModules] = useState<CentralModule[]>([]);
  const [centralizadorRows, setCentralizadorRows] = useState<CentralRow[]>([]);
  const autoSaveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const rowsRef = useRef<StudentRow[]>([]);

  // Estados para el reporte PDF
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const defaultSemester = `${currentMonth <= 6 ? 1 : 2}/${currentYear}`;

  const [facilitator, setFacilitator] = useState("");
  const [director, setDirector] = useState("");
  const [semester, setSemester] = useState(defaultSemester);
  const [editingReport, setEditingReport] = useState(false);
  const [tempFacilitator, setTempFacilitator] = useState("");
  const [tempDirector, setTempDirector] = useState(director);
  const [tempSemester, setTempSemester] = useState(semester);
  const [extraPdfLoading, setExtraPdfLoading] = useState<string | null>(null);

  const isTeacherish = role === "teacher" || role === "admin";
  const mid = parseInt(moduleId ?? "", 10);
  const invalidMid = isNaN(mid) || mid <= 0;

  // Cargar configuración institucional (director, semestre activo)
  useEffect(() => {
    (async () => {
      try {
        // Load active semester from site_settings
        const { data: settingsData } = await supabase.from("site_settings").select("key,value").in("key", ["active_semester"]);
        if (settingsData && settingsData.length > 0) {
          const map = Object.fromEntries(settingsData.map((r) => [r.key, r.value ?? ""]));
          if (map["active_semester"]) {
            setSemester(map["active_semester"]);
            setTempSemester(map["active_semester"]);
          }
        }
        // Load director name from the administrativo profile
        const { data: directorData } = await supabase
          .from("profiles")
          .select("full_name,academic_degree")
          .eq("role", "administrativo")
          .eq("admin_type", "director")
          .single();
        if (directorData?.full_name) {
          const dirName = withDegree(directorData.full_name, directorData.academic_degree);
          setDirector(dirName);
          setTempDirector(dirName);
        }
      } catch { /* usar defaults */ }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mantener rowsRef sincronizado para acceso sin closures obsoletas
  useEffect(() => { rowsRef.current = rows; }, [rows]);

  // Ref para evitar recargas al cambiar de pestaña/ventana
  const loadedModuleRef = useRef<number | null>(null);
  useEffect(() => {
    if (!session || !isTeacherish || invalidMid) return;
    if (loadedModuleRef.current === mid) return;
    loadedModuleRef.current = mid;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, isTeacherish, mid, refreshKey]);

  async function loadAll() {
    setLoadingData(true);
    setMsg(null);

    try {
      const { data: teacherProfile, error: profError } = await supabase
        .from("profiles")
        .select("career_id, shift, full_name, academic_degree")
        .eq("id", session!.user.id)
        .single();

      if (profError || !teacherProfile) {
        setMsg("Error cargando perfil del docente");
        setLoadingData(false);
        return;
      }

      setTeacherShift(teacherProfile.shift || "");
      if (!facilitator) {
        const fullName = teacherProfile.full_name || "";
        const facilitatorName = withDegree(fullName, teacherProfile.academic_degree);
        setFacilitator(facilitatorName);
        setTempFacilitator(facilitatorName);
      }

      // Cargar nombre de la carrera
      if (teacherProfile.career_id) {
        const { data: career } = await supabase
          .from("careers")
          .select("name")
          .eq("id", teacherProfile.career_id)
          .single();

        if (career) {
          setCareerName(career.name);
        }
      }

      const { data: module, error: moduleError } = await supabase
        .from("modules")
        .select("id,level_id,title,sort_order,grades_released")
        .eq("id", mid)
        .single();

      if (moduleError || !module) {
        setMsg("Módulo no encontrado");
        setLoadingData(false);
        return;
      }

      setModuleRow(module as ModuleRow);
      setGradesReleased(!!(module as ModuleRow).grades_released);

      const { data: level, error: levelError } = await supabase
        .from("levels")
        .select("id,name,sort_order,career_id")
        .eq("id", module.level_id)
        .single();

      if (levelError || !level) {
        setMsg("Nivel no encontrado");
        setLoadingData(false);
        return;
      }

      setLevelRow(level as LevelRow);

      const { data: enrollments, error: enrollError } = await supabase
        .from("enrollments")
        .select("student_id,level_id")
        .eq("level_id", module.level_id);

      if (enrollError) {
        setMsg("Error cargando enrollments");
        setLoadingData(false);
        return;
      }

      const studentIds = (enrollments ?? []).map((e: { student_id: string }) => e.student_id);

      if (studentIds.length === 0) {
        setRows([]);
        setLoadingData(false);
        setMsg("No hay estudiantes en este nivel");
        return;
      }

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id,last_name_pat,last_name_mat,first_names")
        .in("id", studentIds)
        .eq("career_id", teacherProfile.career_id)
        .eq("shift", teacherProfile.shift)
        .order("last_name_pat")
        .order("last_name_mat")
        .order("first_names");

      if (profilesError) {
        setMsg("Error cargando estudiantes");
        setLoadingData(false);
        return;
      }

      const students = (profiles ?? []) as unknown as StudentProfile[];

      if (students.length === 0) {
        setRows([]);
        setLoadingData(false);
        setMsg("No hay estudiantes de tu carrera y turno en este nivel");
        return;
      }

      const { data: progressData } = await supabase
        .from("v_module_progress")
        .select("student_id,progress_percent")
        .eq("module_id", mid)
        .in(
          "student_id",
          students.map((s) => s.id),
        );

      const progressMap = new Map<string, number>();
      if (progressData) {
        for (const p of progressData) {
          progressMap.set(p.student_id, p.progress_percent || 0);
        }
      }

      const { data: grades } = await supabase
        .from("module_grades")
        .select(
          "student_id,module_id,ser,saber,hacer_proceso,hacer_producto,decidir,auto_ser,auto_decidir",
        )
        .eq("module_id", mid)
        .in(
          "student_id",
          students.map((s) => s.id),
        );

      const gradesMap = new Map<string, ModuleGrade>();
      if (grades) {
        for (const g of grades) {
          gradesMap.set(g.student_id, g as ModuleGrade);
        }
      }

      // Leer auto_eval_responses directamente (los estudiantes escriben aquí con éxito)
      // Esto garantiza que auto_ser y auto_decidir aparezcan aunque module_grades.auto_ser sea null
      const { data: autoActs } = await supabase
        .from("auto_eval_activities")
        .select("id, dimension")
        .eq("module_id", mid);

      const autoActIds = (autoActs ?? []).map((a: { id: number }) => a.id);
      const autoSerActId  = (autoActs ?? []).find((a: { dimension: string }) => a.dimension === "auto_ser")?.id ?? null;
      const autoDecActId  = (autoActs ?? []).find((a: { dimension: string }) => a.dimension === "auto_decidir")?.id ?? null;

      // Mapa studentId -> { auto_ser: number|null, auto_decidir: number|null }
      const autoEvalMap = new Map<string, { auto_ser: number | null; auto_decidir: number | null }>();
      if (autoActIds.length > 0) {
        const { data: autoResps } = await supabase
          .from("auto_eval_responses")
          .select("activity_id, student_id, final_score")
          .in("activity_id", autoActIds)
          .in("student_id", students.map((s) => s.id));

        for (const resp of autoResps ?? []) {
          const cur = autoEvalMap.get(resp.student_id) ?? { auto_ser: null, auto_decidir: null };
          if (resp.activity_id === autoSerActId) cur.auto_ser = resp.final_score !== null ? Math.round(resp.final_score) : null;
          if (resp.activity_id === autoDecActId) cur.auto_decidir = resp.final_score !== null ? Math.round(resp.final_score) : null;
          autoEvalMap.set(resp.student_id, cur);
        }
      }

      const studentRows: StudentRow[] = students.map((student) => {
        const existingGrade = gradesMap.get(student.id);
        const autoEval = autoEvalMap.get(student.id);
        const progress = progressMap.get(student.id) || 0;
        const suggestedHP = Math.round((progress / 100) * 20);

        const r = (v: number | null) => v !== null ? Math.round(v) : null;
        const grade: ModuleGrade = existingGrade ? {
          ...existingGrade,
          ser: r(existingGrade.ser),
          saber: r(existingGrade.saber),
          hacer_proceso: r(existingGrade.hacer_proceso),
          hacer_producto: r(existingGrade.hacer_producto),
          decidir: r(existingGrade.decidir),
          // module_grades tiene prioridad; auto_eval_responses solo se usa como fallback cuando el docente no ha editado
          auto_ser: r(existingGrade.auto_ser) ?? autoEval?.auto_ser ?? null,
          auto_decidir: r(existingGrade.auto_decidir) ?? autoEval?.auto_decidir ?? null,
        } : {
          student_id: student.id,
          module_id: mid,
          ser: null,
          saber: null,
          hacer_proceso: null,
          hacer_producto: null,
          decidir: null,
          auto_ser: autoEval?.auto_ser ?? null,
          auto_decidir: autoEval?.auto_decidir ?? null,
        };

        return {
          student,
          grade,
          progress,
          suggestedHP,
          total: calculateTotal(grade, suggestedHP),
          autoEvalFromStudent: autoEval ?? null,
        };
      });

      setRows(studentRows);
      setLoadingData(false);

      // Sincronizar auto_ser / auto_decidir a module_grades solo cuando module_grades aún no tiene valor
      // (si el docente ya editó manualmente, no se sobreescribe con la respuesta del estudiante)
      const syncRows = studentRows.filter((sr) => {
        const ae = autoEvalMap.get(sr.student.id);
        if (!ae) return false;
        const existing = gradesMap.get(sr.student.id);
        return (
          (ae.auto_ser !== null && (existing?.auto_ser ?? null) === null) ||
          (ae.auto_decidir !== null && (existing?.auto_decidir ?? null) === null)
        );
      });

      for (const sr of syncRows) {
        const ae = autoEvalMap.get(sr.student.id)!;
        const existing = gradesMap.get(sr.student.id);
        await supabase.from("module_grades").upsert(
          {
            student_id: sr.student.id,
            module_id: mid,
            auto_ser: (existing?.auto_ser ?? null) === null ? ae.auto_ser : existing!.auto_ser,
            auto_decidir: (existing?.auto_decidir ?? null) === null ? ae.auto_decidir : existing!.auto_decidir,
          },
          { onConflict: "student_id,module_id" },
        );
      }
    } catch (error) {
      console.error("Error:", error);
      setMsg("Error cargando datos");
      setLoadingData(false);
    }
  }

  // Mínimos proporcionales por dimensión (escala 20-100)
  const DIM_MIN = { ser: 2, saber: 6, hacer_proceso: 4, hacer_producto: 4, decidir: 2, auto_ser: 1, auto_decidir: 1 };

  function applyDimMin(val: number | null, min: number): number {
    if (val === null) return min;
    return val;
  }

  function calculateTotal(grade: ModuleGrade, suggestedHP: number): number {
    const ser        = applyDimMin(grade.ser,           DIM_MIN.ser);
    const saber      = applyDimMin(grade.saber,         DIM_MIN.saber);
    const hacerProc  = applyDimMin(grade.hacer_proceso ?? suggestedHP, DIM_MIN.hacer_proceso);
    const hacerProd  = applyDimMin(grade.hacer_producto, DIM_MIN.hacer_producto);
    const decidir    = applyDimMin(grade.decidir,        DIM_MIN.decidir);
    const autoSer    = applyDimMin(grade.auto_ser,       DIM_MIN.auto_ser);
    const autoDecid  = applyDimMin(grade.auto_decidir,   DIM_MIN.auto_decidir);

    return Math.max(Math.round(ser + saber + hacerProc + hacerProd + decidir + autoSer + autoDecid), 20);
  }

  function triggerShake(studentId: string, field: string) {
    const key = `${studentId}-${field}`;
    setShakingInputs((prev) => new Set(prev).add(key));
    setTimeout(() => {
      setShakingInputs((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }, 450);
  }

  function updateGradeField(
    studentId: string,
    field: keyof ModuleGrade,
    value: string,
  ) {
    const numValue = value.trim() === "" ? null : Number(value);

    // Si el valor está fuera del rango: vibrar y NO actualizar
    if (numValue !== null && field in GRADE_LIMITS) {
      const limits = GRADE_LIMITS[field as string];
      if (numValue < limits.min || numValue > limits.max) {
        triggerShake(studentId, field as string);
        return;
      }
    }

    setRows((prev) =>
      prev.map((row) => {
        if (row.student.id !== studentId) return row;
        const updatedGrade = { ...row.grade, [field]: numValue };
        return {
          ...row,
          grade: updatedGrade,
          total: calculateTotal(updatedGrade, row.suggestedHP),
        };
      }),
    );

    // Marcar como pendiente y programar auto-guardado
    setDirtyRows((prev) => new Set(prev).add(studentId));
    const existing = autoSaveTimers.current.get(studentId);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => {
      autoSaveTimers.current.delete(studentId);
      void saveGradeQuiet(studentId);
    }, 700);
    autoSaveTimers.current.set(studentId, timer);
  }

  function getProgressColor(progress: number): string {
    if (progress >= 70) return "from-emerald-500 to-emerald-600";
    if (progress >= 51) return "from-amber-500 to-amber-600";
    return "from-red-500 to-red-600";
  }

  function getProgressTextColor(progress: number): string {
    if (progress >= 70) return "text-emerald-400";
    if (progress >= 51) return "text-amber-400";
    return "text-red-400";
  }

  function getObservation(total: number): { text: string; color: string } {
    if (total <= 50) return { text: "Postergado", color: "text-red-400" };
    if (total <= 75) return { text: "Promovido", color: "text-emerald-400" };
    return { text: "Promovido Excelente", color: "text-blue-400" };
  }


  // Guarda una fila usando rowsRef (sin efectos secundarios en state updaters)
  async function saveGradeQuiet(studentId: string) {
    const row = rowsRef.current.find((r) => r.student.id === studentId);
    if (!row) return;
    const hacerProcesoFinal = row.grade.hacer_proceso ?? row.suggestedHP;
    const { error } = await supabase.from("module_grades").upsert(
      {
        student_id: row.student.id,
        module_id: mid,
        ser: row.grade.ser,
        saber: row.grade.saber,
        hacer_proceso: hacerProcesoFinal,
        hacer_producto: row.grade.hacer_producto,
        decidir: row.grade.decidir,
        auto_ser: row.grade.auto_ser,
        auto_decidir: row.grade.auto_decidir,
      },
      { onConflict: "student_id,module_id" },
    );
    if (!error) {
      setDirtyRows((prev) => { const next = new Set(prev); next.delete(studentId); return next; });
      const now = new Date();
      setSavedAt(`${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}`);
    }
  }

  // Vacía los timers pendientes y guarda inmediatamente antes de recargar datos
  async function flushDirtyRows() {
    const pendingIds = [...autoSaveTimers.current.keys()];
    for (const timer of autoSaveTimers.current.values()) clearTimeout(timer);
    autoSaveTimers.current.clear();
    if (pendingIds.length === 0) return;
    await Promise.all(
      pendingIds.map(async (studentId) => {
        const row = rowsRef.current.find((r) => r.student.id === studentId);
        if (!row) return;
        const hacerProcesoFinal = row.grade.hacer_proceso ?? row.suggestedHP;
        await supabase.from("module_grades").upsert(
          {
            student_id: row.student.id,
            module_id: mid,
            ser: row.grade.ser,
            saber: row.grade.saber,
            hacer_proceso: hacerProcesoFinal,
            hacer_producto: row.grade.hacer_producto,
            decidir: row.grade.decidir,
            auto_ser: row.grade.auto_ser,
            auto_decidir: row.grade.auto_decidir,
          },
          { onConflict: "student_id,module_id" },
        );
      }),
    );
    setDirtyRows(new Set());
  }

  // Guardado global (botón "Guardar cambios")
  async function saveAllGrades() {
    setGlobalSaving(true);
    let anyError = false;
    // Capturar snapshot actual de rows
    const snapshot = rows;
    for (const row of snapshot) {
      const hacerProcesoFinal = row.grade.hacer_proceso ?? row.suggestedHP;
      const { error } = await supabase.from("module_grades").upsert(
        {
          student_id: row.student.id,
          module_id: mid,
          ser: row.grade.ser,
          saber: row.grade.saber,
          hacer_proceso: hacerProcesoFinal,
          hacer_producto: row.grade.hacer_producto,
          decidir: row.grade.decidir,
          auto_ser: row.grade.auto_ser,
          auto_decidir: row.grade.auto_decidir,
        },
        { onConflict: "student_id,module_id" },
      );
      if (error) anyError = true;
    }
    setGlobalSaving(false);
    if (anyError) {
      setMsg("❌ Algunos cambios no se pudieron guardar. Intenta de nuevo.");
    } else {
      setDirtyRows(new Set());
      const now = new Date();
      const time = `${now.getHours().toString().padStart(2,"0")}:${now.getMinutes().toString().padStart(2,"0")}`;
      setSavedAt(time);
      setMsg(`✅ Todos los cambios guardados a las ${time}`);
      setTimeout(() => setMsg(null), 3000);
    }
  }

  function handleEditReport() {
    setTempFacilitator(facilitator);
    setTempDirector(director);
    setTempSemester(semester);
    setEditingReport(true);
  }

  function handleSaveReport() {
    setFacilitator(tempFacilitator);
    setDirector(tempDirector);
    setSemester(tempSemester);
    setEditingReport(false);
  }

  function handleCancelEdit() {
    setEditingReport(false);
  }

  async function generatePDF() {
    const doc = new jsPDF({ orientation: "landscape" });
    const pageWidth = doc.internal.pageSize.getWidth();   // 297mm (A4 landscape)
    const pageHeight = doc.internal.pageSize.getHeight(); // 210mm

    // ── Logo ──────────────────────────────────────────────────────────────────
    const logoImg = new Image();
    logoImg.src = logoCea;
    await new Promise((resolve) => { logoImg.onload = resolve; });
    const canvas = document.createElement("canvas");
    canvas.width = logoImg.width; canvas.height = logoImg.height;
    canvas.getContext("2d")?.drawImage(logoImg, 0, 0);
    const logoBase64 = canvas.toDataURL("image/png");
    doc.addImage(logoBase64, "PNG", 10, 5, 18, 18);

    // ── Título centrado ───────────────────────────────────────────────────────
    doc.setFontSize(12); doc.setFont("helvetica", "bold");
    doc.text("Reporte de Calificaciones Modular", pageWidth / 2, 17, { align: "center" });

    // ── Datos generales (espaciado reducido a 4.5 mm entre filas) ─────────────
    const turnoCapitalized = teacherShift.charAt(0).toUpperCase() + teacherShift.slice(1).toLowerCase();
    doc.setFontSize(8.5);
    const startY = 27;          // sube 3 mm respecto al anterior (era 30)
    const sp     = 4.5;         // separación entre filas (era 6 mm)
    const leftX  = 10, midX = pageWidth / 3, rightX = (pageWidth / 3) * 2;

    doc.setFont("helvetica", "bold");   doc.text("CEA:", leftX, startY);
    doc.setFont("helvetica", "normal"); doc.text("Madre María Oliva", leftX + 11, startY);
    doc.setFont("helvetica", "bold");   doc.text("Facilitador(a):", leftX, startY + sp);
    doc.setFont("helvetica", "normal"); doc.text(facilitator, leftX + 27, startY + sp);
    doc.setFont("helvetica", "bold");   doc.text("Director(a):", leftX, startY + sp * 2);
    doc.setFont("helvetica", "normal"); doc.text(director, leftX + 23, startY + sp * 2);

    doc.setFont("helvetica", "bold");   doc.text("Carrera:", midX, startY);
    doc.setFont("helvetica", "normal"); doc.text(careerName, midX + 17, startY);
    doc.setFont("helvetica", "bold");   doc.text("Módulo:", midX, startY + sp);
    doc.setFont("helvetica", "normal"); doc.text(moduleRow?.title || "", midX + 16, startY + sp);
    doc.setFont("helvetica", "bold");   doc.text("Nivel:", midX, startY + sp * 2);
    doc.setFont("helvetica", "normal"); doc.text(levelRow?.name || "", midX + 12, startY + sp * 2);

    doc.setFont("helvetica", "bold");   doc.text("Semestre:", rightX, startY);
    doc.setFont("helvetica", "normal"); doc.text(semester, rightX + 19, startY);
    doc.setFont("helvetica", "bold");   doc.text("Turno:", rightX, startY + sp);
    doc.setFont("helvetica", "normal"); doc.text(turnoCapitalized, rightX + 13, startY + sp);

    // ── Datos de la tabla ─────────────────────────────────────────────────────
    const tableData = rows.map((row, index) => {
      const obs = getObservation(row.total);
      return [
        index + 1,
        formatName(row.student),
        row.grade.ser ?? "",
        row.grade.saber ?? "",
        row.grade.hacer_proceso ?? row.suggestedHP,
        row.grade.hacer_producto ?? "",
        row.grade.decidir ?? "",
        row.grade.auto_ser ?? "",
        row.grade.auto_decidir ?? "",
        row.total,
        obs.text,
      ];
    });

    // Etiquetas rotadas para columnas de notas (índices 2-9)
    // Cada entrada es un array de líneas; las de 2 líneas se dibujan en paralelo
    const GRADE_LABELS: string[][] = [
      ["SER (10)"],
      ["SABER (30)"],
      ["HACER",    "PROCESO(20)"],
      ["HACER",    "PRODUCTO(20)"],
      ["DECIDIR (10)"],
      ["AUTOEVA",  "SER (5)"],
      ["AUTOEVA",  "DEC (5)"],
      ["TOTAL (100)"],
    ];

    // ── Layout: tabla al 80% del ancho, centrada ─────────────────────────────
    const TABLE_WIDTH   = pageWidth * 0.80;          // ≈ 238 mm
    const SIDE_MARGIN   = (pageWidth - TABLE_WIDTH) / 2;
    const TABLE_START_Y = startY + sp * 2 + 8;       // ≈ 44 mm
    // Con etiquetas en 2 líneas la más larga es "PRODUCTO(20)" ≈ 12 chars × 1mm = 12mm
    const HEADER_ROW_H  = 16;                        // reducido de 22 a 16 mm
    const SIG_BLOCK_H   = 16;                        // espacio para línea + texto de firma
    const sigGap        = 6;                         // separación tabla → firma
    const BOTTOM_PAD    = 4;
    const n = rows.length;

    // Columnas: anchos que suman ≈ TABLE_WIDTH (238 mm)
    const COL_W = { num: 9, name: 86, grade: 14, total: 16, obs: 29 };

    // bodyAvailH incluye sigGap para garantizar que las firmas quepan en la misma hoja
    const bodyAvailH = pageHeight - TABLE_START_Y - HEADER_ROW_H - sigGap - SIG_BLOCK_H - BOTTOM_PAD;
    // Filas más compactas; mínimo 4.5 mm para que el texto de 7-8 pt sea legible
    const bodyRowH   = n <= 20 ? Math.max(4.5, bodyAvailH / n) : 6;
    const bodyFontSize = bodyRowH < 5.2 ? 7 : 8;

    autoTable(doc, {
      startY: TABLE_START_Y,
      margin: { left: SIDE_MARGIN, right: SIDE_MARGIN },
      // Columnas 2-9: texto vacío — se dibuja rotado en didDrawCell
      head: [["N°", "Participante", "", "", "", "", "", "", "", "", "OBS"]],
      body: tableData,
      theme: "grid",
      headStyles: {
        fillColor: [235, 235, 235],
        textColor: [0, 0, 0],
        fontStyle: "bold",
        halign: "center",
        valign: "bottom",
        fontSize: 7,
        cellPadding: { top: 1, right: 1, bottom: 2, left: 1 },
        minCellHeight: HEADER_ROW_H,
      },
      bodyStyles: {
        fontSize: bodyFontSize,
        cellPadding: { top: 1, right: 1, bottom: 1, left: 1 },
        minCellHeight: bodyRowH,
      },
      styles: {
        lineColor: [180, 180, 180],
        lineWidth: 0.2,
      },
      columnStyles: {
        0:  { halign: "center", cellWidth: COL_W.num },
        1:  { halign: "left",   cellWidth: COL_W.name },
        2:  { halign: "center", cellWidth: COL_W.grade },
        3:  { halign: "center", cellWidth: COL_W.grade },
        4:  { halign: "center", cellWidth: COL_W.grade },
        5:  { halign: "center", cellWidth: COL_W.grade },
        6:  { halign: "center", cellWidth: COL_W.grade },
        7:  { halign: "center", cellWidth: COL_W.grade },
        8:  { halign: "center", cellWidth: COL_W.grade },
        9:  { halign: "center", cellWidth: COL_W.total, fontStyle: "bold" },
        10: { halign: "center", cellWidth: COL_W.obs },
      },
      // Suprimir texto por defecto en celdas de encabezado rotadas
      willDrawCell: (data) => {
        if (data.section === "head" && data.column.index >= 2 && data.column.index <= 9) {
          (data.cell as unknown as { text: string[] }).text = [];
        }
      },
      // Dibujar texto rotado 90° en cada celda de encabezado de nota
      didDrawCell: (data) => {
        if (data.section === "head" && data.column.index >= 2 && data.column.index <= 9) {
          const lines = GRADE_LABELS[data.column.index - 2];
          const cx = data.cell.x + data.cell.width / 2;
          const y  = data.cell.y + data.cell.height - 2;
          doc.setFontSize(5);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(0, 0, 0);
          if (lines.length === 1) {
            doc.text(lines[0], cx, y, { angle: 90, align: "left" });
          } else {
            // Dos líneas: separadas ~2 mm horizontalmente (que al rotar = "profundidad")
            doc.text(lines[0], cx - 1.5, y, { angle: 90, align: "left" });
            doc.text(lines[1], cx + 1.5, y, { angle: 90, align: "left" });
          }
        }
      },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 10) {
          const obs = data.cell.raw as string;
          if (obs === "Postergado")               data.cell.styles.textColor = [220, 53, 69];
          else if (obs === "Promovido")            data.cell.styles.textColor = [40, 167, 69];
          else if (obs === "Promovido Excelente")  data.cell.styles.textColor = [0, 123, 255];
        }
        if (data.section === "body" && data.column.index === 9) {
          const total = data.cell.raw as number;
          if      (total === 0)               data.cell.styles.textColor = [100, 100, 100];
          else if (total >= 1 && total <= 50)  data.cell.styles.textColor = [220, 53, 69];
          else if (total >= 51 && total <= 75) data.cell.styles.textColor = [40, 167, 69];
          else if (total >= 76)               data.cell.styles.textColor = [0, 123, 255];
        }
      },
    });

    // ── Firmas: siempre debajo, sin superponerse; misma hoja si ≤20 alumnos ──
    const finalY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

    let sigY: number;
    if (finalY + sigGap + SIG_BLOCK_H > pageHeight - BOTTOM_PAD) {
      doc.addPage();
      sigY = 35;
    } else {
      sigY = finalY + sigGap;
    }

    doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(0, 0, 0);
    const firmaLeftX  = pageWidth / 4;
    const firmaRightX = (pageWidth / 4) * 3;
    doc.line(firmaLeftX - 35,  sigY, firmaLeftX + 35,  sigY);
    doc.text("Facilitador(a)", firmaLeftX,  sigY + 5, { align: "center" });
    doc.line(firmaRightX - 35, sigY, firmaRightX + 35, sigY);
    doc.text("Dirección",      firmaRightX, sigY + 5, { align: "center" });

    const fileName = `Calificaciones_${moduleRow?.title?.replace(/\s+/g, "_") || "Modulo"}_${semester.replace("/", "-")}.pdf`;
    doc.save(fileName);
  }

  // ─── PDFs adicionales ────────────────────────────────────────────────────────

  // Mismo enfoque que generatePDF (que funciona): y en fondo de celda, align:"left"
  function drawDimLabel(
    doc: jsPDF,
    cell: { x: number; y: number; width: number; height: number },
    text: string,
  ) {
    const cx = cell.x + cell.width / 2;
    const y = cell.y + cell.height - 2;
    const ptPerMm = doc.internal.scaleFactor;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(5);
    doc.setTextColor(0, 0, 0);
    const lines = doc.splitTextToSize(text, cell.height - 4) as string[];
    if (lines.length === 1) {
      doc.text(lines[0], cx, y, { angle: 90, align: "left" });
    } else {
      const lh = (5 * 1.2) / ptPerMm;
      lines.forEach((line: string, i: number) => {
        doc.text(line, cx + (i - (lines.length - 1) / 2) * lh, y, { angle: 90, align: "left" });
      });
    }
  }

  async function loadLogoBase64(): Promise<string | null> {
    try {
      return await new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          const c = document.createElement("canvas");
          c.width = img.naturalWidth; c.height = img.naturalHeight;
          const ctx = c.getContext("2d");
          if (!ctx) { reject("no ctx"); return; }
          ctx.drawImage(img, 0, 0);
          resolve(c.toDataURL("image/png"));
        };
        img.onerror = () => reject("error");
        img.src = logoCea;
      });
    } catch { return null; }
  }

  async function exportDimsPdf() {
    setExtraPdfLoading("dims");
    try {
      const logo = await loadLogoBase64();
      const doc = new jsPDF({ orientation: "landscape" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const marginX = 10;
      const usableWidth = pageWidth - marginX * 2;
      const studentList = rows.map((r) => r.student);
      const studentIds = studentList.map((s) => s.id);

      // Cargar asistencia para SER/DECIDIR
      const { data: attendRows } = await supabase
        .from("attendance").select("student_id, status").in("student_id", studentIds);
      const attendMap = new Map<string, { total: number; present: number }>();
      for (const sid of studentIds) attendMap.set(sid, { total: 0, present: 0 });
      for (const a of attendRows ?? []) {
        const cur = attendMap.get(a.student_id) ?? { total: 0, present: 0 };
        cur.total++;
        if (a.status === "P") cur.present++;
        attendMap.set(a.student_id, cur);
      }
      const getPct = (sid: string) => {
        const att = attendMap.get(sid) ?? { total: 0, present: 0 };
        return att.total > 0 ? Math.round((att.present / att.total) * 100) : 0;
      };

      const { data: lessons } = await supabase
        .from("lessons").select("id, sort_order").eq("module_id", mid).order("sort_order");
      const lessonIds = (lessons ?? []).map((l: { id: number }) => l.id);
      const lessonOrder = new Map(
        (lessons ?? []).map((l: { id: number; sort_order: number }) => [l.id, l.sort_order]),
      );

      // Indicadores fijos de SER/DECIDIR
      const FIXED_COLS = {
        ser: [
          { title: "Asiste y trabaja con responsabilidad (Asistencia %)", isAuto: true },
          { title: "Respeta las normas del aula/taller", isAuto: false },
        ],
        decidir: [
          { title: "Participa en aula (Asistencia %)", isAuto: true },
          { title: "Corrige errores y mejora su trabajo", isAuto: false },
        ],
      };

      type DimSpec = { key: string; label: string; max: number; min: number; fixed?: boolean };
      const DIMS: DimSpec[] = [
        { key: "ser",            label: "SER",            max: 10, min: 2, fixed: true },
        { key: "saber",          label: "SABER",          max: 30, min: 6 },
        { key: "hacer_proceso",  label: "HACER Proceso",  max: 20, min: 4 },
        { key: "hacer_producto", label: "HACER Producto", max: 20, min: 4 },
        { key: "decidir",        label: "DECIDIR",        max: 10, min: 2, fixed: true },
      ];

      for (let di = 0; di < DIMS.length; di++) {
        const { key: dk, label, max, min, fixed } = DIMS[di];

        if (di > 0) doc.addPage();
        if (logo) doc.addImage(logo, "PNG", 10, 6, 20, 20);
        doc.setFontSize(11); doc.setFont("helvetica", "bold");
        doc.text("C.E.A. Madre María Oliva", pageWidth / 2, 12, { align: "center" });
        doc.setFontSize(9); doc.setFont("helvetica", "normal");
        doc.text(`Registro ${label} (${max} pts) — ${moduleRow?.title ?? ""}`, pageWidth / 2, 18, { align: "center" });
        doc.text(`${careerName} | ${levelRow?.name ?? ""} | Facilitador/a: ${facilitator}`, pageWidth / 2, 23, { align: "center" });

        if (fixed) {
          // ── SER / DECIDIR: indicadores fijos con asistencia ──
          const fixedCols = dk === "ser" ? FIXED_COLS.ser : FIXED_COLS.decidir;
          const totalColIdx = fixedCols.length + 2;
          const nw = 10, sw = 110, gw = 22, tw = 20;
          const tblW = nw + sw + fixedCols.length * gw + tw;
          const tblX = marginX + Math.max(0, (usableWidth - tblW) / 2);
          const gradeField = dk === "ser" ? "ser" : "decidir";

          const colStyles: Record<number, object> = {
            0: { cellWidth: nw, halign: "center" },
            1: { cellWidth: sw, halign: "left", overflow: "hidden" },
            [totalColIdx]: { cellWidth: tw, halign: "center" },
          };
          fixedCols.forEach((_, i) => { colStyles[i + 2] = { cellWidth: gw, halign: "center" }; });

          autoTable(doc, {
            head: [["N°", "Estudiante", ...fixedCols.map((c) => c.title), `TOTAL (${max})`]],
            body: studentList.map((s, idx) => {
              const pct = getPct(s.id);
              const autoNote = Math.round((pct / 100) * max);
              const total = rows.find((r) => r.student.id === s.id)?.grade[gradeField as "ser" | "decidir"] ?? min;
              return [
                String(idx + 1), formatName(s),
                ...fixedCols.map((c) => (c.isAuto ? String(autoNote) : "")),
                String(total),
              ];
            }),
            startY: 30,
            margin: { left: tblX, right: tblX },
            tableWidth: tblW,
            theme: "grid",
            styles: { fontSize: 8, textColor: [0, 0, 0], cellPadding: 1.6, lineColor: [180, 180, 180], lineWidth: 0.2, halign: "center", valign: "middle", overflow: "linebreak" },
            headStyles: { fillColor: [235, 235, 235], fontSize: 6, textColor: [0, 0, 0], minCellHeight: 36, cellPadding: 1, fontStyle: "bold", halign: "center", valign: "middle" },
            bodyStyles: { halign: "center", valign: "middle" },
            columnStyles: colStyles,
            willDrawCell: (data) => {
              if (data.section === "head" && data.column.index >= 2 && data.column.index < 2 + fixedCols.length)
                (data.cell as { text: string[] }).text = [];
            },
            didDrawCell: (data) => {
              if (data.section === "head" && data.column.index >= 2 && data.column.index < 2 + fixedCols.length)
                drawDimLabel(doc, data.cell, fixedCols[data.column.index - 2]?.title ?? "");
            },
          });
        } else {
          // ── SABER / HACER PROCESO / HACER PRODUCTO: desde dimension_grades ──
          let dimCols: { section_id: number; title: string }[] = [];
          const dimCells = new Map<string, number | null>();

          if (lessonIds.length > 0) {
            const { data: sections } = await supabase
              .from("lesson_sections").select("id, title, lesson_id, sort_order")
              .in("lesson_id", lessonIds).eq("dimension", dk).eq("is_active", true);

            dimCols = ((sections ?? []) as { id: number; title: string; lesson_id: number; sort_order: number }[])
              .sort((a, b) => {
                const lo = (lessonOrder.get(a.lesson_id) ?? 0) - (lessonOrder.get(b.lesson_id) ?? 0);
                return lo !== 0 ? lo : a.sort_order - b.sort_order;
              })
              .map((s) => ({ section_id: s.id, title: s.title }));

            if (dimCols.length > 0) {
              const { data: dg } = await supabase
                .from("dimension_grades").select("student_id, section_id, score")
                .in("section_id", dimCols.map((c) => c.section_id)).in("student_id", studentIds);
              for (const g of dg ?? []) dimCells.set(`${g.student_id}_${g.section_id}`, g.score);
            }
          }

          const dimAvgs = new Map<string, number>();
          for (const s of studentList) {
            const scores = dimCols.map((c) => dimCells.get(`${s.id}_${c.section_id}`) ?? null);
            const valid = scores.filter((v) => v !== null) as number[];
            const avg = valid.length === 0 ? min
              : Math.min(Math.max(Math.round(valid.reduce((a, b) => a + b, 0) / valid.length), min), max);
            dimAvgs.set(s.id, avg);
          }

          // Anchos adaptativos: reducir gw y sw para que todo quepa en una hoja
          const actCount = dimCols.length;
          const NW = 10, TW = 18;
          let sw = 90, gw = 16;
          if (actCount > 0 && NW + sw + actCount * gw + TW > usableWidth) {
            gw = Math.max(7, Math.floor((usableWidth - NW - sw - TW) / actCount));
            if (NW + sw + actCount * gw + TW > usableWidth)
              sw = Math.max(55, usableWidth - NW - actCount * gw - TW);
          }
          const tblW = Math.min(NW + sw + actCount * gw + TW, usableWidth);
          const tblX = marginX + Math.max(0, (usableWidth - tblW) / 2);
          const totalColIdx = actCount + 2;
          const headFs = gw <= 9 ? 5 : 6;
          const bodyFs = gw <= 9 ? 7 : 8;

          const colStyles: Record<number, object> = {
            0: { cellWidth: NW, halign: "center" },
            1: { cellWidth: sw, halign: "left", overflow: "hidden" },
            [totalColIdx]: { cellWidth: TW, halign: "center" },
          };
          for (let i = 0; i < actCount; i++) colStyles[i + 2] = { cellWidth: gw, halign: "center" };

          autoTable(doc, {
            head: [["N°", "Estudiante", ...dimCols.map((c) => c.title), `TOTAL (${max})`]],
            body: studentList.map((s, idx) => [
              String(idx + 1), formatName(s),
              ...dimCols.map((c) => {
                const v = dimCells.get(`${s.id}_${c.section_id}`);
                return v !== null && v !== undefined ? String(Math.round(Number(v))) : "-";
              }),
              String(dimAvgs.get(s.id) ?? min),
            ]),
            startY: 30,
            margin: { left: tblX, right: tblX },
            tableWidth: tblW,
            theme: "grid",
            styles: { fontSize: bodyFs, textColor: [0, 0, 0], cellPadding: 1.4, lineColor: [180, 180, 180], lineWidth: 0.2, halign: "center", valign: "middle", overflow: "linebreak" },
            headStyles: { fillColor: [235, 235, 235], fontSize: headFs, textColor: [0, 0, 0], minCellHeight: 36, cellPadding: 1, fontStyle: "bold", halign: "center", valign: "middle" },
            bodyStyles: { halign: "center", valign: "middle" },
            columnStyles: colStyles,
            willDrawCell: (data) => {
              if (data.section === "head" && data.column.index >= 2 && data.column.index < 2 + actCount)
                (data.cell as { text: string[] }).text = [];
            },
            didDrawCell: (data) => {
              if (data.section === "head" && data.column.index >= 2 && data.column.index < 2 + actCount)
                drawDimLabel(doc, data.cell, dimCols[data.column.index - 2]?.title ?? "");
            },
          });
        }
      }

      doc.save(`registro_dimensiones_modulo${mid}.pdf`);
    } finally { setExtraPdfLoading(null); }
  }

  async function exportAutoEvalTemplatePdf() {
    setExtraPdfLoading("autoeval");
    try {
      const { data: acts } = await supabase
        .from("auto_eval_activities").select("id, dimension, indicators").eq("module_id", mid);

      if (!acts || acts.length === 0) {
        alert("No hay actividades de autoevaluación para este módulo.");
        return;
      }

      const logo = await loadLogoBase64();
      const doc = new jsPDF({ orientation: "portrait" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const marginX = 15;

      (acts as { id: number; dimension: string; indicators: unknown }[]).forEach((act, ai) => {
        const indicators = Array.isArray(act.indicators) ? (act.indicators as string[]) : [];
        const dimLabel = act.dimension === "auto_ser" ? "SER" : "DECIDIR";

        if (ai > 0) doc.addPage();
        if (logo) doc.addImage(logo, "PNG", 10, 6, 18, 18);
        doc.setFontSize(12); doc.setFont("helvetica", "bold");
        doc.text("C.E.A. Madre María Oliva", pageWidth / 2, 14, { align: "center" });
        doc.setFontSize(10);
        doc.text(`Autoevaluación — Dimensión ${dimLabel}`, pageWidth / 2, 21, { align: "center" });
        doc.setFontSize(8); doc.setFont("helvetica", "normal");
        doc.text(`${moduleRow?.title ?? ""} | ${levelRow?.name ?? ""} | ${careerName}`, pageWidth / 2, 27, { align: "center" });

        // Línea nombre del estudiante
        doc.setFontSize(10); doc.setFont("helvetica", "normal");
        doc.text("Estudiante: _____________________________________________", marginX, 35);
        doc.text("Fecha: ___________________", pageWidth - marginX - 55, 35);

        // Instrucción
        doc.setFontSize(8);
        doc.text("Instrucciones: Marca con una X el valor que mejor describe tu desempeño (1=Inicio · 2=Proceso · 3=Logro · 4=Logro destacado · 5=Excelente)", marginX, 41, {
          maxWidth: pageWidth - marginX * 2,
        });

        // Tabla de indicadores
        autoTable(doc, {
          startY: 47,
          margin: { left: marginX, right: marginX },
          head: [["N°", "Indicador", "1", "2", "3", "4", "5"]],
          body: indicators.map((ind, i) => [String(i + 1), ind, "", "", "", "", ""]),
          theme: "grid",
          styles: { fontSize: 9, textColor: [0, 0, 0], cellPadding: 3, lineColor: [160, 160, 160], lineWidth: 0.2 },
          headStyles: { fillColor: [235, 235, 235], fontStyle: "bold", halign: "center", fontSize: 9 },
          columnStyles: {
            0: { cellWidth: 10, halign: "center" },
            1: { cellWidth: pageWidth - marginX * 2 - 10 - 30, halign: "left" },
            2: { cellWidth: 6, halign: "center" },
            3: { cellWidth: 6, halign: "center" },
            4: { cellWidth: 6, halign: "center" },
            5: { cellWidth: 6, halign: "center" },
            6: { cellWidth: 6, halign: "center" },
          },
          bodyStyles: { minCellHeight: 12 },
        });

        // Pie: puntuación y firma
        const lastY = ((doc as jsPDF & { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 200) + 10;
        doc.setFontSize(9); doc.setFont("helvetica", "bold");
        doc.text("Puntuación total (sobre 5 pts): _______", marginX, lastY);
        doc.setFont("helvetica", "normal");
        doc.text("Firma del estudiante: ___________________________", marginX, lastY + 12);
      });

      doc.save(`autoevaluacion_modelo_modulo${mid}.pdf`);
    } finally { setExtraPdfLoading(null); }
  }

  async function exportQuizTemplatePdf() {
    setExtraPdfLoading("quiz");
    try {
      const { data: lessons } = await supabase
        .from("lessons").select("id, title, sort_order").eq("module_id", mid).order("sort_order");
      const lessonIds = (lessons ?? []).map((l: { id: number }) => l.id);
      const lessonTitleMap = new Map(
        (lessons ?? []).map((l: { id: number; title: string }) => [l.id, l.title]),
      );

      if (lessonIds.length === 0) { alert("No hay lecciones en este módulo."); return; }

      const { data: quizSections } = await supabase
        .from("lesson_sections").select("id, title, lesson_id, sort_order")
        .in("lesson_id", lessonIds).eq("kind", "quiz").eq("is_active", true)
        .order("sort_order");

      if (!quizSections || quizSections.length === 0) {
        alert("No hay quizzes en este módulo."); return;
      }

      const logo = await loadLogoBase64();
      const doc = new jsPDF({ orientation: "portrait" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const marginX = 15;
      let isFirstPage = true;

      for (const qs of quizSections as { id: number; title: string; lesson_id: number }[]) {
        const { data: quiz } = await supabase
          .from("eval_quizzes").select("id").eq("section_id", qs.id).maybeSingle();
        if (!quiz) continue;

        const { data: questions } = await supabase
          .from("eval_quiz_questions")
          .select("id, question, sort_order, eval_quiz_options(id, option_text)")
          .eq("quiz_id", quiz.id).order("sort_order");

        if (!questions || questions.length === 0) continue;

        if (!isFirstPage) doc.addPage();
        isFirstPage = false;

        if (logo) doc.addImage(logo, "PNG", 10, 6, 18, 18);
        doc.setFontSize(12); doc.setFont("helvetica", "bold");
        doc.text("C.E.A. Madre María Oliva", pageWidth / 2, 14, { align: "center" });
        doc.setFontSize(10);
        doc.text(`Quiz: ${qs.title}`, pageWidth / 2, 21, { align: "center" });
        doc.setFontSize(8); doc.setFont("helvetica", "normal");
        doc.text(`Lección: ${lessonTitleMap.get(qs.lesson_id) ?? ""} | ${moduleRow?.title ?? ""}`, pageWidth / 2, 27, { align: "center" });
        doc.text(`${careerName} | ${levelRow?.name ?? ""}`, pageWidth / 2, 32, { align: "center" });

        doc.setFontSize(10);
        doc.text("Estudiante: _____________________________________________", marginX, 40);
        doc.text("Fecha: ___________________", pageWidth - marginX - 55, 40);

        let curY = 48;
        const OPTS = ["A", "B", "C", "D", "E"];

        (questions as {
          id: number;
          question: string;
          sort_order: number;
          eval_quiz_options: { id: number; option_text: string }[];
        }[]).forEach((q, qi) => {
          // Espacio suficiente para la pregunta
          if (curY > 250) { doc.addPage(); curY = 20; }

          doc.setFontSize(9); doc.setFont("helvetica", "bold");
          const qLines = doc.splitTextToSize(`${qi + 1}. ${q.question}`, pageWidth - marginX * 2) as string[];
          doc.text(qLines, marginX, curY);
          curY += qLines.length * 5 + 2;

          doc.setFont("helvetica", "normal");
          (q.eval_quiz_options ?? []).forEach((opt, oi) => {
            const optLines = doc.splitTextToSize(`${OPTS[oi] ?? String(oi + 1)}) ${opt.option_text}`, pageWidth - marginX * 2 - 6) as string[];
            doc.text(optLines, marginX + 6, curY);
            curY += optLines.length * 4.5 + 1;
          });
          curY += 4; // espacio entre preguntas
        });

        // Pie
        doc.setFontSize(8); doc.setFont("helvetica", "normal");
        doc.text("Firma del estudiante: ___________________________", marginX, curY + 6);
      }

      doc.save(`quizzes_modelo_modulo${mid}.pdf`);
    } finally { setExtraPdfLoading(null); }
  }

  async function toggleReleaseGrades() {
    setReleasingSaving(true);
    const newValue = !gradesReleased;
    const { error } = await supabase
      .from("modules")
      .update({ grades_released: newValue })
      .eq("id", mid);
    setReleasingSaving(false);
    if (!error) {
      setGradesReleased(newValue);
      setMsg(newValue ? "✅ Notas enviadas a los estudiantes" : "🔒 Notas ocultadas a los estudiantes");
      setTimeout(() => setMsg(null), 3000);
    } else {
      setMsg("❌ Error al actualizar. Intenta de nuevo.");
    }
  }

  async function generateCentralizadorPDF() {
    if (centralizadorRows.length === 0) return;
    const doc = new jsPDF({ orientation: "portrait" });
    const pageWidth  = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const logo = await loadLogoBase64();
    if (logo) doc.addImage(logo, "PNG", 10, 5, 18, 18);

    doc.setFontSize(12); doc.setFont("helvetica", "bold");
    doc.text("Centralizador de Calificaciones", pageWidth / 2, 14, { align: "center" });

    const sp = 4.5;
    const startY = 27;
    const leftX = 10, midX = pageWidth / 3, rightX = (pageWidth / 3) * 2;
    const turno = teacherShift.charAt(0).toUpperCase() + teacherShift.slice(1).toLowerCase();

    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");   doc.text("CEA:", leftX, startY);
    doc.setFont("helvetica", "normal"); doc.text("Madre Maria Oliva", leftX + 11, startY);
    doc.setFont("helvetica", "bold");   doc.text("Facilitador(a):", leftX, startY + sp);
    doc.setFont("helvetica", "normal"); doc.text(facilitator, leftX + 27, startY + sp);
    doc.setFont("helvetica", "bold");   doc.text("Director(a):", leftX, startY + sp * 2);
    doc.setFont("helvetica", "normal"); doc.text(director, leftX + 23, startY + sp * 2);

    doc.setFont("helvetica", "bold");   doc.text("Carrera:", midX, startY);
    doc.setFont("helvetica", "normal"); doc.text(careerName, midX + 17, startY);
    doc.setFont("helvetica", "bold");   doc.text("Nivel:", midX, startY + sp);
    doc.setFont("helvetica", "normal"); doc.text(levelRow?.name || "", midX + 12, startY + sp);

    doc.setFont("helvetica", "bold");   doc.text("Semestre:", rightX, startY);
    doc.setFont("helvetica", "normal"); doc.text(semester, rightX + 19, startY);
    doc.setFont("helvetica", "bold");   doc.text("Turno:", rightX, startY + sp);
    doc.setFont("helvetica", "normal"); doc.text(turno, rightX + 13, startY + sp);

    const TABLE_START_Y = startY + sp * 2 + 8;
    const SIDE_MARGIN   = 10;
    const TABLE_WIDTH   = pageWidth - SIDE_MARGIN * 2;
    const HEADER_ROW_H  = 22;
    const BOTTOM_PAD    = 20;
    const nMods = centralizadorModules.length;
    const n     = centralizadorRows.length;

    const NUM_W  = 8;
    const NAME_W = 58;
    const AVG_W  = 16;
    const OBS_W  = 26;
    const modColTotal = TABLE_WIDTH - NUM_W - NAME_W - AVG_W - OBS_W;
    const MOD_W = nMods > 0 ? Math.max(10, Math.floor(modColTotal / nMods)) : 14;

    const bodyAvailH  = pageHeight - TABLE_START_Y - HEADER_ROW_H - BOTTOM_PAD;
    const bodyRowH    = n <= 20 ? Math.max(4.5, bodyAvailH / n) : 6;
    const bodyFontSz  = bodyRowH < 5.2 ? 7 : 8;

    const tableData = centralizadorRows.map((row, idx) => {
      const obs = row.avg !== null ? getObservation(row.avg).text : "";
      return [
        idx + 1,
        formatName(row.student),
        ...row.totals.map((t) => (t !== null ? t : "")),
        row.avg !== null ? row.avg : "",
        obs,
      ];
    });

    const colStyles: Record<number, object> = {
      0: { halign: "center", cellWidth: NUM_W },
      1: { halign: "left",   cellWidth: NAME_W },
      [nMods + 2]: { halign: "center", cellWidth: AVG_W, fontStyle: "bold" },
      [nMods + 3]: { halign: "left",   cellWidth: OBS_W },
    };
    for (let i = 0; i < nMods; i++) {
      colStyles[i + 2] = { halign: "center", cellWidth: MOD_W };
    }

    autoTable(doc, {
      startY: TABLE_START_Y,
      margin: { left: SIDE_MARGIN, right: SIDE_MARGIN },
      head: [["N", "Participante", ...centralizadorModules.map(() => ""), "Prom.", "OBS"]],
      body: tableData,
      theme: "grid",
      headStyles: {
        fillColor: [235, 235, 235],
        textColor: [0, 0, 0],
        fontStyle: "bold",
        halign: "center",
        valign: "bottom",
        fontSize: 7,
        cellPadding: { top: 1, right: 1, bottom: 2, left: 1 },
        minCellHeight: HEADER_ROW_H,
      },
      bodyStyles: {
        fontSize: bodyFontSz,
        cellPadding: { top: 1, right: 1, bottom: 1, left: 1 },
        minCellHeight: bodyRowH,
      },
      styles: { lineColor: [180, 180, 180], lineWidth: 0.2 },
      columnStyles: colStyles,
      willDrawCell: (data) => {
        if (data.section === "head" && data.column.index >= 2 && data.column.index < nMods + 2)
          (data.cell as { text: string[] }).text = [];
      },
      didDrawCell: (data) => {
        if (data.section === "head" && data.column.index >= 2 && data.column.index < nMods + 2) {
          const title = centralizadorModules[data.column.index - 2]?.title ?? "";
          drawDimLabel(doc, data.cell, title.length > 22 ? title.slice(0, 22) + "..." : title);
        }
      },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === nMods + 3) {
          const obs = data.cell.raw as string;
          if (obs === "Postergado")              data.cell.styles.textColor = [220, 53, 69];
          else if (obs === "Promovido")           data.cell.styles.textColor = [40, 167, 69];
          else if (obs === "Promovido Excelente") data.cell.styles.textColor = [0, 123, 255];
        }
        if (data.section === "body" && data.column.index === nMods + 2) {
          const avg = data.cell.raw as number | "";
          if (avg !== "") {
            if      (avg <= 50) data.cell.styles.textColor = [220, 53, 69];
            else if (avg <= 75) data.cell.styles.textColor = [40, 167, 69];
            else                data.cell.styles.textColor = [0, 123, 255];
          }
        }
      },
    });

    // Signatures
    const finalY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
    const sigY = finalY + 8;
    const firmaL = pageWidth / 4, firmaR = (pageWidth / 4) * 3;
    doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(0, 0, 0);
    doc.line(firmaL - 35, sigY, firmaL + 35, sigY);
    doc.text("Facilitador(a)", firmaL, sigY + 5, { align: "center" });
    doc.line(firmaR - 35, sigY, firmaR + 35, sigY);
    doc.text("Direccion", firmaR, sigY + 5, { align: "center" });

    // Footer note
    doc.setFontSize(7); doc.setFont("helvetica", "italic");
    doc.text("(*) Calificacion minima por modulo: 20 pts.", SIDE_MARGIN, sigY + 12);

    doc.save(`Centralizador_${levelRow?.name?.replace(/\s+/g, "_") ?? "nivel"}_${semester.replace("/", "-")}.pdf`);
  }

  async function loadCentralizador() {
    if (!levelRow) return;
    setCentralizadorLoading(true);
    try {
      const { data: modules } = await supabase
        .from("modules")
        .select("id,title,sort_order")
        .eq("level_id", levelRow.id)
        .order("sort_order");

      const mods = (modules ?? []) as CentralModule[];
      setCentralizadorModules(mods);

      if (mods.length === 0 || rows.length === 0) {
        setCentralizadorRows([]);
        return;
      }

      const moduleIds = mods.map((m) => m.id);
      const studentIds = rows.map((r) => r.student.id);

      const [{ data: allGrades }, { data: allProgress }] = await Promise.all([
        supabase
          .from("module_grades")
          .select("student_id,module_id,ser,saber,hacer_proceso,hacer_producto,decidir,auto_ser,auto_decidir")
          .in("module_id", moduleIds)
          .in("student_id", studentIds),
        supabase
          .from("v_module_progress")
          .select("student_id,module_id,progress_percent")
          .in("module_id", moduleIds)
          .in("student_id", studentIds),
      ]);

      const gradesMap = new Map<number, Map<string, ModuleGrade>>();
      for (const g of (allGrades ?? []) as ModuleGrade[]) {
        if (!gradesMap.has(g.module_id)) gradesMap.set(g.module_id, new Map());
        gradesMap.get(g.module_id)!.set(g.student_id, g);
      }

      const progressMap = new Map<number, Map<string, number>>();
      for (const p of (allProgress ?? []) as { student_id: string; module_id: number; progress_percent: number }[]) {
        if (!progressMap.has(p.module_id)) progressMap.set(p.module_id, new Map());
        progressMap.get(p.module_id)!.set(p.student_id, p.progress_percent || 0);
      }

      const cRows: CentralRow[] = rows.map((row) => {
        const totals: (number | null)[] = mods.map((mod) => {
          const grade = gradesMap.get(mod.id)?.get(row.student.id);
          if (!grade || (grade.ser === null && grade.saber === null && grade.hacer_proceso === null && grade.hacer_producto === null && grade.decidir === null)) {
            return null;
          }
          const progress = progressMap.get(mod.id)?.get(row.student.id) ?? 0;
          return calculateTotal(grade, Math.round((progress / 100) * 20));
        });

        const graded = totals.filter((t): t is number => t !== null);
        const avg = graded.length > 0 ? Math.round(graded.reduce((a, b) => a + b, 0) / graded.length) : null;
        return { student: row.student, totals, avg };
      });

      setCentralizadorRows(cRows);
    } finally {
      setCentralizadorLoading(false);
    }
  }

  if (loading)
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-300">Cargando...</div>
      </div>
    );
  if (!session) return <Navigate to="/login" replace />;
  if (!isTeacherish) return <Navigate to="/student" replace />;
  if (invalidMid) return <Navigate to="/teacher/modules" replace />;

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-800 border-b border-slate-800/50 shadow-xl">
        <div className="max-w-[1600px] mx-auto px-6 py-6">
          <div className="flex items-center gap-3 mb-4">
            <button
              className="flex items-center gap-1.5 text-slate-300 hover:text-white transition-colors group text-sm"
              onClick={() => nav("/teacher/modules")}
            >
              <svg className="w-4 h-4 transition-transform group-hover:-translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span className="font-medium">Volver a Módulos</span>
            </button>
            <div className="w-px h-4 bg-slate-700" />
            <button
              className="flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors text-sm"
              onClick={() => nav("/teacher")}
              title="Ir al Dashboard"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
              <span className="hidden sm:inline text-xs">Inicio</span>
            </button>
          </div>
          <div className="flex items-center gap-3 sm:gap-4">
            <img
              src={logoCea}
              alt="CEA Logo"
              className="h-24 w-24 sm:h-32 sm:w-32 lg:h-40 lg:w-40 rounded-xl object-contain p-1"
            />
            <div className="text-center sm:text-left">
              <div className="text-slate-400 text-xs sm:text-sm font-medium mb-1 tracking-wide uppercase">
                CEA Madre María Oliva
              </div>
              <h1 className="text-xl sm:text-2xl font-display font-bold text-white tracking-tight">
                Calificaciones por Módulo
              </h1>
            </div>
          </div>
          <div className="text-slate-400 text-sm font-medium mb-1">
            {levelRow?.name ?? "Cargando..."}
          </div>
          <h1 className="text-3xl font-bold text-white">
            Calificaciones de: {moduleRow?.title ?? "Cargando módulo..."}
          </h1>
          <p className="text-slate-400 mt-1">
            {careerName} · Turno {teacherShift}
          </p>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-6 py-8 space-y-6">
        {msg && (
          <div
            className={`px-6 py-4 rounded-xl font-medium animate-in fade-in slide-in-from-top-2 duration-300 ${
              msg.includes("✅")
                ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                : "bg-red-500/10 border border-red-500/20 text-red-400"
            }`}
          >
            {msg}
          </div>
        )}

        {loadingData ? (
          <div className="bg-slate-900 rounded-2xl border border-slate-700/50 p-12 text-center">
            <div className="text-slate-300 text-lg">
              Cargando estudiantes...
            </div>
          </div>
        ) : rows.length === 0 ? (
          <div className="bg-slate-900 rounded-2xl border border-slate-700/50 p-12 text-center">
            <div className="text-6xl mb-4 opacity-20">👥</div>
            <div className="text-xl font-semibold text-white mb-2">
              No hay estudiantes
            </div>
            <div className="text-slate-400">
              No hay estudiantes de tu carrera y turno en este nivel
            </div>
          </div>
        ) : (
          <>
          {/* Barra de guardado */}
          <div className="flex items-center justify-between bg-slate-900/60 border border-slate-700/50 rounded-xl px-5 py-3">
            <span className="text-sm text-slate-400">
              {dirtyRows.size > 0
                ? <span className="text-amber-400 font-medium">{dirtyRows.size} cambio{dirtyRows.size > 1 ? "s" : ""} guardándose automáticamente…</span>
                : savedAt
                  ? <span className="text-emerald-400">✓ Guardado a las {savedAt}</span>
                  : <span>Los cambios se guardan automáticamente</span>
              }
            </span>
            <div className="flex items-center gap-3">
              {moduleRow && levelRow && (
                <>
                  <button
                    className="flex items-center gap-2 px-4 py-2 bg-cyan-600/20 border border-cyan-500/30 hover:bg-cyan-600/30 text-cyan-300 hover:text-cyan-200 text-sm rounded-lg font-medium transition-all duration-200"
                    onClick={() => { setShowCentralizador(true); void loadCentralizador(); }}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 6h18M3 14h18M3 18h18" />
                    </svg>
                    Centralizador
                  </button>
                  <button
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-600/20 border border-indigo-500/30 hover:bg-indigo-600/30 text-indigo-300 hover:text-indigo-200 text-sm rounded-lg font-medium transition-all duration-200"
                    onClick={() => {
                      try {
                        sessionStorage.setItem("teacher_content_manager_cache", JSON.stringify({
                          view: "lessons",
                          selectedModule: moduleRow,
                          selectedLevel: levelRow,
                        }));
                      } catch { /* ignore */ }
                      nav("/teacher/content");
                    }}
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    Actividades
                  </button>
                </>
              )}
              <button
                onClick={saveAllGrades}
                disabled={globalSaving}
                className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-800 disabled:opacity-60 text-white text-sm rounded-lg font-semibold transition-all duration-200 shadow-lg shadow-emerald-900/30"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {globalSaving ? "Guardando..." : "Guardar cambios"}
              </button>

              <button
                onClick={() => void toggleReleaseGrades()}
                disabled={releasingSaving}
                className={`flex items-center gap-2 px-5 py-2 text-sm rounded-lg font-semibold transition-all duration-200 disabled:opacity-60 ${
                  gradesReleased
                    ? "bg-amber-600/20 border border-amber-500/40 hover:bg-amber-600/30 text-amber-300 hover:text-amber-200"
                    : "bg-sky-600/20 border border-sky-500/40 hover:bg-sky-600/30 text-sky-300 hover:text-sky-200"
                }`}
                title={gradesReleased ? "Las notas son visibles para los estudiantes. Clic para ocultar." : "Los estudiantes no ven estas notas aún. Clic para enviarlas."}
              >
                {gradesReleased ? (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                    {releasingSaving ? "..." : "Ocultar notas"}
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    {releasingSaving ? "..." : "Enviar notas a estudiantes"}
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="bg-slate-900 rounded-2xl border border-slate-700/50 overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-slate-800/50">
                  <tr>
                    <th className="px-3 py-4 text-center text-xs font-semibold text-slate-300 uppercase tracking-wider whitespace-nowrap">
                      N°
                    </th>
                    <th className="px-3 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider whitespace-nowrap">
                      Estudiante
                    </th>
                    <th className="px-3 py-4 text-center text-xs font-semibold text-slate-300 uppercase tracking-wider whitespace-nowrap">
                      Progreso
                    </th>
                    {[
                      { label: "SER", pts: 10, dim: "ser" },
                      { label: "SABER", pts: 30, dim: "saber" },
                      { label: "HACER Proceso", pts: 20, dim: "hacer_proceso" },
                      { label: "HACER Producto", pts: 20, dim: "hacer_producto" },
                      { label: "DECIDIR", pts: 10, dim: "decidir" },
                    ].map(({ label, pts, dim }) => (
                      <th key={dim} style={{ verticalAlign: "bottom", padding: "4px 6px", width: 44, textAlign: "center" }} className="text-xs font-semibold uppercase tracking-wider">
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                          <button
                            className="text-sky-400 hover:text-sky-200 hover:underline transition-colors"
                            onClick={() => setActiveDim(dim as DimKey)}
                            title={`Abrir registro ${label}`}
                          >
                            <span style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", whiteSpace: "nowrap", fontSize: 11, fontWeight: 600, paddingBottom: 2, display: "block" }}>{label}</span>
                          </button>
                          <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 400 }}>({pts})</span>
                        </div>
                      </th>
                    ))}
                    <th style={{ verticalAlign: "bottom", padding: "4px 6px", width: 44, textAlign: "center" }} className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                        <span style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", whiteSpace: "nowrap", fontSize: 11, fontWeight: 600, paddingBottom: 2 }}>AUTO SER</span>
                        <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 400 }}>(5)</span>
                      </div>
                    </th>
                    <th style={{ verticalAlign: "bottom", padding: "4px 6px", width: 44, textAlign: "center" }} className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                        <span style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", whiteSpace: "nowrap", fontSize: 11, fontWeight: 600, paddingBottom: 2 }}>AUTO DECIDIR</span>
                        <span style={{ fontSize: 10, color: "#94a3b8", fontWeight: 400 }}>(5)</span>
                      </div>
                    </th>
                    <th className="px-3 py-4 text-center text-xs font-semibold text-slate-300 uppercase tracking-wider whitespace-nowrap">
                      TOTAL
                      <br />
                      <span className="text-xs font-normal text-slate-400">
                        (100)
                      </span>
                    </th>
                    <th className="px-3 py-4 text-center text-xs font-semibold text-slate-300 uppercase tracking-wider whitespace-nowrap">
                      OBS
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {rows.map((row, idx) => (
                    <tr
                      key={row.student.id}
                      className="hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-white text-center">
                        {idx + 1}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-slate-200">
                        {formatName(row.student)}
                      </td>
                      <td className="px-3 py-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span
                            className={`text-sm font-semibold ${getProgressTextColor(
                              row.progress,
                            )}`}
                          >
                            {row.progress}%
                          </span>
                          <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full bg-gradient-to-r ${getProgressColor(
                                row.progress,
                              )} rounded-full transition-all duration-500`}
                              style={{ width: `${row.progress}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* SER (10) */}
                      <td className="px-3 py-4" style={{ verticalAlign: "middle" }}>
                        <input
                          type="number"
                          className={`w-16 px-2 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white text-center text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none${shakingInputs.has(`${row.student.id}-ser`) ? " shake" : ""}`}
                          min="1" max="10"
                          value={row.grade.ser ?? ""}
                          onChange={(e) => updateGradeField(row.student.id, "ser", e.target.value)}
                          placeholder="—"
                        />
                      </td>

                      {/* SABER (30) */}
                      <td className="px-3 py-4" style={{ verticalAlign: "middle" }}>
                        <input
                          type="number"
                          className={`w-16 px-2 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white text-center text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none${shakingInputs.has(`${row.student.id}-saber`) ? " shake" : ""}`}
                          min="1" max="30"
                          value={row.grade.saber ?? ""}
                          onChange={(e) => updateGradeField(row.student.id, "saber", e.target.value)}
                          placeholder="—"
                        />
                      </td>

                      {/* HACER Proceso (20) — sugerencia como tooltip para no romper alineación */}
                      <td className="px-3 py-4" style={{ verticalAlign: "middle" }}>
                        <input
                          type="number"
                          className={`w-16 px-2 py-2 bg-slate-800/50 border border-amber-500/30 rounded-lg text-white text-center text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-transparent transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none${shakingInputs.has(`${row.student.id}-hacer_proceso`) ? " shake" : ""}`}
                          min="1" max="20"
                          value={row.grade.hacer_proceso ?? ""}
                          onChange={(e) => updateGradeField(row.student.id, "hacer_proceso", e.target.value)}
                          placeholder={String(row.suggestedHP)}
                          title={`Sugerido según avance: ${row.suggestedHP}/20`}
                        />
                      </td>

                      {/* HACER Producto (20) */}
                      <td className="px-3 py-4" style={{ verticalAlign: "middle" }}>
                        <input
                          type="number"
                          className={`w-16 px-2 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white text-center text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none${shakingInputs.has(`${row.student.id}-hacer_producto`) ? " shake" : ""}`}
                          min="1" max="20"
                          value={row.grade.hacer_producto ?? ""}
                          onChange={(e) => updateGradeField(row.student.id, "hacer_producto", e.target.value)}
                          placeholder="—"
                        />
                      </td>

                      {/* DECIDIR (10) */}
                      <td className="px-3 py-4" style={{ verticalAlign: "middle" }}>
                        <input
                          type="number"
                          className={`w-16 px-2 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white text-center text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none${shakingInputs.has(`${row.student.id}-decidir`) ? " shake" : ""}`}
                          min="1" max="10"
                          value={row.grade.decidir ?? ""}
                          onChange={(e) => updateGradeField(row.student.id, "decidir", e.target.value)}
                          placeholder="—"
                        />
                      </td>

                      {/* AUTO SER (5) */}
                      <td className="px-2 py-3 text-center">
                        {autoEditingRows.has(row.student.id) ? (
                          <div className="flex flex-col items-center gap-1">
                            <input
                              type="number"
                              className={`w-14 px-1 py-2 bg-violet-900/30 border border-violet-500/50 rounded-lg text-white text-center text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none${shakingInputs.has(`${row.student.id}-auto_ser`) ? " shake" : ""}`}
                              min="0" max="5"
                              value={row.grade.auto_ser ?? ""}
                              onChange={(e) => updateGradeField(row.student.id, "auto_ser", e.target.value)}
                              placeholder="—"
                            />
                            {row.autoEvalFromStudent?.auto_ser !== null && row.autoEvalFromStudent?.auto_ser !== undefined && (
                              <button
                                className="text-xs text-violet-400 hover:text-violet-200 underline transition-colors"
                                title={`El estudiante envió: ${row.autoEvalFromStudent.auto_ser}. Clic para copiar.`}
                                onClick={() => updateGradeField(row.student.id, "auto_ser", String(row.autoEvalFromStudent!.auto_ser))}
                              >
                                ↓{row.autoEvalFromStudent.auto_ser}
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm font-semibold text-violet-400">
                            {row.grade.auto_ser !== null ? row.grade.auto_ser : <span className="text-slate-600">—</span>}
                          </span>
                        )}
                      </td>

                      {/* AUTO DECIDIR (5) */}
                      <td className="px-2 py-3 text-center">
                        {autoEditingRows.has(row.student.id) ? (
                          <div className="flex flex-col items-center gap-1">
                            <input
                              type="number"
                              className={`w-14 px-1 py-2 bg-violet-900/30 border border-violet-500/50 rounded-lg text-white text-center text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none${shakingInputs.has(`${row.student.id}-auto_decidir`) ? " shake" : ""}`}
                              min="0" max="5"
                              value={row.grade.auto_decidir ?? ""}
                              onChange={(e) => updateGradeField(row.student.id, "auto_decidir", e.target.value)}
                              placeholder="—"
                            />
                            {row.autoEvalFromStudent?.auto_decidir !== null && row.autoEvalFromStudent?.auto_decidir !== undefined && (
                              <button
                                className="text-xs text-violet-400 hover:text-violet-200 underline transition-colors"
                                title={`El estudiante envió: ${row.autoEvalFromStudent.auto_decidir}. Clic para copiar.`}
                                onClick={() => updateGradeField(row.student.id, "auto_decidir", String(row.autoEvalFromStudent!.auto_decidir))}
                              >
                                ↓{row.autoEvalFromStudent.auto_decidir}
                              </button>
                            )}
                          </div>
                        ) : (
                          <span className="text-sm font-semibold text-violet-400">
                            {row.grade.auto_decidir !== null ? row.grade.auto_decidir : <span className="text-slate-600">—</span>}
                          </span>
                        )}
                      </td>

                      {/* TOTAL */}
                      <td className="px-3 py-4 text-center">
                        <div
                          className={`text-xl font-bold ${getObservation(row.total).color}`}
                        >
                          {row.total}
                        </div>
                      </td>

                      {/* OBS */}
                      <td className="px-3 py-4 text-center">
                        <span
                          className={`text-sm font-semibold ${getObservation(row.total).color}`}
                        >
                          {getObservation(row.total).text}
                        </span>
                      </td>

                      {/* Editar autoeval + indicador de guardado */}
                      <td className="px-2 py-3 text-center" style={{ verticalAlign: "middle", width: 56 }}>
                        <div className="flex flex-col items-center gap-1.5">
                          <button
                            title={autoEditingRows.has(row.student.id) ? "Cerrar edición de autoevaluación" : "Editar autoevaluación"}
                            className={`text-xs px-2 py-1 rounded-md border transition-colors ${autoEditingRows.has(row.student.id) ? "bg-violet-600/30 text-violet-300 border-violet-500/40" : "bg-slate-700/40 text-slate-400 hover:text-violet-300 hover:bg-violet-600/20 border-slate-600/40"}`}
                            onClick={() => setAutoEditingRows((prev) => {
                              const next = new Set(prev);
                              if (next.has(row.student.id)) next.delete(row.student.id);
                              else next.add(row.student.id);
                              return next;
                            })}
                          >
                            {autoEditingRows.has(row.student.id) ? "✓" : "✎"}
                          </button>
                          {dirtyRows.has(row.student.id) && (
                            <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" title="Guardando..." />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          </>
        )}

        {/* Sección de Reporte PDF */}
        {rows.length > 0 && (
          <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl border border-slate-700/50 p-6 shadow-xl">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <svg
                className="w-6 h-6 text-red-400"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 2l5 5h-5V4zM6 20V4h6v6h6v10H6z" />
                <path d="M9 13h6v2H9zm0 3h6v2H9zm0-6h2v2H9z" />
              </svg>
              Generar Reporte PDF
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  Facilitador(a) / Docente
                </label>
                {editingReport ? (
                  <input
                    type="text"
                    value={tempFacilitator}
                    onChange={(e) => setTempFacilitator(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                ) : (
                  <div className="px-3 py-2 bg-slate-800/30 border border-slate-700/30 rounded-lg text-white text-sm">
                    {facilitator || "Sin nombre"}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  Director(a) del CEA
                </label>
                {editingReport ? (
                  <input
                    type="text"
                    value={tempDirector}
                    onChange={(e) => setTempDirector(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                ) : (
                  <div className="px-3 py-2 bg-slate-800/30 border border-slate-700/30 rounded-lg text-white text-sm">
                    {director}
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  Semestre
                </label>
                {editingReport ? (
                  <input
                    type="text"
                    value={tempSemester}
                    onChange={(e) => setTempSemester(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    placeholder="1/2026"
                  />
                ) : (
                  <div className="px-3 py-2 bg-slate-800/30 border border-slate-700/30 rounded-lg text-white text-sm">
                    {semester}
                  </div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              {editingReport ? (
                <>
                  <button
                    onClick={handleSaveReport}
                    className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white text-sm rounded-lg font-medium transition-all duration-200 shadow-lg shadow-emerald-900/30 flex items-center gap-2"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    Guardar
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg font-medium transition-all duration-200 flex items-center gap-2"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                    Cancelar
                  </button>
                </>
              ) : (
                <button
                  onClick={handleEditReport}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg font-medium transition-all duration-200 flex items-center gap-2"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                  Editar datos
                </button>
              )}

              <button
                onClick={generatePDF}
                className="px-6 py-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white text-sm rounded-lg font-medium transition-all duration-200 shadow-lg shadow-red-900/30 flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm4 18H6V4h7v5h5v11z" />
                  <path d="M12 18l4-4h-3v-4h-2v4H8l4 4z" />
                </svg>
                Descargar PDF
              </button>

              <button
                onClick={exportDimsPdf}
                disabled={extraPdfLoading !== null}
                className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm rounded-lg font-medium transition-all duration-200 shadow-lg shadow-indigo-900/30 flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm4 18H6V4h7v5h5v11zM8 15h8v2H8zm0-4h8v2H8zm0-4h5v2H8z" />
                </svg>
                {extraPdfLoading === "dims" ? "Generando..." : "📚 PDF Dimensiones"}
              </button>

              <button
                onClick={exportAutoEvalTemplatePdf}
                disabled={extraPdfLoading !== null}
                className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm rounded-lg font-medium transition-all duration-200 shadow-lg shadow-emerald-900/30 flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {extraPdfLoading === "autoeval" ? "Generando..." : "✅ Modelo Autoevaluación"}
              </button>

              <button
                onClick={exportQuizTemplatePdf}
                disabled={extraPdfLoading !== null}
                className="px-5 py-2 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm rounded-lg font-medium transition-all duration-200 shadow-lg shadow-amber-900/30 flex items-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {extraPdfLoading === "quiz" ? "Generando..." : "📋 Modelo Quiz"}
              </button>
            </div>
          </div>
        )}

        {/* Leyenda compacta en una línea */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl border border-slate-700/50 p-6 shadow-xl">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <span className="text-2xl">📊</span>
            Ponderación de Calificaciones
          </h3>
          <div className="flex flex-wrap items-center gap-3">
            <div className="px-4 py-2 bg-slate-800/30 rounded-xl border border-slate-700/30">
              <span className="text-slate-400 text-sm">SER:</span>
              <span className="text-white text-sm font-bold ml-2">10 pts</span>
            </div>
            <div className="px-4 py-2 bg-slate-800/30 rounded-xl border border-slate-700/30">
              <span className="text-slate-400 text-sm">SABER:</span>
              <span className="text-white text-sm font-bold ml-2">30 pts</span>
            </div>
            <div className="px-4 py-2 bg-slate-800/30 rounded-xl border border-slate-700/30">
              <span className="text-slate-400 text-sm">HACER Proceso:</span>
              <span className="text-white text-sm font-bold ml-2">20 pts</span>
            </div>
            <div className="px-4 py-2 bg-slate-800/30 rounded-xl border border-slate-700/30">
              <span className="text-slate-400 text-sm">HACER Producto:</span>
              <span className="text-white text-sm font-bold ml-2">20 pts</span>
            </div>
            <div className="px-4 py-2 bg-slate-800/30 rounded-xl border border-slate-700/30">
              <span className="text-slate-400 text-sm">DECIDIR:</span>
              <span className="text-white text-sm font-bold ml-2">10 pts</span>
            </div>
            <div className="px-4 py-2 bg-slate-800/30 rounded-xl border border-slate-700/30">
              <span className="text-slate-400 text-sm">AUTO SER:</span>
              <span className="text-white text-sm font-bold ml-2">5 pts</span>
            </div>
            <div className="px-4 py-2 bg-slate-800/30 rounded-xl border border-slate-700/30">
              <span className="text-slate-400 text-sm">AUTO DECIDIR:</span>
              <span className="text-white text-sm font-bold ml-2">5 pts</span>
            </div>
            <div className="px-4 py-2 bg-gradient-to-br from-blue-600/20 to-blue-700/20 rounded-xl border border-blue-500/30">
              <span className="text-blue-300 text-sm">TOTAL:</span>
              <span className="text-white text-sm font-bold ml-2">100 pts</span>
            </div>
          </div>

          <div className="mt-4 p-3 bg-slate-800/30 rounded-xl border border-slate-700/30">
            <span className="text-slate-300 text-sm">
              <strong className="text-white">Nota mínima de aprobación:</strong>{" "}
              51 puntos
            </span>
          </div>
        </div>
      </main>

      {/* ── MODAL CENTRALIZADOR ─────────────────────────────────────── */}
      {showCentralizador && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/98 backdrop-blur-sm overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700/50 bg-slate-900/80 shrink-0">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 6h18M3 14h18M3 18h18" />
                </svg>
                Centralizador de Notas
              </h2>
              <p className="text-sm text-slate-400 mt-0.5">{levelRow?.name} — {careerName}</p>
            </div>
            <div className="flex items-center gap-3">
              {!centralizadorLoading && centralizadorRows.length > 0 && (
                <button
                  className="flex items-center gap-2 px-4 py-2 bg-red-600/20 border border-red-500/30 hover:bg-red-600/30 text-red-300 hover:text-red-200 text-sm rounded-lg font-medium transition-all duration-200"
                  onClick={() => void generateCentralizadorPDF()}
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm4 18H6V4h7v5h5v11z"/>
                    <path d="M12 18l4-4h-3v-4h-2v4H8l4 4z"/>
                  </svg>
                  Generar PDF
                </button>
              )}
              <button
                className="p-2 rounded-lg bg-slate-700/50 hover:bg-slate-600/50 text-slate-300 hover:text-white transition-colors"
                onClick={() => setShowCentralizador(false)}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-auto p-6">
            {centralizadorLoading ? (
              <div className="flex items-center justify-center h-40 text-slate-400 text-sm">
                Cargando datos de todos los módulos...
              </div>
            ) : centralizadorRows.length === 0 ? (
              <div className="flex items-center justify-center h-40 text-slate-500 text-sm">
                No hay estudiantes o módulos para mostrar.
              </div>
            ) : (
              <div className="bg-slate-900 rounded-2xl border border-slate-700/50 overflow-hidden shadow-2xl">
                <div className="overflow-x-auto">
                  <table className="min-w-full">
                    <thead className="bg-slate-800/50">
                      <tr>
                        <th className="px-3 py-3 text-center text-xs font-semibold text-slate-300 uppercase tracking-wider whitespace-nowrap">N°</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider whitespace-nowrap">Estudiante</th>
                        {centralizadorModules.map((mod) => (
                          <th
                            key={mod.id}
                            style={{ verticalAlign: "bottom", padding: "4px 6px", width: 52, textAlign: "center" }}
                            className={`text-xs font-semibold uppercase tracking-wider ${mod.id === mid ? "text-cyan-400" : "text-slate-300"}`}
                          >
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                              <span style={{ writingMode: "vertical-rl", transform: "rotate(180deg)", whiteSpace: "nowrap", fontSize: 11, fontWeight: 600, paddingBottom: 4, display: "block" }}>
                                {mod.title.length > 22 ? mod.title.slice(0, 22) + "…" : mod.title}
                              </span>
                            </div>
                          </th>
                        ))}
                        <th className="px-3 py-3 text-center text-xs font-semibold text-cyan-300 uppercase tracking-wider whitespace-nowrap">Promedio</th>
                        <th className="px-3 py-3 text-center text-xs font-semibold text-slate-300 uppercase tracking-wider whitespace-nowrap">Obs</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                      {centralizadorRows.map((row, idx) => {
                        const obs = row.avg !== null ? getObservation(row.avg) : null;
                        return (
                          <tr key={row.student.id} className="hover:bg-slate-800/30 transition-colors">
                            <td className="px-3 py-3 text-center text-sm font-medium text-slate-400">{idx + 1}</td>
                            <td className="px-4 py-3 text-sm text-slate-200 whitespace-nowrap">{formatName(row.student)}</td>
                            {row.totals.map((total, i) => (
                              <td
                                key={i}
                                className={`px-2 py-3 text-center text-sm font-semibold ${centralizadorModules[i]?.id === mid ? "bg-cyan-950/30" : ""}`}
                              >
                                {total !== null ? (
                                  <span className={getObservation(total).color}>{total}</span>
                                ) : (
                                  <span className="text-slate-700">—</span>
                                )}
                              </td>
                            ))}
                            <td className="px-3 py-3 text-center">
                              {row.avg !== null ? (
                                <span className={`text-base font-bold ${obs!.color}`}>{row.avg}</span>
                              ) : (
                                <span className="text-slate-700 text-sm">—</span>
                              )}
                            </td>
                            <td className="px-3 py-3 text-center">
                              {obs ? (
                                <span className={`text-sm font-semibold ${obs.color}`}>{obs.text}</span>
                              ) : (
                                <span className="text-slate-700 text-sm">—</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── OVERLAY DIMENSIÓN ──────────────────────────────────────────── */}
      {activeDim && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950">
          <TeacherDimensionGrades
            inlineModuleId={mid}
            inlineDimension={activeDim}
            onClose={async () => {
              await flushDirtyRows();
              loadedModuleRef.current = null;
              setRefreshKey((k) => k + 1);
              setActiveDim(null);
            }}
          />
        </div>
      )}
    </div>
  );
}

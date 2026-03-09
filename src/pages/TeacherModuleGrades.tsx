// cea-plataforma/web/src/pages/TeacherModuleGrades.tsx
// 🎨 VERSIÓN FINAL: Mejoras UX + Colores dinámicos + Mensajes amigables

import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useRole } from "../lib/useRole";
import logoCea from "../assets/logo-cea.png";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

type ModuleRow = {
  id: number;
  level_id: number;
  title: string;
  sort_order: number;
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
  saving: boolean;
};

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

  // Estados para el reporte PDF
  const currentMonth = new Date().getMonth() + 1;
  const currentYear = new Date().getFullYear();
  const defaultSemester = `${currentMonth <= 6 ? 1 : 2}/${currentYear}`;

  const [facilitator, setFacilitator] = useState("");
  const [director, setDirector] = useState("Lic. Germana Calle Villca");
  const [semester, setSemester] = useState(defaultSemester);
  const [editingReport, setEditingReport] = useState(false);
  const [tempFacilitator, setTempFacilitator] = useState("");
  const [tempDirector, setTempDirector] = useState(director);
  const [tempSemester, setTempSemester] = useState(semester);

  const isTeacherish = role === "teacher" || role === "admin";
  const mid = parseInt(moduleId ?? "", 10);
  const invalidMid = isNaN(mid) || mid <= 0;
  // Ref para evitar recargas al cambiar de pestaña/ventana
  const loadedModuleRef = useRef<number | null>(null);
  useEffect(() => {
    if (!session || !isTeacherish || invalidMid) return;
    // Solo cargar si el módulo cambió o no se ha cargado aún
    if (loadedModuleRef.current === mid) return;
    loadedModuleRef.current = mid;
    loadAll();
  }, [session, isTeacherish, mid]);

  async function loadAll() {
    setLoadingData(true);
    setMsg(null);

    try {
      const { data: teacherProfile, error: profError } = await supabase
        .from("profiles")
        .select("career_id, shift, full_name")
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
        const facilitatorName = fullName ? `Lic. ${fullName}` : "";
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
        .select("id,level_id,title,sort_order")
        .eq("id", mid)
        .single();

      if (moduleError || !module) {
        setMsg("Módulo no encontrado");
        setLoadingData(false);
        return;
      }

      setModuleRow(module as ModuleRow);

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
          // auto_eval_responses tiene prioridad sobre module_grades para auto_ser/auto_decidir
          auto_ser: autoEval?.auto_ser ?? r(existingGrade.auto_ser),
          auto_decidir: autoEval?.auto_decidir ?? r(existingGrade.auto_decidir),
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
          saving: false,
        };
      });

      setRows(studentRows);
      setLoadingData(false);

      // Sincronizar auto_ser / auto_decidir a module_grades en segundo plano
      // para que el docente no tenga que guardar manualmente cada fila
      const syncRows = studentRows.filter((sr) => {
        const ae = autoEvalMap.get(sr.student.id);
        if (!ae) return false;
        const existing = gradesMap.get(sr.student.id);
        return (
          (ae.auto_ser !== null && ae.auto_ser !== (existing?.auto_ser ?? null)) ||
          (ae.auto_decidir !== null && ae.auto_decidir !== (existing?.auto_decidir ?? null))
        );
      });

      for (const sr of syncRows) {
        const ae = autoEvalMap.get(sr.student.id)!;
        await supabase.from("module_grades").upsert(
          {
            student_id: sr.student.id,
            module_id: mid,
            auto_ser: ae.auto_ser,
            auto_decidir: ae.auto_decidir,
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
    return Math.max(val, min);
  }

  function calculateTotal(grade: ModuleGrade, suggestedHP: number): number {
    const ser        = applyDimMin(grade.ser,           DIM_MIN.ser);
    const saber      = applyDimMin(grade.saber,         DIM_MIN.saber);
    const hacerProc  = applyDimMin(grade.hacer_proceso ?? suggestedHP, DIM_MIN.hacer_proceso);
    const hacerProd  = applyDimMin(grade.hacer_producto, DIM_MIN.hacer_producto);
    const decidir    = applyDimMin(grade.decidir,        DIM_MIN.decidir);
    const autoSer    = applyDimMin(grade.auto_ser,       DIM_MIN.auto_ser);
    const autoDecid  = applyDimMin(grade.auto_decidir,   DIM_MIN.auto_decidir);

    return Math.round(ser + saber + hacerProc + hacerProd + decidir + autoSer + autoDecid);
  }

  function updateGradeField(
    studentId: string,
    field: keyof ModuleGrade,
    value: string,
  ) {
    const numValue = value.trim() === "" ? null : Number(value);

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

  function parseErrorMessage(error: string): string {
    // Mensajes amigables para constraints
    if (error.includes("check_ser_range")) {
      return "❌ Error: SER debe estar entre 0 y 10 puntos";
    }
    if (error.includes("check_saber_range")) {
      return "❌ Error: SABER debe estar entre 0 y 30 puntos";
    }
    if (error.includes("check_hacer_proceso_range")) {
      return "❌ Error: HACER PROCESO debe estar entre 0 y 20 puntos";
    }
    if (error.includes("check_hacer_producto_range")) {
      return "❌ Error: HACER PRODUCTO debe estar entre 0 y 20 puntos";
    }
    if (error.includes("check_decidir_range")) {
      return "❌ Error: DECIDIR debe estar entre 0 y 10 puntos";
    }
    if (error.includes("check_auto_ser_range")) {
      return "❌ Error: AUTO SER debe estar entre 0 y 5 puntos";
    }
    if (error.includes("check_auto_decidir_range")) {
      return "❌ Error: AUTO DECIDIR debe estar entre 0 y 5 puntos";
    }

    // Mensaje genérico para otros errores
    return `❌ Error: ${error}`;
  }

  async function saveGrade(studentId: string) {
    const row = rows.find((r) => r.student.id === studentId);
    if (!row) return;

    setRows((prev) =>
      prev.map((r) =>
        r.student.id === studentId ? { ...r, saving: true } : r,
      ),
    );

    try {
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

      if (error) {
        setMsg(parseErrorMessage(error.message));
      } else {
        setMsg("✅ Calificación guardada correctamente");
      }
    } catch (error) {
      setMsg(`❌ Error: ${error}`);
    } finally {
      setRows((prev) =>
        prev.map((r) =>
          r.student.id === studentId ? { ...r, saving: false } : r,
        ),
      );
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
          <button
            className="flex items-center gap-2 text-slate-300 hover:text-white mb-4 transition-colors group"
            onClick={() => nav("/teacher/modules")}
          >
            <svg
              className="w-5 h-5 transition-transform group-hover:-translate-x-1"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            <span className="font-medium">Volver a Módulos</span>
          </button>
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
          <h1 className="text-3xl font-bold text-blue-400">
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
                            onClick={() => nav(`/teacher/module/${mid}/grades/${dim}`)}
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
                    <th className="px-3 py-4 text-center text-xs font-semibold text-slate-300 uppercase tracking-wider whitespace-nowrap">
                      Acciones
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
                      <td className="px-3 py-4">
                        <input
                          type="number"
                          className="w-16 px-2 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white text-center text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          min="0"
                          max="10"
                          value={row.grade.ser ?? ""}
                          onChange={(e) =>
                            updateGradeField(
                              row.student.id,
                              "ser",
                              e.target.value,
                            )
                          }
                          placeholder="0"
                        />
                      </td>

                      {/* SABER (30) */}
                      <td className="px-3 py-4">
                        <input
                          type="number"
                          className="w-16 px-2 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white text-center text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          min="0"
                          max="30"
                          value={row.grade.saber ?? ""}
                          onChange={(e) =>
                            updateGradeField(
                              row.student.id,
                              "saber",
                              e.target.value,
                            )
                          }
                          placeholder="0"
                        />
                      </td>

                      {/* HACER Proceso (20) con sugerencia */}
                      <td className="px-3 py-4">
                        <div className="flex flex-col items-center gap-1">
                          <input
                            type="number"
                            className="w-16 px-2 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white text-center text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-transparent transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            min="0"
                            max="20"
                            value={row.grade.hacer_proceso ?? ""}
                            onChange={(e) =>
                              updateGradeField(
                                row.student.id,
                                "hacer_proceso",
                                e.target.value,
                              )
                            }
                            placeholder={String(row.suggestedHP)}
                          />
                          <span className="text-xs text-amber-400 font-medium">
                            {row.suggestedHP}/20
                          </span>
                        </div>
                      </td>

                      {/* HACER Producto (20) */}
                      <td className="px-3 py-4">
                        <input
                          type="number"
                          className="w-16 px-2 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white text-center text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          min="0"
                          max="20"
                          value={row.grade.hacer_producto ?? ""}
                          onChange={(e) =>
                            updateGradeField(
                              row.student.id,
                              "hacer_producto",
                              e.target.value,
                            )
                          }
                          placeholder="0"
                        />
                      </td>

                      {/* DECIDIR (10) */}
                      <td className="px-3 py-4">
                        <input
                          type="number"
                          className="w-16 px-2 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white text-center text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          min="0"
                          max="10"
                          value={row.grade.decidir ?? ""}
                          onChange={(e) =>
                            updateGradeField(
                              row.student.id,
                              "decidir",
                              e.target.value,
                            )
                          }
                          placeholder="0"
                        />
                      </td>

                      {/* AUTO SER (5) — autocalificado por el estudiante */}
                      <td className="px-3 py-4 text-center">
                        <span className="text-sm font-semibold text-violet-400">
                          {row.grade.auto_ser !== null ? row.grade.auto_ser : <span className="text-slate-600">—</span>}
                        </span>
                      </td>

                      {/* AUTO DECIDIR (5) — autocalificado por el estudiante */}
                      <td className="px-3 py-4 text-center">
                        <span className="text-sm font-semibold text-violet-400">
                          {row.grade.auto_decidir !== null ? row.grade.auto_decidir : <span className="text-slate-600">—</span>}
                        </span>
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

                      {/* Acciones */}
                      <td className="px-3 py-4 text-center">
                        <button
                          className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white text-sm rounded-lg font-medium transition-all duration-200 shadow-lg shadow-emerald-900/30 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                          onClick={() => saveGrade(row.student.id)}
                          disabled={row.saving}
                        >
                          {row.saving ? "Guardando..." : "Guardar"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
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
                <svg
                  className="w-5 h-5"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm4 18H6V4h7v5h5v11z" />
                  <path d="M12 18l4-4h-3v-4h-2v4H8l4 4z" />
                </svg>
                Descargar PDF
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
    </div>
  );
}

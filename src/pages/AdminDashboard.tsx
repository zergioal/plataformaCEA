// cea-plataforma/web/src/pages/AdminDashboard.tsx
// VERSIÓN MODO OSCURO (NEGRO/GRIS) + GESTIÓN COMPLETA + PDFs

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactElement } from "react";
import { supabase } from "../lib/supabase";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import logoCea from "../assets/logo-cea.png";

type Shift = "tarde" | "noche";
type UserRole = "student" | "teacher" | "admin";

type Level = {
  id: number;
  name: string;
  sort_order: number;
  career_id: number;
};
type Career = { id: number; name: string; student_prefix: string };

type UserRow = {
  id: string;
  code: string | null;
  full_name: string | null;
  first_names: string | null;
  last_name_pat: string | null;
  last_name_mat: string | null;
  role: UserRole | null;
  phone: string | null;
  shift: string | null;
  career_id: number | null;
  contact_email: string | null;
  likes: string | null;
  avatar_key: string | null;
  created_at?: string | null;
  rudeal_number?: string | null;
  carnet_number?: string | null;
  gender?: string | null;
  birth_date?: string | null;
};

type StudentWithLevel = UserRow & {
  current_level_id?: number | null;
  current_level_name?: string | null;
};

type EnrollmentRow = {
  student_id: string;
  level_id: number;
};

// Tipo para la vista de historial de notas
type GradeHistoryRow = {
  module_id: number;
  module_name: string;
  module_order: number;
  level_id: number;
  level_name: string;
  level_order: number;
  ser: number | null;
  saber: number | null;
  hacer_proceso: number | null;
  hacer_producto: number | null;
  decidir: number | null;
  auto_ser: number | null;
  auto_decidir: number | null;
  total: number | null;
  observation: string | null;
};

type ApiResponse = {
  ok?: boolean;
  code?: string;
  temp_password?: string;
  message?: string;
  error?: string;
};

// Logo Base64 para PDFs
const LOGO_BASE64 =
  "data:image/png;base64,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";

function randomPass(len = 10) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < len; i++)
    out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

// Estilos inline para modo oscuro NEGRO/GRIS
const darkStyles = {
  container: {
    minHeight: "100vh",
    background:
      "linear-gradient(180deg, #111111 0%, #1a1a1a 50%, #0d0d0d 100%)",
    color: "#e4e4e7",
  },
  header: {
    background: "rgba(20, 20, 20, 0.98)",
    borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
    backdropFilter: "blur(10px)",
  },
  card: {
    background: "rgba(25, 25, 25, 0.95)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    borderRadius: "12px",
    boxShadow: "0 4px 20px rgba(0, 0, 0, 0.4)",
  },
  input: {
    background: "rgba(30, 30, 30, 0.95)",
    border: "1px solid rgba(255, 255, 255, 0.15)",
    color: "#e4e4e7",
    borderRadius: "8px",
    padding: "10px 14px",
    width: "100%",
  },
  tableHeader: {
    background: "rgba(40, 40, 40, 0.9)",
    color: "#a1a1aa",
    fontWeight: "600",
  },
  tableRow: {
    borderBottom: "1px solid rgba(255, 255, 255, 0.05)",
  },
  btnPrimary: {
    background: "linear-gradient(135deg, #3b3b3b 0%, #4a4a4a 100%)",
    color: "white",
    border: "1px solid rgba(255, 255, 255, 0.2)",
    borderRadius: "8px",
    padding: "10px 20px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "all 0.3s ease",
  },
  btnSecondary: {
    background: "rgba(50, 50, 50, 0.8)",
    color: "#d4d4d8",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    borderRadius: "8px",
    padding: "10px 20px",
    fontWeight: "500",
    cursor: "pointer",
    transition: "all 0.3s ease",
  },
  btnDanger: {
    background: "linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%)",
    color: "#fecaca",
    border: "1px solid rgba(239, 68, 68, 0.3)",
    borderRadius: "8px",
    padding: "8px 16px",
    fontWeight: "500",
    cursor: "pointer",
  },
  btnSuccess: {
    background: "linear-gradient(135deg, #14532d 0%, #166534 100%)",
    color: "#bbf7d0",
    border: "1px solid rgba(34, 197, 94, 0.3)",
    borderRadius: "8px",
    padding: "8px 16px",
    fontWeight: "500",
    cursor: "pointer",
  },
  modal: {
    background: "rgba(20, 20, 20, 0.99)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    borderRadius: "16px",
    boxShadow: "0 25px 50px rgba(0, 0, 0, 0.6)",
  },
  badge: {
    background: "rgba(60, 60, 60, 0.8)",
    color: "#d4d4d8",
    padding: "4px 12px",
    borderRadius: "20px",
    fontSize: "12px",
    fontWeight: "500",
  },
  badgeTarde: {
    background: "rgba(251, 191, 36, 0.2)",
    color: "#fbbf24",
    padding: "4px 12px",
    borderRadius: "20px",
    fontSize: "12px",
    fontWeight: "500",
  },
  badgeNoche: {
    background: "rgba(171, 171, 189, 0.2)",
    color: "#c0c2c9",
    padding: "4px 12px",
    borderRadius: "20px",
    fontSize: "12px",
    fontWeight: "500",
  },
  shiftButtonSelected: {
    background: "linear-gradient(135deg, #404040 0%, #525252 100%)",
    border: "2px solid #fff",
    color: "white",
    boxShadow: "0 0 20px rgba(255, 255, 255, 0.2)",
  },
  shiftButtonUnselected: {
    background: "rgba(30, 30, 30, 0.8)",
    border: "2px solid rgba(255, 255, 255, 0.1)",
    color: "#a1a1aa",
  },
};

export default function AdminDashboard() {
  const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL ?? "");
  const anonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? "");

  const [levels, setLevels] = useState<Level[]>([]);
  const [careers, setCareers] = useState<Career[]>([]);
  const [teachers, setTeachers] = useState<UserRow[]>([]);
  const [students, setStudents] = useState<StudentWithLevel[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  // ========== GESTIÓN DE CARRERAS ==========
  const [showCareerForm, setShowCareerForm] = useState(false);
  const [editingCareerId, setEditingCareerId] = useState<number | null>(null);
  const [careerName, setCareerName] = useState("");
  const [careerPrefix, setCareerPrefix] = useState("");
  const [savingCareer, setSavingCareer] = useState(false);
  const [careerSearch, setCareerSearch] = useState("");

  // ========== MODAL PDF ESTUDIANTES ==========
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [pdfCareer, setPdfCareer] = useState<Career | null>(null);
  const [pdfShift, setPdfShift] = useState<Shift>("tarde");
  const [generatingPdf, setGeneratingPdf] = useState(false);

  // ========== MODAL PDF DOCENTES ==========
  const [showTeacherPdfModal, setShowTeacherPdfModal] = useState(false);
  const [generatingTeacherPdf, setGeneratingTeacherPdf] = useState(false);

  // ========== MODAL NOTAS ESTUDIANTE ==========
  const [showGradesModal, setShowGradesModal] = useState(false);
  const [gradesStudent, setGradesStudent] = useState<StudentWithLevel | null>(
    null,
  );
  const [studentGrades, setStudentGrades] = useState<GradeHistoryRow[]>([]);
  const [loadingGrades, setLoadingGrades] = useState(false);
  const [generatingGradesPdf, setGeneratingGradesPdf] = useState(false);

  // ========== MODAL EDITAR USUARIO ==========
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingUser, setEditingUser] = useState<
    UserRow | StudentWithLevel | null
  >(null);

  // Modales crear/editar usuarios
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [role, setRole] = useState<"student" | "teacher">("student");
  const [careerId, setCareerId] = useState<number | "">("");
  const [shift, setShift] = useState<Shift>("tarde");
  const [firstNames, setFirstNames] = useState("");
  const [lastPat, setLastPat] = useState("");
  const [lastMat, setLastMat] = useState("");
  const [phone, setPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [likes, setLikes] = useState("");
  const [avatarKey, setAvatarKey] = useState("av1");
  const [levelId, setLevelId] = useState<number | "">("");
  const [tempPassword, setTempPassword] = useState(randomPass());

  // Nuevos campos para estudiantes
  const [rudealNumber, setRudealNumber] = useState("");
  const [carnetNumber, setCarnetNumber] = useState("");
  const [gender, setGender] = useState<"F" | "M" | "">("");
  const [birthDate, setBirthDate] = useState("");

  const [creating, setCreating] = useState(false);
  const [loadingTeachers, setLoadingTeachers] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);

  // Búsqueda y filtros
  const [teacherSearch, setTeacherSearch] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [filterCareer, setFilterCareer] = useState<number | "">("");

  // Ordenamiento
  const [teacherSort, setTeacherSort] = useState<{
    column: keyof UserRow;
    direction: "asc" | "desc";
  }>({ column: "code", direction: "asc" });

  const [studentSort, setStudentSort] = useState<{
    column: keyof StudentWithLevel | "level_name";
    direction: "asc" | "desc";
  }>({ column: "code", direction: "asc" });

  // Modal reset password
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetUserId, setResetUserId] = useState("");
  const [resetUserCode, setResetUserCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetting, setResetting] = useState(false);

  // Modal de mensajes
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [messageTitle, setMessageTitle] = useState("");
  const [messageContent, setMessageContent] = useState("");
  const [messageType, setMessageType] = useState<
    "success" | "error" | "warning"
  >("success");
  const [messageResolve, setMessageResolve] = useState<(() => void) | null>(
    null,
  );

  // ========== CUENTAS BLOQUEADAS ==========
  type LockedAccount = {
    id: string;
    code: string | null;
    full_name: string | null;
    role: UserRole | null;
    locked_at: string | null;
    failed_attempts: number;
  };
  const [lockedAccounts, setLockedAccounts] = useState<LockedAccount[]>([]);
  const [loadingLocked, setLoadingLocked] = useState(false);
  const [unlockingId, setUnlockingId] = useState<string | null>(null);

  // ========== FUNCIONES HELPER ==========
  function showMessage(
    title: string,
    content: string,
    type: "success" | "error" | "warning" = "success",
  ): Promise<void> {
    return new Promise((resolve) => {
      setMessageTitle(title);
      setMessageContent(content);
      setMessageType(type);
      setMessageResolve(() => resolve);
      setShowMessageModal(true);
    });
  }

  function closeMessageModal() {
    setShowMessageModal(false);
    if (messageResolve) {
      messageResolve();
      setMessageResolve(null);
    }
  }

  function calculateAge(birthDate: string): number {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birth.getDate())
    ) {
      age--;
    }
    return age;
  }

  // ========== FUNCIONES DE CARGA ==========
  const loadCatalogs = useCallback(async () => {
    const c = await supabase
      .from("careers")
      .select("id,name,student_prefix")
      .order("name");
    if (!c.error) setCareers((c.data as Career[]) ?? []);

    const l = await supabase
      .from("levels")
      .select("id,name,sort_order,career_id")
      .order("sort_order");
    if (!l.error) setLevels((l.data as Level[]) ?? []);

    // Nota: No cargamos modules aquí, usamos v_student_grade_history que ya tiene los nombres
  }, []);

  const loadTeachers = useCallback(async () => {
    setLoadingTeachers(true);
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id,code,full_name,first_names,last_name_pat,last_name_mat,role,phone,shift,career_id,contact_email,likes,avatar_key,created_at",
      )
      .eq("role", "teacher")
      .order("created_at", { ascending: false });
    setLoadingTeachers(false);
    if (error) {
      setMsg("Error cargando docentes: " + error.message);
      return;
    }
    setTeachers((data as UserRow[]) ?? []);
  }, []);

  const loadStudents = useCallback(async () => {
    setLoadingStudents(true);
    const { data, error } = await supabase
      .from("profiles")
      .select(
        "id,code,full_name,first_names,last_name_pat,last_name_mat,role,phone,shift,career_id,contact_email,likes,avatar_key,created_at,rudeal_number,carnet_number,gender,birth_date",
      )
      .eq("role", "student")
      .order("created_at", { ascending: false });

    if (error) {
      setLoadingStudents(false);
      setMsg("Error cargando estudiantes: " + error.message);
      return;
    }

    const studentsList = (data as UserRow[]) ?? [];
    const studentIds = studentsList.map((s) => s.id);

    if (studentIds.length === 0) {
      setStudents([]);
      setLoadingStudents(false);
      return;
    }

    const { data: enrollments, error: enrollError } = await supabase
      .from("enrollments")
      .select("student_id, level_id")
      .in("student_id", studentIds);

    if (enrollError) console.error("Error cargando enrollments:", enrollError);

    const levelMap = new Map<string, number>();
    if (enrollments) {
      for (const e of enrollments as EnrollmentRow[]) {
        levelMap.set(e.student_id, e.level_id);
      }
    }

    const studentsWithLevel: StudentWithLevel[] = studentsList.map((s) => {
      const levelIdValue = levelMap.get(s.id);
      const level = levels.find((l) => l.id === levelIdValue);
      return {
        ...s,
        current_level_id: levelIdValue ?? null,
        current_level_name: level?.name ?? null,
      };
    });

    setStudents(studentsWithLevel);
    setLoadingStudents(false);
  }, [levels]);

  // Cargar cuentas bloqueadas
  const loadLockedAccounts = useCallback(async () => {
    setLoadingLocked(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id,code,full_name,role,locked_at,failed_attempts")
      .eq("locked", true)
      .order("locked_at", { ascending: false });

    setLoadingLocked(false);
    if (error) {
      console.error("Error cargando cuentas bloqueadas:", error);
      return;
    }
    setLockedAccounts((data as LockedAccount[]) ?? []);
  }, []);

  // Desbloquear cuenta
  async function unlockAccount(userId: string, userCode: string | null) {
    if (!confirm(`¿Desbloquear la cuenta ${userCode ?? userId}?`)) return;

    setUnlockingId(userId);
    const { error } = await supabase.rpc("unlock_account", { p_user_id: userId });

    if (error) {
      setUnlockingId(null);
      await showMessage("Error", "No se pudo desbloquear la cuenta: " + error.message, "error");
      return;
    }

    await showMessage("Cuenta desbloqueada", `La cuenta ${userCode ?? ""} ha sido desbloqueada exitosamente.`, "success");
    setUnlockingId(null);
    void loadLockedAccounts();
  }

  useEffect(() => {
    void loadCatalogs();
  }, [loadCatalogs]);

  useEffect(() => {
    if (careers.length > 0 && levels.length > 0) {
      void loadTeachers();
      void loadStudents();
      void loadLockedAccounts();
    }
  }, [careers.length, levels.length, loadTeachers, loadStudents, loadLockedAccounts]);

  // ========== FUNCIONES DE CARRERAS ==========
  const studentsPerCareer = useMemo(() => {
    const counts = new Map<number, number>();
    for (const s of students) {
      if (s.career_id) {
        counts.set(s.career_id, (counts.get(s.career_id) ?? 0) + 1);
      }
    }
    return counts;
  }, [students]);

  const filteredCareers = useMemo(() => {
    const s = careerSearch.trim().toLowerCase();
    if (!s) return careers;
    return careers.filter(
      (c) =>
        c.name.toLowerCase().includes(s) ||
        c.student_prefix.toLowerCase().includes(s),
    );
  }, [careers, careerSearch]);

  function resetCareerForm() {
    setShowCareerForm(false);
    setEditingCareerId(null);
    setCareerName("");
    setCareerPrefix("");
  }

  function openEditCareer(career: Career) {
    setEditingCareerId(career.id);
    setCareerName(career.name);
    setCareerPrefix(career.student_prefix);
    setShowCareerForm(true);
  }

  async function saveCareer(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    const name = careerName.trim();
    const prefix = careerPrefix.trim().toUpperCase();

    if (!name || !prefix || prefix.length < 2 || prefix.length > 5) {
      setMsg("Complete los campos correctamente");
      return;
    }

    setSavingCareer(true);

    if (editingCareerId) {
      const { error } = await supabase
        .from("careers")
        .update({ name, student_prefix: prefix })
        .eq("id", editingCareerId);
      setSavingCareer(false);
      if (error) {
        setMsg("Error actualizando carrera: " + error.message);
        return;
      }
      setMsg("✅ Carrera actualizada correctamente");
    } else {
      const { error } = await supabase
        .from("careers")
        .insert({ name, student_prefix: prefix });
      setSavingCareer(false);
      if (error) {
        setMsg(
          error.code === "23505"
            ? "Error: Ya existe una carrera con ese nombre o prefijo"
            : "Error creando carrera: " + error.message,
        );
        return;
      }
      setMsg("✅ Carrera creada correctamente");
    }

    resetCareerForm();
    await loadCatalogs();
  }

  async function deleteCareer(career: Career) {
    const studentCount = studentsPerCareer.get(career.id) ?? 0;
    if (studentCount > 0) {
      setMsg(
        `❌ No se puede eliminar "${career.name}" porque tiene ${studentCount} estudiante(s).`,
      );
      return;
    }
    if (!confirm(`¿Eliminar la carrera "${career.name}"?`)) return;

    const { error } = await supabase
      .from("careers")
      .delete()
      .eq("id", career.id);
    if (error) {
      setMsg("Error eliminando carrera: " + error.message);
      return;
    }
    setMsg("✅ Carrera eliminada correctamente");
    await loadCatalogs();
  }

  // ========== FUNCIONES PDF ESTUDIANTES ==========
  function openPdfModal(career: Career) {
    setPdfCareer(career);
    setPdfShift("tarde");
    setShowPdfModal(true);
  }

  function closePdfModal() {
    setShowPdfModal(false);
    setPdfCareer(null);
  }

  function addPdfHeader(doc: jsPDF, pageWidth: number) {
    // Logo
    try {
      doc.addImage(LOGO_BASE64, "PNG", 15, 10, 25, 25);
    } catch (error) {
      console.error("Error cargando logo:", error);
    }

    // Nombre institución
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text('CEA "MADRE MARÍA OLIVA"', pageWidth / 2, 20, { align: "center" });

    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text("Centro de Educación Alternativa", pageWidth / 2, 26, {
      align: "center",
    });

    // Línea decorativa
    doc.setDrawColor(80, 80, 80);
    doc.setLineWidth(0.5);
    doc.line(15, 38, pageWidth - 15, 38);
  }

  async function generatePdf() {
    if (!pdfCareer) return;
    setGeneratingPdf(true);

    try {
      // Filtrar y agrupar estudiantes por nivel
      const filteredStudents = students
        .filter((s) => s.career_id === pdfCareer.id && s.shift === pdfShift)
        .sort((a, b) => {
          // Primero por nivel (sort_order)
          const levelA = levels.find((l) => l.id === a.current_level_id);
          const levelB = levels.find((l) => l.id === b.current_level_id);
          const orderA = levelA?.sort_order ?? 999;
          const orderB = levelB?.sort_order ?? 999;
          if (orderA !== orderB) return orderA - orderB;

          // Luego alfabéticamente por apellido
          const patA = (a.last_name_pat ?? "").toLowerCase();
          const patB = (b.last_name_pat ?? "").toLowerCase();
          if (patA !== patB) return patA.localeCompare(patB);
          const matA = (a.last_name_mat ?? "").toLowerCase();
          const matB = (b.last_name_mat ?? "").toLowerCase();
          if (matA !== matB) return matA.localeCompare(matB);
          return (a.first_names ?? "")
            .toLowerCase()
            .localeCompare((b.first_names ?? "").toLowerCase());
        });

      const careerTeachers = teachers
        .filter((t) => t.career_id === pdfCareer.id && t.shift === pdfShift)
        .map((t) => t.full_name ?? "Sin nombre")
        .join(", ");

      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      addPdfHeader(doc, pageWidth);

      // Título
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("LISTA DE PARTICIPANTES", pageWidth / 2, 48, {
        align: "center",
      });

      // Info
      const infoStartY = 58;
      const lineHeight = 6;
      doc.setFontSize(10);

      doc.setFont("helvetica", "bold");
      doc.text("Carrera:", 14, infoStartY);
      doc.setFont("helvetica", "normal");
      doc.text(pdfCareer.name, 38, infoStartY);

      doc.setFont("helvetica", "bold");
      doc.text("Turno:", 14, infoStartY + lineHeight);
      doc.setFont("helvetica", "normal");
      doc.text(
        pdfShift === "tarde" ? "Tarde" : "Noche",
        38,
        infoStartY + lineHeight,
      );

      doc.setFont("helvetica", "bold");
      doc.text("Docente(s):", 14, infoStartY + lineHeight * 2);
      doc.setFont("helvetica", "normal");
      doc.text(
        careerTeachers || "Sin asignar",
        38,
        infoStartY + lineHeight * 2,
      );

      doc.setFont("helvetica", "bold");
      doc.text("Total:", 14, infoStartY + lineHeight * 3);
      doc.setFont("helvetica", "normal");
      doc.text(
        `${filteredStudents.length} participante(s)`,
        38,
        infoStartY + lineHeight * 3,
      );

      const today = new Date();
      const dateStr = today.toLocaleDateString("es-BO", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
      doc.setFontSize(9);
      doc.text(`Fecha: ${dateStr}`, pageWidth - 14, infoStartY, {
        align: "right",
      });

      // Tabla agrupada por nivel
      let globalIndex = 1;
      const tableData: (string | number | object)[][] = [];

      // Agrupar por nivel
      const studentsByLevel = new Map<string, StudentWithLevel[]>();
      for (const s of filteredStudents) {
        const levelName = s.current_level_name ?? "Sin nivel";
        if (!studentsByLevel.has(levelName)) {
          studentsByLevel.set(levelName, []);
        }
        studentsByLevel.get(levelName)!.push(s);
      }

      // Ordenar niveles y agregar filas
      const sortedLevels = Array.from(studentsByLevel.entries()).sort(
        (a, b) => {
          const levelA = levels.find((l) => l.name === a[0]);
          const levelB = levels.find((l) => l.name === b[0]);
          return (levelA?.sort_order ?? 999) - (levelB?.sort_order ?? 999);
        },
      );

      for (const [levelName, levelStudents] of sortedLevels) {
        // Fila de encabezado de nivel
        tableData.push([
          {
            content: `📚 ${levelName} (${levelStudents.length})`,
            colSpan: 6,
            styles: {
              fillColor: [60, 60, 60],
              textColor: 255,
              fontStyle: "bold",
              halign: "left",
            },
          } as unknown as string,
        ]);

        for (const s of levelStudents) {
          tableData.push([
            globalIndex.toString(),
            s.code ?? "-",
            s.last_name_pat ?? "-",
            s.last_name_mat ?? "-",
            s.first_names ?? "-",
            levelName,
          ]);
          globalIndex++;
        }
      }

      if (tableData.length === 0) {
        doc.setFontSize(12);
        doc.setTextColor(150, 150, 150);
        doc.text(
          "No hay participantes registrados.",
          pageWidth / 2,
          infoStartY + lineHeight * 5,
          { align: "center" },
        );
      } else {
        autoTable(doc, {
          startY: infoStartY + lineHeight * 4 + 5,
          head: [
            ["N°", "Código", "Ap. Paterno", "Ap. Materno", "Nombres", "Nivel"],
          ],
          body: tableData,
          theme: "grid",
          headStyles: {
            fillColor: [40, 40, 40],
            textColor: 255,
            fontStyle: "bold",
            halign: "center",
          },
          columnStyles: {
            0: { halign: "center", cellWidth: 10 },
            1: { halign: "center", cellWidth: 22 },
            2: { cellWidth: 32 },
            3: { cellWidth: 32 },
            4: { cellWidth: 40 },
            5: { cellWidth: 35 },
          },
          styles: { fontSize: 8, cellPadding: 2 },
          alternateRowStyles: { fillColor: [245, 245, 245] },
        });
      }

      const fileName = `Lista_${pdfCareer.student_prefix}_${pdfShift}_${dateStr.replace(/\//g, "-")}.pdf`;
      doc.save(fileName);
      setMsg(`✅ PDF generado: ${fileName}`);
      closePdfModal();
    } catch (error) {
      setMsg("❌ Error generando PDF: " + (error as Error).message);
    } finally {
      setGeneratingPdf(false);
    }
  }

  // ========== FUNCIONES PDF DOCENTES ==========
  function openTeacherPdfModal() {
    setShowTeacherPdfModal(true);
  }

  function closeTeacherPdfModal() {
    setShowTeacherPdfModal(false);
  }

  async function generateTeacherPdf() {
    setGeneratingTeacherPdf(true);

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      addPdfHeader(doc, pageWidth);

      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("LISTA DE DOCENTES", pageWidth / 2, 48, { align: "center" });

      const today = new Date();
      const dateStr = today.toLocaleDateString("es-BO", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Total: ${teachers.length} docente(s)`, 14, 58);
      doc.text(`Fecha: ${dateStr}`, pageWidth - 14, 58, { align: "right" });

      const sortedTeachers = [...teachers].sort((a, b) => {
        const patA = (a.last_name_pat ?? "").toLowerCase();
        const patB = (b.last_name_pat ?? "").toLowerCase();
        if (patA !== patB) return patA.localeCompare(patB);
        return (a.first_names ?? "")
          .toLowerCase()
          .localeCompare((b.first_names ?? "").toLowerCase());
      });

      const tableData = sortedTeachers.map((t, i) => [
        (i + 1).toString(),
        `${t.last_name_pat ?? ""} ${t.last_name_mat ?? ""}`.trim() || "-",
        t.first_names ?? "-",
        careers.find((c) => c.id === t.career_id)?.name ?? "-",
        t.shift === "tarde" ? "Tarde" : t.shift === "noche" ? "Noche" : "-",
      ]);

      autoTable(doc, {
        startY: 65,
        head: [["N°", "Apellidos", "Nombres", "Carrera", "Turno"]],
        body: tableData,
        theme: "grid",
        headStyles: {
          fillColor: [40, 40, 40],
          textColor: 255,
          fontStyle: "bold",
          halign: "center",
        },
        columnStyles: {
          0: { halign: "center", cellWidth: 12 },
          1: { cellWidth: 45 },
          2: { cellWidth: 45 },
          3: { cellWidth: 50 },
          4: { halign: "center", cellWidth: 25 },
        },
        styles: { fontSize: 9, cellPadding: 3 },
        alternateRowStyles: { fillColor: [245, 245, 245] },
      });

      const fileName = `Lista_Docentes_${dateStr.replace(/\//g, "-")}.pdf`;
      doc.save(fileName);
      setMsg(`✅ PDF generado: ${fileName}`);
      closeTeacherPdfModal();
    } catch (error) {
      setMsg("❌ Error generando PDF: " + (error as Error).message);
    } finally {
      setGeneratingTeacherPdf(false);
    }
  }

  // ========== FUNCIONES NOTAS ESTUDIANTE (CORREGIDO) ==========
  async function openGradesModal(student: StudentWithLevel) {
    setGradesStudent(student);
    setShowGradesModal(true);
    setLoadingGrades(true);
    setStudentGrades([]);

    try {
      // Usar la vista v_student_grade_history que tiene todos los datos
      const { data, error } = await supabase
        .from("v_student_grade_history")
        .select(
          "module_id,module_name,module_order,level_id,level_name,level_order,ser,saber,hacer_proceso,hacer_producto,decidir,auto_ser,auto_decidir,total,observation",
        )
        .eq("student_id", student.id)
        .order("level_order", { ascending: true })
        .order("module_order", { ascending: true });

      if (error) {
        console.error("Error cargando notas:", error);
        setMsg("Error cargando notas: " + error.message);
        setStudentGrades([]);
      } else {
        setStudentGrades((data as GradeHistoryRow[]) ?? []);
      }
    } catch (err) {
      console.error("Error:", err);
      setMsg("Error: " + (err as Error).message);
      setStudentGrades([]);
    } finally {
      setLoadingGrades(false);
    }
  }

  function closeGradesModal() {
    setShowGradesModal(false);
    setGradesStudent(null);
    setStudentGrades([]);
  }

  async function generateGradesPdf() {
    if (!gradesStudent || studentGrades.length === 0) return;
    setGeneratingGradesPdf(true);

    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();

      addPdfHeader(doc, pageWidth);

      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text("HISTORIAL DE CALIFICACIONES", pageWidth / 2, 48, {
        align: "center",
      });

      const infoY = 58;
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("Estudiante:", 14, infoY);
      doc.setFont("helvetica", "normal");
      doc.text(gradesStudent.full_name ?? "-", 42, infoY);

      doc.setFont("helvetica", "bold");
      doc.text("Código:", 14, infoY + 6);
      doc.setFont("helvetica", "normal");
      doc.text(gradesStudent.code ?? "-", 42, infoY + 6);

      doc.setFont("helvetica", "bold");
      doc.text("Carrera:", 14, infoY + 12);
      doc.setFont("helvetica", "normal");
      doc.text(
        careers.find((c) => c.id === gradesStudent.career_id)?.name ?? "-",
        42,
        infoY + 12,
      );

      const today = new Date();
      const dateStr = today.toLocaleDateString("es-BO", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
      doc.text(`Fecha: ${dateStr}`, pageWidth - 14, infoY, { align: "right" });

      // Agrupar por nivel
      const gradesByLevel = new Map<string, GradeHistoryRow[]>();
      for (const g of studentGrades) {
        const key = g.level_name;
        if (!gradesByLevel.has(key)) gradesByLevel.set(key, []);
        gradesByLevel.get(key)!.push(g);
      }

      const tableData: (string | number | object)[][] = [];
      for (const [levelName, grades] of gradesByLevel) {
        tableData.push([
          {
            content: `📚 ${levelName}`,
            colSpan: 7,
            styles: {
              fillColor: [60, 60, 60],
              textColor: 255,
              fontStyle: "bold",
            },
          } as unknown as string,
        ]);

        for (const g of grades) {
          tableData.push([
            g.module_name ?? "-",
            g.ser?.toString() ?? "-",
            g.saber?.toString() ?? "-",
            g.hacer_proceso?.toString() ?? "-",
            g.hacer_producto?.toString() ?? "-",
            g.decidir?.toString() ?? "-",
            g.total?.toString() ?? "-",
          ]);
        }
      }

      autoTable(doc, {
        startY: infoY + 20,
        head: [["Módulo", "SER", "SABER", "HAC.P", "HAC.PR", "DEC.", "TOTAL"]],
        body: tableData,
        theme: "grid",
        headStyles: {
          fillColor: [40, 40, 40],
          textColor: 255,
          fontStyle: "bold",
          halign: "center",
        },
        columnStyles: {
          0: { cellWidth: 55 },
          1: { halign: "center", cellWidth: 18 },
          2: { halign: "center", cellWidth: 18 },
          3: { halign: "center", cellWidth: 18 },
          4: { halign: "center", cellWidth: 18 },
          5: { halign: "center", cellWidth: 18 },
          6: { halign: "center", cellWidth: 20, fontStyle: "bold" },
        },
        styles: { fontSize: 8, cellPadding: 2 },
        alternateRowStyles: { fillColor: [245, 245, 245] },
      });

      const fileName = `Notas_${gradesStudent.code}_${dateStr.replace(/\//g, "-")}.pdf`;
      doc.save(fileName);
      setMsg(`✅ PDF generado: ${fileName}`);
    } catch (error) {
      setMsg("❌ Error generando PDF: " + (error as Error).message);
    } finally {
      setGeneratingGradesPdf(false);
    }
  }

  const getStudentCountByShift = (careerId: number, shiftValue: Shift) => {
    return students.filter(
      (s) => s.career_id === careerId && s.shift === shiftValue,
    ).length;
  };

  // ========== FUNCIONES CRUD USUARIOS ==========
  const filteredTeachers = useMemo(() => {
    const s = teacherSearch.trim().toLowerCase();
    let result = teachers;
    if (s) {
      result = result.filter((t) => {
        const a = (t.code ?? "").toLowerCase();
        const b = (t.full_name ?? "").toLowerCase();
        const c = (t.phone ?? "").toLowerCase();
        return a.includes(s) || b.includes(s) || c.includes(s);
      });
    }
    result = result.slice().sort((a, b) => {
      const aVal = a[teacherSort.column] ?? "";
      const bVal = b[teacherSort.column] ?? "";
      return teacherSort.direction === "asc"
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
    return result;
  }, [teachers, teacherSearch, teacherSort]);

  const filteredStudents = useMemo(() => {
    const s = studentSearch.trim().toLowerCase();
    let result = students;
    if (s) {
      result = result.filter((st) => {
        const code = (st.code ?? "").toLowerCase();
        const fullName = (st.full_name ?? "").toLowerCase();
        const phone = (st.phone ?? "").toLowerCase();
        const firstNames = (st.first_names ?? "").toLowerCase();
        const lastPat = (st.last_name_pat ?? "").toLowerCase();
        const lastMat = (st.last_name_mat ?? "").toLowerCase();
        const rudeal = (st.rudeal_number ?? "").toLowerCase();
        const carnet = (st.carnet_number ?? "").toLowerCase();
        return (
          code.includes(s) ||
          fullName.includes(s) ||
          phone.includes(s) ||
          firstNames.includes(s) ||
          lastPat.includes(s) ||
          lastMat.includes(s) ||
          rudeal.includes(s) ||
          carnet.includes(s)
        );
      });
    }
    if (filterCareer) {
      result = result.filter((st) => st.career_id === filterCareer);
    }
    result = result.slice().sort((a, b) => {
      let aVal: string | number = "";
      let bVal: string | number = "";
      if (studentSort.column === "level_name") {
        aVal = a.current_level_name ?? "";
        bVal = b.current_level_name ?? "";
      } else {
        aVal = a[studentSort.column as keyof UserRow] ?? "";
        bVal = b[studentSort.column as keyof UserRow] ?? "";
      }
      return studentSort.direction === "asc"
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
    return result;
  }, [students, studentSearch, filterCareer, studentSort]);

  function resetForm() {
    setShowEditModal(false);
    setShowCreateModal(false);
    setEditingId(null);
    setEditingUser(null);
    setRole("student");
    setCareerId("");
    setShift("tarde");
    setFirstNames("");
    setLastPat("");
    setLastMat("");
    setPhone("");
    setContactEmail("");
    setLikes("");
    setAvatarKey("av1");
    setLevelId("");
    setTempPassword(randomPass());
    setRudealNumber("");
    setCarnetNumber("");
    setGender("");
    setBirthDate("");
  }

  function openEdit(user: UserRow | StudentWithLevel) {
    setEditingUser(user);
    setEditingId(user.id);
    setRole((user.role as "student" | "teacher") ?? "student");
    setCareerId(user.career_id ?? "");
    setShift((user.shift as Shift) ?? "tarde");
    setFirstNames(user.first_names ?? "");
    setLastPat(user.last_name_pat ?? "");
    setLastMat(user.last_name_mat ?? "");
    setPhone(user.phone ?? "");
    setContactEmail(user.contact_email ?? "");
    setLikes(user.likes ?? "");
    setAvatarKey(user.avatar_key ?? "av1");
    setRudealNumber(user.rudeal_number ?? "");
    setCarnetNumber(user.carnet_number ?? "");
    setGender((user.gender as "F" | "M") ?? "");
    setBirthDate(user.birth_date ?? "");
    if (user.role === "student") {
      const student = user as StudentWithLevel;
      setLevelId(student.current_level_id ?? "");
    }
    setShowEditModal(true);
  }

  async function createUser(e: FormEvent) {
    e.preventDefault();
    setMsg(null);
    setCreating(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    if (!session) {
      setCreating(false);
      showMessage("Error de sesión", "No hay sesión activa.", "error");
      return;
    }

    const fn = firstNames.trim();
    const lp = lastPat.trim();
    const lm = lastMat.trim();
    const ph = phone.trim();

    if (!fn || (!lp && !lm) || !ph || !careerId) {
      setCreating(false);
      showMessage(
        "Campos incompletos",
        "Complete todos los campos obligatorios.",
        "error",
      );
      return;
    }
    if (role === "student" && !levelId) {
      setCreating(false);
      showMessage(
        "Nivel requerido",
        "Seleccione un nivel para el estudiante.",
        "error",
      );
      return;
    }
    // Validar campos obligatorios para estudiantes
    if (role === "student") {
      if (!carnetNumber.trim()) {
        setCreating(false);
        showMessage(
          "Campo requerido",
          "El N° de Carnet es obligatorio para estudiantes.",
          "error",
        );
        return;
      }
      if (!gender) {
        setCreating(false);
        showMessage(
          "Campo requerido",
          "El Género es obligatorio para estudiantes.",
          "error",
        );
        return;
      }
      if (!birthDate) {
        setCreating(false);
        showMessage(
          "Campo requerido",
          "La Fecha de Nacimiento es obligatoria para estudiantes.",
          "error",
        );
        return;
      }

      // Verificar edad
      const age = calculateAge(birthDate);
      if (age < 14) {
        setCreating(false);
        showMessage(
          "❌ Edad no permitida",
          `El estudiante tiene ${age} años. No se pueden registrar participantes menores de 15 años.`,
          "error",
        );
        return;
      }
      if (age === 14) {
        await showMessage(
          "⚠️ Advertencia",
          `El estudiante tiene ${age} años (menor de 15). El registro se guardará normalmente.`,
          "warning",
        );
      }
    }

    const payload = {
      role,
      temp_password: tempPassword,
      first_names: fn,
      last_name_pat: lp || undefined,
      last_name_mat: lm || undefined,
      phone: ph,
      contact_email: contactEmail.trim() || undefined,
      career_id: Number(careerId),
      shift,
      likes: likes.trim() || undefined,
      avatar_key: avatarKey,
      ...(role === "student"
        ? {
            level_id: Number(levelId),
            rudeal_number: rudealNumber.trim() || undefined,
            carnet_number: carnetNumber.trim(),
            gender: gender,
            birth_date: birthDate,
          }
        : {}),
    };

    const res = await fetch(`${supabaseUrl}/functions/v1/create-user`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(payload),
    });

    const raw = await res.text();
    setCreating(false);

    let out: ApiResponse = {};
    try {
      out = raw ? JSON.parse(raw) : { error: "Respuesta vacía" };
    } catch {
      out = { error: raw };
    }

    if (!res.ok) {
      showMessage(
        "Error al crear usuario",
        `Error ${res.status}: ${out.error ?? raw}`,
        "error",
      );
      return;
    }

    const userName = `${fn} ${lp || ""} ${lm || ""}`.trim();
    showMessage(
      "✅ Usuario creado exitosamente",
      `${role === "student" ? "Estudiante" : "Docente"}: ${userName}\nCódigo: ${out.code}\nContraseña temporal: ${out.temp_password}`,
      "success",
    );
    resetForm();
    await loadTeachers();
    await loadStudents();
  }

  async function updateUser(e: FormEvent) {
    e.preventDefault();
    if (!editingId) return;

    setMsg(null);
    setCreating(true);

    const fn = firstNames.trim();
    const lp = lastPat.trim();
    const lm = lastMat.trim();
    const ph = phone.trim();

    if (!fn || (!lp && !lm) || !ph || !careerId) {
      setCreating(false);
      showMessage(
        "Campos incompletos",
        "Complete todos los campos obligatorios.",
        "error",
      );
      return;
    }
    if (role === "student" && !levelId) {
      setCreating(false);
      showMessage(
        "Nivel requerido",
        "Seleccione un nivel para el estudiante.",
        "error",
      );
      return;
    }

    // Verificar edad si es estudiante y hay fecha de nacimiento
    if (role === "student" && birthDate) {
      const age = calculateAge(birthDate);
      if (age < 14) {
        setCreating(false);
        showMessage(
          "❌ Edad no permitida",
          `El estudiante tiene ${age} años. No se pueden registrar participantes menores de 15 años.`,
          "error",
        );
        return;
      }
      if (age === 14) {
        await showMessage(
          "⚠️ Advertencia",
          `El estudiante tiene ${age} años (menor de 15).`,
          "warning",
        );
      }
    }

    // Construir full_name
    const parts = [fn, lp, lm].filter(Boolean);
    const fullName = parts.join(" ");

    // Preparar datos de actualización
    const updateData: Record<string, unknown> = {
      first_names: fn,
      last_name_pat: lp || null,
      last_name_mat: lm || null,
      full_name: fullName,
      phone: ph,
      contact_email: contactEmail.trim() || null,
      career_id: Number(careerId),
      shift,
      likes: likes.trim() || null,
      avatar_key: avatarKey,
    };

    // Agregar campos de estudiante si aplica
    if (role === "student") {
      updateData.rudeal_number = rudealNumber.trim() || null;
      updateData.carnet_number = carnetNumber.trim() || null;
      updateData.gender = gender || null;
      updateData.birth_date = birthDate || null;
    }

    // Actualizar perfil directamente
    const { error: updateErr } = await supabase
      .from("profiles")
      .update(updateData)
      .eq("id", editingId);

    if (updateErr) {
      setCreating(false);
      showMessage("Error al actualizar", updateErr.message, "error");
      return;
    }

    // Si es estudiante, actualizar enrollment directamente
    if (role === "student" && levelId) {
      // Primero eliminar enrollment existente
      await supabase.from("enrollments").delete().eq("student_id", editingId);

      // Luego insertar el nuevo
      const { error: enrollError } = await supabase
        .from("enrollments")
        .insert({ student_id: editingId, level_id: Number(levelId) });

      if (enrollError) {
        console.error("Error actualizando enrollment:", enrollError);
        // No fallamos, solo advertimos
      }
    }

    setCreating(false);
    showMessage(
      "✅ Usuario actualizado",
      `Los datos de ${fullName} han sido actualizados correctamente.`,
      "success",
    );
    resetForm();
    await loadTeachers();
    await loadStudents();
  }

  async function deleteUser(userId: string, code: string) {
    if (!confirm(`¿Eliminar usuario ${code}?`)) return;

    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    if (!session) {
      setMsg("No hay sesión activa.");
      return;
    }

    const res = await fetch(`${supabaseUrl}/functions/v1/delete-user`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ user_id: userId }),
    });

    const raw = await res.text();
    let out: ApiResponse = {};
    try {
      out = raw ? JSON.parse(raw) : { error: "Respuesta vacía" };
    } catch {
      out = { error: raw };
    }

    if (!res.ok) {
      setMsg(`Error ${res.status}: ${out.error ?? raw}`);
      return;
    }

    setMsg("✅ Usuario eliminado correctamente");
    await loadTeachers();
    await loadStudents();
  }

  function openResetPassword(userId: string, code: string) {
    setResetUserId(userId);
    setResetUserCode(code);
    setNewPassword(randomPass());
    setShowResetModal(true);
  }

  async function resetPassword() {
    if (!newPassword.trim()) {
      alert("Ingrese una contraseña");
      return;
    }

    setResetting(true);
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    if (!session) {
      setResetting(false);
      setMsg("No hay sesión activa.");
      return;
    }

    const res = await fetch(`${supabaseUrl}/functions/v1/reset-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ user_id: resetUserId, new_password: newPassword }),
    });

    const raw = await res.text();
    setResetting(false);

    let out: ApiResponse = {};
    try {
      out = raw ? JSON.parse(raw) : { error: "Respuesta vacía" };
    } catch {
      out = { error: raw };
    }

    if (!res.ok) {
      setMsg(`Error ${res.status}: ${out.error ?? raw}`);
      return;
    }

    setMsg(`✅ Contraseña actualizada para ${resetUserCode}: ${newPassword}`);
    setShowResetModal(false);
  }

  function toggleTeacherSort(column: keyof UserRow) {
    setTeacherSort((prev) => ({
      column,
      direction:
        prev.column === column && prev.direction === "asc" ? "desc" : "asc",
    }));
  }

  function toggleStudentSort(column: keyof StudentWithLevel | "level_name") {
    setStudentSort((prev) => ({
      column,
      direction:
        prev.column === column && prev.direction === "asc" ? "desc" : "asc",
    }));
  }

  const availableLevels = useMemo(() => {
    if (role !== "student") return [];
    if (!careerId) return [];
    // Filtrar niveles solo de la carrera seleccionada
    return levels
      .filter((l) => l.career_id === careerId)
      .sort((a, b) => a.sort_order - b.sort_order);
  }, [levels, role, careerId]);

  // ========== RENDER ==========
  return (
    <div style={darkStyles.container}>
      {/* HEADER */}
      <header style={{ ...darkStyles.header, padding: "16px 24px" }}>
        <div
          style={{
            maxWidth: "1400px",
            margin: "0 auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <img
              src={logoCea}
              alt="CEA Logo"
              style={{
                height: "128px",
                width: "128px",
                borderRadius: "12px",
                objectFit: "contain",
                background: "none",
                padding: "4px",
              }}
            />
            <div>
              <div
                style={{
                  fontSize: "12px",
                  color: "#71717a",
                  textTransform: "uppercase",
                  letterSpacing: "1px",
                }}
              >
                CEA Madre María Oliva
              </div>
              <h1
                style={{
                  fontSize: "24px",
                  fontWeight: "700",
                  color: "#fff",
                  margin: "4px 0 0",
                }}
              >
                Panel de Administración
              </h1>
            </div>
          </div>
          <div style={{ display: "flex", gap: "12px" }}>
            <button
              style={darkStyles.btnPrimary}
              onClick={() => supabase.auth.signOut()}
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: "1400px", margin: "0 auto", padding: "24px" }}>
        {/* MENSAJE */}
        {msg && (
          <div
            style={{
              padding: "16px 20px",
              borderRadius: "12px",
              marginBottom: "20px",
              background: msg.includes("✅")
                ? "rgba(34, 197, 94, 0.15)"
                : "rgba(239, 68, 68, 0.15)",
              border: `1px solid ${msg.includes("✅") ? "rgba(34, 197, 94, 0.4)" : "rgba(239, 68, 68, 0.4)"}`,
              color: msg.includes("✅") ? "#86efac" : "#fca5a5",
            }}
          >
            <pre
              style={{
                margin: 0,
                whiteSpace: "pre-wrap",
                fontFamily: "inherit",
              }}
            >
              {msg}
            </pre>
          </div>
        )}

        {/* SECCIÓN CUENTAS BLOQUEADAS */}
        {(lockedAccounts.length > 0 || loadingLocked) && (
          <section
            style={{
              ...darkStyles.card,
              padding: "24px",
              marginBottom: "24px",
              border: "2px solid rgba(239, 68, 68, 0.4)",
              background: "linear-gradient(135deg, rgba(127, 29, 29, 0.3) 0%, rgba(30, 30, 30, 0.95) 100%)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "16px",
              }}
            >
              <h2
                style={{
                  fontSize: "18px",
                  fontWeight: "600",
                  color: "#fca5a5",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                🔒 Cuentas Bloqueadas ({lockedAccounts.length})
              </h2>
              <button
                style={{ ...darkStyles.btnSecondary, padding: "6px 12px", fontSize: "13px" }}
                onClick={() => void loadLockedAccounts()}
                disabled={loadingLocked}
              >
                {loadingLocked ? "Cargando..." : "🔄 Actualizar"}
              </button>
            </div>

            {loadingLocked ? (
              <div style={{ textAlign: "center", padding: "20px", color: "#a1a1aa" }}>
                Cargando cuentas bloqueadas...
              </div>
            ) : lockedAccounts.length === 0 ? (
              <div style={{ textAlign: "center", padding: "20px", color: "#86efac" }}>
                ✅ No hay cuentas bloqueadas
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                      <th style={{ padding: "12px", textAlign: "left", color: "#a1a1aa", fontSize: "13px" }}>Código</th>
                      <th style={{ padding: "12px", textAlign: "left", color: "#a1a1aa", fontSize: "13px" }}>Nombre</th>
                      <th style={{ padding: "12px", textAlign: "left", color: "#a1a1aa", fontSize: "13px" }}>Rol</th>
                      <th style={{ padding: "12px", textAlign: "left", color: "#a1a1aa", fontSize: "13px" }}>Intentos</th>
                      <th style={{ padding: "12px", textAlign: "left", color: "#a1a1aa", fontSize: "13px" }}>Bloqueado</th>
                      <th style={{ padding: "12px", textAlign: "center", color: "#a1a1aa", fontSize: "13px" }}>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lockedAccounts.map((acc) => (
                      <tr
                        key={acc.id}
                        style={{
                          borderBottom: "1px solid rgba(255,255,255,0.05)",
                          background: "rgba(239, 68, 68, 0.05)",
                        }}
                      >
                        <td style={{ padding: "12px", color: "#fff", fontFamily: "monospace" }}>
                          {acc.code || "—"}
                        </td>
                        <td style={{ padding: "12px", color: "#fff" }}>
                          {acc.full_name || "Sin nombre"}
                        </td>
                        <td style={{ padding: "12px" }}>
                          <span
                            style={{
                              padding: "4px 8px",
                              borderRadius: "6px",
                              fontSize: "12px",
                              fontWeight: "500",
                              background:
                                acc.role === "teacher"
                                  ? "rgba(59, 130, 246, 0.2)"
                                  : acc.role === "student"
                                    ? "rgba(34, 197, 94, 0.2)"
                                    : "rgba(168, 85, 247, 0.2)",
                              color:
                                acc.role === "teacher"
                                  ? "#93c5fd"
                                  : acc.role === "student"
                                    ? "#86efac"
                                    : "#c4b5fd",
                            }}
                          >
                            {acc.role === "teacher" ? "Docente" : acc.role === "student" ? "Estudiante" : acc.role}
                          </span>
                        </td>
                        <td style={{ padding: "12px", color: "#fca5a5", fontWeight: "600" }}>
                          {acc.failed_attempts}
                        </td>
                        <td style={{ padding: "12px", color: "#a1a1aa", fontSize: "13px" }}>
                          {acc.locked_at
                            ? new Date(acc.locked_at).toLocaleString("es-BO", {
                                day: "2-digit",
                                month: "2-digit",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "—"}
                        </td>
                        <td style={{ padding: "12px", textAlign: "center" }}>
                          <button
                            style={{
                              ...darkStyles.btnPrimary,
                              padding: "6px 12px",
                              fontSize: "13px",
                              background: "linear-gradient(135deg, #22c55e 0%, #16a34a 100%)",
                            }}
                            onClick={() => void unlockAccount(acc.id, acc.code)}
                            disabled={unlockingId === acc.id}
                          >
                            {unlockingId === acc.id ? "..." : "🔓 Desbloquear"}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <p style={{ marginTop: "12px", fontSize: "12px", color: "#a1a1aa" }}>
              Las cuentas se bloquean automáticamente después de 5 intentos fallidos de inicio de sesión.
            </p>
          </section>
        )}

        {/* SECCIÓN CARRERAS */}
        <section
          style={{ ...darkStyles.card, padding: "24px", marginBottom: "24px" }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "20px",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <h2
              style={{
                fontSize: "18px",
                fontWeight: "600",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              🎓 Carreras
            </h2>
            <div style={{ display: "flex", gap: "12px" }}>
              <input
                style={{ ...darkStyles.input, width: "250px" }}
                placeholder="Buscar carrera..."
                value={careerSearch}
                onChange={(e) => setCareerSearch(e.target.value)}
              />
              {!showCareerForm && (
                <button
                  style={darkStyles.btnPrimary}
                  onClick={() => setShowCareerForm(true)}
                >
                  + Nueva Carrera
                </button>
              )}
            </div>
          </div>

          {/* Form Carrera */}
          {showCareerForm && (
            <div
              style={{
                background: "rgba(50, 50, 50, 0.5)",
                borderRadius: "12px",
                padding: "20px",
                marginBottom: "20px",
                border: "1px solid rgba(255, 255, 255, 0.1)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: "16px",
                }}
              >
                <h3 style={{ color: "#d4d4d8", fontWeight: "600" }}>
                  {editingCareerId ? "Editar Carrera" : "Nueva Carrera"}
                </h3>
                <button
                  style={{
                    ...darkStyles.btnSecondary,
                    padding: "6px 12px",
                    fontSize: "13px",
                  }}
                  onClick={resetCareerForm}
                >
                  Cancelar
                </button>
              </div>
              <form
                onSubmit={saveCareer}
                style={{
                  display: "grid",
                  gridTemplateColumns: "2fr 1fr auto",
                  gap: "16px",
                  alignItems: "end",
                }}
              >
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "13px",
                      color: "#a1a1aa",
                      marginBottom: "6px",
                    }}
                  >
                    Nombre *
                  </label>
                  <input
                    style={darkStyles.input}
                    value={careerName}
                    onChange={(e) => setCareerName(e.target.value)}
                    placeholder="Ej: Enfermería"
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "13px",
                      color: "#a1a1aa",
                      marginBottom: "6px",
                    }}
                  >
                    Prefijo *
                  </label>
                  <input
                    style={{ ...darkStyles.input, textTransform: "uppercase" }}
                    value={careerPrefix}
                    onChange={(e) =>
                      setCareerPrefix(e.target.value.toUpperCase())
                    }
                    placeholder="ENF"
                    maxLength={5}
                  />
                </div>
                <button
                  type="submit"
                  disabled={savingCareer}
                  style={darkStyles.btnPrimary}
                >
                  {savingCareer ? "Guardando..." : "Guardar"}
                </button>
              </form>
            </div>
          )}

          {/* Tabla Carreras */}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={darkStyles.tableHeader}>
                  <th style={{ padding: "12px 16px", textAlign: "left" }}>
                    Prefijo
                  </th>
                  <th style={{ padding: "12px 16px", textAlign: "left" }}>
                    Nombre
                  </th>
                  <th style={{ padding: "12px 16px", textAlign: "center" }}>
                    Estudiantes
                  </th>
                  <th style={{ padding: "12px 16px", textAlign: "center" }}>
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredCareers.map((c) => {
                  const count = studentsPerCareer.get(c.id) ?? 0;
                  return (
                    <tr key={c.id} style={darkStyles.tableRow}>
                      <td
                        style={{
                          padding: "12px 16px",
                          fontFamily: "monospace",
                          color: "#e4e4e7",
                          fontWeight: "600",
                        }}
                      >
                        {c.student_prefix}
                      </td>
                      <td style={{ padding: "12px 16px", color: "#e4e4e7" }}>
                        {c.name}
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "center" }}>
                        <span style={darkStyles.badge}>{count}</span>
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "center" }}>
                        <div
                          style={{
                            display: "flex",
                            gap: "8px",
                            justifyContent: "center",
                          }}
                        >
                          <button
                            style={{
                              ...darkStyles.btnSecondary,
                              padding: "6px 12px",
                              fontSize: "12px",
                            }}
                            onClick={() => openPdfModal(c)}
                          >
                            📄 PDF
                          </button>
                          <button
                            style={{
                              ...darkStyles.btnSecondary,
                              padding: "6px 12px",
                              fontSize: "12px",
                            }}
                            onClick={() => openEditCareer(c)}
                          >
                            Editar
                          </button>
                          <button
                            style={{
                              ...darkStyles.btnDanger,
                              padding: "6px 12px",
                              fontSize: "12px",
                              opacity: count > 0 ? 0.5 : 1,
                              cursor: count > 0 ? "not-allowed" : "pointer",
                            }}
                            onClick={() => count === 0 && deleteCareer(c)}
                            disabled={count > 0}
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredCareers.length === 0 && (
                  <tr>
                    <td
                      colSpan={4}
                      style={{
                        padding: "40px",
                        textAlign: "center",
                        color: "#71717a",
                      }}
                    >
                      No hay carreras
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* SECCIÓN DOCENTES */}
        <section
          style={{ ...darkStyles.card, padding: "24px", marginBottom: "24px" }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "20px",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <h2 style={{ fontSize: "18px", fontWeight: "600", color: "#fff" }}>
              👨‍🏫 Docentes
            </h2>
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <input
                style={{ ...darkStyles.input, width: "220px" }}
                placeholder="Buscar docente..."
                value={teacherSearch}
                onChange={(e) => setTeacherSearch(e.target.value)}
              />
              <button style={darkStyles.btnSecondary} onClick={loadTeachers}>
                {loadingTeachers ? "..." : "🔄"}
              </button>
              <button
                style={{ ...darkStyles.btnSuccess }}
                onClick={openTeacherPdfModal}
              >
                📄 PDF Docentes
              </button>
              <button
                style={darkStyles.btnPrimary}
                onClick={() => {
                  resetForm();
                  setRole("teacher");
                  setShowCreateModal(true);
                }}
              >
                + Nuevo Docente
              </button>
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={darkStyles.tableHeader}>
                  <th
                    style={{
                      padding: "12px 16px",
                      textAlign: "left",
                      cursor: "pointer",
                    }}
                    onClick={() => toggleTeacherSort("code")}
                  >
                    Código{" "}
                    {teacherSort.column === "code" &&
                      (teacherSort.direction === "asc" ? "↑" : "↓")}
                  </th>
                  <th
                    style={{
                      padding: "12px 16px",
                      textAlign: "left",
                      cursor: "pointer",
                    }}
                    onClick={() => toggleTeacherSort("full_name")}
                  >
                    Nombre{" "}
                    {teacherSort.column === "full_name" &&
                      (teacherSort.direction === "asc" ? "↑" : "↓")}
                  </th>
                  <th style={{ padding: "12px 16px", textAlign: "left" }}>
                    Carrera
                  </th>
                  <th style={{ padding: "12px 16px", textAlign: "center" }}>
                    Turno
                  </th>
                  <th style={{ padding: "12px 16px", textAlign: "left" }}>
                    Celular
                  </th>
                  <th style={{ padding: "12px 16px", textAlign: "center" }}>
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredTeachers.map((t) => (
                  <tr key={t.id} style={darkStyles.tableRow}>
                    <td
                      style={{
                        padding: "12px 16px",
                        fontFamily: "monospace",
                        color: "#e4e4e7",
                      }}
                    >
                      {t.code ?? "-"}
                    </td>
                    <td style={{ padding: "12px 16px", color: "#e4e4e7" }}>
                      {t.full_name ?? "-"}
                    </td>
                    <td
                      style={{
                        padding: "12px 16px",
                        color: "#a1a1aa",
                        fontSize: "13px",
                      }}
                    >
                      {careers.find((c) => c.id === t.career_id)?.name ?? "-"}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "center" }}>
                      <span
                        style={
                          t.shift === "tarde"
                            ? darkStyles.badgeTarde
                            : darkStyles.badgeNoche
                        }
                      >
                        {t.shift === "tarde" ? "🌤️ Tarde" : "🌙 Noche"}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: "12px 16px",
                        color: "#a1a1aa",
                        fontSize: "13px",
                      }}
                    >
                      {t.phone ?? "-"}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div
                        style={{
                          display: "flex",
                          gap: "6px",
                          justifyContent: "center",
                          flexWrap: "wrap",
                        }}
                      >
                        <button
                          style={{
                            ...darkStyles.btnSecondary,
                            padding: "5px 10px",
                            fontSize: "11px",
                          }}
                          onClick={() => openEdit(t)}
                        >
                          Editar
                        </button>
                        <button
                          style={{
                            ...darkStyles.btnSecondary,
                            padding: "5px 10px",
                            fontSize: "11px",
                          }}
                          onClick={() =>
                            openResetPassword(t.id, t.code ?? t.id)
                          }
                        >
                          Contraseña
                        </button>
                        <button
                          style={{
                            ...darkStyles.btnDanger,
                            padding: "5px 10px",
                            fontSize: "11px",
                          }}
                          onClick={() => deleteUser(t.id, t.code ?? t.id)}
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredTeachers.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      style={{
                        padding: "40px",
                        textAlign: "center",
                        color: "#71717a",
                      }}
                    >
                      {loadingTeachers ? "Cargando..." : "Sin resultados"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* SECCIÓN ESTUDIANTES */}
        <section style={{ ...darkStyles.card, padding: "24px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "20px",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <h2 style={{ fontSize: "18px", fontWeight: "600", color: "#fff" }}>
              👨‍🎓 Estudiantes
            </h2>
            <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
              <select
                style={{ ...darkStyles.input, width: "180px" }}
                value={filterCareer}
                onChange={(e) =>
                  setFilterCareer(e.target.value ? Number(e.target.value) : "")
                }
              >
                <option value="">Todas las carreras</option>
                {careers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <input
                style={{ ...darkStyles.input, width: "220px" }}
                placeholder="Buscar estudiante..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
              />
              <button style={darkStyles.btnSecondary} onClick={loadStudents}>
                {loadingStudents ? "..." : "🔄"}
              </button>
              <button
                style={darkStyles.btnPrimary}
                onClick={() => {
                  resetForm();
                  setRole("student");
                  setShowCreateModal(true);
                }}
              >
                + Nuevo Estudiante
              </button>
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={darkStyles.tableHeader}>
                  <th
                    style={{
                      padding: "12px 8px",
                      textAlign: "left",
                      cursor: "pointer",
                      fontSize: "12px",
                    }}
                    onClick={() => toggleStudentSort("code")}
                  >
                    Código{" "}
                    {studentSort.column === "code" &&
                      (studentSort.direction === "asc" ? "↑" : "↓")}
                  </th>
                  <th
                    style={{
                      padding: "12px 8px",
                      textAlign: "left",
                      cursor: "pointer",
                      fontSize: "12px",
                    }}
                    onClick={() => toggleStudentSort("rudeal_number")}
                  >
                    RUDEAL{" "}
                    {studentSort.column === "rudeal_number" &&
                      (studentSort.direction === "asc" ? "↑" : "↓")}
                  </th>
                  <th
                    style={{
                      padding: "12px 8px",
                      textAlign: "left",
                      cursor: "pointer",
                      fontSize: "12px",
                    }}
                    onClick={() => toggleStudentSort("last_name_pat")}
                  >
                    Ap. Paterno{" "}
                    {studentSort.column === "last_name_pat" &&
                      (studentSort.direction === "asc" ? "↑" : "↓")}
                  </th>
                  <th
                    style={{
                      padding: "12px 8px",
                      textAlign: "left",
                      cursor: "pointer",
                      fontSize: "12px",
                    }}
                    onClick={() => toggleStudentSort("last_name_mat")}
                  >
                    Ap. Materno{" "}
                    {studentSort.column === "last_name_mat" &&
                      (studentSort.direction === "asc" ? "↑" : "↓")}
                  </th>
                  <th
                    style={{
                      padding: "12px 8px",
                      textAlign: "left",
                      cursor: "pointer",
                      fontSize: "12px",
                    }}
                    onClick={() => toggleStudentSort("first_names")}
                  >
                    Nombres{" "}
                    {studentSort.column === "first_names" &&
                      (studentSort.direction === "asc" ? "↑" : "↓")}
                  </th>
                  <th
                    style={{
                      padding: "12px 8px",
                      textAlign: "left",
                      cursor: "pointer",
                      fontSize: "12px",
                    }}
                    onClick={() => toggleStudentSort("carnet_number")}
                  >
                    Carnet{" "}
                    {studentSort.column === "carnet_number" &&
                      (studentSort.direction === "asc" ? "↑" : "↓")}
                  </th>
                  <th
                    style={{
                      padding: "12px 8px",
                      textAlign: "center",
                      cursor: "pointer",
                      fontSize: "12px",
                    }}
                    onClick={() => toggleStudentSort("gender")}
                  >
                    Género{" "}
                    {studentSort.column === "gender" &&
                      (studentSort.direction === "asc" ? "↑" : "↓")}
                  </th>
                  <th
                    style={{
                      padding: "12px 8px",
                      textAlign: "center",
                      fontSize: "12px",
                    }}
                  >
                    Edad
                  </th>
                  <th
                    style={{
                      padding: "12px 8px",
                      textAlign: "left",
                      fontSize: "12px",
                    }}
                  >
                    Carrera
                  </th>
                  <th
                    style={{
                      padding: "12px 8px",
                      textAlign: "center",
                      cursor: "pointer",
                      fontSize: "12px",
                    }}
                    onClick={() => toggleStudentSort("level_name")}
                  >
                    Nivel{" "}
                    {studentSort.column === "level_name" &&
                      (studentSort.direction === "asc" ? "↑" : "↓")}
                  </th>
                  <th
                    style={{
                      padding: "12px 8px",
                      textAlign: "center",
                      fontSize: "12px",
                    }}
                  >
                    Turno
                  </th>
                  <th
                    style={{
                      padding: "12px 8px",
                      textAlign: "left",
                      fontSize: "12px",
                    }}
                  >
                    Celular
                  </th>
                  <th
                    style={{
                      padding: "12px 8px",
                      textAlign: "center",
                      fontSize: "12px",
                    }}
                  >
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((s) => (
                  <tr key={s.id} style={darkStyles.tableRow}>
                    <td
                      style={{
                        padding: "10px 8px",
                        fontFamily: "monospace",
                        color: "#e4e4e7",
                        fontSize: "12px",
                      }}
                    >
                      {s.code ?? "-"}
                    </td>
                    <td
                      style={{
                        padding: "10px 8px",
                        color: "#e4e4e7",
                        fontSize: "12px",
                      }}
                    >
                      {s.rudeal_number ?? "-"}
                    </td>
                    <td
                      style={{
                        padding: "10px 8px",
                        color: "#e4e4e7",
                        fontSize: "12px",
                      }}
                    >
                      {s.last_name_pat ?? "-"}
                    </td>
                    <td
                      style={{
                        padding: "10px 8px",
                        color: "#e4e4e7",
                        fontSize: "12px",
                      }}
                    >
                      {s.last_name_mat ?? "-"}
                    </td>
                    <td
                      style={{
                        padding: "10px 8px",
                        color: "#e4e4e7",
                        fontSize: "12px",
                      }}
                    >
                      {s.first_names ?? "-"}
                    </td>
                    <td
                      style={{
                        padding: "10px 8px",
                        color: "#e4e4e7",
                        fontSize: "12px",
                      }}
                    >
                      {s.carnet_number ?? "-"}
                    </td>
                    <td
                      style={{
                        padding: "10px 8px",
                        textAlign: "center",
                        color: "#e4e4e7",
                        fontSize: "12px",
                      }}
                    >
                      {s.gender === "F" ? "F" : s.gender === "M" ? "M" : "-"}
                    </td>
                    <td
                      style={{
                        padding: "10px 8px",
                        textAlign: "center",
                        fontSize: "12px",
                        fontWeight: "bold",
                        color: s.birth_date
                          ? calculateAge(s.birth_date) >= 15
                            ? "#22c55e"
                            : "#ef4444"
                          : "#a1a1aa",
                      }}
                    >
                      {s.birth_date ? calculateAge(s.birth_date) : "-"}
                    </td>
                    <td
                      style={{
                        padding: "10px 8px",
                        color: "#a1a1aa",
                        fontSize: "11px",
                      }}
                    >
                      {careers.find((c) => c.id === s.career_id)?.name ?? "-"}
                    </td>
                    <td style={{ padding: "10px 8px", textAlign: "center" }}>
                      <span style={{ ...darkStyles.badge, fontSize: "11px" }}>
                        {s.current_level_name ?? "Sin nivel"}
                      </span>
                    </td>
                    <td style={{ padding: "10px 8px", textAlign: "center" }}>
                      <span
                        style={{
                          ...(s.shift === "tarde"
                            ? darkStyles.badgeTarde
                            : darkStyles.badgeNoche),
                          fontSize: "10px",
                          padding: "3px 6px",
                        }}
                      >
                        {s.shift === "tarde" ? "🌤️" : "🌙"}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: "10px 8px",
                        color: "#a1a1aa",
                        fontSize: "11px",
                      }}
                    >
                      {s.phone ?? "-"}
                    </td>
                    <td style={{ padding: "10px 8px" }}>
                      <div
                        style={{
                          display: "flex",
                          gap: "6px",
                          justifyContent: "center",
                          flexWrap: "wrap",
                        }}
                      >
                        <button
                          style={{
                            ...darkStyles.btnSuccess,
                            padding: "5px 10px",
                            fontSize: "11px",
                          }}
                          onClick={() => openGradesModal(s)}
                        >
                          Notas
                        </button>
                        <button
                          style={{
                            ...darkStyles.btnSecondary,
                            padding: "5px 10px",
                            fontSize: "11px",
                          }}
                          onClick={() => openEdit(s)}
                        >
                          Editar
                        </button>
                        <button
                          style={{
                            ...darkStyles.btnSecondary,
                            padding: "5px 10px",
                            fontSize: "11px",
                          }}
                          onClick={() =>
                            openResetPassword(s.id, s.code ?? s.id)
                          }
                        >
                          Contraseña
                        </button>
                        <button
                          style={{
                            ...darkStyles.btnDanger,
                            padding: "5px 10px",
                            fontSize: "11px",
                          }}
                          onClick={() => deleteUser(s.id, s.code ?? s.id)}
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredStudents.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      style={{
                        padding: "40px",
                        textAlign: "center",
                        color: "#71717a",
                      }}
                    >
                      {loadingStudents ? "Cargando..." : "Sin resultados"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>

      {/* ========== MODALES ========== */}

      {/* MODAL PDF ESTUDIANTES */}
      {showPdfModal && pdfCareer && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
          }}
          onClick={closePdfModal}
        >
          <div
            style={{
              ...darkStyles.modal,
              width: "100%",
              maxWidth: "500px",
              padding: "28px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              style={{
                fontSize: "20px",
                fontWeight: "700",
                color: "#fff",
                marginBottom: "8px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
              }}
            >
              📄 Generar Lista PDF
            </h3>
            <p style={{ color: "#a1a1aa", marginBottom: "24px" }}>
              Carrera:{" "}
              <strong style={{ color: "#fff" }}>{pdfCareer.name}</strong>
            </p>

            <div style={{ marginBottom: "24px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "14px",
                  color: "#a1a1aa",
                  marginBottom: "12px",
                  fontWeight: "500",
                }}
              >
                Seleccione turno:
              </label>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "12px",
                }}
              >
                <button
                  type="button"
                  onClick={() => setPdfShift("tarde")}
                  style={{
                    ...(pdfShift === "tarde"
                      ? darkStyles.shiftButtonSelected
                      : darkStyles.shiftButtonUnselected),
                    padding: "20px",
                    borderRadius: "12px",
                    cursor: "pointer",
                    transition: "all 0.3s ease",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <span style={{ fontSize: "32px" }}>🌤️</span>
                  <span style={{ fontWeight: "600", fontSize: "16px" }}>
                    Tarde
                  </span>
                  <span style={{ fontSize: "13px", opacity: 0.8 }}>
                    {getStudentCountByShift(pdfCareer.id, "tarde")} estudiantes
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setPdfShift("noche")}
                  style={{
                    ...(pdfShift === "noche"
                      ? darkStyles.shiftButtonSelected
                      : darkStyles.shiftButtonUnselected),
                    padding: "20px",
                    borderRadius: "12px",
                    cursor: "pointer",
                    transition: "all 0.3s ease",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <span style={{ fontSize: "32px" }}>🌙</span>
                  <span style={{ fontWeight: "600", fontSize: "16px" }}>
                    Noche
                  </span>
                  <span style={{ fontSize: "13px", opacity: 0.8 }}>
                    {getStudentCountByShift(pdfCareer.id, "noche")} estudiantes
                  </span>
                </button>
              </div>
            </div>

            <div
              style={{
                background: "rgba(60, 60, 60, 0.5)",
                borderRadius: "10px",
                padding: "14px",
                marginBottom: "24px",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <div style={{ fontSize: "13px", color: "#a1a1aa" }}>
                <strong style={{ color: "#d4d4d8" }}>
                  📋 El PDF incluirá:
                </strong>
                <ul
                  style={{
                    marginTop: "8px",
                    marginBottom: 0,
                    paddingLeft: "20px",
                    lineHeight: "1.8",
                  }}
                >
                  <li>Lista agrupada por nivel</li>
                  <li>Ordenada alfabéticamente</li>
                  <li>Columnas: N°, Código, Apellidos, Nombres, Nivel</li>
                </ul>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: "12px",
                justifyContent: "flex-end",
              }}
            >
              <button style={darkStyles.btnSecondary} onClick={closePdfModal}>
                Cancelar
              </button>
              <button
                style={darkStyles.btnPrimary}
                onClick={generatePdf}
                disabled={generatingPdf}
              >
                {generatingPdf ? "Generando..." : "Generar PDF"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PDF DOCENTES */}
      {showTeacherPdfModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
          }}
          onClick={closeTeacherPdfModal}
        >
          <div
            style={{
              ...darkStyles.modal,
              width: "100%",
              maxWidth: "450px",
              padding: "28px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              style={{
                fontSize: "20px",
                fontWeight: "700",
                color: "#fff",
                marginBottom: "20px",
              }}
            >
              📄 Lista de Docentes
            </h3>

            <div
              style={{
                background: "rgba(60, 60, 60, 0.5)",
                borderRadius: "10px",
                padding: "14px",
                marginBottom: "24px",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <p style={{ color: "#a1a1aa", margin: 0, fontSize: "14px" }}>
                Se generará un PDF con{" "}
                <strong style={{ color: "#fff" }}>{teachers.length}</strong>{" "}
                docente(s) registrados.
              </p>
              <ul
                style={{
                  marginTop: "12px",
                  marginBottom: 0,
                  paddingLeft: "20px",
                  color: "#a1a1aa",
                  fontSize: "13px",
                  lineHeight: "1.8",
                }}
              >
                <li>Ordenados alfabéticamente</li>
                <li>Columnas: N°, Apellidos, Nombres, Carrera, Turno</li>
              </ul>
            </div>

            <div
              style={{
                display: "flex",
                gap: "12px",
                justifyContent: "flex-end",
              }}
            >
              <button
                style={darkStyles.btnSecondary}
                onClick={closeTeacherPdfModal}
              >
                Cancelar
              </button>
              <button
                style={darkStyles.btnPrimary}
                onClick={generateTeacherPdf}
                disabled={generatingTeacherPdf}
              >
                {generatingTeacherPdf ? "Generando..." : "Generar PDF"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL NOTAS ESTUDIANTE */}
      {showGradesModal && gradesStudent && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
          }}
          onClick={closeGradesModal}
        >
          <div
            style={{
              ...darkStyles.modal,
              width: "100%",
              maxWidth: "800px",
              maxHeight: "90vh",
              overflow: "auto",
              padding: "28px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "start",
                marginBottom: "20px",
              }}
            >
              <div>
                <h3
                  style={{
                    fontSize: "20px",
                    fontWeight: "700",
                    color: "#fff",
                    marginBottom: "4px",
                  }}
                >
                  📊 Historial de Notas
                </h3>
                <p style={{ color: "#a1a1aa", margin: 0 }}>
                  {gradesStudent.full_name} ({gradesStudent.code})
                </p>
              </div>
              <button
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#71717a",
                  fontSize: "24px",
                  cursor: "pointer",
                }}
                onClick={closeGradesModal}
              >
                ×
              </button>
            </div>

            {loadingGrades ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "40px",
                  color: "#a1a1aa",
                }}
              >
                Cargando notas...
              </div>
            ) : studentGrades.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px" }}>
                <div style={{ fontSize: "48px", marginBottom: "16px" }}>📭</div>
                <p style={{ color: "#71717a", fontSize: "16px" }}>
                  Este estudiante no tiene notas registradas.
                </p>
              </div>
            ) : (
              <>
                <div style={{ overflowX: "auto", marginBottom: "20px" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={darkStyles.tableHeader}>
                        <th style={{ padding: "10px 12px", textAlign: "left" }}>
                          Módulo
                        </th>
                        <th
                          style={{ padding: "10px 12px", textAlign: "center" }}
                        >
                          SER
                        </th>
                        <th
                          style={{ padding: "10px 12px", textAlign: "center" }}
                        >
                          SABER
                        </th>
                        <th
                          style={{ padding: "10px 12px", textAlign: "center" }}
                        >
                          HAC.P
                        </th>
                        <th
                          style={{ padding: "10px 12px", textAlign: "center" }}
                        >
                          HAC.PR
                        </th>
                        <th
                          style={{ padding: "10px 12px", textAlign: "center" }}
                        >
                          DEC.
                        </th>
                        <th
                          style={{ padding: "10px 12px", textAlign: "center" }}
                        >
                          TOTAL
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const gradesByLevel = new Map<
                          string,
                          GradeHistoryRow[]
                        >();
                        for (const g of studentGrades) {
                          const key = g.level_name;
                          if (!gradesByLevel.has(key))
                            gradesByLevel.set(key, []);
                          gradesByLevel.get(key)!.push(g);
                        }

                        const rows: ReactElement[] = [];
                        gradesByLevel.forEach((grades, levelName) => {
                          rows.push(
                            <tr key={`level-${levelName}`}>
                              <td
                                colSpan={7}
                                style={{
                                  padding: "12px",
                                  background: "rgba(60, 60, 60, 0.8)",
                                  color: "#d4d4d8",
                                  fontWeight: "600",
                                }}
                              >
                                📚 {levelName}
                              </td>
                            </tr>,
                          );
                          for (const g of grades) {
                            rows.push(
                              <tr
                                key={`${g.level_id}-${g.module_id}`}
                                style={darkStyles.tableRow}
                              >
                                <td
                                  style={{
                                    padding: "10px 12px",
                                    color: "#e4e4e7",
                                  }}
                                >
                                  {g.module_name ?? "-"}
                                </td>
                                <td
                                  style={{
                                    padding: "10px 12px",
                                    textAlign: "center",
                                    color: "#a1a1aa",
                                  }}
                                >
                                  {g.ser ?? "-"}
                                </td>
                                <td
                                  style={{
                                    padding: "10px 12px",
                                    textAlign: "center",
                                    color: "#a1a1aa",
                                  }}
                                >
                                  {g.saber ?? "-"}
                                </td>
                                <td
                                  style={{
                                    padding: "10px 12px",
                                    textAlign: "center",
                                    color: "#a1a1aa",
                                  }}
                                >
                                  {g.hacer_proceso ?? "-"}
                                </td>
                                <td
                                  style={{
                                    padding: "10px 12px",
                                    textAlign: "center",
                                    color: "#a1a1aa",
                                  }}
                                >
                                  {g.hacer_producto ?? "-"}
                                </td>
                                <td
                                  style={{
                                    padding: "10px 12px",
                                    textAlign: "center",
                                    color: "#a1a1aa",
                                  }}
                                >
                                  {g.decidir ?? "-"}
                                </td>
                                <td
                                  style={{
                                    padding: "10px 12px",
                                    textAlign: "center",
                                    fontWeight: "600",
                                    color: "#fff",
                                  }}
                                >
                                  {g.total ?? "-"}
                                </td>
                              </tr>,
                            );
                          }
                        });
                        return rows;
                      })()}
                    </tbody>
                  </table>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: "12px",
                    justifyContent: "flex-end",
                  }}
                >
                  <button
                    style={darkStyles.btnSecondary}
                    onClick={closeGradesModal}
                  >
                    Cerrar
                  </button>
                  <button
                    style={darkStyles.btnPrimary}
                    onClick={generateGradesPdf}
                    disabled={generatingGradesPdf}
                  >
                    {generatingGradesPdf ? "Generando..." : "Descargar PDF"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* MODAL EDITAR USUARIO */}
      {showEditModal && editingUser && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
          }}
          onClick={resetForm}
        >
          <div
            style={{
              ...darkStyles.modal,
              width: "100%",
              maxWidth: "600px",
              maxHeight: "90vh",
              overflow: "auto",
              padding: "28px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "24px",
              }}
            >
              <h3
                style={{ fontSize: "20px", fontWeight: "700", color: "#fff" }}
              >
                ✏️ Editar {role === "teacher" ? "Docente" : "Estudiante"}
              </h3>
              <button
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#71717a",
                  fontSize: "24px",
                  cursor: "pointer",
                }}
                onClick={resetForm}
              >
                ×
              </button>
            </div>

            <form onSubmit={updateUser}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "16px",
                  marginBottom: "16px",
                }}
              >
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "13px",
                      color: "#a1a1aa",
                      marginBottom: "6px",
                    }}
                  >
                    Carrera *
                  </label>
                  <select
                    style={darkStyles.input}
                    value={careerId}
                    onChange={(e) =>
                      setCareerId(e.target.value ? Number(e.target.value) : "")
                    }
                  >
                    <option value="">Seleccione...</option>
                    {careers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "13px",
                      color: "#a1a1aa",
                      marginBottom: "6px",
                    }}
                  >
                    Turno *
                  </label>
                  <select
                    style={darkStyles.input}
                    value={shift}
                    onChange={(e) => setShift(e.target.value as Shift)}
                  >
                    <option value="tarde">Tarde</option>
                    <option value="noche">Noche</option>
                  </select>
                </div>
              </div>

              {role === "student" && (
                <>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "16px",
                      marginBottom: "16px",
                    }}
                  >
                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: "13px",
                          color: "#a1a1aa",
                          marginBottom: "6px",
                        }}
                      >
                        Nivel *
                      </label>
                      <select
                        style={darkStyles.input}
                        value={levelId}
                        onChange={(e) =>
                          setLevelId(
                            e.target.value ? Number(e.target.value) : "",
                          )
                        }
                      >
                        <option value="">Seleccione nivel...</option>
                        {availableLevels.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: "13px",
                          color: "#a1a1aa",
                          marginBottom: "6px",
                        }}
                      >
                        N° RUDEAL
                      </label>
                      <input
                        style={darkStyles.input}
                        value={rudealNumber}
                        onChange={(e) => setRudealNumber(e.target.value)}
                        placeholder="12345678"
                      />
                    </div>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(3, 1fr)",
                      gap: "16px",
                      marginBottom: "16px",
                    }}
                  >
                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: "13px",
                          color: "#a1a1aa",
                          marginBottom: "6px",
                        }}
                      >
                        N° Carnet *
                      </label>
                      <input
                        style={darkStyles.input}
                        value={carnetNumber}
                        onChange={(e) => setCarnetNumber(e.target.value)}
                        placeholder="87654321"
                      />
                    </div>
                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: "13px",
                          color: "#a1a1aa",
                          marginBottom: "6px",
                        }}
                      >
                        Género *
                      </label>
                      <select
                        style={darkStyles.input}
                        value={gender}
                        onChange={(e) => setGender(e.target.value as "F" | "M")}
                      >
                        <option value="">Seleccione...</option>
                        <option value="F">Femenino</option>
                        <option value="M">Masculino</option>
                      </select>
                    </div>
                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: "13px",
                          color: "#a1a1aa",
                          marginBottom: "6px",
                        }}
                      >
                        Fecha de Nac. *
                      </label>
                      <input
                        type="date"
                        style={darkStyles.input}
                        value={birthDate}
                        onChange={(e) => setBirthDate(e.target.value)}
                      />
                    </div>
                  </div>
                </>
              )}

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: "16px",
                  marginBottom: "16px",
                }}
              >
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "13px",
                      color: "#a1a1aa",
                      marginBottom: "6px",
                    }}
                  >
                    Nombres *
                  </label>
                  <input
                    style={darkStyles.input}
                    value={firstNames}
                    onChange={(e) => setFirstNames(e.target.value)}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "13px",
                      color: "#a1a1aa",
                      marginBottom: "6px",
                    }}
                  >
                    Ap. Paterno
                  </label>
                  <input
                    style={darkStyles.input}
                    value={lastPat}
                    onChange={(e) => setLastPat(e.target.value)}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "13px",
                      color: "#a1a1aa",
                      marginBottom: "6px",
                    }}
                  >
                    Ap. Materno
                  </label>
                  <input
                    style={darkStyles.input}
                    value={lastMat}
                    onChange={(e) => setLastMat(e.target.value)}
                  />
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "16px",
                  marginBottom: "24px",
                }}
              >
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "13px",
                      color: "#a1a1aa",
                      marginBottom: "6px",
                    }}
                  >
                    Celular *
                  </label>
                  <input
                    style={darkStyles.input}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "13px",
                      color: "#a1a1aa",
                      marginBottom: "6px",
                    }}
                  >
                    Correo
                  </label>
                  <input
                    style={darkStyles.input}
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                  />
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  type="button"
                  style={darkStyles.btnSecondary}
                  onClick={resetForm}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={darkStyles.btnPrimary}
                  disabled={creating}
                >
                  {creating ? "Guardando..." : "Guardar Cambios"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CREAR ESTUDIANTE/DOCENTE */}
      {showCreateModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
          }}
          onClick={resetForm}
        >
          <div
            style={{
              ...darkStyles.modal,
              width: "100%",
              maxWidth: "600px",
              maxHeight: "90vh",
              overflow: "auto",
              padding: "28px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "24px",
              }}
            >
              <h3
                style={{ fontSize: "20px", fontWeight: "700", color: "#fff" }}
              >
                ➕ Crear {role === "teacher" ? "Docente" : "Estudiante"}
              </h3>
              <button
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#71717a",
                  fontSize: "24px",
                  cursor: "pointer",
                }}
                onClick={resetForm}
              >
                ×
              </button>
            </div>

            <form onSubmit={createUser}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "16px",
                  marginBottom: "16px",
                }}
              >
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "13px",
                      color: "#a1a1aa",
                      marginBottom: "6px",
                    }}
                  >
                    Carrera *
                  </label>
                  <select
                    style={darkStyles.input}
                    value={careerId}
                    onChange={(e) =>
                      setCareerId(e.target.value ? Number(e.target.value) : "")
                    }
                  >
                    <option value="">Seleccione...</option>
                    {careers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "13px",
                      color: "#a1a1aa",
                      marginBottom: "6px",
                    }}
                  >
                    Turno *
                  </label>
                  <select
                    style={darkStyles.input}
                    value={shift}
                    onChange={(e) => setShift(e.target.value as Shift)}
                  >
                    <option value="tarde">Tarde</option>
                    <option value="noche">Noche</option>
                  </select>
                </div>
              </div>

              {role === "student" && (
                <>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      gap: "16px",
                      marginBottom: "16px",
                    }}
                  >
                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: "13px",
                          color: "#a1a1aa",
                          marginBottom: "6px",
                        }}
                      >
                        Nivel *
                      </label>
                      <select
                        style={darkStyles.input}
                        value={levelId}
                        onChange={(e) =>
                          setLevelId(
                            e.target.value ? Number(e.target.value) : "",
                          )
                        }
                      >
                        <option value="">Seleccione nivel...</option>
                        {availableLevels.map((l) => (
                          <option key={l.id} value={l.id}>
                            {l.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: "13px",
                          color: "#a1a1aa",
                          marginBottom: "6px",
                        }}
                      >
                        N° RUDEAL
                      </label>
                      <input
                        style={darkStyles.input}
                        value={rudealNumber}
                        onChange={(e) => setRudealNumber(e.target.value)}
                        placeholder="12345678"
                      />
                    </div>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(3, 1fr)",
                      gap: "16px",
                      marginBottom: "16px",
                    }}
                  >
                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: "13px",
                          color: "#a1a1aa",
                          marginBottom: "6px",
                        }}
                      >
                        N° Carnet *
                      </label>
                      <input
                        style={darkStyles.input}
                        value={carnetNumber}
                        onChange={(e) => setCarnetNumber(e.target.value)}
                        placeholder="87654321"
                      />
                    </div>
                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: "13px",
                          color: "#a1a1aa",
                          marginBottom: "6px",
                        }}
                      >
                        Género *
                      </label>
                      <select
                        style={darkStyles.input}
                        value={gender}
                        onChange={(e) => setGender(e.target.value as "F" | "M")}
                      >
                        <option value="">Seleccione...</option>
                        <option value="F">Femenino</option>
                        <option value="M">Masculino</option>
                      </select>
                    </div>
                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: "13px",
                          color: "#a1a1aa",
                          marginBottom: "6px",
                        }}
                      >
                        Fecha de Nac. *
                      </label>
                      <input
                        type="date"
                        style={darkStyles.input}
                        value={birthDate}
                        onChange={(e) => setBirthDate(e.target.value)}
                      />
                    </div>
                  </div>
                </>
              )}

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: "16px",
                  marginBottom: "16px",
                }}
              >
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "13px",
                      color: "#a1a1aa",
                      marginBottom: "6px",
                    }}
                  >
                    Nombres *
                  </label>
                  <input
                    style={darkStyles.input}
                    value={firstNames}
                    onChange={(e) => setFirstNames(e.target.value)}
                    placeholder="Juan Carlos"
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "13px",
                      color: "#a1a1aa",
                      marginBottom: "6px",
                    }}
                  >
                    Ap. Paterno
                  </label>
                  <input
                    style={darkStyles.input}
                    value={lastPat}
                    onChange={(e) => setLastPat(e.target.value)}
                    placeholder="Pérez"
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "13px",
                      color: "#a1a1aa",
                      marginBottom: "6px",
                    }}
                  >
                    Ap. Materno
                  </label>
                  <input
                    style={darkStyles.input}
                    value={lastMat}
                    onChange={(e) => setLastMat(e.target.value)}
                    placeholder="Gómez"
                  />
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "16px",
                  marginBottom: "16px",
                }}
              >
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "13px",
                      color: "#a1a1aa",
                      marginBottom: "6px",
                    }}
                  >
                    Celular *
                  </label>
                  <input
                    style={darkStyles.input}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="70707070"
                  />
                </div>
                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "13px",
                      color: "#a1a1aa",
                      marginBottom: "6px",
                    }}
                  >
                    Correo
                  </label>
                  <input
                    style={darkStyles.input}
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="correo@gmail.com"
                  />
                </div>
              </div>

              <div style={{ marginBottom: "16px" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "13px",
                    color: "#a1a1aa",
                    marginBottom: "6px",
                  }}
                >
                  Contraseña temporal
                </label>
                <div style={{ display: "flex", gap: "12px" }}>
                  <input
                    style={{ ...darkStyles.input, flex: 1 }}
                    value={tempPassword}
                    onChange={(e) => setTempPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    style={darkStyles.btnSecondary}
                    onClick={() => setTempPassword(randomPass())}
                  >
                    Generar
                  </button>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: "12px",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  type="button"
                  style={darkStyles.btnSecondary}
                  onClick={resetForm}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  style={darkStyles.btnPrimary}
                  disabled={creating}
                >
                  {creating ? "Creando..." : "Crear Usuario"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL RESET PASSWORD */}
      {showResetModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
            padding: "20px",
          }}
          onClick={() => setShowResetModal(false)}
        >
          <div
            style={{
              ...darkStyles.modal,
              width: "100%",
              maxWidth: "400px",
              padding: "28px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              style={{
                fontSize: "18px",
                fontWeight: "700",
                color: "#fff",
                marginBottom: "8px",
              }}
            >
              🔑 Restablecer Contraseña
            </h3>
            <p style={{ color: "#a1a1aa", marginBottom: "20px" }}>
              Usuario:{" "}
              <strong style={{ color: "#fff" }}>{resetUserCode}</strong>
            </p>

            <div style={{ marginBottom: "20px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  color: "#a1a1aa",
                  marginBottom: "6px",
                }}
              >
                Nueva contraseña
              </label>
              <div style={{ display: "flex", gap: "10px" }}>
                <input
                  style={{ ...darkStyles.input, flex: 1 }}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <button
                  type="button"
                  style={darkStyles.btnSecondary}
                  onClick={() => setNewPassword(randomPass())}
                >
                  Generar
                </button>
              </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: "12px",
                justifyContent: "flex-end",
              }}
            >
              <button
                style={darkStyles.btnSecondary}
                onClick={() => setShowResetModal(false)}
              >
                Cancelar
              </button>
              <button
                style={darkStyles.btnPrimary}
                onClick={resetPassword}
                disabled={resetting}
              >
                {resetting ? "Guardando..." : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE MENSAJES */}
      {showMessageModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1001,
            padding: "20px",
          }}
          onClick={closeMessageModal}
        >
          <div
            style={{
              ...darkStyles.modal,
              width: "100%",
              maxWidth: "500px",
              padding: "28px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: "20px",
              }}
            >
              <h3
                style={{
                  fontSize: "18px",
                  fontWeight: "700",
                  color:
                    messageType === "success"
                      ? "#10b981"
                      : messageType === "warning"
                        ? "#f59e0b"
                        : "#ef4444",
                  margin: 0,
                }}
              >
                {messageTitle}
              </h3>
              <button
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#71717a",
                  fontSize: "24px",
                  cursor: "pointer",
                  padding: 0,
                  lineHeight: 1,
                }}
                onClick={closeMessageModal}
              >
                ×
              </button>
            </div>

            <p
              style={{
                color: "#e4e4e7",
                fontSize: "14px",
                lineHeight: "1.6",
                whiteSpace: "pre-line",
                marginBottom: "24px",
              }}
            >
              {messageContent}
            </p>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                style={{
                  ...darkStyles.btnPrimary,
                  background:
                    messageType === "success"
                      ? "#10b981"
                      : messageType === "warning"
                        ? "#f59e0b"
                        : "#ef4444",
                }}
                onClick={closeMessageModal}
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// cea-plataforma/web/src/pages/AdminDashboard.tsx
// VERSIÓN MODO OSCURO (NEGRO/GRIS) + GESTIÓN COMPLETA + PDFs

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactElement } from "react";
import { supabase } from "../lib/supabase";
import { useRole } from "../lib/useRole";
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
  academic_degree?: string | null;
};

const TW_ADM = "https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/svg";
const ADMIN_AVATARS = [
  { key: "adm1",  label: "Ejecutivo",    url: `${TW_ADM}/1f4bc.svg` },
  { key: "adm2",  label: "Institución",  url: `${TW_ADM}/1f3eb.svg` },
  { key: "adm3",  label: "Graduación",   url: `${TW_ADM}/1f393.svg` },
  { key: "adm4",  label: "Trofeo",       url: `${TW_ADM}/1f3c6.svg` },
  { key: "adm5",  label: "Medalla",      url: `${TW_ADM}/1f3c5.svg` },
  { key: "adm6",  label: "Documento",    url: `${TW_ADM}/1f4cb.svg` },
  { key: "adm7",  label: "Libro",        url: `${TW_ADM}/1f4da.svg` },
  { key: "adm8",  label: "Estrella",     url: `${TW_ADM}/2b50.svg`  },
  { key: "adm9",  label: "Globo",        url: `${TW_ADM}/1f310.svg` },
  { key: "adm10", label: "Oficina",      url: `${TW_ADM}/1f3e2.svg` },
  { key: "adm11", label: "Paloma",       url: `${TW_ADM}/1fabb.svg` },
  { key: "adm12", label: "Corona",       url: `${TW_ADM}/1f451.svg` },
] as const;

const DEGREE_OPTIONS = [
  { value: "",    label: "Sin grado especificado" },
  { value: "ts",  label: "Técnico Superior (T.S.)" },
  { value: "lic", label: "Licenciatura (Lic.)" },
  { value: "ing", label: "Ingeniería (Ing.)" },
  { value: "msc", label: "Maestría (M.Sc.)" },
  { value: "dr",  label: "Doctorado (Dr.)" },
] as const;

function degreePrefix(degree: string | null | undefined): string {
  switch (degree) {
    case "ts":  return "T.S.";
    case "lic": return "Lic.";
    case "ing": return "Ing.";
    case "msc": return "M.Sc.";
    case "dr":  return "Dr.";
    default:    return "";
  }
}
function withDegree(name: string | null | undefined, degree: string | null | undefined): string {
  const p = degreePrefix(degree);
  if (!p || !name) return name ?? "";
  return `${p} ${name}`;
}

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

type AdminStaffRow = {
  id: string;
  code: string | null;
  full_name: string | null;
  first_names: string | null;
  last_name_pat: string | null;
  last_name_mat: string | null;
  admin_type: string | null;
  phone: string | null;
  contact_email: string | null;
  avatar_key: string | null;
  academic_degree: string | null;
};

// Función para cargar logo como Base64 para PDFs
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
  const { role: authRole, profile: adminProfile } = useRole();
  const isReadOnly = authRole === "administrativo" && adminProfile?.admin_type === "secretaria";
  // Director y secretaria pueden gestionar estudiantes
  const canManageStudents = authRole === "admin" || authRole === "administrativo";

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

  // Modal de confirmación de eliminación
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [pendingDeleteCode, setPendingDeleteCode] = useState<string>("");
  const [deleting, setDeleting] = useState(false);

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

  const [adminSection, setAdminSection] = useState<"home" | "carreras" | "docentes" | "estudiantes" | "config" | "administrativos" | "academico">("home");

  // ── Config section state ──────────────────────────────────
  const [configTab, setConfigTab] = useState<"institucion" | "anuncio" | "semestre" | "exportar">("institucion");
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [cfgName, setCfgName] = useState("");
  // ========== PERFIL PROPIO (administrativo) ==========
  const [adminEditMode, setAdminEditMode] = useState(false);
  const [adminEditPhone, setAdminEditPhone] = useState("");
  const [adminEditEmail, setAdminEditEmail] = useState("");
  const [adminEditDegree, setAdminEditDegree] = useState("");
  const [adminProfileSaving, setAdminProfileSaving] = useState(false);
  const [adminProfileMsg, setAdminProfileMsg] = useState<string | null>(null);
  // Avatar propio (administrativo)
  const [showAdminAvatarModal, setShowAdminAvatarModal] = useState(false);
  const [adminSelectedAvatar, setAdminSelectedAvatar] = useState("adm1");
  const [savingAdminAvatar, setSavingAdminAvatar] = useState(false);
  const [localAdminAvatarKey, setLocalAdminAvatarKey] = useState<string | null>(null);
  // Cambiar contraseña propia
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [cpCurrentPass, setCpCurrentPass] = useState("");
  const [cpNewPass, setCpNewPass] = useState("");
  const [cpConfirmPass, setCpConfirmPass] = useState("");
  const [cpMsg, setCpMsg] = useState<string | null>(null);
  const [cpSaving, setCpSaving] = useState(false);

  // ========== ACADÉMICO ==========
  const [acadTab, setAcadTab] = useState<"centralizador" | "modulo">("centralizador");
  const [acadCareer, setAcadCareer] = useState<number | "">("");
  const [acadLevel, setAcadLevel] = useState<number | "">("");
  const [acadModule, setAcadModule] = useState<number | "">("");
  const [acadModulesList, setAcadModulesList] = useState<{ id: number; title: string; sort_order: number }[]>([]);
  const [acadGrades, setAcadGrades] = useState<(GradeHistoryRow & { student_id: string })[]>([]);
  const [loadingAcad, setLoadingAcad] = useState(false);
  const [generatingAcadPdf, setGeneratingAcadPdf] = useState(false);

  // ========== ADMINISTRATIVOS (director / secretaria) ==========
  const [adminStaff, setAdminStaff] = useState<AdminStaffRow[]>([]);
  const [loadingAdminStaff, setLoadingAdminStaff] = useState(false);
  const [showAdminStaffModal, setShowAdminStaffModal] = useState(false);
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [staffAdminType, setStaffAdminType] = useState<"director" | "secretaria">("secretaria");
  const [staffFirstNames, setStaffFirstNames] = useState("");
  const [staffLastPat, setStaffLastPat] = useState("");
  const [staffLastMat, setStaffLastMat] = useState("");
  const [staffPhone, setStaffPhone] = useState("");
  const [staffEmail, setStaffEmail] = useState("");
  const [staffDegree, setStaffDegree] = useState("");
  const [staffTempPassword, setStaffTempPassword] = useState(randomPass());
  const [creatingStaff, setCreatingStaff] = useState(false);
  const [cfgMission, setCfgMission] = useState("");
  const [cfgVision, setCfgVision] = useState("");
  const [cfgPhone, setCfgPhone] = useState("");
  const [cfgMobile, setCfgMobile] = useState("");
  const [cfgEmail, setCfgEmail] = useState("");
  const [cfgAddress, setCfgAddress] = useState("");
  const [cfgAnnouncement, setCfgAnnouncement] = useState("");
  const [cfgAnnouncementActive, setCfgAnnouncementActive] = useState(false);
  const [cfgSemester, setCfgSemester] = useState("1/2026");
  const [cfgBulkSemester, setCfgBulkSemester] = useState(false);
  const [configSaved, setConfigSaved] = useState<string | null>(null);
  const [cfgGallery, setCfgGallery] = useState<{src:string;alt:string}[]>([
    { src: "/images/CEA.jpeg",  alt: "Fachada del CEA Madre María Oliva" },
    { src: "/images/CEA1.jpeg", alt: "Estudiantes en formación técnica" },
    { src: "/images/CEA2.jpeg", alt: "Instalaciones y talleres" },
  ]);
  const [cfgRequirements, setCfgRequirements] = useState<string[]>([
    "3 Fotocopias de Cédula de Identidad",
    "3 Fotocopias de Certificado de Nacimiento",
    "100 Bs. de aporte estudiantil semestral",
  ]);
  const [newGalleryUrl, setNewGalleryUrl] = useState("");
  const [newGalleryAlt, setNewGalleryAlt] = useState("");
  const [newRequirement, setNewRequirement] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const [galleryDragIdx, setGalleryDragIdx] = useState<number | null>(null);
  const [galleryDragOverIdx, setGalleryDragOverIdx] = useState<number | null>(null);

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
        "id,code,full_name,first_names,last_name_pat,last_name_mat,role,phone,shift,career_id,contact_email,likes,avatar_key,created_at,academic_degree",
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

  const loadAdminStaff = useCallback(async () => {
    setLoadingAdminStaff(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("id,code,full_name,first_names,last_name_pat,last_name_mat,admin_type,phone,contact_email,avatar_key,academic_degree")
      .eq("role", "administrativo")
      .order("admin_type");
    setLoadingAdminStaff(false);
    if (!error) setAdminStaff((data as AdminStaffRow[]) ?? []);
  }, []);

  async function saveAdminAvatar() {
    if (!adminProfile) return;
    setSavingAdminAvatar(true);
    await supabase.from("profiles").update({ avatar_key: adminSelectedAvatar }).eq("id", adminProfile.id);
    setSavingAdminAvatar(false);
    setLocalAdminAvatarKey(adminSelectedAvatar);
    setShowAdminAvatarModal(false);
  }

  async function saveAdminProfile() {
    if (!adminProfile) return;
    setAdminProfileSaving(true);
    setAdminProfileMsg(null);
    const { error } = await supabase
      .from("profiles")
      .update({
        phone: adminEditPhone.trim() || null,
        contact_email: adminEditEmail.trim() || null,
        academic_degree: adminEditDegree || null,
      })
      .eq("id", adminProfile.id);
    setAdminProfileSaving(false);
    if (error) {
      setAdminProfileMsg("Error: " + error.message);
    } else {
      setAdminProfileMsg("✅ Perfil actualizado.");
      setAdminEditMode(false);
    }
  }

  async function changeOwnPassword() {
    if (!cpCurrentPass.trim() || !cpNewPass.trim() || !cpConfirmPass.trim()) {
      setCpMsg("Completa todos los campos.");
      return;
    }
    if (cpNewPass !== cpConfirmPass) {
      setCpMsg("Las contraseñas nuevas no coinciden.");
      return;
    }
    if (cpNewPass.length < 6) {
      setCpMsg("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    setCpSaving(true);
    setCpMsg(null);
    // Verificar contraseña actual
    const { data: sess } = await supabase.auth.getSession();
    const email = sess?.session?.user?.email;
    if (!email) { setCpMsg("No se pudo verificar la sesión."); setCpSaving(false); return; }
    const { error: verifyErr } = await supabase.auth.signInWithPassword({ email, password: cpCurrentPass });
    if (verifyErr) { setCpMsg("Contraseña actual incorrecta."); setCpSaving(false); return; }
    const { error } = await supabase.auth.updateUser({ password: cpNewPass });
    setCpSaving(false);
    if (error) {
      setCpMsg("Error: " + error.message);
    } else {
      setCpMsg("✅ Contraseña actualizada correctamente.");
      setCpCurrentPass("");
      setCpNewPass("");
      setCpConfirmPass("");
    }
  }

  async function saveAdminStaff(e: FormEvent) {
    e.preventDefault();
    const fn = staffFirstNames.trim();
    const lp = staffLastPat.trim();
    const lm = staffLastMat.trim();
    const ph = staffPhone.trim();
    if (!fn || (!lp && !lm) || !ph || !staffAdminType) {
      await showMessage("Campos incompletos", "Completa nombre, apellido y teléfono.", "error");
      return;
    }

    setCreatingStaff(true);

    if (editingStaffId) {
      // Editar perfil existente
      const full_name = [fn, lp, lm].filter(Boolean).join(" ");
      const { error } = await supabase
        .from("profiles")
        .update({ first_names: fn, last_name_pat: lp || null, last_name_mat: lm || null, full_name, phone: ph, contact_email: staffEmail.trim() || null, admin_type: staffAdminType, academic_degree: staffDegree || null })
        .eq("id", editingStaffId);
      setCreatingStaff(false);
      if (error) {
        if (error.code === "23505") {
          await showMessage("Conflicto", `Ya existe un usuario con el tipo "${staffAdminType}". Solo puede haber uno de cada tipo.`, "error");
        } else {
          await showMessage("Error", error.message, "error");
        }
        return;
      }
      await showMessage("Actualizado", "Administrativo actualizado correctamente.", "success");
    } else {
      // Crear nuevo
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session) { setCreatingStaff(false); return; }

      const payload = {
        role: "administrativo",
        temp_password: staffTempPassword,
        first_names: fn,
        last_name_pat: lp || undefined,
        last_name_mat: lm || undefined,
        phone: ph,
        contact_email: staffEmail.trim() || undefined,
      };

      const res = await fetch(`${supabaseUrl}/functions/v1/create-user`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: anonKey, Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify(payload),
      });

      const raw = await res.text();
      let out: ApiResponse = {};
      try { out = raw ? JSON.parse(raw) : { error: "Respuesta vacía" }; } catch { out = { error: raw }; }

      if (!res.ok) {
        setCreatingStaff(false);
        await showMessage("Error al crear", out.error ?? out.message ?? "Error desconocido", "error");
        return;
      }

      // Set admin_type on the new profile
      if (out.code) {
        await supabase.from("profiles").update({ admin_type: staffAdminType }).eq("code", out.code);
      }

      setCreatingStaff(false);
      await showMessage("Administrativo creado", `Código: ${out.code ?? "—"}\nContraseña temporal: ${out.temp_password ?? staffTempPassword}\n\nGuarda estos datos.`, "success");
    }

    setShowAdminStaffModal(false);
    void loadAdminStaff();
  }

  function openCreateStaff(type: "director" | "secretaria") {
    setEditingStaffId(null);
    setStaffAdminType(type);
    setStaffFirstNames("");
    setStaffLastPat("");
    setStaffLastMat("");
    setStaffPhone("");
    setStaffEmail("");
    setStaffDegree("");
    setStaffTempPassword(randomPass());
    setShowAdminStaffModal(true);
  }

  function openEditStaff(staff: AdminStaffRow) {
    setEditingStaffId(staff.id);
    setStaffAdminType((staff.admin_type as "director" | "secretaria") ?? "secretaria");
    setStaffFirstNames(staff.first_names ?? "");
    setStaffLastPat(staff.last_name_pat ?? "");
    setStaffLastMat(staff.last_name_mat ?? "");
    setStaffPhone(staff.phone ?? "");
    setStaffEmail(staff.contact_email ?? "");
    setStaffDegree(staff.academic_degree ?? "");
    setShowAdminStaffModal(true);
  }

  async function deleteStaff(staff: AdminStaffRow) {
    if (!confirm(`¿Eliminar al administrativo "${staff.full_name ?? staff.code}"?`)) return;
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    if (!session) return;

    const res = await fetch(`${supabaseUrl}/functions/v1/delete-user`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: anonKey, Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ user_id: staff.id }),
    });
    if (!res.ok) {
      const raw = await res.text();
      let out: ApiResponse = {};
      try { out = JSON.parse(raw); } catch { out = { error: raw }; }
      await showMessage("Error", out.error ?? "No se pudo eliminar", "error");
      return;
    }
    await showMessage("Eliminado", "Administrativo eliminado correctamente.", "success");
    void loadAdminStaff();
  }

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
    if (adminSection === "home") return;
    if (adminSection === "administrativos") { void loadAdminStaff(); return; }
    void loadCatalogs();
  }, [adminSection, loadAdminStaff]);

  // Load site settings when entering config section
  useEffect(() => {
    if (adminSection !== "config") return;
    setLoadingConfig(true);
    (async () => {
      try {
        const { data, error } = await supabase.from("site_settings").select("key,value");
        if (!error && data && data.length > 0) {
          const map = Object.fromEntries(data.map((r) => [r.key, r.value ?? ""]));
          if (map["institution_name"]) setCfgName(map["institution_name"]);
          if (map["institution_mission"]) setCfgMission(map["institution_mission"]);
          if (map["institution_vision"]) setCfgVision(map["institution_vision"]);
          if (map["contact_phone"]) setCfgPhone(map["contact_phone"]);
          if (map["contact_mobile"]) setCfgMobile(map["contact_mobile"]);
          if (map["contact_email"]) setCfgEmail(map["contact_email"]);
          if (map["contact_address"]) setCfgAddress(map["contact_address"]);
          setCfgAnnouncement(map["announcement_text"] ?? "");
          setCfgAnnouncementActive(map["announcement_active"] === "true");
          if (map["active_semester"]) setCfgSemester(map["active_semester"]);
          if (map["gallery_images"]) { try { const g = JSON.parse(map["gallery_images"]); if (Array.isArray(g) && g.length > 0) setCfgGallery(g); } catch { /* keep default */ } }
          if (map["requirements"]) { try { const r = JSON.parse(map["requirements"]); if (Array.isArray(r) && r.length > 0) setCfgRequirements(r); } catch { /* keep default */ } }
        }
      } catch { /* tabla no existe, conservar defaults */ }
      setLoadingConfig(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adminSection]);

  useEffect(() => {
    if (adminSection === "home") return;
    if (careers.length > 0 && levels.length > 0) {
      void loadTeachers();
      void loadStudents();
      void loadLockedAccounts();
    }
  }, [careers.length, levels.length, loadTeachers, loadStudents, loadLockedAccounts, adminSection]);

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

  async function addPdfHeader(doc: jsPDF, pageWidth: number) {
    // Logo
    try {
      const logoData = await loadLogoBase64();
      doc.addImage(logoData, "PNG", 15, 8, 28, 28);
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

      await addPdfHeader(doc, pageWidth);

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

      await addPdfHeader(doc, pageWidth);

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
        degreePrefix(t.academic_degree) || "-",
        careers.find((c) => c.id === t.career_id)?.name ?? "-",
        t.shift === "tarde" ? "Tarde" : t.shift === "noche" ? "Noche" : "-",
      ]);

      autoTable(doc, {
        startY: 65,
        head: [["N°", "Apellidos", "Nombres", "Grado", "Carrera", "Turno"]],
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
          1: { cellWidth: 42 },
          2: { cellWidth: 42 },
          3: { halign: "center", cellWidth: 16 },
          4: { cellWidth: 45 },
          5: { halign: "center", cellWidth: 22 },
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

      await addPdfHeader(doc, pageWidth);

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

  function deleteUser(userId: string, code: string) {
    setPendingDeleteId(userId);
    setPendingDeleteCode(code);
    setShowConfirmDelete(true);
  }

  async function confirmDeleteUser() {
    if (!pendingDeleteId) return;
    setDeleting(true);

    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    if (!session) {
      setDeleting(false);
      setShowConfirmDelete(false);
      void showMessage("Error", "No hay sesión activa.", "error");
      return;
    }

    const res = await fetch(`${supabaseUrl}/functions/v1/delete-user`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ user_id: pendingDeleteId }),
    });

    const raw = await res.text();
    let out: ApiResponse = {};
    try {
      out = raw ? JSON.parse(raw) : { error: "Respuesta vacía" };
    } catch {
      out = { error: raw };
    }

    const deletedCode = pendingDeleteCode;
    setDeleting(false);
    setShowConfirmDelete(false);
    setPendingDeleteId(null);
    setPendingDeleteCode("");

    if (!res.ok) {
      void showMessage("Error al eliminar", out.error ?? `Error ${res.status}`, "error");
      return;
    }

    void showMessage("Usuario eliminado", `El participante ${deletedCode || ""} ha sido eliminado correctamente.`, "success");
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

  // ========== FUNCIONES ACADÉMICO ==========
  async function loadAcadModules(levelId: number) {
    const { data } = await supabase
      .from("modules")
      .select("id, title, sort_order")
      .eq("level_id", levelId)
      .order("sort_order");
    setAcadModulesList((data as { id: number; title: string; sort_order: number }[]) ?? []);
    setAcadModule("");
  }

  async function loadAcadGrades(levelId: number) {
    setLoadingAcad(true);
    const { data, error } = await supabase
      .from("v_student_grade_history")
      .select("student_id, module_id, module_name, module_order, level_id, level_name, ser, saber, hacer_proceso, hacer_producto, decidir, auto_ser, auto_decidir, total, observation")
      .eq("level_id", levelId)
      .order("module_order");
    setLoadingAcad(false);
    if (!error) setAcadGrades((data as (GradeHistoryRow & { student_id: string })[]) ?? []);
  }

  function getAcadStudents() {
    return students.filter(s =>
      (!acadCareer || s.career_id === acadCareer) &&
      (!acadLevel || s.current_level_id === acadLevel)
    ).sort((a, b) => {
      const ap = (a.last_name_pat ?? "").toLowerCase();
      const bp = (b.last_name_pat ?? "").toLowerCase();
      if (ap !== bp) return ap.localeCompare(bp);
      return ((a.first_names ?? "").toLowerCase()).localeCompare((b.first_names ?? "").toLowerCase());
    });
  }

  async function generateCentralizadorPdf() {
    if (!acadCareer || !acadLevel) return;
    setGeneratingAcadPdf(true);
    try {
      const careerObj = careers.find(c => c.id === acadCareer);
      const levelObj = levels.find(l => l.id === acadLevel);
      const acadStudents = getAcadStudents();

      // Cargar módulos directamente si el estado aún no los tiene
      let modules = [...acadModulesList].sort((a, b) => a.sort_order - b.sort_order);
      if (modules.length === 0 && acadLevel) {
        const { data: modData } = await supabase
          .from("modules")
          .select("id, title, sort_order")
          .eq("level_id", acadLevel)
          .order("sort_order");
        modules = (modData as { id: number; title: string; sort_order: number }[]) ?? [];
        setAcadModulesList(modules);
      }
      // Fallback: derivar módulos de los datos de notas ya cargados
      if (modules.length === 0 && acadGrades.length > 0) {
        const modMap = new Map<number, { id: number; title: string; sort_order: number }>();
        for (const g of acadGrades) {
          if (!modMap.has(g.module_id)) {
            modMap.set(g.module_id, { id: g.module_id, title: g.module_name, sort_order: g.module_order });
          }
        }
        modules = [...modMap.values()].sort((a, b) => a.sort_order - b.sort_order);
      }

      // Cargar notas si el estado no las tiene
      let grades = acadGrades;
      if (grades.length === 0 && acadLevel) {
        const { data: gradeData } = await supabase
          .from("v_student_grade_history")
          .select("student_id, module_id, module_name, module_order, level_id, level_name, ser, saber, hacer_proceso, hacer_producto, decidir, auto_ser, auto_decidir, total, observation")
          .eq("level_id", acadLevel)
          .order("module_order");
        grades = (gradeData as (GradeHistoryRow & { student_id: string })[]) ?? [];
        setAcadGrades(grades);
      }

      const doc = new jsPDF({ orientation: "landscape" });
      const pageWidth = doc.internal.pageSize.getWidth();
      await addPdfHeader(doc, pageWidth);

      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text("CENTRALIZADOR DE NOTAS SEMESTRAL", pageWidth / 2, 48, { align: "center" });

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text(`Carrera: ${careerObj?.name ?? "-"}   |   Nivel: ${levelObj?.name ?? "-"}   |   Fecha: ${new Date().toLocaleDateString("es-BO")}`, pageWidth / 2, 56, { align: "center" });

      // Cabeceras con nombres reales de módulo
      const modHeaders = modules.map(m => `Módulo ${m.sort_order}\n${m.title.length > 28 ? m.title.substring(0, 26) + ".." : m.title}`);
      const head = [["N°", "Código", "Ap. Paterno", "Ap. Materno", "Nombres", ...modHeaders, "Promedio\nSemestral"]];

      const body = acadStudents.map((s, idx) => {
        const studentGrades = grades.filter(g => g.student_id === s.id);
        const modTotals = modules.map(m => {
          const g = studentGrades.find(g => g.module_id === m.id);
          return g?.total != null ? String(Math.round(g.total)) : "-";
        });
        const nums = modTotals.filter(t => t !== "-").map(Number);
        const prom = nums.length > 0 ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1) : "-";
        return [String(idx + 1), s.code ?? "-", s.last_name_pat ?? "-", s.last_name_mat ?? "-", s.first_names ?? "-", ...modTotals, prom];
      });

      autoTable(doc, {
        head, body,
        startY: 62,
        styles: { fontSize: 7, cellPadding: 2, valign: "middle" },
        headStyles: { fillColor: [30, 58, 95], fontSize: 6.5, halign: "center", valign: "middle" },
        columnStyles: {
          0: { cellWidth: 8, halign: "center" },
          1: { cellWidth: 18 },
          2: { cellWidth: 28 },
          3: { cellWidth: 28 },
          4: { cellWidth: 28 },
          [5 + modules.length]: { halign: "center", fontStyle: "bold" },
        },
        didParseCell: (data) => {
          // Centrar columnas de notas (módulos y promedio)
          if (data.column.index >= 5) {
            data.cell.styles.halign = "center";
          }
        },
      });

      doc.save(`centralizador_${careerObj?.name ?? "carrera"}_${levelObj?.name ?? "nivel"}.pdf`);
    } finally {
      setGeneratingAcadPdf(false);
    }
  }

  async function generateModuloPdf() {
    if (!acadCareer || !acadLevel || !acadModule) return;
    setGeneratingAcadPdf(true);
    try {
      const careerObj = careers.find(c => c.id === acadCareer);
      const levelObj = levels.find(l => l.id === acadLevel);
      const acadStudents = getAcadStudents();

      // Cargar módulos si aún no están en estado
      let modList = [...acadModulesList];
      if (modList.length === 0 && acadLevel) {
        const { data: modData } = await supabase
          .from("modules")
          .select("id, title, sort_order")
          .eq("level_id", acadLevel)
          .order("sort_order");
        modList = (modData as { id: number; title: string; sort_order: number }[]) ?? [];
        setAcadModulesList(modList);
      }
      const moduleObj = modList.find(m => m.id === acadModule);

      // Cargar notas si aún no están en estado
      let grades = acadGrades;
      if (grades.length === 0 && acadLevel) {
        const { data: gradeData } = await supabase
          .from("v_student_grade_history")
          .select("student_id, module_id, module_name, module_order, level_id, level_name, ser, saber, hacer_proceso, hacer_producto, decidir, auto_ser, auto_decidir, total, observation")
          .eq("level_id", acadLevel)
          .order("module_order");
        grades = (gradeData as (GradeHistoryRow & { student_id: string })[]) ?? [];
        setAcadGrades(grades);
      }
      const moduleGrades = grades.filter(g => g.module_id === acadModule);

      const doc = new jsPDF({ orientation: "landscape" });
      const pageWidth = doc.internal.pageSize.getWidth();
      await addPdfHeader(doc, pageWidth);

      doc.setFontSize(13);
      doc.setFont("helvetica", "bold");
      doc.text("REGISTRO DE NOTAS — MÓDULO", pageWidth / 2, 44, { align: "center" });

      doc.setFontSize(10);
      doc.text(moduleObj?.title ?? grades.find(g => g.module_id === acadModule)?.module_name ?? "-", pageWidth / 2, 52, { align: "center" });

      doc.setFontSize(8.5);
      doc.setFont("helvetica", "normal");
      doc.text(
        `Carrera: ${careerObj?.name ?? "-"}   |   Nivel: ${levelObj?.name ?? "-"}   |   Fecha: ${new Date().toLocaleDateString("es-BO")}`,
        pageWidth / 2, 59, { align: "center" }
      );

      // Hacer = proceso + producto (40 pts), Autoeva = auto_ser + auto_decidir (10 pts)
      const head = [[
        "N°", "Código", "Ap. Paterno", "Ap. Materno", "Nombres",
        "Ser\n(10)", "Saber\n(30)", "Hacer\n(40)", "Decidir\n(10)", "Autoeva.\n(10)", "Total\n(100)", "Resultado"
      ]];
      const body = acadStudents.map((s, idx) => {
        const g = moduleGrades.find(g => g.student_id === s.id);
        const tieneHacer = g?.hacer_proceso != null || g?.hacer_producto != null;
        const tieneAutoeva = g?.auto_ser != null || g?.auto_decidir != null;
        const hacer = tieneHacer ? String(Math.round((g?.hacer_proceso ?? 0) + (g?.hacer_producto ?? 0))) : "-";
        const autoeva = tieneAutoeva ? String(Math.round((g?.auto_ser ?? 0) + (g?.auto_decidir ?? 0))) : "-";
        return [
          String(idx + 1), s.code ?? "-", s.last_name_pat ?? "-", s.last_name_mat ?? "-", s.first_names ?? "-",
          g?.ser != null ? String(Math.round(g.ser)) : "-",
          g?.saber != null ? String(Math.round(g.saber)) : "-",
          hacer,
          g?.decidir != null ? String(Math.round(g.decidir)) : "-",
          autoeva,
          g?.total != null ? String(Math.round(g.total)) : "-",
          g?.observation ?? "-",
        ];
      });

      autoTable(doc, {
        head, body,
        startY: 64,
        styles: { fontSize: 7, cellPadding: 2, valign: "middle" },
        headStyles: { fillColor: [30, 58, 95], fontSize: 7, halign: "center", valign: "middle" },
        columnStyles: {
          0: { cellWidth: 8, halign: "center" },
          1: { cellWidth: 18 },
          2: { cellWidth: 30 },
          3: { cellWidth: 30 },
          4: { cellWidth: 32 },
          5: { halign: "center", cellWidth: 14 },
          6: { halign: "center", cellWidth: 14 },
          7: { halign: "center", cellWidth: 14 },
          8: { halign: "center", cellWidth: 14 },
          9: { halign: "center", cellWidth: 14 },
          10: { halign: "center", cellWidth: 14, fontStyle: "bold" },
        },
      });

      doc.save(`notas_modulo${moduleObj?.sort_order ?? ""}_${levelObj?.name ?? "nivel"}_${careerObj?.name ?? "carrera"}.pdf`);
    } finally {
      setGeneratingAcadPdf(false);
    }
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

  // ─── Config save helpers ──────────────────────────────────
  const upsertSettings = async (rows: { key: string; value: string }[]): Promise<string | null> => {
    const { error } = await supabase
      .from("site_settings")
      .upsert(rows.map(r => ({ key: r.key, value: r.value, updated_at: new Date().toISOString() })),
        { onConflict: "key" });
    return error ? error.message : null;
  };

  const saveInstitution = async () => {
    setSavingConfig(true);
    const err = await upsertSettings([
      { key: "institution_name", value: cfgName },
      { key: "institution_mission", value: cfgMission },
      { key: "institution_vision", value: cfgVision },
      { key: "contact_phone", value: cfgPhone },
      { key: "contact_mobile", value: cfgMobile },
      { key: "contact_email", value: cfgEmail },
      { key: "contact_address", value: cfgAddress },
    ]);
    setSavingConfig(false);
    if (err) { void showMessage("Error al guardar", err, "error"); return; }
    setConfigSaved("institucion");
    setTimeout(() => setConfigSaved(null), 2500);
  };

  const saveAnnouncement = async () => {
    setSavingConfig(true);
    const err = await upsertSettings([
      { key: "announcement_text", value: cfgAnnouncement },
      { key: "announcement_active", value: String(cfgAnnouncementActive) },
    ]);
    setSavingConfig(false);
    if (err) { void showMessage("Error al guardar", err, "error"); return; }
    setConfigSaved("anuncio");
    setTimeout(() => setConfigSaved(null), 2500);
  };

  const saveSemester = async () => {
    setSavingConfig(true);
    const err = await upsertSettings([{ key: "active_semester", value: cfgSemester }]);
    if (!err && cfgBulkSemester) {
      await supabase.from("profiles").update({ current_semester: cfgSemester }).neq("id", "00000000-0000-0000-0000-000000000000");
    }
    setSavingConfig(false);
    if (err) { void showMessage("Error al guardar", err, "error"); return; }
    setConfigSaved("semestre");
    setTimeout(() => setConfigSaved(null), 2500);
  };

  const saveGallery = async () => {
    setSavingConfig(true);
    const err = await upsertSettings([{ key: "gallery_images", value: JSON.stringify(cfgGallery) }]);
    setSavingConfig(false);
    if (err) { void showMessage("Error al guardar", err, "error"); return; }
    setConfigSaved("gallery");
    setTimeout(() => setConfigSaved(null), 2500);
  };

  const saveRequirements = async () => {
    setSavingConfig(true);
    const err = await upsertSettings([{ key: "requirements", value: JSON.stringify(cfgRequirements) }]);
    setSavingConfig(false);
    if (err) { void showMessage("Error al guardar", err, "error"); return; }
    setConfigSaved("requirements");
    setTimeout(() => setConfigSaved(null), 2500);
  };

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
              onClick={() => supabase.auth.signOut({ scope: 'local' })}
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      <main style={{ maxWidth: "1400px", margin: "0 auto", padding: "24px" }}>
        {/* Message */}
        {msg && (
          <div style={{ padding: "16px 20px", borderRadius: "12px", marginBottom: "20px", background: msg.includes("✅") ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", border: `1px solid ${msg.includes("✅") ? "rgba(34,197,94,0.4)" : "rgba(239,68,68,0.4)"}`, color: msg.includes("✅") ? "#86efac" : "#fca5a5" }}>
            <pre style={{ margin: 0, whiteSpace: "pre-wrap", fontFamily: "inherit" }}>{msg}</pre>
          </div>
        )}

        {/* HOME */}
        {adminSection === "home" && (
          <div>
            {/* Profile section */}
            {authRole === "administrativo" ? (() => {
              const effectiveAvatarKey = localAdminAvatarKey ?? adminProfile?.avatar_key ?? "adm1";
              const avatarObj = ADMIN_AVATARS.find(a => a.key === effectiveAvatarKey) ?? ADMIN_AVATARS[0];
              return (
                <div style={{ marginBottom: "32px", background: "linear-gradient(135deg, rgba(15,23,42,0.8) 0%, rgba(20,30,50,0.6) 100%)", borderRadius: "20px", border: "1px solid rgba(30,41,59,0.7)", overflow: "hidden" }}>
                  {/* Header banner */}
                  <div style={{ height: "6px", background: adminProfile?.admin_type === "director" ? "linear-gradient(90deg, #0d9488, #14b8a6)" : "linear-gradient(90deg, #475569, #64748b)" }} />
                  <div style={{ padding: "28px" }}>
                    {/* Top row: avatar + info + botones */}
                    <div style={{ display: "flex", alignItems: "flex-start", gap: "20px", marginBottom: "24px" }}>
                      {/* Avatar */}
                      <div style={{ position: "relative", flexShrink: 0 }}>
                        <div style={{ width: "80px", height: "80px", borderRadius: "16px", background: "rgba(30,41,59,0.9)", border: "2px solid rgba(51,65,85,0.6)", display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                          <img src={avatarObj.url} alt={avatarObj.label} style={{ width: "52px", height: "52px", objectFit: "contain" }} />
                        </div>
                        <button
                          onClick={() => { setAdminSelectedAvatar(adminProfile?.avatar_key ?? "adm1"); setShowAdminAvatarModal(true); }}
                          style={{ position: "absolute", bottom: "-6px", right: "-6px", width: "26px", height: "26px", borderRadius: "8px", background: "linear-gradient(135deg, #0d9488, #0f766e)", border: "none", color: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                          title="Cambiar avatar"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                      </div>
                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "11px", color: adminProfile?.admin_type === "director" ? "#2dd4bf" : "#64748b", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "4px", fontWeight: "600" }}>
                          {adminProfile?.admin_type === "director" ? "Director(a)" : "Secretaria"}
                        </div>
                        <div style={{ fontSize: "22px", fontWeight: "800", color: "#f1f5f9", lineHeight: 1.2, marginBottom: "6px" }}>
                          {withDegree(adminProfile?.full_name, adminProfile?.academic_degree) || adminProfile?.full_name || "Sin nombre"}
                        </div>
                        <div style={{ fontSize: "12px", color: "#475569", fontFamily: "monospace" }}>{adminProfile?.code ?? ""}</div>
                      </div>
                      {/* Botones acción */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px", flexShrink: 0 }}>
                        <button
                          onClick={() => {
                            setAdminEditMode(v => !v);
                            setShowChangePassword(false);
                            if (!adminEditMode) { setAdminEditPhone(adminProfile?.phone ?? ""); setAdminEditEmail(adminProfile?.contact_email ?? ""); setAdminEditDegree(adminProfile?.academic_degree ?? ""); setAdminProfileMsg(null); }
                          }}
                          style={{ background: adminEditMode ? "rgba(51,65,85,0.8)" : "linear-gradient(135deg,rgba(37,99,235,0.7),rgba(29,78,216,0.8))", border: adminEditMode ? "1px solid rgba(71,85,105,0.5)" : "1px solid rgba(96,165,250,0.4)", color: adminEditMode ? "#94a3b8" : "#93c5fd", borderRadius: "10px", padding: "8px 14px", cursor: "pointer", fontSize: "12px", fontWeight: "600", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: "6px" }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                          {adminEditMode ? "Cancelar" : "Editar perfil"}
                        </button>
                        <button
                          onClick={() => { setShowChangePassword(v => !v); setAdminEditMode(false); setCpMsg(null); setCpCurrentPass(""); setCpNewPass(""); setCpConfirmPass(""); }}
                          style={{ background: showChangePassword ? "rgba(51,65,85,0.8)" : "linear-gradient(135deg,rgba(180,83,9,0.7),rgba(146,64,14,0.8))", border: showChangePassword ? "1px solid rgba(71,85,105,0.5)" : "1px solid rgba(251,191,36,0.3)", color: showChangePassword ? "#94a3b8" : "#fcd34d", borderRadius: "10px", padding: "8px 14px", cursor: "pointer", fontSize: "12px", fontWeight: "600", whiteSpace: "nowrap", display: "flex", alignItems: "center", gap: "6px" }}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                          {showChangePassword ? "Cancelar" : "Cambiar contraseña"}
                        </button>
                      </div>
                    </div>

                    {/* Info cells */}
                    {!adminEditMode && !showChangePassword && (
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                        <div style={{ background: "rgba(15,23,42,0.5)", borderRadius: "10px", padding: "12px 14px", border: "1px solid rgba(30,41,59,0.6)" }}>
                          <div style={{ fontSize: "11px", color: "#475569", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Celular</div>
                          <div style={{ fontSize: "14px", color: "#e2e8f0", fontWeight: "500" }}>{adminProfile?.phone || "—"}</div>
                        </div>
                        <div style={{ background: "rgba(15,23,42,0.5)", borderRadius: "10px", padding: "12px 14px", border: "1px solid rgba(30,41,59,0.6)" }}>
                          <div style={{ fontSize: "11px", color: "#475569", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Correo</div>
                          <div style={{ fontSize: "14px", color: "#e2e8f0", fontWeight: "500", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{adminProfile?.contact_email || "—"}</div>
                        </div>
                        <div style={{ background: "rgba(15,23,42,0.5)", borderRadius: "10px", padding: "12px 14px", border: "1px solid rgba(30,41,59,0.6)" }}>
                          <div style={{ fontSize: "11px", color: "#475569", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Grado</div>
                          <div style={{ fontSize: "14px", color: "#e2e8f0", fontWeight: "500" }}>{DEGREE_OPTIONS.find(o => o.value === adminProfile?.academic_degree)?.label?.split(" (")[0] || "—"}</div>
                        </div>
                      </div>
                    )}

                    {/* Edit form */}
                    {adminEditMode && (
                      <div style={{ borderTop: "1px solid rgba(51,65,85,0.4)", paddingTop: "20px" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
                          <div>
                            <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "6px" }}>Celular</label>
                            <input style={{ ...darkStyles.input }} value={adminEditPhone} onChange={e => setAdminEditPhone(e.target.value)} placeholder="Número de celular" />
                          </div>
                          <div>
                            <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "6px" }}>Correo (opcional)</label>
                            <input style={{ ...darkStyles.input }} value={adminEditEmail} onChange={e => setAdminEditEmail(e.target.value)} placeholder="Correo electrónico" />
                          </div>
                          <div>
                            <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "6px" }}>Grado académico</label>
                            <select style={{ ...darkStyles.input }} value={adminEditDegree} onChange={e => setAdminEditDegree(e.target.value)}>
                              {DEGREE_OPTIONS.map(o => <option key={o.value} value={o.value} style={{ background: "#1a1a1a" }}>{o.label}</option>)}
                            </select>
                          </div>
                        </div>
                        {adminProfileMsg && <p style={{ fontSize: "13px", color: adminProfileMsg.startsWith("✅") ? "#86efac" : "#fca5a5", marginBottom: "10px" }}>{adminProfileMsg}</p>}
                        <button onClick={saveAdminProfile} disabled={adminProfileSaving} style={{ ...darkStyles.btnSuccess, padding: "9px 20px", fontSize: "13px" }}>
                          {adminProfileSaving ? "Guardando..." : "Guardar cambios"}
                        </button>
                      </div>
                    )}

                    {/* Cambiar contraseña colapsable */}
                    {showChangePassword && (
                      <div style={{ borderTop: "1px solid rgba(51,65,85,0.4)", paddingTop: "20px" }}>
                        <div style={{ display: "grid", gap: "12px", marginBottom: "14px" }}>
                          <div>
                            <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "6px" }}>Contraseña actual</label>
                            <input type="password" style={{ ...darkStyles.input }} value={cpCurrentPass} onChange={e => setCpCurrentPass(e.target.value)} placeholder="Tu contraseña actual" autoComplete="current-password" />
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                            <div>
                              <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "6px" }}>Nueva contraseña</label>
                              <input type="password" style={{ ...darkStyles.input }} value={cpNewPass} onChange={e => setCpNewPass(e.target.value)} placeholder="Mínimo 6 caracteres" autoComplete="new-password" />
                            </div>
                            <div>
                              <label style={{ display: "block", fontSize: "12px", color: "#94a3b8", marginBottom: "6px" }}>Confirmar contraseña</label>
                              <input type="password" style={{ ...darkStyles.input }} value={cpConfirmPass} onChange={e => setCpConfirmPass(e.target.value)} placeholder="Repite la nueva contraseña" autoComplete="new-password" />
                            </div>
                          </div>
                        </div>
                        {cpMsg && <p style={{ fontSize: "13px", color: cpMsg.startsWith("✅") ? "#86efac" : "#fca5a5", marginBottom: "10px" }}>{cpMsg}</p>}
                        <button onClick={changeOwnPassword} disabled={cpSaving} style={{ ...darkStyles.btnPrimary, fontSize: "13px", padding: "9px 20px" }}>
                          {cpSaving ? "Verificando..." : "Actualizar contraseña"}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })() : (
              /* Admin del sistema — tarjeta simple */
              <div style={{ display: "flex", alignItems: "center", gap: "20px", marginBottom: "32px", padding: "24px", background: "rgba(15,23,42,0.5)", borderRadius: "16px", border: "1px solid rgba(30,41,59,0.5)" }}>
                <img src={logoCea} alt="CEA" style={{ width: "72px", height: "72px", borderRadius: "12px", objectFit: "contain", background: "rgba(255,255,255,0.05)", padding: "4px" }} />
                <div>
                  <div style={{ fontSize: "11px", color: "#475569", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "4px" }}>Administrador del sistema</div>
                  <div style={{ fontSize: "20px", fontWeight: "700", color: "#f1f5f9" }}>{adminProfile?.full_name ?? "Administrador"}</div>
                  {adminProfile?.contact_email && <div style={{ fontSize: "13px", color: "#64748b", marginTop: "2px" }}>{adminProfile.contact_email}</div>}
                </div>
              </div>
            )}

            <p style={{ color: "#71717a", marginBottom: "24px", fontSize: "15px" }}>Selecciona una sección para comenzar.</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px" }}>
              {/* Carreras */}
              <button
                onClick={() => setAdminSection("carreras")}
                style={{ background: "linear-gradient(135deg, rgba(30,58,138,0.6) 0%, rgba(20,20,30,0.9) 100%)", border: "1px solid rgba(59,130,246,0.3)", borderRadius: "20px", padding: "36px 28px", textAlign: "left", cursor: "pointer", color: "#fff", transition: "all 0.25s", position: "relative", overflow: "hidden" }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.border = "1px solid rgba(96,165,250,0.6)"; (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-3px)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 16px 40px rgba(59,130,246,0.2)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.border = "1px solid rgba(59,130,246,0.3)"; (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "none"; }}
              >
                <div style={{ width: "56px", height: "56px", borderRadius: "14px", background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.3)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "16px" }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3L1 9l11 6 9-4.91V17M5 13.18v4L12 21l7-3.82v-4"/></svg>
                </div>
                <h3 style={{ fontSize: "20px", fontWeight: "700", marginBottom: "8px" }}>Carreras</h3>
                <p style={{ color: "#94a3b8", fontSize: "14px", lineHeight: 1.5 }}>Gestión de carreras, niveles y estructura académica.</p>
                <span style={{ position: "absolute", bottom: "20px", right: "24px", fontSize: "24px", color: "rgba(96,165,250,0.3)" }}>→</span>
              </button>

              {/* Docentes */}
              <button
                onClick={() => setAdminSection("docentes")}
                style={{ background: "linear-gradient(135deg, rgba(20,83,45,0.6) 0%, rgba(20,20,30,0.9) 100%)", border: "1px solid rgba(34,197,94,0.3)", borderRadius: "20px", padding: "36px 28px", textAlign: "left", cursor: "pointer", color: "#fff", transition: "all 0.25s", position: "relative", overflow: "hidden" }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.border = "1px solid rgba(74,222,128,0.6)"; (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-3px)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 16px 40px rgba(34,197,94,0.2)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.border = "1px solid rgba(34,197,94,0.3)"; (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "none"; }}
              >
                <div style={{ width: "56px", height: "56px", borderRadius: "14px", background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.3)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "16px" }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                </div>
                <h3 style={{ fontSize: "20px", fontWeight: "700", marginBottom: "8px" }}>Docentes</h3>
                <p style={{ color: "#94a3b8", fontSize: "14px", lineHeight: 1.5 }}>Registro, credenciales y gestión de facilitadores.</p>
                <span style={{ position: "absolute", bottom: "20px", right: "24px", fontSize: "24px", color: "rgba(74,222,128,0.3)" }}>→</span>
              </button>

              {/* Estudiantes */}
              <button
                onClick={() => setAdminSection("estudiantes")}
                style={{ background: "linear-gradient(135deg, rgba(88,28,135,0.6) 0%, rgba(20,20,30,0.9) 100%)", border: "1px solid rgba(168,85,247,0.3)", borderRadius: "20px", padding: "36px 28px", textAlign: "left", cursor: "pointer", color: "#fff", transition: "all 0.25s", position: "relative", overflow: "hidden" }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.border = "1px solid rgba(192,132,252,0.6)"; (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-3px)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 16px 40px rgba(168,85,247,0.2)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.border = "1px solid rgba(168,85,247,0.3)"; (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "none"; }}
              >
                <div style={{ width: "56px", height: "56px", borderRadius: "14px", background: "rgba(168,85,247,0.15)", border: "1px solid rgba(168,85,247,0.3)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "16px" }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#c084fc" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </div>
                <h3 style={{ fontSize: "20px", fontWeight: "700", marginBottom: "8px" }}>Estudiantes</h3>
                <p style={{ color: "#94a3b8", fontSize: "14px", lineHeight: 1.5 }}>Alta de estudiantes, matrículas, niveles y expedientes.</p>
                <span style={{ position: "absolute", bottom: "20px", right: "24px", fontSize: "24px", color: "rgba(192,132,252,0.3)" }}>→</span>
              </button>

              {/* Administrativos — solo admin puede gestionar */}
              {authRole === "admin" && (
                <button
                  onClick={() => setAdminSection("administrativos")}
                  style={{ background: "linear-gradient(135deg, rgba(15,118,110,0.6) 0%, rgba(20,20,30,0.9) 100%)", border: "1px solid rgba(20,184,166,0.3)", borderRadius: "20px", padding: "36px 28px", textAlign: "left", cursor: "pointer", color: "#fff", transition: "all 0.25s", position: "relative", overflow: "hidden" }}
                  onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.border = "1px solid rgba(45,212,191,0.6)"; (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-3px)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 16px 40px rgba(20,184,166,0.2)"; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.border = "1px solid rgba(20,184,166,0.3)"; (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "none"; }}
                >
                  <div style={{ width: "56px", height: "56px", borderRadius: "14px", background: "rgba(20,184,166,0.15)", border: "1px solid rgba(20,184,166,0.3)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "16px" }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#2dd4bf" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 11c0 3-2.3 5.2-5 6-.6.2-1 .7-1 1.4V20"/><path d="M12 11c0 3 2.3 5.2 5 6 .6.2 1 .7 1 1.4V20"/><path d="M12 11V3"/><path d="M9 3h6"/></svg>
                  </div>
                  <h3 style={{ fontSize: "20px", fontWeight: "700", marginBottom: "8px" }}>Administrativos</h3>
                  <p style={{ color: "#94a3b8", fontSize: "14px", lineHeight: 1.5 }}>Gestión de director(a) y secretaria de la institución.</p>
                  <span style={{ position: "absolute", bottom: "20px", right: "24px", fontSize: "24px", color: "rgba(45,212,191,0.3)" }}>→</span>
                </button>
              )}

              {/* Académico — admin y administrativo */}
              <button
                onClick={() => setAdminSection("academico")}
                style={{ background: "linear-gradient(135deg, rgba(30,58,95,0.6) 0%, rgba(20,20,30,0.9) 100%)", border: "1px solid rgba(56,189,248,0.3)", borderRadius: "20px", padding: "36px 28px", textAlign: "left", cursor: "pointer", color: "#fff", transition: "all 0.25s", position: "relative", overflow: "hidden" }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.border = "1px solid rgba(56,189,248,0.6)"; (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-3px)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 16px 40px rgba(56,189,248,0.15)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.border = "1px solid rgba(56,189,248,0.3)"; (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "none"; }}
              >
                <div style={{ width: "56px", height: "56px", borderRadius: "14px", background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.25)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "16px" }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                </div>
                <h3 style={{ fontSize: "20px", fontWeight: "700", marginBottom: "8px" }}>Académico</h3>
                <p style={{ color: "#94a3b8", fontSize: "14px", lineHeight: 1.5 }}>Centralizador de notas y reportes académicos por carrera y nivel.</p>
                <span style={{ position: "absolute", bottom: "20px", right: "24px", fontSize: "24px", color: "rgba(56,189,248,0.3)" }}>→</span>
              </button>

              {/* Configuración */}
              <button
                onClick={() => setAdminSection("config")}
                style={{ background: "linear-gradient(135deg, rgba(120,53,15,0.6) 0%, rgba(20,20,30,0.9) 100%)", border: "1px solid rgba(251,146,60,0.3)", borderRadius: "20px", padding: "36px 28px", textAlign: "left", cursor: "pointer", color: "#fff", transition: "all 0.25s", position: "relative", overflow: "hidden" }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.border = "1px solid rgba(251,146,60,0.6)"; (e.currentTarget as HTMLButtonElement).style.transform = "translateY(-3px)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 16px 40px rgba(251,146,60,0.15)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.border = "1px solid rgba(251,146,60,0.3)"; (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLButtonElement).style.boxShadow = "none"; }}
              >
                <div style={{ width: "56px", height: "56px", borderRadius: "14px", background: "rgba(251,146,60,0.1)", border: "1px solid rgba(251,146,60,0.2)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: "16px" }}>
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fb923c" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                </div>
                <h3 style={{ fontSize: "20px", fontWeight: "700", marginBottom: "8px" }}>Configuración</h3>
                <p style={{ color: "#94a3b8", fontSize: "14px", lineHeight: 1.5 }}>Información institucional, página pública, anuncios y ajustes generales.</p>
              </button>
            </div>
          </div>
        )}

        {/* ADMINISTRATIVOS */}
        {adminSection === "administrativos" && (
          <div>
            <button onClick={() => setAdminSection("home")} style={{ marginBottom: "24px", background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "14px", display: "flex", alignItems: "center", gap: "6px" }}>← Inicio</button>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
              <div>
                <h2 style={{ fontSize: "22px", fontWeight: "700", color: "#fff", margin: 0 }}>Administrativos</h2>
                <p style={{ color: "#64748b", fontSize: "13px", marginTop: "4px" }}>Director(a) y Secretaria de la institución (máximo uno de cada tipo).</p>
              </div>
              <div style={{ display: "flex", gap: "10px" }}>
                {!adminStaff.find(s => s.admin_type === "director") && (
                  <button onClick={() => openCreateStaff("director")} style={{ ...darkStyles.btnPrimary, background: "linear-gradient(135deg, rgba(20,184,166,0.8) 0%, rgba(15,118,110,0.9) 100%)", border: "1px solid rgba(45,212,191,0.4)", fontSize: "13px", padding: "8px 16px" }}>
                    + Añadir Director(a)
                  </button>
                )}
                {!adminStaff.find(s => s.admin_type === "secretaria") && (
                  <button onClick={() => openCreateStaff("secretaria")} style={{ ...darkStyles.btnSecondary, fontSize: "13px", padding: "8px 16px" }}>
                    + Añadir Secretaria
                  </button>
                )}
              </div>
            </div>

            {loadingAdminStaff ? (
              <div style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>Cargando...</div>
            ) : adminStaff.length === 0 ? (
              <div style={{ ...darkStyles.card, padding: "40px", textAlign: "center" }}>
                <p style={{ color: "#64748b", fontSize: "15px" }}>No hay administrativos registrados.</p>
                <p style={{ color: "#475569", fontSize: "13px", marginTop: "8px" }}>Usa los botones de arriba para añadir un director(a) o secretaria.</p>
              </div>
            ) : (
              <div style={{ display: "grid", gap: "16px" }}>
                {adminStaff.map(staff => (
                  <div key={staff.id} style={{ ...darkStyles.card, padding: "20px", display: "flex", alignItems: "center", gap: "16px" }}>
                    <div style={{ width: "52px", height: "52px", borderRadius: "12px", background: staff.admin_type === "director" ? "rgba(20,184,166,0.15)" : "rgba(100,116,139,0.15)", border: `1px solid ${staff.admin_type === "director" ? "rgba(45,212,191,0.3)" : "rgba(100,116,139,0.3)"}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={staff.admin_type === "director" ? "#2dd4bf" : "#94a3b8"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "2px" }}>
                        <span style={{ fontSize: "16px", fontWeight: "600", color: "#f1f5f9" }}>{withDegree(staff.full_name || (`${staff.first_names ?? ""} ${staff.last_name_pat ?? ""}`.trim()) || null, staff.academic_degree) || "—"}</span>
                        <span style={{ padding: "2px 10px", borderRadius: "12px", fontSize: "11px", fontWeight: "600", textTransform: "uppercase", letterSpacing: "0.06em", background: staff.admin_type === "director" ? "rgba(20,184,166,0.2)" : "rgba(100,116,139,0.2)", color: staff.admin_type === "director" ? "#2dd4bf" : "#94a3b8", border: `1px solid ${staff.admin_type === "director" ? "rgba(45,212,191,0.3)" : "rgba(100,116,139,0.3)"}` }}>
                          {staff.admin_type === "director" ? "Director(a)" : "Secretaria"}
                        </span>
                      </div>
                      <div style={{ fontSize: "12px", color: "#64748b" }}>
                        {staff.code && <span style={{ marginRight: "12px" }}>Código: {staff.code}</span>}
                        {staff.phone && <span style={{ marginRight: "12px" }}>Tel: {staff.phone}</span>}
                        {staff.contact_email && <span>{staff.contact_email}</span>}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                      <button onClick={() => openEditStaff(staff)} style={{ ...darkStyles.btnSecondary, fontSize: "12px", padding: "6px 12px" }}>Editar</button>
                      <button onClick={() => openResetPassword(staff.id, staff.code ?? staff.id)} style={{ ...darkStyles.btnSecondary, fontSize: "12px", padding: "6px 12px", color: "#fcd34d", borderColor: "rgba(251,191,36,0.3)" }}>Contraseña</button>
                      <button onClick={() => void deleteStaff(staff)} style={{ ...darkStyles.btnDanger, fontSize: "12px", padding: "6px 12px" }}>Eliminar</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* MODAL CREAR/EDITAR ADMINISTRATIVO */}
        {showAdminStaffModal && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1001, padding: "20px" }}>
            <div style={{ ...darkStyles.modal, width: "100%", maxWidth: "480px", padding: "28px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
                <h3 style={{ fontSize: "18px", fontWeight: "700", color: "#fff", margin: 0 }}>{editingStaffId ? "Editar Administrativo" : `Nuevo ${staffAdminType === "director" ? "Director(a)" : "Secretaria"}`}</h3>
                <button onClick={() => setShowAdminStaffModal(false)} style={{ background: "transparent", border: "none", color: "#71717a", fontSize: "24px", cursor: "pointer", padding: 0, lineHeight: 1 }}>×</button>
              </div>
              <form onSubmit={e => void saveAdminStaff(e)} style={{ display: "grid", gap: "14px" }}>
                {!editingStaffId && (
                  <div>
                    <label style={{ display: "block", color: "#94a3b8", fontSize: "12px", marginBottom: "6px", textTransform: "uppercase" }}>Tipo</label>
                    <div style={{ display: "flex", gap: "8px" }}>
                      {(["director", "secretaria"] as const).map(t => (
                        <button key={t} type="button" onClick={() => setStaffAdminType(t)}
                          style={{ flex: 1, padding: "8px", borderRadius: "8px", border: `2px solid ${staffAdminType === t ? "rgba(45,212,191,0.6)" : "rgba(51,65,85,0.5)"}`, background: staffAdminType === t ? "rgba(20,184,166,0.15)" : "rgba(15,23,42,0.8)", color: staffAdminType === t ? "#2dd4bf" : "#94a3b8", cursor: "pointer", fontSize: "13px", fontWeight: "600", textTransform: "capitalize" }}>
                          {t === "director" ? "Director(a)" : "Secretaria"}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                <div>
                  <label style={{ display: "block", color: "#94a3b8", fontSize: "12px", marginBottom: "6px", textTransform: "uppercase" }}>Nombre(s)</label>
                  <input required value={staffFirstNames} onChange={e => setStaffFirstNames(e.target.value)} style={{ ...darkStyles.input }} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div>
                    <label style={{ display: "block", color: "#94a3b8", fontSize: "12px", marginBottom: "6px", textTransform: "uppercase" }}>Ap. Paterno</label>
                    <input value={staffLastPat} onChange={e => setStaffLastPat(e.target.value)} style={{ ...darkStyles.input }} />
                  </div>
                  <div>
                    <label style={{ display: "block", color: "#94a3b8", fontSize: "12px", marginBottom: "6px", textTransform: "uppercase" }}>Ap. Materno</label>
                    <input value={staffLastMat} onChange={e => setStaffLastMat(e.target.value)} style={{ ...darkStyles.input }} />
                  </div>
                </div>
                <div>
                  <label style={{ display: "block", color: "#94a3b8", fontSize: "12px", marginBottom: "6px", textTransform: "uppercase" }}>Teléfono</label>
                  <input required value={staffPhone} onChange={e => setStaffPhone(e.target.value)} style={{ ...darkStyles.input }} />
                </div>
                <div>
                  <label style={{ display: "block", color: "#94a3b8", fontSize: "12px", marginBottom: "6px", textTransform: "uppercase" }}>Correo electrónico</label>
                  <input type="email" value={staffEmail} onChange={e => setStaffEmail(e.target.value)} style={{ ...darkStyles.input }} />
                </div>
                <div>
                  <label style={{ display: "block", color: "#94a3b8", fontSize: "12px", marginBottom: "6px", textTransform: "uppercase" }}>Grado académico</label>
                  <select value={staffDegree} onChange={e => setStaffDegree(e.target.value)} style={{ ...darkStyles.input }}>
                    <option value="">Sin grado especificado</option>
                    <option value="ts">Técnico Superior (T.S.)</option>
                    <option value="lic">Licenciatura (Lic.)</option>
                    <option value="ing">Ingeniería (Ing.)</option>
                    <option value="msc">Maestría (M.Sc.)</option>
                    <option value="dr">Doctorado (Dr.)</option>
                  </select>
                </div>
                {!editingStaffId && (
                  <div>
                    <label style={{ display: "block", color: "#94a3b8", fontSize: "12px", marginBottom: "6px", textTransform: "uppercase" }}>Contraseña temporal</label>
                    <div style={{ display: "flex", gap: "8px" }}>
                      <input value={staffTempPassword} onChange={e => setStaffTempPassword(e.target.value)} style={{ ...darkStyles.input }} />
                      <button type="button" onClick={() => setStaffTempPassword(randomPass())} style={{ ...darkStyles.btnSecondary, padding: "10px 12px", fontSize: "12px", whiteSpace: "nowrap" }}>Nueva</button>
                    </div>
                  </div>
                )}
                <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
                  <button type="submit" disabled={creatingStaff} style={{ ...darkStyles.btnPrimary, flex: 1, opacity: creatingStaff ? 0.6 : 1 }}>{creatingStaff ? "Guardando..." : editingStaffId ? "Guardar cambios" : "Crear administrativo"}</button>
                  <button type="button" onClick={() => setShowAdminStaffModal(false)} style={{ ...darkStyles.btnSecondary }}>Cancelar</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* CARRERAS */}
        {adminSection === "carreras" && (
          <div>
            <button onClick={() => setAdminSection("home")} style={{ marginBottom: "20px", background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "14px", display: "flex", alignItems: "center", gap: "6px" }}>← Inicio</button>

        {/* SECCIÓN CUENTAS BLOQUEADAS — visible en carreras también si hay bloqueadas */}
        {lockedAccounts.length > 0 && (
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
                        {canManageStudents && (
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
                        )}
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
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M12 3L1 9l11 6 9-4.91V17M5 13.18v4L12 21l7-3.82v-4"/></svg>
              Carreras
            </h2>
            <div style={{ display: "flex", gap: "12px" }}>
              <input
                style={{ ...darkStyles.input, width: "250px" }}
                placeholder="Buscar carrera..."
                value={careerSearch}
                onChange={(e) => setCareerSearch(e.target.value)}
              />
              {!isReadOnly && !showCareerForm && (
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
          {!isReadOnly && showCareerForm && (
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
                          {!isReadOnly && (
                          <>
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
                          </>
                          )}
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
          </div>
        )}

        {/* DOCENTES */}
        {adminSection === "docentes" && (
          <div>
            <button onClick={() => setAdminSection("home")} style={{ marginBottom: "20px", background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "14px", display: "flex", alignItems: "center", gap: "6px" }}>← Inicio</button>

        {/* SECCIÓN CUENTAS BLOQUEADAS */}
        {lockedAccounts.length > 0 && (
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
                        {canManageStudents && (
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
                        )}
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
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
              Docentes
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
              {!isReadOnly && (
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
              )}
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
                      {!isReadOnly && (
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
                      )}
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
          </div>
        )}

        {/* ESTUDIANTES */}
        {adminSection === "estudiantes" && (
          <div>
            <button onClick={() => setAdminSection("home")} style={{ marginBottom: "20px", background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "14px", display: "flex", alignItems: "center", gap: "6px" }}>← Inicio</button>

        {/* SECCIÓN CUENTAS BLOQUEADAS */}
        {lockedAccounts.length > 0 && (
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
                        {canManageStudents && (
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
                        )}
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
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#c084fc" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              Estudiantes
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
              {canManageStudents && (
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
              )}
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
                        {canManageStudents && (
                          <>
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
                          </>
                        )}
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
          </div>
        )}
        {/* ─── ACADÉMICO ─── */}
        {adminSection === "academico" && (
          <div>
            <button onClick={() => setAdminSection("home")} style={{ marginBottom: "24px", background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "14px", display: "flex", alignItems: "center", gap: "6px" }}>← Inicio</button>

            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
              <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              </div>
              <div>
                <h2 style={{ fontSize: "22px", fontWeight: "700", color: "#fff", margin: 0 }}>Académico</h2>
                <p style={{ fontSize: "13px", color: "#64748b", margin: 0 }}>Reportes de calificaciones por carrera y nivel.</p>
              </div>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: "8px", marginBottom: "24px" }}>
              {(["centralizador", "modulo"] as const).map(t => {
                const labels = { centralizador: "Centralizador Semestral", modulo: "Notas por Módulo" };
                return (
                  <button key={t} onClick={() => setAcadTab(t)} style={{ padding: "9px 20px", borderRadius: "10px", fontSize: "13px", fontWeight: "600", cursor: "pointer", transition: "all 0.2s", background: acadTab === t ? "rgba(56,189,248,0.15)" : "rgba(30,30,40,0.8)", border: acadTab === t ? "1px solid rgba(56,189,248,0.5)" : "1px solid rgba(71,85,105,0.4)", color: acadTab === t ? "#38bdf8" : "#94a3b8" }}>
                    {labels[t]}
                  </button>
                );
              })}
            </div>

            {/* Filtros comunes */}
            <div style={{ ...darkStyles.card, padding: "20px", marginBottom: "20px" }}>
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "flex-end" }}>
                <div>
                  <label style={{ display: "block", fontSize: "11px", color: "#64748b", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Carrera</label>
                  <select
                    style={{ ...darkStyles.input, width: "200px" }}
                    value={acadCareer}
                    onChange={e => {
                      const v = e.target.value ? Number(e.target.value) : "";
                      setAcadCareer(v);
                      setAcadLevel("");
                      setAcadModule("");
                      setAcadModulesList([]);
                      setAcadGrades([]);
                    }}
                  >
                    <option value="">Seleccionar carrera</option>
                    {careers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: "11px", color: "#64748b", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Nivel</label>
                  <select
                    style={{ ...darkStyles.input, width: "200px" }}
                    value={acadLevel}
                    disabled={!acadCareer}
                    onChange={e => {
                      const v = e.target.value ? Number(e.target.value) : "";
                      setAcadLevel(v);
                      setAcadModule("");
                      setAcadGrades([]);
                      if (v) {
                        void loadAcadModules(v);
                        void loadAcadGrades(v);
                      } else {
                        setAcadModulesList([]);
                      }
                    }}
                  >
                    <option value="">Seleccionar nivel</option>
                    {levels.filter(l => l.career_id === acadCareer).sort((a,b) => a.sort_order - b.sort_order).map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                </div>
                {acadTab === "modulo" && (
                  <div>
                    <label style={{ display: "block", fontSize: "11px", color: "#64748b", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.06em" }}>Módulo</label>
                    <select
                      style={{ ...darkStyles.input, width: "220px" }}
                      value={acadModule}
                      disabled={!acadLevel}
                      onChange={e => setAcadModule(e.target.value ? Number(e.target.value) : "")}
                    >
                      <option value="">Seleccionar módulo</option>
                      {acadModulesList.map(m => <option key={m.id} value={m.id}>{m.sort_order}. {m.title}</option>)}
                    </select>
                  </div>
                )}
                {loadingAcad && <span style={{ fontSize: "13px", color: "#64748b", alignSelf: "center", paddingBottom: "2px" }}>Cargando datos...</span>}
              </div>
            </div>

            {/* Tab: CENTRALIZADOR */}
            {acadTab === "centralizador" && (
              <div style={{ ...darkStyles.card, padding: "24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                  <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#fff", margin: 0 }}>Centralizador de Notas Semestral</h3>
                  {acadCareer && acadLevel && (
                    <button
                      onClick={() => void generateCentralizadorPdf()}
                      disabled={generatingAcadPdf || getAcadStudents().length === 0}
                      style={{ ...darkStyles.btnPrimary, background: "linear-gradient(135deg, rgba(30,58,95,0.9), rgba(56,189,248,0.3))", border: "1px solid rgba(56,189,248,0.4)", color: "#e0f2fe", fontSize: "13px", padding: "8px 18px" }}
                    >
                      {generatingAcadPdf ? "Generando..." : "📄 Exportar PDF"}
                    </button>
                  )}
                </div>
                {!acadCareer || !acadLevel ? (
                  <p style={{ color: "#475569", textAlign: "center", padding: "32px 0", fontSize: "14px" }}>Selecciona una carrera y nivel para ver el centralizador.</p>
                ) : loadingAcad ? (
                  <p style={{ color: "#475569", textAlign: "center", padding: "32px 0" }}>Cargando notas...</p>
                ) : (() => {
                  const acadStudents = getAcadStudents();
                  const modules = [...acadModulesList].sort((a, b) => a.sort_order - b.sort_order);
                  return (
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                        <thead>
                          <tr style={darkStyles.tableHeader}>
                            <th style={{ padding: "10px 8px", textAlign: "left", whiteSpace: "nowrap" }}>N°</th>
                            <th style={{ padding: "10px 8px", textAlign: "left", whiteSpace: "nowrap" }}>Código</th>
                            <th style={{ padding: "10px 8px", textAlign: "left", whiteSpace: "nowrap" }}>Apellidos</th>
                            <th style={{ padding: "10px 8px", textAlign: "left", whiteSpace: "nowrap" }}>Nombres</th>
                            {modules.map(m => (
                              <th key={m.id} title={m.title} style={{ padding: "10px 8px", textAlign: "center", maxWidth: "100px", fontSize: "11px" }}>
                                <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "98px" }}>M{m.sort_order}: {m.title}</div>
                              </th>
                            ))}
                            <th style={{ padding: "10px 8px", textAlign: "center", whiteSpace: "nowrap", color: "#38bdf8" }}>Promedio</th>
                          </tr>
                        </thead>
                        <tbody>
                          {acadStudents.length === 0 ? (
                            <tr><td colSpan={5 + modules.length + 1} style={{ padding: "32px", textAlign: "center", color: "#475569" }}>No hay estudiantes en este nivel.</td></tr>
                          ) : acadStudents.map((s, idx) => {
                            const sg = acadGrades.filter(g => g.student_id === s.id);
                            const totals = modules.map(m => sg.find(g => g.module_id === m.id)?.total ?? null);
                            const nums = totals.filter((t): t is number => t !== null);
                            const prom = nums.length > 0 ? (nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(1) : "-";
                            return (
                              <tr key={s.id} style={darkStyles.tableRow}>
                                <td style={{ padding: "9px 8px", color: "#71717a" }}>{idx + 1}</td>
                                <td style={{ padding: "9px 8px", fontFamily: "monospace", color: "#e4e4e7", fontSize: "11px" }}>{s.code ?? "-"}</td>
                                <td style={{ padding: "9px 8px", color: "#e4e4e7" }}>{[s.last_name_pat, s.last_name_mat].filter(Boolean).join(" ") || "-"}</td>
                                <td style={{ padding: "9px 8px", color: "#e4e4e7" }}>{s.first_names ?? "-"}</td>
                                {totals.map((t, i) => (
                                  <td key={i} style={{ padding: "9px 8px", textAlign: "center", color: t == null ? "#475569" : t >= 76 ? "#86efac" : t >= 51 ? "#fde68a" : "#fca5a5", fontWeight: t != null ? "600" : "400" }}>
                                    {t != null ? Math.round(t) : "-"}
                                  </td>
                                ))}
                                <td style={{ padding: "9px 8px", textAlign: "center", color: "#38bdf8", fontWeight: "700" }}>{prom}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Tab: NOTAS POR MÓDULO */}
            {acadTab === "modulo" && (
              <div style={{ ...darkStyles.card, padding: "24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
                  <h3 style={{ fontSize: "16px", fontWeight: "700", color: "#fff", margin: 0 }}>Registro de Notas por Módulo</h3>
                  {acadCareer && acadLevel && acadModule && (
                    <button
                      onClick={() => void generateModuloPdf()}
                      disabled={generatingAcadPdf || getAcadStudents().length === 0}
                      style={{ ...darkStyles.btnPrimary, background: "linear-gradient(135deg, rgba(30,58,95,0.9), rgba(56,189,248,0.3))", border: "1px solid rgba(56,189,248,0.4)", color: "#e0f2fe", fontSize: "13px", padding: "8px 18px" }}
                    >
                      {generatingAcadPdf ? "Generando..." : "📄 Exportar PDF"}
                    </button>
                  )}
                </div>
                {!acadCareer || !acadLevel ? (
                  <p style={{ color: "#475569", textAlign: "center", padding: "32px 0", fontSize: "14px" }}>Selecciona una carrera y nivel para continuar.</p>
                ) : !acadModule ? (
                  <p style={{ color: "#475569", textAlign: "center", padding: "32px 0", fontSize: "14px" }}>Selecciona un módulo para ver las calificaciones.</p>
                ) : loadingAcad ? (
                  <p style={{ color: "#475569", textAlign: "center", padding: "32px 0" }}>Cargando notas...</p>
                ) : (() => {
                  const acadStudents = getAcadStudents();
                  const moduleGrades = acadGrades.filter(g => g.module_id === acadModule);
                  return (
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                        <thead>
                          <tr style={darkStyles.tableHeader}>
                            <th style={{ padding: "9px 6px", textAlign: "left", whiteSpace: "nowrap" }}>N°</th>
                            <th style={{ padding: "9px 6px", textAlign: "left", whiteSpace: "nowrap" }}>Código</th>
                            <th style={{ padding: "9px 6px", textAlign: "left", whiteSpace: "nowrap" }}>Apellidos</th>
                            <th style={{ padding: "9px 6px", textAlign: "left", whiteSpace: "nowrap" }}>Nombres</th>
                            <th style={{ padding: "9px 6px", textAlign: "center", whiteSpace: "nowrap" }} title="Ser (10 pts)">Ser (10)</th>
                            <th style={{ padding: "9px 6px", textAlign: "center", whiteSpace: "nowrap" }} title="Saber (30 pts)">Saber (30)</th>
                            <th style={{ padding: "9px 6px", textAlign: "center", whiteSpace: "nowrap" }} title="Hacer Proceso+Producto (40 pts)">Hacer (40)</th>
                            <th style={{ padding: "9px 6px", textAlign: "center", whiteSpace: "nowrap" }} title="Decidir (10 pts)">Decidir (10)</th>
                            <th style={{ padding: "9px 6px", textAlign: "center", whiteSpace: "nowrap" }} title="Autoevaluación: Auto-Ser + Auto-Decidir (10 pts)">Autoeva. (10)</th>
                            <th style={{ padding: "9px 6px", textAlign: "center", whiteSpace: "nowrap" }}>Total (100)</th>
                            <th style={{ padding: "9px 6px", textAlign: "left", whiteSpace: "nowrap" }}>Resultado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {acadStudents.length === 0 ? (
                            <tr><td colSpan={11} style={{ padding: "32px", textAlign: "center", color: "#475569" }}>No hay estudiantes en este nivel.</td></tr>
                          ) : acadStudents.map((s, idx) => {
                            const g = moduleGrades.find(g => g.student_id === s.id);
                            const totalColor = g?.total == null ? "#475569" : g.total >= 76 ? "#86efac" : g.total >= 51 ? "#fde68a" : "#fca5a5";
                            const tieneHacer = g?.hacer_proceso != null || g?.hacer_producto != null;
                            const tieneAutoeva = g?.auto_ser != null || g?.auto_decidir != null;
                            const hacer = tieneHacer ? (g?.hacer_proceso ?? 0) + (g?.hacer_producto ?? 0) : null;
                            const autoeva = tieneAutoeva ? (g?.auto_ser ?? 0) + (g?.auto_decidir ?? 0) : null;
                            return (
                              <tr key={s.id} style={darkStyles.tableRow}>
                                <td style={{ padding: "8px 6px", color: "#71717a" }}>{idx + 1}</td>
                                <td style={{ padding: "8px 6px", fontFamily: "monospace", color: "#e4e4e7", fontSize: "11px" }}>{s.code ?? "-"}</td>
                                <td style={{ padding: "8px 6px", color: "#e4e4e7" }}>{[s.last_name_pat, s.last_name_mat].filter(Boolean).join(" ") || "-"}</td>
                                <td style={{ padding: "8px 6px", color: "#e4e4e7" }}>{s.first_names ?? "-"}</td>
                                <td style={{ padding: "8px 6px", textAlign: "center", color: "#e4e4e7" }}>{g?.ser != null ? Math.round(g.ser) : "-"}</td>
                                <td style={{ padding: "8px 6px", textAlign: "center", color: "#e4e4e7" }}>{g?.saber != null ? Math.round(g.saber) : "-"}</td>
                                <td style={{ padding: "8px 6px", textAlign: "center", color: "#e4e4e7" }}>{hacer != null ? Math.round(hacer) : "-"}</td>
                                <td style={{ padding: "8px 6px", textAlign: "center", color: "#e4e4e7" }}>{g?.decidir != null ? Math.round(g.decidir) : "-"}</td>
                                <td style={{ padding: "8px 6px", textAlign: "center", color: "#a1a1aa" }}>{autoeva != null ? Math.round(autoeva) : "-"}</td>
                                <td style={{ padding: "8px 6px", textAlign: "center", color: totalColor, fontWeight: "700" }}>{g?.total != null ? Math.round(g.total) : "-"}</td>
                                <td style={{ padding: "8px 6px", color: totalColor, fontSize: "11px" }}>{g?.observation ?? "-"}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        )}

        {/* ─── CONFIGURACIÓN ─── */}
        {adminSection === "config" && (
          <div>
            <button onClick={() => setAdminSection("home")} style={{ marginBottom: "20px", background: "none", border: "none", color: "#94a3b8", cursor: "pointer", fontSize: "14px", display: "flex", alignItems: "center", gap: "6px" }}>← Inicio</button>

            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
              <div style={{ width: "44px", height: "44px", borderRadius: "12px", background: "rgba(251,146,60,0.15)", border: "1px solid rgba(251,146,60,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fb923c" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
              </div>
              <h2 style={{ fontSize: "22px", fontWeight: "700", color: "#fff", display: "flex", alignItems: "center", gap: "8px" }}>Configuración del Sistema</h2>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: "6px", marginBottom: "24px", flexWrap: "wrap" }}>
              {(["institucion","anuncio","semestre","exportar"] as const).map((tab) => {
                const labels: Record<string,string> = { institucion: "Institución", anuncio: "Anuncio Global", semestre: "Semestre Activo", exportar: "Exportar Datos" };
                return (
                  <button key={tab} onClick={() => setConfigTab(tab)} style={{ padding: "8px 18px", borderRadius: "10px", fontSize: "13px", fontWeight: "600", cursor: "pointer", transition: "all 0.2s", background: configTab === tab ? "rgba(251,146,60,0.2)" : "rgba(30,30,40,0.8)", border: configTab === tab ? "1px solid rgba(251,146,60,0.5)" : "1px solid rgba(71,85,105,0.4)", color: configTab === tab ? "#fb923c" : "#94a3b8" }}>
                    {labels[tab]}
                  </button>
                );
              })}
            </div>

            {loadingConfig && <div style={{ color: "#64748b", fontSize: "12px", marginBottom: "12px" }}>Sincronizando con base de datos...</div>}

            {configTab === "institucion" && (
              <div style={{ ...darkStyles.card, padding: "28px" }}>
                <h3 style={{ fontSize: "17px", fontWeight: "700", color: "#fff", marginBottom: "20px" }}>Información Institucional</h3>
                <div style={{ display: "grid", gap: "16px" }}>
                  <div>
                    <label style={{ display: "block", color: "#94a3b8", fontSize: "12px", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Nombre de la Institución</label>
                    <input value={cfgName} onChange={e => setCfgName(e.target.value)} style={{ ...darkStyles.input, width: "100%", boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <label style={{ display: "block", color: "#94a3b8", fontSize: "12px", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Misión</label>
                    <textarea value={cfgMission} onChange={e => setCfgMission(e.target.value)} rows={3} style={{ ...darkStyles.input, width: "100%", resize: "vertical", boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <label style={{ display: "block", color: "#94a3b8", fontSize: "12px", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Visión</label>
                    <textarea value={cfgVision} onChange={e => setCfgVision(e.target.value)} rows={3} style={{ ...darkStyles.input, width: "100%", resize: "vertical", boxSizing: "border-box" }} />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                    <div>
                      <label style={{ display: "block", color: "#94a3b8", fontSize: "12px", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Teléfono fijo</label>
                      <input value={cfgPhone} onChange={e => setCfgPhone(e.target.value)} style={{ ...darkStyles.input, width: "100%", boxSizing: "border-box" }} />
                    </div>
                    <div>
                      <label style={{ display: "block", color: "#94a3b8", fontSize: "12px", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Celular / WhatsApp</label>
                      <input value={cfgMobile} onChange={e => setCfgMobile(e.target.value)} style={{ ...darkStyles.input, width: "100%", boxSizing: "border-box" }} />
                    </div>
                  </div>
                  <div>
                    <label style={{ display: "block", color: "#94a3b8", fontSize: "12px", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Correo electrónico</label>
                    <input value={cfgEmail} onChange={e => setCfgEmail(e.target.value)} style={{ ...darkStyles.input, width: "100%", boxSizing: "border-box" }} />
                  </div>
                  <div>
                    <label style={{ display: "block", color: "#94a3b8", fontSize: "12px", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Dirección</label>
                    <input value={cfgAddress} onChange={e => setCfgAddress(e.target.value)} style={{ ...darkStyles.input, width: "100%", boxSizing: "border-box" }} />
                  </div>
                </div>
                <div style={{ marginTop: "20px", display: "flex", alignItems: "center", gap: "12px" }}>
                  <button onClick={saveInstitution} disabled={savingConfig} style={{ ...darkStyles.btnPrimary, opacity: savingConfig ? 0.6 : 1 }}>
                    {savingConfig ? "Guardando..." : "Guardar cambios"}
                  </button>
                  {configSaved === "institucion" && <span style={{ color: "#4ade80", fontSize: "13px" }}>✓ Guardado</span>}
                </div>
                <p style={{ marginTop: "12px", color: "#64748b", fontSize: "12px" }}>Estos datos se reflejan en la página pública de la institución.</p>
              </div>
            )}

            {/* Galería / Carrusel */}
            {configTab === "institucion" && (
              <div style={{ ...darkStyles.card, padding: "28px", marginTop: "16px" }}>
                <h3 style={{ fontSize: "17px", fontWeight: "700", color: "#fff", marginBottom: "4px" }}>Imágenes del Carrusel</h3>
                <p style={{ color: "#64748b", fontSize: "13px", marginBottom: "16px" }}>Fotos que aparecen en la galería de la página pública. Puedes subir un archivo o pegar una URL.</p>

                {/* Lista actual — drag & drop para reordenar */}
                {cfgGallery.length > 1 && (
                  <p style={{ color: "#475569", fontSize: "12px", marginBottom: "8px" }}>
                    Arrastra las filas para cambiar el orden del carrusel.
                  </p>
                )}
                <div style={{ display: "grid", gap: "8px", marginBottom: "16px" }}>
                  {cfgGallery.map((img, i) => (
                    <div
                      key={i}
                      draggable
                      onDragStart={() => setGalleryDragIdx(i)}
                      onDragOver={e => { e.preventDefault(); setGalleryDragOverIdx(i); }}
                      onDrop={e => {
                        e.preventDefault();
                        if (galleryDragIdx === null || galleryDragIdx === i) return;
                        const next = [...cfgGallery];
                        const [moved] = next.splice(galleryDragIdx, 1);
                        next.splice(i, 0, moved);
                        setCfgGallery(next);
                        setGalleryDragIdx(null);
                        setGalleryDragOverIdx(null);
                      }}
                      onDragEnd={() => { setGalleryDragIdx(null); setGalleryDragOverIdx(null); }}
                      style={{
                        display: "flex", gap: "10px", alignItems: "center",
                        background: galleryDragOverIdx === i && galleryDragIdx !== i
                          ? "rgba(59,130,246,0.15)"
                          : "rgba(30,41,59,0.5)",
                        border: galleryDragOverIdx === i && galleryDragIdx !== i
                          ? "1px dashed rgba(96,165,250,0.6)"
                          : "1px solid transparent",
                        borderRadius: "10px", padding: "8px 12px",
                        opacity: galleryDragIdx === i ? 0.4 : 1,
                        cursor: "grab", transition: "background 0.15s, border 0.15s, opacity 0.15s",
                      }}
                    >
                      {/* Handle */}
                      <svg width="14" height="20" viewBox="0 0 10 16" fill="#475569" style={{ flexShrink: 0, cursor: "grab" }}>
                        <circle cx="3" cy="3" r="1.5"/><circle cx="7" cy="3" r="1.5"/>
                        <circle cx="3" cy="8" r="1.5"/><circle cx="7" cy="8" r="1.5"/>
                        <circle cx="3" cy="13" r="1.5"/><circle cx="7" cy="13" r="1.5"/>
                      </svg>
                      {/* Número de posición */}
                      <span style={{ color: "#475569", fontSize: "11px", fontWeight: "600", width: "16px", textAlign: "center", flexShrink: 0 }}>{i + 1}</span>
                      <img src={img.src} alt={img.alt} style={{ width: "56px", height: "40px", objectFit: "cover", borderRadius: "6px", background: "#1e293b", flexShrink: 0 }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      <input
                        value={img.alt}
                        onChange={e => setCfgGallery(prev => prev.map((x,j) => j===i ? {...x,alt:e.target.value} : x))}
                        placeholder="Descripción de la imagen"
                        style={{ ...darkStyles.input, flex: 1, fontSize: "13px" }}
                        onMouseDown={e => e.stopPropagation()}
                      />
                      <span style={{ color: "#475569", fontSize: "11px", maxWidth: "140px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{img.src}</span>
                      <button onClick={() => setCfgGallery(prev => prev.filter((_,j) => j!==i))} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "16px", padding: "2px 6px", flexShrink: 0 }}>✕</button>
                    </div>
                  ))}
                  {cfgGallery.length === 0 && <p style={{ color: "#475569", fontSize: "13px" }}>No hay imágenes. Sube o añade una URL.</p>}
                </div>

                {/* Subir archivo */}
                <div style={{ marginBottom: "12px" }}>
                  <label style={{ display: "block", color: "#94a3b8", fontSize: "12px", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Subir imagen desde tu dispositivo</label>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "8px 16px", background: uploadingImage ? "rgba(14,116,144,0.4)" : "rgba(6,182,212,0.15)", border: "1px solid rgba(6,182,212,0.3)", borderRadius: "10px", cursor: uploadingImage ? "wait" : "pointer", color: "#22d3ee", fontSize: "13px", fontWeight: "600", transition: "all 0.2s" }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    {uploadingImage ? "Subiendo..." : "Seleccionar archivo"}
                    <input type="file" accept="image/*" style={{ display: "none" }} disabled={uploadingImage}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        setUploadingImage(true);
                        const ext = file.name.split(".").pop();
                        const path = `gallery/${Date.now()}.${ext}`;
                        const { error } = await supabase.storage.from("public-assets").upload(path, file, { upsert: true });
                        if (!error) {
                          const { data: urlData } = supabase.storage.from("public-assets").getPublicUrl(path);
                          setCfgGallery(prev => [...prev, { src: urlData.publicUrl, alt: file.name.replace(/\.[^.]+$/, "") }]);
                        } else {
                          const isBucketMissing = error.message.toLowerCase().includes("bucket") || error.message.toLowerCase().includes("not found");
                          void showMessage(
                            "No se pudo subir la imagen",
                            isBucketMissing
                              ? 'El bucket de almacenamiento no existe todavía.\n\nEjecuta el archivo sql/storage_setup.sql en el Editor SQL de Supabase y vuelve a intentarlo.'
                              : "Error: " + error.message,
                            "error"
                          );
                        }
                        setUploadingImage(false);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  <p style={{ color: "#475569", fontSize: "11px", marginTop: "6px" }}>Requiere bucket <code style={{ background: "rgba(255,255,255,0.06)", padding: "1px 5px", borderRadius: "4px" }}>public-assets</code> en Supabase Storage (público).</p>
                </div>

                {/* Añadir por URL */}
                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", color: "#94a3b8", fontSize: "12px", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>O añadir por URL</label>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <input value={newGalleryUrl} onChange={e => setNewGalleryUrl(e.target.value)} placeholder="https://... o /images/foto.jpg" style={{ ...darkStyles.input, flex: 2 }} />
                    <input value={newGalleryAlt} onChange={e => setNewGalleryAlt(e.target.value)} placeholder="Descripción" style={{ ...darkStyles.input, flex: 1 }} />
                    <button onClick={() => { if(newGalleryUrl.trim()) { setCfgGallery(prev => [...prev, {src:newGalleryUrl.trim(), alt:newGalleryAlt.trim()}]); setNewGalleryUrl(""); setNewGalleryAlt(""); }}} style={{ ...darkStyles.btnSecondary, whiteSpace: "nowrap" }}>+ Añadir</button>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <button onClick={saveGallery} disabled={savingConfig || uploadingImage} style={{ ...darkStyles.btnPrimary, opacity: (savingConfig || uploadingImage) ? 0.6 : 1 }}>
                    {savingConfig ? "Guardando..." : "Guardar galería"}
                  </button>
                  {configSaved === "gallery" && <span style={{ color: "#4ade80", fontSize: "13px" }}>✓ Guardado</span>}
                </div>
              </div>
            )}

            {/* Requisitos de Inscripción */}
            {configTab === "institucion" && (
              <div style={{ ...darkStyles.card, padding: "28px", marginTop: "16px" }}>
                <h3 style={{ fontSize: "17px", fontWeight: "700", color: "#fff", marginBottom: "4px" }}>Requisitos de Inscripción</h3>
                <p style={{ color: "#64748b", fontSize: "13px", marginBottom: "16px" }}>Lista que aparece en la sección "Requisitos" de la página pública.</p>
                <div style={{ display: "grid", gap: "8px", marginBottom: "12px" }}>
                  {cfgRequirements.map((req, i) => (
                    <div key={i} style={{ display: "flex", gap: "8px", alignItems: "center", background: "rgba(30,41,59,0.5)", borderRadius: "10px", padding: "8px 12px" }}>
                      <span style={{ color: "#94a3b8", fontSize: "13px", width: "20px", flexShrink: 0 }}>{i + 1}.</span>
                      <input value={req} onChange={e => setCfgRequirements(prev => prev.map((x,j) => j===i ? e.target.value : x))} style={{ ...darkStyles.input, flex: 1, fontSize: "13px" }} />
                      <button onClick={() => setCfgRequirements(prev => prev.filter((_,j) => j!==i))} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "16px", padding: "2px 6px", flexShrink: 0 }}>✕</button>
                    </div>
                  ))}
                  {cfgRequirements.length === 0 && <p style={{ color: "#475569", fontSize: "13px" }}>No hay requisitos. Añade uno abajo.</p>}
                </div>
                <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
                  <input value={newRequirement} onChange={e => setNewRequirement(e.target.value)} onKeyDown={e => { if(e.key==="Enter" && newRequirement.trim()) { setCfgRequirements(prev => [...prev, newRequirement.trim()]); setNewRequirement(""); }}} placeholder="Ej: Fotocopia de CI — Enter para añadir" style={{ ...darkStyles.input, flex: 1 }} />
                  <button onClick={() => { if(newRequirement.trim()) { setCfgRequirements(prev => [...prev, newRequirement.trim()]); setNewRequirement(""); }}} style={{ ...darkStyles.btnSecondary }}>+ Añadir</button>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <button onClick={saveRequirements} disabled={savingConfig} style={{ ...darkStyles.btnPrimary, opacity: savingConfig ? 0.6 : 1 }}>
                    {savingConfig ? "Guardando..." : "Guardar requisitos"}
                  </button>
                  {configSaved === "requirements" && <span style={{ color: "#4ade80", fontSize: "13px" }}>✓ Guardado</span>}
                </div>
              </div>
            )}

            {configTab === "anuncio" && (
              <div style={{ ...darkStyles.card, padding: "28px" }}>
                <h3 style={{ fontSize: "17px", fontWeight: "700", color: "#fff", marginBottom: "6px" }}>Anuncio Global</h3>
                <p style={{ color: "#64748b", fontSize: "13px", marginBottom: "20px" }}>Este mensaje aparece en el dashboard de todos los estudiantes cuando está activo.</p>
                <div style={{ display: "grid", gap: "16px" }}>
                  <div>
                    <label style={{ display: "block", color: "#94a3b8", fontSize: "12px", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Mensaje</label>
                    <textarea value={cfgAnnouncement} onChange={e => setCfgAnnouncement(e.target.value)} rows={4} placeholder="Escribe el mensaje para todos los estudiantes..." style={{ ...darkStyles.input, width: "100%", resize: "vertical", boxSizing: "border-box" }} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <button onClick={() => setCfgAnnouncementActive(v => !v)} style={{ width: "42px", height: "24px", borderRadius: "12px", background: cfgAnnouncementActive ? "#22c55e" : "#374151", border: "none", cursor: "pointer", position: "relative", transition: "background 0.2s" }}>
                      <span style={{ position: "absolute", top: "3px", left: cfgAnnouncementActive ? "21px" : "3px", width: "18px", height: "18px", borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
                    </button>
                    <span style={{ color: cfgAnnouncementActive ? "#4ade80" : "#94a3b8", fontSize: "13px" }}>{cfgAnnouncementActive ? "Anuncio activo (visible para estudiantes)" : "Anuncio desactivado"}</span>
                  </div>
                </div>
                <div style={{ marginTop: "20px", display: "flex", alignItems: "center", gap: "12px" }}>
                  <button onClick={saveAnnouncement} disabled={savingConfig} style={{ ...darkStyles.btnPrimary, opacity: savingConfig ? 0.6 : 1 }}>
                    {savingConfig ? "Guardando..." : "Guardar anuncio"}
                  </button>
                  {configSaved === "anuncio" && <span style={{ color: "#4ade80", fontSize: "13px" }}>✓ Guardado</span>}
                </div>
              </div>
            )}

            {configTab === "semestre" && (
              <div style={{ display: "grid", gap: "16px" }}>
                <div style={{ ...darkStyles.card, padding: "28px" }}>
                  <h3 style={{ fontSize: "17px", fontWeight: "700", color: "#fff", marginBottom: "6px" }}>Semestre Activo</h3>
                  <p style={{ color: "#64748b", fontSize: "13px", marginBottom: "20px" }}>Define el período académico actual. Los nuevos registros usarán este semestre automáticamente.</p>
                  <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                    <div>
                      <label style={{ display: "block", color: "#94a3b8", fontSize: "12px", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.05em" }}>Período (ej: 1/2026)</label>
                      <input value={cfgSemester} onChange={e => setCfgSemester(e.target.value)} placeholder="1/2026" style={{ ...darkStyles.input, width: "160px" }} />
                    </div>
                  </div>
                  <div style={{ marginTop: "16px", display: "flex", alignItems: "center", gap: "10px" }}>
                    <button onClick={() => setCfgBulkSemester(v => !v)} style={{ width: "42px", height: "24px", borderRadius: "12px", background: cfgBulkSemester ? "#f59e0b" : "#374151", border: "none", cursor: "pointer", position: "relative", transition: "background 0.2s" }}>
                      <span style={{ position: "absolute", top: "3px", left: cfgBulkSemester ? "21px" : "3px", width: "18px", height: "18px", borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
                    </button>
                    <span style={{ color: cfgBulkSemester ? "#fbbf24" : "#94a3b8", fontSize: "13px" }}>Actualizar semestre en todos los perfiles de usuario</span>
                  </div>
                  {cfgBulkSemester && (
                    <div style={{ marginTop: "10px", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: "10px", padding: "12px 16px", fontSize: "13px", color: "#fbbf24" }}>
                      ⚠ Esto actualizará el semestre activo en los perfiles de <strong>todos los usuarios</strong> de la plataforma.
                    </div>
                  )}
                  <div style={{ marginTop: "20px", display: "flex", alignItems: "center", gap: "12px" }}>
                    <button onClick={saveSemester} disabled={savingConfig} style={{ ...darkStyles.btnPrimary, opacity: savingConfig ? 0.6 : 1 }}>
                      {savingConfig ? "Guardando..." : "Guardar semestre"}
                    </button>
                    {configSaved === "semestre" && <span style={{ color: "#4ade80", fontSize: "13px" }}>✓ Guardado</span>}
                  </div>
                </div>

                <div style={{ ...darkStyles.card, padding: "24px" }}>
                  <h4 style={{ fontSize: "15px", fontWeight: "600", color: "#fff", marginBottom: "8px" }}>Gestión de Carreras y Niveles</h4>
                  <p style={{ color: "#64748b", fontSize: "13px", marginBottom: "16px" }}>Administra la estructura académica de la institución.</p>
                  <button onClick={() => setAdminSection("carreras")} style={{ ...darkStyles.btnSecondary, display: "flex", alignItems: "center", gap: "8px" }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3L1 9l11 6 9-4.91V17M5 13.18v4L12 21l7-3.82v-4"/></svg>
                    Ir a Gestión de Carreras →
                  </button>
                </div>
              </div>
            )}

            {configTab === "exportar" && (
              <div style={{ ...darkStyles.card, padding: "28px" }}>
                <h3 style={{ fontSize: "17px", fontWeight: "700", color: "#fff", marginBottom: "6px" }}>Exportación General</h3>
                <p style={{ color: "#64748b", fontSize: "13px", marginBottom: "24px" }}>Genera respaldos de los datos de la plataforma en formato PDF o CSV.</p>
                <div style={{ display: "grid", gap: "12px" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", background: "rgba(30,41,59,0.6)", borderRadius: "12px", border: "1px solid rgba(51,65,85,0.5)" }}>
                    <div>
                      <div style={{ color: "#e2e8f0", fontWeight: "600", fontSize: "14px" }}>Lista de Estudiantes</div>
                      <div style={{ color: "#64748b", fontSize: "12px", marginTop: "2px" }}>Todos los estudiantes con carrera, nivel y estado</div>
                    </div>
                    <button onClick={() => setAdminSection("estudiantes")} style={{ ...darkStyles.btnSecondary, fontSize: "12px", padding: "6px 14px" }}>Ir a Estudiantes →</button>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", background: "rgba(30,41,59,0.6)", borderRadius: "12px", border: "1px solid rgba(51,65,85,0.5)" }}>
                    <div>
                      <div style={{ color: "#e2e8f0", fontWeight: "600", fontSize: "14px" }}>Lista de Docentes</div>
                      <div style={{ color: "#64748b", fontSize: "12px", marginTop: "2px" }}>Registro de facilitadores y administrativos</div>
                    </div>
                    <button onClick={() => setAdminSection("docentes")} style={{ ...darkStyles.btnSecondary, fontSize: "12px", padding: "6px 14px" }}>Ir a Docentes →</button>
                  </div>
                  <div style={{ padding: "16px 20px", background: "rgba(30,41,59,0.4)", borderRadius: "12px", border: "1px dashed rgba(51,65,85,0.5)", opacity: 0.6 }}>
                    <div style={{ color: "#94a3b8", fontWeight: "600", fontSize: "14px" }}>Respaldo de Calificaciones (CSV)</div>
                    <div style={{ color: "#475569", fontSize: "12px", marginTop: "2px" }}>Exportación masiva de notas — próximamente</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

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

      {/* MODAL AVATAR ADMINISTRATIVO */}
      {showAdminAvatarModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, padding: "20px" }}>
          <div style={{ ...darkStyles.modal, padding: "28px", width: "100%", maxWidth: "480px" }}>
            <h3 style={{ fontSize: "18px", fontWeight: "700", color: "#f1f5f9", marginBottom: "6px" }}>Elegir avatar</h3>
            <p style={{ fontSize: "13px", color: "#64748b", marginBottom: "20px" }}>Selecciona un ícono para tu perfil.</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "10px", marginBottom: "24px" }}>
              {ADMIN_AVATARS.map(av => (
                <button
                  key={av.key}
                  onClick={() => setAdminSelectedAvatar(av.key)}
                  title={av.label}
                  style={{
                    background: adminSelectedAvatar === av.key ? "rgba(20,184,166,0.2)" : "rgba(30,41,59,0.6)",
                    border: adminSelectedAvatar === av.key ? "2px solid #14b8a6" : "2px solid rgba(51,65,85,0.4)",
                    borderRadius: "12px", padding: "10px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s",
                  }}
                >
                  <img src={av.url} alt={av.label} style={{ width: "36px", height: "36px", objectFit: "contain" }} />
                </button>
              ))}
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={saveAdminAvatar} disabled={savingAdminAvatar} style={{ ...darkStyles.btnSuccess, flex: 1 }}>
                {savingAdminAvatar ? "Guardando..." : "Guardar avatar"}
              </button>
              <button onClick={() => setShowAdminAvatarModal(false)} style={{ ...darkStyles.btnSecondary }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL CONFIRMACIÓN ELIMINAR */}
      {showConfirmDelete && (
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
          onClick={() => { if (!deleting) setShowConfirmDelete(false); }}
        >
          <div
            style={{ ...darkStyles.modal, width: "100%", maxWidth: "440px", padding: "32px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ textAlign: "center", marginBottom: "24px" }}>
              <div style={{
                width: "56px", height: "56px", borderRadius: "50%",
                background: "rgba(239,68,68,0.15)", border: "2px solid rgba(239,68,68,0.4)",
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 16px",
              }}>
                <span style={{ fontSize: "28px" }}>🗑️</span>
              </div>
              <h3 style={{ fontSize: "20px", fontWeight: "700", color: "#f1f5f9", margin: "0 0 10px" }}>
                ¿Eliminar participante?
              </h3>
              <p style={{ fontSize: "14px", color: "#94a3b8", lineHeight: "1.6", margin: 0 }}>
                Estás a punto de eliminar al participante{" "}
                <span style={{ color: "#f1f5f9", fontWeight: "600" }}>{pendingDeleteCode}</span>.
                Esta acción no se puede deshacer.
              </p>
            </div>
            <div style={{ display: "flex", gap: "12px" }}>
              <button
                onClick={() => setShowConfirmDelete(false)}
                disabled={deleting}
                style={{ ...darkStyles.btnSecondary, flex: 1 }}
              >
                Cancelar
              </button>
              <button
                onClick={confirmDeleteUser}
                disabled={deleting}
                style={{
                  ...darkStyles.btnPrimary,
                  flex: 1,
                  background: deleting ? "#6b7280" : "#ef4444",
                  borderColor: "#ef4444",
                }}
              >
                {deleting ? "Eliminando..." : "Sí, eliminar"}
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

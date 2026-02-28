// cea-plataforma/web/src/pages/TeacherDashboard.tsx
// 🎨 PARTE 1: Dashboard oscuro + Modales funcionando + Nueva estructura de tabla

import { useEffect, useState, useMemo } from "react";
import { Navigate, useNavigate, Link } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useRole } from "../lib/useRole";
import logoCea from "../assets/logo-cea.png";

type ProfileData = {
  id: string;
  code: string | null;
  full_name: string | null;
  first_names: string | null;
  last_name_pat: string | null;
  last_name_mat: string | null;
  phone: string | null;
  contact_email: string | null;
  likes: string | null;
  avatar_key: string | null;
  career_id: number | null;
  shift: string | null;
};

type Career = { id: number; name: string };
type Level = { id: number; name: string; sort_order: number };

type Student = {
  id: string;
  code: string | null;
  full_name: string | null;
  first_names: string | null;
  last_name_pat: string | null;
  last_name_mat: string | null;
  phone: string | null;
  contact_email: string | null;
  career_id: number | null;
  shift: string | null;
  level_id: number | null;
  level_name: string | null;
  level_sort_order: number | null;
  can_ascend: boolean;
  rudeal_number?: string | null;
  carnet_number?: string | null;
  gender?: string | null;
  birth_date?: string | null;
  is_active?: boolean;
  current_semester?: string | null;
};

type AvatarItem = { key: string; label: string; url: string };

const DV = "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons";
const SI = "https://cdn.simpleicons.org";
const TW = "https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/svg";

const AVATARS_SISTEMAS: AvatarItem[] = [
  { key: "av1", label: "HTML5", url: `${DV}/html5/html5-original.svg` },
  { key: "av2", label: "CSS3", url: `${DV}/css3/css3-original.svg` },
  {
    key: "av3",
    label: "Windows",
    url: `${DV}/windows11/windows11-original.svg`,
  },
  { key: "av4", label: "Linux Mint", url: `${SI}/linuxmint/87CF3E` },
  { key: "av5", label: "Python", url: `${DV}/python/python-original.svg` },
  {
    key: "av6",
    label: "JavaScript",
    url: `${DV}/javascript/javascript-original.svg`,
  },
  { key: "av7", label: "Git", url: `${DV}/git/git-original.svg` },
  { key: "av8", label: "VS Code", url: `${DV}/vscode/vscode-original.svg` },
  { key: "av9", label: "React", url: `${DV}/react/react-original.svg` },
  {
    key: "av10",
    label: "TypeScript",
    url: `${DV}/typescript/typescript-original.svg`,
  },
  { key: "av11", label: "Node.js", url: `${DV}/nodejs/nodejs-original.svg` },
  { key: "av12", label: "Linux", url: `${DV}/linux/linux-original.svg` },
  { key: "av13", label: "Docker", url: `${DV}/docker/docker-original.svg` },
  {
    key: "av14",
    label: "Arch Linux",
    url: `${DV}/archlinux/archlinux-original.svg`,
  },
  {
    key: "av15",
    label: "PostgreSQL",
    url: `${DV}/postgresql/postgresql-original.svg`,
  },
  { key: "av16", label: "Android", url: `${DV}/android/android-original.svg` },
  { key: "av17", label: "Arduino", url: `${DV}/arduino/arduino-original.svg` },
  { key: "av18", label: "Kali Linux", url: `${SI}/kalilinux/557C94` },
  { key: "av19", label: "Supabase", url: `${SI}/supabase/3FCF8E` },
  { key: "av20", label: "MySQL", url: `${DV}/mysql/mysql-original.svg` },
];

const AVATARS_GASTRONOMIA: AvatarItem[] = [
  { key: "av1", label: "Sartén", url: `${TW}/1f373.svg` },
  { key: "av2", label: "Ensalada", url: `${TW}/1f957.svg` },
  { key: "av3", label: "Bebida", url: `${TW}/1f9c3.svg` },
  { key: "av4", label: "Recetario", url: `${TW}/1f4d6.svg` },
  { key: "av5", label: "Pastelería", url: `${TW}/1f382.svg` },
  { key: "av6", label: "Internacional", url: `${TW}/1f30d.svg` },
  { key: "av7", label: "Decoración", url: `${TW}/1f3a8.svg` },
  { key: "av8", label: "Conservas", url: `${TW}/1f96b.svg` },
  { key: "av9", label: "Pizza", url: `${TW}/1f355.svg` },
  { key: "av10", label: "Marketing", url: `${TW}/1f4c8.svg` },
  { key: "av11", label: "Panadería", url: `${TW}/1f950.svg` },
  { key: "av12", label: "Alta Cocina", url: `${TW}/1f372.svg` },
  { key: "av13", label: "Nutrición", url: `${TW}/1f951.svg` },
  { key: "av14", label: "Costeo", url: `${TW}/1f4b0.svg` },
  { key: "av15", label: "Eventos", url: `${TW}/1f3aa.svg` },
  { key: "av16", label: "Servicio", url: `${TW}/1f377.svg` },
  { key: "av17", label: "Estrella", url: `${TW}/2b50.svg` },
  { key: "av18", label: "Trofeo", url: `${TW}/1f3c6.svg` },
  { key: "av19", label: "Fuego", url: `${TW}/1f525.svg` },
  { key: "av20", label: "Corona", url: `${TW}/1f451.svg` },
];

const AVATARS_CONTADURIA: AvatarItem[] = [
  { key: "av1", label: "Ábaco", url: `${TW}/1f9ee.svg` },
  { key: "av2", label: "Documentos", url: `${TW}/1f4cb.svg` },
  { key: "av3", label: "Números", url: `${TW}/1f522.svg` },
  { key: "av4", label: "Maletín", url: `${TW}/1f4bc.svg` },
  { key: "av5", label: "Gráfico", url: `${TW}/1f4ca.svg` },
  { key: "av6", label: "Banco", url: `${TW}/1f3e6.svg` },
  { key: "av7", label: "Equipo", url: `${TW}/1f465.svg` },
  { key: "av8", label: "Laptop", url: `${TW}/1f4bb.svg` },
  { key: "av9", label: "Tendencia", url: `${TW}/1f4c8.svg` },
  { key: "av10", label: "Auditoría", url: `${TW}/1f50d.svg` },
  { key: "av11", label: "Empresa", url: `${TW}/1f3e2.svg` },
  { key: "av12", label: "Idea", url: `${TW}/1f4a1.svg` },
  { key: "av13", label: "Informe", url: `${TW}/1f4d1.svg` },
  { key: "av14", label: "Gobierno", url: `${TW}/1f3db.svg` },
  { key: "av15", label: "Diamante", url: `${TW}/1f48e.svg` },
  { key: "av16", label: "Graduación", url: `${TW}/1f393.svg` },
  { key: "av17", label: "Medalla", url: `${TW}/1f3c5.svg` },
  { key: "av18", label: "Trofeo", url: `${TW}/1f3c6.svg` },
  { key: "av19", label: "Estrella", url: `${TW}/2b50.svg` },
  { key: "av20", label: "Corona", url: `${TW}/1f451.svg` },
];

const AVATARS_TEXTIL: AvatarItem[] = [
  { key: "av1", label: "Hilo", url: `${TW}/1f9f5.svg` },
  { key: "av2", label: "Aguja", url: `${TW}/1faa1.svg` },
  { key: "av3", label: "Vestido", url: `${TW}/1f457.svg` },
  { key: "av4", label: "Tijeras", url: `${TW}/2702.svg` },
  { key: "av5", label: "Blusa", url: `${TW}/1f45a.svg` },
  { key: "av6", label: "Fábrica", url: `${TW}/1f3ed.svg` },
  { key: "av7", label: "Regla", url: `${TW}/1f4d0.svg` },
  { key: "av8", label: "Tacón", url: `${TW}/1f460.svg` },
  { key: "av9", label: "Corbata", url: `${TW}/1f454.svg` },
  { key: "av10", label: "Pantalón", url: `${TW}/1f456.svg` },
  { key: "av11", label: "Reciclaje", url: `${TW}/267b.svg` },
  { key: "av12", label: "Paleta", url: `${TW}/1f3a8.svg` },
  { key: "av13", label: "Kimono", url: `${TW}/1f458.svg` },
  { key: "av14", label: "Abrigo", url: `${TW}/1f9e5.svg` },
  { key: "av15", label: "Engranaje", url: `${TW}/2699.svg` },
  { key: "av16", label: "Graduación", url: `${TW}/1f393.svg` },
  { key: "av17", label: "Diamante", url: `${TW}/1f48e.svg` },
  { key: "av18", label: "Trofeo", url: `${TW}/1f3c6.svg` },
  { key: "av19", label: "Estrella", url: `${TW}/2b50.svg` },
  { key: "av20", label: "Corona", url: `${TW}/1f451.svg` },
];

function getAvatarsForCareer(name: string): AvatarItem[] {
  const n = name.toLowerCase();
  if (n.includes("gastronom")) return AVATARS_GASTRONOMIA;
  if (n.includes("contad")) return AVATARS_CONTADURIA;
  if (n.includes("textil")) return AVATARS_TEXTIL;
  return AVATARS_SISTEMAS;
}

export default function TeacherDashboard() {
  const nav = useNavigate();
  const { loading, session, role } = useRole();

  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [careerName, setCareerName] = useState("");
  const [levels, setLevels] = useState<Level[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [filteredStudents, setFilteredStudents] = useState<Student[]>([]);
  const [selectedLevelFilter, setSelectedLevelFilter] = useState<number | null>(
    null,
  );
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  const [msg, setMsg] = useState<string | null>(null);
  const [loadingStudents, setLoadingStudents] = useState(false);

  const [editMode, setEditMode] = useState(false);
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editLikes, setEditLikes] = useState("");
  const [saving, setSaving] = useState(false);

  const [showAvatarModal, setShowAvatarModal] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState("av1");

  const [showAddStudent, setShowAddStudent] = useState(false);
  const [addFirstNames, setAddFirstNames] = useState("");
  const [addLastNamePat, setAddLastNamePat] = useState("");
  const [addLastNameMat, setAddLastNameMat] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addPassword, setAddPassword] = useState("");
  const [addLevelId, setAddLevelId] = useState<number | null>(null);
  const [addRudealNumber, setAddRudealNumber] = useState("");
  const [addCarnetNumber, setAddCarnetNumber] = useState("");
  const [addGender, setAddGender] = useState<"F" | "M" | "">("");
  const [addBirthDate, setAddBirthDate] = useState("");
  const [addingStudent, setAddingStudent] = useState(false);

  const [showEditStudent, setShowEditStudent] = useState(false);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [editStudentFirstNames, setEditStudentFirstNames] = useState("");
  const [editStudentLastNamePat, setEditStudentLastNamePat] = useState("");
  const [editStudentLastNameMat, setEditStudentLastNameMat] = useState("");
  const [editStudentPhone, setEditStudentPhone] = useState("");
  const [editStudentEmail, setEditStudentEmail] = useState("");
  const [editStudentLevelId, setEditStudentLevelId] = useState<number | null>(
    null,
  );
  const [editStudentRudealNumber, setEditStudentRudealNumber] = useState("");
  const [editStudentCarnetNumber, setEditStudentCarnetNumber] = useState("");
  const [editStudentGender, setEditStudentGender] = useState<"F" | "M" | "">(
    "",
  );
  const [editStudentBirthDate, setEditStudentBirthDate] = useState("");
  const [editingStudentData, setEditingStudentData] = useState(false);

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

  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetPasswordStudentId, setResetPasswordStudentId] = useState<
    string | null
  >(null);
  const [resetPasswordStudentName, setResetPasswordStudentName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resettingPassword, setResettingPassword] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  // Estado para mostrar estudiantes inactivos
  const [showInactiveStudents, setShowInactiveStudents] = useState(false);
  const [togglingActive, setTogglingActive] = useState(false);

  // Estado para estadísticas de asistencia
  const [attendanceStats, setAttendanceStats] = useState<Map<string, { total: number; faltas: number }>>(new Map());

  // Estado para sistema de semestres
  function computeCurrentSemester(): string {
    const now = new Date();
    const s = now.getMonth() < 6 ? 1 : 2;
    return `${s}/${now.getFullYear()}`;
  }
  const [viewSemester, setViewSemester] = useState<string>(computeCurrentSemester);
  const [showSemesterModal, setShowSemesterModal] = useState(false);
  const [semesterInput, setSemesterInput] = useState("");
  const [editStudentSemester, setEditStudentSemester] = useState("");

  // Estado para modal de avatares especiales
  const [showAvatarUnlockModal, setShowAvatarUnlockModal] = useState(false);
  const [avatarUnlockStudentId, setAvatarUnlockStudentId] = useState<
    string | null
  >(null);
  const [avatarUnlockStudentName, setAvatarUnlockStudentName] = useState("");
  const [avatarUnlockKeys, setAvatarUnlockKeys] = useState<Set<string>>(
    new Set(),
  );
  const [avatarUnlockLoading, setAvatarUnlockLoading] = useState(false);
  const [avatarUnlockSaving, setAvatarUnlockSaving] = useState(false);

  const isTeacherish = role === "teacher" || role === "admin";

  // Helper: calcular edad
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

  // Helper: mostrar mensaje en modal
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

  useEffect(() => {
    if (!session || !isTeacherish || initialLoadDone) return;

    async function load() {
      setMsg(null);

      const { data: prof, error: profErr } = await supabase
        .from("profiles")
        .select(
          "id,code,full_name,first_names,last_name_pat,last_name_mat,phone,contact_email,likes,avatar_key,career_id,shift",
        )
        .eq("id", session!.user.id)
        .single();

      if (profErr) {
        setMsg("Error cargando perfil: " + profErr.message);
        return;
      }

      setProfileData(prof as ProfileData);
      setEditPhone(prof.phone ?? "");
      setEditEmail(prof.contact_email ?? "");
      setEditLikes(prof.likes ?? "");
      setSelectedAvatar(prof.avatar_key ?? "av1");

      if (prof.career_id) {
        const { data: careerData } = await supabase
          .from("careers")
          .select("id,name")
          .eq("id", prof.career_id)
          .single();

        if (careerData) {
          setCareerName((careerData as Career).name);
        }

        const { data: levelsData } = await supabase
          .from("levels")
          .select("id,name,sort_order")
          .eq("career_id", prof.career_id)
          .order("sort_order");

        const loadedLevels = (levelsData as Level[]) ?? [];
        setLevels(loadedLevels);
        await loadStudents(prof.career_id, prof.shift, loadedLevels, computeCurrentSemester());
      }

      setInitialLoadDone(true);
    }

    load();
  }, [session, isTeacherish, initialLoadDone]);

  async function loadStudents(
    careerId: number | null,
    shift: string | null,
    levelsList: Level[],
    semesterFilter?: string,
  ) {
    if (!careerId || !shift) return;

    setLoadingStudents(true);

    let query = supabase
      .from("profiles")
      .select(
        "id,code,full_name,first_names,last_name_pat,last_name_mat,phone,contact_email,career_id,shift,rudeal_number,carnet_number,gender,birth_date,is_active,current_semester",
      )
      .eq("role", "student")
      .eq("career_id", careerId)
      .eq("shift", shift);

    if (semesterFilter) {
      query = query.eq("current_semester", semesterFilter);
    }

    const { data: studentsData, error: studentsError } = await query.order("code");

    if (studentsError) {
      setMsg("Error cargando estudiantes: " + studentsError.message);
      setLoadingStudents(false);
      return;
    }

    const studentsList = (studentsData ?? []) as Student[];
    const studentIds = studentsList.map((s) => s.id);

    if (studentIds.length === 0) {
      setStudents([]);
      setFilteredStudents([]);
      setLoadingStudents(false);
      return;
    }

    const { data: enrollments, error: enrollError } = await supabase
      .from("enrollments")
      .select("student_id,level_id")
      .in("student_id", studentIds);

    if (enrollError) {
      // Error silencioso - no crítico
    }

    const enrollmentMap = new Map<string, number>();
    for (const e of enrollments ?? []) {
      enrollmentMap.set(e.student_id, e.level_id);
    }

    const levelMap = new Map<number, { name: string; sort_order: number }>();
    for (const l of levelsList) {
      levelMap.set(l.id, { name: l.name, sort_order: l.sort_order });
    }

    const studentsWithLevel: Student[] = [];

    for (const s of studentsList) {
      const levelId = enrollmentMap.get(s.id) ?? null;
      const levelInfo = levelId ? levelMap.get(levelId) : null;

      // Verificar si puede ascender: debe completar TODOS los 5 módulos del nivel
      let canAscend = false;
      if (levelId && levelInfo && levelInfo.sort_order < 4) {
        const { data: modulesInLevel } = await supabase
          .from("modules")
          .select("id")
          .eq("level_id", levelId);

        const moduleIds = (modulesInLevel ?? []).map((m: any) => m.id);

        if (moduleIds.length > 0) {
          const { data: grades } = await supabase
            .from("module_grades")
            .select(
              "module_id,ser,saber,hacer_proceso,hacer_producto,decidir,auto_ser,auto_decidir",
            )
            .eq("student_id", s.id)
            .in("module_id", moduleIds);

          // Verificar que tenga TODAS las notas completadas Y aprobadas (>= 51)
          const completedAndPassedModules = (grades ?? []).filter((g: any) => {
            const allFieldsFilled =
              g.ser !== null &&
              g.saber !== null &&
              g.hacer_proceso !== null &&
              g.hacer_producto !== null &&
              g.decidir !== null &&
              g.auto_ser !== null &&
              g.auto_decidir !== null;

            if (!allFieldsFilled) return false;

            const total =
              (g.ser || 0) +
              (g.saber || 0) +
              (g.hacer_proceso || 0) +
              (g.hacer_producto || 0) +
              (g.decidir || 0) +
              (g.auto_ser || 0) +
              (g.auto_decidir || 0);

            return total >= 51;
          }).length;

          // Solo puede ascender si completó Y aprobó TODOS los módulos (normalmente 5)
          canAscend = completedAndPassedModules >= moduleIds.length;
        }
      }

      studentsWithLevel.push({
        ...s,
        level_id: levelId,
        level_name: levelInfo?.name ?? null,
        level_sort_order: levelInfo?.sort_order ?? null,
        can_ascend: canAscend,
        is_active: s.is_active !== false, // Por defecto activo si es null/undefined
      });
    }

    setStudents(studentsWithLevel);
    setFilteredStudents(studentsWithLevel);
    setLoadingStudents(false);

    // Cargar estadísticas de asistencia del semestre
    await loadAttendanceStats(studentsWithLevel.map((s) => s.id), semesterFilter ?? computeCurrentSemester());
  }

  async function loadAttendanceStats(studentIds: string[], semester: string) {
    if (studentIds.length === 0) { setAttendanceStats(new Map()); return; }
    const [semNum, semYear] = semester.split("/");
    const year = parseInt(semYear ?? "2026");
    const s = parseInt(semNum ?? "1");
    const startDate = s === 1 ? `${year}-01-01` : `${year}-07-01`;
    const endDate   = s === 1 ? `${year}-06-30` : `${year}-12-31`;

    const { data } = await supabase
      .from("attendance")
      .select("student_id,status")
      .in("student_id", studentIds)
      .gte("date", startDate)
      .lte("date", endDate);

    const map = new Map<string, { total: number; faltas: number }>();
    for (const row of data ?? []) {
      const prev = map.get(row.student_id) ?? { total: 0, faltas: 0 };
      map.set(row.student_id, {
        total: prev.total + 1,
        faltas: prev.faltas + (row.status === "F" ? 1 : 0),
      });
    }
    setAttendanceStats(map);
  }

  // Recargar estudiantes cuando cambia el semestre visualizado
  useEffect(() => {
    if (!initialLoadDone || !profileData?.career_id || !profileData?.shift) return;
    loadStudents(profileData.career_id, profileData.shift, levels, viewSemester);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewSemester, initialLoadDone]);

  // Aplicar filtros y ordenamiento
  useEffect(() => {
    let filtered = students;

    // Filtro por activos/inactivos
    if (showInactiveStudents) {
      filtered = filtered.filter((s) => s.is_active === false);
    } else {
      filtered = filtered.filter((s) => s.is_active !== false);
    }

    // Filtro por nivel
    if (selectedLevelFilter !== null) {
      filtered = filtered.filter((s) => s.level_id === selectedLevelFilter);
    }

    // Ordenamiento alfabético por apellido paterno
    const sorted = [...filtered].sort((a, b) => {
      const aLastName = (a.last_name_pat || "").toLowerCase();
      const bLastName = (b.last_name_pat || "").toLowerCase();

      if (sortOrder === "asc") {
        return aLastName.localeCompare(bLastName);
      } else {
        return bLastName.localeCompare(aLastName);
      }
    });

    setFilteredStudents(sorted);
  }, [selectedLevelFilter, sortOrder, students, showInactiveStudents]);

  async function saveProfile() {
    if (!session) return;
    setSaving(true);
    setMsg(null);

    const upd = await supabase
      .from("profiles")
      .update({
        phone: editPhone.trim() || null,
        contact_email: editEmail.trim() || null,
        likes: editLikes.trim() || null,
      })
      .eq("id", session.user.id);

    setSaving(false);

    if (upd.error) {
      setMsg("Error: " + upd.error.message);
      return;
    }

    setMsg("✅ Perfil actualizado");
    setEditMode(false);

    const { data: prof } = await supabase
      .from("profiles")
      .select(
        "id,code,full_name,first_names,last_name_pat,last_name_mat,phone,contact_email,likes,avatar_key,career_id,shift",
      )
      .eq("id", session.user.id)
      .single();

    if (prof) setProfileData(prof as ProfileData);
  }

  async function saveAvatar() {
    if (!session) return;

    const upd = await supabase
      .from("profiles")
      .update({ avatar_key: selectedAvatar })
      .eq("id", session.user.id);

    if (upd.error) {
      setMsg("Error: " + upd.error.message);
      return;
    }

    setMsg("✅ Avatar actualizado");
    setShowAvatarModal(false);

    const { data: prof } = await supabase
      .from("profiles")
      .select("avatar_key")
      .eq("id", session.user.id)
      .single();

    if (prof && profileData) {
      setProfileData({ ...profileData, avatar_key: prof.avatar_key });
    }
  }

  async function handleAddStudent() {
    if (!profileData?.career_id || !profileData?.shift || !addLevelId) {
      setMsg("Error: Selecciona un nivel");
      return;
    }

    if (!addFirstNames.trim() || !addPhone.trim() || !addPassword.trim()) {
      setMsg("Error: Nombres, celular y contraseña son obligatorios");
      return;
    }

    if (!addLastNamePat.trim() && !addLastNameMat.trim()) {
      setMsg("Error: Debes llenar al menos un apellido");
      return;
    }

    // Validar campos obligatorios de estudiante
    if (!addCarnetNumber.trim()) {
      setMsg("Error: El N° de Carnet es obligatorio");
      return;
    }
    if (!addGender) {
      setMsg("Error: El Género es obligatorio");
      return;
    }
    if (!addBirthDate) {
      setMsg("Error: La Fecha de Nacimiento es obligatoria");
      return;
    }

    // Validar edad
    const age = calculateAge(addBirthDate);
    if (age < 14) {
      await showMessage(
        "❌ Edad no permitida",
        `El estudiante tiene ${age} años. No se pueden registrar participantes menores de 14 años.`,
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

    setAddingStudent(true);
    setMsg(null);

    try {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();
      if (!currentSession) {
        setMsg("Error: Sesión no válida");
        setAddingStudent(false);
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-user`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${currentSession.access_token}`,
          },
          body: JSON.stringify({
            role: "student",
            temp_password: addPassword,
            first_names: addFirstNames,
            last_name_pat: addLastNamePat || undefined,
            last_name_mat: addLastNameMat || undefined,
            phone: addPhone,
            contact_email: addEmail || undefined,
            career_id: profileData.career_id,
            shift: profileData.shift,
            level_id: addLevelId,
            rudeal_number: addRudealNumber.trim() || undefined,
            carnet_number: addCarnetNumber.trim(),
            gender: addGender,
            birth_date: addBirthDate,
          }),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        setMsg(
          `Error creando estudiante: ${result.error || "Error desconocido"}`,
        );
        setAddingStudent(false);
        return;
      }

      await showMessage(
        "✅ Estudiante creado exitosamente",
        `Código: ${result.code}\nContraseña temporal: ${result.temp_password}`,
        "success",
      );
      setShowAddStudent(false);

      // Reset form
      setAddFirstNames("");
      setAddLastNamePat("");
      setAddLastNameMat("");
      setAddPhone("");
      setAddEmail("");
      setAddPassword("");
      setAddLevelId(null);
      setAddRudealNumber("");
      setAddCarnetNumber("");
      setAddGender("");
      setAddBirthDate("");
      setAddingStudent(false);

      await loadStudents(profileData.career_id, profileData.shift, levels);
    } catch (error) {
      setMsg(`Error: ${error}`);
      setAddingStudent(false);
    }
  }

  function openEditStudent(student: Student) {
    setEditingStudentId(student.id);
    setEditStudentFirstNames(student.first_names ?? "");
    setEditStudentLastNamePat(student.last_name_pat ?? "");
    setEditStudentLastNameMat(student.last_name_mat ?? "");
    setEditStudentPhone(student.phone ?? "");
    setEditStudentEmail(student.contact_email ?? "");
    setEditStudentLevelId(student.level_id);
    setEditStudentRudealNumber(student.rudeal_number ?? "");
    setEditStudentCarnetNumber(student.carnet_number ?? "");
    setEditStudentGender((student.gender as "F" | "M") ?? "");
    setEditStudentBirthDate(student.birth_date ?? "");
    setEditStudentSemester(student.current_semester ?? "");
    setShowEditStudent(true);
  }

  async function handleEditStudent() {
    if (!editingStudentId) return;

    if (!editStudentFirstNames.trim()) {
      setMsg("Error: Nombres son obligatorios");
      return;
    }

    if (!editStudentLastNamePat.trim() && !editStudentLastNameMat.trim()) {
      setMsg("Error: Debes llenar al menos un apellido");
      return;
    }

    if (!profileData?.career_id || !profileData?.shift) {
      setMsg("Error: No se pudo obtener datos del docente");
      return;
    }

    // Validar campos obligatorios de estudiante
    if (!editStudentCarnetNumber.trim()) {
      setMsg("Error: El N° de Carnet es obligatorio");
      return;
    }
    if (!editStudentGender) {
      setMsg("Error: El Género es obligatorio");
      return;
    }
    if (!editStudentBirthDate) {
      setMsg("Error: La Fecha de Nacimiento es obligatoria");
      return;
    }

    // Validar edad
    const age = calculateAge(editStudentBirthDate);
    if (age < 14) {
      await showMessage(
        "❌ Edad no permitida",
        `El estudiante tiene ${age} años. No se pueden registrar participantes menores de 14 años.`,
        "error",
      );
      return;
    }
    if (age === 14) {
      await showMessage(
        "⚠️ Advertencia",
        `El estudiante tiene ${age} años (menor de 15). El registro se actualizará normalmente.`,
        "warning",
      );
    }

    setEditingStudentData(true);
    setMsg(null);

    try {
      // Construir el full_name
      const lastNamePat = editStudentLastNamePat.trim();
      const lastNameMat = editStudentLastNameMat.trim();
      const firstNames = editStudentFirstNames.trim();

      let fullName = "";
      if (lastNamePat && lastNameMat) {
        fullName = `${lastNamePat} ${lastNameMat}, ${firstNames}`;
      } else if (lastNamePat) {
        fullName = `${lastNamePat}, ${firstNames}`;
      } else if (lastNameMat) {
        fullName = `${lastNameMat}, ${firstNames}`;
      } else {
        fullName = firstNames;
      }

      const dataToUpdate = {
        first_names: firstNames,
        last_name_pat: lastNamePat || null,
        last_name_mat: lastNameMat || null,
        full_name: fullName,
        phone: editStudentPhone.trim() || null,
        contact_email: editStudentEmail.trim() || null,
        rudeal_number: editStudentRudealNumber.trim() || null,
        carnet_number: editStudentCarnetNumber.trim() || null,
        gender: editStudentGender || null,
        birth_date: editStudentBirthDate || null,
        current_semester: editStudentSemester.trim() || null,
      };

      // Actualizar datos del estudiante
      const { data: updateData, error: updateError } = await supabase
        .from("profiles")
        .update(dataToUpdate)
        .eq("id", editingStudentId)
        .select();

      if (updateError) {
        setMsg(`Error actualizando: ${updateError.message}`);
        setEditingStudentData(false);
        return;
      }

      if (!updateData || updateData.length === 0) {
        setMsg(
          "⚠️ No se pudo actualizar. Verifica los permisos en la base de datos.",
        );
        setEditingStudentData(false);
        return;
      }

      // Actualizar nivel si cambió
      if (editStudentLevelId) {
        const { error: enrollError } = await supabase
          .from("enrollments")
          .update({ level_id: editStudentLevelId })
          .eq("student_id", editingStudentId)
          .select();

        if (enrollError) {
          setMsg(`Error actualizando nivel: ${enrollError.message}`);
          setEditingStudentData(false);
          return;
        }
      }

      setShowEditStudent(false);
      setEditingStudentData(false);
      await showMessage(
        "✅ Estudiante actualizado",
        "Los datos del estudiante han sido actualizados correctamente.",
        "success",
      );

      // Recargar la lista de estudiantes
      await loadStudents(profileData.career_id, profileData.shift, levels);
    } catch (error) {
      setMsg(`Error: ${error}`);
      setEditingStudentData(false);
    }
  }

  function openResetPassword(studentId: string, studentName: string) {
    setResetPasswordStudentId(studentId);
    setResetPasswordStudentName(studentName);
    setNewPassword("");
    setShowResetPassword(true);
  }

  async function handleResetPassword() {
    if (!resetPasswordStudentId || !newPassword.trim()) {
      setMsg("Error: Ingresa una nueva contraseña");
      return;
    }

    setResettingPassword(true);
    setMsg(null);

    try {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();
      if (!currentSession) {
        setMsg("Error: Sesión no válida");
        setResettingPassword(false);
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reset-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${currentSession.access_token}`,
          },
          body: JSON.stringify({
            user_id: resetPasswordStudentId,
            new_password: newPassword,
          }),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        setMsg(`Error: ${result.error || "Error desconocido"}`);
        setResettingPassword(false);
        return;
      }

      setMsg("✅ Contraseña actualizada");
      setShowResetPassword(false);
      setResettingPassword(false);
    } catch (error) {
      setMsg(`Error: ${error}`);
      setResettingPassword(false);
    }
  }

  async function handleDeleteStudent(studentId: string, studentCode: string) {
    if (
      !confirm(`¿Eliminar a ${studentCode}? Esta acción no se puede deshacer.`)
    ) {
      return;
    }

    if (!profileData?.career_id || !profileData?.shift) {
      setMsg("Error: No se pudo obtener datos del docente");
      return;
    }

    try {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();
      if (!currentSession) {
        setMsg("Error: Sesión no válida");
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${currentSession.access_token}`,
          },
          body: JSON.stringify({
            user_id: studentId,
          }),
        },
      );

      const result = await response.json();

      if (!response.ok) {
        setMsg(`Error: ${result.error || "Error desconocido"}`);
        return;
      }

      await loadStudents(profileData.career_id, profileData.shift, levels);
      await showMessage(
        "✅ Estudiante eliminado",
        `El estudiante ${studentCode} ha sido eliminado correctamente.`,
        "success",
      );
    } catch (error) {
      setMsg(`Error: ${error}`);
    }
  }

  async function handleToggleActive(
    studentId: string,
    studentName: string,
    currentlyActive: boolean,
  ) {
    const action = currentlyActive ? "desactivar" : "activar";
    const newStatus = !currentlyActive;

    if (
      !confirm(
        `¿Estás seguro de ${action} a ${studentName}?\n\n${
          currentlyActive
            ? "El estudiante no podrá acceder al sistema."
            : "El estudiante podrá acceder nuevamente al sistema."
        }`,
      )
    ) {
      return;
    }

    if (!profileData?.career_id || !profileData?.shift) {
      setMsg("Error: No se pudo obtener datos del docente");
      return;
    }

    setTogglingActive(true);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ is_active: newStatus })
        .eq("id", studentId);

      if (error) {
        setMsg(`Error: ${error.message}`);
        setTogglingActive(false);
        return;
      }

      await loadStudents(profileData.career_id, profileData.shift, levels);
      await showMessage(
        newStatus ? "✅ Estudiante activado" : "✅ Estudiante desactivado",
        newStatus
          ? `${studentName} ha sido activado y puede acceder al sistema.`
          : `${studentName} ha sido desactivado y no podrá acceder al sistema.`,
        "success",
      );
      setTogglingActive(false);
    } catch (error) {
      setMsg(`Error: ${error}`);
      setTogglingActive(false);
    }
  }

  async function handleAscend(
    studentId: string,
    currentLevelSortOrder: number | null,
  ) {
    if (currentLevelSortOrder === null) {
      setMsg("Error: El estudiante no tiene nivel asignado");
      return;
    }

    if (currentLevelSortOrder >= 4) {
      setMsg("El estudiante ya está en el nivel máximo (Técnico Medio 2)");
      return;
    }

    const nextLevelSortOrder = currentLevelSortOrder + 1;
    const nextLevel = levels.find((l) => l.sort_order === nextLevelSortOrder);

    if (!nextLevel) {
      setMsg("Error: No se encontró el siguiente nivel");
      return;
    }

    if (!confirm(`¿Ascender al estudiante a ${nextLevel.name}?`)) {
      return;
    }

    if (!profileData?.career_id || !profileData?.shift) {
      setMsg("Error: No se pudo obtener datos del docente");
      return;
    }

    try {
      const { error } = await supabase
        .from("enrollments")
        .update({ level_id: nextLevel.id })
        .eq("student_id", studentId);

      if (error) {
        setMsg(`Error: ${error.message}`);
        return;
      }

      setMsg("✅ Estudiante ascendido exitosamente");
      await loadStudents(profileData.career_id, profileData.shift, levels);
    } catch (error) {
      setMsg(`Error: ${error}`);
    }
  }

  // Función para generar nombre VCF normalizado (sin tildes, espacios como _)
  function normalizeForVCF(text: string): string {
    return text
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Quitar tildes
      .replace(/\s+/g, "_") // Espacios a guiones bajos
      .replace(/[^a-zA-Z0-9_]/g, ""); // Solo letras, números y _
  }

  // Función para abreviar el nombre del nivel
  function abbreviateLevel(levelName: string): string {
    // Mapeo de niveles conocidos
    const abbreviations: { [key: string]: string } = {
      "Técnico Básico 1": "TecBas1",
      "Técnico Básico 2": "TecBas2",
      "Técnico Auxiliar 1": "TecAux1",
      "Técnico Auxiliar 2": "TecAux2",
      "Técnico Medio 1": "TecMed1",
      "Técnico Medio 2": "TecMed2",
    };

    if (abbreviations[levelName]) {
      return abbreviations[levelName];
    }

    // Si no está en el mapeo, crear abreviatura automática
    return normalizeForVCF(levelName).substring(0, 10);
  }

  // Función para exportar contactos a VCF
  function exportContactsToVCF() {
    if (filteredStudents.length === 0) {
      showMessage(
        "Sin contactos",
        "No hay estudiantes para exportar con los filtros actuales.",
        "warning",
      );
      return;
    }

    // Agrupar estudiantes por nivel para mantener numeración separada
    const studentsByLevel = new Map<string, Student[]>();

    for (const student of filteredStudents) {
      const levelKey = student.level_name ?? "SinNivel";
      if (!studentsByLevel.has(levelKey)) {
        studentsByLevel.set(levelKey, []);
      }
      studentsByLevel.get(levelKey)!.push(student);
    }

    // Generar VCF
    let vcfContent = "";

    for (const [levelName, students] of studentsByLevel) {
      const levelPrefix = abbreviateLevel(levelName);

      // Ordenar estudiantes por apellido dentro del nivel
      const sortedStudents = [...students].sort((a, b) => {
        const aName = (a.last_name_pat || "").toLowerCase();
        const bName = (b.last_name_pat || "").toLowerCase();
        return aName.localeCompare(bName);
      });

      sortedStudents.forEach((student, index) => {
        const number = String(index + 1).padStart(2, "0");
        const apPaterno = normalizeForVCF(student.last_name_pat || "");
        const apMaterno = normalizeForVCF(student.last_name_mat || "");
        const nombres = normalizeForVCF(student.first_names || "");
        const codSis = student.code || "";

        // Construir nombre del contacto
        const contactName = `${levelPrefix}_${number}_${apPaterno}_${apMaterno}_${nombres}_${codSis}`;

        // Formatear número de teléfono (agregar +591 si no tiene código de país)
        let phone = (student.phone || "").replace(/\D/g, ""); // Solo dígitos
        if (phone && !phone.startsWith("591")) {
          phone = "591" + phone;
        }
        phone = "+" + phone;

        vcfContent += `BEGIN:VCARD\r\n`;
        vcfContent += `VERSION:2.1\r\n`;
        vcfContent += `N:${contactName};;;;\r\n`;
        vcfContent += `FN:${contactName}\r\n`;
        vcfContent += `TEL;CELL:${phone}\r\n`;
        vcfContent += `END:VCARD\r\n`;
      });
    }

    // Crear y descargar archivo
    const blob = new Blob([vcfContent], { type: "text/vcard;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    // Nombre del archivo con fecha y nivel si está filtrado
    const date = new Date().toISOString().split("T")[0];
    const levelSuffix = selectedLevelFilter
      ? "_" +
        abbreviateLevel(
          levels.find((l) => l.id === selectedLevelFilter)?.name ?? "",
        )
      : "";
    link.href = url;
    link.download = `contactos${levelSuffix}_${date}.vcf`;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showMessage(
      "✅ Contactos exportados",
      `Se han exportado ${filteredStudents.length} contactos en formato VCF.`,
      "success",
    );
  }

  async function openAvatarUnlockModal(studentId: string, studentName: string) {
    setAvatarUnlockStudentId(studentId);
    setAvatarUnlockStudentName(studentName);
    setShowAvatarUnlockModal(true);
    setAvatarUnlockLoading(true);

    const { data, error } = await supabase
      .from("student_avatar_unlocks")
      .select("avatar_key")
      .eq("student_id", studentId);

    setAvatarUnlockLoading(false);

    if (error) {
      setMsg("Error cargando avatares: " + error.message);
      return;
    }

    setAvatarUnlockKeys(
      new Set((data ?? []).map((u: { avatar_key: string }) => u.avatar_key)),
    );
  }

  async function toggleAvatarUnlock(avatarKey: string) {
    if (!avatarUnlockStudentId || !session) return;

    setAvatarUnlockSaving(true);
    const isCurrentlyUnlocked = avatarUnlockKeys.has(avatarKey);

    if (isCurrentlyUnlocked) {
      const { error } = await supabase
        .from("student_avatar_unlocks")
        .delete()
        .eq("student_id", avatarUnlockStudentId)
        .eq("avatar_key", avatarKey);

      if (error) {
        setMsg("Error bloqueando avatar: " + error.message);
      } else {
        setAvatarUnlockKeys((prev) => {
          const next = new Set(prev);
          next.delete(avatarKey);
          return next;
        });
      }
    } else {
      const { error } = await supabase.from("student_avatar_unlocks").insert({
        student_id: avatarUnlockStudentId,
        avatar_key: avatarKey,
        unlocked_by: session.user.id,
      });

      if (error) {
        setMsg("Error desbloqueando avatar: " + error.message);
      } else {
        setAvatarUnlockKeys((prev) => new Set(prev).add(avatarKey));
      }
    }

    setAvatarUnlockSaving(false);
  }

  async function logout() {
    await supabase.auth.signOut({ scope: "local" });
    nav("/login", { replace: true });
  }

  // Estadísticas de estudiantes por nivel (solo activos)
  const levelStats = useMemo(() => {
    const activeStudents = students.filter((s) => s.is_active !== false);
    const stats = levels.map((level) => {
      const count = activeStudents.filter(
        (s) => s.level_id === level.id,
      ).length;
      return {
        id: level.id,
        name: level.name,
        shortName: level.name.replace("Técnico ", "").replace(" ", ""),
        count,
        sortOrder: level.sort_order,
      };
    });
    return stats.sort((a, b) => a.sortOrder - b.sortOrder);
  }, [students, levels]);

  const totalActiveStudents = useMemo(() => {
    return students.filter((s) => s.is_active !== false).length;
  }, [students]);

  const totalInactiveStudents = useMemo(() => {
    return students.filter((s) => s.is_active === false).length;
  }, [students]);

  const avatars = useMemo(() => getAvatarsForCareer(careerName), [careerName]);
  const specialAvatars = useMemo(() => avatars.slice(16), [avatars]);

  if (loading)
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-300">Cargando...</div>
      </div>
    );
  if (!session) return <Navigate to="/login" replace />;
  if (!isTeacherish) return <Navigate to="/student" replace />;

  const avatar =
    avatars.find((a) => a.key === (profileData?.avatar_key ?? "av1")) ??
    avatars[0];

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header - RESPONSIVE */}
      <header className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-800 border-b border-slate-800/50 shadow-xl">
        <div className="px-4 sm:px-6 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row items-center sm:justify-between gap-4">
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
                  Panel Docente
                </h1>
              </div>
            </div>
            <button
              className="w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-xl font-medium transition-all duration-200 shadow-lg shadow-red-900/30 text-sm sm:text-base"
              onClick={logout}
            >
              <span className="sm:hidden">Salir</span>
              <span className="hidden sm:inline">Cerrar sesión</span>
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
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

        {/* Perfil del docente - RESPONSIVE */}
        <section className="w-full max-w-5xl mx-auto bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl border border-slate-700/50 p-4 sm:p-6 lg:p-8 shadow-2xl">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6 lg:gap-8">
            <div className="flex-shrink-0">
              <div className="relative group">
                <div className="w-24 h-24 sm:w-28 sm:h-28 lg:w-32 lg:h-32 rounded-2xl overflow-hidden border-4 border-slate-700/50 shadow-xl">
                  <img
                    src={avatar.url}
                    alt={avatar.label}
                    className="w-full h-full object-cover"
                  />
                </div>
                <button
                  className="absolute -bottom-2 -right-2 sm:-bottom-3 sm:-right-3 w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white flex items-center justify-center hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-lg shadow-blue-900/50 group-hover:scale-110"
                  onClick={() => setShowAvatarModal(true)}
                >
                  <svg
                    className="w-4 h-4 sm:w-5 sm:h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                    />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex-1 w-full text-center sm:text-left">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4 sm:mb-6">
                <div>
                  <div className="text-sm text-slate-400 mb-1 font-mono">
                    {profileData?.code ?? ""}
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-display font-bold text-white mb-2 tracking-tight">
                    {profileData?.full_name ?? "Docente"}
                  </h2>
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 sm:gap-3 text-slate-300">
                    <span className="px-2 sm:px-3 py-1 bg-slate-800/50 rounded-lg text-xs sm:text-sm">
                      {careerName}
                    </span>
                    <span className="px-2 sm:px-3 py-1 bg-slate-800/50 rounded-lg text-xs sm:text-sm capitalize">
                      {profileData?.shift ?? ""}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap justify-center sm:justify-end gap-2 sm:gap-3">
                  <Link
                    to="/teacher/content"
                    className="px-3 sm:px-5 py-2 sm:py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white rounded-xl font-medium transition-all duration-200 shadow-lg shadow-emerald-900/30 text-sm sm:text-base"
                  >
                    <span className="sm:hidden">✏️</span>
                    <span className="hidden sm:inline">
                      ✏️ Editar Contenido
                    </span>
                  </Link>
                  <Link
                    to="/teacher/modules"
                    className="px-3 sm:px-5 py-2 sm:py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl font-medium transition-all duration-200 shadow-lg shadow-blue-900/30 text-sm sm:text-base"
                  >
                    <span className="sm:hidden">📚</span>
                    <span className="hidden sm:inline">📚 Calificaciones</span>
                  </Link>
                  <button
                    className="px-3 sm:px-5 py-2 sm:py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium transition-all duration-200 border border-slate-700/50 text-sm sm:text-base"
                    onClick={() => setEditMode(!editMode)}
                  >
                    {editMode ? (
                      "Cancelar"
                    ) : (
                      <>
                        <span className="sm:hidden">Editar</span>
                        <span className="hidden sm:inline">Editar Perfil</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {editMode ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Celular
                      </label>
                      <input
                        className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Correo (opcional)
                      </label>
                      <input
                        className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all"
                        value={editEmail}
                        onChange={(e) => setEditEmail(e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Gustos (opcional)
                    </label>
                    <textarea
                      className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all"
                      rows={2}
                      value={editLikes}
                      onChange={(e) => setEditLikes(e.target.value)}
                    />
                  </div>

                  <button
                    className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white rounded-xl font-medium transition-all duration-200 shadow-lg shadow-emerald-900/30 disabled:opacity-50"
                    onClick={saveProfile}
                    disabled={saving}
                  >
                    {saving ? "Guardando..." : "Guardar Cambios"}
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-800/30 rounded-xl border border-slate-700/30">
                    <div className="text-sm text-slate-400 mb-1">Celular</div>
                    <div className="text-white font-medium">
                      {profileData?.phone ?? "-"}
                    </div>
                  </div>
                  <div className="p-4 bg-slate-800/30 rounded-xl border border-slate-700/30">
                    <div className="text-sm text-slate-400 mb-1">Correo</div>
                    <div className="text-white font-medium">
                      {profileData?.contact_email ?? "-"}
                    </div>
                  </div>
                  <div className="md:col-span-2 p-4 bg-slate-800/30 rounded-xl border border-slate-700/30">
                    <div className="text-sm text-slate-400 mb-1">Gustos</div>
                    <div className="text-white font-medium">
                      {profileData?.likes ?? "-"}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Widget de Semestre */}
        <section className="bg-slate-900/60 rounded-2xl border border-slate-700/50 p-4 shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-slate-400 text-sm font-medium">Semestre activo:</span>
              <button
                className="flex items-center gap-2 px-4 py-2 bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 rounded-xl text-blue-300 font-bold transition-all"
                onClick={() => { setSemesterInput(viewSemester); setShowSemesterModal(true); }}
                title="Cambiar semestre visualizado"
              >
                📅 {viewSemester}
                {viewSemester !== computeCurrentSemester() && (
                  <span className="ml-1 px-2 py-0.5 bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs rounded-full">
                    Vista histórica
                  </span>
                )}
              </button>
              {viewSemester !== computeCurrentSemester() && (
                <button
                  className="text-xs text-slate-400 hover:text-white underline transition-colors"
                  onClick={() => setViewSemester(computeCurrentSemester())}
                >
                  Volver al actual
                </button>
              )}
            </div>
            <p className="text-xs text-slate-500">Haz clic en el semestre para cambiar la vista</p>
          </div>
        </section>

        {/* Estadísticas de estudiantes por nivel */}
        <section className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl border border-slate-700/50 p-4 sm:p-6 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              📊 Estadísticas por Nivel
            </h2>
            <div className="flex items-center gap-4 text-sm">
              <span className="text-slate-400">
                Total activos:{" "}
                <span className="text-emerald-400 font-bold">
                  {totalActiveStudents}
                </span>
              </span>
              {totalInactiveStudents > 0 && (
                <span className="text-slate-400">
                  Inactivos:{" "}
                  <span className="text-amber-400 font-bold">
                    {totalInactiveStudents}
                  </span>
                </span>
              )}
            </div>
          </div>

          {/* Gráfico de barras visual */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {levelStats.map((stat) => {
              const maxCount = Math.max(...levelStats.map((s) => s.count), 1);
              const percentage = (stat.count / maxCount) * 100;
              const colors = [
                "from-blue-500 to-blue-600",
                "from-cyan-500 to-cyan-600",
                "from-emerald-500 to-emerald-600",
                "from-purple-500 to-purple-600",
              ];
              const colorClass = colors[stat.sortOrder % colors.length];

              return (
                <div
                  key={stat.id}
                  className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/30 hover:border-slate-600/50 transition-colors cursor-pointer"
                  onClick={() => setSelectedLevelFilter(stat.id)}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-300 truncate">
                      {stat.name}
                    </span>
                    <span className="text-2xl font-bold text-white ml-2">
                      {stat.count}
                    </span>
                  </div>
                  <div className="h-2 bg-slate-700/50 rounded-full overflow-hidden">
                    <div
                      className={`h-full bg-gradient-to-r ${colorClass} rounded-full transition-all duration-500`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    {totalActiveStudents > 0
                      ? Math.round((stat.count / totalActiveStudents) * 100)
                      : 0}
                    % del total
                  </div>
                </div>
              );
            })}
          </div>

          {levelStats.length === 0 && (
            <div className="text-center py-8 text-slate-400">
              No hay niveles configurados
            </div>
          )}
        </section>

        {/* Lista de estudiantes - RESPONSIVE */}
        <section className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            <h2 className="text-xl sm:text-2xl font-bold text-white">
              Mis Estudiantes
            </h2>
            <div className="flex flex-wrap gap-2 sm:gap-3 items-center">
              <select
                className="flex-1 sm:flex-none px-3 sm:px-4 py-2 sm:py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all"
                value={selectedLevelFilter ?? ""}
                onChange={(e) =>
                  setSelectedLevelFilter(
                    e.target.value ? Number(e.target.value) : null,
                  )
                }
              >
                <option value="">Todos los niveles</option>
                {levels.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
              <select
                className="flex-1 sm:flex-none px-3 sm:px-4 py-2 sm:py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
              >
                <option value="asc">A → Z</option>
                <option value="desc">Z → A</option>
              </select>
              <button
                className="w-full sm:w-auto px-4 sm:px-5 py-2 sm:py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white rounded-xl font-medium transition-all duration-200 shadow-lg shadow-emerald-900/30 text-sm sm:text-base"
                onClick={() => setShowAddStudent(true)}
              >
                + <span className="hidden sm:inline">Añadir </span>Estudiante
              </button>
              <button
                className="w-full sm:w-auto px-4 sm:px-5 py-2 sm:py-3 bg-gradient-to-r from-violet-600 to-violet-700 hover:from-violet-700 hover:to-violet-800 text-white rounded-xl font-medium transition-all duration-200 shadow-lg shadow-violet-900/30 text-sm sm:text-base"
                onClick={exportContactsToVCF}
                title="Exportar contactos de estudiantes en formato VCF"
              >
                📱 <span className="hidden sm:inline">Exportar </span>Contactos
              </button>
              <button
                className="w-full sm:w-auto px-4 sm:px-5 py-2 sm:py-3 bg-gradient-to-r from-cyan-600 to-cyan-700 hover:from-cyan-700 hover:to-cyan-800 text-white rounded-xl font-medium transition-all duration-200 shadow-lg shadow-cyan-900/30 text-sm sm:text-base"
                onClick={() => nav("/teacher/attendance")}
                title="Registro de asistencia mensual"
              >
                📋 <span className="hidden sm:inline">Asistencia</span>
              </button>
              <button
                className={`w-full sm:w-auto px-4 sm:px-5 py-2 sm:py-3 rounded-xl font-medium transition-all duration-200 text-sm sm:text-base ${
                  showInactiveStudents
                    ? "bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white shadow-lg shadow-amber-900/30"
                    : "bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                }`}
                onClick={() => setShowInactiveStudents(!showInactiveStudents)}
                title={
                  showInactiveStudents
                    ? "Ver estudiantes activos"
                    : "Ver estudiantes inactivos"
                }
              >
                {showInactiveStudents ? "👥 Ver Activos" : "👤 Ver Inactivos"}
              </button>
            </div>
          </div>

          {/* Indicador de modo inactivos */}
          {showInactiveStudents && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl px-4 py-3 flex items-center gap-3">
              <span className="text-amber-400 text-lg">⚠️</span>
              <div>
                <div className="text-amber-300 font-medium">
                  Modo: Estudiantes Inactivos
                </div>
                <div className="text-amber-400/70 text-sm">
                  Estos estudiantes no pueden acceder al sistema. Puedes
                  reactivarlos con el botón "Activar".
                </div>
              </div>
            </div>
          )}

          {loadingStudents ? (
            <div className="bg-slate-900 rounded-2xl border border-slate-700/50 p-12 text-center">
              <div className="text-slate-300 text-lg">
                Cargando estudiantes...
              </div>
            </div>
          ) : filteredStudents.length === 0 ? (
            <div className="bg-slate-900 rounded-2xl border border-slate-700/50 p-12 text-center">
              <div className="text-6xl mb-4 opacity-20">👥</div>
              <div className="text-xl font-semibold text-white mb-2">
                No hay estudiantes
              </div>
              <div className="text-slate-400">
                {selectedLevelFilter
                  ? "No hay estudiantes en este nivel"
                  : "Agrega estudiantes con el botón '+ Añadir Estudiante'"}
              </div>
            </div>
          ) : (
            <div className="bg-slate-900 rounded-2xl border border-slate-700/50 overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-slate-800/50">
                    <tr>
                      <th className="px-2 py-3 text-center text-xs font-semibold text-slate-300 uppercase tracking-wider w-12">
                        N°
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
                        Código
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
                        RUDEAL
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
                        Ap. Paterno
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
                        Ap. Materno
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
                        Nombres
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
                        Carnet
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-slate-300 uppercase tracking-wider">
                        Género
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-slate-300 uppercase tracking-wider">
                        Edad
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-slate-300 uppercase tracking-wider">
                        Nivel
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider">
                        Celular
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-slate-300 uppercase tracking-wider">
                        Asistencia
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {filteredStudents.map((s, index) => (
                      <tr
                        key={s.id}
                        className="hover:bg-slate-800/30 transition-colors"
                      >
                        <td className="px-2 py-3 whitespace-nowrap text-sm text-center text-slate-400 font-mono">
                          {index + 1}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-white font-mono">
                          {s.code || "-"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-300">
                          {s.rudeal_number || "-"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-200">
                          {s.last_name_pat || "-"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-200">
                          {s.last_name_mat || "-"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-200">
                          {s.first_names || "-"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-300">
                          {s.carnet_number || "-"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-300 text-center">
                          {s.gender === "F"
                            ? "F"
                            : s.gender === "M"
                              ? "M"
                              : "-"}
                        </td>
                        <td
                          className="px-4 py-3 whitespace-nowrap text-sm text-center font-bold"
                          style={{
                            color: s.birth_date
                              ? calculateAge(s.birth_date) >= 15
                                ? "#22c55e"
                                : "#ef4444"
                              : "#a1a1aa",
                          }}
                        >
                          {s.birth_date ? calculateAge(s.birth_date) : "-"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-center">
                          <span className="px-2 py-1 bg-blue-500/10 text-blue-400 text-xs font-medium rounded-lg border border-blue-500/20">
                            {s.level_name ?? "Sin nivel"}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-300">
                          {s.phone || "-"}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-center">
                          {(() => {
                            const stat = attendanceStats.get(s.id);
                            if (!stat || stat.total === 0) return <span className="text-xs text-slate-600">-</span>;
                            const pct = Math.round((stat.faltas / stat.total) * 100);
                            const barColor = pct <= 20 ? "bg-emerald-500" : pct <= 30 ? "bg-amber-500" : "bg-red-500";
                            const textColor = pct <= 20 ? "text-emerald-400" : pct <= 30 ? "text-amber-400" : "text-red-400";
                            return (
                              <div className="flex items-center gap-2 justify-center" title={`${stat.faltas} faltas de ${stat.total} clases`}>
                                <div className="w-14 bg-slate-700 rounded-full h-1.5">
                                  <div className={`h-1.5 rounded-full ${barColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                                </div>
                                <span className={`text-xs font-medium ${textColor}`}>{pct}%</span>
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                          <div className="flex justify-end gap-2">
                            <button
                              className="px-3 py-1.5 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                              onClick={() => openEditStudent(s)}
                            >
                              Editar
                            </button>
                            <button
                              className="px-3 py-1.5 text-purple-400 hover:bg-purple-500/10 rounded-lg transition-colors"
                              onClick={() =>
                                openResetPassword(s.id, s.full_name ?? "")
                              }
                            >
                              Reset
                            </button>
                            <button
                              className="px-3 py-1.5 text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                              onClick={() =>
                                nav(`/teacher/student/${s.id}/grades`)
                              }
                            >
                              Notas
                            </button>
                            <button
                              className={`px-3 py-1.5 rounded-lg transition-colors ${
                                !s.can_ascend
                                  ? "text-slate-600 cursor-not-allowed"
                                  : "text-teal-400 hover:bg-teal-500/10"
                              }`}
                              onClick={() =>
                                s.can_ascend &&
                                handleAscend(s.id, s.level_sort_order)
                              }
                              disabled={!s.can_ascend}
                              title={
                                s.can_ascend
                                  ? "Ascender al siguiente nivel"
                                  : "Debe completar y aprobar todos los módulos del nivel"
                              }
                            >
                              Ascender
                            </button>
                            <button
                              className="px-3 py-1.5 text-amber-400 hover:bg-amber-500/10 rounded-lg transition-colors"
                              onClick={() =>
                                openAvatarUnlockModal(
                                  s.id,
                                  [
                                    s.first_names,
                                    s.last_name_pat,
                                    s.last_name_mat,
                                  ]
                                    .filter(Boolean)
                                    .join(" ") ||
                                    s.code ||
                                    "",
                                )
                              }
                              title="Gestionar avatares de desafío"
                            >
                              Avatares
                            </button>
                            <button
                              className={`px-3 py-1.5 rounded-lg transition-colors ${
                                s.is_active
                                  ? "text-amber-400 hover:bg-amber-500/10"
                                  : "text-emerald-400 hover:bg-emerald-500/10"
                              }`}
                              onClick={() =>
                                handleToggleActive(
                                  s.id,
                                  s.full_name ?? s.code ?? "",
                                  s.is_active !== false,
                                )
                              }
                              disabled={togglingActive}
                            >
                              {s.is_active !== false ? "Desactivar" : "Activar"}
                            </button>
                            {!showInactiveStudents && (
                              <button
                                className="px-3 py-1.5 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                onClick={() =>
                                  handleDeleteStudent(s.id, s.code ?? "")
                                }
                              >
                                Eliminar
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </main>

      {/* Modal Avatar */}
      {showAvatarModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={() => setShowAvatarModal(false)}
        >
          <div
            className="bg-slate-900 rounded-2xl border border-slate-700/50 shadow-2xl max-w-xl w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">
                Selecciona tu avatar
              </h3>
              <button
                className="text-slate-400 hover:text-white transition-colors"
                onClick={() => setShowAvatarModal(false)}
              >
                <svg
                  className="w-6 h-6"
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
              </button>
            </div>

            <div className="grid grid-cols-5 gap-3 mb-6">
              {avatars.map((a) => (
                <button
                  key={a.key}
                  className={`p-2 rounded-xl border-2 transition-all ${
                    selectedAvatar === a.key
                      ? "border-blue-500 ring-2 ring-blue-500/20 scale-110"
                      : "border-slate-700/50 hover:border-slate-600"
                  }`}
                  onClick={() => setSelectedAvatar(a.key)}
                >
                  <img src={a.url} alt={a.label} className="w-full" />
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium transition-all"
                onClick={() => setShowAvatarModal(false)}
              >
                Cancelar
              </button>
              <button
                className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl font-medium transition-all shadow-lg shadow-blue-900/30"
                onClick={saveAvatar}
              >
                Guardar Avatar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Añadir Estudiante */}
      {showAddStudent && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 rounded-2xl border border-slate-700/50 shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">
                Añadir Estudiante
              </h3>
              <button
                className="text-slate-400 hover:text-white transition-colors"
                onClick={() => setShowAddStudent(false)}
              >
                <svg
                  className="w-6 h-6"
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
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Nombres *
                </label>
                <input
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all"
                  value={addFirstNames}
                  onChange={(e) => setAddFirstNames(e.target.value)}
                  placeholder="Ej: Juan Carlos"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Apellido Paterno
                  </label>
                  <input
                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all"
                    value={addLastNamePat}
                    onChange={(e) => setAddLastNamePat(e.target.value)}
                    placeholder="Ej: García"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Apellido Materno
                  </label>
                  <input
                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all"
                    value={addLastNameMat}
                    onChange={(e) => setAddLastNameMat(e.target.value)}
                    placeholder="Ej: López"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    N° Carnet *
                  </label>
                  <input
                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all"
                    value={addCarnetNumber}
                    onChange={(e) => setAddCarnetNumber(e.target.value)}
                    placeholder="Ej: 12345678"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    N° RUDEAL (opcional)
                  </label>
                  <input
                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all"
                    value={addRudealNumber}
                    onChange={(e) => setAddRudealNumber(e.target.value)}
                    placeholder="Ej: RUD-2025-001"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Género *
                  </label>
                  <select
                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all"
                    value={addGender}
                    onChange={(e) =>
                      setAddGender(e.target.value as "F" | "M" | "")
                    }
                  >
                    <option value="">Seleccionar</option>
                    <option value="F">Femenino</option>
                    <option value="M">Masculino</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Fecha de Nacimiento *
                  </label>
                  <input
                    type="date"
                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all"
                    value={addBirthDate}
                    onChange={(e) => setAddBirthDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Celular *
                  </label>
                  <input
                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all"
                    value={addPhone}
                    onChange={(e) => setAddPhone(e.target.value)}
                    placeholder="Ej: 72345678"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Email (opcional)
                  </label>
                  <input
                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all"
                    value={addEmail}
                    onChange={(e) => setAddEmail(e.target.value)}
                    placeholder="Ej: estudiante@correo.com"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Nivel *
                  </label>
                  <select
                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all"
                    value={addLevelId ?? ""}
                    onChange={(e) =>
                      setAddLevelId(
                        e.target.value ? Number(e.target.value) : null,
                      )
                    }
                  >
                    <option value="">Selecciona un nivel</option>
                    {levels.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Contraseña Temporal *
                  </label>
                  <input
                    type="password"
                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all"
                    value={addPassword}
                    onChange={(e) => setAddPassword(e.target.value)}
                    placeholder="Ej: 2025"
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium transition-all"
                onClick={() => setShowAddStudent(false)}
              >
                Cancelar
              </button>
              <button
                className="flex-1 px-4 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white rounded-xl font-medium transition-all shadow-lg shadow-emerald-900/30 disabled:opacity-50"
                onClick={handleAddStudent}
                disabled={addingStudent}
              >
                {addingStudent ? "Creando..." : "Crear Estudiante"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Estudiante */}
      {showEditStudent && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 rounded-2xl border border-slate-700/50 shadow-2xl max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">
                Editar Estudiante
              </h3>
              <button
                className="text-slate-400 hover:text-white transition-colors"
                onClick={() => setShowEditStudent(false)}
              >
                <svg
                  className="w-6 h-6"
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
              </button>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Nombres *
                </label>
                <input
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all"
                  value={editStudentFirstNames}
                  onChange={(e) => setEditStudentFirstNames(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Apellido Paterno
                  </label>
                  <input
                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all"
                    value={editStudentLastNamePat}
                    onChange={(e) => setEditStudentLastNamePat(e.target.value)}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Apellido Materno
                  </label>
                  <input
                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all"
                    value={editStudentLastNameMat}
                    onChange={(e) => setEditStudentLastNameMat(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    N° Carnet *
                  </label>
                  <input
                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all"
                    value={editStudentCarnetNumber}
                    onChange={(e) => setEditStudentCarnetNumber(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    N° RUDEAL (opcional)
                  </label>
                  <input
                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all"
                    value={editStudentRudealNumber}
                    onChange={(e) => setEditStudentRudealNumber(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Género *
                  </label>
                  <select
                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all"
                    value={editStudentGender}
                    onChange={(e) =>
                      setEditStudentGender(e.target.value as "F" | "M" | "")
                    }
                  >
                    <option value="">Seleccionar</option>
                    <option value="F">Femenino</option>
                    <option value="M">Masculino</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Fecha de Nacimiento *
                  </label>
                  <input
                    type="date"
                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all"
                    value={editStudentBirthDate}
                    onChange={(e) => setEditStudentBirthDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Celular
                  </label>
                  <input
                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all"
                    value={editStudentPhone}
                    onChange={(e) => setEditStudentPhone(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">
                    Email
                  </label>
                  <input
                    className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all"
                    value={editStudentEmail}
                    onChange={(e) => setEditStudentEmail(e.target.value)}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Nivel *
                </label>
                <select
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all"
                  value={editStudentLevelId ?? ""}
                  onChange={(e) =>
                    setEditStudentLevelId(
                      e.target.value ? Number(e.target.value) : null,
                    )
                  }
                >
                  <option value="">Selecciona un nivel</option>
                  {levels.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-400 mt-2">
                  Puedes cambiar al nivel que desees. Para ascender
                  automáticamente, usa el botón "Ascender".
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Semestre
                </label>
                <input
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all"
                  placeholder="Ej: 1/2026"
                  value={editStudentSemester}
                  onChange={(e) => setEditStudentSemester(e.target.value)}
                />
                <p className="text-xs text-slate-400 mt-2">
                  Formato: número/año (ej: 1/2026 o 2/2025). Se usa para filtrar estudiantes por semestre.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium transition-all"
                onClick={() => setShowEditStudent(false)}
              >
                Cancelar
              </button>
              <button
                className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl font-medium transition-all shadow-lg shadow-blue-900/30 disabled:opacity-50"
                onClick={handleEditStudent}
                disabled={editingStudentData}
              >
                {editingStudentData ? "Guardando..." : "Guardar Cambios"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Reset Password */}
      {showResetPassword && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={() => setShowResetPassword(false)}
        >
          <div
            className="bg-slate-900 rounded-2xl border border-slate-700/50 shadow-2xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">
                Resetear Contraseña
              </h3>
              <button
                className="text-slate-400 hover:text-white transition-colors"
                onClick={() => setShowResetPassword(false)}
              >
                <svg
                  className="w-6 h-6"
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
              </button>
            </div>

            <div className="mb-4 p-4 bg-purple-500/10 border border-purple-500/20 rounded-xl">
              <p className="text-purple-400 text-sm">
                <strong className="block mb-1">
                  {resetPasswordStudentName}
                </strong>
                Se cambiará la contraseña de acceso
              </p>
            </div>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Nueva Contraseña *
                </label>
                <input
                  type="password"
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50 focus:border-transparent transition-all"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Ingresa la nueva contraseña"
                />
              </div>

              <div className="text-xs text-slate-400 bg-slate-800/30 p-3 rounded-lg">
                💡 Tip: Usa una contraseña que el estudiante pueda recordar
                fácilmente, como su fecha de nacimiento o el año actual.
              </div>
            </div>

            <div className="flex gap-3">
              <button
                className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium transition-all"
                onClick={() => setShowResetPassword(false)}
              >
                Cancelar
              </button>
              <button
                className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white rounded-xl font-medium transition-all shadow-lg shadow-purple-900/30 disabled:opacity-50"
                onClick={handleResetPassword}
                disabled={resettingPassword}
              >
                {resettingPassword
                  ? "Actualizando..."
                  : "Actualizar Contraseña"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Desbloqueo de Avatares Especiales */}
      {showAvatarUnlockModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={() => setShowAvatarUnlockModal(false)}
        >
          <div
            className="bg-slate-900 rounded-2xl border border-slate-700/50 shadow-2xl max-w-lg w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-xl font-bold text-white">
                  Avatares de Desafío
                </h3>
                <p className="text-sm text-slate-400 mt-1">
                  {avatarUnlockStudentName}
                </p>
              </div>
              <button
                className="text-slate-400 hover:text-white transition-colors"
                onClick={() => setShowAvatarUnlockModal(false)}
              >
                <svg
                  className="w-6 h-6"
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
              </button>
            </div>

            <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl">
              <p className="text-amber-400 text-sm">
                Estos avatares especiales solo se desbloquean al completar un
                desafío. Activa o desactiva cada uno.
              </p>
            </div>

            {avatarUnlockLoading ? (
              <div className="text-center py-8 text-slate-400">
                Cargando avatares...
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {specialAvatars.map((a) => {
                  const isUnlocked = avatarUnlockKeys.has(a.key);
                  return (
                    <div
                      key={a.key}
                      className={`rounded-xl border p-4 flex items-center gap-4 transition-all duration-200 ${
                        isUnlocked
                          ? "border-amber-500/30 bg-amber-500/5"
                          : "border-slate-700/50 bg-slate-800/30"
                      }`}
                    >
                      <div className="w-16 h-16 rounded-xl overflow-hidden border-2 border-slate-700/50 flex-shrink-0">
                        <img
                          src={a.url}
                          alt={a.label}
                          className={`w-full h-full ${!isUnlocked ? "grayscale opacity-50" : ""}`}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white mb-1">
                          {a.label}
                        </div>
                        <button
                          className={`w-full px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                            isUnlocked
                              ? "bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 border border-amber-500/30"
                              : "bg-slate-700/50 text-slate-400 hover:bg-slate-700 border border-slate-600/50"
                          }`}
                          onClick={() => toggleAvatarUnlock(a.key)}
                          disabled={avatarUnlockSaving}
                        >
                          {avatarUnlockSaving
                            ? "..."
                            : isUnlocked
                              ? "Desbloqueado"
                              : "Bloqueado"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <button
              className="w-full mt-6 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium transition-all"
              onClick={() => setShowAvatarUnlockModal(false)}
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {/* Modal de Mensajes */}
      {showMessageModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={closeMessageModal}
        >
          <div
            className="bg-slate-900 rounded-2xl border border-slate-700/50 shadow-2xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3
                className={`text-xl font-bold ${
                  messageType === "success"
                    ? "text-emerald-400"
                    : messageType === "warning"
                      ? "text-amber-400"
                      : "text-red-400"
                }`}
              >
                {messageTitle}
              </h3>
              <button
                className="text-slate-400 hover:text-white transition-colors"
                onClick={closeMessageModal}
              >
                <svg
                  className="w-6 h-6"
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
              </button>
            </div>
            <div
              className={`p-4 rounded-xl mb-6 ${
                messageType === "success"
                  ? "bg-emerald-500/10 border border-emerald-500/20"
                  : messageType === "warning"
                    ? "bg-amber-500/10 border border-amber-500/20"
                    : "bg-red-500/10 border border-red-500/20"
              }`}
            >
              <p
                className={`text-sm whitespace-pre-line ${
                  messageType === "success"
                    ? "text-emerald-300"
                    : messageType === "warning"
                      ? "text-amber-300"
                      : "text-red-300"
                }`}
              >
                {messageContent}
              </p>
            </div>
            <button
              className={`w-full px-4 py-3 rounded-xl font-medium transition-all ${
                messageType === "success"
                  ? "bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white"
                  : messageType === "warning"
                    ? "bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white"
                    : "bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white"
              }`}
              onClick={closeMessageModal}
            >
              OK
            </button>
          </div>
        </div>
      )}

      {/* Modal cambio de semestre */}
      {showSemesterModal && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50"
          onClick={() => setShowSemesterModal(false)}
        >
          <div
            className="bg-slate-900 rounded-2xl border border-slate-700/50 shadow-2xl max-w-sm w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold text-white mb-4">Cambiar vista de semestre</h3>
            <p className="text-sm text-slate-400 mb-4">
              Semestre actual: <span className="text-blue-400 font-bold">{computeCurrentSemester()}</span>
            </p>
            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Ver semestre:
              </label>
              <input
                className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all"
                placeholder="Ej: 1/2026"
                value={semesterInput}
                onChange={(e) => setSemesterInput(e.target.value)}
              />
            </div>
            <div className="flex gap-3">
              <button
                className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium transition-all"
                onClick={() => setShowSemesterModal(false)}
              >
                Cancelar
              </button>
              <button
                className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl font-medium transition-all"
                onClick={() => {
                  const trimmed = semesterInput.trim();
                  if (trimmed) setViewSemester(trimmed);
                  setShowSemesterModal(false);
                }}
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

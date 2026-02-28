// cea-plataforma/web/src/pages/StudentDashboard.tsx
import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useRole } from "../lib/useRole";
import logoCea from "../assets/logo-cea.png";

type LevelRow = { id: number; name: string; sort_order: number };

type ModuleRow = {
  id: number;
  level_id: number;
  title: string;
  sort_order: number;
  is_active: boolean | null;
};

type ModuleProgress = {
  module_id: number;
  progress_percent: number;
  is_unlocked_final: boolean;
};

type CareerRow = { id: number; name: string };

type ModuleGradeRow = {
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

type GradeHistoryRow = {
  module_id: number;
  module_name: string;
  module_order: number;
  level_id: number;
  level_name: string;
  level_order: number;
  ser: number;
  saber: number;
  hacer_proceso: number;
  hacer_producto: number;
  decidir: number;
  auto_ser: number;
  auto_decidir: number;
  total: number;
  observation: string;
};

function clampPct(x: number) {
  return Math.max(0, Math.min(100, Math.round(x)));
}

type AvatarItem = { key: string; label: string; url: string };

const DV = "https://cdn.jsdelivr.net/gh/devicons/devicon@latest/icons";
const SI = "https://cdn.simpleicons.org";
const TW = "https://cdn.jsdelivr.net/gh/jdecked/twemoji@latest/assets/svg";

// ── Sistemas Informáticos ──
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

// ── Gastronomía ──
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

// ── Contaduría General ──
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

// ── Textil y Confección ──
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

// Nivel mínimo (sort_order) para desbloquear cada grupo de avatares
function getAvatarRequiredLevel(index: number): number | "special" {
  if (index < 4) return 1; // av1-av4: Técnico Básico (todos)
  if (index < 8) return 2; // av5-av8: Técnico Auxiliar
  if (index < 12) return 3; // av9-av12: Técnico Medio I
  if (index < 16) return 4; // av13-av16: Técnico Medio II
  return "special"; // av17-av20: Desafío (docente desbloquea)
}

const LEVEL_NAMES: Record<number, string> = {
  1: "Técnico Básico",
  2: "Técnico Auxiliar",
  3: "Técnico Medio I",
  4: "Técnico Medio II",
};

export default function StudentDashboard() {
  const nav = useNavigate();
  const { loading, session, profile } = useRole();

  const [careerName, setCareerName] = useState<string>("(sin carrera)");
  const [level, setLevel] = useState<LevelRow | null>(null);

  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [progressByModule, setProgressByModule] = useState<
    Record<number, ModuleProgress>
  >({});
  const [msg, setMsg] = useState<string | null>(null);

  const [avatarOpen, setAvatarOpen] = useState(false);
  const [selectedAvatarKey, setSelectedAvatarKey] = useState<string | null>(
    null,
  );
  const [savingAvatar, setSavingAvatar] = useState(false);
  const [specialUnlocks, setSpecialUnlocks] = useState<Set<string>>(new Set());

  // Editar perfil
  const [editProfileOpen, setEditProfileOpen] = useState(false);
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [gradesOpen, setGradesOpen] = useState<Set<number>>(new Set());
  const [gradesByModule, setGradesByModule] = useState<
    Record<number, ModuleGradeRow | null | undefined>
  >({});
  const [gradesLoadingByModule, setGradesLoadingByModule] = useState<
    Record<number, boolean>
  >({});

  // ✅ NOTAS HISTÓRICAS
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyData, setHistoryData] = useState<GradeHistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Asistencia del semestre
  const [attendanceSummary, setAttendanceSummary] = useState<{
    P: number;
    A: number;
    F: number;
    L: number;
    total: number;
  } | null>(null);

  function num0(x: number | null | undefined) {
    return typeof x === "number" && Number.isFinite(x) ? x : 0;
  }

  function calcTotal(g: ModuleGradeRow, pct: number) {
    const hpSuggested = Math.round((clampPct(pct) / 100) * 20);
    const hpFinal =
      g.hacer_proceso === null || g.hacer_proceso === undefined
        ? hpSuggested
        : num0(g.hacer_proceso);

    return (
      num0(g.ser) +
      num0(g.saber) +
      hpFinal +
      num0(g.hacer_producto) +
      num0(g.decidir) +
      num0(g.auto_ser) +
      num0(g.auto_decidir)
    );
  }

  function getObservation(total: number) {
    if (total >= 76) return "Promovido Excelente";
    if (total >= 51) return "Promovido";
    if (total >= 20) return "Postergado";
    return "Retirado";
  }

  async function loadGrades(moduleId: number) {
    if (!session) return;

    setGradesLoadingByModule((p) => ({ ...p, [moduleId]: true }));

    const res = await supabase
      .from("module_grades")
      .select(
        "student_id,module_id,ser,saber,hacer_proceso,hacer_producto,decidir,auto_ser,auto_decidir",
      )
      .eq("student_id", session.user.id)
      .eq("module_id", moduleId)
      .maybeSingle();

    setGradesLoadingByModule((p) => ({ ...p, [moduleId]: false }));

    if (res.error) {
      setMsg("No se pudo cargar calificaciones: " + res.error.message);
      setGradesByModule((p) => ({ ...p, [moduleId]: null }));
      return;
    }

    setGradesByModule((p) => ({
      ...p,
      [moduleId]: (res.data as ModuleGradeRow | null) ?? null,
    }));
  }

  async function loadHistory() {
    if (!session) return;

    setHistoryLoading(true);

    const res = await supabase
      .from("v_student_grade_history")
      .select(
        "module_id,module_name,module_order,level_id,level_name,level_order,ser,saber,hacer_proceso,hacer_producto,decidir,auto_ser,auto_decidir,total,observation",
      )
      .eq("student_id", session.user.id)
      .order("level_order", { ascending: true })
      .order("module_order", { ascending: true });

    setHistoryLoading(false);

    if (res.error) {
      setMsg("No se pudo cargar historial: " + res.error.message);
      return;
    }

    setHistoryData((res.data ?? []) as GradeHistoryRow[]);
  }

  function toggleGrades(moduleId: number) {
    setGradesOpen((prev) => {
      const n = new Set(prev);
      if (n.has(moduleId)) n.delete(moduleId);
      else n.add(moduleId);
      return n;
    });

    if (gradesByModule[moduleId] === undefined) {
      void loadGrades(moduleId);
    }
  }

  function openHistory() {
    setHistoryOpen(true);
    loadHistory();
  }

  async function logout() {
    await supabase.auth.signOut({ scope: "local" });
    nav("/login", { replace: true });
  }

  const displayName = useMemo(() => {
    if (!profile) return "Estudiante";
    const parts = [
      profile.first_names?.trim(),
      profile.last_name_pat?.trim(),
      profile.last_name_mat?.trim(),
    ].filter(Boolean) as string[];
    if (parts.length) return parts.join(" ");
    return profile.full_name?.trim() || profile.code || "Estudiante";
  }, [profile]);

  const avatars = useMemo(() => getAvatarsForCareer(careerName), [careerName]);

  const avatar = useMemo(() => {
    const key = profile?.avatar_key?.trim() || "av1";
    return avatars.find((a) => a.key === key) ?? avatars[0];
  }, [profile?.avatar_key, avatars]);

  useEffect(() => {
    if (!session) return;

    async function loadAll() {
      setMsg(null);

      if (profile?.career_id) {
        const c = await supabase
          .from("careers")
          .select("id,name")
          .eq("id", profile.career_id)
          .single();

        if (!c.error && c.data) setCareerName((c.data as CareerRow).name);
      }

      const enr = await supabase
        .from("enrollments")
        .select("level_id")
        .eq("student_id", session!.user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (enr.error) {
        setMsg("No se pudo leer tu nivel: " + enr.error.message);
        return;
      }

      const levelId = enr.data?.level_id;
      if (!levelId) {
        setMsg("No tienes nivel asignado.");
        return;
      }

      const lv = await supabase
        .from("levels")
        .select("id,name,sort_order")
        .eq("id", levelId)
        .single();
      if (!lv.error && lv.data) setLevel(lv.data as LevelRow);

      // Cargar avatares especiales desbloqueados
      const unlocks = await supabase
        .from("student_avatar_unlocks")
        .select("avatar_key")
        .eq("student_id", session!.user.id);

      if (!unlocks.error && unlocks.data) {
        setSpecialUnlocks(
          new Set(
            unlocks.data.map((u: { avatar_key: string }) => u.avatar_key),
          ),
        );
      }

      const mods = await supabase
        .from("modules")
        .select("id,level_id,title,sort_order,is_active")
        .eq("level_id", levelId)
        .order("sort_order");

      if (mods.error) {
        setMsg("No se pudo cargar módulos: " + mods.error.message);
        return;
      }

      const modList = ((mods.data ?? []) as ModuleRow[]).filter(
        (m) => m.is_active !== false,
      );
      setModules(modList);

      if (modList.length === 0) {
        setMsg("Este nivel no tiene módulos.");
        return;
      }

      const moduleIds = modList.map((m) => m.id);

      // ✅ Cargar progreso usando la vista corregida
      const progRes = await supabase
        .from("v_module_progress")
        .select(
          "module_id,completed_sections,total_sections,progress_percent,is_unlocked_final",
        )
        .eq("student_id", session!.user.id)
        .in("module_id", moduleIds);

      if (progRes.error) {
        setMsg("No se pudo cargar progreso: " + progRes.error.message);
        return;
      }

      const pbm: Record<number, ModuleProgress> = {};
      for (const r of (progRes.data ?? []) as any[]) {
        const pct = Number(r.progress_percent ?? 0);
        pbm[r.module_id] = {
          module_id: r.module_id,
          progress_percent: clampPct(pct),
          is_unlocked_final: Boolean(r.is_unlocked_final),
        };
      }

      // Inicializar módulos sin progreso en 0%
      for (const m of modList) {
        if (!pbm[m.id]) {
          pbm[m.id] = {
            module_id: m.id,
            progress_percent: 0,
            is_unlocked_final: false,
          };
        }
      }

      setProgressByModule(pbm);

      // Cargar asistencia del semestre actual
      const semester = profile?.current_semester;
      if (semester) {
        const [semNum, semYear] = semester.split("/");
        const yr = parseInt(semYear ?? "2026");
        const s = parseInt(semNum ?? "1");
        const startDate = s === 1 ? `${yr}-01-01` : `${yr}-07-01`;
        const endDate = s === 1 ? `${yr}-06-30` : `${yr}-12-31`;
        const { data: attData } = await supabase
          .from("attendance")
          .select("status")
          .eq("student_id", session!.user.id)
          .gte("date", startDate)
          .lte("date", endDate);
        if (attData) {
          const counts = { P: 0, A: 0, F: 0, L: 0, total: 0 };
          for (const r of attData) {
            counts.total++;
            if (r.status === "P") counts.P++;
            else if (r.status === "A") counts.A++;
            else if (r.status === "F") counts.F++;
            else if (r.status === "L") counts.L++;
          }
          setAttendanceSummary(counts);
        }
      }
    }

    loadAll();
  }, [session, profile]);

  const unlockedMap = useMemo(() => {
    const map: Record<number, boolean> = {};
    let okPrev = true;
    const ordered = modules.slice().sort((a, b) => a.sort_order - b.sort_order);

    for (const m of ordered) {
      map[m.id] = okPrev;
      const pct = progressByModule[m.id]?.progress_percent ?? 0;
      if (pct < 70) okPrev = false;
    }
    return map;
  }, [modules, progressByModule]);

  function openAvatarModal() {
    setSelectedAvatarKey(profile?.avatar_key?.trim() || "av1");
    setAvatarOpen(true);
  }

  async function saveAvatar() {
    if (!session || !selectedAvatarKey) return;
    setSavingAvatar(true);
    setMsg(null);

    const upd = await supabase
      .from("profiles")
      .update({ avatar_key: selectedAvatarKey })
      .eq("id", session.user.id);

    setSavingAvatar(false);

    if (upd.error) {
      setMsg("No se pudo actualizar avatar: " + upd.error.message);
      return;
    }

    setAvatarOpen(false);
    window.location.reload();
  }

  function openEditProfile() {
    setEditPhone(profile?.phone ?? "");
    setEditEmail(profile?.contact_email ?? "");
    setEditProfileOpen(true);
  }

  async function saveProfile() {
    if (!session) return;
    setSavingProfile(true);
    setMsg(null);

    const upd = await supabase
      .from("profiles")
      .update({
        phone: editPhone.trim() || null,
        contact_email: editEmail.trim() || null,
      })
      .eq("id", session.user.id);

    setSavingProfile(false);

    if (upd.error) {
      setMsg("No se pudo actualizar perfil: " + upd.error.message);
      return;
    }

    setEditProfileOpen(false);
    window.location.reload();
  }

  if (loading)
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-300 text-lg">Cargando...</div>
      </div>
    );
  if (!session) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header mejorado con gradiente - RESPONSIVE */}
      <header className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-800 border-b border-slate-800/50 shadow-xl">
        <div className="px-4 sm:px-6 py-4 sm:py-5">
          {/* Mobile: Stack vertical, Desktop: Horizontal */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            {/* Logo y título */}
            <div className="flex items-center gap-3">
              <img
                src={logoCea}
                alt="CEA Logo"
                className="h-40 w-40 sm:h-40 sm:w-40 rounded-xl object-contain p-1"
              />
              <div>
                <div className="text-slate-400 text-xs sm:text-sm font-medium tracking-wide uppercase">
                  CEA Madre María Oliva
                </div>
                <h1 className="text-xl sm:text-2xl font-display font-bold text-white tracking-tight">
                  Panel del Estudiante
                </h1>
              </div>
            </div>

            {/* Botones - en móvil se ajustan */}
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={openHistory}
                className="flex-1 sm:flex-none px-3 sm:px-4 py-2 sm:py-2.5 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 text-slate-200 rounded-xl font-medium transition-all duration-200 flex items-center justify-center gap-2 text-sm sm:text-base"
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
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                  />
                </svg>
                <span className="hidden xs:inline sm:inline">Notas</span>
                <span className="hidden sm:inline"> Históricas</span>
              </button>
              <button
                onClick={logout}
                className="flex-1 sm:flex-none px-3 sm:px-4 py-2 sm:py-2.5 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white rounded-xl font-medium transition-all duration-200 shadow-lg shadow-red-900/30 text-sm sm:text-base"
              >
                <span className="sm:hidden">Salir</span>
                <span className="hidden sm:inline">Cerrar sesión</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6 sm:space-y-8">
        {/* Tarjeta de perfil mejorada - RESPONSIVE */}
        <section className="w-full max-w-4xl mx-auto bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl border border-slate-700/50 p-4 sm:p-6 lg:p-8 shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 sm:gap-6 mb-6 sm:mb-8">
            {/* Avatar con botón editar en esquina */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-5">
              <div className="relative group flex-shrink-0">
                <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-2xl border-2 border-blue-500/30 bg-gradient-to-br from-slate-800 to-slate-900 overflow-hidden flex items-center justify-center shadow-xl shadow-blue-900/20">
                  <img
                    src={avatar.url}
                    alt={avatar.label}
                    className="h-full w-full object-cover"
                  />
                </div>
                <button
                  className="absolute -bottom-2 -right-2 w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-r from-blue-600 to-blue-700 text-white flex items-center justify-center hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-lg shadow-blue-900/50 group-hover:scale-110"
                  onClick={openAvatarModal}
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
                      d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                    />
                  </svg>
                </button>
              </div>

              <div className="text-center sm:text-left">
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-2">
                  <span className="px-2 sm:px-3 py-1 bg-blue-500/10 text-blue-400 text-xs font-semibold rounded-lg border border-blue-500/20">
                    {profile?.code ?? ""}
                  </span>
                  <span
                    className={`px-2 sm:px-3 py-1 text-xs font-semibold rounded-lg border ${
                      profile?.shift === "tarde"
                        ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                        : "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
                    }`}
                  >
                    {profile?.shift === "tarde" ? "🌤️ Tarde" : "🌙 Noche"}
                  </span>
                </div>
                <div className="text-xl sm:text-2xl font-display font-bold text-white tracking-tight">
                  {displayName}
                </div>
                <div className="text-slate-400 mt-1 font-medium text-sm sm:text-base">
                  {careerName} · {level?.name ?? "(sin nivel)"}
                </div>
              </div>
            </div>

            {/* Botón Editar perfil */}
            <button
              className="self-center sm:self-start px-3 py-2 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 text-slate-200 rounded-xl font-medium transition-all duration-200 flex items-center gap-2 text-sm flex-shrink-0"
              onClick={openEditProfile}
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
              <span className="hidden sm:inline">Editar perfil</span>
              <span className="sm:hidden">Editar</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            {/* <div className="rounded-xl bg-slate-800/30 border border-slate-700/30 p-4 hover:bg-slate-800/50 transition-colors">
              <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">
                Nombres
              </div>
              <div className="font-semibold text-white">
                {profile?.first_names ?? "-"}
              </div>
            </div>
            <div className="rounded-xl bg-slate-800/30 border border-slate-700/30 p-4 hover:bg-slate-800/50 transition-colors">
              <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">
                Apellidos
              </div>
              <div className="font-semibold text-white">
                {[profile?.last_name_pat, profile?.last_name_mat]
                  .filter(Boolean)
                  .join(" ") || "-"}
              </div>
            </div> */}
            <div className="rounded-xl bg-slate-800/30 border border-slate-700/30 p-4 hover:bg-slate-800/50 transition-colors">
              <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">
                Celular
              </div>
              <div className="font-semibold text-white">
                {profile?.phone ?? "-"}
              </div>
            </div>
            <div className="rounded-xl bg-slate-800/30 border border-slate-700/30 p-4 hover:bg-slate-800/50 transition-colors">
              <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">
                Correo
              </div>
              <div className="font-semibold text-white truncate">
                {profile?.contact_email ?? "-"}
              </div>
            </div>
          </div>

          {msg && (
            <div
              className={`mt-6 px-4 py-3 rounded-xl text-sm ${
                msg.includes("✅")
                  ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                  : "bg-red-500/10 border border-red-500/20 text-red-400"
              }`}
            >
              {msg}
            </div>
          )}
        </section>

        {/* Widget de Asistencia del Semestre */}
        {profile?.current_semester && attendanceSummary !== null && (
          <section className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl border border-slate-700/50 p-4 sm:p-6 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                📋 Asistencia · Semestre {profile.current_semester}
              </h2>
              {attendanceSummary.total > 0 &&
                (() => {
                  const pct = Math.round(
                    (attendanceSummary.F / attendanceSummary.total) * 100,
                  );
                  return (
                    <span
                      className={`text-sm font-bold px-3 py-1 rounded-full ${
                        pct <= 20
                          ? "bg-emerald-500/20 text-emerald-400"
                          : pct <= 30
                            ? "bg-amber-500/20 text-amber-400"
                            : "bg-red-500/20 text-red-400"
                      }`}
                    >
                      {pct}% faltas
                    </span>
                  );
                })()}
            </div>

            <div className="grid grid-cols-4 gap-3 mb-4">
              {[
                {
                  label: "Presentes",
                  value: attendanceSummary.P,
                  color: "text-emerald-400",
                  bg: "bg-emerald-500/10 border-emerald-500/20",
                  icon: "✅",
                },
                {
                  label: "Atrasados",
                  value: attendanceSummary.A,
                  color: "text-amber-400",
                  bg: "bg-amber-500/10 border-amber-500/20",
                  icon: "⏰",
                },
                {
                  label: "Faltas",
                  value: attendanceSummary.F,
                  color: "text-red-400",
                  bg: "bg-red-500/10 border-red-500/20",
                  icon: "❌",
                },
                {
                  label: "Licencias",
                  value: attendanceSummary.L,
                  color: "text-blue-400",
                  bg: "bg-blue-500/10 border-blue-500/20",
                  icon: "📋",
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className={`rounded-xl p-3 border ${item.bg} text-center`}
                >
                  <div className="text-xl">{item.icon}</div>
                  <div className={`text-2xl font-bold ${item.color}`}>
                    {item.value}
                  </div>
                  <div className="text-xs text-slate-500">{item.label}</div>
                </div>
              ))}
            </div>

            {attendanceSummary.total > 0 &&
              (() => {
                const pct = Math.round(
                  (attendanceSummary.F / attendanceSummary.total) * 100,
                );
                return (
                  <>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 bg-slate-700/50 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${pct <= 20 ? "bg-emerald-500" : pct <= 30 ? "bg-amber-500" : "bg-red-500"}`}
                          style={{ width: `${Math.min(pct, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs text-slate-400 w-16 text-right">
                        {pct}% faltas
                      </span>
                    </div>
                    {pct > 30 && (
                      <div className="mt-3 p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-2">
                        <span className="text-red-400 text-lg">⚠️</span>
                        <p className="text-red-300 text-sm">
                          <strong>Atención:</strong> Tu porcentaje de faltas es
                          alto. Podrías quedar inhabilitado como participante
                          efectivo.
                        </p>
                      </div>
                    )}
                  </>
                );
              })()}

            {attendanceSummary.total === 0 && (
              <p className="text-slate-500 text-sm text-center py-2">
                Aún no hay registros de asistencia para este semestre.
              </p>
            )}
          </section>
        )}

        {/* Sección de Módulos mejorada - RESPONSIVE */}
        <section className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl border border-slate-700/50 p-4 sm:p-6 lg:p-8 shadow-2xl">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 mb-5 sm:mb-6">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-700 flex items-center justify-center shadow-lg shadow-emerald-900/30 flex-shrink-0">
                <svg
                  className="w-4 h-4 sm:w-5 sm:h-5 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  />
                </svg>
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-display font-bold text-white tracking-tight">
                  Mis Módulos
                </h2>
                <p className="text-xs sm:text-sm text-slate-400 font-medium">
                  Completa 70% para desbloquear el siguiente
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 sm:gap-5">
            {modules
              .slice()
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((m) => {
                const prog = progressByModule[m.id];
                const pct = prog?.progress_percent ?? 0;
                const unlocked = unlockedMap[m.id] ?? false;
                const canFinal = prog?.is_unlocked_final ?? false;

                const isGradesOpen = gradesOpen.has(m.id);
                const isGradesLoading = gradesLoadingByModule[m.id] ?? false;
                const grade = gradesByModule[m.id];

                return (
                  <div
                    key={m.id}
                    className={`rounded-2xl border p-4 sm:p-5 space-y-3 sm:space-y-4 transition-all duration-300 ${
                      unlocked
                        ? "bg-slate-800/30 border-slate-700/50 hover:border-blue-500/30 hover:shadow-lg hover:shadow-blue-900/10"
                        : "bg-slate-900/50 border-slate-800/50 opacity-60"
                    }`}
                  >
                    <div className="flex items-start gap-2 sm:gap-3">
                      <div
                        className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-base sm:text-lg font-bold shadow-lg flex-shrink-0 ${
                          pct >= 70
                            ? "bg-gradient-to-br from-emerald-600 to-emerald-700 text-white shadow-emerald-900/30"
                            : unlocked
                              ? "bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-blue-900/30"
                              : "bg-slate-800 text-slate-500 border border-slate-700"
                        }`}
                      >
                        {m.sort_order}
                      </div>
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <div className="text-base sm:text-lg font-display font-semibold text-white tracking-tight line-clamp-2">
                          {m.title}
                        </div>
                        <div className="text-xs text-slate-400 font-medium">
                          Módulo {m.sort_order}
                        </div>
                      </div>
                    </div>

                    {/* Barra de progreso mejorada */}
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Progreso</span>
                        <span
                          className={`font-semibold ${
                            pct >= 70 ? "text-emerald-400" : "text-blue-400"
                          }`}
                        >
                          {pct}%
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-slate-700/50 overflow-hidden">
                        <div
                          className={`h-2 rounded-full transition-all duration-500 ${
                            pct >= 70
                              ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
                              : "bg-gradient-to-r from-blue-500 to-blue-400"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>

                    {/* Estado de evaluación final */}
                    <div
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
                        canFinal
                          ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
                          : "bg-slate-800/50 border border-slate-700/30 text-slate-400"
                      }`}
                    >
                      {canFinal ? (
                        <>
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
                              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                          Evaluación habilitada
                        </>
                      ) : (
                        <>
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
                              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                            />
                          </svg>
                          Evaluación bloqueada (70%)
                        </>
                      )}
                    </div>

                    {/* Botones de acción */}
                    <div className="flex gap-2">
                      <button
                        className={`flex-1 rounded-xl px-4 py-2.5 font-medium transition-all duration-200 ${
                          unlocked
                            ? "bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white shadow-lg shadow-blue-900/30"
                            : "bg-slate-800 text-slate-500 cursor-not-allowed"
                        }`}
                        disabled={!unlocked}
                        onClick={() => nav(`/student/module/${m.id}`)}
                        title={
                          !unlocked
                            ? "Completa el módulo anterior al 70% para desbloquear"
                            : "Entrar al módulo"
                        }
                      >
                        {unlocked ? "Entrar" : "🔒 Bloqueado"}
                      </button>

                      <button
                        type="button"
                        className="px-4 py-2.5 rounded-xl border border-slate-700/50 hover:bg-slate-800/50 text-slate-300 transition-all duration-200"
                        onClick={() => toggleGrades(m.id)}
                      >
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                          />
                        </svg>
                      </button>
                    </div>

                    {/* Panel de calificaciones expandible */}
                    {isGradesOpen && (
                      <div className="rounded-xl border border-slate-700/30 bg-slate-800/30 p-4 overflow-auto animate-in fade-in slide-in-from-top-2 duration-200">
                        {isGradesLoading ? (
                          <div className="text-sm text-slate-400 text-center py-2">
                            Cargando calificaciones...
                          </div>
                        ) : grade ? (
                          (() => {
                            const g = grade as ModuleGradeRow;
                            const total = calcTotal(g, pct);
                            const obs = getObservation(total);

                            return (
                              <div className="space-y-3">
                                <table className="min-w-full text-xs">
                                  <thead>
                                    <tr className="text-slate-400 border-b border-slate-700/30">
                                      <th className="py-2 pr-2 text-left">
                                        Ser
                                      </th>
                                      <th className="py-2 pr-2 text-left">
                                        Saber
                                      </th>
                                      <th className="py-2 pr-2 text-left">
                                        H-Pro
                                      </th>
                                      <th className="py-2 pr-2 text-left">
                                        H-Prod
                                      </th>
                                      <th className="py-2 pr-2 text-left">
                                        Dec
                                      </th>
                                      <th className="py-2 pr-2 text-left">
                                        A-Ser
                                      </th>
                                      <th className="py-2 pr-2 text-left">
                                        A-Dec
                                      </th>
                                      <th className="py-2 pr-2 text-left font-semibold text-white">
                                        Total
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    <tr className="text-slate-200">
                                      <td className="py-2 pr-2">
                                        {num0(g.ser)}
                                      </td>
                                      <td className="py-2 pr-2">
                                        {num0(g.saber)}
                                      </td>
                                      <td className="py-2 pr-2">
                                        {g.hacer_proceso === null ||
                                        g.hacer_proceso === undefined
                                          ? `${Math.round((pct / 100) * 20)}`
                                          : num0(g.hacer_proceso)}
                                      </td>
                                      <td className="py-2 pr-2">
                                        {num0(g.hacer_producto)}
                                      </td>
                                      <td className="py-2 pr-2">
                                        {num0(g.decidir)}
                                      </td>
                                      <td className="py-2 pr-2">
                                        {num0(g.auto_ser)}
                                      </td>
                                      <td className="py-2 pr-2">
                                        {num0(g.auto_decidir)}
                                      </td>
                                      <td className="py-2 pr-2 font-bold text-white">
                                        {total}
                                      </td>
                                    </tr>
                                  </tbody>
                                </table>
                                <div
                                  className={`text-sm px-3 py-2 rounded-lg ${
                                    obs.includes("Excelente")
                                      ? "bg-emerald-500/10 text-emerald-400"
                                      : obs.includes("Promovido")
                                        ? "bg-emerald-500/10 text-emerald-400"
                                        : obs.includes("Postergado")
                                          ? "bg-amber-500/10 text-amber-400"
                                          : "bg-red-500/10 text-red-400"
                                  }`}
                                >
                                  <span className="font-semibold">{obs}</span>
                                </div>
                              </div>
                            );
                          })()
                        ) : (
                          <div className="text-sm text-slate-400 text-center py-2">
                            Sin calificaciones aún
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </section>
      </main>

      {/* MODAL AVATAR - con desbloqueo por nivel + Cancelar/Guardar */}
      {avatarOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50"
          onClick={() => setAvatarOpen(false)}
        >
          <div
            className="bg-slate-950 rounded-t-2xl sm:rounded-2xl border border-slate-800 shadow-2xl w-full sm:max-w-2xl p-4 sm:p-6 space-y-4 max-h-[85vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white">
                  Selecciona tu avatar
                </h3>
                <div className="text-xs text-slate-500 mt-1">
                  Desbloquea más avatares subiendo de nivel
                </div>
              </div>
              <button
                className="text-slate-400 hover:text-white transition-colors"
                onClick={() => setAvatarOpen(false)}
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

            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 sm:gap-3">
              {avatars.map((a, index) => {
                const req = getAvatarRequiredLevel(index);
                const myLevel = level?.sort_order ?? 1;
                const isUnlocked =
                  req === "special"
                    ? specialUnlocks.has(a.key)
                    : myLevel >= req;
                const isSelected = selectedAvatarKey === a.key;

                return (
                  <button
                    key={a.key}
                    className={
                      "relative rounded-xl sm:rounded-2xl border-2 p-1.5 sm:p-2 transition-all duration-200 " +
                      (isUnlocked
                        ? isSelected
                          ? "border-blue-500 ring-2 ring-blue-500/20 scale-105 bg-slate-800/50"
                          : "border-slate-800 hover:border-slate-600 hover:bg-slate-900"
                        : "border-slate-800/50 opacity-50 cursor-not-allowed")
                    }
                    onClick={() => isUnlocked && setSelectedAvatarKey(a.key)}
                    disabled={!isUnlocked}
                    title={
                      isUnlocked
                        ? a.label
                        : req === "special"
                          ? "Desbloqueable por desafío"
                          : `Requiere: ${LEVEL_NAMES[req]}`
                    }
                    type="button"
                  >
                    <img
                      src={a.url}
                      alt={a.label}
                      className={
                        "w-full h-auto " + (!isUnlocked ? "grayscale" : "")
                      }
                    />
                    {!isUnlocked && (
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/60 rounded-xl sm:rounded-2xl">
                        {req === "special" ? (
                          <svg
                            className="w-5 h-5 sm:w-6 sm:h-6 text-amber-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                            />
                          </svg>
                        ) : (
                          <svg
                            className="w-5 h-5 sm:w-6 sm:h-6 text-slate-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                            />
                          </svg>
                        )}
                        <span className="text-[9px] sm:text-[10px] text-slate-300 mt-0.5 text-center leading-tight px-1">
                          {req === "special"
                            ? "Desafío"
                            : LEVEL_NAMES[req]?.replace("Técnico ", "T. ")}
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Leyenda */}
            <div className="flex flex-wrap gap-3 text-xs text-slate-500 border-t border-slate-800 pt-3">
              <span className="flex items-center gap-1">
                <svg
                  className="w-3.5 h-3.5 text-slate-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
                Bloqueado por nivel
              </span>
              <span className="flex items-center gap-1">
                <svg
                  className="w-3.5 h-3.5 text-amber-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                  />
                </svg>
                Desbloqueable por desafío
              </span>
            </div>

            {/* Botones Cancelar / Guardar */}
            <div className="flex gap-3 pt-2">
              <button
                className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium transition-all"
                onClick={() => setAvatarOpen(false)}
              >
                Cancelar
              </button>
              <button
                className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl font-medium transition-all shadow-lg shadow-blue-900/30 disabled:opacity-50"
                onClick={saveAvatar}
                disabled={
                  savingAvatar ||
                  selectedAvatarKey === (profile?.avatar_key?.trim() || "av1")
                }
              >
                {savingAvatar ? "Guardando..." : "Guardar Avatar"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDITAR PERFIL */}
      {editProfileOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-50"
          onClick={() => setEditProfileOpen(false)}
        >
          <div
            className="bg-slate-950 rounded-t-2xl sm:rounded-2xl border border-slate-800 shadow-2xl w-full sm:max-w-md p-4 sm:p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base sm:text-lg font-bold text-white">
                Editar perfil
              </h3>
              <button
                className="text-slate-400 hover:text-white transition-colors"
                onClick={() => setEditProfileOpen(false)}
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

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Celular
                </label>
                <input
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="Ej: 72345678"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Correo electrónico
                </label>
                <input
                  type="email"
                  className="w-full px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  placeholder="Ej: correo@ejemplo.com"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                className="flex-1 px-4 py-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-medium transition-all"
                onClick={() => setEditProfileOpen(false)}
              >
                Cancelar
              </button>
              <button
                className="flex-1 px-4 py-3 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white rounded-xl font-medium transition-all shadow-lg shadow-emerald-900/30 disabled:opacity-50"
                onClick={saveProfile}
                disabled={savingProfile}
              >
                {savingProfile ? "Guardando..." : "Guardar Cambios"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ✅ MODAL NOTAS HISTÓRICAS - RESPONSIVE */}
      {historyOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
          <div className="bg-slate-950 rounded-t-2xl sm:rounded-2xl border border-slate-800 shadow w-full sm:max-w-6xl max-h-[90vh] overflow-auto p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between sticky top-0 bg-slate-950 pb-3 border-b border-slate-800 -mx-4 sm:-mx-5 px-4 sm:px-5 -mt-4 sm:-mt-5 pt-4 sm:pt-5">
              <div>
                <div className="text-base sm:text-lg font-bold">
                  📊 Notas Históricas
                </div>
                <div className="text-xs sm:text-sm text-slate-400">
                  Historial de calificaciones
                </div>
              </div>
              <button
                className="rounded-xl px-3 py-2 border border-slate-800 hover:bg-slate-900 text-sm"
                onClick={() => setHistoryOpen(false)}
              >
                Cerrar
              </button>
            </div>

            {historyLoading ? (
              <div className="text-center py-8 text-slate-400">
                Cargando historial...
              </div>
            ) : historyData.length === 0 ? (
              <div className="text-center py-8 text-slate-400">
                No tienes calificaciones registradas aún.
              </div>
            ) : (
              <>
                {/* Vista móvil: tarjetas */}
                <div className="sm:hidden space-y-3">
                  {historyData.map((row) => (
                    <div
                      key={row.module_id}
                      className="bg-slate-900/50 rounded-xl border border-slate-800 p-4 space-y-3"
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-semibold text-white">
                            {row.module_name}
                          </div>
                          <div className="text-xs text-slate-400">
                            {row.level_name}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-white">
                            {row.total}
                          </div>
                          <div
                            className={`text-xs font-medium ${
                              row.observation.includes("Excelente")
                                ? "text-emerald-400"
                                : row.observation.includes("Promovido")
                                  ? "text-emerald-400"
                                  : row.observation.includes("Postergado")
                                    ? "text-amber-400"
                                    : "text-rose-400"
                            }`}
                          >
                            {row.observation}
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-xs">
                        <div className="bg-slate-800/50 rounded-lg p-2 text-center">
                          <div className="text-slate-500">Ser</div>
                          <div className="font-semibold">{row.ser}</div>
                        </div>
                        <div className="bg-slate-800/50 rounded-lg p-2 text-center">
                          <div className="text-slate-500">Saber</div>
                          <div className="font-semibold">{row.saber}</div>
                        </div>
                        <div className="bg-slate-800/50 rounded-lg p-2 text-center">
                          <div className="text-slate-500">H-Pro</div>
                          <div className="font-semibold">
                            {row.hacer_proceso}
                          </div>
                        </div>
                        <div className="bg-slate-800/50 rounded-lg p-2 text-center">
                          <div className="text-slate-500">H-Prod</div>
                          <div className="font-semibold">
                            {row.hacer_producto}
                          </div>
                        </div>
                        <div className="bg-slate-800/50 rounded-lg p-2 text-center">
                          <div className="text-slate-500">Dec</div>
                          <div className="font-semibold">{row.decidir}</div>
                        </div>
                        <div className="bg-slate-800/50 rounded-lg p-2 text-center">
                          <div className="text-slate-500">A-Ser</div>
                          <div className="font-semibold">{row.auto_ser}</div>
                        </div>
                        <div className="bg-slate-800/50 rounded-lg p-2 text-center">
                          <div className="text-slate-500">A-Dec</div>
                          <div className="font-semibold">
                            {row.auto_decidir}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Vista desktop: tabla */}
                <div className="hidden sm:block overflow-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-900 sticky top-0">
                      <tr className="text-left border-b border-slate-800">
                        <th className="p-3">Nivel</th>
                        <th className="p-3">Módulo</th>
                        <th className="p-3">Ser</th>
                        <th className="p-3">Saber</th>
                        <th className="p-3">H-Pro</th>
                        <th className="p-3">H-Prod</th>
                        <th className="p-3">Dec</th>
                        <th className="p-3">A-Ser</th>
                        <th className="p-3">A-Dec</th>
                        <th className="p-3 font-semibold">Total</th>
                        <th className="p-3">Observación</th>
                      </tr>
                    </thead>
                    <tbody>
                      {historyData.map((row) => (
                        <tr
                          key={row.module_id}
                          className="border-b border-slate-800"
                        >
                          <td className="p-3 text-slate-300">
                            {row.level_name}
                          </td>
                          <td className="p-3 font-semibold">
                            {row.module_name}
                          </td>
                          <td className="p-3">{row.ser}</td>
                          <td className="p-3">{row.saber}</td>
                          <td className="p-3">{row.hacer_proceso}</td>
                          <td className="p-3">{row.hacer_producto}</td>
                          <td className="p-3">{row.decidir}</td>
                          <td className="p-3">{row.auto_ser}</td>
                          <td className="p-3">{row.auto_decidir}</td>
                          <td className="p-3 font-semibold">{row.total}</td>
                          <td
                            className={
                              "p-3 " +
                              (row.observation.includes("Excelente")
                                ? "text-emerald-400 font-semibold"
                                : row.observation.includes("Promovido")
                                  ? "text-emerald-400"
                                  : row.observation.includes("Postergado")
                                    ? "text-amber-400"
                                    : "text-rose-400")
                            }
                          >
                            {row.observation}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

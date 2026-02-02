// cea-plataforma/web/src/pages/StudentDashboard.tsx
import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useRole } from "../lib/useRole";
import logoCea from "../assets/logo-cea.png";

type LevelRow = { id: number; name: string };

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

const AVATARS = Array.from({ length: 20 }, (_, i) => {
  const key = `av${i + 1}`;
  return {
    key,
    label: `Avatar ${i + 1}`,
    url: `https://api.dicebear.com/9.x/thumbs/svg?seed=${key}-cea`,
  };
});

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
  const [savingAvatar, setSavingAvatar] = useState(false);

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
    await supabase.auth.signOut();
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

  const avatar = useMemo(() => {
    const key = profile?.avatar_key?.trim() || "av1";
    return AVATARS.find((a) => a.key === key) ?? AVATARS[0];
  }, [profile?.avatar_key]);

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
        .select("id,name")
        .eq("id", levelId)
        .single();
      if (!lv.error && lv.data) setLevel(lv.data as LevelRow);

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

  async function setAvatarKey(newKey: string) {
    if (!session) return;
    setSavingAvatar(true);
    setMsg(null);

    const upd = await supabase
      .from("profiles")
      .update({ avatar_key: newKey })
      .eq("id", session.user.id);

    setSavingAvatar(false);

    if (upd.error) {
      setMsg("No se pudo actualizar avatar: " + upd.error.message);
      return;
    }

    setAvatarOpen(false);
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
            {/* Avatar y datos principales */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-5">
              <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl border-2 border-blue-500/30 bg-gradient-to-br from-slate-800 to-slate-900 overflow-hidden flex items-center justify-center shadow-xl shadow-blue-900/20 flex-shrink-0">
                <img
                  src={avatar.url}
                  alt={avatar.label}
                  className="h-full w-full"
                />
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

            {/* Botón cambiar avatar - esquina superior derecha */}
            <button
              className="self-center sm:self-start px-3 py-2 bg-slate-800/50 hover:bg-slate-700/50 border border-slate-700/50 text-slate-200 rounded-xl font-medium transition-all duration-200 flex items-center gap-2 text-sm flex-shrink-0"
              onClick={() => setAvatarOpen(true)}
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
                  d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0zm6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="hidden sm:inline">Cambiar avatar</span>
              <span className="sm:hidden">Avatar</span>
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

      {/* MODAL AVATAR - RESPONSIVE */}
      {avatarOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4 z-50">
          <div className="bg-slate-950 rounded-t-2xl sm:rounded-2xl border border-slate-800 shadow w-full sm:max-w-xl p-4 sm:p-5 space-y-4 max-h-[85vh] overflow-auto">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs sm:text-sm text-slate-400">
                  Selecciona tu avatar
                </div>
                <div className="text-base sm:text-lg font-bold">Avatares</div>
              </div>
              <button
                className="rounded-xl px-3 py-2 border border-slate-800 hover:bg-slate-900 text-sm"
                onClick={() => setAvatarOpen(false)}
              >
                Cerrar
              </button>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-5 gap-2 sm:gap-3">
              {AVATARS.map((a) => (
                <button
                  key={a.key}
                  className={
                    "rounded-xl sm:rounded-2xl border border-slate-800 p-1.5 sm:p-2 hover:bg-slate-900 " +
                    (avatar.key === a.key ? "ring-2 ring-white" : "")
                  }
                  onClick={() => setAvatarKey(a.key)}
                  disabled={savingAvatar}
                  title={a.label}
                  type="button"
                >
                  <img src={a.url} alt={a.label} className="w-full h-auto" />
                </button>
              ))}
            </div>

            {savingAvatar && (
              <div className="text-sm text-slate-300">Guardando...</div>
            )}
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

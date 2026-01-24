// cea-plataforma/web/src/pages/StudentDashboard.tsx
import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useRole } from "../lib/useRole";

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

function ProgressBar({ value }: { value: number }) {
  const v = clampPct(value);
  return (
    <div className="w-full">
      <div className="flex justify-between text-sm mb-1 text-slate-300">
        <span className="font-medium">Progreso del módulo</span>
        <span>{v}%</span>
      </div>
      <div className="h-3 rounded-full bg-slate-800 overflow-hidden">
        <div className="h-3 bg-white rounded-full" style={{ width: `${v}%` }} />
      </div>
    </div>
  );
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
        .eq("student_id", session.user.id)
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
        .eq("student_id", session.user.id)
        .in("module_id", moduleIds);

      if (progRes.error) {
        console.error("Error cargando progreso:", progRes.error);
        setMsg("No se pudo cargar progreso: " + progRes.error.message);
        return;
      }

      console.log("Progreso raw:", progRes.data);

      const pbm: Record<number, ModuleProgress> = {};
      for (const r of (progRes.data ?? []) as any[]) {
        const pct = Number(r.progress_percent ?? 0);
        pbm[r.module_id] = {
          module_id: r.module_id,
          progress_percent: clampPct(pct),
          is_unlocked_final: Boolean(r.is_unlocked_final),
        };
        console.log(
          `Módulo ${r.module_id}: ${pct}% (${r.completed_sections}/${r.total_sections})`,
        );
      }

      // Inicializar módulos sin progreso en 0%
      for (const m of modList) {
        if (!pbm[m.id]) {
          pbm[m.id] = {
            module_id: m.id,
            progress_percent: 0,
            is_unlocked_final: false,
          };
          console.log(`Módulo ${m.id}: 0% (sin progreso)`);
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

  if (loading) return <div className="p-6">Cargando...</div>;
  if (!session) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="bg-slate-950 border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <div className="text-sm text-slate-400">CEA Madre María Oliva</div>
            <h1 className="text-xl font-bold">Panel del Estudiante</h1>
          </div>

          <div className="flex gap-2">
            <button
              onClick={openHistory}
              className="rounded-xl px-3 py-2 border border-slate-800 hover:bg-slate-900"
            >
              📊 Notas Históricas
            </button>
            <button
              onClick={logout}
              className="rounded-xl px-3 py-2 bg-white text-black"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        <section className="bg-slate-950 rounded-2xl border border-slate-800 p-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden flex items-center justify-center">
                <img
                  src={avatar.url}
                  alt={avatar.label}
                  className="h-full w-full"
                />
              </div>

              <div>
                <div className="text-sm text-slate-400">
                  {profile?.code ?? ""}
                </div>
                <div className="text-xl font-bold">{displayName}</div>
                <div className="text-sm text-slate-300">
                  {careerName} · {level?.name ?? "(sin nivel)"} ·{" "}
                  {profile?.shift ?? "(sin turno)"}
                </div>
              </div>
            </div>

            <button
              className="rounded-xl px-3 py-2 border border-slate-800 hover:bg-slate-900"
              onClick={() => setAvatarOpen(true)}
            >
              Cambiar avatar
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-2xl border border-slate-800 p-4 bg-slate-950">
              <div className="text-xs text-slate-400">Nombres</div>
              <div className="font-semibold">{profile?.first_names ?? "-"}</div>
            </div>
            <div className="rounded-2xl border border-slate-800 p-4 bg-slate-950">
              <div className="text-xs text-slate-400">Apellido(s)</div>
              <div className="font-semibold">
                {[profile?.last_name_pat, profile?.last_name_mat]
                  .filter(Boolean)
                  .join(" ") || "-"}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-800 p-4 bg-slate-950">
              <div className="text-xs text-slate-400">Celular</div>
              <div className="font-semibold">{profile?.phone ?? "-"}</div>
            </div>
            <div className="rounded-2xl border border-slate-800 p-4 bg-slate-950">
              <div className="text-xs text-slate-400">Correo (opcional)</div>
              <div className="font-semibold">
                {profile?.contact_email ?? "-"}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-800 p-4 md:col-span-2 bg-slate-950">
              <div className="text-xs text-slate-400">Gustos</div>
              <div className="font-semibold">{profile?.likes ?? "-"}</div>
            </div>
          </div>

          {msg && (
            <pre className="text-sm bg-slate-900 border border-slate-800 rounded-xl p-3 whitespace-pre-wrap">
              {msg}
            </pre>
          )}
        </section>

        <section className="bg-slate-950 rounded-2xl border border-slate-800 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Módulos (secuenciales)</h2>
            <div className="text-sm text-slate-400">
              Completa 70% para desbloquear el siguiente.
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    className="rounded-2xl border border-slate-800 p-4 space-y-3 bg-slate-950"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm text-slate-400">
                          Módulo {m.sort_order}
                        </div>
                        <div className="text-lg font-semibold">{m.title}</div>
                      </div>

                      <span className="text-xs px-2 py-1 rounded-full bg-slate-900 border border-slate-800">
                        {pct}%
                      </span>
                    </div>

                    <ProgressBar value={pct} />

                    <div className="text-sm text-slate-300">
                      Evaluación final:{" "}
                      <b
                        className={
                          canFinal ? "text-emerald-400" : "text-slate-400"
                        }
                      >
                        {canFinal
                          ? "Habilitada ✅ (70%)"
                          : "Bloqueada 🔒 (70%)"}
                      </b>
                    </div>

                    <button
                      className="rounded-xl px-3 py-2 bg-white text-black disabled:opacity-50 w-full"
                      disabled={!unlocked}
                      onClick={() => nav(`/student/module/${m.id}`)}
                      title={
                        !unlocked
                          ? "Completa el módulo anterior al 70% para desbloquear"
                          : "Entrar"
                      }
                    >
                      {unlocked ? "Entrar" : "Bloqueado"}
                    </button>

                    <button
                      type="button"
                      className="rounded-xl px-3 py-2 border border-slate-800 hover:bg-slate-900 w-full"
                      onClick={() => toggleGrades(m.id)}
                    >
                      {isGradesOpen
                        ? "Ocultar calificaciones"
                        : "Calificaciones"}
                    </button>

                    {isGradesOpen && (
                      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-3 overflow-auto">
                        {isGradesLoading ? (
                          <div className="text-sm text-slate-300">
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
                                    <tr className="text-left text-slate-200">
                                      <th className="py-1 pr-2">Ser</th>
                                      <th className="py-1 pr-2">Saber</th>
                                      <th className="py-1 pr-2">H-Pro</th>
                                      <th className="py-1 pr-2">H-Prod</th>
                                      <th className="py-1 pr-2">Dec</th>
                                      <th className="py-1 pr-2">A-Ser</th>
                                      <th className="py-1 pr-2">A-Dec</th>
                                      <th className="py-1 pr-2 font-semibold">
                                        Total
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    <tr className="border-t border-slate-800 text-slate-100">
                                      <td className="py-1 pr-2">
                                        {num0(g.ser)}
                                      </td>
                                      <td className="py-1 pr-2">
                                        {num0(g.saber)}
                                      </td>
                                      <td className="py-1 pr-2">
                                        {g.hacer_proceso === null ||
                                        g.hacer_proceso === undefined
                                          ? `${Math.round((pct / 100) * 20)}`
                                          : num0(g.hacer_proceso)}
                                      </td>
                                      <td className="py-1 pr-2">
                                        {num0(g.hacer_producto)}
                                      </td>
                                      <td className="py-1 pr-2">
                                        {num0(g.decidir)}
                                      </td>
                                      <td className="py-1 pr-2">
                                        {num0(g.auto_ser)}
                                      </td>
                                      <td className="py-1 pr-2">
                                        {num0(g.auto_decidir)}
                                      </td>
                                      <td className="py-1 pr-2 font-semibold">
                                        {total}
                                      </td>
                                    </tr>
                                  </tbody>
                                </table>
                                <div className="text-sm">
                                  <span className="text-slate-400">
                                    Observación:
                                  </span>{" "}
                                  <span
                                    className={
                                      obs.includes("Excelente")
                                        ? "text-emerald-400 font-semibold"
                                        : obs.includes("Promovido")
                                          ? "text-emerald-400"
                                          : obs.includes("Postergado")
                                            ? "text-amber-400"
                                            : "text-rose-400"
                                    }
                                  >
                                    {obs}
                                  </span>
                                </div>
                              </div>
                            );
                          })()
                        ) : (
                          <div className="text-sm text-slate-300">
                            Sin calificaciones aún.
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

      {/* MODAL AVATAR */}
      {avatarOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-950 rounded-2xl border border-slate-800 shadow max-w-xl w-full p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-slate-400">
                  Selecciona tu avatar
                </div>
                <div className="text-lg font-bold">Avatares</div>
              </div>
              <button
                className="rounded-xl px-3 py-2 border border-slate-800 hover:bg-slate-900"
                onClick={() => setAvatarOpen(false)}
              >
                Cerrar
              </button>
            </div>

            <div className="grid grid-cols-5 gap-3">
              {AVATARS.map((a) => (
                <button
                  key={a.key}
                  className={
                    "rounded-2xl border border-slate-800 p-2 hover:bg-slate-900 " +
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

      {/* ✅ MODAL NOTAS HISTÓRICAS */}
      {historyOpen && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-950 rounded-2xl border border-slate-800 shadow max-w-6xl w-full max-h-[90vh] overflow-auto p-5 space-y-4">
            <div className="flex items-center justify-between sticky top-0 bg-slate-950 pb-3 border-b border-slate-800">
              <div>
                <div className="text-lg font-bold">📊 Notas Históricas</div>
                <div className="text-sm text-slate-400">
                  Historial completo de calificaciones por módulo
                </div>
              </div>
              <button
                className="rounded-xl px-3 py-2 border border-slate-800 hover:bg-slate-900"
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
              <div className="overflow-auto">
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
                        <td className="p-3 text-slate-300">{row.level_name}</td>
                        <td className="p-3 font-semibold">{row.module_name}</td>
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
            )}
          </div>
        </div>
      )}
    </div>
  );
}

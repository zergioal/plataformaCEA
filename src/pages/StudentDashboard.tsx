// cea-plataforma/web/src/pages/StudentDashboard.tsx
import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useRole } from "../lib/useRole";

type ProfileRow = {
  id: string;
  role: "student" | "teacher" | "admin";
  code: string | null;
  full_name: string | null;
  phone: string | null;
  likes: string | null;
  avatar_key: string | null;
  first_names: string | null;
  last_name_pat: string | null;
  last_name_mat: string | null;
  contact_email: string | null;
  shift: string | null;
  career_id: number | null;
};

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
  total_sections: number;
  completed_sections: number;
  pct: number;
};

type CareerRow = { id: number; name: string };

type ModuleGradeRow = {
  student_id: string;
  module_id: number;
  ser: number | null; // 10
  saber: number | null; // 30
  hacer_proceso: number | null; // 20 (override docente)
  hacer_producto: number | null; // 20
  decidir: number | null; // 10
  auto_ser: number | null; // 5
  auto_decidir: number | null; // 5
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

const AVATARS = Array.from({ length: 10 }, (_, i) => {
  const key = `av${i + 1}`;
  return {
    key,
    label: `Avatar ${i + 1}`,
    url: `https://api.dicebear.com/9.x/thumbs/svg?seed=${key}-cea`,
  };
});

export default function StudentDashboard() {
  const nav = useNavigate();
  const { loading, session } = useRole();

  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [careerName, setCareerName] = useState<string>("(sin carrera)");
  const [level, setLevel] = useState<LevelRow | null>(null);

  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [progressByModule, setProgressByModule] = useState<
    Record<number, ModuleProgress>
  >({});
  const [msg, setMsg] = useState<string | null>(null);

  const [avatarOpen, setAvatarOpen] = useState(false);
  const [savingAvatar, setSavingAvatar] = useState(false);

  // ===== Calificaciones =====
  const [gradesOpen, setGradesOpen] = useState<Set<number>>(new Set());
  const [gradesByModule, setGradesByModule] = useState<
    Record<number, ModuleGradeRow | null | undefined>
  >({});
  const [gradesLoadingByModule, setGradesLoadingByModule] = useState<
    Record<number, boolean>
  >({});

  function num0(x: number | null | undefined) {
    return typeof x === "number" && Number.isFinite(x) ? x : 0;
  }

  function suggestedHacerProceso(pct: number) {
    // 0..20 según progreso
    const v = Math.round((clampPct(pct) / 100) * 20);
    return Math.max(0, Math.min(20, v));
  }

  function calcTotal(g: ModuleGradeRow, hacerProcesoFinal: number) {
    return (
      num0(g.ser) +
      num0(g.saber) +
      hacerProcesoFinal +
      num0(g.hacer_producto) +
      num0(g.decidir) +
      num0(g.auto_ser) +
      num0(g.auto_decidir)
    );
  }

  async function loadGrades(moduleId: number) {
    if (!session) return;

    setGradesLoadingByModule((p) => ({ ...p, [moduleId]: true }));

    const res = await supabase
      .from("module_grades")
      .select(
        "student_id,module_id,ser,saber,hacer_proceso,hacer_producto,decidir,auto_ser,auto_decidir"
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

  // ========= LOAD =========
  useEffect(() => {
    if (!session) return;

    async function loadAll() {
      setMsg(null);

      // 1) Perfil
      const p = await supabase
        .from("profiles")
        .select(
          "id,role,code,full_name,phone,likes,avatar_key,first_names,last_name_pat,last_name_mat,contact_email,shift,career_id"
        )
        .eq("id", session.user.id)
        .single();

      if (p.error) {
        setMsg("No se pudo leer tu perfil: " + p.error.message);
        return;
      }
      setProfile(p.data as ProfileRow);

      // 2) Carrera
      if (p.data?.career_id) {
        const c = await supabase
          .from("careers")
          .select("id,name")
          .eq("id", p.data.career_id)
          .single();

        if (!c.error && c.data) setCareerName((c.data as CareerRow).name);
      }

      // 3) Enrollment -> level
      const enr = await supabase
        .from("enrollments")
        .select("level_id")
        .eq("student_id", session.user.id)
        .maybeSingle();

      if (enr.error) {
        setMsg("No se pudo leer tu nivel (enrollments): " + enr.error.message);
        return;
      }
      const levelId = enr.data?.level_id;
      if (!levelId) {
        setMsg(
          "No tienes nivel asignado. Pide al admin/docente que te asigne un nivel."
        );
        return;
      }

      const lv = await supabase
        .from("levels")
        .select("id,name")
        .eq("id", levelId)
        .single();
      if (!lv.error && lv.data) setLevel(lv.data as LevelRow);

      // 4) Módulos
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
        (m) => m.is_active !== false
      );
      setModules(modList);

      if (modList.length === 0) {
        setMsg("Este nivel no tiene módulos todavía.");
        return;
      }

      // 5) Progreso
      const moduleIds = modList.map((m) => m.id);

      const lessonsRes = await supabase
        .from("lessons")
        .select("id,module_id")
        .in("module_id", moduleIds);

      if (lessonsRes.error) {
        setMsg("No se pudo cargar lecciones: " + lessonsRes.error.message);
        return;
      }

      const lessons = (lessonsRes.data ?? []) as {
        id: number;
        module_id: number;
      }[];
      const lessonIds = lessons.map((l) => l.id);

      const lessonToModule = new Map<number, number>();
      for (const l of lessons) lessonToModule.set(l.id, l.module_id);

      let sections: { id: number; lesson_id: number }[] = [];
      if (lessonIds.length) {
        const secRes = await supabase
          .from("lesson_sections")
          .select("id,lesson_id")
          .in("lesson_id", lessonIds);

        if (secRes.error) {
          setMsg("No se pudo cargar secciones: " + secRes.error.message);
          return;
        }
        sections = (secRes.data ?? []) as { id: number; lesson_id: number }[];
      }

      const sectionToModule = new Map<number, number>();
      for (const s of sections) {
        const mid = lessonToModule.get(s.lesson_id);
        if (mid) sectionToModule.set(s.id, mid);
      }

      const totalByModule: Record<number, number> = {};
      for (const m of modList) totalByModule[m.id] = 0;
      for (const s of sections) {
        const mid = sectionToModule.get(s.id);
        if (mid) totalByModule[mid] = (totalByModule[mid] ?? 0) + 1;
      }

      const progRes = await supabase
        .from("student_section_progress")
        .select("section_id")
        .eq("student_id", session.user.id);

      if (progRes.error) {
        setMsg("No se pudo cargar progreso: " + progRes.error.message);
        return;
      }

      const rows = (progRes.data ?? []) as { section_id: number }[];
      const completedSectionIds = new Set<number>(
        rows.map((r) => Number(r.section_id))
      );

      const doneByModule: Record<number, number> = {};
      for (const m of modList) doneByModule[m.id] = 0;

      for (const sid of completedSectionIds) {
        const mid = sectionToModule.get(sid);
        if (mid) doneByModule[mid] = (doneByModule[mid] ?? 0) + 1;
      }

      const pbm: Record<number, ModuleProgress> = {};
      for (const m of modList) {
        const total = totalByModule[m.id] ?? 0;
        const done = Math.min(doneByModule[m.id] ?? 0, total);
        const pct = total > 0 ? (done / total) * 100 : 0;
        pbm[m.id] = {
          module_id: m.id,
          total_sections: total,
          completed_sections: done,
          pct: clampPct(pct),
        };
      }
      setProgressByModule(pbm);
    }

    loadAll();
  }, [session]);

  // ========= SECUENCIAL =========
  const unlockedMap = useMemo(() => {
    const map: Record<number, boolean> = {};
    let okPrev = true;
    const ordered = modules.slice().sort((a, b) => a.sort_order - b.sort_order);

    for (const m of ordered) {
      map[m.id] = okPrev;
      const pct = progressByModule[m.id]?.pct ?? 0;
      if (pct < 100) okPrev = false;
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

    setProfile((p) => (p ? { ...p, avatar_key: newKey } : p));
    setAvatarOpen(false);
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

          <button
            onClick={logout}
            className="rounded-xl px-3 py-2 bg-white text-black"
          >
            Cerrar sesión
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-6 space-y-6">
        {/* PERFIL */}
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

          {/* datos personales */}
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

        {/* MODULOS */}
        <section className="bg-slate-950 rounded-2xl border border-slate-800 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Módulos (secuenciales)</h2>
            <div className="text-sm text-slate-400">
              Completa 100% para desbloquear el siguiente.
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {modules
              .slice()
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((m) => {
                const prog = progressByModule[m.id];
                const pct = prog?.pct ?? 0;
                const unlocked = unlockedMap[m.id] ?? false;

                const isGradesOpen = gradesOpen.has(m.id);
                const isGradesLoading = gradesLoadingByModule[m.id] ?? false;
                const grade = gradesByModule[m.id];

                const hpSuggested = suggestedHacerProceso(pct);

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
                      Secciones completadas:{" "}
                      <b>{prog?.completed_sections ?? 0}</b> /{" "}
                      <b>{prog?.total_sections ?? 0}</b>
                      <div className="mt-1">
                        Evaluación final:{" "}
                        <b
                          className={
                            pct >= 70 ? "text-emerald-400" : "text-slate-400"
                          }
                        >
                          {pct >= 70
                            ? "Habilitada ✅ (70%)"
                            : "Bloqueada 🔒 (70%)"}
                        </b>
                      </div>
                    </div>

                    <button
                      className="rounded-xl px-3 py-2 bg-white text-black disabled:opacity-50 w-full"
                      disabled={!unlocked}
                      onClick={() => nav(`/student/module/${m.id}`)}
                      title={
                        !unlocked
                          ? "Completa el módulo anterior al 100% para desbloquear"
                          : "Entrar"
                      }
                    >
                      {unlocked ? "Entrar" : "Bloqueado"}
                    </button>

                    {/* Calificaciones */}
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

                            // ✅ Hacer-Proceso: si docente puso override -> usarlo, si no -> sugerido por progreso
                            const hpFinal =
                              g.hacer_proceso === null ||
                              g.hacer_proceso === undefined
                                ? hpSuggested
                                : num0(g.hacer_proceso);

                            const total = calcTotal(g, hpFinal);

                            return (
                              <table className="min-w-full text-sm">
                                <thead>
                                  <tr className="text-left text-slate-200">
                                    <th className="py-2 pr-3">Ser (10)</th>
                                    <th className="py-2 pr-3">Saber (30)</th>
                                    <th className="py-2 pr-3">
                                      Hacer-Proceso (20)
                                    </th>
                                    <th className="py-2 pr-3">
                                      Hacer-Producto (20)
                                    </th>
                                    <th className="py-2 pr-3">Decidir (10)</th>
                                    <th className="py-2 pr-3">Auto Ser (5)</th>
                                    <th className="py-2 pr-3">
                                      Auto Decidir (5)
                                    </th>
                                    <th className="py-2 pr-3 font-semibold">
                                      Total (100)
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  <tr className="border-t border-slate-800 text-slate-100">
                                    <td className="py-2 pr-3">{num0(g.ser)}</td>
                                    <td className="py-2 pr-3">
                                      {num0(g.saber)}
                                    </td>
                                    <td className="py-2 pr-3">
                                      {hpFinal}
                                      {(g.hacer_proceso === null ||
                                        g.hacer_proceso === undefined) && (
                                        <span className="ml-2 text-xs text-slate-400">
                                          (sugerido por progreso: {hpSuggested})
                                        </span>
                                      )}
                                    </td>
                                    <td className="py-2 pr-3">
                                      {num0(g.hacer_producto)}
                                    </td>
                                    <td className="py-2 pr-3">
                                      {num0(g.decidir)}
                                    </td>
                                    <td className="py-2 pr-3">
                                      {num0(g.auto_ser)}
                                    </td>
                                    <td className="py-2 pr-3">
                                      {num0(g.auto_decidir)}
                                    </td>
                                    <td className="py-2 pr-3 font-semibold">
                                      {total}
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            );
                          })()
                        ) : (
                          <div className="text-sm text-slate-300">
                            Sin calificaciones aún para este módulo.
                            <div className="text-xs text-slate-400 mt-1">
                              Hacer-Proceso sugerido por tu progreso:{" "}
                              {hpSuggested}/20
                            </div>
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
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4">
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
    </div>
  );
}

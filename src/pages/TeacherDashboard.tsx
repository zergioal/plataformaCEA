import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useRole } from "../lib/useRole";

/** =========================
 *  TIPOS
 *  ========================= */
type LevelRow = {
  id: number;
  career_id: number;
  name: string;
  sort_order: number;
};

type ModuleRow = {
  id: number;
  level_id: number;
  title: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
};

type StudentWithLevel = {
  student_id: string;
  code: string | null;
  full_name: string | null;
  first_names: string | null;
  last_name_pat: string | null;
  last_name_mat: string | null;
  level_id: number | null;
  level_name: string | null;
  level_order: number | null;
  enrolled_at: string | null;
};

function studentName(s: StudentWithLevel) {
  const parts = [
    s.first_names?.trim(),
    s.last_name_pat?.trim(),
    s.last_name_mat?.trim(),
  ].filter(Boolean) as string[];
  if (parts.length) return parts.join(" ");
  return s.full_name?.trim() || s.code || s.student_id;
}

function cx(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(" ");
}

/** =========================
 *  SUBCOMPONENTE: Promover
 *  (lo metemos aquí mismo para que no te pierdas)
 *  ========================= */
function PromoteStudentsPanel() {
  const [rows, setRows] = useState<StudentWithLevel[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setMsg(null);

    const res = await supabase
      .from("v_students_with_level")
      .select(
        "student_id,code,full_name,first_names,last_name_pat,last_name_mat,level_id,level_name,level_order,enrolled_at"
      )
      .order("last_name_pat", { ascending: true, nullsFirst: true });

    setLoading(false);

    if (res.error) {
      setMsg(res.error.message);
      setRows([]);
      return;
    }
    setRows((res.data ?? []) as StudentWithLevel[]);
  }

  useEffect(() => {
    load();
  }, []);

  async function promote(studentId: string) {
    setBusyId(studentId);
    setMsg(null);

    const r = await supabase.rpc("promote_student_next_level", {
      p_student: studentId,
    });

    setBusyId(null);

    if (r.error) {
      setMsg("No se pudo promover: " + r.error.message);
      return;
    }

    await load();
  }

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-lg font-bold">Promover estudiantes</div>
          <div className="text-sm text-slate-400">
            Esto crea un nuevo <b>enrollment</b> en el siguiente nivel (por{" "}
            <b>levels.sort_order</b>). No borra nada y conserva el historial.
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Nota: si un estudiante aparece “Sin matrícula”, primero debes
            crearle un enrollment inicial (o inscribirlo desde tu flujo de
            admin).
          </div>
        </div>

        <button
          className="shrink-0 rounded-xl px-3 py-2 border border-slate-800 hover:bg-slate-900 disabled:opacity-60"
          onClick={load}
          disabled={loading}
        >
          {loading ? "Actualizando..." : "Actualizar"}
        </button>
      </div>

      {msg && (
        <pre className="mt-3 text-sm bg-slate-900 border border-slate-800 rounded-xl p-3 whitespace-pre-wrap">
          {msg}
        </pre>
      )}

      <div className="mt-4 overflow-auto rounded-xl border border-slate-800">
        <table className="min-w-[900px] w-full text-sm">
          <thead className="bg-slate-950">
            <tr className="border-b border-slate-800 text-left">
              <th className="p-3">Estudiante</th>
              <th className="p-3">Código</th>
              <th className="p-3">Nivel actual</th>
              <th className="p-3">Acción</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((s) => (
              <tr key={s.student_id} className="border-b border-slate-800">
                <td className="p-3 font-semibold">{studentName(s)}</td>
                <td className="p-3 text-slate-300">{s.code ?? "—"}</td>
                <td className="p-3">
                  {s.level_name ? (
                    <span className="text-slate-100">
                      {s.level_name}{" "}
                      <span className="text-slate-400">
                        (orden {s.level_order ?? "?"})
                      </span>
                    </span>
                  ) : (
                    <span className="text-rose-300">Sin matrícula</span>
                  )}
                </td>
                <td className="p-3">
                  <button
                    className="rounded-xl px-3 py-2 bg-white text-black disabled:opacity-50"
                    disabled={!s.level_id || busyId === s.student_id}
                    onClick={() => promote(s.student_id)}
                    title={
                      !s.level_id
                        ? "El estudiante no tiene matrícula (enrollment)."
                        : "Promover al siguiente nivel"
                    }
                  >
                    {busyId === s.student_id ? "Promoviendo..." : "Promover"}
                  </button>
                </td>
              </tr>
            ))}

            {rows.length === 0 && !loading && (
              <tr>
                <td className="p-4 text-slate-400" colSpan={4}>
                  No hay estudiantes para mostrar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** =========================
 *  PÁGINA: TeacherDashboard
 *  ========================= */
export default function TeacherDashboard() {
  const nav = useNavigate();
  const { loading, session, role } = useRole();

  const isTeacherish = role === "teacher" || role === "admin";

  const [msg, setMsg] = useState<string | null>(null);

  const [levels, setLevels] = useState<LevelRow[]>([]);
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  async function signOut() {
    await supabase.auth.signOut();
    nav("/login", { replace: true });
  }

  async function loadLevelsModules() {
    setLoadingData(true);
    setMsg(null);

    const lv = await supabase
      .from("levels")
      .select("id,career_id,name,sort_order")
      .order("sort_order", { ascending: true });

    if (lv.error) {
      setLoadingData(false);
      setMsg("Error cargando niveles: " + lv.error.message);
      return;
    }

    const md = await supabase
      .from("modules")
      .select("id,level_id,title,description,sort_order,is_active")
      .order("level_id", { ascending: true })
      .order("sort_order", { ascending: true });

    if (md.error) {
      setLoadingData(false);
      setMsg("Error cargando módulos: " + md.error.message);
      return;
    }

    setLevels((lv.data ?? []) as LevelRow[]);
    setModules((md.data ?? []) as ModuleRow[]);
    setLoadingData(false);
  }

  useEffect(() => {
    if (!session) return;
    if (!isTeacherish) return;
    loadLevelsModules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, isTeacherish]);

  const modulesByLevel = useMemo(() => {
    const map = new Map<number, ModuleRow[]>();
    for (const m of modules) {
      const arr = map.get(m.level_id) ?? [];
      arr.push(m);
      map.set(m.level_id, arr);
    }
    return map;
  }, [modules]);

  if (loading) return <div className="p-6">Cargando...</div>;
  if (!session) return <Navigate to="/login" replace />;
  if (!isTeacherish) return <Navigate to="/student" replace />;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-950">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm text-slate-400">Panel Docente</div>
            <div className="text-2xl font-bold">Teacher Dashboard</div>
            <div className="text-sm text-slate-300">
              Selecciona un módulo para revisar calificaciones o promover
              estudiantes al siguiente nivel.
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              className="rounded-xl px-3 py-2 border border-slate-800 hover:bg-slate-900"
              onClick={loadLevelsModules}
              disabled={loadingData}
            >
              {loadingData ? "Actualizando..." : "Actualizar"}
            </button>
            <button
              className="rounded-xl px-3 py-2 bg-white text-black"
              onClick={signOut}
            >
              Salir
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {msg && (
          <pre className="text-sm bg-slate-900 border border-slate-800 rounded-xl p-3 whitespace-pre-wrap">
            {msg}
          </pre>
        )}

        {/* Panel de promover estudiantes */}
        <PromoteStudentsPanel />

        {/* Niveles y módulos */}
        <section className="space-y-4">
          <div className="text-lg font-bold">Módulos por nivel</div>

          {loadingData ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6">
              Cargando niveles y módulos...
            </div>
          ) : levels.length === 0 ? (
            <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6">
              No hay niveles registrados.
            </div>
          ) : (
            <div className="space-y-4">
              {levels.map((lv) => {
                const ms = modulesByLevel.get(lv.id) ?? [];
                return (
                  <div
                    key={lv.id}
                    className="rounded-2xl border border-slate-800 bg-slate-950"
                  >
                    <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
                      <div>
                        <div className="text-sm text-slate-400">
                          Nivel {lv.sort_order}
                        </div>
                        <div className="text-xl font-bold">{lv.name}</div>
                      </div>
                      <div className="text-sm text-slate-400">
                        {ms.length} módulo(s)
                      </div>
                    </div>

                    <div className="p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {ms.map((m) => (
                        <div
                          key={m.id}
                          className={cx(
                            "rounded-2xl border p-4",
                            m.is_active
                              ? "border-slate-800 bg-slate-950"
                              : "border-slate-800 bg-slate-950 opacity-60"
                          )}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-xs text-slate-400">
                                Módulo {m.sort_order}
                              </div>
                              <div className="font-bold text-lg">{m.title}</div>
                              {m.description && (
                                <div className="text-sm text-slate-300 mt-1">
                                  {m.description}
                                </div>
                              )}
                            </div>
                            {!m.is_active && (
                              <span className="text-xs px-2 py-1 rounded-full border border-slate-700 text-slate-300">
                                Inactivo
                              </span>
                            )}
                          </div>

                          <div className="mt-4 flex gap-2">
                            <button
                              className="rounded-xl px-3 py-2 bg-white text-black disabled:opacity-50"
                              disabled={!m.is_active}
                              onClick={() =>
                                nav(`/teacher/module/${m.id}/grades`)
                              }
                            >
                              Calificaciones
                            </button>

                            <button
                              className="rounded-xl px-3 py-2 border border-slate-800 hover:bg-slate-900"
                              onClick={() => nav(`/student/module/${m.id}`)}
                              title="Abrir como visor del módulo (útil para revisar contenido)"
                            >
                              Ver módulo
                            </button>
                          </div>
                        </div>
                      ))}

                      {ms.length === 0 && (
                        <div className="text-slate-400">
                          No hay módulos cargados para este nivel.
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

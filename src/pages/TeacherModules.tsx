// cea-plataforma/web/src/pages/TeacherModules.tsx
// 🎨 Lista de módulos en tema oscuro

import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useRole } from "../lib/useRole";

type Level = {
  id: number;
  name: string;
  sort_order: number;
  career_id: number;
};

type Module = {
  id: number;
  level_id: number;
  title: string;
  description: string | null;
  sort_order: number;
  is_active: boolean | null;
};

type LevelWithModules = {
  level: Level;
  modules: Module[];
};

export default function TeacherModules() {
  const nav = useNavigate();
  const { loading, session, role } = useRole();

  const [data, setData] = useState<LevelWithModules[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const isTeacherish = role === "teacher" || role === "admin";

  useEffect(() => {
    if (!session || !isTeacherish) return;

    async function load() {
      setLoadingData(true);
      setMsg(null);

      try {
        const { data: teacherProfile, error: profError } = await supabase
          .from("profiles")
          .select("career_id")
          .eq("id", session.user.id)
          .single();

        if (profError || !teacherProfile?.career_id) {
          setMsg("Error: No se pudo cargar tu carrera");
          setLoadingData(false);
          return;
        }

        const { data: levels, error: levelsError } = await supabase
          .from("levels")
          .select("id,name,sort_order,career_id")
          .eq("career_id", teacherProfile.career_id)
          .order("sort_order");

        if (levelsError) {
          setMsg("Error cargando niveles: " + levelsError.message);
          setLoadingData(false);
          return;
        }

        const levelsList = (levels ?? []) as Level[];
        const levelsWithModules: LevelWithModules[] = [];

        for (const level of levelsList) {
          const { data: modules, error: modulesError } = await supabase
            .from("modules")
            .select("id,level_id,title,description,sort_order,is_active")
            .eq("level_id", level.id)
            .order("sort_order");

          if (!modulesError) {
            levelsWithModules.push({
              level,
              modules: (modules ?? []) as Module[],
            });
          }
        }

        setData(levelsWithModules);
        setLoadingData(false);
      } catch (error) {
        console.error("Error:", error);
        setMsg("Error cargando datos");
        setLoadingData(false);
      }
    }

    load();
  }, [session, isTeacherish]);

  if (loading)
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-300">Cargando...</div>
      </div>
    );

  if (!session) return <Navigate to="/login" replace />;
  if (!isTeacherish) return <Navigate to="/student" replace />;

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-800 border-b border-slate-800/50 shadow-xl">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <button
            className="flex items-center gap-2 text-slate-300 hover:text-white mb-4 transition-colors group"
            onClick={() => nav("/teacher")}
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
            <span className="font-medium">Volver al Panel</span>
          </button>

          <div className="text-slate-400 text-sm font-medium mb-1">
            CEA Madre María Oliva
          </div>
          <h1 className="text-3xl font-bold text-white">Módulos por Nivel</h1>
          <p className="text-slate-400 mt-2">
            Selecciona un módulo para gestionar las calificaciones
          </p>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-6">
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
            <div className="text-slate-300 text-lg">Cargando módulos...</div>
          </div>
        ) : data.length === 0 ? (
          <div className="bg-slate-900 rounded-2xl border border-slate-700/50 p-12 text-center">
            <div className="text-6xl mb-4 opacity-20">📚</div>
            <div className="text-xl font-semibold text-white mb-2">
              No hay módulos disponibles
            </div>
            <div className="text-slate-400">
              Contacta al administrador para configurar los módulos
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {data.map(({ level, modules }) => (
              <section
                key={level.id}
                className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl border border-slate-700/50 p-8 shadow-2xl"
              >
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-blue-900/50">
                    {level.sort_order}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">
                      {level.name}
                    </h2>
                    <p className="text-slate-400 text-sm">
                      {modules.length} módulos
                    </p>
                  </div>
                </div>

                {modules.length === 0 ? (
                  <div className="p-6 bg-slate-800/30 rounded-xl border border-slate-700/30 text-center">
                    <p className="text-slate-400">
                      No hay módulos en este nivel
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {modules
                      .filter((m) => m.is_active !== false)
                      .sort((a, b) => a.sort_order - b.sort_order)
                      .map((module) => (
                        <button
                          key={module.id}
                          className="group p-6 bg-slate-800/30 hover:bg-slate-800/50 border border-slate-700/30 hover:border-slate-600 rounded-xl text-left transition-all duration-200"
                          onClick={() =>
                            nav(`/teacher/module/${module.id}/grades`)
                          }
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-600/20 to-emerald-700/20 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold group-hover:scale-110 transition-transform">
                              {module.sort_order}
                            </div>
                            <svg
                              className="w-5 h-5 text-slate-500 group-hover:text-white group-hover:translate-x-1 transition-all"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 5l7 7-7 7"
                              />
                            </svg>
                          </div>

                          <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-blue-400 transition-colors">
                            {module.title}
                          </h3>

                          {module.description && (
                            <p className="text-sm text-slate-400 line-clamp-2">
                              {module.description}
                            </p>
                          )}

                          <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
                            <span>Click para ver calificaciones</span>
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
                                d="M9 5l7 7-7 7"
                              />
                            </svg>
                          </div>
                        </button>
                      ))}
                  </div>
                )}
              </section>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

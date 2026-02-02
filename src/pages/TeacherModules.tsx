// cea-plataforma/web/src/pages/TeacherModules.tsx
// 🎨 Lista de módulos en tema oscuro

import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useRole } from "../lib/useRole";
import logoCea from "../assets/logo-cea.png";

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
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  const isTeacherish = role === "teacher" || role === "admin";

  useEffect(() => {
    if (!session || !isTeacherish || initialLoadDone) return;

    async function load() {
      setLoadingData(true);
      setMsg(null);

      try {
        const { data: teacherProfile, error: profError } = await supabase
          .from("profiles")
          .select("career_id")
          .eq("id", session!.user.id)
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
        setInitialLoadDone(true);
      } catch {
        setMsg("Error cargando datos");
        setLoadingData(false);
      }
    }

    load();
  }, [session, isTeacherish, initialLoadDone]);

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
      {/* Header - RESPONSIVE */}
      <header className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-800 border-b border-slate-800/50 shadow-xl">
        <div className="px-4 sm:px-6 py-4 sm:py-6">
          <button
            className="flex items-center gap-2 text-slate-300 hover:text-white mb-3 sm:mb-4 transition-colors group text-sm sm:text-base"
            onClick={() => nav("/teacher")}
          >
            <svg
              className="w-4 h-4 sm:w-5 sm:h-5 transition-transform group-hover:-translate-x-1"
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
            <span className="font-medium">Volver</span>
          </button>

          <div className="flex items-center gap-3 sm:gap-4">
            <img
              src={logoCea}
              alt="CEA Logo"
              className="h-24 w-24 sm:h-32 sm:w-32 lg:h-40 lg:w-40 rounded-xl object-contain p-1"
            />
            <div>
              <div className="text-slate-400 text-xs sm:text-sm font-medium mb-1 tracking-wide uppercase">
                CEA Madre María Oliva
              </div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-display font-bold text-white tracking-tight">
                Calificaciones por Módulos
              </h1>
            </div>
          </div>
          <p className="text-slate-400 mt-2 ml-0 sm:ml-16 text-sm sm:text-base">
            Selecciona un módulo para gestionar las calificaciones
          </p>
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
          <div className="space-y-6 sm:space-y-8">
            {data.map(({ level, modules }) => (
              <section
                key={level.id}
                className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl border border-slate-700/50 p-4 sm:p-6 lg:p-8 shadow-2xl"
              >
                <div className="flex items-center gap-3 sm:gap-4 mb-4 sm:mb-6">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center text-white font-bold text-lg sm:text-xl shadow-lg shadow-blue-900/50 flex-shrink-0">
                    {level.sort_order}
                  </div>
                  <div>
                    <h2 className="text-xl sm:text-2xl font-display font-bold text-white tracking-tight">
                      {level.name}
                    </h2>
                    <p className="text-slate-400 text-xs sm:text-sm font-medium">
                      {modules.length} módulos
                    </p>
                  </div>
                </div>

                {modules.length === 0 ? (
                  <div className="p-4 sm:p-6 bg-slate-800/30 rounded-xl border border-slate-700/30 text-center">
                    <p className="text-slate-400 text-sm sm:text-base">
                      No hay módulos en este nivel
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4">
                    {modules
                      .filter((m) => m.is_active !== false)
                      .sort((a, b) => a.sort_order - b.sort_order)
                      .map((module) => (
                        <button
                          key={module.id}
                          className="group p-4 sm:p-6 bg-slate-800/30 hover:bg-slate-800/50 border border-slate-700/30 hover:border-slate-600 rounded-xl text-left transition-all duration-200"
                          onClick={() =>
                            nav(`/teacher/module/${module.id}/grades`)
                          }
                        >
                          <div className="flex items-start justify-between mb-2 sm:mb-3">
                            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-gradient-to-br from-emerald-600/20 to-emerald-700/20 border border-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-sm sm:text-base group-hover:scale-110 transition-transform">
                              {module.sort_order}
                            </div>
                            <svg
                              className="w-4 h-4 sm:w-5 sm:h-5 text-slate-500 group-hover:text-white group-hover:translate-x-1 transition-all"
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

                          <h3 className="text-base sm:text-lg font-display font-semibold text-white mb-1 sm:mb-2 group-hover:text-blue-400 transition-colors tracking-tight line-clamp-2">
                            {module.title}
                          </h3>

                          {module.description && (
                            <p className="text-xs sm:text-sm text-slate-400 line-clamp-2">
                              {module.description}
                            </p>
                          )}

                          <div className="mt-3 sm:mt-4 flex items-center gap-2 text-xs text-slate-500">
                            <span className="hidden sm:inline">
                              Click para ver calificaciones
                            </span>
                            <span className="sm:hidden">
                              Ver calificaciones
                            </span>
                            <svg
                              className="w-3 h-3 sm:w-4 sm:h-4"
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

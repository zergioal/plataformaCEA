// cea-plataforma/web/src/pages/AdminContentManager.tsx
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useRole } from "../lib/useRole";

type Career = { id: number; name: string };
type Level = {
  id: number;
  career_id: number;
  name: string;
  sort_order: number;
};
type Module = {
  id: number;
  level_id: number;
  title: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
};
type Lesson = {
  id: number;
  module_id: number;
  title: string;
  sort_order: number;
  is_required: boolean;
};
type Section = {
  id: number;
  lesson_id: number;
  title: string;
  kind: string;
  content_json: any;
  sort_order: number;
  is_active: boolean;
};

export default function AdminContentManager() {
  const { loading, session, role } = useRole();
  const isAdmin = role === "admin";

  const [careers, setCareers] = useState<Career[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [modules, setModules] = useState<Module[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [sections, setSections] = useState<Section[]>([]);

  const [selectedCareer, setSelectedCareer] = useState<number | null>(null);
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null);
  const [selectedModule, setSelectedModule] = useState<number | null>(null);
  const [selectedLesson, setSelectedLesson] = useState<number | null>(null);

  const [view, setView] = useState<
    "careers" | "levels" | "modules" | "lessons" | "sections"
  >("careers");
  const [msg, setMsg] = useState<string | null>(null);

  // Formularios
  const [showCareerForm, setShowCareerForm] = useState(false);
  const [careerName, setCareerName] = useState("");
  const [careerPrefix, setCareerPrefix] = useState("");

  const [showLevelForm, setShowLevelForm] = useState(false);
  const [levelName, setLevelName] = useState("");
  const [levelOrder, setLevelOrder] = useState(1);

  const [showModuleForm, setShowModuleForm] = useState(false);
  const [moduleTitle, setModuleTitle] = useState("");
  const [moduleDesc, setModuleDesc] = useState("");
  const [moduleOrder, setModuleOrder] = useState(1);

  const [showLessonForm, setShowLessonForm] = useState(false);
  const [lessonTitle, setLessonTitle] = useState("");
  const [lessonOrder, setLessonOrder] = useState(1);

  const [showSectionForm, setShowSectionForm] = useState(false);
  const [sectionTitle, setSectionTitle] = useState("");
  const [sectionKind, setSectionKind] = useState<
    "text" | "video" | "image" | "link" | "quiz"
  >("text");
  const [sectionOrder, setSectionOrder] = useState(1);
  const [sectionContent, setSectionContent] = useState("");

  async function loadCareers() {
    const res = await supabase.from("careers").select("*").order("name");
    if (res.error) {
      setMsg("Error cargando carreras: " + res.error.message);
      return;
    }
    setCareers(res.data ?? []);
  }

  async function loadLevels() {
    if (!selectedCareer) return;
    const res = await supabase
      .from("levels")
      .select("*")
      .eq("career_id", selectedCareer)
      .order("sort_order");
    if (res.error) {
      setMsg("Error cargando niveles: " + res.error.message);
      return;
    }
    setLevels(res.data ?? []);
  }

  async function loadModules() {
    if (!selectedLevel) return;
    const res = await supabase
      .from("modules")
      .select("*")
      .eq("level_id", selectedLevel)
      .order("sort_order");
    if (res.error) {
      setMsg("Error cargando módulos: " + res.error.message);
      return;
    }
    setModules(res.data ?? []);
  }

  async function loadLessons() {
    if (!selectedModule) return;
    const res = await supabase
      .from("lessons")
      .select("*")
      .eq("module_id", selectedModule)
      .order("sort_order");
    if (res.error) {
      setMsg("Error cargando lecciones: " + res.error.message);
      return;
    }
    setLessons(res.data ?? []);
  }

  async function loadSections() {
    if (!selectedLesson) return;
    const res = await supabase
      .from("lesson_sections")
      .select("*")
      .eq("lesson_id", selectedLesson)
      .order("sort_order");
    if (res.error) {
      setMsg("Error cargando secciones: " + res.error.message);
      return;
    }
    setSections(res.data ?? []);
  }

  useEffect(() => {
    if (session && isAdmin) loadCareers();
  }, [session, isAdmin]);

  useEffect(() => {
    if (selectedCareer) loadLevels();
  }, [selectedCareer]);

  useEffect(() => {
    if (selectedLevel) loadModules();
  }, [selectedLevel]);

  useEffect(() => {
    if (selectedModule) loadLessons();
  }, [selectedModule]);

  useEffect(() => {
    if (selectedLesson) loadSections();
  }, [selectedLesson]);

  async function createCareer() {
    if (!careerName.trim() || !careerPrefix.trim()) {
      setMsg("Completa nombre y prefijo");
      return;
    }

    const res = await supabase
      .from("careers")
      .insert({ name: careerName, student_prefix: careerPrefix.toUpperCase() });

    if (res.error) {
      setMsg("Error: " + res.error.message);
      return;
    }

    setMsg("✅ Carrera creada");
    setShowCareerForm(false);
    setCareerName("");
    setCareerPrefix("");
    loadCareers();
  }

  async function createLevel() {
    if (!selectedCareer || !levelName.trim()) {
      setMsg("Selecciona carrera y completa nombre");
      return;
    }

    const res = await supabase.from("levels").insert({
      career_id: selectedCareer,
      name: levelName,
      sort_order: levelOrder,
    });

    if (res.error) {
      setMsg("Error: " + res.error.message);
      return;
    }

    setMsg("✅ Nivel creado");
    setShowLevelForm(false);
    setLevelName("");
    setLevelOrder(1);
    loadLevels();
  }

  async function createModule() {
    if (!selectedLevel || !moduleTitle.trim()) {
      setMsg("Selecciona nivel y completa título");
      return;
    }

    const res = await supabase.from("modules").insert({
      level_id: selectedLevel,
      title: moduleTitle,
      description: moduleDesc || null,
      sort_order: moduleOrder,
      is_active: true,
    });

    if (res.error) {
      setMsg("Error: " + res.error.message);
      return;
    }

    setMsg("✅ Módulo creado");
    setShowModuleForm(false);
    setModuleTitle("");
    setModuleDesc("");
    setModuleOrder(1);
    loadModules();
  }

  async function createLesson() {
    if (!selectedModule || !lessonTitle.trim()) {
      setMsg("Selecciona módulo y completa título");
      return;
    }

    const res = await supabase.from("lessons").insert({
      module_id: selectedModule,
      title: lessonTitle,
      sort_order: lessonOrder,
      is_required: true,
    });

    if (res.error) {
      setMsg("Error: " + res.error.message);
      return;
    }

    setMsg("✅ Lección creada");
    setShowLessonForm(false);
    setLessonTitle("");
    setLessonOrder(1);
    loadLessons();
  }

  async function createSection() {
    if (!selectedLesson || !sectionTitle.trim()) {
      setMsg("Selecciona lección y completa título");
      return;
    }

    let content_json: any = {};

    if (sectionKind === "text") {
      content_json = { text: sectionContent };
    } else if (sectionKind === "video") {
      content_json = { url: sectionContent, title: sectionTitle };
    } else if (sectionKind === "image") {
      content_json = { url: sectionContent };
    } else if (sectionKind === "link") {
      content_json = { url: sectionContent, label: sectionTitle };
    } else if (sectionKind === "quiz") {
      try {
        content_json = JSON.parse(sectionContent);
      } catch {
        setMsg("Error: contenido quiz debe ser JSON válido");
        return;
      }
    }

    const res = await supabase.from("lesson_sections").insert({
      lesson_id: selectedLesson,
      title: sectionTitle,
      kind: sectionKind,
      content_json,
      sort_order: sectionOrder,
      is_active: true,
    });

    if (res.error) {
      setMsg("Error: " + res.error.message);
      return;
    }

    setMsg("✅ Sección creada");
    setShowSectionForm(false);
    setSectionTitle("");
    setSectionContent("");
    setSectionOrder(1);
    loadSections();
  }

  async function deleteCareer(id: number) {
    if (
      !confirm(
        "¿Eliminar carrera? Esto eliminará niveles, módulos y lecciones relacionadas.",
      )
    )
      return;
    const res = await supabase.from("careers").delete().eq("id", id);
    if (res.error) {
      setMsg("Error: " + res.error.message);
      return;
    }
    setMsg("✅ Carrera eliminada");
    loadCareers();
  }

  async function deleteLevel(id: number) {
    if (
      !confirm(
        "¿Eliminar nivel? Esto eliminará módulos y lecciones relacionadas.",
      )
    )
      return;
    const res = await supabase.from("levels").delete().eq("id", id);
    if (res.error) {
      setMsg("Error: " + res.error.message);
      return;
    }
    setMsg("✅ Nivel eliminado");
    loadLevels();
  }

  async function deleteModule(id: number) {
    if (!confirm("¿Eliminar módulo? Esto eliminará lecciones relacionadas."))
      return;
    const res = await supabase.from("modules").delete().eq("id", id);
    if (res.error) {
      setMsg("Error: " + res.error.message);
      return;
    }
    setMsg("✅ Módulo eliminado");
    loadModules();
  }

  async function deleteLesson(id: number) {
    if (!confirm("¿Eliminar lección? Esto eliminará secciones relacionadas."))
      return;
    const res = await supabase.from("lessons").delete().eq("id", id);
    if (res.error) {
      setMsg("Error: " + res.error.message);
      return;
    }
    setMsg("✅ Lección eliminada");
    loadLessons();
  }

  async function deleteSection(id: number) {
    if (!confirm("¿Eliminar sección?")) return;
    const res = await supabase.from("lesson_sections").delete().eq("id", id);
    if (res.error) {
      setMsg("Error: " + res.error.message);
      return;
    }
    setMsg("✅ Sección eliminada");
    loadSections();
  }

  if (loading) return <div className="p-6">Cargando...</div>;
  if (!session) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/teacher" replace />;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="bg-slate-950 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="text-sm text-slate-400">Panel Administrador</div>
          <h1 className="text-2xl font-bold">Gestión de Contenido</h1>
          <div className="text-sm text-slate-300 mt-1">
            Administra carreras, niveles, módulos, lecciones y secciones
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {msg && (
          <div
            className={
              "text-sm rounded-xl p-3 " +
              (msg.includes("✅")
                ? "bg-emerald-950 border border-emerald-800 text-emerald-200"
                : "bg-rose-950 border border-rose-800 text-rose-200")
            }
          >
            {msg}
          </div>
        )}

        {/* Navegación en breadcrumbs */}
        <div className="flex items-center gap-2 text-sm">
          <button
            className="text-slate-400 hover:text-white"
            onClick={() => {
              setView("careers");
              setSelectedCareer(null);
              setSelectedLevel(null);
              setSelectedModule(null);
              setSelectedLesson(null);
            }}
          >
            Carreras
          </button>
          {selectedCareer && (
            <>
              <span className="text-slate-600">/</span>
              <button
                className="text-slate-400 hover:text-white"
                onClick={() => {
                  setView("levels");
                  setSelectedLevel(null);
                  setSelectedModule(null);
                  setSelectedLesson(null);
                }}
              >
                Niveles
              </button>
            </>
          )}
          {selectedLevel && (
            <>
              <span className="text-slate-600">/</span>
              <button
                className="text-slate-400 hover:text-white"
                onClick={() => {
                  setView("modules");
                  setSelectedModule(null);
                  setSelectedLesson(null);
                }}
              >
                Módulos
              </button>
            </>
          )}
          {selectedModule && (
            <>
              <span className="text-slate-600">/</span>
              <button
                className="text-slate-400 hover:text-white"
                onClick={() => {
                  setView("lessons");
                  setSelectedLesson(null);
                }}
              >
                Lecciones
              </button>
            </>
          )}
          {selectedLesson && (
            <>
              <span className="text-slate-600">/</span>
              <span className="text-white">Secciones</span>
            </>
          )}
        </div>

        {/* CARRERAS */}
        {view === "careers" && (
          <section className="bg-slate-950 rounded-2xl border border-slate-800 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Carreras</h2>
              <button
                className="rounded-xl px-3 py-2 bg-white text-black"
                onClick={() => setShowCareerForm(true)}
              >
                + Nueva Carrera
              </button>
            </div>

            {showCareerForm && (
              <div className="rounded-2xl border border-slate-700 p-4 space-y-3 bg-slate-900">
                <h3 className="font-semibold">Crear Carrera</h3>
                <input
                  className="w-full rounded-xl px-3 py-2 bg-slate-950 border border-slate-800"
                  placeholder="Nombre (ej: Sistemas Informáticos)"
                  value={careerName}
                  onChange={(e) => setCareerName(e.target.value)}
                />
                <input
                  className="w-full rounded-xl px-3 py-2 bg-slate-950 border border-slate-800"
                  placeholder="Prefijo estudiante (ej: SI)"
                  value={careerPrefix}
                  onChange={(e) => setCareerPrefix(e.target.value)}
                />
                <div className="flex gap-2">
                  <button
                    className="rounded-xl px-3 py-2 bg-white text-black"
                    onClick={createCareer}
                  >
                    Crear
                  </button>
                  <button
                    className="rounded-xl px-3 py-2 border border-slate-800"
                    onClick={() => setShowCareerForm(false)}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {careers.map((c) => (
                <div
                  key={c.id}
                  className="rounded-2xl border border-slate-800 p-4 hover:bg-slate-900 cursor-pointer"
                  onClick={() => {
                    setSelectedCareer(c.id);
                    setView("levels");
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-bold">{c.name}</div>
                      <div className="text-sm text-slate-400">ID: {c.id}</div>
                    </div>
                    <button
                      className="rounded-xl px-2 py-1 border border-rose-800 text-rose-400 text-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteCareer(c.id);
                      }}
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* NIVELES */}
        {view === "levels" && selectedCareer && (
          <section className="bg-slate-950 rounded-2xl border border-slate-800 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">
                Niveles de {careers.find((c) => c.id === selectedCareer)?.name}
              </h2>
              <button
                className="rounded-xl px-3 py-2 bg-white text-black"
                onClick={() => setShowLevelForm(true)}
              >
                + Nuevo Nivel
              </button>
            </div>

            {showLevelForm && (
              <div className="rounded-2xl border border-slate-700 p-4 space-y-3 bg-slate-900">
                <h3 className="font-semibold">Crear Nivel</h3>
                <input
                  className="w-full rounded-xl px-3 py-2 bg-slate-950 border border-slate-800"
                  placeholder="Nombre (ej: Técnico Básico)"
                  value={levelName}
                  onChange={(e) => setLevelName(e.target.value)}
                />
                <input
                  type="number"
                  className="w-full rounded-xl px-3 py-2 bg-slate-950 border border-slate-800"
                  placeholder="Orden (1, 2, 3...)"
                  value={levelOrder}
                  onChange={(e) => setLevelOrder(Number(e.target.value))}
                />
                <div className="flex gap-2">
                  <button
                    className="rounded-xl px-3 py-2 bg-white text-black"
                    onClick={createLevel}
                  >
                    Crear
                  </button>
                  <button
                    className="rounded-xl px-3 py-2 border border-slate-800"
                    onClick={() => setShowLevelForm(false)}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {levels.map((l) => (
                <div
                  key={l.id}
                  className="rounded-2xl border border-slate-800 p-4 hover:bg-slate-900 cursor-pointer"
                  onClick={() => {
                    setSelectedLevel(l.id);
                    setView("modules");
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-bold">{l.name}</div>
                      <div className="text-sm text-slate-400">
                        Orden: {l.sort_order}
                      </div>
                    </div>
                    <button
                      className="rounded-xl px-2 py-1 border border-rose-800 text-rose-400 text-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteLevel(l.id);
                      }}
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* MÓDULOS */}
        {view === "modules" && selectedLevel && (
          <section className="bg-slate-950 rounded-2xl border border-slate-800 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">
                Módulos de {levels.find((l) => l.id === selectedLevel)?.name}
              </h2>
              <button
                className="rounded-xl px-3 py-2 bg-white text-black"
                onClick={() => setShowModuleForm(true)}
              >
                + Nuevo Módulo
              </button>
            </div>

            {showModuleForm && (
              <div className="rounded-2xl border border-slate-700 p-4 space-y-3 bg-slate-900">
                <h3 className="font-semibold">Crear Módulo</h3>
                <input
                  className="w-full rounded-xl px-3 py-2 bg-slate-950 border border-slate-800"
                  placeholder="Título"
                  value={moduleTitle}
                  onChange={(e) => setModuleTitle(e.target.value)}
                />
                <textarea
                  className="w-full rounded-xl px-3 py-2 bg-slate-950 border border-slate-800"
                  placeholder="Descripción (opcional)"
                  rows={3}
                  value={moduleDesc}
                  onChange={(e) => setModuleDesc(e.target.value)}
                />
                <input
                  type="number"
                  className="w-full rounded-xl px-3 py-2 bg-slate-950 border border-slate-800"
                  placeholder="Orden"
                  value={moduleOrder}
                  onChange={(e) => setModuleOrder(Number(e.target.value))}
                />
                <div className="flex gap-2">
                  <button
                    className="rounded-xl px-3 py-2 bg-white text-black"
                    onClick={createModule}
                  >
                    Crear
                  </button>
                  <button
                    className="rounded-xl px-3 py-2 border border-slate-800"
                    onClick={() => setShowModuleForm(false)}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {modules.map((m) => (
                <div
                  key={m.id}
                  className="rounded-2xl border border-slate-800 p-4 hover:bg-slate-900 cursor-pointer"
                  onClick={() => {
                    setSelectedModule(m.id);
                    setView("lessons");
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-bold">{m.title}</div>
                      <div className="text-sm text-slate-400">
                        Orden: {m.sort_order}
                      </div>
                      {m.description && (
                        <div className="text-sm text-slate-500 mt-1">
                          {m.description}
                        </div>
                      )}
                    </div>
                    <button
                      className="rounded-xl px-2 py-1 border border-rose-800 text-rose-400 text-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteModule(m.id);
                      }}
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* LECCIONES */}
        {view === "lessons" && selectedModule && (
          <section className="bg-slate-950 rounded-2xl border border-slate-800 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">
                Lecciones de{" "}
                {modules.find((m) => m.id === selectedModule)?.title}
              </h2>
              <button
                className="rounded-xl px-3 py-2 bg-white text-black"
                onClick={() => setShowLessonForm(true)}
              >
                + Nueva Lección
              </button>
            </div>

            {showLessonForm && (
              <div className="rounded-2xl border border-slate-700 p-4 space-y-3 bg-slate-900">
                <h3 className="font-semibold">Crear Lección</h3>
                <input
                  className="w-full rounded-xl px-3 py-2 bg-slate-950 border border-slate-800"
                  placeholder="Título"
                  value={lessonTitle}
                  onChange={(e) => setLessonTitle(e.target.value)}
                />
                <input
                  type="number"
                  className="w-full rounded-xl px-3 py-2 bg-slate-950 border border-slate-800"
                  placeholder="Orden"
                  value={lessonOrder}
                  onChange={(e) => setLessonOrder(Number(e.target.value))}
                />
                <div className="flex gap-2">
                  <button
                    className="rounded-xl px-3 py-2 bg-white text-black"
                    onClick={createLesson}
                  >
                    Crear
                  </button>
                  <button
                    className="rounded-xl px-3 py-2 border border-slate-800"
                    onClick={() => setShowLessonForm(false)}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {lessons.map((l) => (
                <div
                  key={l.id}
                  className="rounded-2xl border border-slate-800 p-4 hover:bg-slate-900 cursor-pointer"
                  onClick={() => {
                    setSelectedLesson(l.id);
                    setView("sections");
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-bold">{l.title}</div>
                      <div className="text-sm text-slate-400">
                        Orden: {l.sort_order}
                      </div>
                    </div>
                    <button
                      className="rounded-xl px-2 py-1 border border-rose-800 text-rose-400 text-sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteLesson(l.id);
                      }}
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* SECCIONES */}
        {view === "sections" && selectedLesson && (
          <section className="bg-slate-950 rounded-2xl border border-slate-800 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">
                Secciones de{" "}
                {lessons.find((l) => l.id === selectedLesson)?.title}
              </h2>
              <button
                className="rounded-xl px-3 py-2 bg-white text-black"
                onClick={() => setShowSectionForm(true)}
              >
                + Nueva Sección
              </button>
            </div>

            {showSectionForm && (
              <div className="rounded-2xl border border-slate-700 p-4 space-y-3 bg-slate-900">
                <h3 className="font-semibold">Crear Sección</h3>
                <input
                  className="w-full rounded-xl px-3 py-2 bg-slate-950 border border-slate-800"
                  placeholder="Título"
                  value={sectionTitle}
                  onChange={(e) => setSectionTitle(e.target.value)}
                />
                <select
                  className="w-full rounded-xl px-3 py-2 bg-slate-950 border border-slate-800"
                  value={sectionKind}
                  onChange={(e) =>
                    setSectionKind(
                      e.target.value as
                        | "text"
                        | "video"
                        | "image"
                        | "link"
                        | "quiz",
                    )
                  }
                >
                  <option value="text">Texto</option>
                  <option value="video">Video (YouTube)</option>
                  <option value="image">Imagen (URL)</option>
                  <option value="link">Enlace (Google Drive, etc)</option>
                  <option value="quiz">Quiz (JSON)</option>
                </select>
                <textarea
                  className="w-full rounded-xl px-3 py-2 bg-slate-950 border border-slate-800"
                  placeholder={
                    sectionKind === "text"
                      ? "Contenido de texto..."
                      : sectionKind === "video"
                        ? "URL de YouTube"
                        : sectionKind === "image"
                          ? "URL de imagen"
                          : sectionKind === "link"
                            ? "URL del enlace"
                            : 'Quiz en JSON: {"question":"...", "options":["a","b"], "answer":0}'
                  }
                  rows={sectionKind === "quiz" ? 8 : 4}
                  value={sectionContent}
                  onChange={(e) => setSectionContent(e.target.value)}
                />
                <input
                  type="number"
                  className="w-full rounded-xl px-3 py-2 bg-slate-950 border border-slate-800"
                  placeholder="Orden"
                  value={sectionOrder}
                  onChange={(e) => setSectionOrder(Number(e.target.value))}
                />
                <div className="flex gap-2">
                  <button
                    className="rounded-xl px-3 py-2 bg-white text-black"
                    onClick={createSection}
                  >
                    Crear
                  </button>
                  <button
                    className="rounded-xl px-3 py-2 border border-slate-800"
                    onClick={() => setShowSectionForm(false)}
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-3">
              {sections.map((s) => (
                <div
                  key={s.id}
                  className="rounded-2xl border border-slate-800 p-4"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <div className="font-bold">{s.title}</div>
                        <span className="text-xs px-2 py-1 rounded-full bg-slate-800 border border-slate-700">
                          {s.kind}
                        </span>
                      </div>
                      <div className="text-sm text-slate-400 mt-1">
                        Orden: {s.sort_order}
                      </div>
                      <div className="text-xs text-slate-500 mt-2">
                        {JSON.stringify(s.content_json).substring(0, 100)}...
                      </div>
                    </div>
                    <button
                      className="rounded-xl px-2 py-1 border border-rose-800 text-rose-400 text-sm"
                      onClick={() => deleteSection(s.id)}
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

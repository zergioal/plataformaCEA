// cea-plataforma/web/src/pages/TeacherContentManager.tsx
// Gestión de contenido para docentes - Solo edita módulos de su carrera

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useRole } from "../lib/useRole";

// ========== TIPOS ==========
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
  is_active: boolean;
};

type Lesson = {
  id: number;
  module_id: number;
  title: string;
  sort_order: number;
  is_required: boolean;
};

type ContentJson = {
  text?: string;
  url?: string;
  title?: string;
  alt?: string;
  label?: string;
  html?: string;
  driveId?: string;
  originalUrl?: string;
};

type SectionDimension = "hacer_proceso" | "hacer_producto" | "saber" | "auto_ser" | "auto_decidir";

type Section = {
  id: number;
  lesson_id: number;
  title: string;
  kind: "text" | "video" | "image" | "link" | "html" | "drive" | "quiz" | "autoevaluacion";
  content_json: ContentJson;
  sort_order: number;
  is_active: boolean;
  dimension: SectionDimension;
};

type SectionKind = "text" | "video" | "image" | "link" | "html" | "drive" | "quiz" | "autoevaluacion";

type QuizOption = {
  id?: number;
  option_text: string;
  is_correct: boolean;
};

type QuizQuestion = {
  id?: number;
  question: string;
  sort_order: number;
  options: QuizOption[];
};

// ========== ESTILOS MODO OSCURO ==========
const styles = {
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
    padding: "16px 24px",
  },
  card: {
    background: "rgba(25, 25, 25, 0.95)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    borderRadius: "12px",
    padding: "24px",
  },
  input: {
    background: "rgba(30, 30, 30, 0.95)",
    border: "1px solid rgba(255, 255, 255, 0.15)",
    color: "#e4e4e7",
    borderRadius: "8px",
    padding: "10px 14px",
    width: "100%",
    fontSize: "14px",
  },
  textarea: {
    background: "rgba(30, 30, 30, 0.95)",
    border: "1px solid rgba(255, 255, 255, 0.15)",
    color: "#e4e4e7",
    borderRadius: "8px",
    padding: "10px 14px",
    width: "100%",
    fontSize: "14px",
    minHeight: "120px",
    resize: "vertical" as const,
    fontFamily: "inherit",
  },
  select: {
    background: "rgba(30, 30, 30, 0.95)",
    border: "1px solid rgba(255, 255, 255, 0.15)",
    color: "#e4e4e7",
    borderRadius: "8px",
    padding: "10px 14px",
    width: "100%",
    fontSize: "14px",
  },
  btnPrimary: {
    background: "linear-gradient(135deg, #3b3b3b 0%, #4a4a4a 100%)",
    color: "white",
    border: "1px solid rgba(255, 255, 255, 0.2)",
    borderRadius: "8px",
    padding: "10px 20px",
    fontWeight: "600",
    cursor: "pointer",
    fontSize: "14px",
  },
  btnSecondary: {
    background: "rgba(50, 50, 50, 0.8)",
    color: "#d4d4d8",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    borderRadius: "8px",
    padding: "10px 20px",
    fontWeight: "500",
    cursor: "pointer",
    fontSize: "14px",
  },
  btnDanger: {
    background: "linear-gradient(135deg, #7f1d1d 0%, #991b1b 100%)",
    color: "#fecaca",
    border: "1px solid rgba(239, 68, 68, 0.3)",
    borderRadius: "8px",
    padding: "8px 16px",
    fontWeight: "500",
    cursor: "pointer",
    fontSize: "13px",
  },
  btnSuccess: {
    background: "linear-gradient(135deg, #14532d 0%, #166534 100%)",
    color: "#bbf7d0",
    border: "1px solid rgba(34, 197, 94, 0.3)",
    borderRadius: "8px",
    padding: "8px 16px",
    fontWeight: "500",
    cursor: "pointer",
    fontSize: "13px",
  },
  breadcrumb: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "20px",
    fontSize: "14px",
  },
  breadcrumbItem: {
    color: "#71717a",
    cursor: "pointer",
    transition: "color 0.2s",
  },
  breadcrumbActive: {
    color: "#e4e4e7",
    fontWeight: "500",
  },
  levelCard: {
    background: "rgba(40, 40, 40, 0.6)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    borderRadius: "10px",
    padding: "16px",
    cursor: "pointer",
    transition: "all 0.2s",
  },
  moduleCard: {
    background: "rgba(35, 35, 35, 0.8)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    borderRadius: "10px",
    padding: "16px",
    marginBottom: "12px",
  },
  lessonCard: {
    background: "rgba(45, 45, 45, 0.6)",
    border: "1px solid rgba(255, 255, 255, 0.06)",
    borderRadius: "8px",
    padding: "14px",
    marginBottom: "10px",
  },
  sectionCard: {
    background: "rgba(50, 50, 50, 0.5)",
    border: "1px solid rgba(255, 255, 255, 0.05)",
    borderRadius: "8px",
    padding: "12px",
    marginBottom: "8px",
  },
  kindBadge: {
    padding: "4px 10px",
    borderRadius: "6px",
    fontSize: "11px",
    fontWeight: "600",
    textTransform: "uppercase" as const,
  },
  modal: {
    position: "fixed" as const,
    inset: 0,
    background: "rgba(0, 0, 0, 0.85)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: "20px",
  },
  modalContent: {
    background: "rgba(20, 20, 20, 0.99)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    borderRadius: "16px",
    padding: "28px",
    width: "100%",
    maxWidth: "600px",
    maxHeight: "90vh",
    overflow: "auto",
  },
};

const KIND_COLORS: Record<string, { bg: string; color: string }> = {
  text: { bg: "rgba(59, 130, 246, 0.2)", color: "#93c5fd" },
  video: { bg: "rgba(239, 68, 68, 0.2)", color: "#fca5a5" },
  image: { bg: "rgba(34, 197, 94, 0.2)", color: "#86efac" },
  link: { bg: "rgba(168, 85, 247, 0.2)", color: "#d8b4fe" },
  html: { bg: "rgba(251, 146, 60, 0.2)", color: "#fed7aa" },
  drive: { bg: "rgba(234, 179, 8, 0.2)", color: "#fde047" },
  quiz: { bg: "rgba(20, 184, 166, 0.2)", color: "#5eead4" },
};

const KIND_LABELS: Record<string, string> = {
  text: "📝 Texto",
  video: "🎬 Video",
  image: "🖼️ Imagen",
  link: "🔗 Enlace",
  html: "💻 HTML",
  drive: "📁 Google Drive",
  quiz: "📋 Quiz",
};

const DIMENSION_LABELS: Record<SectionDimension, string> = {
  hacer_proceso: "Hacer (Proceso)",
  hacer_producto: "Hacer (Producto)",
  saber: "Saber",
  auto_ser: "Autoevaluación SER",
  auto_decidir: "Autoevaluación DECIDIR",
};

const DIMENSION_COLORS: Record<SectionDimension, { bg: string; color: string }> = {
  hacer_proceso: { bg: "rgba(59, 130, 246, 0.15)", color: "#7dd3fc" },
  hacer_producto: { bg: "rgba(168, 85, 247, 0.15)", color: "#c4b5fd" },
  saber: { bg: "rgba(16, 185, 129, 0.15)", color: "#6ee7b7" },
  auto_ser: { bg: "rgba(236, 72, 153, 0.15)", color: "#f9a8d4" },
  auto_decidir: { bg: "rgba(245, 158, 11, 0.15)", color: "#fcd34d" },
};

// Cache key para este componente
const CACHE_KEY = "teacher_content_manager_cache";

// Función helper para cargar desde cache
const loadFromCache = () => {
  try {
    const cached = sessionStorage.getItem(CACHE_KEY);
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
};

export default function TeacherContentManager() {
  const nav = useNavigate();
  const { loading, session, role } = useRole();

  // Inicializar con datos del cache si existen
  const cachedData = loadFromCache();

  // Datos del docente
  const [careerName, setCareerName] = useState(cachedData?.careerName || "");
  const [careerId, setCareerId] = useState<number | null>(
    cachedData?.careerId || null,
  );

  // Navegación
  const [view, setView] = useState<
    "levels" | "modules" | "lessons" | "sections"
  >(cachedData?.view || "levels");
  const [selectedLevel, setSelectedLevel] = useState<Level | null>(
    cachedData?.selectedLevel || null,
  );
  const [selectedModule, setSelectedModule] = useState<Module | null>(
    cachedData?.selectedModule || null,
  );
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(
    cachedData?.selectedLesson || null,
  );

  // Datos
  const [levels, setLevels] = useState<Level[]>(cachedData?.levels || []);
  const [modules, setModules] = useState<Module[]>(cachedData?.modules || []);
  const [lessons, setLessons] = useState<Lesson[]>(cachedData?.lessons || []);
  const [sections, setSections] = useState<Section[]>(
    cachedData?.sections || [],
  );

  // Estados UI
  const [msg, setMsg] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(false);

  // Modal editar módulo
  const [showEditModule, setShowEditModule] = useState(false);
  const [editingModule, setEditingModule] = useState<Module | null>(null);
  const [editModuleTitle, setEditModuleTitle] = useState("");
  const [editModuleDesc, setEditModuleDesc] = useState("");
  const [savingModule, setSavingModule] = useState(false);

  // Modal lección
  const [showLessonModal, setShowLessonModal] = useState(false);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [lessonTitle, setLessonTitle] = useState("");
  const [savingLesson, setSavingLesson] = useState(false);

  // Modal sección
  const [showSectionModal, setShowSectionModal] = useState(false);
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [sectionTitle, setSectionTitle] = useState("");
  const [sectionKind, setSectionKind] = useState<SectionKind>("text");
  const [sectionContent, setSectionContent] = useState("");
  const [sectionDimension, setSectionDimension] = useState<SectionDimension>("hacer_proceso");
  const [savingSection, setSavingSection] = useState(false);

  // Estado quiz builder
  const [quizMaxAttempts, setQuizMaxAttempts] = useState(2);
  const [autoIndicators, setAutoIndicators] = useState<string[]>([
    "Cumple con responsabilidad y puntualidad",
    "Respeta las normas del aula/taller",
    "Trabaja en equipo con respeto",
    "Demuestra honestidad en su trabajo",
    "Muestra actitud positiva hacia el aprendizaje",
  ]);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([
    { question: "", sort_order: 0, options: [
      { option_text: "", is_correct: true },
      { option_text: "", is_correct: false },
    ]},
  ]);

  // Flag para evitar recargas innecesarias
  const [profileLoaded, setProfileLoaded] = useState(
    cachedData?.profileLoaded || false,
  );

  // ========== GUARDAR ESTADO EN CACHE ==========
  useEffect(() => {
    // Guardar estado en sessionStorage para persistir entre cambios de pestaña
    const dataToCache = {
      careerName,
      careerId,
      view,
      selectedLevel,
      selectedModule,
      selectedLesson,
      levels,
      modules,
      lessons,
      sections,
      profileLoaded,
    };

    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(dataToCache));
    } catch {
      // Ignorar errores de storage (ej: quota exceeded)
    }
  }, [
    careerName,
    careerId,
    view,
    selectedLevel,
    selectedModule,
    selectedLesson,
    levels,
    modules,
    lessons,
    sections,
    profileLoaded,
  ]);

  // ========== CARGA INICIAL ==========
  useEffect(() => {
    if (!session || !role) return;
    if (profileLoaded) return; // Ya se cargó, no volver a cargar

    const userId = session.user.id;

    async function loadProfile() {
      const { data, error } = await supabase
        .from("profiles")
        .select("career_id")
        .eq("id", userId)
        .single();

      if (error || !data) {
        setMsg("Error cargando perfil: " + (error?.message ?? "No encontrado"));
        return;
      }

      setCareerId(data.career_id);
      setProfileLoaded(true);

      if (data.career_id) {
        const { data: career } = await supabase
          .from("careers")
          .select("name")
          .eq("id", data.career_id)
          .single();
        if (career) setCareerName(career.name);
      }
    }

    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, role]);

  // Cargar niveles cuando tengamos career_id
  useEffect(() => {
    if (!careerId) return;
    if (levels.length > 0) return; // Ya cargados, no recargar

    async function loadLevels() {
      setLoadingData(true);
      const { data, error } = await supabase
        .from("levels")
        .select("id, name, sort_order, career_id")
        .eq("career_id", careerId)
        .order("sort_order");

      setLoadingData(false);
      if (error) {
        setMsg("Error cargando niveles: " + error.message);
        return;
      }
      setLevels((data as Level[]) ?? []);
    }

    loadLevels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [careerId]);

  // Cargar módulos cuando seleccionemos nivel
  useEffect(() => {
    if (!selectedLevel) return;
    // Solo cargar si no tenemos módulos cargados para este nivel
    if (modules.length > 0 && modules[0]?.level_id === selectedLevel.id) return;

    const levelId = selectedLevel.id;

    async function loadModules() {
      setLoadingData(true);
      const { data, error } = await supabase
        .from("modules")
        .select("id, level_id, title, description, sort_order, is_active")
        .eq("level_id", levelId)
        .order("sort_order");

      setLoadingData(false);
      if (error) {
        setMsg("Error cargando módulos: " + error.message);
        return;
      }
      setModules((data as Module[]) ?? []);
    }

    loadModules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLevel]);

  // Cargar lecciones cuando seleccionemos módulo
  useEffect(() => {
    if (!selectedModule) return;
    // Solo cargar si no tenemos lecciones cargadas para este módulo
    if (lessons.length > 0 && lessons[0]?.module_id === selectedModule.id)
      return;

    const moduleId = selectedModule.id;

    async function loadLessons() {
      setLoadingData(true);
      const { data, error } = await supabase
        .from("lessons")
        .select("id, module_id, title, sort_order, is_required")
        .eq("module_id", moduleId)
        .order("sort_order");

      setLoadingData(false);
      if (error) {
        setMsg("Error cargando lecciones: " + error.message);
        return;
      }
      setLessons((data as Lesson[]) ?? []);
    }

    loadLessons();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedModule]);

  // Cargar secciones cuando seleccionemos lección
  useEffect(() => {
    if (!selectedLesson) return;
    // Solo cargar si no tenemos secciones cargadas para esta lección
    if (sections.length > 0 && sections[0]?.lesson_id === selectedLesson.id)
      return;

    const lessonId = selectedLesson.id;

    async function loadSections() {
      setLoadingData(true);
      const { data, error } = await supabase
        .from("lesson_sections")
        .select(
          "id, lesson_id, title, kind, content_json, sort_order, is_active, dimension",
        )
        .eq("lesson_id", lessonId)
        .order("sort_order");

      setLoadingData(false);
      if (error) {
        setMsg("Error cargando secciones: " + error.message);
        return;
      }
      setSections((data as Section[]) ?? []);
    }

    loadSections();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLesson]);

  // ========== FUNCIONES MÓDULOS ==========
  function openEditModule(module: Module) {
    setEditingModule(module);
    setEditModuleTitle(module.title);
    setEditModuleDesc(module.description ?? "");
    setShowEditModule(true);
  }

  function closeEditModule() {
    setShowEditModule(false);
    setEditingModule(null);
    setEditModuleTitle("");
    setEditModuleDesc("");
  }

  async function saveModule() {
    if (!editingModule || !selectedLevel) return;

    const title = editModuleTitle.trim();
    if (!title) {
      setMsg("El título es obligatorio");
      return;
    }

    setSavingModule(true);
    const { error } = await supabase
      .from("modules")
      .update({
        title,
        description: editModuleDesc.trim() || null,
      })
      .eq("id", editingModule.id);

    setSavingModule(false);
    if (error) {
      setMsg("Error guardando: " + error.message);
      return;
    }

    setMsg("✅ Módulo actualizado");
    closeEditModule();

    // Recargar módulos
    const { data } = await supabase
      .from("modules")
      .select("id, level_id, title, description, sort_order, is_active")
      .eq("level_id", selectedLevel.id)
      .order("sort_order");
    setModules((data as Module[]) ?? []);
  }

  // ========== FUNCIONES LECCIONES ==========
  function openCreateLesson() {
    setEditingLesson(null);
    setLessonTitle("");
    setShowLessonModal(true);
  }

  function openEditLesson(lesson: Lesson) {
    setEditingLesson(lesson);
    setLessonTitle(lesson.title);
    setShowLessonModal(true);
  }

  function closeLessonModal() {
    setShowLessonModal(false);
    setEditingLesson(null);
    setLessonTitle("");
  }

  async function saveLesson() {
    if (!selectedModule) return;

    const title = lessonTitle.trim();
    if (!title) {
      setMsg("El título es obligatorio");
      return;
    }

    setSavingLesson(true);

    if (editingLesson) {
      // Al editar, solo actualizamos el título, NO el orden
      const { error } = await supabase
        .from("lessons")
        .update({ title })
        .eq("id", editingLesson.id);

      setSavingLesson(false);
      if (error) {
        setMsg("Error actualizando: " + error.message);
        return;
      }
      setMsg("✅ Lección actualizada");
    } else {
      // Al crear, usamos el siguiente sort_order disponible
      const maxOrder =
        lessons.length > 0 ? Math.max(...lessons.map((l) => l.sort_order)) : 0;

      const { error } = await supabase.from("lessons").insert({
        module_id: selectedModule.id,
        title,
        sort_order: maxOrder + 1,
        is_required: true,
      });

      setSavingLesson(false);
      if (error) {
        setMsg("Error creando: " + error.message);
        return;
      }
      setMsg("✅ Lección creada");
    }

    closeLessonModal();

    // Recargar lecciones
    const { data } = await supabase
      .from("lessons")
      .select("id, module_id, title, sort_order, is_required")
      .eq("module_id", selectedModule.id)
      .order("sort_order");
    setLessons((data as Lesson[]) ?? []);
  }

  async function deleteLesson(lesson: Lesson) {
    if (!selectedModule) return;
    if (
      !confirm(
        `¿Eliminar la lección "${lesson.title}"?\nSe eliminarán todas sus secciones.`,
      )
    )
      return;

    const { error } = await supabase
      .from("lessons")
      .delete()
      .eq("id", lesson.id);
    if (error) {
      setMsg("Error eliminando: " + error.message);
      return;
    }
    setMsg("✅ Lección eliminada");

    // Recargar lecciones
    const { data } = await supabase
      .from("lessons")
      .select("id, module_id, title, sort_order, is_required")
      .eq("module_id", selectedModule.id)
      .order("sort_order");
    setLessons((data as Lesson[]) ?? []);
  }

  // ========== FUNCIONES SECCIONES ==========
  function defaultQuizQuestions(): QuizQuestion[] {
    return [
      {
        question: "",
        sort_order: 0,
        options: [
          { option_text: "", is_correct: true },
          { option_text: "", is_correct: false },
        ],
      },
    ];
  }

  function openCreateSection() {
    setEditingSection(null);
    setSectionTitle("");
    setSectionKind("text");
    setSectionContent("");
    setSectionDimension("hacer_proceso");
    setQuizQuestions(defaultQuizQuestions());
    setShowSectionModal(true);
  }

  async function openEditSection(section: Section) {
    setEditingSection(section);
    setSectionTitle(section.title);
    setSectionKind(section.kind);
    setSectionDimension((section.dimension as SectionDimension) ?? "hacer_proceso");

    if (section.kind === "autoevaluacion") {
      const indicators = (section.content_json as { indicators?: string[] }).indicators ?? [];
      setAutoIndicators(indicators.length > 0 ? indicators : [
        "Cumple con responsabilidad y puntualidad",
        "Respeta las normas del aula/taller",
        "Trabaja en equipo con respeto",
        "Demuestra honestidad en su trabajo",
        "Muestra actitud positiva hacia el aprendizaje",
      ]);
      setSectionContent("");
      setQuizQuestions(defaultQuizQuestions());
      setShowSectionModal(true);
      return;
    }

    if (section.kind === "quiz") {
      // Cargar preguntas y opciones del quiz desde BD
      const { data: quizData } = await supabase
        .from("eval_quizzes")
        .select("id, max_attempts")
        .eq("section_id", section.id)
        .single();
      if (quizData) {
        setQuizMaxAttempts(quizData.max_attempts ?? 2);
        const { data: qData } = await supabase
          .from("eval_quiz_questions")
          .select("id, question, sort_order, eval_quiz_options(id, option_text, is_correct)")
          .eq("quiz_id", quizData.id)
          .order("sort_order");
        if (qData && qData.length > 0) {
          setQuizQuestions(
            qData.map((q) => ({
              id: q.id,
              question: q.question,
              sort_order: q.sort_order,
              options: ((q.eval_quiz_options ?? []) as { id: number; option_text: string; is_correct: boolean }[]).map((o) => ({
                id: o.id,
                option_text: o.option_text,
                is_correct: o.is_correct,
              })),
            }))
          );
        } else {
          setQuizQuestions(defaultQuizQuestions());
        }
      } else {
        setQuizQuestions(defaultQuizQuestions());
      }
      setSectionContent("");
    } else {
      setQuizQuestions(defaultQuizQuestions());
      const content = section.content_json;
      if (section.kind === "text") {
        setSectionContent(content?.text ?? "");
      } else if (
        section.kind === "video" ||
        section.kind === "image" ||
        section.kind === "link"
      ) {
        setSectionContent(content?.url ?? "");
      } else if (section.kind === "html") {
        setSectionContent(content?.html ?? "");
      } else if (section.kind === "drive") {
        setSectionContent(content?.originalUrl ?? "");
      }
    }

    setShowSectionModal(true);
  }

  function closeSectionModal() {
    setShowSectionModal(false);
    setEditingSection(null);
    setSectionTitle("");
    setSectionKind("text");
    setSectionContent("");
    setSectionDimension("hacer_proceso");
    setQuizMaxAttempts(2);
    setAutoIndicators([
      "Cumple con responsabilidad y puntualidad",
      "Respeta las normas del aula/taller",
      "Trabaja en equipo con respeto",
      "Demuestra honestidad en su trabajo",
      "Muestra actitud positiva hacia el aprendizaje",
    ]);
    setQuizQuestions(defaultQuizQuestions());
  }

  async function saveQuizData(sectionId: number) {
    // Validar que haya al menos una pregunta con texto y exactamente una opción correcta
    for (let qi = 0; qi < quizQuestions.length; qi++) {
      const q = quizQuestions[qi];
      if (!q.question.trim()) {
        setMsg(`La pregunta ${qi + 1} no tiene texto`);
        return false;
      }
      if (q.options.length < 2) {
        setMsg(`La pregunta ${qi + 1} necesita al menos 2 opciones`);
        return false;
      }
      const correctCount = q.options.filter((o) => o.is_correct).length;
      if (correctCount !== 1) {
        setMsg(`La pregunta ${qi + 1} debe tener exactamente 1 respuesta correcta`);
        return false;
      }
      for (const o of q.options) {
        if (!o.option_text.trim()) {
          setMsg(`Hay opciones vacías en la pregunta ${qi + 1}`);
          return false;
        }
      }
    }

    // Upsert quiz
    const { data: quizData, error: quizErr } = await supabase
      .from("eval_quizzes")
      .upsert({ section_id: sectionId, max_attempts: quizMaxAttempts }, { onConflict: "section_id" })
      .select("id")
      .single();
    if (quizErr || !quizData) {
      setMsg("Error guardando quiz: " + (quizErr?.message ?? ""));
      return false;
    }
    const quizId = quizData.id;

    // Borrar preguntas anteriores (cascade borrará opciones)
    await supabase.from("eval_quiz_questions").delete().eq("quiz_id", quizId);

    // Insertar preguntas + opciones
    for (let qi = 0; qi < quizQuestions.length; qi++) {
      const q = quizQuestions[qi];
      const { data: qRow, error: qErr } = await supabase
        .from("eval_quiz_questions")
        .insert({ quiz_id: quizId, question: q.question.trim(), sort_order: qi })
        .select("id")
        .single();
      if (qErr || !qRow) {
        setMsg("Error guardando pregunta: " + (qErr?.message ?? ""));
        return false;
      }
      const optRows = q.options.map((o) => ({
        question_id: qRow.id,
        option_text: o.option_text.trim(),
        is_correct: o.is_correct,
      }));
      const { error: optErr } = await supabase.from("eval_quiz_options").insert(optRows);
      if (optErr) {
        setMsg("Error guardando opciones: " + optErr.message);
        return false;
      }
    }
    return true;
  }

  async function saveSection() {
    if (!selectedLesson) return;

    const title = sectionTitle.trim();
    if (!title) {
      setMsg("El título es obligatorio");
      return;
    }

    // La dimensión Saber fuerza quiz; auto_ser/auto_decidir fuerzan autoevaluacion
    const effectiveKind: SectionKind =
      sectionDimension === "saber" ? "quiz" :
      (sectionDimension === "auto_ser" || sectionDimension === "auto_decidir") ? "autoevaluacion" :
      sectionKind;

    let content_json: ContentJson = {};
    const content = sectionContent.trim();

    if (effectiveKind === "autoevaluacion") {
      content_json = { indicators: autoIndicators.filter((i) => i.trim() !== "") } as unknown as ContentJson;
    } else if (effectiveKind === "quiz") {
      content_json = {};
    } else if (effectiveKind === "text") {
      if (!content) { setMsg("El contenido de texto es obligatorio"); return; }
      content_json = { text: content };
    } else if (effectiveKind === "video") {
      if (!content) { setMsg("La URL del video es obligatoria"); return; }
      content_json = { url: content, title };
    } else if (effectiveKind === "image") {
      if (!content) { setMsg("La URL de la imagen es obligatoria"); return; }
      content_json = { url: content, alt: title };
    } else if (effectiveKind === "link") {
      if (!content) { setMsg("La URL del enlace es obligatoria"); return; }
      content_json = { url: content, label: title };
    } else if (effectiveKind === "html") {
      if (!content) { setMsg("El código HTML es obligatorio"); return; }
      content_json = { html: content };
    } else if (effectiveKind === "drive") {
      if (!content) { setMsg("El link de Google Drive es obligatorio"); return; }
      const drivePatterns = [
        /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/,
        /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/,
        /drive\.google\.com\/uc\?.*id=([a-zA-Z0-9_-]+)/,
      ];
      let fileId: string | null = null;
      for (const pattern of drivePatterns) {
        const match = content.match(pattern);
        if (match) { fileId = match[1]; break; }
      }
      if (!fileId) { setMsg("El link no parece ser de Google Drive válido"); return; }
      content_json = { driveId: fileId, originalUrl: content };
    }

    setSavingSection(true);

    if (editingSection) {
      const { error } = await supabase
        .from("lesson_sections")
        .update({ title, kind: effectiveKind, content_json, dimension: sectionDimension })
        .eq("id", editingSection.id);

      if (error) { setSavingSection(false); setMsg("Error actualizando: " + error.message); return; }

      if (effectiveKind === "quiz") {
        const ok = await saveQuizData(editingSection.id);
        if (!ok) { setSavingSection(false); return; }
      } else if (effectiveKind === "autoevaluacion" && selectedLesson) {
        // Sync to auto_eval_activities for student access
        const moduleId = lessons.find((l) => l.id === selectedLesson.id)?.module_id;
        if (moduleId) {
          await supabase.from("auto_eval_activities").upsert({
            module_id: moduleId,
            dimension: sectionDimension,
            indicators: autoIndicators.filter((i) => i.trim() !== ""),
          }, { onConflict: "module_id,dimension" });
        }
      }

      setSavingSection(false);
      setMsg("✅ Sección actualizada");
    } else {
      const { data: maxData } = await supabase
        .from("lesson_sections")
        .select("sort_order")
        .eq("lesson_id", selectedLesson.id)
        .order("sort_order", { ascending: false })
        .limit(1)
        .maybeSingle();
      const maxOrder = maxData?.sort_order ?? 0;

      const { data: newSection, error } = await supabase
        .from("lesson_sections")
        .insert({
          lesson_id: selectedLesson.id,
          title,
          kind: effectiveKind,
          content_json,
          dimension: sectionDimension,
          sort_order: maxOrder + 1,
          is_active: true,
        })
        .select("id")
        .single();

      if (error) { setSavingSection(false); setMsg("Error creando: " + error.message); return; }

      if (effectiveKind === "quiz" && newSection) {
        const ok = await saveQuizData(newSection.id);
        if (!ok) { setSavingSection(false); return; }
      }

      if (effectiveKind === "autoevaluacion" && newSection && selectedLesson) {
        const moduleId = lessons.find((l) => l.id === selectedLesson.id)?.module_id;
        if (moduleId) {
          await supabase.from("auto_eval_activities").upsert({
            module_id: moduleId,
            dimension: sectionDimension,
            indicators: autoIndicators.filter((i) => i.trim() !== ""),
          }, { onConflict: "module_id,dimension" });
        }
      }

      setSavingSection(false);
      setMsg("✅ Sección creada");
    }

    closeSectionModal();

    // Recargar secciones
    const { data } = await supabase
      .from("lesson_sections")
      .select("id, lesson_id, title, kind, content_json, sort_order, is_active, dimension")
      .eq("lesson_id", selectedLesson.id)
      .order("sort_order");
    setSections((data as Section[]) ?? []);
  }

  async function deleteSection(section: Section) {
    if (!selectedLesson) return;
    if (!confirm(`¿Eliminar la sección "${section.title}"?`)) return;

    const { error } = await supabase
      .from("lesson_sections")
      .delete()
      .eq("id", section.id);
    if (error) {
      setMsg("Error eliminando: " + error.message);
      return;
    }
    setMsg("✅ Sección eliminada");

    // Recargar secciones
    const { data } = await supabase
      .from("lesson_sections")
      .select("id, lesson_id, title, kind, content_json, sort_order, is_active, dimension")
      .eq("lesson_id", selectedLesson.id)
      .order("sort_order");
    setSections((data as Section[]) ?? []);
  }

  // ========== REORDENAMIENTO ==========
  async function moveLessonUp(lesson: Lesson, currentIndex: number) {
    if (currentIndex === 0 || !selectedModule) return;

    const prevLesson = lessons[currentIndex - 1];
    const currentOrder = lesson.sort_order;
    const prevOrder = prevLesson.sort_order;

    // Swap usando valores temporales negativos para evitar conflictos
    // Paso 1: Mover el actual a un valor temporal negativo
    await supabase
      .from("lessons")
      .update({ sort_order: -999999 })
      .eq("id", lesson.id);

    // Paso 2: Mover el anterior al orden del actual
    await supabase
      .from("lessons")
      .update({ sort_order: currentOrder })
      .eq("id", prevLesson.id);

    // Paso 3: Mover el actual al orden del anterior
    await supabase
      .from("lessons")
      .update({ sort_order: prevOrder })
      .eq("id", lesson.id);

    // Recargar lecciones
    const { data } = await supabase
      .from("lessons")
      .select("id, module_id, title, sort_order, is_required")
      .eq("module_id", selectedModule.id)
      .order("sort_order");
    setLessons((data as Lesson[]) ?? []);
  }

  async function moveLessonDown(lesson: Lesson, currentIndex: number) {
    if (currentIndex === lessons.length - 1 || !selectedModule) return;

    const nextLesson = lessons[currentIndex + 1];
    const currentOrder = lesson.sort_order;
    const nextOrder = nextLesson.sort_order;

    // Swap usando valores temporales negativos
    await supabase
      .from("lessons")
      .update({ sort_order: -999999 })
      .eq("id", lesson.id);

    await supabase
      .from("lessons")
      .update({ sort_order: currentOrder })
      .eq("id", nextLesson.id);

    await supabase
      .from("lessons")
      .update({ sort_order: nextOrder })
      .eq("id", lesson.id);

    // Recargar lecciones
    const { data } = await supabase
      .from("lessons")
      .select("id, module_id, title, sort_order, is_required")
      .eq("module_id", selectedModule.id)
      .order("sort_order");
    setLessons((data as Lesson[]) ?? []);
  }

  async function moveSectionUp(section: Section, currentIndex: number) {
    if (currentIndex === 0 || !selectedLesson) return;

    const prevSection = sections[currentIndex - 1];
    const currentOrder = section.sort_order;
    const prevOrder = prevSection.sort_order;

    // Swap usando valores temporales negativos para evitar conflictos
    await supabase
      .from("lesson_sections")
      .update({ sort_order: -999999 })
      .eq("id", section.id);

    await supabase
      .from("lesson_sections")
      .update({ sort_order: currentOrder })
      .eq("id", prevSection.id);

    await supabase
      .from("lesson_sections")
      .update({ sort_order: prevOrder })
      .eq("id", section.id);

    // Recargar secciones
    const { data } = await supabase
      .from("lesson_sections")
      .select("id, lesson_id, title, kind, content_json, sort_order, is_active, dimension")
      .eq("lesson_id", selectedLesson.id)
      .order("sort_order");
    setSections((data as Section[]) ?? []);
  }

  async function moveSectionDown(section: Section, currentIndex: number) {
    if (currentIndex === sections.length - 1 || !selectedLesson) return;

    const nextSection = sections[currentIndex + 1];
    const currentOrder = section.sort_order;
    const nextOrder = nextSection.sort_order;

    // Swap usando valores temporales negativos
    await supabase
      .from("lesson_sections")
      .update({ sort_order: -999999 })
      .eq("id", section.id);

    await supabase
      .from("lesson_sections")
      .update({ sort_order: currentOrder })
      .eq("id", nextSection.id);

    await supabase
      .from("lesson_sections")
      .update({ sort_order: nextOrder })
      .eq("id", section.id);

    // Recargar secciones
    const { data } = await supabase
      .from("lesson_sections")
      .select("id, lesson_id, title, kind, content_json, sort_order, is_active, dimension")
      .eq("lesson_id", selectedLesson.id)
      .order("sort_order");
    setSections((data as Section[]) ?? []);
  }

  // ========== NAVEGACIÓN ==========
  function goToLevels() {
    setView("levels");
    setSelectedLevel(null);
    setSelectedModule(null);
    setSelectedLesson(null);
  }

  function goToModules(level: Level) {
    setSelectedLevel(level);
    setSelectedModule(null);
    setSelectedLesson(null);
    setView("modules");
  }

  function goToLessons(module: Module) {
    setSelectedModule(module);
    setSelectedLesson(null);
    setView("lessons");
  }

  function goToSections(lesson: Lesson) {
    setSelectedLesson(lesson);
    setView("sections");
  }

  // ========== GUARDS ==========
  // RequireRole ya maneja la autorización, solo mostramos loading mientras se carga
  if (loading || !role) {
    return (
      <div
        style={{
          ...styles.container,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ color: "#71717a" }}>Cargando...</div>
      </div>
    );
  }

  // No necesitamos verificar !session || !isAllowed porque RequireRole ya lo hizo
  // Si llegamos aquí, el usuario tiene permiso

  // ========== RENDER ==========
  return (
    <div style={styles.container}>
      {/* HEADER */}
      <header style={styles.header}>
        <div
          style={{
            maxWidth: "1200px",
            margin: "0 auto",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "12px",
                color: "#71717a",
                textTransform: "uppercase",
                letterSpacing: "1px",
              }}
            >
              Gestión de Contenido
            </div>
            <h1
              style={{
                fontSize: "22px",
                fontWeight: "700",
                color: "#fff",
                margin: "4px 0 0",
              }}
            >
              {careerName || "Mi Carrera"}
            </h1>
          </div>
          <button style={styles.btnSecondary} onClick={() => nav("/teacher")}>
            ← Volver al Dashboard
          </button>
        </div>
      </header>

      <main style={{ maxWidth: "1200px", margin: "0 auto", padding: "24px" }}>
        {/* MENSAJE */}
        {msg && (
          <div
            style={{
              padding: "14px 18px",
              borderRadius: "10px",
              marginBottom: "20px",
              background: msg.includes("✅")
                ? "rgba(34, 197, 94, 0.15)"
                : "rgba(239, 68, 68, 0.15)",
              border: `1px solid ${msg.includes("✅") ? "rgba(34, 197, 94, 0.4)" : "rgba(239, 68, 68, 0.4)"}`,
              color: msg.includes("✅") ? "#86efac" : "#fca5a5",
              fontSize: "14px",
            }}
          >
            {msg}
            <button
              style={{
                marginLeft: "12px",
                background: "none",
                border: "none",
                color: "inherit",
                cursor: "pointer",
              }}
              onClick={() => setMsg(null)}
            >
              ×
            </button>
          </div>
        )}

        {/* BREADCRUMB */}
        <div style={styles.breadcrumb}>
          <span
            style={{
              ...styles.breadcrumbItem,
              ...(view === "levels" ? styles.breadcrumbActive : {}),
            }}
            onClick={goToLevels}
          >
            🏠 Niveles
          </span>
          {selectedLevel && (
            <>
              <span style={{ color: "#52525b" }}>/</span>
              <span
                style={{
                  ...styles.breadcrumbItem,
                  ...(view === "modules" ? styles.breadcrumbActive : {}),
                }}
                onClick={() => goToModules(selectedLevel)}
              >
                📚 {selectedLevel.name}
              </span>
            </>
          )}
          {selectedModule && (
            <>
              <span style={{ color: "#52525b" }}>/</span>
              <span
                style={{
                  ...styles.breadcrumbItem,
                  ...(view === "lessons" ? styles.breadcrumbActive : {}),
                }}
                onClick={() => goToLessons(selectedModule)}
              >
                📖 {selectedModule.title}
              </span>
            </>
          )}
          {selectedLesson && (
            <>
              <span style={{ color: "#52525b" }}>/</span>
              <span style={styles.breadcrumbActive}>
                📝 {selectedLesson.title}
              </span>
            </>
          )}
        </div>

        {/* VISTA: NIVELES */}
        {view === "levels" && (
          <section style={styles.card}>
            <h2
              style={{
                fontSize: "18px",
                fontWeight: "600",
                marginBottom: "20px",
                color: "#fff",
              }}
            >
              📊 Selecciona un Nivel
            </h2>

            {loadingData ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "40px",
                  color: "#71717a",
                }}
              >
                Cargando...
              </div>
            ) : levels.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "40px",
                  color: "#71717a",
                }}
              >
                No hay niveles configurados para tu carrera
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(250px, 1fr))",
                  gap: "16px",
                }}
              >
                {levels.map((level) => (
                  <div
                    key={level.id}
                    style={styles.levelCard}
                    onClick={() => goToModules(level)}
                  >
                    <div
                      style={{
                        fontSize: "16px",
                        fontWeight: "600",
                        color: "#fff",
                        marginBottom: "6px",
                      }}
                    >
                      {level.name}
                    </div>
                    <div style={{ fontSize: "13px", color: "#71717a" }}>
                      5 módulos
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* VISTA: MÓDULOS */}
        {view === "modules" && selectedLevel && (
          <section style={styles.card}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "20px",
              }}
            >
              <h2
                style={{ fontSize: "18px", fontWeight: "600", color: "#fff" }}
              >
                📚 Módulos de {selectedLevel.name}
              </h2>
              <div style={{ fontSize: "13px", color: "#71717a" }}>
                Haz clic en un módulo para editar su nombre o ver sus lecciones
              </div>
            </div>

            {loadingData ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "40px",
                  color: "#71717a",
                }}
              >
                Cargando...
              </div>
            ) : modules.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "40px",
                  color: "#71717a",
                }}
              >
                No hay módulos en este nivel
              </div>
            ) : (
              <div>
                {modules.map((module, idx) => (
                  <div key={module.id} style={styles.moduleCard}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "start",
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            marginBottom: "6px",
                          }}
                        >
                          <span
                            style={{
                              background: "rgba(255, 255, 255, 0.1)",
                              padding: "4px 10px",
                              borderRadius: "6px",
                              fontSize: "12px",
                              fontWeight: "600",
                              color: "#a1a1aa",
                            }}
                          >
                            M{idx + 1}
                          </span>
                          <span
                            style={{
                              fontSize: "16px",
                              fontWeight: "600",
                              color: "#fff",
                            }}
                          >
                            {module.title}
                          </span>
                        </div>
                        {module.description && (
                          <p
                            style={{
                              fontSize: "13px",
                              color: "#71717a",
                              margin: "0 0 0 52px",
                            }}
                          >
                            {module.description}
                          </p>
                        )}
                      </div>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button
                          style={{
                            ...styles.btnSecondary,
                            padding: "8px 14px",
                            fontSize: "13px",
                          }}
                          onClick={() => openEditModule(module)}
                        >
                          ✏️ Editar nombre
                        </button>
                        <button
                          style={{
                            ...styles.btnPrimary,
                            padding: "8px 14px",
                            fontSize: "13px",
                          }}
                          onClick={() => goToLessons(module)}
                        >
                          Editar Lecciones →
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* VISTA: LECCIONES */}
        {view === "lessons" && selectedModule && (
          <section style={styles.card}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "20px",
              }}
            >
              <h2
                style={{ fontSize: "18px", fontWeight: "600", color: "#fff" }}
              >
                📖 Lecciones de "{selectedModule.title}"
              </h2>
              <button style={styles.btnSuccess} onClick={openCreateLesson}>
                + Nueva Lección
              </button>
            </div>

            {loadingData ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "40px",
                  color: "#71717a",
                }}
              >
                Cargando...
              </div>
            ) : lessons.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px" }}>
                <div style={{ fontSize: "48px", marginBottom: "12px" }}>📭</div>
                <p style={{ color: "#71717a", marginBottom: "16px" }}>
                  Este módulo no tiene lecciones
                </p>
                <button style={styles.btnSuccess} onClick={openCreateLesson}>
                  Crear primera lección
                </button>
              </div>
            ) : (
              <div>
                {lessons.map((lesson, idx) => (
                  <div key={lesson.id} style={styles.lessonCard}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                        }}
                      >
                        <span
                          style={{
                            background: "rgba(255, 255, 255, 0.08)",
                            padding: "6px 12px",
                            borderRadius: "6px",
                            fontSize: "13px",
                            fontWeight: "600",
                            color: "#a1a1aa",
                          }}
                        >
                          {idx + 1}
                        </span>
                        <span
                          style={{
                            fontSize: "15px",
                            fontWeight: "500",
                            color: "#e4e4e7",
                          }}
                        >
                          {lesson.title}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button
                          style={{
                            padding: "8px 12px",
                            fontSize: "16px",
                            fontWeight: "bold",
                            background:
                              idx === 0
                                ? "rgba(255, 255, 255, 0.05)"
                                : "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                            color: idx === 0 ? "#52525b" : "#fff",
                            border: "none",
                            borderRadius: "8px",
                            cursor: idx === 0 ? "not-allowed" : "pointer",
                            transition: "all 0.2s ease",
                            boxShadow:
                              idx === 0
                                ? "none"
                                : "0 2px 8px rgba(16, 185, 129, 0.3)",
                          }}
                          onClick={() => moveLessonUp(lesson, idx)}
                          disabled={idx === 0}
                          title="Subir"
                          onMouseEnter={(e) => {
                            if (idx !== 0) {
                              e.currentTarget.style.transform =
                                "translateY(-2px)";
                              e.currentTarget.style.boxShadow =
                                "0 4px 12px rgba(16, 185, 129, 0.4)";
                            }
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = "translateY(0)";
                            e.currentTarget.style.boxShadow =
                              idx === 0
                                ? "none"
                                : "0 2px 8px rgba(16, 185, 129, 0.3)";
                          }}
                        >
                          ⬆
                        </button>
                        <button
                          style={{
                            padding: "8px 12px",
                            fontSize: "16px",
                            fontWeight: "bold",
                            background:
                              idx === lessons.length - 1
                                ? "rgba(255, 255, 255, 0.05)"
                                : "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                            color:
                              idx === lessons.length - 1 ? "#52525b" : "#fff",
                            border: "none",
                            borderRadius: "8px",
                            cursor:
                              idx === lessons.length - 1
                                ? "not-allowed"
                                : "pointer",
                            transition: "all 0.2s ease",
                            boxShadow:
                              idx === lessons.length - 1
                                ? "none"
                                : "0 2px 8px rgba(59, 130, 246, 0.3)",
                          }}
                          onClick={() => moveLessonDown(lesson, idx)}
                          disabled={idx === lessons.length - 1}
                          title="Bajar"
                          onMouseEnter={(e) => {
                            if (idx !== lessons.length - 1) {
                              e.currentTarget.style.transform =
                                "translateY(2px)";
                              e.currentTarget.style.boxShadow =
                                "0 4px 12px rgba(59, 130, 246, 0.4)";
                            }
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.transform = "translateY(0)";
                            e.currentTarget.style.boxShadow =
                              idx === lessons.length - 1
                                ? "none"
                                : "0 2px 8px rgba(59, 130, 246, 0.3)";
                          }}
                        >
                          ⬇
                        </button>
                        <button
                          style={{
                            ...styles.btnSecondary,
                            padding: "6px 12px",
                            fontSize: "12px",
                          }}
                          onClick={() => openEditLesson(lesson)}
                        >
                          Editar título
                        </button>
                        <button
                          style={{
                            ...styles.btnPrimary,
                            padding: "6px 12px",
                            fontSize: "12px",
                          }}
                          onClick={() => goToSections(lesson)}
                        >
                          Editar Contenido →
                        </button>
                        <button
                          style={{
                            ...styles.btnDanger,
                            padding: "6px 12px",
                            fontSize: "12px",
                          }}
                          onClick={() => deleteLesson(lesson)}
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* VISTA: SECCIONES */}
        {view === "sections" && selectedLesson && (
          <section style={styles.card}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "20px",
              }}
            >
              <h2
                style={{ fontSize: "18px", fontWeight: "600", color: "#fff" }}
              >
                📝 Contenido de "{selectedLesson.title}"
              </h2>
              <button style={styles.btnSuccess} onClick={openCreateSection}>
                + Agregar Contenido
              </button>
            </div>

            {loadingData ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "40px",
                  color: "#71717a",
                }}
              >
                Cargando...
              </div>
            ) : sections.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px" }}>
                <div style={{ fontSize: "48px", marginBottom: "12px" }}>📄</div>
                <p style={{ color: "#71717a", marginBottom: "16px" }}>
                  Esta lección no tiene contenido
                </p>
                <button style={styles.btnSuccess} onClick={openCreateSection}>
                  Agregar primer contenido
                </button>
              </div>
            ) : (
              <div>
                {sections.map((section, idx) => {
                  const kindStyle = KIND_COLORS[section.kind] ?? {
                    bg: "rgba(100,100,100,0.2)",
                    color: "#aaa",
                  };
                  return (
                    <div key={section.id} style={styles.sectionCard}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "start",
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "10px",
                              marginBottom: "8px",
                            }}
                          >
                            <span
                              style={{
                                ...styles.kindBadge,
                                background: kindStyle.bg,
                                color: kindStyle.color,
                              }}
                            >
                              {KIND_LABELS[section.kind] ?? section.kind}
                            </span>
                            {section.dimension && (
                              <span
                                style={{
                                  ...styles.kindBadge,
                                  background: DIMENSION_COLORS[section.dimension as SectionDimension]?.bg ?? "rgba(100,100,100,0.2)",
                                  color: DIMENSION_COLORS[section.dimension as SectionDimension]?.color ?? "#aaa",
                                }}
                              >
                                {DIMENSION_LABELS[section.dimension as SectionDimension] ?? section.dimension}
                              </span>
                            )}
                            <span
                              style={{
                                fontSize: "14px",
                                fontWeight: "500",
                                color: "#e4e4e7",
                              }}
                            >
                              {section.title}
                            </span>
                          </div>

                          <div
                            style={{
                              fontSize: "13px",
                              color: "#71717a",
                              marginLeft: "4px",
                              maxHeight: "60px",
                              overflow: "hidden",
                            }}
                          >
                            {section.kind === "text" && (
                              <span>
                                {(section.content_json?.text ?? "").substring(
                                  0,
                                  150,
                                )}
                                ...
                              </span>
                            )}
                            {section.kind === "video" && (
                              <span>🎬 {section.content_json?.url ?? ""}</span>
                            )}
                            {section.kind === "image" && (
                              <span>🖼️ {section.content_json?.url ?? ""}</span>
                            )}
                            {section.kind === "link" && (
                              <span>🔗 {section.content_json?.url ?? ""}</span>
                            )}
                            {section.kind === "html" && (
                              <span>
                                💻 Código HTML (
                                {(section.content_json?.html ?? "").length}{" "}
                                caracteres)
                              </span>
                            )}
                            {section.kind === "drive" && (
                              <span>
                                📁 {section.content_json?.originalUrl ?? ""}
                              </span>
                            )}
                          </div>
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: "8px",
                            marginLeft: "16px",
                          }}
                        >
                          <button
                            style={{
                              padding: "8px 12px",
                              fontSize: "16px",
                              fontWeight: "bold",
                              background:
                                idx === 0
                                  ? "rgba(255, 255, 255, 0.05)"
                                  : "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                              color: idx === 0 ? "#52525b" : "#fff",
                              border: "none",
                              borderRadius: "8px",
                              cursor: idx === 0 ? "not-allowed" : "pointer",
                              transition: "all 0.2s ease",
                              boxShadow:
                                idx === 0
                                  ? "none"
                                  : "0 2px 8px rgba(16, 185, 129, 0.3)",
                            }}
                            onClick={() => moveSectionUp(section, idx)}
                            disabled={idx === 0}
                            title="Subir"
                            onMouseEnter={(e) => {
                              if (idx !== 0) {
                                e.currentTarget.style.transform =
                                  "translateY(-2px)";
                                e.currentTarget.style.boxShadow =
                                  "0 4px 12px rgba(16, 185, 129, 0.4)";
                              }
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = "translateY(0)";
                              e.currentTarget.style.boxShadow =
                                idx === 0
                                  ? "none"
                                  : "0 2px 8px rgba(16, 185, 129, 0.3)";
                            }}
                          >
                            ⬆
                          </button>
                          <button
                            style={{
                              padding: "8px 12px",
                              fontSize: "16px",
                              fontWeight: "bold",
                              background:
                                idx === sections.length - 1
                                  ? "rgba(255, 255, 255, 0.05)"
                                  : "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
                              color:
                                idx === sections.length - 1
                                  ? "#52525b"
                                  : "#fff",
                              border: "none",
                              borderRadius: "8px",
                              cursor:
                                idx === sections.length - 1
                                  ? "not-allowed"
                                  : "pointer",
                              transition: "all 0.2s ease",
                              boxShadow:
                                idx === sections.length - 1
                                  ? "none"
                                  : "0 2px 8px rgba(59, 130, 246, 0.3)",
                            }}
                            onClick={() => moveSectionDown(section, idx)}
                            disabled={idx === sections.length - 1}
                            title="Bajar"
                            onMouseEnter={(e) => {
                              if (idx !== sections.length - 1) {
                                e.currentTarget.style.transform =
                                  "translateY(2px)";
                                e.currentTarget.style.boxShadow =
                                  "0 4px 12px rgba(59, 130, 246, 0.4)";
                              }
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.transform = "translateY(0)";
                              e.currentTarget.style.boxShadow =
                                idx === sections.length - 1
                                  ? "none"
                                  : "0 2px 8px rgba(59, 130, 246, 0.3)";
                            }}
                          >
                            ⬇
                          </button>
                          <button
                            style={{
                              ...styles.btnSecondary,
                              padding: "6px 12px",
                              fontSize: "12px",
                            }}
                            onClick={() => openEditSection(section)}
                          >
                            Editar
                          </button>
                          <button
                            style={{
                              ...styles.btnDanger,
                              padding: "6px 12px",
                              fontSize: "12px",
                            }}
                            onClick={() => deleteSection(section)}
                          >
                            Eliminar
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Leyenda */}
            <div
              style={{
                marginTop: "24px",
                padding: "16px",
                background: "rgba(40, 40, 40, 0.5)",
                borderRadius: "10px",
              }}
            >
              <div
                style={{
                  fontSize: "13px",
                  fontWeight: "600",
                  color: "#a1a1aa",
                  marginBottom: "12px",
                }}
              >
                Tipos de contenido disponibles:
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
                {Object.entries(KIND_LABELS).map(([kind, label]) => {
                  const ks = KIND_COLORS[kind];
                  return (
                    <span
                      key={kind}
                      style={{
                        ...styles.kindBadge,
                        background: ks?.bg,
                        color: ks?.color,
                      }}
                    >
                      {label}
                    </span>
                  );
                })}
              </div>
              <div
                style={{
                  fontSize: "12px",
                  color: "#71717a",
                  marginTop: "12px",
                }}
              >
                💡 <strong>Tip:</strong> Para imágenes y videos, usa URLs
                externas (Imgur, YouTube, Google Drive, etc.)
              </div>
            </div>
          </section>
        )}
      </main>

      {/* MODALES */}

      {/* Modal Editar Módulo */}
      {showEditModule && editingModule && (
        <div style={styles.modal}>
          <div style={styles.modalContent}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "24px",
              }}
            >
              <h3
                style={{ fontSize: "18px", fontWeight: "700", color: "#fff" }}
              >
                ✏️ Editar Módulo
              </h3>
              <button
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#71717a",
                  fontSize: "24px",
                  cursor: "pointer",
                }}
                onClick={closeEditModule}
              >
                ×
              </button>
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
                Título del módulo *
              </label>
              <input
                style={styles.input}
                value={editModuleTitle}
                onChange={(e) => setEditModuleTitle(e.target.value)}
                placeholder="Ej: Introducción a la Enfermería"
              />
            </div>

            <div style={{ marginBottom: "24px" }}>
              <label
                style={{
                  display: "block",
                  fontSize: "13px",
                  color: "#a1a1aa",
                  marginBottom: "6px",
                }}
              >
                Descripción (opcional)
              </label>
              <textarea
                style={styles.textarea}
                value={editModuleDesc}
                onChange={(e) => setEditModuleDesc(e.target.value)}
                placeholder="Breve descripción del módulo..."
                rows={3}
              />
            </div>

            <div
              style={{
                display: "flex",
                gap: "12px",
                justifyContent: "flex-end",
              }}
            >
              <button style={styles.btnSecondary} onClick={closeEditModule}>
                Cancelar
              </button>
              <button
                style={styles.btnPrimary}
                onClick={saveModule}
                disabled={savingModule}
              >
                {savingModule ? "Guardando..." : "Guardar Cambios"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Lección */}
      {showLessonModal && (
        <div style={styles.modal}>
          <div style={styles.modalContent}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "24px",
              }}
            >
              <h3
                style={{ fontSize: "18px", fontWeight: "700", color: "#fff" }}
              >
                {editingLesson ? "✏️ Editar Lección" : "➕ Nueva Lección"}
              </h3>
              <button
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#71717a",
                  fontSize: "24px",
                  cursor: "pointer",
                }}
                onClick={closeLessonModal}
              >
                ×
              </button>
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
                Título de la lección *
              </label>
              <input
                style={styles.input}
                value={lessonTitle}
                onChange={(e) => setLessonTitle(e.target.value)}
                placeholder="Ej: Primeros Auxilios Básicos"
              />
            </div>

            <div
              style={{
                display: "flex",
                gap: "12px",
                justifyContent: "flex-end",
              }}
            >
              <button style={styles.btnSecondary} onClick={closeLessonModal}>
                Cancelar
              </button>
              <button
                style={styles.btnPrimary}
                onClick={saveLesson}
                disabled={savingLesson}
              >
                {savingLesson
                  ? "Guardando..."
                  : editingLesson
                    ? "Guardar Cambios"
                    : "Crear Lección"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Sección */}
      {showSectionModal && (
        <div style={styles.modal}>
          <div style={{ ...styles.modalContent, maxWidth: "700px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "24px",
              }}
            >
              <h3
                style={{ fontSize: "18px", fontWeight: "700", color: "#fff" }}
              >
                {editingSection
                  ? "✏️ Editar Contenido"
                  : "➕ Agregar Contenido"}
              </h3>
              <button
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#71717a",
                  fontSize: "24px",
                  cursor: "pointer",
                }}
                onClick={closeSectionModal}
              >
                ×
              </button>
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
                  Título *
                </label>
                <input
                  style={styles.input}
                  value={sectionTitle}
                  onChange={(e) => setSectionTitle(e.target.value)}
                  placeholder="Ej: Introducción al tema"
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
                  Dimensión evaluativa *
                </label>
                <select
                  style={styles.select}
                  value={sectionDimension}
                  onChange={(e) => {
                    const dim = e.target.value as SectionDimension;
                    setSectionDimension(dim);
                    if (dim === "saber") setSectionKind("quiz");
                    else if (dim === "auto_ser" || dim === "auto_decidir") setSectionKind("autoevaluacion");
                    else if (sectionKind === "quiz" || sectionKind === "autoevaluacion") setSectionKind("text");
                  }}
                >
                  <option value="hacer_proceso">📘 Hacer (Proceso)</option>
                  <option value="hacer_producto">📗 Hacer (Producto)</option>
                  <option value="saber">📋 Saber (Quiz automático)</option>
                  <option value="auto_ser">⭐ Autoevaluación SER (5 pts)</option>
                  <option value="auto_decidir">⭐ Autoevaluación DECIDIR (5 pts)</option>
                </select>
              </div>
            </div>

            {/* Tipo de contenido — solo visible cuando NO es Saber ni auto-eval */}
            {sectionDimension !== "saber" && sectionDimension !== "auto_ser" && sectionDimension !== "auto_decidir" && (
              <div style={{ marginBottom: "16px" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "13px",
                    color: "#a1a1aa",
                    marginBottom: "6px",
                  }}
                >
                  Tipo de contenido *
                </label>
                <select
                  style={styles.select}
                  value={sectionKind}
                  onChange={(e) => setSectionKind(e.target.value as SectionKind)}
                >
                  <option value="text">📝 Texto</option>
                  <option value="video">🎬 Video (URL)</option>
                  <option value="image">🖼️ Imagen (URL)</option>
                  <option value="link">🔗 Enlace</option>
                  <option value="drive">📁 Google Drive</option>
                  <option value="html">💻 HTML</option>
                </select>
              </div>
            )}

            {/* Contenido de texto / URL — cuando NO es quiz ni auto-eval */}
            {sectionDimension !== "saber" && sectionDimension !== "auto_ser" && sectionDimension !== "auto_decidir" && (
              <div style={{ marginBottom: "16px" }}>
                <label
                  style={{
                    display: "block",
                    fontSize: "13px",
                    color: "#a1a1aa",
                    marginBottom: "6px",
                  }}
                >
                  {sectionKind === "text" && "Contenido de texto *"}
                  {sectionKind === "video" && "URL del video * (YouTube, Vimeo, etc.)"}
                  {sectionKind === "image" && "URL de la imagen * (Imgur, Google Drive, etc.)"}
                  {sectionKind === "link" && "URL del enlace *"}
                  {sectionKind === "drive" && "Link de Google Drive * (Pegar link compartido)"}
                  {sectionKind === "html" && "Código HTML *"}
                </label>
                <textarea
                  style={{
                    ...styles.textarea,
                    minHeight: sectionKind === "text" || sectionKind === "html" ? "200px" : "80px",
                    fontFamily: sectionKind === "html" ? "monospace" : "inherit",
                  }}
                  value={sectionContent}
                  onChange={(e) => setSectionContent(e.target.value)}
                  placeholder={
                    sectionKind === "text"
                      ? "Escribe el contenido aquí..."
                      : sectionKind === "video"
                        ? "https://www.youtube.com/watch?v=..."
                        : sectionKind === "image"
                          ? "https://i.imgur.com/..."
                          : sectionKind === "link"
                            ? "https://ejemplo.com/recurso"
                            : sectionKind === "drive"
                              ? "https://drive.google.com/file/d/.../view?usp=sharing"
                              : "<div>Tu código HTML aquí</div>"
                  }
                />
                {sectionKind === "image" && (
                  <p style={{ fontSize: "12px", color: "#71717a", marginTop: "8px" }}>
                    💡 Puedes subir imágenes gratis a imgur.com o imgbb.com y pegar la URL aquí.
                  </p>
                )}
              </div>
            )}

            {/* Indicadores de Autoevaluación */}
            {(sectionDimension === "auto_ser" || sectionDimension === "auto_decidir") && (
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 13, color: "#a1a1aa", marginBottom: 8 }}>
                  Indicadores de autoevaluación ({sectionDimension === "auto_ser" ? "SER" : "DECIDIR"}) — 1 punto cada uno
                </label>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {autoIndicators.map((ind, i) => (
                    <div key={i} style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input
                        style={{ ...styles.input, flex: 1 }}
                        value={ind}
                        onChange={(e) => {
                          const next = [...autoIndicators];
                          next[i] = e.target.value;
                          setAutoIndicators(next);
                        }}
                        placeholder={`Indicador ${i + 1}`}
                      />
                      <button
                        type="button"
                        onClick={() => setAutoIndicators(autoIndicators.filter((_, j) => j !== i))}
                        style={{ background: "rgba(239,68,68,0.2)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171", borderRadius: 6, padding: "6px 10px", cursor: "pointer", fontSize: 12 }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setAutoIndicators([...autoIndicators, ""])}
                    style={{ background: "rgba(99,102,241,0.2)", border: "1px solid rgba(99,102,241,0.3)", color: "#a5b4fc", borderRadius: 6, padding: "8px 14px", cursor: "pointer", fontSize: 13, alignSelf: "flex-start" }}
                  >
                    + Agregar indicador
                  </button>
                </div>
                <p style={{ color: "#71717a", fontSize: 11, marginTop: 6 }}>
                  El estudiante calificará cada indicador del 1 al 5. El promedio se convierte a nota sobre 5 puntos.
                </p>
              </div>
            )}

            {/* Quiz builder — solo cuando dimensión es Saber */}
            {sectionDimension === "saber" && (
              <div style={{ marginBottom: "16px" }}>
                <div style={{ marginBottom: "12px", display: "flex", alignItems: "center", gap: "12px" }}>
                  <label style={{ fontSize: "13px", color: "#a1a1aa", whiteSpace: "nowrap" }}>Intentos permitidos:</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={quizMaxAttempts}
                    onChange={(e) => setQuizMaxAttempts(Math.max(1, parseInt(e.target.value) || 1))}
                    style={{ width: 70, background: "rgba(30,30,30,0.8)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, color: "#e4e4e7", padding: "4px 8px", fontSize: 13, textAlign: "center" }}
                  />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                  <label style={{ fontSize: "13px", color: "#a1a1aa" }}>
                    Preguntas del Quiz *
                  </label>
                  <button
                    type="button"
                    style={{ ...styles.btnSecondary, padding: "6px 14px", fontSize: "13px" }}
                    onClick={() =>
                      setQuizQuestions((prev) => [
                        ...prev,
                        { question: "", sort_order: prev.length, options: [
                          { option_text: "", is_correct: true },
                          { option_text: "", is_correct: false },
                        ]},
                      ])
                    }
                  >
                    + Pregunta
                  </button>
                </div>

                {quizQuestions.map((q, qi) => (
                  <div
                    key={qi}
                    style={{
                      background: "rgba(20,20,20,0.6)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: "8px",
                      padding: "14px",
                      marginBottom: "12px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <span style={{ fontSize: "13px", color: "#71717a" }}>Pregunta {qi + 1}</span>
                      {quizQuestions.length > 1 && (
                        <button
                          type="button"
                          style={{ ...styles.btnDanger, padding: "3px 10px", fontSize: "12px" }}
                          onClick={() => setQuizQuestions((prev) => prev.filter((_, i) => i !== qi))}
                        >
                          Eliminar
                        </button>
                      )}
                    </div>
                    <input
                      style={{ ...styles.input, marginBottom: "10px" }}
                      placeholder="Texto de la pregunta..."
                      value={q.question}
                      onChange={(e) =>
                        setQuizQuestions((prev) =>
                          prev.map((pq, i) => i === qi ? { ...pq, question: e.target.value } : pq)
                        )
                      }
                    />
                    <div style={{ fontSize: "12px", color: "#71717a", marginBottom: "6px" }}>
                      Opciones (marca la correcta):
                    </div>
                    {q.options.map((opt, oi) => (
                      <div key={oi} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                        <input
                          type="radio"
                          name={`correct-q${qi}`}
                          checked={opt.is_correct}
                          onChange={() =>
                            setQuizQuestions((prev) =>
                              prev.map((pq, i) =>
                                i !== qi ? pq : {
                                  ...pq,
                                  options: pq.options.map((o, j) => ({ ...o, is_correct: j === oi })),
                                }
                              )
                            )
                          }
                          style={{ accentColor: "#5eead4", flexShrink: 0 }}
                        />
                        <input
                          style={{ ...styles.input, flex: 1 }}
                          placeholder={`Opción ${oi + 1}...`}
                          value={opt.option_text}
                          onChange={(e) =>
                            setQuizQuestions((prev) =>
                              prev.map((pq, i) =>
                                i !== qi ? pq : {
                                  ...pq,
                                  options: pq.options.map((o, j) =>
                                    j === oi ? { ...o, option_text: e.target.value } : o
                                  ),
                                }
                              )
                            )
                          }
                        />
                        {q.options.length > 2 && (
                          <button
                            type="button"
                            style={{ ...styles.btnDanger, padding: "4px 8px", fontSize: "12px" }}
                            onClick={() =>
                              setQuizQuestions((prev) =>
                                prev.map((pq, i) =>
                                  i !== qi ? pq : { ...pq, options: pq.options.filter((_, j) => j !== oi) }
                                )
                              )
                            }
                          >
                            ×
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      type="button"
                      style={{ ...styles.btnSecondary, padding: "4px 12px", fontSize: "12px", marginTop: "4px" }}
                      onClick={() =>
                        setQuizQuestions((prev) =>
                          prev.map((pq, i) =>
                            i !== qi ? pq : { ...pq, options: [...pq.options, { option_text: "", is_correct: false }] }
                          )
                        )
                      }
                    >
                      + Opción
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div
              style={{
                display: "flex",
                gap: "12px",
                justifyContent: "flex-end",
              }}
            >
              <button style={styles.btnSecondary} onClick={closeSectionModal}>
                Cancelar
              </button>
              <button
                style={styles.btnPrimary}
                onClick={saveSection}
                disabled={savingSection}
              >
                {savingSection
                  ? "Guardando..."
                  : editingSection
                    ? "Guardar Cambios"
                    : "Agregar Contenido"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

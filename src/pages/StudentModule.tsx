// cea-plataforma/web/src/pages/StudentModule.tsx
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useRole } from "../lib/useRole";

// Clave para sessionStorage
const STORAGE_KEY_PREFIX = "studentModule_";

type ModuleRow = {
  id: number;
  level_id: number;
  title: string;
  description: string | null;
  sort_order: number;
  is_active: boolean | null;
};

type LessonRow = {
  id: number;
  module_id: number;
  title: string;
  sort_order: number;
};

type SectionRow = {
  id: number;
  lesson_id: number;
  title: string;
  kind: string;
  content_json: unknown;
  sort_order: number;
  is_active: boolean | null;
};

type ProgressRow = { section_id: number };

function clampPct(x: number) {
  return Math.max(0, Math.min(100, Math.round(x)));
}

// Función para extraer el ID de archivo de Google Drive desde una URL
function extractDriveFileId(url: string): string | null {
  const patterns = [
    /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/,
    /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/,
    /drive\.google\.com\/uc\?.*id=([a-zA-Z0-9_-]+)/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
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

function asObj(x: unknown): Record<string, unknown> {
  if (x && typeof x === "object") return x as Record<string, unknown>;
  return {};
}

function getText(obj: Record<string, unknown>, key: string) {
  const v = obj[key];
  return typeof v === "string" ? v : "";
}

function getNum(obj: Record<string, unknown>, key: string) {
  const v = obj[key];
  return typeof v === "number" ? v : NaN;
}

// Componente para renderizar HTML con scripts ejecutables
function HTMLRenderer({ html }: { html: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Detectar si el HTML contiene un iframe (para PDFs, videos embebidos, etc.)
  const hasIframe = html.toLowerCase().includes("<iframe");

  // Extraer el iframe si el HTML contiene un documento completo
  let processedHtml = html;
  if (
    html.includes("<!doctype") ||
    html.includes("<html") ||
    html.includes("<body")
  ) {
    const iframeMatch = html.match(/<iframe[^>]*>[\s\S]*?<\/iframe>/i);
    if (iframeMatch) {
      processedHtml = iframeMatch[0];
    }
  }

  useEffect(() => {
    if (!containerRef.current || hasIframe) return;

    // Limpiar el contenedor
    containerRef.current.innerHTML = processedHtml;

    // Extraer y ejecutar scripts
    const scripts = containerRef.current.querySelectorAll("script");
    scripts.forEach((oldScript) => {
      const newScript = document.createElement("script");

      // Copiar atributos
      Array.from(oldScript.attributes).forEach((attr) => {
        newScript.setAttribute(attr.name, attr.value);
      });

      // Copiar contenido
      newScript.textContent = oldScript.textContent;

      // Reemplazar script viejo con nuevo para que se ejecute
      oldScript.parentNode?.replaceChild(newScript, oldScript);
    });
  }, [processedHtml, hasIframe]);

  // Si contiene iframe, renderizar con altura adecuada para PDF/videos
  if (hasIframe) {
    return (
      <div
        className="w-full rounded-2xl border border-slate-800 overflow-hidden bg-white"
        style={{ height: "calc(100vh - 220px)", minHeight: "600px" }}
      >
        <iframe
          srcDoc={`
            <!DOCTYPE html>
            <html style="height:100%;margin:0;">
            <body style="height:100%;margin:0;overflow:hidden;">
              ${processedHtml.replace(/style="[^"]*"/gi, "").replace(/width="[^"]*"/gi, "").replace(/height="[^"]*"/gi, "")}
              <style>
                iframe { width: 100% !important; height: 100% !important; border: none !important; }
              </style>
            </body>
            </html>
          `}
          style={{ width: "100%", height: "100%", border: "none" }}
          title="Contenido"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="w-full rounded-2xl border border-slate-800 p-4 bg-white text-black"
    />
  );
}

export default function StudentModule() {
  const nav = useNavigate();
  const { moduleId } = useParams();
  const { loading, session } = useRole();

  const mid = Number(moduleId);
  const invalidMid = !Number.isFinite(mid);
  const storageKey = `${STORAGE_KEY_PREFIX}${mid}`;

  // Función para leer URL params
  const getUrlSectionId = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    const s = params.get("s");
    return s ? Number(s) : null;
  }, []);

  // Función para leer de sessionStorage
  const getSavedSectionId = useCallback(() => {
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) {
        return Number(saved);
      }
    } catch {
      // ignorar errores
    }
    return null;
  }, [storageKey]);

  // Estado inicial: URL tiene prioridad, luego sessionStorage
  const [initialSectionId] = useState(() => {
    const urlId = getUrlSectionId();
    const savedId = getSavedSectionId();
    return urlId ?? savedId;
  });

  const [msg, setMsg] = useState<string | null>(null);

  const [, setModules] = useState<ModuleRow[]>([]);
  const [moduleRow, setModuleRow] = useState<ModuleRow | null>(null);

  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [completedSet, setCompletedSet] = useState<Set<number>>(new Set());

  const [openLessonIds, setOpenLessonIds] = useState<Set<number>>(new Set());
  const [currentSectionId, setCurrentSectionIdState] = useState<number | null>(null);

  // Función para actualizar URL
  const updateUrl = useCallback((sectionId: number | null) => {
    if (sectionId !== null) {
      const newUrl = `${window.location.pathname}?s=${sectionId}`;
      window.history.replaceState({}, "", newUrl);
    }
  }, []);

  // Función wrapper que actualiza estado, URL y sessionStorage
  const setCurrentSectionId = useCallback((id: number | null) => {
    setCurrentSectionIdState(id);
    if (id !== null) {
      sessionStorage.setItem(storageKey, String(id));
      updateUrl(id);
    }
  }, [storageKey, updateUrl]);

  // estado local para quiz (MVP)
  const [quizSelected, setQuizSelected] = useState<number | null>(null);
  const [quizFeedback, setQuizFeedback] = useState<string | null>(null);

  const [marking, setMarking] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);

  // -------- Carga principal --------
  useEffect(() => {
    if (!session) return;
    if (invalidMid) return;
    if (dataLoaded) return; // Evitar recargas innecesarias

    async function load() {
      setMsg(null);

      // 1) enrollment -> level_id
      const enr = await supabase
        .from("enrollments")
        .select("level_id")
        .eq("student_id", session!.user.id)
        .maybeSingle();

      if (enr.error) {
        setMsg("No se pudo leer tu nivel (enrollments): " + enr.error.message);
        return;
      }

      const lvId = enr.data?.level_id ? Number(enr.data.level_id) : null;
      if (!lvId) {
        setMsg(
          "No tienes nivel asignado. Pide al admin/docente que te asigne un nivel.",
        );
        return;
      }

      // 2) módulos del nivel
      const modsRes = await supabase
        .from("modules")
        .select("id,level_id,title,description,sort_order,is_active")
        .eq("level_id", lvId)
        .order("sort_order");

      if (modsRes.error) {
        setMsg("No se pudo cargar módulos: " + modsRes.error.message);
        return;
      }

      const modList = ((modsRes.data ?? []) as ModuleRow[]).filter(
        (m) => m.is_active !== false,
      );
      setModules(modList);

      const currentMod = modList.find((m) => m.id === mid) ?? null;
      if (!currentMod) {
        setMsg("Este módulo no pertenece a tu nivel o no existe.");
        return;
      }
      setModuleRow(currentMod);

      // 3) lessons del módulo (sin is_active)
      const lessonsRes = await supabase
        .from("lessons")
        .select("id,module_id,title,sort_order")
        .eq("module_id", mid)
        .order("sort_order");

      if (lessonsRes.error) {
        setMsg("No se pudo cargar lecciones: " + lessonsRes.error.message);
        return;
      }

      const lessonList = (lessonsRes.data ?? []) as LessonRow[];
      setLessons(lessonList);

      // abrir todas por defecto
      setOpenLessonIds(new Set(lessonList.map((l) => l.id)));

      const lessonIds = lessonList.map((l) => l.id);
      if (lessonIds.length === 0) {
        setSections([]);
        setCurrentSectionId(null);
        return;
      }

      // 4) sections de esas lessons
      const secRes = await supabase
        .from("lesson_sections")
        .select("id,lesson_id,title,kind,content_json,sort_order,is_active")
        .in("lesson_id", lessonIds)
        .order("lesson_id", { ascending: true })
        .order("sort_order", { ascending: true });

      if (secRes.error) {
        setMsg("No se pudo cargar secciones: " + secRes.error.message);
        return;
      }

      const secList = ((secRes.data ?? []) as SectionRow[]).filter(
        (s) => s.is_active !== false,
      );
      setSections(secList);

      // 5) progreso del estudiante
      const progRes = await supabase
        .from("student_section_progress")
        .select("section_id")
        .eq("student_id", session!.user.id);

      if (progRes.error) {
        setMsg("No se pudo cargar progreso: " + progRes.error.message);
        return;
      }

      const rows = (progRes.data ?? []) as ProgressRow[];
      const done = new Set<number>(rows.map((r) => Number(r.section_id)));
      setCompletedSet(done);

      // sección inicial: usar la guardada si es válida, sino la primera
      const validSavedSection = initialSectionId && secList.some(s => s.id === initialSectionId);
      const targetSectionId = validSavedSection ? initialSectionId : (secList[0]?.id ?? null);
      setCurrentSectionId(targetSectionId);

      // reset quiz ui
      setQuizSelected(null);
      setQuizFeedback(null);

      setDataLoaded(true);
    }

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, mid, invalidMid]);

  // -------- Estructura: lesson -> sections --------
  const sectionsByLesson = useMemo(() => {
    const map = new Map<number, SectionRow[]>();
    for (const s of sections) {
      const arr = map.get(s.lesson_id) ?? [];
      arr.push(s);
      map.set(s.lesson_id, arr);
    }
    for (const [k, arr] of map.entries()) {
      arr.sort((a, b) => a.sort_order - b.sort_order);
      map.set(k, arr);
    }
    return map;
  }, [sections]);

  // lista lineal para navegación prev/next
  const linearSections = useMemo(() => {
    const orderedLessons = lessons
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order);
    const out: SectionRow[] = [];
    for (const l of orderedLessons) {
      const arr = sectionsByLesson.get(l.id) ?? [];
      for (const s of arr) out.push(s);
    }
    return out;
  }, [lessons, sectionsByLesson]);

  const currentIndex = useMemo(() => {
    if (!currentSectionId) return -1;
    return linearSections.findIndex((s) => s.id === currentSectionId);
  }, [linearSections, currentSectionId]);

  const currentSection = useMemo(() => {
    if (currentIndex < 0) return null;
    return linearSections[currentIndex] ?? null;
  }, [linearSections, currentIndex]);

  const progress = useMemo(() => {
    const total = linearSections.length;
    if (total === 0) return { total: 0, done: 0, pct: 0 };
    let done = 0;
    for (const s of linearSections) if (completedSet.has(s.id)) done++;
    const pct = total > 0 ? (done / total) * 100 : 0;
    return { total, done, pct: clampPct(pct) };
  }, [linearSections, completedSet]);

  const canFinal = progress.pct >= 70; // ✅ cambio: 70%

  async function toggleCompleted(sectionId: number) {
    if (!session) return;

    setMarking(true);
    setMsg(null);

    const isDone = completedSet.has(sectionId);

    if (isDone) {
      // ✅ desmarcar = delete
      const del = await supabase
        .from("student_section_progress")
        .delete()
        .eq("student_id", session.user.id)
        .eq("section_id", sectionId);

      setMarking(false);

      if (del.error) {
        setMsg("No se pudo desmarcar: " + del.error.message);
        return;
      }

      setCompletedSet((prev) => {
        const n = new Set(prev);
        n.delete(sectionId);
        return n;
      });
      return;
    }

    // ✅ marcar = upsert
    const up = await supabase
      .from("student_section_progress")
      .upsert(
        { student_id: session.user.id, section_id: sectionId },
        { onConflict: "student_id,section_id" },
      );

    setMarking(false);

    if (up.error) {
      setMsg("No se pudo marcar como completado: " + up.error.message);
      return;
    }

    setCompletedSet((prev) => new Set(prev).add(sectionId));
  }

  function goPrev() {
    if (currentIndex <= 0) return;
    const prev = linearSections[currentIndex - 1];
    setCurrentSectionId(prev.id);
    setQuizSelected(null);
    setQuizFeedback(null);
  }

  function goNext() {
    if (currentIndex < 0 || currentIndex >= linearSections.length - 1) return;
    const next = linearSections[currentIndex + 1];
    setCurrentSectionId(next.id);
    setQuizSelected(null);
    setQuizFeedback(null);
  }

  function toggleLesson(id: number) {
    setOpenLessonIds((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  function renderSectionContent(s: SectionRow) {
    const obj = asObj(s.content_json);

    if (s.kind === "text") {
      const text = getText(obj, "text");
      return (
        <div className="text-slate-200 leading-relaxed whitespace-pre-wrap">
          {text || "(sin contenido)"}
        </div>
      );
    }

    if (s.kind === "video") {
      const url = getText(obj, "url");
      return (
        <div className="space-y-2">
          <div className="text-sm text-slate-400">Video</div>
          {url ? (
            <div className="aspect-video w-full overflow-hidden rounded-2xl border border-slate-800 bg-black">
              <iframe
                className="w-full h-full"
                src={url.replace("watch?v=", "embed/")}
                title="Video"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <div className="text-slate-400">(falta url)</div>
          )}
        </div>
      );
    }

    if (s.kind === "image") {
      const url = getText(obj, "url");
      return url ? (
        <img
          src={url}
          alt={s.title}
          className="w-full rounded-2xl border border-slate-800"
        />
      ) : (
        <div className="text-slate-400">(falta url)</div>
      );
    }

    if (s.kind === "link") {
      const url = getText(obj, "url");
      const label = getText(obj, "label") || url;
      return url ? (
        <a
          className="text-sky-400 underline"
          href={url}
          target="_blank"
          rel="noreferrer"
        >
          {label}
        </a>
      ) : (
        <div className="text-slate-400">(falta url)</div>
      );
    }

    if (s.kind === "html") {
      const html = getText(obj, "html");
      return <HTMLRenderer html={html || ""} />;
    }

    if (s.kind === "quiz") {
      const question = getText(obj, "question");
      const options = Array.isArray(obj.options)
        ? (obj.options as unknown[])
        : [];
      const ans = getNum(obj, "answer");
      const answer = Number.isFinite(ans) ? ans : null;

      return (
        <div className="space-y-3">
          <div className="text-sm text-slate-400">Quiz (demo)</div>
          <div className="font-semibold text-slate-100">
            {question || "Pregunta"}
          </div>

          <div className="space-y-2">
            {options.map((opt, i) => {
              const text = typeof opt === "string" ? opt : JSON.stringify(opt);
              const checked = quizSelected === i;
              return (
                <button
                  key={i}
                  type="button"
                  className={
                    "w-full text-left rounded-xl border border-slate-800 px-3 py-2 hover:bg-slate-900 " +
                    (checked ? "ring-2 ring-white" : "")
                  }
                  onClick={() => {
                    setQuizSelected(i);
                    setQuizFeedback(null);
                  }}
                >
                  <span className="text-slate-200">
                    {String.fromCharCode(65 + i)}. {text}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-xl px-3 py-2 bg-white text-black disabled:opacity-50"
              disabled={quizSelected === null}
              onClick={() => {
                if (answer === null) {
                  setQuizFeedback(
                    "Este quiz no tiene respuesta configurada (demo).",
                  );
                } else if (quizSelected === answer) {
                  setQuizFeedback("✅ Correcto");
                } else {
                  setQuizFeedback("❌ Incorrecto");
                }
              }}
            >
              Revisar
            </button>

            <div className="text-sm text-slate-300 flex items-center">
              {quizFeedback ?? ""}
            </div>
          </div>
        </div>
      );
    }

    // Tipo Google Drive (PDF, imagen, video de Drive)
    if (s.kind === "drive") {
      const driveId = getText(obj, "driveId");
      const originalUrl = getText(obj, "originalUrl");

      // Si no hay driveId guardado, intentar extraerlo de la URL original
      const fileId = driveId || extractDriveFileId(originalUrl);

      if (!fileId) {
        return (
          <div className="text-red-400">
            Error: No se pudo obtener el ID del archivo de Google Drive
          </div>
        );
      }

      // URL de preview de Google Drive (funciona para PDF, imágenes, videos)
      const embedUrl = `https://drive.google.com/file/d/${fileId}/preview`;

      return (
        <div
          className="w-full rounded-2xl border border-slate-800 overflow-hidden bg-white"
          style={{ height: "calc(100vh - 220px)", minHeight: "600px" }}
        >
          <iframe
            src={embedUrl}
            className="w-full h-full"
            title={s.title}
            allow="autoplay"
            allowFullScreen
          />
        </div>
      );
    }

    return <div className="text-slate-400">(tipo desconocido: {s.kind})</div>;
  }

  if (loading) return <div className="p-6">Cargando...</div>;
  if (!session) return <Navigate to="/login" replace />;
  if (invalidMid) return <Navigate to="/student" replace />;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="bg-slate-900/50 backdrop-blur-sm border-b border-slate-800 sticky top-0 z-10">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="text-lg sm:text-xl font-bold truncate">
              {moduleRow?.title ?? "Módulo"}
            </div>
            <div className="text-xs sm:text-sm text-slate-400 flex flex-wrap items-center gap-x-2">
              <span>{progress.pct}% completado</span>
              <span className="hidden sm:inline">·</span>
              <span
                className={`hidden sm:inline ${canFinal ? "text-emerald-400" : "text-slate-500"}`}
              >
                Evaluación {canFinal ? "habilitada ✅" : "bloqueada 🔒"}
              </span>
            </div>
          </div>

          <div className="flex gap-2 shrink-0">
            <button
              className="rounded-lg px-3 py-2 text-sm border border-slate-700 hover:bg-slate-800 transition-colors"
              onClick={() => nav("/student", { replace: true })}
            >
              <span className="hidden sm:inline">← Volver</span>
              <span className="sm:hidden">←</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex flex-col lg:flex-row gap-4 px-4 sm:px-6 py-4 sm:py-6 max-w-[1600px] mx-auto">
        {/* Sidebar izquierdo */}
        <aside className="lg:w-72 xl:w-80 shrink-0 bg-slate-950 rounded-2xl border border-slate-800 p-4 space-y-3 h-fit lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
          <ProgressBar value={progress.pct} />

          <div className="pt-2 border-t border-slate-800">
            <div className="text-sm font-semibold mb-2 text-slate-400">Contenido</div>

            <div className="space-y-1.5">
              {lessons
                .slice()
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((l) => {
                  const isOpen = openLessonIds.has(l.id);
                  const sec = sectionsByLesson.get(l.id) ?? [];
                  const lessonDone = sec.every((s) => completedSet.has(s.id));
                  const lessonProgress = sec.length > 0
                    ? sec.filter((s) => completedSet.has(s.id)).length
                    : 0;

                  return (
                    <div key={l.id} className="rounded-lg overflow-hidden">
                      <button
                        type="button"
                        className={`w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors ${
                          isOpen ? "bg-slate-800/50" : "hover:bg-slate-800/30"
                        }`}
                        onClick={() => toggleLesson(l.id)}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`text-sm font-medium truncate ${lessonDone ? "text-emerald-400" : "text-slate-200"}`}>
                            {l.title}
                          </span>
                          {lessonDone && <span className="text-xs">✓</span>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-slate-500">
                            {lessonProgress}/{sec.length}
                          </span>
                          <svg
                            className={`w-4 h-4 text-slate-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </div>
                      </button>

                      {isOpen && (
                        <div className="py-1 space-y-0.5 bg-slate-900/30">
                          {sec.map((s) => {
                            const active = s.id === currentSectionId;
                            const done = completedSet.has(s.id);

                            return (
                              <button
                                key={s.id}
                                type="button"
                                className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                                  active
                                    ? "bg-sky-600/20 text-sky-400 border-l-2 border-sky-500"
                                    : "hover:bg-slate-800/50 text-slate-300 border-l-2 border-transparent"
                                }`}
                                onClick={() => {
                                  setCurrentSectionId(s.id);
                                  setQuizSelected(null);
                                  setQuizFeedback(null);
                                }}
                              >
                                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-xs shrink-0 ${
                                  done
                                    ? "bg-emerald-500/20 text-emerald-400"
                                    : "bg-slate-700 text-slate-500"
                                }`}>
                                  {done ? "✓" : "○"}
                                </span>
                                <span className="truncate">{s.title}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        </aside>

        {/* Contenido principal */}
        <section className="flex-1 min-w-0 bg-slate-950 rounded-2xl border border-slate-800 p-4 sm:p-6 space-y-4">
          {msg && (
            <pre className="text-sm bg-slate-900 border border-slate-800 rounded-xl p-3 whitespace-pre-wrap">
              {msg}
            </pre>
          )}

          {!currentSection ? (
            <div className="text-slate-400">
              Este módulo aún no tiene secciones.
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h2 className="text-xl font-bold truncate">{currentSection.title}</h2>
                  <div className="text-sm text-slate-400">
                    {currentIndex + 1} de {linearSections.length}
                  </div>
                </div>

                <span className={`shrink-0 text-xs px-3 py-1.5 rounded-full font-medium ${
                  completedSet.has(currentSection.id)
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : "bg-slate-800 text-slate-400 border border-slate-700"
                }`}>
                  {completedSet.has(currentSection.id) ? "✓ Completada" : "Pendiente"}
                </span>
              </div>

              <div className="border-t border-slate-800 pt-4">
                {renderSectionContent(currentSection)}
              </div>

              {/* Barra de navegación fija en la parte inferior */}
              <div className="flex items-center justify-between gap-4 pt-4 border-t border-slate-800">
                {/* Botón Anterior */}
                <button
                  type="button"
                  className={`flex items-center gap-2 rounded-xl px-5 py-3 font-medium transition-all ${
                    currentIndex <= 0
                      ? "opacity-40 cursor-not-allowed bg-slate-900 text-slate-500"
                      : "bg-slate-800 hover:bg-slate-700 text-white"
                  }`}
                  disabled={currentIndex <= 0}
                  onClick={goPrev}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                  <span className="hidden sm:inline">Anterior</span>
                </button>

                {/* Botón Marcar completado (centro) */}
                <button
                  type="button"
                  className={`flex-1 max-w-xs rounded-xl px-4 py-3 font-medium transition-all ${
                    completedSet.has(currentSection.id)
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                      : "bg-white hover:bg-slate-100 text-black"
                  } disabled:opacity-50`}
                  disabled={marking || !currentSection}
                  onClick={() => toggleCompleted(currentSection.id)}
                >
                  {marking
                    ? "Guardando..."
                    : completedSet.has(currentSection.id)
                      ? "✓ Completada"
                      : "Marcar completada"}
                </button>

                {/* Botón Siguiente */}
                <button
                  type="button"
                  className={`flex items-center gap-2 rounded-xl px-5 py-3 font-medium transition-all ${
                    currentIndex < 0 || currentIndex >= linearSections.length - 1
                      ? "opacity-40 cursor-not-allowed bg-slate-900 text-slate-500"
                      : "bg-sky-600 hover:bg-sky-500 text-white"
                  }`}
                  disabled={currentIndex < 0 || currentIndex >= linearSections.length - 1}
                  onClick={goNext}
                >
                  <span className="hidden sm:inline">Siguiente</span>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

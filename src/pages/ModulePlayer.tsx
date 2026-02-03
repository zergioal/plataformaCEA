import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useRole } from "../lib/useRole";

type Lesson = { id: number; title: string; sort_order: number };
type Section = {
  id: number;
  lesson_id: number;
  title: string;
  sort_order: number;
  kind: "text" | "video" | "image" | "link" | "html" | "drive" | string;
  content_json: any;
};

function clampPct(x: number) {
  return Math.max(0, Math.min(100, Math.round(x)));
}

// Función para extraer el ID de archivo de Google Drive
function extractDriveFileId(url: string): string | null {
  // Formatos soportados:
  // https://drive.google.com/file/d/FILE_ID/view
  // https://drive.google.com/open?id=FILE_ID
  // https://drive.google.com/uc?id=FILE_ID
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
      <div className="flex justify-between text-sm mb-1">
        <span className="font-medium">Progreso del módulo</span>
        <span>{v}%</span>
      </div>
      <div className="h-3 rounded-full bg-gray-200 overflow-hidden">
        <div className="h-3 bg-black rounded-full" style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}

function renderSection(section: Section) {
  const content = section.content_json ?? {};

  if (section.kind === "text") {
    return (
      <div
        className="prose max-w-none"
        dangerouslySetInnerHTML={{ __html: String(content.text ?? "") }}
      />
    );
  }

  if (section.kind === "video") {
    const url = String(content.url ?? "");
    return (
      <div className="space-y-3">
        <div className="font-semibold">{section.title}</div>
        <div className="aspect-video w-full overflow-hidden rounded-2xl border bg-black">
          <iframe
            className="w-full h-full"
            src={url}
            title="video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    );
  }

  if (section.kind === "image") {
    const url = String(content.url ?? "");
    return (
      <div className="space-y-3">
        <div className="font-semibold">{section.title}</div>
        <img
          src={url}
          alt={content.alt || section.title}
          className="w-full rounded-2xl border"
        />
      </div>
    );
  }

  if (section.kind === "html") {
    let html = String(content.html ?? "");

    // Si el HTML contiene un documento completo, extraer solo el contenido del body o el iframe
    if (
      html.includes("<!doctype") ||
      html.includes("<html") ||
      html.includes("<body")
    ) {
      // Intentar extraer el iframe directamente
      const iframeMatch = html.match(/<iframe[^>]*>[\s\S]*?<\/iframe>/i);
      if (iframeMatch) {
        html = iframeMatch[0];
      }
    }

    // Detectar si contiene iframe para darle altura adecuada
    const hasIframe = html.toLowerCase().includes("<iframe");

    if (hasIframe) {
      // Para iframes de Drive/PDF, usar altura casi completa de la pantalla
      return (
        <div className="space-y-3">
          <div className="font-semibold">{section.title}</div>
          <div
            className="w-full rounded-2xl border overflow-hidden bg-white"
            style={{ height: "calc(100vh - 180px)", minHeight: "700px" }}
          >
            <iframe
              srcDoc={`
                <!DOCTYPE html>
                <html style="height:100%;margin:0;">
                <body style="height:100%;margin:0;overflow:hidden;">
                  ${html.replace(/style="[^"]*"/gi, "")}
                </body>
                </html>
              `}
              style={{ width: "100%", height: "100%", border: "none" }}
              title={section.title}
              allowFullScreen
            />
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <div className="font-semibold">{section.title}</div>
        <div
          className="w-full rounded-2xl border overflow-hidden bg-white p-4"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    );
  }

  if (section.kind === "link") {
    const url = String(content.url ?? "");
    const label = String(content.label ?? "Visitar enlace");
    const driveFileId = extractDriveFileId(url);

    // Si es un archivo de Google Drive
    if (driveFileId) {
      // Usar Google Docs Viewer que es más confiable para embeber
      const embedUrl = `https://docs.google.com/viewer?srcid=${driveFileId}&pid=explorer&efh=false&a=v&chrome=false&embedded=true`;

      return (
        <div className="space-y-3">
          <div className="font-semibold">{section.title}</div>
          <div
            className="w-full rounded-2xl border overflow-hidden bg-white"
            style={{ height: "600px" }}
          >
            <iframe
              src={embedUrl}
              className="w-full h-full"
              title={section.title}
              frameBorder="0"
              allowFullScreen
            />
          </div>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm"
          >
            Abrir en Drive
          </a>
        </div>
      );
    }

    // Link normal (no es de Google Drive)
    return (
      <div className="space-y-3">
        <div className="font-semibold">{section.title}</div>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          {label}
        </a>
      </div>
    );
  }

  // Tipo específico para Google Drive (más simple y confiable)
  if (section.kind === "drive") {
    const driveId = String(content.driveId ?? "");
    const originalUrl = String(content.originalUrl ?? "");

    if (!driveId) {
      return (
        <div className="text-sm text-red-500">
          Error: No se encontró el ID del archivo de Drive
        </div>
      );
    }

    // Usar el preview de Google Drive
    const embedUrl = `https://drive.google.com/file/d/${driveId}/preview`;

    return (
      <div className="space-y-3">
        <div className="font-semibold">{section.title}</div>
        <div
          className="w-full rounded-2xl border overflow-hidden bg-white"
          style={{ height: "600px" }}
        >
          <iframe
            src={embedUrl}
            className="w-full h-full"
            title={section.title}
            allow="autoplay"
            allowFullScreen
          />
        </div>
        <a
          href={
            originalUrl || `https://drive.google.com/file/d/${driveId}/view`
          }
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm"
        >
          Abrir en Drive
        </a>
      </div>
    );
  }

  return (
    <div className="text-sm text-gray-600">
      Tipo no soportado todavía: <b>{section.kind}</b>
    </div>
  );
}

// Cache COMPLETO del módulo - guarda todo el estado
const MODULE_CACHE_KEY = "module_player_full_";

interface ModuleStateCache {
  moduleName: string;
  lessons: Lesson[];
  sections: Section[];
  doneIds: number[];
  activeLessonId: number | null;
  activeSectionId: number | null;
}

function getModuleCache(moduleId: number): ModuleStateCache | null {
  try {
    const raw = sessionStorage.getItem(MODULE_CACHE_KEY + moduleId);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveModuleCache(moduleId: number, state: ModuleStateCache) {
  try {
    sessionStorage.setItem(MODULE_CACHE_KEY + moduleId, JSON.stringify(state));
  } catch {
    // Ignorar errores
  }
}

export default function ModulePlayer() {
  const nav = useNavigate();
  const { moduleId } = useParams();
  const { loading, session, profile } = useRole();

  const mid = Number(moduleId);

  // Cargar estado inicial desde cache
  const initialState = useMemo(() => getModuleCache(mid), [mid]);

  const [moduleName, setModuleName] = useState<string>(
    initialState?.moduleName ?? "Módulo",
  );
  const [lessons, setLessons] = useState<Lesson[]>(initialState?.lessons ?? []);
  const [sections, setSections] = useState<Section[]>(
    initialState?.sections ?? [],
  );
  const [doneIds, setDoneIds] = useState<Set<number>>(
    new Set(initialState?.doneIds ?? []),
  );
  const [activeLessonId, setActiveLessonId] = useState<number | null>(
    initialState?.activeLessonId ?? null,
  );
  const [activeSectionId, setActiveSectionId] = useState<number | null>(
    initialState?.activeSectionId ?? null,
  );
  const [msg, setMsg] = useState<string | null>(null);
  const [dataLoaded, setDataLoaded] = useState(!!initialState);

  // Guardar TODO el estado en cache cuando cambie navegación
  useEffect(() => {
    if (dataLoaded && lessons.length > 0) {
      saveModuleCache(mid, {
        moduleName,
        lessons,
        sections,
        doneIds: Array.from(doneIds),
        activeLessonId,
        activeSectionId,
      });
    }
  }, [
    mid,
    moduleName,
    lessons,
    sections,
    doneIds,
    activeLessonId,
    activeSectionId,
    dataLoaded,
  ]);

  // Solo cargar de la API si NO tenemos datos en cache
  useEffect(() => {
    if (!session || !Number.isFinite(mid)) return;
    if (dataLoaded) return; // Ya tenemos datos del cache, no recargar

    async function loadFromAPI() {
      setMsg(null);

      // módulo
      const modRes = await supabase
        .from("modules")
        .select("id,name")
        .eq("id", mid)
        .single();

      if (modRes.error) {
        setMsg("No se pudo cargar el módulo: " + modRes.error.message);
        return;
      }
      const loadedModuleName = String(modRes.data?.name ?? "Módulo");
      setModuleName(loadedModuleName);

      // lecciones
      const lesRes = await supabase
        .from("lessons")
        .select("id,title,sort_order")
        .eq("module_id", mid)
        .order("sort_order");

      if (lesRes.error) {
        setMsg("No se pudo cargar lecciones: " + lesRes.error.message);
        return;
      }

      const ls = (lesRes.data ?? []) as Lesson[];
      setLessons(ls);

      const firstLessonId = ls[0]?.id ?? null;

      if (!firstLessonId) {
        setSections([]);
        setActiveLessonId(null);
        setActiveSectionId(null);
        setDataLoaded(true);
        return;
      }

      setActiveLessonId(firstLessonId);

      // secciones (todas las lecciones del módulo)
      const ids = ls.map((x) => x.id);
      const secRes = await supabase
        .from("lesson_sections")
        .select("id,lesson_id,title,sort_order,kind,content_json")
        .in("lesson_id", ids)
        .order("lesson_id")
        .order("sort_order");

      if (secRes.error) {
        setMsg("No se pudo cargar secciones: " + secRes.error.message);
        return;
      }

      const ss = (secRes.data ?? []) as Section[];
      setSections(ss);

      // progreso completado
      const progRes = await supabase
        .from("student_section_progress")
        .select("section_id")
        .eq("student_id", session!.user.id);

      if (progRes.error) {
        setMsg("No se pudo cargar progreso: " + progRes.error.message);
        return;
      }

      const doneArray = (progRes.data ?? []).map(
        (r: { section_id: number }) => r.section_id,
      );
      setDoneIds(new Set(doneArray));

      // Primera sección de la primera lección
      const firstSectionId =
        ss.find((s) => s.lesson_id === firstLessonId)?.id ?? null;
      setActiveSectionId(firstSectionId);

      setDataLoaded(true);
    }

    loadFromAPI();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, mid]);

  const sectionsByLesson = useMemo(() => {
    const map = new Map<number, Section[]>();
    for (const s of sections) {
      const arr = map.get(s.lesson_id) ?? [];
      arr.push(s);
      map.set(s.lesson_id, arr);
    }
    return map;
  }, [sections]);

  const activeSections = useMemo(() => {
    if (!activeLessonId) return [];
    return sectionsByLesson.get(activeLessonId) ?? [];
  }, [sectionsByLesson, activeLessonId]);

  const activeSection = useMemo(() => {
    return sections.find((s) => s.id === activeSectionId) ?? null;
  }, [sections, activeSectionId]);

  const totalSections = sections.length;
  const completedCount = doneIds.size;
  const progress = totalSections ? (completedCount / totalSections) * 100 : 0;
  const canFinal = clampPct(progress) >= 100;

  async function markDone() {
    if (!session || !activeSectionId) return;

    const { error } = await supabase.from("student_section_progress").insert({
      student_id: session.user.id,
      section_id: activeSectionId,
      completed: true,
    });

    // si ya existe (PK), lo ignoramos en UI
    if (!error) {
      setDoneIds((prev) => new Set(prev).add(activeSectionId));
    }
  }

  function gotoPrevNext(dir: -1 | 1) {
    if (!activeLessonId || !activeSectionId) return;

    const flat = sections
      .slice()
      .sort((a, b) => a.lesson_id - b.lesson_id || a.sort_order - b.sort_order);

    const idx = flat.findIndex((s) => s.id === activeSectionId);
    const next = flat[idx + dir];
    if (!next) return;

    setActiveLessonId(next.lesson_id);
    setActiveSectionId(next.id);
  }

  if (loading) return <div className="p-6">Cargando...</div>;
  if (!session) return <Navigate to="/login" replace />;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-500">CEA Madre María Oliva</div>
            <h1 className="text-xl font-bold">{moduleName}</h1>
          </div>
          <div className="flex gap-2">
            <button
              className="rounded-xl px-3 py-2 border"
              onClick={() => nav("/student", { replace: true })}
            >
              Volver
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-1 md:grid-cols-[300px_1fr] gap-4">
        {/* Sidebar */}
        <aside className="bg-white rounded-2xl shadow p-4 space-y-4 h-fit">
          <div className="space-y-2">
            <div className="text-sm text-gray-500">Alumno</div>
            <div className="font-semibold">
              {profile?.full_name ?? profile?.code ?? "Estudiante"}
            </div>
          </div>

          <ProgressBar value={progress} />

          <div className="text-sm text-gray-600">
            Evaluación final:{" "}
            <b className={canFinal ? "text-green-600" : "text-gray-500"}>
              {canFinal ? "Habilitada ✅" : "Bloqueada 🔒 (100%)"}
            </b>
          </div>

          <div className="border-t pt-3 space-y-2">
            <div className="text-sm font-semibold">Índice</div>
            {lessons.map((l) => (
              <button
                key={l.id}
                className={
                  "w-full text-left rounded-xl px-3 py-2 border " +
                  (activeLessonId === l.id ? "bg-gray-50" : "bg-white")
                }
                onClick={() => {
                  setActiveLessonId(l.id);
                  const first = (sectionsByLesson.get(l.id) ?? [])[0];
                  setActiveSectionId(first?.id ?? null);
                }}
              >
                <div className="font-medium">{l.title}</div>
                <div className="text-xs text-gray-500">
                  {(sectionsByLesson.get(l.id) ?? []).length} secciones
                </div>
              </button>
            ))}
          </div>

          {/* Secciones de la lección activa */}
          {activeLessonId && (
            <div className="border-t pt-3 space-y-2">
              <div className="text-sm font-semibold">Secciones</div>
              {activeSections.map((s) => {
                const done = doneIds.has(s.id);
                return (
                  <button
                    key={s.id}
                    className={
                      "w-full text-left rounded-xl px-3 py-2 border " +
                      (activeSectionId === s.id ? "bg-gray-50" : "bg-white")
                    }
                    onClick={() => setActiveSectionId(s.id)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm">{s.title}</span>
                      <span className="text-xs">{done ? "✅" : ""}</span>
                    </div>
                    <div className="text-xs text-gray-500">{s.kind}</div>
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        {/* Contenido */}
        <section className="bg-white rounded-2xl shadow p-6 space-y-4">
          {msg && (
            <pre className="text-sm bg-gray-50 border rounded-xl p-3 whitespace-pre-wrap">
              {msg}
            </pre>
          )}

          {!activeSection ? (
            <div className="text-gray-600">No hay secciones aún.</div>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm text-gray-500">
                    {activeSection.kind.toUpperCase()}
                  </div>
                  <h2 className="text-xl font-bold">{activeSection.title}</h2>
                </div>

                <button
                  className="rounded-xl px-3 py-2 border"
                  onClick={markDone}
                  disabled={doneIds.has(activeSection.id)}
                  title={
                    doneIds.has(activeSection.id)
                      ? "Ya completado"
                      : "Marcar como completado"
                  }
                >
                  {doneIds.has(activeSection.id)
                    ? "Completado ✅"
                    : "Marcar completado"}
                </button>
              </div>

              <div className="border-t pt-4">
                {renderSection(activeSection)}
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  className="rounded-xl px-3 py-2 border w-full"
                  onClick={() => gotoPrevNext(-1)}
                >
                  ← Anterior
                </button>
                <button
                  className="rounded-xl px-3 py-2 border w-full"
                  onClick={() => gotoPrevNext(1)}
                >
                  Siguiente →
                </button>
              </div>

              <button
                className="rounded-xl px-3 py-2 bg-black text-white w-full disabled:opacity-50"
                disabled={!canFinal}
                onClick={() =>
                  alert(
                    "Luego: evaluación final del módulo (docente califica manualmente)",
                  )
                }
              >
                Evaluación Final del Módulo
              </button>
            </>
          )}
        </section>
      </main>
    </div>
  );
}

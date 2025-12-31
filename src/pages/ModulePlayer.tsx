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
  kind: "text" | "video" | "image" | string;
  payload: any;
};

function clampPct(x: number) {
  return Math.max(0, Math.min(100, Math.round(x)));
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
  const p = section.payload ?? {};
  if (section.kind === "text") {
    return (
      <div
        className="prose max-w-none"
        dangerouslySetInnerHTML={{ __html: String(p.html ?? "") }}
      />
    );
  }

  if (section.kind === "video") {
    const url = String(p.url ?? "");
    return (
      <div className="space-y-3">
        <div className="font-semibold">{p.title ?? "Video"}</div>
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
    const url = String(p.url ?? "");
    return (
      <div className="space-y-3">
        <div className="font-semibold">{p.title ?? "Imagen"}</div>
        <img src={url} className="w-full rounded-2xl border" />
      </div>
    );
  }

  return (
    <div className="text-sm text-gray-600">
      Tipo no soportado todavía: <b>{section.kind}</b>
    </div>
  );
}

export default function ModulePlayer() {
  const nav = useNavigate();
  const { moduleId } = useParams();
  const { loading, session, profile } = useRole();

  const [moduleName, setModuleName] = useState<string>("Módulo");
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [doneIds, setDoneIds] = useState<Set<number>>(new Set());
  const [activeLessonId, setActiveLessonId] = useState<number | null>(null);
  const [activeSectionId, setActiveSectionId] = useState<number | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const mid = Number(moduleId);

  useEffect(() => {
    if (!session || !Number.isFinite(mid)) return;

    async function load() {
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
      setModuleName(String(modRes.data?.name ?? "Módulo"));

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

      const firstLesson = ls[0]?.id ?? null;
      setActiveLessonId(firstLesson);

      if (!firstLesson) {
        setSections([]);
        setActiveSectionId(null);
        return;
      }

      // secciones (todas las lecciones del módulo)
      const ids = ls.map((x) => x.id);
      const secRes = await supabase
        .from("lesson_sections")
        .select("id,lesson_id,title,sort_order,kind,payload")
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
        .eq("student_id", session.user.id);

      if (progRes.error) {
        setMsg("No se pudo cargar progreso: " + progRes.error.message);
        return;
      }

      const set = new Set<number>(
        (progRes.data ?? []).map((r: any) => r.section_id)
      );
      setDoneIds(set);

      // sección inicial
      const firstSection =
        ss.find((s) => s.lesson_id === firstLesson)?.id ?? null;
      setActiveSectionId(firstSection);
    }

    load();
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
                    "Luego: evaluación final del módulo (docente califica manualmente)"
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

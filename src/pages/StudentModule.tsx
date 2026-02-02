// cea-plataforma/web/src/pages/StudentModule.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useRole } from "../lib/useRole";

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

  useEffect(() => {
    if (!containerRef.current) return;

    // Limpiar el contenedor
    containerRef.current.innerHTML = html;

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
  }, [html]);

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

  const [msg, setMsg] = useState<string | null>(null);

  const [, setModules] = useState<ModuleRow[]>([]);
  const [moduleRow, setModuleRow] = useState<ModuleRow | null>(null);

  const [lessons, setLessons] = useState<LessonRow[]>([]);
  const [sections, setSections] = useState<SectionRow[]>([]);
  const [completedSet, setCompletedSet] = useState<Set<number>>(new Set());

  const [openLessonIds, setOpenLessonIds] = useState<Set<number>>(new Set());
  const [currentSectionId, setCurrentSectionId] = useState<number | null>(null);

  // estado local para quiz (MVP)
  const [quizSelected, setQuizSelected] = useState<number | null>(null);
  const [quizFeedback, setQuizFeedback] = useState<string | null>(null);

  const [marking, setMarking] = useState(false);

  // -------- Carga principal --------
  useEffect(() => {
    if (!session) return;
    if (invalidMid) return;

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

      // sección inicial
      setCurrentSectionId(secList[0]?.id ?? null);

      // reset quiz ui
      setQuizSelected(null);
      setQuizFeedback(null);
    }

    load();
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

    return <div className="text-slate-400">(tipo desconocido: {s.kind})</div>;
  }

  async function logout() {
    await supabase.auth.signOut();
    nav("/login", { replace: true });
  }

  if (loading) return <div className="p-6">Cargando...</div>;
  if (!session) return <Navigate to="/login" replace />;
  if (invalidMid) return <Navigate to="/student" replace />;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="bg-slate-950 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <div className="text-sm text-slate-400">CEA Madre María Oliva</div>
            <div className="text-xl font-bold">
              {moduleRow?.title ?? "Módulo"}
            </div>
            <div className="text-sm text-slate-300">
              {progress.done}/{progress.total} completadas · {progress.pct}% ·{" "}
              <span
                className={canFinal ? "text-emerald-400" : "text-slate-400"}
              >
                Evaluación final{" "}
                {canFinal ? "habilitada ✅" : "bloqueada 🔒 (70%)"}
              </span>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              className="rounded-xl px-3 py-2 border border-slate-800 hover:bg-slate-900"
              onClick={() => nav("/student", { replace: true })}
            >
              Volver al panel
            </button>
            <button
              className="rounded-xl px-3 py-2 bg-white text-black"
              onClick={logout}
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
        <aside className="bg-slate-950 rounded-2xl border border-slate-800 p-4 space-y-3 h-fit lg:sticky lg:top-6">
          <ProgressBar value={progress.pct} />

          <div className="pt-2 border-t border-slate-800">
            <div className="text-sm font-semibold mb-2">Índice</div>

            <div className="space-y-2">
              {lessons
                .slice()
                .sort((a, b) => a.sort_order - b.sort_order)
                .map((l) => {
                  const isOpen = openLessonIds.has(l.id);
                  const sec = sectionsByLesson.get(l.id) ?? [];

                  return (
                    <div
                      key={l.id}
                      className="rounded-xl border border-slate-800"
                    >
                      <button
                        type="button"
                        className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-slate-900 rounded-xl"
                        onClick={() => toggleLesson(l.id)}
                      >
                        <span className="font-semibold">{l.title}</span>
                        <span className="text-xs text-slate-400">
                          {isOpen ? "−" : "+"}
                        </span>
                      </button>

                      {isOpen && (
                        <div className="px-2 pb-2 space-y-1">
                          {sec.map((s) => {
                            const active = s.id === currentSectionId;
                            const done = completedSet.has(s.id);

                            return (
                              <button
                                key={s.id}
                                type="button"
                                className={
                                  "w-full flex items-center justify-between rounded-lg px-2 py-2 text-left text-sm hover:bg-slate-900 " +
                                  (active ? "bg-slate-900" : "")
                                }
                                onClick={() => {
                                  setCurrentSectionId(s.id);
                                  setQuizSelected(null);
                                  setQuizFeedback(null);
                                }}
                              >
                                <span className="truncate text-slate-200">
                                  {s.title}{" "}
                                  <span className="ml-2 text-xs text-slate-500">
                                    ({s.kind})
                                  </span>
                                </span>
                                <span className="text-xs">
                                  {done ? "✅" : ""}
                                </span>
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

        <section className="bg-slate-950 rounded-2xl border border-slate-800 p-6 space-y-4">
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
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm text-slate-400">
                    Sección {currentIndex + 1} / {linearSections.length}
                  </div>
                  <h2 className="text-xl font-bold">{currentSection.title}</h2>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-1 rounded-full bg-slate-900 border border-slate-800">
                    {currentSection.kind}
                  </span>
                  <span className="text-xs px-2 py-1 rounded-full bg-slate-900 border border-slate-800">
                    {completedSet.has(currentSection.id)
                      ? "Completada ✅"
                      : "Pendiente"}
                  </span>
                </div>
              </div>

              <div className="border-t border-slate-800 pt-4">
                {renderSectionContent(currentSection)}
              </div>

              <div className="flex flex-col md:flex-row gap-2 md:items-center md:justify-between pt-4 border-t border-slate-800">
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="rounded-xl px-3 py-2 border border-slate-800 hover:bg-slate-900 disabled:opacity-50"
                    disabled={currentIndex <= 0}
                    onClick={goPrev}
                  >
                    ← Anterior
                  </button>
                  <button
                    type="button"
                    className="rounded-xl px-3 py-2 border border-slate-800 hover:bg-slate-900 disabled:opacity-50"
                    disabled={
                      currentIndex < 0 ||
                      currentIndex >= linearSections.length - 1
                    }
                    onClick={goNext}
                  >
                    Siguiente →
                  </button>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    className="rounded-xl px-3 py-2 bg-white text-black disabled:opacity-50"
                    disabled={marking || !currentSection}
                    onClick={() => toggleCompleted(currentSection.id)}
                  >
                    {marking
                      ? "Guardando..."
                      : completedSet.has(currentSection.id)
                        ? "Desmarcar completado"
                        : "Marcar como completado"}
                  </button>

                  <button
                    type="button"
                    className="rounded-xl px-3 py-2 border border-slate-800 hover:bg-slate-900 disabled:opacity-50"
                    disabled={!canFinal}
                    onClick={() =>
                      alert(
                        "Siguiente hito: Evaluación Final del módulo (manual por docente).",
                      )
                    }
                    title={
                      !canFinal
                        ? "Completa al menos 70% para habilitar"
                        : "Entrar"
                    }
                  >
                    Evaluación Final
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

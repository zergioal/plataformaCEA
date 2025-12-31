import { useEffect, useRef, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useRole } from "../lib/useRole";

type ModuleRow = {
  id: number;
  level_id: number;
  title: string;
  sort_order: number;
};

type EnrollmentRow = {
  student_id: string;
  level_id: number;
};

type StudentProfile = {
  id: string;
  code: string | null;
  full_name: string | null;
  first_names: string | null;
  last_name_pat: string | null;
  last_name_mat: string | null;
};

type ModuleGradeRow = {
  student_id: string;
  module_id: number;
  ser: number | null; // 10
  saber: number | null; // 30
  hacer_proceso: number | null; // 20 (override docente) | null => usar sugerencia
  hacer_producto: number | null; // 20
  decidir: number | null; // 10
  auto_ser: number | null; // 5
  auto_decidir: number | null; // 5
};

type RowVM = {
  student: StudentProfile;
  progressPct: number; // 0..100
  suggestedHP: number; // 0..20
  grade: ModuleGradeRow;
  saving: boolean;
  error: string | null;
};

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function clampPct(x: number) {
  return clamp(Math.round(x), 0, 100);
}

function toNum(x: unknown): number {
  if (typeof x === "number" && Number.isFinite(x)) return x;
  if (typeof x === "string") {
    const n = Number(x);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function toNumOrNull(x: unknown): number | null {
  if (x === null || x === undefined) return null;
  if (typeof x === "number" && Number.isFinite(x)) return x;
  if (typeof x === "string") {
    const t = x.trim();
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function numOrNull(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function displayStudentName(s: StudentProfile) {
  const parts = [
    s.first_names?.trim(),
    s.last_name_pat?.trim(),
    s.last_name_mat?.trim(),
  ].filter(Boolean) as string[];
  if (parts.length) return parts.join(" ");
  return s.full_name?.trim() || s.code || s.id;
}

function safe0(x: unknown) {
  const n = toNum(x);
  return Number.isFinite(n) ? n : 0;
}

function calcTotal(g: ModuleGradeRow, suggestedHPValue: number) {
  const hpFinal =
    g.hacer_proceso === null || g.hacer_proceso === undefined
      ? suggestedHPValue
      : safe0(g.hacer_proceso);

  const total =
    safe0(g.ser) +
    safe0(g.saber) +
    hpFinal +
    safe0(g.hacer_producto) +
    safe0(g.decidir) +
    safe0(g.auto_ser) +
    safe0(g.auto_decidir);

  // Por si algo raro se cuela
  return Math.round(total * 100) / 100;
}

function ProgressBar({ value }: { value: number }) {
  const v = clampPct(value);
  return (
    <div className="w-full">
      <div className="flex justify-between text-xs mb-1 text-slate-300">
        <span>Progreso</span>
        <span>{v}%</span>
      </div>
      <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
        <div className="h-2 bg-white rounded-full" style={{ width: `${v}%` }} />
      </div>
    </div>
  );
}

// Util: chunk para IN (...)
function chunk<T>(arr: T[], size: number) {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export default function TeacherModuleGrades() {
  const nav = useNavigate();
  const { moduleId } = useParams();
  const { loading, session, role } = useRole();

  const mid = Number(moduleId);
  const invalidMid = !Number.isFinite(mid);

  const [msg, setMsg] = useState<string | null>(null);
  const [moduleRow, setModuleRow] = useState<ModuleRow | null>(null);

  const [rows, setRows] = useState<RowVM[]>([]);
  const rowsRef = useRef<RowVM[]>([]);
  useEffect(() => {
    rowsRef.current = rows;
  }, [rows]);

  const [loadingData, setLoadingData] = useState(false);

  const isTeacherish = role === "teacher" || role === "admin";

  useEffect(() => {
    if (!session) return;
    if (!isTeacherish) return;
    if (invalidMid) return;

    async function loadAll() {
      setLoadingData(true);
      setMsg(null);

      // 1) módulo y nivel
      const mRes = await supabase
        .from("modules")
        .select("id,level_id,title,sort_order")
        .eq("id", mid)
        .single();

      if (mRes.error) {
        setLoadingData(false);
        setMsg("No se pudo cargar el módulo: " + mRes.error.message);
        return;
      }

      const mod = mRes.data as ModuleRow;
      setModuleRow(mod);

      // 2) enrollments del nivel => estudiantes
      const enrRes = await supabase
        .from("enrollments")
        .select("student_id,level_id")
        .eq("level_id", mod.level_id);

      if (enrRes.error) {
        setLoadingData(false);
        setMsg("No se pudo cargar enrollments: " + enrRes.error.message);
        return;
      }

      const enrolls = (enrRes.data ?? []) as EnrollmentRow[];
      const studentIds = enrolls.map((e) => e.student_id);

      if (studentIds.length === 0) {
        setRows([]);
        setLoadingData(false);
        setMsg("No hay estudiantes matriculados en este nivel.");
        return;
      }

      // 3) perfiles de estudiantes (en chunks)
      const profiles: StudentProfile[] = [];
      for (const part of chunk(studentIds, 200)) {
        const pRes = await supabase
          .from("profiles")
          .select("id,code,full_name,first_names,last_name_pat,last_name_mat")
          .in("id", part);

        if (pRes.error) {
          setLoadingData(false);
          setMsg("No se pudo cargar perfiles: " + pRes.error.message);
          return;
        }
        profiles.push(...((pRes.data ?? []) as StudentProfile[]));
      }

      const profileMap = new Map<string, StudentProfile>();
      for (const p of profiles) profileMap.set(p.id, p);

      // 4) progreso por vista (más confiable y barato que secciones)
      // v_module_progress: module_id, student_id, progress_percent, is_unlocked_final, ...
      const progRes = await supabase
        .from("v_module_progress")
        .select("student_id,progress_percent")
        .eq("module_id", mid)
        .in("student_id", studentIds);

      if (progRes.error) {
        setLoadingData(false);
        setMsg("No se pudo cargar progreso (vista): " + progRes.error.message);
        return;
      }

      const progMap = new Map<string, number>();
      for (const r of progRes.data ?? []) {
        progMap.set((r as any).student_id, toNum((r as any).progress_percent));
      }

      // 5) sugerencia hacer_proceso_20 por vista (si existe para ese módulo)
      const hpRes = await supabase
        .from("v_hacer_proceso")
        .select("student_id,hacer_proceso_20")
        .eq("module_id", mid)
        .in("student_id", studentIds);

      const hpMap = new Map<string, number>();
      if (!hpRes.error) {
        for (const r of hpRes.data ?? []) {
          hpMap.set((r as any).student_id, toNum((r as any).hacer_proceso_20));
        }
      }

      // 6) grades existentes del módulo
      const gradesRes = await supabase
        .from("module_grades")
        .select(
          "student_id,module_id,ser,saber,hacer_proceso,hacer_producto,decidir,auto_ser,auto_decidir"
        )
        .eq("module_id", mid)
        .in("student_id", studentIds);

      if (gradesRes.error) {
        setLoadingData(false);
        setMsg("No se pudo cargar calificaciones: " + gradesRes.error.message);
        return;
      }

      const gradeMap = new Map<string, ModuleGradeRow>();
      for (const g of (gradesRes.data ?? []) as any[]) {
        gradeMap.set(g.student_id, {
          student_id: g.student_id,
          module_id: g.module_id,
          ser: toNumOrNull(g.ser),
          saber: toNumOrNull(g.saber),
          hacer_proceso: toNumOrNull(g.hacer_proceso),
          hacer_producto: toNumOrNull(g.hacer_producto),
          decidir: toNumOrNull(g.decidir),
          auto_ser: toNumOrNull(g.auto_ser),
          auto_decidir: toNumOrNull(g.auto_decidir),
        });
      }

      // 7) armar VM
      const vm: RowVM[] = studentIds
        .map((sid) => {
          const st = profileMap.get(sid);
          if (!st) return null;

          const pct = clampPct(progMap.get(sid) ?? 0);

          // sugerencia: de vista, o fallback con regla simple
          const suggestedHP = clamp(
            Math.round(hpMap.get(sid) ?? (pct / 100) * 20),
            0,
            20
          );

          const existing = gradeMap.get(sid);
          const grade: ModuleGradeRow =
            existing ??
            ({
              student_id: sid,
              module_id: mid,
              ser: null,
              saber: null,
              hacer_proceso: null,
              hacer_producto: null,
              decidir: null,
              auto_ser: null,
              auto_decidir: null,
            } as ModuleGradeRow);

          return {
            student: st,
            progressPct: pct,
            suggestedHP,
            grade,
            saving: false,
            error: null,
          } satisfies RowVM;
        })
        .filter(Boolean) as RowVM[];

      // orden por apellido/código
      vm.sort((a, b) => {
        const an =
          (a.student.last_name_pat || "") + (a.student.first_names || "");
        const bn =
          (b.student.last_name_pat || "") + (b.student.first_names || "");
        return an.localeCompare(bn);
      });

      setRows(vm);
      setLoadingData(false);
    }

    loadAll();
  }, [session, isTeacherish, invalidMid, mid]);

  function setField(
    studentId: string,
    key: keyof ModuleGradeRow,
    value: number | null
  ) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.student.id !== studentId) return r;
        return {
          ...r,
          grade: { ...r.grade, [key]: value },
        };
      })
    );
  }

  function useSuggestedHP(studentId: string) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.student.id !== studentId) return r;
        return { ...r, grade: { ...r.grade, hacer_proceso: r.suggestedHP } };
      })
    );
  }

  function clearHP(studentId: string) {
    setRows((prev) =>
      prev.map((r) => {
        if (r.student.id !== studentId) return r;
        return { ...r, grade: { ...r.grade, hacer_proceso: null } };
      })
    );
  }

  async function saveRow(studentId: string) {
    // marcar saving (sin depender del estado viejo)
    setRows((prev) =>
      prev.map((r) =>
        r.student.id === studentId ? { ...r, saving: true, error: null } : r
      )
    );

    const row = rowsRef.current.find((r) => r.student.id === studentId);
    if (!row) {
      setRows((prev) =>
        prev.map((r) =>
          r.student.id === studentId ? { ...r, saving: false } : r
        )
      );
      return;
    }

    const g = row.grade;

    // validación + clamps
    const cleaned: ModuleGradeRow = {
      student_id: g.student_id,
      module_id: g.module_id,
      ser: g.ser === null ? null : clamp(g.ser, 0, 10),
      saber: g.saber === null ? null : clamp(g.saber, 0, 30),
      hacer_proceso:
        g.hacer_proceso === null ? null : clamp(g.hacer_proceso, 0, 20),
      hacer_producto:
        g.hacer_producto === null ? null : clamp(g.hacer_producto, 0, 20),
      decidir: g.decidir === null ? null : clamp(g.decidir, 0, 10),
      auto_ser: g.auto_ser === null ? null : clamp(g.auto_ser, 0, 5),
      auto_decidir:
        g.auto_decidir === null ? null : clamp(g.auto_decidir, 0, 5),
    };

    const up = await supabase
      .from("module_grades")
      .upsert(cleaned, { onConflict: "student_id,module_id" });

    if (up.error) {
      setRows((prev) =>
        prev.map((r) =>
          r.student.id === studentId
            ? { ...r, saving: false, error: up.error.message }
            : r
        )
      );
      return;
    }

    setRows((prev) =>
      prev.map((r) =>
        r.student.id === studentId ? { ...r, saving: false, error: null } : r
      )
    );
  }

  if (loading) return <div className="p-6">Cargando...</div>;
  if (!session) return <Navigate to="/login" replace />;
  if (!isTeacherish) return <Navigate to="/student" replace />;
  if (invalidMid) return <Navigate to="/teacher" replace />;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="bg-slate-950 border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <div className="text-sm text-slate-400">Panel Docente</div>
            <div className="text-xl font-bold">
              Calificaciones — {moduleRow?.title ?? "Módulo"}
            </div>
            <div className="text-sm text-slate-300">
              Orden oficial: Ser(10), Saber(30), Hacer-Proceso(20),
              Hacer-Producto(20), Decidir(10), Auto Ser(5), Auto Decidir(5),
              Total(100)
            </div>
          </div>

          <div className="flex gap-2">
            <button
              className="rounded-xl px-3 py-2 border border-slate-800 hover:bg-slate-900"
              onClick={() => nav("/teacher", { replace: true })}
            >
              Volver
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-4">
        {msg && (
          <pre className="text-sm bg-slate-900 border border-slate-800 rounded-xl p-3 whitespace-pre-wrap">
            {msg}
          </pre>
        )}

        {loadingData ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6">
            Cargando estudiantes y progreso...
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6">
            No hay datos para mostrar.
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-800 bg-slate-950 overflow-auto">
            <table className="min-w-[1200px] w-full text-sm">
              <thead className="bg-slate-950 sticky top-0">
                <tr className="text-left border-b border-slate-800">
                  <th className="p-3">Estudiante</th>
                  <th className="p-3 w-56">Progreso</th>

                  <th className="p-3">Ser (10)</th>
                  <th className="p-3">Saber (30)</th>
                  <th className="p-3">Hacer-Proceso (20)</th>
                  <th className="p-3">Hacer-Producto (20)</th>
                  <th className="p-3">Decidir (10)</th>
                  <th className="p-3">Auto Ser (5)</th>
                  <th className="p-3">Auto Decidir (5)</th>
                  <th className="p-3 font-semibold">Total</th>

                  <th className="p-3">Acción</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((r) => {
                  const hpIsOverride =
                    r.grade.hacer_proceso !== null &&
                    r.grade.hacer_proceso !== undefined;

                  const total = calcTotal(r.grade, r.suggestedHP);
                  const totalOk = total <= 100;

                  return (
                    <tr
                      key={r.student.id}
                      className="border-b border-slate-800"
                    >
                      <td className="p-3">
                        <div className="font-semibold">
                          {displayStudentName(r.student)}
                        </div>
                        <div className="text-xs text-slate-400">
                          {r.student.code ?? r.student.id}
                        </div>
                      </td>

                      <td className="p-3">
                        <ProgressBar value={r.progressPct} />
                        <div className="text-xs text-slate-400 mt-1">
                          Sugerencia H-Proceso: <b>{r.suggestedHP}</b>/20
                        </div>
                        <div className="text-xs mt-1">
                          Evaluación final:{" "}
                          <b
                            className={
                              r.progressPct >= 70
                                ? "text-emerald-400"
                                : "text-slate-400"
                            }
                          >
                            {r.progressPct >= 70
                              ? "Habilita ✅"
                              : "Bloquea 🔒 (<70%)"}
                          </b>
                        </div>
                      </td>

                      <td className="p-3">
                        <input
                          className="w-20 rounded-lg bg-slate-900 border border-slate-800 px-2 py-1"
                          placeholder="0-10"
                          value={r.grade.ser ?? ""}
                          onChange={(e) =>
                            setField(
                              r.student.id,
                              "ser",
                              numOrNull(e.target.value)
                            )
                          }
                        />
                      </td>

                      <td className="p-3">
                        <input
                          className="w-20 rounded-lg bg-slate-900 border border-slate-800 px-2 py-1"
                          placeholder="0-30"
                          value={r.grade.saber ?? ""}
                          onChange={(e) =>
                            setField(
                              r.student.id,
                              "saber",
                              numOrNull(e.target.value)
                            )
                          }
                        />
                      </td>

                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <input
                            className="w-20 rounded-lg bg-slate-900 border border-slate-800 px-2 py-1"
                            placeholder="(sugerido)"
                            value={r.grade.hacer_proceso ?? ""}
                            onChange={(e) =>
                              setField(
                                r.student.id,
                                "hacer_proceso",
                                numOrNull(e.target.value)
                              )
                            }
                          />
                          {!hpIsOverride ? (
                            <button
                              type="button"
                              className="text-xs px-2 py-1 rounded-lg border border-slate-800 hover:bg-slate-900"
                              onClick={() => useSuggestedHP(r.student.id)}
                              title="Poner override igual a la sugerencia"
                            >
                              Usar sugerencia
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="text-xs px-2 py-1 rounded-lg border border-slate-800 hover:bg-slate-900"
                              onClick={() => clearHP(r.student.id)}
                              title="Quitar override y volver a sugerido"
                            >
                              Volver a sugerido
                            </button>
                          )}
                        </div>
                        <div className="text-xs text-slate-400 mt-1">
                          {hpIsOverride
                            ? "Override docente"
                            : "Automático (sugerido)"}
                        </div>
                      </td>

                      <td className="p-3">
                        <input
                          className="w-20 rounded-lg bg-slate-900 border border-slate-800 px-2 py-1"
                          placeholder="0-20"
                          value={r.grade.hacer_producto ?? ""}
                          onChange={(e) =>
                            setField(
                              r.student.id,
                              "hacer_producto",
                              numOrNull(e.target.value)
                            )
                          }
                        />
                      </td>

                      <td className="p-3">
                        <input
                          className="w-20 rounded-lg bg-slate-900 border border-slate-800 px-2 py-1"
                          placeholder="0-10"
                          value={r.grade.decidir ?? ""}
                          onChange={(e) =>
                            setField(
                              r.student.id,
                              "decidir",
                              numOrNull(e.target.value)
                            )
                          }
                        />
                      </td>

                      <td className="p-3">
                        <input
                          className="w-20 rounded-lg bg-slate-900 border border-slate-800 px-2 py-1"
                          placeholder="0-5"
                          value={r.grade.auto_ser ?? ""}
                          onChange={(e) =>
                            setField(
                              r.student.id,
                              "auto_ser",
                              numOrNull(e.target.value)
                            )
                          }
                        />
                      </td>

                      <td className="p-3">
                        <input
                          className="w-20 rounded-lg bg-slate-900 border border-slate-800 px-2 py-1"
                          placeholder="0-5"
                          value={r.grade.auto_decidir ?? ""}
                          onChange={(e) =>
                            setField(
                              r.student.id,
                              "auto_decidir",
                              numOrNull(e.target.value)
                            )
                          }
                        />
                      </td>

                      <td
                        className={
                          "p-3 font-semibold " +
                          (totalOk ? "text-slate-100" : "text-rose-400")
                        }
                        title={totalOk ? "" : "Total > 100 (revisa valores)"}
                      >
                        {total}
                      </td>

                      <td className="p-3">
                        <button
                          className="rounded-xl px-3 py-2 bg-white text-black disabled:opacity-50"
                          disabled={r.saving}
                          onClick={() => saveRow(r.student.id)}
                        >
                          {r.saving ? "Guardando..." : "Guardar"}
                        </button>

                        {r.error && (
                          <div className="text-xs text-rose-400 mt-2">
                            {r.error}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </div>
  );
}

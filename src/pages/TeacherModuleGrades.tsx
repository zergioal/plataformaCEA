// cea-plataforma/web/src/pages/TeacherModuleGrades.tsx
// 🎨 VERSIÓN FINAL: Mejoras UX + Colores dinámicos + Mensajes amigables

import { useEffect, useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useRole } from "../lib/useRole";

type ModuleRow = {
  id: number;
  level_id: number;
  title: string;
  sort_order: number;
};

type LevelRow = {
  id: number;
  name: string;
  sort_order: number;
  career_id: number;
};

type StudentProfile = {
  id: string;
  code: string | null;
  full_name: string | null;
};

type ModuleGrade = {
  student_id: string;
  module_id: number;
  ser: number | null;
  saber: number | null;
  hacer_proceso: number | null;
  hacer_producto: number | null;
  decidir: number | null;
  auto_ser: number | null;
  auto_decidir: number | null;
};

type StudentRow = {
  student: StudentProfile;
  grade: ModuleGrade;
  progress: number;
  suggestedHP: number;
  total: number;
  saving: boolean;
};

export default function TeacherModuleGrades() {
  const nav = useNavigate();
  const { loading, session, role } = useRole();
  const { moduleId } = useParams();

  const [moduleRow, setModuleRow] = useState<ModuleRow | null>(null);
  const [levelRow, setLevelRow] = useState<LevelRow | null>(null);
  const [careerName, setCareerName] = useState<string>("");
  const [teacherShift, setTeacherShift] = useState<string>("");
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const isTeacherish = role === "teacher" || role === "admin";
  const mid = parseInt(moduleId ?? "", 10);
  const invalidMid = isNaN(mid) || mid <= 0;

  useEffect(() => {
    if (!session || !isTeacherish || invalidMid) return;
    loadAll();
  }, [session, isTeacherish, mid]);

  async function loadAll() {
    setLoadingData(true);
    setMsg(null);

    try {
      const { data: teacherProfile, error: profError } = await supabase
        .from("profiles")
        .select("career_id, shift")
        .eq("id", session!.user.id)
        .single();

      if (profError || !teacherProfile) {
        setMsg("Error cargando perfil del docente");
        setLoadingData(false);
        return;
      }

      setTeacherShift(teacherProfile.shift || "");

      // Cargar nombre de la carrera
      if (teacherProfile.career_id) {
        const { data: career } = await supabase
          .from("careers")
          .select("name")
          .eq("id", teacherProfile.career_id)
          .single();

        if (career) {
          setCareerName(career.name);
        }
      }

      const { data: module, error: moduleError } = await supabase
        .from("modules")
        .select("id,level_id,title,sort_order")
        .eq("id", mid)
        .single();

      if (moduleError || !module) {
        setMsg("Módulo no encontrado");
        setLoadingData(false);
        return;
      }

      setModuleRow(module as ModuleRow);

      const { data: level, error: levelError } = await supabase
        .from("levels")
        .select("id,name,sort_order,career_id")
        .eq("id", module.level_id)
        .single();

      if (levelError || !level) {
        setMsg("Nivel no encontrado");
        setLoadingData(false);
        return;
      }

      setLevelRow(level as LevelRow);

      const { data: enrollments, error: enrollError } = await supabase
        .from("enrollments")
        .select("student_id,level_id")
        .eq("level_id", module.level_id);

      if (enrollError) {
        setMsg("Error cargando enrollments");
        setLoadingData(false);
        return;
      }

      const studentIds = (enrollments ?? []).map((e: any) => e.student_id);

      if (studentIds.length === 0) {
        setRows([]);
        setLoadingData(false);
        setMsg("No hay estudiantes en este nivel");
        return;
      }

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id,code,full_name")
        .in("id", studentIds)
        .eq("career_id", teacherProfile.career_id)
        .eq("shift", teacherProfile.shift)
        .order("code");

      if (profilesError) {
        setMsg("Error cargando estudiantes");
        setLoadingData(false);
        return;
      }

      const students = (profiles ?? []) as StudentProfile[];

      if (students.length === 0) {
        setRows([]);
        setLoadingData(false);
        setMsg("No hay estudiantes de tu carrera y turno en este nivel");
        return;
      }

      const { data: progressData } = await supabase
        .from("v_module_progress")
        .select("student_id,progress_percent")
        .eq("module_id", mid)
        .in(
          "student_id",
          students.map((s) => s.id),
        );

      const progressMap = new Map<string, number>();
      if (progressData) {
        for (const p of progressData) {
          progressMap.set(p.student_id, p.progress_percent || 0);
        }
      }

      const { data: grades } = await supabase
        .from("module_grades")
        .select(
          "student_id,module_id,ser,saber,hacer_proceso,hacer_producto,decidir,auto_ser,auto_decidir",
        )
        .eq("module_id", mid)
        .in(
          "student_id",
          students.map((s) => s.id),
        );

      const gradesMap = new Map<string, ModuleGrade>();
      if (grades) {
        for (const g of grades) {
          gradesMap.set(g.student_id, g as ModuleGrade);
        }
      }

      const studentRows: StudentRow[] = students.map((student) => {
        const existingGrade = gradesMap.get(student.id);
        const progress = progressMap.get(student.id) || 0;
        const suggestedHP = Math.round((progress / 100) * 20);

        const grade: ModuleGrade = existingGrade || {
          student_id: student.id,
          module_id: mid,
          ser: null,
          saber: null,
          hacer_proceso: null,
          hacer_producto: null,
          decidir: null,
          auto_ser: null,
          auto_decidir: null,
        };

        return {
          student,
          grade,
          progress,
          suggestedHP,
          total: calculateTotal(grade, suggestedHP),
          saving: false,
        };
      });

      setRows(studentRows);
      setLoadingData(false);
    } catch (error) {
      console.error("Error:", error);
      setMsg("Error cargando datos");
      setLoadingData(false);
    }
  }

  function calculateTotal(grade: ModuleGrade, suggestedHP: number): number {
    const ser = grade.ser ?? 0;
    const saber = grade.saber ?? 0;
    const hacerProceso = grade.hacer_proceso ?? suggestedHP;
    const hacerProducto = grade.hacer_producto ?? 0;
    const decidir = grade.decidir ?? 0;
    const autoSer = grade.auto_ser ?? 0;
    const autoDecidir = grade.auto_decidir ?? 0;

    return (
      ser +
      saber +
      hacerProceso +
      hacerProducto +
      decidir +
      autoSer +
      autoDecidir
    );
  }

  function updateGradeField(
    studentId: string,
    field: keyof ModuleGrade,
    value: string,
  ) {
    const numValue = value.trim() === "" ? null : Number(value);

    setRows((prev) =>
      prev.map((row) => {
        if (row.student.id !== studentId) return row;

        const updatedGrade = { ...row.grade, [field]: numValue };
        return {
          ...row,
          grade: updatedGrade,
          total: calculateTotal(updatedGrade, row.suggestedHP),
        };
      }),
    );
  }

  function getProgressColor(progress: number): string {
    if (progress >= 70) return "from-emerald-500 to-emerald-600";
    if (progress >= 51) return "from-amber-500 to-amber-600";
    return "from-red-500 to-red-600";
  }

  function getProgressTextColor(progress: number): string {
    if (progress >= 70) return "text-emerald-400";
    if (progress >= 51) return "text-amber-400";
    return "text-red-400";
  }

  function parseErrorMessage(error: string): string {
    // Mensajes amigables para constraints
    if (error.includes("check_ser_range")) {
      return "❌ Error: SER debe estar entre 0 y 10 puntos";
    }
    if (error.includes("check_saber_range")) {
      return "❌ Error: SABER debe estar entre 0 y 30 puntos";
    }
    if (error.includes("check_hacer_proceso_range")) {
      return "❌ Error: HACER PROCESO debe estar entre 0 y 20 puntos";
    }
    if (error.includes("check_hacer_producto_range")) {
      return "❌ Error: HACER PRODUCTO debe estar entre 0 y 20 puntos";
    }
    if (error.includes("check_decidir_range")) {
      return "❌ Error: DECIDIR debe estar entre 0 y 10 puntos";
    }
    if (error.includes("check_auto_ser_range")) {
      return "❌ Error: AUTO SER debe estar entre 0 y 5 puntos";
    }
    if (error.includes("check_auto_decidir_range")) {
      return "❌ Error: AUTO DECIDIR debe estar entre 0 y 5 puntos";
    }

    // Mensaje genérico para otros errores
    return `❌ Error: ${error}`;
  }

  async function saveGrade(studentId: string) {
    const row = rows.find((r) => r.student.id === studentId);
    if (!row) return;

    setRows((prev) =>
      prev.map((r) =>
        r.student.id === studentId ? { ...r, saving: true } : r,
      ),
    );

    try {
      const hacerProcesoFinal = row.grade.hacer_proceso ?? row.suggestedHP;

      const { error } = await supabase.from("module_grades").upsert(
        {
          student_id: row.student.id,
          module_id: mid,
          ser: row.grade.ser,
          saber: row.grade.saber,
          hacer_proceso: hacerProcesoFinal,
          hacer_producto: row.grade.hacer_producto,
          decidir: row.grade.decidir,
          auto_ser: row.grade.auto_ser,
          auto_decidir: row.grade.auto_decidir,
        },
        { onConflict: "student_id,module_id" },
      );

      if (error) {
        setMsg(parseErrorMessage(error.message));
      } else {
        setMsg("✅ Calificación guardada correctamente");
      }
    } catch (error) {
      setMsg(`❌ Error: ${error}`);
    } finally {
      setRows((prev) =>
        prev.map((r) =>
          r.student.id === studentId ? { ...r, saving: false } : r,
        ),
      );
    }
  }

  if (loading)
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-slate-300">Cargando...</div>
      </div>
    );
  if (!session) return <Navigate to="/login" replace />;
  if (!isTeacherish) return <Navigate to="/student" replace />;
  if (invalidMid) return <Navigate to="/teacher/modules" replace />;

  return (
    <div className="min-h-screen bg-slate-950">
      <header className="bg-gradient-to-r from-slate-900 via-slate-900 to-slate-800 border-b border-slate-800/50 shadow-xl">
        <div className="max-w-[1600px] mx-auto px-6 py-6">
          <button
            className="flex items-center gap-2 text-slate-300 hover:text-white mb-4 transition-colors group"
            onClick={() => nav("/teacher/modules")}
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
            <span className="font-medium">Volver a Módulos</span>
          </button>
          <div className="text-slate-400 text-sm font-medium mb-1">
            {levelRow?.name ?? "Cargando..."}
          </div>
          <h1 className="text-3xl font-bold text-white">
            {moduleRow?.title ?? "Cargando módulo..."}
          </h1>
          <p className="text-slate-400 mt-1">
            {careerName} · Turno {teacherShift}
          </p>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-6 py-8 space-y-6">
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
            <div className="text-slate-300 text-lg">
              Cargando estudiantes...
            </div>
          </div>
        ) : rows.length === 0 ? (
          <div className="bg-slate-900 rounded-2xl border border-slate-700/50 p-12 text-center">
            <div className="text-6xl mb-4 opacity-20">👥</div>
            <div className="text-xl font-semibold text-white mb-2">
              No hay estudiantes
            </div>
            <div className="text-slate-400">
              No hay estudiantes de tu carrera y turno en este nivel
            </div>
          </div>
        ) : (
          <div className="bg-slate-900 rounded-2xl border border-slate-700/50 overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-slate-800/50">
                  <tr>
                    <th className="px-3 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider whitespace-nowrap">
                      Código
                    </th>
                    <th className="px-3 py-4 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider whitespace-nowrap">
                      Estudiante
                    </th>
                    <th className="px-3 py-4 text-center text-xs font-semibold text-slate-300 uppercase tracking-wider whitespace-nowrap">
                      Progreso
                    </th>
                    <th className="px-3 py-4 text-center text-xs font-semibold text-slate-300 uppercase tracking-wider whitespace-nowrap">
                      SER
                      <br />
                      <span className="text-xs font-normal text-slate-400">
                        (10)
                      </span>
                    </th>
                    <th className="px-3 py-4 text-center text-xs font-semibold text-slate-300 uppercase tracking-wider whitespace-nowrap">
                      SABER
                      <br />
                      <span className="text-xs font-normal text-slate-400">
                        (30)
                      </span>
                    </th>
                    <th className="px-3 py-4 text-center text-xs font-semibold text-slate-300 uppercase tracking-wider whitespace-nowrap">
                      HACER
                      <br />
                      Proceso
                      <br />
                      <span className="text-xs font-normal text-slate-400">
                        (20)
                      </span>
                    </th>
                    <th className="px-3 py-4 text-center text-xs font-semibold text-slate-300 uppercase tracking-wider whitespace-nowrap">
                      HACER
                      <br />
                      Producto
                      <br />
                      <span className="text-xs font-normal text-slate-400">
                        (20)
                      </span>
                    </th>
                    <th className="px-3 py-4 text-center text-xs font-semibold text-slate-300 uppercase tracking-wider whitespace-nowrap">
                      DECIDIR
                      <br />
                      <span className="text-xs font-normal text-slate-400">
                        (10)
                      </span>
                    </th>
                    <th className="px-3 py-4 text-center text-xs font-semibold text-slate-300 uppercase tracking-wider whitespace-nowrap">
                      AUTO
                      <br />
                      SER
                      <br />
                      <span className="text-xs font-normal text-slate-400">
                        (5)
                      </span>
                    </th>
                    <th className="px-3 py-4 text-center text-xs font-semibold text-slate-300 uppercase tracking-wider whitespace-nowrap">
                      AUTO
                      <br />
                      DECIDIR
                      <br />
                      <span className="text-xs font-normal text-slate-400">
                        (5)
                      </span>
                    </th>
                    <th className="px-3 py-4 text-center text-xs font-semibold text-slate-300 uppercase tracking-wider whitespace-nowrap">
                      TOTAL
                      <br />
                      <span className="text-xs font-normal text-slate-400">
                        (100)
                      </span>
                    </th>
                    <th className="px-3 py-4 text-center text-xs font-semibold text-slate-300 uppercase tracking-wider whitespace-nowrap">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {rows.map((row) => (
                    <tr
                      key={row.student.id}
                      className="hover:bg-slate-800/30 transition-colors"
                    >
                      <td className="px-3 py-4 whitespace-nowrap text-sm font-medium text-white">
                        {row.student.code}
                      </td>
                      <td className="px-3 py-4 whitespace-nowrap text-sm text-slate-200">
                        {row.student.full_name}
                      </td>
                      <td className="px-3 py-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span
                            className={`text-sm font-semibold ${getProgressTextColor(
                              row.progress,
                            )}`}
                          >
                            {row.progress}%
                          </span>
                          <div className="w-16 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full bg-gradient-to-r ${getProgressColor(
                                row.progress,
                              )} rounded-full transition-all duration-500`}
                              style={{ width: `${row.progress}%` }}
                            />
                          </div>
                        </div>
                      </td>

                      {/* SER (10) */}
                      <td className="px-3 py-4">
                        <input
                          type="number"
                          className="w-16 px-2 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white text-center text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all"
                          min="0"
                          max="10"
                          value={row.grade.ser ?? ""}
                          onChange={(e) =>
                            updateGradeField(
                              row.student.id,
                              "ser",
                              e.target.value,
                            )
                          }
                          placeholder="0"
                        />
                      </td>

                      {/* SABER (30) */}
                      <td className="px-3 py-4">
                        <input
                          type="number"
                          className="w-16 px-2 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white text-center text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all"
                          min="0"
                          max="30"
                          value={row.grade.saber ?? ""}
                          onChange={(e) =>
                            updateGradeField(
                              row.student.id,
                              "saber",
                              e.target.value,
                            )
                          }
                          placeholder="0"
                        />
                      </td>

                      {/* HACER Proceso (20) con sugerencia */}
                      <td className="px-3 py-4">
                        <div className="flex flex-col items-center gap-1">
                          <input
                            type="number"
                            className="w-16 px-2 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white text-center text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-transparent transition-all"
                            min="0"
                            max="20"
                            value={row.grade.hacer_proceso ?? ""}
                            onChange={(e) =>
                              updateGradeField(
                                row.student.id,
                                "hacer_proceso",
                                e.target.value,
                              )
                            }
                            placeholder={String(row.suggestedHP)}
                          />
                          <span className="text-xs text-amber-400 font-medium">
                            {row.suggestedHP}/20
                          </span>
                        </div>
                      </td>

                      {/* HACER Producto (20) */}
                      <td className="px-3 py-4">
                        <input
                          type="number"
                          className="w-16 px-2 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white text-center text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all"
                          min="0"
                          max="20"
                          value={row.grade.hacer_producto ?? ""}
                          onChange={(e) =>
                            updateGradeField(
                              row.student.id,
                              "hacer_producto",
                              e.target.value,
                            )
                          }
                          placeholder="0"
                        />
                      </td>

                      {/* DECIDIR (10) */}
                      <td className="px-3 py-4">
                        <input
                          type="number"
                          className="w-16 px-2 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white text-center text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all"
                          min="0"
                          max="10"
                          value={row.grade.decidir ?? ""}
                          onChange={(e) =>
                            updateGradeField(
                              row.student.id,
                              "decidir",
                              e.target.value,
                            )
                          }
                          placeholder="0"
                        />
                      </td>

                      {/* AUTO SER (5) */}
                      <td className="px-3 py-4">
                        <input
                          type="number"
                          className="w-16 px-2 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white text-center text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all"
                          min="0"
                          max="5"
                          value={row.grade.auto_ser ?? ""}
                          onChange={(e) =>
                            updateGradeField(
                              row.student.id,
                              "auto_ser",
                              e.target.value,
                            )
                          }
                          placeholder="0"
                        />
                      </td>

                      {/* AUTO DECIDIR (5) */}
                      <td className="px-3 py-4">
                        <input
                          type="number"
                          className="w-16 px-2 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white text-center text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all"
                          min="0"
                          max="5"
                          value={row.grade.auto_decidir ?? ""}
                          onChange={(e) =>
                            updateGradeField(
                              row.student.id,
                              "auto_decidir",
                              e.target.value,
                            )
                          }
                          placeholder="0"
                        />
                      </td>

                      {/* TOTAL */}
                      <td className="px-3 py-4 text-center">
                        <div
                          className={`text-xl font-bold ${
                            row.total >= 51
                              ? "text-emerald-400"
                              : "text-red-400"
                          }`}
                        >
                          {row.total}
                        </div>
                      </td>

                      {/* Acciones */}
                      <td className="px-3 py-4 text-center">
                        <button
                          className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white text-sm rounded-lg font-medium transition-all duration-200 shadow-lg shadow-emerald-900/30 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                          onClick={() => saveGrade(row.student.id)}
                          disabled={row.saving}
                        >
                          {row.saving ? "Guardando..." : "Guardar"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Leyenda compacta en una línea */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl border border-slate-700/50 p-6 shadow-xl">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <span className="text-2xl">📊</span>
            Ponderación de Calificaciones
          </h3>
          <div className="flex flex-wrap items-center gap-3">
            <div className="px-4 py-2 bg-slate-800/30 rounded-xl border border-slate-700/30">
              <span className="text-slate-400 text-sm">SER:</span>
              <span className="text-white text-sm font-bold ml-2">10 pts</span>
            </div>
            <div className="px-4 py-2 bg-slate-800/30 rounded-xl border border-slate-700/30">
              <span className="text-slate-400 text-sm">SABER:</span>
              <span className="text-white text-sm font-bold ml-2">30 pts</span>
            </div>
            <div className="px-4 py-2 bg-slate-800/30 rounded-xl border border-slate-700/30">
              <span className="text-slate-400 text-sm">HACER Proceso:</span>
              <span className="text-white text-sm font-bold ml-2">20 pts</span>
            </div>
            <div className="px-4 py-2 bg-slate-800/30 rounded-xl border border-slate-700/30">
              <span className="text-slate-400 text-sm">HACER Producto:</span>
              <span className="text-white text-sm font-bold ml-2">20 pts</span>
            </div>
            <div className="px-4 py-2 bg-slate-800/30 rounded-xl border border-slate-700/30">
              <span className="text-slate-400 text-sm">DECIDIR:</span>
              <span className="text-white text-sm font-bold ml-2">10 pts</span>
            </div>
            <div className="px-4 py-2 bg-slate-800/30 rounded-xl border border-slate-700/30">
              <span className="text-slate-400 text-sm">AUTO SER:</span>
              <span className="text-white text-sm font-bold ml-2">5 pts</span>
            </div>
            <div className="px-4 py-2 bg-slate-800/30 rounded-xl border border-slate-700/30">
              <span className="text-slate-400 text-sm">AUTO DECIDIR:</span>
              <span className="text-white text-sm font-bold ml-2">5 pts</span>
            </div>
            <div className="px-4 py-2 bg-gradient-to-br from-blue-600/20 to-blue-700/20 rounded-xl border border-blue-500/30">
              <span className="text-blue-300 text-sm">TOTAL:</span>
              <span className="text-white text-sm font-bold ml-2">100 pts</span>
            </div>
          </div>

          <div className="mt-4 p-3 bg-slate-800/30 rounded-xl border border-slate-700/30">
            <span className="text-slate-300 text-sm">
              <strong className="text-white">Nota mínima de aprobación:</strong>{" "}
              51 puntos
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}

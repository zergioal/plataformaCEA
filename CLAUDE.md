# CLAUDE.md

Contexto persistente del proyecto para Claude Code. Léelo al empezar cualquier sesión nueva sobre este repo.

## Qué es

Plataforma de gestión académica para el **CEA Madre María Oliva** (educación alternativa por competencias).
Roles: `admin`, `administrativo`, `teacher`, `student`. Docentes registran asistencia y calificaciones por
dimensión; estudiantes ven su progreso, notas y asistencia. Ver también [README.md](README.md) para el stack
y la estructura de calificaciones (SER/SABER/HACER Proceso/HACER Producto/DECIDIR + autoevaluaciones, 100 pts).

Stack: React 19 + TypeScript + Vite, Tailwind v3, Supabase (Postgres + RLS + Edge Functions), React Router v7,
jsPDF/jspdf-autotable, SheetJS. Sin backend propio: toda la lógica de servidor vive en Supabase (RLS policies
en `sql/`, migraciones en `supabase/migrations/`, Edge Functions en `supabase/functions/`).

## Estructura relevante

- `src/pages/TeacherModuleGrades.tsx` — **registro modular principal** de un módulo (una fila por estudiante,
  columnas = las 5 dimensiones + autoevaluaciones + total). Aquí se guarda `module_grades`.
- `src/pages/TeacherDimensionGrades.tsx` — **registro secundario por dimensión** (SER/SABER/HACER
  Proceso/HACER Producto/DECIDIR). Cada dimensión tiene sus propios indicadores (`lesson_sections` filtradas
  por `dimension`, o columnas fijas de asistencia para SER/DECIDIR), guarda en `dimension_grades` y calcula
  un promedio que puede sincronizarse ("↑ Cargar al principal") hacia `module_grades`. Se abre como ruta propia
  (`/teacher/module/:id/grades/:dimension`) o inline dentro del registro modular.
- `src/pages/AdminDashboard.tsx` — archivo grande (~5000 líneas) que concentra casi toda la administración:
  gestión de usuarios/estudiantes, carreras/niveles, apertura de semestre, retiros, reseteo de progreso,
  configuración del sitio, exportaciones. Buscar por secciones (`configTab`, `adminSection`) en vez de leerlo
  completo.
- `src/lib/useRole.ts` — hook de sesión/perfil/rol, con cache en `sessionStorage` (`user_session_cache`).
- `src/lib/supabase.ts` — cliente Supabase.
- `supabase/functions/` — Edge Functions con `SERVICE_ROLE_KEY` para operaciones que necesitan bypasear RLS
  (crear/borrar/actualizar usuarios, reset de contraseña, reset de progreso de estudiantes).

## Modelo de datos clave (Supabase)

- `profiles` — usuarios (todos los roles). Campos importantes para estudiantes: `career_id`, `shift`,
  `is_active`, `is_graduated`, `current_semester`, `current_level_id`.
- `enrollments` — **una sola fila por estudiante** con su `level_id` actual (no es histórico por semestre).
  Al editar el nivel de un estudiante (`AdminDashboard`), se hace `delete` + `insert`, nunca se guarda
  historial de niveles anteriores.
- `modules` (pertenece a `levels`), `levels` (pertenece a `careers`).
- `module_grades` — notas del registro principal. La constraint única real es
  **`(student_id, module_id, semester)`** desde el commit `fa6dfc1` ("Add gestion de semestres", 2026-07-06);
  antes de eso era `(student_id, module_id)`. Cualquier `upsert` a esta tabla debe incluir `semester` en el
  payload y usar `onConflict: "student_id,module_id,semester"` — si se omite `semester` o se usa el
  `onConflict` viejo, el upsert falla en cuanto ya existe una fila previa para ese estudiante+módulo (inserts
  nuevos "funcionan" por accidente porque no hay conflicto que resolver, lo que hace el bug parezca parcial/
  intermitente). Este era exactamente el bug de "N fila(s) no se pudieron actualizar" en
  `TeacherDimensionGrades.tsx` (corregido 2026-08-26): el botón "Cargar al principal" y los auto-syncs de
  SER/DECIDIR seguían usando el `onConflict` y payload antiguos (sin `semester`) porque el commit de semestres
  solo se aplicó a `TeacherModuleGrades.tsx`. Queda un caso más con el mismo patrón, tolerado a propósito:
  `StudentModule.tsx` → `submitAutoEval()` (sync de autoevaluación a `module_grades`) sigue con el `onConflict`
  viejo, pero está envuelto en un `try/warn` porque `TeacherModuleGrades.tsx` ya usa `auto_eval_responses`
  como fuente de verdad de respaldo si ese upsert falla — revisar si se quiere corregir igual.
- `dimension_grades` — notas del registro secundario, por `(student_id, section_id)`.
- `lesson_sections` — indicadores de contenido de una lección, con campo `dimension` (saber/hacer_proceso/
  hacer_producto) e `is_active`.
- `attendance` — asistencia por `(student_id, date, status)`; alimenta el cálculo automático de SER/DECIDIR.
- `site_settings` — key/value, incluye `active_semester` (semestre activo global).

### Ciclo de semestre / retiro (importante para entender bugs de "aparecen alumnos de semestres pasados")

"Retirar" un estudiante (`AdminDashboard.retireSelected`) **solo pone `profiles.is_active = false`**; no borra
su fila en `enrollments`. Lo mismo con `is_graduated`. Esto significa que **cualquier query que liste
estudiantes de un nivel debe filtrar explícitamente por `is_active = true` y `is_graduated = false`** además
de `career_id`/`shift`, o mostrará estudiantes retirados/graduados/de semestres anteriores que técnicamente
siguen con una fila en `enrollments` para ese nivel.

`TeacherModuleGrades.tsx` sí aplica ese filtro completo al cargar `profiles`. Si algún otro archivo que lista
estudiantes de un nivel (dimension grades, asistencia, reportes nuevos, etc.) no lo replica exactamente, va a
mostrar una lista distinta/inconsistente con el registro principal — este es un patrón de bug que ya se dio
una vez (ver `TeacherDimensionGrades.tsx`, corregido 2026-08-26) y hay que revisarlo cada vez que se toque una
página que consulta `enrollments` + `profiles`.

## Convenciones / puntos a tener en cuenta

- Los componentes de página son grandes y con mucho estilo inline (no CSS modules); es normal, no refactorizar
  por refactorizar.
- Autoguardado con debounce (~700ms) en inputs de notas (`setTimeout` + `autoSaveTimers` ref), no hay botón de
  guardar por celda.
- `total_override` en `module_grades` permite al docente forzar el total ignorando el cálculo por dimensiones.
- Los módulos de "graduación" (`sort_order === 20` o título contiene "modalidad") usan un esquema de
  calificación distinto (socialización/proyecto de sistematización/proyecto de vida) en vez de las 5
  dimensiones normales.
- **Mensajes de aviso (`msg`) en `TeacherModuleGrades.tsx` y `TeacherDimensionGrades.tsx`**: se muestran como
  modal centrado (overlay oscuro + tarjeta), no como banner arriba de la tabla. El color se decide por
  contenido del string: verde si incluye "✅" o "🔒" (éxito/acción intencional), rojo en cualquier otro caso.
  Al agregar un nuevo `setMsg(...)`, usar ese mismo prefijo para que quede bien coloreado — no hay un `type`
  explícito, es heurística por emoji.
- `npm run build` corre `tsc -b && vite build`; usar `npx tsc -b --noEmit` para chequeo rápido de tipos sin
  generar `dist/`.

## Historial de bugs corregidos (para no repetir)

- **2026-08-26** — En `TeacherDimensionGrades.tsx`, el query de `profiles` para listar estudiantes del nivel
  no filtraba por `is_active`/`is_graduated` (a diferencia de `TeacherModuleGrades.tsx`), por lo que
  estudiantes retirados/graduados de semestres anteriores seguían apareciendo en los sub-registros de
  dimensión (pero no en el registro modular), y el botón "Cargar al principal" arrastraba esas filas viejas.
  Fix: agregar `.eq("is_active", true).eq("is_graduated", false)` al mismo query.
- **2026-08-26** — En `TeacherDimensionGrades.tsx`, "Cargar al principal" (y los auto-syncs de SER/DECIDIR)
  fallaban con "N fila(s) no se pudieron actualizar" para estudiantes que ya tenían una fila previa en
  `module_grades`. Causa: seguían usando `onConflict: "student_id,module_id"` sin `semester` en el payload,
  desactualizado desde que `fa6dfc1` cambió la constraint única de esa tabla a
  `(student_id, module_id, semester)`. Fix: incluir `semester: activeSemester` en los 3 upserts
  (`loadAll` auto-sync, `saveCell`, `confirmSync`) y su `onConflict`, y agregar `.eq("semester", activeSemester)`
  a las 2 lecturas de `module_grades` que detectan ediciones manuales del docente (`loadAll`, `openSyncModal`).

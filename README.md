# CEA Plataforma Web

Sistema de gestión académica para el **Centro de Educación Alternativa Madre María Oliva**. Permite a docentes registrar asistencia y calificaciones por dimensiones, y a estudiantes consultar su progreso.

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | React 19 + TypeScript + Vite |
| Estilos | Tailwind CSS v3 |
| Backend / DB | Supabase (PostgreSQL + RLS) |
| Enrutamiento | React Router v7 |
| PDF | jsPDF + jspdf-autotable |
| Excel | SheetJS (xlsx) |

## Roles

- **Administrador** — gestión de usuarios, carreras, niveles, módulos y contenido.
- **Docente** — registro de asistencia, calificaciones por dimensión y generación de reportes.
- **Estudiante** — consulta de asistencia, notas y módulos.

## Estructura de calificaciones

Cada módulo usa el modelo de evaluación por competencias:

| Dimensión | Puntos |
|-----------|--------|
| SER | 10 |
| SABER | 30 |
| HACER Proceso | 20 |
| HACER Producto | 20 |
| DECIDIR | 10 |
| Autoevaluación SER | 5 |
| Autoevaluación DECIDIR | 5 |
| **TOTAL** | **100** |

SER y DECIDIR se calculan automáticamente desde la asistencia. Cada dimensión tiene un registro secundario con modo Fácil (clic para ciclar presets) o Manual (entrada libre).

## Páginas principales

```
/login
/admin/dashboard
/teacher/dashboard
/teacher/modules
/teacher/module/:id/grades          ← Registro modular principal
/teacher/module/:id/grades/ser      ← Registro secundario (inline overlay)
/teacher/module/:id/grades/saber
/teacher/module/:id/grades/hacer_proceso
/teacher/module/:id/grades/hacer_producto
/teacher/module/:id/grades/decidir
/teacher/module/:id/attendance
/student/dashboard
/student/module/:id
/student/attendance
```

## Exportaciones

Desde el registro modular y el centralizador se pueden generar:
- **PDF** (tamaño Carta, orientación horizontal/vertical) con firmas al pie.
- **Excel (.xlsx)** con el mismo contenido tabular.

## Desarrollo local

```bash
npm install
npm run dev
```

Requiere un proyecto Supabase con las tablas `users`, `modules`, `module_grades`, `attendance`, etc. Configura las variables de entorno en `.env`:

```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```

## Build

```bash
npm run build   # tsc + vite build → dist/
npm run preview # sirve dist/ localmente
```

-- =============================================================================
-- FASE 1: Sistema de Evaluación por Dimensiones
-- CEA Plataforma Web
-- Ejecutar en Supabase SQL Editor
-- =============================================================================

-- =============================================================================
-- PASO 1: Agregar columna "dimension" a lesson_sections
-- =============================================================================

ALTER TABLE lesson_sections
  ADD COLUMN IF NOT EXISTS dimension TEXT NOT NULL DEFAULT 'hacer_proceso'
  CHECK (dimension IN ('ser','saber','hacer_proceso','hacer_producto','decidir','auto_ser','auto_decidir'));

-- Las secciones existentes quedan con valor 'hacer_proceso' por defecto.

-- =============================================================================
-- PASO 2: Tablas del sistema de Quiz (dimensión SABER)
-- =============================================================================

-- Quiz asociado a una sección de tipo saber
CREATE TABLE IF NOT EXISTS quizzes (
  id              BIGSERIAL PRIMARY KEY,
  section_id      BIGINT NOT NULL REFERENCES lesson_sections(id) ON DELETE CASCADE,
  max_attempts    INT NOT NULL DEFAULT 2,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (section_id)
);

-- Preguntas del quiz
CREATE TABLE IF NOT EXISTS quiz_questions (
  id          BIGSERIAL PRIMARY KEY,
  quiz_id     BIGINT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  question    TEXT NOT NULL,
  sort_order  INT NOT NULL DEFAULT 0
);

-- Opciones de cada pregunta
CREATE TABLE IF NOT EXISTS quiz_options (
  id           BIGSERIAL PRIMARY KEY,
  question_id  BIGINT NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
  option_text  TEXT NOT NULL,
  is_correct   BOOLEAN NOT NULL DEFAULT FALSE
);

-- Intentos de un estudiante en un quiz
CREATE TABLE IF NOT EXISTS quiz_attempts (
  id              BIGSERIAL PRIMARY KEY,
  quiz_id         BIGINT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  student_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  attempt_number  INT NOT NULL,
  score           NUMERIC(5,2),          -- nota sobre 100
  completed_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (quiz_id, student_id, attempt_number)
);

-- Respuestas dentro de un intento
CREATE TABLE IF NOT EXISTS quiz_answers (
  id           BIGSERIAL PRIMARY KEY,
  attempt_id   BIGINT NOT NULL REFERENCES quiz_attempts(id) ON DELETE CASCADE,
  question_id  BIGINT NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
  option_id    BIGINT REFERENCES quiz_options(id) ON DELETE SET NULL
);

-- =============================================================================
-- PASO 3: Tablas de Autoevaluación (auto_ser y auto_decidir)
-- =============================================================================

-- Actividad de autoevaluación generada automáticamente por módulo
CREATE TABLE IF NOT EXISTS auto_eval_activities (
  id          BIGSERIAL PRIMARY KEY,
  module_id   BIGINT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  dimension   TEXT NOT NULL CHECK (dimension IN ('auto_ser','auto_decidir')),
  -- Indicadores como array JSON (editables por el docente)
  indicators  JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (module_id, dimension)
);

-- Respuestas del estudiante a la autoevaluación
CREATE TABLE IF NOT EXISTS auto_eval_responses (
  id              BIGSERIAL PRIMARY KEY,
  activity_id     BIGINT NOT NULL REFERENCES auto_eval_activities(id) ON DELETE CASCADE,
  student_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Scores como array JSON: [{indicator_index: 0, score: 4}, ...]
  scores          JSONB NOT NULL DEFAULT '[]'::jsonb,
  average_score   NUMERIC(5,2),   -- promedio sobre 5
  final_score     NUMERIC(5,2),   -- nota final sobre la ponderación (5 pts)
  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (activity_id, student_id)
);

-- =============================================================================
-- PASO 4: Tabla de notas por actividad/dimensión (dimension_grades)
-- =============================================================================

-- Almacena la nota de cada estudiante en cada actividad (sección) evaluable
CREATE TABLE IF NOT EXISTS dimension_grades (
  id           BIGSERIAL PRIMARY KEY,
  student_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  section_id   BIGINT NOT NULL REFERENCES lesson_sections(id) ON DELETE CASCADE,
  module_id    BIGINT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  dimension    TEXT NOT NULL CHECK (dimension IN ('ser','saber','hacer_proceso','hacer_producto','decidir')),
  score        NUMERIC(5,2),         -- nota sobre 100 (se ponderará al calcular total)
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by   UUID REFERENCES auth.users(id),
  UNIQUE (student_id, section_id)
);

-- =============================================================================
-- PASO 5: Insertar indicadores predeterminados de autoevaluación
-- (función auxiliar para crear las actividades al crear un módulo)
-- =============================================================================

-- Indicadores fijos de Ser
CREATE OR REPLACE FUNCTION public.default_auto_ser_indicators()
RETURNS JSONB LANGUAGE sql IMMUTABLE AS $$
  SELECT '[
    "Asistí regularmente a clases y participé de manera responsable en las actividades del módulo.",
    "Cumplí con responsabilidad las prácticas y actividades asignadas durante el desarrollo del módulo.",
    "Respeté las normas del aula o taller y cuidé adecuadamente los equipos y recursos tecnológicos.",
    "Mantuve una actitud de respeto y colaboración con el docente y mis compañeros durante las actividades de aprendizaje.",
    "Realicé mis actividades con honestidad y compromiso, procurando aprender y mejorar mis habilidades en informática."
  ]'::jsonb;
$$;

-- Indicadores fijos de Decidir
CREATE OR REPLACE FUNCTION public.default_auto_decidir_indicators()
RETURNS JSONB LANGUAGE sql IMMUTABLE AS $$
  SELECT '[
    "Intenté resolver los problemas técnicos por mi cuenta antes de pedir ayuda.",
    "Elegí herramientas o procedimientos adecuados para realizar las prácticas.",
    "Analicé los errores que cometí y busqué maneras de corregirlos.",
    "Tomé decisiones responsables al usar equipos, programas y recursos tecnológicos.",
    "Reflexioné sobre lo que aprendí para mejorar mis decisiones en las siguientes actividades."
  ]'::jsonb;
$$;

-- =============================================================================
-- PASO 6: Función para crear automáticamente las auto_eval_activities
-- cuando se crea (o activa) un módulo.
-- Llamar manualmente para módulos ya existentes.
-- =============================================================================

-- PASO 6 corregido (solo esto si los demás pasos ya corrieron)

CREATE OR REPLACE FUNCTION public.create_auto_eval_for_module(p_module_id BIGINT)
RETURNS VOID LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO auto_eval_activities (module_id, dimension, indicators)
  VALUES (p_module_id, 'auto_ser', public.default_auto_ser_indicators())
  ON CONFLICT (module_id, dimension) DO NOTHING;

  INSERT INTO auto_eval_activities (module_id, dimension, indicators)
  VALUES (p_module_id, 'auto_decidir', public.default_auto_decidir_indicators())
  ON CONFLICT (module_id, dimension) DO NOTHING;
END;
$$;

-- Poblar para módulos existentes
DO $$
DECLARE
  mod RECORD;
BEGIN
  FOR mod IN SELECT id FROM modules LOOP
    PERFORM public.create_auto_eval_for_module(mod.id::BIGINT);
  END LOOP;
END;
$$;

-- Trigger para nuevos módulos
CREATE OR REPLACE FUNCTION public.trigger_create_auto_eval()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  PERFORM public.create_auto_eval_for_module(NEW.id::BIGINT);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_eval_on_module_insert ON modules;
CREATE TRIGGER trg_auto_eval_on_module_insert
  AFTER INSERT ON modules
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_create_auto_eval();


-- =============================================================================
-- PASO 7: Trigger para crear auto_eval automáticamente al insertar un módulo
-- =============================================================================

CREATE OR REPLACE FUNCTION public.trigger_create_auto_eval()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  PERFORM public.create_auto_eval_for_module(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_eval_on_module_insert ON modules;
CREATE TRIGGER trg_auto_eval_on_module_insert
  AFTER INSERT ON modules
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_create_auto_eval();

-- =============================================================================
-- PASO 8: Función de cálculo de nota final por dimensión con mínimos
-- Devuelve la nota ponderada para el registro principal del módulo
-- =============================================================================

-- Notas mínimas proporcionales (escala 20-100):
--   ser: 2/10, saber: 6/30, hacer_proceso: 4/20, hacer_producto: 4/20,
--   decidir: 2/10, auto_ser: 1/5, auto_decidir: 1/5

CREATE OR REPLACE FUNCTION public.apply_dimension_minimum(
  p_score    NUMERIC,   -- promedio calculado (0-100 scale normalizado a la ponderación)
  p_min      NUMERIC    -- mínimo proporcional para esa dimensión
) RETURNS NUMERIC LANGUAGE sql IMMUTABLE AS $$
  SELECT GREATEST(COALESCE(p_score, p_min), p_min);
$$;

-- =============================================================================
-- PASO 9: Row Level Security (RLS)
-- =============================================================================

-- quizzes: acceso público de lectura para autenticados
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read quizzes" ON quizzes
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Teachers manage quizzes" ON quizzes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('teacher','admin'))
  );

-- quiz_questions
ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read quiz_questions" ON quiz_questions
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Teachers manage quiz_questions" ON quiz_questions
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('teacher','admin'))
  );

-- quiz_options
ALTER TABLE quiz_options ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read quiz_options" ON quiz_options
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Teachers manage quiz_options" ON quiz_options
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('teacher','admin'))
  );

-- quiz_attempts: estudiante solo ve los suyos; docentes ven todos
ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students manage own attempts" ON quiz_attempts
  FOR ALL USING (student_id = auth.uid());
CREATE POLICY "Teachers read all attempts" ON quiz_attempts
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('teacher','admin'))
  );

-- quiz_answers: igual que attempts
ALTER TABLE quiz_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students manage own answers" ON quiz_answers
  FOR ALL USING (
    EXISTS (SELECT 1 FROM quiz_attempts qa WHERE qa.id = attempt_id AND qa.student_id = auth.uid())
  );
CREATE POLICY "Teachers read all answers" ON quiz_answers
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('teacher','admin'))
  );

-- auto_eval_activities: todos leen; docentes modifican
ALTER TABLE auto_eval_activities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read auto_eval_activities" ON auto_eval_activities
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Teachers manage auto_eval_activities" ON auto_eval_activities
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('teacher','admin'))
  );

-- auto_eval_responses: estudiante solo ve/escribe la suya; docentes ven todas
ALTER TABLE auto_eval_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students manage own auto_eval_responses" ON auto_eval_responses
  FOR ALL USING (student_id = auth.uid());
CREATE POLICY "Teachers read all auto_eval_responses" ON auto_eval_responses
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('teacher','admin'))
  );

-- dimension_grades: docentes gestionan; estudiantes solo leen la suya
ALTER TABLE dimension_grades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students read own dimension_grades" ON dimension_grades
  FOR SELECT USING (student_id = auth.uid());
CREATE POLICY "Teachers manage dimension_grades" ON dimension_grades
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('teacher','admin'))
  );

-- =============================================================================
-- VERIFICACIÓN FINAL
-- =============================================================================

SELECT 'lesson_sections dimension column' AS check,
  COUNT(*) AS total_sections,
  COUNT(*) FILTER (WHERE dimension = 'hacer_proceso') AS default_hacer_proceso
FROM lesson_sections;

SELECT 'auto_eval_activities created' AS check, COUNT(*) AS total
FROM auto_eval_activities;

SELECT 'Tables created' AS check, table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('quizzes','quiz_questions','quiz_options','quiz_attempts','quiz_answers',
                     'auto_eval_activities','auto_eval_responses','dimension_grades')
ORDER BY table_name;

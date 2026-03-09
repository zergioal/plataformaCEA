-- ============================================================
-- AUTOEVALUACIÓN SETUP
-- Tablas para que los estudiantes se autoevalúen en SER y DECIDIR
-- ============================================================

-- Tabla de actividades de autoevaluación por módulo
CREATE TABLE IF NOT EXISTS auto_eval_activities (
  id         BIGSERIAL PRIMARY KEY,
  module_id  BIGINT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  dimension  TEXT NOT NULL CHECK (dimension IN ('auto_ser', 'auto_decidir')),
  indicators JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (module_id, dimension)
);

-- Respuestas de los estudiantes
CREATE TABLE IF NOT EXISTS auto_eval_responses (
  id            BIGSERIAL PRIMARY KEY,
  activity_id   BIGINT NOT NULL REFERENCES auto_eval_activities(id) ON DELETE CASCADE,
  student_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scores        JSONB NOT NULL DEFAULT '[]',  -- array de puntajes por indicador (1-5)
  average_score NUMERIC(5,2) DEFAULT 0,
  final_score   NUMERIC(5,2) DEFAULT 0,       -- sobre 5 puntos
  submitted_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (activity_id, student_id)
);

-- RLS
ALTER TABLE auto_eval_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE auto_eval_responses  ENABLE ROW LEVEL SECURITY;

-- Políticas auto_eval_activities
CREATE POLICY "Students can view auto_eval_activities"
  ON auto_eval_activities FOR SELECT
  USING (true);

CREATE POLICY "Teachers/admins can manage auto_eval_activities"
  ON auto_eval_activities FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('teacher', 'admin')
    )
  );

-- Políticas auto_eval_responses
CREATE POLICY "Students can view their own responses"
  ON auto_eval_responses FOR SELECT
  USING (student_id = auth.uid());

CREATE POLICY "Students can insert/update their own responses"
  ON auto_eval_responses FOR INSERT
  WITH CHECK (student_id = auth.uid());

CREATE POLICY "Students can update their own responses"
  ON auto_eval_responses FOR UPDATE
  USING (student_id = auth.uid());

CREATE POLICY "Teachers/admins can view all responses"
  ON auto_eval_responses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('teacher', 'admin')
    )
  );

-- Índices
CREATE INDEX IF NOT EXISTS idx_auto_eval_activities_module ON auto_eval_activities(module_id);
CREATE INDEX IF NOT EXISTS idx_auto_eval_responses_activity ON auto_eval_responses(activity_id);
CREATE INDEX IF NOT EXISTS idx_auto_eval_responses_student ON auto_eval_responses(student_id);

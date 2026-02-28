-- =====================================================
-- SCRIPT: Sistema de Semestres + Asistencia
-- Ejecutar en Supabase SQL Editor
-- =====================================================

-- 1. Agregar columna current_semester a profiles (estudiantes)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS current_semester VARCHAR(10);

-- 2. Poblar semestre actual para estudiantes existentes
UPDATE profiles
SET current_semester =
  CASE
    WHEN EXTRACT(MONTH FROM NOW()) <= 6
    THEN CONCAT('1/', EXTRACT(YEAR FROM NOW())::TEXT)
    ELSE CONCAT('2/', EXTRACT(YEAR FROM NOW())::TEXT)
  END
WHERE role = 'student' AND current_semester IS NULL;

-- 3. Crear tabla de asistencia
CREATE TABLE IF NOT EXISTS attendance (
  id          BIGSERIAL PRIMARY KEY,
  student_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  date        DATE NOT NULL,
  status      VARCHAR(1) NOT NULL CHECK (status IN ('P','A','F','L')),
  recorded_by UUID REFERENCES profiles(id),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, date)
);

-- 4. Índices para búsquedas eficientes
CREATE INDEX IF NOT EXISTS idx_attendance_student_date
  ON attendance(student_id, date);
CREATE INDEX IF NOT EXISTS idx_attendance_date
  ON attendance(date);
CREATE INDEX IF NOT EXISTS idx_attendance_student_id
  ON attendance(student_id);

-- 5. RLS para tabla attendance
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- Docentes y admin pueden ver registros de estudiantes de su misma carrera/turno
CREATE POLICY "Teachers can view attendance of their students" ON attendance
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles teacher
      JOIN profiles student ON student.id = attendance.student_id
      WHERE teacher.id = auth.uid()
        AND teacher.role IN ('teacher', 'admin', 'administrativo')
        AND teacher.career_id = student.career_id
        AND teacher.shift = student.shift
    )
    OR (
      -- Admin y administrativo pueden ver todo
      EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role IN ('admin', 'administrativo')
      )
    )
  );

-- Docentes pueden insertar/actualizar asistencia de sus estudiantes
CREATE POLICY "Teachers can insert attendance" ON attendance
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles teacher
      JOIN profiles student ON student.id = attendance.student_id
      WHERE teacher.id = auth.uid()
        AND teacher.role IN ('teacher', 'admin')
        AND teacher.career_id = student.career_id
        AND teacher.shift = student.shift
    )
  );

CREATE POLICY "Teachers can update attendance" ON attendance
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles teacher
      JOIN profiles student ON student.id = attendance.student_id
      WHERE teacher.id = auth.uid()
        AND teacher.role IN ('teacher', 'admin')
        AND teacher.career_id = student.career_id
        AND teacher.shift = student.shift
    )
  );

CREATE POLICY "Teachers can delete attendance" ON attendance
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles teacher
      JOIN profiles student ON student.id = attendance.student_id
      WHERE teacher.id = auth.uid()
        AND teacher.role IN ('teacher', 'admin')
        AND teacher.career_id = student.career_id
        AND teacher.shift = student.shift
    )
  );

-- Estudiantes solo pueden ver SU propia asistencia
CREATE POLICY "Students can view own attendance" ON attendance
  FOR SELECT
  USING (student_id = auth.uid());

SELECT 'Script semestres y asistencia ejecutado correctamente' AS resultado;

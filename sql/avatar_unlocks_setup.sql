-- =====================================================
-- SCRIPT: Sistema de avatares desbloqueables por desafío
-- Los avatares especiales (av17-av20) son desbloqueados por el docente
-- Ejecutar en Supabase SQL Editor
-- =====================================================

-- 1. Crear tabla para registrar avatares especiales desbloqueados
CREATE TABLE IF NOT EXISTS student_avatar_unlocks (
  id SERIAL PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  avatar_key VARCHAR(10) NOT NULL,
  unlocked_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, avatar_key)
);

-- 2. Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_avatar_unlocks_student ON student_avatar_unlocks(student_id);

-- 3. Habilitar RLS
ALTER TABLE student_avatar_unlocks ENABLE ROW LEVEL SECURITY;

-- 4. Política: estudiantes pueden ver sus propios avatares desbloqueados
CREATE POLICY "Students can view own avatar unlocks"
  ON student_avatar_unlocks
  FOR SELECT
  USING (student_id = auth.uid());

-- 5. Política: docentes y admins pueden ver todos los avatares desbloqueados
CREATE POLICY "Teachers can view all avatar unlocks"
  ON student_avatar_unlocks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('teacher', 'admin')
    )
  );

-- 6. Política: docentes y admins pueden desbloquear avatares
CREATE POLICY "Teachers can unlock avatars"
  ON student_avatar_unlocks
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('teacher', 'admin')
    )
  );

-- 7. Política: docentes y admins pueden bloquear avatares (eliminar desbloqueo)
CREATE POLICY "Teachers can lock avatars"
  ON student_avatar_unlocks
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('teacher', 'admin')
    )
  );

SELECT 'Script de avatares ejecutado correctamente' as resultado;

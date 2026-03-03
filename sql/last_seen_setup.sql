-- =============================================================
-- last_seen_setup.sql
-- Agrega columna last_seen_at a profiles para rastrear
-- la última vez que un participante se conectó a la plataforma.
-- Ejecutar en: Supabase SQL Editor
-- =============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;

-- Índice para ordenar por última conexión de forma eficiente
CREATE INDEX IF NOT EXISTS idx_profiles_last_seen_at
  ON profiles(last_seen_at DESC NULLS LAST);

-- RLS: los estudiantes pueden actualizar su propio last_seen_at
-- (La política existente "Users can update own profile" ya debería cubrirlo,
--  pero si no existe, crearla explícitamente):
-- DROP POLICY IF EXISTS "Allow self update last_seen_at" ON profiles;
-- CREATE POLICY "Allow self update last_seen_at" ON profiles
--   FOR UPDATE USING (auth.uid() = id)
--   WITH CHECK (auth.uid() = id);

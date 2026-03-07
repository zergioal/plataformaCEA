-- =============================================================
-- board_member_setup.sql
-- Agrega campo is_board_member a profiles para identificar
-- a los participantes que forman parte de la mesa directiva.
-- Los miembros de la mesa directiva pueden ver la asistencia
-- de todos los estudiantes desde su panel.
-- Ejecutar en: Supabase SQL Editor
-- =============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_board_member BOOLEAN DEFAULT FALSE;

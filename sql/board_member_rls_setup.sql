-- =============================================================
-- board_member_rls_setup.sql
-- IMPORTANTE: Ejecutar el PASO 0 primero para restaurar el login
-- si el sistema está caído por recursión infinita.
-- Ejecutar en: Supabase SQL Editor
-- =============================================================

-- ── PASO 0: RESTAURAR (ejecutar si hay error 42P17) ──────────
-- Elimina la política recursiva que rompe el login de todos.
DROP POLICY IF EXISTS "Board members can view student profiles" ON profiles;
DROP POLICY IF EXISTS "Board members can view attendance" ON attendance;
DROP POLICY IF EXISTS "Board members can view enrollments" ON enrollments;

-- ── PASO 1: Función SECURITY DEFINER ─────────────────────────
-- Consulta is_board_member SIN activar las políticas RLS de
-- profiles, rompiendo así la recursión infinita.
CREATE OR REPLACE FUNCTION public.is_board_member(user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_board_member FROM profiles WHERE id = user_id LIMIT 1),
    FALSE
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_board_member(UUID) TO authenticated;

-- ── PASO 2: attendance — mesa directiva puede leer toda ───────
CREATE POLICY "Board members can view attendance"
  ON attendance FOR SELECT
  USING (
    public.is_board_member(auth.uid()) = TRUE
  );

-- ── PASO 3: profiles — mesa directiva puede leer perfiles ─────
-- Usa la función SECURITY DEFINER (no recursiva) en vez de
-- subquery FROM profiles dentro de la política.
CREATE POLICY "Board members can view student profiles"
  ON profiles FOR SELECT
  USING (
    id = auth.uid()
    OR
    public.is_board_member(auth.uid()) = TRUE
  );

-- ── PASO 4: enrollments — mesa directiva puede ver inscrip. ───
CREATE POLICY "Board members can view enrollments"
  ON enrollments FOR SELECT
  USING (
    student_id = auth.uid()
    OR
    public.is_board_member(auth.uid()) = TRUE
  );

SELECT 'Políticas RLS para mesa directiva creadas correctamente (sin recursión)' AS resultado;

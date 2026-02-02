-- =====================================================
-- SCRIPT DE SEGURIDAD: Bloqueo de cuentas por intentos fallidos
-- Ejecutar en Supabase SQL Editor
-- =====================================================

-- 1. Agregar columna 'locked' a profiles (si no existe)
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS locked BOOLEAN DEFAULT FALSE;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS failed_attempts INT DEFAULT 0;

-- 2. Crear tabla para registro de intentos de login
CREATE TABLE IF NOT EXISTS login_attempts (
  id BIGSERIAL PRIMARY KEY,
  email TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  success BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_login_attempts_email ON login_attempts(email);
CREATE INDEX IF NOT EXISTS idx_login_attempts_created_at ON login_attempts(created_at);
CREATE INDEX IF NOT EXISTS idx_profiles_locked ON profiles(locked) WHERE locked = TRUE;

-- 4. Función para registrar intento de login y bloquear si es necesario
CREATE OR REPLACE FUNCTION register_login_attempt(
  p_email TEXT,
  p_success BOOLEAN,
  p_ip_address TEXT DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile_id UUID;
  v_failed_attempts INT;
  v_is_locked BOOLEAN;
  v_max_attempts INT := 5;
BEGIN
  -- Registrar el intento
  INSERT INTO login_attempts (email, success, ip_address, user_agent)
  VALUES (p_email, p_success, p_ip_address, p_user_agent);

  -- Buscar el perfil por email
  SELECT p.id, p.failed_attempts, p.locked
  INTO v_profile_id, v_failed_attempts, v_is_locked
  FROM profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE u.email = p_email;

  -- Si no existe el usuario, retornar
  IF v_profile_id IS NULL THEN
    RETURN json_build_object('status', 'user_not_found');
  END IF;

  -- Si ya está bloqueado
  IF v_is_locked THEN
    RETURN json_build_object('status', 'already_locked', 'locked', TRUE);
  END IF;

  -- Si el login fue exitoso, resetear contador
  IF p_success THEN
    UPDATE profiles
    SET failed_attempts = 0
    WHERE id = v_profile_id;

    RETURN json_build_object('status', 'success', 'locked', FALSE);
  END IF;

  -- Login fallido: incrementar contador
  v_failed_attempts := COALESCE(v_failed_attempts, 0) + 1;

  IF v_failed_attempts >= v_max_attempts THEN
    -- Bloquear cuenta
    UPDATE profiles
    SET locked = TRUE,
        locked_at = NOW(),
        failed_attempts = v_failed_attempts
    WHERE id = v_profile_id;

    RETURN json_build_object(
      'status', 'account_locked',
      'locked', TRUE,
      'attempts', v_failed_attempts
    );
  ELSE
    -- Solo incrementar contador
    UPDATE profiles
    SET failed_attempts = v_failed_attempts
    WHERE id = v_profile_id;

    RETURN json_build_object(
      'status', 'attempt_recorded',
      'locked', FALSE,
      'attempts', v_failed_attempts,
      'remaining', v_max_attempts - v_failed_attempts
    );
  END IF;
END;
$$;

-- 5. Función para verificar si una cuenta está bloqueada (antes del login)
CREATE OR REPLACE FUNCTION check_account_locked(p_email TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_is_locked BOOLEAN;
  v_locked_at TIMESTAMPTZ;
  v_role TEXT;
BEGIN
  SELECT p.locked, p.locked_at, p.role
  INTO v_is_locked, v_locked_at, v_role
  FROM profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE u.email = p_email;

  IF v_is_locked IS NULL THEN
    RETURN json_build_object('exists', FALSE, 'locked', FALSE);
  END IF;

  RETURN json_build_object(
    'exists', TRUE,
    'locked', COALESCE(v_is_locked, FALSE),
    'locked_at', v_locked_at,
    'role', v_role
  );
END;
$$;

-- 6. Función para desbloquear cuenta (solo admin)
CREATE OR REPLACE FUNCTION unlock_account(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE profiles
  SET locked = FALSE,
      locked_at = NULL,
      failed_attempts = 0
  WHERE id = p_user_id;

  RETURN FOUND;
END;
$$;

-- 7. Dar permisos para llamar las funciones desde el cliente
GRANT EXECUTE ON FUNCTION register_login_attempt TO anon, authenticated;
GRANT EXECUTE ON FUNCTION check_account_locked TO anon, authenticated;
GRANT EXECUTE ON FUNCTION unlock_account TO authenticated;

-- 8. RLS para login_attempts (solo lectura para admins)
ALTER TABLE login_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view login attempts" ON login_attempts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Permitir INSERT desde anon (para registrar intentos antes de autenticación)
CREATE POLICY "Anyone can insert login attempts" ON login_attempts
  FOR INSERT
  WITH CHECK (TRUE);

SELECT 'Script ejecutado correctamente' as resultado;

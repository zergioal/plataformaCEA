-- =====================================================
-- SCRIPT: Rol "administrativo" (solo lectura + reportes)
-- Ejecutar en Supabase SQL Editor
-- =====================================================

-- 1. Agregar 'administrativo' al enum user_role
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'administrativo';

-- 2. Actualizar RLS de login_attempts para que administrativo también pueda ver
DROP POLICY IF EXISTS "Admins can view login attempts" ON login_attempts;
CREATE POLICY "Admins can view login attempts" ON login_attempts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'administrativo')
    )
  );

-- 3. Crear el usuario administrativo
-- Paso 1: Crear en auth.users (ajustar email y contraseña)
-- Paso 2: Insertar perfil con role = 'administrativo'
--
-- OPCION A: Crear manualmente desde Supabase Auth > Users > Add User
--   Email: administrativo@cea.edu.bo (o el que prefieras)
--   Password: Admin2026!
--   Luego actualizar el perfil:
--   UPDATE profiles SET role = 'administrativo' WHERE id = '<UUID_DEL_USUARIO>';
--
-- OPCION B: Usar esta función (ejecutar después de crear el usuario en Auth):
-- UPDATE profiles
-- SET role = 'administrativo',
--     code = 'ADM-001',
--     full_name = 'Usuario Administrativo',
--     first_names = 'Usuario',
--     last_name_pat = 'Administrativo'
-- WHERE id = '<UUID_DEL_USUARIO>';

SELECT 'Enum user_role actualizado con administrativo' as resultado;

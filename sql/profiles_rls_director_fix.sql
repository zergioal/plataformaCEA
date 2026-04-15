-- ============================================================
-- CEA Plataforma — Fix RLS profiles para director(a)
-- El director necesita poder actualizar perfiles de docentes
-- y estudiantes (igual que el admin del sistema).
-- ============================================================

-- Eliminar policies anteriores de admin en profiles (nombres comunes)
DROP POLICY IF EXISTS "Admins can manage profiles" ON profiles;
DROP POLICY IF EXISTS "admins_manage_profiles" ON profiles;
DROP POLICY IF EXISTS "Admin manages all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update profiles" ON profiles;
DROP POLICY IF EXISTS "admins_update_profiles" ON profiles;
DROP POLICY IF EXISTS "director_update_profiles" ON profiles;

-- Policy: admin del sistema Y director pueden leer/editar todos los perfiles
CREATE POLICY "admins_manage_profiles" ON profiles
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND (
          p.role = 'admin'
          OR (p.role = 'administrativo' AND p.admin_type = 'director')
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND (
          p.role = 'admin'
          OR (p.role = 'administrativo' AND p.admin_type = 'director')
        )
    )
  );

-- Policy separada: cada usuario puede leer/actualizar su propio perfil
DROP POLICY IF EXISTS "Users manage own profile" ON profiles;
DROP POLICY IF EXISTS "users_manage_own_profile" ON profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "user_self_access" ON profiles;

CREATE POLICY "users_manage_own_profile" ON profiles
  FOR ALL TO authenticated
  USING  (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Secretaria: solo lectura de todos los perfiles (sin editar)
DROP POLICY IF EXISTS "secretaria_read_profiles" ON profiles;
CREATE POLICY "secretaria_read_profiles" ON profiles
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'administrativo'
        AND p.admin_type = 'secretaria'
    )
  );

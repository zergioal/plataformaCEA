-- ============================================================
-- CEA Plataforma — Fix URGENTE: RLS profiles sin recursión
-- El error 500 se debe a que la policy anterior consultaba
-- la tabla profiles DENTRO de una policy de profiles → loop.
-- Solución: función SECURITY DEFINER que bypass RLS.
-- ============================================================

-- 1. Eliminar policies problemáticas
DROP POLICY IF EXISTS "admins_manage_profiles"       ON profiles;
DROP POLICY IF EXISTS "users_manage_own_profile"     ON profiles;
DROP POLICY IF EXISTS "secretaria_read_profiles"     ON profiles;
-- También nombres comunes que puedan existir
DROP POLICY IF EXISTS "Admins can manage profiles"   ON profiles;
DROP POLICY IF EXISTS "Admin manages all profiles"   ON profiles;
DROP POLICY IF EXISTS "Admins can update profiles"   ON profiles;
DROP POLICY IF EXISTS "Users manage own profile"     ON profiles;
DROP POLICY IF EXISTS "Users can view their own profile"   ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "user_self_access"             ON profiles;
DROP POLICY IF EXISTS "director_update_profiles"     ON profiles;

-- 2. Funciones helper SECURITY DEFINER (sin RLS, sin recursión)
DROP FUNCTION IF EXISTS get_my_role();
DROP FUNCTION IF EXISTS get_my_admin_type();

CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION get_my_admin_type()
RETURNS TEXT
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT admin_type FROM profiles WHERE id = auth.uid();
$$;

-- 3. Policy: cada usuario puede ver y editar su propio perfil
CREATE POLICY "users_own_profile"
  ON profiles FOR ALL
  TO authenticated
  USING     (id = auth.uid())
  WITH CHECK(id = auth.uid());

-- 4. Policy: admin del sistema gestiona todo
CREATE POLICY "admin_manage_all_profiles"
  ON profiles FOR ALL
  TO authenticated
  USING     (get_my_role() = 'admin')
  WITH CHECK(get_my_role() = 'admin');

-- 5. Policy: director gestiona perfiles de docentes y estudiantes
CREATE POLICY "director_manage_profiles"
  ON profiles FOR ALL
  TO authenticated
  USING (
    get_my_role() = 'administrativo'
    AND get_my_admin_type() = 'director'
  )
  WITH CHECK (
    get_my_role() = 'administrativo'
    AND get_my_admin_type() = 'director'
  );

-- 6. Policy: secretaria solo lectura de todos los perfiles
CREATE POLICY "secretaria_read_profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    get_my_role() = 'administrativo'
    AND get_my_admin_type() = 'secretaria'
  );

-- 7. Permisos para ejecutar las funciones
GRANT EXECUTE ON FUNCTION get_my_role()       TO authenticated;
GRANT EXECUTE ON FUNCTION get_my_admin_type() TO authenticated;

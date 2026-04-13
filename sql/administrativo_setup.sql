-- ============================================================
-- CEA Plataforma — Rol Administrativo
-- director(a): permisos equivalentes al admin
-- secretaria:  lectura y reportes, sin editar/eliminar usuarios ni carreras
-- Solo puede existir UN director y UNA secretaria a la vez.
-- ============================================================

-- 1. Añadir columna admin_type a profiles (si no existe)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS admin_type TEXT
  CHECK (admin_type IN ('director', 'secretaria'));

-- 2. Índice único: solo un director
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_director
  ON profiles (admin_type)
  WHERE role = 'administrativo' AND admin_type = 'director';

-- 3. Índice único: solo una secretaria
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_secretaria
  ON profiles (admin_type)
  WHERE role = 'administrativo' AND admin_type = 'secretaria';

-- 4. RLS: los administrativos pueden leer todo (mismos permisos de lectura que admin)
-- Los policies de lectura existentes para admin ya cubren esto si usan role IN ('admin','administrativo')
-- Verificar/añadir si se usan policies estrictas en otras tablas.

-- 5. Eliminar director_name de site_settings si existe
--    (ahora el nombre del director se lee del perfil del usuario con admin_type='director')
DELETE FROM site_settings WHERE key = 'director_name';

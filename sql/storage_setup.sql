-- ============================================================
-- CEA Plataforma — Storage bucket para assets públicos
-- Ejecutar en Supabase → SQL Editor
-- ============================================================

-- 1. Crear bucket público
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'public-assets',
  'public-assets',
  true,
  5242880,  -- 5 MB por archivo
  ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/gif']
)
ON CONFLICT (id) DO UPDATE SET public = true;

-- 2. Política: cualquier usuario autenticado puede subir
DROP POLICY IF EXISTS "authenticated_upload" ON storage.objects;
CREATE POLICY "authenticated_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'public-assets');

-- 3. Política: admins pueden borrar
DROP POLICY IF EXISTS "admin_delete" ON storage.objects;
CREATE POLICY "admin_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'public-assets'
    AND EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 4. Política: lectura pública (sin autenticar)
DROP POLICY IF EXISTS "public_read" ON storage.objects;
CREATE POLICY "public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'public-assets');

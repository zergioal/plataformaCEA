-- ============================================================
-- CEA Plataforma — Fix RLS site_settings para administrativos
-- Permite a director y secretaria gestionar la configuración
-- ============================================================

DROP POLICY IF EXISTS "admins_manage_site_settings" ON site_settings;

CREATE POLICY "admins_manage_site_settings" ON site_settings
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'administrativo')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
      AND role IN ('admin', 'administrativo')
  ));

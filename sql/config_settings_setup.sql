-- ============================================================
-- CEA Plataforma — Tablas de configuración
-- site_settings: configuración global (admin)
-- teacher_settings: configuración por docente
-- ============================================================

-- 1. Configuración global del sitio
CREATE TABLE IF NOT EXISTS site_settings (
  key   TEXT PRIMARY KEY,
  value TEXT,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_by  UUID REFERENCES auth.users(id)
);

ALTER TABLE site_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_manage_site_settings" ON site_settings;
CREATE POLICY "admins_manage_site_settings" ON site_settings
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  ));

DROP POLICY IF EXISTS "authenticated_read_site_settings" ON site_settings;
DROP POLICY IF EXISTS "public_read_site_settings" ON site_settings;
CREATE POLICY "public_read_site_settings" ON site_settings
  FOR SELECT TO anon, authenticated USING (true);

-- 2. Configuración por docente
CREATE TABLE IF NOT EXISTS teacher_settings (
  teacher_id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  schedule_rows       JSONB    DEFAULT '[]',   -- [{day,time,room}]
  active_semester     TEXT,                     -- ej. "1/2026" (override local)
  saber_pct           INT      DEFAULT 25,
  hacer_proceso_pct   INT      DEFAULT 25,
  hacer_producto_pct  INT      DEFAULT 25,
  ser_pct             INT      DEFAULT 25,
  decidir_pct         INT      DEFAULT 0,
  min_passing         NUMERIC  DEFAULT 51,
  observation_templates TEXT[] DEFAULT '{}',
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE teacher_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "teacher_owns_settings" ON teacher_settings;
CREATE POLICY "teacher_owns_settings" ON teacher_settings
  FOR ALL TO authenticated
  USING (teacher_id = auth.uid())
  WITH CHECK (teacher_id = auth.uid());

DROP POLICY IF EXISTS "admins_read_teacher_settings" ON teacher_settings;
CREATE POLICY "admins_read_teacher_settings" ON teacher_settings
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','administrativo')
  ));

-- Default site settings (se pueden sobrescribir desde el admin)
INSERT INTO site_settings (key, value) VALUES
  ('institution_name',   'CEA Madre María Oliva'),
  ('institution_mission','Formar técnicos medios con espíritu emprendedor y vocación de servicio, comprometidos con su desarrollo personal y el bienestar de sus comunidades.'),
  ('institution_vision', 'Consolidarnos como una institución líder en educación técnica alternativa, reconocida por su excelencia académica, formación en valores, calidad humana y compromiso con el desarrollo local.'),
  ('contact_phone',      '4502863'),
  ('contact_mobile',     '71418791'),
  ('contact_email',      'ceammoliva@gmail.com'),
  ('contact_address',    'Calle Maximiliano Marquez Nº 2036 (Lado UCB)'),
  ('announcement_text',  ''),
  ('announcement_active','false'),
  ('active_semester',    '1/2026'),
  ('gallery_images',     '[{"src":"/images/CEA.jpeg","alt":"Fachada del CEA Madre María Oliva"},{"src":"/images/CEA1.jpeg","alt":"Estudiantes en formación técnica"},{"src":"/images/CEA2.jpeg","alt":"Instalaciones y talleres"}]'),
  ('requirements',       '["3 Fotocopias de Cédula de Identidad","3 Fotocopias de Certificado de Nacimiento","100 Bs. de aporte estudiantil semestral"]')
ON CONFLICT (key) DO NOTHING;

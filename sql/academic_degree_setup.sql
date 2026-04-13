-- ============================================================
-- CEA Plataforma — Grado académico máximo
-- Para docentes y administrativos
-- Opciones: ts | lic | ing | msc | dr
-- ============================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS academic_degree TEXT
  CHECK (academic_degree IN ('ts', 'lic', 'ing', 'msc', 'dr'));

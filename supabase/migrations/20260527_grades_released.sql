-- Permite al docente controlar cuándo los estudiantes pueden ver sus notas por módulo
ALTER TABLE modules
ADD COLUMN IF NOT EXISTS grades_released boolean DEFAULT false;

COMMENT ON COLUMN modules.grades_released IS 'Si true, los estudiantes pueden ver su calificación en este módulo';

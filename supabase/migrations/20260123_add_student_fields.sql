-- Agregar nuevos campos para estudiantes en la tabla profiles
-- Ejecutar en Supabase SQL Editor

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS rudeal_number VARCHAR(50),
ADD COLUMN IF NOT EXISTS carnet_number VARCHAR(20),
ADD COLUMN IF NOT EXISTS gender VARCHAR(1) CHECK (gender IN ('F', 'M')),
ADD COLUMN IF NOT EXISTS birth_date DATE;

-- Comentarios para documentar las columnas
COMMENT ON COLUMN profiles.rudeal_number IS 'Número RUDEAL del estudiante (opcional)';
COMMENT ON COLUMN profiles.carnet_number IS 'Número de Carnet del estudiante (obligatorio)';
COMMENT ON COLUMN profiles.gender IS 'Género del estudiante: F (Femenino) o M (Masculino)';
COMMENT ON COLUMN profiles.birth_date IS 'Fecha de nacimiento del estudiante';

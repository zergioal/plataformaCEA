-- ============================================================
-- POLÍTICAS RLS: Permite a estudiantes escribir sus propias notas
-- Problema raíz: dimension_grades y module_grades solo tenían
-- políticas SELECT para estudiantes — los upserts del JS fallaban
-- silenciosamente sin mostrar error.
--
-- NOTA: CREATE POLICY IF NOT EXISTS no está disponible en PG15.
-- Se usa DROP ... IF EXISTS + CREATE para idempotencia segura.
-- ============================================================

-- ── dimension_grades ────────────────────────────────────────

DROP POLICY IF EXISTS "Students insert own dimension_grades" ON dimension_grades;
CREATE POLICY "Students insert own dimension_grades"
  ON dimension_grades FOR INSERT
  WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "Students update own dimension_grades" ON dimension_grades;
CREATE POLICY "Students update own dimension_grades"
  ON dimension_grades FOR UPDATE
  USING (student_id = auth.uid());

-- ── module_grades ────────────────────────────────────────────

DROP POLICY IF EXISTS "Students insert own module_grades" ON module_grades;
CREATE POLICY "Students insert own module_grades"
  ON module_grades FOR INSERT
  WITH CHECK (student_id = auth.uid());

DROP POLICY IF EXISTS "Students update own module_grades" ON module_grades;
CREATE POLICY "Students update own module_grades"
  ON module_grades FOR UPDATE
  USING (student_id = auth.uid());

-- ── VERIFICACIÓN ─────────────────────────────────────────────
SELECT schemaname, tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('dimension_grades', 'module_grades')
ORDER BY tablename, policyname;

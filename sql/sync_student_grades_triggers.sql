-- ============================================================
-- TRIGGERS: Propaga notas de estudiantes al registro docente
-- Problema: RLS impide que estudiantes escriban en dimension_grades
-- y module_grades directamente. Los triggers (SECURITY DEFINER)
-- corren con privilegios elevados y saltan el RLS.
-- ============================================================

-- ============================================================
-- TRIGGER 1: eval_quiz_attempts → dimension_grades (SABER)
-- Se activa cuando un estudiante completa un quiz.
-- Normaliza la nota de 0-100% a la escala de SABER (0-30).
-- ============================================================

CREATE OR REPLACE FUNCTION public.sync_quiz_to_dimension_grades()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_section_id BIGINT;
  v_module_id  BIGINT;
  v_score_saber NUMERIC;
BEGIN
  -- Solo actuar cuando el intento se marca como completado (score no null)
  IF NEW.score IS NULL THEN RETURN NEW; END IF;

  -- Obtener section_id desde eval_quizzes
  SELECT eq.section_id INTO v_section_id
  FROM eval_quizzes eq WHERE eq.id = NEW.quiz_id;
  IF v_section_id IS NULL THEN RETURN NEW; END IF;

  -- Obtener module_id recorriendo lesson_sections → lessons
  SELECT l.module_id INTO v_module_id
  FROM lesson_sections ls
  JOIN lessons l ON l.id = ls.lesson_id
  WHERE ls.id = v_section_id;
  IF v_module_id IS NULL THEN RETURN NEW; END IF;

  -- Normalizar nota de porcentaje (0-100) a escala SABER (0-30)
  v_score_saber := ROUND((NEW.score / 100.0) * 30);

  -- Guardar en dimension_grades tomando la MEJOR nota histórica
  INSERT INTO dimension_grades (student_id, section_id, module_id, dimension, score, updated_at, updated_by)
  VALUES (NEW.student_id, v_section_id, v_module_id, 'saber', v_score_saber, now(), NEW.student_id)
  ON CONFLICT (student_id, section_id) DO UPDATE
    SET score      = GREATEST(dimension_grades.score, EXCLUDED.score),
        updated_at = now(),
        updated_by = EXCLUDED.updated_by;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_quiz_to_dimension_grades ON eval_quiz_attempts;
CREATE TRIGGER trg_quiz_to_dimension_grades
  AFTER INSERT OR UPDATE OF score ON eval_quiz_attempts
  FOR EACH ROW
  WHEN (NEW.score IS NOT NULL)
  EXECUTE FUNCTION public.sync_quiz_to_dimension_grades();

-- ============================================================
-- TRIGGER 2: auto_eval_responses → module_grades (auto_ser / auto_decidir)
-- Se activa cuando un estudiante envía su autoevaluación.
-- Copia final_score a la columna correspondiente de module_grades.
-- ============================================================

CREATE OR REPLACE FUNCTION public.sync_auto_eval_to_module_grades()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_module_id BIGINT;
  v_dimension TEXT;
BEGIN
  -- Obtener module_id y dimensión desde auto_eval_activities
  SELECT module_id, dimension INTO v_module_id, v_dimension
  FROM auto_eval_activities WHERE id = NEW.activity_id;
  IF v_module_id IS NULL THEN RETURN NEW; END IF;

  IF v_dimension = 'auto_ser' THEN
    INSERT INTO module_grades (student_id, module_id, auto_ser)
    VALUES (NEW.student_id, v_module_id, NEW.final_score)
    ON CONFLICT (student_id, module_id) DO UPDATE
      SET auto_ser = EXCLUDED.auto_ser;

  ELSIF v_dimension = 'auto_decidir' THEN
    INSERT INTO module_grades (student_id, module_id, auto_decidir)
    VALUES (NEW.student_id, v_module_id, NEW.final_score)
    ON CONFLICT (student_id, module_id) DO UPDATE
      SET auto_decidir = EXCLUDED.auto_decidir;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_eval_to_module_grades ON auto_eval_responses;
CREATE TRIGGER trg_auto_eval_to_module_grades
  AFTER INSERT OR UPDATE ON auto_eval_responses
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_auto_eval_to_module_grades();

-- ============================================================
-- VERIFICACIÓN
-- ============================================================
SELECT trigger_name, event_object_table, action_timing, event_manipulation
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name IN ('trg_quiz_to_dimension_grades', 'trg_auto_eval_to_module_grades')
ORDER BY trigger_name;

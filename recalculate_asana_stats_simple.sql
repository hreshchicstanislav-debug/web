-- Простая функция для пересчета asana_stats на основе текущих данных в asana_tasks
-- 
-- ВАЖНО: Эта функция пересчитывает статистику БЕЗ синхронизации с Asana API
-- Используйте её после ручного исправления данных в asana_tasks
--
-- ИСПОЛЬЗОВАНИЕ:
-- SELECT * FROM recalculate_asana_stats_for_week();  -- для текущей недели
-- SELECT * FROM recalculate_asana_stats_for_week('2025-01-13');  -- для конкретной недели

CREATE OR REPLACE FUNCTION recalculate_asana_stats_for_week(target_date DATE DEFAULT CURRENT_DATE)
RETURNS TABLE (
  week_start_date DATE,
  done_fact_this_week INTEGER,
  to_shoot_qty INTEGER,
  week_load INTEGER,
  plan INTEGER,
  done_qty INTEGER,
  carry_over_from_prev INTEGER,
  on_hand_qty INTEGER,
  warehouse_qty INTEGER,
  shot_not_processed_qty INTEGER,
  q_errors_count INTEGER,
  done_stm_qty INTEGER,
  done_nonstm_qty INTEGER
) AS $$
DECLARE
  week_start DATE;
  week_end DATE;
  prev_week_start DATE;
  done_fact INTEGER;
  to_shoot INTEGER;
  week_load_val INTEGER;
  plan_val INTEGER;
  carry_over INTEGER;
  on_hand INTEGER;
  warehouse INTEGER;
  shot_not_processed INTEGER;
  q_errors INTEGER;
  done_stm INTEGER;
  done_nonstm INTEGER;
  remaining_to_plan INTEGER;
  overtime_qty INTEGER;
BEGIN
  -- Вычисляем начало и конец недели для target_date
  week_start := DATE_TRUNC('week', target_date)::date + INTERVAL '1 day' * (1 - EXTRACT(DOW FROM DATE_TRUNC('week', target_date)::date));
  week_end := week_start + INTERVAL '6 days';
  
  -- Вычисляем начало предыдущей недели
  prev_week_start := week_start - INTERVAL '7 days';
  
  -- 1. done_fact_this_week: сумма q для задач, где q > 0, completed = true, и фактическая неделя = текущая
  -- Фактическая неделя определяется по приоритету: week_processed > week_shot > неделя completed_at
  WITH fact_tasks AS (
    SELECT 
      t.*,
      COALESCE(
        t.week_processed, 
        t.week_shot, 
        CASE 
          WHEN t.completed = true AND t.completed_at IS NOT NULL THEN
            DATE_TRUNC('week', t.completed_at::date)::date + INTERVAL '1 day' * (1 - EXTRACT(DOW FROM DATE_TRUNC('week', t.completed_at::date)::date))
          ELSE NULL
        END
      ) as fact_week
    FROM asana_tasks t
    WHERE t.q > 0 
      AND t.completed = true
      AND (
        t.week_processed = week_start 
        OR t.week_shot = week_start
        OR (t.completed = true AND t.completed_at IS NOT NULL AND 
            DATE_TRUNC('week', t.completed_at::date)::date + INTERVAL '1 day' * (1 - EXTRACT(DOW FROM DATE_TRUNC('week', t.completed_at::date)::date)) = week_start)
      )
  )
  SELECT 
    COALESCE(SUM(q), 0),
    COALESCE(SUM(CASE WHEN task_type_label = 'СТМ' THEN q ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN task_type_label != 'СТМ' OR task_type_label IS NULL THEN q ELSE 0 END), 0)
  INTO done_fact, done_stm, done_nonstm
  FROM fact_tasks
  WHERE fact_week = week_start;
  
  -- 2. to_shoot_qty: сумма q для задач, где due_on в текущей неделе, q > 0, completed != true
  SELECT COALESCE(SUM(q), 0)
  INTO to_shoot
  FROM asana_tasks
  WHERE due_on >= week_start 
    AND due_on <= week_end
    AND q > 0
    AND completed != true;
  
  -- 3. week_load = done_fact_this_week + to_shoot_qty
  week_load_val := done_fact + to_shoot;
  
  -- 4. plan: динамический план (80-100)
  IF week_load_val <= 80 THEN
    plan_val := 80;
  ELSIF week_load_val <= 100 THEN
    plan_val := week_load_val;
  ELSE
    plan_val := 100;
  END IF;
  
  -- 5. carry_over_from_prev: переработка с прошлой недели (overtime_qty из asana_stats)
  SELECT COALESCE(overtime_qty, 0)
  INTO carry_over
  FROM asana_stats
  WHERE week_start_date = prev_week_start
  LIMIT 1;
  
  -- 6. on_hand_qty: сумма q для задач, где product_source = 'PRINESLI', completed != true, shot_at IS NULL, due_on в текущей неделе
  SELECT COALESCE(SUM(q), 0)
  INTO on_hand
  FROM asana_tasks
  WHERE product_source = 'PRINESLI'
    AND completed != true
    AND shot_at IS NULL
    AND due_on >= week_start
    AND due_on <= week_end
    AND q > 0;
  
  -- 7. warehouse_qty: сумма q для задач, где product_source = 'WAREHOUSE', completed != true, shot_at IS NULL, processed_at IS NULL, due_on в текущей неделе
  SELECT COALESCE(SUM(q), 0)
  INTO warehouse
  FROM asana_tasks
  WHERE product_source = 'WAREHOUSE'
    AND completed != true
    AND shot_at IS NULL
    AND processed_at IS NULL
    AND due_on >= week_start
    AND due_on <= week_end
    AND q > 0;
  
  -- 8. shot_not_processed_qty: сумма q для задач, где shot_at заполнено, processed_at IS NULL, completed != true, week_shot = текущая неделя
  SELECT COALESCE(SUM(q), 0)
  INTO shot_not_processed
  FROM asana_tasks
  WHERE shot_at IS NOT NULL
    AND processed_at IS NULL
    AND completed != true
    AND week_shot = week_start
    AND q > 0;
  
  -- 9. q_errors_count: количество задач недели, где q IS NULL или q <= 0
  SELECT COUNT(DISTINCT asana_task_gid)
  INTO q_errors
  FROM asana_tasks
  WHERE (
    due_on >= week_start AND due_on <= week_end
    OR week_shot = week_start
    OR week_processed = week_start
  )
  AND (q IS NULL OR q <= 0);
  
  -- Вычисляем remaining_to_plan и overtime_qty
  remaining_to_plan := GREATEST(0, plan_val - done_fact);
  overtime_qty := GREATEST(0, done_fact - plan_val);
  
  -- Выполняем UPSERT в asana_stats
  INSERT INTO asana_stats (
    week_start_date,
    week_end_date,
    done_fact_this_week,
    to_shoot_qty,
    week_load,
    plan,
    done_qty,
    carry_over_from_prev,
    on_hand_qty,
    warehouse_qty,
    shot_not_processed_qty,
    q_errors_count,
    done_stm_qty,
    done_nonstm_qty,
    remaining_to_plan,
    overtime_qty,
    updated_at
  )
  VALUES (
    week_start,
    week_end,
    done_fact,
    to_shoot,
    week_load_val,
    plan_val,
    done_fact + carry_over, -- done_qty
    carry_over,
    on_hand,
    warehouse,
    shot_not_processed,
    q_errors,
    done_stm,
    done_nonstm,
    remaining_to_plan,
    overtime_qty,
    NOW()
  )
  ON CONFLICT (week_start_date) 
  DO UPDATE SET
    week_end_date = EXCLUDED.week_end_date,
    done_fact_this_week = EXCLUDED.done_fact_this_week,
    to_shoot_qty = EXCLUDED.to_shoot_qty,
    week_load = EXCLUDED.week_load,
    plan = EXCLUDED.plan,
    done_qty = EXCLUDED.done_qty,
    carry_over_from_prev = EXCLUDED.carry_over_from_prev,
    on_hand_qty = EXCLUDED.on_hand_qty,
    warehouse_qty = EXCLUDED.warehouse_qty,
    shot_not_processed_qty = EXCLUDED.shot_not_processed_qty,
    q_errors_count = EXCLUDED.q_errors_count,
    done_stm_qty = EXCLUDED.done_stm_qty,
    done_nonstm_qty = EXCLUDED.done_nonstm_qty,
    remaining_to_plan = EXCLUDED.remaining_to_plan,
    overtime_qty = EXCLUDED.overtime_qty,
    updated_at = EXCLUDED.updated_at;
  
  -- Возвращаем результаты
  RETURN QUERY
  SELECT 
    week_start,
    done_fact,
    to_shoot,
    week_load_val,
    plan_val,
    done_fact + carry_over,
    carry_over,
    on_hand,
    warehouse,
    shot_not_processed,
    q_errors,
    done_stm,
    done_nonstm;
END;
$$ LANGUAGE plpgsql;

-- Комментарий к функции
COMMENT ON FUNCTION recalculate_asana_stats_for_week IS 'Пересчитывает asana_stats для указанной недели на основе текущих данных в asana_tasks. Использование: SELECT * FROM recalculate_asana_stats_for_week(); или SELECT * FROM recalculate_asana_stats_for_week(''2025-01-13'');';


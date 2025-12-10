-- ПРОСТОЕ ИСПРАВЛЕНИЕ: Установить переработку прошлой недели = -23
-- Выполните этот скрипт в Supabase SQL Editor

-- ШАГ 1: Исправляем переработку прошлой недели
WITH current_week AS (
  SELECT DATE_TRUNC('week', CURRENT_DATE)::date + INTERVAL '1 day' * (1 - EXTRACT(DOW FROM DATE_TRUNC('week', CURRENT_DATE)::date)) as week_start
),
prev_week AS (
  SELECT week_start - INTERVAL '7 days' as week_start
  FROM current_week
)
UPDATE asana_stats
SET 
  overtime_qty = -23,  -- ⚠️ Долг прошлой недели
  updated_at = NOW()
FROM prev_week pw
WHERE asana_stats.week_start_date = pw.week_start
RETURNING 
  week_start_date,
  overtime_qty as restored_overtime;

-- ШАГ 2: Обновляем текущую неделю (чтобы она знала о долге прошлой недели)
WITH current_week AS (
  SELECT DATE_TRUNC('week', CURRENT_DATE)::date + INTERVAL '1 day' * (1 - EXTRACT(DOW FROM DATE_TRUNC('week', CURRENT_DATE)::date)) as week_start
)
UPDATE asana_stats
SET 
  carry_over_from_prev = -23,  -- ⚠️ Долг с прошлой недели
  done_qty = done_fact_this_week + (-23),  -- done_qty = факт + долг
  overtime_qty = GREATEST(0, (done_fact_this_week + (-23)) - plan),  -- переработка с учетом долга
  updated_at = NOW()
FROM current_week cw
WHERE asana_stats.week_start_date = cw.week_start
RETURNING 
  week_start_date,
  carry_over_from_prev,
  done_fact_this_week,
  done_qty,
  plan,
  overtime_qty;



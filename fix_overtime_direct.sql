-- Прямое исправление переработки БЕЗ использования функции
-- Используйте этот скрипт, если функция не работает
-- Выполните в Supabase SQL Editor

-- Исправляем overtime_qty для текущей недели с учетом долга
WITH current_week AS (
  SELECT DATE_TRUNC('week', CURRENT_DATE)::date + INTERVAL '1 day' * (1 - EXTRACT(DOW FROM DATE_TRUNC('week', CURRENT_DATE)::date)) as week_start
)
UPDATE asana_stats
SET 
  overtime_qty = GREATEST(0, done_qty - plan),
  updated_at = NOW()
FROM current_week cw
WHERE asana_stats.week_start_date = cw.week_start
RETURNING 
  week_start_date,
  done_fact_this_week as fact,
  carry_over_from_prev as carry_over,
  done_qty as total_done,
  plan,
  overtime_qty as new_overtime,
  GREATEST(0, done_qty - plan) as should_be_overtime;


-- БЫСТРОЕ ВОССТАНОВЛЕНИЕ carry_over_from_prev
-- Инструкция: замените YOUR_VALUE на нужное число (например, 14 или -5)

WITH current_week AS (
  SELECT DATE_TRUNC('week', CURRENT_DATE)::date + INTERVAL '1 day' * (1 - EXTRACT(DOW FROM DATE_TRUNC('week', CURRENT_DATE)::date)) as week_start
)
UPDATE asana_stats
SET 
  carry_over_from_prev = -23,  -- Долг с прошлой недели (отрицательное число)
  done_qty = done_fact_this_week + (-23),  -- done_qty = done_fact + carry_over
  overtime_qty = GREATEST(0, (done_fact_this_week + (-23)) - plan),  -- overtime = max(0, done_qty - plan)
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


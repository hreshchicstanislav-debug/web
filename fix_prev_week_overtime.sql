-- БЫСТРОЕ ИСПРАВЛЕНИЕ переработки прошлой недели
-- Устанавливает overtime_qty = -23 для прошлой недели

WITH current_week AS (
  SELECT DATE_TRUNC('week', CURRENT_DATE)::date + INTERVAL '1 day' * (1 - EXTRACT(DOW FROM DATE_TRUNC('week', CURRENT_DATE)::date)) as week_start
),
prev_week AS (
  SELECT week_start - INTERVAL '7 days' as week_start
  FROM current_week
)
UPDATE asana_stats
SET 
  overtime_qty = -23,  -- Долг прошлой недели
  updated_at = NOW()
FROM prev_week pw
WHERE asana_stats.week_start_date = pw.week_start
RETURNING 
  week_start_date,
  done_fact_this_week,
  plan,
  overtime_qty as restored_overtime,
  updated_at;

-- После этого нужно обновить carry_over_from_prev для текущей недели
-- (чтобы текущая неделя знала о долге прошлой недели)
WITH current_week AS (
  SELECT DATE_TRUNC('week', CURRENT_DATE)::date + INTERVAL '1 day' * (1 - EXTRACT(DOW FROM DATE_TRUNC('week', CURRENT_DATE)::date)) as week_start
),
prev_week AS (
  SELECT week_start - INTERVAL '7 days' as week_start
  FROM current_week
),
prev_stats AS (
  SELECT s.overtime_qty
  FROM asana_stats s, prev_week pw
  WHERE s.week_start_date = pw.week_start
  LIMIT 1
)
UPDATE asana_stats
SET 
  carry_over_from_prev = COALESCE((SELECT overtime_qty FROM prev_stats), -23),
  done_qty = done_fact_this_week + COALESCE((SELECT overtime_qty FROM prev_stats), -23),
  overtime_qty = GREATEST(0, (done_fact_this_week + COALESCE((SELECT overtime_qty FROM prev_stats), -23)) - plan),
  updated_at = NOW()
FROM current_week cw
WHERE asana_stats.week_start_date = cw.week_start
RETURNING 
  week_start_date,
  carry_over_from_prev,
  done_fact_this_week,
  done_qty,
  plan,
  overtime_qty,
  updated_at;


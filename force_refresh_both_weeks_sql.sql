-- SQL-скрипт для принудительного пересчета прошлой и текущей недель
-- Выполните в Supabase SQL Editor

-- ============================================
-- 1. Пересчет прошлой недели
-- ============================================
WITH current_week AS (
  SELECT DATE_TRUNC('week', CURRENT_DATE)::date + INTERVAL '1 day' * (1 - EXTRACT(DOW FROM DATE_TRUNC('week', CURRENT_DATE)::date)) as week_start
),
prev_week AS (
  SELECT week_start - INTERVAL '7 days' as week_start
  FROM current_week
)
SELECT 
  'Пересчет прошлой недели' as action,
  pw.week_start as week_start_date,
  recalculate_asana_stats_for_week(pw.week_start) as result
FROM prev_week pw;

-- ============================================
-- 2. Пересчет текущей недели
-- ============================================
WITH current_week AS (
  SELECT DATE_TRUNC('week', CURRENT_DATE)::date + INTERVAL '1 day' * (1 - EXTRACT(DOW FROM DATE_TRUNC('week', CURRENT_DATE)::date)) as week_start
)
SELECT 
  'Пересчет текущей недели' as action,
  cw.week_start as week_start_date,
  recalculate_asana_stats_for_week(cw.week_start) as result
FROM current_week cw;

-- ============================================
-- 3. Проверка результатов
-- ============================================
WITH current_week AS (
  SELECT DATE_TRUNC('week', CURRENT_DATE)::date + INTERVAL '1 day' * (1 - EXTRACT(DOW FROM DATE_TRUNC('week', CURRENT_DATE)::date)) as week_start
),
prev_week AS (
  SELECT week_start - INTERVAL '7 days' as week_start
  FROM current_week
)
SELECT 
  'Прошлая неделя' as period,
  s.week_start_date,
  s.done_fact_this_week,
  s.carry_over_from_prev,
  s.done_qty,
  s.plan,
  s.overtime_qty,
  s.updated_at
FROM asana_stats s, prev_week pw
WHERE s.week_start_date = pw.week_start
UNION ALL
SELECT 
  'Текущая неделя' as period,
  s.week_start_date,
  s.done_fact_this_week,
  s.carry_over_from_prev,
  s.done_qty,
  s.plan,
  s.overtime_qty,
  s.updated_at
FROM asana_stats s, current_week cw
WHERE s.week_start_date = cw.week_start
ORDER BY period DESC, updated_at DESC;


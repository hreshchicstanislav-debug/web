-- Скрипт для восстановления carry_over_from_prev (переработка с прошлой недели)
-- Выполните в Supabase SQL Editor

-- ============================================
-- 1. Проверка текущего состояния
-- ============================================
WITH current_week AS (
  SELECT DATE_TRUNC('week', CURRENT_DATE)::date + INTERVAL '1 day' * (1 - EXTRACT(DOW FROM DATE_TRUNC('week', CURRENT_DATE)::date)) as week_start
),
prev_week AS (
  SELECT week_start - INTERVAL '7 days' as week_start
  FROM current_week
)
SELECT 
  'Текущая неделя' as period,
  s.week_start_date,
  s.carry_over_from_prev as current_carry_over,
  s.done_fact_this_week,
  s.done_qty,
  s.plan,
  s.overtime_qty
FROM asana_stats s, current_week cw
WHERE s.week_start_date = cw.week_start
ORDER BY s.updated_at DESC
LIMIT 1;

-- ============================================
-- 2. Проверка прошлой недели (откуда брать значение)
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
  s.overtime_qty as should_be_carry_over,
  s.done_fact_this_week,
  s.plan,
  s.overtime_qty
FROM asana_stats s, prev_week pw
WHERE s.week_start_date = pw.week_start
ORDER BY s.updated_at DESC
LIMIT 1;

-- ============================================
-- 3. ВАРИАНТ А: Автоматическое восстановление из overtime_qty прошлой недели
-- ============================================
-- Раскомментируйте и выполните, если хотите автоматически восстановить из прошлой недели
/*
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
  ORDER BY s.updated_at DESC
  LIMIT 1
)
UPDATE asana_stats
SET 
  carry_over_from_prev = COALESCE((SELECT overtime_qty FROM prev_stats), 0),
  updated_at = NOW()
FROM current_week cw
WHERE asana_stats.week_start_date = cw.week_start
RETURNING 
  week_start_date,
  carry_over_from_prev as restored_value,
  done_fact_this_week,
  done_qty,
  plan;
*/

-- ============================================
-- 4. ВАРИАНТ Б: Вручную ввести число
-- ============================================
-- Раскомментируйте и замените YOUR_VALUE на нужное число (например, 14)
/*
WITH current_week AS (
  SELECT DATE_TRUNC('week', CURRENT_DATE)::date + INTERVAL '1 day' * (1 - EXTRACT(DOW FROM DATE_TRUNC('week', CURRENT_DATE)::date)) as week_start
)
UPDATE asana_stats
SET 
  carry_over_from_prev = YOUR_VALUE,  -- ЗАМЕНИТЕ YOUR_VALUE на нужное число
  updated_at = NOW()
FROM current_week cw
WHERE asana_stats.week_start_date = cw.week_start
RETURNING 
  week_start_date,
  carry_over_from_prev as restored_value,
  done_fact_this_week,
  done_qty,
  plan;
*/

-- ============================================
-- 5. После восстановления - пересчитать done_qty и overtime_qty
-- ============================================
-- После обновления carry_over_from_prev нужно пересчитать done_qty и overtime_qty
-- Раскомментируйте и выполните:
/*
WITH current_week AS (
  SELECT DATE_TRUNC('week', CURRENT_DATE)::date + INTERVAL '1 day' * (1 - EXTRACT(DOW FROM DATE_TRUNC('week', CURRENT_DATE)::date)) as week_start
)
UPDATE asana_stats
SET 
  done_qty = done_fact_this_week + carry_over_from_prev,
  overtime_qty = GREATEST(0, (done_fact_this_week + carry_over_from_prev) - plan),
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
*/


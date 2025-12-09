-- Скрипт для исправления переработки в текущей неделе
-- Выполните этот скрипт в Supabase SQL Editor

-- ============================================
-- ШАГ 1: Убедитесь, что функция обновлена
-- ============================================
-- Сначала выполните recalculate_asana_stats_simple.sql, если функция не существует или старая

-- ============================================
-- ШАГ 2: Пересчитайте статистику для текущей недели
-- ============================================
-- Это автоматически исправит overtime_qty с учетом долга
SELECT * FROM recalculate_asana_stats_for_week();

-- ============================================
-- ШАГ 3: Проверка результата
-- ============================================
WITH current_week AS (
  SELECT DATE_TRUNC('week', CURRENT_DATE)::date + INTERVAL '1 day' * (1 - EXTRACT(DOW FROM DATE_TRUNC('week', CURRENT_DATE)::date)) as week_start
)
SELECT 
  'После исправления' as status,
  s.week_start_date,
  s.done_fact_this_week as fact,
  s.carry_over_from_prev as carry_over,
  s.done_qty as total_done,
  s.plan,
  s.overtime_qty as overtime,
  GREATEST(0, s.done_qty - s.plan) as should_be_overtime,
  CASE 
    WHEN s.overtime_qty = GREATEST(0, s.done_qty - s.plan) THEN '✅ Исправлено'
    ELSE '❌ Все еще неправильно'
  END as check_result
FROM asana_stats s
CROSS JOIN current_week cw
WHERE s.week_start_date = cw.week_start
ORDER BY s.updated_at DESC
LIMIT 1;

-- ============================================
-- АЛЬТЕРНАТИВА: Прямое исправление (если функция не работает)
-- ============================================
-- Раскомментируйте и выполните, если функция не работает:
/*
WITH current_week AS (
  SELECT DATE_TRUNC('week', CURRENT_DATE)::date + INTERVAL '1 day' * (1 - EXTRACT(DOW FROM DATE_TRUNC('week', CURRENT_DATE)::date)) as week_start
)
UPDATE asana_stats s
SET 
  overtime_qty = GREATEST(0, s.done_qty - s.plan),
  updated_at = NOW()
FROM current_week cw
WHERE s.week_start_date = cw.week_start
RETURNING 
  s.week_start_date,
  s.done_fact_this_week,
  s.carry_over_from_prev,
  s.done_qty,
  s.plan,
  s.overtime_qty as new_overtime;
*/


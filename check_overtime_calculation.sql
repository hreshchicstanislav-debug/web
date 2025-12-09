-- Скрипт для проверки текущего расчета переработки в Supabase
-- Выполните этот скрипт в Supabase SQL Editor, чтобы проверить:
-- 1. Как сейчас считается переработка
-- 2. Есть ли функция recalculate_asana_stats_for_week
-- 3. Текущие значения в asana_stats

-- ============================================
-- 1. Проверка существования функции
-- ============================================
SELECT 
  'Проверка функции' as check_type,
  CASE 
    WHEN EXISTS (
      SELECT 1 
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public' 
      AND p.proname = 'recalculate_asana_stats_for_week'
    ) THEN '✅ Функция существует'
    ELSE '❌ Функция НЕ найдена'
  END as status;

-- ============================================
-- 2. Проверка текущих значений в asana_stats для текущей недели
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
  s.done_fact_this_week,
  s.carry_over_from_prev,
  s.done_qty,
  s.plan,
  s.overtime_qty as current_overtime,
  -- Как ДОЛЖНА считаться переработка (с учетом долга)
  GREATEST(0, s.done_qty - s.plan) as correct_overtime,
  -- Как сейчас считается (без учета долга) - для сравнения
  GREATEST(0, s.done_fact_this_week - s.plan) as wrong_overtime,
  -- Разница
  s.overtime_qty - GREATEST(0, s.done_qty - s.plan) as difference,
  s.updated_at
FROM asana_stats s, current_week cw
WHERE s.week_start_date = cw.week_start
ORDER BY s.updated_at DESC
LIMIT 1;

-- ============================================
-- 3. Проверка прошлой недели (для понимания carry_over_from_prev)
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
  s.done_qty,
  s.plan,
  s.overtime_qty,
  -- Этот overtime_qty должен быть carry_over_from_prev для текущей недели
  s.overtime_qty as should_be_carry_over,
  s.updated_at
FROM asana_stats s, prev_week pw
WHERE s.week_start_date = pw.week_start
ORDER BY s.updated_at DESC
LIMIT 1;

-- ============================================
-- 4. Детальный анализ: почему переработка неправильная
-- ============================================
WITH current_week AS (
  SELECT DATE_TRUNC('week', CURRENT_DATE)::date + INTERVAL '1 day' * (1 - EXTRACT(DOW FROM DATE_TRUNC('week', CURRENT_DATE)::date)) as week_start
),
prev_week AS (
  SELECT week_start - INTERVAL '7 days' as week_start
  FROM current_week
)
SELECT 
  'Анализ расчета' as analysis,
  s.week_start_date,
  s.done_fact_this_week as fact,
  s.carry_over_from_prev as carry_over,
  s.done_qty as total_done,
  s.plan,
  -- Текущая формула (неправильная)
  GREATEST(0, s.done_fact_this_week - s.plan) as wrong_formula,
  -- Правильная формула (с учетом долга)
  GREATEST(0, s.done_qty - s.plan) as correct_formula,
  -- Текущее значение в БД
  s.overtime_qty as current_value,
  -- Нужно ли исправить?
  CASE 
    WHEN s.overtime_qty != GREATEST(0, s.done_qty - s.plan) THEN '⚠️ НУЖНО ИСПРАВИТЬ'
    ELSE '✅ Правильно'
  END as needs_fix
FROM asana_stats s, current_week cw
WHERE s.week_start_date = cw.week_start
ORDER BY s.updated_at DESC
LIMIT 1;

-- ============================================
-- 5. Проверка формулы в функции (если она существует)
-- ============================================
SELECT 
  'Формула в функции' as check_type,
  pg_get_functiondef(p.oid) as function_definition
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
AND p.proname = 'recalculate_asana_stats_for_week'
LIMIT 1;


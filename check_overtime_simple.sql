-- Простой скрипт для проверки расчета переработки
-- Выполните по частям, если возникают ошибки

-- 1. Проверка существования функции
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public' 
      AND p.proname = 'recalculate_asana_stats_for_week'
    ) THEN 'Функция существует'
    ELSE 'Функция НЕ найдена'
  END as function_status;

-- 2. Текущие значения для текущей недели
WITH current_week AS (
  SELECT DATE_TRUNC('week', CURRENT_DATE)::date + INTERVAL '1 day' * (1 - EXTRACT(DOW FROM DATE_TRUNC('week', CURRENT_DATE)::date)) as week_start
)
SELECT 
  s.week_start_date,
  s.done_fact_this_week,
  s.carry_over_from_prev,
  s.done_qty,
  s.plan,
  s.overtime_qty as current_overtime,
  GREATEST(0, s.done_qty - s.plan) as correct_overtime,
  GREATEST(0, s.done_fact_this_week - s.plan) as wrong_overtime,
  s.overtime_qty - GREATEST(0, s.done_qty - s.plan) as difference
FROM asana_stats s
CROSS JOIN current_week cw
WHERE s.week_start_date = cw.week_start
ORDER BY s.updated_at DESC
LIMIT 1;


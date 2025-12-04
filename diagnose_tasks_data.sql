-- Диагностика данных задач для понимания, почему не пересчитываются показатели
-- 
-- Проверяем задачи, которые должны попадать в "Уже на руках" и "Сфоткано, но не обработано"

-- 1. Проверяем задачи, которые попадают в "Уже на руках" (on_hand_qty)
-- Должны быть: product_source = 'PRINESLI', completed = false, shot_at IS NULL, due_on в текущей неделе
WITH current_week AS (
  SELECT DATE_TRUNC('week', CURRENT_DATE)::date + INTERVAL '1 day' * (1 - EXTRACT(DOW FROM DATE_TRUNC('week', CURRENT_DATE)::date)) as week_start,
         DATE_TRUNC('week', CURRENT_DATE)::date + INTERVAL '1 day' * (6 - EXTRACT(DOW FROM DATE_TRUNC('week', CURRENT_DATE)::date)) as week_end
)
SELECT 
  'Уже на руках (должны быть)' as category,
  COUNT(*) as task_count,
  COALESCE(SUM(q), 0) as total_q
FROM asana_tasks, current_week
WHERE product_source = 'PRINESLI'
  AND completed = false
  AND shot_at IS NULL
  AND due_on >= current_week.week_start
  AND due_on <= current_week.week_end
  AND q > 0;

-- 2. Проверяем задачи, которые НЕ должны попадать в "Уже на руках" (но могут попадать по старой логике)
-- Это задачи с shot_at заполнено, но которые могут считаться в on_hand_qty по старой логике
WITH current_week AS (
  SELECT DATE_TRUNC('week', CURRENT_DATE)::date + INTERVAL '1 day' * (1 - EXTRACT(DOW FROM DATE_TRUNC('week', CURRENT_DATE)::date)) as week_start,
         DATE_TRUNC('week', CURRENT_DATE)::date + INTERVAL '1 day' * (6 - EXTRACT(DOW FROM DATE_TRUNC('week', CURRENT_DATE)::date)) as week_end
)
SELECT 
  'НЕ должны быть в "Уже на руках" (shot_at заполнено)' as category,
  COUNT(*) as task_count,
  COALESCE(SUM(q), 0) as total_q
FROM asana_tasks, current_week
WHERE product_source = 'PRINESLI'
  AND completed = false
  AND shot_at IS NOT NULL  -- Товар сфотографирован
  AND due_on >= current_week.week_start
  AND due_on <= current_week.week_end
  AND q > 0;

-- 3. Проверяем задачи, которые попадают в "Сфоткано, но не обработано" (shot_not_processed_qty)
-- Должны быть: shot_at заполнено, processed_at IS NULL, completed = false, week_shot = текущая неделя
WITH current_week AS (
  SELECT DATE_TRUNC('week', CURRENT_DATE)::date + INTERVAL '1 day' * (1 - EXTRACT(DOW FROM DATE_TRUNC('week', CURRENT_DATE)::date)) as week_start
)
SELECT 
  'Сфоткано, но не обработано' as category,
  COUNT(*) as task_count,
  COALESCE(SUM(q), 0) as total_q
FROM asana_tasks, current_week
WHERE shot_at IS NOT NULL
  AND processed_at IS NULL
  AND completed = false
  AND week_shot = current_week.week_start
  AND q > 0;

-- 4. Детальный список задач, которые могут неправильно считаться в "Уже на руках"
-- (имеют shot_at, но по старой логике могут попадать в on_hand_qty)
WITH current_week AS (
  SELECT DATE_TRUNC('week', CURRENT_DATE)::date + INTERVAL '1 day' * (1 - EXTRACT(DOW FROM DATE_TRUNC('week', CURRENT_DATE)::date)) as week_start,
         DATE_TRUNC('week', CURRENT_DATE)::date + INTERVAL '1 day' * (6 - EXTRACT(DOW FROM DATE_TRUNC('week', CURRENT_DATE)::date)) as week_end
)
SELECT 
  task_name,
  q,
  product_source,
  shot_at,
  processed_at,
  completed,
  due_on,
  week_shot,
  week_processed,
  updated_at,
  CASE 
    WHEN shot_at IS NOT NULL THEN '❌ НЕ должна быть в "Уже на руках" (сфотографирована)'
    ELSE '✅ Должна быть в "Уже на руках"'
  END as status
FROM asana_tasks, current_week
WHERE product_source = 'PRINESLI'
  AND completed = false
  AND due_on >= current_week.week_start
  AND due_on <= current_week.week_end
  AND q > 0
ORDER BY shot_at DESC NULLS LAST, updated_at DESC
LIMIT 20;

-- 5. Проверяем текущую статистику в asana_stats
SELECT 
  week_start_date,
  on_hand_qty,
  shot_not_processed_qty,
  done_fact_this_week,
  done_qty,
  updated_at
FROM asana_stats
WHERE week_start_date = (
  SELECT DATE_TRUNC('week', CURRENT_DATE)::date + INTERVAL '1 day' * (1 - EXTRACT(DOW FROM DATE_TRUNC('week', CURRENT_DATE)::date))
)
ORDER BY updated_at DESC
LIMIT 1;


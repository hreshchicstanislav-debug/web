-- Проверка разницы между "Сфоткано, но не обработано" и "Предстоит отснять"
-- Выполните этот скрипт в Supabase SQL Editor

WITH current_week AS (
  SELECT 
    DATE_TRUNC('week', CURRENT_DATE)::date + INTERVAL '1 day' * (1 - EXTRACT(DOW FROM DATE_TRUNC('week', CURRENT_DATE)::date)) as week_start,
    DATE_TRUNC('week', CURRENT_DATE)::date + INTERVAL '1 day' * (6 - EXTRACT(DOW FROM DATE_TRUNC('week', CURRENT_DATE)::date)) as week_end
)
-- 1. "Предстоит отснять" (to_shoot_qty)
-- Задачи с дедлайном в текущей неделе, которые ещё не завершены
SELECT 
  '1. Предстоит отснять (to_shoot_qty)' as category,
  COUNT(*) as task_count,
  COALESCE(SUM(q), 0) as total_q,
  'Неделя определяется по due_on (плановый дедлайн)' as note
FROM asana_tasks, current_week
WHERE due_on >= current_week.week_start 
  AND due_on <= current_week.week_end
  AND q > 0
  AND completed != true

UNION ALL

-- 2. "Сфоткано, но не обработано" (shot_not_processed_qty)
-- Задачи, которые сфотографированы на этой неделе, но ещё не обработаны
SELECT 
  '2. Сфоткано, но не обработано (shot_not_processed_qty)' as category,
  COUNT(*) as task_count,
  COALESCE(SUM(q), 0) as total_q,
  'Неделя определяется по week_shot (фактическая дата съёмки)' as note
FROM asana_tasks, current_week
WHERE week_shot = current_week.week_start
  AND shot_at IS NOT NULL
  AND processed_at IS NULL
  AND completed != true
  AND q > 0

UNION ALL

-- 3. Пересечение: задачи, которые попадают в ОБА показателя
-- (сфотканы на этой неделе И имеют дедлайн в этой неделе)
SELECT 
  '3. ПЕРЕСЕЧЕНИЕ (попадают в оба показателя)' as category,
  COUNT(*) as task_count,
  COALESCE(SUM(q), 0) as total_q,
  'Задачи, которые сфотканы на этой неделе И имеют дедлайн в этой неделе' as note
FROM asana_tasks, current_week
WHERE due_on >= current_week.week_start 
  AND due_on <= current_week.week_end
  AND week_shot = current_week.week_start
  AND shot_at IS NOT NULL
  AND processed_at IS NULL
  AND completed != true
  AND q > 0

UNION ALL

-- 4. Только в "Предстоит отснять" (не сфотканы на этой неделе)
SELECT 
  '4. Только в "Предстоит отснять" (не сфотканы на этой неделе)' as category,
  COUNT(*) as task_count,
  COALESCE(SUM(q), 0) as total_q,
  'Задачи с дедлайном в этой неделе, но НЕ сфотканы на этой неделе' as note
FROM asana_tasks, current_week
WHERE due_on >= current_week.week_start 
  AND due_on <= current_week.week_end
  AND q > 0
  AND completed != true
  AND (
    week_shot IS NULL 
    OR week_shot != current_week.week_start
    OR shot_at IS NULL
  )

UNION ALL

-- 5. Только в "Сфоткано, но не обработано" (дедлайн не в этой неделе)
SELECT 
  '5. Только в "Сфоткано, но не обработано" (дедлайн не в этой неделе)' as category,
  COUNT(*) as task_count,
  COALESCE(SUM(q), 0) as total_q,
  'Задачи, сфотканы на этой неделе, но дедлайн НЕ в этой неделе' as note
FROM asana_tasks, current_week
WHERE week_shot = current_week.week_start
  AND shot_at IS NOT NULL
  AND processed_at IS NULL
  AND completed != true
  AND q > 0
  AND (
    due_on < current_week.week_start 
    OR due_on > current_week.week_end
    OR due_on IS NULL
  );

-- Детальный список задач из пересечения
SELECT 
  'ДЕТАЛЬНЫЙ СПИСОК: Задачи из пересечения' as info,
  task_name,
  q,
  due_on,
  shot_at,
  processed_at,
  week_shot,
  completed,
  product_source
FROM asana_tasks, (
  SELECT 
    DATE_TRUNC('week', CURRENT_DATE)::date + INTERVAL '1 day' * (1 - EXTRACT(DOW FROM DATE_TRUNC('week', CURRENT_DATE)::date)) as week_start,
    DATE_TRUNC('week', CURRENT_DATE)::date + INTERVAL '1 day' * (6 - EXTRACT(DOW FROM DATE_TRUNC('week', CURRENT_DATE)::date)) as week_end
) as current_week
WHERE due_on >= current_week.week_start 
  AND due_on <= current_week.week_end
  AND week_shot = current_week.week_start
  AND shot_at IS NOT NULL
  AND processed_at IS NULL
  AND completed != true
  AND q > 0
ORDER BY due_on, task_name;


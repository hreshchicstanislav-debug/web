-- Проверка предложенной логики показателей
-- Выполните этот скрипт в Supabase SQL Editor

WITH current_week AS (
  SELECT 
    DATE_TRUNC('week', CURRENT_DATE)::date + INTERVAL '1 day' * (1 - EXTRACT(DOW FROM DATE_TRUNC('week', CURRENT_DATE)::date)) as week_start,
    DATE_TRUNC('week', CURRENT_DATE)::date + INTERVAL '1 day' * (6 - EXTRACT(DOW FROM DATE_TRUNC('week', CURRENT_DATE)::date)) as week_end
)

-- ТЕКУЩАЯ ЛОГИКА

-- 1. "Предстоит отснять" (to_shoot_qty) - ТЕКУЩАЯ
SELECT 
  'ТЕКУЩАЯ: Предстоит отснять (to_shoot_qty)' as category,
  COUNT(*) as task_count,
  COALESCE(SUM(q), 0) as total_q,
  'due_on в текущей неделе, completed != true' as logic
FROM asana_tasks, current_week
WHERE due_on >= current_week.week_start 
  AND due_on <= current_week.week_end
  AND q > 0
  AND completed != true

UNION ALL

-- 2. "Сфоткано, но не обработано" (shot_not_processed_qty) - ТЕКУЩАЯ
SELECT 
  'ТЕКУЩАЯ: Сфоткано, но не обработано (shot_not_processed_qty)' as category,
  COUNT(*) as task_count,
  COALESCE(SUM(q), 0) as total_q,
  'week_shot = текущая неделя, shot_at IS NOT NULL, processed_at IS NULL' as logic
FROM asana_tasks, current_week
WHERE week_shot = current_week.week_start
  AND shot_at IS NOT NULL
  AND processed_at IS NULL
  AND completed != true
  AND q > 0

UNION ALL

-- ПРЕДЛАГАЕМАЯ ЛОГИКА

-- 3. "Предстоит обработать (на этой неделе)" - ПРЕДЛАГАЕМАЯ
SELECT 
  'ПРЕДЛАГАЕМАЯ: Предстоит обработать (на этой неделе)' as category,
  COUNT(*) as task_count,
  COALESCE(SUM(q), 0) as total_q,
  'due_on в текущей неделе, processed_at IS NULL, completed != true' as logic
FROM asana_tasks, current_week
WHERE due_on >= current_week.week_start 
  AND due_on <= current_week.week_end
  AND processed_at IS NULL
  AND completed != true
  AND q > 0

UNION ALL

-- 4. "Сфоткано, но не обработано" (накопительный) - ПРЕДЛАГАЕМАЯ
SELECT 
  'ПРЕДЛАГАЕМАЯ: Сфоткано, но не обработано (накопительный)' as category,
  COUNT(*) as task_count,
  COALESCE(SUM(q), 0) as total_q,
  'shot_at IS NOT NULL, processed_at IS NULL, due_on НЕ в текущей неделе' as logic
FROM asana_tasks, current_week
WHERE shot_at IS NOT NULL
  AND processed_at IS NULL
  AND completed != true
  AND q > 0
  AND (
    due_on < current_week.week_start 
    OR due_on > current_week.week_end
    OR due_on IS NULL
  )

UNION ALL

-- АНАЛИЗ: Задачи, которые попадают в текущую логику, но не в предлагаемую

-- 5. Задачи в "Предстоит отснять" (текущая), но НЕ в "Предстоит обработать" (предлагаемая)
-- Это задачи с дедлайном в текущей неделе, которые УЖЕ обработаны, но не закрыты
SELECT 
  'АНАЛИЗ: В текущей "Предстоит отснять", но НЕ в предлагаемой "Предстоит обработать"' as category,
  COUNT(*) as task_count,
  COALESCE(SUM(q), 0) as total_q,
  'due_on в текущей неделе, processed_at IS NOT NULL, completed != true' as logic
FROM asana_tasks, current_week
WHERE due_on >= current_week.week_start 
  AND due_on <= current_week.week_end
  AND processed_at IS NOT NULL
  AND completed != true
  AND q > 0

UNION ALL

-- 6. Задачи в предлагаемой "Сфоткано, но не обработано" (накопительный), но НЕ в текущей
-- Это задачи, сфотканные НЕ на этой неделе, но не обработанные
SELECT 
  'АНАЛИЗ: В предлагаемой "Сфоткано, но не обработано" (накопительный), но НЕ в текущей' as category,
  COUNT(*) as task_count,
  COALESCE(SUM(q), 0) as total_q,
  'shot_at IS NOT NULL, week_shot != текущая неделя, processed_at IS NULL, due_on НЕ в текущей неделе' as logic
FROM asana_tasks, current_week
WHERE shot_at IS NOT NULL
  AND (week_shot IS NULL OR week_shot != current_week.week_start)
  AND processed_at IS NULL
  AND completed != true
  AND q > 0
  AND (
    due_on < current_week.week_start 
    OR due_on > current_week.week_end
    OR due_on IS NULL
  )

UNION ALL

-- 7. Пересечение: задачи, которые попадают в оба показателя (текущая логика)
SELECT 
  'ПЕРЕСЕЧЕНИЕ (текущая): В обоих показателях одновременно' as category,
  COUNT(*) as task_count,
  COALESCE(SUM(q), 0) as total_q,
  'due_on в текущей неделе И week_shot = текущая неделя, processed_at IS NULL' as logic
FROM asana_tasks, current_week
WHERE due_on >= current_week.week_start 
  AND due_on <= current_week.week_end
  AND week_shot = current_week.week_start
  AND shot_at IS NOT NULL
  AND processed_at IS NULL
  AND completed != true
  AND q > 0

UNION ALL

-- 8. Пересечение: задачи, которые попадают в оба показателя (предлагаемая логика)
-- Должно быть 0, так как они разделены по due_on
SELECT 
  'ПЕРЕСЕЧЕНИЕ (предлагаемая): В обоих показателях одновременно' as category,
  COUNT(*) as task_count,
  COALESCE(SUM(q), 0) as total_q,
  'Должно быть 0 (разделены по due_on)' as logic
FROM asana_tasks, current_week
WHERE due_on >= current_week.week_start 
  AND due_on <= current_week.week_end
  AND shot_at IS NOT NULL
  AND processed_at IS NULL
  AND completed != true
  AND q > 0
  AND (
    due_on < current_week.week_start 
    OR due_on > current_week.week_end
    OR due_on IS NULL
  );

-- ДЕТАЛЬНЫЙ СПИСОК: Задачи, которые попадают в предлагаемую "Сфоткано, но не обработано" (накопительный)
-- Это задачи, сфотканные давно, но не обработанные (ваш сценарий)
SELECT 
  'ДЕТАЛЬНЫЙ СПИСОК: Сфоткано давно, но не обработано (накопительный долг)' as info,
  task_name,
  q,
  due_on,
  shot_at,
  processed_at,
  week_shot,
  completed,
  CASE 
    WHEN due_on >= (SELECT week_start FROM current_week) AND due_on <= (SELECT week_end FROM current_week) 
    THEN 'В текущей неделе'
    ELSE 'НЕ в текущей неделе'
  END as due_on_status
FROM asana_tasks, current_week
WHERE shot_at IS NOT NULL
  AND processed_at IS NULL
  AND completed != true
  AND q > 0
  AND (
    due_on < current_week.week_start 
    OR due_on > current_week.week_end
    OR due_on IS NULL
  )
ORDER BY shot_at ASC, due_on ASC;


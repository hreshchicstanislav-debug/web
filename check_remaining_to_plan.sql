-- Проверка данных для расчета "до выполнения плана"
-- Выполните этот скрипт в Supabase SQL Editor

-- 1. Проверяем текущую неделю и данные в asana_stats
SELECT 
  week_start_date,
  week_end_date,
  plan,
  done_fact_this_week,
  remaining_to_plan,
  -- Ручной расчет для проверки
  GREATEST(0, plan - done_fact_this_week) as calculated_remaining_to_plan,
  -- Разница между сохраненным и рассчитанным значением
  remaining_to_plan - GREATEST(0, plan - done_fact_this_week) as difference,
  done_qty,
  carry_over_from_prev,
  overtime_qty,
  to_shoot_qty,
  week_load,
  updated_at
FROM asana_stats
WHERE week_start_date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY week_start_date DESC
LIMIT 5;

-- 2. Проверяем задачи текущей недели для расчета done_fact_this_week
SELECT 
  'Задачи с week_processed = текущая неделя' as category,
  COUNT(*) as task_count,
  COALESCE(SUM(q), 0) as total_q
FROM asana_tasks
WHERE week_processed = (
  SELECT week_start_date 
  FROM asana_stats 
  WHERE week_start_date >= CURRENT_DATE - INTERVAL '7 days'
  ORDER BY week_start_date DESC 
  LIMIT 1
)
AND completed = true
AND q > 0

UNION ALL

SELECT 
  'Задачи с week_shot = текущая неделя (если нет week_processed)' as category,
  COUNT(*) as task_count,
  COALESCE(SUM(q), 0) as total_q
FROM asana_tasks
WHERE week_shot = (
  SELECT week_start_date 
  FROM asana_stats 
  WHERE week_start_date >= CURRENT_DATE - INTERVAL '7 days'
  ORDER BY week_start_date DESC 
  LIMIT 1
)
AND week_processed IS NULL
AND completed = true
AND q > 0

UNION ALL

SELECT 
  'Задачи с completed_at в текущей неделе (если нет week_shot и week_processed)' as category,
  COUNT(*) as task_count,
  COALESCE(SUM(q), 0) as total_q
FROM asana_tasks
WHERE DATE_TRUNC('week', completed_at::date) = (
  SELECT week_start_date 
  FROM asana_stats 
  WHERE week_start_date >= CURRENT_DATE - INTERVAL '7 days'
  ORDER BY week_start_date DESC 
  LIMIT 1
)
AND week_processed IS NULL
AND week_shot IS NULL
AND completed = true
AND q > 0;

-- 3. Детальная проверка: какие задачи учитываются в done_fact_this_week
SELECT 
  asana_task_gid,
  task_name,
  q,
  completed,
  completed_at,
  shot_at,
  processed_at,
  week_shot,
  week_processed,
  due_on,
  -- Определяем фактическую неделю
  CASE 
    WHEN week_processed IS NOT NULL THEN week_processed
    WHEN week_shot IS NOT NULL THEN week_shot
    WHEN completed_at IS NOT NULL THEN DATE_TRUNC('week', completed_at::date)::date
    ELSE NULL
  END as fact_week
FROM asana_tasks
WHERE (
  week_processed = (
    SELECT week_start_date 
    FROM asana_stats 
    WHERE week_start_date >= CURRENT_DATE - INTERVAL '7 days'
    ORDER BY week_start_date DESC 
    LIMIT 1
  )
  OR week_shot = (
    SELECT week_start_date 
    FROM asana_stats 
    WHERE week_start_date >= CURRENT_DATE - INTERVAL '7 days'
    ORDER BY week_start_date DESC 
    LIMIT 1
  )
  OR (completed_at IS NOT NULL AND DATE_TRUNC('week', completed_at::date)::date = (
    SELECT week_start_date 
    FROM asana_stats 
    WHERE week_start_date >= CURRENT_DATE - INTERVAL '7 days'
    ORDER BY week_start_date DESC 
    LIMIT 1
  ))
)
AND completed = true
AND q > 0
ORDER BY processed_at DESC, shot_at DESC, completed_at DESC;


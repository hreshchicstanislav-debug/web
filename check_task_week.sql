-- Проверка задачи "слойка_круассан_макароны_4_СТМ" на попадание в факт выполненных задач текущей недели
-- 
-- Условия для попадания в done_fact_this_week:
-- 1. q > 0
-- 2. completed = true
-- 3. Неделя по приоритету (processed_at -> shot_at -> completed_at) должна совпадать с текущей неделей

-- Находим задачу
SELECT 
  task_name,
  q,
  completed,
  completed_at,
  shot_at,
  processed_at,
  week_shot,
  week_processed,
  week_start_date,
  due_on,
  -- Определяем фактическую неделю по приоритету
  COALESCE(week_processed, week_shot, 
    CASE 
      WHEN completed = true AND completed_at IS NOT NULL 
      THEN DATE_TRUNC('week', completed_at::date)::date + INTERVAL '1 day' * (1 - EXTRACT(DOW FROM DATE_TRUNC('week', completed_at::date)::date))
      ELSE NULL 
    END
  ) as fact_week,
  -- Текущая неделя (понедельник текущей недели)
  DATE_TRUNC('week', CURRENT_DATE)::date + INTERVAL '1 day' * (1 - EXTRACT(DOW FROM DATE_TRUNC('week', CURRENT_DATE)::date)) as current_week_start,
  -- Проверка условий
  CASE 
    WHEN q > 0 AND completed = true THEN 'Условия выполнены'
    WHEN q <= 0 THEN 'Q <= 0'
    WHEN completed = false THEN 'Задача не завершена'
    ELSE 'Не выполнены условия'
  END as conditions_check,
  -- Попадает ли в факт текущей недели
  CASE 
    WHEN q > 0 
      AND completed = true 
      AND COALESCE(week_processed, week_shot, 
        CASE 
          WHEN completed = true AND completed_at IS NOT NULL 
          THEN DATE_TRUNC('week', completed_at::date)::date + INTERVAL '1 day' * (1 - EXTRACT(DOW FROM DATE_TRUNC('week', completed_at::date)::date))
          ELSE NULL 
        END
      ) = (DATE_TRUNC('week', CURRENT_DATE)::date + INTERVAL '1 day' * (1 - EXTRACT(DOW FROM DATE_TRUNC('week', CURRENT_DATE)::date)))
    THEN 'ДА - попадает в факт текущей недели'
    ELSE 'НЕТ - не попадает в факт текущей недели'
  END as in_fact_this_week
FROM asana_tasks
WHERE task_name ILIKE '%слойка_круассан_макароны_4_СТМ%'
ORDER BY updated_at DESC
LIMIT 1;

-- Дополнительная информация: показываем все задачи с похожим названием
SELECT 
  task_name,
  q,
  completed,
  processed_at,
  week_processed,
  shot_at,
  week_shot,
  completed_at,
  CASE 
    WHEN completed = true AND completed_at IS NOT NULL 
    THEN DATE_TRUNC('week', completed_at::date)::date + INTERVAL '1 day' * (1 - EXTRACT(DOW FROM DATE_TRUNC('week', completed_at::date)::date))
    ELSE NULL 
  END as week_completed,
  DATE_TRUNC('week', CURRENT_DATE)::date + INTERVAL '1 day' * (1 - EXTRACT(DOW FROM DATE_TRUNC('week', CURRENT_DATE)::date)) as current_week
FROM asana_tasks
WHERE task_name ILIKE '%слойка%круассан%макароны%'
ORDER BY updated_at DESC;


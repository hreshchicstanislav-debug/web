-- Обновление срока выполнения (due_on) для задач:
-- 1. "Средний_Шоколадки_8_НЕ СТМ"
-- 2. "Средний_Оливковое масло_7_НЕ СТМ"
-- 3. "Средний_семечки и курт_13_НЕ СТМ"
-- 4. "Средний_трюфельные соусы_9_НЕ СТМ"
-- Новая дата: 21.11.2025
-- 
-- ВАЖНО: Это временное изменение в Supabase. 
-- При следующей синхронизации из Asana (каждые 5 минут или через webhook) 
-- значение может перезаписаться обратно, если в Asana не изменено.
-- 
-- Рекомендуется также изменить due_on в самой Asana для постоянного эффекта.

-- Сначала проверяем текущее состояние задач
SELECT 
  task_name,
  asana_task_gid,
  due_on,
  week_start_date,
  completed,
  q
FROM asana_tasks
WHERE task_name ILIKE '%Средний_Шоколадки_8_НЕ СТМ%'
   OR task_name ILIKE '%Средний_Оливковое масло_7_НЕ СТМ%'
   OR task_name ILIKE '%Средний_семечки и курт_13_НЕ СТМ%'
   OR task_name ILIKE '%Средний_трюфельные соусы_9_НЕ СТМ%'
ORDER BY updated_at DESC
LIMIT 10;

-- Обновляем due_on на 21.11.2025 для всех задач
-- week_start_date пересчитывается как понедельник недели, в которую попадает 21.11.2025
-- 21.11.2025 - это пятница, понедельник этой недели = 17.11.2025
UPDATE asana_tasks
SET 
  due_on = '2025-11-21'::date,
  week_start_date = DATE_TRUNC('week', '2025-11-21'::date)::date + INTERVAL '1 day' * (1 - EXTRACT(DOW FROM DATE_TRUNC('week', '2025-11-21'::date)::date)),
  updated_at = NOW()
WHERE task_name ILIKE '%Средний_Шоколадки_8_НЕ СТМ%'
   OR task_name ILIKE '%Средний_Оливковое масло_7_НЕ СТМ%'
   OR task_name ILIKE '%Средний_семечки и курт_13_НЕ СТМ%'
   OR task_name ILIKE '%Средний_трюфельные соусы_9_НЕ СТМ%'
RETURNING 
  task_name,
  asana_task_gid,
  due_on,
  week_start_date,
  updated_at;

-- Проверяем результат для всех четырёх задач
SELECT 
  task_name,
  due_on,
  week_start_date,
  CASE 
    WHEN week_start_date = DATE_TRUNC('week', CURRENT_DATE)::date + INTERVAL '1 day' * (1 - EXTRACT(DOW FROM DATE_TRUNC('week', CURRENT_DATE)::date))
    THEN 'Попадает в текущую неделю'
    ELSE 'НЕ попадает в текущую неделю'
  END as week_status
FROM asana_tasks
WHERE task_name ILIKE '%Средний_Шоколадки_8_НЕ СТМ%'
   OR task_name ILIKE '%Средний_Оливковое масло_7_НЕ СТМ%'
   OR task_name ILIKE '%Средний_семечки и курт_13_НЕ СТМ%'
   OR task_name ILIKE '%Средний_трюфельные соусы_9_НЕ СТМ%'
ORDER BY updated_at DESC;


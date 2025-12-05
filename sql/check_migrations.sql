-- Проверка наличия колонок после применения миграций
-- Выполните этот скрипт в Supabase Dashboard → SQL Editor

-- Проверка колонок asana_stats
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'asana_stats' 
  AND column_name IN ('done_week', 'debt_week', 'done_stm_qty', 'done_nonstm_qty')
ORDER BY column_name;

-- Проверка колонок asana_tasks
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'asana_tasks' 
  AND column_name IN ('task_type_gid', 'task_type_label', 'priority_gid', 'priority_label')
ORDER BY column_name;

-- Если колонки отсутствуют, вы увидите пустой результат
-- Если колонки есть, вы увидите их список с типами данных


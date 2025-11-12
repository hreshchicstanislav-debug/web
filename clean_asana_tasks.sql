-- Скрипт для очистки таблицы asana_tasks
-- Используйте этот скрипт, если нужно очистить все данные или только старые данные

-- ВАРИАНТ 1: Удалить ВСЕ данные из таблицы asana_tasks
-- ВНИМАНИЕ: Это удалит все записи! Используйте только если уверены.
-- DELETE FROM asana_tasks;

-- ВАРИАНТ 2: Удалить только задачи старше определенной даты (например, старше 2 недель)
-- Это безопасный вариант - удалит только старые данные
DELETE FROM asana_tasks 
WHERE week_start_date < CURRENT_DATE - INTERVAL '14 days';

-- ВАРИАНТ 3: Удалить задачи с некорректными week_start_date (например, NULL или старые форматы)
-- DELETE FROM asana_tasks WHERE week_start_date IS NULL;

-- ВАРИАНТ 4: Удалить задачи для конкретной недели (замените дату на нужную)
-- DELETE FROM asana_tasks WHERE week_start_date = '2025-11-03';

-- После выполнения скрипта проверьте результат:
-- SELECT COUNT(*) as total_tasks, 
--        MIN(week_start_date) as oldest_week, 
--        MAX(week_start_date) as newest_week 
-- FROM asana_tasks;


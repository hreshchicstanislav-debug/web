-- Объединённый скрипт для применения всех миграций для вкладки "Задачи"
-- Выполните этот скрипт в Supabase Dashboard → SQL Editor
-- Идемпотентный: можно запускать несколько раз без ошибок

-- ============================================================================
-- 1. Миграция asana_stats: добавление полей done_week и debt_week
-- ============================================================================
ALTER TABLE asana_stats 
ADD COLUMN IF NOT EXISTS done_week INTEGER DEFAULT 0 NOT NULL;

ALTER TABLE asana_stats 
ADD COLUMN IF NOT EXISTS debt_week INTEGER DEFAULT 0 NOT NULL;

COMMENT ON COLUMN asana_stats.done_week IS 'Факт выполненных товаров, зачтённых в эту неделю после перераспределения. На текущем этапе равен done_fact_this_week. В будущем будет рассчитываться по алгоритму перераспределения из docs/tasks-backend-new-kpi-spec.md';
COMMENT ON COLUMN asana_stats.debt_week IS 'Долг недели до плана 80: max(0, 80 - done_week). Показывается, сколько товаров не хватает до выполнения статичного плана 80 в конкретной неделе';

-- ============================================================================
-- 2. Миграция asana_stats: добавление полей для разбивки СТМ/НЕ СТМ
-- ============================================================================
ALTER TABLE asana_stats 
ADD COLUMN IF NOT EXISTS done_stm_qty INTEGER DEFAULT 0 NOT NULL;

ALTER TABLE asana_stats 
ADD COLUMN IF NOT EXISTS done_nonstm_qty INTEGER DEFAULT 0 NOT NULL;

COMMENT ON COLUMN asana_stats.done_stm_qty IS 'Количество товаров, сделанных по задачам с типом "СТМ" в текущей неделе. Рассчитывается на основе task_type_label из asana_tasks. Используется для разбивки карточки "Сделано" на СТМ/НЕ СТМ';
COMMENT ON COLUMN asana_stats.done_nonstm_qty IS 'Количество товаров, сделанных по задачам с типом "НЕ СТМ" в текущей неделе. Рассчитывается на основе task_type_label из asana_tasks. Используется для разбивки карточки "Сделано" на СТМ/НЕ СТМ';

-- ============================================================================
-- 3. Миграция asana_tasks: добавление полей для типа задачи и приоритета
-- ============================================================================
ALTER TABLE asana_tasks 
ADD COLUMN IF NOT EXISTS task_type_gid TEXT;

ALTER TABLE asana_tasks 
ADD COLUMN IF NOT EXISTS task_type_label TEXT;

ALTER TABLE asana_tasks 
ADD COLUMN IF NOT EXISTS priority_gid TEXT;

ALTER TABLE asana_tasks 
ADD COLUMN IF NOT EXISTS priority_label TEXT;

COMMENT ON COLUMN asana_tasks.task_type_gid IS 'GID значения enum-поля "Тип задачи" в Asana (custom_field_gid = 1211791857710742). Значение: GID выбранной опции enum (СТМ или НЕ СТМ)';
COMMENT ON COLUMN asana_tasks.task_type_label IS 'Человекочитаемое значение типа задачи из Asana (например, "СТМ" или "НЕ СТМ"). Извлекается из enum_value.name или enum_value.display_value';
COMMENT ON COLUMN asana_tasks.priority_gid IS 'GID значения enum-поля "Приоритет" в Asana (custom_field_gid = 1210258017012074). Значение: GID выбранной опции enum (🔥 Срочно / Высокий / Средний)';
COMMENT ON COLUMN asana_tasks.priority_label IS 'Человекочитаемое значение приоритета из Asana (например, "🔥 Срочно", "Высокий", "Средний"). Извлекается из enum_value.name или enum_value.display_value';

-- ============================================================================
-- Проверка: выводим список всех колонок для проверки
-- ============================================================================
SELECT 'asana_stats columns:' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'asana_stats' 
  AND column_name IN ('done_week', 'debt_week', 'done_stm_qty', 'done_nonstm_qty')
ORDER BY column_name;

SELECT 'asana_tasks columns:' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'asana_tasks' 
  AND column_name IN ('task_type_gid', 'task_type_label', 'priority_gid', 'priority_label')
ORDER BY column_name;


-- Миграция таблицы asana_stats: добавление полей done_week и debt_week
-- Подготовка к новой модели KPI с перераспределением товаров между неделями
-- См. docs/tasks-backend-new-kpi-spec.md для деталей новой логики
-- 
-- Идемпотентный скрипт: можно запускать несколько раз без ошибок

-- Добавление поля done_week (факт выполненных товаров, зачтённых в эту неделю)
ALTER TABLE asana_stats 
ADD COLUMN IF NOT EXISTS done_week INTEGER DEFAULT 0 NOT NULL;

-- Добавление поля debt_week (долг недели до плана 80)
ALTER TABLE asana_stats 
ADD COLUMN IF NOT EXISTS debt_week INTEGER DEFAULT 0 NOT NULL;

-- Обновление комментариев к новым столбцам
COMMENT ON COLUMN asana_stats.done_week IS 'Факт выполненных товаров, зачтённых в эту неделю после перераспределения. На текущем этапе равен done_fact_this_week. В будущем будет рассчитываться по алгоритму перераспределения из docs/tasks-backend-new-kpi-spec.md';
COMMENT ON COLUMN asana_stats.debt_week IS 'Долг недели до плана 80: max(0, 80 - done_week). Показывается, сколько товаров не хватает до выполнения статичного плана 80 в конкретной неделе';

-- Обновление комментария к таблице (добавляем информацию о новых полях)
COMMENT ON TABLE asana_stats IS 'Агрегированная статистика по неделям: динамический план, KPI "Сделано", объёмы работ и ошибки. Включает новые поля done_week и debt_week для подготовки к новой модели KPI с перераспределением товаров между неделями';


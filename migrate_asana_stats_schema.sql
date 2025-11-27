-- Миграция таблицы asana_stats для поддержки новой бизнес-логики
-- Обновляет существующие колонки и добавляет новые для агрегированных показателей
-- Идемпотентный скрипт: можно запускать несколько раз без ошибок

-- Добавление новых полей (если их ещё нет)
ALTER TABLE asana_stats 
ADD COLUMN IF NOT EXISTS week_load INTEGER DEFAULT 0;

ALTER TABLE asana_stats 
ADD COLUMN IF NOT EXISTS plan INTEGER DEFAULT 80;

ALTER TABLE asana_stats 
ADD COLUMN IF NOT EXISTS done_qty INTEGER DEFAULT 0;

ALTER TABLE asana_stats 
ADD COLUMN IF NOT EXISTS to_shoot_qty INTEGER DEFAULT 0;

ALTER TABLE asana_stats 
ADD COLUMN IF NOT EXISTS on_hand_qty INTEGER DEFAULT 0;

ALTER TABLE asana_stats 
ADD COLUMN IF NOT EXISTS warehouse_qty INTEGER DEFAULT 0;

ALTER TABLE asana_stats 
ADD COLUMN IF NOT EXISTS shot_not_processed_qty INTEGER DEFAULT 0;

ALTER TABLE asana_stats 
ADD COLUMN IF NOT EXISTS q_errors_count INTEGER DEFAULT 0;

-- Переименование старых колонок для ясности (если они ещё не переименованы)
-- completed_count -> done_qty (уже добавлено выше, старую можно оставить для обратной совместимости)
-- pending_count -> to_shoot_qty (уже добавлено выше, старую можно оставить для обратной совместимости)
-- total_plan -> week_load (уже добавлено выше, старую можно оставить для обратной совместимости)
-- remaining_to_plan остаётся как есть

-- Обновление комментариев к столбцам
COMMENT ON COLUMN asana_stats.week_start_date IS 'Понедельник недели (уникальный ключ)';
COMMENT ON COLUMN asana_stats.week_end_date IS 'Воскресенье недели';
COMMENT ON COLUMN asana_stats.completed_count IS 'Legacy: отснято на неделе (используйте done_qty)';
COMMENT ON COLUMN asana_stats.pending_count IS 'Legacy: предстоит отснять (используйте to_shoot_qty)';
COMMENT ON COLUMN asana_stats.total_plan IS 'Legacy: запланировано товаров (используйте week_load)';
COMMENT ON COLUMN asana_stats.remaining_to_plan IS 'Остаток до выполнения плана: plan - done_qty (может быть отрицательным при перевыполнении)';
COMMENT ON COLUMN asana_stats.week_load IS 'Суммарный Q задач недели по due_on и заполненному Q';
COMMENT ON COLUMN asana_stats.plan IS 'Динамический план недели (80-100, рассчитанный по правилам: если weekLoad <= 80 → 80, если 80 < weekLoad <= 100 → weekLoad, если weekLoad > 100 → 100)';
COMMENT ON COLUMN asana_stats.done_qty IS 'KPI "Сделано" за неделю с учётом переработки из/в другие недели (Q задач, достигших статуса "Сделано" и зачтённых в эту неделю)';
COMMENT ON COLUMN asana_stats.to_shoot_qty IS 'Объём "Предстоит отснять" (задачи недели с Q > 0, не доведённые до состояния "Сделано")';
COMMENT ON COLUMN asana_stats.on_hand_qty IS 'Объём товара, который уже "Принесли" и/или сфоткан, но ещё не обработан';
COMMENT ON COLUMN asana_stats.warehouse_qty IS 'Объём задач недели, где "Товар" = "Взять самому со склада" и работа по ним ещё не начата (нет shot_at/processed_at)';
COMMENT ON COLUMN asana_stats.shot_not_processed_qty IS 'Q задач с shot_at в этой неделе, но без processed_at';
COMMENT ON COLUMN asana_stats.q_errors_count IS 'Количество задач недели, которые помечены как проблемные (например, тип "Взять со склада", но Q не задан)';

-- Обновление комментария к таблице
COMMENT ON TABLE asana_stats IS 'Агрегированная статистика по неделям: динамический план, KPI "Сделано", объёмы работ и ошибки';


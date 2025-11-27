-- Миграция таблицы asana_tasks для поддержки новой бизнес-логики
-- Добавляет поля: q, product_source, shot_at, processed_at, week_shot, week_processed
-- Идемпотентный скрипт: можно запускать несколько раз без ошибок

-- Добавление поля q (количество товаров из поля Q, основной источник)
ALTER TABLE asana_tasks 
ADD COLUMN IF NOT EXISTS q INTEGER;

-- Добавление поля product_source (источник товара: 'PRINESLI' или 'WAREHOUSE')
ALTER TABLE asana_tasks 
ADD COLUMN IF NOT EXISTS product_source TEXT;

-- Добавление поля shot_at (дата из поля "когда сфоткал")
ALTER TABLE asana_tasks 
ADD COLUMN IF NOT EXISTS shot_at DATE;

-- Добавление поля processed_at (дата из поля "когда обработал" или completed_at)
ALTER TABLE asana_tasks 
ADD COLUMN IF NOT EXISTS processed_at DATE;

-- Добавление поля week_shot (понедельник недели, к которой относится shot_at)
ALTER TABLE asana_tasks 
ADD COLUMN IF NOT EXISTS week_shot DATE;

-- Добавление поля week_processed (понедельник недели, к которой относится processed_at)
ALTER TABLE asana_tasks 
ADD COLUMN IF NOT EXISTS week_processed DATE;

-- Создание индексов для новых полей
CREATE INDEX IF NOT EXISTS idx_asana_tasks_q ON asana_tasks(q) WHERE q IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_asana_tasks_product_source ON asana_tasks(product_source) WHERE product_source IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_asana_tasks_shot_at ON asana_tasks(shot_at) WHERE shot_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_asana_tasks_processed_at ON asana_tasks(processed_at) WHERE processed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_asana_tasks_week_shot ON asana_tasks(week_shot) WHERE week_shot IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_asana_tasks_week_processed ON asana_tasks(week_processed) WHERE week_processed IS NOT NULL;

-- Обновление комментариев к столбцам
COMMENT ON COLUMN asana_tasks.q IS 'Количество товаров из поля Q (основной источник, заменяет quantity)';
COMMENT ON COLUMN asana_tasks.product_source IS 'Источник товара: PRINESLI (Принесли) или WAREHOUSE (Взять самому со склада)';
COMMENT ON COLUMN asana_tasks.shot_at IS 'Дата из поля "когда сфоткал", проставляется фотографом вручную';
COMMENT ON COLUMN asana_tasks.processed_at IS 'Дата из поля "когда обработал" или completed_at, если поле пустое при completed = true';
COMMENT ON COLUMN asana_tasks.week_shot IS 'Понедельник недели, к которой относится shot_at (для группировки и расчёта переработки)';
COMMENT ON COLUMN asana_tasks.week_processed IS 'Понедельник недели, к которой относится processed_at (для группировки и расчёта переработки)';
COMMENT ON COLUMN asana_tasks.quantity IS 'Legacy: старое поле "Кол-во товаров" (Custom Field ID: 1210420107320602), больше не используется в расчётах';

-- Обновление комментария к таблице
COMMENT ON TABLE asana_tasks IS 'Детальная информация о задачах Asana с количеством товаров (Q), источником товара, датами съёмки и обработки';


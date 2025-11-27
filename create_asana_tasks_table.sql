-- Создание таблицы для детальной информации о задачах Asana
-- Эта таблица хранит информацию о каждой задаче с количеством товаров

CREATE TABLE IF NOT EXISTS asana_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asana_task_gid TEXT NOT NULL UNIQUE, -- GID задачи из Asana
  task_name TEXT, -- Название задачи
  completed BOOLEAN DEFAULT false, -- Завершена ли задача
  completed_at TIMESTAMP WITH TIME ZONE, -- Дата завершения
  due_on DATE, -- Дедлайн задачи
  -- Legacy поле (сохраняется для обратной совместимости)
  quantity INTEGER, -- Legacy: количество товаров из старого поля "Кол-во товаров" (Custom Field ID: 1210420107320602)
  -- Новые поля для новой бизнес-логики
  q INTEGER, -- Количество товаров из поля Q (основной источник)
  product_source TEXT, -- Источник товара: 'PRINESLI' (Принесли) или 'WAREHOUSE' (Взять самому со склада)
  shot_at DATE, -- Дата из поля "когда сфоткал"
  processed_at DATE, -- Дата из поля "когда обработал" или completed_at, если поле пустое при completed = true
  week_shot DATE, -- Понедельник недели, к которой относится shot_at
  week_processed DATE, -- Понедельник недели, к которой относится processed_at
  assignee_gid TEXT, -- GID исполнителя (User ID: 1210252517070407)
  week_start_date DATE NOT NULL, -- Дата начала недели (понедельник) для группировки по due_on
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_asana_tasks_asana_gid ON asana_tasks(asana_task_gid);
CREATE INDEX IF NOT EXISTS idx_asana_tasks_week_start ON asana_tasks(week_start_date);
CREATE INDEX IF NOT EXISTS idx_asana_tasks_completed ON asana_tasks(completed);
CREATE INDEX IF NOT EXISTS idx_asana_tasks_due_on ON asana_tasks(due_on);
CREATE INDEX IF NOT EXISTS idx_asana_tasks_q ON asana_tasks(q) WHERE q IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_asana_tasks_product_source ON asana_tasks(product_source) WHERE product_source IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_asana_tasks_shot_at ON asana_tasks(shot_at) WHERE shot_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_asana_tasks_processed_at ON asana_tasks(processed_at) WHERE processed_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_asana_tasks_week_shot ON asana_tasks(week_shot) WHERE week_shot IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_asana_tasks_week_processed ON asana_tasks(week_processed) WHERE week_processed IS NOT NULL;

-- RLS политики
ALTER TABLE asana_tasks ENABLE ROW LEVEL SECURITY;

-- Политика для SELECT (все могут читать)
CREATE POLICY "Anyone can read asana_tasks"
  ON asana_tasks FOR SELECT
  USING (true);

-- Политика для INSERT/UPDATE/DELETE (только service_role через Edge Function)
-- Edge Function использует service_role key, поэтому может вставлять/обновлять данные

-- Комментарии к столбцам
COMMENT ON TABLE asana_tasks IS 'Детальная информация о задачах Asana с количеством товаров (Q), источником товара, датами съёмки и обработки';
COMMENT ON COLUMN asana_tasks.asana_task_gid IS 'GID задачи из Asana API';
COMMENT ON COLUMN asana_tasks.quantity IS 'Legacy: старое поле "Кол-во товаров" (Custom Field ID: 1210420107320602), больше не используется в расчётах';
COMMENT ON COLUMN asana_tasks.q IS 'Количество товаров из поля Q (основной источник, заменяет quantity)';
COMMENT ON COLUMN asana_tasks.product_source IS 'Источник товара: PRINESLI (Принесли) или WAREHOUSE (Взять самому со склада)';
COMMENT ON COLUMN asana_tasks.shot_at IS 'Дата из поля "когда сфоткал", проставляется фотографом вручную';
COMMENT ON COLUMN asana_tasks.processed_at IS 'Дата из поля "когда обработал" или completed_at, если поле пустое при completed = true';
COMMENT ON COLUMN asana_tasks.week_shot IS 'Понедельник недели, к которой относится shot_at (для группировки и расчёта переработки)';
COMMENT ON COLUMN asana_tasks.week_processed IS 'Понедельник недели, к которой относится processed_at (для группировки и расчёта переработки)';
COMMENT ON COLUMN asana_tasks.assignee_gid IS 'GID исполнителя задачи (User ID: 1210252517070407)';
COMMENT ON COLUMN asana_tasks.week_start_date IS 'Дата начала недели (понедельник) для группировки задач по due_on';


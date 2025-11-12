-- Создание таблицы для детальной информации о задачах Asana
-- Эта таблица хранит информацию о каждой задаче с количеством товаров

CREATE TABLE IF NOT EXISTS asana_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asana_task_gid TEXT NOT NULL UNIQUE, -- GID задачи из Asana
  task_name TEXT, -- Название задачи
  completed BOOLEAN DEFAULT false, -- Завершена ли задача
  completed_at TIMESTAMP WITH TIME ZONE, -- Дата завершения
  due_on DATE, -- Дедлайн задачи
  quantity INTEGER, -- Количество товаров (из поля "Кол-во товаров", Custom Field ID: 1210420107320602)
  assignee_gid TEXT, -- GID исполнителя (User ID: 1210252517070407)
  week_start_date DATE NOT NULL, -- Дата начала недели (понедельник) для группировки
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_asana_tasks_asana_gid ON asana_tasks(asana_task_gid);
CREATE INDEX IF NOT EXISTS idx_asana_tasks_week_start ON asana_tasks(week_start_date);
CREATE INDEX IF NOT EXISTS idx_asana_tasks_completed ON asana_tasks(completed);
CREATE INDEX IF NOT EXISTS idx_asana_tasks_due_on ON asana_tasks(due_on);

-- RLS политики
ALTER TABLE asana_tasks ENABLE ROW LEVEL SECURITY;

-- Политика для SELECT (все могут читать)
CREATE POLICY "Anyone can read asana_tasks"
  ON asana_tasks FOR SELECT
  USING (true);

-- Политика для INSERT/UPDATE/DELETE (только service_role через Edge Function)
-- Edge Function использует service_role key, поэтому может вставлять/обновлять данные

-- Комментарии к столбцам
COMMENT ON TABLE asana_tasks IS 'Детальная информация о задачах Asana с количеством товаров';
COMMENT ON COLUMN asana_tasks.asana_task_gid IS 'GID задачи из Asana API';
COMMENT ON COLUMN asana_tasks.quantity IS 'Количество товаров из поля "Кол-во товаров" (Custom Field ID: 1210420107320602)';
COMMENT ON COLUMN asana_tasks.assignee_gid IS 'GID исполнителя задачи (User ID: 1210252517070407)';
COMMENT ON COLUMN asana_tasks.week_start_date IS 'Дата начала недели (понедельник) для группировки задач по неделям';


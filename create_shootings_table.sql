-- Создание таблицы для хранения съёмок из Google Calendar
-- Таблица будет хранить информацию о предстоящих съёмках

CREATE TABLE IF NOT EXISTS shootings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  start_time TIME NOT NULL, -- Время начала съёмки из календаря (например, 15:30)
  end_time TIME NOT NULL, -- Время окончания съёмки из календаря (например, 17:00)
  title TEXT, -- Название события из календаря (опционально)
  description TEXT, -- Описание события (опционально)
  google_event_id TEXT UNIQUE, -- ID события в Google Calendar (для предотвращения дубликатов)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индекс для быстрого поиска по дате
CREATE INDEX IF NOT EXISTS idx_shootings_date ON shootings(date);

-- Индекс для поиска по Google Event ID
CREATE INDEX IF NOT EXISTS idx_shootings_google_event_id ON shootings(google_event_id);

-- Функция для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Триггер для автоматического обновления updated_at
CREATE TRIGGER update_shootings_updated_at
  BEFORE UPDATE ON shootings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Комментарии к таблице и полям
COMMENT ON TABLE shootings IS 'Таблица для хранения информации о съёмках из Google Calendar';
COMMENT ON COLUMN shootings.date IS 'Дата съёмки';
COMMENT ON COLUMN shootings.start_time IS 'Время начала съёмки (из Google Calendar)';
COMMENT ON COLUMN shootings.end_time IS 'Время окончания съёмки (из Google Calendar)';
COMMENT ON COLUMN shootings.title IS 'Название события из Google Calendar';
COMMENT ON COLUMN shootings.google_event_id IS 'Уникальный ID события в Google Calendar для предотвращения дубликатов';


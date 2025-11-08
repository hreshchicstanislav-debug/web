-- SQL скрипт для полного пересоздания таблицы в Supabase
-- ВНИМАНИЕ: Это удалит все данные! Используйте только если хотите начать с нуля

-- 1. Удаление существующей таблицы (если нужно)
-- DROP TABLE IF EXISTS time_tracks CASCADE;

-- 2. Создание таблицы заново
CREATE TABLE IF NOT EXISTS time_tracks (
  id BIGSERIAL PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  in_time TIME,
  out_time TIME,
  breaks_json TEXT,
  comment TEXT,
  photo_url TEXT,
  day_balance_min INTEGER DEFAULT 0,
  carry_new_min INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Создание индексов для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_time_tracks_date ON time_tracks(date);
CREATE INDEX IF NOT EXISTS idx_time_tracks_created_at ON time_tracks(created_at);

-- 4. Включение Row Level Security (RLS) - если нужно
-- ALTER TABLE time_tracks ENABLE ROW LEVEL SECURITY;

-- 5. Политика доступа (если используется RLS)
-- Разрешить всем читать и писать (для тестирования)
-- В продакшене настройте политики безопасности!
-- CREATE POLICY "Allow all operations" ON time_tracks
--   FOR ALL
--   USING (true)
--   WITH CHECK (true);

-- 6. Функция для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. Триггер для автоматического обновления updated_at
DROP TRIGGER IF EXISTS update_time_tracks_updated_at ON time_tracks;
CREATE TRIGGER update_time_tracks_updated_at
  BEFORE UPDATE ON time_tracks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 8. Проверка структуры таблицы
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'time_tracks'
ORDER BY ordinal_position;


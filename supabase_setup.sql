-- SQL скрипт для создания таблицы в Supabase
-- Выполните этот скрипт в SQL Editor вашего Supabase проекта

-- Создание таблицы для хранения отчетов
CREATE TABLE IF NOT EXISTS time_tracks (
  date DATE PRIMARY KEY,
  plan_start TEXT,
  plan_end TEXT,
  in_time TEXT,
  out_time TEXT,
  breaks_json TEXT,
  comment TEXT,
  photo_url TEXT,
  day_balance_min INTEGER DEFAULT 0,
  carry_new_min INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Добавление поля photo_url, если таблица уже существует
ALTER TABLE time_tracks 
ADD COLUMN IF NOT EXISTS photo_url TEXT;

-- Создание индекса для быстрого поиска по дате
CREATE INDEX IF NOT EXISTS idx_time_tracks_date ON time_tracks(date DESC);

-- Включение Row Level Security (RLS) - опционально
-- Если хотите ограничить доступ, раскомментируйте следующие строки:

-- ALTER TABLE time_tracks ENABLE ROW LEVEL SECURITY;

-- Политика для чтения (все могут читать)
-- CREATE POLICY "Allow read access" ON time_tracks FOR SELECT USING (true);

-- Политика для записи (все могут писать)
-- CREATE POLICY "Allow insert access" ON time_tracks FOR INSERT WITH CHECK (true);
-- CREATE POLICY "Allow update access" ON time_tracks FOR UPDATE USING (true);

-- Если RLS включен, но политики не созданы, таблица будет недоступна
-- Поэтому либо создайте политики, либо отключите RLS:
-- ALTER TABLE time_tracks DISABLE ROW LEVEL SECURITY;


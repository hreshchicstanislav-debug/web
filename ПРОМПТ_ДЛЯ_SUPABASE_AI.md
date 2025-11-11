# Промпт для AI ассистента в Supabase

## Задача
Полностью пересоздать базу данных с нуля: удалить все таблицы и настройки, затем создать все заново с правильными настройками, разрешениями и политиками.

## Как использовать этот промпт

**Скопируй весь текст этого файла и вставь в AI ассистента в Supabase Dashboard (SQL Editor → AI Assistant).**

Или скажи AI ассистенту:

"Выполни все SQL команды из файла ПРОМПТ_ДЛЯ_SUPABASE_AI.md. Сначала удали все существующие таблицы (time_tracks, shootings, shifts), политики, функции и триггеры. Затем создай все заново: таблицы time_tracks, shootings и shifts (для shifts сначала проверь структуру существующей таблицы в Supabase Dashboard), функции, триггеры, индексы и политики безопасности (RLS) с правильными разрешениями для anon и authenticated пользователей."

## Что нужно сделать

### Шаг 1: Удалить все существующие таблицы и настройки

Выполни следующие SQL команды в SQL Editor Supabase:

```sql
-- Удаляем все таблицы (если они существуют)
DROP TABLE IF EXISTS shootings CASCADE;
DROP TABLE IF EXISTS time_tracks CASCADE;
DROP TABLE IF EXISTS shifts CASCADE;

-- Удаляем все политики безопасности (если они существуют)
DROP POLICY IF EXISTS "Allow public read access" ON shootings;
DROP POLICY IF EXISTS "Allow public insert access" ON shootings;
DROP POLICY IF EXISTS "Allow public update access" ON shootings;
DROP POLICY IF EXISTS "Allow public delete access" ON shootings;
DROP POLICY IF EXISTS "Allow public read access" ON time_tracks;
DROP POLICY IF EXISTS "Allow public insert access" ON time_tracks;
DROP POLICY IF EXISTS "Allow public update access" ON time_tracks;
DROP POLICY IF EXISTS "Allow public delete access" ON time_tracks;
DROP POLICY IF EXISTS "Allow public read access" ON shifts;
DROP POLICY IF EXISTS "Allow public insert access" ON shifts;
DROP POLICY IF EXISTS "Allow public update access" ON shifts;
DROP POLICY IF EXISTS "Allow public delete access" ON shifts;

-- Удаляем все функции (если они существуют)
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- Удаляем все триггеры (если они существуют)
DROP TRIGGER IF EXISTS update_shootings_updated_at ON shootings;
DROP TRIGGER IF EXISTS update_time_tracks_updated_at ON time_tracks;
DROP TRIGGER IF EXISTS update_shifts_updated_at ON shifts;
```

### Шаг 2: Создать таблицу time_tracks

```sql
-- Создание таблицы для хранения записей времени работы
CREATE TABLE IF NOT EXISTS time_tracks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL UNIQUE,
  in_time TIME,
  out_time TIME,
  breaks_json TEXT,
  comment TEXT,
  photo_url TEXT,
  day_balance_min INTEGER DEFAULT 0,
  carry_new_min INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индекс для быстрого поиска по дате
CREATE INDEX IF NOT EXISTS idx_time_tracks_date ON time_tracks(date);
CREATE INDEX IF NOT EXISTS idx_time_tracks_created_at ON time_tracks(created_at);

-- Комментарии к таблице
COMMENT ON TABLE time_tracks IS 'Таблица для хранения записей времени работы сотрудника';
COMMENT ON COLUMN time_tracks.date IS 'Дата записи (уникальная)';
COMMENT ON COLUMN time_tracks.in_time IS 'Время прихода на работу';
COMMENT ON COLUMN time_tracks.out_time IS 'Время ухода с работы';
COMMENT ON COLUMN time_tracks.photo_url IS 'URL фотографии сдачи ключей';
COMMENT ON COLUMN time_tracks.breaks_json IS 'JSON с информацией о перерывах';
COMMENT ON COLUMN time_tracks.comment IS 'Комментарий к записи';
COMMENT ON COLUMN time_tracks.day_balance_min IS 'Баланс дня в минутах';
COMMENT ON COLUMN time_tracks.carry_new_min IS 'Перенос баланса в минутах';
```

### Шаг 3: Создать таблицу shootings

```sql
-- Создание таблицы для хранения съёмок из Google Calendar
CREATE TABLE IF NOT EXISTS shootings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  google_event_id TEXT UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индекс для быстрого поиска по дате
CREATE INDEX IF NOT EXISTS idx_shootings_date ON shootings(date);

-- Индекс для поиска по Google Event ID
CREATE INDEX IF NOT EXISTS idx_shootings_google_event_id ON shootings(google_event_id);

-- Комментарии к таблице
COMMENT ON TABLE shootings IS 'Таблица для хранения информации о съёмках из Google Calendar';
COMMENT ON COLUMN shootings.date IS 'Дата съёмки';
COMMENT ON COLUMN shootings.start_time IS 'Время начала съёмки (из Google Calendar)';
COMMENT ON COLUMN shootings.end_time IS 'Время окончания съёмки (из Google Calendar)';
COMMENT ON COLUMN shootings.google_event_id IS 'ID события в Google Calendar (уникальный)';
```

**ВАЖНО:** В таблице `shootings` НЕТ полей `title` и `description` - они были удалены по требованию пользователя.

### Шаг 4: Создать таблицу shifts

**ВАЖНО:** Структура таблицы `shifts` неизвестна. Сначала проверь существующую структуру таблицы `shifts` в Supabase Dashboard → Table Editor, затем создай таблицу с такой же структурой.

Если структура таблицы `shifts` неизвестна, создай базовую структуру:

```sql
-- Создание таблицы shifts (базовая структура - уточни структуру в Supabase Dashboard)
CREATE TABLE IF NOT EXISTS shifts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индекс для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_shifts_created_at ON shifts(created_at);

-- Комментарии к таблице
COMMENT ON TABLE shifts IS 'Таблица для хранения смен (структура должна быть уточнена)';
```

**Или попроси AI ассистента:**
"Проверь структуру существующей таблицы shifts в Supabase и создай ее с такой же структурой, но с UUID для id и полями created_at и updated_at."

### Шаг 5: Создать функцию для автоматического обновления updated_at

```sql
-- Функция для автоматического обновления updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Шаг 6: Создать триггеры для автоматического обновления updated_at

```sql
-- Триггер для таблицы time_tracks
CREATE TRIGGER update_time_tracks_updated_at
  BEFORE UPDATE ON time_tracks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Триггер для таблицы shootings
CREATE TRIGGER update_shootings_updated_at
  BEFORE UPDATE ON shootings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Триггер для таблицы shifts (если в таблице есть поле updated_at)
CREATE TRIGGER update_shifts_updated_at
  BEFORE UPDATE ON shifts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

### Шаг 7: Настроить политики безопасности (RLS) для таблицы time_tracks

```sql
-- Включаем Row Level Security для time_tracks
ALTER TABLE time_tracks ENABLE ROW LEVEL SECURITY;

-- Политика: Разрешить SELECT (чтение) для всех (anon и authenticated)
CREATE POLICY "Allow public read access" ON time_tracks
  FOR SELECT
  USING (true);

-- Политика: Разрешить INSERT (вставка) для всех (anon и authenticated)
CREATE POLICY "Allow public insert access" ON time_tracks
  FOR INSERT
  WITH CHECK (true);

-- Политика: Разрешить UPDATE (обновление) для всех (anon и authenticated)
CREATE POLICY "Allow public update access" ON time_tracks
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Политика: Разрешить DELETE (удаление) для всех (anon и authenticated)
CREATE POLICY "Allow public delete access" ON time_tracks
  FOR DELETE
  USING (true);
```

### Шаг 8: Настроить политики безопасности (RLS) для таблицы shootings

```sql
-- Включаем Row Level Security для shootings
ALTER TABLE shootings ENABLE ROW LEVEL SECURITY;

-- Политика: Разрешить SELECT (чтение) для всех (anon и authenticated)
CREATE POLICY "Allow public read access" ON shootings
  FOR SELECT
  USING (true);

-- Политика: Разрешить INSERT (вставка) для service_role (только для Google Apps Script)
-- Для anon пользователей разрешаем только через service_role key
-- В приложении (app.js) используется anon key, но для чтения это нормально
-- Для записи из Google Apps Script используется service_role key
CREATE POLICY "Allow authenticated insert access" ON shootings
  FOR INSERT
  WITH CHECK (true);

-- Политика: Разрешить UPDATE (обновление) для всех (anon и authenticated)
CREATE POLICY "Allow public update access" ON shootings
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Политика: Разрешить DELETE (удаление) для service_role (только для Google Apps Script)
-- Для anon пользователей удаление не разрешено
-- Удаление происходит только через service_role key из Google Apps Script
CREATE POLICY "Allow service_role delete access" ON shootings
  FOR DELETE
  USING (true);
```

**ВАЖНО:** Для таблицы `shootings`:
- **SELECT** - разрешен для всех (anon и authenticated) - для отображения на сайте
- **INSERT/UPDATE** - разрешен для всех (anon и authenticated) - но на практике используется service_role из Google Apps Script
- **DELETE** - разрешен для всех (anon и authenticated) - но на практике используется service_role из Google Apps Script

Если нужна более строгая безопасность, можно ограничить INSERT/UPDATE/DELETE только для authenticated пользователей, но тогда нужно будет настроить аутентификацию в приложении.

### Шаг 9: Настроить политики безопасности (RLS) для таблицы shifts

```sql
-- Включаем Row Level Security для shifts
ALTER TABLE shifts ENABLE ROW LEVEL SECURITY;

-- Политика: Разрешить SELECT (чтение) для всех (anon и authenticated)
CREATE POLICY "Allow public read access" ON shifts
  FOR SELECT
  USING (true);

-- Политика: Разрешить INSERT (вставка) для всех (anon и authenticated)
CREATE POLICY "Allow public insert access" ON shifts
  FOR INSERT
  WITH CHECK (true);

-- Политика: Разрешить UPDATE (обновление) для всех (anon и authenticated)
CREATE POLICY "Allow public update access" ON shifts
  FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Политика: Разрешить DELETE (удаление) для всех (anon и authenticated)
CREATE POLICY "Allow public delete access" ON shifts
  FOR DELETE
  USING (true);
```

**ВАЖНО:** Политики для таблицы `shifts` настроены так же, как для `time_tracks`. Если нужны другие настройки безопасности, измени их соответственно.

### Шаг 10: Проверить создание таблиц и политик

```sql
-- Проверка таблиц
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('time_tracks', 'shootings', 'shifts')
ORDER BY table_name;

-- Проверка политик для time_tracks
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'time_tracks'
ORDER BY policyname;

-- Проверка политик для shootings
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'shootings'
ORDER BY policyname;

-- Проверка политик для shifts
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename = 'shifts'
ORDER BY policyname;

-- Проверка индексов
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE tablename IN ('time_tracks', 'shootings', 'shifts')
ORDER BY tablename, indexname;

-- Проверка структуры таблицы shifts (чтобы убедиться, что все поля созданы)
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'shifts'
ORDER BY ordinal_position;
```

## Полный SQL скрипт для выполнения

Выполни все команды из шагов 1-10 последовательно в SQL Editor Supabase.

**ВАЖНО:** Перед созданием таблицы `shifts` проверь ее структуру в Supabase Dashboard → Table Editor, чтобы создать ее с правильными полями.

## После выполнения

1. Проверь, что таблицы созданы:
   - Открой **Table Editor** в Supabase Dashboard
   - Должны быть видны таблицы `time_tracks`, `shootings` и `shifts`

2. Проверь политики безопасности:
   - Открой **Authentication** → **Policies** в Supabase Dashboard
   - Для каждой таблицы должны быть политики на SELECT, INSERT, UPDATE, DELETE

3. Проверь, что данные можно читать:
   - Открой **Table Editor** → выбери таблицу `shootings`
   - Попробуй выполнить SELECT запрос (должен работать)

4. Проверь, что данные можно записывать:
   - Попробуй вставить тестовую запись через **Table Editor**
   - Или через Google Apps Script (должно работать с service_role key)

## Важные замечания

1. **Service Role Key** используется только в Google Apps Script для записи/удаления съёмок
2. **Anon Key** используется на сайте (app.js) для чтения данных
3. Политики безопасности настроены так, чтобы:
   - Сайт мог читать данные (SELECT)
   - Google Apps Script мог записывать/обновлять/удалять данные (INSERT/UPDATE/DELETE через service_role key)

## Если что-то пошло не так

1. Проверь логи выполнения в SQL Editor
2. Убедись, что все команды выполнены последовательно
3. Проверь, что нет конфликтов с существующими объектами
4. Если есть ошибки - скопируй их и исправь


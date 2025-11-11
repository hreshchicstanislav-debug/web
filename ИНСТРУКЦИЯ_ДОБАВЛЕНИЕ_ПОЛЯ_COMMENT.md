# Инструкция: Добавление поля comment в таблицу time_tracks в Supabase

## Проблема
В таблице `time_tracks` отсутствует поле `comment` для хранения комментариев, поэтому комментарии не сохраняются в базе данных.

## Решение

### Вариант 1: Использовать AI ассистента в Supabase (рекомендуется)

1. Откройте [Supabase Dashboard](https://supabase.com/dashboard/project/uqgpynqnboyeqvsaljso)
2. Перейдите в **SQL Editor** → **AI Assistant**
3. Скопируйте и вставьте следующий запрос:

```sql
-- Проверяем, существует ли поле comment в таблице time_tracks
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'time_tracks' AND column_name = 'comment';

-- Если поле не существует, добавляем его
ALTER TABLE time_tracks 
ADD COLUMN IF NOT EXISTS comment TEXT;

-- Проверяем, что поле добавлено
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'time_tracks' AND column_name = 'comment';
```

4. Нажмите **Run** (▶️) для выполнения запроса
5. Убедитесь, что поле добавлено успешно

### Вариант 2: Использовать Table Editor в Supabase

1. Откройте [Supabase Dashboard](https://supabase.com/dashboard/project/uqgpynqnboyeqvsaljso)
2. Перейдите в **Table Editor**
3. Выберите таблицу `time_tracks`
4. Нажмите на иконку **"+"** (Add Column) в правом верхнем углу
5. Заполните форму:
   - **Name:** `comment`
   - **Type:** `text`
   - **Is Nullable:** ✅ (галочка должна быть установлена - поле опциональное)
   - **Default Value:** оставьте пустым
6. Нажмите **Save**

### Вариант 3: Использовать SQL Editor напрямую

1. Откройте [Supabase Dashboard](https://supabase.com/dashboard/project/uqgpynqnboyeqvsaljso)
2. Перейдите в **SQL Editor**
3. Создайте новый запрос
4. Вставьте следующий SQL:

```sql
-- Добавляем поле comment в таблицу time_tracks
ALTER TABLE time_tracks 
ADD COLUMN IF NOT EXISTS comment TEXT;

-- Добавляем комментарий к полю (опционально)
COMMENT ON COLUMN time_tracks.comment IS 'Комментарий к записи времени работы';
```

5. Нажмите **Run** (▶️)

## Проверка

После добавления поля проверьте:

1. Откройте **Table Editor** → `time_tracks`
2. Убедитесь, что в таблице есть колонка `comment`
3. Попробуйте добавить комментарий на сайте и проверить, что он сохраняется

## Если поле уже существует

Если поле `comment` уже существует в таблице, но комментарии не сохраняются:

1. Проверьте права доступа (RLS политики) - поле должно быть доступно для записи
2. Проверьте консоль браузера на наличие ошибок
3. Убедитесь, что функция `saveRecord` в `app.js` правильно сохраняет поле `comment`

## Дополнительная информация

- **Тип поля:** `TEXT` - позволяет хранить комментарии любой длины
- **Nullable:** Да - комментарий опциональный, может быть пустым
- **Default:** Нет значения по умолчанию


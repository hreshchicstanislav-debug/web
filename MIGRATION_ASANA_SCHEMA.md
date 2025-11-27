# Инструкция по миграции схемы Supabase для задач Asana

Этот документ описывает процесс обновления схемы Supabase для поддержки новой бизнес-логики вкладки "Задачи".

## Обзор изменений

### Таблица `asana_tasks` (сырые данные задач)
Добавлены новые поля:
- `completed` (BOOLEAN) — завершена ли задача в Asana
- `due_on` (DATE) — дедлайн задачи (дата, по которой определяется неделя)
- `q` (INTEGER) — количество товаров из поля Q (основной источник)
- `product_source` (TEXT) — источник товара: 'PRINESLI' или 'WAREHOUSE'
- `shot_at` (DATE) — дата из поля "когда сфоткал"
- `processed_at` (DATE) — дата из поля "когда обработал" или `completed_at`
- `week_start_date` (DATE) — понедельник недели по `due_on` (используется для фильтрации)
- `week_shot` (DATE) — понедельник недели по `shot_at`
- `week_processed` (DATE) — понедельник недели по `processed_at`

**Важно:** Поле `week_start_date` критично для работы фронтенда, так как используется в запросах `.eq('week_start_date', weekStartStr)`.

Старое поле `quantity` сохраняется как legacy для обратной совместимости.

### Таблица `asana_stats` (агрегированная статистика)
Добавлены новые поля:
- `week_load` (INTEGER) — суммарный Q задач недели
- `plan` (INTEGER) — динамический план недели (80–100)
- `done_qty` (INTEGER) — KPI "Сделано" с учётом переработки
- `to_shoot_qty` (INTEGER) — объём "Предстоит отснять"
- `on_hand_qty` (INTEGER) — объём товара "Принесли" и/или сфоткан, но не обработан
- `warehouse_qty` (INTEGER) — объём задач "Взять со склада", работа не начата
- `shot_not_processed_qty` (INTEGER) — Q задач с `shot_at`, но без `processed_at`
- `q_errors_count` (INTEGER) — количество проблемных задач недели

Старые поля (`completed_count`, `pending_count`, `total_plan`) сохраняются как legacy для обратной совместимости.

## Порядок применения миграций

### Шаг 1: Резервное копирование (рекомендуется)
Перед применением миграций рекомендуется создать резервную копию таблиц:
```sql
-- Создание резервных копий (опционально)
CREATE TABLE asana_tasks_backup AS SELECT * FROM asana_tasks;
CREATE TABLE asana_stats_backup AS SELECT * FROM asana_stats;
```

### Шаг 2: Применение миграции `asana_tasks`
1. Откройте Supabase Dashboard → SQL Editor
2. Скопируйте содержимое файла `supabase/sql/patch-asana-tasks-schema.sql` (рекомендуется) или `migrate_asana_tasks_schema.sql` из корня проекта
3. Выполните скрипт
4. Убедитесь, что новые колонки созданы:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'asana_tasks' 
ORDER BY ordinal_position;
```

### Шаг 3: Применение миграции `asana_stats`
1. В том же SQL Editor скопируйте содержимое файла `supabase/sql/patch-asana-stats-schema.sql` (рекомендуется) или `migrate_asana_stats_schema.sql` из корня проекта
2. Выполните скрипт
3. Убедитесь, что новые колонки созданы:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'asana_stats' 
ORDER BY ordinal_position;
```

**Альтернатива: Применение всех патчей одним скриптом**

Если вы используете Supabase CLI, можете применить все патчи одним скриптом:
```bash
supabase db execute -f supabase/sql/apply-asana-schema-patches.sql
```

Для Supabase Dashboard выполните скрипты по отдельности (см. выше).

### Шаг 4: Проверка индексов
Убедитесь, что индексы созданы:
```sql
-- Проверка индексов для asana_tasks
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'asana_tasks';

-- Проверка индексов для asana_stats
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'asana_stats';
```

## Идемпотентность

Оба миграционных скрипта идемпотентны: их можно запускать несколько раз без ошибок. Скрипты используют `IF NOT EXISTS` и `ADD COLUMN IF NOT EXISTS`, поэтому повторное выполнение не создаст дубликаты.

## Откат изменений (если необходимо)

Если нужно откатить миграцию, можно удалить новые колонки:
```sql
-- ВНИМАНИЕ: Это удалит данные в новых колонках!
ALTER TABLE asana_tasks 
DROP COLUMN IF EXISTS q,
DROP COLUMN IF EXISTS product_source,
DROP COLUMN IF EXISTS shot_at,
DROP COLUMN IF EXISTS processed_at,
DROP COLUMN IF EXISTS week_shot,
DROP COLUMN IF EXISTS week_processed;

ALTER TABLE asana_stats 
DROP COLUMN IF EXISTS week_load,
DROP COLUMN IF EXISTS plan,
DROP COLUMN IF EXISTS done_qty,
DROP COLUMN IF EXISTS to_shoot_qty,
DROP COLUMN IF EXISTS on_hand_qty,
DROP COLUMN IF EXISTS warehouse_qty,
DROP COLUMN IF EXISTS shot_not_processed_qty,
DROP COLUMN IF EXISTS q_errors_count;
```

## Следующие шаги

После применения миграций:
1. Обновите Edge Function `fetch-asana-stats`, чтобы она заполняла новые поля
2. Обновите фронтенд (`app.js`), чтобы он читал новые поля из `asana_stats`
3. Протестируйте вкладку "Задачи" на наличие ошибок

## Быстрое применение миграций

**Чтобы схема Supabase соответствовала текущему коду, выполните следующие шаги:**

1. Откройте [Supabase Dashboard](https://supabase.com/dashboard) → SQL Editor
2. Скопируйте содержимое файла `supabase/sql/patch-asana-tasks-schema.sql`
3. Вставьте в SQL Editor и выполните (Run или Ctrl+Enter)
4. Скопируйте содержимое файла `supabase/sql/patch-asana-stats-schema.sql`
5. Вставьте в SQL Editor и выполните

**Или через Supabase CLI:**
```bash
supabase db execute -f supabase/sql/patch-asana-tasks-schema.sql
supabase db execute -f supabase/sql/patch-asana-stats-schema.sql
```

**Проверка после применения:**
```bash
supabase db execute -f supabase/sql/verify-schema.sql
```

После применения миграций запрос из `app.js` вида `select=task_name,q,product_source,shot_at,processed_at,due_on,completed,quantity&week_start_date=eq.…` перестанет возвращать ошибку "column asana_tasks.q does not exist" или "column asana_tasks.week_start_date does not exist".

## Дополнительная информация

- Полное описание схемы: `ASANA_INTEGRATION.md` (разделы 2.1 и 2.2)
- Обзор бизнес-логики: `docs/tasks-tab-overview.md` (раздел "Синхронизация схемы Supabase")
- Скрипт создания таблиц с нуля: `create_asana_tasks_table.sql`
- SQL-скрипты патчей: `supabase/sql/` (рекомендуется использовать эти файлы)
- README по SQL-скриптам: `supabase/sql/README.md`
- Инструкция по применению: `supabase/sql/APPLY_MIGRATIONS.md`


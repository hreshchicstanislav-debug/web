# Чек-лист деплоя и тестирования новой логики KPI для вкладки "Задачи"

## Что изменилось

### 1. Edge Function `fetch-asana-stats`

**Изменения в логике расчёта KPI:**

- **`to_shoot_qty`** (теперь означает "Обработать на этой неделе"):
  - Добавлено условие: `processed_at IS NULL`
  - Показывает только задачи текущей недели (по `due_on`), которые нужно обработать (не обработанные)
  - Исключает задачи, которые уже обработаны (даже если не закрыты)

- **`shot_not_processed_qty`** (теперь накопительный долг):
  - Убрано условие: `week_shot = текущая неделя`
  - Добавлено условие: `due_on НЕ в текущей неделе` (или `due_on IS NULL`)
  - Показывает весь накопительный долг по обработке за все время, независимо от недели съёмки

**Файл:** `/Users/stanislav/supabase/functions/fetch-asana-stats/index.ts`

---

### 2. SQL-функция `recalculate_asana_stats_for_week`

**Изменения в логике расчёта:**

- **`to_shoot_qty`**: добавлено условие `processed_at IS NULL` в WHERE-клаузулу
- **`shot_not_processed_qty`**: убрано условие `week_shot = week_start_val`, добавлено условие `(due_on < week_start_val OR due_on > week_end_val OR due_on IS NULL)`

**Файл:** `recalculate_asana_stats_simple.sql`

---

### 3. Frontend (`app.js`)

**Изменения в UI:**

- **Переименование карточки**: "Предстоит отснять" → "Обработать на этой неделе"
  - Заголовок карточки изменён (строка 2142)
  - ID элемента (`pendingCount`) и маппинг данных не изменялись

- **Изменение операционного блока**:
  - Операционный блок теперь содержит только две карточки: "Уже на руках" и "Нужно взять со склада"
  - Карточка "Сфоткано, но не обработано" удалена из операционного блока

- **Новый блок для накопительных показателей**:
  - Создан новый блок `#tasksAccumulatedKpi` с заголовком "Накопительные показатели"
  - Карточка "Сфоткано, но не обработано (накопительный долг)" размещена в этом блоке
  - ID элементов не изменялись (`#kpiShotNotProcessedCard`, `#kpiShotNotProcessedValue`)

**Файл:** `app.js`

---

## Деплой: порядок действий

**⚠️ ВАЖНО: Это инструкция для ручных действий. Никакие команды не выполняются автоматически.**

### Шаг 1: Проверка git-статуса

```bash
cd /Users/stanislav/web
git status
```

**Ожидаемый результат:**
- Видны изменения в `app.js` и `recalculate_asana_stats_simple.sql`
- Возможно, есть изменения в `docs/` (документация)

**Действие:** Закоммитить изменения перед деплоем (если нужно):
```bash
git add app.js recalculate_asana_stats_simple.sql docs/
git commit -m "Обновление логики KPI: новая модель для to_shoot_qty и shot_not_processed_qty"
```

---

### Шаг 2: Локальные проверки (опционально)

**Проверка синтаксиса JavaScript:**
```bash
# Если есть линтер
npm run lint

# Или проверка через node (если установлен)
node -c app.js
```

**Проверка SQL-синтаксиса:**
- Открыть `recalculate_asana_stats_simple.sql` в Supabase SQL Editor
- Нажать "Validate" (если доступно) или выполнить `EXPLAIN` для проверки синтаксиса

**Примечание:** Если линтер или валидатор не настроены, этот шаг можно пропустить.

---

### Шаг 3: Деплой Edge Function в Supabase

**Команда для деплоя:**
```bash
cd /Users/stanislav/supabase
supabase functions deploy fetch-asana-stats
```

**Альтернатива (если нужно указать project-ref явно):**
```bash
supabase functions deploy fetch-asana-stats --project-ref <your-project-ref>
```

**Где найти project-ref:**
- Supabase Dashboard → Settings → General → Reference ID

**Проверка после деплоя:**
1. Открыть Supabase Dashboard → Edge Functions
2. Убедиться, что функция `fetch-asana-stats` обновлена
3. Проверить версию в логах (должна быть `v3.2-tasks-kpi-new-kpi-logic`)

---

### Шаг 4: Применение изменений SQL-функции

**Вариант 1: Через Supabase SQL Editor (рекомендуется)**

1. Открыть [Supabase Dashboard](https://supabase.com/dashboard)
2. Выбрать проект
3. Перейти в **SQL Editor**
4. Открыть файл `recalculate_asana_stats_simple.sql`
5. Скопировать содержимое файла
6. Вставить в SQL Editor
7. Нажать **Run**

**Вариант 2: Через Supabase CLI**

```bash
cd /Users/stanislav/web
supabase db execute -f recalculate_asana_stats_simple.sql
```

**Вариант 3: Ручное выполнение (если нужен контроль)**

1. Открыть Supabase SQL Editor
2. Выполнить только блок `CREATE OR REPLACE FUNCTION recalculate_asana_stats_for_week(...)`
3. Проверить, что функция создана без ошибок:
   ```sql
   SELECT proname, prosrc 
   FROM pg_proc 
   WHERE proname = 'recalculate_asana_stats_for_week';
   ```

**Проверка после применения:**
```sql
-- Проверить, что функция существует и имеет правильную сигнатуру
SELECT 
  proname,
  pg_get_function_arguments(oid) as arguments,
  pg_get_function_result(oid) as returns
FROM pg_proc 
WHERE proname = 'recalculate_asana_stats_for_week';
```

---

### Шаг 5: Деплой frontend (если используется GitHub Pages или другой хостинг)

**Если изменения в `app.js` уже закоммичены и запушены:**
- GitHub Pages обновится автоматически (если настроен автоматический деплой)
- Или выполнить ручной деплой через `deploy.sh` (если есть)

**Проверка:**
- Открыть сайт в браузере
- Перейти на вкладку "Задачи"
- Убедиться, что карточка называется "Обработать на этой неделе"
- Убедиться, что блок "Накопительные показатели" отображается внизу страницы

---

## Рекомендованный порядок: сначала стейджинг/дев, потом прод

### Если есть dev-проект Supabase

**Рекомендуемый порядок:**

1. **Деплой в dev-проект:**
   ```bash
   # Переключиться на dev-проект
   supabase link --project-ref <dev-project-ref>
   
   # Задеплоить Edge Function
   supabase functions deploy fetch-asana-stats
   
   # Применить SQL-функцию
   supabase db execute -f recalculate_asana_stats_simple.sql
   ```

2. **Тестирование в dev:**
   - Выполнить все smoke-тесты (см. раздел ниже)
   - Проверить логи Edge Function на наличие ошибок
   - Убедиться, что значения KPI корректны

3. **Деплой в прод-проект:**
   ```bash
   # Переключиться на прод-проект
   supabase link --project-ref <prod-project-ref>
   
   # Задеплоить Edge Function
   supabase functions deploy fetch-asana-stats
   
   # Применить SQL-функцию
   supabase db execute -f recalculate_asana_stats_simple.sql
   ```

### Если нет dev-проекта (деплой в текущий проект)

**Рекомендуемый порядок:**

1. **Создать бэкап данных:**
   ```sql
   -- Экспорт текущей статистики (опционально, для истории)
   SELECT * FROM asana_stats 
   WHERE week_start_date >= CURRENT_DATE - INTERVAL '14 days'
   ORDER BY week_start_date DESC;
   ```

2. **Деплой Edge Function:**
   ```bash
   cd /Users/stanislav/supabase
   supabase functions deploy fetch-asana-stats
   ```

3. **Применение SQL-функции:**
   - Через Supabase SQL Editor (см. Шаг 4 выше)

4. **Немедленное тестирование:**
   - Выполнить smoke-тесты (см. раздел ниже)
   - Проверить логи Edge Function

5. **Пересчёт статистики для текущей недели:**
   ```sql
   -- Пересчитать статистику для текущей недели с новой логикой
   SELECT * FROM recalculate_asana_stats_for_week();
   ```

---

## Проверки после деплоя (smoke-тесты)

### Тест-кейс 1: "Обработать на этой неделе" — задача без обработки

**Шаги:**
1. Убедиться, что есть задача с `due_on` в текущей неделе
2. Убедиться, что у задачи `processed_at IS NULL`
3. Убедиться, что у задачи `completed != true`
4. Убедиться, что у задачи `q > 0`

**Ожидаемый результат:**
- Задача увеличивает значение в карточке "Обработать на этой неделе"
- Задача НЕ попадает в "Сфоткано, но не обработано (накопительный долг)"
- Сумма `q` таких задач = значение в карточке "Обработать на этой неделе"

**Проверка через SQL:**
```sql
-- Подсчитать задачи, которые должны попасть в "Обработать на этой неделе"
SELECT COALESCE(SUM(q), 0) as expected_to_process_this_week
FROM asana_tasks
WHERE due_on >= DATE_TRUNC('week', CURRENT_DATE)::date + INTERVAL '1 day' * (1 - EXTRACT(DOW FROM DATE_TRUNC('week', CURRENT_DATE)::date))
  AND due_on <= DATE_TRUNC('week', CURRENT_DATE)::date + INTERVAL '1 day' * (1 - EXTRACT(DOW FROM DATE_TRUNC('week', CURRENT_DATE)::date)) + INTERVAL '6 days'
  AND processed_at IS NULL
  AND q > 0
  AND completed != true;

-- Сверить с asana_stats
SELECT to_shoot_qty 
FROM asana_stats 
WHERE week_start_date = DATE_TRUNC('week', CURRENT_DATE)::date + INTERVAL '1 day' * (1 - EXTRACT(DOW FROM DATE_TRUNC('week', CURRENT_DATE)::date))
ORDER BY week_start_date DESC 
LIMIT 1;
```

---

### Тест-кейс 2: "Обработать на этой неделе" — задача уже обработана

**Шаги:**
1. Убедиться, что есть задача с `due_on` в текущей неделе
2. Убедиться, что у задачи `processed_at IS NOT NULL` (уже обработана)
3. Убедиться, что у задачи `completed != true` (но обработана)

**Ожидаемый результат:**
- Задача НЕ увеличивает значение в карточке "Обработать на этой неделе"
- Задача НЕ попадает в "Сфоткано, но не обработано (накопительный долг)"
- Если `completed = true`, задача попадает в "Сделано"

**Проверка через SQL:**
```sql
-- Подсчитать задачи, которые НЕ должны попасть в "Обработать на этой неделе" (уже обработаны)
SELECT COUNT(*) as processed_tasks_count
FROM asana_tasks
WHERE due_on >= DATE_TRUNC('week', CURRENT_DATE)::date + INTERVAL '1 day' * (1 - EXTRACT(DOW FROM DATE_TRUNC('week', CURRENT_DATE)::date))
  AND due_on <= DATE_TRUNC('week', CURRENT_DATE)::date + INTERVAL '1 day' * (1 - EXTRACT(DOW FROM DATE_TRUNC('week', CURRENT_DATE)::date)) + INTERVAL '6 days'
  AND processed_at IS NOT NULL
  AND completed != true
  AND q > 0;

-- Эти задачи не должны влиять на to_shoot_qty
```

---

### Тест-кейс 3: "Сфоткано, но не обработано (накопительный долг)" — задача вне текущей недели

**Шаги:**
1. Убедиться, что есть задача с `shot_at IS NOT NULL` (любая дата, не обязательно текущая неделя)
2. Убедиться, что у задачи `processed_at IS NULL`
3. Убедиться, что у задачи `due_on` НЕ в текущей неделе (или `due_on IS NULL`)
4. Убедиться, что у задачи `completed != true`
5. Убедиться, что у задачи `q > 0`

**Ожидаемый результат:**
- Задача увеличивает значение в карточке "Сфоткано, но не обработано (накопительный долг)"
- Задача НЕ попадает в "Обработать на этой неделе"
- Сумма `q` таких задач = значение в карточке "Сфоткано, но не обработано (накопительный долг)"

**Проверка через SQL:**
```sql
-- Подсчитать задачи, которые должны попасть в накопительный долг
WITH current_week AS (
  SELECT 
    DATE_TRUNC('week', CURRENT_DATE)::date + INTERVAL '1 day' * (1 - EXTRACT(DOW FROM DATE_TRUNC('week', CURRENT_DATE)::date)) as week_start,
    DATE_TRUNC('week', CURRENT_DATE)::date + INTERVAL '1 day' * (1 - EXTRACT(DOW FROM DATE_TRUNC('week', CURRENT_DATE)::date)) + INTERVAL '6 days' as week_end
)
SELECT COALESCE(SUM(q), 0) as expected_shot_not_processed
FROM asana_tasks, current_week
WHERE shot_at IS NOT NULL
  AND processed_at IS NULL
  AND completed != true
  AND q > 0
  AND (
    due_on < current_week.week_start 
    OR due_on > current_week.week_end
    OR due_on IS NULL
  );

-- Сверить с asana_stats (значение должно быть одинаковым для всех недель, так как это накопительный показатель)
SELECT shot_not_processed_qty 
FROM asana_stats 
ORDER BY week_start_date DESC 
LIMIT 1;
```

---

### Тест-кейс 4: Разделение текущей недели и накопительного долга

**Шаги:**
1. Убедиться, что есть задача с `shot_at IS NOT NULL`, `processed_at IS NULL`, `due_on` в текущей неделе
2. Убедиться, что есть задача с `shot_at IS NOT NULL`, `processed_at IS NULL`, `due_on` НЕ в текущей неделе

**Ожидаемый результат:**
- Первая задача попадает в "Обработать на этой неделе" (НЕ в накопительный долг)
- Вторая задача попадает в "Сфоткано, но не обработано (накопительный долг)" (НЕ в "Обработать на этой неделе")
- Одна и та же задача НЕ может попадать в оба показателя одновременно

**Проверка через SQL:**
```sql
-- Проверить, что нет задач, которые попадают в оба показателя одновременно
WITH current_week AS (
  SELECT 
    DATE_TRUNC('week', CURRENT_DATE)::date + INTERVAL '1 day' * (1 - EXTRACT(DOW FROM DATE_TRUNC('week', CURRENT_DATE)::date)) as week_start,
    DATE_TRUNC('week', CURRENT_DATE)::date + INTERVAL '1 day' * (1 - EXTRACT(DOW FROM DATE_TRUNC('week', CURRENT_DATE)::date)) + INTERVAL '6 days' as week_end
)
SELECT COUNT(*) as duplicate_tasks_count
FROM asana_tasks, current_week
WHERE shot_at IS NOT NULL
  AND processed_at IS NULL
  AND completed != true
  AND q > 0
  AND due_on >= current_week.week_start
  AND due_on <= current_week.week_end
  AND (
    due_on < current_week.week_start 
    OR due_on > current_week.week_end
    OR due_on IS NULL
  );

-- Результат должен быть 0 (нет задач, которые попадают в оба показателя)
```

---

### Тест-кейс 5: "Уже на руках" и "Нужно взять со склада" не сломались

**Шаги:**
1. Убедиться, что есть задача с `due_on` в текущей неделе, `product_source = 'PRINESLI'`, `shot_at IS NULL`
2. Убедиться, что есть задача с `due_on` в текущей неделе, `product_source = 'WAREHOUSE'`, `shot_at IS NULL`, `processed_at IS NULL`

**Ожидаемый результат:**
- Первая задача увеличивает значение в карточке "Уже на руках"
- Вторая задача увеличивает значение в карточке "Нужно взять со склада"
- Значения соответствуют ожидаемым (можно проверить через SQL)

**Проверка через SQL:**
```sql
-- Проверить "Уже на руках"
SELECT COALESCE(SUM(q), 0) as expected_on_hand
FROM asana_tasks
WHERE product_source = 'PRINESLI'
  AND completed != true
  AND shot_at IS NULL
  AND due_on >= DATE_TRUNC('week', CURRENT_DATE)::date + INTERVAL '1 day' * (1 - EXTRACT(DOW FROM DATE_TRUNC('week', CURRENT_DATE)::date))
  AND due_on <= DATE_TRUNC('week', CURRENT_DATE)::date + INTERVAL '1 day' * (1 - EXTRACT(DOW FROM DATE_TRUNC('week', CURRENT_DATE)::date)) + INTERVAL '6 days'
  AND q > 0;

-- Проверить "Нужно взять со склада"
SELECT COALESCE(SUM(q), 0) as expected_warehouse
FROM asana_tasks
WHERE product_source = 'WAREHOUSE'
  AND completed != true
  AND shot_at IS NULL
  AND processed_at IS NULL
  AND due_on >= DATE_TRUNC('week', CURRENT_DATE)::date + INTERVAL '1 day' * (1 - EXTRACT(DOW FROM DATE_TRUNC('week', CURRENT_DATE)::date))
  AND due_on <= DATE_TRUNC('week', CURRENT_DATE)::date + INTERVAL '1 day' * (1 - EXTRACT(DOW FROM DATE_TRUNC('week', CURRENT_DATE)::date)) + INTERVAL '6 days'
  AND q > 0;
```

---

### Тест-кейс 6: Завершённая задача не попадает в операционные показатели

**Шаги:**
1. Убедиться, что есть задача с `completed = true`, `processed_at IS NOT NULL`
2. Проверить значения в карточках "Обработать на этой неделе", "Сфоткано, но не обработано", "Уже на руках", "Нужно взять со склада"

**Ожидаемый результат:**
- Завершённая задача НЕ попадает в "Обработать на этой неделе"
- Завершённая задача НЕ попадает в "Сфоткано, но не обработано (накопительный долг)"
- Завершённая задача НЕ попадает в "Уже на руках" и "Нужно взять со склада"
- Завершённая задача попадает в "Сделано" (если `week_processed` = текущая неделя)

---

## Как проверить численно (через SQL)

### Запрос 1: Проверка "Обработать на этой неделе"

```sql
-- Все задачи, которые должны попасть в "Обработать на этой неделе"
WITH current_week AS (
  SELECT 
    DATE_TRUNC('week', CURRENT_DATE)::date + INTERVAL '1 day' * (1 - EXTRACT(DOW FROM DATE_TRUNC('week', CURRENT_DATE)::date)) as week_start,
    DATE_TRUNC('week', CURRENT_DATE)::date + INTERVAL '1 day' * (1 - EXTRACT(DOW FROM DATE_TRUNC('week', CURRENT_DATE)::date)) + INTERVAL '6 days' as week_end
)
SELECT 
  asana_task_gid,
  task_name,
  q,
  due_on,
  shot_at,
  processed_at,
  completed,
  product_source
FROM asana_tasks, current_week
WHERE due_on >= current_week.week_start 
  AND due_on <= current_week.week_end
  AND processed_at IS NULL
  AND q > 0
  AND completed != true
ORDER BY due_on ASC, q DESC;

-- Сумма q этих задач должна совпадать с to_shoot_qty в asana_stats
```

**Сверка с UI:**
- Подсчитать сумму `q` из результата запроса
- Сверить с значением в карточке "Обработать на этой неделе" в UI
- Значения должны совпадать

---

### Запрос 2: Проверка "Сфоткано, но не обработано (накопительный долг)"

```sql
-- Все задачи, которые должны попасть в накопительный долг
WITH current_week AS (
  SELECT 
    DATE_TRUNC('week', CURRENT_DATE)::date + INTERVAL '1 day' * (1 - EXTRACT(DOW FROM DATE_TRUNC('week', CURRENT_DATE)::date)) as week_start,
    DATE_TRUNC('week', CURRENT_DATE)::date + INTERVAL '1 day' * (1 - EXTRACT(DOW FROM DATE_TRUNC('week', CURRENT_DATE)::date)) + INTERVAL '6 days' as week_end
)
SELECT 
  asana_task_gid,
  task_name,
  q,
  due_on,
  shot_at,
  processed_at,
  completed,
  week_shot,
  CASE 
    WHEN due_on < current_week.week_start THEN 'Прошлая неделя или раньше'
    WHEN due_on > current_week.week_end THEN 'Будущая неделя'
    WHEN due_on IS NULL THEN 'Без дедлайна'
    ELSE 'Текущая неделя (не должно быть в результате)'
  END as due_on_status
FROM asana_tasks, current_week
WHERE shot_at IS NOT NULL
  AND processed_at IS NULL
  AND completed != true
  AND q > 0
  AND (
    due_on < current_week.week_start 
    OR due_on > current_week.week_end
    OR due_on IS NULL
  )
ORDER BY shot_at DESC, q DESC;

-- Сумма q этих задач должна совпадать с shot_not_processed_qty в asana_stats
```

**Сверка с UI:**
- Подсчитать сумму `q` из результата запроса
- Сверить с значением в карточке "Сфоткано, но не обработано (накопительный долг)" в UI
- Значения должны совпадать

---

### Запрос 3: Проверка отсутствия дублирования

```sql
-- Проверить, что нет задач, которые попадают и в "Обработать на этой неделе", и в накопительный долг
WITH current_week AS (
  SELECT 
    DATE_TRUNC('week', CURRENT_DATE)::date + INTERVAL '1 day' * (1 - EXTRACT(DOW FROM DATE_TRUNC('week', CURRENT_DATE)::date)) as week_start,
    DATE_TRUNC('week', CURRENT_DATE)::date + INTERVAL '1 day' * (1 - EXTRACT(DOW FROM DATE_TRUNC('week', CURRENT_DATE)::date)) + INTERVAL '6 days' as week_end
),
to_process_this_week AS (
  SELECT asana_task_gid, q, due_on, shot_at, processed_at
  FROM asana_tasks, current_week
  WHERE due_on >= current_week.week_start 
    AND due_on <= current_week.week_end
    AND processed_at IS NULL
    AND q > 0
    AND completed != true
),
accumulated_debt AS (
  SELECT asana_task_gid, q, due_on, shot_at, processed_at
  FROM asana_tasks, current_week
  WHERE shot_at IS NOT NULL
    AND processed_at IS NULL
    AND completed != true
    AND q > 0
    AND (
      due_on < current_week.week_start 
      OR due_on > current_week.week_end
      OR due_on IS NULL
    )
)
SELECT 
  t.asana_task_gid,
  t.task_name,
  t.q,
  t.due_on,
  'Попадает в оба показателя!' as error
FROM asana_tasks t
INNER JOIN to_process_this_week tp ON t.asana_task_gid = tp.asana_task_gid
INNER JOIN accumulated_debt ad ON t.asana_task_gid = ad.asana_task_gid;

-- Результат должен быть пустым (0 строк)
-- Если есть строки — это ошибка логики
```

---

### Запрос 4: Сверка всех KPI с asana_stats

```sql
-- Получить текущую статистику из asana_stats
SELECT 
  week_start_date,
  week_end_date,
  to_shoot_qty as "Обработать на этой неделе",
  shot_not_processed_qty as "Сфоткано, но не обработано (накопительный долг)",
  on_hand_qty as "Уже на руках",
  warehouse_qty as "Нужно взять со склада",
  done_fact_this_week as "Сделано (факт)",
  done_qty as "Сделано (с переработкой)",
  week_load,
  plan,
  remaining_to_plan
FROM asana_stats
WHERE week_start_date = DATE_TRUNC('week', CURRENT_DATE)::date + INTERVAL '1 day' * (1 - EXTRACT(DOW FROM DATE_TRUNC('week', CURRENT_DATE)::date))
ORDER BY week_start_date DESC
LIMIT 1;
```

**Сверка с UI:**
- Сверить каждое значение из результата с соответствующим значением в карточке UI
- Все значения должны совпадать

---

## Откат изменений

### Если новая логика ведёт себя некорректно

#### 1. Откат Edge Function

**Вариант 1: Через git (если есть история коммитов)**

```bash
cd /Users/stanislav/supabase
git log functions/fetch-asana-stats/index.ts
# Найти хеш коммита с предыдущей версией

git checkout <previous-commit-hash> -- functions/fetch-asana-stats/index.ts
supabase functions deploy fetch-asana-stats
```

**Вариант 2: Ручное восстановление**

1. Открыть файл `/Users/stanislav/supabase/functions/fetch-asana-stats/index.ts`
2. Вернуть старую логику:
   - В `computeWeekAggregates()` убрать условие `!task.processed_at` для `toShootQty`
   - Вернуть условие `week_shot = weekStartStr` для `shotNotProcessedQty`
3. Задеплоить:
   ```bash
   cd /Users/stanislav/supabase
   supabase functions deploy fetch-asana-stats
   ```

---

#### 2. Откат SQL-функции

**Вариант 1: Через git**

```bash
cd /Users/stanislav/web
git log recalculate_asana_stats_simple.sql
# Найти хеш коммита с предыдущей версией

git checkout <previous-commit-hash> -- recalculate_asana_stats_simple.sql
# Применить старую версию через Supabase SQL Editor
```

**Вариант 2: Ручное восстановление**

1. Открыть Supabase SQL Editor
2. Выполнить старую версию функции:
   ```sql
   -- Старая логика to_shoot_qty (без processed_at IS NULL)
   -- Старая логика shot_not_processed_qty (с week_shot = week_start_val)
   -- Скопировать из предыдущей версии файла
   ```

---

#### 3. Пересчёт статистики после отката

**Если нужно пересчитать статистику для текущей недели:**

```sql
-- Пересчитать статистику для текущей недели
SELECT * FROM recalculate_asana_stats_for_week();

-- Или для конкретной недели
SELECT * FROM recalculate_asana_stats_for_week('2025-01-13');
```

**Если нужно пересчитать статистику для нескольких недель:**

```sql
-- Пересчитать статистику для последних 4 недель
SELECT * FROM recalculate_asana_stats_for_week(CURRENT_DATE - INTERVAL '0 days');
SELECT * FROM recalculate_asana_stats_for_week(CURRENT_DATE - INTERVAL '7 days');
SELECT * FROM recalculate_asana_stats_for_week(CURRENT_DATE - INTERVAL '14 days');
SELECT * FROM recalculate_asana_stats_for_week(CURRENT_DATE - INTERVAL '21 days');
```

---

#### 4. Откат frontend (если нужно)

**Вариант 1: Через git**

```bash
cd /Users/stanislav/web
git log app.js
# Найти хеш коммита с предыдущей версией

git checkout <previous-commit-hash> -- app.js
git commit -m "Откат изменений UI для вкладки Задачи"
git push origin main
```

**Вариант 2: Ручное восстановление**

1. Открыть файл `app.js`
2. Вернуть старые названия:
   - "Обработать на этой неделе" → "Предстоит отснять"
   - Вернуть карточку "Сфоткано, но не обработано" в операционный блок
   - Убрать блок "Накопительные показатели"
3. Закоммитить и запушеть изменения

---

## Важно

**⚠️ Этот документ — инструкция для ручных действий.**

- Никакие команды деплоя не выполнялись автоматически при создании этого документа
- Никакие изменения в базе данных не применялись автоматически
- Ответственность за выполнение команд и применение изменений лежит на пользователе

**Перед деплоем в прод:**
- Убедитесь, что все изменения протестированы в dev-окружении (если доступно)
- Создайте бэкап данных (если возможно)
- Выполните все smoke-тесты после деплоя
- Проверьте логи Edge Function на наличие ошибок

**После деплоя:**
- Мониторьте значения KPI в течение нескольких дней
- Сравнивайте значения с ожидаемыми (через SQL-запросы)
- При обнаружении проблем используйте раздел "Откат изменений"

---

**Версия документа:** 1.0  
**Дата создания:** 2025-01-XX  
**Статус:** Инструкция для деплоя (не выполнено)


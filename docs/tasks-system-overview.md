# Полный обзор системы вкладки "Задачи"

## 1. Общий обзор архитектуры вкладки "Задачи"

Вкладка "Задачи" (`#/tasks`) представляет собой систему для отслеживания недельного прогресса по задачам Asana. Система состоит из следующих компонентов:

- **Источник данных**: Asana API (проект "Arbuz Контент. Задачи", задачи текущего пользователя)
- **Backend**: Supabase Edge Function `fetch-asana-stats` (синхронизация и расчёт KPI)
- **База данных**: Supabase (таблицы `asana_tasks` и `asana_stats`)
- **Frontend**: PWA на JavaScript (`app.js`), отображение KPI и детальных данных

### Основные сущности

1. **`asana_tasks`** — детальные данные о каждой задаче из Asana
2. **`asana_stats`** — агрегированная статистика по неделям (KPI)
3. **Edge Function `fetch-asana-stats`** — синхронизация с Asana API и расчёт статистики
4. **Frontend функции** — `getAsanaStats()`, `updateTasksCards()`, `renderTasks()`, `getAsanaTasksDetailsByWeekStart()`

---

## 2. Полный путь данных (Asana → Supabase → Edge Function → Frontend → UI)

### 2.1. Поток синхронизации данных

```
Asana API
  ↓
Edge Function fetch-asana-stats
  ↓
  ├─→ Запрос задач через Asana API
  │   GET /tasks?workspace=1208507351529750&project=1210258013776969&assignee=me
  │
  ├─→ Фильтрация по assignee_gid (защитная проверка)
  │
  ├─→ Извлечение кастомных полей:
  │   - Q (количество товаров)
  │   - "Товар" (PRINESLI / WAREHOUSE)
  │   - "когда сфоткал" (shot_at)
  │   - "когда обработал" (processed_at)
  │   - "Тип задачи" (СТМ / НЕ СТМ)
  │   - "Приоритет" (🔥 Срочно / Высокий / Средний)
  │
  ├─→ Вычисление недель:
  │   - week_start_date (понедельник по due_on)
  │   - week_shot (понедельник по shot_at)
  │   - week_processed (понедельник по processed_at)
  │
  ├─→ Upsert в asana_tasks (по asana_task_gid)
  │
  ├─→ Расчёт агрегатов через computeWeekAggregates():
  │   - done_fact_this_week
  │   - to_shoot_qty
  │   - on_hand_qty
  │   - warehouse_qty
  │   - shot_not_processed_qty
  │   - q_errors_count
  │   - done_stm_qty / done_nonstm_qty
  │
  ├─→ Расчёт производных показателей:
  │   - week_load = done_fact_this_week + to_shoot_qty
  │   - plan = computeDynamicPlan(week_load) [80-100]
  │   - carry_over_from_prev (из предыдущей недели)
  │   - done_qty = done_fact_this_week + carry_over_from_prev
  │   - overtime_qty = max(0, done_fact_this_week - plan)
  │   - remaining_to_plan = max(0, plan - done_fact_this_week)
  │
  └─→ Upsert в asana_stats (по week_start_date)
      ↓
      Возврат JSON с агрегатами
      ↓
Frontend getAsanaStats()
  ↓
  ├─→ Нормализация данных (fallback на legacy поля)
  ├─→ Кеширование в cachedTasksStats
  └─→ Обновление UI через updateTasksCards()
```

### 2.2. Триггеры обновления

1. **Ручное обновление**: Кнопка "Обновить данные" → `getAsanaStats()` → Edge Function
2. **Автоматическое обновление**:
   - Webhook от Asana → Edge Function `handle-asana-webhook` → `fetch-asana-stats`
   - Cron job (pg_cron) → `refresh_asana_stats()` → Edge Function (каждые 5 минут)

### 2.3. Защитная фильтрация по исполнителю

**На уровне Asana API:**
- Параметр `assignee=me` в запросе к `/tasks` — первичная фильтрация

**На уровне Edge Function (защитная проверка):**
- Проверка наличия `task.assignee?.gid`
- Если установлена переменная `TIMETRACK_ASSIGNEE_GID`, задачи, где `task.assignee.gid !== TIMETRACK_ASSIGNEE_GID`, отбрасываются
- Логируется количество задач до и после фильтрации

**Важно:** Все расчёты KPI выполняются только по задачам, прошедшим фильтрацию и записанным в `asana_tasks`.

---

## 3. Полное описание всех KPI: формулы, условия, зависимости, SQL

### 3.1. Основные KPI

#### `done_fact_this_week` (фактический объём недели)

**Определение:** Сумма `q` для задач, фактически выполненных в текущей неделе.

**Формула:**
```sql
SELECT COALESCE(SUM(q), 0)
FROM asana_tasks
WHERE q > 0
  AND completed = true
  AND (
    week_processed = week_start_val
    OR week_shot = week_start_val
    OR (completed = true AND completed_at IS NOT NULL AND 
        DATE_TRUNC('week', completed_at::date)::date + INTERVAL '1 day' * (1 - EXTRACT(DOW FROM DATE_TRUNC('week', completed_at::date)::date)) = week_start_val)
  )
```

**Приоритет определения фактической недели:**
1. `week_processed` (если `processed_at` заполнено)
2. `week_shot` (если `processed_at` пусто, но `shot_at` заполнено)
3. Неделя `completed_at` (если задача завершена, но нет `shot_at` и `processed_at`)

**Где считается:**
- Edge Function: `computeWeekAggregates()`, цикл по `factTasks` (строки 443-470)
- SQL функция: `recalculate_asana_stats_simple.sql`, строки 53-81

**Зависимости:**
- Требует нормализации `q` через `normalizeQ()`
- Используется для расчёта `week_load`, `plan`, `overtime_qty`, `done_qty`

---

#### `done_qty` (KPI "Сделано")

**Определение:** Итоговое значение карточки "Сделано", включающее переработку с прошлой недели.

**Формула:**
```javascript
done_qty = done_fact_this_week + carry_over_from_prev
```

**Где считается:**
- Edge Function: строка 853 (`done_qty = done_fact_this_week + carry_over_from_prev`)
- SQL функция: `recalculate_asana_stats_simple.sql`, строка 193
- Frontend: `app.js`, строки 1894, 1950, 2065 (нормализация)

**Использование:**
- Отображается в карточке "Сделано" (`#completedCount`)
- Используется для расчёта `remaining_to_plan` на фронтенде

---

#### `to_shoot_qty` (предстоит отснять)

**Определение:** Сумма `q` незавершённых задач, чьё `due_on` попадает в текущую неделю.

**Формула:**
```sql
SELECT COALESCE(SUM(q), 0)
FROM asana_tasks
WHERE due_on >= week_start_val 
  AND due_on <= week_end_val
  AND q > 0
  AND completed != true
```

**Где считается:**
- Edge Function: `computeWeekAggregates()`, цикл по `planTasks` (строки 473-499)
- SQL функция: `recalculate_asana_stats_simple.sql`, строки 84-90

**Особенности:**
- Использует **плановую неделю** (`due_on`), а не фактическую
- Включает все незавершённые задачи недели по дедлайну

---

#### `week_load` (недельная нагрузка)

**Определение:** Совокупный объём недели (фактически сделанное + плановые остатки).

**Формула:**
```javascript
week_load = done_fact_this_week + to_shoot_qty
```

**Где считается:**
- Edge Function: `computeWeekAggregates()`, строка 504
- SQL функция: `recalculate_asana_stats_simple.sql`, строка 93
- Frontend: `app.js`, строка 2069 (fallback: `doneFact + toShootQty`)

**Использование:**
- Используется для расчёта динамического плана (`plan`)

---

#### `plan` (динамический план недели)

**Определение:** Динамический план в диапазоне 80-100, вычисляется от `week_load`.

**Формула:**
```javascript
function computeDynamicPlan(weekLoad) {
  if (weekLoad <= 80) return 80;
  if (weekLoad <= 100) return weekLoad;
  return 100;
}
```

**Где считается:**
- Edge Function: `computeDynamicPlan(weekLoad: number)` (строка 516)
- SQL функция: `recalculate_asana_stats_simple.sql`, строки 96-102

**Важно:** На фронтенде план принудительно устанавливается в 80 (строка 1904, 1955, 2068), переопределяя значение из backend.

---

#### `remaining_to_plan` (остаток до плана)

**Определение:** Сколько товаров осталось до выполнения плана.

**Формула (Backend):**
```javascript
remaining_to_plan = max(0, plan - done_fact_this_week)
```

**Формула (Frontend):**
```javascript
remaining_to_plan = max(0, plan - done_qty)
```

**Где считается:**
- Edge Function: строка 830 (`GREATEST(0, plan_val - done_fact)`)
- SQL функция: `recalculate_asana_stats_simple.sql`, строка 162
- Frontend: `app.js`, строки 1915, 1959, 2073 (`Math.max(plan - doneQty, 0)`)

**Несоответствие:** Backend использует `done_fact_this_week`, frontend использует `done_qty` (с учётом `carry_over_from_prev`). Frontend переопределяет значение backend.

---

#### `overtime_qty` (переработка текущей недели)

**Определение:** Объём переработки сверх плана текущей недели.

**Формула:**
```javascript
overtime_qty = max(0, done_fact_this_week - plan)
```

**Где считается:**
- Edge Function: строка 831 (`GREATEST(0, (done_fact + carry_over_val) - plan_val)`)
- SQL функция: `recalculate_asana_stats_simple.sql`, строка 163

**Использование:**
- Сохраняется в `asana_stats.overtime_qty`
- Используется как `carry_over_from_prev` для следующей недели

---

#### `carry_over_from_prev` (переработка с прошлой недели)

**Определение:** Объём переработки, который пришёл из прошлой недели (может быть отрицательным, если это долг).

**Формула:**
```sql
SELECT COALESCE(prev_stats.carry_over_from_prev, prev_stats.overtime_qty, 0)
FROM asana_stats prev_stats
WHERE prev_stats.week_start_date = prev_week_start_val
LIMIT 1
```

**Где считается:**
- Edge Function: строки 833-851 (запрос к БД)
- SQL функция: `recalculate_asana_stats_simple.sql`, строки 108-112

**Особенности:**
- Может быть отрицательным (долг) или положительным (переработка)
- Добавляется к `done_fact_this_week` для получения `done_qty`

---

### 3.2. Вторичные показатели

#### `on_hand_qty` (уже на руках)

**Определение:** Сумма `q` задач недели по `due_on`, где товар принесли, но ещё не сфотографировали.

**Формула:**
```sql
SELECT COALESCE(SUM(q), 0)
FROM asana_tasks
WHERE product_source = 'PRINESLI'
  AND completed != true
  AND shot_at IS NULL
  AND due_on >= week_start_val
  AND due_on <= week_end_val
  AND q > 0
```

**Где считается:**
- Edge Function: `computeWeekAggregates()`, цикл по `planTasks` (строка 487)
- SQL функция: `recalculate_asana_stats_simple.sql`, строки 115-123

**Логика:**
- Использует **плановую неделю** (`due_on`)
- Товар считается "на руках", если он принесён (`PRINESLI`), но ещё не сфотографирован (`shot_at IS NULL`)

---

#### `warehouse_qty` (нужно взять со склада)

**Определение:** Сумма `q` задач недели по `due_on`, где товар нужно взять со склада, и работа ещё не начата.

**Формула:**
```sql
SELECT COALESCE(SUM(q), 0)
FROM asana_tasks
WHERE product_source = 'WAREHOUSE'
  AND completed != true
  AND shot_at IS NULL
  AND processed_at IS NULL
  AND due_on >= week_start_val
  AND due_on <= week_end_val
  AND q > 0
```

**Где считается:**
- Edge Function: `computeWeekAggregates()`, цикл по `planTasks` (строки 491-496)
- SQL функция: `recalculate_asana_stats_simple.sql`, строки 126-135

**Логика:**
- Использует **плановую неделю** (`due_on`)
- Товар считается "на складе", если работа не начата (`shot_at IS NULL` и `processed_at IS NULL`)

---

#### `shot_not_processed_qty` (сфоткано, но не обработано)

**Определение:** Сумма `q` задач, где `shot_at` заполнено, `processed_at` пусто, задача не завершена.

**Формула (текущая):**
```sql
SELECT COALESCE(SUM(q), 0)
FROM asana_tasks
WHERE shot_at IS NOT NULL
  AND processed_at IS NULL
  AND completed != true
  AND week_shot = week_start_val
  AND q > 0
```

**Где считается:**
- Edge Function: `computeWeekAggregates()`, цикл по `factTasks` (строки 453-460)
- SQL функция: `recalculate_asana_stats_simple.sql`, строки 138-145

**Особенности:**
- Использует **фактическую неделю** (`week_shot`)
- Показывает только задачи, сфотографированные **на этой неделе**

**Проблема:** Не включает задачи, сфотографированные ранее, но не обработанные (если их `due_on` перенесён на будущее).

---

#### `q_errors_count` (ошибки Q)

**Определение:** Количество задач недели, где `q <= 0` или `q IS NULL`, но задача попадает в план или факт.

**Формула:**
```sql
SELECT COUNT(DISTINCT asana_task_gid)
FROM asana_tasks
WHERE (
  due_on >= week_start_val AND due_on <= week_end_val
  OR week_shot = week_start_val
  OR week_processed = week_start_val
)
AND (q IS NULL OR q <= 0)
```

**Где считается:**
- Edge Function: `computeWeekAggregates()`, трекинг ошибок через `trackQError(task)` (строки 436-441, 468-470, 478-480)
- SQL функция: `recalculate_asana_stats_simple.sql`, строки 148-156

---

#### `done_stm_qty` / `done_nonstm_qty` (разбивка по типу задачи)

**Определение:** Количество товаров, сделанных по задачам типа "СТМ" и "НЕ СТМ".

**Формула:**
```sql
-- done_stm_qty
SELECT COALESCE(SUM(CASE WHEN task_type_label = 'СТМ' THEN q ELSE 0 END), 0)
FROM fact_tasks
WHERE fact_week = week_start_val;

-- done_nonstm_qty
SELECT COALESCE(SUM(CASE WHEN task_type_label != 'СТМ' OR task_type_label IS NULL THEN q ELSE 0 END), 0)
FROM fact_tasks
WHERE fact_week = week_start_val;
```

**Где считается:**
- Edge Function: `computeWeekAggregates()`, цикл по `factTasks` (строки 77-78)
- SQL функция: `recalculate_asana_stats_simple.sql`, строки 77-78

**Использование:**
- Отображается в мета-информации карточки "Сделано" (`#doneStmNonStmMeta`)

---

## 4. Где в коде считаются каждое из KPI (строки, файлы)

### 4.1. Edge Function (`supabase/functions/fetch-asana-stats/index.ts`)

**Примечание:** Полный код Edge Function находится вне репозитория `/Users/stanislav/web`, но логика описана в документации.

**Основные функции:**

1. **`normalizeQ(value: any): number`** (строка 112)
   - Нормализует значение `q` (число, строка → число, иначе → 0)

2. **`getFactWeek(task)`** (строки 154-168)
   - Определяет фактическую неделю задачи по приоритету: `week_processed` → `week_shot` → неделя `completed_at`

3. **`computeWeekAggregates()`** (строка 423)
   - Расчёт всех агрегатов по текущей неделе
   - Цикл по `factTasks` (строки 443-470): `done_fact_this_week`, `shot_not_processed_qty`, `done_stm_qty`, `done_nonstm_qty`
   - Цикл по `planTasks` (строки 473-499): `to_shoot_qty`, `on_hand_qty`, `warehouse_qty`
   - Трекинг ошибок: `trackQError(task)` (строки 436-441, 468-470, 478-480)

4. **`computeDynamicPlan(weekLoad: number)`** (строка 516)
   - Расчёт динамического плана 80-100

5. **Основной обработчик** (строки 800-900)
   - Получение `carry_over_from_prev` (строки 833-851)
   - Расчёт `done_qty` (строка 853)
   - Расчёт `overtime_qty` (строка 831)
   - Расчёт `remaining_to_plan` (строка 830)
   - Upsert в `asana_stats` (строки 860-900)

---

### 4.2. SQL функции

#### `recalculate_asana_stats_simple.sql`

**Функция:** `recalculate_asana_stats_for_week(target_date DATE DEFAULT CURRENT_DATE)`

**Расчёт KPI:**

1. **`done_fact_this_week`** (строки 53-81)
   - CTE `fact_tasks` с определением `fact_week`
   - Сумма `q` для задач, где `fact_week = week_start_val`

2. **`to_shoot_qty`** (строки 84-90)
   - Сумма `q` для задач с `due_on` в текущей неделе, `completed != true`

3. **`week_load`** (строка 93)
   - `done_fact + to_shoot`

4. **`plan`** (строки 96-102)
   - Динамический план 80-100

5. **`carry_over_from_prev`** (строки 108-112)
   - Запрос к `asana_stats` предыдущей недели

6. **`on_hand_qty`** (строки 115-123)
   - Сумма `q` для задач `PRINESLI` с `due_on` в текущей неделе, `shot_at IS NULL`

7. **`warehouse_qty`** (строки 126-135)
   - Сумма `q` для задач `WAREHOUSE` с `due_on` в текущей неделе, работа не начата

8. **`shot_not_processed_qty`** (строки 138-145)
   - Сумма `q` для задач с `week_shot = week_start_val`, `processed_at IS NULL`

9. **`q_errors_count`** (строки 148-156)
   - Количество задач с `q IS NULL` или `q <= 0`

10. **`remaining_to_plan`** (строка 162)
    - `GREATEST(0, plan_val - done_fact)`

11. **`overtime_qty`** (строка 163)
    - `GREATEST(0, (done_fact + carry_over_val) - plan_val)`

12. **Upsert в `asana_stats`** (строки 167-222)

---

### 4.3. Frontend (`app.js`)

#### `getAsanaStats()` (строки 1857-1942)

**Назначение:** Получение статистики из Edge Function и нормализация данных.

**Ключевые строки:**
- 1863-1865: Вызов Edge Function через `supabaseClient.functions.invoke('fetch-asana-stats')`
- 1892-1894: Извлечение `done_fact_this_week`, `carry_over_from_prev`, `done_qty`
- 1904: Принудительная установка `plan = 80` (переопределение backend)
- 1915: Расчёт `remainingToPlan = Math.max(80 - doneQty, 0)` (переопределение backend)
- 1928: Кеширование в `cachedTasksStats`

---

#### `updateTasksCards(stats)` (строки 1946-2018)

**Назначение:** Обновление значений в карточках без пересоздания HTML.

**Ключевые строки:**
- 1947-1950: Извлечение и нормализация `doneFact`, `carryOver`, `doneQty`
- 1955: Принудительная установка `plan = 80`
- 1959: Расчёт `remainingToPlan = Math.max(plan - doneQty, 0)`
- 1968-1994: Обновление DOM элементов карточек

---

#### `renderTasks()` (строки 2037-2387)

**Назначение:** Рендеринг страницы "Задачи" с карточками KPI.

**Ключевые строки:**
- 2061-2080: Извлечение и нормализация всех показателей
- 2068: Принудительная установка `plan = 80`
- 2073: Расчёт `remainingToPlan = Math.max(plan - doneQty, 0)`
- 2082-2214: Генерация HTML с карточками
- 2219-2235: Вызов `updateTasksCards()` для обновления значений

---

#### `getAsanaTasksDetailsByWeekStart(weekStartStr)` (строки 2665-2722)

**Назначение:** Получение детальных данных о задачах по неделе из `asana_tasks`.

**Ключевые строки:**
- 2679-2685: Запрос к Supabase с фильтрацией по `week_shot`, `week_processed`, `week_start_date`
- 2698-2702: Вычисление `hasQError` и `operationalStatus` для каждой задачи

---

## 5. Структура таблиц Supabase (asana_tasks, asana_stats)

### 5.1. Таблица `asana_tasks`

**Назначение:** Детальная информация о каждой задаче из Asana.

**SQL схема:** `create_asana_tasks_table.sql`

**Ключевые поля:**

| Поле | Тип | Описание |
|------|-----|----------|
| `asana_task_gid` | TEXT (UNIQUE) | GID задачи из Asana (PRIMARY KEY) |
| `task_name` | TEXT | Название задачи |
| `completed` | BOOLEAN | Завершена ли задача |
| `completed_at` | TIMESTAMPTZ | Дата завершения задачи |
| `due_on` | DATE | Дедлайн задачи (используется для плановых KPI) |
| `q` | INTEGER | Количество товаров из поля Q (основной источник) |
| `quantity` | INTEGER | Legacy: старое поле "Кол-во товаров" |
| `product_source` | TEXT | Источник товара: 'PRINESLI' или 'WAREHOUSE' |
| `shot_at` | DATE | Дата из поля "когда сфоткал" |
| `processed_at` | DATE | Дата из поля "когда обработал" или `completed_at` |
| `week_start_date` | DATE (NOT NULL) | Понедельник недели по `due_on` (ключ для плановых KPI) |
| `week_shot` | DATE | Понедельник недели по `shot_at` (для фактических KPI) |
| `week_processed` | DATE | Понедельник недели по `processed_at` (для фактических KPI) |
| `assignee_gid` | TEXT | GID исполнителя (User ID: 1210252517070407) |
| `task_type_gid` | TEXT | GID значения enum-поля "Тип задачи" |
| `task_type_label` | TEXT | Человекочитаемое значение типа задачи (СТМ / НЕ СТМ) |
| `priority_gid` | TEXT | GID значения enum-поля "Приоритет" |
| `priority_label` | TEXT | Человекочитаемое значение приоритета (🔥 Срочно / Высокий / Средний) |
| `created_at` | TIMESTAMPTZ | Время создания записи |
| `updated_at` | TIMESTAMPTZ | Время последнего обновления |

**Индексы:**
- `idx_asana_tasks_asana_gid` на `asana_task_gid`
- `idx_asana_tasks_week_start` на `week_start_date`
- `idx_asana_tasks_completed` на `completed`
- `idx_asana_tasks_due_on` на `due_on`
- `idx_asana_tasks_q` на `q` (WHERE q IS NOT NULL)
- `idx_asana_tasks_product_source` на `product_source` (WHERE product_source IS NOT NULL)
- `idx_asana_tasks_shot_at` на `shot_at` (WHERE shot_at IS NOT NULL)
- `idx_asana_tasks_processed_at` на `processed_at` (WHERE processed_at IS NOT NULL)
- `idx_asana_tasks_week_shot` на `week_shot` (WHERE week_shot IS NOT NULL)
- `idx_asana_tasks_week_processed` на `week_processed` (WHERE week_processed IS NOT NULL)

**RLS политики:**
- SELECT: все могут читать (`Anyone can read asana_tasks`)
- INSERT/UPDATE/DELETE: только service_role через Edge Function

---

### 5.2. Таблица `asana_stats`

**Назначение:** Агрегированная статистика по неделям. Одна запись на неделю.

**SQL схема:** `migrate_asana_stats_schema.sql`

**Ключевые поля:**

| Поле | Тип | Описание |
|------|-----|----------|
| `week_start_date` | DATE (UNIQUE) | Понедельник недели (PRIMARY KEY) |
| `week_end_date` | DATE | Воскресенье недели |
| `week_load` | INTEGER | Недельная нагрузка: `done_fact_this_week + to_shoot_qty` |
| `plan` | INTEGER | Динамический план недели (80-100) |
| `done_qty` | INTEGER | KPI "Сделано": `done_fact_this_week + carry_over_from_prev` |
| `to_shoot_qty` | INTEGER | Объём "Предстоит отснять" |
| `on_hand_qty` | INTEGER | Объём товара "Принесли", ещё не сфотографированного |
| `warehouse_qty` | INTEGER | Объём задач "Взять со склада", работа не начата |
| `shot_not_processed_qty` | INTEGER | Q задач с `shot_at`, но без `processed_at` |
| `q_errors_count` | INTEGER | Количество задач с проблемами по Q |
| `done_stm_qty` | INTEGER | Количество товаров, сделанных по задачам типа "СТМ" |
| `done_nonstm_qty` | INTEGER | Количество товаров, сделанных по задачам типа "НЕ СТМ" |
| `remaining_to_plan` | INTEGER | Остаток до выполнения плана: `max(0, plan - done_fact_this_week)` |
| `overtime_qty` | INTEGER | Переработка текущей недели: `max(0, done_fact_this_week - plan)` |
| `carry_over_from_prev` | INTEGER | Переработка с прошлой недели (может быть отрицательным) |
| `done_fact_this_week` | INTEGER | Фактический объём недели (вычисляемый, не сохраняется в БД) |
| `completed_count` | INTEGER | Legacy: отснято на неделе (= `done_qty`) |
| `pending_count` | INTEGER | Legacy: предстоит отснять (= `to_shoot_qty`) |
| `total_plan` | INTEGER | Legacy: запланировано товаров (= `week_load`) |
| `updated_at` | TIMESTAMPTZ | Время последнего обновления |
| `version` | STRING | Версия Edge Function (например, "v3.1-tasks-kpi") |

**Индексы:**
- `idx_asana_stats_week_start` на `week_start_date`

**RLS политики:**
- SELECT: все могут читать (`Anyone can read asana_stats`)
- INSERT/UPDATE/DELETE: только service_role через Edge Function

**Миграции:**
- `sql/migrate_asana_stats_add_done_debt.sql` — добавление полей `done_week`, `debt_week` (для будущей логики)
- `sql/migrate_asana_stats_add_stm_split.sql` — добавление полей `done_stm_qty`, `done_nonstm_qty`

---

## 6. Как week_shot / week_processed вычисляются

### 6.1. Вычисление `week_shot`

**Определение:** Понедельник недели, к которой относится `shot_at`.

**Формула:**
```javascript
function getWeekStart(date) {
  if (!date) return null;
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Понедельник
  const monday = new Date(d.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday.toISOString().split('T')[0]; // 'YYYY-MM-DD'
}

week_shot = getWeekStart(shot_at);
```

**SQL эквивалент:**
```sql
week_shot = DATE_TRUNC('week', shot_at::date)::date + INTERVAL '1 day' * (1 - EXTRACT(DOW FROM DATE_TRUNC('week', shot_at::date)::date))
```

**Где вычисляется:**
- Edge Function: при обработке задач из Asana API
- SQL: при upsert в `asana_tasks` (через триггер или вычисление в Edge Function)

---

### 6.2. Вычисление `week_processed`

**Определение:** Понедельник недели, к которой относится `processed_at`.

**Формула:**
```javascript
week_processed = getWeekStart(processed_at);
```

**Особенность:** Если `processed_at` пусто, но `completed = true`, используется `completed_at`:
```javascript
processed_at = task.custom_fields.find(f => f.name === 'когда обработал')?.date_value 
  || (task.completed ? task.completed_at : null);
week_processed = getWeekStart(processed_at);
```

**Где вычисляется:**
- Edge Function: при обработке задач из Asana API
- SQL: при upsert в `asana_tasks`

---

### 6.3. Вычисление `week_start_date`

**Определение:** Понедельник недели по `due_on` (используется для плановых KPI).

**Формула:**
```javascript
week_start_date = getWeekStart(due_on);
```

**Где вычисляется:**
- Edge Function: при обработке задач из Asana API
- SQL: при upsert в `asana_tasks`

---

## 7. Как UI интерпретирует данные

### 7.1. Нормализация данных на фронтенде

**Функция:** `getAsanaStats()` в `app.js` (строки 1857-1942)

**Процесс:**

1. **Вызов Edge Function:**
   ```javascript
   const { data: result, error } = await supabaseClient.functions.invoke('fetch-asana-stats', { body: {} });
   ```

2. **Извлечение данных:**
   ```javascript
   const doneFactThisWeek = data.done_fact_this_week ?? 0;
   const carryOverFromPrev = data.carry_over_from_prev ?? 0;
   const doneQty = data.done_qty ?? doneFactThisWeek + carryOverFromPrev;
   ```

3. **Переопределение значений:**
   ```javascript
   plan: 80, // Принудительно 80, игнорируя backend
   remainingToPlan: Math.max(80 - doneQty, 0), // Пересчёт с учётом done_qty
   ```

4. **Fallback на legacy поля:**
   ```javascript
   completedCount: data.completed_count ?? 0,
   pendingCount: data.pending_count ?? 0,
   totalPlan: data.total_plan ?? 0,
   ```

5. **Кеширование:**
   ```javascript
   cachedTasksStats = normalizedStats;
   ```

---

### 7.2. Отображение в карточках

**Функция:** `updateTasksCards(stats)` в `app.js` (строки 1946-2018)

**Маппинг полей:**

| Поле stats | DOM элемент | Описание |
|------------|-------------|----------|
| `doneQty` | `#completedCount` | Основное значение карточки "Сделано" |
| `doneFactThisWeek` | `#doneFactValue` | Мета-информация "Факт" |
| `carryOverFromPrev` | `#carryOverValue` | Мета-информация "Переработка с прошлой недели" |
| `doneStmQty` / `doneNonStmQty` | `#doneStmNonStmMeta` | Мета-информация "СТМ: X / НЕ СТМ: Y" |
| `toShootQty` | `#pendingCount` | Карточка "Предстоит отснять" |
| `plan` | `#planValue` | Карточка "План недели" |
| `weekLoad` | `#weekLoadValue` | Мета-информация "Нагрузка недели" |
| `remainingToPlan` | `#remainingCount` | Карточка "До выполнения плана" |
| `overtimeQty` | `#overtimeQty` | Карточка "Переработка недели" |
| `onHandQty` | `#kpiOnHandValue` | Карточка "Уже на руках" |
| `warehouseQty` | `#kpiWarehouseValue` | Карточка "Нужно взять со склада" |
| `shotNotProcessedQty` | `#kpiShotNotProcessedValue` | Карточка "Сфоткано, но не обработано" |
| `qErrorsCount` | `#tasksOperationalKpi p` | Подпись "Задач с ошибкой Q: X" |

---

### 7.3. Детальный список задач

**Функция:** `getAsanaTasksDetailsByWeekStart(weekStartStr)` в `app.js` (строки 2665-2722)

**Запрос к Supabase:**
```javascript
const { data: rows, error } = await supabaseClient
  .from('asana_tasks')
  .select('task_name, q, product_source, shot_at, processed_at, completed_at, due_on, week_start_date, completed, project_gid, assignee_gid, task_type_label, task_type_gid, priority_label, priority_gid')
  .or(`week_shot.eq.${weekStartStr},week_processed.eq.${weekStartStr},week_start_date.eq.${weekStartStr}`)
  .order('processed_at', { ascending: false })
  .order('shot_at', { ascending: false })
  .order('due_on', { ascending: true });
```

**Обработка данных:**
- Вычисление `hasQError` (строка 2700): `row.q == null || Number(row.q) <= 0`
- Вычисление `operationalStatus` (строка 2701): через `computeOperationalStatus(row)`

**Фильтрация:**
- Режим: "Только операционные" / "Все задачи"
- Тип товара: "СТМ" / "НЕ СТМ" / "Все"
- Приоритет: "🔥 Срочно" / "Высокий" / "Средний" / "Все"
- Показать выполненные задачи недели (чекбокс)
- Показать только задачи с ошибкой Q (чекбокс)
- Статус: "on_hand" / "warehouse" / "shot_not_processed" / "completed" / "other" / "all"

---

## 8. Все найденные несоответствия между backend и frontend

### 8.1. План недели (`plan`)

**Backend:**
- Динамический план 80-100, вычисляется от `week_load`
- Формула: `if (week_load <= 80) return 80; if (week_load <= 100) return week_load; return 100;`

**Frontend:**
- Принудительно устанавливается в 80 (строки 1904, 1955, 2068)
- Игнорирует значение из backend

**Проблема:** Frontend переопределяет логику backend, что может привести к несоответствию между `remaining_to_plan` на backend и frontend.

---

### 8.2. Остаток до плана (`remaining_to_plan`)

**Backend:**
- Формула: `remaining_to_plan = max(0, plan - done_fact_this_week)`
- Использует `done_fact_this_week` (без учёта `carry_over_from_prev`)

**Frontend:**
- Формула: `remaining_to_plan = max(0, plan - done_qty)`
- Использует `done_qty = done_fact_this_week + carry_over_from_prev`

**Проблема:** Frontend пересчитывает `remaining_to_plan` с учётом долга/переработки, что может отличаться от значения backend.

**Обоснование:** Пользователь хочет видеть остаток до плана с учётом долга с прошлой недели, поэтому frontend переопределяет значение.

---

### 8.3. Нормализация полей

**Backend:**
- Возвращает поля в snake_case: `done_fact_this_week`, `carry_over_from_prev`, `done_qty`, `to_shoot_qty`, `week_load`, `plan`, `remaining_to_plan`, `on_hand_qty`, `warehouse_qty`, `shot_not_processed_qty`, `q_errors_count`, `done_stm_qty`, `done_nonstm_qty`

**Frontend:**
- Нормализует в camelCase: `doneFactThisWeek`, `carryOverFromPrev`, `doneQty`, `toShootQty`, `weekLoad`, `plan`, `remainingToPlan`, `onHandQty`, `warehouseQty`, `shotNotProcessedQty`, `qErrorsCount`, `doneStmQty`, `doneNonStmQty`
- Поддерживает fallback на оба формата (snake_case и camelCase)

**Проблема:** Нет, это нормальная практика нормализации данных.

---

## 9. Все найденные проблемы текущей логики

### 9.1. Проблема с `shot_not_processed_qty`

**Текущая логика:**
- Показывает только задачи, сфотографированные **на этой неделе** (`week_shot = текущая неделя`)
- Не включает задачи, сфотографированные ранее, но не обработанные (если их `due_on` перенесён на будущее)

**Пример проблемы:**
- Задача сфотографирована на прошлой неделе, но не обработана
- `due_on` перенесён на месяц вперёд (т.к. нет времени заниматься сейчас)
- Задача не попадает в "Сфоткано, но не обработано" для текущей недели

**Предложение пользователя:**
- Переименовать "Предстоит отснять" → "Обработать на этой неделе"
- Изменить "Сфоткано, но не обработано" на накопительный показатель (все сфотографированные, но не обработанные задачи, независимо от недели)

---

### 9.2. Несоответствие между планом на backend и frontend

**Проблема:**
- Backend вычисляет динамический план 80-100
- Frontend принудительно устанавливает план в 80
- Это может привести к несоответствию между `remaining_to_plan` на backend и frontend

**Решение:**
- Либо backend должен всегда возвращать план = 80
- Либо frontend должен использовать план из backend

---

### 9.3. Несоответствие между `remaining_to_plan` на backend и frontend

**Проблема:**
- Backend использует `done_fact_this_week` для расчёта `remaining_to_plan`
- Frontend использует `done_qty` (с учётом `carry_over_from_prev`)
- Это может привести к разным значениям

**Обоснование:**
- Пользователь хочет видеть остаток до плана с учётом долга/переработки
- Frontend переопределяет значение backend

**Решение:**
- Либо backend должен использовать `done_qty` для расчёта `remaining_to_plan`
- Либо frontend должен использовать `done_fact_this_week` (но это не соответствует требованиям пользователя)

---

### 9.4. Определение фактической недели

**Текущая логика:**
- Приоритет: `week_processed` → `week_shot` → неделя `completed_at`

**Проблема:**
- Если задача завершена (`completed = true`), но нет `shot_at` и `processed_at`, используется `completed_at`
- Это может привести к тому, что задача попадает в неправильную неделю

**Решение:**
- Логика корректна, но нужно убедиться, что Edge Function правильно заполняет `processed_at` из `completed_at` при `completed = true`

---

### 9.5. Нормализация поля `q`

**Текущая логика:**
- Функция `normalizeQ()` возвращает 0 для `null`, пустых строк, нечисловых значений

**Проблема:**
- Если `q` в БД хранится как `NULL`, функция возвращает `0`
- Это означает, что задача с `q = NULL` не учитывается в расчётах, но может попасть в `q_errors_count`

**Решение:**
- Логика корректна, но нужно убедиться, что задачи с `q = NULL` правильно отслеживаются в `q_errors_count`

---

## 10. Краткий вывод: как сейчас работает система

### 10.1. Архитектура

Система состоит из трёх основных компонентов:

1. **Asana API** — источник данных (задачи проекта "Arbuz Контент. Задачи")
2. **Supabase Edge Function `fetch-asana-stats`** — синхронизация и расчёт KPI
3. **Frontend PWA** — отображение статистики и детальных данных

### 10.2. Поток данных

1. **Синхронизация:**
   - Edge Function запрашивает задачи из Asana API
   - Фильтрует по исполнителю (защитная проверка)
   - Извлекает кастомные поля (Q, Товар, когда сфоткал, когда обработал)
   - Вычисляет недели (`week_start_date`, `week_shot`, `week_processed`)
   - Upsert в `asana_tasks`

2. **Расчёт KPI:**
   - Edge Function запрашивает задачи из `asana_tasks`
   - Разделяет на `factTasks` (фактические даты) и `planTasks` (плановые даты)
   - Расчёт агрегатов через `computeWeekAggregates()`
   - Расчёт производных показателей (`week_load`, `plan`, `done_qty`, `overtime_qty`, `remaining_to_plan`)
   - Upsert в `asana_stats`

3. **Отображение:**
   - Frontend вызывает Edge Function через `getAsanaStats()`
   - Нормализует данные (snake_case → camelCase, fallback на legacy)
   - Переопределяет `plan = 80` и `remaining_to_plan = max(0, 80 - done_qty)`
   - Обновляет UI через `updateTasksCards()`

### 10.3. Ключевые особенности

1. **Разделение плановых и фактических KPI:**
   - Плановые (`to_shoot_qty`, `on_hand_qty`, `warehouse_qty`) используют `due_on` / `week_start_date`
   - Фактические (`done_fact_this_week`, `done_qty`, `shot_not_processed_qty`) используют `shot_at` / `processed_at` / `completed_at`

2. **Переработка между неделями:**
   - `overtime_qty = max(0, done_fact_this_week - plan)` переносится в следующую неделю
   - `carry_over_from_prev` добавляется к `done_fact_this_week` для получения `done_qty`

3. **Нормализация данных:**
   - `normalizeQ()` нормализует значение `q` (число, строка → число, иначе → 0)
   - Frontend нормализует поля (snake_case → camelCase, fallback на legacy)

4. **Кеширование:**
   - Frontend кеширует статистику в `cachedTasksStats` для быстрого отображения
   - Детальные данные кешируются в `cachedTasksDetails`

### 10.4. Известные проблемы

1. **Несоответствие плана:** Backend вычисляет динамический план 80-100, frontend принудительно устанавливает 80
2. **Несоответствие `remaining_to_plan`:** Backend использует `done_fact_this_week`, frontend использует `done_qty`
3. **Проблема с `shot_not_processed_qty`:** Показывает только задачи, сфотографированные на этой неделе, не включает накопительный итог

### 10.5. Предложения по улучшению

1. **Изменить логику `shot_not_processed_qty`:**
   - Убрать условие `week_shot = текущая неделя`
   - Показывать все сфотографированные, но не обработанные задачи (накопительный итог)
   - Переименовать "Предстоит отснять" → "Обработать на этой неделе"

2. **Унифицировать расчёт плана:**
   - Либо backend всегда возвращает план = 80
   - Либо frontend использует план из backend

3. **Унифицировать расчёт `remaining_to_plan`:**
   - Либо backend использует `done_qty` для расчёта
   - Либо frontend использует `done_fact_this_week` (но это не соответствует требованиям пользователя)

---

## Приложение A: Связанные файлы

### Backend (Edge Function)
- `supabase/functions/fetch-asana-stats/index.ts` — основной код Edge Function (вне репозитория `/Users/stanislav/web`)

### Frontend
- `app.js` — функции `getAsanaStats()`, `updateTasksCards()`, `renderTasks()`, `getAsanaTasksDetailsByWeekStart()`, `computeOperationalStatus()`, `applyTasksDetailsFilters()`

### SQL схемы
- `create_asana_tasks_table.sql` — схема таблицы `asana_tasks`
- `migrate_asana_stats_schema.sql` — схема таблицы `asana_stats`
- `recalculate_asana_stats_simple.sql` — SQL функция для пересчёта статистики

### Миграции
- `sql/migrate_asana_tasks_add_type_priority.sql` — добавление полей `task_type_gid`, `task_type_label`, `priority_gid`, `priority_label`
- `sql/migrate_asana_stats_add_done_debt.sql` — добавление полей `done_week`, `debt_week`
- `sql/migrate_asana_stats_add_stm_split.sql` — добавление полей `done_stm_qty`, `done_nonstm_qty`

### Документация
- `ASANA_INTEGRATION.md` — общее описание интеграции с Asana
- `docs/tasks-backend-current.md` — текущая бэкенд-логика
- `docs/tasks-tab-overview.md` — обзор вкладки "Задачи"
- `docs/tasks-tab-architecture.md` — архитектура вкладки "Задачи"
- `docs/asana-kpi-implementation.md` — детальное описание расчёта KPI
- `docs/tasks-backend-new-kpi-spec.md` — спецификация новой логики KPI (будущая)
- `ПОЛНОЕ_ОПИСАНИЕ_ПОКАЗАТЕЛЕЙ_И_ПРЕДЛОЖЕНИЯ.md` — описание всех показателей и предложений пользователя

---

## Приложение B: Константы и идентификаторы

### Asana API

- **Workspace GID**: `1208507351529750` (Arbuz workspace)
- **Project GID**: `1210258013776969` (Arbuz Контент. Задачи)
- **User ID**: `1210252517070407` (Stanislav Khreshchik)
- **Custom Field (Q)**: числовое поле "Q" (основной источник количества товаров)
- **Custom Field (Legacy)**: `1210420107320602` (старое поле "Кол-во товаров", больше не используется)
- **Custom Field (Товар)**: enum-поле "Товар" ("Принесли" / "Взять самому со склада")
- **Custom Field (когда сфоткал)**: дата "когда сфоткал"
- **Custom Field (когда обработал)**: дата "когда обработал"
- **Custom Field (Тип задачи)**: `1211791857710742` (enum: СТМ / НЕ СТМ)
- **Custom Field (Приоритет)**: `1210258017012074` (enum: 🔥 Срочно / Высокий / Средний)

### Переменные окружения Supabase

- `ASANA_PAT` — Personal Access Token от Asana (обязательно)
- `TIMETRACK_ASSIGNEE_GID` — GID исполнителя для защитной фильтрации (опционально, рекомендуется: `1210252517070407`)
- `SUPABASE_URL` — URL проекта Supabase (устанавливается автоматически)
- `SUPABASE_SERVICE_ROLE_KEY` — Service Role Key для записи в БД (устанавливается автоматически)

---

## Приложение C: Версии логики

### v3.1-tasks-kpi (текущая)

**Особенности:**
- Плановые KPI (`to_shoot_qty`, `on_hand_qty`, `warehouse_qty`) рассчитываются по неделям `due_on`
- Фактические KPI (`done_fact_this_week`, `done_qty`, `shot_not_processed_qty`) строятся по фактическим датам (`shot_at`, `processed_at`, `completed_at`)
- `week_load = done_fact_this_week + to_shoot_qty`
- План (80-100) сравнивается только с `done_fact_this_week`
- Введены `overtime_qty` и `carry_over_from_prev` для фиксации переработки между неделями
- Разбивка по типу задачи (СТМ / НЕ СТМ)
- Фильтры по типу задачи, приоритету, операционному статусу

### v3 (предыдущая)

**Особенности:**
- Базовая логика с разделением плановых и фактических KPI
- Динамический план 80-100
- Переработка между неделями

---

**Документ создан:** 2025-01-XX  
**Версия:** 1.0  
**Автор:** AI Assistant (на основе анализа кодовой базы)


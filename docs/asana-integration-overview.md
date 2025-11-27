# Технический обзор интеграции с Asana для вкладки "Задачи Asana" в TimeTrack

## Общая схема потока данных

### 1. Источник данных: Asana API

**Проект Asana:**
- **Project GID**: `1210258013776969` (Arbuz Контент. Задачи)
- **Workspace GID**: `1208507351529750` (Arbuz workspace)
- **User GID**: `1210252517070407` (Stanislav Khreshchik)

**API Endpoint:**
```
GET https://app.asana.com/api/1.0/tasks?project=1210258013776969&limit=100&completed_since={weekStartDate}T00:00:00Z&opt_fields=...
```

**Параметры запроса:**
- `project`: GID проекта "Arbuz Контент. Задачи"
- `limit`: 100 задач на страницу (с пагинацией)
- `completed_since`: дата начала текущей недели в ISO формате (возвращает незавершённые задачи + завершённые начиная с этой даты)
- `opt_fields`: `gid,name,completed,completed_at,due_on,assignee,created_at,modified_at,custom_fields,custom_fields.gid,custom_fields.name,custom_fields.enum_value,custom_fields.number_value`

### 2. Edge Function: fetch-asana-stats

**Путь:** `/Users/stanislav/supabase/functions/fetch-asana-stats/index.ts`

**Вызов от фронтенда:**
```javascript
supabaseClient.functions.invoke('fetch-asana-stats', { body: {} })
```

**URL Edge Function:** `https://{supabase-project}.supabase.co/functions/v1/fetch-asana-stats`

**Что делает:**
1. Получает задачи из Asana API с пагинацией по `next_page`
2. Извлекает кастомные поля: Q (количество), "товар" (источник), "когда сфотал", "когда обработал"
3. Записывает детальные данные задач в таблицу `asana_tasks` (upsert по `asana_task_gid`)
4. Рассчитывает агрегированную статистику по текущей неделе
5. Записывает статистику в таблицу `asana_stats` (upsert по `week_start_date`)
6. Возвращает JSON с KPI для фронтенда

**Версия:** `v3.1-tasks-kpi` (логируется в начале handler и в ответе)

### 3. Таблицы Supabase

**asana_tasks** (детальные данные задач):
- `asana_task_gid` (TEXT, UNIQUE) - GID задачи из Asana
- `task_name` (TEXT) - название задачи
- `q` (INTEGER) - количество товаров из поля "Q" или "Количество"
- `product_source` (TEXT) - источник товара: 'PRINESLI' или 'WAREHOUSE'
- `shot_at` (DATE) - дата из поля "когда сфотал"
- `processed_at` (DATE) - дата из поля "когда обработал" или `completed_at`
- `week_shot` (DATE) - понедельник недели для `shot_at`
- `week_processed` (DATE) - понедельник недели для `processed_at`
- `due_on` (DATE) - дедлайн задачи (используется для плановых KPI)
- `completed` (BOOLEAN) - статус завершения
- `completed_at` (TIMESTAMP) - дата завершения
- `assignee_gid` (TEXT) - GID исполнителя
- `project_gid` (TEXT) - GID проекта
- `week_start_date` (DATE) - понедельник недели по `due_on` (deprecated, для обратной совместимости)

**asana_stats** (агрегированная статистика по неделям):
- `week_start_date` (DATE, PRIMARY KEY) - понедельник недели
- `week_end_date` (DATE) - воскресенье недели
- `week_load` (INTEGER) - недельная нагрузка: `done_fact_this_week + to_shoot_qty`
- `plan` (INTEGER) - динамический план 80-100
- `done_fact_this_week` (INTEGER) - фактический объём недели (по shot/processed/completed)
- `carry_over_from_prev` (INTEGER) - переработка с прошлой недели
- `done_qty` (INTEGER) - `done_fact_this_week + carry_over_from_prev`
- `overtime_qty` (INTEGER) - переработка текущей недели: `max(0, done_fact_this_week - plan)`
- `to_shoot_qty` (INTEGER) - сумма Q незавершённых задач с `due_on` в неделе
- `on_hand_qty` (INTEGER) - сумма Q задач с `product_source = 'PRINESLI'` и `due_on` в неделе
- `warehouse_qty` (INTEGER) - сумма Q задач с `product_source = 'WAREHOUSE'`, `shot_at IS NULL`, `due_on` в неделе
- `shot_not_processed_qty` (INTEGER) - сумма Q задач с `shot_at` заполнено, `processed_at` пусто
- `q_errors_count` (INTEGER) - количество задач с `q <= 0` или `q IS NULL`
- `remaining_to_plan` (INTEGER) - `max(0, plan - done_fact_this_week)`

### 4. Фронтенд: получение данных

**Файл:** `/Users/stanislav/web/app.js`

**Функции:**

1. **`getAsanaStats()`** (строка ~1852):
   - Вызывает Edge Function `fetch-asana-stats`
   - Нормализует ответ в объект с KPI
   - Кэширует результат в `cachedTasksStats`
   - Логирует: `[[TasksTab Debug]] Версия Edge Function: ...`

2. **`getAsanaTasksDetailsByWeekStart(weekStartStr)`** (строка ~2339):
   - Читает детальные данные из таблицы `asana_tasks`
   - Фильтрует по `week_shot` или `week_processed` = `weekStartStr`
   - Вычисляет `hasQError` для каждой задачи
   - Логирует: `[[TasksTab Details Debug]] Загружено строк: ...`

**Рендеринг:**
- Функции `updateTasksCards()`, `renderTasks()` отображают KPI и детали задач
- Используются данные из `cachedTasksStats` и результатов `getAsanaTasksDetailsByWeekStart()`

## Основные файлы

### Edge Functions

- **`/Users/stanislav/supabase/functions/fetch-asana-stats/index.ts`** — основная Edge Function для получения задач из Asana, записи в БД и расчёта KPI. Версия: `v3.1-tasks-kpi`. Обрабатывает пагинацию, извлекает кастомные поля, рассчитывает статистику по неделям.

- **`/Users/stanislav/supabase/functions/fetch-asana-stats/fixtures/fact-week-example.json`** — тестовая фикстура с примерами задач для проверки логики расчёта KPI.

- **`/Users/stanislav/supabase/functions/fetch-asana-stats/fixtures/fact-week-example-runner.ts`** — Deno-скрипт для локального тестирования расчёта KPI по фикстуре.

- **`/Users/stanislav/supabase/functions/handle-asana-webhook/index.ts`** — Edge Function для обработки webhook-событий от Asana (если используется).

### Фронтенд

- **`/Users/stanislav/web/app.js`** — основной файл фронтенда. Содержит функции `getAsanaStats()`, `getAsanaTasksDetailsByWeekStart()`, `updateTasksCards()`, `renderTasks()` для работы с вкладкой "Задачи Asana". Использует Supabase клиент для вызова Edge Function и чтения данных из таблиц.

- **`/Users/stanislav/web/index.html`** — HTML-разметка страницы с вкладкой "Задачи Asana" (роут `#/tasks`).

### SQL-миграции и схемы

- **`/Users/stanislav/web/create_asana_tasks_table.sql`** — создание таблицы `asana_tasks` с индексами и RLS-политиками.

- **`/Users/stanislav/web/migrate_asana_tasks_schema.sql`** — миграция схемы таблицы `asana_tasks` (добавление новых полей).

- **`/Users/stanislav/web/migrate_asana_stats_schema.sql`** — миграция схемы таблицы `asana_stats` (добавление полей для v3 логики).

### Документация

- **`/Users/stanislav/web/ASANA_INTEGRATION.md`** — подробная документация по интеграции с Asana: показатели, API-параметры, структура таблиц, логика v3.

- **`/Users/stanislav/web/docs/tasks-tab-overview.md`** — обзор вкладки "Задачи": описание KPI, бизнес-логика, использование дат.

- **`/Users/stanislav/web/docs/tasks-tab-architecture.md`** — архитектура вкладки "Задачи": поток данных, контракты, компоненты.

## Конфигурация Asana

### Project GID

- **ARBUZ_CONTENT_PROJECT_GID**: `"1210258013776969"` — проект "Arbuz Контент. Задачи"
- Используется в Edge Function для фильтрации задач из Asana API

### Custom Fields

**Поле "товар" (источник товара):**
- **GID**: `"1211796527554509"` (константа `PRODUCT_FIELD_GID`)
- **Тип**: enum
- **Значения**:
  - "Принесли" → `product_source = 'PRINESLI'`
  - "Взять самому со склада" → `product_source = 'WAREHOUSE'`
- **Использование**: фильтрация задач (логируется, но не отбрасываются задачи без этого поля)

**Поле "Q" / "Количество":**
- **Тип**: number
- **Поиск**: по имени "Q", "Количество", "количество" или по GID (если известен)
- **Значение**: `field.number_value` (число)
- **Использование**: записывается в `asana_tasks.q`, используется для расчёта всех KPI

**Поле "когда сфотал":**
- **Тип**: date
- **Поиск**: по имени, содержащему "когда сфотал"
- **Значение**: `field.date_value.date` (строка YYYY-MM-DD)
- **Использование**: записывается в `asana_tasks.shot_at`, используется для расчёта `week_shot` и `shot_not_processed_qty`

**Поле "когда обработал":**
- **Тип**: date
- **Поиск**: по имени, содержащему "когда обработал"
- **Значение**: `field.date_value.date` (строка YYYY-MM-DD)
- **Fallback**: если поле пустое, но `completed = true`, используется `completed_at.split('T')[0]`
- **Использование**: записывается в `asana_tasks.processed_at`, используется для расчёта `week_processed` и `done_fact_this_week`

### Переменные окружения Supabase

- **`ASANA_PAT`** — Personal Access Token для Asana API (хранится в секретах Supabase)
- **`SUPABASE_URL`** — URL проекта Supabase
- **`SUPABASE_SERVICE_ROLE_KEY`** — Service Role Key для записи в таблицы (используется Edge Function)

## Сервисная информация и логи

### Версия функции

**Константа:** `FUNCTION_VERSION = "v3.1-tasks-kpi"` (строка 41 в `fetch-asana-stats/index.ts`)

**Логирование версии:**
- При старте handler: `[FetchAsanaStats] EDGE FUNCTION HANDLER START, version = v3.1-tasks-kpi` (строка ~573)
- В процессе выполнения: `[FetchAsanaStats] Версия функции: v3.1-tasks-kpi` (строка ~579)
- В ответе фронтенду: `data.version = "v3.1-tasks-kpi"` (строка ~902)

### Ключевые логи для отладки

**Edge Function (`fetch-asana-stats/index.ts`):**

- `[FetchAsanaStats] EDGE FUNCTION HANDLER START, version = v3.1-tasks-kpi` — старт функции (строка ~573)
- `[FetchAsanaStats] Fetch page X, url = ...` — загрузка страницы пагинации (строка ~623)
- `[FetchAsanaStats] Total tasks from Asana (raw): N` — общее количество задач после пагинации (строка ~667)
- `[FetchAsanaStats] task has NO product field but WILL be processed` — задача без поля "товар" (строка ~340)
- `[FetchAsanaStats Summary] { totalTasks, tasksWithProduct, tasksWithQuantity }` — сводная статистика по задачам (строка ~730)
- `[FetchAsanaStats] Записано задач в asana_tasks: N` — количество записанных задач (строка ~737)
- `[FetchAsanaStats] Итоговые данные для фронтенда: ...` — финальные KPI перед отправкой (строка ~924)

**Фронтенд (`app.js`):**

- `[[TasksTab Debug]] Версия Edge Function: ...` — версия функции из ответа (строка ~2188)
- `[[TasksTab Debug]] Полный ответ от Edge Function: ...` — полный JSON-ответ (строка ~2189)
- `[[TasksTab Debug]] Нормализованные значения: ...` — нормализованные KPI (строка ~2216)
- `[TasksTab Details Debug] getAsanaTasksDetailsByWeekStart called with weekStartDate = ...` — вызов функции деталей (строка ~2346)
- `[[TasksTab Details Debug]] Загружено строк: N` — количество загруженных задач (строка ~2373)
- `[[TasksTab Error]] ...` — ошибки при получении данных (строки ~1900, ~2135, ~2357)
- `[[TasksTab Warning]] ...` — предупреждения (строка ~1867)

### Логирование в консоли браузера

Все логи фронтенда с префиксом `[[TasksTab ...]]` или `[TasksTab ...]` выводятся в консоль браузера (F12 → Console). Это позволяет отслеживать:
- Версию Edge Function
- Нормализованные значения KPI
- Количество загруженных задач
- Ошибки при работе с API

### Логирование в Supabase

Логи Edge Function доступны в Supabase Dashboard:
- **Путь**: Dashboard → Edge Functions → `fetch-asana-stats` → Logs
- **Фильтр**: можно фильтровать по времени, уровню (info, error, debug)
- **Ключевые логи**: все логи с префиксом `[FetchAsanaStats]`

## Дополнительные файлы

- **`/Users/stanislav/web/DEPLOY_EDGE_FUNCTION.md`** — инструкция по деплою Edge Function
- **`/Users/stanislav/web/EDGE_FUNCTION_UPDATE.md`** — документация по обновлению Edge Function
- **`/Users/stanislav/web/MIGRATION_ASANA_SCHEMA.md`** — документация по миграции схемы таблиц Asana


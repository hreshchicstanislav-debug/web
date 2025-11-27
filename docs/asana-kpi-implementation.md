# Реализация расчёта KPI для вкладки "Задачи Asana"

## Список KPI и их смысл

### 1. `week_load` (недельная нагрузка)

**Описание:** Совокупный объём работы на неделю: что уже сделано по факту + что ещё предстоит по сроку выполнения.

**Формула:** `week_load = done_fact_this_week + to_shoot_qty`

**Где считается:**
- Файл: `/Users/stanislav/supabase/functions/fetch-asana-stats/index.ts`
- Функция: `computeWeekAggregates()` (строка 423)
- Возвращаемое значение: `weekLoad: doneFactThisWeek + toShootQty` (строка 504)

**Использование:** Используется для расчёта динамического плана (`plan`) и отображается на фронтенде как общая нагрузка недели.

---

### 2. `plan` (динамический план)

**Описание:** План недели, вычисляемый динамически на основе `week_load`. Сравнивается с `done_fact_this_week` (не с `done_qty`).

**Формула:**
- Если `week_load <= 80` → `plan = 80`
- Если `80 < week_load <= 100` → `plan = week_load`
- Если `week_load > 100` → `plan = 100`

**Где считается:**
- Файл: `/Users/stanislav/supabase/functions/fetch-asana-stats/index.ts`
- Функция: `computeDynamicPlan(weekLoad: number)` (строка 516)
- Вызов: `const plan = computeDynamicPlan(aggregates.weekLoad)` (строка 829)

**Использование:** Используется для расчёта `remaining_to_plan` и `overtime_qty`.

---

### 3. `done_fact_this_week` (фактический объём недели)

**Описание:** Сумма `q` задач, фактически сделанных в текущей неделе. Неделя определяется по фактическим датам (processed_at, shot_at, completed_at), а не по due_on.

**Формула:** Сумма `q` для задач, где:
- `q > 0` (после нормализации через `normalizeQ()`)
- `completed = true`
- `getFactWeek(task) === weekStartStr` (фактическая неделя = текущая неделя)

**Определение фактической недели (`getFactWeek`):**
- Приоритет 1: неделя `processed_at` (если заполнено)
- Приоритет 2: неделя `shot_at` (если `processed_at` пусто)
- Приоритет 3: неделя `completed_at` (если задача завершена, но нет `shot_at` и `processed_at`)

**Где считается:**
- Файл: `/Users/stanislav/supabase/functions/fetch-asana-stats/index.ts`
- Функция: `computeWeekAggregates()` → цикл по `factTasks` (строка 443-470)
- Условие: `if (q > 0 && !!task.completed && isRelevantFactWeek)` (строка 449)
- Функция `getFactWeek()`: строки 154-168

**Источник данных:** Задачи из таблицы `asana_tasks`, где `week_shot = weekStartStr` ИЛИ `week_processed = weekStartStr` (строка 776).

**Использование:** Основа для расчёта `done_qty`, `remaining_to_plan`, `overtime_qty`.

---

### 4. `carry_over_from_prev` (переработка с прошлой недели)

**Описание:** Объём переработки, который пришёл из прошлой недели. Это `overtime_qty` предыдущей недели, который добавляется к `done_fact_this_week` при показе карточки "Сделано".

**Формула:** `carry_over_from_prev = previousWeekStats.overtime_qty` (если запись за прошлую неделю существует)

**Где считается:**
- Файл: `/Users/stanislav/supabase/functions/fetch-asana-stats/index.ts`
- Строки: 833-851
- Запрос к БД: `SELECT overtime_qty FROM asana_stats WHERE week_start_date = previousWeekStr` (строка 836-840)

**Использование:** Добавляется к `done_fact_this_week` для получения `done_qty` (строка 853).

---

### 5. `done_qty` (показывается на карточке "Сделано")

**Описание:** Значение, которое отображается на карточке "Сделано" на фронтенде. Включает фактический объём недели + переработку с прошлой недели.

**Формула:** `done_qty = done_fact_this_week + carry_over_from_prev`

**Где считается:**
- Файл: `/Users/stanislav/supabase/functions/fetch-asana-stats/index.ts`
- Строка: 853

**Использование:** Отображается на фронтенде как основное значение карточки "Сделано".

---

### 6. `overtime_qty` (переработка текущей недели)

**Описание:** Переработка текущей недели, рассчитанная как превышение фактического объёма над планом. Переносится в `carry_over_from_prev` следующей недели.

**Формула:** `overtime_qty = max(0, done_fact_this_week - plan)`

**Где считается:**
- Файл: `/Users/stanislav/supabase/functions/fetch-asana-stats/index.ts`
- Строка: 831

**Использование:** Сохраняется в `asana_stats.overtime_qty` и используется как `carry_over_from_prev` для следующей недели.

---

### 7. `to_shoot_qty` (предстоит отснять)

**Описание:** Сумма `q` незавершённых задач, чьё `due_on` попадает в текущую неделю (понедельник–воскресенье). Это плановый объём "предстоит".

**Формула:** Сумма `q` для задач, где:
- `due_on` попадает в диапазон `[weekStartStr, weekEndStr]`
- `q > 0` (после нормализации)
- `completed != true`

**Где считается:**
- Файл: `/Users/stanislav/supabase/functions/fetch-asana-stats/index.ts`
- Функция: `computeWeekAggregates()` → цикл по `planTasks` (строка 473-499)
- Условие: `if (!task.completed)` (строка 483)

**Источник данных:** Задачи из таблицы `asana_tasks`, где `due_on >= weekStartStr AND due_on <= weekEndStr` (строки 798-799).

**Использование:** Используется для расчёта `week_load` и отображается на фронтенде как "Предстоит отснять".

---

### 8. `remaining_to_plan` (остаток до плана)

**Описание:** Сколько осталось сделать до выполнения плана. Если отрицательно (перевыполнение), возвращается 0.

**Формула:** `remaining_to_plan = max(0, plan - done_fact_this_week)`

**Где считается:**
- Файл: `/Users/stanislav/supabase/functions/fetch-asana-stats/index.ts`
- Строка: 830

**Важно:** Сравнивается именно с `done_fact_this_week`, а не с `done_qty` (который включает переработку с прошлой недели).

**Использование:** Отображается на фронтенде как "До выполнения плана".

---

### 9. `on_hand_qty` (уже на руках)

**Описание:** Сумма `q` задач, где товар уже принесли фотографу, но работа ещё не доведена до конца.

**Формула:** Сумма `q` для задач, где:
- `due_on` попадает в диапазон `[weekStartStr, weekEndStr]`
- `q > 0`
- `completed != true`
- `product_source = 'PRINESLI'`

**Где считается:**
- Файл: `/Users/stanislav/supabase/functions/fetch-asana-stats/index.ts`
- Функция: `computeWeekAggregates()` → цикл по `planTasks` (строка 473-499)
- Условие: `if (!task.completed && task.product_source === PRODUCT_SOURCE_PRINESLI)` (строка 487)

**Использование:** Отображается на фронтенде как "Уже на руках".

---

### 10. `warehouse_qty` (нужно взять со склада)

**Описание:** Сумма `q` задач, где нужно взять товар самому со склада, работа ещё не начата (нет shot_at и processed_at).

**Формула:** Сумма `q` для задач, где:
- `due_on` попадает в диапазон `[weekStartStr, weekEndStr]`
- `q > 0`
- `completed != true`
- `product_source = 'WAREHOUSE'`
- `shot_at IS NULL`
- `processed_at IS NULL`

**Где считается:**
- Файл: `/Users/stanislav/supabase/functions/fetch-asana-stats/index.ts`
- Функция: `computeWeekAggregates()` → цикл по `planTasks` (строка 473-499)
- Условие: `if (!task.completed && task.product_source === PRODUCT_SOURCE_WAREHOUSE && !task.shot_at && !task.processed_at)` (строки 491-496)

**Использование:** Отображается на фронтенде как "Нужно взять со склада".

---

### 11. `shot_not_processed_qty` (сфоткано, но не обработано)

**Описание:** Сумма `q` задач, где фотосъёмка начата (есть `shot_at`), но обработка ещё не завершена (нет `processed_at`).

**Формула:** Сумма `q` для задач, где:
- `q > 0`
- `week_shot = weekStartStr` (сфоткано на этой неделе)
- `completed != true`
- `shot_at IS NOT NULL`
- `processed_at IS NULL`

**Где считается:**
- Файл: `/Users/stanislav/supabase/functions/fetch-asana-stats/index.ts`
- Функция: `computeWeekAggregates()` → цикл по `factTasks` (строка 443-470)
- Условие: `if (q > 0 && isShotThisWeek && !task.completed && !!task.shot_at && !task.processed_at)` (строки 453-460)

**Использование:** Отображается на фронтенде как "Сфоткано, но не обработано".

---

### 12. `q_errors_count` (ошибки Q)

**Описание:** Количество задач, у которых `q <= 0` или `q IS NULL`, но задача должна участвовать в планах/факте (имеет `due_on` в неделе или попадает в `week_shot`/`week_processed` текущей недели).

**Формула:** Количество уникальных задач (по `asana_task_gid`), где:
- `q <= 0` или `q IS NULL` (после нормализации через `normalizeQ()`)
- И выполняется одно из условий:
  - `getFactWeek(task) === weekStartStr` (попадает в фактическую неделю)
  - `week_shot === weekStartStr` (сфоткано на этой неделе)
  - `due_on` попадает в диапазон `[weekStartStr, weekEndStr]`

**Где считается:**
- Файл: `/Users/stanislav/supabase/functions/fetch-asana-stats/index.ts`
- Функция: `computeWeekAggregates()` (строка 423)
- Трекинг ошибок: `trackQError(task)` (строки 436-441, 468-470, 478-480)
- Возвращаемое значение: `qErrorsCount: qErrorTaskIds.size` (строка 509)

**Использование:** Отображается на фронтенде как "Ошибки Q" с предупреждением, если > 0.

---

### 13. `completed_count` (legacy поле)

**Описание:** Legacy поле для обратной совместимости. Равно `done_qty`.

**Формула:** `completed_count = done_qty`

**Где считается:**
- Файл: `/Users/stanislav/supabase/functions/fetch-asana-stats/index.ts`
- Строка: 889 (в `statsRow`)

**Использование:** Используется старым фронтендом для обратной совместимости.

---

### 14. `pending_count` (legacy поле)

**Описание:** Legacy поле для обратной совместимости. Равно `to_shoot_qty`.

**Формула:** `pending_count = to_shoot_qty`

**Где считается:**
- Файл: `/Users/stanislav/supabase/functions/fetch-asana-stats/index.ts`
- Строка: 890 (в `statsRow`)

**Использование:** Используется старым фронтендом для обратной совместимости.

---

### 15. `total_plan` (legacy поле)

**Описание:** Legacy поле для обратной совместимости. Равно `week_load`.

**Формула:** `total_plan = week_load`

**Где считается:**
- Файл: `/Users/stanislav/supabase/functions/fetch-asana-stats/index.ts`
- Строка: 891 (в `statsRow`)

**Использование:** Используется старым фронтендом для обратной совместимости.

---

## Фильтры и ограничения

### Фильтры при получении задач из Asana API

**Параметры запроса:**
- `project=1210258013776969` — только задачи из проекта "Arbuz Контент. Задачи"
- `completed_since={weekStartDate}T00:00:00Z` — незавершённые задачи + завершённые начиная с начала недели
- `limit=100` — пагинация по 100 задач на страницу

**Где:** `/Users/stanislav/supabase/functions/fetch-asana-stats/index.ts`, строки 612-618

---

### Фильтры при записи в asana_tasks

**ВАЖНО:** В текущей реализации (v3.1) задачи НЕ отбрасываются по полю "товар". Все задачи из Asana API записываются в `asana_tasks`, даже если у них нет поля "товар".

**Логирование:**
- Задачи без поля "товар" логируются: `[FetchAsanaStats] task has NO product field but WILL be processed` (строка 340)
- Задачи без assignee логируются: `[FetchAsanaStats] task has no assignee but will be processed` (строка 702)

**Где:** `/Users/stanislav/supabase/functions/fetch-asana-stats/index.ts`, строки 688-724

**Функция проверки поля "товар":**
- `isTimetrackProductTask(task)` (строка 286) — проверяет наличие поля "товар" с GID `1211796527554509` и непустым `enum_value`
- **НО:** Эта функция используется только для логирования, задачи не отбрасываются

---

### Фильтры при выборке задач для расчёта KPI

**factTasks (для фактических KPI):**
```sql
SELECT asana_task_gid, q, product_source, shot_at, processed_at, completed, completed_at, due_on, week_shot, week_processed
FROM asana_tasks
WHERE project_gid = '1210258013776969'
  AND (week_shot = '2025-11-24' OR week_processed = '2025-11-24')
```

**Где:** `/Users/stanislav/supabase/functions/fetch-asana-stats/index.ts`, строки 770-776

**planTasks (для плановых KPI):**
```sql
SELECT asana_task_gid, q, product_source, shot_at, processed_at, completed, due_on, week_shot, week_processed
FROM asana_tasks
WHERE project_gid = '1210258013776969'
  AND due_on >= '2025-11-24'
  AND due_on <= '2025-11-30'
```

**Где:** `/Users/stanislav/supabase/functions/fetch-asana-stats/index.ts`, строки 792-799

**Важно:** Оба запроса фильтруют только по `project_gid`. Нет фильтрации по:
- `assignee_gid` (убрана в v3.1)
- Наличию поля "товар" (задачи без поля "товар" тоже учитываются в KPI, если попадают в выборку)

---

### Нормализация значения `q`

**Функция:** `normalizeQ(value: any): number` (строка 112)

**Логика:**
- Если `value` — число → возвращается как есть
- Если `value` — строка (непустая) → парсится в число
- Иначе → возвращается `0`

**Где используется:** Во всех расчётах KPI для нормализации `task.q` перед суммированием.

**Потенциальная проблема:** Если `q` в БД хранится как `NULL`, после нормализации становится `0`, и задача не учитывается в суммировании, но может попасть в `q_errors_count`.

---

## Сохранение в Supabase

### Таблица `asana_stats`

**Структура:**
- `week_start_date` (DATE, PRIMARY KEY) — понедельник недели
- `week_end_date` (DATE) — воскресенье недели
- Все поля KPI (см. список выше)
- `updated_at` (TIMESTAMP) — время последнего обновления

**Операция:** UPSERT по `week_start_date` (если запись существует — обновляется, иначе — вставляется)

**Где сохраняется:**
- Файл: `/Users/stanislav/supabase/functions/fetch-asana-stats/index.ts`
- Функция: `upsertAsanaStats(supabase, statsRow)` (строка 525)
- Вызов: строка 895

**Когда запускается обновление:**
- По запросу с фронтенда через `supabaseClient.functions.invoke('fetch-asana-stats', { body: {} })`
- Фронтенд вызывает при:
  - Загрузке вкладки "Задачи Asana" (`#/tasks`)
  - Нажатии кнопки "Обновить данные"
  - Автоматическом обновлении (если настроено)

**Где на фронтенде:** `/Users/stanislav/web/app.js`, функция `getAsanaStats()` (строка 1852)

---

### Таблица `asana_tasks`

**Структура:** Детальные данные каждой задачи (см. документацию по схеме)

**Операция:** UPSERT по `asana_task_gid` (если задача существует — обновляется, иначе — вставляется)

**Где сохраняется:**
- Файл: `/Users/stanislav/supabase/functions/fetch-asana-stats/index.ts`
- Строки: 730-762

**Когда запускается обновление:**
- Одновременно с расчётом KPI (в том же вызове Edge Function)
- Все задачи из Asana API записываются/обновляются в `asana_tasks` перед расчётом статистики

---

## Несоответствия/подозрительные места

### 1. Задачи без поля "товар" учитываются в KPI

**Проблема:** В текущей реализации (v3.1) задачи без поля "товар" НЕ отбрасываются и записываются в `asana_tasks`. Это означает, что они могут попасть в расчёт KPI, если:
- У них есть `due_on` в текущей неделе (попадут в `planTasks`)
- У них есть `week_shot` или `week_processed` в текущей неделе (попадут в `factTasks`)

**Где:** `/Users/stanislav/supabase/functions/fetch-asana-stats/index.ts`, строки 688-724 (нет фильтрации по `isTimetrackProductTask`)

**Последствие:** KPI могут включать задачи, которые не должны учитываться (если по бизнес-логике нужны только задачи с полем "товар").

**Рекомендация:** Если нужна фильтрация по полю "товар", добавить фильтр в запросы к `asana_tasks` для `factTasks` и `planTasks` (например, `product_source IS NOT NULL`).

---

### 2. Нет фильтрации по `assignee_gid` в запросах для KPI

**Проблема:** В запросах для `factTasks` и `planTasks` нет фильтрации по `assignee_gid`. Это означает, что в расчёт KPI попадают все задачи проекта, независимо от исполнителя.

**Где:** `/Users/stanislav/supabase/functions/fetch-asana-stats/index.ts`, строки 770-799

**Последствие:** Если в проекте есть задачи других исполнителей, они тоже учитываются в KPI.

**Рекомендация:** Если нужна фильтрация по исполнителю, добавить `.eq("assignee_gid", ASANA_USER_GID)` в оба запроса.

---

### 3. `normalizeQ()` возвращает 0 для NULL

**Проблема:** Если `q` в БД хранится как `NULL`, функция `normalizeQ()` возвращает `0`. Это означает:
- Задача не учитывается в суммировании (так как `q = 0`)
- Но может попасть в `q_errors_count`, если выполняется условие `requiresQValidation`

**Где:** `/Users/stanislav/supabase/functions/fetch-asana-stats/index.ts`, функция `normalizeQ()` (строка 112)

**Последствие:** Задачи с `q = NULL` могут "теряться" в расчётах, но при этом считаться ошибками.

**Рекомендация:** Убедиться, что при записи в `asana_tasks` поле `q` всегда заполняется (либо числом, либо явно `NULL`), и логика обработки `NULL` согласована.

---

### 4. Разделение `factTasks` и `planTasks` может приводить к дублированию

**Проблема:** Задача может попасть и в `factTasks` (если `week_shot` или `week_processed` = текущая неделя), и в `planTasks` (если `due_on` в текущей неделе). Это нормально для логики, но может быть неочевидно.

**Где:** `/Users/stanislav/supabase/functions/fetch-asana-stats/index.ts`, строки 770-799

**Последствие:** Одна и та же задача может учитываться в разных KPI (например, в `done_fact_this_week` и в `to_shoot_qty`, если она завершена, но `due_on` в текущей неделе).

**Рекомендация:** Убедиться, что логика расчёта корректно обрабатывает такие случаи (сейчас это делается через проверку `completed` в `planTasks`).

---

### 5. `q_errors_count` считает уникальные задачи, но может быть неточным

**Проблема:** `q_errors_count` использует `Set` для трекинга уникальных задач по `asana_task_gid`. Но если задача попадает и в `factTasks`, и в `planTasks`, она может быть учтена дважды в проверке `requiresQValidation`.

**Где:** `/Users/stanislav/supabase/functions/fetch-asana-stats/index.ts`, строки 436-441, 463-470, 478-480

**Последствие:** `q_errors_count` должен быть корректен (благодаря `Set`), но логика может быть избыточной.

**Рекомендация:** Текущая реализация корректна, но можно оптимизировать, чтобы не проверять одну и ту же задачу дважды.

---

### 6. Нет проверки на пустые `factTasks` или `planTasks`

**Проблема:** Если `factTasks` или `planTasks` пустые (нет задач в БД), все KPI будут равны 0, но ошибка не будет выброшена.

**Где:** `/Users/stanislav/supabase/functions/fetch-asana-stats/index.ts`, строки 822-827

**Последствие:** Если в БД нет задач, KPI будут нулевыми, но это может быть неочевидно для пользователя.

**Рекомендация:** Добавить логирование или предупреждение, если `factTasks` или `planTasks` пустые, чтобы было понятно, почему KPI = 0.

---

## Дополнительные замечания

### Версия функции

**Текущая версия:** `v3.1-tasks-kpi` (константа `FUNCTION_VERSION`, строка 41)

**Логирование версии:**
- При старте handler: `[FetchAsanaStats] EDGE FUNCTION HANDLER START, version = v3.1-tasks-kpi` (строка ~573)
- В процессе: `[FetchAsanaStats] Версия функции: v3.1-tasks-kpi` (строка ~579)
- В ответе: `data.version = "v3.1-tasks-kpi"` (строка 902)

### Тестирование

**Фикстура для тестирования:**
- Файл: `/Users/stanislav/supabase/functions/fetch-asana-stats/fixtures/fact-week-example.json`
- Раннер: `/Users/stanislav/supabase/functions/fetch-asana-stats/fixtures/fact-week-example-runner.ts`

**Запуск теста:**
```bash
cd /Users/stanislav/supabase/functions/fetch-asana-stats
deno run --allow-read --allow-env fixtures/fact-week-example-runner.ts
```


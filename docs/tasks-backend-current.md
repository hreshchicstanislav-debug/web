# Текущая бэкенд-логика для вкладки "Задачи" TimeTrack

## Обзор

Вкладка "Задачи" получает данные из Supabase Edge Function `fetch-asana-stats`, которая синхронизирует задачи из Asana API, рассчитывает агрегированную статистику по неделям и возвращает KPI для отображения на фронтенде.

---

## Endpoints и Handlers

### 1. Edge Function: `fetch-asana-stats`

**Расположение:** `supabase/functions/fetch-asana-stats/index.ts` (вне репозитория `/Users/stanislav/web`)

**Версия:** `v3.1-tasks-kpi`

**Вызов с фронтенда:**
```javascript
// app.js, строка 1861
const { data: result, error } = await supabaseClient.functions.invoke('fetch-asana-stats', {
  body: {}
});
```

**Что делает:**
1. Получает задачи из Asana API для проекта "Arbuz Контент. Задачи" (`ARBUZ_CONTENT_PROJECT_GID = 1210258013776969`)
2. Фильтрует задачи по текущему пользователю (`assignee=me` в запросе к Asana API)
3. Применяет защитную фильтрацию по `assignee_gid` перед записью в `asana_tasks` (если установлена переменная `TIMETRACK_ASSIGNEE_GID`)
4. Извлекает кастомные поля: Q (количество), "Товар" (источник), "когда сфоткал", "когда обработал"
5. Заполняет таблицу `asana_tasks` детальными данными задач (upsert по `asana_task_gid`)
6. Рассчитывает агрегированную статистику по текущей неделе
7. Записывает статистику в таблицу `asana_stats` (upsert по `week_start_date`)
8. Возвращает JSON с агрегатами для фронтенда

**Триггеры вызова:**
- Кнопка "Обновить данные" на вкладке "Задачи" (`app.js`, строка 2187)
- При загрузке вкладки, если нет кеша (`app.js`, строка 2026)

---

## Сущности и типы данных

### Таблица `asana_tasks` (детальные данные задач)

**Назначение:** Хранит сырые данные задач из Asana. В таблицу попадают только задачи текущего пользователя из проекта "Arbuz Контент. Задачи", прошедшие фильтрацию по `assignee_gid` на уровне Edge Function.

**Ключевые поля:**
- `asana_task_gid` (TEXT, PRIMARY KEY) — GID задачи в Asana
- `task_name` (TEXT) — название задачи
- `q` (INTEGER) — количество товаров из кастомного поля Q (основной источник)
- `product_source` (TEXT) — источник товара: 'PRINESLI' или 'WAREHOUSE'
- `shot_at` (DATE) — дата из поля "когда сфоткал"
- `processed_at` (DATE) — дата из поля "когда обработал" или `completed_at`, если поле пустое при `completed = true`
- `completed` (BOOLEAN) — флаг завершённости задачи в Asana
- `completed_at` (TIMESTAMP) — дата завершения задачи
- `due_on` (DATE) — срок выполнения задачи, определяет плановую неделю для плановых KPI
- `week_start_date` (DATE) — понедельник недели по `due_on` (для плановых KPI)
- `week_shot` (DATE) — понедельник недели по `shot_at` (для фактических KPI)
- `week_processed` (DATE) — понедельник недели по `processed_at` (для фактических KPI)
- `assignee_gid` (TEXT) — GID исполнителя
- `project_gid` (TEXT) — GID проекта
- `quantity` (INTEGER, legacy) — старое поле "Кол-во товаров" (для обратной совместимости)

**Обновление:** Edge Function выполняет upsert по `asana_task_gid` при каждом вызове.

**SQL схема:** `create_asana_tasks_table.sql`

---

### Таблица `asana_stats` (агрегированная статистика по неделям)

**Назначение:** Хранит агрегированную статистику по неделям. Одна запись на неделю.

**Ключевые поля:**

**Основные KPI:**
- `week_start_date` (DATE, PRIMARY KEY) — понедельник недели (YYYY-MM-DD)
- `week_end_date` (DATE) — воскресенье недели
- `week_load` (INTEGER) — недельная нагрузка: `done_fact_this_week + to_shoot_qty`
- `plan` (INTEGER) — динамический план недели (80–100), сравнивается с `done_fact_this_week`
- `done_qty` (INTEGER) — KPI "Сделано": `done_fact_this_week + carry_over_from_prev`
- `to_shoot_qty` (INTEGER) — объём "Предстоит отснять": задачи этой недели по `due_on`, которые ещё не завершены
- `remaining_to_plan` (INTEGER) — остаток до плана: `max(0, plan - done_fact_this_week)`

**Вторичные показатели:**
- `on_hand_qty` (INTEGER) — объём задач `PRINESLI` с дедлайном этой недели, ещё не завершённых и не сфотографированных
- `warehouse_qty` (INTEGER) — объём задач `WAREHOUSE` с дедлайном этой недели, по которым работа не начата
- `shot_not_processed_qty` (INTEGER) — Q задач, где `shot_at` есть, `processed_at` нет, задача не завершена (неделя = `week_shot`)
- `q_errors_count` (INTEGER) — количество задач недели, где `Q <= 0` или `Q IS NULL`, но задача попадает в план или факт

**Вычисляемые показатели (не сохраняются в БД, но возвращаются в ответе):**
- `done_fact_this_week` (INTEGER) — факт недели по последовательности `week_processed → week_shot → completed_at`
- `overtime_qty` (INTEGER) — переработка текущей недели: `max(0, done_fact_this_week - plan)`
- `carry_over_from_prev` (INTEGER) — перенос из предыдущей недели (равен `overtime_qty` предыдущей недели)

**Legacy поля (для обратной совместимости):**
- `completed_count` (INTEGER) — приравнен к `done_qty`
- `pending_count` (INTEGER) — приравнен к `to_shoot_qty`
- `total_plan` (INTEGER) — приравнен к `week_load`

**Служебные поля:**
- `updated_at` (TIMESTAMP) — время последнего обновления
- `version` (STRING) — версия Edge Function (например, "v3.1-tasks-kpi")

**Обновление:** Edge Function выполняет upsert по `week_start_date` при каждом вызове.

**SQL схема:** `migrate_asana_stats_schema.sql`

---

## Определение недели

### Текущая неделя

**Расчёт:** Понедельник текущей календарной недели (ISO 8601, неделя начинается с понедельника).

**Где считается:** Edge Function использует функцию `getCurrentWeek()`, которая возвращает понедельник текущей недели в формате `YYYY-MM-DD`.

### Определение недели для задач

**Два подхода в зависимости от типа KPI:**

#### 1. Плановые KPI (используют `due_on`)

**Поля:** `to_shoot_qty`, `on_hand_qty`, `warehouse_qty`, часть `week_load` (плановая часть)

**Логика:** Неделя определяется по `due_on` задачи. Если `due_on` попадает в диапазон `[weekStartStr, weekEndStr]` (понедельник–воскресенье текущей недели), задача учитывается в плановых KPI.

**Где:** Edge Function запрашивает задачи из `asana_tasks`:
```sql
SELECT ... FROM asana_tasks
WHERE project_gid = '1210258013776969'
  AND due_on >= weekStartStr
  AND due_on <= weekEndStr
```

#### 2. Фактические KPI (используют `shot_at`, `processed_at`, `completed_at`)

**Поля:** `done_fact_this_week`, `done_qty`, `shot_not_processed_qty`

**Логика:** Неделя определяется по фактическим датам работы. Приоритет:
1. Неделя `processed_at` (если заполнено)
2. Неделя `shot_at` (если `processed_at` пусто)
3. Неделя `completed_at` (если задача завершена, но нет `shot_at` и `processed_at`)

**Важно:** Если задача завершена (`completed = true`), но поле "когда обработал" не заполнено (`processed_at IS NULL`), используется `completed_at` как дата обработки. Завершённая задача всегда попадает в "Сделано", даже если дата обработки не проставлена вручную.

**Где:** Edge Function запрашивает задачи из `asana_tasks`:
```sql
SELECT ... FROM asana_tasks
WHERE project_gid = '1210258013776969'
  AND (week_shot = weekStartStr OR week_processed = weekStartStr)
```

**Функция определения фактической недели:** `getFactWeek(task)` в Edge Function (строки 154-168)

---

## Расчёт недельной статистики

### Основные KPI

#### `done_fact_this_week` (фактический объём недели)

**Формула:** Сумма `q` для задач, где:
- `q > 0` (после нормализации через `normalizeQ()`)
- `completed = true`
- Фактическая неделя задачи (`getFactWeek(task)`) совпадает с текущей неделей

**Где считается:** Edge Function, функция `computeWeekAggregates()`, цикл по `factTasks` (строки 443-470)

**Источник данных:** Задачи из `asana_tasks`, где `week_shot = weekStartStr` ИЛИ `week_processed = weekStartStr`

---

#### `done_qty` (KPI "Сделано")

**Формула:** `done_qty = done_fact_this_week + carry_over_from_prev`

**Где считается:** Edge Function, строка 853

**Использование:** Отображается на фронтенде как основное значение карточки "Сделано"

---

#### `to_shoot_qty` (предстоит отснять)

**Формула:** Сумма `q` для задач, где:
- `due_on` попадает в диапазон `[weekStartStr, weekEndStr]`
- `q > 0` (после нормализации)
- `completed != true`

**Где считается:** Edge Function, функция `computeWeekAggregates()`, цикл по `planTasks` (строки 473-499)

**Источник данных:** Задачи из `asana_tasks`, где `due_on >= weekStartStr AND due_on <= weekEndStr`

---

#### `week_load` (недельная нагрузка)

**Формула:** `week_load = done_fact_this_week + to_shoot_qty`

**Где считается:** Edge Function, функция `computeWeekAggregates()`, строка 504

**Использование:** Используется для расчёта динамического плана (`plan`)

---

#### `plan` (динамический план)

**Формула:**
- Если `week_load <= 80` → `plan = 80`
- Если `80 < week_load <= 100` → `plan = week_load`
- Если `week_load > 100` → `plan = 100`

**Где считается:** Edge Function, функция `computeDynamicPlan(weekLoad: number)` (строка 516)

**Важно:** План сравнивается с `done_fact_this_week` (не с `done_qty`), так как переработка с прошлой недели не должна влиять на план текущей недели.

---

#### `remaining_to_plan` (остаток до плана)

**Формула:** `remaining_to_plan = max(0, plan - done_fact_this_week)`

**Где считается:** Edge Function, строка 830

**Использование:** Отображается на фронтенде как "До выполнения плана"

---

### Вторичные показатели

#### `on_hand_qty` (уже на руках)

**Формула:** Сумма `q` для задач, где:
- `due_on` попадает в диапазон `[weekStartStr, weekEndStr]`
- `q > 0`
- `completed != true`
- `product_source = 'PRINESLI'`
- `shot_at IS NULL` (товар ещё не сфотографирован, поэтому всё ещё на руках)

**Где считается:** Edge Function, функция `computeWeekAggregates()`, цикл по `planTasks` (строка 487)

---

#### `warehouse_qty` (нужно взять со склада)

**Формула:** Сумма `q` для задач, где:
- `due_on` попадает в диапазон `[weekStartStr, weekEndStr]`
- `q > 0`
- `completed != true`
- `product_source = 'WAREHOUSE'`
- `shot_at IS NULL`
- `processed_at IS NULL`

**Где считается:** Edge Function, функция `computeWeekAggregates()`, цикл по `planTasks` (строки 491-496)

---

#### `shot_not_processed_qty` (сфоткано, но не обработано)

**Формула:** Сумма `q` для задач, где:
- `q > 0`
- `week_shot = weekStartStr` (сфоткано на этой неделе)
- `completed != true`
- `shot_at IS NOT NULL`
- `processed_at IS NULL`

**Где считается:** Edge Function, функция `computeWeekAggregates()`, цикл по `factTasks` (строки 453-460)

---

#### `q_errors_count` (ошибки Q)

**Формула:** Количество уникальных задач (по `asana_task_gid`), где:
- `q <= 0` или `q IS NULL` (после нормализации через `normalizeQ()`)
- И выполняется одно из условий:
  - Фактическая неделя задачи (`getFactWeek(task)`) совпадает с текущей неделей
  - `week_shot = weekStartStr`
  - `due_on` попадает в диапазон `[weekStartStr, weekEndStr]`

**Где считается:** Edge Function, функция `computeWeekAggregates()`, трекинг ошибок через `trackQError(task)` (строки 436-441, 468-470, 478-480)

---

### Переработка между неделями

#### `overtime_qty` (переработка текущей недели)

**Формула:** `overtime_qty = max(0, done_fact_this_week - plan)`

**Где считается:** Edge Function, строка 831

**Использование:** Сохраняется в `asana_stats.overtime_qty` и используется как `carry_over_from_prev` для следующей недели

---

#### `carry_over_from_prev` (переработка с прошлой недели)

**Формула:** `carry_over_from_prev = previousWeekStats.overtime_qty` (если запись за прошлую неделю существует)

**Где считается:** Edge Function, строки 833-851 (запрос к БД: `SELECT overtime_qty FROM asana_stats WHERE week_start_date = previousWeekStr`)

**Использование:** Добавляется к `done_fact_this_week` для получения `done_qty`

---

## Поля, возвращаемые на фронтенд

### Структура ответа Edge Function

```typescript
{
  success: boolean,
  data: {
    // Основные KPI
    week_start_date: string,        // 'YYYY-MM-DD'
    week_end_date: string,           // 'YYYY-MM-DD'
    week_load: number,
    plan: number,
    done_qty: number,
    to_shoot_qty: number,
    remaining_to_plan: number,
    
    // Вычисляемые показатели (не сохраняются в БД)
    done_fact_this_week: number,
    carry_over_from_prev: number,
    overtime_qty: number,
    
    // Вторичные показатели
    on_hand_qty: number,
    warehouse_qty: number,
    shot_not_processed_qty: number,
    q_errors_count: number,
    
    // Legacy поля (для обратной совместимости)
    completed_count: number,         // = done_qty
    pending_count: number,          // = to_shoot_qty
    total_plan: number,              // = week_load
    
    // Служебные поля
    updated_at: string | null,
    version: string                  // 'v3.1-tasks-kpi'
  }
}
```

### Нормализация на фронтенде

**Функция:** `getAsanaStats()` в `app.js` (строки 1855-1933)

**Что делает:**
1. Вызывает Edge Function через `supabaseClient.functions.invoke('fetch-asana-stats')`
2. Нормализует данные с fallback на legacy поля:
   ```javascript
   const doneQty = data.done_qty ?? doneFactThisWeek + carryOverFromPrev;
   const toShootQty = data.to_shoot_qty ?? 0;
   const weekLoad = data.week_load ?? 0;
   const plan = data.plan ?? 80;
   const remainingToPlan = data.remaining_to_plan ?? Math.max((data.plan ?? 80) - doneFactThisWeek, 0);
   ```
3. Кеширует результат в `cachedTasksStats`
4. Возвращает нормализованный объект для использования в UI

---

## Фронтенд-функции, использующие бэкенд

### `getAsanaStats()` (app.js, строки 1855-1933)

**Назначение:** Получает статистику из Edge Function и нормализует данные.

**Вызов:** 
- При загрузке вкладки "Задачи" (`renderTasks()`, строка 2026)
- При нажатии кнопки "Обновить данные" (`renderTasks()`, строка 2193)

**Возвращает:** Нормализованный объект со статистикой для отображения в карточках.

---

### `getAsanaTasksDetailsByWeekStart(weekStartStr)` (app.js, строки 2295-2351)

**Назначение:** Получает детальные данные о задачах по неделе из таблицы `asana_tasks`.

**Вызов:** 
- При нажатии кнопки "Показать подробности" (`renderTasks()`, строка 2252)
- При загрузке вкладки, если секция подробностей была развернута (`renderTasks()`, строка 2156)

**Запрос к Supabase:**
```javascript
const { data: rows, error } = await supabaseClient
  .from('asana_tasks')
  .select('task_name, q, product_source, shot_at, processed_at, completed_at, due_on, week_start_date, completed, project_gid, assignee_gid')
  .or(`week_shot.eq.${weekStartStr},week_processed.eq.${weekStartStr},week_start_date.eq.${weekStartStr}`)
  .order('processed_at', { ascending: false })
  .order('shot_at', { ascending: false })
  .order('due_on', { ascending: true });
```

**Возвращает:** Массив задач с дополнительным полем `hasQError` (вычисляется на фронтенде).

---

### `updateTasksCards(stats)` (app.js, строки 1937-2002)

**Назначение:** Обновляет значения в карточках KPI без пересоздания HTML.

**Вызов:** После получения статистики из `getAsanaStats()` или при обновлении данных.

**Используемые поля из `stats`:**
- `doneQty` / `done_qty` → карточка "Сделано"
- `doneFactThisWeek` / `done_fact_this_week` → мета-информация в карточке "Сделано"
- `carryOverFromPrev` / `carry_over_from_prev` → мета-информация в карточке "Сделано"
- `overtimeQty` / `overtime_qty` → карточка "Переработка этой недели"
- `toShootQty` / `to_shoot_qty` → карточка "Предстоит отснять"
- `weekLoad` / `week_load` → мета-информация в карточке "Запланировано"
- `plan` → карточка "Запланировано" и подпись в карточке "До выполнения плана"
- `remainingToPlan` / `remaining_to_plan` → карточка "До выполнения плана"
- `onHandQty` / `on_hand_qty` → вторичный показатель "Уже на руках"
- `warehouseQty` / `warehouse_qty` → вторичный показатель "Нужно взять со склада"
- `shotNotProcessedQty` / `shot_not_processed_qty` → вторичный показатель "Сфоткано, но не обработано"
- `qErrorsCount` / `q_errors_count` → вторичный показатель "Ошибки Q"

---

## Поток данных

1. **Пользователь нажимает "Обновить данные" или открывает вкладку "Задачи"**
   - Фронтенд вызывает `getAsanaStats()` → `supabaseClient.functions.invoke('fetch-asana-stats')`

2. **Edge Function выполняет:**
   - Запрос к Asana API для получения задач проекта с фильтрацией по `assignee=me`
   - Защитная фильтрация по `assignee_gid` (если установлена `TIMETRACK_ASSIGNEE_GID`)
   - Извлечение кастомных полей (Q, Товар, когда сфоткал, когда обработал)
   - Upsert в `asana_tasks` (детальные данные)
   - Запрос задач из `asana_tasks` для расчёта KPI:
     - `factTasks`: задачи с `week_shot` или `week_processed` = текущая неделя
     - `planTasks`: задачи с `due_on` в диапазоне текущей недели
   - Расчёт агрегатов по текущей неделе через `computeWeekAggregates()`
   - Получение `carry_over_from_prev` из предыдущей недели
   - Расчёт `overtime_qty` и сохранение для следующей недели
   - Upsert в `asana_stats` (агрегаты)
   - Возврат JSON с новыми полями

3. **Фронтенд получает ответ:**
   - Нормализует данные (новые поля с fallback на legacy) в `getAsanaStats()`
   - Обновляет карточки через `updateTasksCards(stats)`
   - Кеширует статистику в `cachedTasksStats`

4. **При загрузке вкладки:**
   - Если есть кеш (`cachedTasksStats`) — использует его для быстрого отображения
   - Если нет кеша — запрашивает данные из Edge Function через `getAsanaStats()`

5. **При нажатии "Показать подробности":**
   - Вызывается `getAsanaTasksDetailsByWeekStart(weekStartStr)`
   - Запрос к `asana_tasks` с фильтрацией по `week_shot`, `week_processed` или `week_start_date`
   - Отображение таблицы с деталями задач

---

## Ключевые особенности реализации

### Фильтрация по исполнителю

**На уровне Asana API:**
- Запрос к `/tasks` с параметром `assignee=me` — первичная фильтрация на уровне API

**На уровне Edge Function (защитная фильтрация):**
- Перед записью в `asana_tasks` проверяется `task.assignee?.gid`
- Если установлена переменная `TIMETRACK_ASSIGNEE_GID`, задачи, где `task.assignee.gid !== TIMETRACK_ASSIGNEE_GID`, отбрасываются
- Логируется количество задач до и после фильтрации

**Важно:** Все расчёты KPI выполняются только по задачам, прошедшим фильтрацию и записанным в `asana_tasks`.

---

### Нормализация поля `q`

**Функция:** `normalizeQ(value: any): number` в Edge Function

**Логика:**
- Если `value` — число → возвращается как есть
- Если `value` — строка (непустая) → парсится в число
- Иначе → возвращается `0`

**Использование:** Во всех расчётах KPI для нормализации `task.q` перед суммированием.

---

### Разделение плановых и фактических KPI

**Плановые KPI** (используют `due_on`):
- `to_shoot_qty`
- `on_hand_qty`
- `warehouse_qty`
- Часть `week_load` (плановая часть)

**Фактические KPI** (используют `shot_at`, `processed_at`, `completed_at`):
- `done_fact_this_week`
- `done_qty`
- `shot_not_processed_qty`

**Причина:** Плановые показатели должны отражать запланированный объём работы на неделю (по дедлайнам), а фактические — реально выполненную работу (по датам съёмки и обработки).

---

## Связанные файлы

### Бэкенд (Edge Function)
- `supabase/functions/fetch-asana-stats/index.ts` — основной код Edge Function (вне репозитория `/Users/stanislav/web`)

### Фронтенд
- `app.js` — функции `getAsanaStats()`, `updateTasksCards()`, `renderTasks()`, `getAsanaTasksDetailsByWeekStart()`

### SQL схемы
- `create_asana_tasks_table.sql` — схема таблицы `asana_tasks`
- `migrate_asana_stats_schema.sql` — схема таблицы `asana_stats`

### Документация
- `ASANA_INTEGRATION.md` — общее описание интеграции с Asana
- `docs/tasks-tab-architecture.md` — архитектура вкладки "Задачи"
- `docs/asana-kpi-implementation.md` — детальное описание расчёта KPI
- `docs/tasks-tab-overview.md` — обзор вкладки "Задачи"

---

## Версия логики

**Текущая версия:** `v3.1-tasks-kpi`

**Особенности:**
- Плановые KPI (`to_shoot_qty`, `on_hand_qty`, `warehouse_qty`) рассчитываются по неделям `due_on`
- Фактические KPI (`done_fact_this_week`, `done_qty`, `shot_not_processed_qty`) строятся по `shot_at/processed_at/completed_at`
- `week_load = done_fact_this_week + to_shoot_qty`
- План (80–100) сравнивается только с `done_fact_this_week`
- Введены понятия `overtime_qty` и `carry_over_from_prev` для фиксации переработки между неделями

---

## Примечания

1. **Edge Function находится вне репозитория:** Код Edge Function `fetch-asana-stats` находится в `/Users/stanislav/supabase/functions/fetch-asana-stats/index.ts`, а не в репозитории `/Users/stanislav/web`. Для деплоя используется команда `supabase functions deploy fetch-asana-stats`.

2. **Кеширование:** Фронтенд кеширует статистику в `cachedTasksStats` для быстрого отображения при повторном входе во вкладку.

3. **Legacy поля:** Для обратной совместимости сохраняются поля `completed_count`, `pending_count`, `total_plan`, которые приравнены к новым полям (`done_qty`, `to_shoot_qty`, `week_load`).

4. **Нормализация данных:** Фронтенд нормализует данные с fallback на legacy поля, чтобы обеспечить совместимость со старыми версиями Edge Function.


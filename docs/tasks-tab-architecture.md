# Архитектура вкладки "Задачи" Timetrack

## Обзор

Вкладка "Задачи" отображает статистику по задачам Asana, рассчитанную на основе кастомных полей (Q, Товар, когда сфоткал, когда обработал) и стандартных полей задач (completed, due_on).

## Компоненты системы

### 1. Edge Function: `fetch-asana-stats`

**Расположение:** `supabase/functions/fetch-asana-stats/index.ts`

**Версия:** `v3-tasks-kpi` (неделя = due_on для плана + фактические даты для сделанного)

**Назначение:**
- Получает задачи из Asana API для проекта "Arbuz Контент. Задачи" (`ARBUZ_CONTENT_PROJECT_GID`) с фильтрацией по текущему пользователю (`assignee=me`)
- Применяет защитную фильтрацию по `assignee_gid` перед записью в `asana_tasks` (только задачи, где `task.assignee.gid === TIMETRACK_ASSIGNEE_GID`)
- Извлекает кастомные поля: Q (количество), 'Товар' (источник), 'когда сфоткал', 'когда обработал'
- Заполняет таблицу `asana_tasks` детальными данными задач (только отфильтрованные задачи текущего пользователя)
- Рассчитывает агрегированную статистику по неделям и записывает в `asana_stats`
- Возвращает JSON с агрегатами для фронтенда

**Вызов:**
- Из фронтенда: `supabaseClient.functions.invoke('fetch-asana-stats', { body: {} })`
- Кнопка "Обновить данные" на вкладке "Задачи"

**Возвращаемые поля в `data`:**

Новые поля (используются фронтендом):
- `done_qty` (integer) — KPI "Сделано": `done_fact_this_week + carry_over_from_prev`
- `to_shoot_qty` (integer) — объём "Предстоит отснять": задачи этой недели по `due_on`, которые ещё не завершены
- `week_load` (integer) — недельная нагрузка: `done_fact_this_week + to_shoot_qty`
- `plan` (integer) — динамический план недели (80–100), сравнивается с `done_fact_this_week`
- `remaining_to_plan` (integer) — `max(0, plan - done_fact_this_week)`
- `on_hand_qty` (integer) — объём задач `PRINESLI` с дедлайном этой недели, ещё не завершённых
- `warehouse_qty` (integer) — объём задач `WAREHOUSE` с дедлайном этой недели, по которым работа не начата (нет shot/process)
- `shot_not_processed_qty` (integer) — Q задач, где `shot_at` есть, `processed_at` нет, задача не завершена (неделя = `week_shot`)
- `q_errors_count` (integer) — количество задач недели, где `Q <= 0` или `Q IS NULL`, но задача попадает в план или факт

Дополнительные вычисляемые показатели (не всегда сохраняются напрямую, но должны быть описаны в коде/доках):
- `done_fact_this_week` — факт недели по последовательности `week_processed → week_shot → completed_at`
- `overtime_qty = max(0, done_fact_this_week - plan)`
- `carry_over_from_prev` — перенос из предыдущей недели, добавляется к `done_fact_this_week` при показе карточки «Сделано»

Legacy поля (для обратной совместимости):
- `completed_count` (integer) — приравнен к `done_qty`
- `pending_count` (integer) — приравнен к `to_shoot_qty`
- `total_plan` (integer) — приравнен к `week_load` (не plan!)

Служебные поля:
- `week_start_date` (date) — понедельник текущей недели (YYYY-MM-DD)
- `week_end_date` (date) — воскресенье текущей недели (YYYY-MM-DD)
- `updated_at` (timestamp) — время последнего обновления
- `version` (string) — версия Edge Function (например, "v2-tasks-kpi")

### 2. Таблица Supabase: `asana_tasks`

**Назначение:** Хранит сырые данные задач из Asana. В таблицу попадают **только** задачи текущего пользователя из проекта "Arbuz Контент. Задачи", прошедшие фильтрацию по `assignee_gid` на уровне Edge Function.

**Scope данных:**
- Все задачи в таблице относятся к проекту `ARBUZ_CONTENT_PROJECT_GID` (1210258013776969)
- Все задачи имеют `assignee_gid`, соответствующий `TIMETRACK_ASSIGNEE_GID` (если переменная окружения установлена)
- Задачи других исполнителей или из других проектов не попадают в таблицу

**Ключевые поля:**
- `asana_task_gid` (text, primary key) — GID задачи в Asana
- `task_name` (text) — название задачи
- `q` (integer) — количество товаров из кастомного поля Q
- `product_source` (text) — источник товара: 'PRINESLI' или 'WAREHOUSE'
- `shot_at` (date) — дата из поля "когда сфоткал"
- `processed_at` (date) — дата из поля "когда обработал" или `completed_at`, если поле пустое при `completed = true`
- `completed` (boolean) — флаг завершённости задачи в Asana
- `due_on` (date) — срок выполнения задачи, определяет плановую неделю для `to_shoot/on_hand/warehouse`
- `week_start_date` (date) — понедельник недели по due_on
- `week_shot` (date) — понедельник недели по shot_at
- `week_processed` (date) — понедельник недели по processed_at
- `quantity` (integer, legacy) — старое поле "Кол-во товаров" (для обратной совместимости)

**Обновление:** Edge Function выполняет upsert по `asana_task_gid` при каждом вызове. В таблице **нет** колонок `project_name`, `assignee_name`, `has_q_error` — человекочитаемые названия и признаки ошибок рассчитываются на фронтенде.

### 3. Таблица Supabase: `asana_stats`

**Назначение:** Хранит агрегированную статистику по неделям

**Ключевые поля:**
- `week_start_date` (date, primary key) — понедельник недели (YYYY-MM-DD)
- `week_end_date` (date) — воскресенье недели
- Новые поля: `week_load`, `plan`, `done_qty`, `remaining_to_plan`, `to_shoot_qty`, `on_hand_qty`, `warehouse_qty`, `shot_not_processed_qty`, `q_errors_count`
- Legacy поля: `completed_count`, `pending_count`, `total_plan`
- `updated_at` (timestamp) — время последнего обновления

**Обновление:** Edge Function выполняет upsert по `week_start_date` при каждом вызове

### 4. Фронтенд: `app.js`

**Функции:**
- `renderTasks()` — рендерит вкладку "Задачи" с карточками
- `getAsanaStats()` — получает статистику из `asana_stats` (кешируется)
- `updateTasksCards(stats)` — обновляет значения в карточках без пересоздания HTML
**Таблица "Показать подробности":**
- Данные берутся из `asana_tasks` по неделе (`week_shot`/`week_processed`) без дополнительных фильтров на API-уровне.
- Для отображения используется набор полей: `task_name`, `q`, `product_source`, `completed`, `shot_at`, `processed_at`, `due_on`, `project_gid`, `assignee_gid`.
- Объект `ASANA_PROJECT_LABELS` в `app.js` сопоставляет `project_gid` → человекочитаемое имя проекта; если GID не известен, выводится сам идентификатор.
- Фронтенд вычисляет `hasQError = (q == null || q <= 0)` и подсвечивает такие строки красным фоном/значком `⚠`; логика KPI (`q_errors_count`) на бэкенде не меняется.
- Фильтры (селект по проекту и чекбокс «Показать только ошибки Q») применяются на фронтенде к уже загруженному массиву строк и логируются: `[[TasksTab Details Debug]] Фильтрация деталей { totalRows, filteredRows, filterState }`.
- Обработчик кнопки "Обновить данные" — вызывает Edge Function через `supabaseClient.functions.invoke('fetch-asana-stats')`

**Маппинг данных:**

Нормализация (с fallback на legacy):
```javascript
const doneQty = data.done_qty ?? data.completed_count ?? 0
const toShootQty = data.to_shoot_qty ?? data.pending_count ?? 0
const weekLoad = data.week_load ?? data.total_plan ?? 0
const plan = data.plan ?? 80
const remainingToPlan = data.remaining_to_plan ?? Math.max(plan - doneQty, 0)
const onHandQty = data.on_hand_qty ?? 0
const warehouseQty = data.warehouse_qty ?? 0
const shotNotProcessedQty = data.shot_not_processed_qty ?? 0
```

**UI карточки:**

Основные карточки (4 штуки):
1. **"Сделано"** — отображает `doneQty` (зелёная карточка)
2. **"Предстоит отснять"** — отображает `toShootQty` (оранжевая карточка)
3. **"Недельная нагрузка"** — отображает `weekLoad` (синяя карточка)
4. **"До выполнения плана"** — отображает `remainingToPlan` и подпись "товаров (план: {plan})" (розовая/зелёная карточка в зависимости от значения)

Дополнительные карточки (3 штуки):
1. **"Уже на руках"** — отображает `onHandQty` (фиолетовая карточка)
2. **"Нужно взять со склада"** — отображает `warehouseQty` (жёлтая карточка)
3. **"Сфоткано, но не обработано"** — отображает `shotNotProcessedQty` (голубая карточка)

## Поток данных

1. **Пользователь нажимает "Обновить данные"**
   - Фронтенд вызывает `supabaseClient.functions.invoke('fetch-asana-stats')`

2. **Edge Function выполняет:**
   - Запрос к Asana API для получения задач проекта
   - Извлечение кастомных полей (Q, Товар, когда сфоткал, когда обработал)
   - Расчёт агрегатов по текущей неделе
   - Upsert в `asana_tasks` (детальные данные)
   - Upsert в `asana_stats` (агрегаты)
   - Возврат JSON с новыми полями

3. **Фронтенд получает ответ:**
   - Нормализует данные (новые поля с fallback на legacy)
   - Обновляет карточки через `updateTasksCards()`
   - Кеширует статистику в `cachedTasksStats`

4. **При загрузке вкладки:**
   - Если есть кеш — использует его для быстрого отображения
   - Если нет кеша — запрашивает данные из `asana_stats` через `getAsanaStats()`

## Критические поля для работы вкладки

### В `asana_tasks`:
- `q` — обязательно для расчёта агрегатов
- `product_source` — для расчёта `on_hand_qty` и `warehouse_qty`
- `shot_at`, `processed_at` — для расчёта `done_qty` и `shot_not_processed_qty`
- `completed` — для определения статуса задачи
- `week_shot`, `week_processed` — для определения недели задачи на основе фактических дат съёмки и обработки
- `due_on` — плановая дата. Используется для определения недели плановых KPI (`to_shoot`, `on_hand`, `warehouse`, `week_load` часть "plan")

### В `asana_stats`:
- `done_qty` — для карточки "Сделано"
- `to_shoot_qty` — для карточки "Предстоит отснять"
- `week_load` — для карточки "Недельная нагрузка"
- `plan` — для подписи под карточкой "До выполнения плана"
- `remaining_to_plan` — для карточки "До выполнения плана"
- `on_hand_qty`, `warehouse_qty`, `shot_not_processed_qty` — для дополнительных карточек

## Деплой Edge Function

Для применения изменений в Edge Function необходимо выполнить деплой:

```bash
cd /Users/stanislav/web
supabase functions deploy fetch-asana-stats
```

После деплоя проверьте:
1. В логах браузера при нажатии "Обновить данные" должно появиться поле `version: "v2-tasks-kpi"` в ответе
2. Новые поля (`done_qty`, `to_shoot_qty`, `week_load`, `plan` и т.д.) должны присутствовать в ответе и не быть `undefined`

## Диагностика проблем

### Проблема: Edge Function возвращает только legacy-поля

**Причины:**
1. Edge Function не была задеплоена после изменений
2. Вызывается старая версия функции

**Решение:**
1. Проверьте версию в ответе: должно быть `version: "v2-tasks-kpi"`
2. Если версии нет или она старая — выполните деплой: `supabase functions deploy fetch-asana-stats`
3. Проверьте логи Edge Function в Supabase Dashboard → Functions → Logs

### Проблема: UI показывает старые заголовки карточек

**Причины:**
1. Кеш браузера (старая версия `app.js`)
2. Изменения в `app.js` не применены

**Решение:**
1. Очистите кеш браузера (Ctrl+Shift+R / Cmd+Shift+R)
2. Проверьте, что в `app.js` заголовки карточек обновлены на "Сделано", "Предстоит отснять", "Недельная нагрузка", "До выполнения плана"

### Проблема: Все значения равны 0

**Причины:**
1. В Asana нет задач с заполненным полем Q
2. Задачи не попадают в текущую неделю по `due_on`
3. Edge Function не может получить доступ к Asana API (неверный токен)

**Решение:**
1. Проверьте логи Edge Function в Supabase Dashboard
2. Убедитесь, что `ASANA_PAT` установлен в секретах Supabase: `supabase secrets set ASANA_PAT=your_token`
3. Проверьте, что в Asana есть задачи с заполненным полем Q и фактическими датами съёмки/обработки (`shot_at`/`processed_at`)

## Assignee safety filter

Edge Function применяет защитную фильтрацию по исполнителю перед записью задач в `asana_tasks`:

1. **Источник данных Asana API**: запрос к `/tasks` с параметрами `workspace=ARBUZ_WORKSPACE_GID`, `project=ARBUZ_CONTENT_PROJECT_GID`, `assignee=me` — это первичная фильтрация на уровне API.

2. **Дополнительная проверка перед записью**:
   - Задачи без `assignee` (`task.assignee?.gid` отсутствует) не записываются в `asana_tasks`.
   - Если переменная окружения `TIMETRACK_ASSIGNEE_GID` установлена, задачи, где `task.assignee.gid !== TIMETRACK_ASSIGNEE_GID`, отбрасываются.
   - Логируется количество задач до и после фильтрации для диагностики.

3. **Влияние на KPI**: все расчёты в `asana_stats` и отображение в Tasks Tab выполняются только по задачам, прошедшим фильтрацию и записанным в `asana_tasks`. Это гарантирует, что статистика относится только к личным задачам фотографа (assignee = owner).

**Настройка:**
```bash
supabase secrets set TIMETRACK_ASSIGNEE_GID=1210252517070407
```

Если переменная не установлена, выводится предупреждение, что защитный фильтр выключен, и все задачи из Asana API записываются без дополнительной проверки.

## Версия логики

`v3 – due_on + фактические даты, переработка`: плановые KPI (`to_shoot`, `on_hand`, `warehouse`, часть `week_load`) рассчитываются по неделям `due_on`, фактические KPI (`done_fact_this_week`, `done_qty`, `shot_not_processed`) — по `shot_at/processed_at/completed_at`. План (80–100) сравнивается с `done_fact_this_week`, переработка (`overtime_qty`) переносится на следующую неделю как `carry_over_from_prev`.

`v3-tasks-kpi – детализация UI`: таблица «Показать подробности» подсвечивает Q-ошибки (красный фон строки, значок `⚠`), использует фронтенд-фильтры (чекбокс «Показать только ошибки Q» + селект по проекту) и маппит `project_gid` через объект `ASANA_PROJECT_LABELS`. Supabase отдаёт полный набор задач недели, а фильтрация выполняется в браузере.

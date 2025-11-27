# Интеграция Asana с Supabase для статистики фотосъемки

## Цель
Добавить на сайт статистику работы фотографа по товарам на текущую неделю из Asana.

## Показатели (логика v3)
1. **done_fact_this_week** — сумма `Q` задач, фактически сделанных в этой неделе. Неделя определяется по первой доступной дате из `processed_at`, `shot_at`, `completed_at` (все недели нормализуются к понедельнику). Учитываются только задачи с `Q > 0` и `completed = true`.
2. **carry_over_from_prev** — объём переработки, который пришёл из прошлой недели (хранится в `asana_stats`). При отображении карточки «Сделано» добавляется к `done_fact_this_week`.
3. **done_qty** — показывается на карточке «Сделано»: `done_fact_this_week + carry_over_from_prev`.
4. **to_shoot_qty** — сумма `Q` незавершённых задач, чьё `due_on` попадает в текущую неделю (понедельник–воскресенье). Это плановый объём «предстоит».
5. **week_load** — недельная нагрузка: `done_fact_this_week + to_shoot_qty`. Показывает совокупный объём недели (что уже сделано по факту + что ещё предстоит по сроку).
6. **plan** — динамический план 80–100, вычисляется от `week_load` и сравнивается именно с `done_fact_this_week`.
7. **remaining_to_plan** — `max(0, plan - done_fact_this_week)`. Если отрицательно, значит перевыполнение (используется для зелёной подсветки).
8. **on_hand_qty** — суммарный `Q` задач с `product_source = 'PRINESLI'`, `completed != true`, `due_on` в текущей неделе.
9. **warehouse_qty** — суммарный `Q` задач с `product_source = 'WAREHOUSE'`, `completed != true`, `shot_at IS NULL`, `processed_at IS NULL`, `due_on` в текущей неделе.
10. **shot_not_processed_qty** — суммарный `Q` задач, где `shot_at` заполнено, `processed_at` пусто, задача не завершена. Неделя определяется по `week_shot`.
11. **q_errors_count** — количество задач, где `Q <= 0` или `Q IS NULL`, но задача либо имеет `due_on` в текущей неделе, либо попадает в `week_shot` текущей недели (т.е. должна участвовать в планах/факте).
12. **overtime_qty** — `max(0, done_fact_this_week - plan)`; переносится в `carry_over_from_prev` следующей недели.

## Данные Asana API

### Основные параметры
- **Base URL**: `https://app.asana.com/api/1.0/`
- **Workspace GID**: `1208507351529750` (Arbuz workspace)
- **Project GID**: `1210258013776969` (Arbuz Контент. Задачи)
- **Assignee Scope**: `me` (задачи текущего пользователя, владельца Personal Access Token)
- **User ID**: `1210252517070407` (Stanislav Khreshchik) — используется для защитной фильтрации перед записью в `asana_tasks`
- **Custom Field (Q)**: числовое поле "Q" — основной источник количества товаров (точный GID можно посмотреть в проекте Asana; legacy поле "Кол-во товаров" больше не используется)

### Endpoint для получения задач

Edge Function использует endpoint `/tasks` с фильтрацией по workspace, project и assignee:

```
GET https://app.asana.com/api/1.0/tasks?workspace=1208507351529750&project=1210258013776969&assignee=me&limit=100&opt_fields=gid,name,completed,completed_at,due_on,assignee,created_at,modified_at,custom_fields
```

### Параметры запроса
- `workspace`: `1208507351529750` — фильтр по рабочему пространству Arbuz
- `project`: `1210258013776969` — фильтр по проекту "Arbuz Контент. Задачи"
- `assignee`: `me` — фильтр по задачам текущего пользователя (владельца PAT)
- `limit`: `100` — максимальное количество задач на страницу (при необходимости используется пагинация)
- `opt_fields`: `gid,name,completed,completed_at,due_on,assignee,created_at,modified_at,custom_fields` — поля, которые нужно получить из Asana

### Фильтрация по исполнителю перед записью

Перед записью задач в таблицу `asana_tasks` Edge Function применяет дополнительную защитную фильтрацию:

1. **Проверка наличия assignee**: задачи без исполнителя (`task.assignee?.gid` отсутствует) не записываются в `asana_tasks` и логируются как пропущенные.

2. **Проверка соответствия assignee_gid**: если переменная окружения `TIMETRACK_ASSIGNEE_GID` установлена, задачи, где `task.assignee.gid !== TIMETRACK_ASSIGNEE_GID`, отбрасываются с debug-логом (task_gid, task_name, assignee_gid, expected_assignee_gid).

3. **Логирование**: Edge Function логирует количество задач до и после фильтрации:
   - `[FetchAsanaStats] Total tasks from Asana (raw): N` — количество задач, полученных из Asana API
   - `[FetchAsanaStats] Tasks after assignee filter: M` — количество задач после фильтрации

4. **Безопасность**: если `TIMETRACK_ASSIGNEE_GID` не установлена, выводится предупреждение, что защитный фильтр выключен, и все задачи из Asana API записываются в `asana_tasks` без дополнительной проверки.

**Важно:** Все KPI и статистика рассчитываются только по задачам, прошедшим фильтрацию и записанным в `asana_tasks`. Это гарантирует, что в систему попадают только задачи текущего пользователя из проекта "Arbuz Контент. Задачи".

**Настройка переменной окружения:**
```bash
supabase secrets set TIMETRACK_ASSIGNEE_GID=1210252517070407
```

## Шаг 1: Получение Personal Access Token в Asana

1. Откройте Asana: https://app.asana.com
2. Перейдите в **Settings** → **Apps** → **Developer Console**
3. Создайте новый **Personal Access Token**
4. Скопируйте токен (он понадобится для настройки Supabase)

**ВАЖНО**: Токен нужно хранить в секретах Supabase, не в коде!

## Шаг 2: Создание таблиц в Supabase

### 2.1. Таблица для статистики (asana_stats)

Создайте таблицу для хранения агрегированной статистики Asana:

```sql
-- Создание таблицы для статистики Asana
CREATE TABLE asana_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start_date DATE NOT NULL, -- Дата начала недели (понедельник)
  week_end_date DATE NOT NULL,    -- Дата окончания недели (воскресенье)
  -- Legacy поля (сохраняются для обратной совместимости)
  completed_count INTEGER DEFAULT 0,      -- Legacy: отснято на неделе (используйте done_qty)
  pending_count INTEGER DEFAULT 0,        -- Legacy: предстоит отснять (используйте to_shoot_qty)
  total_plan INTEGER DEFAULT 0,           -- Legacy: запланировано товаров (используйте week_load)
  remaining_to_plan INTEGER DEFAULT 0,    -- Остаток до выполнения плана: plan - done_qty
  -- Новые поля для расширенной статистики (комбинация due_on + фактические даты)
  week_load INTEGER DEFAULT 0,            -- Недельная нагрузка: done_fact_this_week + to_shoot_qty
  plan INTEGER DEFAULT 80,                -- Динамический план недели (80-100), сравнивается с done_fact_this_week
  done_qty INTEGER DEFAULT 0,             -- KPI "Сделано": done_fact_this_week + carry_over_from_prev
  to_shoot_qty INTEGER DEFAULT 0,         -- Сумма Q незавершённых задач с due_on в текущей неделе
  on_hand_qty INTEGER DEFAULT 0,          -- Сумма Q задач недели (due_on), где product_source = 'PRINESLI' и completed != true
  warehouse_qty INTEGER DEFAULT 0,        -- Сумма Q задач недели (due_on), где product_source = 'WAREHOUSE', shot_at IS NULL, processed_at IS NULL
  shot_not_processed_qty INTEGER DEFAULT 0, -- Сумма Q задач недели по week_shot, где shot_at есть, processed_at нет
  q_errors_count INTEGER DEFAULT 0,        -- Количество задач недели, у которых Q отсутствует/<=0, но они попадают в план или факт
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(week_start_date) -- Одна запись на неделю
);

-- Создание индекса для быстрого поиска по дате
CREATE INDEX idx_asana_stats_week_start ON asana_stats(week_start_date);

-- RLS политики
ALTER TABLE asana_stats ENABLE ROW LEVEL SECURITY;

-- Политика для SELECT (все могут читать)
CREATE POLICY "Anyone can read asana_stats"
  ON asana_stats FOR SELECT
  USING (true);
```

**Примечание:** 
- Для обновления существующей таблицы `asana_stats` используйте скрипт `supabase/sql/patch-asana-stats-schema.sql` (рекомендуется) или `migrate_asana_stats_schema.sql` в корне проекта.
- См. раздел "Синхронизация схемы Supabase" в `docs/tasks-tab-overview.md` для подробных инструкций.

### 2.2. Таблица для детальной информации о задачах (asana_tasks)

Создайте таблицу для хранения детальной информации о каждой задаче с количеством товаров:

```sql
-- Создание таблицы для детальной информации о задачах Asana
CREATE TABLE asana_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asana_task_gid TEXT NOT NULL UNIQUE, -- GID задачи из Asana
  task_name TEXT, -- Название задачи
  completed BOOLEAN DEFAULT false, -- Завершена ли задача
  completed_at TIMESTAMP WITH TIME ZONE, -- Дата завершения
  due_on DATE, -- Дедлайн задачи (используется для плановых KPI недели)
  -- Legacy поле (сохраняется для обратной совместимости)
  quantity INTEGER, -- Legacy: старое поле "Кол-во товаров"
  -- Новые поля для новой бизнес-логики
  q INTEGER, -- Количество товаров из поля Q (основной источник)
  product_source TEXT, -- Источник товара: 'PRINESLI' (Принесли) или 'WAREHOUSE' (Взять самому со склада)
  shot_at DATE, -- Дата из поля "когда сфоткал"
  processed_at DATE, -- Дата из поля "когда обработал" или completed_at, если поле пустое при completed = true
  week_shot DATE, -- Понедельник недели, к которой относится shot_at (используется для расчёта KPI)
  week_processed DATE, -- Понедельник недели, к которой относится processed_at (используется для расчёта KPI)
  assignee_gid TEXT, -- GID исполнителя (User ID: 1210252517070407)
  week_start_date DATE NOT NULL, -- Дата начала недели (понедельник) по due_on. Ключ недели для плановых KPI и выборок UI
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Индексы для быстрого поиска
CREATE INDEX idx_asana_tasks_asana_gid ON asana_tasks(asana_task_gid);
CREATE INDEX idx_asana_tasks_week_start ON asana_tasks(week_start_date);
CREATE INDEX idx_asana_tasks_completed ON asana_tasks(completed);
CREATE INDEX idx_asana_tasks_due_on ON asana_tasks(due_on);
CREATE INDEX idx_asana_tasks_q ON asana_tasks(q) WHERE q IS NOT NULL;
CREATE INDEX idx_asana_tasks_product_source ON asana_tasks(product_source) WHERE product_source IS NOT NULL;
CREATE INDEX idx_asana_tasks_shot_at ON asana_tasks(shot_at) WHERE shot_at IS NOT NULL;
CREATE INDEX idx_asana_tasks_processed_at ON asana_tasks(processed_at) WHERE processed_at IS NOT NULL;
CREATE INDEX idx_asana_tasks_week_shot ON asana_tasks(week_shot) WHERE week_shot IS NOT NULL;
CREATE INDEX idx_asana_tasks_week_processed ON asana_tasks(week_processed) WHERE week_processed IS NOT NULL;

-- RLS политики
ALTER TABLE asana_tasks ENABLE ROW LEVEL SECURITY;

-- Политика для SELECT (все могут читать)
CREATE POLICY "Anyone can read asana_tasks"
  ON asana_tasks FOR SELECT
  USING (true);
```

**Примечания:**
- SQL скрипт для создания таблицы `asana_tasks` находится в файле `create_asana_tasks_table.sql` в корне проекта.
- Для обновления существующей таблицы `asana_tasks` используйте скрипт `supabase/sql/patch-asana-tasks-schema.sql` (рекомендуется) или `migrate_asana_tasks_schema.sql` в корне проекта.
- Поле `q` является основным источником количества товаров. Поле `quantity` сохраняется только как legacy для обратной совместимости.
- См. раздел "Синхронизация схемы Supabase" в `docs/tasks-tab-overview.md` для подробных инструкций по применению патчей.

## Шаг 3: Создание Supabase Edge Function

### 3.1. Установка Supabase CLI (если еще не установлен)

**Зачем нужен Supabase CLI на макбуке:**
Supabase CLI нужен только для первоначальной настройки - чтобы быстро создать и развернуть Edge Function на вашем Supabase проекте через терминал макбука. Это самый удобный способ настроить интеграцию.

**Важно:** После того, как все настроится и Edge Function будет развернута на Supabase, макбук больше не понадобится. Все будет работать автоматически на серверах Supabase, и обновление данных будет происходить через Webhooks от Asana (см. Шаг 4).

```bash
npm install -g supabase
```

### 3.2. Инициализация проекта (если еще не инициализирован)

```bash
supabase init
```

### 3.3. Создание Edge Function

```bash
supabase functions new fetch-asana-stats
```

### 3.4. Код Edge Function

Создайте файл `supabase/functions/fetch-asana-stats/index.ts`:

**Важно:** Полный код Edge Function находится в файле `supabase/functions/fetch-asana-stats/index.ts` в корне проекта. Ниже приведено краткое описание логики.

**Основные особенности логики v3:**

1. **Получение задач из Asana API.**
   - Edge Function запрашивает задачи через endpoint `/tasks` с параметрами: `workspace=ARBUZ_WORKSPACE_GID`, `project=ARBUZ_CONTENT_PROJECT_GID`, `assignee=me`.
   - Это гарантирует, что из Asana приходят только задачи текущего пользователя из проекта "Arbuz Контент. Задачи".

2. **Защитная фильтрация по исполнителю перед записью.**
   - Перед записью в `asana_tasks` применяется дополнительная проверка: задачи без `assignee` и задачи, где `task.assignee.gid !== TIMETRACK_ASSIGNEE_GID` (если переменная окружения установлена), отбрасываются.
   - Логируется количество задач до и после фильтрации для диагностики.
   - Если `TIMETRACK_ASSIGNEE_GID` не установлена, выводится предупреждение, что защитный фильтр выключен.

3. **Q как единственный источник количества.** Edge Function извлекает кастомное поле Q (число). Legacy поле "Кол-во товаров" больше не используется в расчётах.

4. **Кастомные поля Asana:**
   - **Q** — числовое поле (количество товаров).
   - **"Товар"** — enum: "Принесли" (`PRINESLI`) или "Взять самому со склада" (`WAREHOUSE`).
   - **"когда сфотал"** — дата съёмки (`shot_at`).
   - **"когда обработал"** — дата обработки (`processed_at`). Если пусто, но `completed = true`, используется `completed_at`.

3. **Фактический зачёт «Сделано».**
   - Задача попадает в `done_fact_this_week`, если `Q > 0`, `completed = true`, и неделя одного из полей (`processed_at` → `shot_at` → `completed_at`) совпадает с текущей.
   - `done_qty = done_fact_this_week + carry_over_from_prev`.
   - `overtime_qty = max(0, done_fact_this_week - plan)` переносится в следующую неделю.

4. **Плановые показатели по `due_on`.**
   - `to_shoot_qty`, `on_hand_qty`, `warehouse_qty` используют неделю `week_start_date` (понедельник по `due_on`).
   - `to_shoot_qty` включает все незавершённые задачи недели по дедлайну.
   - `on_hand_qty` ограничено задачами `PRINESLI`, `warehouse_qty` — задачами `WAREHOUSE` без начала работы (`shot_at` и `processed_at` пусты).

5. **Недельная нагрузка и план.**
   - `week_load = done_fact_this_week + to_shoot_qty`.
   - План фиксируется в диапазоне 80–100 по прежним правилам, но сравнивается именно с фактическим `done_fact_this_week`.
   - `remaining_to_plan = max(0, plan - done_fact_this_week)`.

6. **Вторичные показатели.**
   - `shot_not_processed_qty` опирается на `week_shot`.
   - `q_errors_count` учитывает задачи недели (по `due_on` или `week_shot`), где `Q` отсутствует или <= 0.

7. **Запись в `asana_tasks`.**
   - Сохраняются `q`, `product_source`, `shot_at`, `processed_at`, `week_shot`, `week_processed`, а также обязательные `due_on` и `week_start_date` для плановых KPI.
   - Legacy поле `quantity` остаётся только для обратной совместимости UI/SQL.

**Полный код:** См. файл `supabase/functions/fetch-asana-stats/index.ts` в корне проекта.

### 3.5. Развертывание Edge Function

```bash
# Установка секретов
supabase secrets set ASANA_PAT=your_asana_personal_access_token

# Развертывание функции
supabase functions deploy fetch-asana-stats
```

## Шаг 4: Настройка автоматического обновления

**Требования к обновлению данных:**
- Обновление при создании новой задачи на вас в Asana
- Обновление при заполнении поля Q в задаче
- Обновление при изменении количества товаров в существующей задаче
- Кнопка на сайте для принудительного обновления данных (уже реализована)

**Рекомендуемый способ:** Использование Webhooks от Asana для мгновенного обновления при изменениях.

### Вариант 1: Использование Asana Webhooks (РЕКОМЕНДУЕТСЯ)

Asana Webhooks позволяют получать уведомления в реальном времени при изменениях задач. Это самый эффективный способ обновления данных.

#### 4.1. Создание Webhook endpoint в Edge Function

Создайте новую Edge Function для обработки webhooks:

```bash
supabase functions new handle-asana-webhook
```

Создайте файл `supabase/functions/handle-asana-webhook/index.ts`:

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Примечание: Asana не предоставляет стандартный секрет для проверки подписи webhook
// Если в будущем Asana добавит проверку подписи, можно будет использовать ASANA_WEBHOOK_SECRET
// const ASANA_WEBHOOK_SECRET = Deno.env.get('ASANA_WEBHOOK_SECRET')

serve(async (req) => {
  try {
    // Проверка метода запроса
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' }
      })
    }
    
    // Проверка подлинности webhook (опционально)
    // Asana не предоставляет стандартную проверку подписи через X-Hook-Signature
    // Можно добавить собственную проверку, например, через проверку IP-адресов Asana
    // или через проверку наличия определенных заголовков
    
    const body = await req.json()
    
    // Обрабатываем только события, связанные с задачами
    if (body.events) {
      for (const event of body.events) {
        // Проверяем, относится ли событие к нашему проекту и пользователю
        if (event.resource && event.resource.resource_type === 'task') {
          // Вызываем функцию обновления статистики
          const supabaseUrl = Deno.env.get('SUPABASE_URL')!
          const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
          const supabase = createClient(supabaseUrl, supabaseKey)
          
          // Вызываем функцию fetch-asana-stats для обновления данных
          const { data, error } = await supabase.functions.invoke('fetch-asana-stats', {
            body: {}
          })
          
          if (error) {
            console.error('Ошибка обновления статистики:', error)
          }
        }
      }
    }
    
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    })
    
  } catch (error) {
    console.error('Ошибка обработки webhook:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
})
```

#### 4.2. Развертывание Webhook endpoint

```bash
supabase functions deploy handle-asana-webhook
```

#### 4.3. Настройка Webhook в Asana

1. Откройте Asana API: https://app.asana.com/api/1.0
2. Создайте Personal Access Token (если еще не создан)
3. Создайте Webhook через Asana API:

```bash
curl -X POST https://app.asana.com/api/1.0/webhooks \
  -H "Authorization: Bearer YOUR_PERSONAL_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "resource": "1210258013776969",
    "target": "https://your-project-ref.supabase.co/functions/v1/handle-asana-webhook",
    "filters": [
      {
        "resource_type": "task",
        "action": "added"
      },
      {
        "resource_type": "task",
        "action": "changed"
      }
    ]
  }'
```

**Примечание:** Asana Webhooks могут требовать дополнительной настройки. Если у вас возникнут проблемы, используйте Вариант 2 (проверка каждые 5-10 минут).

### Вариант 2: Использование Supabase Cron Jobs (pg_cron) - Альтернатива

Создайте SQL функцию для вызова Edge Function:

```sql
-- Создание функции для вызова Edge Function
CREATE OR REPLACE FUNCTION refresh_asana_stats()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  response_status int;
  response_content text;
BEGIN
  -- Вызов Edge Function через HTTP
  SELECT status, content INTO response_status, response_content
  FROM http((
    'POST',
    'https://your-project-ref.supabase.co/functions/v1/fetch-asana-stats',
    ARRAY[
      http_header('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')),
      http_header('Content-Type', 'application/json')
    ],
    'application/json',
    '{}'
  )::http_request);
  
  IF response_status != 200 THEN
    RAISE EXCEPTION 'Failed to refresh Asana stats: %', response_content;
  END IF;
END;
$$;

-- Настройка автоматического запуска каждые 5 минут (для более быстрого обновления)
-- Если используете Webhooks, этот cron можно отключить или установить реже (например, раз в час для подстраховки)
SELECT cron.schedule(
  'refresh-asana-stats-frequent',
  '*/5 * * * *', -- Каждые 5 минут
  $$SELECT refresh_asana_stats();$$
);

-- Настройка очистки данных в воскресенье в 23:59
SELECT cron.schedule(
  'clear-asana-stats-weekly',
  '59 23 * * 0', -- Каждое воскресенье в 23:59
  $$DELETE FROM asana_stats WHERE week_start_date < CURRENT_DATE - INTERVAL '7 days';$$
);
```

### Вариант 3: Использование внешнего сервиса (cron-job.org, EasyCron и т.д.)

Если Webhooks не работают или нужна дополнительная подстраховка, можно использовать внешний сервис для периодической проверки:

Настройте cron job для вызова Edge Function:
- URL: `https://your-project-ref.supabase.co/functions/v1/fetch-asana-stats`
- Метод: POST
- Headers: `Authorization: Bearer YOUR_SERVICE_ROLE_KEY`
- Частота: Каждые 5-10 минут (для более быстрого обновления при изменениях)

## Шаг 5: Установка секретов в Supabase

Перед развертыванием функций необходимо установить секреты:

```bash
# Установка Personal Access Token от Asana (ОБЯЗАТЕЛЬНО)
supabase secrets set ASANA_PAT=ваш_реальный_токен_asana

# Примечание: ASANA_WEBHOOK_SECRET НЕ ТРЕБУЕТСЯ
# Asana не предоставляет стандартную проверку подписи для webhooks
# Если в будущем Asana добавит эту функцию, можно будет установить секрет
```

**Важно:** 
- `SUPABASE_URL` и `SUPABASE_SERVICE_ROLE_KEY` обычно уже установлены автоматически при развертывании
- Если их нет, их можно найти в Supabase Dashboard → Settings → API
- Эти переменные используются автоматически, их не нужно устанавливать вручную

## Шаг 6: Кнопка принудительного обновления на сайте

Кнопка "Обновить данные" уже реализована на странице "Задачи". При нажатии она:
1. Вызывает Edge Function `fetch-asana-stats`
2. Обновляет данные в таблице `asana_stats`
3. Перезагружает страницу с новыми данными

Эта кнопка позволяет вручную обновить данные в любой момент.

## Шаг 7: Интеграция на фронтенде

### 7.1. Добавление кнопки "Задачи" в навигацию

В файле `app.js` добавьте кнопку навигации (см. реализацию ниже).

### 7.2. Создание функции для получения данных

```javascript
// Функция для получения статистики Asana из Supabase
async function getAsanaStats() {
  try {
    // Получаем начало текущей недели (понедельник)
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    const weekStartStr = monday.toISOString().split('T')[0];
    
    // Запрашиваем данные из Supabase
    const { data, error } = await supabase
      .from('asana_stats')
      .select('*')
      .eq('week_start_date', weekStartStr)
      .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
      throw error;
    }
    
    // Если данных нет, возвращаем значения по умолчанию
    if (!data) {
      return {
        completed_count: 0,
        pending_count: 0,
        total_plan: 0,
        remaining_to_plan: 80
      };
    }
    
    return data;
  } catch (error) {
    console.error('Ошибка получения статистики Asana:', error);
    return {
      completed_count: 0,
      pending_count: 0,
      total_plan: 0,
      remaining_to_plan: 80
    };
  }
}
```

### 7.3. Создание функции рендеринга страницы

```javascript
async function renderTasks() {
  const app = $('#app');
  
  // Получаем статистику
  const stats = await getAsanaStats();
  
  app.innerHTML = `
    <h1>Задачи Asana</h1>
    
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 16px; margin-top: 24px;">
      <!-- Карточка 1: Отснято на неделе -->
      <div style="background: #e8f5e9; border: 1px solid #4caf50; border-radius: 8px; padding: 20px;">
        <h3 style="margin: 0 0 12px 0; color: #2e7d32; font-size: 14px; font-weight: 500;">Отснято на неделе</h3>
        <div style="font-size: 32px; font-weight: bold; color: #1b5e20;">${stats.completed_count || 0}</div>
        <p style="margin: 8px 0 0 0; color: #666; font-size: 12px;">товаров</p>
      </div>
      
      <!-- Карточка 2: Предстоит отснять -->
      <div style="background: #fff3e0; border: 1px solid #ff9800; border-radius: 8px; padding: 20px;">
        <h3 style="margin: 0 0 12px 0; color: #e65100; font-size: 14px; font-weight: 500;">Предстоит отснять</h3>
        <div style="font-size: 32px; font-weight: bold; color: #bf360c;">${stats.pending_count || 0}</div>
        <p style="margin: 8px 0 0 0; color: #666; font-size: 12px;">товаров</p>
      </div>
      
      <!-- Карточка 3: Запланировано товаров на неделю -->
      <div style="background: #e3f2fd; border: 1px solid #2196f3; border-radius: 8px; padding: 20px;">
        <h3 style="margin: 0 0 12px 0; color: #1565c0; font-size: 14px; font-weight: 500;">Запланировано товаров на неделю</h3>
        <div style="font-size: 32px; font-weight: bold; color: #0d47a1;">${stats.total_plan || 0}</div>
        <p style="margin: 8px 0 0 0; color: #666; font-size: 12px;">товаров</p>
      </div>
      
      <!-- Карточка 4: До выполнения плана -->
      <div style="background: ${stats.remaining_to_plan > 0 ? '#fce4ec' : '#e8f5e9'}; border: 1px solid ${stats.remaining_to_plan > 0 ? '#e91e63' : '#4caf50'}; border-radius: 8px; padding: 20px;">
        <h3 style="margin: 0 0 12px 0; color: ${stats.remaining_to_plan > 0 ? '#880e4f' : '#2e7d32'}; font-size: 14px; font-weight: 500;">До выполнения плана</h3>
        <div style="font-size: 32px; font-weight: bold; color: ${stats.remaining_to_plan > 0 ? '#c2185b' : '#1b5e20'};">
          ${stats.remaining_to_plan || 0}
        </div>
        <p style="margin: 8px 0 0 0; color: #666; font-size: 12px;">товаров (план: 80)</p>
      </div>
    </div>
    
    <div style="margin-top: 24px;">
      <button id="refreshStats" class="btn">Обновить данные</button>
      <p class="muted" style="margin-top: 8px; font-size: 12px;">
        Нажмите кнопку "Обновить данные" для получения актуальной статистики из Asana. В воскресенье в 23:59 данные очищаются для новой недели.
      </p>
    </div>
  `;
  
  // Обработчик кнопки обновления
  $('#refreshStats').addEventListener('click', async () => {
    const btn = $('#refreshStats');
    btn.disabled = true;
    btn.textContent = 'Обновление...';
    
    try {
      // Вызываем Edge Function для обновления данных
      const { data, error } = await supabase.functions.invoke('fetch-asana-stats');
      
      if (error) throw error;
      
      // Перезагружаем страницу
      await renderTasks();
      
      alert('Данные успешно обновлены!');
    } catch (error) {
      console.error('Ошибка обновления данных:', error);
      alert('Ошибка обновления данных: ' + error.message);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Обновить данные';
    }
  });
}
```

## Шаг 6: Тестирование

1. Убедитесь, что Personal Access Token настроен в секретах Supabase
2. Вызовите Edge Function вручную для проверки:
   ```bash
   curl -X POST https://your-project-ref.supabase.co/functions/v1/fetch-asana-stats \
     -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"
   ```
3. Проверьте данные в таблице `asana_stats` в Supabase Dashboard
4. Откройте страницу "Задачи" на сайте и убедитесь, что данные отображаются

## Важные замечания

1. **Безопасность**: Никогда не храните Asana Personal Access Token в коде. Используйте секреты Supabase.

2. **Очистка данных**: Данные автоматически очищаются в воскресенье в 23:59. Каждая неделя имеет свою запись в таблице.

3. **Обновление данных**: 
   - **Ручное**: Через кнопку "Обновить данные" на странице "Задачи"
   - Данные обновляются только при нажатии кнопки "Обновить данные"
   - После настройки макбук больше не нужен - все работает на серверах Supabase

4. **Обработка ошибок**: Если Asana API недоступен, функция вернет ошибку, но не сломает сайт.

5. **Лимиты API**: Asana API имеет лимиты на количество запросов. При использовании Webhooks запросы происходят только при реальных изменениях, что более эффективно, чем периодические проверки.

6. **Макбук нужен только для настройки**: После развертывания Edge Function и настройки Webhooks/Cron, макбук больше не требуется. Все работает автоматически на серверах Supabase.

## Дополнительные улучшения (опционально)

1. Добавить кеширование данных на фронтенде
2. Добавить индикатор последнего обновления
3. Добавить график прогресса за неделю
4. Добавить уведомления при достижении плана

## Изменения логики

**Версия v3 – due_on + фактические даты, с переработкой (2025 Q4):**

- Плановые KPI (`to_shoot_qty`, `on_hand_qty`, `warehouse_qty`) рассчитываются по неделям `due_on`.
- Фактические KPI (`done_fact_this_week`, `done_qty`, `shot_not_processed_qty`) строятся по `shot_at/processed_at/completed_at`.
- `week_load = done_fact_this_week + to_shoot_qty`, план (80–100) сравнивается только с `done_fact_this_week`.
- Введены понятия `overtime_qty` и `carry_over_from_prev`, чтобы фиксировать переработку между неделями.
- Поле `due_on` теперь официально участвует в расчётах плановых KPI, тогда как фактические показатели всегда следуют реальным датам работы.


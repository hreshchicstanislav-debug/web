# Интеграция Asana с Supabase для статистики фотосъемки

## Цель
Добавить на сайт статистику работы фотографа по товарам на текущую неделю из Asana.

## Показатели
1. **Отснято на неделе** - сумма поля "Кол-во товаров" из завершенных задач за текущую неделю
2. **Предстоит отснять** - сумма поля "Кол-во товаров" из незавершенных задач с дедлайном на текущую неделю
3. **Запланировано товаров на неделю** - сумма показателей 1 и 2
4. **До выполнения плана** - результат: 80 - (сумма показателей 1 и 2). План на неделю: 80 товаров. Если выполнено больше 80 - показывает перевыполнение (отрицательное значение)

## Данные Asana API

### Основные параметры
- **Base URL**: `https://app.asana.com/api/1.0/`
- **User ID**: `1210252517070407` (Stanislav Khreshchik)
- **Project ID**: `1210258013776969` (Arbuz Контент. Задачи)
- **Custom Field ID**: `1210420107320602` (поле "Кол-во товаров", тип: CustomPropertyNumberProto)

### Endpoint для получения задач
```
GET https://app.asana.com/api/1.0/tasks?project=1210258013776969&assignee=1210252517070407
```

### Параметры запроса
- `opt_fields`: `gid,name,completed,completed_at,due_on,custom_fields`

## Шаг 1: Получение Personal Access Token в Asana

1. Откройте Asana: https://app.asana.com
2. Перейдите в **Settings** → **Apps** → **Developer Console**
3. Создайте новый **Personal Access Token**
4. Скопируйте токен (он понадобится для настройки Supabase)

**ВАЖНО**: Токен нужно хранить в секретах Supabase, не в коде!

## Шаг 2: Создание таблицы в Supabase

Создайте таблицу для хранения статистики Asana:

```sql
-- Создание таблицы для статистики Asana
CREATE TABLE asana_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start_date DATE NOT NULL, -- Дата начала недели (понедельник)
  week_end_date DATE NOT NULL,    -- Дата окончания недели (воскресенье)
  completed_count INTEGER DEFAULT 0,      -- Отснято на неделе
  pending_count INTEGER DEFAULT 0,        -- Предстоит отснять
  total_plan INTEGER DEFAULT 0,           -- Запланировано товаров на неделю (сумма показателей 1 и 2)
  remaining_to_plan INTEGER DEFAULT 0,    -- До выполнения плана (80 - total_plan)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(week_start_date) -- Одна запись на неделю
);

-- Создание индекса для быстрого поиска по дате
CREATE INDEX idx_asana_stats_week_start ON asana_stats(week_start_date);

-- RLS политики (если нужен доступ только для аутентифицированных пользователей)
ALTER TABLE asana_stats ENABLE ROW LEVEL SECURITY;

-- Политика для SELECT (все могут читать)
CREATE POLICY "Anyone can read asana_stats"
  ON asana_stats FOR SELECT
  USING (true);

-- Политика для INSERT/UPDATE (только service_role)
-- Для автоматического обновления через Edge Function
```

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

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ASANA_API_BASE = "https://app.asana.com/api/1.0"
const ASANA_PAT = Deno.env.get('ASANA_PAT') // Personal Access Token
const PROJECT_ID = "1210258013776969"
const USER_ID = "1210252517070407"
const CUSTOM_FIELD_ID = "1210420107320602"

// Функция для получения начала и конца текущей недели (понедельник - воскресенье)
function getCurrentWeek() {
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1) // Понедельник
  const monday = new Date(now.setDate(diff))
  monday.setHours(0, 0, 0, 0)
  
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  
  return { start: monday, end: sunday }
}

// Функция для проверки, попадает ли дата в текущую неделю
function isInCurrentWeek(date: Date, weekStart: Date, weekEnd: Date) {
  return date >= weekStart && date <= weekEnd
}

serve(async (req) => {
  try {
    // Получаем текущую неделю
    const { start: weekStart, end: weekEnd } = getCurrentWeek()
    
    // Получаем задачи из Asana
    const response = await fetch(
      `${ASANA_API_BASE}/tasks?project=${PROJECT_ID}&assignee=${USER_ID}&opt_fields=gid,name,completed,completed_at,due_on,custom_fields`,
      {
        headers: {
          'Authorization': `Bearer ${ASANA_PAT}`,
          'Content-Type': 'application/json'
        }
      }
    )
    
    if (!response.ok) {
      throw new Error(`Asana API error: ${response.status} ${response.statusText}`)
    }
    
    const data = await response.json()
    const tasks = data.data || []
    
    // Инициализация счетчиков
    let completedCount = 0  // Отснято на неделе
    let pendingCount = 0     // Предстоит отснять
    
    // Обработка задач
    for (const task of tasks) {
      // Находим поле "Кол-во товаров"
      const quantityField = task.custom_fields?.find(
        (field: any) => field.gid === CUSTOM_FIELD_ID
      )
      
      if (!quantityField || !quantityField.number_value) {
        continue // Пропускаем задачи без количества товаров
      }
      
      const quantity = quantityField.number_value
      
      // Проверяем завершенные задачи
      if (task.completed && task.completed_at) {
        const completedDate = new Date(task.completed_at)
        if (isInCurrentWeek(completedDate, weekStart, weekEnd)) {
          completedCount += quantity
        }
      }
      
      // Проверяем предстоящие задачи
      if (!task.completed && task.due_on) {
        const dueDate = new Date(task.due_on)
        if (isInCurrentWeek(dueDate, weekStart, weekEnd)) {
          pendingCount += quantity
        }
      }
    }
    
    // Расчет показателей
    const totalPlan = completedCount + pendingCount // Запланировано товаров на неделю
    const remainingToPlan = 80 - totalPlan // До выполнения плана (80 товаров). Может быть отрицательным при перевыполнении
    
    // Подключение к Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)
    
    // Форматирование дат для Supabase
    const weekStartStr = weekStart.toISOString().split('T')[0]
    const weekEndStr = weekEnd.toISOString().split('T')[0]
    
    // Сохранение или обновление данных в Supabase
    const { data: existingData, error: selectError } = await supabase
      .from('asana_stats')
      .select('id')
      .eq('week_start_date', weekStartStr)
      .single()
    
    const statsData = {
      week_start_date: weekStartStr,
      week_end_date: weekEndStr,
      completed_count: completedCount,
      pending_count: pendingCount,
      total_plan: totalPlan,
      remaining_to_plan: remainingToPlan,
      updated_at: new Date().toISOString()
    }
    
    if (existingData) {
      // Обновляем существующую запись
      const { error } = await supabase
        .from('asana_stats')
        .update(statsData)
        .eq('id', existingData.id)
      
      if (error) throw error
    } else {
      // Создаем новую запись
      const { error } = await supabase
        .from('asana_stats')
        .insert(statsData)
      
      if (error) throw error
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        data: statsData,
        message: 'Statistics updated successfully'
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 200
      }
    )
    
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})
```

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
- Обновление при заполнении поля "Кол-во товаров" в задаче
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

Эта кнопка позволяет вручную обновить данные в любой момент, если автоматическое обновление еще не сработало.

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
        Данные обновляются автоматически каждый час. В воскресенье в 23:59 данные очищаются для новой недели.
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
   - **Автоматическое**: Через Webhooks от Asana (при создании/изменении задач) или через cron job (каждые 5-10 минут)
   - **Ручное**: Через кнопку "Обновить данные" на странице "Задачи"
   - После настройки макбук больше не нужен - все работает автоматически на серверах Supabase

4. **Обработка ошибок**: Если Asana API недоступен, функция вернет ошибку, но не сломает сайт.

5. **Лимиты API**: Asana API имеет лимиты на количество запросов. При использовании Webhooks запросы происходят только при реальных изменениях, что более эффективно, чем периодические проверки.

6. **Макбук нужен только для настройки**: После развертывания Edge Function и настройки Webhooks/Cron, макбук больше не требуется. Все работает автоматически на серверах Supabase.

## Дополнительные улучшения (опционально)

1. Добавить кеширование данных на фронтенде
2. Добавить индикатор последнего обновления
3. Добавить график прогресса за неделю
4. Добавить уведомления при достижении плана


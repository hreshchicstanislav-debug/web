# Инструкция по проверке данных в Supabase

## Проблема
"До выполнения плана" показывает 0, хотя должно быть 8.

## Способы проверки

### Способ 1: Через консоль браузера (быстро)

1. Откройте приложение в браузере
2. Откройте консоль разработчика (F12 или Cmd+Option+I)
3. Перейдите на вкладку "Console"
4. Скопируйте и выполните код из файла `check_supabase_data.js`
5. Или просто выполните:

```javascript
async function checkData() {
  const { data } = await supabaseClient
    .from('asana_stats')
    .select('*')
    .order('week_start_date', { ascending: false })
    .limit(1)
    .single();
  
  console.log('План в БД:', data.plan);
  console.log('done_fact_this_week:', data.done_fact_this_week);
  console.log('remaining_to_plan в БД:', data.remaining_to_plan);
  console.log('Рассчитано с планом 80:', Math.max(0, 80 - data.done_fact_this_week));
}

checkData();
```

### Способ 2: Через Supabase SQL Editor (детально)

1. Откройте [Supabase Dashboard](https://supabase.com/dashboard)
2. Выберите ваш проект
3. Перейдите в **SQL Editor**
4. Откройте файл `check_remaining_to_plan.sql`
5. Скопируйте содержимое и выполните

Скрипт покажет:
- Текущие значения в `asana_stats`
- Правильность расчета `remaining_to_plan`
- Какие задачи учитываются в `done_fact_this_week`

## Что проверить

### 1. Значение `plan` в базе данных

**Ожидается:** План может быть динамическим (80-100) в зависимости от `week_load`

**Проверка:**
```sql
SELECT plan, week_load, done_fact_this_week 
FROM asana_stats 
ORDER BY week_start_date DESC 
LIMIT 1;
```

**Если `plan` в БД ≠ 80:**
- Это нормально, если используется динамический план
- На фронтенде план всегда 80 (статический)
- Фронтенд должен пересчитывать `remaining_to_plan = max(0, 80 - done_fact_this_week)`

### 2. Значение `done_fact_this_week`

**Ожидается:** Сумма `q` всех задач, которые:
- `completed = true`
- `q > 0`
- Фактическая неделя (week_processed, week_shot или completed_at) = текущая неделя

**Проверка:**
```sql
SELECT 
  COUNT(*) as task_count,
  SUM(q) as total_q
FROM asana_tasks
WHERE (
  week_processed = (SELECT week_start_date FROM asana_stats ORDER BY week_start_date DESC LIMIT 1)
  OR week_shot = (SELECT week_start_date FROM asana_stats ORDER BY week_start_date DESC LIMIT 1)
)
AND completed = true
AND q > 0;
```

### 3. Значение `remaining_to_plan`

**Ожидается:** `remaining_to_plan = max(0, plan - done_fact_this_week)`

**Проверка:**
```sql
SELECT 
  plan,
  done_fact_this_week,
  remaining_to_plan,
  GREATEST(0, plan - done_fact_this_week) as calculated_remaining,
  remaining_to_plan - GREATEST(0, plan - done_fact_this_week) as difference
FROM asana_stats
ORDER BY week_start_date DESC
LIMIT 1;
```

**Если `difference ≠ 0`:**
- В базе данных неправильно рассчитан `remaining_to_plan`
- Нужно пересчитать статистику через Edge Function или SQL-скрипт

## Возможные проблемы

### Проблема 1: `remaining_to_plan` в БД рассчитан с динамическим планом

**Симптомы:**
- `plan` в БД = 72 (например)
- `done_fact_this_week` = 72
- `remaining_to_plan` в БД = 0
- Но на фронтенде должно быть: `80 - 72 = 8`

**Решение:**
- Фронтенд уже исправлен и пересчитывает `remaining_to_plan = max(0, 80 - done_fact_this_week)`
- Обновите страницу с очисткой кеша (Ctrl+Shift+R)

### Проблема 2: `done_fact_this_week` неправильно рассчитан

**Симптомы:**
- Сумма `q` задач не равна `done_fact_this_week` в БД

**Решение:**
- Нужно пересчитать статистику через Edge Function `fetch-asana-stats`
- Или выполнить SQL-скрипт `recalculate_asana_stats_simple.sql`

### Проблема 3: Задачи не учитываются в `done_fact_this_week`

**Симптомы:**
- Задачи завершены (`completed = true`), но не попадают в расчет

**Проверка:**
```sql
SELECT * FROM asana_tasks
WHERE completed = true
AND q > 0
AND (
  week_processed IS NULL
  AND week_shot IS NULL
  AND completed_at IS NULL
);
```

**Решение:**
- Нужно обновить задачи через Edge Function `fetch-asana-stats`
- Edge Function должен правильно заполнить `week_processed`, `week_shot` на основе `processed_at`, `shot_at`, `completed_at`

## Быстрое исправление

Если проблема в данных в БД, выполните:

1. **Обновите статистику через Edge Function:**
   - На вкладке "Задачи" нажмите "Обновить данные"
   - Или вызовите Edge Function вручную

2. **Или пересчитайте через SQL:**
   ```sql
   -- Выполните скрипт recalculate_asana_stats_simple.sql
   ```

3. **Проверьте результат:**
   ```sql
   SELECT 
     plan,
     done_fact_this_week,
     remaining_to_plan,
     GREATEST(0, 80 - done_fact_this_week) as should_be_on_frontend
   FROM asana_stats
   ORDER BY week_start_date DESC
   LIMIT 1;
   ```

## После исправления

1. Обновите страницу с очисткой кеша (Ctrl+Shift+R / Cmd+Shift+R)
2. Проверьте значение "До выполнения плана" на вкладке "Задачи"
3. Оно должно быть: `max(0, 80 - done_fact_this_week)`


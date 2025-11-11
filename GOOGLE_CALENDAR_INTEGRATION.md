# Инструкция по интеграции Google Calendar с TimeTracker

## Обзор

Данные из Google Calendar будут автоматически синхронизироваться с базой данных Supabase, а затем отображаться на сайте TimeTracker в экране начальника.

**Архитектура:**
```
Google Calendar → Supabase (таблица shootings) → TimeTracker (экран начальника)
```

## Шаг 1: Создание таблицы в Supabase

1. Откройте ваш проект в [Supabase Dashboard](https://app.supabase.com)
2. Перейдите в раздел **SQL Editor**
3. Откройте файл `create_shootings_table.sql` из проекта
4. Скопируйте содержимое SQL скрипта и выполните его в SQL Editor
5. Убедитесь, что таблица `shootings` создана успешно

## Шаг 2: Настройка Google Calendar API

### 2.1. Создание проекта в Google Cloud Console

1. Перейдите в [Google Cloud Console](https://console.cloud.google.com)
2. Создайте новый проект или выберите существующий
3. Включите **Google Calendar API**:
   - Перейдите в **APIs & Services** → **Library**
   - Найдите "Google Calendar API"
   - Нажмите **Enable**

### 2.2. Создание учетных данных (OAuth 2.0)

1. Перейдите в **APIs & Services** → **Credentials**
2. Нажмите **Create Credentials** → **OAuth client ID**
3. Выберите тип приложения: **Web application**
4. Добавьте **Authorized redirect URIs**:
   - Для локальной разработки: `http://localhost:3000/auth/callback`
   - Для продакшена: `https://ваш-домен.com/auth/callback`
5. Сохраните **Client ID** и **Client Secret** (они понадобятся позже)

**Сохраненные учетные данные:**

- **Client ID:** `ваш-client-id.apps.googleusercontent.com`
- **Client Secret:** `ваш-client-secret`

**ВАЖНО:** Замените эти значения на ваши реальные Client ID и Client Secret из Google Cloud Console.

### 2.3. Настройка OAuth consent screen

1. Перейдите в **APIs & Services** → **OAuth consent screen**
2. Выберите тип приложения: **External** (или **Internal** если у вас Google Workspace)
3. Заполните обязательные поля:
   - App name: `TimeTracker Calendar Sync`
   - User support email: ваш email
   - Developer contact: ваш email
4. Добавьте scopes:
   - `https://www.googleapis.com/auth/calendar.readonly` (для чтения календаря)
5. Сохраните и продолжите

## Шаг 3: Реализация синхронизации через Google Apps Script

### 3.1. Создание скрипта

1. Откройте [Google Apps Script](https://script.google.com)
2. Создайте новый проект
3. Вставьте следующий код:

```javascript
// Конфигурация
const SUPABASE_URL = 'https://ваш-проект.supabase.co';

// ВАЖНО: Для Google Apps Script используйте SERVICE_ROLE_KEY, а не ANON_KEY!
// Anon key используется только на сайте (в браузере), а Apps Script работает как сервер
// Service Role Key можно получить в Supabase Dashboard → Project Settings → API
const SUPABASE_SERVICE_ROLE_KEY = 'ваш-service-role-key';

// ВАЖНО: Укажите ID календаря для съёмок
// Вариант 1: Использовать основной календарь
const CALENDAR_ID = 'primary';

// Вариант 2: Использовать отдельный календарь для съёмок
// Чтобы узнать ID календаря:
// 1. Откройте Google Calendar в браузере
// 2. Настройки календаря → выберите нужный календарь
// 3. В разделе "Интеграция календаря" найдите "Идентификатор календаря"
// 4. Скопируйте email-адрес (например: abc123@group.calendar.google.com)
// Раскомментируйте следующую строку и укажите ваш ID календаря:
// const CALENDAR_ID = 'ваш-email-календаря@group.calendar.google.com';

// ВАЖНО: Убедитесь, что CALENDAR_ID определена! Если используете отдельный календарь,
// раскомментируйте строку выше и укажите правильный ID календаря.

// ОПЦИОНАЛЬНО: Фильтрация по цвету события
// Если вы используете определенный цвет для съёмок, укажите его здесь
// Цвета: 'lavender', 'sage', 'grape', 'flamingo', 'banana', 'tangerine', 
//        'peacock', 'graphite', 'blueberry', 'basil', 'tomato'
// Если не нужна фильтрация по цвету, оставьте null
const FILTER_BY_COLOR = null; // или например: 'peacock'

// ОПЦИОНАЛЬНО: Фильтрация по ключевым словам в названии
// Если хотите синхронизировать только события с определенными словами
// Оставьте пустым массив [], чтобы брать ВСЕ события из календаря
const KEYWORDS = []; // например: ['съёмка', 'shooting', 'фото']

// Функция для синхронизации съёмок
function syncShootings() {
  try {
    Logger.log('Начало синхронизации...');
    
    // Проверяем, что CALENDAR_ID определена
    if (typeof CALENDAR_ID === 'undefined' || !CALENDAR_ID) {
      Logger.log('КРИТИЧЕСКАЯ ОШИБКА: CALENDAR_ID не определена!');
      Logger.log('Укажите CALENDAR_ID в конфигурации перед функцией syncShootings()');
      Logger.log('Например: const CALENDAR_ID = \'primary\';');
      Logger.log('Или: const CALENDAR_ID = \'ваш-email@group.calendar.google.com\';');
      return;
    }
    
    // Получаем календарь
    let calendar;
    try {
      calendar = CalendarApp.getCalendarById(CALENDAR_ID);
      Logger.log('Календарь найден: ' + CALENDAR_ID);
    } catch (error) {
      Logger.log('ОШИБКА: Не удалось найти календарь с ID: ' + CALENDAR_ID);
      Logger.log('Проверьте правильность CALENDAR_ID в конфигурации');
      Logger.log('Ошибка: ' + error.toString());
      return;
    }
    
    const now = new Date();
    const futureDate = new Date();
    futureDate.setMonth(futureDate.getMonth() + 3); // Синхронизируем на 3 месяца вперед
    
    Logger.log('Получаем события с ' + now + ' по ' + futureDate);
    
    // Получаем только будущие события (начиная с текущего момента)
    const events = calendar.getEvents(now, futureDate);
    Logger.log('Найдено событий в календаре: ' + events.length);
    
    // Фильтруем события
    const shootings = events.filter(event => {
      const endTime = event.getEndTime();
      
      // Пропускаем события, которые уже закончились
      if (endTime < now) {
        return false;
      }
      
      // Фильтрация по цвету (если указана)
      if (FILTER_BY_COLOR) {
        const eventColor = event.getColor();
        if (eventColor !== FILTER_BY_COLOR) {
          return false;
        }
      }
      
      // Фильтрация по ключевым словам (если указаны)
      if (KEYWORDS.length > 0) {
        const title = event.getTitle().toLowerCase();
        const description = event.getDescription() ? event.getDescription().toLowerCase() : '';
        const hasKeyword = KEYWORDS.some(keyword => 
          title.includes(keyword.toLowerCase()) || description.includes(keyword.toLowerCase())
        );
        if (!hasKeyword) {
          return false;
        }
      }
      
      return true;
    });
    
    Logger.log('Отфильтровано съёмок: ' + shootings.length);
    
    // Отправляем каждое событие в Supabase
    let successCount = 0;
    let errorCount = 0;
    
    shootings.forEach(event => {
      try {
        const startTime = event.getStartTime();
        const endTime = event.getEndTime();
        
        // ВАЖНО: Время берется из выбранного времени события (startTime и endTime),
        // а НЕ из названия события
        const shootingData = {
          date: Utilities.formatDate(startTime, Session.getScriptTimeZone(), 'yyyy-MM-dd'),
          start_time: Utilities.formatDate(startTime, Session.getScriptTimeZone(), 'HH:mm:ss'),
          end_time: Utilities.formatDate(endTime, Session.getScriptTimeZone(), 'HH:mm:ss'),
          google_event_id: event.getId()
        };
        
        Logger.log('Синхронизируем: ' + shootingData.date + ' ' + shootingData.start_time + '-' + shootingData.end_time + ' (ID: ' + shootingData.google_event_id + ')');
        Logger.log('Данные для отправки: ' + JSON.stringify(shootingData));
        
        // Отправляем в Supabase (upsert - обновляет существующие или создает новые)
        const result = sendToSupabase(shootingData);
        if (result) {
          successCount++;
          Logger.log('✓ Успешно синхронизировано: ' + shootingData.date);
        } else {
          errorCount++;
          Logger.log('✗ Ошибка синхронизации: ' + shootingData.date);
        }
      } catch (error) {
        Logger.log('Ошибка обработки события: ' + error.toString());
        errorCount++;
      }
    });
    
    // Собираем ID событий из календаря
    const calendarEventIds = shootings.map(event => event.getId());
    Logger.log('ID событий в календаре: ' + calendarEventIds.length);
    
    // Удаляем старые съёмки из базы (которые уже прошли)
    deleteOldShootings(now);
    
    // Удаляем съёмки, которые были удалены из календаря
    deleteRemovedShootings(calendarEventIds, now);
    
    Logger.log('=== Результат синхронизации ===');
    Logger.log('Успешно синхронизировано: ' + successCount);
    Logger.log('Ошибок: ' + errorCount);
    Logger.log('Всего съёмок в календаре: ' + shootings.length);
  } catch (error) {
    Logger.log('КРИТИЧЕСКАЯ ОШИБКА синхронизации: ' + error.toString());
    Logger.log('Стек ошибки: ' + error.stack);
  }
}

// Функция для удаления прошедших съёмок из базы
function deleteOldShootings(now) {
  try {
    const today = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    const url = `${SUPABASE_URL}/rest/v1/shootings?date=lt.${today}`;
    
    const options = {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      },
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    if (responseCode === 200 || responseCode === 204) {
      Logger.log('Старые съёмки (прошедшие даты) удалены');
    } else {
      Logger.log('Ошибка удаления старых съёмок (код ' + responseCode + '): ' + response.getContentText());
    }
  } catch (error) {
    Logger.log('Ошибка удаления старых съёмок: ' + error.toString());
  }
}

// Функция для удаления съёмок, которые были удалены из календаря
function deleteRemovedShootings(calendarEventIds, now) {
  try {
    const today = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    
    // Получаем все будущие съёмки из Supabase
    const url = `${SUPABASE_URL}/rest/v1/shootings?date=gte.${today}&select=google_event_id`;
    
    const options = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      },
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    
    if (responseCode !== 200) {
      Logger.log('Ошибка получения съёмок из Supabase (код ' + responseCode + '): ' + response.getContentText());
      return;
    }
    
    const responseText = response.getContentText();
    let supabaseShootings = [];
    
    try {
      supabaseShootings = JSON.parse(responseText);
    } catch (parseError) {
      Logger.log('Ошибка парсинга ответа от Supabase: ' + parseError.toString());
      Logger.log('Ответ: ' + responseText);
      return;
    }
    
    if (!Array.isArray(supabaseShootings)) {
      Logger.log('Неожиданный формат ответа от Supabase: ' + responseText);
      return;
    }
    
    Logger.log('Найдено съёмок в Supabase: ' + supabaseShootings.length);
    
    // Находим съёмки, которых нет в календаре
    const shootingsToDelete = supabaseShootings.filter(shooting => {
      return !calendarEventIds.includes(shooting.google_event_id);
    });
    
    if (shootingsToDelete.length === 0) {
      Logger.log('Все съёмки из Supabase присутствуют в календаре');
      return;
    }
    
    Logger.log('Найдено съёмок для удаления (отсутствуют в календаре): ' + shootingsToDelete.length);
    
    // Удаляем каждую съёмку
    let deletedCount = 0;
    shootingsToDelete.forEach(shooting => {
      try {
        const deleteUrl = `${SUPABASE_URL}/rest/v1/shootings?google_event_id=eq.${encodeURIComponent(shooting.google_event_id)}`;
        
        const deleteOptions = {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_SERVICE_ROLE_KEY,
            'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
          },
          muteHttpExceptions: true
        };
        
        const deleteResponse = UrlFetchApp.fetch(deleteUrl, deleteOptions);
        const deleteCode = deleteResponse.getResponseCode();
        
        if (deleteCode === 200 || deleteCode === 204) {
          deletedCount++;
          Logger.log('✓ Удалена съёмка с ID: ' + shooting.google_event_id);
        } else {
          Logger.log('✗ Ошибка удаления съёмки с ID ' + shooting.google_event_id + ' (код ' + deleteCode + '): ' + deleteResponse.getContentText());
        }
      } catch (error) {
        Logger.log('✗ Ошибка удаления съёмки с ID ' + shooting.google_event_id + ': ' + error.toString());
      }
    });
    
    Logger.log('=== Удаление завершено ===');
    Logger.log('Удалено съёмок из Supabase: ' + deletedCount + ' из ' + shootingsToDelete.length);
  } catch (error) {
    Logger.log('Ошибка удаления удаленных съёмок: ' + error.toString());
    Logger.log('Стек ошибки: ' + error.stack);
  }
}

// Функция для отправки данных в Supabase (upsert - обновляет существующие или создает новые)
function sendToSupabase(shootingData) {
  // Сначала пытаемся обновить существующую запись через PATCH
  // Если запись не найдена (404), создаем новую через POST
  const updateResult = updateExistingShooting(shootingData);
  if (updateResult) {
    return true;
  }
  
  // Если обновление не удалось (запись не существует), создаем новую
  const url = `${SUPABASE_URL}/rest/v1/shootings`;
  
  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE_ROLE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      'Prefer': 'return=minimal'
    },
    payload: JSON.stringify(shootingData),
    muteHttpExceptions: true
  };
  
  try {
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    
    // 201 - создана новая запись
    if (responseCode === 201 || responseCode === 200 || responseCode === 204) {
      Logger.log('✓ Новая запись успешно создана через POST для ID: ' + shootingData.google_event_id);
      return true;
    } else if (responseCode === 409) {
      // Конфликт - запись уже существует (может произойти при параллельных запросах)
      // Это нормально, запись уже есть в базе
      Logger.log('→ Запись уже существует (409), считаем успешным для ID: ' + shootingData.google_event_id);
      return true;
    } else {
      const responseText = response.getContentText();
      Logger.log('✗ Ошибка создания записи в Supabase (код ' + responseCode + ') для ID: ' + shootingData.google_event_id);
      Logger.log('Ответ сервера: ' + responseText);
      Logger.log('Отправленные данные: ' + JSON.stringify(shootingData));
      return false;
    }
  } catch (error) {
    Logger.log('Ошибка создания записи: ' + error.toString());
    return false;
  }
}

// Функция для обновления существующей записи через PATCH
function updateExistingShooting(shootingData) {
  try {
    // 1) Сначала проверяем, существует ли запись через GET
    const checkUrl = `${SUPABASE_URL}/rest/v1/shootings?select=id&google_event_id=eq.${encodeURIComponent(shootingData.google_event_id)}`;
    
    const checkOptions = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
      },
      muteHttpExceptions: true
    };
    
    const checkResp = UrlFetchApp.fetch(checkUrl, checkOptions);
    const checkCode = checkResp.getResponseCode();
    
    if (checkCode !== 200) {
      Logger.log('→ Ошибка проверки существования записи (код ' + checkCode + '): ' + checkResp.getContentText());
      return false; // Записи нет или ошибка - нужно создать через POST
    }
    
    const existing = JSON.parse(checkResp.getContentText());
    
    if (!Array.isArray(existing) || existing.length === 0) {
      // Записи нет — нужно создать через POST
      Logger.log('→ Запись не найдена через GET, будет создана через POST для ID: ' + shootingData.google_event_id);
      return false;
    }
    
    // 2) Запись существует — выполняем PATCH для обновления
    const url = `${SUPABASE_URL}/rest/v1/shootings?google_event_id=eq.${encodeURIComponent(shootingData.google_event_id)}`;
    
    const options = {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        'Prefer': 'return=minimal'
      },
      payload: JSON.stringify(shootingData),
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(url, options);
    const code = response.getResponseCode();
    
    if (code === 204 || code === 200) {
      Logger.log('✓ Обновление через PATCH успешно для ID: ' + shootingData.google_event_id);
      return true;
    }
    
    Logger.log('✗ PATCH вернул код ' + code + ' для ID: ' + shootingData.google_event_id + '. Ответ: ' + response.getContentText());
    return false;
  } catch (err) {
    Logger.log('Ошибка в updateExistingShooting: ' + err.toString());
    return false;
  }
}

// Функция для настройки триггера (запускается один раз)
function setupTrigger() {
  // Удаляем существующие триггеры
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === 'syncShootings') {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  // Создаем новый триггер - запускается каждый час
  ScriptApp.newTrigger('syncShootings')
    .timeBased()
    .everyHours(1)
    .create();
  
  Logger.log('Триггер настроен: синхронизация каждый час');
}
```

### 3.2. Настройка скрипта

1. Замените `SUPABASE_URL` и `SUPABASE_SERVICE_ROLE_KEY` на ваши значения из Supabase
   - **ВАЖНО:** Используйте **Service Role Key**, а не Anon Key!
   - Service Role Key можно получить в Supabase Dashboard → Project Settings → API
2. Настройте `CALENDAR_ID` (см. раздел 3.3)
3. Настройте фильтрацию (если нужно) — см. раздел 3.3
4. Сохраните проект

### 3.3. Настройка конфигурации

**ВАЖНО:** Перед запуском проверьте настройки:

1. **CALENDAR_ID** — укажите правильный ID календаря:
   - Если используете основной календарь: `'primary'`
   - Если используете отдельный календарь для съёмок:
     - Откройте Google Calendar в браузере
     - Настройки календаря → выберите нужный календарь
     - В разделе "Интеграция календаря" найдите "Идентификатор календаря"
     - Скопируйте email-адрес (например: `abc123@group.calendar.google.com`)
     - Укажите: `const CALENDAR_ID = 'abc123@group.calendar.google.com';`

2. **KEYWORDS** — оставьте пустым массив `[]`, чтобы брать ВСЕ события из календаря
   - Если хотите фильтровать по ключевым словам, укажите: `['съёмка', 'shooting']`

3. **FILTER_BY_COLOR** — оставьте `null`, если не используете цвет для фильтрации
   - Если используете определенный цвет для съёмок, укажите его (например: `'peacock'`)

### 3.4. Запуск синхронизации

1. Выберите функцию `syncShootings` в выпадающем списке
2. Нажмите **Run** (▶️)
3. Разрешите доступ к календарю при первом запуске
4. Проверьте логи выполнения (см. раздел "Отладка" ниже)

### 3.5. Настройка автоматической синхронизации

После успешного ручного запуска настройте автоматическую синхронизацию:

1. Выберите функцию `setupTrigger` в выпадающем списке
2. Нажмите **Run** (▶️)
3. После настройки триггера синхронизация будет происходить автоматически каждый час

### 3.6. Отладка и проверка

Если синхронизируется ноль съёмок или новая съёмка не появляется:

1. **Проверьте логи:**
   - В Google Apps Script откройте **Executions** (выполнения)
   - Выберите последнее выполнение функции `syncShootings`
   - Проверьте логи — там будет подробная информация:
     - Сколько событий найдено в календаре
     - Сколько отфильтровано
     - Какие данные отправляются в Supabase
     - Какие ошибки возникли (с кодами ответов и текстом ошибок)
     - Успешно ли созданы/обновлены записи

2. **Проверьте настройки:**
   - Убедитесь, что `CALENDAR_ID` указан правильно
   - Убедитесь, что `KEYWORDS = []` (пустой массив) для синхронизации всех событий
   - Убедитесь, что `FILTER_BY_COLOR = null` (если не используете фильтрацию по цвету)
   - Проверьте, что `SUPABASE_URL` и `SUPABASE_SERVICE_ROLE_KEY` указаны правильно
   - **ВАЖНО:** Используйте **Service Role Key**, а не Anon Key для Google Apps Script!

3. **Проверьте календарь:**
   - Убедитесь, что в календаре есть будущие события (начиная с сегодняшнего дня)
   - Убедитесь, что события не закончились (время окончания >= текущее время)
   - Проверьте, что событие находится в правильном календаре (с ID из `CALENDAR_ID`)

4. **Проверьте Supabase:**
   - Убедитесь, что таблица `shootings` создана
   - Проверьте права доступа (таблица должна быть доступна для записи через anon key)
   - Проверьте, что в таблице есть записи (может быть, они уже синхронизированы)

5. **Если новая съёмка не синхронизируется:**
   - Проверьте логи — там будет видно, отправляется ли событие в Supabase
   - Проверьте, что событие не закончилось (время окончания >= текущее время)
   - Проверьте, что событие находится в правильном календаре
   - Проверьте ответ сервера Supabase в логах — там будет видно, почему запись не создалась

6. **Проверка удаления съёмок:**
   - При удалении съёмки из календаря она автоматически удалится из Supabase при следующей синхронизации
   - Проверьте логи — там будет видно, сколько съёмок найдено для удаления
   - Убедитесь, что функция `deleteRemovedShootings` вызывается после синхронизации

## Шаг 4: Проверка работы

1. Откройте экран начальника на сайте TimeTracker
2. Нажмите кнопку **"Показать съёмки"**
3. Убедитесь, что список съёмок отображается корректно
4. Проверьте, что время преобразовано правильно:
   - Время начала съёмки - 1 час = время ухода
   - Время окончания съёмки + 40 минут = время возвращения

## Важные замечания

1. **Фильтрация событий**: Настройте фильтрацию событий в зависимости от того, как вы называете съёмки в календаре
2. **Частота синхронизации**: Google Apps Script имеет ограничение на время выполнения (6 минут). Для большого количества событий может потребоваться оптимизация
3. **Безопасность**: Храните ключи и токены в безопасном месте. Не коммитьте их в Git
4. **Обработка ошибок**: Добавьте обработку ошибок для случаев, когда календарь недоступен или Supabase не отвечает

## Отладка

### Проверка данных в Supabase

1. Откройте Supabase Dashboard
2. Перейдите в **Table Editor**
3. Выберите таблицу `shootings`
4. Убедитесь, что данные синхронизируются

### Проверка логов

- **Google Apps Script**: Откройте **Executions** в редакторе скрипта

## Поддержка

При возникновении проблем:
1. Проверьте логи синхронизации
2. Убедитесь, что таблица `shootings` создана в Supabase
3. Проверьте права доступа к календарю
4. Убедитесь, что ключи и токены настроены правильно


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

## Шаг 3: Выбор способа синхронизации

Есть два основных способа синхронизации данных из Google Calendar:

### Вариант A: Google Apps Script (рекомендуется для простоты)

**Преимущества:**
- Не требует отдельного сервера
- Бесплатно
- Простая настройка
- Автоматическая синхронизация по расписанию

**Недостатки:**
- Ограничения по времени выполнения (6 минут)
- Меньше гибкости

### Вариант B: Отдельный сервер (Node.js/Python)

**Преимущества:**
- Полный контроль
- Больше гибкости
- Можно использовать webhooks

**Недостатки:**
- Требует отдельный сервер
- Более сложная настройка

## Шаг 4: Реализация синхронизации (Вариант A - Google Apps Script)

### 4.1. Создание скрипта

1. Откройте [Google Apps Script](https://script.google.com)
2. Создайте новый проект
3. Вставьте следующий код:

```javascript
// Конфигурация
const SUPABASE_URL = 'https://ваш-проект.supabase.co';
const SUPABASE_ANON_KEY = 'ваш-anon-key';

// ВАЖНО: Укажите ID календаря для съёмок
// Вариант 1: Использовать основной календарь
const CALENDAR_ID = 'primary';

// Вариант 2: Использовать отдельный календарь для съёмок
// Чтобы узнать ID календаря:
// 1. Откройте Google Calendar в браузере
// 2. Настройки календаря → выберите нужный календарь
// 3. В разделе "Интеграция календаря" найдите "Идентификатор календаря"
// 4. Скопируйте email-адрес (например: abc123@group.calendar.google.com)
// const CALENDAR_ID = 'ваш-email-календаря@group.calendar.google.com';

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
    
    // Получаем календарь
    let calendar;
    try {
      calendar = CalendarApp.getCalendarById(CALENDAR_ID);
      Logger.log('Календарь найден: ' + CALENDAR_ID);
    } catch (error) {
      Logger.log('ОШИБКА: Не удалось найти календарь с ID: ' + CALENDAR_ID);
      Logger.log('Проверьте правильность CALENDAR_ID в конфигурации');
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
        
        // Отправляем в Supabase (upsert - обновляет существующие или создает новые)
        const result = sendToSupabase(shootingData);
        if (result) {
          successCount++;
        } else {
          errorCount++;
        }
      } catch (error) {
        Logger.log('Ошибка обработки события: ' + error.toString());
        errorCount++;
      }
    });
    
    // Удаляем старые съёмки из базы (которые уже прошли)
    deleteOldShootings(now);
    
    Logger.log('=== Результат синхронизации ===');
    Logger.log('Успешно синхронизировано: ' + successCount);
    Logger.log('Ошибок: ' + errorCount);
    Logger.log('Всего съёмок: ' + shootings.length);
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
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
      }
    };
    
    const response = UrlFetchApp.fetch(url, options);
    if (response.getResponseCode() === 200 || response.getResponseCode() === 204) {
      Logger.log('Старые съёмки удалены');
    }
  } catch (error) {
    Logger.log('Ошибка удаления старых съёмок: ' + error.toString());
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
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Prefer': 'return=minimal'
    },
    payload: JSON.stringify(shootingData)
  };
  
  try {
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    
    // 201 - создана новая запись
    if (responseCode === 201 || responseCode === 200 || responseCode === 204) {
      return true;
    } else {
      const responseText = response.getContentText();
      Logger.log('Ошибка создания записи в Supabase (код ' + responseCode + '): ' + responseText);
      return false;
    }
  } catch (error) {
    Logger.log('Ошибка создания записи: ' + error.toString());
    return false;
  }
}

// Функция для обновления существующей записи через PATCH
function updateExistingShooting(shootingData) {
  // Экранируем google_event_id для URL (на случай специальных символов)
  const eventId = encodeURIComponent(shootingData.google_event_id);
  const url = `${SUPABASE_URL}/rest/v1/shootings?google_event_id=eq.${eventId}`;
  
  const options = {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Prefer': 'return=minimal'
    },
    payload: JSON.stringify(shootingData),
    muteHttpExceptions: true // Не выбрасывать исключение при ошибках HTTP
  };
  
  try {
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    
    if (responseCode === 200 || responseCode === 204) {
      Logger.log('Запись успешно обновлена через PATCH');
      return true;
    } else if (responseCode === 404) {
      // Запись не найдена - это нормально, будем создавать новую
      Logger.log('Запись не найдена, будет создана новая');
      return false;
    } else {
      const responseText = response.getContentText();
      Logger.log('Ошибка обновления через PATCH (код ' + responseCode + '): ' + responseText);
      return false;
    }
  } catch (error) {
    Logger.log('Ошибка обновления через PATCH: ' + error.toString());
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

### 4.2. Настройка скрипта

1. Замените `SUPABASE_URL` и `SUPABASE_ANON_KEY` на ваши значения из Supabase
2. Настройте `CALENDAR_ID` (см. раздел 4.3)
3. Настройте фильтрацию (если нужно) — см. раздел 4.3
4. Сохраните проект

### 4.3. Настройка конфигурации

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

### 4.4. Запуск синхронизации

1. Выберите функцию `syncShootings` в выпадающем списке
2. Нажмите **Run** (▶️)
3. Разрешите доступ к календарю при первом запуске
4. Проверьте логи выполнения (см. раздел "Отладка" ниже)

### 4.5. Настройка автоматической синхронизации

После успешного ручного запуска настройте автоматическую синхронизацию:

1. Выберите функцию `setupTrigger` в выпадающем списке
2. Нажмите **Run** (▶️)
3. После настройки триггера синхронизация будет происходить автоматически каждый час

### 4.6. Отладка и проверка

Если синхронизируется ноль съёмок:

1. **Проверьте логи:**
   - В Google Apps Script откройте **Executions** (выполнения)
   - Выберите последнее выполнение функции `syncShootings`
   - Проверьте логи — там будет информация:
     - Сколько событий найдено в календаре
     - Сколько отфильтровано
     - Какие ошибки возникли

2. **Проверьте настройки:**
   - Убедитесь, что `CALENDAR_ID` указан правильно
   - Убедитесь, что `KEYWORDS = []` (пустой массив) для синхронизации всех событий
   - Убедитесь, что `FILTER_BY_COLOR = null` (если не используете фильтрацию по цвету)

3. **Проверьте календарь:**
   - Убедитесь, что в календаре есть будущие события (начиная с сегодняшнего дня)
   - Убедитесь, что события не закончились (время окончания >= текущее время)

4. **Проверьте Supabase:**
   - Убедитесь, что таблица `shootings` создана
   - Проверьте, что `SUPABASE_URL` и `SUPABASE_ANON_KEY` указаны правильно
   - Проверьте права доступа (таблица должна быть доступна для записи через anon key)

## Шаг 5: Альтернативный вариант - Node.js сервер

Если вы предпочитаете использовать отдельный сервер, создайте Node.js приложение:

### 5.1. Установка зависимостей

```bash
npm init -y
npm install googleapis @supabase/supabase-js node-cron
```

### 5.2. Создание файла `sync-calendar.js`

```javascript
const { google } = require('googleapis');
const { createClient } = require('@supabase/supabase-js');
const cron = require('node-cron');

// Конфигурация
const SUPABASE_URL = 'https://ваш-проект.supabase.co';
const SUPABASE_ANON_KEY = 'ваш-anon-key';
const GOOGLE_CLIENT_ID = 'ваш-client-id.apps.googleusercontent.com';
const GOOGLE_CLIENT_SECRET = 'ваш-client-secret';
const GOOGLE_REDIRECT_URI = 'http://localhost:3000/auth/callback';
const CALENDAR_ID = 'primary'; // или email вашего календаря для съёмок

// ОПЦИОНАЛЬНО: Фильтрация по ключевым словам
// Оставьте пустым массив [], чтобы брать ВСЕ события из календаря
const KEYWORDS = []; // например: ['съёмка', 'shooting', 'фото']

// Инициализация Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Инициализация Google OAuth
const oauth2Client = new google.auth.OAuth2(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI
);

// Функция для получения токена доступа
// ВАЖНО: При первом запуске нужно получить токен через OAuth flow
async function getAccessToken() {
  // Здесь должен быть сохраненный refresh token
  // Для получения токена используйте OAuth flow один раз
  const refreshToken = 'ваш-refresh-token'; // Сохраните после первого OAuth
  oauth2Client.setCredentials({ refresh_token: refreshToken });
  const { credentials } = await oauth2Client.refreshAccessToken();
  return credentials.access_token;
}

// Функция синхронизации
async function syncShootings() {
  try {
    console.log('Начало синхронизации...');
    
    const accessToken = await getAccessToken();
    oauth2Client.setCredentials({ access_token: accessToken });
    
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    const now = new Date();
    const futureDate = new Date();
    futureDate.setMonth(futureDate.getMonth() + 3);
    
    console.log('Получаем события с', now.toISOString(), 'по', futureDate.toISOString());
    
    // Получаем только будущие события (начиная с текущего момента)
    const response = await calendar.events.list({
      calendarId: CALENDAR_ID,
      timeMin: now.toISOString(), // Только события начиная с текущего момента
      timeMax: futureDate.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });
    
    const events = response.data.items || [];
    console.log('Найдено событий в календаре:', events.length);
    
    // Фильтруем съёмки и проверяем, что событие еще не закончилось
    const shootings = events.filter(event => {
      const end = new Date(event.end.dateTime || event.end.date);
      // Пропускаем события, которые уже закончились
      if (end < now) {
        return false;
      }
      
      // Фильтрация по ключевым словам (если указаны)
      if (KEYWORDS.length > 0) {
        const title = (event.summary || '').toLowerCase();
        const description = (event.description || '').toLowerCase();
        const hasKeyword = KEYWORDS.some(keyword => 
          title.includes(keyword.toLowerCase()) || description.includes(keyword.toLowerCase())
        );
        if (!hasKeyword) {
          return false;
        }
      }
      
      return true;
    });
    
    console.log('Отфильтровано съёмок:', shootings.length);
    
    // Отправляем в Supabase
    let successCount = 0;
    let errorCount = 0;
    
    for (const event of shootings) {
      try {
        const start = new Date(event.start.dateTime || event.start.date);
        const end = new Date(event.end.dateTime || event.end.date);
        
        // ВАЖНО: Время берется из выбранного времени события (start и end),
        // а НЕ из названия события
        const shootingData = {
          date: start.toISOString().split('T')[0],
          start_time: start.toTimeString().split(' ')[0],
          end_time: end.toTimeString().split(' ')[0],
          title: event.summary || 'Съёмка',
          description: event.description || '',
          google_event_id: event.id
        };
        
        console.log('Синхронизируем:', shootingData.date, shootingData.start_time + '-' + shootingData.end_time, '-', shootingData.title);
        
        const { error } = await supabase
          .from('shootings')
          .upsert(shootingData, { onConflict: 'google_event_id' });
        
        if (error) {
          console.error('Ошибка сохранения:', error);
          errorCount++;
        } else {
          successCount++;
        }
      } catch (error) {
        console.error('Ошибка обработки события:', error);
        errorCount++;
      }
    }
    
    // Удаляем старые съёмки из базы (которые уже прошли)
    await deleteOldShootings(now);
    
    console.log('=== Результат синхронизации ===');
    console.log('Успешно синхронизировано:', successCount);
    console.log('Ошибок:', errorCount);
    console.log('Всего съёмок:', shootings.length);
  } catch (error) {
    console.error('КРИТИЧЕСКАЯ ОШИБКА синхронизации:', error);
    console.error('Стек ошибки:', error.stack);
  }
}

// Функция для удаления прошедших съёмок из базы
async function deleteOldShootings(now) {
  try {
    const today = now.toISOString().split('T')[0];
    
    const { error } = await supabase
      .from('shootings')
      .delete()
      .lt('date', today);
    
    if (error) {
      console.error('Ошибка удаления старых съёмок:', error);
    } else {
      console.log('Старые съёмки удалены');
    }
  } catch (error) {
    console.error('Ошибка удаления старых съёмок:', error);
  }
}

// Запуск синхронизации каждый час
cron.schedule('0 * * * *', syncShootings);

// Первый запуск
syncShootings();
```

### 5.3. Получение OAuth токена (один раз)

Для получения refresh token используйте этот код:

```javascript
const { google } = require('googleapis');

const GOOGLE_CLIENT_ID = 'ваш-client-id.apps.googleusercontent.com';
const GOOGLE_CLIENT_SECRET = 'ваш-client-secret';
const GOOGLE_REDIRECT_URI = 'http://localhost:3000/auth/callback';

const oauth2Client = new google.auth.OAuth2(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI
);

// Получите URL для авторизации
const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: ['https://www.googleapis.com/auth/calendar.readonly'],
});

console.log('Откройте этот URL в браузере:', authUrl);
console.log('После авторизации вставьте код из URL сюда:');

// После получения кода:
const code = 'код-из-url';
const { tokens } = await oauth2Client.getToken(code);
console.log('Refresh token:', tokens.refresh_token);
```

## Шаг 6: Проверка работы

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
- **Node.js**: Проверьте консоль сервера

## Поддержка

При возникновении проблем:
1. Проверьте логи синхронизации
2. Убедитесь, что таблица `shootings` создана в Supabase
3. Проверьте права доступа к календарю
4. Убедитесь, что ключи и токены настроены правильно


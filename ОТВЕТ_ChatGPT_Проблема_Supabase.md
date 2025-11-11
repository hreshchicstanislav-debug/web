# Решение проблемы: Supabase не обновляется из Google Apps Script

## Проблема

При запуске скрипта Google Apps Script данные не синхронизируются в Supabase — записи не добавляются, не обновляются и не удаляются.

## Причина

В Google Apps Script используется **anon key** (публичный ключ), но в Supabase для таблицы `shootings` настроены политики безопасности:

- **SELECT / INSERT / UPDATE** — только для `authenticated` пользователей
- **DELETE** — только для `service_role`

**Anon key ≠ authenticated** → Supabase молча отказывает в доступе, и записи не появляются.

## Решение

### Почему нужен service_role key?

- **Anon key** используется только на сайте/фронтенде (в браузере пользователя)
- **Service role key** используется для серверных запросов (Google Apps Script работает как сервер)

### Где взять Service Role Key?

1. Откройте [Supabase Dashboard](https://supabase.com/dashboard)
2. Выберите ваш проект
3. Перейдите в **Project Settings** → **API**
   - Или прямая ссылка: `https://supabase.com/dashboard/project/uqgpynqnboyeqvsaljso/settings/api`
4. Найдите раздел **Project API keys**
5. Скопируйте **Service Role Key** (он длинный, НЕ тот, который anon/public)

⚠️ **ВАЖНО:** Service Role Key имеет полный доступ к базе данных. Храните его в секрете и не публикуйте в открытых репозиториях!

### Как обновить код

В Google Apps Script замените:

**Было:**
```javascript
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
```

**Должно быть:**
```javascript
const SUPABASE_SERVICE_ROLE_KEY = 'ВАШ_SERVICE_ROLE_KEY_ЗДЕСЬ';
```

И во всех запросах к Supabase замените:

**Было:**
```javascript
'apikey': SUPABASE_ANON_KEY,
'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
```

**Должно быть:**
```javascript
'apikey': SUPABASE_SERVICE_ROLE_KEY,
'Authorization': `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`
```

## Где использовать какой ключ?

| Место | Ключ |
|------|------|
| Сайт → браузер (app.js) | `anon` (публичный) |
| Google Apps Script → Supabase | `service_role` (секретный) |

## После исправления

После замены ключа данные начнут:
- ✅ Добавляться в Supabase
- ✅ Обновляться при изменении в календаре
- ✅ Удаляться при удалении из календаря

## Безопасность

⚠️ **КРИТИЧЕСКИ ВАЖНО:**

1. **Service Role Key НИКОГДА не должен попадать в Git/публичные репозитории**
2. Храните его только в Google Apps Script (в коде скрипта)
3. Не публикуйте его в документации или инструкциях
4. Если ключ был скомпрометирован, немедленно сгенерируйте новый в Supabase Dashboard

## Проверка

После обновления кода:

1. Запустите функцию `syncShootings()` в Google Apps Script
2. Проверьте логи — должны появиться сообщения об успешной синхронизации
3. Проверьте таблицу `shootings` в Supabase — записи должны появиться

## Дополнительно

Если после замены ключа проблема сохраняется:

1. Проверьте, что Service Role Key скопирован полностью (без пробелов)
2. Проверьте логи в Google Apps Script — там будут видны ошибки
3. Убедитесь, что таблица `shootings` существует в Supabase
4. Проверьте, что в Supabase нет ограничений на количество запросов


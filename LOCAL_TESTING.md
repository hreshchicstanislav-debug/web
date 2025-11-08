# Локальное тестирование сайта

## Быстрый запуск

### Вариант 1: Использование скрипта (рекомендуется)

```bash
cd /Users/stanislav/web
./start-server.sh
```

Сервер запустится на `http://localhost:8000`

### Вариант 2: Python HTTP сервер

```bash
cd /Users/stanislav/web
python3 -m http.server 8000
```

### Вариант 3: Node.js http-server

```bash
cd /Users/stanislav/web
npx --yes http-server -p 8000 -c-1
```

## Тестирование в iOS-симуляторе

### Шаг 1: Запустите локальный сервер

Выполните один из вариантов выше. Сервер должен быть доступен на `http://localhost:8000`

### Шаг 2: Откройте Xcode

1. Откройте Xcode
2. Выберите **Xcode → Open Developer Tool → Simulator** (или нажмите `Cmd + Space` и введите "Simulator")

### Шаг 3: Запустите iOS-симулятор

1. В Simulator выберите устройство: **File → Open Simulator → iPhone 15 Pro** (или другое устройство)
2. Дождитесь загрузки симулятора

### Шаг 4: Откройте Safari в симуляторе

1. В симуляторе откройте Safari
2. Введите адрес: `http://localhost:8000`
3. Сайт должен загрузиться

### Альтернативный способ: Использование IP-адреса

Если `localhost` не работает в симуляторе, используйте IP-адрес вашего Mac:

1. Узнайте IP-адрес Mac:
   ```bash
   ifconfig | grep "inet " | grep -v 127.0.0.1
   ```
   Или:
   ```bash
   ipconfig getifaddr en0
   ```

2. Используйте этот IP вместо localhost:
   ```
   http://192.168.1.XXX:8000
   ```

## Полезные команды

### Остановка сервера
Нажмите `Ctrl+C` в терминале, где запущен сервер

### Проверка доступности сервера
Откройте в браузере на Mac: `http://localhost:8000`

### Изменение порта
Измените порт в скрипте `start-server.sh` или укажите другой порт:
```bash
python3 -m http.server 3000
```

## Отладка

### Проблема: Сайт не загружается в симуляторе

1. Проверьте, что сервер запущен и доступен на Mac:
   ```bash
   curl http://localhost:8000
   ```

2. Убедитесь, что используете правильный адрес (localhost или IP)

3. Проверьте, что порт не занят:
   ```bash
   lsof -i :8000
   ```

### Проблема: Service Worker не работает

Service Worker требует HTTPS или localhost. При использовании `localhost` он должен работать.

### Проблема: Supabase не работает

Убедитесь, что в `app.js` правильно настроены `SUPABASE_URL` и `SUPABASE_ANON_KEY`.

## Дополнительные инструменты

### Chrome DevTools для мобильной отладки

1. Откройте Chrome на Mac
2. Перейдите в `chrome://inspect`
3. Подключите устройство или используйте эмулятор

### Safari Web Inspector

1. В симуляторе: **Settings → Safari → Advanced → Web Inspector** (включите)
2. На Mac: **Safari → Develop → [Ваш симулятор] → [Страница]**


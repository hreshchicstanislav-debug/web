#!/bin/bash

# Простой скрипт для запуска локального веб-сервера
# Использование: ./start-server.sh

PORT=8000

echo "🚀 Запуск локального веб-сервера..."
echo "📱 Откройте в браузере: http://localhost:$PORT"
echo "📱 Для iOS-симулятора: http://localhost:$PORT"
echo ""
echo "Для остановки сервера нажмите Ctrl+C"
echo ""

# Проверяем наличие Python3
if command -v python3 &> /dev/null; then
    echo "✅ Используется Python3 HTTP сервер"
    python3 -m http.server $PORT
elif command -v node &> /dev/null; then
    echo "✅ Используется Node.js http-server"
    # Проверяем, установлен ли http-server
    if command -v npx &> /dev/null; then
        npx --yes http-server -p $PORT -c-1
    else
        echo "❌ Ошибка: npx не найден"
        exit 1
    fi
else
    echo "❌ Ошибка: не найден Python3 или Node.js"
    exit 1
fi


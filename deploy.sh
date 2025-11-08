#!/bin/bash

cd /Users/stanislav/web

# сообщение коммита со временем
MESSAGE="Авто-деплой: $(date +'%Y-%m-%d %H:%M:%S')"

git add .
git commit -m "$MESSAGE"
git push origin main --force

echo "✅ Полная замена выполнена успешно."

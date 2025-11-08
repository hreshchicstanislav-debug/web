# Завершение настройки Git и GitHub Pages

## Шаг 1: Добавление удаленного репозитория

Выполните в терминале (замените YOUR_USERNAME на ваш GitHub username):

```bash
cd /Users/stanislav/web:

# Добавление удаленного репозитория
git remote add origin https://github.com/YOUR_USERNAME/timetrack.git

# Проверка, что remote добавлен
git remote -v

# Загрузка на GitHub
git push -u origin main
```

Если репозиторий уже существует и вы получили ошибку, используйте:

```bash
git remote set-url origin https://github.com/YOUR_USERNAME/timetrack.git
git push -u origin main
```

## Шаг 2: Настройка GitHub Pages

В GitHub Pages настройка немного изменилась:

1. Откройте ваш репозиторий на GitHub
2. Перейдите в **Settings** (Настройки)
3. В левом меню найдите **Pages** (Страницы)
4. В разделе **Build and deployment** (Сборка и развертывание):
   - **Source**: выберите **Deploy from a branch** (Развертывание из ветки)
   - **Branch**: выберите **main** (или **master**)
   - **Folder**: выберите **/ (root)** или оставьте пустым
   - Нажмите **Save** (Сохранить)

Если опции "/ (root)" нет:
- Просто выберите ветку **main**
- Поле **Folder** оставьте пустым или выберите **/ (root)** если есть
- GitHub Pages автоматически найдет файлы в корне репозитория

## Шаг 3: Проверка

После сохранения настроек:
1. Подождите 1-2 минуты
2. Обновите страницу Settings → Pages
3. Вы увидите сообщение: "Your site is live at https://YOUR_USERNAME.github.io/timetrack/"

## Шаг 4: Если репозиторий называется по-другому

Если ваш репозиторий называется НЕ `timetrack`, нужно обновить пути в файлах:

### manifest.webmanifest:
Замените все `/` на `/ИМЯ_ВАШЕГО_РЕПОЗИТОРИЯ/`

### index.html:
Обновите пути к иконкам и manifest

См. подробную инструкцию в файле `DEPLOYMENT.md`


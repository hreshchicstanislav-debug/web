-- SQL скрипт для очистки базы данных
-- ВНИМАНИЕ: Этот скрипт удалит ВСЕ данные из таблицы time_tracks!
-- Выполните этот скрипт в SQL Editor вашего Supabase проекта

-- Удаляем все записи из таблицы
DELETE FROM time_tracks;

-- Проверяем, что таблица пуста
SELECT COUNT(*) as total_records FROM time_tracks;
-- Должно вернуть 0

-- Если нужно также очистить Storage (фотографии):
-- 1. Перейдите в Storage в Supabase Dashboard
-- 2. Выберите bucket "photos"
-- 3. Выберите все файлы и удалите их


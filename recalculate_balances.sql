-- SQL скрипт для пересчета всех балансов в таблице time_tracks
-- Выполните этот скрипт в SQL Editor в Supabase Dashboard

-- Логика пересчета:
-- 1. Если in_time и out_time отсутствуют → day_balance_min = 0
-- 2. Если есть in_time и out_time → рассчитываем баланс дня
-- 3. carry_new_min(первая строка) = day_balance_min(первая строка)
-- 4. carry_new_min(каждая следующая) = предыдущий carry_new_min + текущий day_balance_min

-- План работы: 09:00 - 18:00 = 9 часов = 540 минут

-- ШАГ 1: Просмотр текущих данных (для проверки)
SELECT 
  date,
  in_time,
  out_time,
  day_balance_min as old_day_balance,
  carry_new_min as old_carry_new,
  created_at
FROM time_tracks
ORDER BY date;

-- ШАГ 2: Упрощенный вариант пересчета (через оконные функции)
-- Этот вариант проще и работает быстрее

-- Сначала обновляем day_balance_min для всех записей
-- Если in_time и out_time отсутствуют → day_balance_min = 0
-- Если есть in_time и out_time → рассчитываем баланс дня
UPDATE time_tracks
SET 
  day_balance_min = CASE 
    WHEN in_time IS NULL OR out_time IS NULL THEN 0
    ELSE (
      -- Время присутствия в минутах
      (EXTRACT(EPOCH FROM (out_time::time - in_time::time)) / 60)::integer
      -- Вычитаем отлучки (если есть)
      - COALESCE((
        SELECT SUM(
          (EXTRACT(EPOCH FROM (
            ((break->>'to')::time) - ((break->>'from')::time)
          )) / 60)::integer
        )
        FROM jsonb_array_elements(
          CASE 
            WHEN breaks_json IS NULL OR breaks_json = '' THEN '[]'::jsonb
            ELSE breaks_json::jsonb
          END
        ) AS break
        WHERE break->>'to' IS NOT NULL 
          AND break->>'from' IS NOT NULL
          AND (break->>'to')::time IS NOT NULL
          AND (break->>'from')::time IS NOT NULL
      ), 0)
      -- Вычитаем план (540 минут = 9 часов)
      - 540
    )
  END,
  updated_at = NOW();

-- ШАГ 3: Пересчитываем carry_new_min через оконную функцию
-- carry_new_min(первая строка) = day_balance_min(первая строка)
-- carry_new_min(каждая следующая) = предыдущий carry_new_min + текущий day_balance_min
WITH ordered_records AS (
  SELECT 
    date,
    day_balance_min,
    ROW_NUMBER() OVER (ORDER BY date) as rn
  FROM time_tracks
),
calculated_carry AS (
  SELECT 
    date,
    day_balance_min,
    SUM(day_balance_min) OVER (ORDER BY date ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) as new_carry_new
  FROM ordered_records
)
UPDATE time_tracks t
SET 
  carry_new_min = cc.new_carry_new,
  updated_at = NOW()
FROM calculated_carry cc
WHERE t.date = cc.date;

-- ШАГ 4: Проверка результатов
SELECT 
  date,
  in_time,
  out_time,
  day_balance_min,
  carry_new_min,
  CASE 
    WHEN day_balance_min = 0 AND (in_time IS NULL OR out_time IS NULL) THEN 'OK (нерабочий день)'
    WHEN day_balance_min != 0 AND in_time IS NOT NULL AND out_time IS NOT NULL THEN 'OK (рабочий день)'
    ELSE 'Проверить'
  END as status
FROM time_tracks
ORDER BY date;


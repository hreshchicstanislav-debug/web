-- SQL скрипт для исправления данных в Supabase
-- Выполните этот скрипт в SQL Editor в Supabase Dashboard

-- 1. Просмотр всех записей с некорректными значениями carry_new_min
-- (значения больше 100000 минут или меньше -100000 минут, или очень большие числа)
SELECT 
  date,
  in_time,
  out_time,
  day_balance_min,
  carry_new_min,
  CASE 
    WHEN carry_new_min > 100000 OR carry_new_min < -100000 THEN 'Некорректное значение (выходит за пределы)'
    WHEN carry_new_min > 1000000 THEN 'Возможно timestamp вместо минут'
    ELSE 'OK'
  END as status
FROM time_tracks
WHERE carry_new_min > 100000 
   OR carry_new_min < -100000
   OR carry_new_min > 1000000
ORDER BY date;

-- 2. Просмотр всех записей для анализа
SELECT 
  date,
  in_time,
  out_time,
  day_balance_min,
  carry_new_min,
  created_at,
  updated_at
FROM time_tracks
ORDER BY date;

-- 3. ОБНУЛЕНИЕ всех некорректных значений carry_new_min и day_balance_min
-- ВНИМАНИЕ: Это обнулит все некорректные значения!
-- Выполните только если уверены, что хотите обнулить все некорректные значения
UPDATE time_tracks
SET 
  carry_new_min = 0,
  day_balance_min = 0,
  updated_at = NOW()
WHERE carry_new_min > 100000 
   OR carry_new_min < -100000
   OR carry_new_min > 1000000
   OR day_balance_min > 100000
   OR day_balance_min < -100000;

-- 4. ПОЛНОЕ ОБНУЛЕНИЕ всех балансов (если нужно начать с нуля)
-- ВНИМАНИЕ: Это обнулит ВСЕ балансы! Используйте только если хотите начать заново
-- UPDATE time_tracks
-- SET 
--   carry_new_min = 0,
--   day_balance_min = 0,
--   updated_at = NOW();

-- 5. УДАЛЕНИЕ всех записей (если нужно начать с чистого листа)
-- ВНИМАНИЕ: Это удалит ВСЕ записи! Используйте только если хотите начать заново
-- DELETE FROM time_tracks;

-- 6. Проверка после исправления
SELECT 
  date,
  in_time,
  out_time,
  day_balance_min,
  carry_new_min
FROM time_tracks
ORDER BY date;


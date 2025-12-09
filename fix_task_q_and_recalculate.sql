-- Скрипт для исправления Q в задаче и пересчета статистики
-- 
-- ПРОБЛЕМА: Если вы изменили Q в Asana, но Edge Function не подтянул изменения
-- (например, задача закрыта и относится к прошлой неделе), нужно:
-- 1. Исправить Q в asana_tasks вручную
-- 2. Пересчитать asana_stats на основе исправленных данных
--
-- ИСПОЛЬЗОВАНИЕ:
-- 1. Найдите GID задачи в Asana (из URL: https://app.asana.com/.../task/1212216295467219)
-- 2. Замените '1212216295467219' на GID вашей задачи
-- 3. Замените 6 на правильное значение Q
-- 4. Выполните скрипт в Supabase SQL Editor

-- ============================================
-- ШАГ 1: Исправление Q в конкретной задаче
-- ============================================

-- Замените эти значения на ваши:
DO $$
DECLARE
  task_gid_to_fix TEXT := '1212216295467219';  -- GID задачи из Asana
  new_q_value INTEGER := 6;  -- Новое значение Q
  task_week_start DATE;
  task_week_processed DATE;
  task_week_shot DATE;
BEGIN
  -- Обновляем Q в задаче
  UPDATE asana_tasks
  SET 
    q = new_q_value,
    updated_at = NOW()
  WHERE asana_task_gid = task_gid_to_fix;
  
  -- Проверяем, что задача обновлена
  IF NOT FOUND THEN
    RAISE NOTICE '❌ Задача с GID % не найдена в asana_tasks', task_gid_to_fix;
    RAISE NOTICE '💡 Проверьте, что задача синхронизирована из Asana';
    RETURN;
  END IF;
  
  RAISE NOTICE '✅ Q обновлено в задаче % на значение %', task_gid_to_fix, new_q_value;
  
  -- Получаем информацию о задаче для определения недели
  SELECT week_start_date, week_processed, week_shot
  INTO task_week_start, task_week_processed, task_week_shot
  FROM asana_tasks
  WHERE asana_task_gid = task_gid_to_fix;
  
  RAISE NOTICE '📋 Информация о задаче:';
  RAISE NOTICE '   Неделя по дедлайну: %', task_week_start;
  RAISE NOTICE '   Неделя обработки: %', task_week_processed;
  RAISE NOTICE '   Неделя съемки: %', task_week_shot;
  
  -- Определяем, какие недели нужно пересчитать
  -- Пересчитываем неделю, к которой относится задача (по фактической дате)
  IF task_week_processed IS NOT NULL THEN
    RAISE NOTICE '🔄 Пересчитываю статистику для недели обработки: %', task_week_processed;
    PERFORM recalculate_asana_stats_for_week(task_week_processed);
  ELSIF task_week_shot IS NOT NULL THEN
    RAISE NOTICE '🔄 Пересчитываю статистику для недели съемки: %', task_week_shot;
    PERFORM recalculate_asana_stats_for_week(task_week_shot);
  ELSIF task_week_start IS NOT NULL THEN
    RAISE NOTICE '🔄 Пересчитываю статистику для недели по дедлайну: %', task_week_start;
    PERFORM recalculate_asana_stats_for_week(task_week_start);
  ELSE
    RAISE NOTICE '⚠️ Не удалось определить неделю задачи. Пересчитываю текущую неделю.';
    PERFORM recalculate_asana_stats_for_week(CURRENT_DATE);
  END IF;
  
  RAISE NOTICE '✅ Статистика пересчитана!';
END $$;

-- ============================================
-- ШАГ 2: Проверка результата
-- ============================================

-- Проверяем, что задача обновлена
SELECT 
  asana_task_gid,
  task_name,
  q,
  completed,
  week_processed,
  week_shot,
  week_start_date,
  updated_at
FROM asana_tasks
WHERE asana_task_gid = '1212216295467219';  -- Замените на ваш GID

-- Проверяем статистику для текущей недели
WITH current_week AS (
  SELECT DATE_TRUNC('week', CURRENT_DATE)::date + INTERVAL '1 day' * (1 - EXTRACT(DOW FROM DATE_TRUNC('week', CURRENT_DATE)::date)) as week_start
)
SELECT 
  week_start_date,
  done_fact_this_week,
  done_qty,
  carry_over_from_prev,
  updated_at
FROM asana_stats, current_week
WHERE week_start_date = current_week.week_start
ORDER BY updated_at DESC
LIMIT 1;


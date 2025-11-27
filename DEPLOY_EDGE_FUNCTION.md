# Инструкция по деплою Edge Function fetch-asana-stats

## Быстрый деплой

Для применения обновлений Edge Function выполните:

```bash
cd /Users/stanislav/web
supabase functions deploy fetch-asana-stats
```

## Проверка деплоя

После деплоя проверьте:

1. **В Supabase Dashboard:**
   - Перейдите в Functions → fetch-asana-stats
   - Убедитесь, что статус функции "Active"
   - Проверьте логи на наличие сообщений `[FetchAsanaStats] Версия: v2-tasks-kpi`

2. **В браузере (вкладка "Задачи"):**
   - Откройте DevTools (F12) → Console
   - Нажмите кнопку "Обновить данные"
   - В логах должно появиться:
     - `[[TasksTab Debug]] Версия Edge Function: v2-tasks-kpi`
     - `[[TasksTab Debug]] Нормализованные значения:` с полями `doneQty`, `toShootQty`, `weekLoad`, `plan` и т.д.
   - Проверьте, что новые поля **не равны `undefined`**

## Что изменилось в версии v2-tasks-kpi

- Добавлены новые поля в ответ: `done_qty`, `to_shoot_qty`, `week_load`, `plan`, `remaining_to_plan`, `on_hand_qty`, `warehouse_qty`, `shot_not_processed_qty`, `q_errors_count`
- Legacy поля (`completed_count`, `pending_count`, `total_plan`) продолжают возвращаться для обратной совместимости
- Добавлено поле `version` в ответ для диагностики

## Устранение проблем

### Проблема: После деплоя всё ещё возвращаются только legacy-поля

**Решение:**
1. Убедитесь, что деплой прошёл успешно: `supabase functions list` должен показывать функцию в статусе "Active"
2. Очистите кеш браузера (Ctrl+Shift+R / Cmd+Shift+R)
3. Проверьте логи Edge Function в Supabase Dashboard на наличие ошибок
4. Убедитесь, что в ответе есть поле `version: "v2-tasks-kpi"` — если его нет, значит вызывается старая версия

### Проблема: Ошибка при деплое

**Решение:**
1. Проверьте, что Supabase CLI установлен: `supabase --version`
2. Убедитесь, что вы находитесь в правильной директории: `/Users/stanislav/web`
3. Проверьте, что файл `supabase/functions/fetch-asana-stats/index.ts` существует и не содержит синтаксических ошибок

## Дополнительная информация

Подробная документация по архитектуре вкладки "Задачи" находится в файле `docs/tasks-tab-architecture.md`.


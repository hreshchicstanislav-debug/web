# Проверка исправления Edge Function для on_hand_qty

## Проблема
Показываются старые цифры:
- "Сфоткано, но не обработано" - 92
- "Уже на руках" - 88

Но по факту товары уже сфотографированы (проставлена дата съемки сегодня) и отданы, поэтому "Уже на руках" должно быть 0.

## Что проверить

### 1. Проверить, что Edge Function обновлена

Откройте файл Edge Function:
```bash
# Путь к Edge Function
/Users/stanislav/supabase/functions/fetch-asana-stats/index.ts
```

Найдите строку ~487 (или поищите `on_hand_qty` или `PRODUCT_SOURCE_PRINESLI`).

**Правильный код должен быть:**
```typescript
if (!task.completed && task.product_source === PRODUCT_SOURCE_PRINESLI && !task.shot_at) {
  onHandQty += q;
}
```

**Неправильный код (старый):**
```typescript
if (!task.completed && task.product_source === PRODUCT_SOURCE_PRINESLI) {
  onHandQty += q;
}
```

### 2. Если код не обновлен

1. Обновите код в файле Edge Function
2. Задеплойте:
   ```bash
   cd /Users/stanislav/supabase
   supabase functions deploy fetch-asana-stats
   ```

### 3. После деплоя - обновите данные

**Вариант 1: Через UI**
- Откройте вкладку "Задачи"
- Нажмите кнопку "Обновить данные"

**Вариант 2: Через консоль браузера**
- Откройте консоль (F12)
- Выполните: `await forceRefreshAsanaStats()`

### 4. Проверить данные в Supabase

Выполните SQL-запрос из файла `diagnose_tasks_data.sql` в Supabase Dashboard → SQL Editor.

Это покажет:
- Сколько задач должно быть в "Уже на руках" (shot_at IS NULL)
- Сколько задач НЕ должно быть в "Уже на руках" (shot_at заполнено)
- Сколько задач в "Сфоткано, но не обработано"
- Текущие значения в asana_stats

### 5. Возможные причины проблемы

1. **Edge Function не обновлена** - код еще со старой логикой
2. **Edge Function не задеплоена** - изменения не применены
3. **Кеш в браузере** - старые данные показываются
4. **Данные в Asana не синхронизированы** - Edge Function не получила свежие данные из Asana

### 6. Принудительная синхронизация

Если данные все еще не обновляются:

1. **Проверьте логи Edge Function:**
   - Supabase Dashboard → Functions → fetch-asana-stats → Logs
   - Ищите ошибки или предупреждения

2. **Проверьте, что данные в Asana актуальны:**
   - Убедитесь, что в задачах проставлена дата "когда сфоткал" (сегодня)
   - Убедитесь, что задачи не завершены (completed = false)

3. **Принудительно обновите через Edge Function:**
   - В консоли браузера: `await forceRefreshAsanaStats()`
   - Или через кнопку "Обновить данные" в UI


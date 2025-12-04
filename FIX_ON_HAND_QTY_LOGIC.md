# Исправление логики `on_hand_qty` (Уже на руках)

## Проблема

Сейчас задача может попадать одновременно в два показателя:
- "Уже на руках" (`on_hand_qty`)
- "Сфоткано, но не обработано" (`shot_not_processed_qty`)

Это происходит, если:
- `product_source = 'PRINESLI'`
- `due_on` в текущей неделе
- `shot_at` заполнено (товар сфотографирован)
- `processed_at` пусто
- `completed = false`

## Правильная логика

**"Уже на руках"** — это товары, которые физически находятся у фотографа:
- Товар принесли (`product_source = 'PRINESLI'`)
- Товар ещё не сфотографирован (`shot_at IS NULL`)
- После съёмки товар возвращается, поэтому он больше не "на руках"

**"Сфоткано, но не обработано"** — это товары, которые уже сфотографированы, но ещё не обработаны:
- `shot_at` заполнено
- `processed_at` пусто
- `completed = false`

## Что нужно изменить

### В Edge Function (`supabase/functions/fetch-asana-stats/index.ts`)

Найти строку ~487, где считается `on_hand_qty`:

**Было:**
```typescript
if (!task.completed && task.product_source === PRODUCT_SOURCE_PRINESLI) {
  onHandQty += q;
}
```

**Должно быть:**
```typescript
if (!task.completed && task.product_source === PRODUCT_SOURCE_PRINESLI && !task.shot_at) {
  onHandQty += q;
}
```

## Путь задачи

1. **"Уже на руках"** — товар принесли, но ещё не сфотографировали (`shot_at IS NULL`)
2. **"Сфоткано, но не обработано"** — товар сфотографирован (`shot_at` заполнено), но не обработан (`processed_at IS NULL`) и задача не завершена (`completed = false`)
3. **"Сделано"** — задача завершена (`completed = true`). 
   - Если `processed_at` заполнено — используется оно как дата обработки
   - Если `processed_at` пусто — используется `completed_at` как дата обработки
   - **Важно:** Даже если нет даты обработки, но задача завершена — она попадает в "Сделано", используя дату завершения (`completed_at`) как дату обработки

## Проверка

После изменения Edge Function:
- Задача с `shot_at` заполнено НЕ должна попадать в `on_hand_qty`
- Задача с `shot_at` заполнено и `processed_at` пусто ДОЛЖНА попадать в `shot_not_processed_qty`
- Задача с `shot_at IS NULL` и `product_source = 'PRINESLI'` ДОЛЖНА попадать в `on_hand_qty`


# Текущий UI вкладки «Задачи» (desktop + mobile)

Полное техническое описание структуры интерфейса вкладки «Задачи» согласно исходному коду проекта.

---

## 1. Общий контейнер страницы и корневая DOM-структура

### 1.1. Корневой контейнер `.tasks-page`

**Элемент**: `<div class="tasks-page">`

**CSS-свойства**:
- Desktop: `max-width: 960px`, `margin: 0 auto`, `padding: 16px`, `box-sizing: border-box`
- Mobile (≤768px): `padding: 12px`
- Mobile (≤480px): `padding: 8px`

**Роль**: Ограничивает ширину контента и центрирует его на странице, обеспечивает единые отступы для всех внутренних блоков.

### 1.2. Полная DOM-иерархия

```
#app
└── div.tasks-page
    ├── h1 "Задачи Asana" (inline style: margin: 0 0 12px 0; font-size: 24px)
    ├── div#tasksHeader
    │   ├── div#tasksOperationalKpi.tasks-kpi-section.tasks-kpi-section--operational
    │   │   ├── div.kpi-grid.tasks-kpi-grid-operational
    │   │   │   ├── div#kpiOnHandCard.kpi-card
    │   │   │   │   ├── h3.kpi-title "Уже на руках"
    │   │   │   │   ├── div#kpiOnHandValue.kpi-value
    │   │   │   │   └── p.kpi-subtext "товаров"
    │   │   │   ├── div#kpiWarehouseCard.kpi-card
    │   │   │   │   ├── h3.kpi-title "Нужно взять со склада"
    │   │   │   │   ├── div#kpiWarehouseValue.kpi-value
    │   │   │   │   └── p.kpi-subtext "товаров"
    │   │   │   └── div#kpiShotNotProcessedCard.kpi-card
    │   │   │       ├── h3.kpi-title "Сфоткано, но не обработано"
    │   │   │       ├── div#kpiShotNotProcessedValue.kpi-value
    │   │   │       └── p.kpi-subtext "товаров"
    │   │   └── p (условно, если qErrorsCount > 0) "Задач с ошибкой Q: N"
    │   └── div#tasksWeeklyKpi.tasks-kpi-section.tasks-kpi-section--weekly
    │       └── div#tasksGrid.kpi-grid
    │           ├── div.kpi-card.kpi-card--done
    │           │   ├── h3.kpi-title "Сделано"
    │           │   ├── div#completedCount.kpi-value.kpi-value--done
    │           │   ├── div#doneStmNonStmMeta.kpi-meta.kpi-meta--stm-split "СТМ: X / НЕ СТМ: Y"
    │           │   ├── div.kpi-meta.kpi-meta--primary
    │           │   │   ├── span "Факт"
    │           │   │   └── strong#doneFactValue
    │           │   └── div#carryOverRow.kpi-meta (.kpi-meta--muted если carryOver = 0)
    │           │       ├── span "Переработка с прошлой недели"
    │           │       └── strong#carryOverValue
    │           ├── div.kpi-card.kpi-card--plan
    │           │   ├── h3.kpi-title "План недели"
    │           │   ├── div#planValue.kpi-value.kpi-value--plan
    │           │   ├── p.kpi-subtext "товаров"
    │           │   └── div.kpi-meta
    │           │       ├── span "Нагрузка недели"
    │           │       └── strong#weekLoadValue
    │           ├── div.kpi-card.kpi-card--pending
    │           │   ├── h3.kpi-title "Предстоит отснять"
    │           │   ├── div#pendingCount.kpi-value.kpi-value--pending
    │           │   └── p.kpi-subtext "товаров"
    │           ├── div#cardRemaining.kpi-card.kpi-card--remaining (.kpi-card--remaining-success если remainingToPlan = 0)
    │           │   ├── h3.kpi-title "До выполнения плана"
    │           │   ├── div#remainingCount.kpi-value (.kpi-value--remaining или .kpi-value--remaining-success)
    │           │   └── p#remainingText.kpi-subtext "товаров (план: 80)"
    │           └── div#overtimeCard.kpi-card.kpi-card--overtime (.kpi-card--muted если overtimeQty = 0)
    │               ├── h3.kpi-title "Переработка недели"
    │               ├── div#overtimeQty.kpi-value.kpi-value--overtime
    │               └── p.kpi-subtext "товаров сверх плана"
    ├── div (margin-top: 16px)
    │   ├── button#refreshStats.btn.btn-full "Обновить данные"
    │   └── p.muted "Нажмите кнопку для получения актуальной статистики из Asana."
    ├── div (margin-top: 16px)
    │   └── button#showDetails.btn.btn-full "Показать подробности" / "Скрыть подробности"
    └── div#tasksDetailsContainer.tasks-details-container (.expanded если tasksDetailsExpanded = true)
        ├── div#tasksDetailsFilters.tasks-filters
        │   └── div.tasks-filters-row
        │       ├── div.tasks-filters-mode
        │       │   ├── button.tasks-filter-mode-btn (.tasks-filter-mode-btn--active если mode = 'operational') [data-mode="operational"] "Только операционные"
        │       │   └── button.tasks-filter-mode-btn (.tasks-filter-mode-btn--active если mode = 'all') [data-mode="all"] "Все задачи"
        │       ├── div.tasks-filters-selects
        │       │   ├── label.tasks-filter-label
        │       │   │   ├── span "Тип товара:"
        │       │   │   └── select#tasksFilterType.tasks-filter-select
        │       │   │       ├── option[value="all"] "Все"
        │       │   │       ├── option[value="СТМ"] "СТМ"
        │       │   │       └── option[value="НЕ СТМ"] "НЕ СТМ"
        │       │   └── label.tasks-filter-label
        │       │       ├── span "Приоритет:"
        │       │       └── select#tasksFilterPriority.tasks-filter-select
        │       │           ├── option[value="all"] "Все"
        │       │           ├── option[value="🔥 Срочно"] "🔥 Срочно"
        │       │           ├── option[value="Высокий"] "Высокий"
        │       │           └── option[value="Средний"] "Средний"
        │       └── div.tasks-filters-checkboxes
        │           ├── label.tasks-filter-checkbox
        │           │   ├── span "Показать выполненные задачи недели"
        │           │   └── input#tasksFilterShowCompleted[type="checkbox"]
        │           └── label.tasks-filter-checkbox
        │               ├── span "Показать только задачи с ошибкой Q"
        │               └── input#tasksFilterOnlyQErrors[type="checkbox"]
        └── div#tasksDetailsInner.tasks-details-inner
            └── div#tasksDetailsList.tasks-details-panel
                └── (динамический контент: счетчик задач, таблица или сообщение)
```

---

## 2. Блок KPI (операционный и недельный)

### 2.1. Контейнер операционного блока KPI

**Элемент**: `#tasksOperationalKpi`

**Классы**: `tasks-kpi-section`, `tasks-kpi-section--operational`

**Стили**: `margin-bottom: 16px`

**Внутренняя сетка**: `.kpi-grid.tasks-kpi-grid-operational`
- Desktop: `grid-template-columns: repeat(3, 1fr)`
- Mobile (≤768px): `grid-template-columns: 1fr !important`

### 2.2. Операционные KPI-карточки

#### 2.2.1. Карточка "Уже на руках" (`#kpiOnHandCard`)

**Классы**: `kpi-card`

**Inline-стили**:
- `background: #fff3e0`
- `border-color: #ff9800`

**Структура**:
- `h3.kpi-title` (inline: `color: #e65100`): "Уже на руках"
- `div#kpiOnHandValue.kpi-value` (inline: `color: #bf360c`): значение `onHandQty`
- `p.kpi-subtext`: "товаров"

**Обновление значения**: функция `updateTasksCards()` обновляет `#kpiOnHandValue.textContent = onHandQty`

**Кликабельность**: при клике вызывает `setTasksDetailsStatusFilter('on_hand')` и `expandTasksDetailsSectionIfCollapsed()`

**Активное состояние** (когда `tasksDetailsFilterState.status === 'on_hand'`):
- `border-width: 2px` (вместо 1px)
- `box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15)`
- `transform: scale(1.02)`
- `transition: all 0.2s ease`

#### 2.2.2. Карточка "Нужно взять со склада" (`#kpiWarehouseCard`)

**Классы**: `kpi-card`

**Inline-стили**:
- `background: #e3f2fd`
- `border-color: #2196f3`

**Структура**:
- `h3.kpi-title` (inline: `color: #1565c0`): "Нужно взять со склада"
- `div#kpiWarehouseValue.kpi-value` (inline: `color: #0d47a1`): значение `warehouseQty`
- `p.kpi-subtext`: "товаров"

**Обновление значения**: `#kpiWarehouseValue.textContent = warehouseQty`

**Кликабельность**: при клике вызывает `setTasksDetailsStatusFilter('warehouse')`

**Активное состояние**: аналогично `#kpiOnHandCard` при `status === 'warehouse'`

#### 2.2.3. Карточка "Сфоткано, но не обработано" (`#kpiShotNotProcessedCard`)

**Классы**: `kpi-card`

**Inline-стили**:
- `background: #f3e5f5`
- `border-color: #9c27b0`

**Структура**:
- `h3.kpi-title` (inline: `color: #6a1b9a`): "Сфоткано, но не обработано"
- `div#kpiShotNotProcessedValue.kpi-value` (inline: `color: #4a148c`): значение `shotNotProcessedQty`
- `p.kpi-subtext`: "товаров"

**Обновление значения**: `#kpiShotNotProcessedValue.textContent = shotNotProcessedQty`

**Кликабельность**: при клике вызывает `setTasksDetailsStatusFilter('shot_not_processed')`

**Активное состояние**: аналогично предыдущим при `status === 'shot_not_processed'`

#### 2.2.4. Подпись об ошибках Q (под операционными карточками)

**Элемент**: `<p>` внутри `#tasksOperationalKpi`

**Условие отображения**: только если `qErrorsCount > 0`

**Стили**: `font-size: 11px`, `color: var(--text-secondary)`, `margin-top: 8px`, `text-align: center`

**Содержимое**: "Задач с ошибкой Q: **N**" (где N в `<strong>` с цветом `#d32f2f`)

**Обновление**: функция `updateTasksCards()` обновляет этот элемент через `document.querySelector('#tasksOperationalKpi p')`, скрывает (`display: none`) если `qErrorsCount === 0`

### 2.3. Контейнер недельного блока KPI

**Элемент**: `#tasksWeeklyKpi`

**Классы**: `tasks-kpi-section`, `tasks-kpi-section--weekly`

**Внутренняя сетка**: `#tasksGrid.kpi-grid`
- Desktop: `grid-template-columns: repeat(auto-fit, minmax(140px, 1fr))`, `gap: 10px`
- Mobile (≤768px): `grid-template-columns: 1fr !important`, `gap: 8px`

### 2.4. Недельные KPI-карточки

#### 2.4.1. Карточка "Сделано" (`.kpi-card--done`)

**Классы**: `kpi-card`, `kpi-card--done`

**CSS-стили**:
- Фон: `#e8f5e9`
- Граница: `#4caf50`
- Заголовок: цвет `#2e7d32`

**Структура**:
- `h3.kpi-title`: "Сделано"
- `div#completedCount.kpi-value.kpi-value--done`: значение `doneQty` (цвет `#1b5e20`, размер `24px`)
- `div#doneStmNonStmMeta.kpi-meta.kpi-meta--stm-split`: "СТМ: X / НЕ СТМ: Y" (размер `11px`, цвет `var(--text-secondary)`)
- `div.kpi-meta.kpi-meta--primary`:
  - `span`: "Факт"
  - `strong#doneFactValue`: значение `doneFact` (цвет `#2e7d32`)
- `div#carryOverRow.kpi-meta` (класс `.kpi-meta--muted` если `carryOver = 0`):
  - `span`: "Переработка с прошлой недели"
  - `strong#carryOverValue`: значение `carryOver`

**Обновление значений**:
- `#completedCount.textContent = doneQty`
- `#doneStmNonStmMeta.textContent = "СТМ: ${doneStmQty} / НЕ СТМ: ${doneNonStmQty}"`
- `#doneFactValue.textContent = doneFact`
- `#carryOverValue.textContent = carryOver`
- `#carryOverRow.style.opacity = carryOver > 0 ? '1' : '0.5'`

#### 2.4.2. Карточка "План недели" (`.kpi-card--plan`)

**Классы**: `kpi-card`, `kpi-card--plan`

**CSS-стили**:
- Фон: `#e3f2fd`
- Граница: `#2196f3`
- Заголовок: цвет `#1565c0`

**Структура**:
- `h3.kpi-title`: "План недели"
- `div#planValue.kpi-value.kpi-value--plan`: значение `plan` (всегда 80, цвет `#0d47a1`)
- `p.kpi-subtext`: "товаров"
- `div.kpi-meta`:
  - `span`: "Нагрузка недели"
  - `strong#weekLoadValue`: значение `weekLoad`

**Обновление значений**:
- `#planValue.textContent = plan` (всегда 80)
- `#weekLoadValue.textContent = weekLoad`

#### 2.4.3. Карточка "Предстоит отснять" (`.kpi-card--pending`)

**Классы**: `kpi-card`, `kpi-card--pending`

**CSS-стили**:
- Фон: `#fff3e0`
- Граница: `#ff9800`
- Заголовок: цвет `#e65100`

**Структура**:
- `h3.kpi-title`: "Предстоит отснять"
- `div#pendingCount.kpi-value.kpi-value--pending`: значение `toShootQty` (цвет `#bf360c`)
- `p.kpi-subtext`: "товаров"

**Обновление значения**: `#pendingCount.textContent = toShootQty`

#### 2.4.4. Карточка "До выполнения плана" (`#cardRemaining`)

**Классы**: `kpi-card`, `kpi-card--remaining` (или `.kpi-card--remaining-success` если `remainingToPlan = 0`)

**Динамические CSS-стили** (обновляются через `updateTasksCards()`):
- Если `remainingToPlan > 0`:
  - Фон: `#fce4ec`
  - Граница: `#e91e63`
  - Заголовок: цвет `#880e4f`
  - Значение: цвет `#c2185b`
- Если `remainingToPlan = 0`:
  - Фон: `#e8f5e9`
  - Граница: `#4caf50`
  - Заголовок: цвет `#2e7d32`
  - Значение: цвет `#1b5e20`

**Структура**:
- `h3.kpi-title`: "До выполнения плана"
- `div#remainingCount.kpi-value` (класс `.kpi-value--remaining` или `.kpi-value--remaining-success`): значение `remainingToPlan`
- `p#remainingText.kpi-subtext`: "товаров (план: 80)"

**Обновление значений**:
- `#remainingCount.textContent = remainingToPlan`
- `#remainingText.textContent = "товаров (план: ${plan})"`
- Динамические стили обновляются через `updateTasksCards()`

#### 2.4.5. Карточка "Переработка недели" (`#overtimeCard`)

**Классы**: `kpi-card`, `kpi-card--overtime` (класс `.kpi-card--muted` если `overtimeQty = 0`)

**CSS-стили**:
- Фон: `#f3f6f4`
- Граница: `#8bc34a`
- Заголовок: цвет `#558b2f`
- Значение: цвет `#33691e`

**Структура**:
- `h3.kpi-title`: "Переработка недели"
- `div#overtimeQty.kpi-value.kpi-value--overtime`: значение `overtimeQty`
- `p.kpi-subtext`: "товаров сверх плана"

**Обновление значений**:
- `#overtimeQty.textContent = overtimeQty`
- `#overtimeCard.style.opacity = overtimeQty > 0 ? '1' : '0.5'`

### 2.5. Общие стили KPI-карточек

**Базовые стили** (`.kpi-card`):
- `background: var(--bg-surface)`
- `border: 1px solid var(--border-default)`
- `border-radius: 8px`
- `padding: 12px` (desktop), `8px` (mobile ≤480px)
- `display: flex`
- `flex-direction: column`
- `gap: 6px`
- `min-height: 100%`

**Заголовок** (`.kpi-title`):
- `margin: 0`
- `font-size: 12px` (desktop), `13px` (mobile ≤768px), `10px` (mobile ≤480px)
- `font-weight: 500`
- `line-height: 1.3`

**Значение** (`.kpi-value`):
- `font-size: 24px` (desktop), `20px` (mobile ≤768px и ≤480px)
- `font-weight: 700`
- `color: var(--text-primary)`

**Подпись** (`.kpi-subtext`):
- `margin: 4px 0 0 0`
- `color: #666`
- `font-size: 11px` (desktop), `9px` (mobile ≤480px)

**Мета-информация** (`.kpi-meta`):
- `display: flex`
- `justify-content: space-between`
- `align-items: center`
- `font-size: 11px`
- `color: #666`
- `.kpi-meta--primary`: цвет `#2e7d32`
- `.kpi-meta--muted`: `opacity: 0.5`

---

## 3. Кнопки действий

### 3.1. Кнопка "Обновить данные" (`#refreshStats`)

**Классы**: `btn`, `btn-full`

**Текст**: "Обновить данные"

**Стили** (`.btn-full`):
- `width: 100%`
- `position: relative`
- `z-index: 1`
- `cursor: pointer`
- `user-select: none`

**Поведение при клике**:
1. Кнопка становится неактивной: `disabled = true`
2. Текст меняется на "Обновление..."
3. Вызывается `getAsanaStats()` для получения свежих данных
4. Обновляются все KPI через `updateTasksCards(stats)`
5. Загружаются детальные данные задач через `getAsanaTasksDetailsByWeekStart()`
6. Если секция подробностей развернута, показывается "Загрузка данных..."
7. После успешной загрузки показывается alert "Данные успешно обновлены!"
8. Кнопка возвращается в исходное состояние: `disabled = false`, текст "Обновить данные"

**Подпись под кнопкой**:
- Элемент: `<p class="muted">`
- Текст: "Нажмите кнопку для получения актуальной статистики из Asana."
- Стили: `margin-top: 8px`, `font-size: 11px`, `line-height: 1.4`

### 3.2. Кнопка "Показать подробности" / "Скрыть подробности" (`#showDetails`)

**Классы**: `btn`, `btn-full`

**Динамический текст**:
- Если `tasksDetailsExpanded = false`: "Показать подробности"
- Если `tasksDetailsExpanded = true`: "Скрыть подробности"

**Поведение при клике**:
1. Переключается `tasksDetailsExpanded = !tasksDetailsExpanded`
2. Если `tasksDetailsExpanded = true`:
   - Текст кнопки меняется на "Скрыть подробности"
   - К `#tasksDetailsContainer` добавляется класс `expanded`
   - Если есть кеш `cachedTasksDetails`, вызывается `renderTasksDetailsFromCache()`
   - Если кеша нет, показывается "Загрузка данных..." и загружаются данные через `getAsanaTasksDetailsByWeekStart()`
3. Если `tasksDetailsExpanded = false`:
   - Текст кнопки меняется на "Показать подробности"
   - У `#tasksDetailsContainer` удаляется класс `expanded`
   - Контейнер скрывается (через CSS или inline-стили)

---

## 4. Блок фильтров

### 4.1. Контейнер фильтров (`#tasksDetailsFilters`)

**Классы**: `tasks-filters`

**Inline-стили**:
- `margin-bottom: 12px`
- `padding: 12px`
- `background: var(--bg-muted)`
- `border-radius: 8px`

**CSS-стили** (из `tasks-mobile.css`):
- Desktop: стандартные стили
- Mobile (≤768px): `display: flex`, `flex-direction: column`, `gap: 8px`

### 4.2. Внутренняя структура фильтров (`.tasks-filters-row`)

**Стили**:
- Desktop: `display: flex`, `flex-direction: column`, `gap: 12px`
- Mobile (≤768px): `flex-direction: column`, `gap: 8px`

### 4.3. Кнопки режима (`.tasks-filters-mode`)

**Контейнер**: `.tasks-filters-mode`

**Стили**:
- Desktop: `display: flex`, `gap: 8px`
- Mobile (≤768px): `flex-direction: column`, все кнопки на `width: 100%`

**Кнопка "Только операционные"**:
- Классы: `.tasks-filter-mode-btn` (класс `.tasks-filter-mode-btn--active` если `tasksDetailsFilterState.mode === 'operational'`)
- Атрибут: `data-mode="operational"`
- Inline-стили (динамические):
  - `padding: 6px 12px`
  - `border: 1px solid var(--border-default)`
  - `background`: `var(--brand-primary)` (если активна) или `var(--bg-surface)` (если неактивна)
  - `color`: `var(--text-inverse)` (если активна) или `var(--text-primary)` (если неактивна)
  - `border-radius: 6px`
  - `font-size: 13px`
  - `cursor: pointer`
  - `font-weight`: `600` (если активна) или `400` (если неактивна)

**Кнопка "Все задачи"**:
- Классы: `.tasks-filter-mode-btn` (класс `.tasks-filter-mode-btn--active` если `tasksDetailsFilterState.mode === 'all'`)
- Атрибут: `data-mode="all"`
- Inline-стили: аналогично кнопке "Только операционные"

**Поведение при клике**:
- Обработчик в `setupTasksDetailsFilters()`:
  - Устанавливается `tasksDetailsFilterState.mode = e.target.dataset.mode`
  - Если `mode === 'all'`, сбрасывается `tasksDetailsFilterState.status = 'all'`
  - Вызывается `updateOperationalCardsVisualState()`
  - Вызывается `syncTasksDetailsFiltersUiFromState()`
  - Вызывается `renderTasksDetailsFromCache()`

### 4.4. Селекты (`.tasks-filters-selects`)

**Контейнер**: `.tasks-filters-selects`

**Стили**:
- Desktop: `display: flex`, `gap: 16px`, `flex-wrap: wrap`
- Mobile (≤768px): элементы в колонку, `width: 100%`

**Селект "Тип товара"** (`#tasksFilterType`):
- Классы: `.tasks-filter-select`
- Лейбл: `.tasks-filter-label` с текстом "Тип товара:"
- Inline-стили: `padding: 4px 8px`, `border: 1px solid var(--border-default)`, `border-radius: 4px`, `font-size: 13px`
- Опции:
  - `value="all"` (selected если `tasksDetailsFilterState.type === 'all'`): "Все"
  - `value="СТМ"` (selected если `tasksDetailsFilterState.type === 'СТМ'`): "СТМ"
  - `value="НЕ СТМ"` (selected если `tasksDetailsFilterState.type === 'НЕ СТМ'`): "НЕ СТМ"

**Селект "Приоритет"** (`#tasksFilterPriority`):
- Классы: `.tasks-filter-select`
- Лейбл: `.tasks-filter-label` с текстом "Приоритет:"
- Inline-стили: аналогично селекту типа
- Опции:
  - `value="all"` (selected если `tasksDetailsFilterState.priority === 'all'`): "Все"
  - `value="🔥 Срочно"` (selected если `tasksDetailsFilterState.priority === '🔥 Срочно'`): "🔥 Срочно"
  - `value="Высокий"` (selected если `tasksDetailsFilterState.priority === 'Высокий'`): "Высокий"
  - `value="Средний"` (selected если `tasksDetailsFilterState.priority === 'Средний'`): "Средний"

**Поведение при изменении**:
- Обработчики в `setupTasksDetailsFilters()`:
  - Для типа: `tasksDetailsFilterState.type = e.target.value`, если значение не 'all', сбрасывается `status = 'all'`
  - Для приоритета: `tasksDetailsFilterState.priority = e.target.value`, если значение не 'all', сбрасывается `status = 'all'`
  - Вызывается `updateOperationalCardsVisualState()`
  - Вызывается `syncTasksDetailsFiltersUiFromState()`
  - Вызывается `renderTasksDetailsFromCache()`

### 4.5. Чекбоксы (`.tasks-filters-checkboxes`)

**Контейнер**: `.tasks-filters-checkboxes`

**Стили**:
- Desktop: `display: flex`, `gap: 16px`, `flex-wrap: wrap`
- Mobile (≤768px): элементы в колонку, `width: 100%`

**Чекбокс "Показать выполненные задачи недели"** (`#tasksFilterShowCompleted`):
- Лейбл: `.tasks-filter-checkbox` с текстом "Показать выполненные задачи недели"
- Атрибут: `type="checkbox"`
- Состояние: `checked` если `tasksDetailsFilterState.showCompleted === true`
- Inline-стили: `cursor: pointer`

**Чекбокс "Показать только задачи с ошибкой Q"** (`#tasksFilterOnlyQErrors`):
- Лейбл: `.tasks-filter-checkbox` с текстом "Показать только задачи с ошибкой Q"
- Атрибут: `type="checkbox"`
- Состояние: `checked` если `tasksDetailsFilterState.onlyQErrors === true`
- Inline-стили: `cursor: pointer`

**Поведение при изменении**:
- Обработчики в `setupTasksDetailsFilters()`:
  - Для "Показать выполненные": `tasksDetailsFilterState.showCompleted = e.target.checked`
  - Для "Только ошибки Q": `tasksDetailsFilterState.onlyQErrors = e.target.checked`
  - Вызывается `updateOperationalCardsVisualState()`
  - Вызывается `syncTasksDetailsFiltersUiFromState()`
  - Вызывается `renderTasksDetailsFromCache()`

### 4.6. Состояние фильтров (`tasksDetailsFilterState`)

**Глобальный объект состояния**:
```javascript
{
  mode: 'operational',        // 'operational' | 'all' (по умолчанию 'operational')
  type: 'all',                // 'all' | 'СТМ' | 'НЕ СТМ' (по умолчанию 'all')
  priority: 'all',            // 'all' | '🔥 Срочно' | 'Высокий' | 'Средний' (по умолчанию 'all')
  showCompleted: false,        // boolean (по умолчанию false)
  onlyQErrors: false,          // boolean (по умолчанию false)
  status: 'all'               // 'all' | 'on_hand' | 'warehouse' | 'shot_not_processed' | 'completed' | 'other' (по умолчанию 'all')
}
```

**Синхронизация UI с состоянием**:
- Функция `syncTasksDetailsFiltersUiFromState()` обновляет все элементы фильтров в соответствии с `tasksDetailsFilterState`:
  - Кнопки режима получают/теряют класс `.tasks-filter-mode-btn--active`
  - Селекты получают соответствующие `value`
  - Чекбоксы получают/теряют атрибут `checked`

---

## 5. Таблица «Показать подробности»

### 5.1. Контейнер подробностей (`#tasksDetailsContainer`)

**Классы**: `tasks-details-container` (класс `.expanded` если `tasksDetailsExpanded = true`)

**Inline-стили**: `margin-top: 16px`

**CSS-стили**:
- Desktop: `margin-top: 16px`, `padding: 12px 0 0 0`, `box-sizing: border-box`
- Mobile (≤768px): `font-size: 13px`

**Внутренний контейнер** (`#tasksDetailsInner`):
- Классы: `tasks-details-inner`
- CSS-стили: `padding: 12px`, `border-radius: 8px`, `border: 1px solid var(--border-default)`, `box-sizing: border-box`

**Контейнер списка** (`#tasksDetailsList`):
- Классы: `tasks-details-panel`
- CSS-стили:
  - Desktop: `background: var(--bg-surface)`, `border: 1px solid var(--border-default)`, `border-radius: 8px`, `padding: 16px`, `width: 100%`, `overflow-x: auto`
  - Mobile (≤720px): `padding: 12px`, `margin: 0`, `width: 100%`, `box-sizing: border-box`

### 5.2. Счетчик задач (над таблицей)

**Условия отображения**:
- Всегда показывается счетчик задач
- Если активны фильтры и `filteredTasksCount !== totalTasksCount`: "Показано задач: **X** из **Y**"
- Если фильтров нет или все задачи показаны: "Всего задач: **X**"

**Стили**: `font-size: 12px`, `color: var(--text-secondary)`, `margin-bottom: 8px`

**Информация об ошибках Q** (под счетчиком):
- Условие: только если `qErrorsCount > 0`
- Текст: "Задач с ошибкой Q: **N**" (N в `<strong>` с цветом `#d32f2f`)
- Стили: `font-size: 12px`, `margin-bottom: 12px`

### 5.3. Структура таблицы (`.tasks-details-table`)

**Элемент**: `<table class="tasks-details-table">`

**CSS-стили**:
- Desktop: стандартная таблица, `width: 100%`, `border-collapse: collapse`, `font-size: 13px`
- Mobile (≤768px): `display: block` (вся таблица и все её элементы)

**Заголовок таблицы** (`<thead>`):
- Desktop: видимый, фон `var(--bg-muted)`, граница снизу `2px solid var(--border-default)`
- Mobile (≤768px): `display: none`

**Колонки заголовка** (`<th>`):
1. "№" (ширина: `40px`)
2. "Задача"
3. "Q"
4. "Товар"
5. "Статус"
6. "Сфоткал"
7. "Обработал"
8. "Дедлайн"

**CSS-стили заголовков**:
- Desktop: `padding: 10px 8px`, `text-align: center`, `font-weight: 600`, `color: var(--text-primary)`, `font-size: 12px`
- Mobile: скрыты

### 5.4. Строки задач

**Базовые классы строк** (`.task-row`):
- `task-row`: базовая строка
- `task-row--alt`: чередующаяся строка (для `index % 2 !== 0`)
- `task-row--error`: строка с ошибкой Q (если `hasQError === true`)
- `q-error`: дополнительный класс для строк с ошибкой Q
- `task-card`: класс для мобильной версии

**CSS-стили строк**:
- Desktop:
  - `.task-row`: `border-bottom: 1px solid var(--border-default)`, фон `var(--bg-surface)`
  - `.task-row--alt`: фон `var(--bg-muted)`
  - `.task-row--error`: фон `#ffebee`, левая граница `3px solid #d32f2f`
- Mobile (≤768px):
  - `.task-row`: `display: block`, `margin-bottom: 12px`, `padding: 12px`, `border-radius: 8px`, `border: 1px solid var(--border-default)`, фон `var(--bg-surface)`
  - `.task-card.q-error`: фон `#ffe6e6`, левая граница `4px solid #ff4d4d`

**Структура строки задачи** (`renderTasksDetailsRow()`):

```
<tr class="task-row [task-row--alt] [task-row--error] [q-error] task-card">
  <td class="task-row-cell" data-label="№">
    ${index + 1}
  </td>
  <td class="task-row-cell task-row-cell--name" data-label="Задача">
    <div class="task-field">
      <span class="task-field-label">Задача</span>
      <span class="task-field-value task-row-value">
        ${taskName}[<span class="task-row-value--error">⚠</span>]
      </span>
    </div>
    <div class="task-row-meta meta-field">
      project: ${project_gid} • assignee: ${assignee_gid}
    </div>
  </td>
  <td class="task-row-cell" data-label="Q">
    <div class="task-field">
      <span class="task-field-label">Q</span>
      <span class="task-field-value task-row-value [task-row-value--error]">
        ${qDisplay}
      </span>
    </div>
  </td>
  <td class="task-row-cell" data-label="Товар">
    <div class="task-field">
      <span class="task-field-label">Товар</span>
      <span class="task-field-value task-row-value">${productSource}</span>
    </div>
  </td>
  <td class="task-row-cell" data-label="Статус">
    <div class="task-field">
      <span class="task-field-label">Статус</span>
      <span class="[task-row-value--status-done|task-row-value--status-pending]">
        ${statusText}
      </span>
    </div>
  </td>
  <td class="task-row-cell" data-label="Сфоткал">
    <div class="task-field">
      <span class="task-field-label">Сфоткал</span>
      <span class="task-field-value task-row-value">${shotAt || '—'}</span>
    </div>
  </td>
  <td class="task-row-cell" data-label="Обработал">
    <div class="task-field">
      <span class="task-field-label">Обработал</span>
      <span class="task-field-value task-row-value">${processedAt || '—'}</span>
    </div>
  </td>
  <td class="task-row-cell" data-label="Дедлайн">
    <div class="task-field">
      <span class="task-field-label">Дедлайн</span>
      <span class="task-field-value task-row-value">${dueOn || '—'}</span>
    </div>
  </td>
</tr>
```

**CSS-стили ячеек** (`.task-row-cell`):
- Desktop: `padding: 10px 8px`, `text-align: center`, `color: var(--text-primary)`, `font-size: 12px`
- `.task-row-cell--name`: `text-align: left`, `word-break: break-word`
- Mobile (≤768px): `display: flex`, `justify-content: space-between`, `align-items: center`, `gap: 8px`, `padding: 6px 0`, `font-size: 13px`, `text-align: left`, границы удалены

**Использование `data-label` на мобильном**:
- Каждая `<td>` имеет атрибут `data-label` с названием поля
- Лейбл отображается через `td::before { content: attr(data-label); }`
- Стили лейбла: `font-weight: 500`, цвет `var(--text-secondary)`, `min-width: 80px`, `flex-shrink: 0`

**Скрытые элементы на мобильном**:
- `.task-field-label`: `display: none`
- `.task-row-meta`: `display: none` (мета-информация project/assignee)

### 5.5. Группировка задач

**Заголовки групп** (`.tasks-details-group-row`):
- Элемент: `<tr class="tasks-details-group-row">`
- Внутренняя ячейка: `<td colspan="8">`
- Inline-стили: `font-weight: 600`, `font-size: 14px`, `padding: 12px 8px 8px 8px`, фон `var(--bg-muted)`, граница сверху `2px solid var(--border-default)`
- Содержимое: название группы + количество задач в скобках, например "Уже на руках (5)"
- Количество задач: `<span>` с `font-weight: 400`, цвет `var(--text-secondary)`, `font-size: 12px`

**Порядок групп** (сверху вниз):
1. "Уже на руках" (`operationalStatus = 'on_hand'`)
2. "Нужно взять со склада" (`operationalStatus = 'warehouse'`)
3. "Сфоткано, но не обработано" (`operationalStatus = 'shot_not_processed'`)
4. "Выполненные задачи недели" (`operationalStatus = 'completed'`)
5. "Прочие задачи" (`operationalStatus = 'other'`)

**Пустые группы**: не отображаются (проверка `if (!rows || rows.length === 0) return`)

**CSS-стили заголовков групп на мобильном** (≤768px):
- `display: block`
- `padding: 12px 0 8px 0`
- Границы удалены, фон прозрачный
- `font-weight: 600`, `font-size: 14px`
- `margin-top: 16px`, `margin-bottom: 8px` (кроме первой группы: `margin-top: 0`)
- Внутренние `td`: `display: block`, `padding: 0`, `text-align: left`, границы удалены, `td::before` скрыт

### 5.6. Сообщение при отсутствии задач

**Условие**: если `filteredRows.length === 0`

**Элемент**: `<p>`

**Текст**: "Нет задач, удовлетворяющих выбранным фильтрам."

**Стили**: `text-align: center`, `color: var(--text-muted)`, `margin-top: 12px`

---

## 6. Описание логики отображения и динамических классов

### 6.1. Динамические классы KPI-карточек

**Карточка "До выполнения плана"** (`#cardRemaining`):
- `.kpi-card--remaining`: если `remainingToPlan > 0`
- `.kpi-card--remaining-success`: если `remainingToPlan = 0`
- Значение получает класс `.kpi-value--remaining` или `.kpi-value--remaining-success` соответственно

**Карточка "Переработка недели"** (`#overtimeCard`):
- `.kpi-card--muted`: если `overtimeQty = 0` (добавляется класс, устанавливается `opacity: 0.5`)

**Строка "Переработка с прошлой недели"** (`#carryOverRow`):
- `.kpi-meta--muted`: если `carryOver = 0` (устанавливается `opacity: 0.5`)

### 6.2. Динамические inline-стили

**Операционные карточки при активном состоянии**:
- Устанавливаются через `updateOperationalCardsVisualState()`:
  - `border-width: 2px`
  - `box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15)`
  - `transform: scale(1.02)`
  - `transition: all 0.2s ease`

**Карточка "До выполнения плана"**:
- Обновляются через `updateTasksCards()`:
  - `background`: `#fce4ec` (если долг) или `#e8f5e9` (если план выполнен)
  - `borderColor`: `#e91e63` или `#4caf50`
  - Заголовок: `color: #880e4f` или `#2e7d32`
  - Значение: `color: #c2185b` или `#1b5e20`

**Кнопки режима фильтров**:
- Inline-стили обновляются через `syncTasksDetailsFiltersUiFromState()`:
  - `background`: `var(--brand-primary)` (активная) или `var(--bg-surface)` (неактивная)
  - `color`: `var(--text-inverse)` (активная) или `var(--text-primary)` (неактивная)
  - `fontWeight`: `600` (активная) или `400` (неактивная)

### 6.3. Логика обновления значений

**Функция `updateTasksCards(stats)`**:
- Обновляет все числовые значения в KPI-карточках через `textContent`
- Обновляет динамические стили и классы
- Обновляет операционные карточки
- Обновляет подпись об ошибках Q

**Функция `renderTasksDetailsFromCache()`**:
- Применяет фильтры через `applyTasksDetailsFilters(cachedTasksDetails)`
- Группирует задачи через `groupTasksByOperationalStatus(filteredRows)`
- Генерирует HTML таблицы с группами
- Вставляет HTML в `#tasksDetailsList`

### 6.4. Логика фильтрации

**Функция `applyTasksDetailsFilters(rawRows)`**:
- Применяет фильтры последовательно:
  1. Режим (`mode === 'operational'` → только операционные статусы)
  2. Тип товара (`type !== 'all'` → фильтр по `task_type_label`)
  3. Приоритет (`priority !== 'all'` → фильтр по `priority_label`)
  4. Выполненность (`showCompleted === false` → скрыть завершённые)
  5. Ошибки Q (`onlyQErrors === true` → только задачи с `hasQError === true`)
  6. Операционный статус (`status !== 'all'` → фильтр по `operationalStatus`)

**Вычисление операционного статуса** (`computeOperationalStatus(task)`):
- `'on_hand'`: `!completed && product_source === 'PRINESLI' && !shot_at`
- `'warehouse'`: `!completed && product_source === 'WAREHOUSE' && !shot_at && !processed_at`
- `'shot_not_processed'`: `!completed && !!shot_at && !processed_at`
- `'completed'`: `completed === true`
- `'other'`: все остальные случаи

---

## 7. Мобильная адаптация ≤768px

### 7.1. Breakpoint

**Медиа-запрос**: `@media (max-width: 768px)`

### 7.2. Контейнер страницы

**`.tasks-page`**:
- `padding: 12px` (вместо 16px)

### 7.3. KPI-карточки

**Сетка KPI** (`.kpi-grid`):
- `grid-template-columns: 1fr !important` (все карточки в одну колонку)
- `gap: 8px` (вместо 10px)

**Операционная сетка** (`.tasks-kpi-grid-operational`):
- `grid-template-columns: 1fr !important`

**Карточки** (`.kpi-card`):
- `width: 100%`

**Размеры шрифтов**:
- `.kpi-title`: `font-size: 13px` (вместо 12px)
- `.kpi-value`: `font-size: 20px` (вместо 24px)

**Операционные карточки**:
- `cursor: pointer`
- `transition: transform 0.2s ease, box-shadow 0.2s ease`
- При нажатии: `transform: scale(0.98)`

### 7.4. Панель фильтров

**Контейнер** (`#tasksDetailsFilters`):
- `display: flex`
- `flex-direction: column`
- `gap: 8px`

**Внутренние элементы**:
- `.tasks-filters-row`: `flex-direction: column`, `gap: 8px`
- `.tasks-filters-mode`: `flex-direction: column` (кнопки в колонку)
- Все селекты, кнопки и лейблы: `width: 100%`
- `.tasks-filter-label`: `flex-direction: column`, `align-items: flex-start`, `gap: 4px`
- `.tasks-filter-select`: `width: 100%`

### 7.5. Таблица задач (превращение в карточки)

**Преобразование структуры**:
- `.tasks-details-table`, `thead`, `tbody`, `th`, `td`, `tr`: `display: block`
- `thead`: `display: none`

**Строки задач** (`.task-row`):
- `display: block`
- `margin-bottom: 12px`
- `padding: 12px`
- `border-radius: 8px`
- `border: 1px solid var(--border-default)`
- Фон `var(--bg-surface)`

**Ячейки** (`td`):
- `display: flex`
- `justify-content: space-between`
- `align-items: center`
- `gap: 8px`
- `padding: 6px 0`
- `font-size: 13px`
- `text-align: left`
- Границы удалены

**Использование `data-label`**:
- `td::before { content: attr(data-label); }`
- Стили: `font-weight: 500`, цвет `var(--text-secondary)`, `min-width: 80px`, `flex-shrink: 0`

**Скрытые элементы**:
- `.task-field-label`: `display: none`
- `.task-row-meta`: `display: none`

**Заголовки групп** (`.tasks-details-group-row`):
- `display: block`
- `padding: 12px 0 8px 0`
- Границы удалены, фон прозрачный
- `font-weight: 600`, `font-size: 14px`
- `margin-top: 16px`, `margin-bottom: 8px` (кроме первой: `margin-top: 0`)
- Внутренние `td`: `display: block`, `padding: 0`, `text-align: left`, границы удалены, `td::before` скрыт

---

## 8. Мобильная адаптация ≤480px

### 8.1. Breakpoint

**Медиа-запрос**: `@media (max-width: 480px)`

### 8.2. Контейнер страницы

**`.tasks-page`**:
- `padding: 8px`

### 8.3. KPI-карточки

**Сетка** (`.kpi-grid`):
- `grid-template-columns: 1fr !important`
- `gap: 6px`

**Карточки** (`.kpi-card`):
- `padding: 8px`
- `font-size: 14px`

**Размеры шрифтов**:
- `.kpi-title`: `font-size: 10px`
- `.kpi-value`: `font-size: 20px`
- `.kpi-subtext`: `font-size: 9px`

---

## 9. Итоговая сводка всех UI-компонентов

### 9.1. Корневые контейнеры

| ID/Класс | Роль | Дочерние элементы |
|----------|------|-------------------|
| `.tasks-page` | Корневой контейнер вкладки | Все блоки вкладки |
| `#tasksHeader` | Контейнер верхних KPI | Операционные и недельные KPI |

### 9.2. Операционные KPI-карточки

| ID | Классы | Значение | Обновляется через |
|----|--------|----------|-------------------|
| `#kpiOnHandCard` | `kpi-card` | `onHandQty` | `#kpiOnHandValue.textContent` |
| `#kpiWarehouseCard` | `kpi-card` | `warehouseQty` | `#kpiWarehouseValue.textContent` |
| `#kpiShotNotProcessedCard` | `kpi-card` | `shotNotProcessedQty` | `#kpiShotNotProcessedValue.textContent` |

**Кликабельность**: все три карточки кликабельны, вызывают `setTasksDetailsStatusFilter()` и `expandTasksDetailsSectionIfCollapsed()`

### 9.3. Недельные KPI-карточки

| ID | Классы | Значение | Обновляется через |
|----|--------|----------|-------------------|
| (нет) | `kpi-card--done` | `doneQty` | `#completedCount.textContent` |
| (нет) | `kpi-card--plan` | `plan` (80) | `#planValue.textContent` |
| (нет) | `kpi-card--pending` | `toShootQty` | `#pendingCount.textContent` |
| `#cardRemaining` | `kpi-card--remaining` / `kpi-card--remaining-success` | `remainingToPlan` | `#remainingCount.textContent` + динамические стили |
| `#overtimeCard` | `kpi-card--overtime` / `kpi-card--muted` | `overtimeQty` | `#overtimeQty.textContent` + `opacity` |

**Дополнительные элементы**:
- `#doneStmNonStmMeta`: разбивка СТМ/НЕ СТМ
- `#doneFactValue`: факт недели
- `#carryOverValue`: переработка с прошлой недели
- `#weekLoadValue`: нагрузка недели
- `#remainingText`: подпись с планом

### 9.4. Кнопки действий

| ID | Классы | Текст | Поведение |
|----|--------|-------|-----------|
| `#refreshStats` | `btn`, `btn-full` | "Обновить данные" | Обновляет статистику из Asana |
| `#showDetails` | `btn`, `btn-full` | "Показать подробности" / "Скрыть подробности" | Переключает `tasksDetailsExpanded` |

### 9.5. Элементы фильтров

| ID | Тип | Роль | Состояние |
|----|-----|------|-----------|
| `.tasks-filter-mode-btn[data-mode="operational"]` | button | Режим "Только операционные" | Класс `.tasks-filter-mode-btn--active` если `mode === 'operational'` |
| `.tasks-filter-mode-btn[data-mode="all"]` | button | Режим "Все задачи" | Класс `.tasks-filter-mode-btn--active` если `mode === 'all'` |
| `#tasksFilterType` | select | Фильтр по типу товара | `value` соответствует `tasksDetailsFilterState.type` |
| `#tasksFilterPriority` | select | Фильтр по приоритету | `value` соответствует `tasksDetailsFilterState.priority` |
| `#tasksFilterShowCompleted` | checkbox | Показать выполненные | `checked` если `showCompleted === true` |
| `#tasksFilterOnlyQErrors` | checkbox | Только ошибки Q | `checked` если `onlyQErrors === true` |

### 9.6. Элементы таблицы подробностей

| ID/Класс | Роль | Содержимое |
|----------|------|------------|
| `#tasksDetailsContainer` | Контейнер блока подробностей | Класс `.expanded` если развернут |
| `#tasksDetailsFilters` | Панель фильтров | Все элементы фильтрации |
| `#tasksDetailsInner` | Внутренний контейнер | Обёртка для списка задач |
| `#tasksDetailsList` | Контейнер списка задач | Динамический HTML (счетчик, таблица, сообщение) |
| `.tasks-details-table` | Таблица задач | 8 колонок, группировка по статусам |
| `.tasks-details-group-row` | Заголовок группы | Название группы + количество задач |
| `.task-row` | Строка задачи | 8 ячеек с данными задачи |
| `.task-row--alt` | Чередующаяся строка | Для `index % 2 !== 0` |
| `.task-row--error` | Строка с ошибкой Q | Если `hasQError === true` |
| `.task-row-cell` | Ячейка задачи | Данные с `data-label` для мобильного |
| `.task-row-cell--name` | Ячейка названия | Выравнивание `left` |

### 9.7. Функции обновления UI

| Функция | Роль | Вызывается при |
|---------|------|----------------|
| `updateTasksCards(stats)` | Обновляет все KPI-карточки | После получения статистики |
| `renderTasksDetailsFromCache()` | Рендерит таблицу задач | При изменении фильтров или раскрытии блока |
| `syncTasksDetailsFiltersUiFromState()` | Синхронизирует UI фильтров | При изменении состояния фильтров |
| `updateOperationalCardsVisualState()` | Обновляет визуальное состояние операционных карточек | При изменении активного статуса |
| `setTasksDetailsStatusFilter(nextStatus)` | Устанавливает фильтр по статусу | При клике на операционную карточку |
| `expandTasksDetailsSectionIfCollapsed()` | Раскрывает блок подробностей | При клике на операционную карточку |

### 9.8. Глобальные переменные состояния

| Переменная | Тип | Роль |
|-----------|-----|------|
| `tasksDetailsExpanded` | boolean | Состояние развернутости блока подробностей |
| `cachedTasksDetails` | Array\|null | Кеш детальных данных задач |
| `cachedTasksStats` | Object\|null | Кеш статистики KPI |
| `lastAsanaWeekStart` | string\|null | Последняя неделя для загрузки деталей |
| `tasksDetailsFilterState` | Object | Состояние всех фильтров |

---

**Конец документа**

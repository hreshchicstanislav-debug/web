/***** CONFIG: Supabase настройки *****/
// ВАЖНО: Замените эти значения на ваши из Supabase Dashboard
// Settings → API → Project URL и anon public key
const SUPABASE_URL = 'https://uqgpynqnboyeqvsaljso.supabase.co'; // Например: https://xxxxx.supabase.co
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxZ3B5bnFuYm95ZXF2c2FsanNvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIxMDc0NjIsImV4cCI6MjA3NzY4MzQ2Mn0.lpzVJN2yL5xeKHcBYhUkxP9ZyvvQ2LJY4Ng7yJzLlG8'; // Ваш anon public key

// Инициализация Supabase клиента (выполнится после загрузки библиотеки)
let supabaseClient = null;

function initSupabase() {
  // Проверяем наличие библиотеки (может быть доступна как window.supabase или просто supabase)
  const supabaseLib = window.supabase || (typeof supabase !== 'undefined' ? supabase : null);
  
  if (supabaseLib && SUPABASE_URL !== 'YOUR_SUPABASE_URL' && SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY') {
    try {
      supabaseClient = supabaseLib.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      console.log('Supabase инициализирован');
    } catch (e) {
      console.error('Ошибка инициализации Supabase:', e);
    }
  } else {
    if (SUPABASE_URL === 'YOUR_SUPABASE_URL' || SUPABASE_ANON_KEY === 'YOUR_SUPABASE_ANON_KEY') {
      console.warn('⚠️ Не забудьте настроить SUPABASE_URL и SUPABASE_ANON_KEY в app.js');
    } else {
      console.error('Библиотека Supabase не загружена. Проверьте подключение скрипта в index.html');
    }
  }
}

// Инициализируем после загрузки страницы и библиотеки
function waitForSupabase() {
  if (window.supabase || (typeof supabase !== 'undefined')) {
    initSupabase();
  } else {
    // Ждем немного и пробуем снова
    setTimeout(waitForSupabase, 100);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', waitForSupabase);
} else {
  waitForSupabase();
}

/***** CONFIG: План рабочего дня *****/
// План рабочего дня зафиксирован: 09:00 - 18:00
const PLAN_START = '09:00';
const PLAN_END = '18:00';

/***** HELPERS *****/
const $ = sel => document.querySelector(sel);
const todayISO = () => new Date().toISOString().slice(0,10);
const pad = n => String(n).padStart(2,'0');

// Форматирование даты в формат DD.MM.YYYY (например: 14.11.2025)
function formatDate(dateISO) {
  if (!dateISO) return '';
  const date = new Date(dateISO + 'T00:00:00');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  return `${day}.${month}.${year}`;
}

function toMinutes(hhmm){ if(!hhmm) return 0; const [h,m]=hhmm.split(':').map(Number); return h*60+(m||0); }
function mmToHhmm(mm){
  const sign = mm<0 ? '-' : '';
  mm = Math.abs(mm);
  return `${sign}${pad(Math.floor(mm/60))}:${pad(mm%60)}`;
}
// Функция для расчета времени окончания работы для выхода в ноль
// Формула: время прихода + 9 часов (540 минут) - остаток с прошлого дня
function updateTargetEndTime(inTime, carryPrevMinutes) {
  const targetEndTimeEl = $('#targetEndTime');
  if (!targetEndTimeEl) return;
  
  // Если время прихода не заполнено, скрываем поле
  if (!inTime) {
    targetEndTimeEl.textContent = '';
    return;
  }
  
  // План работы: 9 часов = 540 минут (09:00 - 18:00)
  const PLAN_HOURS = 9;
  const PLAN_MINUTES = PLAN_HOURS * 60;
  
  // Время прихода в минутах
  const inTimeMinutes = toMinutes(inTime);
  
  // Время окончания для выхода в ноль:
  // время прихода + план работы - остаток с прошлого дня
  // Если остаток положительный (переработка), можно уйти раньше
  // Если остаток отрицательный (недоработка), нужно работать дольше
  const targetEndMinutes = inTimeMinutes + PLAN_MINUTES - carryPrevMinutes;
  
  // Преобразуем обратно в формат HH:MM
  const hours = Math.floor(targetEndMinutes / 60) % 24;
  const minutes = targetEndMinutes % 60;
  const targetEndTime = `${pad(hours)}:${pad(minutes)}`;
  
  // Обновляем поле с иконкой часов
  targetEndTimeEl.textContent = `⏱ ${targetEndTime}`;
}
function copyToClipboard(t){
  if(navigator.clipboard) return navigator.clipboard.writeText(t);
  const ta=document.createElement('textarea'); ta.value=t; document.body.appendChild(ta); ta.select();
  document.execCommand('copy'); document.body.removeChild(ta);
  return Promise.resolve();
}

/***** SUPABASE STORAGE *****/
const TABLE_NAME = 'time_tracks';
const SHOOTINGS_TABLE_NAME = 'shootings'; // Таблица для съёмок
const STORAGE_BUCKET = 'photos'; // Имя bucket для хранения фотографий

// Загрузить все записи
async function loadData(){
  try {
    if (!supabaseClient) {
      console.error('Supabase не инициализирован');
      return {};
    }
    
    const { data, error } = await supabaseClient
      .from(TABLE_NAME)
      .select('*')
      .order('date', { ascending: false });
    
    if (error) {
      console.error('Ошибка загрузки данных:', error);
      return {};
    }
    
    // Преобразуем массив в объект с ключами по дате
    const result = {};
    if (data) {
      data.forEach(rec => {
        result[rec.date] = rec;
      });
    }
    
    return result;
  } catch (e) {
    console.error('Ошибка загрузки данных:', e);
    return {};
  }
}

// Получить запись по дате
async function getRecord(date){
  try {
    if (!supabaseClient) {
      console.error('Supabase не инициализирован');
      return { date };
    }
    
    const { data, error } = await supabaseClient
      .from(TABLE_NAME)
      .select('*')
      .eq('date', date)
      .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
      console.error('Ошибка получения записи:', error);
      return { date };
    }
    
    return data || { date };
  } catch (e) {
    console.error('Ошибка получения записи:', e);
    return { date };
  }
}

// Сохранить или обновить запись
async function saveRecord(date, patch){
  try {
    if (!supabaseClient) {
      console.error('Supabase не инициализирован');
      return { date, ...patch };
    }
    
    // Проверяем, существует ли запись
    const { data: existing } = await supabaseClient
      .from(TABLE_NAME)
      .select('*')
      .eq('date', date)
      .single();
    
    const record = {
      date,
      ...patch,
      updated_at: new Date().toISOString()
    };
    
    let savedData = null;
    
    if (existing) {
      // Обновляем существующую запись
      const { data, error } = await supabaseClient
        .from(TABLE_NAME)
        .update(record)
        .eq('date', date)
        .select()
        .single();
      
      if (error) {
        console.error('Ошибка обновления записи:', error);
        throw error;
      }
      
      savedData = data;
    } else {
      // Создаем новую запись
      record.created_at = new Date().toISOString();
      const { data, error } = await supabaseClient
        .from(TABLE_NAME)
        .insert(record)
        .select()
        .single();
      
      if (error) {
        console.error('Ошибка создания записи:', error);
        throw error;
      }
      
      savedData = data;
    }
    
    // ОПТИМИЗАЦИЯ: Обновляем кеш для месяца этой даты
    const monthKey = date.slice(0, 7); // YYYY-MM
    if (monthDataCache[monthKey]) {
      monthDataCache[monthKey][date] = savedData;
      console.log('Кеш обновлен для даты:', date);
    }
    
    // ОПТИМИЗАЦИЯ: Обновляем день в списке, если он отображается
    updateDayInMonthList(date, savedData);
    
    return savedData;
  } catch (e) {
    console.error('Ошибка сохранения записи:', e);
    throw e;
  }
}

// Получить все записи
async function getAllRecords(){
  return await loadData();
}

// Получить предыдущий день (для расчета баланса)
async function getPrevDayRecord(date){
  try {
    if (!supabaseClient) {
      console.error('Supabase не инициализирован');
      return null;
    }
    
    // Убираем .single() чтобы избежать ошибки 406, когда записей нет
    const { data, error } = await supabaseClient
      .from(TABLE_NAME)
      .select('*')
      .lt('date', date)
      .order('date', { ascending: false })
      .limit(1);
    
    if (error) {
      // Ошибка 406 (Not Acceptable) - это нормально, когда записей нет
      // PGRST116 - это тоже нормальная ошибка "нет записей"
      // Игнорируем эти ошибки, так как это ожидаемое поведение
      if (error.code !== 'PGRST116' && error.code !== '406' && error.message !== 'Not Acceptable') {
        console.error('Ошибка получения предыдущей записи:', error);
      }
      // Возвращаем null, так как записей нет - это нормальная ситуация
      return null;
    }
    
    // Логирование для отладки
    if (data && data.length > 0) {
      const prevRec = data[0];
      console.log('Найдена предыдущая запись для даты', date, ':', prevRec.date, 'с carry_new_min:', prevRec.carry_new_min);
      return prevRec;
    } else {
      // Нет записей - это нормально для первой даты в базе
      // Не логируем это как ошибку, так как это ожидаемое поведение
      return null;
    }
  } catch (e) {
    console.error('Ошибка получения предыдущей записи:', e);
    return null;
  }
}

/***** SHOOTINGS (Съёмки из Google Calendar) *****/

// Преобразование времени съёмки в время отсутствия на работе
// Вычитаем 1 час от начала (время ухода) и добавляем 40 минут к концу (время возвращения)
function convertShootingTime(startTime, endTime) {
  // Преобразуем время в минуты
  const startMinutes = toMinutes(startTime);
  const endMinutes = toMinutes(endTime);
  
  // Вычитаем 1 час (60 минут) от начала
  const departureMinutes = startMinutes - 60;
  
  // Добавляем 40 минут к концу
  const returnMinutes = endMinutes + 40;
  
  // Преобразуем обратно в формат HH:MM
  const departureTime = mmToHhmm(departureMinutes);
  const returnTime = mmToHhmm(returnMinutes);
  
  return {
    departure: departureTime,
    return: returnTime,
    display: `~${departureTime}–${returnTime}`
  };
}

// Получить все предстоящие съёмки
async function getUpcomingShootings() {
  try {
    if (!supabaseClient) {
      console.error('Supabase не инициализирован');
      return [];
    }
    
    const today = todayISO();
    
    // Получаем все съёмки начиная с сегодняшнего дня, отсортированные по дате
    const { data, error } = await supabaseClient
      .from(SHOOTINGS_TABLE_NAME)
      .select('*')
      .gte('date', today)
      .order('date', { ascending: true })
      .order('start_time', { ascending: true });
    
    if (error) {
      console.error('Ошибка загрузки съёмок:', error);
      return [];
    }
    
    return data || [];
  } catch (e) {
    console.error('Ошибка загрузки съёмок:', e);
    return [];
  }
}

// Сохранить или обновить съёмку
async function saveShooting(shootingData) {
  try {
    if (!supabaseClient) {
      console.error('Supabase не инициализирован');
      return null;
    }
    
    // Если есть google_event_id, проверяем существование
    if (shootingData.google_event_id) {
      const { data: existing } = await supabaseClient
        .from(SHOOTINGS_TABLE_NAME)
        .select('*')
        .eq('google_event_id', shootingData.google_event_id)
        .single();
      
      if (existing) {
        // Обновляем существующую запись
        const { data, error } = await supabaseClient
          .from(SHOOTINGS_TABLE_NAME)
          .update(shootingData)
          .eq('google_event_id', shootingData.google_event_id)
          .select()
          .single();
        
        if (error) {
          console.error('Ошибка обновления съёмки:', error);
          throw error;
        }
        
        return data;
      }
    }
    
    // Создаем новую запись
    const { data, error } = await supabaseClient
      .from(SHOOTINGS_TABLE_NAME)
      .insert(shootingData)
      .select()
      .single();
    
    if (error) {
      console.error('Ошибка создания съёмки:', error);
      throw error;
    }
    
    return data;
  } catch (e) {
    console.error('Ошибка сохранения съёмки:', e);
    throw e;
  }
}

/***** REPORT *****/
function buildReport(rec, carryPrevText){
  const lines = [];
  
  // Функция для форматирования строки: метка + один пробел + значение
  const formatLine = (label, value) => {
    return `${label} ${value}`;
  };
  
  // Остаток на начало (с пустой строкой после)
  if (carryPrevText && carryPrevText !== '00:00' && carryPrevText !== '-00:00') {
    // carryPrevText уже в формате "HH:MM" или "-HH:MM" из mmToHhmm
    // mmToHhmm возвращает "-HH:MM" для отрицательных, "HH:MM" для положительных
    const formatted = carryPrevText.startsWith('-') 
      ? carryPrevText 
      : `+${carryPrevText}`;
    lines.push(formatLine('Остаток на начало:', formatted));
  } else {
    lines.push(formatLine('Остаток на начало:', '00:00'));
  }
  lines.push('');
  
  // Блок деталей дня (Приход, Уход, Факт, Норма)
  // Выравниваем метки по фиксированной ширине, чтобы значения времени были на одной вертикали
  const labelWidth = 7; // Максимальная длина метки в этом блоке ("Приход:" = 7 символов)
  
  if (rec.in_time) {
    lines.push(`${'Приход:'.padEnd(labelWidth)} ${rec.in_time}`);
  } else {
    lines.push(`${'Приход:'.padEnd(labelWidth)} --:--`);
  }
  
  if (rec.out_time) {
    lines.push(`${'Уход:'.padEnd(labelWidth)} ${rec.out_time}`);
  } else {
    lines.push(`${'Уход:'.padEnd(labelWidth)} --:--`);
  }
  
  // Проверяем наличие завершенных отлучек
  let completedBreaks = [];
  let totalBreaksMin = 0;
  if (rec.breaks_json) {
    try {
      const arr = JSON.parse(rec.breaks_json);
      completedBreaks = arr.filter(b => b.to); // Только завершенные отлучки
      completedBreaks.forEach(b => {
        totalBreaksMin += (toMinutes(b.to) - toMinutes(b.from));
      });
    } catch {}
  }
  
  // Время присутствия (по времени вход–выход)
  let presenceMinutes = 0;
  if (rec.in_time && rec.out_time) {
    presenceMinutes = toMinutes(rec.out_time) - toMinutes(rec.in_time);
  }
  
  // Если есть отлучки, показываем расширенный формат
  if (completedBreaks.length > 0) {
    // Факт (по времени вход–выход)
    lines.push(`${'Факт (по времени вход–выход):'.padEnd(labelWidth)} ${mmToHhmm(presenceMinutes)}`);
    
    // Отлучки с длительностью
    lines.push('');
    completedBreaks.forEach(b => {
      const breakDuration = toMinutes(b.to) - toMinutes(b.from);
      lines.push(`Отлучка: ${b.from}–${b.to} → ${mmToHhmm(breakDuration)}`);
    });
    
    // Факт за вычетом отлучки
    const factAfterBreaks = presenceMinutes - totalBreaksMin;
    lines.push('');
    lines.push(`Факт за вычетом отлучки: ${mmToHhmm(factAfterBreaks)}`);
  } else {
    // Если нет отлучек, показываем просто "Факт"
    lines.push(`${'Факт:'.padEnd(labelWidth)} ${mmToHhmm(presenceMinutes)}`);
  }
  
  // Норма (план)
  const planMinutes = toMinutes(PLAN_END) - toMinutes(PLAN_START);
  lines.push(`${'Норма:'.padEnd(labelWidth)} ${mmToHhmm(planMinutes)}`);
  
  // Пустая строка после блока деталей дня
  lines.push('');
  
  // Итог дня (с пустой строкой после)
  if (rec.day_balance_min !== undefined) {
    const dayBalance = rec.day_balance_min || 0;
    const sign = dayBalance >= 0 ? '+' : '';
    lines.push(formatLine('Итог дня:', `${sign}${mmToHhmm(dayBalance)}`));
  } else {
    lines.push(formatLine('Итог дня:', '00:00'));
  }
  lines.push('');
  
  // Остаток на конец
  if (rec.carry_new_min !== undefined) {
    const carryNew = rec.carry_new_min || 0;
    const sign = carryNew >= 0 ? '+' : '';
    lines.push(formatLine('Остаток на конец:', `${sign}${mmToHhmm(carryNew)}`));
  } else {
    // Если нет данных, используем остаток на начало
    if (carryPrevText && carryPrevText !== '00:00' && carryPrevText !== '-00:00') {
      const formatted = carryPrevText.startsWith('-') 
        ? carryPrevText 
        : `+${carryPrevText}`;
      lines.push(formatLine('Остаток на конец:', formatted));
    } else {
      lines.push(formatLine('Остаток на конец:', '00:00'));
    }
  }
  
  // Пустая строка после "Остаток на конец дня" (такой же отступ как между другими блоками)
  lines.push('');
  
  // Комментарий (если есть)
  if (rec.comment && rec.comment.trim()) {
    lines.push(formatLine('Комментарий:', rec.comment.trim()));
  }
  
  return lines.join('\n');
}
function deltaText(min){ const sign = min>=0 ? '+' : ''; return `${sign}${mmToHhmm(min)}`; }

/***** STATE *****/
let currentDate = todayISO();

/***** ME SCREEN *****/
async function renderMe(){
  const app = $('#app');
  app.innerHTML = `
    <h1>Мой экран (сегодня: <span id="today">${currentDate}</span>)</h1>

    <div style="background: #fff3cd; border: 1px solid #ffc107; padding: 12px; border-radius: 8px; margin-bottom: 16px;">
      <label style="display: block; margin-bottom: 8px; font-weight: bold; color: #856404;">⚠️ ВРЕМЕННАЯ ФУНКЦИЯ: Выбор даты для тестирования</label>
      <input id="dateSelector" type="date" value="${currentDate}" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
      <p class="muted" style="margin-top: 8px; margin-bottom: 0; font-size: 12px;">Выберите дату для работы с отчетами за разные дни</p>
    </div>

    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
      <p class="muted" id="carryPrevText" style="margin: 0;">Остаток с прошлого дня — "..."</p>
      <p class="muted" id="targetEndTime" style="margin: 0; text-align: right; font-weight: 500;"></p>
    </div>

    <div class="row">
      <div>
        <label>Факт прихода</label>
        <div class="time-wrapper">
        <input id="inTime" type="time" placeholder="--:--">
          <button id="inTimeConfirm" class="time-confirm-btn" style="display: none;" title="Подтвердить время">✓</button>
          <span id="inTimeCheck" class="checkmark">✓</span>
        </div>
      </div>
      <div>
        <label>Факт ухода</label>
        <div class="time-wrapper">
        <input id="outTime" type="time" placeholder="--:--">
          <button id="outTimeConfirm" class="time-confirm-btn" style="display: none;" title="Подтвердить время">✓</button>
          <span id="outTimeCheck" class="checkmark">✓</span>
        </div>
      </div>
    </div>

    <label>Отлучался</label>
    <button id="addBreak" class="btn">Добавить отлучку</button>
    <div id="breaksList" class="list muted">Пока нет отлучек</div>

    <label>Фото сдачи ключей</label>
    <div style="display: flex; align-items: center; gap: 8px;">
      <button id="addPhoto" class="btn">Добавить фото</button>
      <span id="photoCheck" class="checkmark">✓</span>
      <span id="photoStatus" class="muted" style="font-size: 12px;"></span>
    </div>
    <div id="photoPreview" style="margin-top: 8px; display: none;">
      <img id="photoImage" src="" alt="Фото" style="max-width: 200px; max-height: 200px; border-radius: 4px; border: 1px solid #ccc;">
    </div>

    <label>Комментарий</label>
    <div class="time-wrapper">
      <input id="comment" type="text" placeholder="Опционально" readonly style="cursor: pointer;" autocomplete="off" inputmode="none">
      <button id="commentConfirm" class="time-confirm-btn" style="display: none;" title="Подтвердить комментарий">✓</button>
      <span id="commentCheck" class="checkmark">✓</span>
    </div>

    <div class="right">
      <button id="showReport" class="btn">Показать отчёт</button>
    </div>
  `;

  // Загружаем данные
  const rec = await getRecord(currentDate);
  hydrateMe(rec);

  // Обработчик смены даты (временная функция для тестирования)
  $('#dateSelector').addEventListener('change', async (e) => {
    const selectedDate = e.target.value;
    if (selectedDate && selectedDate !== currentDate) {
      currentDate = selectedDate;
      $('#today').textContent = currentDate;
      
      // Перезагружаем данные для выбранной даты
      const rec = await getRecord(currentDate);
    hydrateMe(rec);
    }
  });

  // handlers
  // Для полей времени используем кнопку подтверждения вместо автоматического сохранения
  // Это решает проблему на мобильных устройствах, где time picker может сразу закрываться
  
  // Показываем кнопку подтверждения при изменении времени
  $('#inTime').addEventListener('change', async (e) => {
    const newValue = e.target.value || '';
    // Показываем кнопку подтверждения, если есть значение и оно отличается от сохраненного
    if (newValue && newValue !== window.previousInTime) {
      $('#inTimeConfirm').style.display = 'inline-flex';
    } else {
      $('#inTimeConfirm').style.display = 'none';
    }
    // Обновляем время окончания работы при изменении времени прихода (предварительный расчет)
    if (newValue) {
      const prev = await getPrevDayRecord(currentDate).catch(() => null);
      let carryPrev = 0;
      if (prev && prev.date && typeof prev.carry_new_min === 'number' && !isNaN(prev.carry_new_min)) {
        const MAX_REASONABLE_MINUTES = 100000;
        const MIN_REASONABLE_MINUTES = -100000;
        if (prev.carry_new_min > MAX_REASONABLE_MINUTES || prev.carry_new_min < MIN_REASONABLE_MINUTES) {
          carryPrev = 0;
        } else {
          carryPrev = Math.round(prev.carry_new_min);
        }
      }
      updateTargetEndTime(newValue, carryPrev);
    } else {
      updateTargetEndTime('', 0);
    }
  });
  
  $('#inTime').addEventListener('input', (e) => {
    const newValue = e.target.value || '';
    // Показываем кнопку подтверждения при вводе
    if (newValue && newValue !== window.previousInTime) {
      $('#inTimeConfirm').style.display = 'inline-flex';
    } else {
      $('#inTimeConfirm').style.display = 'none';
    }
  });
  
  // Кнопка подтверждения для факта прихода
  $('#inTimeConfirm').addEventListener('click', async (e) => {
    e.preventDefault();
    const newValue = $('#inTime').value || '';
    if (newValue) {
      window.previousInTime = newValue;
      $('#inTimeConfirm').style.display = 'none';
      await saveField('in_time', newValue);
      // Обновляем время окончания работы после сохранения времени прихода
      const prev = await getPrevDayRecord(currentDate).catch(() => null);
      let carryPrev = 0;
      if (prev && prev.date && typeof prev.carry_new_min === 'number' && !isNaN(prev.carry_new_min)) {
        const MAX_REASONABLE_MINUTES = 100000;
        const MIN_REASONABLE_MINUTES = -100000;
        if (prev.carry_new_min > MAX_REASONABLE_MINUTES || prev.carry_new_min < MIN_REASONABLE_MINUTES) {
          carryPrev = 0;
        } else {
          carryPrev = Math.round(prev.carry_new_min);
        }
      }
      updateTargetEndTime(newValue, carryPrev);
    }
  });
  
  // Показываем кнопку подтверждения при изменении времени
  $('#outTime').addEventListener('change', (e) => {
    const newValue = e.target.value || '';
    // Показываем кнопку подтверждения, если есть значение и оно отличается от сохраненного
    if (newValue && newValue !== window.previousOutTime) {
      $('#outTimeConfirm').style.display = 'inline-flex';
    } else {
      $('#outTimeConfirm').style.display = 'none';
    }
  });
  
  $('#outTime').addEventListener('input', (e) => {
    const newValue = e.target.value || '';
    // Показываем кнопку подтверждения при вводе
    if (newValue && newValue !== window.previousOutTime) {
      $('#outTimeConfirm').style.display = 'inline-flex';
    } else {
      $('#outTimeConfirm').style.display = 'none';
    }
  });
  
  // Кнопка подтверждения для факта ухода
  $('#outTimeConfirm').addEventListener('click', async (e) => {
    e.preventDefault();
    const newValue = $('#outTime').value || '';
    if (newValue) {
      window.previousOutTime = newValue;
      $('#outTimeConfirm').style.display = 'none';
      await saveField('out_time', newValue);
    }
  });
  
  // Сохраняем предыдущее значение комментария для проверки изменений
  window.previousComment = '';
  
  // Открываем модальное окно при клике/тапе на поле комментария
  // Но только если комментарий не сохранен (нет галочки)
  const commentField = $('#comment');
  
  // Обработчик для клика (десктоп и мобильные)
  commentField.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Проверяем, сохранен ли комментарий (есть ли видимая галочка)
    const commentCheck = $('#commentCheck');
    const isSaved = commentCheck && commentCheck.classList.contains('visible');
    
    if (isSaved) {
      // Комментарий уже сохранен - нельзя редактировать
      return;
    }
    
    // Комментарий не сохранен - можно редактировать
    openCommentModal();
  });
  
  // Обработчик для touchstart (мобильные устройства) - предотвращает автозаполнение
  commentField.addEventListener('touchstart', (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Проверяем, сохранен ли комментарий
    const commentCheck = $('#commentCheck');
    const isSaved = commentCheck && commentCheck.classList.contains('visible');
    
    if (isSaved) {
      return;
    }
    
    // Открываем модальное окно
    openCommentModal();
  });
  
  // Обработчик для focus - предотвращает показ клавиатуры и автозаполнения
  commentField.addEventListener('focus', (e) => {
    e.preventDefault();
    e.target.blur(); // Убираем фокус сразу
    
    // Проверяем, сохранен ли комментарий
    const commentCheck = $('#commentCheck');
    const isSaved = commentCheck && commentCheck.classList.contains('visible');
    
    if (isSaved) {
      return;
    }
    
    // Открываем модальное окно
    openCommentModal();
  });
  
  // Кнопка подтверждения для комментария (галочка)
  $('#commentConfirm').addEventListener('click', async (e) => {
    e.preventDefault();
    const newValue = $('#comment').value || '';
    window.previousComment = newValue;
    $('#commentConfirm').style.display = 'none';
    await saveField('comment', newValue);
  });
  
  $('#addBreak').addEventListener('click', openBreakModal);
  $('#addPhoto').addEventListener('click', openPhotoModal);
  $('#showReport').addEventListener('click', showReportForToday);
}

async function hydrateMe(rec){
  // fill fields
  $('#inTime').value    = rec.in_time    || '';
  $('#outTime').value   = rec.out_time   || '';
  $('#comment').value   = rec.comment    || '';
  
  // Обновляем сохраненные предыдущие значения для проверки изменений
  // Это нужно для предотвращения ложных срабатываний на мобильных устройствах
  // когда просто открывается time picker без реального выбора времени
  window.previousInTime = rec.in_time || '';
  window.previousOutTime = rec.out_time || '';
  window.previousComment = rec.comment || '';

  // Блокируем поля после сохранения (если есть значение)
  // Факт прихода блокируется после сохранения
  if (rec.in_time) {
    $('#inTime').disabled = true;
    $('#inTime').readOnly = true;
    $('#inTime').classList.add('locked');
  } else {
    $('#inTime').disabled = false;
    $('#inTime').readOnly = false;
    $('#inTime').classList.remove('locked');
  }

  // Факт ухода блокируется после сохранения
  if (rec.out_time) {
    $('#outTime').disabled = true;
    $('#outTime').readOnly = true;
    $('#outTime').classList.add('locked');
    // После выбора "факт ухода" блокируем добавление отлучек и фото
    $('#addBreak').disabled = true;
    $('#addBreak').classList.add('locked');
    $('#addPhoto').disabled = true;
    $('#addPhoto').classList.add('locked');
  } else {
    $('#outTime').disabled = false;
    $('#outTime').readOnly = false;
    $('#outTime').classList.remove('locked');
    // Если "факт ухода" не выбран, можно добавлять отлучки и фото
    $('#addBreak').disabled = false;
    $('#addBreak').classList.remove('locked');
    $('#addPhoto').disabled = false;
    $('#addPhoto').classList.remove('locked');
  }

  // show checkmarks if times are saved
  $('#inTimeCheck').classList.toggle('visible', !!rec.in_time);
  $('#outTimeCheck').classList.toggle('visible', !!rec.out_time);
  $('#commentCheck').classList.toggle('visible', !!rec.comment);
  
  // Скрываем кнопки подтверждения при загрузке данных
  const inTimeConfirm = $('#inTimeConfirm');
  const outTimeConfirm = $('#outTimeConfirm');
  if (inTimeConfirm) {
    inTimeConfirm.style.display = 'none';
  }
  if (outTimeConfirm) {
    outTimeConfirm.style.display = 'none';
  }
  
  // Логирование для отладки
  console.log('hydrateMe для даты:', rec.date);
  console.log('in_time:', rec.in_time, 'out_time:', rec.out_time);
  
  // show photo checkmark and preview if photo exists
  if (rec.photo_url) {
    $('#photoCheck').classList.add('visible');
    $('#photoStatus').textContent = 'Фото загружено';
    $('#photoImage').src = rec.photo_url;
    $('#photoPreview').style.display = 'block';
  } else {
    $('#photoCheck').classList.remove('visible');
    $('#photoStatus').textContent = '';
    $('#photoPreview').style.display = 'none';
  }

  // carry from previous day
  const prev = await getPrevDayRecord(rec.date);
  
  // Для первой записи (когда нет предыдущей) остаток на начало строго 0
  let carryPrevMin = 0;
  if (prev && prev.date) {
    // Есть предыдущая запись - берем её carry_new_min
    // Проверяем, что это действительно число
    const prevCarry = prev.carry_new_min;
    if (typeof prevCarry === 'number' && !isNaN(prevCarry)) {
      // Проверяем, что это не timestamp (timestamp был бы очень большим числом)
      // Если значение больше 100000 минут (примерно 70 дней), значит это ошибка
      const MAX_REASONABLE_MINUTES = 100000;
      const MIN_REASONABLE_MINUTES = -100000;
      if (prevCarry > MAX_REASONABLE_MINUTES || prevCarry < MIN_REASONABLE_MINUTES) {
        console.warn('Обнаружено некорректное значение carry_new_min:', prevCarry, 'для даты:', prev.date);
        carryPrevMin = 0;
      } else {
        carryPrevMin = Math.round(prevCarry);
      }
    } else {
      carryPrevMin = 0;
    }
  } else {
    // Нет предыдущей записи - остаток с прошлого дня строго = 0
    carryPrevMin = 0;
  }
  
  $('#carryPrevText').textContent = `Остаток с прошлого дня — "${mmToHhmm(carryPrevMin)}"`;
  
  // Обновляем время окончания работы для выхода в ноль
  updateTargetEndTime(rec.in_time, carryPrevMin);

  // breaks list
  renderBreaksList(rec.breaks_json);
}

function renderBreaksList(bjson){
  const el = $('#breaksList');
  if (!bjson) { el.textContent = 'Пока нет отлучек'; return; }
  try {
    const arr = JSON.parse(bjson);
    // Фильтруем только завершенные отлучки (с to)
    const completedBreaks = arr.filter(b => b.to);
    if (!completedBreaks.length){ el.textContent = 'Пока нет отлучек'; return; }
    el.innerHTML = completedBreaks.map((b,i)=>`${i+1}) ${b.from}–${b.to}${b.reason?` (${b.reason})`:''}`).join('<br>');
  } catch {
    el.textContent = 'Пока нет отлучек';
  }
}

async function saveField(field, val){
  try {
    await saveRecord(currentDate, { [field]: val });
    
    // Show checkmark for time fields after successful save
    if (field === 'in_time') {
      if (val) {
        $('#inTimeCheck').classList.add('visible');
        // Блокируем поле после сохранения
        $('#inTime').disabled = true;
        $('#inTime').readOnly = true;
        $('#inTime').classList.add('locked');
      } else {
        $('#inTimeCheck').classList.remove('visible');
        // Разблокируем поле, если значение удалено
        $('#inTime').disabled = false;
        $('#inTime').readOnly = false;
        $('#inTime').classList.remove('locked');
      }
    } else if (field === 'out_time') {
      if (val) {
        $('#outTimeCheck').classList.add('visible');
        // Блокируем поле после сохранения
        $('#outTime').disabled = true;
        $('#outTime').readOnly = true;
        $('#outTime').classList.add('locked');
        // После выбора "факт ухода" блокируем добавление отлучек и фото
        $('#addBreak').disabled = true;
        $('#addBreak').classList.add('locked');
        $('#addPhoto').disabled = true;
        $('#addPhoto').classList.add('locked');
      } else {
        $('#outTimeCheck').classList.remove('visible');
        // Разблокируем поле, если значение удалено
        $('#outTime').disabled = false;
        $('#outTime').readOnly = false;
        $('#outTime').classList.remove('locked');
        // Разблокируем добавление отлучек и фото
        $('#addBreak').disabled = false;
        $('#addBreak').classList.remove('locked');
        $('#addPhoto').disabled = false;
        $('#addPhoto').classList.remove('locked');
      }
    } else if (field === 'comment') {
      if (val) {
        $('#commentCheck').classList.add('visible');
      } else {
        $('#commentCheck').classList.remove('visible');
      }
    }
    
    // Пересчитываем баланс после сохранения времени
    if (field === 'in_time' || field === 'out_time') {
      await recalculateBalance();
    }
  } catch (error) {
    console.error('Ошибка сохранения:', error);
    alert('Не удалось сохранить данные. Проверьте консоль браузера.');
  }
}

async function recalculateBalance(){
  const rec = await getRecord(currentDate);
  const prev = await getPrevDayRecord(currentDate);
  
  // Для первой даты (когда нет предыдущей записи) остаток должен быть строго 0
  // Проверяем, что prev действительно null или undefined, а не объект с carry_new_min
  let carryPrev = 0;
  if (prev && prev.date) {
    // Есть предыдущая запись - берем её carry_new_min
    // Важно: используем сохраненное значение из базы данных, не пересчитываем его
    // Но проверяем, что это действительно число, а не что-то другое
    const prevCarry = prev.carry_new_min;
    if (typeof prevCarry === 'number' && !isNaN(prevCarry)) {
      // Проверяем, что это не timestamp (timestamp был бы очень большим числом)
      // Если значение больше 100000 минут (примерно 70 дней), значит это ошибка
      const MAX_REASONABLE_MINUTES = 100000;
      const MIN_REASONABLE_MINUTES = -100000;
      if (prevCarry > MAX_REASONABLE_MINUTES || prevCarry < MIN_REASONABLE_MINUTES) {
        console.warn('Обнаружено некорректное значение carry_new_min:', prevCarry, 'для даты:', prev.date);
        carryPrev = 0;
      } else {
        carryPrev = Math.round(prevCarry);
      }
    } else {
      carryPrev = 0;
    }
  } else {
    // Нет предыдущей записи - остаток с прошлого дня строго = 0
    // Это гарантирует, что для первой записи остаток всегда будет 0
    carryPrev = 0;
  }
  
  // Логирование для отладки
  console.log('recalculateBalance для даты:', currentDate);
  console.log('Предыдущая запись:', prev);
  console.log('Остаток с прошлого дня (carryPrev):', carryPrev, 'минут =', mmToHhmm(carryPrev));
  
  // План рабочего дня зафиксирован: 09:00 - 18:00
  const planStart = PLAN_START;
  const planEnd = PLAN_END;

  // План работы в минутах
  const planMinutes = toMinutes(planEnd) - toMinutes(planStart);
  
  // Фактически отработано в минутах
  // ВАЖНО: Баланс рассчитывается ТОЛЬКО если есть и in_time, и out_time
  let actualMinutes = 0;
  let dayDelta = 0;
  
  if (rec.in_time && rec.out_time) {
    // Есть полные данные - рассчитываем баланс
    // Время присутствия на работе
    const presenceMinutes = toMinutes(rec.out_time) - toMinutes(rec.in_time);
    
    // Вычитаем отлучки (только завершенные)
    let breaksMin = 0;
    if (rec.breaks_json) {
      try {
        const breaks = JSON.parse(rec.breaks_json);
        breaks.forEach(b => {
          // Учитываем только завершенные отлучки (с to)
          if (b.to) {
            breaksMin += (toMinutes(b.to) - toMinutes(b.from));
          }
        });
      } catch {}
    }
    
    // Фактически отработано = время присутствия - отлучки
    actualMinutes = presenceMinutes - breaksMin;
    
    // Баланс дня = фактически отработано - план
    dayDelta = actualMinutes - planMinutes;
  } else {
    // Если нет полных данных (нет in_time или out_time) - день не считается рабочим
    // day_balance_min = 0 (не начисляем минус за нерабочий день)
    dayDelta = 0;
  }
  // Новый остаток = остаток с прошлого дня + баланс текущего дня
  const carryNew = carryPrev + dayDelta;
  
  console.log('Баланс дня (dayDelta):', dayDelta, 'минут =', mmToHhmm(dayDelta));
  console.log('Новый остаток (carryNew):', carryNew, 'минут =', mmToHhmm(carryNew));

  // Проверяем, что carryNew - это разумное значение (не timestamp)
  // Если значение больше 100000 минут (примерно 70 дней), значит это ошибка
  const MAX_REASONABLE_MINUTES = 100000; // ~70 дней
  const MIN_REASONABLE_MINUTES = -100000; // ~-70 дней
  const safeCarryNew = (carryNew > MAX_REASONABLE_MINUTES || carryNew < MIN_REASONABLE_MINUTES) 
    ? 0 
    : Math.round(carryNew);
  
  // Сохраняем рассчитанные значения ТОЛЬКО для текущего дня
  // Это не вызывает цепную реакцию, так как пересчет последующих дней
  // происходит только при их открытии и сохранении данных
  await saveRecord(currentDate, {
    day_balance_min: dayDelta,
    carry_new_min: safeCarryNew
  });

  // Обновляем отображение остатка (только если элемент существует)
  const carryPrevTextEl = $('#carryPrevText');
  if (carryPrevTextEl) {
    carryPrevTextEl.textContent = `Остаток с прошлого дня — "${mmToHhmm(carryPrev)}"`;
  }
  
  // Обновляем время окончания работы для выхода в ноль
  const currentRec = await getRecord(currentDate);
  updateTargetEndTime(currentRec.in_time, carryPrev);
}

async function openBreakModal(){
  // Проверяем, не выбран ли уже "факт ухода"
  const rec = await getRecord(currentDate);
  if (rec.out_time) {
    alert('Нельзя добавить отлучку после выбора "факт ухода"');
    return;
  }
  
  // Получаем текущие отлучки
  let currentBreaks = [];
  if (rec.breaks_json) {
    try{ currentBreaks = JSON.parse(rec.breaks_json)||[]; } catch{}
  }
  
  // Ищем незавершенную отлучку (есть from, но нет to)
  let savedFrom = '';
  let savedReason = '';
  
  // Проверяем последнюю отлучку - если она незавершенная, загружаем её
  if (currentBreaks.length > 0) {
    const lastBreak = currentBreaks[currentBreaks.length - 1];
    if (lastBreak.from && !lastBreak.to) {
      savedFrom = lastBreak.from;
      savedReason = lastBreak.reason || '';
    }
  }
  
  // Создаем HTML для модального окна с формой
  const modalHTML = `
    <div style="margin-bottom: 16px;">
      <label style="display: block; margin-bottom: 8px;">Ушёл</label>
      <div class="time-wrapper">
        <input id="bFrom" type="time" value="${savedFrom}" style="flex: 1;">
        <button id="bFromConfirm" class="time-confirm-btn" style="display: none;" title="Подтвердить время">✓</button>
        <span id="bFromCheck" class="checkmark ${savedFrom ? 'visible' : ''}">✓</span>
      </div>
    </div>
    <div style="margin-bottom: 16px;">
      <label style="display: block; margin-bottom: 8px;">Вернулся</label>
      <div class="time-wrapper">
        <input id="bTo" type="time" style="flex: 1;">
        <button id="bToConfirm" class="time-confirm-btn" style="display: none;" title="Подтвердить время">✓</button>
        <span id="bToCheck" class="checkmark">✓</span>
      </div>
    </div>
    <div style="margin-bottom: 16px;">
      <label style="display: block; margin-bottom: 8px;">Причина</label>
      <select id="bReason" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
        <option value="">не указано</option>
        <option value="съемка" ${savedReason === 'съемка' ? 'selected' : ''}>съемка</option>
        <option value="личное" ${savedReason === 'личное' ? 'selected' : ''}>личное</option>
      </select>
    </div>
  `;
  
  // Открываем модальное окно с HTML
  openModalHTML('Отлучка', modalHTML);
  
  // Сохраняем предыдущие значения для проверки изменений
  let previousBFrom = savedFrom || '';
  let previousBTo = '';
  
  // Показываем кнопку подтверждения при изменении времени "Ушёл"
  $('#bFrom').addEventListener('change', (e) => {
    const newValue = e.target.value || '';
    if (newValue && newValue !== previousBFrom) {
      $('#bFromConfirm').style.display = 'inline-flex';
    } else {
      $('#bFromConfirm').style.display = 'none';
    }
  });
  
  $('#bFrom').addEventListener('input', (e) => {
    const newValue = e.target.value || '';
    if (newValue && newValue !== previousBFrom) {
      $('#bFromConfirm').style.display = 'inline-flex';
    } else {
      $('#bFromConfirm').style.display = 'none';
    }
  });
  
  // Кнопка подтверждения для времени "Ушёл"
  $('#bFromConfirm').addEventListener('click', async (e) => {
    e.preventDefault();
    const from = $('#bFrom').value || '';
    if (from) {
      previousBFrom = from;
      $('#bFromConfirm').style.display = 'none';
      $('#bFromCheck').classList.add('visible');
      // Сохраняем частичную отлучку (только from)
      await savePartialBreak(from, $('#bReason').value);
    }
  });
  
  // Показываем кнопку подтверждения при изменении времени "Вернулся"
  $('#bTo').addEventListener('change', (e) => {
    const newValue = e.target.value || '';
    if (newValue && newValue !== previousBTo) {
      $('#bToConfirm').style.display = 'inline-flex';
    } else {
      $('#bToConfirm').style.display = 'none';
    }
  });
  
  $('#bTo').addEventListener('input', (e) => {
    const newValue = e.target.value || '';
    if (newValue && newValue !== previousBTo) {
      $('#bToConfirm').style.display = 'inline-flex';
    } else {
      $('#bToConfirm').style.display = 'none';
    }
  });
  
  // Кнопка подтверждения для времени "Вернулся"
  $('#bToConfirm').addEventListener('click', async (e) => {
    e.preventDefault();
    const to = $('#bTo').value || '';
    const from = $('#bFrom').value || '';
    if (to && from) {
      previousBTo = to;
      $('#bToConfirm').style.display = 'none';
      $('#bToCheck').classList.add('visible');
      // Завершаем отлучку - сохраняем полную
      await completeBreak(from, to, $('#bReason').value);
      // Очищаем поля после сохранения
      $('#bFrom').value = '';
      $('#bTo').value = '';
      $('#bReason').value = '';
      $('#bFromCheck').classList.remove('visible');
      $('#bToCheck').classList.remove('visible');
      previousBFrom = '';
      previousBTo = '';
    }
  });
  
  // Обновление причины при изменении выпадающего списка
  // Если уже выбрано время "Ушёл", обновляем причину в частичной отлучке
  $('#bReason').addEventListener('change', async (e) => {
    const reason = e.target.value;
    const from = $('#bFrom').value;
    if (from && $('#bFromCheck').classList.contains('visible')) {
      // Если время "Ушёл" уже подтверждено, обновляем причину
      await savePartialBreak(from, reason);
    }
  });
  
  // Функция сохранения частичной отлучки (только from)
  async function savePartialBreak(from, reason) {
    let rec = await getRecord(currentDate);
    let arr = [];
    if (rec.breaks_json) {
      try{ arr = JSON.parse(rec.breaks_json)||[]; } catch{}
    }
    
    // Удаляем незавершенную отлучку если есть
    arr = arr.filter(b => b.to); // Оставляем только завершенные
    
    // Добавляем новую частичную отлучку
    arr.push({ from, to: null, reason: reason || '' });
    const breaks_json = JSON.stringify(arr);
    await saveRecord(currentDate, { breaks_json });
    renderBreaksList(breaks_json);
    // Не пересчитываем баланс, так как отлучка не завершена
  }
  
  // Функция завершения отлучки (добавляем to)
  async function completeBreak(from, to, reason) {
    let rec = await getRecord(currentDate);
    let arr = [];
    if (rec.breaks_json) {
      try{ arr = JSON.parse(rec.breaks_json)||[]; } catch{}
    }
    
    // Находим незавершенную отлучку и завершаем её
    const incompleteIndex = arr.findIndex(b => b.from === from && !b.to);
    if (incompleteIndex !== -1) {
      arr[incompleteIndex].to = to;
      arr[incompleteIndex].reason = reason || arr[incompleteIndex].reason || '';
    } else {
      // Если не нашли, добавляем новую полную отлучку
      arr.push({ from, to, reason: reason || '' });
    }
    
    const breaks_json = JSON.stringify(arr);
    await saveRecord(currentDate, { breaks_json });
    renderBreaksList(breaks_json);
    await recalculateBalance(); // Пересчитываем баланс после завершения отлучки
  }
  
  // Функция обновления причины в завершенной отлучке
  async function updateBreakReason(from, to, reason) {
    let rec = await getRecord(currentDate);
    let arr = [];
    if (rec.breaks_json) {
      try{ arr = JSON.parse(rec.breaks_json)||[]; } catch{}
    }
    
    // Находим завершенную отлучку и обновляем причину
    const breakIndex = arr.findIndex(b => b.from === from && b.to === to);
    if (breakIndex !== -1) {
      arr[breakIndex].reason = reason || '';
      const breaks_json = JSON.stringify(arr);
      await saveRecord(currentDate, { breaks_json });
      renderBreaksList(breaks_json);
      await recalculateBalance();
    }
  }
  
  // Функция удаления незавершенной отлучки
  async function removeIncompleteBreak() {
    let rec = await getRecord(currentDate);
    let arr = [];
  if (rec.breaks_json) {
      try{ arr = JSON.parse(rec.breaks_json)||[]; } catch{}
    }
    
    // Удаляем незавершенные отлучки
    arr = arr.filter(b => b.to);
    
    const breaks_json = JSON.stringify(arr);
    await saveRecord(currentDate, { breaks_json });
    renderBreaksList(breaks_json);
  }
}

async function showReportForToday(){
  // Пересчитываем баланс перед показом отчета только для текущего дня
  // Это безопасно, так как пересчет происходит только для одного дня
  await recalculateBalance();
  
  // Получаем обновленные данные после пересчета
  const rec = await getRecord(currentDate);
  const prev = await getPrevDayRecord(currentDate);
  
  // Для первой записи (когда нет предыдущей) остаток на начало строго 0
  let carryPrev = 0;
  if (prev && prev.date) {
    // Есть предыдущая запись - берем её carry_new_min
    // Проверяем, что это действительно число
    const prevCarry = prev.carry_new_min;
    if (typeof prevCarry === 'number' && !isNaN(prevCarry)) {
      // Проверяем, что это не timestamp (timestamp был бы очень большим числом)
      const MAX_REASONABLE_MINUTES = 100000;
      const MIN_REASONABLE_MINUTES = -100000;
      if (prevCarry > MAX_REASONABLE_MINUTES || prevCarry < MIN_REASONABLE_MINUTES) {
        console.warn('Обнаружено некорректное значение carry_new_min:', prevCarry, 'для даты:', prev.date);
        carryPrev = 0;
      } else {
        carryPrev = Math.round(prevCarry);
      }
    } else {
      carryPrev = 0;
    }
  } else {
    // Нет предыдущей записи - остаток с прошлого дня строго = 0
    carryPrev = 0;
  }
  
  const carryPrevText = mmToHhmm(carryPrev);
  const rep = buildReport(rec, carryPrevText);
  const dateFormatted = formatDate(currentDate);
  // Используем openReportModal для сохранения даты для копирования
  openReportModal(dateFormatted, rep, null);
}

// Функция открытия модального окна для редактирования комментария
async function openCommentModal(){
  // Получаем текущее значение комментария из поля (может быть несохраненное)
  const currentCommentValue = $('#comment') ? $('#comment').value || '' : '';
  
  const modalHTML = `
    <div style="margin-bottom: 16px;">
      <label style="display: block; margin-bottom: 8px;">Комментарий</label>
      <textarea id="commentTextarea" rows="6" placeholder="Введите комментарий..." style="width: 100%; padding: 12px; border: 1px solid var(--border-default); border-radius: 8px; font-size: 15px; font-family: inherit; resize: vertical; box-sizing: border-box;">${currentCommentValue}</textarea>
    </div>
    <div style="display: flex; justify-content: space-between; gap: 12px; margin-top: 16px;">
      <button id="commentReset" class="btn" style="flex: 1;">Сбросить</button>
      <button id="commentDone" class="btn" style="flex: 1;">Готово</button>
    </div>
  `;
  
  openModalHTML('Комментарий', modalHTML, true); // true = скрыть кнопку "Закрыть"
  
  // Устанавливаем ширину модального окна для комментария
  const modal = document.querySelector('.modal');
  const modalBack = $('#modalBack');
  if (modal && modalBack) {
    // Определяем мобильную версию более точно (включая PWA)
    const isMobile = window.innerWidth <= 768 || 
                     /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
                     (window.matchMedia && window.matchMedia('(max-width: 768px)').matches);
    
    if (isMobile) {
      // Мобильная версия: на всю ширину с отступами 16px с каждой стороны (как принято в индустрии)
      modalBack.style.padding = '16px';
      modal.style.maxWidth = '100%';
      modal.style.width = '100%';
      modal.style.margin = '0';
      modal.style.borderRadius = '12px'; // Более скругленные углы для мобильных
    } else {
      // Десктопная версия: ширина одного поля времени
      modalBack.style.padding = '24px';
      const rowElement = document.querySelector('.row');
      if (rowElement) {
        const rowWidth = rowElement.offsetWidth;
        const gap = 12; // gap из .row
        const fieldWidth = (rowWidth - gap) / 2; // ширина одного поля
        modal.style.maxWidth = fieldWidth + 'px';
        modal.style.width = 'auto';
        modal.style.margin = '0';
      }
    }
  }
  
  const commentTextarea = $('#commentTextarea');
  const commentReset = $('#commentReset');
  const commentDone = $('#commentDone');
  
  // Кнопка "Сбросить"
  commentReset.addEventListener('click', () => {
    commentTextarea.value = '';
    // Обновляем поле комментария на главном экране
    $('#comment').value = '';
    // Скрываем кнопку подтверждения
    $('#commentConfirm').style.display = 'none';
    // Обновляем предыдущее значение
    window.previousComment = '';
    // Закрываем модальное окно
    closeModal();
  });
  
  // Кнопка "Готово"
  commentDone.addEventListener('click', () => {
    const newValue = commentTextarea.value.trim();
    // Обновляем поле комментария на главном экране
    $('#comment').value = newValue;
    // Показываем кнопку подтверждения, если есть текст и он отличается от сохраненного
    if (newValue && newValue !== window.previousComment) {
      $('#commentConfirm').style.display = 'inline-flex';
    } else {
      $('#commentConfirm').style.display = 'none';
    }
    // Закрываем модальное окно
    closeModal();
  });
  
  // Фокус на textarea при открытии
  setTimeout(() => {
    commentTextarea.focus();
    // Прокручиваем в конец текста, если он есть
    if (commentTextarea.value) {
      commentTextarea.setSelectionRange(commentTextarea.value.length, commentTextarea.value.length);
    }
  }, 100);
}

async function openPhotoModal(){
  // Проверяем, не выбран ли уже "факт ухода"
  const rec = await getRecord(currentDate);
  if (rec.out_time) {
    alert('Нельзя добавить фото после выбора "факт ухода"');
    return;
  }
  
  const modalHTML = `
    <div style="margin-bottom: 16px;">
      <label style="display: block; margin-bottom: 8px;">Выберите фото (только одна фотография)</label>
      <input id="photoInput" type="file" accept="image/*" style="width: 100%; padding: 8px; border: 1px solid #ccc; border-radius: 4px;">
      <p class="muted" style="margin-top: 8px; font-size: 12px;">Можно загрузить только одну фотографию</p>
    </div>
    <div id="photoUploadStatus" style="margin-top: 12px; display: none;">
      <div id="photoUploadProgress" class="muted">Загрузка...</div>
    </div>
  `;
  
  openModalHTML('Загрузка фото', modalHTML);
  
  const photoInput = $('#photoInput');
  const uploadStatus = $('#photoUploadStatus');
  const uploadProgress = $('#photoUploadProgress');
  
  photoInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    // Проверяем, что это изображение
    if (!file.type.startsWith('image/')) {
      alert('Пожалуйста, выберите файл изображения');
      return;
    }
    
    // Показываем статус загрузки
    uploadStatus.style.display = 'block';
    uploadProgress.textContent = 'Сжатие фото...';
    
    try {
      // Сжимаем фото до 300 КБ перед загрузкой
      const compressedFile = await compressImage(file, 300 * 1024); // 300 КБ в байтах
      
      uploadProgress.textContent = 'Загрузка фото...';
      
      // Загружаем сжатое фото в Supabase Storage
      const photoUrl = await uploadPhotoToStorage(compressedFile);
      
      if (photoUrl) {
        // Сохраняем URL в базе данных
        await saveField('photo_url', photoUrl);
        
        // Показываем галочку
        $('#photoCheck').classList.add('visible');
        $('#photoStatus').textContent = 'Фото загружено';
        
        // Показываем превью
        $('#photoImage').src = photoUrl;
        $('#photoPreview').style.display = 'block';
        
        uploadProgress.textContent = 'Фото успешно загружено!';
        uploadProgress.style.color = '#28a745';
        
        // Закрываем модальное окно через 1 секунду
        setTimeout(() => {
          closeModal();
        }, 1000);
      } else {
        throw new Error('Не удалось получить URL загруженного фото');
      }
    } catch (error) {
      console.error('Ошибка загрузки фото:', error);
      uploadProgress.textContent = 'Ошибка загрузки фото. Попробуйте еще раз.';
      uploadProgress.style.color = '#dc3545';
    }
  });
}

// Функция сжатия изображения до указанного размера (в байтах)
async function compressImage(file, maxSizeBytes) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = async () => {
        // Начальные параметры
        let width = img.width;
        let height = img.height;
        const maxDimension = 1920; // Максимальный размер по большей стороне
        
        // Уменьшаем размер, если изображение слишком большое
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height / width) * maxDimension);
            width = maxDimension;
          } else {
            width = Math.round((width / height) * maxDimension);
            height = maxDimension;
          }
        }
        
        // Создаем canvas
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        
        // Рисуем изображение
        ctx.drawImage(img, 0, 0, width, height);
        
        // Бинарный поиск оптимального качества
        let minQuality = 0.1;
        let maxQuality = 0.9;
        let bestBlob = null;
        let bestQuality = 0.9;
        
        // Функция для получения размера blob
        const getBlobSize = (blob) => blob.size;
        
        // Итеративно ищем оптимальное качество
        while (maxQuality - minQuality > 0.05) {
          const quality = (minQuality + maxQuality) / 2;
          
          const blob = await new Promise((resolve) => {
            canvas.toBlob((b) => resolve(b), 'image/jpeg', quality);
          });
          
          if (!blob) {
            reject(new Error('Не удалось сжать изображение'));
            return;
          }
          
          const size = getBlobSize(blob);
          
          if (size <= maxSizeBytes) {
            // Размер подходит - можем попробовать лучшее качество
            bestBlob = blob;
            bestQuality = quality;
            minQuality = quality;
          } else {
            // Размер слишком большой - уменьшаем качество
            maxQuality = quality;
          }
        }
        
        // Если не нашли подходящий размер, используем минимальное качество
        if (!bestBlob) {
          const finalBlob = await new Promise((resolve) => {
            canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.1);
          });
          
          if (!finalBlob) {
            reject(new Error('Не удалось сжать изображение'));
            return;
          }
          
          bestBlob = finalBlob;
        }
        
        // Создаем File из Blob с оригинальным именем
        const compressedFile = new File([bestBlob], file.name.replace(/\.[^/.]+$/, '.jpg'), {
          type: 'image/jpeg',
          lastModified: Date.now()
        });
        
        resolve(compressedFile);
      };
      
      img.onerror = () => {
        reject(new Error('Не удалось загрузить изображение'));
      };
      
      img.src = e.target.result;
    };
    
    reader.onerror = () => {
      reject(new Error('Не удалось прочитать файл'));
    };
    
    reader.readAsDataURL(file);
  });
}

// Функция загрузки фото в Supabase Storage
async function uploadPhotoToStorage(file) {
  try {
    if (!supabaseClient) {
      throw new Error('Supabase не инициализирован');
    }
    
    // Генерируем уникальное имя файла: дата_время_случайное_число.расширение
    const fileExt = file.name.split('.').pop();
    const fileName = `${currentDate}_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `${currentDate}/${fileName}`;
    
    // Загружаем файл в Storage
    const { data, error } = await supabaseClient.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false // Не перезаписывать существующие файлы
      });
    
    if (error) {
      console.error('Ошибка загрузки в Storage:', error);
      throw error;
    }
    
    // Получаем публичный URL файла
    const { data: urlData } = supabaseClient.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(filePath);
    
    if (!urlData || !urlData.publicUrl) {
      throw new Error('Не удалось получить публичный URL');
    }
    
    return urlData.publicUrl;
  } catch (error) {
    console.error('Ошибка загрузки фото:', error);
    throw error;
  }
}

/***** BOSS SCREEN - Месячный календарь и список *****/
// Кеш данных за месяцы для быстрой загрузки
const monthDataCache = {};
const monthDataCacheTime = {};

// Функция для поиска предыдущей записи в уже загруженных данных
function findPrevRecordInData(date, allData) {
  // Сортируем все даты по убыванию
  const sortedDates = Object.keys(allData).sort().reverse();
  
  // Находим первую дату, которая меньше текущей
  for (const prevDate of sortedDates) {
    if (prevDate < date) {
      return allData[prevDate];
    }
  }
  
  return null;
}

// Функция для обновления только одного дня в списке (если он отображается)
async function updateDayInMonthList(date, updatedRec) {
  const monthListView = $('#monthListView');
  if (!monthListView) return; // Список не отображается
  
  // Находим элемент дня по data-атрибуту
  const dayElement = monthListView.querySelector(`[data-date="${date}"]`);
  if (!dayElement) return; // День не найден в списке
  
  // Получаем все данные для расчета остатка с прошлого дня
  const monthKey = date.slice(0, 7); // YYYY-MM
  let allData = monthDataCache[monthKey];
  
  if (!allData) {
    // Если данных нет в кеше, загружаем их
    allData = await getAllRecords();
    monthDataCache[monthKey] = allData;
  }
  
  // Находим предыдущую запись
  const prev = findPrevRecordInData(date, allData);
  
  // Рассчитываем остаток с прошлого дня
  let carryPrev = 0;
  if (prev && prev.date) {
    const prevCarry = prev.carry_new_min;
    if (typeof prevCarry === 'number' && !isNaN(prevCarry)) {
      // Проверяем, что это не timestamp (timestamp был бы очень большим числом)
      const MAX_REASONABLE_MINUTES = 100000;
      const MIN_REASONABLE_MINUTES = -100000;
      if (prevCarry > MAX_REASONABLE_MINUTES || prevCarry < MIN_REASONABLE_MINUTES) {
        console.warn('Обнаружено некорректное значение carry_new_min:', prevCarry, 'для даты:', prev.date);
        carryPrev = 0;
      } else {
        carryPrev = Math.round(prevCarry);
      }
    }
  }
  
  // Формируем отчет
  const report = buildReport(updatedRec, mmToHhmm(carryPrev));
  
  // Формируем содержимое дня
  const dateObj = new Date(date);
  const dayName = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'][dateObj.getDay()];
  let content = `<div class="day-header">${dayName} ${formatDate(date)}</div>`;
  
  if (updatedRec.in_time || updatedRec.out_time) {
    const formattedReport = report.split('\n').map(line => {
      if (line.trim() === '') return '<br>';
      const escapedLine = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `<div style="margin: 2px 0;">${escapedLine}</div>`;
    }).join('');
    content += `<div class="day-content" style="white-space: pre-wrap; font-family: monospace; font-size: 13px; line-height: 1.6; padding: 8px;">${formattedReport}</div>`;
    
    // Добавляем кнопку "Показать фото" если есть фото
    if (updatedRec.photo_url) {
      const photoId = `photo-${date.replace(/-/g, '')}`;
      const photoContainerId = `photo-container-${date.replace(/-/g, '')}`;
      const photoImgId = `photo-img-${date.replace(/-/g, '')}`;
      content += `
        <div style="margin-top: 12px;">
          <button class="photo-toggle-btn" id="${photoId}" style="width: 100%;">Показать фото</button>
          <div class="photo-container" id="${photoContainerId}" style="max-height: 0; overflow: hidden; transition: max-height 0.3s ease-out;">
            <img 
              id="${photoImgId}"
              class="photo-thumbnail" 
              src="${updatedRec.photo_url}" 
              alt="Фото сдачи ключей" 
              loading="lazy"
              style="max-width: 200px !important; max-height: 150px !important; width: auto !important; height: auto !important; border-radius: 8px; cursor: pointer; display: block; margin: 12px auto; border: 1px solid #ddd; transition: transform 0.2s; object-fit: contain !important; object-position: center; flex-shrink: 0;"
            >
          </div>
        </div>
      `;
    } else {
      const photoId = `photo-${date.replace(/-/g, '')}`;
      const photoContainerId = `photo-container-${date.replace(/-/g, '')}`;
      content += `
        <div style="margin-top: 12px;">
          <button class="photo-toggle-btn" id="${photoId}" style="width: 100%;">Показать фото</button>
          <div class="photo-container" id="${photoContainerId}" style="max-height: 0; overflow: hidden; transition: max-height 0.3s ease-out;">
            <div class="photo-placeholder" style="width: 200px; height: 150px; background: #f0f0f0; border: 2px dashed #ccc; border-radius: 8px; display: flex; align-items: center; justify-content: center; margin: 12px auto; color: #999;">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="width: 48px; height: 48px;">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
          </div>
        </div>
      `;
    }
  } else {
    content += `<div class="day-content muted">Нет данных за эту дату</div>`;
  }
  
  // Обновляем содержимое элемента
  dayElement.innerHTML = content;
  
  // Восстанавливаем обработчики событий
  const photoToggleBtn = dayElement.querySelector(`#photo-${date.replace(/-/g, '')}`);
  const photoContainer = dayElement.querySelector(`#photo-container-${date.replace(/-/g, '')}`);
  const photoImg = dayElement.querySelector(`#photo-img-${date.replace(/-/g, '')}`);
  
  if (photoToggleBtn && photoContainer) {
    photoToggleBtn.onclick = () => {
      const isExpanded = photoContainer.classList.contains('expanded');
      if (isExpanded) {
        photoContainer.classList.remove('expanded');
        photoContainer.style.maxHeight = '0px';
        photoToggleBtn.textContent = 'Показать фото';
      } else {
        photoContainer.classList.add('expanded');
        photoContainer.style.maxHeight = '500px';
        photoToggleBtn.textContent = 'Скрыть фото';
      }
    };
  }
  
  if (photoImg && updatedRec.photo_url) {
    photoImg.onclick = () => {
      openLightbox(updatedRec.photo_url);
    };
  }
  
  console.log('День обновлен в списке:', date);
}

function getEmptyAsanaStats() {
      return {
    weekStartDate: null,
    weekEndDate: null,
    weekLoad: 0,
        plan: 80,
    doneFactThisWeek: 0,
    carryOverFromPrev: 0,
    overtimeQty: 0,
    doneQty: 0,
    doneStmQty: 0,
    doneNonStmQty: 0,
    toShootQty: 0,
    remainingToPlan: 80,
    onHandQty: 0,
    warehouseQty: 0,
    shotNotProcessedQty: 0,
    qErrorsCount: 0,
    completedCount: 0,
    pendingCount: 0,
    totalPlan: 0,
    version: 'unknown',
    updatedAt: null
  };
}

// Функция для получения статистики Asana напрямую из Edge Function
// ============================================================================
// Вкладка "Задачи" (Tasks Tab) - Логика работы с Asana статистикой
// ============================================================================
// 
// Модель данных (v3.2-tasks-kpi-new-kpi-logic):
// - Фактические KPI (done_fact_this_week) рассчитываются по фактическим датам (week_shot, week_processed, completed_at)
// - Плановые KPI (to_shoot_qty, on_hand_qty, warehouse_qty) рассчитываются по due_on (дедлайн задачи)
// - to_shoot_qty теперь означает "Обработать на этой неделе": задачи с due_on в текущей неделе, processed_at IS NULL
// - shot_not_processed_qty теперь накопительный долг: все задачи, где shot_at IS NOT NULL, processed_at IS NULL, due_on НЕ в текущей неделе
// - Используется поле q (количество товаров), legacy поле quantity удалено
// - См. docs/tasks-backend-new-kpi-spec.md для деталей новой модели KPI
// 
// Основные функции:
// - getAsanaStats(): получает статистику через Edge Function fetch-asana-stats
// - updateTasksCards(stats): обновляет карточки KPI на основе нормализованных данных
// - renderTasks(): рендерит вкладку "Задачи" с карточками и кнопками
// - getAsanaTasksDetailsByWeekStart(weekStartStr): получает детали задач по неделе (фильтрация по week_shot/week_processed/week_start_date)
// - renderTasksDetailsFromCache(): отображает таблицу с деталями задач
// ============================================================================

async function getAsanaStats() {
  try {
    if (!supabaseClient) {
      return cachedTasksStats || getEmptyAsanaStats();
    }

    const { data: result, error } = await supabaseClient.functions.invoke('fetch-asana-stats', {
      body: {}
    });

    if (error) {
      console.error('[[TasksTab Error]] Ошибка вызова Edge Function:', error);
      throw new Error(error.message || 'Ошибка вызова Edge Function');
    }

    // Логируем полный ответ Edge Function (один раз, без спама)
    console.log('[[TasksTab Debug]] Полный ответ Edge Function:', JSON.stringify(result, null, 2));

    if (!result) {
      console.warn('[[TasksTab Warning]] Edge Function вернула пустой ответ (result is null/undefined)');
      return cachedTasksStats || getEmptyAsanaStats();
    }

    if (result.success === false || result.data === null) {
      const message = result.message || 'Edge Function вернула ошибку';
      console.warn('[[TasksTab Warning]] Edge Function вернула ошибку:', message, result.error || '');
      return cachedTasksStats || getEmptyAsanaStats();
    }

    if (!result.data) {
      console.warn('[[TasksTab Warning]] Edge Function вернула пустой ответ по статистике Asana (data is null/undefined)');
      return cachedTasksStats || getEmptyAsanaStats();
    }

    const data = result.data;
    const doneFactThisWeek = data.done_fact_this_week ?? 0;
    const carryOverFromPrev = data.carry_over_from_prev ?? 0;
    const doneQty = data.done_qty ?? doneFactThisWeek + carryOverFromPrev;
    const doneStmQty = data.done_stm_qty ?? 0;
    const doneNonStmQty = data.done_nonstm_qty ?? 0;
    
    const normalizedStats = {
      weekStartDate: data.week_start_date || null, // 'YYYY-MM-DD' - важно для getAsanaTasksDetailsByWeekStart
      weekEndDate: data.week_end_date || null,
      weekLoad: data.week_load ?? 0,
      // План всегда статичен и равен 80 товаров в неделю (см. docs/tasks-backend-new-kpi-spec.md)
      // Принудительно устанавливаем 80, даже если из API пришло другое значение (для совместимости со старыми данными)
      plan: 80,
      doneFactThisWeek,
      carryOverFromPrev,
      overtimeQty: data.overtime_qty ?? 0,
      doneQty,
      doneStmQty,
      doneNonStmQty,
      toShootQty: data.to_shoot_qty ?? 0,
      // Всегда пересчитываем remaining_to_plan на фронтенде с учетом долга/переработки
      // remaining_to_plan = max(0, plan - done_qty), где done_qty = done_fact_this_week + carry_over_from_prev
      // Это учитывает долг с прошлой недели (отрицательный carry_over) или переработку (положительный)
      remainingToPlan: Math.max(80 - doneQty, 0), // План всегда 80, учитываем долг/переработку
      onHandQty: data.on_hand_qty ?? 0,
      warehouseQty: data.warehouse_qty ?? 0,
      shotNotProcessedQty: data.shot_not_processed_qty ?? 0,
      qErrorsCount: data.q_errors_count ?? 0,
      completedCount: data.completed_count ?? 0,
      pendingCount: data.pending_count ?? 0,
      totalPlan: data.total_plan ?? 0,
      version: data.version || 'unknown',
      updatedAt: data.updated_at || null,
      _raw: data
    };

    cachedTasksStats = normalizedStats;
    
    // Сохраняем weekStartDate для использования в деталях задач
    if (normalizedStats.weekStartDate) {
      lastAsanaWeekStart = normalizedStats.weekStartDate;
    } else {
      lastAsanaWeekStart = null;
    }
    
    return normalizedStats;
  } catch (error) {
    console.error('[[TasksTab Error]] Ошибка получения статистики Asana через Edge Function:', error);
    return cachedTasksStats || getEmptyAsanaStats();
  }
}

// Функция обновления значений в карточках без пересоздания HTML
// Принимает объект stats с нормализованными полями (doneQty, toShootQty, weekLoad, plan, remainingToPlan)
function updateTasksCards(stats) {
  const doneFact = stats.doneFactThisWeek ?? stats.done_fact_this_week ?? 0;
  const carryOver = stats.carryOverFromPrev ?? stats.carry_over_from_prev ?? 0;
  // done_qty = done_fact + carry_over (учитывает долг/переработку)
  const doneQty = stats.doneQty ?? stats.done_qty ?? (doneFact + carryOver);
  const overtimeQty = stats.overtimeQty ?? stats.overtime_qty ?? 0;
  // to_shoot_qty теперь означает "Обработать на этой неделе" (задачи с due_on в текущей неделе, processed_at IS NULL)
  // См. docs/tasks-backend-new-kpi-spec.md для деталей новой модели KPI
  const toShootQty = stats.toShootQty ?? stats.to_shoot_qty ?? 0;
  const weekLoad = stats.weekLoad ?? stats.week_load ?? 0;
  // План всегда статичен и равен 80 товаров в неделю (см. docs/tasks-backend-new-kpi-spec.md)
  const plan = 80;
  // Всегда пересчитываем remaining_to_plan с учетом долга/переработки
  // remaining_to_plan = max(0, plan - done_qty), где done_qty = done_fact + carry_over
  // Это учитывает долг с прошлой недели (отрицательный carry_over) или переработку (положительный)
  const remainingToPlan = Math.max(plan - doneQty, 0);
  const onHandQty = stats.onHandQty ?? stats.on_hand_qty ?? 0;
  const warehouseQty = stats.warehouseQty ?? stats.warehouse_qty ?? 0;
  // shot_not_processed_qty теперь означает накопительный долг (все сфотканы, но не обработаны, где due_on НЕ в текущей неделе)
  // См. docs/tasks-backend-new-kpi-spec.md для деталей новой модели KPI
  const shotNotProcessedQty =
    stats.shotNotProcessedQty ?? stats.shot_not_processed_qty ?? 0;
  const qErrorsCount = stats.qErrorsCount ?? stats.q_errors_count ?? 0;
  const doneStmQty = stats.doneStmQty ?? stats.done_stm_qty ?? 0;
  const doneNonStmQty = stats.doneNonStmQty ?? stats.done_nonstm_qty ?? 0;

  const completedValue = $('#completedCount');
  const doneStmNonStmMeta = $('#doneStmNonStmMeta');
  const pendingValue = $('#pendingCount');
  const planValue = $('#planValue');
  const weekLoadValue = $('#weekLoadValue');
  const remainingValue = $('#remainingCount');
  const remainingText = $('#remainingText');
  const cardRemaining = $('#cardRemaining');
  const doneFactValue = $('#doneFactValue');
  const carryOverValue = $('#carryOverValue');
  const carryOverRow = $('#carryOverRow');
  const overtimeValue = $('#overtimeQty');
  const overtimeCard = $('#overtimeCard');

  if (completedValue) completedValue.textContent = doneQty;
  if (doneStmNonStmMeta) {
    doneStmNonStmMeta.textContent = `СТМ: ${doneStmQty} / НЕ СТМ: ${doneNonStmQty}`;
  }
  // Обновление карточки "Обработать на этой неделе" (было "Предстоит отснять")
  if (pendingValue) pendingValue.textContent = toShootQty;
  if (planValue) planValue.textContent = plan;
  if (weekLoadValue) weekLoadValue.textContent = weekLoad;
  if (remainingValue) remainingValue.textContent = remainingToPlan;
  if (doneFactValue) doneFactValue.textContent = doneFact;
  if (carryOverValue) carryOverValue.textContent = carryOver;
  if (carryOverRow) carryOverRow.style.opacity = carryOver > 0 ? '1' : '0.5';
  if (overtimeValue) overtimeValue.textContent = overtimeQty;
  if (overtimeCard) overtimeCard.style.opacity = overtimeQty > 0 ? '1' : '0.5';

  if (cardRemaining && remainingValue && remainingText) {
    // Классы уже установлены в HTML, стили управляются через CSS
    remainingText.textContent = `товаров (план: ${plan})`;
  }
  
  // Обновление операционных карточек (текущая неделя)
  const onHandValueEl = $('#kpiOnHandValue');
  const warehouseValueEl = $('#kpiWarehouseValue');
  
  if (onHandValueEl) onHandValueEl.textContent = onHandQty;
  if (warehouseValueEl) warehouseValueEl.textContent = warehouseQty;
  
  // Обновление накопительного показателя "Сфоткано, но не обработано (накопительный долг)"
  const shotNotProcessedValueEl = $('#kpiShotNotProcessedValue');
  if (shotNotProcessedValueEl) shotNotProcessedValueEl.textContent = shotNotProcessedQty;
  
  // Обновление подписи для qErrorsCount (если есть)
  const qErrorsNoteEl = document.querySelector('#tasksOperationalKpi p');
  if (qErrorsNoteEl && qErrorsCount > 0) {
    qErrorsNoteEl.innerHTML = `Задач с ошибкой Q: <strong>${qErrorsCount}</strong>`;
    qErrorsNoteEl.style.display = 'block';
  } else if (qErrorsNoteEl && qErrorsCount === 0) {
    qErrorsNoteEl.style.display = 'none';
  }
}

// Функция рендеринга страницы "Задачи"
// Глобальные переменные для сохранения состояния
let tasksDetailsExpanded = false;
let cachedTasksDetails = null;
let cachedTasksStats = null; // Кеш для статистики
let lastAsanaWeekStart = null; // string | null - последняя неделя Asana для загрузки деталей задач

// Состояние фильтров для деталей задач
const tasksDetailsFilterState = {
  mode: 'operational', // 'operational' | 'all'
  type: 'all',         // 'all' | 'СТМ' | 'НЕ СТМ'
  priority: 'all',     // 'all' | '🔥 Срочно' | 'Высокий' | 'Средний'
  showCompleted: false,
  onlyQErrors: false,
  status: 'all',       // 'all' | 'on_hand' | 'warehouse' | 'shot_not_processed' | 'accumulatedShotNotProcessed' | 'completed' | 'other'
};

async function renderTasks() {
  const app = $('#app');
  
  // Если есть кешированная статистика, используем её для быстрого отображения
  let stats;
  if (cachedTasksStats) {
    stats = cachedTasksStats;
  } else {
    // Показываем загрузку только если нет кеша
    app.innerHTML = `
      <h1>Задачи Asana</h1>
      <p>Загрузка данных...</p>
    `;
    
    // Получаем статистику
    stats = await getAsanaStats();
    if (stats) {
      cachedTasksStats = stats;
      // Сохраняем weekStartDate для использования в деталях задач (уже сохранено в getAsanaStats)
      // lastAsanaWeekStart уже обновлён в getAsanaStats
    }
  }
  
  // Используем нормализованные данные из stats объекта
  const doneFact = stats.doneFactThisWeek ?? stats.done_fact_this_week ?? 0;
  const carryOver = stats.carryOverFromPrev ?? stats.carry_over_from_prev ?? 0;
  const overtimeQty = stats.overtimeQty ?? stats.overtime_qty ?? 0;
  // done_qty = done_fact + carry_over (учитывает долг/переработку)
  const doneQty = stats.doneQty ?? stats.done_qty ?? (doneFact + carryOver);
  const toShootQty = stats.toShootQty ?? stats.to_shoot_qty ?? 0;
  // План всегда статичен и равен 80 товаров в неделю (см. docs/tasks-backend-new-kpi-spec.md)
  const plan = 80;
  const weekLoad = stats.weekLoad ?? stats.week_load ?? doneFact + toShootQty;
  // Всегда пересчитываем remaining_to_plan с учетом долга/переработки
  // remaining_to_plan = max(0, plan - done_qty), где done_qty = done_fact + carry_over
  // Это учитывает долг с прошлой недели (отрицательный carry_over) или переработку (положительный)
  const remainingToPlan = Math.max(plan - doneQty, 0);
  const onHandQty = stats.onHandQty ?? stats.on_hand_qty ?? 0;
  const warehouseQty = stats.warehouseQty ?? stats.warehouse_qty ?? 0;
  const shotNotProcessedQty =
    stats.shotNotProcessedQty ?? stats.shot_not_processed_qty ?? 0;
  const qErrorsCount = stats.qErrorsCount ?? stats.q_errors_count ?? 0;
  const doneStmQty = stats.doneStmQty ?? stats.done_stm_qty ?? 0;
  const doneNonStmQty = stats.doneNonStmQty ?? stats.done_nonstm_qty ?? 0;
  
  app.innerHTML = `
    <div class="tasks-page">
    <h1 class="tasks-page-title">Задачи Asana</h1>
    
      <div id="tasksHeader">
      <!-- Операционный блок: две карточки (текущая неделя) -->
      <div id="tasksOperationalKpi" class="tasks-kpi-section tasks-kpi-section--operational">
        <div class="kpi-grid tasks-kpi-grid-operational">
          <div id="kpiOnHandCard" class="kpi-card kpi-card--onhand kpi-card--clickable">
            <h3 class="kpi-title">Уже на руках</h3>
            <div id="kpiOnHandValue" class="kpi-value">${onHandQty}</div>
            <p class="kpi-subtext">товаров</p>
          </div>
          
          <div id="kpiWarehouseCard" class="kpi-card kpi-card--warehouse kpi-card--clickable">
            <h3 class="kpi-title">Нужно взять со склада</h3>
            <div id="kpiWarehouseValue" class="kpi-value">${warehouseQty}</div>
            <p class="kpi-subtext">товаров</p>
          </div>
        </div>
        ${qErrorsCount > 0 ? `<p class="tasks-operational-note">Задач с ошибкой Q: <strong>${qErrorsCount}</strong></p>` : ''}
      </div>
      
      <!-- Недельные KPI -->
      <div id="tasksWeeklyKpi" class="tasks-kpi-section tasks-kpi-section--weekly">
    <div id="tasksGrid" class="kpi-grid">
      <div class="kpi-card kpi-card--done">
        <h3 class="kpi-title">Сделано</h3>
        <div id="completedCount" class="kpi-value kpi-value--done">${doneQty}</div>
            <div id="doneStmNonStmMeta" class="kpi-meta kpi-meta--stm-split">СТМ: ${doneStmQty} / НЕ СТМ: ${doneNonStmQty}</div>
        <div class="kpi-meta kpi-meta--primary">
          <span>Факт</span>
          <strong id="doneFactValue">${doneFact}</strong>
        </div>
        <div id="carryOverRow" class="kpi-meta ${carryOver > 0 ? '' : 'kpi-meta--muted'}">
          <span>Переработка с прошлой недели</span>
          <strong id="carryOverValue">${carryOver}</strong>
        </div>
      </div>
      
      <div class="kpi-card kpi-card--plan">
            <h3 class="kpi-title">План недели</h3>
        <div id="planValue" class="kpi-value kpi-value--plan">${plan}</div>
            <p class="kpi-subtext">товаров</p>
        <div class="kpi-meta">
          <span>Нагрузка недели</span>
          <strong id="weekLoadValue">${weekLoad}</strong>
        </div>
      </div>
          
          <div class="kpi-card kpi-card--pending">
            <h3 class="kpi-title">Обработать на этой неделе</h3>
            <div id="pendingCount" class="kpi-value kpi-value--pending">${toShootQty}</div>
            <p class="kpi-subtext">товаров</p>
      </div>
      
      <div id="cardRemaining" class="kpi-card kpi-card--remaining ${remainingToPlan > 0 ? '' : 'kpi-card--remaining-success'}">
        <h3 class="kpi-title">До выполнения плана</h3>
        <div id="remainingCount" class="kpi-value ${remainingToPlan > 0 ? 'kpi-value--remaining' : 'kpi-value--remaining-success'}">
          ${remainingToPlan}
        </div>
        <p id="remainingText" class="kpi-subtext">товаров (план: ${plan})</p>
      </div>
    
      <div id="overtimeCard" class="kpi-card kpi-card--overtime ${overtimeQty > 0 ? '' : 'kpi-card--muted'}">
            <h3 class="kpi-title">Переработка недели</h3>
        <div id="overtimeQty" class="kpi-value kpi-value--overtime">${overtimeQty}</div>
        <p class="kpi-subtext">товаров сверх плана</p>
      </div>
    </div>
      </div>
    </div>
    
    <div class="tasks-actions-section">
      <button id="refreshStats" class="btn btn-full">Обновить данные</button>
      <p class="muted tasks-actions-note">
        Нажмите кнопку для получения актуальной статистики из Asana.
      </p>
    </div>
    
    <div class="tasks-actions-section">
      <button id="showDetails" class="btn btn-full">Показать подробности</button>
    </div>
    
    <!-- Накопительные показатели -->
    <div id="tasksAccumulatedKpi" class="tasks-kpi-section tasks-kpi-section--accumulated">
      <h2 class="tasks-section-title">Накопительные показатели</h2>
      <div class="kpi-grid tasks-kpi-grid-accumulated">
        <div id="kpiShotNotProcessedCard" class="kpi-card kpi-card--shot kpi-card--clickable">
          <h3 class="kpi-title">Сфоткано, но не обработано (накопительный долг)</h3>
          <div id="kpiShotNotProcessedValue" class="kpi-value">${shotNotProcessedQty}</div>
          <p class="kpi-subtext">товаров</p>
        </div>
      </div>
    </div>
    
    <div id="tasksDetailsContainer" class="tasks-details-container ${tasksDetailsExpanded ? 'expanded' : ''}">
      <div id="tasksDetailsFilters" class="tasks-filters">
        <div class="tasks-filters-row">
          <div class="tasks-filters-mode">
            <button type="button" class="tasks-filter-mode-btn ${tasksDetailsFilterState.mode === 'operational' ? 'tasks-filter-mode-btn--active' : ''}" data-mode="operational">Только операционные</button>
            <button type="button" class="tasks-filter-mode-btn ${tasksDetailsFilterState.mode === 'all' ? 'tasks-filter-mode-btn--active' : ''}" data-mode="all">Все задачи</button>
          </div>
          <div class="tasks-filters-selects">
            <label class="tasks-filter-label">
              Тип товара:
              <select id="tasksFilterType" class="tasks-filter-select">
                <option value="all" ${tasksDetailsFilterState.type === 'all' ? 'selected' : ''}>Все</option>
                <option value="СТМ" ${tasksDetailsFilterState.type === 'СТМ' ? 'selected' : ''}>СТМ</option>
                <option value="НЕ СТМ" ${tasksDetailsFilterState.type === 'НЕ СТМ' ? 'selected' : ''}>НЕ СТМ</option>
              </select>
            </label>
            <label class="tasks-filter-label">
              Приоритет:
              <select id="tasksFilterPriority" class="tasks-filter-select">
                <option value="all" ${tasksDetailsFilterState.priority === 'all' ? 'selected' : ''}>Все</option>
                <option value="🔥 Срочно" ${tasksDetailsFilterState.priority === '🔥 Срочно' ? 'selected' : ''}>🔥 Срочно</option>
                <option value="Высокий" ${tasksDetailsFilterState.priority === 'Высокий' ? 'selected' : ''}>Высокий</option>
                <option value="Средний" ${tasksDetailsFilterState.priority === 'Средний' ? 'selected' : ''}>Средний</option>
              </select>
            </label>
          </div>
          <div class="tasks-filters-checkboxes">
            <label class="tasks-filter-checkbox">
              <span>Показать выполненные задачи недели</span>
              <input type="checkbox" id="tasksFilterShowCompleted" ${tasksDetailsFilterState.showCompleted ? 'checked' : ''} />
            </label>
            <label class="tasks-filter-checkbox">
              <span>Показать только задачи с ошибкой Q</span>
              <input type="checkbox" id="tasksFilterOnlyQErrors" ${tasksDetailsFilterState.onlyQErrors ? 'checked' : ''} />
            </label>
          </div>
        </div>
      </div>
      <div id="tasksDetailsInner" class="tasks-details-inner">
      <div id="tasksDetailsList" class="tasks-details-panel"></div>
      </div>
    </div>
    </div>
  `;
  
  // Обновляем вторичные показатели сразу после рендера
  // Передаём нормализованные данные в updateTasksCards
  updateTasksCards({
    doneQty,
    doneFactThisWeek: doneFact,
    carryOverFromPrev: carryOver,
    overtimeQty,
    toShootQty,
    weekLoad,
    plan,
    remainingToPlan,
    onHandQty,
    warehouseQty,
    shotNotProcessedQty,
    qErrorsCount,
    doneStmQty,
    doneNonStmQty,
    weekStartDate: stats.weekStartDate || stats.week_start_date || null
  });
  
  // Загружаем детальные данные сразу (в фоне), чтобы они были готовы при нажатии "Показать подробности"
  const weekStart = lastAsanaWeekStart || stats.weekStartDate || stats.week_start_date;
  if (stats && weekStart) {
    getAsanaTasksDetailsByWeekStart(weekStart).then(tasks => {
      cachedTasksDetails = tasks;
      if (tasksDetailsExpanded) {
        renderTasksDetailsFromCache();
      }
    }).catch(error => {
      console.error('[[TasksTab Details Error]] Ошибка загрузки детальных данных:', error);
    });
  }
  
  // Если секция была развернута, восстанавливаем данные
  if (tasksDetailsExpanded) {
    const detailsContainer = $('#tasksDetailsContainer');
    if (detailsContainer) {
      detailsContainer.classList.add('expanded');
    }
    // Восстанавливаем данные из кеша или показываем загрузку
    if (cachedTasksDetails) {
      renderTasksDetailsFromCache();
    } else {
      const detailsList = $('#tasksDetailsList');
      if (detailsList) {
        detailsList.innerHTML = '<p class="tasks-details-loading">Загрузка данных...</p>';
      }
    }
  }
  
  // Обработчик кнопки обновления
  const refreshBtn = $('#refreshStats');
  
  if (refreshBtn) {
    refreshBtn.addEventListener('click', async () => {
      refreshBtn.disabled = true;
      refreshBtn.textContent = 'Обновление...';
      
      try {
        // Используем функцию getAsanaStats для получения данных (избегаем дублирования кода)
        const stats = await getAsanaStats();
        
        if (!stats) {
          throw new Error('Не удалось получить статистику Asana');
        }
          
          // Обновляем карточки нормализованными данными
        updateTasksCards(stats);
        
        // Сохраняем weekStartDate для использования в деталях задач (уже сохранено в getAsanaStats)
        // lastAsanaWeekStart уже обновлён в getAsanaStats
          
          // Загружаем свежие детальные данные
        if (stats.weekStartDate) {
          getAsanaTasksDetailsByWeekStart(stats.weekStartDate).then(tasks => {
              cachedTasksDetails = tasks;
              if (tasksDetailsExpanded) {
                renderTasksDetailsFromCache();
              }
            }).catch(error => {
              console.error('[[TasksTab Details Error]] Ошибка загрузки детальных данных:', error);
            });
          }
          
          // Если секция подробностей развернута, показываем загрузку
          if (tasksDetailsExpanded) {
            const detailsList = $('#tasksDetailsList');
            if (detailsList) {
              detailsList.innerHTML = '<p class="tasks-details-loading">Загрузка данных...</p>';
            }
          }
          
          alert('Данные успешно обновлены!');
        
        refreshBtn.textContent = 'Обновить данные';
        refreshBtn.disabled = false;
      } catch (error) {
        console.error('Ошибка обновления данных:', error);
        alert('Ошибка обновления данных: ' + (error.message || 'Неизвестная ошибка'));
        refreshBtn.disabled = false;
        refreshBtn.textContent = 'Обновить данные';
      }
    });
  } else {
    console.error('Кнопка refreshStats не найдена!');
  }
  
  // Обработчик кнопки "Показать подробности"
  const showDetailsBtn = $('#showDetails');
  const detailsContainer = $('#tasksDetailsContainer');
  
  if (showDetailsBtn && detailsContainer) {
    // Восстанавливаем текст кнопки
    if (tasksDetailsExpanded) {
      showDetailsBtn.textContent = 'Скрыть подробности';
    } else {
      showDetailsBtn.textContent = 'Показать подробности';
    }
    
    showDetailsBtn.addEventListener('click', async () => {
      tasksDetailsExpanded = !tasksDetailsExpanded;
      
      if (tasksDetailsExpanded) {
        // Если данные уже в кеше, показываем их сразу
        if (cachedTasksDetails && cachedTasksDetails.length > 0) {
          renderTasksDetailsFromCache();
        } else {
          // Если данных нет, показываем загрузку и загружаем
          const detailsList = $('#tasksDetailsList');
          if (detailsList) {
            detailsList.innerHTML = '<p class="tasks-details-loading">Загрузка данных...</p>';
          }
          
          // Загружаем данные, используя lastAsanaWeekStart
          if (!lastAsanaWeekStart) {
            console.warn('[TasksTab Details Warning] Невозможно загрузить детали задач: weekStartDate не задан. Сначала обнови статистику Asana.');
            const detailsList = $('#tasksDetailsList');
            if (detailsList) {
              detailsList.innerHTML = '<p class="tasks-details-empty">Необходимо сначала обновить статистику Asana</p>';
            }
            return;
          }
          
          const tasks = await getAsanaTasksDetailsByWeekStart(lastAsanaWeekStart);
            cachedTasksDetails = tasks;
            renderTasksDetailsFromCache();
        }
        
        // Раскрываем с анимацией
        detailsContainer.classList.add('expanded');
        showDetailsBtn.textContent = 'Скрыть подробности';
      } else {
        // Скрываем с анимацией
        detailsContainer.classList.remove('expanded');
        showDetailsBtn.textContent = 'Показать подробности';
      }
    });
  }
  
  // Обработчики событий для фильтров
  setupTasksDetailsFilters();
  
  // Синхронизируем UI фильтров с начальным состоянием
  syncTasksDetailsFiltersUiFromState();
  
  // Обновляем визуальное состояние операционных карточек
  updateOperationalCardsVisualState();
  
  // Обработчики кликов по операционным карточкам
  setupTasksOperationalKpiInteractions();
}

/**
 * Настраивает обработчики кликов по верхним операционным карточкам
 * Связывает клики по карточкам с фильтрами блока «Показать подробности»
 */
function setupTasksOperationalKpiInteractions() {
  const onHandCard = $('#kpiOnHandCard');
  const warehouseCard = $('#kpiWarehouseCard');
  const shotNotProcessedCard = $('#kpiShotNotProcessedCard');
  
  if (onHandCard) {
    onHandCard.style.cursor = 'pointer';
    onHandCard.addEventListener('click', () => {
      setTasksDetailsStatusFilter('on_hand');
      expandTasksDetailsSectionIfCollapsed();
    });
  }
  
  if (warehouseCard) {
    warehouseCard.style.cursor = 'pointer';
    warehouseCard.addEventListener('click', () => {
      setTasksDetailsStatusFilter('warehouse');
      expandTasksDetailsSectionIfCollapsed();
    });
  }
  
  if (shotNotProcessedCard) {
    shotNotProcessedCard.style.cursor = 'pointer';
    shotNotProcessedCard.addEventListener('click', () => {
      // Карточка "Сфоткано, но не обработано (накопительный долг)" использует отдельный фильтр
      // для накопительного долга (задачи с due_on НЕ в текущей неделе)
      setTasksDetailsStatusFilter('accumulatedShotNotProcessed');
      expandTasksDetailsSectionIfCollapsed();
    });
  }
}

/**
 * Синхронизирует UI фильтров с состоянием tasksDetailsFilterState
 * Обновляет кнопки режима, селекты и чекбоксы в соответствии с текущим состоянием
 */
function syncTasksDetailsFiltersUiFromState() {
  // Синхронизация кнопок режима
  const modeButtons = document.querySelectorAll('.tasks-filter-mode-btn');
  modeButtons.forEach(btn => {
    const mode = btn.dataset.mode;
    const isActive = mode === tasksDetailsFilterState.mode;
    btn.classList.toggle('tasks-filter-mode-btn--active', isActive);
    // Стили управляются через CSS-класс .tasks-filter-mode-btn--active
  });
  
  // Синхронизация селекта типа
  const typeSelect = document.getElementById('tasksFilterType');
  if (typeSelect) {
    typeSelect.value = tasksDetailsFilterState.type;
  }
  
  // Синхронизация селекта приоритета
  const prioritySelect = document.getElementById('tasksFilterPriority');
  if (prioritySelect) {
    prioritySelect.value = tasksDetailsFilterState.priority;
  }
  
  // Синхронизация чекбокса "Показать выполненные"
  const showCompletedCheckbox = document.getElementById('tasksFilterShowCompleted');
  if (showCompletedCheckbox) {
    showCompletedCheckbox.checked = tasksDetailsFilterState.showCompleted;
  }
  
  // Синхронизация чекбокса "Только ошибки Q"
  const onlyQErrorsCheckbox = document.getElementById('tasksFilterOnlyQErrors');
  if (onlyQErrorsCheckbox) {
    onlyQErrorsCheckbox.checked = tasksDetailsFilterState.onlyQErrors;
  }
}

/**
 * Обновляет визуальное состояние операционных карточек в зависимости от активного статуса
 * Поддерживает как операционные карточки (on_hand, warehouse), так и накопительный долг (accumulatedShotNotProcessed)
 */
function updateOperationalCardsVisualState() {
  const onHandCard = $('#kpiOnHandCard');
  const warehouseCard = $('#kpiWarehouseCard');
  const shotNotProcessedCard = $('#kpiShotNotProcessedCard');
  
  const activeStatus = tasksDetailsFilterState.status;
  
  // Убираем класс активного состояния со всех карточек
  [onHandCard, warehouseCard, shotNotProcessedCard].forEach(card => {
    if (card) {
      card.classList.remove('kpi-card--active');
    }
  });
  
  // Добавляем класс активного состояния нужной карточке
  if (activeStatus === 'on_hand' && onHandCard) {
    onHandCard.classList.add('kpi-card--active');
  } else if (activeStatus === 'warehouse' && warehouseCard) {
    warehouseCard.classList.add('kpi-card--active');
  } else if (activeStatus === 'shot_not_processed' && shotNotProcessedCard) {
    // Старый статус для обратной совместимости (если где-то используется)
    shotNotProcessedCard.classList.add('kpi-card--active');
  } else if (activeStatus === 'accumulatedShotNotProcessed' && shotNotProcessedCard) {
    // Накопительный долг: карточка "Сфоткано, но не обработано (накопительный долг)"
    shotNotProcessedCard.classList.add('kpi-card--active');
  }
}

/**
 * Устанавливает фильтр по операционному статусу из кликов по верхним операционным карточкам
 * Связывает верхние операционные карточки с режимом «Показать подробности»
 * @param {string} nextStatus - статус для фильтрации: 'on_hand' | 'warehouse' | 'shot_not_processed' | 'accumulatedShotNotProcessed' | 'all'
 */
function setTasksDetailsStatusFilter(nextStatus) {
  // Для накопительного долга используем режим 'all', так как это не операционный показатель текущей недели
  // Для остальных карточек используем режим 'operational'
  if (nextStatus === 'accumulatedShotNotProcessed') {
    tasksDetailsFilterState.mode = 'all';
  } else {
    tasksDetailsFilterState.mode = 'operational';
  }
  tasksDetailsFilterState.status = nextStatus;
  
  // При клике по карточке сбрасываем тип/приоритет в 'all', чтобы не было неожиданных комбинаций
  tasksDetailsFilterState.type = 'all';
  tasksDetailsFilterState.priority = 'all';
  
  // По умолчанию завершённые задачи при операционном фокусе скрываем
  tasksDetailsFilterState.showCompleted = false;
  
  // Обновляем визуальное состояние карточек
  updateOperationalCardsVisualState();
  
  // Синхронизируем UI фильтров с новым состоянием
  syncTasksDetailsFiltersUiFromState();
  
  // После изменения состояния перерисовываем подробности
  renderTasksDetailsFromCache();
}

/**
 * Раскрывает секцию «Показать подробности», если она свернута
 */
function expandTasksDetailsSectionIfCollapsed() {
  const detailsContainer = $('#tasksDetailsContainer');
  const showDetailsBtn = $('#showDetails');
  
  if (!detailsContainer || !showDetailsBtn) return;
  
  // Проверяем, свернута ли секция (нет класса 'expanded')
  if (!detailsContainer.classList.contains('expanded')) {
    // Раскрываем секцию
    tasksDetailsExpanded = true;
    detailsContainer.classList.add('expanded');
    showDetailsBtn.textContent = 'Скрыть подробности';
    
    // Если данных нет в кеше, загружаем их
    if (!cachedTasksDetails || cachedTasksDetails.length === 0) {
      const weekStart = lastAsanaWeekStart;
      if (weekStart) {
        getAsanaTasksDetailsByWeekStart(weekStart).then(tasks => {
          cachedTasksDetails = tasks;
          renderTasksDetailsFromCache();
        }).catch(error => {
          console.error('[[TasksTab Details Error]] Ошибка загрузки детальных данных:', error);
        });
      }
    }
  }
}

/**
 * Настраивает обработчики событий для панели фильтров задач
 */
function setupTasksDetailsFilters() {
  // Обработчики кнопок режима (Только операционные / Все задачи)
  const modeButtons = document.querySelectorAll('.tasks-filter-mode-btn');
  modeButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const mode = e.target.dataset.mode;
      tasksDetailsFilterState.mode = mode;
      
      // Если переключаемся на 'all', сбрасываем фильтр по статусу
      if (mode === 'all') {
        tasksDetailsFilterState.status = 'all';
      }
      
      // Обновляем визуальное состояние карточек
      updateOperationalCardsVisualState();
      
      // Синхронизируем UI
      syncTasksDetailsFiltersUiFromState();
      
      renderTasksDetailsFromCache();
    });
  });
  
  // Обработчик селекта типа товара
  const typeSelect = document.getElementById('tasksFilterType');
  if (typeSelect) {
    typeSelect.addEventListener('change', (e) => {
      tasksDetailsFilterState.type = e.target.value;
      // При ручном изменении типа сбрасываем фильтр по статусу
      if (e.target.value !== 'all') {
        tasksDetailsFilterState.status = 'all';
      }
      updateOperationalCardsVisualState();
      syncTasksDetailsFiltersUiFromState();
      renderTasksDetailsFromCache();
    });
  }
  
  // Обработчик селекта приоритета
  const prioritySelect = document.getElementById('tasksFilterPriority');
  if (prioritySelect) {
    prioritySelect.addEventListener('change', (e) => {
      tasksDetailsFilterState.priority = e.target.value;
      // При ручном изменении приоритета сбрасываем фильтр по статусу
      if (e.target.value !== 'all') {
        tasksDetailsFilterState.status = 'all';
      }
      updateOperationalCardsVisualState();
      syncTasksDetailsFiltersUiFromState();
      renderTasksDetailsFromCache();
    });
  }
  
  // Обработчик чекбокса "Показать выполненные задачи недели"
  const showCompletedCheckbox = document.getElementById('tasksFilterShowCompleted');
  if (showCompletedCheckbox) {
    showCompletedCheckbox.addEventListener('change', (e) => {
      tasksDetailsFilterState.showCompleted = e.target.checked;
      updateOperationalCardsVisualState();
      syncTasksDetailsFiltersUiFromState();
      renderTasksDetailsFromCache();
    });
  }
  
  // Обработчик чекбокса "Показать только задачи с ошибкой Q"
  const onlyQErrorsCheckbox = document.getElementById('tasksFilterOnlyQErrors');
  if (onlyQErrorsCheckbox) {
    onlyQErrorsCheckbox.addEventListener('change', (e) => {
      tasksDetailsFilterState.onlyQErrors = e.target.checked;
      updateOperationalCardsVisualState();
      syncTasksDetailsFiltersUiFromState();
      renderTasksDetailsFromCache();
    });
  }
}

/**
 * Вычисляет операционный статус задачи на основе её полей
 * Подготовка для фильтров и группировки: "Только операционные", статусы "Уже на руках", "Со склада", "Сфоткано, но не обработано"
 * 
 * @param {Object} task - объект задачи из asana_tasks
 * @returns {string} - один из статусов: 'on_hand', 'warehouse', 'shot_not_processed', 'completed', 'other'
 */
function computeOperationalStatus(task) {
  const completed = !!task.completed;
  const shotAt = task.shot_at;
  const processedAt = task.processed_at;
  const source = task.product_source;

  // "Уже на руках": товар принесли, но ещё не сфоткали
  if (!completed && source === 'PRINESLI' && !shotAt) {
    return 'on_hand';
  }

  // "Нужно взять со склада": товар нужно взять со склада, работа не начата
  if (!completed && source === 'WAREHOUSE' && !shotAt && !processedAt) {
    return 'warehouse';
  }

  // "Сфоткано, но не обработано": уже есть снимки, но нет обработки, задача не завершена
  // Примечание: это общий статус для задач с shot_at и без processed_at.
  // Для разделения на операционный показатель и накопительный долг используется фильтр
  // 'accumulatedShotNotProcessed' в applyTasksDetailsFilters() на основе due_on.
  if (!completed && !!shotAt && !processedAt) {
    return 'shot_not_processed';
  }

  // "Сделано": задача завершена
  if (completed) {
    return 'completed';
  }

  // Всё остальное
  return 'other';
}

// Функция для получения детальных данных о задачах по неделе
// Новая модель: фильтрация по week_shot и week_processed (фактические даты), а не по week_start_date (плановая дата)
async function getAsanaTasksDetailsByWeekStart(weekStartStr) {
  try {
    if (!supabaseClient) {
      console.error('[[TasksTab Details Error]] Supabase клиент не инициализирован');
      return [];
    }
    
    if (!weekStartStr || typeof weekStartStr !== 'string') {
      console.error('[[TasksTab Details Error]] weekStartStr должен быть строкой в формате YYYY-MM-DD, получено:', weekStartStr);
      return [];
    }
    
    console.log('[TasksTab Details Debug] getAsanaTasksDetailsByWeekStart called with weekStartDate =', weekStartStr);

    const { data: rows, error } = await supabaseClient
      .from('asana_tasks')
      .select('task_name, q, product_source, shot_at, processed_at, completed_at, due_on, week_start_date, completed, project_gid, assignee_gid, task_type_label, task_type_gid, priority_label, priority_gid')
      .or(`week_shot.eq.${weekStartStr},week_processed.eq.${weekStartStr},week_start_date.eq.${weekStartStr}`)
      .order('processed_at', { ascending: false })
      .order('shot_at', { ascending: false })
      .order('due_on', { ascending: true });
    
    if (error && error.code !== 'PGRST116') {
      console.error('[[TasksTab Details Error]] Ошибка получения деталей задач:', error);
      throw error;
    }
    
    const safeRows = rows || [];
    const distinctProjects = Array.from(new Set(safeRows.map(r => r.project_gid).filter(Boolean)));
    const distinctAssignees = Array.from(new Set(safeRows.map(r => r.assignee_gid).filter(Boolean)));

    // Вычисляем hasQError и operationalStatus для каждой строки
    // Подготовка для фильтров и группировки: тип задачи, приоритет и операционный статус
    const rowsWithErrors = safeRows.map((row) => ({
      ...row,
      hasQError: row.q == null || Number(row.q) <= 0,
      operationalStatus: computeOperationalStatus(row),
    }));
    
    const qErrorsCount = rowsWithErrors.filter(row => row.hasQError).length;

    console.log('[[TasksTab Details Debug]] Загружено строк:', safeRows.length, {
      weekStartDate: weekStartStr,
      distinct_project_gids: distinctProjects,
      distinct_assignee_gids: distinctAssignees,
      qErrorsCount: qErrorsCount
    });

    if (safeRows.length === 0) {
      console.warn('[[TasksTab Details Debug]] Нет задач для недели', weekStartStr);
    }

    return rowsWithErrors;
  } catch (error) {
    console.error('[[TasksTab Details Error]] Ошибка в getAsanaTasksDetailsByWeekStart:', error);
    return [];
  }
}

// Функция для получения детальных данных о задачах из asana_tasks (старая версия для обратной совместимости)
async function getAsanaTasksDetails() {
  try {
    if (!supabaseClient) {
      console.error('Supabase клиент не инициализирован');
      return [];
    }
    
    // Используем lastAsanaWeekStart, если он есть, иначе fallback на кеш или текущую неделю
    let weekStartStr = lastAsanaWeekStart;
    
    if (!weekStartStr && cachedTasksStats) {
      weekStartStr = cachedTasksStats.weekStartDate || cachedTasksStats.week_start_date;
    }
    
    if (!weekStartStr) {
      // Если кеша нет, рассчитываем начало недели
      const now = new Date();
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(now.getFullYear(), now.getMonth(), diff);
      monday.setHours(0, 0, 0, 0);
      weekStartStr = monday.toISOString().split('T')[0];
    }
    
    return await getAsanaTasksDetailsByWeekStart(weekStartStr);
  } catch (error) {
    console.error('Ошибка в getAsanaTasksDetails:', error);
    return [];
  }
}

// Функция для форматирования даты в формат день.месяц.год
function formatDate(dateString) {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  
  return `${day}.${month}.${year}`;
}

const ASANA_PROJECT_LABELS = {
  '1210258013776969': 'Timetrack',
};

// Функция для отображения детальных данных о задачах
async function renderTasksDetails() {
  const detailsList = $('#tasksDetailsList');
  if (!detailsList) return;
  
  // Показываем загрузку
              detailsList.innerHTML = '<p class="tasks-details-loading">Загрузка данных...</p>';
  
  try {
    const tasks = await getAsanaTasksDetails();
    
    // Сохраняем данные в кеш
    cachedTasksDetails = tasks;
    
    renderTasksDetailsFromCache();
  } catch (error) {
    console.error('Ошибка отображения деталей задач:', error);
    const detailsList = $('#tasksDetailsList');
    if (detailsList) {
      detailsList.innerHTML = '<p class="tasks-details-error">Ошибка загрузки данных</p>';
    }
  }
}

/**
 * Группирует задачи по операционному статусу
 * @param {Array} rows - массив задач (уже отфильтрованных)
 * @returns {Object} - объект с группами задач по статусам
 */
function groupTasksByOperationalStatus(rows) {
  const groups = {
    on_hand: [],
    warehouse: [],
    shot_not_processed: [],
    completed: [],
    other: [],
  };

  for (const task of rows) {
    const status = task.operationalStatus || 'other';
    if (status === 'on_hand') {
      groups.on_hand.push(task);
    } else if (status === 'warehouse') {
      groups.warehouse.push(task);
    } else if (status === 'shot_not_processed') {
      groups.shot_not_processed.push(task);
    } else if (status === 'completed') {
      groups.completed.push(task);
    } else {
      groups.other.push(task);
    }
  }

  return groups;
}

/**
 * Рендерит одну строку задачи в таблице
 * @param {Object} task - объект задачи
 * @param {number} index - индекс для чередования стилей
 * @returns {string} - HTML строка задачи
 */
function renderTasksDetailsRow(task, index) {
    const taskName = task.task_name || 'Без названия';
    const q = task.q || 0;
  const productSource = task.product_source === 'PRINESLI' ? 'Принесли' : (task.product_source === 'WAREHOUSE' ? 'Взять со склада' : (task.product_source || '—'));
    const dueOn = formatDate(task.due_on);
    const shotAt = formatDate(task.shot_at);
    const processedAt = formatDate(task.processed_at || task.completed_at);
    const isCompleted = task.completed === true;
  const hasErr = task.hasQError || (task.q == null || task.q <= 0);
    const qDisplay = hasErr ? '⚠ Q!' : q;
    const statusText = isCompleted ? 'Сделано' : 'Не сделано';
    const statusValueClass = isCompleted
      ? 'task-field-value task-row-value task-row-value--status-done'
      : 'task-field-value task-row-value task-row-value--status-pending';
    
    const rowClasses = ['task-row'];
    if (index % 2 !== 0) {
      rowClasses.push('task-row--alt');
    }
    if (hasErr) {
      rowClasses.push('task-row--error');
    }
    rowClasses.push('task-card');
    const rowClassName = rowClasses.join(' ');
    
  return `
      <tr class="${rowClassName} ${hasErr ? 'q-error' : ''}">
        <td class="task-row-cell task-row-cell--number" data-label="№">
          ${index + 1}
        </td>
        <td class="task-row-cell task-row-cell--name" data-label="Задача">
          <div class="task-field">
            <span class="task-field-label">Задача</span>
            <span class="task-field-value task-row-value">
              ${taskName}${hasErr ? ' <span class="task-row-value task-row-value--error">⚠</span>' : ''}
            </span>
          </div>
          <div class="task-row-meta meta-field">
            project: ${task.project_gid || '—'} • assignee: ${task.assignee_gid || '—'}
          </div>
        </td>
        <td class="task-row-cell" data-label="Q">
          <div class="task-field">
            <span class="task-field-label">Q</span>
            <span class="task-field-value task-row-value ${hasErr ? 'task-row-value--error' : ''}">${qDisplay ?? '—'}</span>
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
            <span class="${statusValueClass}">${statusText}</span>
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
    `;
}

/**
 * Вычисляет начало и конец текущей недели (понедельник-воскресенье)
 * Используется для фильтрации накопительного долга (due_on НЕ в текущей неделе)
 * @returns {Object} - { weekStart: Date, weekEnd: Date }
 */
function getCurrentWeekBounds() {
  const today = new Date();
  // Получаем понедельник текущей недели
  const dayOfWeek = today.getDay(); // 0 = воскресенье, 1 = понедельник, ...
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Если воскресенье, откатываемся на 6 дней назад
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() + diff);
  weekStart.setHours(0, 0, 0, 0);
  
  // Воскресенье текущей недели
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  
  return { weekStart, weekEnd };
}

/**
 * Проверяет, попадает ли дата в текущую неделю
 * @param {string|null} dateStr - дата в формате 'YYYY-MM-DD' или null
 * @returns {boolean} - true, если дата в текущей неделе; false, если дата вне недели или null
 * Примечание: null считается как "не в текущей неделе" (для накопительного долга)
 */
function isDateInCurrentWeek(dateStr) {
  if (!dateStr) return false; // null или пустая строка = не в текущей неделе
  const { weekStart, weekEnd } = getCurrentWeekBounds();
  const date = new Date(dateStr);
  date.setHours(0, 0, 0, 0);
  return date >= weekStart && date <= weekEnd;
}

/**
 * Применяет фильтры к списку задач на основе состояния tasksDetailsFilterState
 * @param {Array} rawRows - массив задач из кеша
 * @returns {Array} - отфильтрованный массив задач
 */
function applyTasksDetailsFilters(rawRows) {
  const { mode, type, priority, showCompleted, onlyQErrors, status } = tasksDetailsFilterState;
  
  return rawRows.filter(task => {
    // 1) Фильтр по режиму: 'Только операционные' / 'Все задачи'
    if (mode === 'operational') {
      const op = task.operationalStatus;
      const isOperational = op === 'on_hand' || op === 'warehouse' || op === 'shot_not_processed';
      if (!isOperational) {
        return false;
      }
    }

    // 2) Фильтр по типу товара
    if (type !== 'all') {
      if (!task.task_type_label || task.task_type_label !== type) {
        return false;
      }
    }

    // 3) Фильтр по приоритету
    if (priority !== 'all') {
      if (!task.priority_label || task.priority_label !== priority) {
        return false;
      }
    }

    // 4) Фильтр по выполненности ("Показать выполненные задачи недели")
    if (!showCompleted) {
      // по умолчанию скрываем завершённые задачи
      if (task.completed) {
        return false;
      }
    }

    // 5) Фильтр по ошибкам Q
    if (onlyQErrors) {
      if (!task.hasQError) {
        return false;
      }
    }

    // 6) Фильтр по операционному статусу (для кликов по верхним карточкам)
    if (status !== 'all') {
      if (status === 'accumulatedShotNotProcessed') {
        // Фильтр для накопительного долга "Сфоткано, но не обработано (накопительный долг)"
        // Условия из docs/tasks-backend-new-kpi-spec.md:
        // 1) shot_at IS NOT NULL
        // 2) processed_at IS NULL
        // 3) completed != true
        // 4) q > 0
        // 5) due_on НЕ в текущей неделе (или due_on IS NULL)
        const hasShotAt = !!task.shot_at;
        const hasNoProcessedAt = !task.processed_at;
        const isNotCompleted = !task.completed;
        const hasValidQ = task.q != null && task.q > 0;
        const dueOnNotInCurrentWeek = !isDateInCurrentWeek(task.due_on);
        
        if (!(hasShotAt && hasNoProcessedAt && isNotCompleted && hasValidQ && dueOnNotInCurrentWeek)) {
          return false;
        }
      } else {
        // Обычный фильтр по операционному статусу
        const op = task.operationalStatus;
        if (op !== status) {
          return false;
        }
      }
    }

    return true;
  });
}

// Функция для отображения данных из кеша
function renderTasksDetailsFromCache() {
  const detailsList = $('#tasksDetailsList');
  if (!detailsList) return;
  
  if (!cachedTasksDetails || cachedTasksDetails.length === 0) {
    detailsList.innerHTML = '<p class="tasks-details-empty">Нет данных для отображения</p>';
    return;
  }
  
  // Функция для определения ошибки Q: q == null или q <= 0
  function hasQError(task) {
    if (typeof task.hasQError === 'boolean') {
      return task.hasQError;
    }
    // Ошибка Q: q отсутствует или <= 0
    return task.q == null || task.q <= 0;
  }
  
  // Функция для форматирования источника товара
  function formatProductSource(source) {
    if (source === 'PRINESLI') return 'Принесли';
    if (source === 'WAREHOUSE') return 'Взять со склада';
    return source || '—';
  }
  
  // Подсчёт ошибок Q в исходных данных (до фильтрации)
  const qErrorsCount = cachedTasksDetails.filter(task => hasQError(task)).length;
  
  // Применяем все фильтры из tasksDetailsFilterState
  const filteredRows = applyTasksDetailsFilters(cachedTasksDetails);

  console.debug('[[TasksTab Details Debug]] Фильтрация деталей', {
    totalRows: cachedTasksDetails.length,
    qErrorsCount: qErrorsCount,
    filteredRows: filteredRows.length,
    filterState: tasksDetailsFilterState
  });

  // Заголовок с информацией о количестве задач и ошибках Q
  let headerHTML = '';
  
  // Счетчик задач: показываем количество отфильтрованных задач
  const totalTasksCount = cachedTasksDetails.length;
  const filteredTasksCount = filteredRows.length;
  
  // Определяем, активны ли фильтры (кроме режима 'operational' по умолчанию)
  const hasActiveFilters = tasksDetailsFilterState.status !== 'all' || 
                          tasksDetailsFilterState.type !== 'all' || 
                          tasksDetailsFilterState.priority !== 'all' || 
                          tasksDetailsFilterState.showCompleted || 
                          tasksDetailsFilterState.onlyQErrors;
  
  if (hasActiveFilters && filteredTasksCount !== totalTasksCount) {
    headerHTML += `<p class="tasks-details-counter">Показано задач: <strong>${filteredTasksCount}</strong> из <strong>${totalTasksCount}</strong></p>`;
  } else {
    headerHTML += `<p class="tasks-details-counter">Всего задач: <strong>${filteredTasksCount}</strong></p>`;
  }
  
  if (qErrorsCount > 0) {
    headerHTML += `<p class="tasks-details-q-errors">Задач с ошибкой Q: <strong>${qErrorsCount}</strong></p>`;
  }

  // Группируем отфильтрованные задачи по операционному статусу
  const groups = groupTasksByOperationalStatus(filteredRows);
  
  // Контролы фильтрации (убраны, так как теперь фильтры в отдельной панели выше)
  // data-label и @media (max-width: 768px) используются для превращения таблицы в мобильные карточки задач
  // Адаптация не трогает десктоп-версию
  let tableHTML = headerHTML + `
    <table class="tasks-details-table">
      <thead>
        <tr>
          <th style="width: 40px;">№</th>
          <th>Задача</th>
          <th>Q</th>
          <th>Товар</th>
          <th>Статус</th>
          <th>Сфоткал</th>
          <th>Обработал</th>
          <th>Дедлайн</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  // Функция для добавления группы задач с заголовком
  let rowIndex = 0;
  function appendGroup(label, rows) {
    if (!rows || rows.length === 0) return;
    
    // Добавляем заголовок группы с количеством задач в группе
    tableHTML += `<tr class="tasks-details-group-row"><td colspan="8">${label} <span class="tasks-details-group-count">(${rows.length})</span></td></tr>`;
    
    // Добавляем строки задач этой группы
    for (const task of rows) {
      tableHTML += renderTasksDetailsRow(task, rowIndex);
      rowIndex++;
    }
  }
  
  // Добавляем группы в фиксированном порядке
  appendGroup('Уже на руках', groups.on_hand);
  appendGroup('Нужно взять со склада', groups.warehouse);
  appendGroup('Сфоткано, но не обработано', groups.shot_not_processed);
  appendGroup('Выполненные задачи недели', groups.completed);
  appendGroup('Прочие задачи', groups.other);
  
  tableHTML += `
      </tbody>
    </table>
  `;

  if (filteredRows.length === 0) {
    tableHTML += '<p class="tasks-details-empty">Нет задач, удовлетворяющих выбранным фильтрам.</p>';
  }
  
  detailsList.innerHTML = tableHTML;
  
  // Примечание: фильтр по проекту убран, так как Edge Function уже фильтрует по проекту "Arbuz Контент. Задачи"
  // Все задачи в таблице относятся к одному проекту, поэтому дополнительный выбор проекта не нужен
}

async function renderBoss(){
  console.log('renderBoss() вызван');
  const app = $('#app');
  const now = new Date();
  let year = now.getFullYear(), monthIdx = now.getMonth(); // 0-based
  let viewMode = 'calendar'; // 'calendar' или 'list'
  
  app.innerHTML = `
    <h1>Экран начальника</h1>
    <div class="row" style="margin-bottom: 16px;">
      <div style="flex: 1;"></div>
      <button id="shootingsToggle" class="btn" style="width: auto; padding: 8px 16px; margin-right: 8px;">
        <span id="shootingsToggleText">Показать съёмки</span>
      </button>
      <button id="viewToggle" class="btn" style="width: auto; padding: 8px 16px;">
        <span id="viewToggleText">Показать списком</span>
      </button>
    </div>
    <div id="shootingsContainer" class="shootings-container" style="margin-bottom: 16px;">
      <div class="day-card-static" id="shootingsList"></div>
    </div>
    <div class="row">
      <button id="prevM" class="btn">←</button>
      <div style="flex:1; text-align:center; padding:12px 0" id="ym"></div>
      <button id="nextM" class="btn">→</button>
    </div>
    <div id="bossContent"></div>
  `;
  
  // Переключатель режима отображения
  $('#viewToggle').onclick = async () => {
    const content = $('#bossContent');
    
    // Плавное скрытие текущего контента
    content.classList.add('fade-out');
    
    // Ждем завершения анимации скрытия
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Меняем режим
    viewMode = viewMode === 'calendar' ? 'list' : 'calendar';
    $('#viewToggleText').textContent = viewMode === 'calendar' ? 'Показать списком' : 'Показать календарем';
    
    // Рендерим новый контент
    await renderContent();
    
    // Плавное появление нового контента
    content.classList.remove('fade-out');
    content.classList.add('fade-in');
    
    // Убираем класс fade-in после завершения анимации
    setTimeout(() => {
      content.classList.remove('fade-in');
    }, 300);
  };
  
  // Переключатель отображения съёмок
  let shootingsExpanded = false;
  $('#shootingsToggle').onclick = async () => {
    shootingsExpanded = !shootingsExpanded;
    const container = $('#shootingsContainer');
    const toggleText = $('#shootingsToggleText');
    
    if (shootingsExpanded) {
      // Загружаем данные перед раскрытием
      await renderShootings();
      
      // Раскрываем с анимацией
      container.classList.add('expanded');
      toggleText.textContent = 'Скрыть съёмки';
    } else {
      // Скрываем с анимацией
      container.classList.remove('expanded');
      toggleText.textContent = 'Показать съёмки';
    }
  };
  
  // Функция отображения списка съёмок
  async function renderShootings() {
    const shootingsList = $('#shootingsList');
    if (!shootingsList) return;
    
    try {
      const shootings = await getUpcomingShootings();
      
      if (shootings.length === 0) {
        shootingsList.innerHTML = `
          <div class="day-header">Предстоящие съёмки</div>
          <div class="day-content muted">Нет предстоящих съёмок</div>
        `;
        return;
      }
      
      let html = '<div class="day-header">Предстоящие съёмки</div>';
      
      shootings.forEach(shooting => {
        const converted = convertShootingTime(shooting.start_time, shooting.end_time);
        const dateFormatted = formatDate(shooting.date);
        const title = shooting.title || 'Съёмка';
        
        html += `
          <div style="margin: 12px 0; padding: 12px; border: 1px solid var(--border-default); border-radius: 8px; background: var(--bg-surface);">
            <div style="font-weight: 600; margin-bottom: 8px; color: var(--text-primary);">${dateFormatted}</div>
            <div style="color: var(--text-secondary); font-size: 14px; margin-bottom: 4px;">${title}</div>
            <div style="color: var(--text-primary); font-size: 15px; font-weight: 500;">${converted.display}</div>
          </div>
        `;
      });
      
      shootingsList.innerHTML = html;
    } catch (error) {
      console.error('Ошибка загрузки съёмок:', error);
      shootingsList.innerHTML = `
        <div class="day-header">Предстоящие съёмки</div>
        <div class="day-content muted">Ошибка загрузки съёмок</div>
      `;
    }
  }
  
  async function renderContent() {
    const content = $('#bossContent');
    if (viewMode === 'calendar') {
      await drawCalendar();
    } else {
      await drawMonthList();
    }
  }
  
  async function drawCalendar(){
    const content = $('#bossContent');
    content.innerHTML = '<div class="calendar" id="cal"></div>';
    
    const d = new Date(year, monthIdx, 1);
    year = d.getFullYear(); monthIdx = d.getMonth();
    const ym = `${year}-${pad(monthIdx+1)}`;
    $('#ym').textContent = `${toRusMonth(monthIdx)} ${year}`;

    const data = await getAllRecords();
    const map = {}; 
    Object.keys(data).forEach(date => {
      if (date.startsWith(ym)) {
        map[date] = data[date];
      }
    });

    // Загружаем съёмки для текущего месяца
    const shootings = await getUpcomingShootings();
    const shootingsMap = {};
    shootings.forEach(shooting => {
      if (shooting.date.startsWith(ym)) {
        shootingsMap[shooting.date] = shooting;
      }
    });

    const firstWeekday = (new Date(year, monthIdx, 1).getDay() + 6) % 7; // 0-пн
    const daysInMonth = new Date(year, monthIdx+1, 0).getDate();
    const cells = [];
    for (let i=0;i<firstWeekday;i++) cells.push('');
    for (let d=1; d<=daysInMonth; d++) cells.push(String(d));

    const cal = $('#cal');
    cal.innerHTML = '';
    cells.forEach(c=>{
      const div = document.createElement('div');
      div.className = 'cell';
      if (c) {
        const dateISO = `${year}-${pad(monthIdx+1)}-${pad(parseInt(c,10))}`;
        const rec = map[dateISO] || { date: dateISO };
        
        div.textContent = c;
        div.style.cursor = 'pointer';
        
        // Добавляем индикатор если есть данные
        if (rec.in_time || rec.out_time) {
          div.style.background = '#e8f5e9';
          div.style.fontWeight = 'bold';
        }
        
        // Добавляем точку если есть фото (левый нижний угол)
        if (rec.photo_url) {
          const photoIcon = document.createElement('div');
          photoIcon.className = 'cell-photo-icon';
          div.appendChild(photoIcon);
        }
        
        // Добавляем иконку фотоаппарата если есть съёмка (правый нижний угол)
        if (shootingsMap[dateISO]) {
          const shootingIcon = document.createElement('div');
          shootingIcon.className = 'cell-shooting-icon';
          shootingIcon.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          `;
          div.appendChild(shootingIcon);
        }
        
        // Сохраняем dateISO в data-атрибуте для надежности
        div.setAttribute('data-date', dateISO);
        
        // Используем onclick для более простой отладки
        div.onclick = async function(e) {
          e.preventDefault();
          e.stopPropagation();
          console.log('Клик по дню:', dateISO);
          
          try {
            // Получаем данные за эту дату
            const rec = await getRecord(dateISO);
            
            // Проверяем, есть ли данные (приход или уход)
            if (!rec.in_time && !rec.out_time) {
              // Нет данных - показываем сообщение
              openModal(dateISO, 'Нет данных за эту дату');
              return;
            }
            
            // Используем сохраненные данные без пересчета
            // Пересчет происходит только при сохранении данных в конкретном дне
            // Это предотвращает цепную реакцию пересчета всех дней
            const updatedRec = rec;
            const prev = await getPrevDayRecord(dateISO);
            
            // Для первой записи (когда нет предыдущей) остаток на начало строго 0
            let carryPrev = 0;
            if (prev && prev.date) {
              // Есть предыдущая запись - берем её carry_new_min
              // Проверяем, что это действительно число
              const prevCarry = prev.carry_new_min;
              if (typeof prevCarry === 'number' && !isNaN(prevCarry)) {
                carryPrev = prevCarry;
              } else {
                carryPrev = 0;
              }
            } else {
              // Нет предыдущей записи - остаток с прошлого дня строго = 0
              carryPrev = 0;
            }
            
            const rep = buildReport(updatedRec, mmToHhmm(carryPrev));
            console.log('Отчет:', rep);
            const dateFormatted = formatDate(dateISO);
            openReportModal(dateFormatted, rep, updatedRec.photo_url || null);
          } catch (error) {
            console.error('Ошибка при открытии отчета:', error);
            alert('Ошибка при открытии отчета: ' + error.message);
          }
        };
      } else {
        div.style.visibility='hidden';
      }
      cal.appendChild(div);
    });
  }
  

  async function drawMonthList(){
    const content = $('#bossContent');
    content.innerHTML = '<div class="week-view" id="monthListView"></div>';
    
    const d = new Date(year, monthIdx, 1);
    year = d.getFullYear(); monthIdx = d.getMonth();
    const ym = `${year}-${pad(monthIdx+1)}`;
    $('#ym').textContent = `${toRusMonth(monthIdx)} ${year}`;
    
    const monthView = $('#monthListView');
    
    // Проверяем кеш (кеш действителен 30 секунд)
    const cacheKey = ym;
    const now = Date.now();
    const cacheAge = 30000; // 30 секунд
    let data = null;
    
    if (monthDataCache[cacheKey] && monthDataCacheTime[cacheKey] && (now - monthDataCacheTime[cacheKey]) < cacheAge) {
      // Используем кеш
      data = monthDataCache[cacheKey];
      console.log('Используется кеш для месяца:', ym);
    } else {
      // Загружаем данные
      monthView.innerHTML = '<div class="muted">Загрузка...</div>';
      data = await getAllRecords();
      // Сохраняем в кеш
      monthDataCache[cacheKey] = data;
      monthDataCacheTime[cacheKey] = now;
      console.log('Данные загружены и сохранены в кеш для месяца:', ym);
    }
    
    // Получаем все дни месяца
    const daysInMonth = new Date(year, monthIdx+1, 0).getDate();
    const days = [];
    for (let d = 1; d <= daysInMonth; d++) {
      const dateISO = `${year}-${pad(monthIdx+1)}-${pad(d)}`;
      days.push({ date: dateISO, rec: data[dateISO] || { date: dateISO } });
    }
    
    // Очищаем контейнер и отображаем дни сразу
    monthView.innerHTML = '';
    
    // Используем сохраненные значения из базы данных, не пересчитываем автоматически
    // Это предотвращает цепную реакцию пересчета всех дней
    // ОПТИМИЗАЦИЯ: Используем уже загруженные данные вместо отдельных запросов к базе
    for (const {date, rec} of days) {
      const div = document.createElement('div');
      div.className = 'day-card-static'; // Статичный блок без hover и клика
      div.setAttribute('data-date', date); // Добавляем data-атрибут для поиска элемента
      
      const dateObj = new Date(date);
      const dayName = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'][dateObj.getDay()];
      
      // Используем сохраненные данные без пересчета
      // Пересчет происходит только при сохранении данных в конкретном дне
      const updatedRec = rec;
      
      // ОПТИМИЗАЦИЯ: Используем уже загруженные данные вместо запроса к базе
      const prev = findPrevRecordInData(date, data);
      
      // Для первой записи (когда нет предыдущей) остаток на начало строго 0
      let carryPrev = 0;
      if (prev && prev.date) {
        // Есть предыдущая запись - берем её carry_new_min
        // Проверяем, что это действительно число
        const prevCarry = prev.carry_new_min;
        if (typeof prevCarry === 'number' && !isNaN(prevCarry)) {
          // Проверяем, что это не timestamp (timestamp был бы очень большим числом)
          const MAX_REASONABLE_MINUTES = 100000;
          const MIN_REASONABLE_MINUTES = -100000;
          if (prevCarry > MAX_REASONABLE_MINUTES || prevCarry < MIN_REASONABLE_MINUTES) {
            console.warn('Обнаружено некорректное значение carry_new_min:', prevCarry, 'для даты:', prev.date);
            carryPrev = 0;
          } else {
            carryPrev = Math.round(prevCarry);
          }
        } else {
          carryPrev = 0;
        }
      } else {
        // Нет предыдущей записи - остаток с прошлого дня строго = 0
        carryPrev = 0;
      }
      
      // Используем ту же функцию buildReport, что и во всплывающем окне
      const report = buildReport(updatedRec, mmToHhmm(carryPrev));
      
      // Убираем класс "today" - не подсвечиваем сегодняшнюю дату
      let content = `<div class="day-header">${dayName} ${formatDate(date)}</div>`;
      
      if (updatedRec.in_time || updatedRec.out_time) {
        // Форматируем отчет для отображения (заменяем переносы строк на <br> и сохраняем форматирование)
        const formattedReport = report.split('\n').map(line => {
          if (line.trim() === '') return '<br>';
          // Экранируем HTML для безопасности
          const escapedLine = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          return `<div style="margin: 2px 0;">${escapedLine}</div>`;
        }).join('');
        content += `<div class="day-content" style="white-space: pre-wrap; font-family: monospace; font-size: 13px; line-height: 1.6; padding: 8px;">${formattedReport}</div>`;
        
        // Добавляем кнопку "Показать фото" если есть фото
        if (updatedRec.photo_url) {
          const photoId = `photo-${date.replace(/-/g, '')}`;
          const photoContainerId = `photo-container-${date.replace(/-/g, '')}`;
          const photoImgId = `photo-img-${date.replace(/-/g, '')}`;
          content += `
            <div style="margin-top: 12px;">
              <button class="photo-toggle-btn" id="${photoId}" style="width: 100%;">Показать фото</button>
              <div class="photo-container" id="${photoContainerId}" style="max-height: 0; overflow: hidden; transition: max-height 0.3s ease-out;">
                <img 
                  id="${photoImgId}"
                  class="photo-thumbnail" 
                  src="${updatedRec.photo_url}" 
                  alt="Фото сдачи ключей" 
                  loading="lazy"
                  style="max-width: 200px !important; max-height: 150px !important; width: auto !important; height: auto !important; border-radius: 8px; cursor: pointer; display: block; margin: 12px auto; border: 1px solid #ddd; transition: transform 0.2s; object-fit: contain !important; object-position: center; flex-shrink: 0;"
                >
              </div>
            </div>
          `;
        } else {
          // Плейсхолдер если фото нет
          const photoId = `photo-${date.replace(/-/g, '')}`;
          const photoContainerId = `photo-container-${date.replace(/-/g, '')}`;
          content += `
            <div style="margin-top: 12px;">
              <button class="photo-toggle-btn" id="${photoId}" style="width: 100%;">Показать фото</button>
              <div class="photo-container" id="${photoContainerId}" style="max-height: 0; overflow: hidden; transition: max-height 0.3s ease-out;">
                <div class="photo-placeholder" style="width: 200px; height: 150px; background: #f0f0f0; border: 2px dashed #ccc; border-radius: 8px; display: flex; align-items: center; justify-content: center; margin: 12px auto; color: #999;">
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="width: 48px; height: 48px;">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
              </div>
            </div>
          `;
        }
      } else {
        content += `<div class="day-content muted">Нет данных за эту дату</div>`;
      }
      
      div.innerHTML = content;
      
      // Добавляем обработчик для кнопки "Показать фото"
      const photoToggleBtn = div.querySelector(`#photo-${date.replace(/-/g, '')}`);
      const photoContainer = div.querySelector(`#photo-container-${date.replace(/-/g, '')}`);
      const photoImg = div.querySelector(`#photo-img-${date.replace(/-/g, '')}`);
      
      if (photoToggleBtn && photoContainer) {
        photoToggleBtn.onclick = () => {
          const isExpanded = photoContainer.classList.contains('expanded');
          if (isExpanded) {
            photoContainer.classList.remove('expanded');
            photoContainer.style.maxHeight = '0px';
            photoToggleBtn.textContent = 'Показать фото';
          } else {
            photoContainer.classList.add('expanded');
            photoContainer.style.maxHeight = '500px';
            photoToggleBtn.textContent = 'Скрыть фото';
          }
        };
      }
      
      // Добавляем обработчик клика по изображению для открытия lightbox
      if (photoImg && updatedRec.photo_url) {
        photoImg.onclick = () => {
          openLightbox(updatedRec.photo_url);
        };
      }
      
      // Убираем onclick - блок статичный, не кликабельный
      monthView.appendChild(div);
    }
  }

  function toRusMonth(i){
    return ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'][i];
  }

  // Обработчики для кнопок навигации
  $('#prevM').onclick = ()=>{ monthIdx--; renderContent(); };
  $('#nextM').onclick = ()=>{ monthIdx++; renderContent(); };
  
  // Первоначальная отрисовка
  renderContent();
}

/***** ROUTER *****/
// Проверка режима "только для начальника" через параметр URL
function isBossOnlyMode() {
  // Проверяем, что мы на странице boss.html
  const pathname = window.location.pathname;
  const href = window.location.href;
  
  // Проверяем путь к файлу разными способами
  const filename = pathname.split('/').pop(); // Получаем имя файла
  const hasBossHtml = filename === 'boss.html' || 
                      pathname.endsWith('/boss.html') || 
                      pathname.includes('boss.html') ||
                      href.includes('boss.html');
  
  if (hasBossHtml) {
    console.log('Режим начальника: обнаружен boss.html, pathname:', pathname, 'filename:', filename);
    return true;
  }
  
  // Проверяем параметр URL ?mode=boss или хеш #boss-only
  const urlParams = new URLSearchParams(window.location.search);
  const hash = window.location.hash;
  if (urlParams.get('mode') === 'boss' || hash === '#boss-only' || hash === '#/boss-only') {
    console.log('Режим начальника: обнаружен параметр mode=boss или хеш');
    return true;
  }
  
  return false;
}

function route(){
  // Проверяем режим "только для начальника"
  const bossMode = isBossOnlyMode();
  console.log('route() вызван, bossMode:', bossMode, 'pathname:', window.location.pathname);
  
  if (bossMode) {
    // Скрываем навигацию
    const header = document.querySelector('header');
    if (header) {
      header.style.display = 'none';
    }
    // Показываем только экран начальника (игнорируем хеш)
    currentDate = todayISO();
    console.log('Показываем экран начальника');
    renderBoss();
    return;
  }
  
  // Обычный режим - показываем навигацию
  const header = document.querySelector('header');
  if (header) {
    header.style.display = 'block';
  }
  
  const h = location.hash || '#/me';
  $('#tabMe').classList.toggle('active', h==='#/me');
  $('#tabBoss').classList.toggle('active', h==='#/boss');
  $('#tabTasks').classList.toggle('active', h==='#/tasks');
  currentDate = todayISO();
  if (h==='#/boss') {
    renderBoss();
  } else if (h==='#/tasks') {
    renderTasks();
  } else {
    renderMe();
  }
}
window.addEventListener('hashchange', () => {
  // В режиме boss-only игнорируем изменения хеша
  if (isBossOnlyMode()) {
    console.log('Игнорируем изменение хеша в режиме boss-only');
    return;
  }
  route();
});
window.addEventListener('load', route);

/***** MODAL *****/
function openModal(title, body){
  const modalTitle = $('#modalTitle');
  const modalBody = $('#modalBody');
  const modalBack = $('#modalBack');
  
  if (!modalTitle || !modalBody || !modalBack) {
    console.error('Элементы модального окна не найдены!');
    alert('Ошибка: элементы модального окна не найдены');
    return;
  }
  
  // Сбрасываем currentReportText и currentReportDate для обычных модальных окон (не отчетов)
  currentReportText = null;
  currentReportDate = null;
  
  modalTitle.textContent = title;
  modalBody.textContent = body;
  modalBody.style.whiteSpace = 'pre-wrap';
  
  // Скрываем секцию с фото для обычных модальных окон
  const photoSection = $('#photoSection');
  if (photoSection) {
    photoSection.style.display = 'none';
  }
  
  modalBack.style.display = 'flex';
  console.log('Модальное окно открыто:', title);
}

// Переменные для хранения данных отчета (для копирования при закрытии)
let currentReportText = null;
let currentReportDate = null;

// Функция открытия отчета с фото
async function openReportModal(dateFormatted, reportText, photoUrl){
  const modalTitle = $('#modalTitle');
  const modalBody = $('#modalBody');
  const modalBack = $('#modalBack');
  const photoSection = $('#photoSection');
  const photoToggleBtn = $('#photoToggleBtn');
  const photoContainer = $('#photoContainer');
  const photoContent = $('#photoContent');
  
  if (!modalTitle || !modalBody || !modalBack) {
    console.error('Элементы модального окна не найдены!');
    alert('Ошибка: элементы модального окна не найдены');
    return;
  }
  
  // Сохраняем текст отчета и дату для копирования при закрытии
  currentReportText = reportText;
  currentReportDate = dateFormatted;
  
  modalTitle.textContent = dateFormatted;
  modalBody.textContent = reportText;
  modalBody.style.whiteSpace = 'pre-wrap';
  
  // Настраиваем секцию с фото
  if (photoUrl) {
    photoSection.style.display = 'block';
    photoContainer.classList.remove('expanded');
    photoToggleBtn.textContent = 'Показать фото';
    
    // Создаем миниатюру с lazy loading
    const img = document.createElement('img');
    img.className = 'photo-thumbnail';
    img.src = photoUrl;
    img.alt = 'Фото сдачи ключей';
    img.loading = 'lazy';
    img.onclick = () => openLightbox(photoUrl);
    // Устанавливаем строгие стили для сохранения пропорций (особенно важно для PWA на iPhone)
    img.style.maxWidth = '200px';
    img.style.maxHeight = '150px';
    img.style.width = 'auto';
    img.style.height = 'auto';
    img.style.objectFit = 'contain';
    img.style.objectPosition = 'center';
    img.style.flexShrink = '0';
    img.style.display = 'block';
    img.style.margin = '12px auto';
    photoContent.innerHTML = '';
    photoContent.appendChild(img);
    
    // Обработчик кнопки "Показать фото"
    photoToggleBtn.onclick = () => {
      const isExpanded = photoContainer.classList.contains('expanded');
      if (isExpanded) {
        photoContainer.classList.remove('expanded');
        photoToggleBtn.textContent = 'Показать фото';
      } else {
        photoContainer.classList.add('expanded');
        photoToggleBtn.textContent = 'Скрыть фото';
      }
    };
  } else {
    // Нет фото - показываем плейсхолдер
    photoSection.style.display = 'block';
    photoContainer.classList.remove('expanded');
    photoToggleBtn.textContent = 'Показать фото';
    
    photoContent.innerHTML = `
      <div class="photo-placeholder">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
      </div>
    `;
    
    // Обработчик кнопки "Показать фото" для плейсхолдера
    photoToggleBtn.onclick = () => {
      const isExpanded = photoContainer.classList.contains('expanded');
      if (isExpanded) {
        photoContainer.classList.remove('expanded');
        photoToggleBtn.textContent = 'Показать фото';
      } else {
        photoContainer.classList.add('expanded');
        photoToggleBtn.textContent = 'Скрыть фото';
      }
    };
  }
  
  modalBack.style.display = 'flex';
  console.log('Отчет открыт:', dateFormatted, 'Фото:', photoUrl ? 'есть' : 'нет');
}

// Функция открытия lightbox для полноэкранного просмотра
function openLightbox(photoUrl){
  const lightbox = $('#lightbox');
  const lightboxImage = $('#lightboxImage');
  const lightboxClose = $('#lightboxClose');
  
  if (lightbox && lightboxImage) {
    lightboxImage.src = photoUrl;
    lightbox.classList.add('active');
    
    // Функция закрытия
    const closeLightbox = () => {
      lightbox.classList.remove('active');
    };
    
    // Закрытие по клику на фон
    lightbox.onclick = (e) => {
      if (e.target === lightbox) {
        closeLightbox();
      }
    };
    
    // Закрытие по клику на кнопку закрытия
    if (lightboxClose) {
      lightboxClose.onclick = (e) => {
        e.stopPropagation();
        closeLightbox();
      };
    }
    
    // Закрытие по Escape
    const escapeHandler = (e) => {
      if (e.key === 'Escape' && lightbox.classList.contains('active')) {
        closeLightbox();
        document.removeEventListener('keydown', escapeHandler);
      }
    };
    document.addEventListener('keydown', escapeHandler);
  }
}

// Делаем функцию доступной глобально
window.openLightbox = openLightbox;

// Переменная для отслеживания типа модального окна (для скрытия кнопки "Закрыть")
let currentModalType = null;

// Открыть модальное окно с HTML контентом (для форм)
function openModalHTML(title, html, hideCloseButton = false){
  // Сбрасываем currentReportText и currentReportDate для модальных окон с HTML (не отчетов)
  currentReportText = null;
  currentReportDate = null;
  
  // Сохраняем тип модального окна
  currentModalType = hideCloseButton ? 'comment' : null;
  
  $('#modalTitle').textContent = title;
  $('#modalBody').innerHTML = html;
  $('#modalBody').style.whiteSpace = 'normal';
  $('#modalBack').style.display = 'flex';
  
  // Скрываем кнопку "Закрыть" для модального окна комментария
  const modalClose = $('#modalClose');
  if (modalClose) {
    if (hideCloseButton) {
      modalClose.style.display = 'none';
    } else {
      modalClose.style.display = 'block';
    }
  }
}
function closeModal(){
  const modalBack = $('#modalBack');
  if (!modalBack) {
    return; // Если modalBack не найден, выходим
  }
  
  // Сначала закрываем окно, чтобы оно закрылось независимо от копирования
    modalBack.style.display = 'none';
  
  // Если открыт отчет (currentReportText не null), копируем его в буфер с датой
  if (currentReportText) {
    // Формируем полный текст для копирования: дата + пустая строка + текст отчета
    const fullText = currentReportDate 
      ? `${currentReportDate}\n\n${currentReportText}`
      : currentReportText;
    
    // Копируем в буфер асинхронно (не блокируем закрытие окна)
    copyToClipboard(fullText).then(() => {
      console.log('Отчёт скопирован в буфер обмена');
    }).catch(err => {
      console.error('Ошибка копирования отчета:', err);
    });
    
    // Сбрасываем сохраненные данные отчета
    currentReportText = null;
    currentReportDate = null;
  }
    
    // Сбрасываем состояние секции с фото
    const photoSection = $('#photoSection');
    const photoContainer = $('#photoContainer');
    if (photoSection) {
      photoSection.style.display = 'none';
    }
    if (photoContainer) {
      photoContainer.classList.remove('expanded');
    }
  
  // Восстанавливаем стандартную ширину модального окна
  const modal = document.querySelector('.modal');
  if (modal) {
    modal.style.maxWidth = '720px';
    modal.style.width = '100%';
    modal.style.margin = '0';
  }
  
  // Восстанавливаем стандартный padding для modal-back
  if (modalBack) {
    modalBack.style.padding = '24px';
  }
  
  // Восстанавливаем видимость кнопки "Закрыть"
  const modalClose = $('#modalClose');
  if (modalClose) {
    modalClose.style.display = 'block';
  }
  
  // Сбрасываем тип модального окна
  currentModalType = null;
}

// Инициализация обработчиков модального окна после загрузки DOM
function initModalHandlers() {
  const modalClose = $('#modalClose');
  const modalBack = $('#modalBack');
  
  if (modalClose) {
    modalClose.addEventListener('click', closeModal);
  }
  
  if (modalBack) {
    modalBack.addEventListener('click', (e)=> { 
      if (e.target.id==='modalBack') closeModal(); 
    });
  }
}

// Инициализируем обработчики при загрузке
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initModalHandlers);
} else {
  initModalHandlers();
}

// Регистрация Service Worker для PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Определяем путь к service worker (для GitHub Pages может быть /repo-name/)
    const swPath = location.pathname.includes('/') && location.pathname !== '/' 
      ? location.pathname.split('/').slice(0, -1).join('/') + '/service-worker.js'
      : '/service-worker.js';
    
    navigator.serviceWorker.register(swPath)
      .then((registration) => {
        console.log('Service Worker зарегистрирован:', registration.scope);
      })
      .catch((error) => {
        console.log('Ошибка регистрации Service Worker:', error);
      });
  });
}

// Функция для проверки, попадает ли задача в факт выполненных задач текущей недели
// Использование: checkTaskInFactThisWeek('слойка_круассан_макароны_4_СТМ')
async function checkTaskInFactThisWeek(taskNamePattern) {
  try {
    if (!supabaseClient) {
      console.error('Supabase клиент не инициализирован');
      return null;
    }

    // Получаем текущую неделю (понедельник)
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = воскресенье, 1 = понедельник, ...
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(today);
    monday.setDate(today.getDate() - daysToMonday);
    const currentWeekStart = monday.toISOString().slice(0, 10); // YYYY-MM-DD

    console.log('🔍 Проверка задачи:', taskNamePattern);
    console.log('📅 Текущая неделя начинается:', currentWeekStart);

    // Ищем задачу
    const { data: tasks, error } = await supabaseClient
      .from('asana_tasks')
      .select('task_name, q, completed, completed_at, shot_at, processed_at, week_shot, week_processed, week_start_date, due_on')
      .ilike('task_name', `%${taskNamePattern}%`)
      .order('updated_at', { ascending: false })
      .limit(5);

    if (error) {
      console.error('Ошибка при запросе:', error);
      return null;
    }

    if (!tasks || tasks.length === 0) {
      console.log('❌ Задача не найдена в базе данных');
      return null;
    }

    console.log(`✅ Найдено задач: ${tasks.length}`);

    // Проверяем каждую найденную задачу
    for (const task of tasks) {
      console.log('\n📋 Задача:', task.task_name);
      console.log('  Q:', task.q);
      console.log('  Завершена:', task.completed);
      console.log('  Дата обработки (processed_at):', task.processed_at);
      console.log('  Неделя обработки (week_processed):', task.week_processed);
      console.log('  Дата съемки (shot_at):', task.shot_at);
      console.log('  Неделя съемки (week_shot):', task.week_shot);
      console.log('  Дата завершения (completed_at):', task.completed_at);

      // Определяем фактическую неделю по приоритету
      let factWeek = null;
      let factWeekSource = '';

      if (task.week_processed) {
        factWeek = task.week_processed;
        factWeekSource = 'week_processed (дата обработки)';
      } else if (task.week_shot) {
        factWeek = task.week_shot;
        factWeekSource = 'week_shot (дата съемки)';
      } else if (task.completed && task.completed_at) {
        // Вычисляем неделю по completed_at
        const completedDate = new Date(task.completed_at);
        const completedDayOfWeek = completedDate.getDay();
        const completedDaysToMonday = completedDayOfWeek === 0 ? 6 : completedDayOfWeek - 1;
        const completedMonday = new Date(completedDate);
        completedMonday.setDate(completedDate.getDate() - completedDaysToMonday);
        factWeek = completedMonday.toISOString().slice(0, 10);
        factWeekSource = 'completed_at (дата завершения)';
      }

      console.log('  📍 Фактическая неделя:', factWeek, `(${factWeekSource})`);

      // Проверяем условия для попадания в done_fact_this_week
      const conditions = {
        qGreaterThanZero: task.q > 0,
        completed: task.completed === true,
        factWeekMatchesCurrent: factWeek === currentWeekStart
      };

      console.log('  ✅ Условия:');
      console.log('    - Q > 0:', conditions.qGreaterThanZero ? '✅' : '❌');
      console.log('    - Завершена:', conditions.completed ? '✅' : '❌');
      console.log('    - Неделя совпадает с текущей:', conditions.factWeekMatchesCurrent ? '✅' : '❌');

      const inFactThisWeek = conditions.qGreaterThanZero && conditions.completed && conditions.factWeekMatchesCurrent;

      if (inFactThisWeek) {
        console.log('  🎯 РЕЗУЛЬТАТ: ✅ ЗАДАЧА ПОПАДАЕТ В ФАКТ ВЫПОЛНЕННЫХ ЗАДАЧ ЭТОЙ НЕДЕЛИ');
      } else {
        console.log('  🎯 РЕЗУЛЬТАТ: ❌ Задача НЕ попадает в факт выполненных задач этой недели');
        if (!conditions.qGreaterThanZero) {
          console.log('     Причина: Q <= 0 или отсутствует');
        }
        if (!conditions.completed) {
          console.log('     Причина: Задача не завершена');
        }
        if (!conditions.factWeekMatchesCurrent) {
          console.log(`     Причина: Фактическая неделя (${factWeek}) не совпадает с текущей (${currentWeekStart})`);
        }
      }

      return {
        task: task,
        factWeek: factWeek,
        factWeekSource: factWeekSource,
        currentWeekStart: currentWeekStart,
        conditions: conditions,
        inFactThisWeek: inFactThisWeek
      };
    }

    return tasks[0];
  } catch (error) {
    console.error('Ошибка при проверке задачи:', error);
    return null;
  }
}

// Делаем функцию доступной глобально для вызова из консоли
window.checkTaskInFactThisWeek = checkTaskInFactThisWeek;

// Функция для обновления срока выполнения (due_on) задачи в Supabase
// Использование: 
//   await updateTaskDueDate('Средний_Шоколадки_8_НЕ СТМ', '2025-11-21')
//   await updateTaskDueDate(['Средний_Шоколадки_8_НЕ СТМ', 'Средний_Оливковое масло_7_НЕ СТМ', 'Средний_семечки и курт_13_НЕ СТМ', 'Средний_трюфельные соусы_9_НЕ СТМ'], '2025-11-21')
// ВАЖНО: Это временное изменение. При следующей синхронизации из Asana значение может перезаписаться.
// Рекомендуется также изменить due_on в самой Asana.
async function updateTaskDueDate(taskNamePattern, newDueDate) {
  // Поддерживаем как один паттерн, так и массив паттернов
  const patterns = Array.isArray(taskNamePattern) ? taskNamePattern : [taskNamePattern];
  try {
    if (!supabaseClient) {
      console.error('Supabase клиент не инициализирован');
      return null;
    }

    if (!newDueDate || !/^\d{4}-\d{2}-\d{2}$/.test(newDueDate)) {
      console.error('Неверный формат даты. Используйте формат YYYY-MM-DD (например: 2025-11-21)');
      return null;
    }

    console.log('🔍 Поиск задач:', patterns.length === 1 ? patterns[0] : patterns);
    console.log('📅 Новая дата due_on:', newDueDate);

    // Вычисляем week_start_date (понедельник недели, в которую попадает новая дата)
    const dueDate = new Date(newDueDate + 'T00:00:00');
    const dayOfWeek = dueDate.getDay(); // 0 = воскресенье, 1 = понедельник, ...
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(dueDate);
    monday.setDate(dueDate.getDate() - daysToMonday);
    const weekStartDate = monday.toISOString().slice(0, 10); // YYYY-MM-DD

    console.log('📅 Новая week_start_date:', weekStartDate);

    // Строим условие для поиска (поддержка нескольких паттернов)
    // Для Supabase .or() нужно использовать правильный формат
    let query = supabaseClient
      .from('asana_tasks')
      .select('task_name, asana_task_gid, due_on, week_start_date');
    
    // Если несколько паттернов, используем .or(), иначе .ilike()
    if (patterns.length > 1) {
      const orConditions = patterns.map(p => `task_name.ilike.%${p}%`).join(',');
      query = query.or(orConditions);
    } else {
      query = query.ilike('task_name', `%${patterns[0]}%`);
    }
    
    query = query.order('updated_at', { ascending: false }).limit(10);
    
    // Сначала находим задачи
    const { data: tasks, error: findError } = await query;

    if (findError) {
      console.error('Ошибка при поиске задачи:', findError);
      return null;
    }

    if (!tasks || tasks.length === 0) {
      console.log('❌ Задача не найдена в базе данных');
      return null;
    }

    console.log(`✅ Найдено задач: ${tasks.length}`);
    tasks.forEach((task, index) => {
      console.log(`  ${index + 1}. ${task.task_name} (GID: ${task.asana_task_gid})`);
      console.log(`     Текущий due_on: ${task.due_on}, week_start_date: ${task.week_start_date}`);
    });

    // Обновляем все найденные задачи по их GID (более надежно, чем по имени)
    const taskGids = tasks.map(t => t.asana_task_gid);
    
    let updateQuery = supabaseClient
      .from('asana_tasks')
      .update({
        due_on: newDueDate,
        week_start_date: weekStartDate,
        updated_at: new Date().toISOString()
      })
      .in('asana_task_gid', taskGids)
      .select('task_name, asana_task_gid, due_on, week_start_date, updated_at');
    
    const { data: updatedTasks, error: updateError } = await updateQuery;

    if (updateError) {
      console.error('Ошибка при обновлении:', updateError);
      return null;
    }

    console.log(`\n✅ Обновлено задач: ${updatedTasks.length}`);
    updatedTasks.forEach((task, index) => {
      console.log(`  ${index + 1}. ${task.task_name}`);
      console.log(`     Новый due_on: ${task.due_on}`);
      console.log(`     Новый week_start_date: ${task.week_start_date}`);
    });

    // Проверяем, попадает ли задача в текущую неделю
    const today = new Date();
    const todayDayOfWeek = today.getDay();
    const todayDaysToMonday = todayDayOfWeek === 0 ? 6 : todayDayOfWeek - 1;
    const currentMonday = new Date(today);
    currentMonday.setDate(today.getDate() - todayDaysToMonday);
    const currentWeekStart = currentMonday.toISOString().slice(0, 10);

    const inCurrentWeek = weekStartDate === currentWeekStart;
    console.log(`\n📊 Статус:`);
    console.log(`  Текущая неделя начинается: ${currentWeekStart}`);
    console.log(`  Неделя задачи начинается: ${weekStartDate}`);
    console.log(`  Попадает в текущую неделю: ${inCurrentWeek ? '❌ ДА' : '✅ НЕТ'}`);

    if (inCurrentWeek) {
      console.warn('⚠️ ВНИМАНИЕ: Задача всё ещё попадает в текущую неделю!');
    } else {
      console.log('✅ Задача успешно исключена из текущей недели');
    }

    console.warn('\n⚠️ ВАЖНО: Это временное изменение в Supabase.');
    console.warn('При следующей синхронизации из Asana (каждые 5 минут или через webhook)');
    console.warn('значение может перезаписаться, если due_on не изменено в самой Asana.');

    return updatedTasks;
  } catch (error) {
    console.error('Ошибка при обновлении задачи:', error);
    return null;
  }
}

// Делаем функцию доступной глобально для вызова из консоли
window.updateTaskDueDate = updateTaskDueDate;

// Функция для принудительного обновления статистики Asana через Edge Function
// Использование: await forceRefreshAsanaStats()
async function forceRefreshAsanaStats() {
  try {
    console.log('🔄 Начинаю принудительное обновление статистики Asana...');
    
    if (!supabaseClient) {
      console.error('❌ Supabase клиент не инициализирован');
      return null;
    }

    // Вызываем Edge Function для обновления данных
    console.log('📡 Вызываю Edge Function fetch-asana-stats...');
    const { data, error } = await supabaseClient.functions.invoke('fetch-asana-stats', {
      body: {}
    });

    if (error) {
      console.error('❌ Ошибка при вызове Edge Function:', error);
      return null;
    }

    if (!data || !data.success) {
      console.error('❌ Edge Function вернула ошибку:', data?.error || 'Unknown error');
      return null;
    }

    console.log('✅ Edge Function выполнена успешно');
    console.log('📊 Полученные данные:', data.data);

    // Проверяем ключевые показатели
    const stats = data.data;
    console.log('\n📈 Ключевые показатели:');
    console.log('  - Уже на руках (on_hand_qty):', stats.on_hand_qty ?? 0);
    console.log('  - Сфоткано, но не обработано (shot_not_processed_qty):', stats.shot_not_processed_qty ?? 0);
    console.log('  - Сделано (done_qty):', stats.done_qty ?? 0);
    console.log('  - Факт недели (done_fact_this_week):', stats.done_fact_this_week ?? 0);
    console.log('  - Версия Edge Function:', stats.version || 'unknown');

    // Обновляем кеш и UI
    if (typeof updateTasksCards === 'function') {
      console.log('\n🔄 Обновляю карточки в UI...');
      cachedTasksStats = {
        ...stats,
        doneQty: stats.done_qty,
        doneFactThisWeek: stats.done_fact_this_week,
        toShootQty: stats.to_shoot_qty,
        weekLoad: stats.week_load,
        plan: stats.plan,
        remainingToPlan: stats.remaining_to_plan,
        onHandQty: stats.on_hand_qty,
        warehouseQty: stats.warehouse_qty,
        shotNotProcessedQty: stats.shot_not_processed_qty,
        qErrorsCount: stats.q_errors_count
      };
      updateTasksCards(cachedTasksStats);
      console.log('✅ UI обновлён');
    } else {
      console.warn('⚠️ Функция updateTasksCards не найдена. Перезагрузите страницу для обновления UI.');
    }

    // Проверяем логику on_hand_qty
    if (stats.on_hand_qty > 0) {
      console.log('\n⚠️ ВНИМАНИЕ: on_hand_qty > 0. Проверьте, что Edge Function обновлена с условием !task.shot_at');
      console.log('   Если товары сфотографированы (shot_at заполнено), они НЕ должны попадать в "Уже на руках"');
    }

    return stats;
  } catch (error) {
    console.error('❌ Ошибка при обновлении статистики:', error);
    return null;
  }
}

// Делаем функцию доступной глобально для вызова из консоли
window.forceRefreshAsanaStats = forceRefreshAsanaStats;

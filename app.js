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

// Функция для получения статистики Asana из Supabase
async function getAsanaStats() {
  try {
    if (!supabaseClient) {
      console.error('Supabase клиент не инициализирован');
      // Если есть кеш, возвращаем его вместо нулей
      if (cachedTasksStats) {
        console.log('Используем кеш из-за отсутствия клиента');
        return cachedTasksStats;
      }
      return {
        completed_count: 0,
        pending_count: 0,
        total_plan: 0,
        remaining_to_plan: 80
      };
    }
    
    // Получаем начало текущей недели (понедельник)
    const now = new Date();
    const day = now.getDay();
    const diff = now.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(now.getFullYear(), now.getMonth(), diff);
    monday.setHours(0, 0, 0, 0);
    const weekStartStr = monday.toISOString().split('T')[0];
    
    // Запрашиваем данные из Supabase
    const { data, error } = await supabaseClient
      .from('asana_stats')
      .select('*')
      .eq('week_start_date', weekStartStr)
      .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
      console.error('Ошибка получения статистики Asana:', error);
      // Если есть кеш, возвращаем его вместо ошибки
      if (cachedTasksStats) {
        console.log('Используем кеш из-за ошибки запроса');
        return cachedTasksStats;
      }
      throw error;
    }
    
    // Если данных нет, проверяем кеш
    if (!data) {
      // Если есть кеш, возвращаем его
      if (cachedTasksStats) {
        console.log('Данных нет в Supabase, используем кеш');
        return cachedTasksStats;
      }
      return {
        completed_count: 0,
        pending_count: 0,
        total_plan: 0,
        remaining_to_plan: 80
      };
    }
    
    // Сохраняем в кеш только если данные есть
    cachedTasksStats = data;
    console.log('Данные получены из Supabase и сохранены в кеш:', data);
    return data;
  } catch (error) {
    console.error('Ошибка получения статистики Asana:', error);
    // Если есть кеш, возвращаем его вместо нулей
    if (cachedTasksStats) {
      console.log('Используем кеш из-за исключения');
      return cachedTasksStats;
    }
    return {
      completed_count: 0,
      pending_count: 0,
      total_plan: 0,
      remaining_to_plan: 80
    };
  }
}

// Функция обновления значений в карточках без пересоздания HTML
function updateTasksCards(stats) {
  console.log('updateTasksCards вызвана с данными:', stats);
  
  const completedValue = $('#completedCount');
  const pendingValue = $('#pendingCount');
  const totalPlanValue = $('#totalPlan');
  const remainingValue = $('#remainingCount');
  const remainingText = $('#remainingText');
  const card4 = $('#cardRemaining');
  
  console.log('Найденные элементы:', {
    completedValue: !!completedValue,
    pendingValue: !!pendingValue,
    totalPlanValue: !!totalPlanValue,
    remainingValue: !!remainingValue,
    remainingText: !!remainingText,
    card4: !!card4
  });
  
  if (completedValue) completedValue.textContent = stats.completed_count || 0;
  if (pendingValue) pendingValue.textContent = stats.pending_count || 0;
  if (totalPlanValue) totalPlanValue.textContent = stats.total_plan || 0;
  if (remainingValue) remainingValue.textContent = stats.remaining_to_plan || 0;
  
  // Обновляем стили и текст для карточки "До выполнения плана"
  if (card4 && remainingValue && remainingText) {
    const isPositive = stats.remaining_to_plan > 0;
    card4.style.background = isPositive ? '#fce4ec' : '#e8f5e9';
    card4.style.borderColor = isPositive ? '#e91e63' : '#4caf50';
    const title = card4.querySelector('h3');
    if (title) title.style.color = isPositive ? '#880e4f' : '#2e7d32';
    remainingValue.style.color = isPositive ? '#c2185b' : '#1b5e20';
    remainingText.textContent = `товаров (план: 80${stats.remaining_to_plan < 0 ? ', перевыполнение: ' + Math.abs(stats.remaining_to_plan) : ''})`;
  }
}

// Функция рендеринга страницы "Задачи"
// Глобальные переменные для сохранения состояния
let tasksDetailsExpanded = false;
let cachedTasksDetails = null;
let cachedTasksStats = null; // Кеш для статистики

async function renderTasks() {
  const app = $('#app');
  
  // Если есть кешированная статистика, используем её для быстрого отображения
  let stats;
  if (cachedTasksStats) {
    console.log('Используем кешированную статистику:', cachedTasksStats);
    stats = cachedTasksStats;
  } else {
    // Показываем загрузку только если нет кеша
    app.innerHTML = `
      <h1>Задачи Asana</h1>
      <p>Загрузка данных...</p>
    `;
    
    // Получаем статистику
    stats = await getAsanaStats();
    // Сохраняем в кеш всегда (getAsanaStats уже сохраняет в кеш, но на всякий случай)
    if (stats) {
      cachedTasksStats = stats;
      console.log('Статистика сохранена в кеш:', stats);
    }
  }
  
  app.innerHTML = `
    <h1 style="margin: 0 0 12px 0; font-size: 24px;">Задачи Asana</h1>
    
    <div id="tasksGrid" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; margin-top: 12px;">
      <!-- Карточка 1: Отснято на неделе -->
      <div style="background: #e8f5e9; border: 1px solid #4caf50; border-radius: 8px; padding: 12px;">
        <h3 style="margin: 0 0 8px 0; color: #2e7d32; font-size: 12px; font-weight: 500;">Отснято на неделе</h3>
        <div id="completedCount" style="font-size: 24px; font-weight: bold; color: #1b5e20;">${stats.completed_count || 0}</div>
        <p style="margin: 4px 0 0 0; color: #666; font-size: 11px;">товаров</p>
      </div>
      
      <!-- Карточка 2: Предстоит отснять -->
      <div style="background: #fff3e0; border: 1px solid #ff9800; border-radius: 8px; padding: 12px;">
        <h3 style="margin: 0 0 8px 0; color: #e65100; font-size: 12px; font-weight: 500;">Предстоит отснять</h3>
        <div id="pendingCount" style="font-size: 24px; font-weight: bold; color: #bf360c;">${stats.pending_count || 0}</div>
        <p style="margin: 4px 0 0 0; color: #666; font-size: 11px;">товаров</p>
      </div>
      
      <!-- Карточка 3: Запланировано товаров на неделю -->
      <div style="background: #e3f2fd; border: 1px solid #2196f3; border-radius: 8px; padding: 12px;">
        <h3 style="margin: 0 0 8px 0; color: #1565c0; font-size: 12px; font-weight: 500;">Запланировано</h3>
        <div id="totalPlan" style="font-size: 24px; font-weight: bold; color: #0d47a1;">${stats.total_plan || 0}</div>
        <p style="margin: 4px 0 0 0; color: #666; font-size: 11px;">товаров</p>
      </div>
      
      <!-- Карточка 4: До выполнения плана -->
      <div id="cardRemaining" style="background: ${stats.remaining_to_plan > 0 ? '#fce4ec' : '#e8f5e9'}; border: 1px solid ${stats.remaining_to_plan > 0 ? '#e91e63' : '#4caf50'}; border-radius: 8px; padding: 12px;">
        <h3 style="margin: 0 0 8px 0; color: ${stats.remaining_to_plan > 0 ? '#880e4f' : '#2e7d32'}; font-size: 12px; font-weight: 500;">До выполнения плана</h3>
        <div id="remainingCount" style="font-size: 24px; font-weight: bold; color: ${stats.remaining_to_plan > 0 ? '#c2185b' : '#1b5e20'};">
          ${stats.remaining_to_plan || 0}
        </div>
        <p id="remainingText" style="margin: 4px 0 0 0; color: #666; font-size: 11px;">товаров (план: 80${stats.remaining_to_plan < 0 ? ', перевыполнение: ' + Math.abs(stats.remaining_to_plan) : ''})</p>
      </div>
    </div>
    
    <div style="margin-top: 16px;">
      <button id="refreshStats" class="btn" style="width: 100%; position: relative; z-index: 1; cursor: pointer; user-select: none; -webkit-tap-highlight-color: transparent;">Обновить данные</button>
      <p class="muted" style="margin-top: 8px; font-size: 11px; line-height: 1.4;">
        Нажмите кнопку для получения актуальной статистики из Asana.
      </p>
    </div>
    
    <div style="margin-top: 16px;">
      <button id="showDetails" class="btn" style="width: 100%; position: relative; z-index: 1; cursor: pointer; user-select: none; -webkit-tap-highlight-color: transparent;">Показать подробности</button>
    </div>
    
    <div id="tasksDetailsContainer" class="tasks-details-container ${tasksDetailsExpanded ? 'expanded' : ''}" style="margin-top: 16px;">
      <div id="tasksDetailsList" style="background: var(--bg-surface); border: 1px solid var(--border-default); border-radius: 8px; padding: 16px;"></div>
    </div>
  `;
  
  // Если секция была развернута, восстанавливаем данные
  if (tasksDetailsExpanded) {
    const detailsContainer = $('#tasksDetailsContainer');
    if (detailsContainer) {
      detailsContainer.classList.add('expanded');
    }
    // Восстанавливаем данные из кеша или загружаем заново
    if (cachedTasksDetails) {
      renderTasksDetailsFromCache();
    } else {
      await renderTasksDetails();
    }
  }
  
  // Обработчик кнопки обновления
  const refreshBtn = $('#refreshStats');
  console.log('Кнопка refreshStats найдена:', !!refreshBtn);
  
  if (refreshBtn) {
    console.log('Добавляем обработчик клика на кнопку обновления');
    refreshBtn.addEventListener('click', async () => {
      console.log('Кнопка "Обновить данные" нажата');
      refreshBtn.disabled = true;
      refreshBtn.textContent = 'Обновление...';
      
      try {
        console.log('Вызываем Edge Function через Supabase client');
        
        // Используем Supabase client для вызова Edge Function (избегаем проблем с CORS)
        if (!supabaseClient) {
          throw new Error('Supabase client не инициализирован');
        }
        
        const { data: result, error: invokeError } = await supabaseClient.functions.invoke('fetch-asana-stats', {
          body: {}
        });
        
        console.log('Ответ от Edge Function:', result);
        console.log('Ошибка (если есть):', invokeError);
        
        if (invokeError) {
          throw new Error(invokeError.message || 'Ошибка вызова Edge Function');
        }
        
        if (!result || !result.success) {
          throw new Error(result?.error || 'Ошибка обновления данных');
        }
        
        // Используем данные из ответа Edge Function
        if (result.data) {
          console.log('Обновляем карточки данными из ответа:', result.data);
          updateTasksCards(result.data);
          
          // Обновляем кеш статистики (всегда, даже если нули)
          cachedTasksStats = result.data;
          console.log('Кеш статистики обновлен:', cachedTasksStats);
          
          // Очищаем кеш детальных данных, чтобы при следующем открытии загрузились свежие данные
          cachedTasksDetails = null;
          
          // Если секция подробностей развернута, обновляем данные
          if (tasksDetailsExpanded) {
            await renderTasksDetails();
          }
          
          alert('Данные успешно обновлены!');
        } else {
          // Если данных нет в ответе, получаем из Supabase с небольшой задержкой
          console.log('Данных нет в ответе, получаем из Supabase...');
          await new Promise(resolve => setTimeout(resolve, 500));
          const stats = await getAsanaStats();
          console.log('Получены данные из Supabase:', stats);
          updateTasksCards(stats);
          
          // Обновляем кеш статистики (всегда, даже если нули)
          cachedTasksStats = stats;
          console.log('Кеш статистики обновлен:', cachedTasksStats);
          
          // Очищаем кеш детальных данных
          cachedTasksDetails = null;
          
          // Если секция подробностей развернута, обновляем данные
          if (tasksDetailsExpanded) {
            await renderTasksDetails();
          }
          
          alert('Данные успешно обновлены!');
        }
        
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
        // Загружаем данные перед раскрытием
        await renderTasksDetails();
        
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
}

// Функция для получения детальных данных о задачах из asana_tasks
async function getAsanaTasksDetails() {
  try {
    if (!supabaseClient) {
      console.error('Supabase клиент не инициализирован');
      return [];
    }
    
    // Используем week_start_date из кешированной статистики, если она есть
    // Это гарантирует, что мы запрашиваем данные для той же недели, что и статистика
    let weekStartStr;
    if (cachedTasksStats && cachedTasksStats.week_start_date) {
      weekStartStr = cachedTasksStats.week_start_date;
      console.log('getAsanaTasksDetails: Используем week_start_date из кеша:', weekStartStr);
    } else {
      // Если кеша нет, рассчитываем начало недели (как в getAsanaStats)
      const now = new Date();
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(now.getFullYear(), now.getMonth(), diff);
      monday.setHours(0, 0, 0, 0);
      weekStartStr = monday.toISOString().split('T')[0];
      console.log('getAsanaTasksDetails: Рассчитали week_start_date:', weekStartStr);
    }
    
    console.log('getAsanaTasksDetails: Запрашиваем данные для недели:', weekStartStr);
    
    // Запрашиваем данные из Supabase
    const { data, error } = await supabaseClient
      .from('asana_tasks')
      .select('task_name, quantity, completed_at')
      .eq('week_start_date', weekStartStr)
      .order('completed_at', { ascending: false });
    
    console.log('getAsanaTasksDetails: Ответ от Supabase:', { data, error, dataLength: data?.length });
    
    if (error && error.code !== 'PGRST116') {
      console.error('Ошибка получения деталей задач Asana:', error);
      throw error;
    }
    
    if (!data || data.length === 0) {
      console.log('getAsanaTasksDetails: Данных нет для недели:', weekStartStr);
      // Попробуем получить все данные для отладки
      const { data: allData, error: allError } = await supabaseClient
        .from('asana_tasks')
        .select('task_name, quantity, completed_at, week_start_date')
        .order('week_start_date', { ascending: false })
        .limit(10);
      console.log('getAsanaTasksDetails: Последние 10 записей в таблице:', { allData, allError });
    }
    
    return data || [];
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

// Функция для отображения детальных данных о задачах
async function renderTasksDetails() {
  const detailsList = $('#tasksDetailsList');
  if (!detailsList) return;
  
  // Показываем загрузку
  detailsList.innerHTML = '<p style="text-align: center; color: var(--text-muted);">Загрузка данных...</p>';
  
  try {
    const tasks = await getAsanaTasksDetails();
    
    // Сохраняем данные в кеш
    cachedTasksDetails = tasks;
    
    renderTasksDetailsFromCache();
  } catch (error) {
    console.error('Ошибка отображения деталей задач:', error);
    const detailsList = $('#tasksDetailsList');
    if (detailsList) {
      detailsList.innerHTML = '<p style="text-align: center; color: var(--error);">Ошибка загрузки данных</p>';
    }
  }
}

// Функция для отображения данных из кеша
function renderTasksDetailsFromCache() {
  const detailsList = $('#tasksDetailsList');
  if (!detailsList) return;
  
  if (!cachedTasksDetails || cachedTasksDetails.length === 0) {
    detailsList.innerHTML = '<p style="text-align: center; color: var(--text-muted);">Нет данных для отображения</p>';
    return;
  }
  
  // Создаем таблицу
  let tableHTML = `
    <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
      <thead>
        <tr style="background: var(--bg-muted); border-bottom: 2px solid var(--border-default);">
          <th style="padding: 12px; text-align: left; font-weight: 600; color: var(--text-primary);">Задача</th>
          <th style="padding: 12px; text-align: center; font-weight: 600; color: var(--text-primary);">Кол-во</th>
          <th style="padding: 12px; text-align: center; font-weight: 600; color: var(--text-primary);">Дата</th>
        </tr>
      </thead>
      <tbody>
  `;
  
  cachedTasksDetails.forEach((task, index) => {
    const rowStyle = index % 2 === 0 ? 'background: var(--bg-surface);' : 'background: var(--bg-muted);';
    const taskName = task.task_name || 'Без названия';
    const quantity = task.quantity || 0;
    const date = formatDate(task.completed_at);
    
    tableHTML += `
      <tr style="${rowStyle} border-bottom: 1px solid var(--border-default);">
        <td style="padding: 12px; color: var(--text-primary); word-break: break-word;">${taskName}</td>
        <td style="padding: 12px; text-align: center; color: var(--text-primary); font-weight: 500;">${quantity}</td>
        <td style="padding: 12px; text-align: center; color: var(--text-primary);">${date}</td>
      </tr>
    `;
  });
  
  tableHTML += `
      </tbody>
    </table>
  `;
  
  detailsList.innerHTML = tableHTML;
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

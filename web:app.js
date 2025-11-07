/***** CONFIG *****/
const API_BASE = 'https://script.google.com/macros/s/AKfycbwic24EDSMX-0Mfh7aGtWYrqlRWXyerAe7j_HjwGzy0a-YnW1YKhbSRRI9ePWLJicU-/exec';
const API_KEY  = 'ttSK-93dfA8pQx20bHZm9q4K3u';

/***** HELPERS *****/
const $ = sel => document.querySelector(sel);
const todayISO = () => new Date().toISOString().slice(0,10);
const pad = n => String(n).padStart(2,'0');

function toMinutes(hhmm){
  if(!hhmm) return 0;
  const [h,m]=hhmm.split(':').map(Number);
  return h*60+(m||0);
}
function mmToHhmm(mm){
  const sign = mm<0 ? '-' : '';
  mm = Math.abs(mm);
  return `${sign}${pad(Math.floor(mm/60))}:${pad(mm%60)}`;
}

/***** API *****/
async function apiGet(month){
  const url = `${API_BASE}?month=${encodeURIComponent(month)}`;
  const r = await fetch(url);
  const j = await r.json();
  return j.items || [];
}

async function apiSave(date, patch){
  const r = await fetch(API_BASE, {
    method:'POST',
    headers:{ 'Content-Type':'text/plain;charset=utf-8' },
    body: JSON.stringify({ apiKey: API_KEY, date, patch })
  });
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || 'save failed');
  return j.saved;
}

/***** STATE *****/
let cacheMonth = {};
let currentDate = todayISO();

/***** UI RENDER: ME *****/
function renderMe(){
  const app = $('#app');
  app.innerHTML = `
    <h1>Мой экран (сегодня: <span id="today">${currentDate}</span>)</h1>

    <div class="row">
      <div><label>План начало</label><input id="planStart" type="time" value="09:00"></div>
      <div><label>План конец</label><input id="planEnd" type="time" value="18:00"></div>
    </div>

    <p class="muted" id="carryPrevText">Остаток...</p>

    <div class="row">
      <div><label>Факт прихода</label><input id="inTime" type="time"></div>
      <div><label>Факт ухода</label><input id="outTime" type="time"></div>
    </div>

    <label>Отлучался</label>
    <button id="addBreak" class="btn">Добавить отлучку</button>
    <div id="breaksList" class="list muted">Пока нет отлучек</div>

    <label>Комментарий</label>
    <textarea id="comment" rows="3"></textarea>

    <div class="right"><button id="showReport" class="btn">Показать отчёт</button></div>
  `;

  const month = currentDate.slice(0,7);
  apiGet(month).then(items=>{
    cacheMonth[month] = items;
    const rec = ensureToday(items);
    hydrateMe(rec);
  });

  $('#planStart').addEventListener('change', e => saveField('plan_start', e.target.value));
  $('#planEnd').addEventListener('change', e => saveField('plan_end', e.target.value));
  $('#inTime').addEventListener('change', e => saveField('in_time', e.target.value));
  $('#outTime').addEventListener('change', e => saveField('out_time', e.target.value));
  $('#comment').addEventListener('blur', e => saveField('comment', e.target.value));
  $('#addBreak').addEventListener('click', openBreakModal);
  $('#showReport').addEventListener('click', showReportForToday);
}

function ensureToday(items){
  let rec = items.find(x=>x.date===currentDate);
  if (!rec) rec = { date: currentDate };
  return rec;
}

function hydrateMe(rec){
  $('#planStart').value = rec.plan_start || '09:00';
  $('#planEnd').value   = rec.plan_end   || '18:00';
  $('#inTime').value    = rec.in_time    || '';
  $('#outTime').value   = rec.out_time   || '';
  $('#comment').value   = rec.comment    || '';

  const prev = findPrevRecord(rec.date);
  const carryPrevMin = prev ? parseInt(prev.carry_new_min||0,10) : 0;
  $('#carryPrevText').textContent = `Остаток: ${mmToHhmm(carryPrevMin)}`;

  renderBreaksList(rec.breaks_json);
}

function findPrevRecord(date){
  const m = date.slice(0,7);
  const items = cacheMonth[m] || [];
  const prevs = items.filter(x=>x.date < date).sort((a,b)=> a.date.localeCompare(b.date));
  return prevs.length ? prevs.at(-1) : null;
}

/***** BREAK MODAL *****/
function renderBreaksList(bjson){
  const el = $('#breaksList');
  if (!bjson) { el.textContent='Пока нет отлучек'; return; }
  try {
    const arr = JSON.parse(bjson);
    if (!arr.length) return el.textContent='Пока нет отлучек';
    el.innerHTML = arr.map((b,i)=>`${i+1}) ${b.from}–${b.to}${b.reason?` (${b.reason})`:''}`).join('<br>');
  } catch {
    el.textContent='Пока нет отлучек';
  }
}

function openBreakModal(){
  const from=prompt("Ушёл (чч:мм)");
  const to=prompt("Вернулся (чч:мм)");
  const reason=prompt("Причина (опц)")||'';

  if(!from||!to) return;

  const m = currentDate.slice(0,7);
  const rec = ensureToday(cacheMonth[m]||[]);
  
  let arr=[];
  if(rec.breaks_json) try{arr=JSON.parse(rec.breaks_json)||[]}catch{}

  arr.push({from,to,reason});

  apiSave(currentDate,{breaks_json:JSON.stringify(arr)}).then(()=>{
    renderBreaksList(JSON.stringify(arr));
  });
}

/***** SAVE FIELD *****/
function saveField(field,val){
  const patch={}; patch[field]=val;
  return apiSave(currentDate,patch);
}

/***** REPORT *****/
async function showReportForToday(){
  const m=currentDate.slice(0,7);
  const items=cacheMonth[m]||await apiGet(m);
  const rec=ensureToday(items);
  alert(`Отчёт за ${rec.date}`);
}

/***** ROUTER *****/
function route(){
  currentDate = todayISO();
  renderMe();
}
window.addEventListener('hashchange', route);
window.addEventListener('load', route);

const SVG_NS = 'http://www.w3.org/2000/svg';
const STEP = 17;
const SIZE = 13;
const svg = document.getElementById('calendar');
const heading = document.getElementById('heading');
const months = document.getElementById('months');
const yearsNav = document.getElementById('years');
const status = document.getElementById('status');
const toggle = document.getElementById('toggle');
const replay = document.getElementById('replay');
let manifest;
let data;
let route = [];
let frame = 0;
let timer;
let playing = true;
let generation = 0;

function el(name, attrs = {}) {
  const node = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
}

function color(count) {
  if (count === 0) return '#161b22';
  if (count < 3) return '#0e4429';
  if (count < 6) return '#006d32';
  if (count < 11) return '#26a641';
  return '#39d353';
}

function drawSnake() {
  document.getElementById('snake')?.remove();
  if (!route.length) return;
  const group = el('g', { id: 'snake', 'aria-hidden': 'true' });
  for (let offset = 5; offset >= 0; offset--) {
    const index = Math.max(0, frame - offset) % route.length;
    const point = route[index];
    if (!point || (frame < offset && offset > 0)) continue;
    group.append(el('rect', {
      x: point.x * STEP, y: point.y * STEP, width: SIZE, height: SIZE,
      rx: 3, class: offset === 0 ? 'snake-head' : 'snake-body',
      opacity: offset === 0 ? 1 : (0.95 - offset * .09),
    }));
    if (offset === 0) group.append(el('circle', { cx: point.x * STEP + 10, cy: point.y * STEP + 4, r: 1.3, class: 'snake-eye' }));
  }
  svg.append(group);
}

function tick() {
  if (!playing || document.hidden) return;
  frame = (frame + 1) % route.length;
  drawSnake();
}

function renderCalendar() {
  svg.replaceChildren();
  months.replaceChildren();
  const first = new Date(`${data.year}-01-01T00:00:00Z`);
  const leading = first.getUTCDay();
  const weeks = Math.ceil((leading + data.days.length) / 7);
  const width = weeks * STEP;
  svg.setAttribute('viewBox', `0 0 ${width} 119`);
  svg.style.width = `${width}px`;
  months.style.width = `${width}px`;
  document.querySelector('.calendar-wrap').style.width = `${width + 42}px`;
  const byDate = new Map(data.days.map(day => [day.date, day.count]));
  const totalDays = Math.round((Date.UTC(data.year + 1, 0, 1) - Date.UTC(data.year, 0, 1)) / 86400000);
  route = [];
  let lastMonth = -1;
  for (let i = 0; i < totalDays; i++) {
    const date = new Date(Date.UTC(data.year, 0, i + 1));
    const day = date.getUTCDay();
    const week = Math.floor((leading + i) / 7);
    const iso = date.toISOString().slice(0, 10);
    const count = byDate.get(iso) ?? 0;
    const rect = el('rect', { x: week * STEP, y: day * STEP, width: SIZE, height: SIZE, rx: 3, fill: color(count), class: 'cell' });
    const title = el('title');
    title.textContent = `${iso} · ${count} 次贡献`;
    rect.append(title);
    svg.append(rect);
    if (date.getUTCMonth() !== lastMonth) {
      const label = document.createElement('span');
      label.textContent = `${date.getUTCMonth() + 1}月`;
      label.style.left = `${week * STEP}px`;
      months.append(label);
      lastMonth = date.getUTCMonth();
    }
  }
  // An adjacent-cell serpentine route keeps the snake on the selected year's grid.
  for (let y = 0; y < 7; y++) {
    const columns = Array.from({ length: weeks }, (_, x) => x);
    if (y % 2) columns.reverse();
    for (const x of columns) route.push({ x, y });
  }
  frame = 4;
  drawSnake();
}

function renderYears() {
  yearsNav.replaceChildren();
  for (const year of manifest.years) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = year;
    button.setAttribute('aria-current', String(year === data.year));
    button.addEventListener('click', () => selectYear(year));
    yearsNav.append(button);
  }
}

async function selectYear(year) {
  const request = ++generation;
  clearInterval(timer);
  status.textContent = `正在加载 ${year} 年的贡献记录…`;
  try {
    const response = await fetch(`./data/${year}.json`, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const result = await response.json();
    if (request !== generation) return;
    if (result.year !== year || !Array.isArray(result.days)) throw new Error('数据格式错误');
    data = result;
    heading.textContent = `${year} 年贡献 ${data.total} 次`;
    renderCalendar();
    renderYears();
    toggle.disabled = false;
    replay.disabled = false;
    playing = true;
    toggle.textContent = '暂停';
    const stamp = new Date(manifest.updatedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    status.textContent = `数据更新于 ${stamp}（北京时间）。图中紫色方块为贪吃蛇。`;
    const url = new URL(location.href);
    url.searchParams.set('year', year);
    history.replaceState(null, '', url);
    timer = setInterval(tick, 70);
  } catch (error) {
    if (request === generation) status.textContent = `加载失败：${error.message}。请刷新页面重试。`;
  }
}

toggle.addEventListener('click', () => {
  playing = !playing;
  toggle.textContent = playing ? '暂停' : '继续';
});
replay.addEventListener('click', () => { frame = 4; drawSnake(); playing = true; toggle.textContent = '暂停'; });

try {
  const response = await fetch('./data/manifest.json', { cache: 'no-cache' });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  manifest = await response.json();
  const requested = Number(new URL(location.href).searchParams.get('year'));
  const selected = manifest.years.includes(requested) ? requested : manifest.years[0];
  await selectYear(selected);
} catch (error) {
  heading.textContent = '贡献记录暂时无法加载';
  status.textContent = `请稍后刷新页面。${error.message}`;
}

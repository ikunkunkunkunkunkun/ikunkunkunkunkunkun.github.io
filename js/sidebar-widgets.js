(function (global, factory) {
  'use strict';

  const api = factory(global);

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  if (global && global.document) {
    global.sidebarWidgets = api;
    api.start();
  }
})(typeof window !== 'undefined' ? window : null, function (global) {
  'use strict';

  const BLOGGER_LOCATION = Object.freeze({ name: '重庆', lat: 29.563, lon: 106.5516 });
  const FORTUNE_STORAGE_KEY = 'ikun_daily_fortune_v1';
  const LOCATION_STORAGE_KEY = 'ikun_visitor_location_v1';
  const LOCATION_CACHE_MS = 6 * 60 * 60 * 1000;
  const LOCATION_ENDPOINT = 'https://ipwho.is/?lang=zh';

  const FORTUNES = Object.freeze([
    { level: '大吉', icon: '🚀', tone: 'gold', text: '今天适合把想法变成提交，灵感会在动手之后追上你。' },
    { level: '上吉', icon: '✨', tone: 'mint', text: '卡住的地方会出现新入口，换个工具可能比硬扛更快。' },
    { level: '中吉', icon: '🧭', tone: 'blue', text: '方向没问题，先完成最小一步，后面的路会自己亮起来。' },
    { level: '小吉', icon: '☕', tone: 'coral', text: '今天的好运比较安静，认真做完手边小事就能遇见。' },
    { level: '平', icon: '🌤️', tone: 'silver', text: '没有突然开挂，也没有意外报错，稳定本身就是好消息。' },
    { level: '宜摸鱼', icon: '🎧', tone: 'violet', text: '脑子正在后台更新，短暂休息比盯着空白屏幕更有效。' },
    { level: '宜备份', icon: '💾', tone: 'blue', text: '今天最可靠的玄学，是提交代码、同步文件并确认能恢复。' },
    { level: '谨慎提交', icon: '🧪', tone: 'coral', text: '看起来能跑不代表真的没事，测试会替你挡下一次返工。' }
  ]);

  function getDateKey(date) {
    const current = date || new Date();
    return [
      current.getFullYear(),
      String(current.getMonth() + 1).padStart(2, '0'),
      String(current.getDate()).padStart(2, '0')
    ].join('-');
  }

  function formatChineseDate(date) {
    const current = date || new Date();
    const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    return `${current.getMonth() + 1}月${current.getDate()}日 · ${weekdays[current.getDay()]}`;
  }

  function distanceKm(lat1, lon1, lat2, lon2) {
    const toRadians = (degree) => degree * Math.PI / 180;
    const earthRadius = 6371;
    const deltaLat = toRadians(lat2 - lat1);
    const deltaLon = toRadians(lon2 - lon1);
    const a = Math.sin(deltaLat / 2) ** 2
      + Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(deltaLon / 2) ** 2;
    return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function formatDistance(kilometers) {
    if (!Number.isFinite(kilometers)) return '--';
    if (kilometers < 1) return `${Math.max(1, Math.round(kilometers * 1000))} 米`;
    if (kilometers < 30) return `${Math.round(kilometers)} 公里 · 就在附近`;
    return `约 ${new Intl.NumberFormat('zh-CN').format(Math.round(kilometers))} 公里`;
  }

  function readStoredJson(key) {
    try {
      return JSON.parse(global.localStorage.getItem(key) || 'null');
    } catch (error) {
      return null;
    }
  }

  function writeStoredJson(key, value) {
    try {
      global.localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      // Storage can be unavailable in strict privacy mode; the widget still works for this page view.
    }
  }

  function randomIndex(length) {
    if (global.crypto && typeof global.crypto.getRandomValues === 'function') {
      const value = new Uint32Array(1);
      global.crypto.getRandomValues(value);
      return value[0] % length;
    }
    return Math.floor(Math.random() * length);
  }

  function renderFortune(root, fortune, isSaved) {
    const stage = root.querySelector('#fortuneStage');
    const button = root.querySelector('#fortuneDrawButton');
    if (!stage || !button) return;

    root.dataset.tone = fortune.tone;
    root.classList.add('is-drawn');
    stage.replaceChildren();

    const result = document.createElement('div');
    result.className = 'fortune-result';

    const badge = document.createElement('div');
    badge.className = 'fortune-result-badge';
    badge.innerHTML = `<span aria-hidden="true">${fortune.icon}</span><strong>${fortune.level}</strong>`;

    const text = document.createElement('p');
    text.textContent = fortune.text;

    const note = document.createElement('small');
    note.textContent = isSaved ? '今日签已保存，明天再来' : '签已收好，今天只许抽一次';

    result.append(badge, text, note);
    stage.appendChild(result);
    button.disabled = true;
    button.innerHTML = '<span aria-hidden="true">✓</span><span>今日已抽</span>';
  }

  function initFortune() {
    const root = document.querySelector('#card-daily-fortune');
    if (!root || root.dataset.ready === 'true') return;
    root.dataset.ready = 'true';

    const date = new Date();
    const dateLabel = root.querySelector('#fortuneDate');
    const button = root.querySelector('#fortuneDrawButton');
    if (dateLabel) dateLabel.textContent = formatChineseDate(date);
    if (!button) return;

    const saved = readStoredJson(FORTUNE_STORAGE_KEY);
    if (saved && saved.date === getDateKey(date) && Number.isInteger(saved.index) && FORTUNES[saved.index]) {
      renderFortune(root, FORTUNES[saved.index], true);
      return;
    }

    button.addEventListener('click', function () {
      const index = randomIndex(FORTUNES.length);
      writeStoredJson(FORTUNE_STORAGE_KEY, { date: getDateKey(new Date()), index });
      renderFortune(root, FORTUNES[index], false);
    }, { once: true });
  }

  function countryName(countryCode, fallback) {
    if (!countryCode || typeof Intl.DisplayNames !== 'function') return fallback || '';
    try {
      return new Intl.DisplayNames(['zh-CN'], { type: 'region' }).of(countryCode.toUpperCase()) || fallback || '';
    } catch (error) {
      return fallback || '';
    }
  }

  function normalizeLocation(payload) {
    if (!payload || payload.success !== true) return null;
    const lat = Number(payload.latitude);
    const lon = Number(payload.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;

    return {
      city: String(payload.city || '').trim(),
      region: String(payload.region || '').trim(),
      country: countryName(payload.country_code, payload.country),
      countryCode: String(payload.country_code || '').toUpperCase(),
      flag: payload.flag && payload.flag.emoji ? String(payload.flag.emoji) : '📍',
      lat,
      lon
    };
  }

  async function fetchLocation() {
    const controller = new AbortController();
    const timeout = global.setTimeout(() => controller.abort(), 8000);
    try {
      const response = await global.fetch(LOCATION_ENDPOINT, {
        cache: 'no-store',
        referrerPolicy: 'no-referrer',
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`Location request failed: ${response.status}`);
      const location = normalizeLocation(await response.json());
      if (!location) throw new Error('Location payload is incomplete');
      writeStoredJson(LOCATION_STORAGE_KEY, { time: Date.now(), location });
      return location;
    } finally {
      global.clearTimeout(timeout);
    }
  }

  function getCachedLocation() {
    const cached = readStoredJson(LOCATION_STORAGE_KEY);
    if (!cached || !cached.location || !Number.isFinite(cached.time)) return null;
    if (Date.now() - cached.time > LOCATION_CACHE_MS) return null;
    return cached.location;
  }

  function renderLocation(root, location) {
    const flag = root.querySelector('#visitorOriginFlag');
    const label = root.querySelector('.visitor-origin-label');
    const place = root.querySelector('#visitorOriginPlace');
    const detail = root.querySelector('#visitorOriginDetail');
    const distance = root.querySelector('#visitorDistanceValue');
    if (!flag || !label || !place || !detail || !distance) return;

    const primary = location.city || location.region || location.country || '远方';
    const secondary = [location.region, location.country]
      .filter(Boolean)
      .filter((item, index, list) => item !== primary && list.indexOf(item) === index)
      .join(' · ');
    const kilometers = distanceKm(BLOGGER_LOCATION.lat, BLOGGER_LOCATION.lon, location.lat, location.lon);

    root.dataset.state = 'ready';
    flag.textContent = location.flag;
    label.textContent = '你来自这里';
    place.textContent = primary;
    detail.textContent = secondary || 'IP 粗略定位 · 可能存在误差';
    distance.textContent = formatDistance(kilometers);
  }

  function renderLocationError(root) {
    const flag = root.querySelector('#visitorOriginFlag');
    const label = root.querySelector('.visitor-origin-label');
    const place = root.querySelector('#visitorOriginPlace');
    const detail = root.querySelector('#visitorOriginDetail');
    const distance = root.querySelector('#visitorDistanceValue');
    if (!flag || !label || !place || !detail || !distance) return;

    root.dataset.state = 'error';
    flag.textContent = '🛰️';
    label.textContent = '坐标信号暂时失联';
    place.textContent = '定位不可用';
    detail.textContent = '点击右上角重试，不影响浏览';
    distance.textContent = '--';
  }

  async function loadLocation(root, forceRefresh) {
    root.dataset.state = 'loading';
    const cached = forceRefresh ? null : getCachedLocation();
    if (cached) {
      renderLocation(root, cached);
      return;
    }

    try {
      renderLocation(root, await fetchLocation());
    } catch (error) {
      renderLocationError(root);
    }
  }

  function initLocation() {
    const root = document.querySelector('#card-visitor-origin');
    if (!root || root.dataset.ready === 'true') return;
    root.dataset.ready = 'true';

    const refresh = root.querySelector('#visitorRefreshButton');
    if (refresh) {
      refresh.addEventListener('click', function () {
        refresh.animate([
          { transform: 'rotate(0deg)' },
          { transform: 'rotate(360deg)' }
        ], { duration: 500, easing: 'ease-out' });
        loadLocation(root, true);
      });
    }

    loadLocation(root, false);
  }

  function init() {
    initFortune();
    initLocation();
  }

  function start() {
    if (!global || !global.document) return;
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
      init();
    }
    document.addEventListener('pjax:complete', function () {
      global.setTimeout(init, 0);
    });
  }

  return {
    BLOGGER_LOCATION,
    FORTUNES,
    distanceKm,
    formatDistance,
    getDateKey,
    normalizeLocation,
    start
  };
});

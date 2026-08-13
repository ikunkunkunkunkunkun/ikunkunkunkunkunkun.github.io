(function (global, factory) {
  'use strict';

  const api = factory(global);

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  }

  if (global && global.document) {
    global.siteStats51la = api;
    api.start();
  }
})(typeof window !== 'undefined' ? window : null, function (global) {
  'use strict';

  const VALUE_SELECTORS = Object.freeze({
    uv: '#site_stats_51la_value_site_uv',
    pv: '#site_stats_51la_value_site_pv'
  });
  const DISPLAY_FIELDS = '0,0,1,0,0,0,0,1';
  const values = { uv: '', pv: '' };
  let widgetRequested = false;
  let sourceRequested = false;

  function isPreviewHost(hostname) {
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  }

  function normalizeCount(value) {
    const text = String(value == null ? '' : value).trim();
    return /^[\d,.]+$/.test(text) ? text : '';
  }

  function parseWidgetSource(source) {
    const rows = {};
    const rowPattern = /<p><span>([0-6])<\/span><span>([\d,.]+)<\/span><\/p>/g;
    let match;
    while ((match = rowPattern.exec(String(source || ''))) !== null) {
      rows[match[1]] = normalizeCount(match[2]);
    }
    return {
      uv: rows[1] || '',
      pv: rows[6] || ''
    };
  }

  function setValue(selector, value) {
    const element = document.querySelector(selector);
    const count = normalizeCount(value);
    if (!element || count === '') return;
    element.textContent = count;
    element.title = '由 51.LA 提供，统计数据可能存在延迟';
  }

  function fillValues() {
    setValue(VALUE_SELECTORS.uv, values.uv);
    setValue(VALUE_SELECTORS.pv, values.pv);
  }

  function applyValues(nextValues) {
    if (!nextValues) return false;
    const uv = normalizeCount(nextValues.uv);
    const pv = normalizeCount(nextValues.pv);
    if (uv === '' || pv === '') return false;
    values.uv = uv;
    values.pv = pv;
    fillValues();
    return true;
  }

  function readRenderedWidget(host) {
    if (!host) return false;
    const nextValues = { uv: '', pv: '' };
    const rows = host.querySelectorAll('.la-data-widget__container p');
    rows.forEach((row) => {
      const label = row.textContent || '';
      const number = [...row.querySelectorAll('span')]
        .map((span) => normalizeCount(span.textContent))
        .find((value) => value !== '') || '';
      if (/今日访问人数/.test(label)) nextValues.uv = number;
      if (/总访问量/.test(label)) nextValues.pv = number;
    });
    return applyValues(nextValues);
  }

  async function readWidgetSource(widgetSrc) {
    if (sourceRequested) return false;
    sourceRequested = true;
    try {
      const response = await global.fetch(widgetSrc, {
        cache: 'no-store',
        mode: 'cors',
        referrerPolicy: 'no-referrer'
      });
      if (!response.ok) throw new Error(`51.LA widget request failed: ${response.status}`);
      return applyValues(parseWidgetSource(await response.text()));
    } catch (error) {
      return false;
    }
  }

  function showFallback() {
    Object.values(VALUE_SELECTORS).forEach((selector) => {
      const element = document.querySelector(selector);
      if (element && element.querySelector('.anzhiyu-icon-spinner')) {
        element.textContent = '--';
        element.title = '51.LA 暂时没有返回统计数据';
      }
    });
  }

  function startCollector(config) {
    if (!config || !config.id || isPreviewHost(global.location.hostname)) return;
    if (global.LA && typeof global.LA.init === 'function') return;
    if (document.getElementById('LA_COLLECT')) return;

    const collector = document.createElement('script');
    collector.id = 'LA_COLLECT';
    collector.charset = 'UTF-8';
    collector.src = config.collectUrl || 'https://sdk.51.la/js-sdk-pro.min.js';
    collector.onload = function () {
      if (global.LA && typeof global.LA.init === 'function') {
        global.LA.init({ id: config.id, ck: config.id, hashMode: true });
      }
    };
    document.head.appendChild(collector);
  }

  function mountWidget(config) {
    fillValues();
    if (widgetRequested || !config || !config.id) return;
    widgetRequested = true;

    const widgetSrc = `${config.widgetUrl}/${config.id}/quote.js?theme=0&col=true&f=12&display=${DISPLAY_FIELDS}`;
    const host = document.createElement('span');
    host.id = 'site-stats-51la-widget-source';
    host.hidden = true;
    document.body.appendChild(host);

    const observer = new MutationObserver(function () {
      if (readRenderedWidget(host)) observer.disconnect();
    });
    observer.observe(host, { childList: true, subtree: true });

    const widget = document.createElement('script');
    widget.id = 'LA-DATA-WIDGET';
    widget.crossOrigin = 'anonymous';
    widget.charset = 'UTF-8';
    widget.src = widgetSrc;
    widget.onload = function () {
      if (!readRenderedWidget(host)) readWidgetSource(widgetSrc);
    };
    widget.onerror = function () {
      readWidgetSource(widgetSrc);
    };
    host.appendChild(widget);

    global.setTimeout(function () {
      if (values.uv === '' || values.pv === '') readWidgetSource(widgetSrc);
    }, 2000);
    global.setTimeout(function () {
      observer.disconnect();
      if (values.uv === '' || values.pv === '') showFallback();
    }, 10000);
  }

  function init() {
    const config = global.siteStats51laConfig;
    if (!config || !config.id) return;
    startCollector(config);
    mountWidget(config);
  }

  function start() {
    if (!global || !global.document) return;
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
      init();
    }
    document.addEventListener('pjax:complete', function () {
      global.setTimeout(function () {
        fillValues();
        init();
      }, 0);
    });
  }

  return {
    isPreviewHost,
    normalizeCount,
    parseWidgetSource,
    start
  };
});

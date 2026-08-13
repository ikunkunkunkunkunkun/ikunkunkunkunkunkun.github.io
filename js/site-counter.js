(function () {
  const config = window.siteCounterConfig || {};
  const endpoint = String(config.endpoint || '').trim();
  const selectors = Object.assign({
    sitePv: '#site_counter_value_site_pv',
    siteUv: '#site_counter_value_site_uv'
  }, config.selectors || {});

  const storageKey = 'site-counter-visitor-id';
  let lastCountKey = '';

  function getVisitorId() {
    try {
      let visitorId = window.localStorage.getItem(storageKey);
      if (!visitorId) {
        const random = window.crypto && window.crypto.randomUUID
          ? window.crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        visitorId = `v-${random}`;
        window.localStorage.setItem(storageKey, visitorId);
      }
      return visitorId;
    } catch (error) {
      return `v-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    }
  }

  function formatNumber(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) return '--';
    return number.toLocaleString();
  }

  function setText(selector, value) {
    document.querySelectorAll(selector).forEach((item) => {
      item.textContent = value;
    });
  }

  function setFallback() {
    setText(selectors.sitePv, '--');
    setText(selectors.siteUv, '--');
  }

  function fillStats(data) {
    setText(selectors.sitePv, formatNumber(data.site_pv));
    setText(selectors.siteUv, formatNumber(data.site_uv));
  }

  async function countVisit() {
    if (!endpoint) {
      setFallback();
      return;
    }

    const countKey = `${location.origin}${location.pathname}${location.search}`;
    if (lastCountKey === countKey) return;
    lastCountKey = countKey;

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        mode: 'cors',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          site: location.hostname,
          path: location.pathname,
          visitorId: getVisitorId()
        })
      });

      if (!response.ok) throw new Error(`Counter request failed: ${response.status}`);

      const data = await response.json();
      if (!data || data.ok === false) throw new Error('Counter response is not ok');

      fillStats(data);
    } catch (error) {
      lastCountKey = '';
      setFallback();
      if (window.console && console.warn) console.warn('[site-counter]', error);
    }
  }

  window.loadSiteCounter = countVisit;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', countVisit);
  } else {
    countVisit();
  }

  document.addEventListener('pjax:complete', countVisit);
})();

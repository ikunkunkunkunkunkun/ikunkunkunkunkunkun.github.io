(function () {
  const DEFAULT_API_BASE = 'https://friend-api.12700188.xyz';
  const STATUS_TEXT = {
    pending: '待审核',
    approved: '已通过',
    rejected: '未通过'
  };

  function qs(root, selector) {
    return root.querySelector(selector);
  }

  function qsa(root, selector) {
    return Array.from(root.querySelectorAll(selector));
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[char]);
  }

  function normalizeApiBase(value) {
    return String(value || DEFAULT_API_BASE).replace(/\/+$/, '');
  }

  function getPayload(form) {
    const formData = new FormData(form);
    const payload = {};
    for (const [key, value] of formData.entries()) {
      payload[key] = String(value || '').trim();
    }
    return payload;
  }

  function setMessage(root, text, tone) {
    const el = qs(root, '[data-friend-message]');
    if (!el) return;
    el.textContent = text || '';
    el.dataset.tone = tone || '';
  }

  function getStatusClass(status) {
    if (status === 'rejected') return 'is-rejected';
    return 'is-pending';
  }

  function normalizeLink(value) {
    return String(value || '').trim().replace(/\/+$/, '').toLowerCase();
  }

  function renderApprovedLinks(root, items) {
    const flink = root.closest('.flink');
    const listEl = flink?.querySelector('.anzhiyu-flink-list');
    if (!flink || !listEl) return;

    listEl.querySelectorAll('[data-friend-approved-item]').forEach(item => item.remove());

    const staticItems = Array.from(listEl.querySelectorAll('.flink-list-item'));
    const staticLinks = new Set(staticItems.map(item => {
      return normalizeLink(item.querySelector('a.cf-friends-link')?.getAttribute('href'));
    }).filter(Boolean));
    const approvedItems = items.filter(item => {
      return item.status === 'approved' && !staticLinks.has(normalizeLink(item.link));
    });

    const markup = approvedItems.map(item => {
      const id = escapeHtml(item.id);
      const name = escapeHtml(item.name);
      const description = escapeHtml(item.description || '这个朋友还没有留下简介。');
      const link = escapeHtml(item.link);
      const avatar = escapeHtml(item.avatar);
      return `
        <div class="flink-list-item" data-friend-approved-item="${id}">
          <a class="cf-friends-link" href="${link}" title="${name}" target="_blank" rel="external nofollow noopener">
            <img class="cf-friends-avatar no-lightbox" src="${avatar}" alt="${name}" loading="lazy" decoding="async">
            <div class="flink-item-info">
              <div class="flink-item-name cf-friends-name">${name}</div>
              <div class="flink-item-desc" title="${description}">${description}</div>
            </div>
          </a>
        </div>
      `;
    }).join('');

    listEl.insertAdjacentHTML('beforeend', markup);
    listEl.querySelectorAll('[data-friend-approved-item] img').forEach(image => {
      image.addEventListener('error', () => {
        image.src = '/img/404.jpg';
      }, { once: true });
    });

    const heading = Array.from(flink.children).find(element => element.tagName === 'H2');
    if (heading) {
      const baseTitle = heading.dataset.friendBaseTitle || heading.textContent.replace(/\s*\(\d+\)\s*$/, '');
      heading.dataset.friendBaseTitle = baseTitle;
      heading.textContent = `${baseTitle}(${staticItems.length + approvedItems.length})`;
    }
  }

  function renderList(root, items) {
    const listEl = qs(root, '[data-friend-list]');
    const countEl = qs(root, '[data-friend-count]');
    if (!listEl) return;

    const applicationItems = items.filter(item => item.status !== 'approved');

    if (countEl) countEl.textContent = `共 ${applicationItems.length} 条`;

    if (!applicationItems.length) {
      listEl.innerHTML = '<div class="friend-apply-empty">暂时没有匹配的友链申请。</div>';
      return;
    }

    listEl.innerHTML = applicationItems.map(item => {
      const status = item.status || 'pending';
      const statusText = STATUS_TEXT[status] || STATUS_TEXT.pending;
      const name = escapeHtml(item.name);
      const description = escapeHtml(item.description);
      return `
        <article class="friend-apply-card">
          <div class="friend-apply-card-top">
            <span class="friend-apply-name" title="${name}">${name}</span>
            <span class="friend-apply-status ${getStatusClass(status)}">${statusText}</span>
          </div>
          <p>${description || '这个朋友还没有留下简介。'}</p>
        </article>
      `;
    }).join('');
  }

  async function loadApplications(root) {
    const apiBase = normalizeApiBase(root.dataset.apiBase);
    const status = qs(root, '[data-friend-status]')?.value || 'all';
    const search = qs(root, '[data-friend-search]')?.value || '';
    const countEl = qs(root, '[data-friend-count]');
    const listEl = qs(root, '[data-friend-list]');

    if (countEl) countEl.textContent = '加载中';
    if (listEl) listEl.innerHTML = '<div class="friend-apply-empty">正在读取申请列表...</div>';

    try {
      const response = await fetch(`${apiBase}/api/applications`, {
        headers: { Accept: 'application/json' }
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.message || '读取失败');
      const allItems = Array.isArray(data.items) ? data.items : [];
      const approvedItems = allItems.filter(item => item.status === 'approved');
      const normalizedSearch = search.trim().toLowerCase();
      const applicationItems = allItems.filter(item => {
        if (item.status === 'approved') return false;
        if (status !== 'all' && item.status !== status) return false;
        if (!normalizedSearch) return true;
        return `${item.name} ${item.description}`.toLowerCase().includes(normalizedSearch);
      });
      renderApprovedLinks(root, approvedItems);
      renderList(root, applicationItems);
    } catch (error) {
      if (countEl) countEl.textContent = '未连接';
      if (listEl) {
        listEl.innerHTML = `<div class="friend-apply-empty">申请系统后端暂未连接：${escapeHtml(error.message)}</div>`;
      }
    }
  }

  async function submitApplication(root, form) {
    const apiBase = normalizeApiBase(root.dataset.apiBase);
    const submitButton = qs(form, '.friend-apply-submit');
    const payload = getPayload(form);

    setMessage(root, '正在提交...', 'info');
    if (submitButton) submitButton.disabled = true;

    try {
      const response = await fetch(`${apiBase}/api/applications`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.message || '提交失败');
      form.reset();
      qsa(root, '[data-friend-condition]').forEach(input => { input.checked = false; });
      updateSubmitState(root);
      setMessage(root, '提交成功，申请已进入待审核列表。', 'success');
      await loadApplications(root);
    } catch (error) {
      setMessage(root, `提交失败：${error.message}`, 'error');
      updateSubmitState(root);
    }
  }

  function updateSubmitState(root) {
    const conditions = qsa(root, '[data-friend-condition]');
    const submitButton = qs(root, '.friend-apply-submit');
    const panel = qs(root, '[data-friend-panel]');
    const enabled = conditions.length > 0 && conditions.every(input => input.checked);
    if (submitButton) submitButton.disabled = !enabled;
    if (panel) panel.hidden = !enabled;
    root.classList.toggle('is-conditions-ready', enabled);
  }

  function showConditions(root) {
    const conditionsPanel = qs(root, '[data-friend-conditions]');
    if (conditionsPanel) {
      conditionsPanel.hidden = false;
      conditionsPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function bindMode(root) {
    const modeInput = qs(root, 'input[name="type"]');
    qsa(root, '[data-friend-mode]').forEach(button => {
      button.addEventListener('click', () => {
        qsa(root, '[data-friend-mode]').forEach(item => item.classList.remove('is-active'));
        button.classList.add('is-active');
        if (modeInput) modeInput.value = button.dataset.friendMode || 'new';
      });
    });
  }

  function initOne(root) {
    if (root.dataset.friendApplyReady === 'true') return;
    root.dataset.friendApplyReady = 'true';
    const form = qs(root, '[data-friend-form]');
    const conditionsPanel = qs(root, '[data-friend-conditions]');
    const panel = qs(root, '[data-friend-panel]');

    if (conditionsPanel) conditionsPanel.hidden = true;
    if (panel) panel.hidden = true;

    qs(root, '[data-friend-launch]')?.addEventListener('click', () => showConditions(root));

    qsa(root, '[data-friend-condition]').forEach(input => {
      input.addEventListener('change', () => updateSubmitState(root));
    });

    bindMode(root);
    updateSubmitState(root);

    if (form) {
      form.addEventListener('submit', event => {
        event.preventDefault();
        submitApplication(root, form);
      });
    }

    const reloadList = () => loadApplications(root);
    qs(root, '[data-friend-status]')?.addEventListener('change', reloadList);
    qs(root, '[data-friend-search]')?.addEventListener('input', () => {
      clearTimeout(root.friendApplySearchTimer);
      root.friendApplySearchTimer = setTimeout(reloadList, 250);
    });

    loadApplications(root);
  }

  function initFriendApply() {
    qsa(document, '[data-friend-apply]').forEach(initOne);
  }

  document.addEventListener('DOMContentLoaded', initFriendApply);
  document.addEventListener('pjax:complete', initFriendApply);
  window.friendApplyInit = initFriendApply;
})();

(function () {
  const DEFAULT_API_BASE = 'https://friend-api.12700188.xyz';
  const TOKEN_KEY = 'friendAdminToken';
  const STATUS_TEXT = {
    pending: '待审核',
    approved: '已通过',
    rejected: '未通过'
  };

  function qsa(root, selector) {
    return Array.from(root.querySelectorAll(selector));
  }

  function qs(root, selector) {
    return root.querySelector(selector);
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

  function apiBase(root) {
    return String(root.dataset.apiBase || DEFAULT_API_BASE).replace(/\/+$/, '');
  }

  function token(root) {
    return qs(root, '[data-friend-admin-token]')?.value.trim() || localStorage.getItem(TOKEN_KEY) || '';
  }

  function setMessage(root, text, tone) {
    const el = qs(root, '[data-friend-admin-message]');
    if (!el) return;
    el.textContent = text || '';
    el.dataset.tone = tone || '';
  }

  async function request(root, path, options) {
    const response = await fetch(`${apiBase(root)}${path}`, {
      ...options,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token(root)}`,
        ...(options && options.headers ? options.headers : {})
      }
    });
    if (path.endsWith('/link-yml')) {
      if (!response.ok) throw new Error(await response.text());
      return response.text();
    }
    const data = await response.json();
    if (!response.ok || !data.ok) throw new Error(data.message || '请求失败');
    return data;
  }

  function render(root, items) {
    const list = qs(root, '[data-friend-admin-list]');
    if (!list) return;
    if (!items.length) {
      list.innerHTML = '<div class="friend-admin-empty">没有匹配的申请。</div>';
      return;
    }
    list.innerHTML = items.map(item => `
      <article class="friend-admin-card" data-id="${escapeHtml(item.id)}">
        <div class="friend-admin-card-head">
          <h2>${escapeHtml(item.name)}</h2>
          <span>${STATUS_TEXT[item.status] || item.status}</span>
        </div>
        <dl>
          <dt>网站</dt><dd><a href="${escapeHtml(item.link)}" target="_blank" rel="noopener">${escapeHtml(item.link)}</a></dd>
          <dt>Logo</dt><dd><a href="${escapeHtml(item.avatar)}" target="_blank" rel="noopener">${escapeHtml(item.avatar)}</a></dd>
          <dt>简介</dt><dd>${escapeHtml(item.description)}</dd>
          <dt>邮箱</dt><dd>${escapeHtml(item.email)}</dd>
          <dt>截图</dt><dd>${item.screenshot ? `<a href="${escapeHtml(item.screenshot)}" target="_blank" rel="noopener">${escapeHtml(item.screenshot)}</a>` : '无'}</dd>
          <dt>RSS</dt><dd>${item.rss ? `<a href="${escapeHtml(item.rss)}" target="_blank" rel="noopener">${escapeHtml(item.rss)}</a>` : '自动发现'}</dd>
        </dl>
        <div class="friend-admin-actions">
          <button type="button" data-action="approved">通过</button>
          <button type="button" data-action="rejected">拒绝</button>
          <button type="button" data-action="pending">改回待审</button>
          <button type="button" data-action="delete">删除</button>
        </div>
      </article>
    `).join('');

    qsa(list, '[data-action]').forEach(button => {
      button.addEventListener('click', async () => {
        const card = button.closest('[data-id]');
        const id = card?.dataset.id;
        const action = button.dataset.action;
        if (!id || !action) return;
        if (action === 'delete' && !confirm('确认删除这条申请？')) return;
        try {
          if (action === 'delete') {
            await request(root, `/api/admin/applications/${id}`, { method: 'DELETE' });
          } else {
            await request(root, `/api/admin/applications/${id}`, {
              method: 'PATCH',
              body: JSON.stringify({ status: action })
            });
          }
          setMessage(root, '操作成功。', 'success');
          await load(root);
        } catch (error) {
          setMessage(root, `操作失败：${error.message}`, 'error');
        }
      });
    });
  }

  async function load(root, status) {
    const selected = status || root.dataset.status || 'pending';
    root.dataset.status = selected;
    try {
      const data = await request(root, `/api/admin/applications?status=${encodeURIComponent(selected)}`);
      render(root, data.items || []);
      setMessage(root, `已加载 ${data.items.length} 条。`, 'success');
    } catch (error) {
      setMessage(root, `加载失败：${error.message}`, 'error');
    }
  }

  function initOne(root) {
    if (root.dataset.friendAdminReady === 'true') return;
    root.dataset.friendAdminReady = 'true';
    const input = qs(root, '[data-friend-admin-token]');
    if (input) input.value = localStorage.getItem(TOKEN_KEY) || '';

    qs(root, '[data-friend-admin-save]')?.addEventListener('click', () => {
      const value = input?.value.trim() || '';
      if (!value) {
        setMessage(root, '先输入管理员 Token。', 'error');
        return;
      }
      localStorage.setItem(TOKEN_KEY, value);
      load(root, 'pending');
    });

    qsa(root, '[data-friend-admin-filter]').forEach(button => {
      button.addEventListener('click', () => load(root, button.dataset.friendAdminFilter || 'pending'));
    });

    qs(root, '[data-friend-admin-export]')?.addEventListener('click', async () => {
      try {
        const yml = await request(root, '/api/admin/link-yml', { method: 'GET' });
        const panel = qs(root, '[data-friend-admin-export-panel]');
        const textarea = qs(root, '[data-friend-admin-yml]');
        if (textarea) textarea.value = yml;
        if (panel) panel.hidden = false;
        setMessage(root, '已生成 YAML。', 'success');
      } catch (error) {
        setMessage(root, `导出失败：${error.message}`, 'error');
      }
    });

    if (token(root)) load(root, 'pending');
  }

  function init() {
    qsa(document, '[data-friend-admin]').forEach(initOne);
  }

  document.addEventListener('DOMContentLoaded', init);
  document.addEventListener('pjax:complete', init);
})();

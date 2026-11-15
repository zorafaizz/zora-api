import { loadCatalog, filterCatalog } from './catalog.js';

export async function copyText(text, button, statusEl) {
  try {
    await navigator.clipboard.writeText(text);
    if (button) {
      button.dataset.copied = 'true';
      clearTimeout(button.__copyTimer);
      button.__copyTimer = setTimeout(() => {
        delete button.dataset.copied;
      }, 1400);
    }
    if (statusEl) statusEl.textContent = 'Copied to clipboard.';
    return true;
  } catch {
    if (statusEl) {
      statusEl.textContent = 'Clipboard unavailable. Select the text and copy manually.';
    }
    return false;
  }
}

export function initCommandPalette({ onSelectEndpoint } = {}) {
  let backdrop = document.querySelector('#cmd-backdrop');
  if (backdrop?.dataset.bound === 'true') return;

  if (!backdrop) {
    backdrop = document.createElement('div');
    backdrop.id = 'cmd-backdrop';
    backdrop.className = 'cmd-backdrop';
    backdrop.hidden = true;
    backdrop.innerHTML = `
      <div class="cmd-dialog" role="dialog" aria-modal="true" aria-label="Jump to endpoint or tool">
        <div class="cmd-input-row">
          <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="7" cy="7" r="4.75"></circle>
            <path d="M10.5 10.5L14 14"></path>
          </svg>
          <input id="cmd-input" class="cmd-input" type="search" autocomplete="off" spellcheck="false" placeholder="Jump to endpoint, path, or action…" aria-label="Search endpoints and actions" />
          <kbd class="kbd" data-close-cmd>ESC</kbd>
        </div>
        <div id="cmd-list" class="cmd-list" role="listbox" aria-label="Command results"></div>
        <div class="cmd-foot">
          <span><kbd class="kbd">↑</kbd> <kbd class="kbd">↓</kbd> Navigate · <kbd class="kbd">↵</kbd> Open</span>
          <span>42 routes indexed</span>
        </div>
      </div>
    `;
    document.body.append(backdrop);
  }
  backdrop.dataset.bound = 'true';

  const input = backdrop.querySelector('#cmd-input');
  const list = backdrop.querySelector('#cmd-list');
  let items = [];
  let entries = [];
  let activeIndex = 0;
  let lastFocused = null;

  const staticActions = [
    {
      kind: 'action',
      label: 'Open API Workbench',
      sub: '/explorer.html',
      badge: 'Page',
      run: () => { location.href = '/explorer.html'; }
    },
    {
      kind: 'action',
      label: 'Open Scalar OpenAPI Reference',
      sub: '/docs',
      badge: 'Docs',
      run: () => { location.href = '/docs'; }
    },
    {
      kind: 'action',
      label: 'Inspect Raw OpenAPI 3.1 Spec',
      sub: '/api/v1/openapi.json',
      badge: 'JSON',
      run: () => { location.href = '/api/v1/openapi.json'; }
    },
    {
      kind: 'action',
      label: 'Toggle Color Theme (Dark / Light)',
      sub: 'Switch interface contrast',
      badge: 'Theme',
      run: () => {
        const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
        window.__kgTheme?.set(next);
        close();
      }
    }
  ];

  function render() {
    const q = input.value.trim();
    const matchedEndpoints = filterCatalog(items, { search: q }).slice(0, 24).map((ep) => ({
      kind: 'endpoint',
      label: ep.title,
      sub: ep.executionPath,
      method: ep.method,
      badge: ep.public ? 'Public' : `${ep.credits} cr`,
      ep,
      run: () => {
        close();
        if (typeof onSelectEndpoint === 'function') {
          onSelectEndpoint(ep.id);
        } else {
          location.href = '/explorer.html?endpoint=' + encodeURIComponent(ep.id);
        }
      }
    }));

    const matchedActions = staticActions.filter((a) =>
      !q || `${a.label} ${a.sub} ${a.badge}`.toLowerCase().includes(q.toLowerCase())
    );

    entries = q ? [...matchedEndpoints, ...matchedActions] : [...matchedEndpoints.slice(0, 10), ...matchedActions];
    if (activeIndex >= entries.length) activeIndex = 0;

    list.replaceChildren();
    if (!entries.length) {
      const empty = document.createElement('div');
      empty.className = 'cmd-empty';
      empty.textContent = 'No matching endpoints or commands.';
      list.append(empty);
      return;
    }

    entries.forEach((entry, idx) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'cmd-item' + (idx === activeIndex ? ' is-active' : '');
      btn.setAttribute('role', 'option');
      btn.setAttribute('aria-selected', String(idx === activeIndex));

      const left = document.createElement('span');
      left.className = 'cmd-item-main';

      if (entry.method) {
        const m = document.createElement('span');
        m.className = 'method method-' + entry.method.toLowerCase();
        m.textContent = entry.method;
        left.append(m);
      }

      const title = document.createElement('span');
      title.className = 'cmd-item-title';
      title.textContent = entry.label;

      const sub = document.createElement('code');
      sub.className = 'cmd-item-sub';
      sub.textContent = entry.sub;

      left.append(title, sub);

      const badge = document.createElement('span');
      badge.className = 'chip ' + (entry.badge === 'Public' ? 'chip-public' : 'chip-muted');
      badge.textContent = entry.badge;

      btn.append(left, badge);
      btn.addEventListener('mouseenter', () => {
        activeIndex = idx;
        updateActive();
      });
      btn.addEventListener('click', () => entry.run());
      list.append(btn);
    });
  }

  function updateActive() {
    [...list.querySelectorAll('.cmd-item')].forEach((el, idx) => {
      const on = idx === activeIndex;
      el.classList.toggle('is-active', on);
      el.setAttribute('aria-selected', String(on));
      if (on) el.scrollIntoView({ block: 'nearest' });
    });
  }

  async function open() {
    if (!backdrop.hidden) return;
    lastFocused = document.activeElement;
    backdrop.hidden = false;
    document.body.classList.add('cmd-open');
    input.value = '';
    activeIndex = 0;
    if (!items.length) {
      try {
        items = await loadCatalog();
      } catch {
        items = [];
      }
    }
    render();
    requestAnimationFrame(() => input.focus());
  }

  function close() {
    if (backdrop.hidden) return;
    backdrop.hidden = true;
    document.body.classList.remove('cmd-open');
    if (lastFocused && typeof lastFocused.focus === 'function') {
      lastFocused.focus();
    }
  }

  input.addEventListener('input', () => {
    activeIndex = 0;
    render();
  });

  backdrop.addEventListener('mousedown', (e) => {
    if (e.target === backdrop) close();
  });

  backdrop.querySelector('.cmd-input-row .kbd, [data-close-cmd]')?.addEventListener('click', close);

  document.querySelectorAll('.cmd-trigger, [data-open-cmd]').forEach((btn) => {
    btn.addEventListener('click', open);
  });

  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (backdrop.hidden) open();
      else close();
      return;
    }
    if (!backdrop.hidden) {
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (entries.length) {
          activeIndex = (activeIndex + 1) % entries.length;
          updateActive();
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (entries.length) {
          activeIndex = (activeIndex - 1 + entries.length) % entries.length;
          updateActive();
        }
      } else if (e.key === 'Enter' && entries[activeIndex]) {
        e.preventDefault();
        entries[activeIndex].run();
      }
      return;
    }
    if (
      e.key === '/' &&
      !e.metaKey &&
      !e.ctrlKey &&
      !e.altKey &&
      !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName || '')
    ) {
      const searchTarget = document.querySelector('#search, #sidebar-filter');
      if (searchTarget) {
        e.preventDefault();
        searchTarget.focus();
      }
    }
  });

  return { open, close };
}

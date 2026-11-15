import { loadCatalog, renderCatalog, SAMPLE_PARAMS } from './catalog.js';
import { makeSnippet } from './request.js';
import { copyText, initCommandPalette } from './command.js';

initCommandPalette();

const PRESETS = [
  {
    id: 'tool.dns',
    label: 'DNS Lookup',
    sampleEnvelope: {
      status: true,
      creator: 'KanjutGede',
      latency: '18ms',
      result: {
        domain: 'itsfaiz.my.id',
        type: 'A',
        records: ['104.21.48.1', '172.67.182.1']
      }
    }
  },
  {
    id: 'dl.tiktok',
    label: 'TikTok Media',
    sampleEnvelope: {
      status: true,
      creator: 'KanjutGede',
      latency: '412ms',
      result: {
        provider: 'tikwm',
        title: 'Sample short-form video',
        duration: 19,
        video_hd: 'https://cdn.example.invalid/video-hd.mp4',
        audio: 'https://cdn.example.invalid/audio.mp3'
      }
    }
  },
  {
    id: 'stalk.github',
    label: 'GitHub Profile',
    sampleEnvelope: {
      status: true,
      creator: 'KanjutGede',
      latency: '94ms',
      result: {
        login: 'torvalds',
        name: 'Linus Torvalds',
        public_repos: 8,
        followers: 228000
      }
    }
  },
  {
    id: 'solve.turnstile',
    label: 'Turnstile Solver',
    sampleEnvelope: {
      status: true,
      creator: 'KanjutGede',
      latency: '2840ms',
      result: {
        solved: true,
        token: '0.turnstile_verification_token_excerpt',
        elapsed_ms: 2811
      }
    }
  }
];

const searchInput = document.querySelector('#search');
const categorySelect = document.querySelector('#category');
const catalogContainer = document.querySelector('.catalog');
const catalogStatus = document.querySelector('.catalog-status');
const categoryPills = document.querySelector('#category-pills');
const scopeButtons = [...document.querySelectorAll('[data-scope]')];

let allItems = [];
let activeScope = 'all';
let activePresetId = PRESETS[0].id;
let activeLang = 'cURL';
let activePreviewTab = 'request';

document.querySelectorAll('[data-copy-value]').forEach((btn) => {
  btn.addEventListener('click', () => {
    copyText(btn.dataset.copyValue, btn);
  });
});

function renderQuickstart() {
  const preset = PRESETS.find((p) => p.id === activePresetId) || PRESETS[0];
  const ep = allItems.find((item) => item.id === preset.id) || {
    id: 'tool.dns',
    executionPath: '/api/v1/tools/dns',
    method: 'GET',
    public: true
  };

  const codeEl = document.querySelector('#quickstart-code');
  const openWorkbenchLink = document.querySelector('#quickstart-open');
  const authTag = document.querySelector('#quickstart-auth');
  const routeTag = document.querySelector('#quickstart-route');

  if (openWorkbenchLink) {
    openWorkbenchLink.href = '/explorer.html?endpoint=' + encodeURIComponent(ep.id);
  }
  if (routeTag) {
    routeTag.textContent = `${ep.method} ${ep.executionPath}`;
  }
  if (authTag) {
    authTag.textContent = ep.public ? 'Public · 0 cr' : `Bearer Key · ${ep.credits || 1} cr`;
    authTag.className = 'chip ' + (ep.public ? 'chip-public' : 'chip-auth');
  }

  if (!codeEl) return;
  if (activePreviewTab === 'response') {
    codeEl.textContent = JSON.stringify(preset.sampleEnvelope, null, 2);
  } else {
    const sampleVals = SAMPLE_PARAMS[ep.id] || {};
    codeEl.textContent = makeSnippet(ep, sampleVals, activeLang);
  }
}

document.querySelectorAll('[data-preset]').forEach((btn) => {
  btn.addEventListener('click', () => {
    activePresetId = btn.dataset.preset;
    document.querySelectorAll('[data-preset]').forEach((el) => {
      const on = el === btn;
      el.classList.toggle('is-active', on);
      el.setAttribute('aria-selected', String(on));
    });
    renderQuickstart();
  });
});

document.querySelectorAll('[data-qs-lang]').forEach((btn) => {
  btn.addEventListener('click', () => {
    activeLang = btn.dataset.qsLang;
    activePreviewTab = 'request';
    document.querySelectorAll('[data-qs-lang]').forEach((el) => {
      el.classList.toggle('is-active', el === btn);
    });
    document.querySelectorAll('[data-qs-tab]').forEach((el) => {
      el.classList.toggle('is-active', el.dataset.qsTab === 'request');
    });
    renderQuickstart();
  });
});

document.querySelectorAll('[data-qs-tab]').forEach((btn) => {
  btn.addEventListener('click', () => {
    activePreviewTab = btn.dataset.qsTab;
    document.querySelectorAll('[data-qs-tab]').forEach((el) => {
      el.classList.toggle('is-active', el === btn);
    });
    renderQuickstart();
  });
});

document.querySelector('.sample')?.addEventListener('click', () => {
  activePreviewTab = 'response';
  document.querySelectorAll('[data-qs-tab]').forEach((el) => {
    el.classList.toggle('is-active', el.dataset.qsTab === 'response');
  });
  renderQuickstart();
  const sampleStatus = document.querySelector('.sample-status');
  if (sampleStatus) {
    sampleStatus.textContent = 'Sample 200 OK envelope loaded locally. Zero network calls made.';
  }
});

document.querySelector('#quickstart-copy')?.addEventListener('click', (e) => {
  const code = document.querySelector('#quickstart-code')?.textContent || '';
  copyText(code, e.currentTarget, document.querySelector('.sample-status'));
});

function syncDirectory() {
  const count = renderCatalog(allItems, catalogContainer, {
    search: searchInput.value,
    category: categorySelect.value,
    scope: activeScope,
    limit: allItems.length
  });
  catalogStatus.textContent = count
    ? `Showing ${count} of ${allItems.length} endpoints`
    : 'No matching endpoints. Adjust search query or reset filters.';

  if (categoryPills) {
    categoryPills.querySelectorAll('[data-cat]').forEach((pill) => {
      pill.classList.toggle('is-active', pill.dataset.cat === categorySelect.value);
    });
  }
}

scopeButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    activeScope = btn.dataset.scope;
    scopeButtons.forEach((el) => {
      const on = el === btn;
      el.classList.toggle('is-active', on);
      el.setAttribute('aria-pressed', String(on));
    });
    syncDirectory();
  });
});

document.querySelector('#reset-filters')?.addEventListener('click', () => {
  searchInput.value = '';
  categorySelect.value = '';
  activeScope = 'all';
  scopeButtons.forEach((el) => {
    const on = el.dataset.scope === 'all';
    el.classList.toggle('is-active', on);
    el.setAttribute('aria-pressed', String(on));
  });
  syncDirectory();
  searchInput.focus();
});

loadCatalog()
  .then((items) => {
    allItems = items;
    const totalEl = document.querySelector('#stat-total');
    const pubEl = document.querySelector('#stat-public');
    const keyEl = document.querySelector('#stat-protected');
    const pubCount = items.filter((e) => e.public).length;
    if (totalEl) totalEl.textContent = String(items.length);
    if (pubEl) pubEl.textContent = String(pubCount);
    if (keyEl) keyEl.textContent = String(items.length - pubCount);

    const categories = [...new Set(items.map((e) => e.category))];
    for (const name of categories) {
      const count = items.filter((e) => e.category === name).length;
      categorySelect.append(new Option(`${name} (${count})`, name));
    }

    if (categoryPills) {
      const allBtn = document.createElement('button');
      allBtn.type = 'button';
      allBtn.className = 'cat-pill is-active';
      allBtn.dataset.cat = '';
      allBtn.textContent = `All (${items.length})`;
      allBtn.addEventListener('click', () => {
        categorySelect.value = '';
        syncDirectory();
      });
      categoryPills.append(allBtn);

      for (const name of categories) {
        const count = items.filter((e) => e.category === name).length;
        const pill = document.createElement('button');
        pill.type = 'button';
        pill.className = 'cat-pill';
        pill.dataset.cat = name;
        pill.textContent = `${name} (${count})`;
        pill.addEventListener('click', () => {
          categorySelect.value = name;
          syncDirectory();
        });
        categoryPills.append(pill);
      }
    }

    searchInput.addEventListener('input', syncDirectory);
    categorySelect.addEventListener('change', syncDirectory);

    renderQuickstart();
    syncDirectory();
  })
  .catch(() => {
    catalogStatus.textContent =
      'Endpoint catalog unavailable. Open Scalar reference (/docs) or reload to retry.';
  });

renderQuickstart();

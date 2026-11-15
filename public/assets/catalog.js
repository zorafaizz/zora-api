let catalogPromise;

export function loadCatalog() {
  if (!catalogPromise) {
    catalogPromise = fetch('/assets/catalog.json', { credentials: 'omit' }).then((res) => {
      if (!res.ok) throw new Error('Catalog unavailable');
      return res.json();
    });
  }
  return catalogPromise;
}

export const SAMPLE_PARAMS = {
  'dl.aio': { url: 'https://www.tiktok.com/@tiktok/video/7106594312292453675' },
  'dl.tiktok': { url: 'https://www.tiktok.com/@tiktok/video/7106594312292453675' },
  'dl.youtube': { url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ' },
  'dl.instagram': { url: 'https://www.instagram.com/reel/C8p5x1oy1A0/' },
  'dl.facebook': { url: 'https://www.facebook.com/watch/?v=10153231379946729' },
  'dl.twitter': { url: 'https://x.com/jack/status/20' },
  'dl.spotify': { url: 'https://open.spotify.com/track/4cOdK2wGLETKBW3PvgPWqT' },
  'dl.pinterest': { url: 'https://www.pinterest.com/pin/99360735500167749/' },
  'dl.soundcloud': { q: 'ambient synthwave' },
  'dl.sfile': { url: 'https://sfile.mobi/example' },
  'dl.mediafire': { url: 'https://www.mediafire.com/file/example/archive.zip/file' },
  'dl.pixeldrain': { url: 'https://pixeldrain.com/u/example' },
  'ai.chat': { prompt: 'Explain HTTP 429 exponential backoff in three concise bullet points.' },
  'media.hd': { url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=640' },
  'media.uhd': { url: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=640' },
  'info.sholat': { kota: 'jakarta' },
  'util.lirik': { artist: 'Radiohead', title: 'Creep' },
  'util.shortlink': { url: 'https://api.itsfaiz.my.id/docs' },
  'search.gsmarena': { q: 'iPhone 16 Pro' },
  'search.anime': { q: 'Steins Gate' },
  'tool.tempmail.inbox': { email: 'demo@1secmail.com' },
  'stalk.github': { username: 'torvalds' },
  'util.iplookup': { ip: '1.1.1.1' },
  'tool.presetam': { url: 'https://alight.link/example' },
  'search.manga': { q: 'Vagabond' },
  'search.wikipedia': { q: 'Representational state transfer', lang: 'en' },
  'search.pinterest': { q: 'minimalist architecture' },
  'search.applemusic': { q: 'Daft Punk Random Access Memories' },
  'search.steam': { q: 'Factorio' },
  'search.sticker': { q: 'developer cat' },
  'search.soundboard': { q: 'notification' },
  'stalk.npm': { pkg: 'express' },
  'tool.translate': { text: 'Service healthy and ready to accept requests.', to: 'id', from: 'en' },
  'tool.dns': { domain: 'itsfaiz.my.id', type: 'A' },
  'tool.ssweb': { url: 'https://itsfaiz.my.id' },
  'solve.waf': { url: 'https://example.com' },
  'solve.turnstile': { url: 'https://example.com', sitekey: '0x4AAAAAAADnPIDROrmt1Wwj' }
};

function createArrowSvg() {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 16 16');
  svg.setAttribute('width', '14');
  svg.setAttribute('height', '14');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '1.5');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('ep-arrow');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', 'M3.5 8h9M8.5 4l4 4-4 4');
  svg.append(path);
  return svg;
}

export function filterCatalog(items, { search = '', category = '', scope = 'all' } = {}) {
  const term = search.trim().toLowerCase();
  return items.filter((ep) => {
    if (category && ep.category !== category) return false;
    if (scope === 'public' && !ep.public) return false;
    if (scope === 'protected' && ep.public) return false;
    if (!term) return true;
    const haystack = [
      ep.id,
      ep.title,
      ep.path,
      ep.executionPath,
      ep.method,
      ep.description,
      ep.category,
      ep.subcategory,
      ...(ep.aliases || []),
      ...(ep.providers || []),
      ...(ep.parameters || []).map((p) => p.name)
    ]
      .join(' ')
      .toLowerCase();
    return haystack.includes(term);
  });
}

function formatTtl(sec) {
  const n = Number(sec) || 0;
  if (n >= 86400) return `${Math.round(n / 86400)}d cache`;
  if (n >= 3600) return `${Math.round(n / 3600)}h cache`;
  if (n >= 60) return `${Math.round(n / 60)}m cache`;
  return `${n}s cache`;
}

export function renderCatalog(
  items,
  container,
  { search = '', category = '', scope = 'all', limit = items.length } = {}
) {
  const filtered = filterCatalog(items, { search, category, scope });
  container.replaceChildren();

  const frag = document.createDocumentFragment();
  filtered.slice(0, limit).forEach((ep, index) => {
    const link = document.createElement('a');
    link.className = 'endpoint';
    link.href = '/explorer.html?endpoint=' + encodeURIComponent(ep.id);
    link.style.setProperty('--row-idx', String(Math.min(index, 14)));

    const routeLine = document.createElement('div');
    routeLine.className = 'ep-route';

    const method = document.createElement('span');
    method.className = 'method method-' + ep.method.toLowerCase();
    method.textContent = ep.method;

    const pathEl = document.createElement('code');
    pathEl.className = 'ep-path';
    pathEl.textContent = ep.executionPath;

    routeLine.append(method, pathEl);

    const textLine = document.createElement('div');
    textLine.className = 'ep-body';

    const title = document.createElement('strong');
    title.className = 'ep-title';
    title.textContent = ep.title;

    const desc = document.createElement('span');
    desc.className = 'ep-desc';
    desc.textContent = ep.description;

    textLine.append(title, desc);

    const right = document.createElement('div');
    right.className = 'ep-meta';

    const catChip = document.createElement('span');
    catChip.className = 'chip chip-muted ep-cat-chip';
    catChip.textContent = ep.category;
    right.append(catChip);

    if (ep.cacheTtl > 0) {
      const cacheChip = document.createElement('span');
      cacheChip.className = 'chip chip-mono';
      cacheChip.textContent = formatTtl(ep.cacheTtl);
      right.append(cacheChip);
    }

    const authChip = document.createElement('span');
    authChip.className = ep.public ? 'chip chip-public' : 'chip chip-auth';
    authChip.textContent = ep.supported === false ? 'Native bridge' : ep.public ? 'Public' : `${ep.credits} cr · Key`;
    right.append(authChip, createArrowSvg());

    link.append(routeLine, textLine, right);
    frag.append(link);
  });

  container.append(frag);
  return filtered.length;
}

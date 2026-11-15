import { loadCatalog, SAMPLE_PARAMS, filterCatalog } from './catalog.js';
import { makeRequest, makeSnippet, redact, readBounded, formatResponse } from './request.js';
import { copyText, initCommandPalette } from './command.js';

const $ = (s) => document.querySelector(s);

let catalog = [];
let active;
let controller;
let run = 0;
let responseText = '';
let responseValue;
let hasResponse = false;
let timeout;

const values = () =>
  Object.fromEntries(
    [...$('.parameters').querySelectorAll('input')].map((el) => [el.name, el.value])
  );

function setStatusBadge(code, ok) {
  const badge = $('#http-badge');
  if (!badge) return;
  if (!code) {
    badge.textContent = 'IDLE';
    badge.className = 'http-badge http-idle';
    return;
  }
  badge.textContent = `HTTP ${code}`;
  badge.className =
    'http-badge ' +
    (ok ? 'http-ok' : code === 429 ? 'http-warn' : 'http-err');
}

function say(text, state = 'idle', error = false) {
  const statusEl = $('.status');
  statusEl.textContent = text;
  statusEl.dataset.kind = error ? 'error' : state === 'success' ? 'ok' : 'status';
}

function lock(busy) {
  const execBtn = $('.execute');
  execBtn.disabled = busy || !active || active.supported === false;
  $('.cancel').disabled = !busy;
  $('#endpoint').disabled = busy;
  execBtn.setAttribute('aria-busy', String(busy));
  const labelSpan = execBtn.querySelector('.exec-label');
  if (labelSpan) labelSpan.textContent = busy ? 'Executing…' : 'Execute';
  const responsePanel = $('.response-panel');
  if (responsePanel) responsePanel.dataset.loading = busy ? 'true' : 'false';
}

function clearResponse() {
  responseText = '';
  responseValue = undefined;
  hasResponse = false;
  setStatusBadge(null, false);
  $('.response').textContent = 'Awaiting execution — press Ctrl/Cmd + Enter or click Execute.';
  $('.response-tree').replaceChildren();
  const metaEl = $('.response-meta');
  metaEl.textContent = 'No request sent.';
  metaEl.hidden = true;
  $('.headers').textContent = 'No response headers captured yet.';
  const hdrCount = $('#header-count');
  if (hdrCount) hdrCount.textContent = '0';
  $('.copy-response').disabled = true;
  $('.copy-status').textContent = '';
}

function updateLiveUrl() {
  if (!active) return;
  const methodBadge = $('#active-method');
  if (methodBadge) {
    methodBadge.textContent = active.method;
    methodBadge.className = 'method method-' + active.method.toLowerCase();
  }
  if (active.supported === false) {
    $('.request-line').textContent = `${active.method} ${active.executionPath}`;
    return;
  }
  try {
    const req = makeRequest(active, values());
    $('.request-line').textContent = req.path;
  } catch {
    $('.request-line').textContent = active.executionPath;
  }
}

function snippets() {
  if (!active) return;
  updateLiveUrl();
  if (active.supported === false) {
    $('.snippet').textContent =
      'This native bridge endpoint expects an automated protocol payload. Refer to the OpenAPI specification (/docs); browser execution is disabled.';
    return;
  }
  const key = $('#api-key').value.trim();
  $('.snippet').textContent = redact(makeSnippet(active, values(), $('#language').value), key);
}

function renderSpecMeta(ep) {
  const container = $('#spec-chips');
  if (!container) return;
  container.replaceChildren();

  const items = [
    {
      text: ep.public ? 'Public · 0 credits' : `Bearer Auth · ${ep.credits} credit${ep.credits === 1 ? '' : 's'}`,
      cls: ep.public ? 'chip-public' : 'chip-auth'
    },
    {
      text: `Policy: ${ep.policy}`,
      cls: 'chip-muted'
    },
    {
      text: `Deadline: ${Math.round((ep.deadline || 15000) / 1000)}s`,
      cls: 'chip-mono'
    }
  ];

  if (ep.cacheTtl > 0) {
    items.push({
      text: `Cache TTL: ${ep.cacheTtl}s`,
      cls: 'chip-mono'
    });
  }

  for (const item of items) {
    const span = document.createElement('span');
    span.className = `chip ${item.cls}`;
    span.textContent = item.text;
    container.append(span);
  }

  const providerLine = $('#provider-chain');
  if (providerLine) {
    if (ep.providers?.length) {
      providerLine.hidden = false;
      providerLine.textContent = `Failover chain: ${ep.providers.join(' → ')}`;
    } else {
      providerLine.hidden = true;
      providerLine.textContent = '';
    }
  }

  const aliasLine = $('#alias-line');
  if (aliasLine) {
    if (ep.aliases?.length) {
      aliasLine.hidden = false;
      aliasLine.textContent = `Legacy routes: ${ep.aliases.join(', ')}`;
    } else {
      aliasLine.hidden = true;
      aliasLine.textContent = '';
    }
  }
}

function syncSidebarActive() {
  const rail = $('#endpoint-rail-list');
  if (!rail || !active) return;
  rail.querySelectorAll('[data-ep-id]').forEach((btn) => {
    const on = btn.dataset.epId === active.id;
    btn.classList.toggle('is-active', on);
    if (on) btn.setAttribute('aria-current', 'true');
    else btn.removeAttribute('aria-current');
  });
}

function renderSidebar(filterText = '') {
  const rail = $('#endpoint-rail-list');
  if (!rail) return;
  rail.replaceChildren();

  const filtered = filterCatalog(catalog, { search: filterText });
  if (!filtered.length) {
    const empty = document.createElement('p');
    empty.className = 'rail-empty';
    empty.textContent = 'No endpoints match filter.';
    rail.append(empty);
    return;
  }

  const grouped = new Map();
  for (const ep of filtered) {
    if (!grouped.has(ep.category)) grouped.set(ep.category, []);
    grouped.get(ep.category).push(ep);
  }

  const frag = document.createDocumentFragment();
  for (const [cat, eps] of grouped.entries()) {
    const group = document.createElement('div');
    group.className = 'rail-group';

    const heading = document.createElement('div');
    heading.className = 'rail-group-title';
    heading.textContent = `${cat} (${eps.length})`;
    group.append(heading);

    for (const ep of eps) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'rail-item' + (active?.id === ep.id ? ' is-active' : '');
      btn.dataset.epId = ep.id;

      const top = document.createElement('span');
      top.className = 'rail-item-top';

      const title = document.createElement('span');
      title.className = 'rail-item-title';
      title.textContent = ep.title;

      const scope = document.createElement('span');
      scope.className = 'rail-scope ' + (ep.public ? 'is-pub' : 'is-key');
      scope.textContent = ep.public ? 'PUB' : 'KEY';

      top.append(title, scope);

      const pathCode = document.createElement('code');
      pathCode.className = 'rail-item-path';
      pathCode.textContent = ep.executionPath;

      btn.append(top, pathCode);
      btn.addEventListener('click', () => {
        $('#endpoint').value = ep.id;
        choose();
      });
      group.append(btn);
    }
    frag.append(group);
  }
  rail.append(frag);
}

function choose() {
  controller?.abort();
  clearTimeout(timeout);
  run++;
  active = catalog.find((e) => e.id === $('#endpoint').value) || catalog[0];
  if (!active) return;

  clearResponse();
  $('.parameters').replaceChildren();
  $('#api-key').type = 'password';
  const visBtn = $('#toggle-key-vis');
  if (visBtn) visBtn.textContent = 'Reveal';
  $('.key-field').hidden = active.public && !$('#api-key').value.trim();
  const quotaOut = $('#quota-readout');
  if (quotaOut) {
    quotaOut.hidden = true;
    quotaOut.textContent = '';
  }

  const fillBtn = $('#fill-sample');
  if (fillBtn) {
    fillBtn.hidden = !active.parameters.length || !SAMPLE_PARAMS[active.id];
  }

  if (!active.parameters.length) {
    const emptyParam = document.createElement('p');
    emptyParam.className = 'no-params';
    emptyParam.textContent = 'No query parameters required for this endpoint.';
    $('.parameters').append(emptyParam);
  } else {
    for (const param of active.parameters) {
      const fieldWrap = document.createElement('div');
      fieldWrap.className = 'param-row';

      const label = document.createElement('label');
      label.className = 'param-label';

      const headerRow = document.createElement('span');
      headerRow.className = 'param-head';

      const nameCode = document.createElement('code');
      nameCode.className = 'param-name';
      nameCode.textContent = param.name;

      const reqBadge = document.createElement('span');
      reqBadge.className = param.required ? 'param-req is-required' : 'param-req';
      reqBadge.textContent = param.required ? 'required' : 'optional';

      const typeBadge = document.createElement('span');
      typeBadge.className = 'param-type';
      typeBadge.textContent = param.schema?.type || 'string';

      headerRow.append(nameCode, typeBadge, reqBadge);

      const input = document.createElement('input');
      input.name = param.name;
      input.required = !!param.required;
      input.autocomplete = 'off';
      input.spellcheck = false;
      input.type =
        param.schema?.type === 'integer' || param.schema?.type === 'number'
          ? 'number'
          : 'text';
      const sampleHint = SAMPLE_PARAMS[active.id]?.[param.name];
      input.placeholder =
        param.name === 'url'
          ? 'https://...'
          : sampleHint
            ? `e.g. ${sampleHint}`
            : `Enter ${param.name}`;

      label.append(headerRow, input);

      const hint = document.createElement('p');
      hint.className = 'hint param-hint';
      hint.textContent = param.description || '';

      fieldWrap.append(label);
      if (param.description) fieldWrap.append(hint);
      $('.parameters').append(fieldWrap);

      input.addEventListener('input', () => {
        input.removeAttribute('aria-invalid');
        snippets();
      });
    }
  }

  $('#endpoint-title').textContent = active.title;
  $('.endpoint-description').textContent = active.description;
  $('.billing').textContent = active.public
    ? 'Public endpoint — executes without an API key or credit deduction.'
    : `Protected endpoint — requires Bearer Authorization header (${active.policy}, default ${active.credits} credit).`;

  $('.field-help').textContent =
    active.id === 'sys.health'
      ? 'Returns status, creator, uptime, node_version, memory, cluster, total_endpoints, and provider_health.'
      : 'Standard JSON envelope: { status: boolean, creator: "KanjutGede", latency: string, result: object | array }.';

  renderSpecMeta(active);
  syncSidebarActive();
  history.replaceState(null, '', '/explorer.html?endpoint=' + encodeURIComponent(active.id));
  lock(false);
  snippets();
  say(
    active.supported === false
      ? 'Native bridge protocol endpoint — inspect via OpenAPI reference (/docs).'
      : 'Ready. No request has been sent.'
  );
}

function tokenJson(text) {
  const frag = document.createDocumentFragment();
  const regex =
    /"(?:\\.|[^"\\])*"(?:\s*:)?|\b(?:true|false|null)\b|-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/g;
  let previous = 0;
  let tokens = 0;
  for (const match of text.matchAll(regex)) {
    if (++tokens > 2000) return document.createTextNode(text);
    frag.append(document.createTextNode(text.slice(previous, match.index)));
    const span = document.createElement('span');
    span.className = match[0].endsWith(':')
      ? 'json-key'
      : match[0][0] === '"'
        ? 'json-string'
        : /true|false|null/.test(match[0])
          ? 'json-bool'
          : 'json-number';
    span.textContent = match[0];
    frag.append(span);
    previous = match.index + match[0].length;
  }
  frag.append(document.createTextNode(text.slice(previous)));
  return frag;
}

function renderResponse() {
  const raw = $('.response');
  const tree = $('.response-tree');
  raw.hidden = $('#response-view').value === 'tree';
  tree.hidden = !raw.hidden;
  tree.replaceChildren();

  if (!raw.hidden) {
    const display =
      responseText.length > 200000
        ? responseText.slice(0, 200000) + '\n[Display truncated. Copy JSON for full payload.]'
        : responseText;
    raw.replaceChildren(
      responseValue !== undefined && display.length <= 100000
        ? tokenJson(display)
        : document.createTextNode(display)
    );
    return;
  }

  raw.replaceChildren();
  if (responseValue === undefined) {
    tree.textContent = responseText;
    return;
  }

  let nodes = 0;
  function add(value, name, depth = 0) {
    if (++nodes > 400 || depth > 12) {
      const note = document.createElement('p');
      note.textContent = 'Tree node limit reached. Switch to Formatted JSON for full output.';
      return note;
    }
    if (value && typeof value === 'object') {
      const details = document.createElement('details');
      const summary = document.createElement('summary');
      summary.textContent = `${name} ${
        Array.isArray(value) ? '[' + value.length + ']' : '{' + Object.keys(value).length + '}'
      }`;
      details.append(summary);
      details.addEventListener('toggle', () => {
        if (!details.open || details.dataset.loaded) return;
        details.dataset.loaded = 'true';
        for (const [k, v] of Object.entries(value)) {
          details.append(add(v, k, depth + 1));
          if (nodes > 400) break;
        }
      });
      if (depth === 0) details.open = true;
      return details;
    }
    const leaf = document.createElement('div');
    leaf.className = 'leaf';
    leaf.textContent = name + ': ' + JSON.stringify(value);
    return leaf;
  }
  tree.append(add(responseValue, 'response'));
}

$('form').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!active || $('.execute').disabled) return;

  for (const input of $('.parameters').querySelectorAll('input')) {
    if ((input.required && !input.value.trim()) || !input.checkValidity()) {
      input.setAttribute('aria-invalid', 'true');
      input.focus();
      say('Check parameter: ' + input.name + '.', 'invalid parameters', true);
      return;
    }
  }

  const key = $('#api-key').value.trim();
  if (!active.public && !key) {
    $('#api-key').focus();
    say('Enter an API key before executing this protected endpoint.', 'authentication failure', true);
    return;
  }

  const request = makeRequest(active, values());
  const version = ++run;
  controller = new AbortController();
  const currentController = controller;
  const started = performance.now();
  let timedOut = false;

  clearResponse();
  lock(true);
  say('Sending request…', 'loading');

  timeout = setTimeout(
    () => {
      timedOut = true;
      currentController.abort();
    },
    Math.min(120000, Math.max(15000, (active.deadline || 25000) + 5000))
  );

  try {
    const response = await fetch(request.path, {
      method: request.method,
      headers: key && !active.public ? { Authorization: 'Bearer ' + key } : {},
      signal: currentController.signal,
      credentials: 'omit',
      cache: 'no-store',
      redirect: 'error'
    });
    const text = await readBounded(response);
    if (version !== run) return;

    const formatted = formatResponse(text, key);
    responseText = formatted.text;
    responseValue = formatted.value;
    hasResponse = true;
    $('.copy-response').disabled = false;

    const elapsed = Math.round(performance.now() - started);
    const bytes = new TextEncoder().encode(text).byteLength;
    const ok = response.ok && responseValue?.status !== false;

    setStatusBadge(response.status, ok);
    const metaEl = $('.response-meta');
    metaEl.hidden = false;
    metaEl.textContent = `HTTP ${response.status} · ${elapsed} ms · ${bytes} B`;

    const allowed = [
      'content-type',
      'x-request-id',
      'x-ratelimit-limit',
      'x-ratelimit-remaining',
      'x-ratelimit-reset',
      'retry-after',
      'x-quota-daily-remaining',
      'x-quota-test-remaining',
      'x-credit-remaining'
    ];
    const presentHeaders = allowed.filter((h) => response.headers.has(h));
    const hdrCount = $('#header-count');
    if (hdrCount) hdrCount.textContent = String(presentHeaders.length);

    $('.headers').textContent =
      presentHeaders
        .map((h) => h + ': ' + redact(response.headers.get(h), key))
        .join('\n') || 'No displayable headers.';

    renderResponse();
    say(
      ok
        ? 'Response received.'
        : response.status === 401 || response.status === 403
          ? 'Authentication failed. Check your key and permissions.'
          : response.status === 429
            ? 'Rate limit or quota reached. Check the response and retry-after header.'
            : 'The request returned an error. Inspect the response before retrying.',
      ok
        ? 'success'
        : response.status === 401 || response.status === 403
          ? 'authentication failure'
          : response.status === 429
            ? 'rate limit'
            : 'server error',
      !ok
    );
  } catch (error) {
    if (version !== run) return;
    clearResponse();
    say(
      timedOut
        ? 'Request timed out. The server may still complete accepted work.'
        : error.name === 'AbortError'
          ? 'Request cancelled. Accepted work may still complete.'
          : error.message?.includes('too large')
            ? 'Response exceeds the 1 MB display limit. Use your integration code to inspect it safely.'
            : 'Network request failed. Check connectivity or endpoint availability, then retry explicitly.',
      error.name === 'AbortError' ? 'cancelled' : 'server error',
      true
    );
  } finally {
    if (version === run) {
      clearTimeout(timeout);
      controller = undefined;
      lock(false);
    }
  }
});

window.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    if (active && !$('.execute').disabled) {
      e.preventDefault();
      $('form').requestSubmit();
    }
  }
});

$('#fill-sample')?.addEventListener('click', () => {
  if (!active) return;
  const sample = SAMPLE_PARAMS[active.id];
  if (!sample) return;
  for (const input of $('.parameters').querySelectorAll('input')) {
    if (sample[input.name] !== undefined) {
      input.value = String(sample[input.name]);
      input.removeAttribute('aria-invalid');
    }
  }
  snippets();
  say('Sample parameter values populated. Click Execute to run.');
});

$('#toggle-key-vis')?.addEventListener('click', (e) => {
  const keyInput = $('#api-key');
  const nextType = keyInput.type === 'password' ? 'text' : 'password';
  keyInput.type = nextType;
  e.currentTarget.textContent = nextType === 'password' ? 'Reveal' : 'Mask';
});

$('#check-quota')?.addEventListener('click', async (e) => {
  const key = $('#api-key').value.trim();
  const quotaOut = $('#quota-readout');
  if (!key) {
    $('#api-key').focus();
    say('Enter an API key first to inspect account quota.', 'authentication failure', true);
    return;
  }
  const btn = e.currentTarget;
  btn.disabled = true;
  if (quotaOut) {
    quotaOut.hidden = false;
    quotaOut.textContent = 'Querying /api/v1/account…';
  }
  try {
    const res = await fetch('/api/v1/account', {
      headers: { Authorization: 'Bearer ' + key },
      credentials: 'omit',
      cache: 'no-store'
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (quotaOut) quotaOut.textContent = redact(body.message || body.error || `HTTP ${res.status}`, key);
    } else {
      const r = body.result || body;
      const tier = r.plan || r.tier || r.status || 'active';
      const credits = r.credits ?? r.wallet_balance ?? r.balance ?? '—';
      if (quotaOut) quotaOut.textContent = `Key active · Plan: ${tier} · Credits: ${credits}`;
    }
  } catch {
    if (quotaOut) quotaOut.textContent = 'Account endpoint unreachable.';
  } finally {
    btn.disabled = false;
  }
});

$('.cancel').addEventListener('click', () => {
  controller?.abort();
  clearTimeout(timeout);
  run++;
  controller = undefined;
  lock(false);
  say('Request cancelled. Accepted work may still complete.', 'cancelled');
});

$('.clear-key').addEventListener('click', () => {
  controller?.abort();
  clearTimeout(timeout);
  run++;
  controller = undefined;
  $('#api-key').value = '';
  $('#api-key').type = 'password';
  const visBtn = $('#toggle-key-vis');
  if (visBtn) visBtn.textContent = 'Reveal';
  if (active?.public) $('.key-field').hidden = true;
  const quotaOut = $('#quota-readout');
  if (quotaOut) {
    quotaOut.hidden = true;
    quotaOut.textContent = '';
  }
  clearResponse();
  lock(false);
  snippets();
  say('Key and response cleared.');
});

$('#api-key').addEventListener('input', () => {
  controller?.abort();
  clearTimeout(timeout);
  run++;
  controller = undefined;
  clearResponse();
  lock(false);
  snippets();
});

$('#endpoint').addEventListener('change', choose);
$('#language').addEventListener('change', snippets);
$('#response-view').addEventListener('change', () => {
  if (hasResponse) renderResponse();
});

$('#sidebar-filter')?.addEventListener('input', (e) => {
  renderSidebar(e.target.value);
});

$('#copy-url')?.addEventListener('click', (e) => {
  if (!active) return;
  const full = 'https://api.itsfaiz.my.id' + $('.request-line').textContent;
  copyText(full, e.currentTarget, $('.copy-status'));
});

$('.copy-response').addEventListener('click', (e) => {
  if (hasResponse) copyText(responseText, e.currentTarget, $('.copy-status'));
});

$('.copy-code').addEventListener('click', (e) => {
  copyText($('.snippet').textContent, e.currentTarget, $('.copy-status'));
});

initCommandPalette({
  onSelectEndpoint(id) {
    if (catalog.some((e) => e.id === id)) {
      $('#endpoint').value = id;
      choose();
    }
  }
});

loadCatalog()
  .then((items) => {
    catalog = items;
    $('#endpoint').replaceChildren();
    for (const e of items) {
      $('#endpoint').append(new Option(`${e.title} (${e.executionPath})`, e.id));
    }
    const id = new URLSearchParams(location.search).get('endpoint');
    $('#endpoint').value = items.some((e) => e.id === id) ? id : 'dl.tiktok';
    renderSidebar('');
    choose();
  })
  .catch(() =>
    say(
      'Endpoint catalog unavailable. Reload to retry or open the OpenAPI reference (/docs).',
      'server error',
      true
    )
  );

window.addEventListener('pagehide', () => {
  run++;
  controller?.abort();
  clearTimeout(timeout);
  $('#api-key').value = '';
  responseText = '';
  responseValue = undefined;
  clearResponse();
});

import { ENDPOINT_REGISTRY } from '../../registry/endpoints.js';

const URL_PARAM_IDS = new Set([
  'dl.aio',
  'dl.tiktok',
  'dl.youtube',
  'dl.instagram',
  'dl.facebook',
  'dl.twitter',
  'dl.spotify',
  'dl.pinterest',
  'dl.sfile',
  'dl.mediafire',
  'dl.pixeldrain',
  'media.hd',
  'media.uhd',
  'util.shortlink',
  'tool.presetam',
  'tool.ssweb',
  'solve.waf',
  'solve.turnstile'
]);

const QUERY_PARAM_IDS = new Set([
  'dl.soundcloud',
  'search.gsmarena',
  'search.anime',
  'search.manga',
  'search.wikipedia',
  'search.pinterest',
  'search.applemusic',
  'search.steam',
  'search.sticker',
  'search.soundboard'
]);

function buildParametersForEndpoint(ep) {
  const params = [];

  if (URL_PARAM_IDS.has(ep.id)) {
    params.push({
      name: 'url',
      in: 'query',
      required: true,
      description: 'Target URL input',
      schema: { type: 'string' }
    });
  }

  if (QUERY_PARAM_IDS.has(ep.id)) {
    params.push({
      name: 'q',
      in: 'query',
      required: true,
      description: 'Kata kunci pencarian',
      schema: { type: 'string' }
    });
  }

  if (ep.id === 'search.wikipedia') {
    params.push({
      name: 'lang',
      in: 'query',
      required: false,
      description: 'Kode bahasa Wikipedia (contoh: id, en)',
      schema: { type: 'string', default: 'id' }
    });
  }

  if (ep.id === 'ai.chat') {
    params.push({
      name: 'prompt',
      in: 'query',
      required: true,
      description: 'AI prompt message',
      schema: { type: 'string' }
    });
  }

  if (ep.id === 'info.sholat') {
    params.push({
      name: 'kota',
      in: 'query',
      required: false,
      description: 'Nama kota/kabupaten di Indonesia',
      schema: { type: 'string', default: 'jakarta' }
    });
  }

  if (ep.id === 'util.lirik') {
    params.push(
      {
        name: 'artist',
        in: 'query',
        required: true,
        description: 'Nama penyanyi / grup musik',
        schema: { type: 'string' }
      },
      {
        name: 'title',
        in: 'query',
        required: true,
        description: 'Judul lagu',
        schema: { type: 'string' }
      }
    );
  }

  if (ep.id === 'tool.tempmail.inbox') {
    params.push({
      name: 'email',
      in: 'query',
      required: true,
      description: 'Alamat email sementara dari endpoint /tempmail',
      schema: { type: 'string' }
    });
  }

  if (ep.id === 'stalk.github') {
    params.push({
      name: 'username',
      in: 'query',
      required: true,
      description: 'Username GitHub publik',
      schema: { type: 'string' }
    });
  }

  if (ep.id === 'stalk.npm') {
    params.push({
      name: 'pkg',
      in: 'query',
      required: true,
      description: 'Nama package NPM (contoh: express atau @fastify/cors)',
      schema: { type: 'string' }
    });
  }

  if (ep.id === 'util.iplookup') {
    params.push({
      name: 'ip',
      in: 'query',
      required: false,
      description: 'Alamat IPv4 / IPv6 publik',
      schema: { type: 'string' }
    });
  }

  if (ep.id === 'tool.translate') {
    params.push(
      {
        name: 'text',
        in: 'query',
        required: true,
        description: 'Teks sumber yang akan diterjemahkan',
        schema: { type: 'string' }
      },
      {
        name: 'to',
        in: 'query',
        required: false,
        description: 'Kode bahasa tujuan (default: id)',
        schema: { type: 'string', default: 'id' }
      },
      {
        name: 'from',
        in: 'query',
        required: false,
        description: 'Kode bahasa asal (default: auto)',
        schema: { type: 'string', default: 'auto' }
      }
    );
  }

  if (ep.id === 'tool.dns') {
    params.push(
      {
        name: 'domain',
        in: 'query',
        required: true,
        description: 'Nama domain target (contoh: itsfaiz.my.id)',
        schema: { type: 'string' }
      },
      {
        name: 'type',
        in: 'query',
        required: false,
        description: 'Tipe record DNS (A, AAAA, MX, TXT, NS, CNAME, CAA)',
        schema: { type: 'string', default: 'A' }
      }
    );
  }

  if (ep.id === 'solve.turnstile') {
    params.push({
      name: 'sitekey',
      in: 'query',
      required: true,
      description: 'Cloudflare Turnstile sitekey',
      schema: { type: 'string' }
    });
  }

  return params;
}

export function generateOpenAPISpec() {
  const paths = {};

  for (const ep of ENDPOINT_REGISTRY) {
    const method = ep.method === 'ALL' ? 'get' : ep.method.toLowerCase();
    const openApiPath = ep.path;

    if (!paths[openApiPath]) {
      paths[openApiPath] = {};
    }

    paths[openApiPath][method] = {
      summary: ep.metadata.title,
      description: `${ep.metadata.summary}\n\n**Billing Policy:** ${ep.billing_policy.type} (${ep.billing_policy.default_credits} credit)\n**Resource Class:** ${ep.resource_class}\n**Providers:** ${(ep.provider_list || []).join(' -> ')}`,
      tags: ep.metadata.tags || [ep.category],
      parameters: buildParametersForEndpoint(ep),
      responses: {
        '200': {
          description: 'Successful response',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status: { type: 'boolean', example: true },
                  creator: { type: 'string', example: 'KanjutGede' },
                  latency: { type: 'string', example: '45ms' },
                  result: { type: 'object' },
                  data: { type: 'object' }
                }
              }
            }
          }
        },
        '400': { description: 'Bad Request / SSRF Blocked' },
        '401': { description: 'Unauthorized / Invalid API Key' },
        '402': { description: 'Payment Required / Insufficient Credits' },
        '429': { description: 'Daily Quota Exceeded / Rate Limited' }
      },
      security: ep.scopes?.includes('public') ? [] : [{ BearerAuth: [] }]
    };
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'KanjutGede API',
      version: '2.0.0',
      description:
        'High-Performance Multi-Engine Media Scraper, Search Discovery, AI Inference, and Network Automation Platform.\n\nDomain: `api.itsfaiz.my.id`',
      contact: {
        name: 'Zora Faiz',
        url: 'https://itsfaiz.my.id'
      }
    },
    servers: [
      {
        url: 'https://api.itsfaiz.my.id',
        description: 'Production HTTPS API'
      },
      {
        url: 'http://127.0.0.1:3095',
        description: 'Localhost Development'
      }
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'zora_live_<id>_<secret>'
        }
      }
    },
    paths
  };
}

export function renderScalarHtml(specUrl = '/api/v1/openapi.json') {
  const routeCount = Object.keys(generateOpenAPISpec().paths || {}).length;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <title>KanjutGede API Docs — Build Without Guesswork</title>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="description" content="Searchable API contracts, authentication rules, request examples, and response schemas for KanjutGede API." />
  <meta name="theme-color" content="#090909" />
  <link rel="icon" type="image/png" href="/icon.png" />
  <link rel="preload" href="/assets/fonts/bricolage-grotesque-latin.woff2" as="font" type="font/woff2" crossorigin />
  <link rel="preload" href="/assets/fonts/plus-jakarta-sans-latin.woff2" as="font" type="font/woff2" crossorigin />
  <script>
    (() => {
      let saved; try { saved = localStorage.getItem('kg-celestial-theme'); } catch {}
      document.documentElement.dataset.theme = saved === 'dark' || saved === 'light' ? saved : matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
    })();
  </script>
  <style>
    @font-face { font-family: 'Bricolage Grotesque'; src: url('/assets/fonts/bricolage-grotesque-latin.woff2') format('woff2'); font-weight: 600 800; font-display: swap; }
    @font-face { font-family: 'Plus Jakarta Sans'; src: url('/assets/fonts/plus-jakarta-sans-latin.woff2') format('woff2'); font-weight: 400 600; font-display: swap; }
    @font-face { font-family: 'JetBrains Mono'; src: url('/assets/fonts/jetbrains-mono-latin.woff2') format('woff2'); font-weight: 400 500; font-display: swap; }
    :root {
      color-scheme: dark;
      --scalar-font: 'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif;
      --scalar-font-code: 'JetBrains Mono', ui-monospace, monospace;
      --scalar-color-1: #e7e7e7;
      --scalar-color-2: #a5abb5;
      --scalar-color-3: #747982;
      --scalar-color-accent: #bcbcbc;
      --scalar-background-1: #090909;
      --scalar-background-2: #191919;
      --scalar-background-3: #222222;
      --scalar-background-accent: rgba(128,128,128,.12);
      --scalar-border-color: #353537;
      --scalar-border-width: 1px;
      --scalar-radius: 10px;
    }
    * { box-sizing: border-box; }
    html { background: #090909; scroll-behavior: smooth; }
    body { margin: 0; overflow-x: hidden; background: #090909; color: #e7e7e7; font-family: 'Plus Jakarta Sans', sans-serif; }
    .docs-nav a { color: inherit; }
    :focus-visible { outline: 2px solid #bcbcbc; outline-offset: 4px; }
    .skip-link { position: fixed; top: 1rem; left: 1rem; z-index: 1000; transform: translateY(-180%); border-radius: 999px; background: #e7e7e7; color: #090909; padding: .75rem 1rem; transition: transform 180ms ease; }
    .skip-link:focus { transform: translateY(0); }
    .docs-nav { position: absolute; inset: 0 0 auto; z-index: 20; display: flex; align-items: center; justify-content: space-between; gap: 1rem; max-width: 1480px; margin: 1rem auto 0; padding: .65rem 1rem; width: calc(100% - 2.5rem); border: 1px solid rgba(231,231,231,.22); border-bottom-color: rgba(231,231,231,.4); border-radius: .65rem; background: rgba(7,7,7,.82); backdrop-filter: blur(20px); }
    .docs-brand { display: flex; align-items: center; gap: .75rem; text-decoration: none; font-weight: 600; }
    .docs-brand img { width: 2rem; height: 2rem; border-radius: .6rem; }
    .docs-nav-links { display: flex; gap: .6rem; }
    .docs-nav-links a { border: 1px solid rgba(231,231,231,.2); border-radius: 999px; padding: .7rem 1rem; background: rgba(9,9,9,.38); text-decoration: none; font-size: .75rem; font-weight: 600; backdrop-filter: blur(14px); transition: background 180ms ease, border-color 180ms ease, transform 180ms ease; }
    .docs-nav-links a:hover { transform: translateY(-2px); border-color: rgba(200,200,200,.75); background: rgba(128,128,128,.24); }
    .docs-hero { position: relative; isolation: isolate; display: grid; align-items: end; overflow: hidden; border-bottom: 1px solid #353537; }
    .docs-hero::before { content: ''; position: absolute; inset: 0; z-index: -2; background: url('/assets/media/anime-operator-blue.png') center 28% / cover no-repeat; transform: scale(1.035); filter: grayscale(1); }
    .docs-hero::after { content: ''; position: absolute; inset: 0; z-index: -1; background: linear-gradient(90deg, rgba(9,9,9,.97), rgba(9,9,9,.76) 45%, rgba(9,9,9,.18)), linear-gradient(180deg, rgba(9,9,9,.32), rgba(9,9,9,.92)); }
    .docs-hero-grid { width: min(100%, 1480px); margin: 0 auto; padding: 6.5rem clamp(1.25rem, 4vw, 3rem) 2.5rem; }
    .docs-kicker { margin: 0 0 1rem; color: #bcbcbc; font-family: 'JetBrains Mono', monospace; font-size: .68rem; letter-spacing: .18em; text-transform: uppercase; }
    .docs-title { max-width: 980px; margin: 0; font-family: 'Bricolage Grotesque', sans-serif; font-size: clamp(3rem, 5.4vw, 5.6rem); font-weight: 750; line-height: 1; letter-spacing: -.05em; text-wrap: balance; }
    .docs-title span { color: #bcbcbc; }
    .docs-intro-row { display: grid; gap: 1.5rem; max-width: 980px; margin-top: 2rem; padding-top: 1.4rem; border-top: 1px solid rgba(231,231,231,.2); grid-template-columns: minmax(0, 34rem) 1fr; align-items: end; }
    .docs-intro-row p { margin: 0; color: rgba(231,231,231,.7); font-size: .9rem; line-height: 1.8; }
    .docs-contract { justify-self: end; color: rgba(231,231,231,.58); font-family: 'JetBrains Mono', monospace; font-size: .65rem; letter-spacing: .12em; text-align: right; text-transform: uppercase; }
    .scalar-shell { position: relative; background: linear-gradient(90deg, rgba(53,53,55,.14) 1px, transparent 1px), #090909; background-size: 72px 72px; }
    html[data-theme='light'] { color-scheme: light; --scalar-color-1: #080808; --scalar-color-2: #3e3e3e; --scalar-color-3: #686868; --scalar-color-accent: #0c0c0c; --scalar-background-1: #efefed; --scalar-background-2: #fcfcfa; --scalar-background-3: #e4e4e1; --scalar-border-color: #aeaeaa; }
    html, body, .scalar-shell { background: var(--scalar-background-1); color: var(--scalar-color-1); }
    .docs-hero, .docs-nav { color: #e7e7e7; }
    .docs-theme { min-height: 44px; padding: .5rem .75rem; border: 1px solid #777; border-radius: .5rem; color: inherit; background: transparent; cursor: pointer; }
    .dark-mode { --scalar-color-1: #f8f8f8; --scalar-color-2: #bababa; --scalar-color-3: #a0a0a0; --scalar-color-accent: #eeeeee; --scalar-background-1: #090909; --scalar-background-2: #191919; --scalar-background-3: #222222; }
    .light-mode { --scalar-color-1: #080808; --scalar-color-2: #3e3e3e; --scalar-color-3: #595959; --scalar-color-accent: #0c0c0c; --scalar-background-1: #efefed; --scalar-background-2: #fcfcfa; --scalar-background-3: #e4e4e1; }
    .light-mode .hljs-literal, .light-mode .sidebar-heading-type { color: #454545 !important; }
    .scalar-app { min-height: 100vh; }
    .scalar-shell .sidebar { border-right-color: var(--scalar-border-color) !important; background: var(--scalar-background-1) !important; }
    .scalar-shell .references-layout { background: transparent !important; }
    .docs-hero h1, .scalar-shell .section-header { font-family: 'Bricolage Grotesque', sans-serif; letter-spacing: -.035em; text-wrap: balance; }
    .scalar-shell code, .scalar-shell pre { font-family: 'JetBrains Mono', monospace; }
    .docs-nav button, .docs-nav a { transition: color 160ms ease, background-color 160ms ease, border-color 160ms ease; }
    @view-transition { navigation: auto; }
    ::view-transition-old(root) { animation: docs-out 260ms ease both; }
    ::view-transition-new(root) { animation: docs-in 460ms cubic-bezier(.16,1,.3,1) both; }
    @keyframes docs-out { to { opacity: 0; transform: translateY(-14px); } }
    @keyframes docs-in { from { opacity: 0; transform: translateY(18px); } }
    @media (max-width: 700px) {
      .docs-nav { gap: .5rem; padding: .5rem; }
      .docs-brand { min-width: 0; gap: .5rem; font-size: .75rem; }
      .docs-nav-links { flex-shrink: 0; gap: .4rem; }
      .docs-nav-links a { padding: .6rem; max-width: 6.5rem; }
      .docs-nav-links a:first-child { display: none; }
      .docs-hero { min-height: 0; }
      .docs-hero::before { background-position: 66% center; }
      .docs-hero::after { background: linear-gradient(180deg, rgba(9,9,9,.22), rgba(9,9,9,.95) 62%); }
      .docs-title { font-size: clamp(2.8rem, 10vw, 4rem); }
      .docs-intro-row { grid-template-columns: 1fr; }
      .docs-contract { justify-self: start; text-align: left; }
    }
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; }
      html { scroll-behavior: auto; }
      ::view-transition-old(root), ::view-transition-new(root) { animation: none !important; }
    }
  </style>
</head>
<body>
  <a class="skip-link" href="#scalar-reference">Skip to API reference</a>
  <header class="docs-nav">
    <a class="docs-brand" href="/"><img src="/icon.png" width="32" height="32" alt="" /><span>KanjutGede API / Docs</span></a>
    <nav class="docs-nav-links" aria-label="Documentation navigation"><a href="/">Home</a><a href="/explorer.html">Open Workbench</a><button class="docs-theme" type="button" aria-label="Switch theme">Light</button></nav>
  </header>
  <main>
    <section class="docs-hero" aria-labelledby="docs-title">
      <div class="docs-hero-grid">
        <p class="docs-kicker">Documentation / OpenAPI 3.1</p>
        <h1 class="docs-title" id="docs-title">Know the contract.<br /><span>Ship the request.</span></h1>
        <div class="docs-intro-row"><p>Search the real API surface, inspect authentication rules, copy production-minded examples, and move from endpoint to response without losing context.</p><div class="docs-contract">${routeCount} route definitions<br />Bearer auth + public routes</div></div>
      </div>
    </section>
    <section class="scalar-shell" aria-label="Interactive API reference">
      <div id="scalar-reference" tabindex="-1"></div>
    </section>
  </main>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.78.1/dist/browser/standalone.js"></script>
  <script>
    const button = document.querySelector('.docs-theme');
    const reference = Scalar.createApiReference('#scalar-reference', {
      url: '${specUrl}', theme: 'none', layout: 'modern',
      defaultHttpClient: { targetKey: 'js', clientKey: 'fetch' },
      hideDarkModeToggle: true, forceDarkModeState: document.documentElement.dataset.theme
    });
    function applyTheme(theme) {
      document.documentElement.dataset.theme = theme;
      reference.updateConfiguration({ ...reference.getConfiguration(), forceDarkModeState: theme, darkMode: theme === 'dark' });
      button.textContent = theme === 'dark' ? 'Light' : 'Dark';
      button.setAttribute('aria-label', 'Switch to ' + (theme === 'dark' ? 'light' : 'dark') + ' theme');
    }
    button.textContent = document.documentElement.dataset.theme === 'dark' ? 'Light' : 'Dark';
    button.setAttribute('aria-label', 'Switch to ' + (document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark') + ' theme');
    button.addEventListener('click', () => {
      const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
      try { localStorage.setItem('kg-celestial-theme', theme); } catch {}
      applyTheme(theme);
    });
    matchMedia('(prefers-color-scheme: light)').addEventListener('change', event => {
      let saved; try { saved = localStorage.getItem('kg-celestial-theme'); } catch {}
      if (saved !== 'dark' && saved !== 'light') applyTheme(event.matches ? 'light' : 'dark');
    });
    window.addEventListener('storage', event => {
      if (event.key === 'kg-celestial-theme') applyTheme(event.newValue === 'light' ? 'light' : 'dark');
    });
  </script>
</body>
</html>`;
}

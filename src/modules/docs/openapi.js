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
  return `<!DOCTYPE html>
<html>
<head>
  <title>KanjutGede API Documentation</title>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="icon" type="image/svg+xml" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%233b82f6'><path d='M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5'/></svg>">
  <style>
    body { margin: 0; background-color: #09090b; }
  </style>
</head>
<body>
  <script
    id="api-reference"
    data-url="${specUrl}"
    data-theme="deepSpace"
    data-layout="modern"
  ></script>
  <script src="https://cdn.jsdelivr.net/npm/@scalar/api-reference"></script>
</body>
</html>`;
}

import { ENDPOINT_REGISTRY } from '../../registry/endpoints.js';

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
      description: `${ep.metadata.summary}\n\n**Billing Policy:** ${ep.billing_policy.type} (${ep.billing_policy.default_credits} credit)\n**Resource Class:** ${ep.resource_class}`,
      tags: ep.metadata.tags || [ep.category],
      parameters: [
        ...(ep.path.includes('url') || ['dl.aio', 'dl.tiktok', 'dl.youtube', 'dl.instagram', 'dl.facebook', 'dl.twitter', 'dl.mediafire', 'media.hd', 'media.uhd', 'tool.presetam', 'solve.waf'].includes(ep.id)
          ? [{
              name: 'url',
              in: 'query',
              required: true,
              description: 'Target URL input',
              schema: { type: 'string' }
            }]
          : []),
        ...(ep.id === 'ai.chat'
          ? [{
              name: 'prompt',
              in: 'query',
              required: true,
              description: 'AI prompt message',
              schema: { type: 'string' }
            }]
          : [])
      ],
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
      version: '1.0.0',
      description: 'High-Performance Commercial Media Scraper, AI Inference, and Automation Tools Platform.\n\nDomain: `api.itsfaiz.my.id`',
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

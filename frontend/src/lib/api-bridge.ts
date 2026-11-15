// Typed bridge directly consuming the contract-tested ESM modules in /public/assets/
import * as requestMod from '../../../public/assets/request.js';
import * as catalogMod from '../../../public/assets/catalog.js';

export interface EndpointParamSchema {
  type?: 'string' | 'integer' | 'number' | 'boolean';
  default?: string | number | boolean;
  minimum?: number;
  maximum?: number;
  maxLength?: number;
  enum?: string[];
}

export interface EndpointParam {
  name: string;
  in: string;
  required?: boolean;
  description?: string;
  schema?: EndpointParamSchema;
}

export interface EndpointSpec {
  id: string;
  path: string;
  executionPath: string;
  aliases?: string[];
  method: string;
  supported: boolean;
  public: boolean;
  scopes?: string[];
  title: string;
  description: string;
  category: string;
  subcategory?: string;
  policy?: string;
  credits: number;
  deadline?: number;
  cacheTtl?: number;
  concurrency?: number;
  resourceClass?: string;
  providers?: string[];
  parameters: EndpointParam[];
}

export type SnippetLang = 'cURL' | 'JavaScript' | 'TypeScript' | 'Python' | 'Go';

export const SNIPPET_LANGUAGES: SnippetLang[] = [
  'cURL',
  'JavaScript',
  'TypeScript',
  'Python',
  'Go',
];

export interface BuiltRequest {
  path: string;
  method: string;
}

export interface FormattedApiResponse {
  text: string;
  value?: unknown;
}

export type OperatorApiState = 'idle' | 'focus' | 'loading' | 'success' | 'error' | 'cancelled';

export const loadCatalog: () => Promise<EndpointSpec[]> = catalogMod.loadCatalog;
export const SAMPLE_PARAMS: Record<string, Record<string, string | number | boolean>> = catalogMod.SAMPLE_PARAMS;
export const filterCatalog: (
  items: EndpointSpec[],
  opts?: { search?: string; category?: string; scope?: 'all' | 'public' | 'protected' }
) => EndpointSpec[] = catalogMod.filterCatalog;

export const makeRequest: (
  endpoint: EndpointSpec,
  values: Record<string, string | number | boolean>
) => BuiltRequest = requestMod.makeRequest;

export const makeSnippet: (
  endpoint: EndpointSpec,
  values: Record<string, string | number | boolean>,
  language: SnippetLang
) => string = requestMod.makeSnippet;

export const redact: <T>(value: T, key?: string) => T = requestMod.redact;
export const readBounded: (response: Response, limit?: number) => Promise<string> = requestMod.readBounded;
export const formatResponse: (text: string, key?: string) => FormattedApiResponse = requestMod.formatResponse;

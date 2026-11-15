import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  Filter,
  KeyRound,
  RotateCcw,
  Search,
  ShieldAlert,
  Sparkles,
  Square,
  Wallet,
  Zap,
} from 'lucide-react';
import {
  SAMPLE_PARAMS,
  SNIPPET_LANGUAGES,
  filterCatalog,
  formatResponse,
  loadCatalog,
  makeRequest,
  makeSnippet,
  readBounded,
  redact,
  type EndpointSpec,
  type OperatorApiState,
  type SnippetLang,
} from '../lib/api-bridge';
import { CelestialNavbar } from '../components/CelestialNavbar';
import { CommandModal } from '../components/CommandModal';
import { AnimeCanvasFX } from '../components/AnimeCanvasFX';
import { AnimeOperator } from '../components/AnimeOperator';
import { JsonViewer } from '../components/JsonViewer';

interface QuotaSnapshot {
  email?: string;
  plan?: string;
  balance?: number;
  freeQuotaRemaining?: number;
  raw?: unknown;
}

export const ExplorerApp: React.FC = () => {
  const [endpoints, setEndpoints] = useState<EndpointSpec[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(true);
  const [commandOpen, setCommandOpen] = useState(false);

  // Filter & Selection State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedScope, setSelectedScope] = useState<'all' | 'public' | 'protected'>('all');
  const [activeId, setActiveId] = useState<string>('');
  const [paramValues, setParamValues] = useState<Record<string, string>>({});

  // Volatile In-Memory Bearer Key (NEVER persisted to localStorage / sessionStorage)
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [quotaInfo, setQuotaInfo] = useState<QuotaSnapshot | null>(null);
  const [quotaLoading, setQuotaLoading] = useState(false);
  const [quotaError, setQuotaError] = useState('');

  // Execution & Companion State
  const [apiState, setApiState] = useState<OperatorApiState>('idle');
  const [operatorNote, setOperatorNote] = useState('');
  const [burstSignal, setBurstSignal] = useState(0);
  const [snippetLang, setSnippetLang] = useState<SnippetLang>('cURL');
  const [snippetCopied, setSnippetCopied] = useState(false);

  const [respText, setRespText] = useState('');
  const [respValue, setRespValue] = useState<unknown>(null);
  const [respHeaders, setRespHeaders] = useState<Array<[string, string]>>([]);
  const [respStatus, setRespStatus] = useState<number | null>(null);
  const [respDuration, setRespDuration] = useState<number | null>(null);
  const [respBytes, setRespBytes] = useState<number | null>(null);
  const [respTruncated, setRespTruncated] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  // Zero-persistence security wipe on pagehide
  useEffect(() => {
    const purgeSecrets = () => {
      setApiKey('');
      abortRef.current?.abort();
    };
    window.addEventListener('pagehide', purgeSecrets);
    return () => {
      window.removeEventListener('pagehide', purgeSecrets);
      abortRef.current?.abort();
    };
  }, []);

  // Load Catalog & Resolve Deep-Linked ?endpoint=
  useEffect(() => {
    let mounted = true;
    loadCatalog()
      .then((items) => {
        if (!mounted) return;
        const list = items || [];
        setEndpoints(list);
        setLoadingCatalog(false);

        const params = new URLSearchParams(window.location.search);
        const requested = params.get('endpoint');
        const matched =
          list.find((e) => e.id === requested || e.executionPath === requested) ||
          list.find((e) => e.id === 'search.anime') ||
          list[0];
        if (matched) {
          setActiveId(matched.id);
        }
      })
      .catch(() => {
        if (mounted) setLoadingCatalog(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const categories = useMemo(() => {
    const s = new Set<string>();
    endpoints.forEach((e) => s.add(e.category));
    return ['all', ...Array.from(s)];
  }, [endpoints]);

  const filteredEndpoints = useMemo(() => {
    return filterCatalog(endpoints, {
      search: searchQuery,
      category: selectedCategory === 'all' ? '' : selectedCategory,
      scope: selectedScope,
    });
  }, [endpoints, searchQuery, selectedCategory, selectedScope]);

  const activeEndpoint = useMemo(() => {
    return endpoints.find((e) => e.id === activeId) || filteredEndpoints[0] || null;
  }, [activeId, endpoints, filteredEndpoints]);

  const populateSampleValues = useCallback((ep: EndpointSpec | null) => {
    if (!ep) return;
    const next: Record<string, string> = {};
    const sampleBag = SAMPLE_PARAMS[ep.id] || {};
    for (const p of ep.parameters || []) {
      if (sampleBag[p.name] !== undefined) {
        next[p.name] = String(sampleBag[p.name]);
      } else if (p.schema?.default !== undefined) {
        next[p.name] = String(p.schema.default);
      } else if (ep.id === 'search.anime' && p.name === 'q') {
        next[p.name] = 'Steins Gate';
      } else {
        next[p.name] = '';
      }
    }
    setParamValues(next);
  }, []);

  useEffect(() => {
    if (!activeEndpoint) return;
    populateSampleValues(activeEndpoint);

    const url = new URL(window.location.href);
    url.searchParams.set('endpoint', activeEndpoint.id);
    window.history.replaceState(null, '', url.toString());
  }, [activeEndpoint, populateSampleValues]);

  // Inspect Bearer Key Account & Credit Balance via GET /api/v1/account
  const inspectQuota = useCallback(async () => {
    const trimmed = apiKey.trim();
    if (!trimmed) {
      setQuotaError('Enter an in-memory Bearer API key first to inspect credit balance.');
      return;
    }
    setQuotaLoading(true);
    setQuotaError('');
    setApiState('loading');
    setOperatorNote('Inspecting Bearer token quota on GET /api/v1/account ...');

    try {
      const res = await fetch('/api/v1/account', {
        method: 'GET',
        credentials: 'omit',
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${trimmed}`,
        },
      });
      const raw = await readBounded(res, 262_144);
      const parsed = formatResponse(raw, trimmed).value as any;

      if (!res.ok) {
        setQuotaInfo(null);
        setQuotaError(parsed?.error || parsed?.message || `HTTP ${res.status} unauthorized`);
        setApiState('error');
        setOperatorNote(`Account check returned HTTP ${res.status}. Verify Bearer token.`);
      } else {
        const resultObj = parsed?.result || parsed?.data || parsed || {};
        setQuotaInfo({
          email: resultObj?.account?.email || resultObj?.email || 'Authenticated Key',
          plan: resultObj?.account?.tier || resultObj?.tier || 'Metered',
          balance:
            resultObj?.wallet?.balance ??
            resultObj?.credits ??
            resultObj?.balance ??
            undefined,
          freeQuotaRemaining: resultObj?.freeQuotaRemaining ?? undefined,
          raw: resultObj,
        });
        setApiState('success');
        setBurstSignal((n) => n + 1);
        setOperatorNote('Bearer key verified. Credit ledger loaded into volatile memory.');
      }
    } catch (err: any) {
      setQuotaError(err?.message || 'Unable to inspect account quota.');
      setApiState('error');
    } finally {
      setQuotaLoading(false);
    }
  }, [apiKey]);

  // Execute Selected Endpoint
  const executeEndpoint = useCallback(async () => {
    if (!activeEndpoint) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const trimmedKey = apiKey.trim();
    const { path, method } = makeRequest(activeEndpoint, paramValues);

    setApiState('loading');
    setBurstSignal((n) => n + 1);
    setOperatorNote(`Dispatching ${method} ${redact(path, trimmedKey)} ...`);

    const headers: Record<string, string> = { Accept: 'application/json' };
    if (trimmedKey) {
      headers.Authorization = `Bearer ${trimmedKey}`;
    }

    const timeoutMs = activeEndpoint.deadline || 20000;
    const timer = setTimeout(() => controller.abort('timeout'), timeoutMs);
    const t0 = performance.now();

    try {
      const res = await fetch(path, {
        method,
        headers,
        signal: controller.signal,
        credentials: 'omit',
        cache: 'no-store',
      });
      clearTimeout(timer);

      const rawText = await readBounded(res, 1_048_576);
      const byteLen = new TextEncoder().encode(rawText).byteLength;
      const wasTruncated = rawText.includes('truncated at');
      const elapsed = Math.max(1, Math.round(performance.now() - t0));
      const formatted = formatResponse(rawText, trimmedKey);

      const hdrs: Array<[string, string]> = [];
      res.headers.forEach((v, k) => {
        hdrs.push([k, redact(v, trimmedKey)]);
      });

      setRespText(formatted.text);
      setRespValue(formatted.value);
      setRespHeaders(hdrs);
      setRespStatus(res.status);
      setRespDuration(elapsed);
      setRespBytes(byteLen);
      setRespTruncated(wasTruncated);

      if (res.ok) {
        setApiState('success');
        setBurstSignal((n) => n + 1);
        setOperatorNote(
          `${activeEndpoint.id} succeeded with HTTP ${res.status} in ${elapsed} ms.`
        );
      } else {
        setApiState('error');
        setOperatorNote(
          `${activeEndpoint.id} returned HTTP ${res.status} (${elapsed} ms).`
        );
      }
    } catch (err: any) {
      clearTimeout(timer);
      if (controller.signal.aborted) {
        setApiState('cancelled');
        setOperatorNote('Request cancelled via AbortController.');
      } else {
        setApiState('error');
        setOperatorNote(`Transport error: ${err?.message || 'Request failed'}`);
      }
    }
  }, [activeEndpoint, apiKey, paramValues]);

  const cancelExecution = useCallback(() => {
    abortRef.current?.abort('user_cancelled');
    setApiState('cancelled');
    setOperatorNote('In-flight HTTP stream aborted cleanly.');
  }, []);

  const builtPreview = useMemo(() => {
    if (!activeEndpoint) return { method: 'GET', path: '/api/v1/health' };
    const req = makeRequest(activeEndpoint, paramValues);
    return { method: req.method, path: redact(req.path, apiKey.trim()) };
  }, [activeEndpoint, apiKey, paramValues]);

  const codeSnippet = useMemo(() => {
    if (!activeEndpoint) return '';
    return makeSnippet(activeEndpoint, paramValues, snippetLang);
  }, [activeEndpoint, paramValues, snippetLang]);

  const handleCopySnippet = async () => {
    try {
      await navigator.clipboard.writeText(codeSnippet);
      setSnippetCopied(true);
      setTimeout(() => setSnippetCopied(false), 1600);
    } catch {}
  };

  return (
    <div className="celestial-atmosphere relative min-h-screen overflow-x-clip pb-16">
      <AnimeCanvasFX apiState={apiState} burstSignal={burstSignal} />

      <CelestialNavbar
        activeRoute="explorer"
        onOpenCommand={() => setCommandOpen(true)}
        endpointCount={endpoints.length || 42}
      />

      <CommandModal
        open={commandOpen}
        onClose={() => setCommandOpen(false)}
        endpoints={endpoints}
        onSelectEndpoint={(ep) => setActiveId(ep.id)}
      />

      <main className="relative z-10 mx-auto max-w-[1400px] px-4 pt-24 sm:px-6 sm:pt-28">
        {/* Top Header + In-Memory Bearer Key Bar */}
        <div className="mb-6 grid items-end gap-5 lg:grid-cols-12">
          <div className="space-y-1.5 lg:col-span-5">
            <div className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-celestial-sky">
              <Sparkles className="h-3.5 w-3.5" strokeWidth={1.5} />
              <span>CELESTIAL API WORKBENCH</span>
            </div>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-celestial-primary sm:text-3xl">
              Explorer &amp; Live HTTP Playground
            </h1>
            <p className="text-xs leading-relaxed text-celestial-secondary sm:text-sm">
              Select any route, customize parameters, inspect live JSON envelopes, and copy
              production-ready SDK snippets.
            </p>
          </div>

          {/* Volatile Memory Bearer Vault */}
          <div className="celestial-card flex flex-col justify-between gap-3 p-4 lg:col-span-7">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-medium text-celestial-lilac">
                <KeyRound className="h-3.5 w-3.5" strokeWidth={1.5} />
                <span>IN-MEMORY BEARER KEY (ZERO STORAGE PERSISTENCE)</span>
              </span>
              <a
                href="/signin.html?returnTo=%2Fexplorer.html"
                className="font-mono text-[11px] text-celestial-sky hover:underline"
              >
                Need Session Auth? Sign In →
              </a>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={apiKey}
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Paste kg_live_... token (cleared automatically on tab close)"
                  className="w-full rounded-lg border border-celestial-border/50 bg-celestial-canvas/70 py-2 pl-3 pr-9 font-mono text-base text-celestial-primary placeholder:text-celestial-muted focus:border-celestial-sky focus:outline-none sm:text-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((v) => !v)}
                  aria-label={showKey ? 'Mask Bearer token' : 'Reveal Bearer token'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-celestial-muted hover:text-celestial-primary"
                >
                  {showKey ? (
                    <EyeOff className="h-3.5 w-3.5" strokeWidth={1.5} />
                  ) : (
                    <Eye className="h-3.5 w-3.5" strokeWidth={1.5} />
                  )}
                </button>
              </div>

              <button
                type="button"
                onClick={inspectQuota}
                disabled={quotaLoading}
                className="inline-flex min-h-[38px] shrink-0 items-center justify-center gap-1.5 rounded-lg border border-celestial-sky/45 bg-celestial-sky/15 px-3.5 py-2 font-mono text-xs font-medium text-celestial-primary transition-colors hover:bg-celestial-sky/25 disabled:opacity-50"
              >
                <Wallet className="h-3.5 w-3.5 text-celestial-sky" strokeWidth={1.5} />
                <span>{quotaLoading ? 'Checking...' : 'Check Quota'}</span>
              </button>
            </div>

            {quotaError && (
              <div className="flex items-center gap-2 font-mono text-[11px] text-rose-400">
                <ShieldAlert className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
                <span>{quotaError}</span>
              </div>
            )}

            {quotaInfo && (
              <div className="flex flex-wrap items-center gap-3 rounded-lg border border-emerald-400/35 bg-emerald-400/10 px-3 py-1.5 font-mono text-[11px] text-emerald-300">
                <span>Account: {quotaInfo.email}</span>
                {quotaInfo.balance !== undefined && <span>· Credits: {quotaInfo.balance}</span>}
                {quotaInfo.plan && <span>· Tier: {quotaInfo.plan}</span>}
              </div>
            )}
          </div>
        </div>

        {/* 3-Column Workbench Layout */}
        <div className="grid items-start gap-5 lg:grid-cols-12">
          {/* LEFT SIDEBAR: Searchable Route Directory (3 Cols) */}
          <aside className="celestial-card flex flex-col overflow-hidden lg:col-span-3">
            <div className="space-y-3 border-b border-celestial-border/40 p-3.5">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-celestial-muted"
                  strokeWidth={1.5}
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={`Filter ${endpoints.length || 42} endpoints...`}
                  className="w-full rounded-lg border border-celestial-border/50 bg-celestial-canvas/65 py-2 pl-8 pr-3 text-base text-celestial-primary placeholder:text-celestial-muted focus:border-celestial-sky focus:outline-none sm:text-xs"
                />
              </div>

              <div className="flex items-center gap-1 rounded-lg border border-celestial-border/35 bg-celestial-canvas/45 p-1">
                {(['all', 'public', 'protected'] as const).map((sc) => (
                  <button
                    key={sc}
                    type="button"
                    onClick={() => setSelectedScope(sc)}
                    className={`flex-1 rounded-md py-1 font-mono text-[10px] uppercase transition-colors ${
                      selectedScope === sc
                        ? 'bg-celestial-sky/20 font-medium text-celestial-primary'
                        : 'text-celestial-muted hover:text-celestial-primary'
                    }`}
                  >
                    {sc}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <Filter className="h-3 w-3 shrink-0 text-celestial-muted" strokeWidth={1.5} />
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setSelectedCategory(cat)}
                    className={`shrink-0 rounded border px-2 py-0.5 font-mono text-[10px] uppercase ${
                      selectedCategory === cat
                        ? 'border-celestial-sky bg-celestial-sky/15 font-medium text-celestial-primary'
                        : 'border-celestial-border/40 text-celestial-muted hover:text-celestial-primary'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="max-h-[420px] divide-y divide-celestial-border/25 overflow-y-auto lg:max-h-[680px]">
              {loadingCatalog ? (
                <div className="p-6 text-center font-mono text-xs text-celestial-muted">
                  Loading Celestial Route Catalog...
                </div>
              ) : filteredEndpoints.length === 0 ? (
                <div className="p-6 text-center font-mono text-xs text-celestial-muted">
                  No routes match your filter.
                </div>
              ) : (
                filteredEndpoints.map((ep) => {
                  const selected = activeEndpoint?.id === ep.id;
                  return (
                    <button
                      key={ep.id}
                      type="button"
                      onClick={() => setActiveId(ep.id)}
                      className={`flex w-full flex-col gap-1 px-3.5 py-3 text-left transition-colors ${
                        selected
                          ? 'bg-celestial-sky/15'
                          : 'hover:bg-celestial-elevated/45'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 font-mono text-[10px]">
                        <span className="rounded bg-celestial-sky/15 px-1.5 py-0.5 font-semibold text-celestial-sky">
                          {ep.method}
                        </span>
                        <span className={ep.public ? 'font-medium text-emerald-600 dark:text-emerald-400' : 'font-medium text-celestial-lilac'}>
                          {ep.public ? 'PUBLIC' : `${ep.credits} CR`}
                        </span>
                      </div>
                      <div className="truncate text-xs font-semibold text-celestial-primary">
                        {ep.title}
                      </div>
                      <div className="truncate font-mono text-[11px] text-celestial-muted">
                        {ep.executionPath}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          {/* CENTER WORKSPACE: Request Builder + Live JSON Viewer + SDK Snippets (6 Cols) */}
          <section className="space-y-4 lg:col-span-6">
            {activeEndpoint ? (
              <>
                <div className="celestial-card space-y-4 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 font-mono text-[11px]">
                        <span className="rounded bg-celestial-sky/20 px-2 py-0.5 font-semibold text-celestial-sky">
                          {activeEndpoint.method}
                        </span>
                        <span className="text-celestial-muted">{activeEndpoint.id}</span>
                        <span className="rounded border border-celestial-border/45 px-2 py-0.5 text-celestial-secondary">
                          {activeEndpoint.public
                            ? 'Public Access'
                            : `Protected · ${activeEndpoint.credits} Credits`}
                        </span>
                      </div>
                      <h2 className="mt-2 font-display text-xl font-semibold text-celestial-primary">
                        {activeEndpoint.title}
                      </h2>
                      <p className="mt-1 text-xs leading-relaxed text-celestial-secondary sm:text-sm">
                        {activeEndpoint.description}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => populateSampleValues(activeEndpoint)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-celestial-border/45 bg-celestial-canvas/55 px-2.5 py-1.5 font-mono text-[11px] text-celestial-secondary transition-colors hover:border-celestial-sky/50 hover:text-celestial-primary"
                    >
                      <RotateCcw className="h-3.5 w-3.5" strokeWidth={1.5} />
                      <span>Sample Params</span>
                    </button>
                  </div>

                  {/* Computed Request Target */}
                  <div className="rounded-lg border border-celestial-border/45 bg-celestial-canvas/70 px-3.5 py-2.5 font-mono text-xs">
                    <span className="mr-2 font-semibold text-celestial-sky">
                      {builtPreview.method}
                    </span>
                    <span className="break-all text-celestial-primary">{builtPreview.path}</span>
                  </div>

                  {/* Protected Warning if No Key Entered */}
                  {!activeEndpoint.public && !apiKey.trim() && (
                    <div className="rounded-lg border border-celestial-lilac/40 bg-celestial-lilac/10 px-3.5 py-2 text-xs text-celestial-secondary">
                      This endpoint requires a <code className="font-mono text-celestial-lilac">Bearer</code>{' '}
                      API key above. Executing without one will demonstrate the structured{' '}
                      <code className="font-mono">401 Unauthorized</code> contract.
                    </div>
                  )}

                  {/* Dynamic Parameters Form */}
                  {(activeEndpoint.parameters || []).length === 0 ? (
                    <div className="rounded-lg border border-celestial-border/30 bg-celestial-canvas/40 px-3.5 py-2.5 font-mono text-xs text-celestial-muted">
                      No query or body parameters required for this endpoint.
                    </div>
                  ) : (
                    <div className="grid gap-3.5 sm:grid-cols-2">
                      {activeEndpoint.parameters.map((param) => {
                        const enumValues = param.schema?.enum;
                        const singleParam = (activeEndpoint.parameters?.length || 0) === 1;
                        return (
                          <label
                            key={param.name}
                            className={`block space-y-1 ${singleParam ? 'sm:col-span-2' : ''}`}
                          >
                            <span className="flex items-center justify-between font-mono text-[11px]">
                              <span className="font-medium text-celestial-primary">
                                {param.name}
                                {param.required && (
                                  <span className="ml-1 text-rose-400">*</span>
                                )}
                              </span>
                              <span className="text-celestial-muted">
                                {param.in} · {param.schema?.type || 'string'}
                              </span>
                            </span>

                            {enumValues && enumValues.length > 0 ? (
                              <select
                                value={paramValues[param.name] ?? ''}
                                onChange={(e) =>
                                  setParamValues((prev) => ({
                                    ...prev,
                                    [param.name]: e.target.value,
                                  }))
                                }
                                className="w-full rounded-lg border border-celestial-border/50 bg-celestial-canvas/75 px-3 py-2 font-mono text-base text-celestial-primary focus:border-celestial-sky focus:outline-none sm:text-xs"
                              >
                                {enumValues.map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <input
                                type="text"
                                value={paramValues[param.name] ?? ''}
                                onFocus={() => {
                                  if (apiState !== 'loading') setApiState('focus');
                                }}
                                onBlur={() => {
                                  if (apiState === 'focus') setApiState('idle');
                                }}
                                onChange={(e) =>
                                  setParamValues((prev) => ({
                                    ...prev,
                                    [param.name]: e.target.value,
                                  }))
                                }
                                placeholder={param.description || param.name}
                                className="w-full rounded-lg border border-celestial-border/50 bg-celestial-canvas/75 px-3 py-2 font-mono text-base text-celestial-primary placeholder:text-celestial-muted focus:border-celestial-sky focus:outline-none sm:text-xs"
                              />
                            )}
                            {param.description && (
                              <span className="block text-[11px] leading-snug text-celestial-muted">
                                {param.description}
                              </span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  )}

                  {/* Execute & Abort Buttons */}
                  <div className="flex flex-wrap items-center gap-2.5 pt-1">
                    <motion.button
                      whileTap={{ scale: 0.98 }}
                      type="button"
                      onClick={executeEndpoint}
                      disabled={apiState === 'loading'}
                      className="btn-celestial-primary inline-flex min-h-[42px] items-center gap-2 rounded-xl px-5 py-2 text-xs font-semibold disabled:opacity-60"
                    >
                      <Zap className="h-3.5 w-3.5" strokeWidth={1.75} />
                      <span>
                        {apiState === 'loading' ? 'Executing Request...' : 'Execute Request'}
                      </span>
                    </motion.button>

                    {apiState === 'loading' && (
                      <button
                        type="button"
                        onClick={cancelExecution}
                        className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-rose-400/55 bg-rose-400/15 px-3.5 py-2 font-mono text-xs text-rose-300 transition-colors hover:bg-rose-400/25"
                      >
                        <Square className="h-3.5 w-3.5" strokeWidth={1.5} />
                        <span>Cancel Stream</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Structured JSON Viewer */}
                <JsonViewer
                  formattedText={respText}
                  parsedValue={respValue}
                  headers={respHeaders}
                  status={respStatus}
                  durationMs={respDuration}
                  byteLength={respBytes}
                  truncated={respTruncated}
                  maxHeightClass="max-h-[420px]"
                />

                {/* Copyable Multi-Language Code Snippets */}
                <div className="celestial-card overflow-hidden">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-celestial-border/40 bg-celestial-canvas/55 px-3.5 py-2.5">
                    <div className="flex flex-wrap items-center gap-1">
                      {SNIPPET_LANGUAGES.map((lang) => (
                        <button
                          key={lang}
                          type="button"
                          onClick={() => setSnippetLang(lang)}
                          className={`rounded-md px-2.5 py-1 font-mono text-[11px] transition-colors ${
                            snippetLang === lang
                              ? 'bg-celestial-lilac/25 text-celestial-primary'
                              : 'text-celestial-muted hover:text-celestial-primary'
                          }`}
                        >
                          {lang}
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={handleCopySnippet}
                      className="inline-flex items-center gap-1.5 rounded-md border border-celestial-border/45 bg-celestial-surface/60 px-2.5 py-1 font-mono text-[11px] text-celestial-secondary hover:text-celestial-primary"
                    >
                      {snippetCopied ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-400" strokeWidth={1.5} />
                          <span>Copied</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" strokeWidth={1.5} />
                          <span>Copy Code</span>
                        </>
                      )}
                    </button>
                  </div>
                  <pre className="max-h-64 overflow-auto p-4 font-mono text-xs leading-relaxed text-celestial-secondary">
                    {codeSnippet}
                  </pre>
                </div>
              </>
            ) : null}
          </section>

          {/* RIGHT DOCK: Living Companion Sora + Telemetry Metadata (3 Cols) */}
          <aside className="space-y-4 lg:sticky lg:top-24 lg:col-span-3">
            <AnimeOperator
              apiState={apiState}
              statusText={operatorNote}
              compact={true}
            />

            {activeEndpoint && (
              <div className="celestial-card space-y-2.5 p-4 font-mono text-xs">
                <div className="text-[11px] uppercase tracking-wider text-celestial-sky">
                  Route Contract Metadata
                </div>
                <div className="flex justify-between border-b border-celestial-border/25 pb-1.5">
                  <span className="text-celestial-muted">Category</span>
                  <span className="text-celestial-primary">{activeEndpoint.category}</span>
                </div>
                <div className="flex justify-between border-b border-celestial-border/25 pb-1.5">
                  <span className="text-celestial-muted">Credit Cost</span>
                  <span className="text-celestial-primary">{activeEndpoint.credits} CR</span>
                </div>
                <div className="flex justify-between border-b border-celestial-border/25 pb-1.5">
                  <span className="text-celestial-muted">Timeout Guard</span>
                  <span className="text-celestial-primary">
                    {((activeEndpoint.deadline || 20000) / 1000).toFixed(0)}s
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-celestial-muted">Cache TTL</span>
                  <span className="text-celestial-primary">
                    {activeEndpoint.cacheTtl ? `${activeEndpoint.cacheTtl}s` : 'Dynamic'}
                  </span>
                </div>
              </div>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
};

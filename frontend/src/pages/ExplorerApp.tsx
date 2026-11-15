import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowUpRight,
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
  const [directoryOpen, setDirectoryOpen] = useState(false);
  const directoryTriggerRef = useRef<HTMLButtonElement | null>(null);

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
  const [mobileWorkspace, setMobileWorkspace] = useState<'request' | 'response'>('request');
  const [operatorNote, setOperatorNote] = useState('');
  const [, setBurstSignal] = useState(0);
  const [snippetLang, setSnippetLang] = useState<SnippetLang>('cURL');
  const [snippetCopied, setSnippetCopied] = useState(false);
  const [snippetCopyMessage, setSnippetCopyMessage] = useState('');

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
      const pending = abortRef.current;
      abortRef.current = null;
      pending?.abort();
    };
    window.addEventListener('pagehide', purgeSecrets);
    return () => {
      window.removeEventListener('pagehide', purgeSecrets);
      const pending = abortRef.current;
      abortRef.current = null;
      pending?.abort();
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
    const previous = abortRef.current;
    abortRef.current = null;
    previous?.abort('endpoint_changed');
    setApiState('idle');
    setMobileWorkspace('request');
    setOperatorNote('');
    setRespText('');
    setRespValue(null);
    setRespHeaders([]);
    setRespStatus(null);
    setRespDuration(null);
    setRespBytes(null);
    setRespTruncated(false);
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
      const rawText = await readBounded(res, 1_048_576);
      if (abortRef.current !== controller || controller.signal.aborted) return;
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
      setMobileWorkspace('response');

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
      if (abortRef.current !== controller) return;
      if (controller.signal.aborted && controller.signal.reason === 'timeout') {
        setApiState('error');
        setOperatorNote('Request timed out. Check the parameters and try again.');
      } else if (controller.signal.aborted) {
        setApiState('cancelled');
        setOperatorNote('Request cancelled via AbortController.');
      } else {
        setApiState('error');
        setOperatorNote(`Transport error: ${err?.message || 'Request failed'}`);
      }
    } finally {
      clearTimeout(timer);
      if (abortRef.current === controller) abortRef.current = null;
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
      setSnippetCopyMessage('Code copied.');
      setSnippetCopied(true);
      setTimeout(() => setSnippetCopied(false), 1600);
    } catch {
      setSnippetCopied(false);
      setSnippetCopyMessage('Could not copy the code. Select and copy it manually.');
    }
  };

  return (
    <div className="celestial-atmosphere relative min-h-screen overflow-x-clip pb-16">
      <a href="#main-content" className="skip-link">Skip to content</a>
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

      <main id="main-content" tabIndex={-1} className="relative z-10 mx-auto max-w-[1480px] px-4 pt-28 sm:px-6 sm:pt-32 lg:px-10">
        <div className="mb-8 grid items-end gap-6 lg:grid-cols-12">
          <div className="space-y-2 lg:col-span-5">
            <div className="section-kicker inline-flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5" strokeWidth={1.5} />
              <span>LIVE API WORKBENCH</span>
            </div>
            <h1 className="font-display text-3xl font-semibold tracking-[-0.045em] text-celestial-primary sm:text-5xl">
              Build the request. See the truth.
            </h1>
            <p className="max-w-xl text-sm leading-6 text-celestial-secondary">
              Explore the real contract, execute deliberately, inspect the response, and leave with code that is ready to adapt.
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
                href="/signin?returnTo=%2Fexplorer"
                className="font-mono text-[11px] text-celestial-sky hover:underline"
              >
                Need Session Auth? Sign In →
              </a>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <input
                  type={showKey ? 'text' : 'password'}
                  aria-label="Bearer API key"
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
              <div className="flex items-center gap-2 font-mono text-[11px] text-celestial-primary">
                <ShieldAlert className="h-3.5 w-3.5 shrink-0" strokeWidth={1.5} />
                <span>{quotaError}</span>
              </div>
            )}

            {quotaInfo && (
              <div className="flex flex-wrap items-center gap-3 rounded-lg border border-celestial-border bg-celestial-elevated px-3 py-1.5 font-mono text-[11px] text-celestial-primary">
                <span>Account: {quotaInfo.email}</span>
                {quotaInfo.balance !== undefined && <span>· Credits: {quotaInfo.balance}</span>}
                {quotaInfo.plan && <span>· Tier: {quotaInfo.plan}</span>}
              </div>
            )}
          </div>
        </div>

        {/* 3-Column Workbench Layout */}
        <div className="explorer-grid grid items-start gap-5 lg:grid-cols-12">
          {/* LEFT SIDEBAR: Searchable Route Directory (3 Cols) */}
          <button ref={directoryTriggerRef} type="button" className="endpoint-picker lg:hidden" aria-expanded={directoryOpen} aria-controls="endpoint-directory" onClick={() => setDirectoryOpen((value) => !value)}>
            <span><span className="endpoint-picker-label">Selected endpoint</span><strong>{activeEndpoint?.title || 'Choose an endpoint'}</strong></span>
            <span aria-hidden="true">{directoryOpen ? '−' : '+'}</span>
          </button>
          <aside id="endpoint-directory" aria-label="Endpoint directory" className={`endpoint-directory celestial-card flex-col overflow-hidden lg:col-span-3 lg:flex ${directoryOpen ? 'flex' : 'hidden'}`}>
            <div className="space-y-3 border-b border-celestial-border/40 p-3.5">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-celestial-muted"
                  strokeWidth={1.5}
                />
                <input
                  type="text"
                  aria-label="Filter endpoints"
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

            <div className="directory-count" aria-live="polite">{filteredEndpoints.length} endpoints <span>Scroll to browse ↓</span></div>
            <div className="max-h-[420px] divide-y divide-celestial-border/25 overflow-y-auto lg:max-h-[680px]" tabIndex={0} aria-label="Scrollable endpoint list">
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
                      onClick={() => { setActiveId(ep.id); if (directoryOpen) { setDirectoryOpen(false); directoryTriggerRef.current?.focus(); } }}
                      aria-pressed={selected}
                      className={`directory-item flex w-full flex-col gap-1 px-3.5 py-3 text-left transition-colors ${
                        selected
                          ? 'bg-celestial-sky/15'
                          : 'hover:bg-celestial-elevated/45'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 font-mono text-[10px]">
                        <span className="rounded bg-celestial-sky/15 px-1.5 py-0.5 font-semibold text-celestial-sky">
                          {ep.method}
                        </span>
                        <span className={ep.public ? 'font-medium text-celestial-primary' : 'font-medium text-celestial-secondary'}>
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
          <section className="workspace-body lg:col-span-9">
            {activeEndpoint ? (
              <>
                <div className="workspace-switch lg:hidden" aria-label="Workspace view">
                  <button type="button" aria-pressed={mobileWorkspace === 'request'} onClick={() => setMobileWorkspace('request')}>Request</button>
                  <button type="button" aria-pressed={mobileWorkspace === 'response'} onClick={() => setMobileWorkspace('response')}>Response {respStatus !== null && <span>{respStatus}</span>}</button>
                </div>
                <div className={`celestial-card workspace-request space-y-4 p-5 ${mobileWorkspace !== 'request' ? 'workspace-mobile-hidden' : ''}`}>
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
                                  <span className="ml-1 text-celestial-primary">*</span>
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
                        className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-celestial-border bg-celestial-elevated px-3.5 py-2 font-mono text-xs text-celestial-secondary transition-colors hover:border-celestial-primary hover:text-celestial-primary"
                      >
                        <Square className="h-3.5 w-3.5" strokeWidth={1.5} />
                        <span>Cancel Stream</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Structured JSON Viewer */}
                <div className={`workspace-response ${mobileWorkspace !== 'response' ? 'workspace-mobile-hidden' : ''}`}><JsonViewer
                  formattedText={respText}
                  parsedValue={respValue}
                  headers={respHeaders}
                  status={respStatus}
                  durationMs={respDuration}
                  byteLength={respBytes}
                  truncated={respTruncated}
                  maxHeightClass="max-h-[420px]"
                /></div>

                {/* Copyable Multi-Language Code Snippets */}
                <div className="workspace-snippets celestial-card overflow-hidden">
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
                          <Check className="h-3.5 w-3.5 text-celestial-primary" strokeWidth={1.5} />
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
                  <p role="status" className={snippetCopyMessage ? 'px-4 pt-2 text-xs text-celestial-secondary' : 'sr-only'}>{snippetCopyMessage}</p>
                  <pre tabIndex={0} className="max-h-64 overflow-auto p-4 font-mono text-xs leading-relaxed text-celestial-secondary">
                    {codeSnippet}
                  </pre>
                </div>
              </>
            ) : null}
          <aside className="workspace-inspector space-y-4">
            <div className="celestial-card overflow-hidden">
              <div className="border-b border-celestial-border/50 bg-celestial-deep/40 px-4 py-3">
                <div className="section-kicker">REQUEST STATUS</div>
              </div>
              <div className="p-4">
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${apiState === 'loading' ? 'animate-pulse bg-celestial-primary' : apiState === 'idle' ? 'bg-celestial-muted' : 'bg-celestial-primary'}`} />
                  <strong className="text-sm capitalize text-celestial-primary">{apiState}</strong>
                </div>
                <p className="mt-3 text-xs leading-5 text-celestial-secondary" aria-live="polite">{operatorNote || 'No request has been executed in this session.'}</p>
              </div>
            </div>

            {activeEndpoint && (
              <div className="celestial-card space-y-3 p-4 font-mono text-xs">
                <div className="section-kicker">CONTRACT DETAILS</div>
                <div className="flex justify-between border-b border-celestial-border/40 pb-2"><span className="text-celestial-muted">Category</span><span className="text-celestial-primary">{activeEndpoint.category}</span></div>
                <div className="flex justify-between border-b border-celestial-border/40 pb-2"><span className="text-celestial-muted">Access</span><span className="text-celestial-primary">{activeEndpoint.public ? 'Public' : 'Bearer'}</span></div>
                <div className="flex justify-between border-b border-celestial-border/40 pb-2"><span className="text-celestial-muted">Credit cost</span><span className="text-celestial-primary">{activeEndpoint.credits} CR</span></div>
                <div className="flex justify-between border-b border-celestial-border/40 pb-2"><span className="text-celestial-muted">Timeout</span><span className="text-celestial-primary">{((activeEndpoint.deadline || 20000) / 1000).toFixed(0)}s</span></div>
                <div className="flex justify-between"><span className="text-celestial-muted">Cache</span><span className="text-celestial-primary">{activeEndpoint.cacheTtl ? `${activeEndpoint.cacheTtl}s` : 'Dynamic'}</span></div>
              </div>
            )}

            <a href="/docs" className="group flex items-center justify-between rounded-2xl border border-celestial-border/70 bg-celestial-surface p-4 text-sm font-medium text-celestial-secondary transition-colors hover:border-celestial-sky/50 hover:text-celestial-primary">
              <span>Read the full contract</span><ArrowUpRight className="h-4 w-4 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
            </a>
          </aside>
          </section>
        </div>
      </main>
    </div>
  );
};

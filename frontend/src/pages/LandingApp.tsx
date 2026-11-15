import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { motion } from 'motion/react';
import {
  ArrowRight,
  ArrowUpRight,
  Braces,
  Check,
  CircleStop,
  Code2,
  Copy,
  FileJson2,
  Gauge,
  Layers3,
  LockKeyhole,
  Pause,
  Play,
  Route,
  ShieldCheck,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import {
  SAMPLE_PARAMS,
  SNIPPET_LANGUAGES,
  formatResponse,
  loadCatalog,
  makeRequest,
  makeSnippet,
  readBounded,
  type EndpointSpec,
  type OperatorApiState,
  type SnippetLang,
} from '../lib/api-bridge';
import { CelestialNavbar } from '../components/CelestialNavbar';
import { CommandModal } from '../components/CommandModal';
import { JsonViewer } from '../components/JsonViewer';
import { useCelestialTheme } from '../lib/theme';

gsap.registerPlugin(ScrollTrigger);

const FEATURED_IDS = ['sys.health', 'search.anime', 'stalk.github', 'util.iplookup', 'search.manga'];

const VALUE_BLOCKS = [
  {
    icon: ShieldCheck,
    index: '01',
    title: 'Safe by default',
    copy: 'Volatile credentials, bounded response streams, and automatic redaction keep experimentation from becoming a security footgun.',
  },
  {
    icon: Braces,
    index: '02',
    title: 'One predictable shape',
    copy: 'Consistent JSON envelopes and real OpenAPI contracts make every route feel familiar after the first request.',
  },
  {
    icon: Gauge,
    index: '03',
    title: 'Built for iteration',
    copy: 'Tune parameters, execute explicitly, inspect headers, then move to production-ready snippets without changing context.',
  },
];

export const LandingApp: React.FC = () => {
  const { theme, reducedMotion } = useCelestialTheme();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const [endpoints, setEndpoints] = useState<EndpointSpec[]>([]);
  const [commandOpen, setCommandOpen] = useState(false);
  const [selectedId, setSelectedId] = useState('sys.health');
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [apiState, setApiState] = useState<OperatorApiState>('idle');
  const [statusText, setStatusText] = useState('Ready when you are. Requests only run after an explicit execute.');
  const [snippetLang, setSnippetLang] = useState<SnippetLang>('cURL');
  const [copied, setCopied] = useState(false);
  const [responseText, setResponseText] = useState('');
  const [responseValue, setResponseValue] = useState<unknown>(null);
  const [responseHeaders, setResponseHeaders] = useState<Array<[string, string]>>([]);
  const [responseStatus, setResponseStatus] = useState<number | null>(null);
  const [responseDuration, setResponseDuration] = useState<number | null>(null);
  const [responseBytes, setResponseBytes] = useState<number | null>(null);
  const [responseTruncated, setResponseTruncated] = useState(false);
  const [videoMuted, setVideoMuted] = useState(true);
  const [videoPaused, setVideoPaused] = useState(false);

  useEffect(() => {
    let active = true;
    loadCatalog()
      .then((items) => {
        if (active) setEndpoints(items || []);
      })
      .catch(() => {
        if (active) setStatusText('The endpoint catalog is temporarily unavailable.');
      });
    return () => {
      active = false;
      abortRef.current?.abort();
    };
  }, []);

  const featuredEndpoints = useMemo(() => {
    const picked = FEATURED_IDS.map((id) => endpoints.find((endpoint) => endpoint.id === id)).filter(
      Boolean
    ) as EndpointSpec[];
    return picked.length ? picked : endpoints.filter((endpoint) => endpoint.public).slice(0, 5);
  }, [endpoints]);

  const activeEndpoint = useMemo(
    () => featuredEndpoints.find((endpoint) => endpoint.id === selectedId) || featuredEndpoints[0] || null,
    [featuredEndpoints, selectedId]
  );

  useEffect(() => {
    if (!activeEndpoint) return;
    setSelectedId(activeEndpoint.id);
    const next: Record<string, string> = {};
    const samples = SAMPLE_PARAMS[activeEndpoint.id] || {};
    for (const parameter of activeEndpoint.parameters || []) {
      next[parameter.name] =
        samples[parameter.name] !== undefined
          ? String(samples[parameter.name])
          : parameter.schema?.default !== undefined
            ? String(parameter.schema.default)
            : '';
    }
    setParamValues(next);
    setApiState('idle');
    setStatusText('Ready when you are. Requests only run after an explicit execute.');
  }, [activeEndpoint]);

  useLayoutEffect(() => {
    if (reducedMotion) return;
    const context = gsap.context(() => {
      gsap.fromTo(
        '.hero-reveal',
        { y: 28, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.9, stagger: 0.09, ease: 'power3.out' }
      );
      gsap.fromTo(
        '.hero-mask-word > span',
        { yPercent: 118, rotate: 2 },
        { yPercent: 0, rotate: 0, duration: 1.15, stagger: 0.1, ease: 'power4.out', delay: 0.08 }
      );
      gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach((section) => {
        gsap.fromTo(
          section,
          { y: 42, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.8,
            ease: 'power3.out',
            scrollTrigger: { trigger: section, start: 'top 84%', once: true },
          }
        );
      });
      gsap.to('.hero-background-media', {
        yPercent: 10,
        scale: 1.06,
        ease: 'none',
        scrollTrigger: { trigger: '.hero-cinematic', start: 'top top', end: 'bottom top', scrub: 0.7 },
      });
      gsap.to('.anime-parallax-image', {
        yPercent: -12,
        ease: 'none',
        scrollTrigger: { trigger: '.bento-image-card', start: 'top bottom', end: 'bottom top', scrub: 0.8 },
      });
    }, rootRef);
    return () => context.revert();
  }, [reducedMotion]);

  const runRequest = useCallback(async () => {
    if (!activeEndpoint) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const { path, method } = makeRequest(activeEndpoint, paramValues);
    setApiState('loading');
    setStatusText(`Dispatching ${method} ${path}`);
    const started = performance.now();
    const timer = window.setTimeout(() => controller.abort('timeout'), activeEndpoint.deadline || 15000);

    try {
      const response = await fetch(path, {
        method,
        signal: controller.signal,
        credentials: 'omit',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      window.clearTimeout(timer);
      const raw = await readBounded(response, 1_048_576);
      const formatted = formatResponse(raw, '');
      const duration = Math.max(1, Math.round(performance.now() - started));
      const bytes = new TextEncoder().encode(raw).byteLength;
      const headers: Array<[string, string]> = [];
      response.headers.forEach((value, key) => headers.push([key, value]));
      setResponseText(formatted.text);
      setResponseValue(formatted.value);
      setResponseHeaders(headers);
      setResponseStatus(response.status);
      setResponseDuration(duration);
      setResponseBytes(bytes);
      setResponseTruncated(raw.includes('truncated at'));
      setApiState(response.ok ? 'success' : 'error');
      setStatusText(`HTTP ${response.status} · ${duration} ms · ${(bytes / 1024).toFixed(1)} KB`);
    } catch (error: any) {
      window.clearTimeout(timer);
      const cancelled = controller.signal.aborted;
      setApiState(cancelled ? 'cancelled' : 'error');
      setStatusText(cancelled ? 'Request cancelled. The stream was closed cleanly.' : error?.message || 'Request failed.');
    }
  }, [activeEndpoint, paramValues]);

  const cancelRequest = () => {
    abortRef.current?.abort('user_cancelled');
    setApiState('cancelled');
  };

  const snippet = useMemo(
    () => (activeEndpoint ? makeSnippet(activeEndpoint, paramValues, snippetLang) : ''),
    [activeEndpoint, paramValues, snippetLang]
  );

  const copySnippet = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      setStatusText('Clipboard access was blocked by the browser.');
    }
  };

  const toggleVideo = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
      setVideoPaused(false);
    } else {
      video.pause();
      setVideoPaused(true);
    }
  };

  const toggleAudio = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !videoMuted;
    setVideoMuted(!videoMuted);
    if (video.paused) {
      video.play().catch(() => {});
      setVideoPaused(false);
    }
  };

  const isDark = theme === 'dark';

  return (
    <div ref={rootRef} className="celestial-atmosphere min-h-screen overflow-x-clip">
      <CelestialNavbar
        activeRoute="landing"
        onOpenCommand={() => setCommandOpen(true)}
        amvAudioAvailable
        amvMuted={videoMuted}
        onToggleAmvAudio={toggleAudio}
        endpointCount={endpoints.length}
      />
      <CommandModal open={commandOpen} onClose={() => setCommandOpen(false)} endpoints={endpoints} />

      <main>
        <section className="hero-cinematic relative isolate min-h-[100svh] overflow-hidden border-b border-celestial-border/60">
          <div className="hero-background-media absolute inset-0 -z-20">
            <video
              ref={videoRef}
              autoPlay={!reducedMotion}
              loop
              muted
              playsInline
              preload="metadata"
              poster="/assets/media/intro-poster.webp"
              className={`h-full w-full object-cover ${isDark ? 'brightness-[0.72]' : 'brightness-[0.8]'}`}
            >
              <source src="/assets/media/intro.webm" type="video/webm" />
              <source src="/assets/media/intro.mp4" type="video/mp4" />
            </video>
          </div>
          <div className="hero-film-overlay absolute inset-0 -z-10" aria-hidden="true" />
          <div className="hero-editorial-grid mx-auto grid min-h-[100svh] max-w-[1480px] grid-cols-12 content-end px-5 pb-10 pt-32 sm:px-8 sm:pb-14 lg:px-12 lg:pb-16">
            <div className="col-span-12 lg:col-span-9">
              <div className="hero-reveal mb-5 flex items-center gap-3 font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-white/68 sm:text-xs">
                <span className="status-dot" />
                REST infrastructure for people who ship
              </div>
              <h1 className="hero-title text-white">
                <span className="hero-mask-word"><span>Build beyond</span></span>
                <span className="hero-mask-word hero-title-accent"><span>the obvious.</span></span>
              </h1>
              <div className="hero-reveal mt-7 grid gap-7 border-t border-white/20 pt-6 sm:grid-cols-[minmax(0,34rem)_1fr] sm:items-end lg:max-w-5xl">
                <p className="max-w-xl text-pretty text-sm leading-7 text-white/72 sm:text-base">
                  Search, media extraction, developer utilities, and discovery APIs—one clean contract, one focused workbench, zero dashboard theatre.
                </p>
                <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                  <motion.a
                    whileTap={{ scale: 0.98 }}
                    href="/explorer.html"
                    className="btn-celestial-primary animated-button group inline-flex min-h-13 items-center justify-center gap-3 rounded-full px-6 py-3.5 text-sm font-semibold"
                  >
                    <span>Open Workbench</span>
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </motion.a>
                  <a href="/docs" className="btn-glass animated-button inline-flex min-h-13 items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold">
                    Read API Docs
                    <ArrowUpRight className="h-4 w-4" />
                  </a>
                </div>
              </div>
            </div>

            <div className="hero-reveal col-span-12 mt-8 flex flex-wrap items-end justify-between gap-5 border-t border-white/15 pt-5 text-white lg:mt-12">
              <div className="grid grid-cols-3 gap-6 sm:gap-12">
                <div><strong className="hero-metric">{endpoints.length || '—'}</strong><span className="hero-metric-label">real routes</span></div>
                <div><strong className="hero-metric">3.1</strong><span className="hero-metric-label">OpenAPI</span></div>
                <div><strong className="hero-metric">1 MB</strong><span className="hero-metric-label">stream guard</span></div>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={toggleVideo} aria-label={videoPaused ? 'Play hero video' : 'Pause hero video'} className="media-control">
                  {videoPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                </button>
                <button type="button" onClick={toggleAudio} aria-label={videoMuted ? 'Unmute hero video' : 'Mute hero video'} className="media-control">
                  {videoMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>
        </section>

        <section data-reveal className="border-y border-celestial-border/60 bg-celestial-surface/55 py-5">
          <div className="ticker-track" aria-label="API capabilities">
            {[...Array(2)].flatMap((_, repeat) => ['SEARCH', 'EXTRACT', 'DISCOVER', 'AUTOMATE', 'INSPECT'].map((word) => (
              <React.Fragment key={`${repeat}-${word}`}><span>{word}</span><i /></React.Fragment>
            )))}
          </div>
        </section>

        <section data-reveal id="playground" className="mx-auto max-w-[1480px] px-5 py-24 sm:px-8 lg:px-12 lg:py-32">
          <div className="mb-12 flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
            <div className="max-w-2xl">
              <p className="section-kicker">NO MOCKS. NO AUTO-RUN.</p>
              <h2 className="section-title">A real request, without leaving the page.</h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-celestial-secondary">Pick a public route, tune the actual parameters, and inspect the response. Nothing fires until you press execute.</p>
          </div>

          <div className="workbench-shell grid overflow-hidden lg:grid-cols-[300px_1fr]">
            <aside className="route-rail">
              <div className="rail-heading"><Route className="h-4 w-4" /><span>Public routes</span></div>
              <div className="space-y-1.5 p-3">
                {featuredEndpoints.map((endpoint, index) => (
                  <button
                    key={endpoint.id}
                    type="button"
                    onClick={() => setSelectedId(endpoint.id)}
                    className={`route-row ${activeEndpoint?.id === endpoint.id ? 'is-active' : ''}`}
                  >
                    <span className="route-index">0{index + 1}</span>
                    <span className="min-w-0 flex-1"><strong>{endpoint.title}</strong><small>{endpoint.executionPath}</small></span>
                    <ArrowRight className="h-3.5 w-3.5 shrink-0" />
                  </button>
                ))}
              </div>
              <a href="/explorer.html" className="rail-footer">Browse all {endpoints.length || ''} routes <ArrowUpRight className="h-3.5 w-3.5" /></a>
            </aside>

            <div className="min-w-0 bg-celestial-canvas/45">
              {activeEndpoint && (
                <>
                  <div className="request-editor border-b border-celestial-border/60 p-5 sm:p-7">
                    <div className="flex flex-wrap items-start justify-between gap-5">
                      <div>
                        <div className="mb-3 flex flex-wrap items-center gap-2 font-mono text-[11px]">
                          <span className="method-pill">{activeEndpoint.method}</span>
                          <span className="text-celestial-muted">{activeEndpoint.id}</span>
                        </div>
                        <h3 className="font-display text-2xl font-semibold tracking-tight text-celestial-primary">{activeEndpoint.title}</h3>
                        <p className="mt-2 max-w-2xl text-sm leading-6 text-celestial-secondary">{activeEndpoint.description}</p>
                      </div>
                      <span className="access-pill">{activeEndpoint.public ? 'Public access' : `${activeEndpoint.credits} credits`}</span>
                    </div>

                    <div className="mt-6 grid gap-4 sm:grid-cols-2">
                      {(activeEndpoint.parameters || []).map((parameter) => (
                        <label key={parameter.name} className="field-label">
                          <span>{parameter.name}{parameter.required && <b>*</b>}</span>
                          <input
                            value={paramValues[parameter.name] ?? ''}
                            onChange={(event) => setParamValues((current) => ({ ...current, [parameter.name]: event.target.value }))}
                            placeholder={parameter.description || parameter.name}
                            className="field-input"
                          />
                        </label>
                      ))}
                    </div>

                    <div className="mt-6 flex flex-col gap-4 border-t border-celestial-border/50 pt-5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="font-mono text-xs text-celestial-muted" aria-live="polite">{statusText}</div>
                      <div className="flex gap-2">
                        {apiState === 'loading' && <button type="button" onClick={cancelRequest} className="btn-danger"><CircleStop className="h-4 w-4" />Cancel</button>}
                        <motion.button whileTap={{ scale: 0.98 }} type="button" onClick={runRequest} disabled={apiState === 'loading'} className="btn-celestial-primary inline-flex min-h-11 items-center gap-2 rounded-xl px-5 text-sm font-semibold disabled:opacity-55">
                          <Zap className="h-4 w-4" />{apiState === 'loading' ? 'Running…' : 'Execute request'}
                        </motion.button>
                      </div>
                    </div>
                  </div>

                  <div className="grid lg:grid-cols-2">
                    <div className="min-w-0 border-b border-celestial-border/60 lg:border-b-0 lg:border-r">
                      <div className="code-toolbar">
                        <div className="flex gap-1">
                          {SNIPPET_LANGUAGES.map((language) => <button key={language} type="button" onClick={() => setSnippetLang(language)} className={`code-tab ${snippetLang === language ? 'is-active' : ''}`}>{language}</button>)}
                        </div>
                        <button type="button" onClick={copySnippet} className="copy-button">{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copied ? 'Copied' : 'Copy'}</button>
                      </div>
                      <pre className="h-[360px] overflow-auto p-5 font-mono text-xs leading-6 text-celestial-secondary"><code>{snippet}</code></pre>
                    </div>
                    <div className="min-w-0">
                      <JsonViewer formattedText={responseText} parsedValue={responseValue} headers={responseHeaders} status={responseStatus} durationMs={responseDuration} byteLength={responseBytes} truncated={responseTruncated} maxHeightClass="max-h-[360px]" />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>

        <section data-reveal className="bento-section border-y border-celestial-border/60">
          <div className="mx-auto max-w-[1480px] px-5 py-24 sm:px-8 lg:px-12 lg:py-32">
            <div className="mb-12 grid gap-6 lg:grid-cols-12 lg:items-end">
              <div className="lg:col-span-8">
                <p className="section-kicker">SYSTEM, RECOMPOSED</p>
                <h2 className="section-title">A sharper interface for a faster thought.</h2>
              </div>
              <p className="max-w-md text-pretty text-sm leading-7 text-celestial-secondary lg:col-span-4">Swiss discipline in the grid. Cinematic tension in the composition. The API stays direct, readable, and deliberately alive.</p>
            </div>

            <div className="cinematic-bento">
              <article className="bento-image-card group">
                <img src="/assets/media/anime-operator-blue.png" alt="Original anime API operator in a cobalt-lit server corridor" width="1672" height="941" loading="lazy" className="anime-parallax-image" />
                <div className="bento-image-shade" />
                <div className="absolute inset-x-0 bottom-0 z-10 flex items-end justify-between gap-4 p-6 sm:p-8">
                  <div><span className="bento-index">01 / VISUAL SYSTEM</span><h3 className="bento-title text-white">Cool focus.<br />Zero noise.</h3></div>
                  <ArrowUpRight className="h-5 w-5 text-white/70 transition-transform group-hover:-translate-y-1 group-hover:translate-x-1" />
                </div>
              </article>

              <article className="bento-stat-card">
                <span className="bento-index">LIVE CATALOG</span>
                <strong className="bento-stat">{endpoints.length || '—'}</strong>
                <p>Real routes generated from the source contract—not decorative dashboard data.</p>
                <div className="bento-orbit" aria-hidden="true" />
              </article>

              {VALUE_BLOCKS.map(({ icon: Icon, index, title, copy }) => (
                <article key={index} className="bento-value-card group">
                  <div className="flex items-center justify-between"><span className="bento-index">{index}</span><Icon className="h-5 w-5 text-celestial-sky" /></div>
                  <div><h3>{title}</h3><p>{copy}</p></div>
                  <span className="bento-line" aria-hidden="true" />
                </article>
              ))}
            </div>
          </div>
        </section>

        <section data-reveal className="mx-auto max-w-[1480px] px-5 py-24 sm:px-8 lg:px-12 lg:py-32">
          <div className="docs-stage grid overflow-hidden lg:grid-cols-[0.95fr_1.05fr]">
            <div className="p-7 sm:p-10 lg:p-14">
              <p className="section-kicker">DOCUMENTATION, RECOMPOSED</p>
              <h2 className="section-title">Docs that don&apos;t feel like homework.</h2>
              <p className="mt-6 max-w-lg text-sm leading-7 text-celestial-secondary">Searchable contracts, focused request examples, clear auth rules, and code you can copy without hunting through a wall of chrome.</p>
              <a href="/docs" className="mt-9 inline-flex items-center gap-2 text-sm font-semibold text-celestial-primary hover:text-celestial-sky">Explore OpenAPI docs <ArrowRight className="h-4 w-4" /></a>
            </div>
            <div className="docs-visual">
              <div className="docs-mini-sidebar"><span>GETTING STARTED</span><b>Introduction</b><b>Authentication</b><span>ENDPOINTS</span><b>Search</b><b>Downloaders</b><b>Utilities</b></div>
              <div className="docs-mini-content">
                <div className="flex items-center gap-2"><span className="method-pill">GET</span><code>/api/v1/search/anime</code></div>
                <h3>Search anime</h3>
                <p>Discover titles and metadata through the unified response envelope.</p>
                <div className="docs-code"><span>curl</span> https://api.itsfaiz.my.id/api/v1/search/anime?q=frieren</div>
                <div className="docs-response"><FileJson2 className="h-4 w-4" /><span>200 · application/json</span></div>
              </div>
            </div>
          </div>
        </section>

        <section data-reveal className="mx-auto max-w-[1480px] px-5 pb-24 sm:px-8 lg:px-12 lg:pb-32">
          <div className="cta-panel">
            <div>
              <p className="section-kicker">READY TO BUILD?</p>
              <h2 className="mt-3 font-display text-4xl font-semibold tracking-[-0.055em] text-celestial-primary sm:text-6xl">Your next request is one click away.</h2>
            </div>
            <a href="/explorer.html" className="btn-celestial-primary inline-flex min-h-14 shrink-0 items-center justify-center gap-3 rounded-2xl px-7 text-sm font-semibold">Launch workbench <ArrowUpRight className="h-4 w-4" /></a>
          </div>
        </section>
      </main>

      <footer className="border-t border-celestial-border/60 px-5 py-8 sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-[1480px] flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3"><img src="/icon.png" alt="KanjutGede" className="h-8 w-8 rounded-lg" /><div><strong className="block text-sm text-celestial-primary">KanjutGede API</strong><span className="text-xs text-celestial-muted">Built for developers who prefer shipping.</span></div></div>
          <div className="flex gap-5 text-xs font-medium text-celestial-secondary"><a href="/docs">Docs</a><a href="/explorer.html">Workbench</a><a href="/signin.html">Sign in</a></div>
        </div>
      </footer>
    </div>
  );
};

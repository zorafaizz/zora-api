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
        { y: 34, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.85, stagger: 0.08, ease: 'power3.out' }
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
      gsap.to('.hero-media-shell', {
        yPercent: 7,
        ease: 'none',
        scrollTrigger: { trigger: '.hero-grid', start: 'top top', end: 'bottom top', scrub: 0.6 },
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
        <section className="hero-grid mx-auto grid min-h-screen max-w-[1480px] items-center gap-12 px-5 pb-20 pt-32 sm:px-8 lg:grid-cols-[0.82fr_1.18fr] lg:px-12 lg:pt-28">
          <div className="relative z-10 max-w-2xl">
            <div className="hero-reveal mb-7 inline-flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.16em] text-celestial-secondary">
              <span className="status-dot" />
              REST infrastructure for people who ship
            </div>
            <h1 className="hero-reveal font-display text-[clamp(3.5rem,7vw,7.6rem)] font-semibold leading-[0.83] tracking-[-0.075em] text-celestial-primary">
              Make the web
              <span className="block text-celestial-sky">programmable.</span>
            </h1>
            <p className="hero-reveal mt-8 max-w-xl text-base leading-7 text-celestial-secondary sm:text-lg">
              Search, media extraction, developer utilities, and discovery APIs—one clean contract,
              one focused workbench, zero dashboard theatre.
            </p>
            <div className="hero-reveal mt-9 flex flex-col gap-3 sm:flex-row">
              <motion.a
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.98 }}
                href="/explorer.html"
                className="btn-celestial-primary group inline-flex min-h-13 items-center justify-center gap-3 rounded-2xl px-6 py-3.5 text-sm font-semibold"
              >
                Open the workbench
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </motion.a>
              <a
                href="/docs"
                className="btn-secondary inline-flex min-h-13 items-center justify-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-semibold"
              >
                Read API docs
                <ArrowUpRight className="h-4 w-4" />
              </a>
            </div>
            <div className="hero-reveal mt-10 grid grid-cols-3 gap-3 border-t border-celestial-border/60 pt-5">
              <div><strong className="metric-value">{endpoints.length || '—'}</strong><span className="metric-label">real routes</span></div>
              <div><strong className="metric-value">OpenAPI</strong><span className="metric-label">3.1 contract</span></div>
              <div><strong className="metric-value">1 MB</strong><span className="metric-label">stream guard</span></div>
            </div>
          </div>

          <div className="hero-reveal hero-media-shell relative lg:pl-4">
            <div className="media-ruler" aria-hidden="true"><span>00</span><span>16:9</span><span>100</span></div>
            <div className="video-frame">
              <video
                ref={videoRef}
                autoPlay={!reducedMotion}
                loop
                muted
                playsInline
                preload="metadata"
                poster="/assets/media/intro-poster.webp"
                className={`aspect-video h-auto w-full bg-black object-contain ${isDark ? 'brightness-[0.82]' : 'brightness-[0.96]'}`}
              >
                <source src="/assets/media/intro.webm" type="video/webm" />
                <source src="/assets/media/intro.mp4" type="video/mp4" />
              </video>
              <div className="video-vignette" aria-hidden="true" />
              <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 sm:p-5">
                <div className="rounded-xl border border-white/15 bg-black/55 px-3 py-2 text-white backdrop-blur-md">
                  <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/55">Visual signal</div>
                  <div className="mt-0.5 text-xs font-medium sm:text-sm">Original 16:9 frame · uncropped</div>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={toggleVideo} aria-label={videoPaused ? 'Play hero video' : 'Pause hero video'} className="media-control">
                    {videoPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                  </button>
                  <button type="button" onClick={toggleAudio} aria-label={videoMuted ? 'Unmute hero video' : 'Mute hero video'} className="media-control">
                    {videoMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
            <div className="media-caption"><span>KG / SIGNAL FILM 01</span><span>1920 × 1080 DISPLAY</span></div>
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

        <section data-reveal className="border-y border-celestial-border/60 bg-celestial-surface/45">
          <div className="mx-auto max-w-[1480px] px-5 sm:px-8 lg:px-12">
            <div className="grid lg:grid-cols-[0.72fr_1.28fr]">
              <div className="py-20 pr-0 lg:border-r lg:border-celestial-border/60 lg:py-28 lg:pr-16">
                <p className="section-kicker">THE DIFFERENCE IS RESTRAINT</p>
                <h2 className="section-title">Less spectacle.<br />More signal.</h2>
                <p className="mt-6 text-sm leading-7 text-celestial-secondary">Every interaction is designed to shorten the distance between an idea and a working request.</p>
              </div>
              <div className="divide-y divide-celestial-border/60 lg:pl-16">
                {VALUE_BLOCKS.map(({ icon: Icon, index, title, copy }) => (
                  <article key={index} className="value-row group">
                    <span className="value-index">{index}</span>
                    <Icon className="h-5 w-5 text-celestial-sky" />
                    <div><h3>{title}</h3><p>{copy}</p></div>
                    <ArrowUpRight className="ml-auto h-4 w-4 text-celestial-muted transition-transform group-hover:-translate-y-1 group-hover:translate-x-1" />
                  </article>
                ))}
              </div>
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

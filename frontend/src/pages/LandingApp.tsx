import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { motion } from 'motion/react';
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  CircleStop,
  Copy,
  Route,
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
import { LandingHero } from '../components/landing/LandingHero';
import {
  CapabilityRail,
  DocsSection,
  LandingCta,
  LandingFooter,
  SystemSection,
} from '../components/landing/LandingSections';
import { useCelestialTheme } from '../lib/theme';

gsap.registerPlugin(ScrollTrigger);

const FEATURED_IDS = ['sys.health', 'search.anime', 'stalk.github', 'util.iplookup', 'search.manga'];

export const LandingApp: React.FC = () => {
  const { reducedMotion } = useCelestialTheme();
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

  return (
    <div ref={rootRef} className="celestial-atmosphere min-h-screen overflow-x-clip">
      <a href="#main-content" className="skip-link">Skip to Content</a>
      <CelestialNavbar
        activeRoute="landing"
        onOpenCommand={() => setCommandOpen(true)}
        amvAudioAvailable
        amvMuted={videoMuted}
        onToggleAmvAudio={toggleAudio}
        endpointCount={endpoints.length}
      />
      <CommandModal open={commandOpen} onClose={() => setCommandOpen(false)} endpoints={endpoints} />

      <main id="main-content">
        <LandingHero
          endpointCount={endpoints.length}
          reducedMotion={reducedMotion}
          videoRef={videoRef}
          videoMuted={videoMuted}
          videoPaused={videoPaused}
          onToggleAudio={toggleAudio}
          onToggleVideo={toggleVideo}
        />
        <CapabilityRail />

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
              <a href="/explorer" className="rail-footer">Browse all {endpoints.length || ''} routes <ArrowUpRight className="h-3.5 w-3.5" /></a>
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

        <SystemSection endpointCount={endpoints.length} />
        <DocsSection />
        <LandingCta />
      </main>
      <LandingFooter />
    </div>
  );
};

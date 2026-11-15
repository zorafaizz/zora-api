import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { motion } from 'motion/react';
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Check,
  Code2,
  Compass,
  Copy,
  KeyRound,
  Layers,
  Pause,
  Play,
  Radio,
  Shield,
  Sparkles,
  Square,
  Terminal,
  Volume2,
  VolumeX,
  Zap,
} from 'lucide-react';
import { useCelestialTheme } from '../lib/theme';
import { useSmoothScroll } from '../lib/smooth-scroll';
import {
  SAMPLE_PARAMS,
  SNIPPET_LANGUAGES,
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
import { CelestialThreeStage } from '../components/CelestialThreeStage';
import { JsonViewer } from '../components/JsonViewer';

gsap.registerPlugin(ScrollTrigger);

const FEATURED_DEMO_IDS = [
  'search.anime',
  'sys.health',
  'stalk.github',
  'util.iplookup',
  'search.manga',
];

const CHAPTERS = [
  {
    code: 'CHAPTER 01 // ZERO-PERSISTENCE SHIELD',
    title: 'In-Memory Credentials & 1 MB Stream Guard',
    summary:
      'Bearer keys stay strictly inside volatile runtime memory and purge on pagehide. Every live playground stream is bounded to 1,048,576 bytes with automatic secret redaction.',
    metric: '0 bytes written to WebStorage',
    svgPath: 'M24,60 C72,18 132,102 180,60 C228,18 288,102 336,60',
  },
  {
    code: 'CHAPTER 02 // UNIFIED JSON ENVELOPE',
    title: 'Deterministic Contracts Across 42 Live Routes',
    summary:
      'Anime metadata, social stalkers, media extractors, and network utilities share one predictable schema, structured error codes, and OpenAPI 3.1 parity.',
    metric: 'OpenAPI 3.1 + 5 SDK Snippets',
    svgPath: 'M24,60 L96,26 L180,94 L264,26 L336,60',
  },
  {
    code: 'CHAPTER 03 // TRANSPARENT CREDIT LEDGER',
    title: 'Public Exploration First, Metered Scale Ready',
    summary:
      'Test public routes immediately with zero sign-up friction, then unlock authenticated burst quotas through passwordless 8-digit developer sessions.',
    metric: 'Instant Public + Bearer Tiers',
    svgPath: 'M24,78 Q102,14 180,60 T336,42',
  },
];

export const LandingApp: React.FC = () => {
  const { theme, reducedMotion } = useCelestialTheme();
  const { velocityRef, scrollTo } = useSmoothScroll();

  const [endpoints, setEndpoints] = useState<EndpointSpec[]>([]);
  const [commandOpen, setCommandOpen] = useState(false);

  // AMV Hero Video & Soundtrack State
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [amvMuted, setAmvMuted] = useState(true);
  const [amvPaused, setAmvPaused] = useState(false);
  const [introDone, setIntroDone] = useState(false);

  // Live Health Telemetry
  const [healthLatency, setHealthLatency] = useState<number | null>(null);
  const [healthStatus, setHealthStatus] = useState<'online' | 'checking'>('checking');

  // Interactive Quick Playground + Sora Companion State
  const [selectedDemoId, setSelectedDemoId] = useState<string>('search.anime');
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [apiState, setApiState] = useState<OperatorApiState>('idle');
  const [operatorNote, setOperatorNote] = useState<string>('');
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

  // Category filter in Act III
  const [activeCategory, setActiveCategory] = useState<string>('all');

  // Refs for GSAP Intro & Scroll Choreography
  const rootRef = useRef<HTMLDivElement | null>(null);
  const introCurtainRef = useRef<HTMLDivElement | null>(null);
  const heroStageRef = useRef<HTMLElement | null>(null);
  const heroVideoFrameRef = useRef<HTMLDivElement | null>(null);
  const ribbonTrackARef = useRef<HTMLDivElement | null>(null);
  const ribbonTrackBRef = useRef<HTMLDivElement | null>(null);
  const storyPinSectionRef = useRef<HTMLElement | null>(null);
  const morphWavePathRef = useRef<SVGPathElement | null>(null);
  const [activeChapterIdx, setActiveChapterIdx] = useState(0);

  // 1. Load Endpoint Catalog + Real Health Probe
  useEffect(() => {
    let mounted = true;
    loadCatalog()
      .then((items) => {
        if (!mounted) return;
        setEndpoints(items || []);
      })
      .catch(() => {});

    const t0 = performance.now();
    fetch('/api/v1/health', { cache: 'no-store', credentials: 'omit' })
      .then((res) => {
        if (!mounted) return;
        if (res.ok) {
          setHealthLatency(Math.max(1, Math.round(performance.now() - t0)));
          setHealthStatus('online');
        }
      })
      .catch(() => {});

    return () => {
      mounted = false;
      abortRef.current?.abort();
    };
  }, []);

  const demoEndpoints = useMemo(() => {
    if (!endpoints.length) return [];
    const picked = FEATURED_DEMO_IDS.map((id) => endpoints.find((e) => e.id === id)).filter(
      Boolean
    ) as EndpointSpec[];
    return picked.length ? picked : endpoints.filter((e) => e.public).slice(0, 5);
  }, [endpoints]);

  const activeDemoEndpoint = useMemo(() => {
    return (
      demoEndpoints.find((e) => e.id === selectedDemoId) ||
      demoEndpoints[0] ||
      endpoints[0] ||
      null
    );
  }, [demoEndpoints, endpoints, selectedDemoId]);

  // Populate realistic anime/developer sample params whenever demo endpoint changes
  useEffect(() => {
    if (!activeDemoEndpoint) return;
    const defaults: Record<string, string> = {};
    const sampleBag = SAMPLE_PARAMS[activeDemoEndpoint.id] || {};
    for (const p of activeDemoEndpoint.parameters || []) {
      if (activeDemoEndpoint.id === 'search.anime' && p.name === 'q') {
        defaults[p.name] = 'Sousou no Frieren';
      } else if (activeDemoEndpoint.id === 'search.manga' && p.name === 'q') {
        defaults[p.name] = 'Vagabond';
      } else if (sampleBag[p.name] !== undefined) {
        defaults[p.name] = String(sampleBag[p.name]);
      } else if (p.schema?.default !== undefined) {
        defaults[p.name] = String(p.schema.default);
      } else {
        defaults[p.name] = '';
      }
    }
    setParamValues(defaults);
  }, [activeDemoEndpoint]);

  // 2. Smooth AMV Soundtrack Toggle with Gentle Gain Ramp
  const toggleAmvAudio = useCallback(() => {
    const vid = videoRef.current;
    if (!vid) return;
    if (amvMuted) {
      vid.muted = false;
      vid.volume = 0.05;
      vid.play().catch(() => {});
      gsap.to(vid, { volume: 0.72, duration: 0.65, ease: 'power2.out' });
      setAmvMuted(false);
      setAmvPaused(false);
    } else {
      gsap.to(vid, {
        volume: 0,
        duration: 0.3,
        ease: 'power2.in',
        onComplete: () => {
          vid.muted = true;
        },
      });
      setAmvMuted(true);
    }
  }, [amvMuted]);

  const toggleAmvPlay = useCallback(() => {
    const vid = videoRef.current;
    if (!vid) return;
    if (vid.paused) {
      vid.play().catch(() => {});
      setAmvPaused(false);
    } else {
      vid.pause();
      setAmvPaused(true);
    }
  }, []);

  // 3. GSAP Cinematic Anime Opening + ScrollTrigger Choreography
  useLayoutEffect(() => {
    if (reducedMotion) {
      setIntroDone(true);
      return;
    }

    const ctx = gsap.context(() => {
      // A. Cinematic Anime Opening Timeline (non-blocking pointer-events-none veil)
      const introTl = gsap.timeline({
        onComplete: () => setIntroDone(true),
      });

      if (introCurtainRef.current) {
        introTl
          .fromTo(
            introCurtainRef.current,
            { clipPath: 'circle(140% at 50% 50%)' },
            {
              clipPath: 'circle(0% at 50% 44%)',
              duration: 1.05,
              ease: 'expo.inOut',
              delay: 0.18,
            }
          )
          .set(introCurtainRef.current, { display: 'none' });
      }

      introTl.fromTo(
        '.hero-kicker-item',
        { y: 20, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.55, stagger: 0.07, ease: 'power3.out' },
        0.42
      );

      introTl.fromTo(
        '.hero-line-inner',
        { yPercent: 112, rotateZ: 1.5 },
        {
          yPercent: 0,
          rotateZ: 0,
          duration: 0.82,
          stagger: 0.09,
          ease: 'expo.out',
        },
        0.5
      );

      introTl.fromTo(
        '.hero-deck-reveal',
        { y: 22, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.65, stagger: 0.08, ease: 'power3.out' },
        0.78
      );

      // B. Hero AMV Frame Cinematic Widescreen Morph on Scroll
      if (heroStageRef.current && heroVideoFrameRef.current) {
        gsap.to(heroVideoFrameRef.current, {
          scale: 0.94,
          borderRadius: '28px',
          yPercent: 8,
          ease: 'none',
          scrollTrigger: {
            trigger: heroStageRef.current,
            start: 'top top',
            end: 'bottom top',
            scrub: true,
          },
        });
      }

      // C. Desktop Pinned Scroll-Driven Storytelling + SVG Signal Wave Morph
      const mm = gsap.matchMedia();
      mm.add('(min-width: 1024px)', () => {
        if (!storyPinSectionRef.current) return;
        ScrollTrigger.create({
          trigger: storyPinSectionRef.current,
          start: 'top top+=84',
          end: '+=155%',
          pin: true,
          scrub: 0.5,
          onUpdate: (self) => {
            const p = self.progress;
            const idx = p < 0.34 ? 0 : p < 0.68 ? 1 : 2;
            setActiveChapterIdx(idx);
            if (morphWavePathRef.current) {
              morphWavePathRef.current.setAttribute('d', CHAPTERS[idx].svgPath);
            }
          },
        });
      });

      // D. Staggered Bento Cards Entrance
      gsap.utils.toArray<HTMLElement>('.celestial-reveal-section').forEach((sec) => {
        gsap.fromTo(
          sec.querySelectorAll('.celestial-reveal-card'),
          { y: 28, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.6,
            stagger: 0.06,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: sec,
              start: 'top 82%',
              once: true,
            },
          }
        );
      });
    }, rootRef);

    return () => ctx.revert();
  }, [reducedMotion]);

  // 4. Velocity-Driven Kinetic Typography Ribbon Loop
  useEffect(() => {
    if (reducedMotion) return;
    let rafId = 0;
    let offsetA = 0;
    let offsetB = -25;

    const animateRibbon = () => {
      const vel = velocityRef.current || 0;
      const delta = 0.032 + Math.min(0.35, Math.abs(vel) * 0.014);
      offsetA = (offsetA - delta) % 50;
      offsetB = (offsetB + delta * 0.85) % 50;
      if (offsetB > 0) offsetB -= 50;

      const skew = Math.max(-5, Math.min(5, vel * -0.18));
      if (ribbonTrackARef.current) {
        ribbonTrackARef.current.style.transform = `translate3d(${offsetA.toFixed(3)}%, 0, 0) skewX(${skew.toFixed(2)}deg)`;
      }
      if (ribbonTrackBRef.current) {
        ribbonTrackBRef.current.style.transform = `translate3d(${offsetB.toFixed(3)}%, 0, 0) skewX(${(-skew).toFixed(2)}deg)`;
      }
      rafId = requestAnimationFrame(animateRibbon);
    };

    rafId = requestAnimationFrame(animateRibbon);
    return () => cancelAnimationFrame(rafId);
  }, [reducedMotion, velocityRef]);

  // 5. Execute Real HTTP Request in Quick Playground
  const runLiveDemo = useCallback(async () => {
    if (!activeDemoEndpoint) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setApiState('loading');
    setBurstSignal((n) => n + 1);
    const { path, method } = makeRequest(activeDemoEndpoint, paramValues);
    setOperatorNote(`Dispatching ${method} ${path} ...`);

    const timeoutMs = activeDemoEndpoint.deadline || 15000;
    const timer = setTimeout(() => controller.abort('timeout'), timeoutMs);
    const started = performance.now();

    try {
      const res = await fetch(path, {
        method,
        signal: controller.signal,
        credentials: 'omit',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      clearTimeout(timer);

      const rawText = await readBounded(res, 1_048_576);
      const byteLen = new TextEncoder().encode(rawText).byteLength;
      const wasTruncated = rawText.includes('truncated at');
      const elapsed = Math.max(1, Math.round(performance.now() - started));
      const formatted = formatResponse(rawText, '');
      const hdrs: Array<[string, string]> = [];
      res.headers.forEach((val, key) => {
        hdrs.push([key, redact(val, '')]);
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
        setOperatorNote(`HTTP ${res.status} received in ${elapsed} ms (${(byteLen / 1024).toFixed(1)} KB).`);
      } else {
        setApiState('error');
        setOperatorNote(`Upstream responded with HTTP ${res.status} in ${elapsed} ms.`);
      }
    } catch (err: any) {
      clearTimeout(timer);
      if (controller.signal.aborted) {
        setApiState('cancelled');
        setOperatorNote('Request aborted cleanly by operator signal.');
      } else {
        setApiState('error');
        setOperatorNote(`Network fault: ${err?.message || 'Unable to reach relay'}`);
      }
    }
  }, [activeDemoEndpoint, paramValues]);

  const cancelLiveDemo = useCallback(() => {
    abortRef.current?.abort('user_cancelled');
    setApiState('cancelled');
    setOperatorNote('AbortController signal dispatched. Stream closed.');
  }, []);

  const currentSnippet = useMemo(() => {
    if (!activeDemoEndpoint) return '';
    return makeSnippet(activeDemoEndpoint, paramValues, snippetLang);
  }, [activeDemoEndpoint, paramValues, snippetLang]);

  const copySnippet = async () => {
    try {
      await navigator.clipboard.writeText(currentSnippet);
      setSnippetCopied(true);
      setTimeout(() => setSnippetCopied(false), 1600);
    } catch {}
  };

  const categories = useMemo(() => {
    const set = new Set<string>();
    endpoints.forEach((e) => set.add(e.category));
    return ['all', ...Array.from(set)];
  }, [endpoints]);

  const visibleCatalogSlice = useMemo(() => {
    const list =
      activeCategory === 'all'
        ? endpoints
        : endpoints.filter((e) => e.category === activeCategory);
    return list.slice(0, 9);
  }, [activeCategory, endpoints]);

  const isDark = theme === 'dark';

  return (
    <div ref={rootRef} className="celestial-atmosphere relative min-h-screen overflow-x-clip">
      {/* Procedural Anime Starlight & Speed-Line Canvas */}
      <AnimeCanvasFX apiState={apiState} burstSignal={burstSignal} />

      {/* Non-Blocking Cinematic Anime Opening Aperture Curtain */}
      {!introDone && !reducedMotion && (
        <div
          ref={introCurtainRef}
          aria-hidden="true"
          className="pointer-events-none fixed inset-0 z-[80] flex flex-col items-center justify-center bg-[#101827]"
        >
          <div className="flex items-center gap-3">
            <span className="kg-metallic-emblem h-12 w-12">
              <img src="/icon.png" alt="" width={48} height={48} />
            </span>
            <div className="font-mono text-xs tracking-[0.26em] text-[#83B9FF]">
              OP.01 // CELESTIAL BLUE RELAY
            </div>
          </div>
        </div>
      )}

      {/* Floating Celestial Navbar with AMV Audio Equalizer */}
      <CelestialNavbar
        activeRoute="landing"
        onOpenCommand={() => setCommandOpen(true)}
        amvAudioAvailable={true}
        amvMuted={amvMuted}
        onToggleAmvAudio={toggleAmvAudio}
        endpointCount={endpoints.length || 42}
      />

      <CommandModal
        open={commandOpen}
        onClose={() => setCommandOpen(false)}
        endpoints={endpoints}
        amvMuted={amvMuted}
        onToggleAmvAudio={toggleAmvAudio}
      />

      <main className="relative z-10">
        {/* =====================================================================
            HERO STAGE: CINEMATIC ANIME AMV + KINETIC TYPOGRAPHY + AUDIO DECK
           ===================================================================== */}
        <section
          ref={heroStageRef}
          className="relative flex min-h-[96vh] items-center pt-24 pb-14 sm:pt-28"
        >
          {/* Full-Bleed Sculpted AMV Video Stage */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden px-2 pt-2 sm:px-4 sm:pt-3">
            <div
              ref={heroVideoFrameRef}
              className="relative h-full w-full overflow-hidden rounded-2xl border border-celestial-border/45 shadow-2xl"
            >
              {!reducedMotion ? (
                <video
                  ref={videoRef}
                  autoPlay
                  loop
                  muted
                  playsInline
                  preload="metadata"
                  poster="/assets/media/intro-poster.webp"
                  className={`h-full w-full object-cover transition-all duration-700 ${
                    isDark
                      ? 'brightness-[0.76] contrast-[1.08] saturate-[1.12]'
                      : 'brightness-[1.04] contrast-[0.98] saturate-[1.08]'
                  }`}
                >
                  <source src="/assets/media/intro.webm" type="video/webm" />
                  <source src="/assets/media/intro.mp4" type="video/mp4" />
                </video>
              ) : (
                <img
                  src="/assets/media/intro-poster.webp"
                  alt=""
                  className="h-full w-full object-cover"
                />
              )}

              {/* Distinct Anime Night vs Anime Summer Daylight Atmospheric Grading */}
              <div className="amv-hero-scrim absolute inset-0 transition-all duration-500" />

              {/* Subtle Anime Daylight Cumulus Horizon Cloud SVG (Visible in Light Mode) */}
              {!isDark && (
                <svg
                  viewBox="0 0 1440 220"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                  className="absolute inset-x-0 bottom-0 h-36 w-full opacity-75"
                >
                  <path
                    d="M0,168 C160,118 280,192 460,148 C640,104 790,178 980,136 C1160,96 1310,152 1440,122 L1440,220 L0,220 Z"
                    fill="#EAF4FF"
                  />
                </svg>
              )}
            </div>
          </div>

          {/* Foreground Hero Content */}
          <div className="relative z-10 mx-auto w-full max-w-7xl px-5 sm:px-8">
            <div className="max-w-3xl space-y-6">
              {/* Episode & Live Telemetry Kicker */}
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="hero-kicker-item inline-flex items-center gap-2 rounded-full border border-celestial-sky/45 bg-celestial-canvas/75 px-3 py-1 font-mono text-[11px] font-medium tracking-wider text-celestial-sky backdrop-blur-md">
                  <Radio className="h-3.5 w-3.5 animate-pulse" strokeWidth={1.5} />
                  <span>OP.01 // CELESTIAL BLUE</span>
                </span>

                <span className="hero-kicker-item inline-flex items-center gap-2 rounded-full border border-celestial-border/50 bg-celestial-canvas/75 px-3 py-1 font-mono text-[11px] text-celestial-secondary backdrop-blur-md">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  <span>
                    {healthStatus === 'online'
                      ? `RELAY ONLINE · ${healthLatency}ms`
                      : 'PROBING EDGE RELAY'}
                  </span>
                </span>
              </div>

              {/* Expressive Kinetic Headline with Line-Mask Clipping */}
              <h1 className="font-display text-4xl font-semibold leading-[1.04] tracking-tight text-celestial-primary sm:text-6xl lg:text-[4.35rem]">
                <span className="line-mask">
                  <span className="hero-line-inner">High-Velocity </span>
                </span>
                <span className="line-mask">
                  <span className="hero-line-inner celestial-text-gradient">
                    Anime &amp; Utility APIs{' '}
                  </span>
                </span>
                <span className="line-mask">
                  <span className="hero-line-inner">Under Starlight.</span>
                </span>
              </h1>

              <p className="hero-deck-reveal max-w-2xl text-base leading-relaxed text-celestial-secondary sm:text-lg">
                One cohesive HTTP gateway for anime discovery, social intelligence, media extraction,
                and developer utilities — engineered with deterministic JSON contracts, bounded
                streams, and zero browser token persistence.
              </p>

              {/* Primary Tactile Actions + Interactive AMV Sound Director Bar */}
              <div className="hero-deck-reveal flex flex-wrap items-center gap-3 pt-1">
                <motion.a
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  href="/explorer.html"
                  className="btn-celestial-primary inline-flex min-h-[46px] items-center gap-2.5 rounded-xl px-5 py-2.5 text-sm font-semibold"
                >
                  <span>Open API Workbench</span>
                  <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
                </motion.a>

                <motion.button
                  whileHover={{ y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  type="button"
                  onClick={() => scrollTo('#live-playground')}
                  className="inline-flex min-h-[46px] items-center gap-2 rounded-xl border border-celestial-border/65 bg-celestial-surface/85 px-4 py-2.5 text-sm font-medium text-celestial-primary backdrop-blur-md transition-colors hover:border-celestial-sky/60"
                >
                  <Terminal className="h-4 w-4 text-celestial-sky" strokeWidth={1.5} />
                  <span>Try Live Request Here</span>
                </motion.button>

                {/* AMV Soundtrack Unmute / Play Deck */}
                {!reducedMotion && (
                  <div className="inline-flex min-h-[46px] items-center gap-1 rounded-xl border border-celestial-lilac/45 bg-celestial-surface/85 p-1 backdrop-blur-md">
                    <button
                      type="button"
                      onClick={toggleAmvAudio}
                      className={`inline-flex h-9 items-center gap-2 rounded-lg px-3 font-mono text-xs font-medium transition-colors ${
                        !amvMuted
                          ? 'bg-celestial-lilac/25 text-celestial-primary'
                          : 'text-celestial-secondary hover:text-celestial-primary'
                      }`}
                    >
                      {amvMuted ? (
                        <VolumeX className="h-4 w-4 text-celestial-lilac" strokeWidth={1.5} />
                      ) : (
                        <Volume2 className="h-4 w-4 text-celestial-lilac" strokeWidth={1.5} />
                      )}
                      <span>{amvMuted ? 'Play AMV Audio' : 'Soundtrack On'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={toggleAmvPlay}
                      aria-label={amvPaused ? 'Resume background AMV video' : 'Pause background AMV video'}
                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-celestial-secondary transition-colors hover:bg-celestial-elevated/60 hover:text-celestial-primary"
                    >
                      {amvPaused ? (
                        <Play className="h-3.5 w-3.5" strokeWidth={1.5} />
                      ) : (
                        <Pause className="h-3.5 w-3.5" strokeWidth={1.5} />
                      )}
                    </button>
                  </div>
                )}
              </div>

              {/* Compact Engineering Proof Strip */}
              <div className="hero-deck-reveal grid max-w-2xl grid-cols-3 gap-3 pt-4">
                <div className="rounded-xl border border-celestial-border/55 bg-celestial-surface/85 px-3.5 py-3 backdrop-blur-md">
                  <div className="font-mono text-lg font-semibold text-celestial-primary sm:text-xl">
                    {endpoints.length || 42}
                  </div>
                  <div className="font-mono text-[11px] text-celestial-muted">
                    ACTIVE ENDPOINTS
                  </div>
                </div>
                <div className="rounded-xl border border-celestial-border/55 bg-celestial-surface/85 px-3.5 py-3 backdrop-blur-md">
                  <div className="font-mono text-lg font-semibold text-celestial-sky sm:text-xl">
                    1.0 MB
                  </div>
                  <div className="font-mono text-[11px] text-celestial-muted">
                    BOUNDED STREAM CAP
                  </div>
                </div>
                <div className="rounded-xl border border-celestial-border/55 bg-celestial-surface/85 px-3.5 py-3 backdrop-blur-md">
                  <div className="font-mono text-lg font-semibold text-celestial-lilac sm:text-xl">
                    5 SDKs
                  </div>
                  <div className="font-mono text-[11px] text-celestial-muted">
                    LIVE CODEGEN
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* =====================================================================
            SCROLL-VELOCITY KINETIC TYPOGRAPHY RIBBON
           ===================================================================== */}
        <section
          aria-label="Capabilities kinetic marquee"
          className="relative overflow-hidden border-y border-celestial-border/35 bg-celestial-surface/45 py-4"
        >
          <div
            ref={ribbonTrackARef}
            className="flex w-max items-center gap-8 whitespace-nowrap font-display text-sm font-semibold uppercase tracking-[0.2em] text-celestial-secondary will-change-transform"
          >
            {Array.from({ length: 4 }).map((_, i) => (
              <React.Fragment key={i}>
                <span>ANIME &amp; MANGA DISCOVERY</span>
                <span className="text-celestial-sky">✦</span>
                <span>ZERO-STORAGE BEARER SECURITY</span>
                <span className="text-celestial-lilac">✦</span>
                <span>OPENAPI 3.1 SCHEMA PARITY</span>
                <span className="text-celestial-sky">✦</span>
                <span>MEDIA &amp; SOCIAL INTELLIGENCE</span>
                <span className="text-celestial-lilac">✦</span>
              </React.Fragment>
            ))}
          </div>
          <div
            ref={ribbonTrackBRef}
            className="mt-2 flex w-max items-center gap-8 whitespace-nowrap font-mono text-xs tracking-[0.18em] text-celestial-muted will-change-transform"
          >
            {Array.from({ length: 4 }).map((_, i) => (
              <React.Fragment key={i}>
                <span>GET /api/v1/search/anime</span>
                <span>·</span>
                <span>GET /api/v1/stalk/github</span>
                <span>·</span>
                <span>GET /api/v1/util/iplookup</span>
                <span>·</span>
                <span>GET /api/v1/health</span>
                <span>·</span>
                <span>POST /api/v1/auth/email/start</span>
                <span>·</span>
              </React.Fragment>
            ))}
          </div>
        </section>

        {/* =====================================================================
            ACT I: PINNED 3D CELESTIAL OBSERVATORY & ARCHITECTURE CHOREOGRAPHY
           ===================================================================== */}
        <section
          ref={storyPinSectionRef}
          className="mx-auto max-w-7xl px-5 py-16 sm:px-8 lg:py-20"
        >
          <div className="grid items-center gap-8 lg:grid-cols-12">
            {/* Left: Interactive Three.js / R3F Celestial Core + SVG Morphing Telemetry */}
            <div className="lg:col-span-6">
              <div className="celestial-card relative overflow-hidden p-5 sm:p-6">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-[11px] uppercase tracking-wider text-celestial-sky">
                    ACT I // INTERACTIVE 3D ASTROLABE
                  </span>
                  <span className="font-mono text-[11px] text-celestial-muted">
                    R3F · WEBGL · POINTER REACTIVE
                  </span>
                </div>

                <CelestialThreeStage apiState={apiState} className="my-2 h-[310px] w-full sm:h-[360px]" />

                {/* SVG Animated Signal Wave Morphing with Scroll Chapter */}
                <div className="rounded-xl border border-celestial-border/40 bg-celestial-canvas/65 p-3.5">
                  <div className="flex items-center justify-between font-mono text-[11px]">
                    <span className="text-celestial-secondary">
                      {CHAPTERS[activeChapterIdx].code}
                    </span>
                    <span className="text-celestial-lilac">
                      {CHAPTERS[activeChapterIdx].metric}
                    </span>
                  </div>
                  <svg
                    viewBox="0 0 360 110"
                    className="mt-1 h-14 w-full"
                    aria-hidden="true"
                  >
                    <defs>
                      <linearGradient id="celestialWaveGrad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#83B9FF" />
                        <stop offset="50%" stopColor="#B9A7FF" />
                        <stop offset="100%" stopColor="#EAF4FF" />
                      </linearGradient>
                    </defs>
                    <path
                      ref={morphWavePathRef}
                      d={CHAPTERS[activeChapterIdx].svgPath}
                      fill="none"
                      stroke="url(#celestialWaveGrad)"
                      strokeWidth="2.6"
                      strokeLinecap="round"
                      className="transition-all duration-500"
                    />
                  </svg>
                </div>
              </div>
            </div>

            {/* Right: Scroll-Driven Architecture Chapters */}
            <div className="space-y-5 lg:col-span-6">
              <div className="space-y-2">
                <span className="font-mono text-xs uppercase tracking-widest text-celestial-lilac">
                  SCROLL-DRIVEN SYSTEM STORY
                </span>
                <h2 className="font-display text-3xl font-semibold tracking-tight text-celestial-primary sm:text-4xl">
                  Built Like an Observatory, Tuned for Production Code.
                </h2>
              </div>

              <div className="space-y-3.5">
                {CHAPTERS.map((chap, idx) => {
                  const active = idx === activeChapterIdx;
                  return (
                    <button
                      key={chap.code}
                      type="button"
                      onClick={() => setActiveChapterIdx(idx)}
                      className={`celestial-card w-full p-5 text-left transition-all duration-200 ${
                        active
                          ? 'border-celestial-sky/70 ring-1 ring-celestial-sky/30'
                          : 'opacity-75 hover:opacity-100'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 font-mono text-[11px]">
                        <span className="text-celestial-sky">{chap.code}</span>
                        <span className="rounded border border-celestial-border/45 px-2 py-0.5 text-celestial-muted">
                          {chap.metric}
                        </span>
                      </div>
                      <h3 className="mt-2 font-display text-lg font-semibold text-celestial-primary">
                        {chap.title}
                      </h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-celestial-secondary">
                        {chap.summary}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* =====================================================================
            ACT II: LIVE QUICK PLAYGROUND + LIVING ANIME COMPANION "SORA"
           ===================================================================== */}
        <section
          id="live-playground"
          className="celestial-reveal-section mx-auto max-w-7xl px-5 py-16 sm:px-8"
        >
          <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div className="space-y-2">
              <span className="font-mono text-xs uppercase tracking-widest text-celestial-sky">
                ACT II // INTERACTIVE STAGE &amp; RIVE OPERATOR
              </span>
              <h2 className="font-display text-3xl font-semibold tracking-tight text-celestial-primary sm:text-4xl">
                Execute Live Endpoints Alongside Sora.
              </h2>
              <p className="max-w-2xl text-sm text-celestial-secondary sm:text-base">
                Move your cursor to test eye tracking and spring-rigged hair physics, then fire a
                real HTTP request below — Sora reacts live to loading, 200 OK, upstream errors, and
                request cancellation.
              </p>
            </div>
            <a
              href={
                activeDemoEndpoint
                  ? `/explorer.html?endpoint=${encodeURIComponent(activeDemoEndpoint.id)}`
                  : '/explorer.html'
              }
              className="inline-flex items-center gap-2 font-mono text-xs font-medium text-celestial-sky hover:underline"
            >
              <span>Open Full {endpoints.length || 42}-Route Workbench</span>
              <ArrowUpRight className="h-4 w-4" strokeWidth={1.5} />
            </a>
          </div>

          <div className="grid items-start gap-6 lg:grid-cols-12">
            {/* Left 5 Cols: Living Anime Character Companion */}
            <div className="celestial-reveal-card lg:sticky lg:top-24 lg:col-span-5">
              <AnimeOperator
                apiState={apiState}
                statusText={operatorNote}
                interactiveControls={true}
                onSelectState={(st) => {
                  setApiState(st);
                  setOperatorNote(`Manual expression preview switched to [${st.toUpperCase()}].`);
                }}
              />
            </div>

            {/* Right 7 Cols: Real Request Builder + JSON Tree + Multi-Lang Snippets */}
            <div className="celestial-reveal-card space-y-4 lg:col-span-7">
              <div className="celestial-card space-y-4 p-5">
                {/* Preset Route Pills */}
                <div className="flex flex-wrap items-center gap-2">
                  {demoEndpoints.map((ep) => {
                    const selected = activeDemoEndpoint?.id === ep.id;
                    return (
                      <button
                        key={ep.id}
                        type="button"
                        onClick={() => setSelectedDemoId(ep.id)}
                        className={`rounded-lg border px-3 py-1.5 font-mono text-xs transition-colors ${
                          selected
                            ? 'border-celestial-sky bg-celestial-sky/20 text-celestial-primary'
                            : 'border-celestial-border/45 bg-celestial-canvas/50 text-celestial-secondary hover:border-celestial-sky/45 hover:text-celestial-primary'
                        }`}
                      >
                        {ep.id}
                      </button>
                    );
                  })}
                </div>

                {activeDemoEndpoint && (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-celestial-border/45 bg-celestial-canvas/65 px-3.5 py-2.5 font-mono text-xs">
                      <div className="flex items-center gap-2.5 overflow-hidden">
                        <span className="rounded bg-celestial-sky/20 px-2 py-0.5 font-semibold text-celestial-sky">
                          {activeDemoEndpoint.method}
                        </span>
                        <span className="truncate text-celestial-primary">
                          {makeRequest(activeDemoEndpoint, paramValues).path}
                        </span>
                      </div>
                      <span className="text-[11px] text-celestial-muted">
                        {activeDemoEndpoint.public ? 'PUBLIC · 0 KEY NEEDED' : 'BEARER AUTH'}
                      </span>
                    </div>

                    {/* Dynamic Parameter Inputs */}
                    {(activeDemoEndpoint.parameters || []).length > 0 && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {activeDemoEndpoint.parameters.map((param) => {
                          const isSingle = (activeDemoEndpoint.parameters?.length || 0) === 1;
                          return (
                          <label
                            key={param.name}
                            className={`block space-y-1 ${isSingle ? 'sm:col-span-2' : ''}`}
                          >
                            <span className="flex items-center justify-between font-mono text-[11px] text-celestial-secondary">
                              <span>
                                {param.name}
                                {param.required && <span className="ml-1 text-celestial-sky">*</span>}
                              </span>
                              <span className="text-celestial-muted">{param.in}</span>
                            </span>
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
                              className="w-full rounded-lg border border-celestial-border/50 bg-celestial-canvas/70 px-3 py-2 font-mono text-base text-celestial-primary placeholder:text-celestial-muted focus:border-celestial-sky focus:outline-none sm:text-xs"
                            />
                          </label>
                          );
                        })}
                      </div>
                    )}

                    {/* Dispatch & Cancel Controls */}
                    <div className="flex flex-wrap items-center gap-2.5">
                      <motion.button
                        whileTap={{ scale: 0.98 }}
                        type="button"
                        onClick={runLiveDemo}
                        disabled={apiState === 'loading'}
                        className="btn-celestial-primary inline-flex min-h-[42px] items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold disabled:opacity-60"
                      >
                        <Zap className="h-3.5 w-3.5" strokeWidth={1.75} />
                        <span>
                          {apiState === 'loading' ? 'Executing Live Stream...' : 'Send Live Request'}
                        </span>
                      </motion.button>

                      {apiState === 'loading' && (
                        <button
                          type="button"
                          onClick={cancelLiveDemo}
                          className="inline-flex min-h-[42px] items-center gap-1.5 rounded-xl border border-rose-400/50 bg-rose-400/15 px-3.5 py-2 font-mono text-xs text-rose-300 transition-colors hover:bg-rose-400/25"
                        >
                          <Square className="h-3.5 w-3.5" strokeWidth={1.5} />
                          <span>Cancel Request</span>
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>

              {/* Live JSON Response Viewer */}
              <JsonViewer
                formattedText={respText}
                parsedValue={respValue}
                headers={respHeaders}
                status={respStatus}
                durationMs={respDuration}
                byteLength={respBytes}
                truncated={respTruncated}
                maxHeightClass="max-h-[290px]"
              />

              {/* Instant Copyable SDK Code Snippet */}
              <div className="celestial-card overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-celestial-border/40 bg-celestial-canvas/55 px-3.5 py-2">
                  <div className="flex flex-wrap items-center gap-1">
                    {SNIPPET_LANGUAGES.map((lang) => (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => setSnippetLang(lang)}
                        className={`rounded-md px-2.5 py-1 font-mono text-[11px] transition-colors ${
                          snippetLang === lang
                            ? 'bg-celestial-lilac/20 text-celestial-primary'
                            : 'text-celestial-muted hover:text-celestial-primary'
                        }`}
                      >
                        {lang}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={copySnippet}
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
                        <span>Copy Snippet</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="max-h-44 overflow-auto p-3.5 font-mono text-xs leading-relaxed text-celestial-secondary">
                  {currentSnippet}
                </pre>
              </div>
            </div>
          </div>
        </section>

        {/* =====================================================================
            ACT III: ROUTE CONSTELLATION DIRECTORY & TRANSPARENT ACCESS TIERS
           ===================================================================== */}
        <section className="celestial-reveal-section mx-auto max-w-7xl px-5 py-16 sm:px-8">
          <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <span className="font-mono text-xs uppercase tracking-widest text-celestial-lilac">
                ACT III // ROUTE CONSTELLATION
              </span>
              <h2 className="mt-1 font-display text-3xl font-semibold tracking-tight text-celestial-primary sm:text-4xl">
                Explore the Endpoint Matrix.
              </h2>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setActiveCategory(cat)}
                  className={`rounded-lg border px-3 py-1.5 font-mono text-xs uppercase transition-colors ${
                    activeCategory === cat
                      ? 'border-celestial-sky bg-celestial-sky/20 text-celestial-primary'
                      : 'border-celestial-border/45 bg-celestial-surface/50 text-celestial-muted hover:text-celestial-primary'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visibleCatalogSlice.map((ep) => (
              <a
                key={ep.id}
                href={`/explorer.html?endpoint=${encodeURIComponent(ep.id)}`}
                className="celestial-reveal-card celestial-card group flex flex-col justify-between p-5"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 font-mono text-[11px]">
                    <span className="rounded bg-celestial-sky/15 px-2 py-0.5 font-semibold text-celestial-sky">
                      {ep.method}
                    </span>
                    <span
                      className={
                        ep.public
                          ? 'font-medium text-emerald-600 dark:text-emerald-400'
                          : 'font-medium text-celestial-lilac'
                      }
                    >
                      {ep.public ? 'PUBLIC' : `${ep.credits} CR · KEY`}
                    </span>
                  </div>
                  <h3 className="mt-3 font-display text-base font-semibold text-celestial-primary group-hover:text-celestial-sky">
                    {ep.title}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-celestial-secondary">
                    {ep.description}
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-celestial-border/35 pt-3 font-mono text-[11px] text-celestial-muted">
                  <span className="truncate">{ep.executionPath}</span>
                  <ArrowUpRight
                    className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-celestial-sky"
                    strokeWidth={1.5}
                  />
                </div>
              </a>
            ))}
          </div>

          {/* Transparent Auth & Quota Architecture Strip */}
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            <div className="celestial-card p-5">
              <Compass className="h-5 w-5 text-celestial-sky" strokeWidth={1.5} />
              <h3 className="mt-3 font-display text-base font-semibold text-celestial-primary">
                Instant Public Discovery
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-celestial-secondary">
                Run anime search, system diagnostics, and public OSINT lookups right in the browser
                without creating an account.
              </p>
            </div>
            <div className="celestial-card p-5">
              <KeyRound className="h-5 w-5 text-celestial-lilac" strokeWidth={1.5} />
              <h3 className="mt-3 font-display text-base font-semibold text-celestial-primary">
                Passwordless 8-Digit Gate
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-celestial-secondary">
                Sign in via CSRF-protected one-time email verification codes with step-up
                re-authentication and multi-device session revocation.
              </p>
            </div>
            <div className="celestial-card p-5">
              <Shield className="h-5 w-5 text-emerald-400" strokeWidth={1.5} />
              <h3 className="mt-3 font-display text-base font-semibold text-celestial-primary">
                Metered Bearer Quota
              </h3>
              <p className="mt-1.5 text-xs leading-relaxed text-celestial-secondary">
                Inspect live credit balances via <code className="font-mono text-celestial-sky">GET /api/v1/account</code>{' '}
                with deterministic per-route credit weights and rate headers.
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* Celestial Footer */}
      <footer className="relative z-10 border-t border-celestial-border/40 bg-celestial-surface/55 py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-5 sm:flex-row sm:items-center sm:px-8">
          <div className="flex items-center gap-3">
            <span className="kg-metallic-emblem h-9 w-9">
              <img src="/icon.png" alt="KanjutGede emblem" width={36} height={36} />
            </span>
            <div>
              <div className="font-display text-sm font-semibold text-celestial-primary">
                KanjutGede REST API
              </div>
              <div className="font-mono text-[11px] text-celestial-muted">
                Celestial Blue Edition · Night Sky &amp; Summer Stratosphere
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-5 font-mono text-xs text-celestial-secondary">
            <a href="/explorer.html" className="hover:text-celestial-sky">
              API Workbench
            </a>
            <a href="/signin.html" className="hover:text-celestial-sky">
              Developer Sign In
            </a>
            <a href="/docs" className="hover:text-celestial-sky">
              OpenAPI Spec
            </a>
            <a href="/api/v1/health" className="hover:text-celestial-sky">
              Health JSON
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
};

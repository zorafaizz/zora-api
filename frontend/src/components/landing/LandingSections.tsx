import { LandingAction } from './LandingAction';
import { ArrowRight, ArrowUpRight, Braces, FileJson2, Gauge, ShieldCheck } from 'lucide-react';

const VALUE_BLOCKS = [
  {
    icon: ShieldCheck,
    index: '01',
    title: 'Safe by default',
    copy: 'Volatile credentials, bounded response streams, and automatic redaction keep experimentation controlled.',
  },
  {
    icon: Braces,
    index: '02',
    title: 'One predictable shape',
    copy: 'Consistent JSON envelopes and real OpenAPI contracts make every route familiar after the first request.',
  },
  {
    icon: Gauge,
    index: '03',
    title: 'Built for iteration',
    copy: 'Tune parameters, execute explicitly, inspect the response, then copy production-ready snippets.',
  },
];

export function CapabilityRail() {
  return (
    <div tabIndex={0} role="region" className="capability-rail" aria-label="API capabilities">
      {['Search', 'Extract', 'Discover', 'Automate', 'Inspect'].map((word) => (
        <span key={word}>{word}</span>
      ))}
    </div>
  );
}

export function SystemSection({ endpointCount }: { endpointCount: number }) {
  return (
    <section data-reveal className="system-section border-y border-celestial-border/60">
      <div className="mx-auto max-w-[1480px] px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
        <div className="system-intro system-composition">
          <div className="system-copy">
            <p className="section-kicker">Built for the work behind the screen</p>
            <h2 className="section-title">A clearer path<br /><span>from idea to API.</span></h2>
            <p className="system-description">Explore actual routes, shape a request, and see what comes back. The details stay close at hand while you build.</p>
            <a href="/explorer" className="system-link">Explore the workbench <ArrowUpRight aria-hidden="true" /></a>
          </div>
          <div className="system-art" aria-hidden="true">
            <img src="/assets/media/anime-operator-blue.png" alt="" loading="lazy" />
            <div className="system-art-caption"><strong>{endpointCount || '—'}</strong><span>routes in the<br />API catalog</span></div>
          </div>
        </div>

        <div className="system-list system-features">
          {VALUE_BLOCKS.map(({ icon: Icon, index, title, copy }) => (
            <article key={index} className="value-row group">
              <span className="value-index">{index}</span>
              <Icon aria-hidden="true" className="h-5 w-5 text-celestial-sky" strokeWidth={1.5} />
              <div><h3>{title}</h3><p>{copy}</p></div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function DocsSection() {
  return (
    <section data-reveal className="mx-auto max-w-[1480px] px-5 py-20 sm:px-8 lg:px-12 lg:py-28">
      <div className="docs-stage grid overflow-hidden lg:grid-cols-[0.95fr_1.05fr]">
        <div className="p-7 sm:p-10 lg:p-14">
          <p className="section-kicker">Documentation that reads clearly</p>
          <h2 className="section-title">From contract to request, without the hunt.</h2>
          <p className="mt-6 max-w-lg text-sm leading-7 text-celestial-secondary">Searchable contracts, focused examples, clear auth rules, and code you can copy without fighting the interface.</p>
          <a href="/docs" className="text-link mt-9 inline-flex items-center gap-2 text-sm font-semibold">Explore OpenAPI Docs <ArrowRight aria-hidden="true" className="h-4 w-4" /></a>
        </div>
        <div className="docs-visual">
          <div className="docs-mini-sidebar"><span>Getting started</span><b>Introduction</b><b>Authentication</b><span>Endpoints</span><b>Search</b><b>Downloaders</b><b>Utilities</b></div>
          <div className="docs-mini-content">
            <div className="flex items-center gap-2"><span className="method-pill">GET</span><code>/api/v1/search/anime</code></div>
            <h3>Search anime</h3>
            <p>Discover titles and metadata through the unified response envelope.</p>
            <div tabIndex={0} role="region" aria-label="Example request" className="docs-code"><span>curl</span> https://api.itsfaiz.my.id/api/v1/search/anime?q=frieren</div>
            <div className="docs-response"><FileJson2 aria-hidden="true" className="h-4 w-4" /><span>200 · application/json</span></div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function LandingCta() {
  return (
    <section data-reveal className="landing-closing" aria-labelledby="closing-title">
      <div className="landing-closing-art" aria-hidden="true" />
      <div className="landing-closing-content mx-auto max-w-[1480px] px-5 sm:px-8 lg:px-12">
        <p className="section-kicker">Ready when you are</p>
        <h2 id="closing-title">Make your<br /><span>first request.</span></h2>
        <div className="landing-closing-bottom">
          <p>Choose a route. Shape the request.<br />See what comes back.</p>
          <LandingAction href="/explorer">Launch Workbench</LandingAction>
        </div>
      </div>
    </section>
  );
}

export function LandingFooter() {
  return (
    <footer className="border-t border-celestial-border/60 px-5 py-8 sm:px-8 lg:px-12">
      <div className="mx-auto flex max-w-[1480px] flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3"><img src="/icon.png" alt="" width="32" height="32" className="h-8 w-8 rounded-lg grayscale" /><div><strong className="block text-sm text-celestial-primary">KanjutGede API</strong><span className="text-xs text-celestial-muted">REST infrastructure for people who ship.</span></div></div>
        <nav aria-label="Footer navigation" className="flex gap-5 text-xs font-medium text-celestial-secondary"><a href="/docs">Docs</a><a href="/explorer">Workbench</a><a href="/signin">Sign In</a></nav>
      </div>
    </footer>
  );
}

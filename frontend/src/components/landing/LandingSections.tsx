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
    <div className="capability-rail" aria-label="API capabilities">
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
        <div className="system-intro grid gap-8 border-b border-celestial-border/70 pb-10 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-8">
            <p className="section-kicker">The interface gets out of the way</p>
            <h2 className="section-title">Less decoration.<br />More signal.</h2>
          </div>
          <div className="lg:col-span-4 lg:justify-self-end">
            <strong className="system-count">{endpointCount || '—'}</strong>
            <p className="mt-3 max-w-sm text-sm leading-7 text-celestial-secondary">Real routes generated from the source contract—not invented dashboard metrics.</p>
          </div>
        </div>

        <div className="system-list">
          {VALUE_BLOCKS.map(({ icon: Icon, index, title, copy }) => (
            <article key={index} className="value-row group">
              <span className="value-index">{index}</span>
              <Icon aria-hidden="true" className="h-5 w-5 text-celestial-sky" strokeWidth={1.5} />
              <div><h3>{title}</h3><p>{copy}</p></div>
              <ArrowUpRight aria-hidden="true" className="h-5 w-5 text-celestial-muted transition-transform group-hover:-translate-y-1 group-hover:translate-x-1" />
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
            <div className="docs-code"><span>curl</span> https://api.itsfaiz.my.id/api/v1/search/anime?q=frieren</div>
            <div className="docs-response"><FileJson2 aria-hidden="true" className="h-4 w-4" /><span>200 · application/json</span></div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function LandingCta() {
  return (
    <section data-reveal className="mx-auto max-w-[1480px] px-5 pb-20 sm:px-8 lg:px-12 lg:pb-28">
      <div className="cta-panel">
        <div>
          <p className="section-kicker">Ready when you are</p>
          <h2 className="mt-3 font-display text-4xl font-semibold tracking-[-0.055em] text-celestial-primary sm:text-6xl">Make your first request.</h2>
        </div>
        <a href="/explorer" className="btn-celestial-primary inline-flex min-h-13 shrink-0 items-center justify-center gap-3 px-6 text-sm font-semibold">Launch Workbench <ArrowUpRight aria-hidden="true" className="h-4 w-4" /></a>
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

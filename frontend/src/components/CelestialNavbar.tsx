import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowUpRight, Command, FileCode2, FlaskConical, Home, KeyRound, Menu, Moon, Sun, Volume2, VolumeX, X } from 'lucide-react';
import { useCelestialTheme } from '../lib/theme';

export type ActiveRouteId = 'landing' | 'explorer' | 'signin';

interface CelestialNavbarProps {
  activeRoute: ActiveRouteId;
  onOpenCommand: () => void;
  amvAudioAvailable?: boolean;
  amvMuted?: boolean;
  onToggleAmvAudio?: () => void;
  endpointCount?: number;
}

const NAV_ITEMS = [
  { id: 'landing' as const, label: 'Home', href: '/', icon: Home },
  { id: 'explorer' as const, label: 'Workbench', href: '/explorer', icon: FlaskConical },
  { id: 'signin' as const, label: 'Account', href: '/signin', icon: KeyRound },
];

export const CelestialNavbar: React.FC<CelestialNavbarProps> = ({
  activeRoute,
  onOpenCommand,
  amvAudioAvailable = false,
  amvMuted = true,
  onToggleAmvAudio,
  endpointCount = 0,
}) => {
  const { theme, toggleTheme } = useCelestialTheme();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 18);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        onOpenCommand();
      }
      if (event.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onOpenCommand]);

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-6 sm:pt-4">
      <nav aria-label="Primary navigation" className={`celestial-dock-glass mx-auto flex max-w-[1480px] items-center justify-between gap-3 rounded-2xl px-3 transition-all sm:px-4 ${scrolled ? 'py-2 shadow-xl' : 'py-2.5'}`}>
        <a href="/" className="flex min-w-0 items-center gap-3 rounded-xl">
          <span className="kg-metallic-emblem h-9 w-9 shrink-0"><img src="/icon.png" alt="" width={36} height={36} className="grayscale" /></span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold tracking-[-0.02em] text-celestial-primary">KanjutGede</span>
            <span className="hidden font-mono text-[9px] uppercase tracking-[0.16em] text-celestial-muted sm:block">API infrastructure · {endpointCount || '—'} routes</span>
          </span>
        </a>

        <div className="hidden items-center rounded-xl border border-celestial-border/60 bg-celestial-canvas/50 p-1 md:flex">
          {NAV_ITEMS.map(({ id, label, href }) => (
            <a key={id} href={href} className={`relative rounded-lg px-3.5 py-2 text-xs font-medium transition-colors ${activeRoute === id ? 'text-celestial-primary' : 'text-celestial-muted hover:text-celestial-primary'}`}>
              {activeRoute === id && <motion.span layoutId="active-nav" className="absolute inset-0 rounded-lg bg-celestial-elevated shadow-sm" transition={{ type: 'spring', stiffness: 420, damping: 34 }} />}
              <span className="relative z-10">{label}</span>
            </a>
          ))}
          <a href="/docs" className="flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-xs font-medium text-celestial-muted hover:text-celestial-primary"><FileCode2 className="h-3.5 w-3.5" />Docs<ArrowUpRight className="h-3 w-3" /></a>
        </div>

        <div className="flex items-center gap-1.5">
          {amvAudioAvailable && onToggleAmvAudio && (
            <button type="button" onClick={onToggleAmvAudio} aria-pressed={!amvMuted} aria-label={amvMuted ? 'Unmute hero video' : 'Mute hero video'} className="hidden h-9 items-center gap-2 rounded-xl border border-celestial-border/60 bg-celestial-canvas/50 px-3 text-[11px] font-medium text-celestial-secondary sm:flex">
              {amvMuted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5 text-celestial-sky" />}
              <span>{amvMuted ? 'Sound off' : 'Sound on'}</span>
            </button>
          )}
          <button type="button" onClick={onOpenCommand} aria-label="Open command menu" className="hidden h-9 items-center gap-2 rounded-xl border border-celestial-border/60 bg-celestial-canvas/50 px-3 font-mono text-[10px] text-celestial-secondary sm:flex"><Command className="h-3.5 w-3.5" />⌘K</button>
          <button type="button" onClick={(event) => { const rect = event.currentTarget.getBoundingClientRect(); toggleTheme({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }); }} aria-label={theme === 'dark' ? 'Use light theme' : 'Use dark theme'} className="flex h-9 w-9 items-center justify-center rounded-xl border border-celestial-border/60 bg-celestial-canvas/50 text-celestial-primary">
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          {activeRoute !== 'explorer' && <a href="/explorer" className="btn-celestial-primary hidden h-9 items-center gap-2 rounded-xl px-4 text-xs font-semibold lg:flex">Try API<ArrowUpRight className="h-3.5 w-3.5" /></a>}
          <button type="button" onClick={() => setMobileOpen((value) => !value)} aria-expanded={mobileOpen} aria-label="Toggle navigation" className="flex h-9 w-9 items-center justify-center rounded-xl border border-celestial-border/60 bg-celestial-canvas/50 md:hidden">{mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}</button>
        </div>
      </nav>

      {mobileOpen && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="celestial-dock-glass mx-auto mt-2 max-w-[1480px] rounded-2xl p-2 md:hidden">
          {[...NAV_ITEMS, { id: 'docs' as const, label: 'Documentation', href: '/docs', icon: FileCode2 }].map(({ id, label, href, icon: Icon }) => (
            <a key={id} href={href} className={`flex min-h-12 items-center justify-between rounded-xl px-3.5 text-sm font-medium ${activeRoute === id ? 'bg-celestial-elevated text-celestial-primary' : 'text-celestial-secondary'}`}><span className="flex items-center gap-3"><Icon className="h-4 w-4 text-celestial-sky" />{label}</span><ArrowUpRight className="h-4 w-4" /></a>
          ))}
          <button type="button" onClick={() => { setMobileOpen(false); onOpenCommand(); }} className="flex min-h-12 w-full items-center justify-between rounded-xl px-3.5 text-sm font-medium text-celestial-secondary"><span className="flex items-center gap-3"><Command className="h-4 w-4 text-celestial-sky" />Search endpoints</span><span className="font-mono text-[10px]">⌘K</span></button>
        </motion.div>
      )}
    </header>
  );
};

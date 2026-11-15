import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowUpRight,
  Command,
  Compass,
  FileCode2,
  KeyRound,
  Menu,
  Moon,
  Sparkles,
  Sun,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
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

const NAV_ITEMS: { id: ActiveRouteId; label: string; href: string; icon: React.FC<any> }[] = [
  { id: 'landing', label: 'Opening Stage', href: '/', icon: Sparkles },
  { id: 'explorer', label: 'API Workbench', href: '/explorer.html', icon: Compass },
  { id: 'signin', label: 'Session Gate', href: '/signin.html', icon: KeyRound },
];

export const CelestialNavbar: React.FC<CelestialNavbarProps> = ({
  activeRoute,
  onOpenCommand,
  amvAudioAvailable = false,
  amvMuted = true,
  onToggleAmvAudio,
  endpointCount = 42,
}) => {
  const { theme, toggleTheme } = useCelestialTheme();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        onOpenCommand();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onOpenCommand]);

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-6 sm:pt-4">
      <nav
        aria-label="Primary Celestial Navigation"
        className={`celestial-dock-glass mx-auto flex max-w-7xl items-center justify-between gap-3 rounded-2xl px-3.5 transition-all duration-200 sm:px-5 ${
          scrolled ? 'py-2.5 shadow-[0_12px_36px_rgba(10,15,26,0.34)]' : 'py-3'
        }`}
      >
        {/* Left: Metallic Silver Monochrome KG Emblem + Brand */}
        <a
          href="/"
          className="group flex items-center gap-3 rounded-xl focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-celestial-sky"
        >
          <span className="kg-metallic-emblem h-9 w-9 shrink-0 transition-transform duration-200 group-hover:scale-[1.04]">
            <img
              src="/icon.png"
              alt="KanjutGede metallic silver monogram"
              width={36}
              height={36}
            />
          </span>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="font-display text-sm font-semibold tracking-tight text-celestial-primary sm:text-[15px]">
                KanjutGede
              </span>
              <span className="hidden rounded-full border border-celestial-sky/35 bg-celestial-sky/10 px-2 py-0.5 font-mono text-[10px] font-medium text-celestial-sky sm:inline-block">
                v1 · {endpointCount} ROUTES
              </span>
            </div>
            <span className="font-mono text-[10px] tracking-wider text-celestial-muted">
              CELESTIAL BLUE RELAY
            </span>
          </div>
        </a>

        {/* Center: Spring-Animated Pill Route Switcher */}
        <div className="hidden items-center gap-1 rounded-xl border border-celestial-border/40 bg-celestial-canvas/45 p-1 md:flex">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeRoute === item.id;
            return (
              <a
                key={item.id}
                href={item.href}
                className={`relative flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-xs font-medium transition-colors duration-150 ${
                  active
                    ? 'text-celestial-primary'
                    : 'text-celestial-secondary hover:text-celestial-primary'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="celestial-nav-pill"
                    transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                    className="absolute inset-0 rounded-lg border border-celestial-sky/40 bg-celestial-sky/15"
                  />
                )}
                <Icon className="relative z-10 h-3.5 w-3.5 text-celestial-sky" strokeWidth={1.5} />
                <span className="relative z-10">{item.label}</span>
              </a>
            );
          })}
          <a
            href="/docs"
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-celestial-secondary transition-colors duration-150 hover:text-celestial-primary"
          >
            <FileCode2 className="h-3.5 w-3.5 text-celestial-lilac" strokeWidth={1.5} />
            <span>OpenAPI</span>
            <ArrowUpRight className="h-3 w-3 opacity-70" strokeWidth={1.5} />
          </a>
        </div>

        {/* Right: AMV Audio Equalizer, Command Bar, Anime Day/Night Switch, Launch CTA */}
        <div className="flex items-center gap-2">
          {amvAudioAvailable && onToggleAmvAudio && (
            <motion.button
              whileTap={{ scale: 0.96 }}
              type="button"
              onClick={onToggleAmvAudio}
              aria-pressed={!amvMuted}
              aria-label={amvMuted ? 'Unmute anime opening soundtrack' : 'Mute anime opening soundtrack'}
              className={`inline-flex min-h-[38px] items-center gap-2 rounded-xl border px-3 py-1.5 font-mono text-xs transition-colors duration-150 ${
                !amvMuted
                  ? 'border-celestial-lilac/65 bg-celestial-lilac/20 text-celestial-primary'
                  : 'border-celestial-border/50 bg-celestial-canvas/55 text-celestial-secondary hover:border-celestial-sky/50 hover:text-celestial-primary'
              }`}
            >
              {amvMuted ? (
                <VolumeX className="h-3.5 w-3.5 text-celestial-muted" strokeWidth={1.5} />
              ) : (
                <Volume2 className="h-3.5 w-3.5 text-celestial-lilac" strokeWidth={1.5} />
              )}
              <span className="hidden sm:inline">{amvMuted ? 'AMV Muted' : 'AMV Live'}</span>
              {!amvMuted && (
                <span className="flex h-3 items-end gap-0.5" aria-hidden="true">
                  <span className="eq-bar h-full w-0.5 rounded-full bg-celestial-sky" />
                  <span className="eq-bar h-full w-0.5 rounded-full bg-celestial-lilac" />
                  <span className="eq-bar h-full w-0.5 rounded-full bg-celestial-sky" />
                  <span className="eq-bar h-full w-0.5 rounded-full bg-celestial-lilac" />
                </span>
              )}
            </motion.button>
          )}

          {/* Command Palette Trigger */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            type="button"
            onClick={onOpenCommand}
            aria-label="Open command palette (Ctrl+K)"
            className="hidden min-h-[38px] items-center gap-2 rounded-xl border border-celestial-border/50 bg-celestial-canvas/55 px-3 py-1.5 text-xs text-celestial-secondary transition-colors duration-150 hover:border-celestial-sky/50 hover:text-celestial-primary sm:inline-flex"
          >
            <Command className="h-3.5 w-3.5 text-celestial-sky" strokeWidth={1.5} />
            <span className="font-mono text-[11px]">⌘K</span>
          </motion.button>

          {/* Anime Day / Night Atmosphere Toggle */}
          <motion.button
            whileTap={{ scale: 0.94 }}
            type="button"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              toggleTheme({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
            }}
            aria-label={
              theme === 'dark'
                ? 'Switch to Anime Daylight Sky mode'
                : 'Switch to Anime Night Sky mode'
            }
            title={theme === 'dark' ? 'Daylight Stratosphere Mode' : 'Midnight Observatory Mode'}
            className="inline-flex h-[38px] w-[38px] items-center justify-center rounded-xl border border-celestial-border/50 bg-celestial-canvas/55 text-celestial-primary transition-colors duration-150 hover:border-celestial-sky/60"
          >
            {theme === 'dark' ? (
              <Sun className="h-4 w-4 text-celestial-sky" strokeWidth={1.5} />
            ) : (
              <Moon className="h-4 w-4 text-celestial-lilac" strokeWidth={1.5} />
            )}
          </motion.button>

          {/* Primary Workbench Action */}
          {activeRoute !== 'explorer' && (
            <motion.a
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              href="/explorer.html"
              className="btn-celestial-primary hidden min-h-[38px] items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold lg:inline-flex"
            >
              <span>Run Playground</span>
              <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.75} />
            </motion.a>
          )}

          {/* Mobile Drawer Trigger */}
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            aria-expanded={mobileOpen}
            aria-label="Toggle navigation menu"
            className="inline-flex h-[38px] w-[38px] items-center justify-center rounded-xl border border-celestial-border/50 bg-celestial-canvas/55 text-celestial-primary md:hidden"
          >
            {mobileOpen ? (
              <X className="h-4 w-4" strokeWidth={1.5} />
            ) : (
              <Menu className="h-4 w-4" strokeWidth={1.5} />
            )}
          </button>
        </div>
      </nav>

      {/* Mobile Navigation Drawer */}
      {mobileOpen && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="celestial-dock-glass mx-auto mt-2 max-w-7xl rounded-2xl p-3 md:hidden"
        >
          <div className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = activeRoute === item.id;
              return (
                <a
                  key={item.id}
                  href={item.href}
                  className={`flex min-h-[44px] items-center justify-between rounded-xl px-3.5 py-2.5 text-sm font-medium ${
                    active
                      ? 'bg-celestial-sky/15 text-celestial-primary'
                      : 'text-celestial-secondary'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Icon className="h-4 w-4 text-celestial-sky" strokeWidth={1.5} />
                    {item.label}
                  </span>
                  <ArrowUpRight className="h-4 w-4 opacity-60" strokeWidth={1.5} />
                </a>
              );
            })}
            <button
              type="button"
              onClick={() => {
                setMobileOpen(false);
                onOpenCommand();
              }}
              className="flex min-h-[44px] items-center justify-between rounded-xl px-3.5 py-2.5 text-left text-sm font-medium text-celestial-secondary"
            >
              <span className="flex items-center gap-2.5">
                <Command className="h-4 w-4 text-celestial-lilac" strokeWidth={1.5} />
                Search Endpoints &amp; Commands
              </span>
              <span className="font-mono text-xs text-celestial-muted">⌘K</span>
            </button>
          </div>
        </motion.div>
      )}
    </header>
  );
};

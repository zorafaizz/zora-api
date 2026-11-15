import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowUpRight,
  Compass,
  FileCode2,
  KeyRound,
  Moon,
  Search,
  Sun,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import type { EndpointSpec } from '../lib/api-bridge';
import { filterCatalog } from '../lib/api-bridge';
import { useCelestialTheme } from '../lib/theme';

interface CommandModalProps {
  open: boolean;
  onClose: () => void;
  endpoints: EndpointSpec[];
  onSelectEndpoint?: (ep: EndpointSpec) => void;
  amvMuted?: boolean;
  onToggleAmvAudio?: () => void;
}

interface CommandItem {
  id: string;
  label: string;
  sublabel: string;
  badge: string;
  action: () => void;
  kind: 'nav' | 'action' | 'endpoint';
}

export const CommandModal: React.FC<CommandModalProps> = ({
  open,
  onClose,
  endpoints,
  onSelectEndpoint,
  amvMuted,
  onToggleAmvAudio,
}) => {
  const { theme, toggleTheme } = useCelestialTheme();
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  const items = useMemo<CommandItem[]>(() => {
    const baseActions: CommandItem[] = [
      {
        id: 'nav-landing',
        label: 'Celestial Opening Stage (Home)',
        sublabel: 'Return to cinematic AMV landing page & architecture chapters',
        badge: 'PAGE',
        kind: 'nav',
        action: () => {
          window.location.href = '/';
        },
      },
      {
        id: 'nav-explorer',
        label: 'API Explorer & Live Playground',
        sublabel: 'Execute live requests, inspect JSON & copy multi-language snippets',
        badge: 'WORKBENCH',
        kind: 'nav',
        action: () => {
          window.location.href = '/explorer.html';
        },
      },
      {
        id: 'nav-signin',
        label: 'Developer Session Gate (Sign In)',
        sublabel: '8-digit passwordless email verification & session controls',
        badge: 'AUTH',
        kind: 'nav',
        action: () => {
          window.location.href = '/signin.html';
        },
      },
      {
        id: 'nav-openapi',
        label: 'OpenAPI 3.1 Reference (/docs)',
        sublabel: 'Machine-readable schema & full specification reference',
        badge: 'SPEC',
        kind: 'nav',
        action: () => {
          window.location.href = '/docs';
        },
      },
      {
        id: 'act-theme',
        label:
          theme === 'dark'
            ? 'Switch to Anime Daylight Atmosphere (Summer Stratosphere)'
            : 'Switch to Anime Night Atmosphere (Midnight Observatory)',
        sublabel: 'Trigger celestial horizon iris transition',
        badge: 'THEME',
        kind: 'action',
        action: () => {
          toggleTheme({ x: window.innerWidth / 2, y: window.innerHeight / 3 });
          onClose();
        },
      },
    ];

    if (onToggleAmvAudio) {
      baseActions.push({
        id: 'act-audio',
        label: amvMuted ? 'Unmute Opening AMV Soundtrack' : 'Mute Opening AMV Soundtrack',
        sublabel: 'Toggle stereo soundtrack on Celestial Hero video stage',
        badge: 'AUDIO',
        kind: 'action',
        action: () => {
          onToggleAmvAudio();
          onClose();
        },
      });
    }

    const q = query.trim().toLowerCase();
    const matchedActions = q
      ? baseActions.filter(
          (a) =>
            a.label.toLowerCase().includes(q) ||
            a.sublabel.toLowerCase().includes(q) ||
            a.badge.toLowerCase().includes(q)
        )
      : baseActions;

    const matchedEndpoints = filterCatalog(endpoints, { search: query })
      .slice(0, 18)
      .map<CommandItem>((ep) => ({
        id: `ep-${ep.id}`,
        label: ep.title,
        sublabel: `${ep.method} ${ep.executionPath} · ${ep.category}`,
        badge: ep.public ? 'PUBLIC' : `${ep.credits} CR`,
        kind: 'endpoint',
        action: () => {
          if (onSelectEndpoint) {
            onSelectEndpoint(ep);
            onClose();
          } else {
            window.location.href = `/explorer.html?endpoint=${encodeURIComponent(ep.id)}`;
          }
        },
      }));

    return [...matchedActions, ...matchedEndpoints];
  }, [amvMuted, endpoints, onClose, onSelectEndpoint, onToggleAmvAudio, query, theme, toggleTheme]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((prev) => (items.length ? (prev + 1) % items.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((prev) => (items.length ? (prev - 1 + items.length) % items.length : 0));
      } else if (e.key === 'Enter' && items[activeIndex]) {
        e.preventDefault();
        items[activeIndex].action();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeIndex, items, onClose, open]);

  return (
    <AnimatePresence>
      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-[11vh]"
          role="dialog"
          aria-modal="true"
          aria-label="Celestial Command Palette"
        >
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={onClose}
            className="fixed inset-0 bg-[#0A0F1A]/70 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -8 }}
            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
            className="celestial-dock-glass relative z-10 w-full max-w-xl overflow-hidden rounded-xl shadow-2xl"
          >
            <div className="flex items-center gap-3 border-b border-celestial-border/45 px-4 py-3.5">
              <Search className="h-4 w-4 shrink-0 text-celestial-sky" strokeWidth={1.5} />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Jump to endpoint, switch day/night sky, or open workbench..."
                className="w-full bg-transparent text-base text-celestial-primary placeholder:text-celestial-muted focus:outline-none sm:text-sm"
              />
              <button
                type="button"
                onClick={onClose}
                aria-label="Close command palette"
                className="rounded-md border border-celestial-border/45 p-1 text-celestial-muted transition-colors hover:text-celestial-primary"
              >
                <X className="h-3.5 w-3.5" strokeWidth={1.5} />
              </button>
            </div>

            <div className="max-h-[56vh] overflow-y-auto p-2">
              {items.length === 0 ? (
                <div className="px-4 py-8 text-center text-sm text-celestial-muted">
                  No matching routes or commands for &ldquo;{query}&rdquo;.
                </div>
              ) : (
                items.map((item, idx) => {
                  const selected = idx === activeIndex;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={item.action}
                      className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2.5 text-left transition-colors duration-100 ${
                        selected
                          ? 'bg-celestial-sky/15 text-celestial-primary'
                          : 'text-celestial-secondary hover:bg-celestial-elevated/50'
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-celestial-border/45 bg-celestial-canvas/60 text-celestial-sky">
                          {item.id === 'act-theme' ? (
                            theme === 'dark' ? (
                              <Sun className="h-3.5 w-3.5" strokeWidth={1.5} />
                            ) : (
                              <Moon className="h-3.5 w-3.5" strokeWidth={1.5} />
                            )
                          ) : item.id === 'act-audio' ? (
                            amvMuted ? (
                              <Volume2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                            ) : (
                              <VolumeX className="h-3.5 w-3.5" strokeWidth={1.5} />
                            )
                          ) : item.id === 'nav-signin' ? (
                            <KeyRound className="h-3.5 w-3.5" strokeWidth={1.5} />
                          ) : item.kind === 'endpoint' ? (
                            <FileCode2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                          ) : (
                            <Compass className="h-3.5 w-3.5" strokeWidth={1.5} />
                          )}
                        </span>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-celestial-primary">
                            {item.label}
                          </div>
                          <div className="truncate font-mono text-[11px] text-celestial-muted">
                            {item.sublabel}
                          </div>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="rounded border border-celestial-border/50 px-1.5 py-0.5 font-mono text-[10px] text-celestial-muted">
                          {item.badge}
                        </span>
                        <ArrowUpRight className="h-3.5 w-3.5 text-celestial-muted" strokeWidth={1.5} />
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-between border-t border-celestial-border/40 px-4 py-2 font-mono text-[11px] text-celestial-muted">
              <span>Navigate with Up/Down · Enter to select</span>
              <span>ESC to close</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

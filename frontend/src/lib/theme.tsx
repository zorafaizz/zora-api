import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';

export type CelestialTheme = 'dark' | 'light';

interface ThemeContextValue {
  theme: CelestialTheme;
  toggleTheme: (origin?: { x: number; y: number }) => void;
  setThemeExplicit: (next: CelestialTheme, origin?: { x: number; y: number }) => void;
  reducedMotion: boolean;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'dark',
  toggleTheme: () => {},
  setThemeExplicit: () => {},
  reducedMotion: false,
});

function readInitialTheme(): CelestialTheme {
  if (typeof document === 'undefined') return 'dark';
  const attr = document.documentElement.getAttribute('data-theme');
  if (attr === 'light' || attr === 'dark') return attr;
  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

export const CelestialThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<CelestialTheme>(readInitialTheme);
  const [reducedMotion, setReducedMotion] = useState<boolean>(false);
  const curtainRef = useRef<SVGSVGElement | null>(null);
  const circleRef = useRef<SVGCircleElement | null>(null);
  const ringRef = useRef<SVGCircleElement | null>(null);
  const animatingRef = useRef(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const applyDomTheme = useCallback((next: CelestialTheme) => {
    document.documentElement.setAttribute('data-theme', next);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.setAttribute('content', next === 'dark' ? '#0c0c0e' : '#f4f2ee');
    }
    try {
      localStorage.setItem('kg-celestial-theme', next);
    } catch {
      // Ignore storage quota / privacy mode errors
    }
    setTheme(next);
  }, []);

  const runCinematicTransition = useCallback(
    (next: CelestialTheme, origin?: { x: number; y: number }) => {
      if (reducedMotion || !curtainRef.current || !circleRef.current || !ringRef.current || animatingRef.current) {
        applyDomTheme(next);
        return;
      }

      animatingRef.current = true;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const cx = origin?.x ?? vw - 88;
      const cy = origin?.y ?? 42;
      const maxR = Math.hypot(Math.max(cx, vw - cx), Math.max(cy, vh - cy)) * 1.12;

      const svg = curtainRef.current;
      const circle = circleRef.current;
      const ring = ringRef.current;

      const fillHex = next === 'light' ? '#f4f2ee' : '#0c0c0e';
      const strokeHex = next === 'light' ? '#cd3932' : '#ff746a';

      svg.style.display = 'block';
      circle.setAttribute('cx', String(cx));
      circle.setAttribute('cy', String(cy));
      circle.setAttribute('fill', fillHex);

      ring.setAttribute('cx', String(cx));
      ring.setAttribute('cy', String(cy));
      ring.setAttribute('stroke', strokeHex);

      const tl = gsap.timeline({
        onComplete: () => {
          svg.style.display = 'none';
          gsap.set([circle, ring], { attr: { r: 0 }, opacity: 1 });
          animatingRef.current = false;
        },
      });

      tl.fromTo(
        circle,
        { attr: { r: 0 }, opacity: 0.94 },
        { attr: { r: maxR }, opacity: 1, duration: 0.46, ease: 'power3.inOut' },
        0
      )
        .fromTo(
          ring,
          { attr: { r: 8 }, opacity: 0.95, strokeWidth: 6 },
          { attr: { r: maxR * 0.96 }, opacity: 0, strokeWidth: 1.5, duration: 0.54, ease: 'expo.out' },
          0
        )
        .add(() => {
          applyDomTheme(next);
        }, 0.26)
        .to(
          circle,
          { opacity: 0, duration: 0.28, ease: 'power2.out' },
          0.34
        );
    },
    [applyDomTheme, reducedMotion]
  );

  const toggleTheme = useCallback(
    (origin?: { x: number; y: number }) => {
      const next: CelestialTheme = theme === 'dark' ? 'light' : 'dark';
      runCinematicTransition(next, origin);
    },
    [theme, runCinematicTransition]
  );

  const setThemeExplicit = useCallback(
    (next: CelestialTheme, origin?: { x: number; y: number }) => {
      if (next === theme) return;
      runCinematicTransition(next, origin);
    },
    [theme, runCinematicTransition]
  );

  const value = useMemo(
    () => ({ theme, toggleTheme, setThemeExplicit, reducedMotion }),
    [theme, toggleTheme, setThemeExplicit, reducedMotion]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
      {/* Memorable Anime Celestial Horizon / Eclipse Iris Curtain */}
      <svg
        ref={curtainRef}
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[120] hidden h-full w-full"
      >
        <circle ref={circleRef} cx="0" cy="0" r="0" />
        <circle ref={ringRef} cx="0" cy="0" r="0" fill="none" />
      </svg>
    </ThemeContext.Provider>
  );
};

export function useCelestialTheme() {
  return useContext(ThemeContext);
}

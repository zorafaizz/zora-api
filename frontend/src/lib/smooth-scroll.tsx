import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useCelestialTheme } from './theme';

gsap.registerPlugin(ScrollTrigger);

interface ScrollContextValue {
  velocityRef: React.MutableRefObject<number>;
  progressRef: React.MutableRefObject<number>;
  scrollTo: (target: string | number | HTMLElement) => void;
}

const ScrollContext = createContext<ScrollContextValue>({
  velocityRef: { current: 0 },
  progressRef: { current: 0 },
  scrollTo: () => {},
});

export const SmoothScrollProvider: React.FC<{ children: React.ReactNode; enabled?: boolean }> = ({
  children,
  enabled = true,
}) => {
  const { reducedMotion } = useCelestialTheme();
  const velocityRef = useRef(0);
  const progressRef = useRef(0);
  const lenisRef = useRef<Lenis | null>(null);
  const [, forceReady] = useState(0);

  useEffect(() => {
    const isCoarseTouch =
      typeof window !== 'undefined' &&
      (window.matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0);

    if (!enabled || reducedMotion || isCoarseTouch) {
      lenisRef.current = null;
      let prevY = typeof window !== 'undefined' ? window.scrollY : 0;
      const onNativeScroll = () => {
        const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        const currY = window.scrollY;
        velocityRef.current = (currY - prevY) * 0.15;
        prevY = currY;
        progressRef.current = Math.min(1, Math.max(0, currY / max));
        ScrollTrigger.update();
      };
      window.addEventListener('scroll', onNativeScroll, { passive: true });
      return () => window.removeEventListener('scroll', onNativeScroll);
    }

    const lenis = new Lenis({
      duration: 1.12,
      easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 0.95,
      touchMultiplier: 1.4,
    });

    lenisRef.current = lenis;

    lenis.on('scroll', (e: any) => {
      velocityRef.current = e.velocity ?? 0;
      progressRef.current = e.progress ?? 0;
      ScrollTrigger.update();
    });

    const updateTicker = (time: number) => {
      lenis.raf(time * 1000);
      velocityRef.current *= 0.92;
    };

    gsap.ticker.add(updateTicker);
    gsap.ticker.lagSmoothing(0);
    forceReady((n) => n + 1);

    return () => {
      gsap.ticker.remove(updateTicker);
      lenis.destroy();
      lenisRef.current = null;
    };
  }, [enabled, reducedMotion]);

  const scrollTo = (target: string | number | HTMLElement) => {
    if (lenisRef.current) {
      lenisRef.current.scrollTo(target, { offset: -84 });
      return;
    }
    if (typeof target === 'number') {
      window.scrollTo({ top: target, behavior: reducedMotion ? 'auto' : 'smooth' });
    } else if (typeof target === 'string') {
      const el = document.querySelector(target);
      el?.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
    } else {
      target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' });
    }
  };

  return (
    <ScrollContext.Provider value={{ velocityRef, progressRef, scrollTo }}>
      {children}
    </ScrollContext.Provider>
  );
};

export function useSmoothScroll() {
  return useContext(ScrollContext);
}

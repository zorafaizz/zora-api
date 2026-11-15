import React, { useEffect, useRef } from 'react';
import { useCelestialTheme } from '../lib/theme';
import { useSmoothScroll } from '../lib/smooth-scroll';
import type { OperatorApiState } from '../lib/api-bridge';

interface AnimeCanvasFXProps {
  apiState?: OperatorApiState;
  burstSignal?: number;
}

interface StarParticle {
  x: number;
  y: number;
  z: number;
  size: number;
  phase: number;
  hueType: 'sky' | 'lilac' | 'starlight';
  vx: number;
  vy: number;
}

interface SpeedRay {
  angle: number;
  innerR: number;
  length: number;
  width: number;
  speed: number;
  alpha: number;
}

export const AnimeCanvasFX: React.FC<AnimeCanvasFXProps> = ({
  apiState = 'idle',
  burstSignal = 0,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { theme, reducedMotion } = useCelestialTheme();
  const { velocityRef } = useSmoothScroll();
  const stateRef = useRef({ apiState, theme, burstEnergy: 0 });

  useEffect(() => {
    stateRef.current.apiState = apiState;
    stateRef.current.theme = theme;
  }, [apiState, theme]);

  useEffect(() => {
    if (burstSignal > 0) {
      stateRef.current.burstEnergy = 1;
    }
  }, [burstSignal]);

  useEffect(() => {
    if (reducedMotion) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let width = window.innerWidth;
    let height = window.innerHeight;
    let dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    let rafId = 0;
    let hidden = document.hidden;

    const resize = () => {
      width = window.innerWidth;
      height = window.innerHeight;
      dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();

    const count = width < 768 ? 34 : 64;
    const particles: StarParticle[] = Array.from({ length: count }, (_, i) => ({
      x: Math.random() * width,
      y: Math.random() * height,
      z: 0.35 + Math.random() * 0.9,
      size: 1.1 + Math.random() * 2.3,
      phase: Math.random() * Math.PI * 2,
      hueType: i % 3 === 0 ? 'lilac' : i % 2 === 0 ? 'sky' : 'starlight',
      vx: (Math.random() - 0.5) * 0.22,
      vy: -0.14 - Math.random() * 0.28,
    }));

    const rays: SpeedRay[] = Array.from({ length: 44 }, (_, i) => ({
      angle: (i / 44) * Math.PI * 2 + Math.random() * 0.1,
      innerR: 0.28 + Math.random() * 0.24,
      length: 90 + Math.random() * 220,
      width: 0.8 + Math.random() * 1.8,
      speed: 0.02 + Math.random() * 0.035,
      alpha: 0.25 + Math.random() * 0.55,
    }));

    let pointerX = width * 0.5;
    let pointerY = height * 0.5;
    const onPointerMove = (e: PointerEvent) => {
      pointerX = e.clientX;
      pointerY = e.clientY;
    };

    const onVisibility = () => {
      hidden = document.hidden;
      if (!hidden && !rafId) {
        rafId = requestAnimationFrame(render);
      }
    };

    window.addEventListener('resize', resize, { passive: true });
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    document.addEventListener('visibilitychange', onVisibility);

    let tick = 0;
    const render = () => {
      if (hidden) {
        rafId = 0;
        return;
      }
      tick += 0.016;
      ctx.clearRect(0, 0, width, height);

      const isDark = stateRef.current.theme === 'dark';
      const currentApi = stateRef.current.apiState;
      const scrollVel = Math.min(28, Math.abs(velocityRef.current || 0));
      stateRef.current.burstEnergy *= 0.93;

      const speedIntensity = Math.min(
        1,
        scrollVel / 18 +
          (currentApi === 'loading' ? 0.72 : 0) +
          stateRef.current.burstEnergy * 0.85
      );

      // 1. Celestial Atmosphere Particles (Night Starlight Motes vs Daylight Sky Petals/Drifts)
      for (const p of particles) {
        p.x += p.vx + (isDark ? 0.05 : 0.22) * p.z;
        p.y += p.vy * p.z - (velocityRef.current || 0) * 0.18 * p.z;

        if (p.x > width + 16) p.x = -16;
        if (p.x < -16) p.x = width + 16;
        if (p.y < -16) p.y = height + 16;
        if (p.y > height + 16) p.y = -16;

        const dx = (pointerX - width * 0.5) * 0.012 * p.z;
        const dy = (pointerY - height * 0.5) * 0.012 * p.z;
        const px = p.x + dx;
        const py = p.y + dy;

        const twinkle = 0.45 + 0.55 * Math.sin(tick * 2.2 + p.phase);
        let fill = 'rgba(234, 244, 255, ';
        if (isDark) {
          if (p.hueType === 'sky') fill = 'rgba(131, 185, 255, ';
          else if (p.hueType === 'lilac') fill = 'rgba(185, 167, 255, ';
        } else {
          if (p.hueType === 'sky') fill = 'rgba(38, 112, 224, ';
          else if (p.hueType === 'lilac') fill = 'rgba(112, 84, 216, ';
          else fill = 'rgba(51, 75, 112, ';
        }

        const alpha = (isDark ? 0.58 : 0.34) * twinkle;
        ctx.fillStyle = `${fill}${alpha.toFixed(3)})`;

        if (p.size > 2.4) {
          // 4-point anime starlight glint
          const r = p.size * (1 + speedIntensity * 0.4);
          ctx.beginPath();
          ctx.moveTo(px, py - r * 1.7);
          ctx.quadraticCurveTo(px, py, px + r * 1.7, py);
          ctx.quadraticCurveTo(px, py, px, py + r * 1.7);
          ctx.quadraticCurveTo(px, py, px - r * 1.7, py);
          ctx.quadraticCurveTo(px, py, px, py - r * 1.7);
          ctx.fill();
        } else {
          ctx.beginPath();
          ctx.arc(px, py, p.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 2. Procedural Anime Action Speed Lines on Fast Scroll / API Execution
      if (speedIntensity > 0.08) {
        const cx = width * 0.5 + (pointerX - width * 0.5) * 0.12;
        const cy = height * 0.5 + (pointerY - height * 0.5) * 0.12;
        const maxRadius = Math.hypot(width, height) * 0.62;

        ctx.save();
        ctx.lineCap = 'round';
        for (const ray of rays) {
          ray.innerR -= ray.speed * (0.6 + speedIntensity * 1.4);
          if (ray.innerR < 0.18) {
            ray.innerR = 0.68 + Math.random() * 0.25;
          }

          const r0 = maxRadius * ray.innerR;
          const r1 = r0 + ray.length * (0.5 + speedIntensity * 0.9);
          const x0 = cx + Math.cos(ray.angle) * r0;
          const y0 = cy + Math.sin(ray.angle) * r0;
          const x1 = cx + Math.cos(ray.angle) * r1;
          const y1 = cy + Math.sin(ray.angle) * r1;

          const grad = ctx.createLinearGradient(x0, y0, x1, y1);
          const strokeRgb =
            currentApi === 'error'
              ? '244, 114, 182'
              : isDark
                ? '131, 185, 255'
                : '51, 75, 112';
          const rayAlpha = Math.min(0.45, ray.alpha * speedIntensity * 0.5);
          grad.addColorStop(0, `rgba(${strokeRgb}, 0)`);
          grad.addColorStop(0.5, `rgba(${strokeRgb}, ${rayAlpha.toFixed(3)})`);
          grad.addColorStop(1, `rgba(185, 167, 255, 0)`);

          ctx.strokeStyle = grad;
          ctx.lineWidth = ray.width;
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(x1, y1);
          ctx.stroke();
        }
        ctx.restore();
      }

      rafId = requestAnimationFrame(render);
    };

    rafId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', onPointerMove);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [reducedMotion, velocityRef]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[1] h-full w-full"
    />
  );
};

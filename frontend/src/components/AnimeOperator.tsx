import React, { useEffect, useId, useRef, useState } from 'react';
import { useRive, useStateMachineInput, RuntimeLoader } from '@rive-app/react-canvas';
import { Activity, AlertTriangle, CheckCircle2, PauseCircle, Sparkles, Terminal } from 'lucide-react';
import type { OperatorApiState } from '../lib/api-bridge';
import { useCelestialTheme } from '../lib/theme';
import { useSmoothScroll } from '../lib/smooth-scroll';

// Self-hosted Rive WASM binary — zero external CDN dependency, 100% CSP safe
RuntimeLoader.setWasmUrl('/assets/media/rive.wasm');

interface AnimeOperatorProps {
  apiState: OperatorApiState;
  statusText?: string;
  compact?: boolean;
  interactiveControls?: boolean;
  onSelectState?: (state: OperatorApiState) => void;
}

const STATE_NUM_MAP: Record<OperatorApiState, number> = {
  idle: 0,
  focus: 1,
  loading: 2,
  success: 3,
  error: 4,
  cancelled: 5,
};

const STATE_META: Record<
  OperatorApiState,
  { badge: string; caption: string; toneClass: string }
> = {
  idle: {
    badge: 'STANDBY · ASTRAL SYNC',
    caption: 'Sora is monitoring edge routes and awaiting your next HTTP dispatch.',
    toneClass: 'text-celestial-sky border-celestial-sky/40 bg-celestial-sky/10',
  },
  focus: {
    badge: 'TARGET LOCKED',
    caption: 'Tracking query parameters and computing payload signature.',
    toneClass: 'text-celestial-lilac border-celestial-lilac/40 bg-celestial-lilac/10',
  },
  loading: {
    badge: 'DISPATCHING STREAM',
    caption: 'Executing upstream relay with bounded 1 MB response shield...',
    toneClass: 'text-celestial-sky border-celestial-sky/60 bg-celestial-sky/15',
  },
  success: {
    badge: '200 OK · PAYLOAD VERIFIED',
    caption: 'Clean JSON envelope received and redacted for safe inspection.',
    toneClass: 'text-emerald-400 border-emerald-400/40 bg-emerald-400/10',
  },
  error: {
    badge: 'UPSTREAM ANOMALY',
    caption: 'Non-2xx status or rate limit encountered. Inspect headers before retry.',
    toneClass: 'text-rose-400 border-rose-400/40 bg-rose-400/10',
  },
  cancelled: {
    badge: 'ABORT SIGNAL SENT',
    caption: 'AbortController triggered cleanly. Connection released.',
    toneClass: 'text-amber-300 border-amber-300/40 bg-amber-400/10',
  },
};

const RiveAstrolabeHalo: React.FC<{
  apiState: OperatorApiState;
  normX: number;
  normY: number;
}> = ({ apiState, normX, normY }) => {
  const { rive, RiveComponent } = useRive({
    src: '/assets/media/celestial-operator.riv',
    stateMachines: 'OperatorStateMachine',
    autoplay: true,
  });

  const apiInput = useStateMachineInput(rive, 'OperatorStateMachine', 'apiState');
  const pxInput = useStateMachineInput(rive, 'OperatorStateMachine', 'pointerX');
  const pyInput = useStateMachineInput(rive, 'OperatorStateMachine', 'pointerY');

  useEffect(() => {
    if (apiInput) apiInput.value = STATE_NUM_MAP[apiState] ?? 0;
    if (rive) {
      if (apiState === 'loading') {
        rive.play('OrbitSurge');
      } else {
        rive.play('OrbitIdle');
      }
    }
  }, [apiState, apiInput, rive]);

  useEffect(() => {
    if (pxInput) pxInput.value = normX * 100;
    if (pyInput) pyInput.value = normY * 100;
  }, [normX, normY, pxInput, pyInput]);

  return (
    <div className="pointer-events-none absolute inset-0 opacity-90">
      <RiveComponent className="h-full w-full" />
    </div>
  );
};

export const AnimeOperator: React.FC<AnimeOperatorProps> = ({
  apiState,
  statusText,
  compact = false,
  interactiveControls = false,
  onSelectState,
}) => {
  const uid = useId().replace(/:/g, '');
  const { theme, reducedMotion } = useCelestialTheme();
  const { velocityRef } = useSmoothScroll();
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Refs for direct 60fps spring-physics DOM transforms without React re-render overhead
  const headGroupRef = useRef<SVGGElement | null>(null);
  const backHairRef = useRef<SVGGElement | null>(null);
  const leftLockRef = useRef<SVGPathElement | null>(null);
  const rightLockRef = useRef<SVGPathElement | null>(null);
  const bangsRef = useRef<SVGGElement | null>(null);
  const ahogeRef = useRef<SVGPathElement | null>(null);
  const leftPupilRef = useRef<SVGGElement | null>(null);
  const rightPupilRef = useRef<SVGGElement | null>(null);
  const floatBodyRef = useRef<SVGGElement | null>(null);

  const [isBlinking, setIsBlinking] = useState(false);
  const [riveCoords, setRiveCoords] = useState({ x: 0, y: 0 });

  // Natural autonomous anime blink loop
  useEffect(() => {
    if (reducedMotion) return;
    let timer: ReturnType<typeof setTimeout>;
    const scheduleBlink = () => {
      const delay = 2200 + Math.random() * 3400;
      timer = setTimeout(() => {
        setIsBlinking(true);
        setTimeout(() => {
          setIsBlinking(false);
          // Occasional cute double-blink
          if (Math.random() < 0.22) {
            setTimeout(() => {
              setIsBlinking(true);
              setTimeout(() => setIsBlinking(false), 110);
            }, 140);
          }
          scheduleBlink();
        }, 125);
      }, delay);
    };
    scheduleBlink();
    return () => clearTimeout(timer);
  }, [reducedMotion]);

  // 60FPS Eye Tracking, Head Movement & Damped-Harmonic Hair Spring Physics
  useEffect(() => {
    if (reducedMotion) return;

    let targetX = 0;
    let targetY = 0;
    let headX = 0;
    let headY = 0;
    let eyeX = 0;
    let eyeY = 0;

    // Hair spring state (angle + angular velocity)
    let hairAngle = 0;
    let hairVel = 0;
    let ahogeAngle = 0;
    let ahogeVel = 0;
    let prevTargetX = 0;
    let rafId = 0;
    let frameCount = 0;

    const onPointerMove = (e: PointerEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (rect) {
        const cx = rect.left + rect.width * 0.5;
        const cy = rect.top + rect.height * 0.44;
        targetX = Math.max(-1, Math.min(1, (e.clientX - cx) / (window.innerWidth * 0.42)));
        targetY = Math.max(-1, Math.min(1, (e.clientY - cy) / (window.innerHeight * 0.42)));
      } else {
        targetX = (e.clientX / window.innerWidth) * 2 - 1;
        targetY = (e.clientY / window.innerHeight) * 2 - 1;
      }
    };

    window.addEventListener('pointermove', onPointerMove, { passive: true });

    let t = 0;
    const step = () => {
      t += 0.025;
      frameCount++;

      // Smooth eye & head interpolation
      eyeX += (targetX - eyeX) * 0.18;
      eyeY += (targetY - eyeY) * 0.18;
      headX += (targetX - headX) * 0.085;
      headY += (targetY - headY) * 0.085;

      const pointerImpulse = (targetX - prevTargetX) * 26;
      prevTargetX = targetX;
      const scrollWind = Math.max(-14, Math.min(14, (velocityRef.current || 0) * 0.45));
      const ambientBreeze = Math.sin(t * 1.35) * 2.2 + (apiState === 'loading' ? Math.sin(t * 7.5) * 4.2 : 0);

      // Hooke's law damped spring for side hair locks & bangs
      const desiredHair = -headX * 7.5 - pointerImpulse + ambientBreeze + scrollWind * 0.35;
      const springForce = (desiredHair - hairAngle) * 0.11;
      hairVel = (hairVel + springForce) * 0.82;
      hairAngle += hairVel;

      // Lighter, bouncier spring for top ahoge antenna strand
      const desiredAhoge = -headX * 12 - pointerImpulse * 1.5 + Math.sin(t * 2.1) * 4.5 - scrollWind * 0.5;
      ahogeVel = (ahogeVel + (desiredAhoge - ahogeAngle) * 0.14) * 0.78;
      ahogeAngle += ahogeVel;

      // Breathing & floating motion
      const breathY = Math.sin(t * 1.5) * (apiState === 'loading' ? 4.5 : 2.6);
      const headTiltDeg = headX * 5.2;

      if (floatBodyRef.current) {
        floatBodyRef.current.setAttribute('transform', `translate(0, ${breathY.toFixed(2)})`);
      }
      if (headGroupRef.current) {
        headGroupRef.current.setAttribute(
          'transform',
          `translate(${(headX * 6.5).toFixed(2)}, ${(headY * 4.5).toFixed(2)}) rotate(${headTiltDeg.toFixed(2)}, 180, 175)`
        );
      }
      if (backHairRef.current) {
        backHairRef.current.setAttribute(
          'transform',
          `translate(${(-headX * 4.2).toFixed(2)}, ${(-headY * 2.5 + breathY * 0.6).toFixed(2)}) rotate(${(hairAngle * 0.35).toFixed(2)}, 180, 150)`
        );
      }
      if (leftLockRef.current) {
        leftLockRef.current.setAttribute('transform', `rotate(${hairAngle.toFixed(2)}, 118, 146)`);
      }
      if (rightLockRef.current) {
        rightLockRef.current.setAttribute('transform', `rotate(${(hairAngle * 0.92).toFixed(2)}, 242, 146)`);
      }
      if (bangsRef.current) {
        bangsRef.current.setAttribute(
          'transform',
          `translate(${(hairAngle * 0.28).toFixed(2)}, 0) rotate(${(hairAngle * 0.38).toFixed(2)}, 180, 118)`
        );
      }
      if (ahogeRef.current) {
        ahogeRef.current.setAttribute('transform', `rotate(${ahogeAngle.toFixed(2)}, 182, 82)`);
      }

      const px = eyeX * 6.2;
      const py = eyeY * 4.4;
      if (leftPupilRef.current) {
        leftPupilRef.current.setAttribute('transform', `translate(${px.toFixed(2)}, ${py.toFixed(2)})`);
      }
      if (rightPupilRef.current) {
        rightPupilRef.current.setAttribute('transform', `translate(${px.toFixed(2)}, ${py.toFixed(2)})`);
      }

      if (frameCount % 6 === 0) {
        setRiveCoords({ x: Number(headX.toFixed(2)), y: Number(headY.toFixed(2)) });
      }

      rafId = requestAnimationFrame(step);
    };

    rafId = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('pointermove', onPointerMove);
    };
  }, [apiState, reducedMotion, velocityRef]);

  const meta = STATE_META[apiState];
  const eyesClosed = isBlinking || apiState === 'cancelled';

  return (
    <div
      ref={containerRef}
      className={`celestial-card relative overflow-hidden ${
        compact ? 'p-4' : 'p-5 sm:p-6'
      } flex flex-col justify-between select-none`}
    >
      {/* Ambient Celestial Glow matching current API mood */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-16 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full opacity-35 blur-3xl transition-colors duration-500"
        style={{
          background:
            apiState === 'error'
              ? 'radial-gradient(circle, #fb7185, transparent 70%)'
              : apiState === 'success'
                ? 'radial-gradient(circle, #34d399, #83B9FF 55%, transparent 72%)'
                : apiState === 'loading'
                  ? 'radial-gradient(circle, #83B9FF, #B9A7FF 60%, transparent 75%)'
                  : theme === 'dark'
                    ? 'radial-gradient(circle, #334B70, transparent 70%)'
                    : 'radial-gradient(circle, #83B9FF, transparent 70%)',
        }}
      />

      {/* Top Telemetry Status Header */}
      <div className="relative z-10 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[11px] font-medium tracking-wide ${meta.toneClass}`}
          >
            {apiState === 'loading' && <Activity className="h-3.5 w-3.5 animate-pulse" strokeWidth={1.5} />}
            {apiState === 'success' && <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.5} />}
            {apiState === 'error' && <AlertTriangle className="h-3.5 w-3.5" strokeWidth={1.5} />}
            {apiState === 'cancelled' && <PauseCircle className="h-3.5 w-3.5" strokeWidth={1.5} />}
            {(apiState === 'idle' || apiState === 'focus') && (
              <Sparkles className="h-3.5 w-3.5" strokeWidth={1.5} />
            )}
            {meta.badge}
          </span>
        </div>
        <span className="font-mono text-[11px] text-celestial-muted">UNIT // SORA-01</span>
      </div>

      {/* Hybrid Rive State Machine Halo + Layered Anime Character Rig */}
      <div
        className={`relative mx-auto my-2 flex items-center justify-center ${
          compact ? 'h-52 w-52' : 'h-72 w-72 sm:h-80 sm:w-80'
        }`}
      >
        {/* Rive State Machine Orbital Canvas */}
        <RiveAstrolabeHalo apiState={apiState} normX={riveCoords.x} normY={riveCoords.y} />

        {/* Precision Rigged Anime SVG Character */}
        <svg
          viewBox="0 0 360 360"
          className={`relative z-10 h-full w-full overflow-visible ${
            theme === 'dark'
              ? 'drop-shadow-[0_14px_26px_rgba(16,24,39,0.5)]'
              : 'drop-shadow-[0_12px_22px_rgba(29,99,220,0.16)]'
          }`}
          role="img"
          aria-label={`Sora anime API companion currently in ${apiState} state`}
        >
          <defs>
            <linearGradient id={`hairMain-${uid}`} x1="0" y1="0" x2="0.25" y2="1">
              <stop offset="0%" stopColor={theme === 'dark' ? '#EAF4FF' : '#F4F9FF'} />
              <stop offset="42%" stopColor="#83B9FF" />
              <stop offset="85%" stopColor="#466899" />
              <stop offset="100%" stopColor="#334B70" />
            </linearGradient>
            <linearGradient id={`hairBack-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#334B70" />
              <stop offset="100%" stopColor="#101827" />
            </linearGradient>
            <linearGradient id={`irisGrad-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#101827" />
              <stop offset="38%" stopColor="#334B70" />
              <stop offset="76%" stopColor="#83B9FF" />
              <stop offset="100%" stopColor="#B9A7FF" />
            </linearGradient>
            <linearGradient id={`skinGrad-${uid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#FFF8F5" />
              <stop offset="100%" stopColor="#F6E5E2" />
            </linearGradient>
            <linearGradient id={`jacketGrad-${uid}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#1E2E4A" />
              <stop offset="55%" stopColor="#101827" />
              <stop offset="100%" stopColor="#2A4066" />
            </linearGradient>
            <linearGradient id={`silverTrim-${uid}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="50%" stopColor="#C2CEE0" />
              <stop offset="100%" stopColor="#4A5B78" />
            </linearGradient>
          </defs>

          {/* Back Flowing Hair Layer */}
          <g ref={backHairRef}>
            <path
              d="M98 138 C80 198, 68 264, 88 320 C112 298, 128 286, 144 318 C166 300, 194 300, 216 318 C232 286, 248 298, 272 320 C292 264, 280 198, 262 138 Z"
              fill={`url(#hairBack-${uid})`}
              stroke="#83B9FF"
              strokeOpacity="0.32"
              strokeWidth="1.2"
            />
          </g>

          {/* Floating Torso & Celestial Astral High-Collar Coat */}
          <g ref={floatBodyRef}>
            {/* Slender Anime Neck & Cel-Shaded Chin Cast Shadow */}
            <path d="M166 222 L164 258 L196 258 L194 222 Z" fill={`url(#skinGrad-${uid})`} />
            <path d="M165 224 Q180 241 195 224 L195 236 Q180 247 165 236 Z" fill="#D7B8BE" opacity="0.72" />

            {/* Tailored Celestial Coat & High Collar */}
            <path
              d="M88 334 C96 278, 126 254, 158 248 L180 284 L202 248 C234 254, 264 278, 272 334 Z"
              fill={`url(#jacketGrad-${uid})`}
              stroke={`url(#silverTrim-${uid})`}
              strokeWidth="1.6"
            />
            <path
              d="M148 244 L162 272 L144 282 L138 254 Z M212 244 L198 272 L216 282 L222 254 Z"
              fill="#334B70"
              stroke={`url(#silverTrim-${uid})`}
              strokeWidth="1.1"
            />
            {/* Inner Starlight Shirt & Lilac Astral Tie */}
            <path d="M158 250 L180 296 L202 250 L193 247 L180 273 L167 247 Z" fill="#EAF4FF" />
            <polygon points="180,266 171,292 180,316 189,292" fill="#B9A7FF" />
            <polygon points="180,262 174,268 180,274 186,268" fill={`url(#silverTrim-${uid})`} />

            {/* Glowing Chest Telemetry Strip */}
            <line
              x1="124"
              y1="296"
              x2="152"
              y2="305"
              stroke={apiState === 'error' ? '#FB7185' : apiState === 'success' ? '#34D399' : '#83B9FF'}
              strokeWidth="2.4"
              strokeLinecap="round"
            />
            <line
              x1="236"
              y1="296"
              x2="208"
              y2="305"
              stroke={apiState === 'error' ? '#FB7185' : apiState === 'success' ? '#34D399' : '#83B9FF'}
              strokeWidth="2.4"
              strokeLinecap="round"
            />

            {/* Head & Facial Rig */}
            <g ref={headGroupRef}>
              {/* Metallic Silver Anime Comms Headset */}
              <path
                d="M106 164 C106 98, 254 98, 254 164"
                fill="none"
                stroke={`url(#silverTrim-${uid})`}
                strokeWidth="5.5"
                strokeLinecap="round"
              />
              <rect
                x="95"
                y="152"
                width="16"
                height="40"
                rx="7"
                fill={`url(#silverTrim-${uid})`}
                stroke="#101827"
                strokeWidth="1.3"
              />
              <rect
                x="249"
                y="152"
                width="16"
                height="40"
                rx="7"
                fill={`url(#silverTrim-${uid})`}
                stroke="#101827"
                strokeWidth="1.3"
              />
              <circle
                cx="103"
                cy="172"
                r="3.8"
                fill={apiState === 'loading' ? '#B9A7FF' : apiState === 'error' ? '#FB7185' : '#83B9FF'}
              />
              <circle
                cx="257"
                cy="172"
                r="3.8"
                fill={apiState === 'loading' ? '#B9A7FF' : apiState === 'error' ? '#FB7185' : '#83B9FF'}
              />

              {/* Hair Crown Volume */}
              <path
                d="M108 164 C102 100, 138 74, 180 74 C222 74, 258 100, 252 164 Z"
                fill={`url(#hairMain-${uid})`}
              />

              {/* Delicate Anime Ears */}
              <path d="M123 166 C115 166, 114 184, 125 189 Z" fill={`url(#skinGrad-${uid})`} stroke="#CFAEB4" strokeWidth="1" />
              <path d="M237 166 C245 166, 246 184, 235 189 Z" fill={`url(#skinGrad-${uid})`} stroke="#CFAEB4" strokeWidth="1" />

              {/* Modern V-Line Anime Face Contour */}
              <path
                d="M123 146 C123 182, 132 206, 156 222 C169 231, 180 234, 180 234 C180 234, 191 231, 204 222 C228 206, 237 182, 237 146 C237 112, 213 96, 180 96 C147 96, 123 112, 123 146 Z"
                fill={`url(#skinGrad-${uid})`}
                stroke="#CFAEB4"
                strokeWidth="1.15"
              />

              {/* Soft Anime Cheek Blush & Slash Marks */}
              <ellipse
                cx="141"
                cy="193"
                rx="11.5"
                ry="5.2"
                fill="#F48FB1"
                opacity={apiState === 'success' ? 0.5 : 0.26}
              />
              <ellipse
                cx="219"
                cy="193"
                rx="11.5"
                ry="5.2"
                fill="#F48FB1"
                opacity={apiState === 'success' ? 0.5 : 0.26}
              />

              {/* EXPRESSIVE CEL-SHADED ANIME EYES */}
              {eyesClosed ? (
                <>
                  <path
                    d="M135 174 Q151 182 167 173"
                    fill="none"
                    stroke="#1E293B"
                    strokeWidth="2.8"
                    strokeLinecap="round"
                  />
                  <path
                    d="M193 173 Q209 182 225 174"
                    fill="none"
                    stroke="#1E293B"
                    strokeWidth="2.8"
                    strokeLinecap="round"
                  />
                </>
              ) : (
                <>
                  {/* Left Eye */}
                  <g>
                    <path d="M136 159 Q151 154 165 160" fill="none" stroke="#9E828C" strokeWidth="1.1" strokeLinecap="round" />
                    <ellipse cx="151" cy="173" rx="15.5" ry="14.5" fill="#FFFFFF" />
                    <path d="M136 168 Q151 162 166 168 L166 163 Q151 157 136 163 Z" fill="#C7D8F0" opacity="0.55" />
                    <g ref={leftPupilRef}>
                      <ellipse cx="151" cy="174" rx="10.4" ry="11.8" fill={`url(#irisGrad-${uid})`} />
                      <path d="M143 178 A8.5 8.5 0 0 0 159 178" fill="none" stroke="#EAF4FF" strokeWidth="1.6" opacity="0.7" />
                      <ellipse cx="151" cy="174.5" rx="4.6" ry="5.2" fill="#101827" />
                      <circle cx="146" cy="168" r="3.6" fill="#FFFFFF" />
                      <circle cx="155.8" cy="179.2" r="1.9" fill="#EAF4FF" />
                      <path
                        d="M153.5 165 L154.5 168 L157.5 169 L154.5 170 L153.5 173 L152.5 170 L149.5 169 L152.5 168 Z"
                        fill="#EAF4FF"
                        opacity={apiState === 'success' || apiState === 'loading' ? 1 : 0.65}
                      />
                    </g>
                    <path
                      d="M132 169 C138 155, 162 155, 168 167 L165 163 C158 154, 140 155, 132 169 Z"
                      fill="#101827"
                    />
                    <path
                      d="M133 168 C139 156, 162 156, 168 167"
                      fill="none"
                      stroke="#101827"
                      strokeWidth="3.3"
                      strokeLinecap="round"
                    />
                    <path d="M143 187.5 Q151 189.5 159 187.5" fill="none" stroke="#8C737E" strokeWidth="1.1" strokeLinecap="round" />
                  </g>

                  {/* Right Eye */}
                  <g>
                    <path d="M195 160 Q209 154 224 159" fill="none" stroke="#9E828C" strokeWidth="1.1" strokeLinecap="round" />
                    <ellipse cx="209" cy="173" rx="15.5" ry="14.5" fill="#FFFFFF" />
                    <path d="M194 168 Q209 162 224 168 L224 163 Q209 157 194 163 Z" fill="#C7D8F0" opacity="0.55" />
                    <g ref={rightPupilRef}>
                      <ellipse cx="209" cy="174" rx="10.4" ry="11.8" fill={`url(#irisGrad-${uid})`} />
                      <path d="M201 178 A8.5 8.5 0 0 0 217 178" fill="none" stroke="#EAF4FF" strokeWidth="1.6" opacity="0.7" />
                      <ellipse cx="209" cy="174.5" rx="4.6" ry="5.2" fill="#101827" />
                      <circle cx="204" cy="168" r="3.6" fill="#FFFFFF" />
                      <circle cx="213.8" cy="179.2" r="1.9" fill="#EAF4FF" />
                      <path
                        d="M211.5 165 L212.5 168 L215.5 169 L212.5 170 L211.5 173 L210.5 170 L207.5 169 L210.5 168 Z"
                        fill="#EAF4FF"
                        opacity={apiState === 'success' || apiState === 'loading' ? 1 : 0.65}
                      />
                    </g>
                    <path
                      d="M192 167 C198 155, 222 155, 228 169 L220 155 C210 154, 198 156, 192 167 Z"
                      fill="#101827"
                    />
                    <path
                      d="M192 167 C198 156, 221 156, 227 168"
                      fill="none"
                      stroke="#101827"
                      strokeWidth="3.3"
                      strokeLinecap="round"
                    />
                    <path d="M201 187.5 Q209 189.5 217 187.5" fill="none" stroke="#8C737E" strokeWidth="1.1" strokeLinecap="round" />
                  </g>
                </>
              )}

              {/* Dynamic Eyebrows Driven by API State */}
              <path
                d={
                  apiState === 'error'
                    ? 'M136 150 L165 156'
                    : apiState === 'loading' || apiState === 'focus'
                      ? 'M135 152 Q151 148 166 154'
                      : 'M135 151 Q151 145 166 150'
                }
                fill="none"
                stroke="#334B70"
                strokeWidth="2.2"
                strokeLinecap="round"
              />
              <path
                d={
                  apiState === 'error'
                    ? 'M224 150 L195 156'
                    : apiState === 'loading' || apiState === 'focus'
                      ? 'M194 154 Q209 148 225 152'
                      : 'M194 150 Q209 145 225 151'
                }
                fill="none"
                stroke="#334B70"
                strokeWidth="2.2"
                strokeLinecap="round"
              />

              {/* Delicate Anime Nose + Light Catch */}
              <path d="M179.2 185.5 L177.8 191 L180.8 192" fill="none" stroke="#C69EA5" strokeWidth="1.4" strokeLinecap="round" />

              {/* Dynamic Mouth Expression Driven by API State */}
              {apiState === 'success' && (
                <path
                  d="M170 204 Q180 216 190 204 Z"
                  fill="#F08090"
                  stroke="#9E3F50"
                  strokeWidth="1.45"
                />
              )}
              {apiState === 'loading' && (
                <ellipse cx="180" cy="207" rx="4.8" ry="5.8" fill="#E57A8C" stroke="#9E3F50" strokeWidth="1.35" />
              )}
              {apiState === 'error' && (
                <>
                  <path
                    d="M170 210 Q175 205 180 209 Q185 213 190 208"
                    fill="none"
                    stroke="#9E3F50"
                    strokeWidth="1.9"
                    strokeLinecap="round"
                  />
                  <path
                    d="M231 146 C235 154, 236 160, 231 163 C226 160, 227 154, 231 146 Z"
                    fill="#83B9FF"
                    stroke="#334B70"
                    strokeWidth="1"
                  />
                </>
              )}
              {apiState === 'cancelled' && (
                <path d="M173 207 L187 207" stroke="#9E3F50" strokeWidth="1.9" strokeLinecap="round" />
              )}
              {(apiState === 'idle' || apiState === 'focus') && (
                <path
                  d="M172 205.5 Q180 211.5 188 205.5"
                  fill="none"
                  stroke="#9E3F50"
                  strokeWidth="1.9"
                  strokeLinecap="round"
                />
              )}

              {/* Spring-Rigged Front Multi-Strand Bangs + Angel-Ring Hair Specular */}
              <g ref={bangsRef}>
                <path
                  d="M116 144 C120 104, 148 86, 180 86 C212 86, 240 104, 244 144 C233 126, 224 148, 214 166 C208 140, 200 128, 191 162 C185 134, 177 132, 171 163 C162 132, 152 136, 144 165 C135 144, 126 126, 116 144 Z"
                  fill={`url(#hairMain-${uid})`}
                  stroke="#EAF4FF"
                  strokeOpacity="0.5"
                  strokeWidth="1"
                />
                {/* Anime Angel-Ring Crown Specular Highlight */}
                <path
                  d="M134 118 Q156 108 176 116 M186 116 Q206 108 226 118"
                  fill="none"
                  stroke="#EAF4FF"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  opacity="0.72"
                />
                {/* Celestial Hairpin Starlight Accent */}
                <polygon points="214,125 227,120 223,130 210,133" fill="#B9A7FF" />
                <circle cx="229" cy="119" r="2.5" fill="#EAF4FF" />
              </g>

              {/* Spring-Rigged Side Hair Locks */}
              <path
                ref={leftLockRef}
                d="M118 136 C103 176, 100 226, 115 272 C125 244, 128 202, 128 156 Z"
                fill={`url(#hairMain-${uid})`}
                stroke="#EAF4FF"
                strokeOpacity="0.38"
                strokeWidth="1"
              />
              <path
                ref={rightLockRef}
                d="M242 136 C257 176, 260 226, 245 272 C235 244, 232 202, 232 156 Z"
                fill={`url(#hairMain-${uid})`}
                stroke="#EAF4FF"
                strokeOpacity="0.38"
                strokeWidth="1"
              />

              {/* Bouncy Anime Ahoge Strand */}
              <path
                ref={ahogeRef}
                d="M182 82 C175 50, 198 38, 214 54 C197 54, 188 66, 186 82 Z"
                fill="#EAF4FF"
                stroke="#83B9FF"
                strokeWidth="1.1"
              />
            </g>
          </g>
        </svg>
      </div>

      {/* Live Dialogue Readout */}
      <div className="relative z-10 space-y-3">
        <div className="rounded-lg border border-celestial-border/45 bg-celestial-canvas/65 px-3.5 py-2.5">
          <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-celestial-muted">
            <Terminal className="h-3.5 w-3.5 text-celestial-sky" strokeWidth={1.5} />
            <span>Operator Telemetry</span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-celestial-secondary">
            {statusText || meta.caption}
          </p>
        </div>

        {interactiveControls && onSelectState && (
          <div className="flex flex-wrap gap-1.5 pt-0.5" role="group" aria-label="Preview operator API expressions">
            {(['idle', 'loading', 'success', 'error', 'cancelled'] as OperatorApiState[]).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => onSelectState(st)}
                className={`rounded-md border px-2.5 py-1 font-mono text-[11px] uppercase tracking-wide transition-colors duration-150 ${
                  apiState === st
                    ? 'border-celestial-sky bg-celestial-sky/20 text-celestial-primary'
                    : 'border-celestial-border/45 bg-celestial-canvas/40 text-celestial-muted hover:border-celestial-sky/45 hover:text-celestial-primary'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

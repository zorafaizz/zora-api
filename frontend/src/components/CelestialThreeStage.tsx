import React, { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Line, Sparkles as DreiSparkles } from '@react-three/drei';
import * as THREE from 'three';
import { useCelestialTheme } from '../lib/theme';
import { useSmoothScroll } from '../lib/smooth-scroll';
import type { OperatorApiState } from '../lib/api-bridge';

interface CelestialCoreMeshProps {
  isDark: boolean;
  apiState: OperatorApiState;
  velocityRef: React.MutableRefObject<number>;
  progressRef: React.MutableRefObject<number>;
}

const CelestialCoreMesh: React.FC<CelestialCoreMeshProps> = ({
  isDark,
  apiState,
  velocityRef,
  progressRef,
}) => {
  const rootRef = useRef<THREE.Group>(null);
  const crystalRef = useRef<THREE.Mesh>(null);
  const wireShellRef = useRef<THREE.Mesh>(null);
  const ringOuterRef = useRef<THREE.Group>(null);
  const ringInnerRef = useRef<THREE.Group>(null);
  const constellationRef = useRef<THREE.Points>(null);

  const ringPointsOuter = useMemo(() => {
    const pts: [number, number, number][] = [];
    const segs = 96;
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      pts.push([Math.cos(a) * 2.35, Math.sin(a) * 2.35, 0]);
    }
    return pts;
  }, []);

  const ringPointsInner = useMemo(() => {
    const pts: [number, number, number][] = [];
    const segs = 80;
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      pts.push([Math.cos(a) * 1.72, 0, Math.sin(a) * 1.72]);
    }
    return pts;
  }, []);

  // Multi-hue celestial starfield buffer (Sky Blue + Lilac + Starlight — zero flat monochrome)
  const { positions, colors } = useMemo(() => {
    const count = 320;
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const cSky = new THREE.Color('#83B9FF');
    const cLilac = new THREE.Color('#B9A7FF');
    const cStar = new THREE.Color('#EAF4FF');
    const cCobalt = new THREE.Color('#2670E0');

    for (let i = 0; i < count; i++) {
      const r = 2.5 + Math.random() * 3.6;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      pos[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);

      const pick = i % 3 === 0 ? cLilac : i % 2 === 0 ? (isDark ? cSky : cCobalt) : cStar;
      col[i * 3] = pick.r;
      col[i * 3 + 1] = pick.g;
      col[i * 3 + 2] = pick.b;
    }
    return { positions: pos, colors: col };
  }, [isDark]);

  useFrame((state, rawDelta) => {
    const delta = Math.min(rawDelta, 0.08);
    const speedBoost =
      (apiState === 'loading' ? 3.2 : apiState === 'success' ? 1.8 : 1) +
      Math.min(2.5, Math.abs(velocityRef.current || 0) * 0.14);

    if (crystalRef.current) {
      crystalRef.current.rotation.y += delta * 0.52 * speedBoost;
      crystalRef.current.rotation.x += delta * 0.24 * speedBoost;
    }
    if (wireShellRef.current) {
      wireShellRef.current.rotation.y -= delta * 0.34 * speedBoost;
      wireShellRef.current.rotation.z += delta * 0.18;
    }
    if (ringOuterRef.current) {
      ringOuterRef.current.rotation.z += delta * 0.28 * speedBoost;
      ringOuterRef.current.rotation.x = 0.68 + Math.sin(state.clock.elapsedTime * 0.5) * 0.14;
    }
    if (ringInnerRef.current) {
      ringInnerRef.current.rotation.y -= delta * 0.44 * speedBoost;
      ringInnerRef.current.rotation.z = -0.42 + Math.cos(state.clock.elapsedTime * 0.6) * 0.12;
    }
    if (constellationRef.current) {
      constellationRef.current.rotation.y += delta * 0.06 * speedBoost;
    }
    if (rootRef.current) {
      const targetRotY = state.pointer.x * 0.42;
      const targetRotX = -state.pointer.y * 0.3 + (progressRef.current || 0) * 0.35;
      rootRef.current.rotation.y += (targetRotY - rootRef.current.rotation.y) * 0.07;
      rootRef.current.rotation.x += (targetRotX - rootRef.current.rotation.x) * 0.07;

      const responsiveScale = state.viewport.width < 5 ? 0.72 : 0.94;
      rootRef.current.scale.setScalar(responsiveScale);
    }
  });

  const coreEmissive =
    apiState === 'error'
      ? '#FB7185'
      : apiState === 'success'
        ? '#34D399'
        : isDark
          ? '#83B9FF'
          : '#3B82F6';

  return (
    <group ref={rootRef}>
      <Float speed={1.8} rotationIntensity={0.25} floatIntensity={0.45}>
        {/* Central Metallic Silver & Celestial Blue Relay Octahedron */}
        <mesh ref={crystalRef}>
          <octahedronGeometry args={[1.02, 0]} />
          <meshStandardMaterial
            color={isDark ? '#DCEBFF' : '#FFFFFF'}
            metalness={0.86}
            roughness={0.14}
            emissive={coreEmissive}
            emissiveIntensity={apiState === 'loading' ? 0.85 : isDark ? 0.42 : 0.24}
          />
        </mesh>

        {/* Outer Icosahedron Astral Cage */}
        <mesh ref={wireShellRef}>
          <icosahedronGeometry args={[1.42, 1]} />
          <meshStandardMaterial
            color={isDark ? '#B9A7FF' : '#334B70'}
            wireframe
            transparent
            opacity={isDark ? 0.45 : 0.32}
            emissive={isDark ? '#B9A7FF' : '#2670E0'}
            emissiveIntensity={0.4}
          />
        </mesh>
      </Float>

      {/* Tilted Astrolabe Orbit Rings */}
      <group ref={ringOuterRef}>
        <Line
          points={ringPointsOuter}
          color={isDark ? '#83B9FF' : '#2670E0'}
          lineWidth={1.4}
          transparent
          opacity={0.72}
        />
        <mesh position={[2.35, 0, 0]}>
          <sphereGeometry args={[0.075, 16, 16]} />
          <meshBasicMaterial color="#EAF4FF" />
        </mesh>
      </group>

      <group ref={ringInnerRef}>
        <Line
          points={ringPointsInner}
          color={isDark ? '#B9A7FF' : '#7054D8'}
          lineWidth={1.25}
          transparent
          opacity={0.68}
        />
        <mesh position={[0, 0, 1.72]}>
          <sphereGeometry args={[0.065, 16, 16]} />
          <meshBasicMaterial color="#B9A7FF" />
        </mesh>
      </group>

      {/* Multi-Color Constellation Point Cloud */}
      <points ref={constellationRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={positions.length / 3}
            array={positions}
            itemSize={3}
          />
          <bufferAttribute
            attach="attributes-color"
            count={colors.length / 3}
            array={colors}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.045}
          vertexColors
          transparent
          opacity={isDark ? 0.85 : 0.65}
          sizeAttenuation
        />
      </points>

      <DreiSparkles
        count={42}
        scale={4.8}
        size={2.1}
        speed={0.35}
        opacity={isDark ? 0.65 : 0.4}
        color={isDark ? '#EAF4FF' : '#2670E0'}
      />
    </group>
  );
};

function canUseWebGL(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl2') || canvas.getContext('webgl'))
    );
  } catch {
    return false;
  }
}

export const CelestialThreeStage: React.FC<{
  apiState?: OperatorApiState;
  className?: string;
}> = ({ apiState = 'idle', className = '' }) => {
  const { theme, reducedMotion } = useCelestialTheme();
  const { velocityRef, progressRef } = useSmoothScroll();
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [supported, setSupported] = useState(false);
  const [inView, setInView] = useState(true);
  const [tabVisible, setTabVisible] = useState(true);

  useEffect(() => {
    setSupported(canUseWebGL());
  }, []);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { threshold: 0.04 }
    );
    io.observe(el);

    const onVis = () => setTabVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, []);

  const isDark = theme === 'dark';
  const activeLoop = inView && tabVisible && !reducedMotion ? 'always' : 'demand';

  return (
    <div ref={wrapRef} className={`relative overflow-hidden ${className}`}>
      {supported ? (
        <Canvas
          dpr={[1, 1.5]}
          frameloop={activeLoop}
          camera={{ position: [0, 0, 5.4], fov: 44 }}
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        >
          <ambientLight intensity={isDark ? 0.75 : 1.25} />
          <directionalLight
            position={[4, 5, 4]}
            intensity={isDark ? 1.65 : 2.1}
            color={isDark ? '#83B9FF' : '#FFFFFF'}
          />
          <pointLight
            position={[-4, -3, 2]}
            intensity={1.25}
            color={isDark ? '#B9A7FF' : '#83B9FF'}
          />
          <Suspense fallback={null}>
            <CelestialCoreMesh
              isDark={isDark}
              apiState={apiState}
              velocityRef={velocityRef}
              progressRef={progressRef}
            />
          </Suspense>
        </Canvas>
      ) : (
        /* Graceful Non-WebGL / Headless SVG Astrolabe Fallback */
        <div className="flex h-full w-full items-center justify-center">
          <svg viewBox="0 0 240 240" className="h-56 w-56 opacity-85" aria-hidden="true">
            <circle cx="120" cy="120" r="92" fill="none" stroke="#83B9FF" strokeOpacity="0.45" strokeWidth="1.4" />
            <ellipse cx="120" cy="120" rx="84" ry="34" transform="rotate(-24 120 120)" fill="none" stroke="#B9A7FF" strokeOpacity="0.6" strokeWidth="1.4" />
            <polygon points="120,66 164,120 120,174 76,120" fill="#83B9FF" fillOpacity="0.18" stroke="#EAF4FF" strokeWidth="1.5" />
          </svg>
        </div>
      )}
    </div>
  );
};

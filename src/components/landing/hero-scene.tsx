"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import type { Group, Mesh } from "three";

// Editorial 3D: a slow drift of square "frames" that evoke film apertures
// without being literal about it. Colors read as cream/wine against the
// page. Restrained on purpose — this is a reading product, not a demo.
export function HeroScene() {
  // Defer mount until after hydration so SSR stays clean and the canvas
  // doesn't fight for main-thread time during first paint.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 -z-10 opacity-90"
    >
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 0, 6], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[4, 5, 3]} intensity={0.8} />
        <directionalLight
          position={[-3, -2, -1]}
          intensity={0.3}
          color="#6B1F2B"
        />
        <Frames />
      </Canvas>
    </div>
  );
}

function Frames() {
  const group = useRef<Group>(null);

  type Vec3 = [number, number, number];
  const frames = useMemo<
    Array<{ position: Vec3; rotation: Vec3; color: string; scale: number }>
  >(
    () => [
      { position: [-2.4, 0.6, 0], rotation: [0.1, 0.4, 0], color: "#E8DFCC", scale: 1.2 },
      { position: [1.8, -0.3, -1], rotation: [-0.05, -0.3, 0.1], color: "#C9BEA8", scale: 1.4 },
      { position: [0.3, 1.2, -2], rotation: [0.2, 0.1, -0.08], color: "#6B1F2B", scale: 0.9 },
      { position: [-0.8, -1.3, -0.5], rotation: [-0.15, 0.2, 0.05], color: "#F2EBDD", scale: 1.05 },
      { position: [2.6, 1.1, -1.5], rotation: [0.05, -0.5, -0.12], color: "#E8DFCC", scale: 0.75 },
    ],
    [],
  );

  useFrame((state) => {
    if (!group.current) return;
    const t = state.clock.elapsedTime;
    // Very slow drift so it feels like a camera breathing, not animating.
    group.current.rotation.y = Math.sin(t * 0.15) * 0.12;
    group.current.rotation.x = Math.cos(t * 0.1) * 0.05;
  });

  return (
    <group ref={group}>
      {frames.map((f, i) => (
        <Float
          key={i}
          speed={0.8 + i * 0.1}
          rotationIntensity={0.25}
          floatIntensity={0.5}
        >
          <Frame
            position={f.position}
            rotation={f.rotation}
            color={f.color}
            scale={f.scale}
          />
        </Float>
      ))}
    </group>
  );
}

function Frame({
  position,
  rotation,
  color,
  scale,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
  color: string;
  scale: number;
}) {
  const mesh = useRef<Mesh>(null);

  return (
    <mesh
      ref={mesh}
      position={position}
      rotation={rotation}
      scale={scale}
    >
      {/* Thin, wide box — reads as a film-frame when backlit. */}
      <boxGeometry args={[1.6, 2.2, 0.04]} />
      <meshStandardMaterial
        color={color}
        roughness={0.45}
        metalness={0.05}
      />
    </mesh>
  );
}

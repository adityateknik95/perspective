"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Float } from "@react-three/drei";
import type { Group, Mesh } from "three";

// Theme-aware palette for the r3f scene. Three.js doesn't see CSS variables,
// so we maintain a parallel hex set per theme and re-render the scene when
// the data-theme attribute on <html> flips.
//
// In light: cream + rule frames with one wine accent — the published mood.
// In dark: deeper cream-deep / rule shades + a lifted rose-wine, so the
// frames still read as film-frames behind a dark page rather than vanishing.
const LIGHT_PALETTE = {
  bg1: "#E8DFCC",
  bg2: "#C9BEA8",
  bg3: "#F2EBDD",
  accent: "#6B1F2B",
};
const DARK_PALETTE = {
  bg1: "#2E2820",
  bg2: "#473F37",
  bg3: "#241E18",
  accent: "#C66074",
};

type Palette = typeof LIGHT_PALETTE;

// Subscribe to <html data-theme> changes so the canvas swaps palettes when
// the user toggles. Read once at mount; the MutationObserver covers later
// flips without re-mounting the canvas.
function useThemePalette(): Palette {
  const [isDark, setIsDark] = useState(false);
  useEffect(() => {
    const html = document.documentElement;
    const sync = () => setIsDark(html.getAttribute("data-theme") === "dark");
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(html, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);
  return isDark ? DARK_PALETTE : LIGHT_PALETTE;
}

// Editorial 3D: a slow drift of square "frames" that evoke film apertures
// without being literal about it. Colors read as cream/wine against the
// page. Restrained on purpose — this is a reading product, not a demo.
export function HeroScene() {
  // Defer mount until after hydration so SSR stays clean and the canvas
  // doesn't fight for main-thread time during first paint.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const palette = useThemePalette();
  if (!mounted) return null;

  return (
    <div
      aria-hidden
      // Lower opacity + constrain to the right half so the frames sit behind
      // the negative space next to the headline rather than slicing through
      // it. On narrow viewports the mask collapses to full-width so the
      // composition still reads.
      className="pointer-events-none absolute inset-y-0 -z-10 right-0 w-full opacity-50 [mask-image:linear-gradient(to_right,transparent,black_30%,black)] md:left-1/3 md:w-2/3 md:opacity-60"
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
          color={palette.accent}
        />
        <Frames palette={palette} />
      </Canvas>
    </div>
  );
}

function Frames({ palette }: { palette: Palette }) {
  const group = useRef<Group>(null);

  type Vec3 = [number, number, number];
  const frames = useMemo<
    Array<{ position: Vec3; rotation: Vec3; color: string; scale: number }>
  >(
    // Repositioned to sit in the right half of the canvas (the canvas is
    // already masked to that side). The wine card moved deepest + smallest
    // so it stops competing with the headline; cream/rule cards drift in
    // front. Keep five — the negative space between them is the point.
    () => [
      { position: [0.4, 0.8, -0.2], rotation: [0.1, 0.4, 0], color: palette.bg1, scale: 1.15 },
      { position: [2.8, -0.4, -1], rotation: [-0.05, -0.3, 0.1], color: palette.bg2, scale: 1.3 },
      { position: [2.0, 1.6, -3.2], rotation: [0.2, 0.1, -0.08], color: palette.accent, scale: 0.7 },
      { position: [1.2, -1.4, -0.5], rotation: [-0.15, 0.2, 0.05], color: palette.bg3, scale: 1.0 },
      { position: [3.4, 1.0, -2.1], rotation: [0.05, -0.5, -0.12], color: palette.bg1, scale: 0.8 },
    ],
    [palette],
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

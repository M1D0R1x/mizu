"use client";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { lanternPositions } from "@/lib/world/builders";
import { world } from "@/lib/game/world";

const POOL = 5;

/** A handful of warm point lights that jump to whichever lanterns are nearest the player. */
export function LanternLights() {
  const lights = useMemo(() => Array.from({ length: POOL }, () => {
    const l = new THREE.PointLight(0xffb060, 0, 14, 2);
    l.castShadow = false;
    return l;
  }), []);
  const timer = useRef(0);
  const targets = useRef<THREE.Vector3[]>([]);
  useFrame(({ camera }, dt) => {
    timer.current -= dt;
    if (timer.current <= 0) {
      timer.current = 0.35;
      const c = camera.position;
      targets.current = lanternPositions
        .map((p) => ({ p, d: p.distanceToSquared(c) }))
        .sort((a, b) => a.d - b.d)
        .slice(0, POOL)
        .map((o) => o.p);
    }
    const glow = world.lanternGlow;
    lights.forEach((l, i) => {
      const t = targets.current[i];
      if (!t || glow < 0.02) { l.intensity = 0; return; }
      l.position.lerp(t, 1 - Math.exp(-dt * 6));
      const flicker = 0.9 + 0.1 * Math.sin(world.clock * 7 + i * 3) * Math.sin(world.clock * 3.3 + i);
      l.intensity = glow * 9 * flicker;
    });
  });
  return <>{lights.map((l, i) => <primitive key={i} object={l} />)}</>;
}

"use client";
import { useMemo } from "react";
import * as THREE from "three";
import { STREAM, streamCenterX, streamSurface, terrainHeight } from "@/lib/world/terrain";
import { createWaterMaterial } from "./Water";
import { bridge, mergeStatic, stoneLantern } from "@/lib/world/builders";

/** The forest stream: a ribbon of water following the carved channel, and two little bridges. */
export function Stream() {
  const { water, extras } = useMemo(() => {
    const positions: number[] = [], depths: number[] = [], indices: number[] = [];
    const step = 1.5, half = 3.4;
    let vi = 0;
    for (let z = STREAM.zStart - 8; z <= STREAM.zEnd; z += step) {
      const cx = streamCenterX(z), y = streamSurface(z);
      const dx = (streamCenterX(z + 0.5) - streamCenterX(z - 0.5)); // tangent
      const nx = 1 / Math.hypot(1, dx), nz = -dx / Math.hypot(1, dx);
      for (const s of [-1, -0.5, 0, 0.5, 1]) {
        positions.push(cx + nx * s * half, y, z + nz * s * half);
        depths.push(Math.max(0, 0.9 - Math.abs(s) * 0.95));
      }
      if (vi > 0) {
        const a = vi - 5, b = vi;
        for (let k = 0; k < 4; k++) indices.push(a + k, b + k, a + k + 1, a + k + 1, b + k, b + k + 1);
      }
      vi += 5;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("aDepth", new THREE.Float32BufferAttribute(depths, 1));
    geo.setIndex(indices);
    const water = new THREE.Mesh(geo, createWaterMaterial({ shallow: 0x5f8f80, deep: 0x2a4a50, scale: 3.5, flow: 2.6 }));
    water.renderOrder = 2; water.frustumCulled = false;
    const extras = new THREE.Group();
    for (const z of [196, 262]) {
      const cx = streamCenterX(z);
      const x1 = cx - 5.2, x2 = cx + 5.2;
      extras.add(bridge(x1, terrainHeight(x1, z) + 0.1, z, x2, terrainHeight(x2, z) + 0.1, z, 2.0, 0.8));
      extras.add(stoneLantern(x1 - 1.4, terrainHeight(x1 - 1.4, z + 1.8), z + 1.8, 0.8));
    }
    return { water, extras: mergeStatic(extras) };
  }, []);
  return (
    <>
      <primitive object={water} />
      <primitive object={extras} />
    </>
  );
}

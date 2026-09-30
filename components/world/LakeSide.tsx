"use client";
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { LAKE, LOOKOUT, terrainHeight, WATER_LEVEL } from "@/lib/world/terrain";
import { bench, boat, box, cyl, paperLantern, stoneLantern, torii , mergeStatic } from "@/lib/world/builders";
import { mats } from "@/lib/game/materials";
import { addInteractable } from "@/lib/game/interactables";
import { sit } from "@/lib/game/actions";
import { world } from "@/lib/game/world";
import { audio } from "@/lib/game/audio";
import { addCollider } from "@/lib/game/colliders";

/** Marches from the lake centre outward along `angle` until land is found. */
export function shorePoint(angle: number, height = 0.25) {
  const dx = Math.cos(angle), dz = Math.sin(angle);
  for (let r = 30; r < 140; r += 0.5) {
    const x = LAKE.x + dx * r, z = LAKE.z + dz * r;
    if (terrainHeight(x, z) > height) return { x, z, dx, dz, r };
  }
  return { x: LAKE.x + dx * 100, z: LAKE.z + dz * 100, dx, dz, r: 100 };
}

export const DOCK_ANGLE = Math.atan2(62 - LAKE.z, -62 - LAKE.x); // toward the village path end
export const DOCK = (() => {
  const s = shorePoint(DOCK_ANGLE, 0.6);
  return { ...s, length: 16, endX: s.x - s.dx * 16, endZ: s.z - s.dz * 16 };
})();
export const LAKE_TORII = (() => { const s = shorePoint(-Math.PI / 2 + 0.25, 0.2); return { x: s.x - s.dx * 9, z: s.z - s.dz * 9, ry: -Math.PI / 2 + 0.25 + Math.PI / 2 }; })();

export function LakeSide() {
  const boats = useRef<THREE.Group[]>([]);
  const group = useMemo(() => {
    const g = new THREE.Group();
    const m = mats();
    // ---- dock ----
    const d = DOCK, ang = Math.atan2(-d.dx, -d.dz);
    const n = Math.ceil(d.length / 0.34);
    const planks = new THREE.InstancedMesh(new THREE.BoxGeometry(2.6, 0.08, 0.3), m.weatheredWood, n);
    const tm = new THREE.Matrix4(), q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ang, 0));
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      tm.compose(new THREE.Vector3(d.x - d.dx * t * d.length, WATER_LEVEL + 0.62, d.z - d.dz * t * d.length), q, new THREE.Vector3(1, 1, 1));
      planks.setMatrixAt(i, tm);
    }
    planks.castShadow = true; planks.receiveShadow = true;
    g.add(planks);
    for (let i = 0; i <= 5; i++) {
      const t = i / 5;
      for (const s of [-1, 1]) {
        const px = d.x - d.dx * t * d.length + Math.cos(ang) * s * 1.2, pz = d.z - d.dz * t * d.length - Math.sin(ang) * s * 1.2;
        g.add(cyl(0.11, 0.13, 3.2, m.darkWood, px, WATER_LEVEL - 0.6, pz, 7));
      }
    }
    for (const s of [-1, 1]) g.add(box(0.06, 0.06, d.length, m.darkWood, d.x - d.dx * d.length / 2 + Math.cos(ang) * s * 1.25, WATER_LEVEL + 1.3, d.z - d.dz * d.length / 2 - Math.sin(ang) * s * 1.25, ang, false));
    // lantern post at the end of the dock
    g.add(cyl(0.07, 0.09, 2.6, m.darkWood, d.endX + Math.cos(ang) * 1.1, WATER_LEVEL + 1.9, d.endZ - Math.sin(ang) * 1.1, 6));
    g.add(paperLantern(d.endX + Math.cos(ang) * 1.1, WATER_LEVEL + 3.35, d.endZ - Math.sin(ang) * 1.1, false, 1.15));
    g.add(bench(d.endX + d.dx * 1.6 - Math.cos(ang) * 0.6, WATER_LEVEL + 0.66, d.endZ + d.dz * 1.6 + Math.sin(ang) * 0.6, ang + Math.PI));
    // boats
    const b1 = boat(d.endX + Math.cos(ang) * 2.6, WATER_LEVEL, d.endZ - Math.sin(ang) * 2.6, ang + 0.15);
    const b2 = boat(d.endX - Math.cos(ang) * 3.0 + d.dx * 3, WATER_LEVEL, d.endZ + Math.sin(ang) * 3.0 + d.dz * 3, ang - 0.4);
    const s3 = shorePoint(Math.PI * 0.35, 0.15);
    const b3 = boat(s3.x - s3.dx * 1.5, terrainHeight(s3.x - s3.dx * 1.5, s3.z - s3.dz * 1.5) + 0.2, s3.z - s3.dz * 1.5, Math.atan2(s3.dx, s3.dz) + 0.5);
    b1.userData.dynamic = true; b2.userData.dynamic = true;
    g.add(b1, b2, b3);
    boats.current = [b1, b2];
    // ---- the torii standing in the water ----
    g.add(torii(LAKE_TORII.x, WATER_LEVEL - 0.3, LAKE_TORII.z, LAKE_TORII.ry, 1.6));
    addCollider(LAKE_TORII.x, LAKE_TORII.z, 2.4);
    // ---- lookout hill bench + lanterns ----
    const ly = terrainHeight(LOOKOUT.x + 6, LOOKOUT.z);
    g.add(bench(LOOKOUT.x + 6, ly, LOOKOUT.z, -Math.PI / 2));
    g.add(stoneLantern(LOOKOUT.x + 8, terrainHeight(LOOKOUT.x + 8, LOOKOUT.z - 3), LOOKOUT.z - 3, 0.9));
    // small shrine stones near the shore path
    const s4 = shorePoint(Math.PI * 1.35, 1.2);
    g.add(stoneLantern(s4.x, terrainHeight(s4.x, s4.z), s4.z, 0.85));
    return mergeStatic(g);
  }, []);

  useEffect(() => {
    const d = DOCK, ang = Math.atan2(-d.dx, -d.dz);
    const offs = [
      addInteractable({ x: d.endX + d.dx * 1.6, y: WATER_LEVEL + 0.6, z: d.endZ + d.dz * 1.6, radius: 2.3, label: "SIT", action: () => { sit(d.endX + d.dx * 1.6 - Math.cos(ang) * 0.6, d.endZ + d.dz * 1.6 + Math.sin(ang) * 0.6, ang + Math.PI); world.player.pos.y = WATER_LEVEL + 0.62; } }),
      addInteractable({ x: d.endX, y: WATER_LEVEL + 0.6, z: d.endZ, radius: 2.4, label: "FEED THE FISH", action: () => { audio.splash(); world.fishFedAt = world.clock; } }),
      addInteractable({ x: LOOKOUT.x + 6, y: terrainHeight(LOOKOUT.x + 6, LOOKOUT.z), z: LOOKOUT.z, radius: 2.4, label: "SIT", action: () => sit(LOOKOUT.x + 6, LOOKOUT.z, -Math.PI / 2) }),
    ];
    return () => offs.forEach((f) => f());
  }, []);

  useFrame(() => {
    const t = world.clock;
    boats.current.forEach((b, i) => {
      b.position.y = WATER_LEVEL + Math.sin(t * 0.8 + i * 2) * 0.04 * (0.5 + world.windStrength);
      b.rotation.z = Math.sin(t * 0.6 + i) * 0.02 * (0.5 + world.windStrength);
      b.rotation.x = Math.cos(t * 0.5 + i * 1.7) * 0.015;
    });
  });

  return <primitive object={group} />;
}

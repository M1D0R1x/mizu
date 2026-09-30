"use client";
import { useMemo } from "react";
import * as THREE from "three";
import { TERRACES, terraceLevel, terraceMask, terrainHeight } from "@/lib/world/terrain";
import { createWaterMaterial } from "./Water";
import { withWind, mats } from "@/lib/game/materials";
import { mulberry32 } from "@/lib/world/noise";
import { box, cyl, mergeStatic } from "@/lib/world/builders";
import { QUALITY, useGame } from "@/store/gameStore";

/** Flooded paddies stepping up the eastern slope, each one a mirror for the sky. */
export function RiceTerraces() {
  const quality = useGame((s) => s.settings.quality);
  const q = QUALITY[quality];
  const { water, crops, extras } = useMemo(() => {
    const cell = 1;
    const positions: number[] = [], depths: number[] = [], indices: number[] = [];
    const cropPos: { x: number; z: number; y: number }[] = [];
    const rng = mulberry32(99);
    let vi = 0;
    for (let x = TERRACES.x0; x < TERRACES.x1; x += cell) {
      for (let z = TERRACES.z0; z < TERRACES.z1; z += cell) {
        const m = terraceMask(x + 0.5, z + 0.5);
        if (m < 0.92) continue;
        const l = terraceLevel(x + 0.5, z + 0.5);
        const corners = [terraceLevel(x, z), terraceLevel(x + cell, z), terraceLevel(x, z + cell), terraceLevel(x + cell, z + cell)];
        if (corners.some((c) => Math.abs(c - l) > 0.01)) continue;
        const y = l + 0.16;
        positions.push(x, y, z, x + cell, y, z, x, y, z + cell, x + cell, y, z + cell);
        depths.push(0.35, 0.35, 0.35, 0.35);
        indices.push(vi, vi + 2, vi + 1, vi + 1, vi + 2, vi + 3);
        vi += 4;
        // rows of rice
        if (rng() < 0.85) for (const [ox, oz] of [[0.3, 0.3], [0.7, 0.7]]) if (rng() < 0.8) cropPos.push({ x: x + ox, z: z + oz, y });
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute("aDepth", new THREE.Float32BufferAttribute(depths, 1));
    geo.setIndex(indices);
    const water = new THREE.Mesh(geo, createWaterMaterial({ shallow: 0x6f7a55, deep: 0x4a5a45, scale: 2.2, flow: 0.6 }));
    water.renderOrder = 2; water.frustumCulled = false;

    // crops: crossed blades
    const blade = new THREE.PlaneGeometry(0.14, 0.55, 1, 2); blade.translate(0, 0.27, 0);
    const blade2 = blade.clone(); blade2.rotateY(Math.PI / 2);
    const merged = new THREE.BufferGeometry();
    const p1 = blade.attributes.position, p2 = blade2.attributes.position;
    const pos = new Float32Array((p1.count + p2.count) * 3);
    pos.set(p1.array as Float32Array, 0); pos.set(p2.array as Float32Array, p1.count * 3);
    merged.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const uv1 = blade.attributes.uv, uv2 = blade2.attributes.uv;
    const uvs = new Float32Array((uv1.count + uv2.count) * 2); uvs.set(uv1.array as Float32Array, 0); uvs.set(uv2.array as Float32Array, uv1.count * 2);
    merged.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
    const idx: number[] = [];
    for (let i = 0; i < blade.index!.count; i++) idx.push(blade.index!.getX(i));
    for (let i = 0; i < blade2.index!.count; i++) idx.push(blade2.index!.getX(i) + p1.count);
    merged.setIndex(idx);
    merged.computeVertexNormals();
    const cropMat = withWind(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, side: THREE.DoubleSide }), { heightScale: 1.6, amount: 0.5 });
    const keep = cropPos.filter(() => rng() < 0.45 + 0.55 * q.grass);
    const crops = new THREE.InstancedMesh(merged, cropMat, Math.max(1, keep.length));
    const tm = new THREE.Matrix4(), c = new THREE.Color();
    keep.forEach((p, i) => {
      const s = 0.8 + rng() * 0.5;
      tm.makeRotationY(rng() * Math.PI).scale(new THREE.Vector3(s, s, s)).setPosition(p.x, p.y - 0.05, p.z);
      crops.setMatrixAt(i, tm);
      crops.setColorAt(i, c.setHSL(0.21 + rng() * 0.05, 0.42, 0.34 + rng() * 0.1, THREE.SRGBColorSpace));
    });
    crops.frustumCulled = false; crops.castShadow = false; crops.receiveShadow = true;

    // extras: irrigation channels, a hut, a scarecrow
    const extras = new THREE.Group();
    const m = mats();
    for (let i = 0; i < 6; i++) {
      const x = TERRACES.x0 + 14 + i * 18, z = -10 + i * 14;
      const y = terrainHeight(x, z);
      const pipe = cyl(0.12, 0.12, 3.2, m.wood, x, y + 1.2, z, 7); pipe.rotation.z = 0.9; extras.add(pipe);
      extras.add(cyl(0.15, 0.15, 1.3, m.darkWood, x + 1.1, y + 0.6, z, 6));
    }
    const hx = TERRACES.x0 + 8, hz = 60, hy = terrainHeight(hx, hz);
    extras.add(box(3, 2.2, 3, m.weatheredWood, hx, hy + 1.1, hz));
    const hr = new THREE.Mesh(new THREE.ConeGeometry(2.8, 1.6, 4), m.thatch); hr.position.set(hx, hy + 3.0, hz); hr.rotation.y = Math.PI / 4; hr.castShadow = true; extras.add(hr);
    const sx = TERRACES.x0 + 40, sz = 20, sy = terraceLevel(sx, sz) + 0.16;
    extras.add(cyl(0.05, 0.05, 2.0, m.wood, sx, sy + 1, sz, 5), box(1.2, 0.05, 0.05, m.wood, sx, sy + 1.6, sz), box(0.7, 0.9, 0.2, m.clothBlue, sx, sy + 1.3, sz, 0.2, false));
    const hat = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.25, 8), m.thatch); hat.position.set(sx, sy + 2.05, sz); extras.add(hat);
    return { water, crops, extras: mergeStatic(extras) };
  }, [q.grass]);
  return (
    <>
      <primitive object={water} />
      <primitive object={crops} />
      <primitive object={extras} />
    </>
  );
}

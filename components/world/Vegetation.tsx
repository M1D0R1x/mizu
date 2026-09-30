"use client";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { makeCardCanopy, makeConifer, makeRock, makeTrunk } from "@/lib/world/treeGeometry";
import { disc, notBamboo, rect, ring, scatter, standardAccept, type Placed } from "@/lib/world/placement";
import { LOOKOUT, MAPLE_GROVE, SAKURA, SHRINE, VILLAGE, LAKE, lakeDist, terrainHeight, slopeAt, streamDist, WATER_LEVEL } from "@/lib/world/terrain";
import { mats, withWind } from "@/lib/game/materials";
import { mulberry32 } from "@/lib/world/noise";
import { useGame, QUALITY } from "@/store/gameStore";
import { tex } from "@/lib/game/textures";

const tmpM = new THREE.Matrix4(), tmpP = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpC = new THREE.Color();

/** Builds an InstancedMesh from placements. */
export function instanced(geo: THREE.BufferGeometry, mat: THREE.Material, items: Placed[], opts: { color?: (p: Placed, c: THREE.Color) => void; shadow?: boolean; yScale?: (p: Placed) => number; tilt?: number } = {}) {
  const mesh = new THREE.InstancedMesh(geo, mat, Math.max(items.length, 1));
  const rng = mulberry32(items.length * 17 + 3);
  items.forEach((p, i) => {
    tmpP.set(p.x, p.y, p.z);
    tmpQ.setFromEuler(new THREE.Euler((rng() - 0.5) * (opts.tilt ?? 0), p.rot, (rng() - 0.5) * (opts.tilt ?? 0)));
    const ys = opts.yScale ? opts.yScale(p) : p.scale;
    tmpS.set(p.scale, ys, p.scale);
    tmpM.compose(tmpP, tmpQ, tmpS);
    mesh.setMatrixAt(i, tmpM);
    if (opts.color) { opts.color(p, tmpC); mesh.setColorAt(i, tmpC); }
  });
  if (items.length === 0) mesh.count = 0;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  mesh.castShadow = opts.shadow ?? true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  return mesh;
}

type TreeKind = "sakura" | "maple" | "broadleaf";

function leafyTree(kind: TreeKind, seed: number) {
  const size = kind === "sakura" ? { height: 6.8, radius: 0.3, branches: 5, spread: 0.95 } : kind === "maple" ? { height: 6.2, radius: 0.26, branches: 5, spread: 0.85 } : { height: 8, radius: 0.34, branches: 4, spread: 0.7 };
  const t = makeTrunk(seed, size);
  const canopy = makeCardCanopy(seed, [...t.tips, t.top], { radius: kind === "broadleaf" ? 2.4 : 2.1, cards: kind === "broadleaf" ? 54 : 48, size: kind === "broadleaf" ? [1.7, 2.6] : [1.5, 2.3], flatten: 0.7 });
  return { trunk: t.geo, canopy };
}

export function Trees() {
  const quality = useGame((s) => s.settings.quality);
  const q = QUALITY[quality];
  const group = useMemo(() => {
    const g = new THREE.Group();
    const m = mats();
    const coniferAlpha = tex.canopy().clone(); coniferAlpha.repeat.set(3, 3); coniferAlpha.needsUpdate = true;
    const cardMat = (alpha: THREE.Texture, emissive = 0x000000, ei = 0) => withWind(new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.9, alphaMap: alpha, alphaTest: 0.5, side: THREE.DoubleSide, emissive, emissiveIntensity: ei }), { heightScale: 0, base: 0.22, amount: 0.55 });
    const sakuraMat = cardMat(tex.blossoms(), 0xff9ab0, 0.05), mapleMat = cardMat(tex.leaves(), 0xff5a20, 0.04), leafMat = cardMat(tex.leaves());
    const coniferMat = withWind(new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.92, alphaMap: coniferAlpha, alphaTest: 0.16, side: THREE.DoubleSide, flatShading: true }), { heightScale: 0, base: 0.22, amount: 0.55 });

    // ---- placements ----
    const accept = (x: number, z: number, h: number) => standardAccept(x, z, h) && notBamboo(x, z);
    const sakura: Placed[] = [
      ...scatter(11, 190, disc(SAKURA.x, SAKURA.z, 66, 0.8), accept, { minDist: 4.2, scale: [0.8, 1.25] }),
      ...scatter(12, 34, disc(LOOKOUT.x, LOOKOUT.z, 30, 0.9), accept, { minDist: 4.5, scale: [0.9, 1.3] }),
      ...scatter(13, 40, ring(LAKE.x, LAKE.z, 96, 122, Math.PI * 1.05, Math.PI * 1.95), accept, { minDist: 5, scale: [0.85, 1.2] }),
      ...scatter(14, 22, ring(VILLAGE.x, VILLAGE.z, VILLAGE.radius - 2, VILLAGE.radius + 22), accept, { minDist: 6 }),
      ...scatter(15, 18, ring(LAKE.x, LAKE.z, 98, 130, Math.PI * 0.05, Math.PI * 0.6), accept, { minDist: 6 }),
    ];
    const maple = scatter(21, 48, disc(MAPLE_GROVE.x, MAPLE_GROVE.z, MAPLE_GROVE.radius, 0.85), accept, { minDist: 4, scale: [0.8, 1.2] });
    const broadleaf = [
      ...scatter(31, 40, ring(LAKE.x, LAKE.z, 100, 150), accept, { minDist: 8, scale: [0.8, 1.3] }),
      ...scatter(32, 40, rect(-40, 170, 110, 330), (x, z, h) => accept(x, z, h) && streamDist(x, z) > 6, { minDist: 8, scale: [0.8, 1.3] }),
      ...scatter(33, 16, ring(VILLAGE.x, VILLAGE.z, VILLAGE.radius + 10, VILLAGE.radius + 40), accept, { minDist: 8 }),
    ];
    const pineAccept = (x: number, z: number, h: number) => accept(x, z, h) && h < 105;
    const pines = [
      ...scatter(41, 460, ring(0, 0, 215, 345), pineAccept, { minDist: 5.5, scale: [0.75, 1.35] }),
      ...scatter(42, 110, disc(-80, 260, 75), pineAccept, { minDist: 6, scale: [0.8, 1.3] }),
      ...scatter(43, 90, disc(125, 245, 65), pineAccept, { minDist: 6, scale: [0.8, 1.3] }),
      ...scatter(44, 70, disc(-110, -220, 70), pineAccept, { minDist: 6, scale: [0.8, 1.3] }),
      ...scatter(45, 70, disc(120, -200, 70), pineAccept, { minDist: 6, scale: [0.8, 1.3] }),
    ];
    const cedars = [
      ...scatter(51, 46, ring(SHRINE.x, SHRINE.z, SHRINE.platformRadius + 8, 60), (x, z, h) => standardAccept(x, z, h, 0.6) && Math.abs(x) > 9, { minDist: 7, scale: [0.9, 1.4] }),
      ...scatter(52, 30, rect(-40, -262, 40, -212), (x, z, h) => standardAccept(x, z, h, 0.6) && Math.abs(x) > 10, { minDist: 6, scale: [0.9, 1.3] }),
    ];

    // ---- geometry variants ----
    const addLeafy = (kind: TreeKind, items: Placed[], trunkMat: THREE.Material, leafM: THREE.Material, color: (p: Placed, c: THREE.Color) => void) => {
      for (let v = 0; v < 3; v++) {
        const sub = items.filter((p) => p.variant === v);
        if (!sub.length) continue;
        const tg = leafyTree(kind, 100 + v * 7 + (kind === "sakura" ? 0 : kind === "maple" ? 30 : 60));
        g.add(instanced(tg.trunk, trunkMat, sub, { shadow: true }));
        g.add(instanced(tg.canopy, leafM, sub, { color, shadow: true }));
      }
    };
    addLeafy("sakura", sakura, m.trunkSakura, sakuraMat, (p, c) => c.setHSL(0.93 + p.tint * 0.04, 0.5 + p.tint * 0.2, 0.86 + (1 - p.tint) * 0.08, THREE.SRGBColorSpace));
    addLeafy("maple", maple, m.bark, mapleMat, (p, c) => c.setHSL(0.02 + p.tint * 0.07, 0.8, 0.5 + p.tint * 0.12, THREE.SRGBColorSpace));
    addLeafy("broadleaf", broadleaf, m.bark, leafMat, (p, c) => c.setHSL(0.22 + p.tint * 0.07, 0.36, 0.36 + p.tint * 0.1, THREE.SRGBColorSpace));

    for (let v = 0; v < 3; v++) {
      const sub = pines.filter((p) => p.variant === v);
      const c = makeConifer(200 + v, { height: 13 + v * 1.5, tiers: 5 + v, width: 3.2 });
      g.add(instanced(c.geo, coniferMat, sub, { color: (p, col) => col.setHSL(0.3 + p.tint * 0.06, 0.38, 0.3 + p.tint * 0.1, THREE.SRGBColorSpace), shadow: true }));
      g.add(instanced(c.trunk, m.bark, sub, { shadow: false }));
      const sub2 = cedars.filter((p) => p.variant === v);
      const cd = makeConifer(300 + v, { height: 22 + v * 2, tiers: 8, width: 3.4 });
      g.add(instanced(cd.geo, coniferMat, sub2, { color: (p, col) => col.setHSL(0.28 + p.tint * 0.04, 0.32, 0.27 + p.tint * 0.07, THREE.SRGBColorSpace), shadow: true }));
      g.add(instanced(cd.trunk, m.bark, sub2, { shadow: false }));
    }
    return g;
  }, []);
  useEffect(() => {
    group.traverse((o) => { if ((o as THREE.Mesh).isMesh) (o as THREE.Mesh).castShadow = q.shadows; });
  }, [group, q.shadows]);
  return <primitive object={group} />;
}

export function Rocks() {
  const group = useMemo(() => {
    const g = new THREE.Group();
    const m = mats();
    const acceptRock = (x: number, z: number, h: number) => h > WATER_LEVEL - 0.5 && h < 140 && slopeAt(x, z) < 0.7 && Math.hypot(x - VILLAGE.x, z - VILLAGE.z) > VILLAGE.radius;
    const items = [
      ...scatter(61, 90, ring(LAKE.x, LAKE.z, 84, 112), (x, z, h) => acceptRock(x, z, h) && lakeDist(x, z) > 84, { minDist: 4, scale: [0.4, 1.4], sink: 0.35 }),
      ...scatter(62, 120, ring(0, 0, 200, 340), acceptRock, { minDist: 5, scale: [0.6, 2.4], sink: 0.5 }),
      ...scatter(63, 70, rect(0, 100, 70, 360), (x, z, h) => acceptRock(x, z, h) && streamDist(x, z) < 7 && streamDist(x, z) > 1.5, { minDist: 2, scale: [0.3, 0.9], sink: 0.25 }),
      ...scatter(64, 50, disc(SAKURA.x, SAKURA.z, 70), acceptRock, { minDist: 6, scale: [0.4, 1.1], sink: 0.3 }),
      ...scatter(65, 30, disc(SHRINE.x, SHRINE.z + 30, 50), (x, z, h) => acceptRock(x, z, h) && Math.abs(x) > 13, { minDist: 5, scale: [0.5, 1.6], sink: 0.4 }),
    ];
    for (let v = 0; v < 3; v++) {
      const sub = items.filter((p) => p.variant === v);
      const geo = makeRock(v + 1);
      const rockMat = (v === 1 ? m.mossyStone : m.rock).clone(); rockMat.color.set(0xffffff);
      g.add(instanced(geo, rockMat, sub, { shadow: v !== 2, tilt: 0.5, color: (p, c) => (v === 1 ? c.setHSL(0.24, 0.25, 0.5 + p.tint * 0.15, THREE.SRGBColorSpace) : c.setHSL(0.1, 0.04, 0.68 + p.tint * 0.18, THREE.SRGBColorSpace)) }));
    }
    return g;
  }, []);
  return <primitive object={group} />;
}

export { terrainHeight };

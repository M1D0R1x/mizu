"use client";
import { useMemo } from "react";
import * as THREE from "three";
import { box, cyl, roof, sphere, stoneLantern, mergeStatic } from "@/lib/world/builders";
import { mats } from "@/lib/game/materials";
import { mulberry32, range } from "@/lib/world/noise";
import { terrainHeight } from "@/lib/world/terrain";

import { subSeed } from "@/lib/world/seed";

interface OutpostSpec {
  x: number; z: number;
  seed: number;
  variant: "watermill" | "wall" | "hut" | "shrine_ruin" | "guardhouse";
}

function getOutposts(): OutpostSpec[] {
  const rSeed = subSeed("ruins");
  const rng = mulberry32(rSeed);
  const wobble = (amt = 16) => (rng() - 0.5) * amt;
  return [
    { x: -80 + wobble(),  z: -210 + wobble(), seed: rSeed + 1, variant: "wall" },
    { x:  60 + wobble(),  z: -220 + wobble(), seed: rSeed + 2, variant: "shrine_ruin" },
    { x: 200 + wobble(),  z:  180 + wobble(), seed: rSeed + 3, variant: "hut" },
    { x: -180 + wobble(), z:  210 + wobble(), seed: rSeed + 4, variant: "guardhouse" },
    { x:  10 + wobble(),  z:  300 + wobble(), seed: rSeed + 5, variant: "watermill" },
  ];
}

function buildOutpost(spec: OutpostSpec, g: THREE.Group) {
  const m = mats();
  const rng = mulberry32(spec.seed);
  const bx = spec.x, bz = spec.z;
  const by = terrainHeight(bx, bz);

  if (spec.variant === "wall") {
    // Crumbling stone wall section with moss, broken gap in the middle
    const wallH = 2.4 + rng() * 0.8;
    const wallL = 12 + rng() * 8;
    for (let i = 0; i < 3; i++) {
      const wx = bx - wallL / 2 + i * (wallL / 2) + (rng() - 0.5) * 1.2;
      const wh = i === 1 ? wallH * (0.35 + rng() * 0.3) : wallH; // broken middle
      const wy = by + wh / 2;
      g.add(box(wallL / 3 - 0.4, wh, 0.7 + rng() * 0.4, m.darkStone, wx, wy, bz, (rng() - 0.5) * 0.06));
    }
    // overgrown mossy patches (small spheres)
    for (let i = 0; i < 4; i++) {
      const mx = bx + (rng() - 0.5) * wallL;
      const mz = bz + (rng() - 0.5) * 1.5;
      g.add(sphere(0.3 + rng() * 0.25, m.mossyStone, mx, terrainHeight(mx, mz) + 0.1, mz, 1 + rng() * 0.5, 0.6, 1 + rng() * 0.5, false));
    }
    // toppled stone lantern
    const lx = bx + (rng() - 0.5) * 4, lz = bz + range(rng, 1.5, 3);
    const tipped = stoneLantern(lx, terrainHeight(lx, lz), lz, 0.7);
    tipped.rotation.z = 0.9 + rng() * 0.5;
    tipped.rotation.y = rng() * Math.PI;
    g.add(tipped);

  } else if (spec.variant === "shrine_ruin") {
    // Partial torii — one post standing, one fallen; broken stone steps
    const postH = 3.6 + rng() * 1.2;
    // standing post
    g.add(cyl(0.18, 0.22, postH, m.vermilion, bx - 1.6, by + postH / 2, bz, 10));
    // fallen post (lying on the ground)
    const fallen = cyl(0.18, 0.22, postH, m.vermilion, bx + 1.6 + postH / 2 * Math.cos(1.5), by + 0.18 * Math.sin(1.5), bz, 10);
    fallen.rotation.z = 1.5;
    g.add(fallen);
    // broken crossbeam fragment
    g.add(box(2.2, 0.22, 0.38, m.black, bx - 0.5, by + postH - 0.3, bz));
    // cracked stone platform remnant
    g.add(box(5 + rng() * 2, 0.2, 4 + rng() * 1.5, m.cobble, bx, by + 0.1, bz + 2));
    // moss on the stones
    for (let i = 0; i < 3; i++) {
      const mx = bx + (rng() - 0.5) * 4, mz = bz + 2 + (rng() - 0.5) * 2;
      g.add(sphere(0.22 + rng() * 0.18, m.mossyStone, mx, by + 0.25, mz, 1.5, 0.5, 1.2, false));
    }

  } else if (spec.variant === "hut") {
    // Collapsed mountain hut — three walls standing, roof partially caved
    const w = 4 + rng() * 2, d = 3.5 + rng() * 1.5, h = 2.4 + rng() * 0.6;
    g.add(box(0.35, h, d, m.weatheredWood, bx - w / 2, by + h / 2, bz));
    g.add(box(0.35, h * (0.4 + rng() * 0.3), d, m.weatheredWood, bx + w / 2, by + h / 2 * 0.4, bz));
    g.add(box(w, h * 0.15, 0.35, m.weatheredWood, bx, by + h, bz - d / 2));
    // collapsed roof planks
    for (let i = 0; i < 5; i++) {
      const plank = box(w + 0.6, 0.08, 0.4, m.weatheredWood, bx + (rng() - 0.5) * 0.5, by + h * 0.15 + i * (0.09 + rng() * 0.04), bz + (rng() - 0.5) * d * 0.6, rng() * 0.4);
      g.add(plank);
    }
    // stone base
    g.add(box(w + 0.6, 0.3, d + 0.6, m.stone, bx, by + 0.15, bz));

  } else if (spec.variant === "guardhouse") {
    // Small guardhouse, partially intact with a caved-in section
    const gw = 3.5 + rng() * 1.5, gd = 3.5 + rng() * 1, gh = 2.8;
    g.add(box(gw, 0.4, gd, m.stone, bx, by + 0.2, bz));
    g.add(box(gw, gh, gd, m.plaster, bx, by + 0.4 + gh / 2, bz));
    // broken wall on one side
    g.add(box(gw, gh * (0.3 + rng() * 0.4), 0.4, m.stone, bx, by + gh * 0.2, bz + gd / 2));
    // roof – only one slope survived
    const survivingRoof = roof({ width: gw, depth: gd * 0.6, rise: 1.1, overhang: 0.8, curve: 0.25, x: bx, y: by + 0.4 + gh, z: bz - gd * 0.2, mat: m.roofDark });
    g.add(survivingRoof);
    g.add(stoneLantern(bx + gw / 2 + 0.5, by, bz, 0.7));

  } else if (spec.variant === "watermill") {
    // Watermill ruin on the stream bank
    const mw = 5, md = 4, mh = 3.5;
    g.add(box(mw, 0.4, md, m.stone, bx, by + 0.2, bz));
    g.add(box(mw, mh, md, m.weatheredWood, bx, by + 0.4 + mh / 2, bz));
    g.add(roof({ width: mw, depth: md, rise: 1.8, overhang: 1.0, curve: 0.2, x: bx, y: by + 0.4 + mh, z: bz, mat: m.thatch }));
    // wheel — a torus, partially buried
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(1.8, 0.18, 6, 18), m.weatheredWood);
    wheel.rotation.y = Math.PI / 2;
    wheel.position.set(bx - mw / 2 - 0.1, by + 1.2, bz);
    wheel.castShadow = true;
    g.add(wheel);
    // broken paddles
    for (let i = 0; i < 5; i++) {
      const a = (i / 6) * Math.PI * 2;
      const px = bx - mw / 2 - 0.1, py = by + 1.2 + Math.sin(a) * 1.8, pz = bz + Math.cos(a) * 1.8;
      if (rng() > 0.35) g.add(box(0.1, 0.8, 0.22, m.weatheredWood, px, py, pz, a));
    }
    // moss on the base
    for (let i = 0; i < 3; i++) {
      const mx = bx + (rng() - 0.5) * mw;
      g.add(sphere(0.28 + rng() * 0.2, m.mossyStone, mx, by + 0.35, bz + (rng() - 0.5) * md, 1.4, 0.5, 1.1, false));
    }
  }
}

export function Ruins() {
  const group = useMemo(() => {
    const g = new THREE.Group();
    const outposts = getOutposts();
    for (const spec of outposts) buildOutpost(spec, g);
    return mergeStatic(g);
  }, []);
  return <primitive object={group} />;
}

"use client";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { SHRINE, SHRINE_HEIGHT, STAIRS, STAIRS_START_HEIGHT, terrainHeight } from "@/lib/world/terrain";
import { box, cyl, paperLantern, roof, scaleBoxUVs, sphere, stoneLantern, torii, mergeStatic } from "@/lib/world/builders";
import { mats } from "@/lib/game/materials";
import { addCollider } from "@/lib/game/colliders";
import { addInteractable } from "@/lib/game/interactables";
import { audio } from "@/lib/game/audio";
import { world } from "@/lib/game/world";

export const BELL_POS = new THREE.Vector3(SHRINE.x, SHRINE_HEIGHT + 3.1, SHRINE.z + 5.2);

/** The long staircase, its torii gates, and the hilltop shrine. */
export function Shrine() {
  const group = useMemo(() => {
    const g = new THREE.Group();
    const m = mats();
    // ---- staircase ----
    const rise = SHRINE_HEIGHT - STAIRS_START_HEIGHT;
    const n = Math.max(20, Math.round(rise / 0.3));
    const run = STAIRS.zStart - STAIRS.zEnd;
    const depth = run / n;
    const step = scaleBoxUVs(new THREE.BoxGeometry(5.6, 0.34, depth + 0.04), 5.6, 0.34, depth + 0.04);
    const steps = new THREE.InstancedMesh(step, m.stone, n);
    const tm = new THREE.Matrix4();
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const z = STAIRS.zStart - t * run;
      const y = STAIRS_START_HEIGHT + rise * ((i + 1) / n);
      tm.makeTranslation(STAIRS.x, y - 0.17, z);
      steps.setMatrixAt(i, tm);
    }
    steps.receiveShadow = true; steps.castShadow = false;
    g.add(steps);
    // low stone edging either side
    for (const s of [-1, 1]) {
      const wall = box(0.4, 0.5, run + 1, m.darkStone, STAIRS.x + s * 3.0, (STAIRS_START_HEIGHT + SHRINE_HEIGHT) / 2 + 0.1, (STAIRS.zStart + STAIRS.zEnd) / 2);
      wall.rotation.x = Math.atan2(rise, run);
      g.add(wall);
    }
    // torii gates along the climb
    const gates = 6;
    for (let i = 0; i <= gates; i++) {
      const t = i / gates;
      const z = STAIRS.zStart + 4 - t * (run + 6);
      const y = i === 0 ? terrainHeight(0, z) : STAIRS_START_HEIGHT + rise * Math.min(1, (STAIRS.zStart - z) / run);
      g.add(torii(STAIRS.x, y - 0.05, z, 0, i === 0 || i === gates ? 1.35 : 1.05));
    }
    // stone lanterns lining the stairs
    for (let i = 0; i < 7; i++) {
      const t = (i + 0.5) / 7;
      const z = STAIRS.zStart - t * run;
      const y = STAIRS_START_HEIGHT + rise * t;
      for (const s of [-1, 1]) g.add(stoneLantern(STAIRS.x + s * 4.2, y - 0.1, z, 0.95));
    }
    // ---- platform ----
    const Y = SHRINE_HEIGHT, Z = SHRINE.z;
    g.add(box(30, 0.5, 26, m.cobble, 0, Y - 0.2, Z - 4));
    // main hall
    const hx = 0, hz = Z - 8;
    g.add(box(13, 0.6, 10, m.stone, hx, Y + 0.3, hz));
    g.add(box(11, 0.5, 8.6, m.darkWood, hx, Y + 0.85, hz));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(cyl(0.22, 0.24, 4.2, m.vermilion, hx + sx * 5.2, Y + 3.0, hz + sz * 4.0, 10));
    for (const sx of [-1, 0, 1]) g.add(cyl(0.2, 0.22, 4.2, m.vermilion, hx + sx * 5.2, Y + 3.0, hz + 4.0, 10));
    g.add(box(9.6, 3.6, 7.4, m.darkWood, hx, Y + 2.9, hz - 0.3));
    for (let i = -1; i <= 1; i++) g.add(box(1.7, 2.4, 0.08, m.shoji, hx + i * 2.2, Y + 2.5, hz + 3.45));
    g.add(box(1.4, 0.5, 0.06, m.plaster, hx, Y + 4.3, hz + 3.5)); // name plaque
    // veranda + railing
    g.add(box(12.4, 0.16, 9.8, m.plank, hx, Y + 1.12, hz));
    for (const sx of [-1, 1]) g.add(box(0.1, 0.9, 9.8, m.vermilion, hx + sx * 6.15, Y + 1.6, hz));
    g.add(box(12.4, 0.1, 0.1, m.vermilion, hx, Y + 2.05, hz - 4.85));
    // two-tier sweeping roof
    g.add(roof({ width: 11.5, depth: 9, rise: 3.6, overhang: 2.4, curve: 0.55, x: hx, y: Y + 4.9, z: hz - 0.3, mat: m.roofDark, gableMat: m.darkWood }));
    g.add(roof({ width: 7, depth: 5.5, rise: 2.4, overhang: 1.4, curve: 0.4, x: hx, y: Y + 8.4, z: hz - 0.3, mat: m.roofDark, gableMat: m.darkWood }));
    g.add(box(7.2, 2.2, 5.6, m.darkWood, hx, Y + 7.6, hz - 0.3));
    // offering box and the bell
    g.add(box(1.8, 0.9, 1.1, m.darkWood, hx, Y + 1.65, hz + 5.2));
    for (let i = -3; i <= 3; i++) g.add(box(0.12, 0.05, 1.1, m.black, hx + i * 0.24, Y + 2.12, hz + 5.2, 0, false));
    g.add(cyl(0.05, 0.05, 2.3, m.cloth, BELL_POS.x, BELL_POS.y + 1.1, BELL_POS.z, 6, false)); // rope
    const bell = sphere(0.42, m.metal, BELL_POS.x, BELL_POS.y, BELL_POS.z, 1, 0.9, 1);
    bell.name = "bell";
    g.add(bell);
    g.add(box(0.5, 0.12, 0.4, m.black, BELL_POS.x, BELL_POS.y + 2.3, BELL_POS.z, 0, false));
    // paper lanterns under the eaves
    for (let i = -3; i <= 3; i++) g.add(paperLantern(hx + i * 1.75, Y + 4.7, hz + 5.9, i % 2 === 0, 1.1));
    // lantern poles around the platform
    const ringR = 12;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + 0.2;
      const px = Math.cos(a) * ringR * 1.15, pz = Z - 4 + Math.sin(a) * ringR;
      g.add(cyl(0.08, 0.1, 3.6, m.darkWood, px, Y + 1.8, pz, 6));
      const a2 = ((i + 1) / 8) * Math.PI * 2 + 0.2;
      const qx = Math.cos(a2) * ringR * 1.15, qz = Z - 4 + Math.sin(a2) * ringR;
      const len = Math.hypot(qx - px, qz - pz);
      g.add(box(len, 0.015, 0.015, m.black, (px + qx) / 2, Y + 3.55, (pz + qz) / 2, Math.atan2(qx - px, qz - pz) + Math.PI / 2, false));
      for (let k = 1; k <= 3; k++) { const t = k / 4; g.add(paperLantern(px + (qx - px) * t, Y + 3.5 - Math.sin(t * Math.PI) * 0.45, pz + (qz - pz) * t, (i + k) % 3 === 0, 0.95)); }
    }
    // kitsune guardians
    const fox = (x: number, z: number, ry: number) => {
      const f = new THREE.Group();
      f.add(box(1.0, 1.0, 1.0, m.stone, 0, 0.5, 0));
      f.add(box(0.42, 0.5, 0.95, m.stone, 0, 1.25, 0));
      f.add(sphere(0.2, m.stone, 0, 1.62, 0.3, 1, 0.9, 1.2));
      for (const s of [-1, 1]) { const ear = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 4), m.stone); ear.position.set(s * 0.12, 1.88, 0.3); f.add(ear); }
      const tail = cyl(0.05, 0.16, 0.8, m.stone, 0, 1.55, -0.5, 6); tail.rotation.x = -0.6; f.add(tail);
      f.add(box(0.36, 0.22, 0.05, m.vermilion, 0, 1.42, 0.5, 0, false)); // red bib
      f.position.set(x, Y, z); f.rotation.y = ry;
      return f;
    };
    g.add(fox(-3.2, Z + 4.5, 0.3), fox(3.2, Z + 4.5, -0.3));
    // stone lanterns on the platform corners
    for (const [x, z] of [[-11, Z + 6], [11, Z + 6], [-11, Z - 14], [11, Z - 14]]) g.add(stoneLantern(x, Y, z, 1.2));
    // a child's toy left by the steps
    g.add(sphere(0.1, m.vermilion, 2.2, Y + 0.1, Z + 8.5, 1, 1, 1, false));
    g.add(box(0.25, 0.25, 0.25, m.clothBlue, 1.9, Y + 0.13, Z + 8.7, 0.4, false));

    addCollider(hx, hz, 7.2);
    addCollider(hx, hz + 5.2, 1.2);
    return mergeStatic(g);
  }, []);

  useEffect(() => {
    const off = addInteractable({
      x: BELL_POS.x, y: BELL_POS.y, z: BELL_POS.z + 1.2, radius: 3.2, label: "RING THE BELL",
      action: () => { if (world.clock - world.bellRungAt > 4) audio.bell(0); },
    });
    return off;
  }, []);

  return <primitive object={group} />;
}

"use client";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { VILLAGE, terrainHeight } from "@/lib/world/terrain";
import { bench, bicycle, box, cyl, fence, house, paperLantern, sphere, stoneLantern , mergeStatic } from "@/lib/world/builders";
import { mats, withWind } from "@/lib/game/materials";
import { addCollider } from "@/lib/game/colliders";
import { addInteractable } from "@/lib/game/interactables";
import { audio } from "@/lib/game/audio";
import { mulberry32 } from "@/lib/world/noise";
import { sit, whisper } from "@/lib/game/actions";
import { getVillageLayout } from "@/lib/world/villageGen";

const V = VILLAGE;
const _layout = getVillageLayout();
export const HOUSES = _layout.houses;
export const SMOKE_SOURCES = _layout.smokeSources;

export function Village() {
  const group = useMemo(() => {
    const g = new THREE.Group();
    const m = mats();
    const rng = mulberry32(4242);
    const y = V.height;
    HOUSES.forEach((h) => g.add(house(h)));
    // street lantern lines: poles every 11m with paper lanterns strung between them
    for (let i = -3; i <= 3; i++) {
      const x = V.x + i * 11;
      for (const s of [-1, 1]) g.add(cyl(0.08, 0.1, 3.4, m.darkWood, x, y + 1.7, V.z + s * 3.4, 6));
      if (i < 3) for (let k = 1; k <= 3; k++) {
        const t = k / 4;
        const lx = x + t * 11, sag = Math.sin(t * Math.PI) * 0.5;
        g.add(paperLantern(lx, y + 3.4 - sag, V.z - 3.4 + (rng() - 0.5) * 0.2, k % 2 === 0, 0.9));
        g.add(paperLantern(lx + 1.5, y + 3.4 - sag, V.z + 3.4, k % 2 === 1, 0.9));
      }
      // cross wire
      if (i < 3) for (const s of [-1, 1]) {
        const wire = box(11, 0.015, 0.015, m.black, x + 5.5, y + 3.35, V.z + s * 3.4, 0, false);
        g.add(wire);
      }
    }
    // well
    const wx = V.x + 2, wz = V.z + 1;
    g.add(cyl(1.0, 1.05, 0.9, m.cobble, wx, y + 0.45, wz, 12));
    g.add(cyl(0.75, 0.75, 0.95, m.black, wx, y + 0.5, wz, 12, false));
    for (const s of [-1, 1]) g.add(cyl(0.07, 0.07, 2.2, m.darkWood, wx + s * 0.9, y + 1.7, wz, 6));
    g.add(cyl(0.06, 0.06, 1.9, m.darkWood, wx, y + 2.3, wz, 6).rotateZ(Math.PI / 2));
    const wroof = new THREE.Mesh(new THREE.ConeGeometry(1.5, 0.6, 4), m.roofDark); wroof.position.set(wx, y + 2.9, wz); wroof.rotation.y = Math.PI / 4; wroof.castShadow = true; g.add(wroof);
    g.add(cyl(0.2, 0.22, 0.28, m.wood, wx + 0.3, y + 1.0, wz - 0.3, 8)); // bucket
    addCollider(wx, wz, 1.2);
    // benches, bicycles, laundry
    g.add(bench(V.x - 8, y, V.z - 5.4, Math.PI));
    g.add(bench(V.x + 20, y, V.z + 5.6, 0.2));
    g.add(bicycle(V.x - 24.5, y, V.z - 6.4, 0.1));
    g.add(bicycle(V.x + 7, y, V.z + 7.6, Math.PI + 0.3, -0.25));
    // street clutter: barrels, crates, firewood, potted plants, a handcart
    const barrel = (bx: number, bz: number) => g.add(cyl(0.32, 0.3, 0.8, m.plank, bx, y + 0.4, bz, 10));
    barrel(V.x - 28.5, V.z - 6.2); barrel(V.x - 27.8, V.z - 6.9); barrel(V.x + 13, V.z + 8.2);
    for (let k = 0; k < 3; k++) g.add(box(0.7, 0.5, 0.5, m.weatheredWood, V.x + 26 + (k % 2) * 0.75, y + 0.25 + Math.floor(k / 2) * 0.5, V.z - 6.4, 0.15 * k));
    for (let k = 0; k < 14; k++) { const log = cyl(0.09, 0.09, 0.8, m.wood, V.x - 3 + (k % 7) * 0.2, y + 0.1 + Math.floor(k / 7) * 0.18, V.z + 8.6, 8, false); log.rotation.x = Math.PI / 2; g.add(log); }
    for (const [px, pz] of [[V.x - 9.5, V.z - 6.2], [V.x - 3, V.z - 6.2], [V.x + 12.5, V.z - 6.6], [V.x - 15.5, V.z + 8.3]]) {
      g.add(cyl(0.22, 0.17, 0.32, m.rust, px, y + 0.16, pz, 10));
      const plant = new THREE.Mesh(new THREE.IcosahedronGeometry(0.28, 1), new THREE.MeshStandardMaterial({ color: 0x3f7a35, roughness: 1 })); plant.position.set(px, y + 0.5, pz); plant.castShadow = true; g.add(plant);
    }
    const cart = new THREE.Group();
    cart.add(box(1.6, 0.1, 1.0, m.weatheredWood, 0, 0.6, 0), box(0.06, 0.06, 2.6, m.darkWood, -0.4, 0.62, 0.6), box(0.06, 0.06, 2.6, m.darkWood, 0.4, 0.62, 0.6));
    for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.08, 14), m.darkWood); w.rotation.z = Math.PI / 2; w.position.set(s * 0.85, 0.42, 0); w.castShadow = true; cart.add(w); }
    cart.position.set(V.x + 36, y, V.z + 6); cart.rotation.y = 0.5; g.add(cart);
    g.add(stoneLantern(V.x - 12, y, V.z - 6.0, 0.75));
    g.add(stoneLantern(V.x + 22, y, V.z + 6.4, 0.75));
    g.add(bicycle(V.x - 36, y, V.z + 22, 1.2));
    const clothMat = withWind(m.cloth.clone(), { heightScale: 0, base: 0.6, amount: 0.45 });
    const clothBlue = withWind(m.clothBlue.clone(), { heightScale: 0, base: 0.6, amount: 0.45 });
    const laundry = (x: number, z: number, ry: number) => {
      g.add(cyl(0.05, 0.05, 2, m.darkWood, x - Math.cos(ry) * 2, y + 1, z + Math.sin(ry) * 2, 5));
      g.add(cyl(0.05, 0.05, 2, m.darkWood, x + Math.cos(ry) * 2, y + 1, z - Math.sin(ry) * 2, 5));
      g.add(box(4, 0.02, 0.02, m.black, x, y + 1.95, z, ry, false));
      for (let k = 0; k < 4; k++) {
        const t = -1.3 + k * 0.85;
        const c = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.9, 1, 3), k % 2 ? clothBlue : clothMat);
        c.position.set(x + Math.cos(ry) * t, y + 1.5, z - Math.sin(ry) * t); c.rotation.y = ry; c.castShadow = true;
        g.add(c);
      }
    };
    laundry(V.x - 14, V.z + 19, 0.1);
    laundry(V.x + 30, V.z - 18, 1.4);
    // fences around gardens
    g.add(fence([[V.x - 40, y, V.z - 20], [V.x - 40, y, V.z - 30], [V.x - 28, y, V.z - 31], [V.x - 22, y, V.z - 26]]));
    g.add(fence([[V.x + 36, y, V.z + 6], [V.x + 40, y, V.z + 14], [V.x + 34, y, V.z + 24]]));
    g.add(fence([[V.x - 22, y, V.z + 22], [V.x - 4, y, V.z + 23]]));
    // vegetable rows
    const tuft = new THREE.ConeGeometry(0.28, 0.5, 5); tuft.translate(0, 0.25, 0);
    const tuftMat = withWind(new THREE.MeshStandardMaterial({ color: 0x3f6b2a, roughness: 1 }), { heightScale: 2, amount: 0.3 });
    const rows = new THREE.InstancedMesh(tuft, tuftMat, 120);
    const tm = new THREE.Matrix4();
    let k = 0;
    for (let r = 0; r < 4; r++) for (let c = 0; c < 30; c++) {
      tm.makeScale(1, 0.8 + rng() * 0.5, 1).setPosition(V.x - 38 + c * 0.55, y, V.z - 23 - r * 1.4 + (rng() - 0.5) * 0.15);
      rows.setMatrixAt(k++, tm);
    }
    rows.castShadow = true; g.add(rows);
    // stone lanterns at the village entrances
    g.add(stoneLantern(V.x + 46, terrainHeight(V.x + 46, V.z + 5), V.z + 5, 0.9));
    g.add(stoneLantern(V.x + 46, terrainHeight(V.x + 46, V.z - 3), V.z - 3, 0.9));
    g.add(stoneLantern(V.x - 46, terrainHeight(V.x - 46, V.z + 2), V.z + 2, 0.9));
    // signs
    for (const [sx, sz, ry] of [[V.x + 44, V.z + 1, Math.PI / 2], [V.x - 30, V.z - 6, 0]] as [number, number, number][]) {
      g.add(cyl(0.06, 0.07, 1.8, m.darkWood, sx, y + 0.9, sz, 5));
      g.add(box(0.9, 0.35, 0.05, m.weatheredWood, sx, y + 1.6, sz, ry));
    }
    // small stories: an umbrella left by a door, a cup of tea on a veranda, a cat's bowl
    const umb = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.28, 10, 1, true), m.vermilion); umb.position.set(V.x - 29.5, y + 1.3, V.z - 6.6); umb.rotation.z = 0.35; umb.castShadow = true; (umb.material as THREE.Material).side = THREE.DoubleSide; g.add(umb);
    g.add(cyl(0.012, 0.012, 1.1, m.black, V.x - 29.7, y + 0.75, V.z - 6.6, 4, false));
    g.add(cyl(0.08, 0.06, 0.09, m.plaster, V.x - 18.5, y + 0.6, V.z - 6.4, 10, false)); // teacup
    g.add(cyl(0.16, 0.14, 0.06, m.plaster, V.x + 4.8, y + 0.43, V.z + 8.9, 10, false)); // small bowl
    g.add(sphere(0.12, m.vermilion, V.x - 44.5, y + 0.12, V.z + 24, 1, 1, 1, false)); // a child's ball, forgotten
    // colliders
    for (const h of HOUSES) addCollider(h.x, h.z, Math.max(h.w, h.d) / 2 + 0.9);
    return mergeStatic(g);
  }, []);

  useEffect(() => {
    const offs = [
      addInteractable({ x: V.x - 24.5, y: V.height, z: V.z - 6.4, radius: 2.4, label: "RING THE BICYCLE BELL", action: () => audio.bicycleBell() }),
      addInteractable({ x: V.x + 7, y: V.height, z: V.z + 7.6, radius: 2.4, label: "RING THE BICYCLE BELL", action: () => audio.bicycleBell() }),
      addInteractable({ x: V.x + 2, y: V.height, z: V.z + 1, radius: 2.6, label: "LOOK INTO THE WELL", action: () => { audio.splash(); whisper("THE WATER IS VERY STILL"); } }),
      ...HOUSES.slice(0, 6).map((h) => addInteractable({ x: h.x, y: V.height, z: h.z + h.d / 2 + 1.5, radius: 2.2, label: "SLIDE THE DOOR", action: () => audio.door() })),
      ...[[V.x - 8, V.z - 5.4, Math.PI], [V.x + 20, V.z + 5.6, 0.2]].map(([bx, bz, ry]) => addInteractable({ x: bx, y: V.height, z: bz, radius: 2.2, label: "SIT", action: () => sit(bx, bz, ry) })),
    ];
    return () => offs.forEach((f) => f());
  }, []);

  return <primitive object={group} />;
}

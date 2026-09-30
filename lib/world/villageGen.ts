import * as THREE from 'three';
import { mulberry32, range } from './noise';
import { VILLAGE, terrainHeight } from './terrain';
import { subSeed } from './seed';
import type { HouseOpts } from './builders';

export interface VillageLayout {
  houses: HouseOpts[];
  smokeSources: { x: number; y: number; z: number }[];
}

export function generateVillage(): VillageLayout {
  const rng = mulberry32(subSeed('village'));
  const y = VILLAGE.height;
  const cx = VILLAGE.x, cz = VILLAGE.z;
  const houses: HouseOpts[] = [];
  const smokeSources: { x: number; y: number; z: number }[] = [];

  // --- street layout ---
  // Two rows: north (z = cz - 10) and south (z = cz + 12), each ~110m wide
  // Optional east alley: a house at the far east or west
  const rows: { rowZ: number; ry: number; side: number }[] = [
    { rowZ: cz - 10, ry: 0,        side:  1 },  // south-facing (front = +z)
    { rowZ: cz + 12, ry: Math.PI,  side: -1 },  // north-facing (front = -z)
  ];

  for (const row of rows) {
    // Fill ~110m with houses of varying width 5.5–8m, gap 1–2m
    let cursor = cx - 52;
    let hIdx = 0;
    while (cursor < cx + 52) {
      const w = range(rng, 5.5, 8.0);
      const d = range(rng, 4.8, 6.2);
      const ry = row.ry + (rng() - 0.5) * 0.08;
      const x = cursor + w / 2;
      const shop = rng() < 0.25;
      const lantern = rng() < 0.55;
      const weathered = rng() < 0.22;
      const smoke = rng() < 0.45;
      const hOpts: HouseOpts = { x, z: row.rowZ, y: y - 0.1, w, d, ry, seed: hIdx + 1, shop, lantern, weathered, veranda: true };
      houses.push(hOpts);
      if (smoke) {
        smokeSources.push({
          x: x + Math.cos(ry) * w * 0.3,
          y: y + 3.6 + d * 0.14 + 1.5,
          z: row.rowZ + Math.sin(ry) * w * 0.3,
        });
      }
      cursor += w + range(rng, 1.0, 2.2);
      hIdx++;
    }
  }

  // Back-street single house west of the village
  houses.push({
    x: cx - 42, z: cz + 2, y: y - 0.1, w: 5.5, d: 5.0,
    ry: Math.PI / 2, seed: 100, weathered: true, veranda: true,
  });

  return { houses, smokeSources };
}

// Cached singleton — same seed = same layout every time
let _layout: VillageLayout | null = null;
export function getVillageLayout(): VillageLayout {
  if (!_layout) _layout = generateVillage();
  return _layout;
}

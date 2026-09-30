// Deterministic scatter helpers for populating the valley.
import { mulberry32, type Rng } from "./noise";
import { BAMBOO, isGrassy, lakeDist, slopeAt, streamDist, terraceMask, terrainHeight, WATER_LEVEL, SHRINE, STATION, TRACK_HALF_LENGTH, VILLAGE, STAIRS } from "./terrain";

export interface Placed { x: number; y: number; z: number; scale: number; rot: number; variant: number; tint: number }

export type Region = (rng: Rng) => [number, number];

export const disc = (cx: number, cz: number, r: number, falloff = 1): Region => (rng) => {
  const a = rng() * Math.PI * 2;
  const d = Math.pow(rng(), falloff) * r; // falloff>1 -> denser centre
  return [cx + Math.cos(a) * d, cz + Math.sin(a) * d];
};
export const ring = (cx: number, cz: number, r0: number, r1: number, a0 = 0, a1 = Math.PI * 2): Region => (rng) => {
  const a = a0 + rng() * (a1 - a0);
  const d = Math.sqrt(rng() * (r1 * r1 - r0 * r0) + r0 * r0);
  return [cx + Math.cos(a) * d, cz + Math.sin(a) * d];
};
export const rect = (x0: number, z0: number, x1: number, z1: number): Region => (rng) => [x0 + rng() * (x1 - x0), z0 + rng() * (z1 - z0)];

export function standardAccept(x: number, z: number, h: number, maxSlope = 0.45) {
  if (h < WATER_LEVEL + 0.8 || h > 120) return false;
  if (slopeAt(x, z) > maxSlope) return false;
  if (!isGrassy(x, z, h)) return false;
  if (Math.hypot(x - VILLAGE.x, z - VILLAGE.z) < VILLAGE.radius - 4) return false;
  if (Math.hypot(x - STATION.x, z - STATION.z) < 30) return false;
  if (Math.abs(x) < TRACK_HALF_LENGTH && Math.abs(z - STATION.trackZ) < 9) return false;
  if (streamDist(x, z) < 5) return false;
  if (terraceMask(x, z) > 0.2) return false;
  if (Math.hypot(x - SHRINE.x, z - SHRINE.z) < SHRINE.platformRadius + 6) return false;
  if (z < STAIRS.zStart + 8 && z > STAIRS.zEnd - 8 && Math.abs(x) < 13) return false;
  if (lakeDist(x, z) < 96) return false;
  if (Math.hypot(x + 50, z - 130) < 16) return false; // player start
  if (Math.hypot(x + 234, z - 60) < 7 || (x > -236 && x < -205 && Math.abs(z - 60) < 7)) return false; // lookout bench + its view
  return true;
}

export function scatter(seed: number, count: number, region: Region, accept: (x: number, z: number, h: number) => boolean = standardAccept,
  opts: { minDist?: number; scale?: [number, number]; variants?: number; sink?: number } = {}): Placed[] {
  const rng = mulberry32(seed);
  const out: Placed[] = [];
  const minDist = opts.minDist ?? 0;
  const [s0, s1] = opts.scale ?? [0.85, 1.2];
  let tries = 0;
  while (out.length < count && tries < count * 12) {
    tries++;
    const [x, z] = region(rng);
    const h = terrainHeight(x, z);
    if (!accept(x, z, h)) continue;
    if (minDist > 0) {
      let ok = true;
      for (let i = out.length - 1; i >= 0 && i > out.length - 400; i--) {
        const o = out[i];
        if ((o.x - x) * (o.x - x) + (o.z - z) * (o.z - z) < minDist * minDist) { ok = false; break; }
      }
      if (!ok) continue;
    }
    out.push({ x, y: h - (opts.sink ?? 0.1), z, scale: s0 + rng() * (s1 - s0), rot: rng() * Math.PI * 2, variant: Math.floor(rng() * (opts.variants ?? 3)), tint: rng() });
  }
  return out;
}

export const notBamboo = (x: number, z: number) => Math.hypot(x - BAMBOO.x, z - BAMBOO.z) > BAMBOO.radius + 8;

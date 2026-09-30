// The single source of truth for the shape of the valley.
// Every system (terrain mesh, player grounding, vegetation placement,
// water, buildings) samples these functions so the world is always consistent.

import { clamp, fbm, gauss, lerp, smoothstep } from "./noise";

export const WORLD_SIZE = 800; // terrain mesh spans -400..400
export const WATER_LEVEL = 0;

export const LAKE = { x: 0, z: 30, radius: 78 };
export const VILLAGE = { x: -160, z: 40, radius: 55, height: 4.5 };
export const LOOKOUT = { x: -240, z: 60 };
export const SAKURA = { x: 0, z: -100 };
export const BAMBOO = { x: 0, z: -175, radius: 48 };
export const SHRINE = { x: 0, z: -278, platformRadius: 24 };
export const STAIRS = { x: 0, zStart: -214, zEnd: -262 };
export const STATION = { x: -30, z: 150, trackZ: 152, height: 3.2 };
export const TERRACES = { x0: 105, x1: 230, z0: -45, z1: 105, step: 2.5 };
export const MAPLE_GROVE = { x: -110, z: -150, radius: 30 };
export const TRACK_HALF_LENGTH = 306;

export type AreaId =
  | "lake" | "village" | "sakura" | "bamboo" | "shrine" | "terraces" | "station" | "stream" | "lookout" | "maple";

export const AREAS: { id: AreaId; name: string; x: number; z: number; radius: number }[] = [
  { id: "lake", name: "MIZU LAKE", x: LAKE.x, z: LAKE.z, radius: 110 },
  { id: "village", name: "KAWAMURA VILLAGE", x: VILLAGE.x, z: VILLAGE.z, radius: 60 },
  { id: "lookout", name: "SAKURA HILL", x: LOOKOUT.x, z: LOOKOUT.z, radius: 30 },
  { id: "sakura", name: "SAKURA VALLEY", x: SAKURA.x, z: SAKURA.z, radius: 60 },
  { id: "maple", name: "THE MAPLE GROVE", x: MAPLE_GROVE.x, z: MAPLE_GROVE.z, radius: 32 },
  { id: "bamboo", name: "BAMBOO FOREST", x: BAMBOO.x, z: BAMBOO.z, radius: 50 },
  { id: "shrine", name: "KITSUNE SHRINE", x: SHRINE.x, z: SHRINE.z, radius: 34 },
  { id: "terraces", name: "RICE TERRACES", x: 165, z: 30, radius: 70 },
  { id: "station", name: "MIZU STATION", x: STATION.x, z: STATION.z, radius: 40 },
  { id: "stream", name: "FOREST STREAM", x: 30, z: 260, radius: 50 },
];

export function areaAt(x: number, z: number): (typeof AREAS)[number] | null {
  let best: (typeof AREAS)[number] | null = null;
  let bestD = Infinity;
  for (const a of AREAS) {
    const d = Math.hypot(x - a.x, z - a.z) / a.radius;
    if (d < 1 && d < bestD) { bestD = d; best = a; }
  }
  return best;
}

// ---------- stream ----------
export const STREAM = { zStart: 95, zEnd: 380 };
export const streamCenterX = (z: number) => 32 + 16 * Math.sin(z * 0.028) + 5 * Math.sin(z * 0.071);
// The bed follows the terrain along the centreline as a running minimum (downstream = north),
// so the water always flows downhill and never floats above the ground.
let bedTable: Float32Array | null = null;
function buildBedTable() {
  const n = STREAM.zEnd - STREAM.zStart + 1;
  const t = new Float32Array(n);
  let cur = Infinity;
  for (let i = n - 1; i >= 0; i--) {
    const z = STREAM.zStart + i;
    cur = Math.min(cur, terrainNoStream(streamCenterX(z), z) - 1.1);
    t[i] = cur;
  }
  return t;
}
export function streamBed(z: number) {
  if (!bedTable) bedTable = buildBedTable();
  const f = clamp(z - STREAM.zStart, 0, bedTable.length - 1.001);
  const i = Math.floor(f);
  return lerp(bedTable[i], bedTable[i + 1], f - i);
}
export const streamSurface = (z: number) => streamBed(z) + 0.6;
export function streamDist(x: number, z: number) {
  if (z < STREAM.zStart - 10 || z > STREAM.zEnd + 10) return 1e9;
  return Math.abs(x - streamCenterX(z));
}

// ---------- lake ----------
export function lakeDist(x: number, z: number) {
  const d = Math.hypot(x - LAKE.x, z - LAKE.z);
  return d + 16 * fbm(x * 0.011 + 3.1, z * 0.011 - 1.7, 3);
}

// ---------- terraces ----------
export function terraceRaw(x: number, z: number) {
  return 4 + (x - TERRACES.x0) * 0.235 + 5 * Math.sin(z * 0.03 + x * 0.01) + 2 * fbm(x * 0.02, z * 0.02, 2);
}
export const terraceLevel = (x: number, z: number) => Math.floor(terraceRaw(x, z) / TERRACES.step) * TERRACES.step;
export function terraceMask(x: number, z: number) {
  return smoothstep(TERRACES.x0 - 6, TERRACES.x0 + 6, x) * smoothstep(TERRACES.x1 + 6, TERRACES.x1 - 6, x) *
    smoothstep(TERRACES.z0 - 10, TERRACES.z0 + 6, z) * smoothstep(TERRACES.z1 + 10, TERRACES.z1 - 6, z);
}

// ---------- paths ----------
export const PATHS: [number, number][][] = [
  [[-150, 42], [-110, 46], [-80, 52], [-62, 62]], // village -> lake dock
  [[-190, 44], [-215, 52], [-240, 60]], // village -> lookout hill
  [[-2, -48], [-14, -80], [-6, -110], [2, -140], [0, -175], [0, -214]], // lake -> sakura -> bamboo -> stairs
  [[-6, 108], [-18, 128], [-30, 145]], // lake -> station
  [[70, 42], [95, 34], [110, 30]], // lake -> terraces
  [[-26, 158], [-4, 178], [10, 205], [16, 230], [10, 262]], // station -> stream path
  [[-60, -70], [-90, -110], [-110, -140]], // sakura -> maple grove (faint)
];

function segDist(px: number, pz: number, ax: number, az: number, bx: number, bz: number) {
  const dx = bx - ax, dz = bz - az;
  const l2 = dx * dx + dz * dz || 1;
  const t = clamp(((px - ax) * dx + (pz - az) * dz) / l2, 0, 1);
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}
export function pathDist(x: number, z: number) {
  let m = 1e9;
  for (const p of PATHS) for (let i = 0; i < p.length - 1; i++) {
    m = Math.min(m, segDist(x, z, p[i][0], p[i][1], p[i + 1][0], p[i + 1][1]));
  }
  return m;
}

// ---------- height ----------
function terrainNoStream(x: number, z: number) {
  let h = 3 + 5 * fbm(x * 0.008, z * 0.008, 4) + 1.1 * fbm(x * 0.045, z * 0.045, 2);

  // encircling mountains
  const r = Math.hypot(x, z);
  const ring = smoothstep(265, 440, r);
  h += ring * ring * (120 + 70 * fbm(x * 0.006 + 9, z * 0.006, 3)) + ring * 24 * fbm(x * 0.02, z * 0.02, 3);

  // northern shrine mountain
  h += 92 * gauss(Math.hypot(x, z + 362), 92) * (1 + 0.25 * fbm(x * 0.015, z * 0.015, 3));
  // sakura hill and bamboo plateau
  h += 14 * gauss(Math.hypot(x - SAKURA.x, z - SAKURA.z), 58);
  h += 22 * gauss(Math.hypot(x - BAMBOO.x, z - BAMBOO.z), 46);
  // lookout hill west of the village
  h += 26 * gauss(Math.hypot(x - LOOKOUT.x, z - LOOKOUT.z), 34);
  // southern wooded hills
  h += 10 * gauss(Math.hypot(x + 80, z - 260), 60) + 9 * gauss(Math.hypot(x - 120, z - 250), 55);

  // rice terraces (stepped slope east of the lake)
  const tm = terraceMask(x, z);
  if (tm > 0) h = lerp(h, terraceLevel(x, z), tm);

  // lake basin
  const ld = lakeDist(x, z);
  const basin = smoothstep(95, 56, ld);
  h = lerp(h, -9, basin);

  // village flats
  h = lerp(h, VILLAGE.height, smoothstep(VILLAGE.radius + 14, VILLAGE.radius - 12, Math.hypot(x - VILLAGE.x, z - VILLAGE.z)));

  // station flats + railway corridor
  h = lerp(h, STATION.height, smoothstep(58, 28, Math.hypot(x - STATION.x, z - STATION.z)));
  if (Math.abs(x) < TRACK_HALF_LENGTH + 4) h = lerp(h, STATION.height, smoothstep(11, 4, Math.abs(z - STATION.trackZ)));
  return h;
}

function baseHeight(x: number, z: number) {
  let h = terrainNoStream(x, z);
  // forest stream carving (after flats so it cuts through them)
  const sd = streamDist(x, z);
  if (sd < 40) {
    const bed = streamBed(z);
    const w = smoothstep(12, 0, sd);
    h = lerp(h, Math.min(h, bed + 1.5), w * w);
    h -= 1.6 * gauss(sd, 2.4);
    if (sd < 2.4) h = Math.min(h, bed);
  }
  return h;
}

const stairsStartH = baseHeight(STAIRS.x, STAIRS.zStart);
export const SHRINE_HEIGHT = Math.max(baseHeight(SHRINE.x, SHRINE.z), stairsStartH + 26);
export const STAIRS_START_HEIGHT = stairsStartH;

export function terrainHeight(x: number, z: number) {
  let h = baseHeight(x, z);
  // shrine platform
  const pd = Math.hypot(x - SHRINE.x, z - SHRINE.z);
  h = lerp(h, SHRINE_HEIGHT, smoothstep(SHRINE.platformRadius + 12, SHRINE.platformRadius - 4, pd));
  // staircase ramp corridor
  if (z < STAIRS.zStart + 6 && z > STAIRS.zEnd && Math.abs(x) < 16) {
    const t = clamp((STAIRS.zStart - z) / (STAIRS.zStart - STAIRS.zEnd), 0, 1);
    const ramp = lerp(stairsStartH, SHRINE_HEIGHT, t);
    h = lerp(h, ramp, smoothstep(14, 6, Math.abs(x)));
  }
  return h;
}

export function terrainNormal(x: number, z: number, out: [number, number, number] = [0, 1, 0]) {
  const e = 0.6;
  const hl = terrainHeight(x - e, z), hr = terrainHeight(x + e, z);
  const hd = terrainHeight(x, z - e), hu = terrainHeight(x, z + e);
  let nx = hl - hr, ny = 2 * e, nz = hd - hu;
  const l = Math.hypot(nx, ny, nz);
  out[0] = nx / l; out[1] = ny / l; out[2] = nz / l;
  return out;
}

export const slopeAt = (x: number, z: number) => 1 - terrainNormal(x, z)[1];

// Is this a spot where ground vegetation can grow?
export function isGrassy(x: number, z: number, h = terrainHeight(x, z)) {
  if (h < WATER_LEVEL + 0.6) return false;
  if (h > 95) return false;
  if (pathDist(x, z) < 2.2) return false;
  if (Math.hypot(x - VILLAGE.x, z - VILLAGE.z) < VILLAGE.radius - 8 && (Math.abs(z - VILLAGE.z) < 7.5 || fbm(x * 0.06, z * 0.06, 2) < 0.15)) return false;
  if (Math.hypot(x - STATION.x, z - STATION.z) < 22) return false;
  if (Math.abs(x) < TRACK_HALF_LENGTH && Math.abs(z - STATION.trackZ) < 4.5) return false;
  if (terraceMask(x, z) > 0.5) return false;
  if (streamDist(x, z) < 3) return false;
  if (Math.hypot(x - SHRINE.x, z - SHRINE.z) < SHRINE.platformRadius) return false;
  if (z < STAIRS.zStart + 4 && z > STAIRS.zEnd - 4 && Math.abs(x) < 5) return false;
  return true;
}

// ---------- ground colour (used by terrain mesh + grass tint) ----------
export function terrainColor(x: number, z: number, h: number, slope: number, out: [number, number, number]) {
  const n = fbm(x * 0.03, z * 0.03, 3);
  const n2 = fbm(x * 0.11 + 5, z * 0.11, 2);
  // lush grass -> dry grass
  let r = 0.24 + 0.06 * n, g = 0.4 + 0.07 * n2, b = 0.14 + 0.03 * n;
  const dry = smoothstep(20, 70, h) * 0.6;
  r = lerp(r, 0.45, dry); g = lerp(g, 0.43, dry); b = lerp(b, 0.2, dry);
  // lake bed and shore sand
  const shore = smoothstep(1.5, 0.3, h);
  r = lerp(r, 0.55 + 0.04 * n, shore); g = lerp(g, 0.5, shore); b = lerp(b, 0.38, shore);
  const bed = smoothstep(0.2, -2, h);
  r = lerp(r, 0.22, bed); g = lerp(g, 0.3, bed); b = lerp(b, 0.28, bed);
  // darker forested slopes on the mountain flanks
  const forest = smoothstep(28, 60, h) * smoothstep(125, 85, h) * (0.5 + 0.5 * smoothstep(-0.2, 0.3, n));
  r = lerp(r, 0.14 + 0.04 * n2, forest * 0.8); g = lerp(g, 0.24 + 0.05 * n2, forest * 0.8); b = lerp(b, 0.12, forest * 0.8);
  // rock on steep faces
  const rock = smoothstep(0.32, 0.55, slope);
  const rg = 0.44 + 0.08 * n2;
  r = lerp(r, rg, rock); g = lerp(g, rg - 0.01, rock); b = lerp(b, rg + 0.02, rock);
  // snow on peaks
  const snow = smoothstep(135, 170, h + 12 * n);
  r = lerp(r, 0.92, snow); g = lerp(g, 0.94, snow); b = lerp(b, 0.98, snow);
  // village gravel
  const vd = Math.hypot(x - VILLAGE.x, z - VILLAGE.z);
  const vill = smoothstep(VILLAGE.radius - 4, VILLAGE.radius - 22, vd) * (0.55 + 0.45 * smoothstep(0.15, -0.1, fbm(x * 0.06, z * 0.06, 2)));
  r = lerp(r, 0.46 + 0.07 * n2, vill); g = lerp(g, 0.43 + 0.06 * n2, vill); b = lerp(b, 0.37 + 0.03 * n, vill);
  // the village street: worn stone
  const street = smoothstep(VILLAGE.radius - 2, VILLAGE.radius - 12, vd) * smoothstep(4.5, 2.5, Math.abs(z - VILLAGE.z));
  r = lerp(r, 0.58 + 0.06 * n2, street); g = lerp(g, 0.56 + 0.05 * n2, street); b = lerp(b, 0.52, street);
  // station gravel
  const st = smoothstep(26, 14, Math.hypot(x - STATION.x, z - STATION.z));
  r = lerp(r, 0.6, st); g = lerp(g, 0.58, st); b = lerp(b, 0.54, st);
  // rail ballast
  if (Math.abs(x) < TRACK_HALF_LENGTH) {
    const rail = smoothstep(4.2, 2.6, Math.abs(z - STATION.trackZ));
    r = lerp(r, 0.42, rail); g = lerp(g, 0.4, rail); b = lerp(b, 0.38, rail);
  }
  // terrace mud walls
  const tm = terraceMask(x, z);
  if (tm > 0.2) { const mud = tm * smoothstep(0.15, 0.4, slope); r = lerp(r, 0.36, mud); g = lerp(g, 0.32, mud); b = lerp(b, 0.26, mud); }
  // paths
  const pd = pathDist(x, z);
  const path = smoothstep(2.6, 1.3, pd) * smoothstep(-0.5, 1.2, h);
  r = lerp(r, 0.5 + 0.04 * n2, path); g = lerp(g, 0.44 + 0.03 * n2, path); b = lerp(b, 0.34, path);
  // shrine platform stone
  const sp = smoothstep(SHRINE.platformRadius + 2, SHRINE.platformRadius - 6, Math.hypot(x - SHRINE.x, z - SHRINE.z));
  r = lerp(r, 0.5, sp); g = lerp(g, 0.49, sp); b = lerp(b, 0.47, sp);
  out[0] = r; out[1] = g; out[2] = b;
  return out;
}

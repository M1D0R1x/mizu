// Bakes the terrain into a texture so GPU systems (grass, petals, fireflies)
// can read ground height / grass mask without any per-frame CPU work.
import * as THREE from "three";
import { isGrassy, lakeDist, pathDist, terraceMask, terrainHeight, WORLD_SIZE } from "./terrain";
import { clamp, smoothstep } from "./noise";

export const HEIGHTMAP_RES = 400;
let cached: THREE.DataTexture | null = null;

export function heightmapTexture() {
  if (cached) return cached;
  const n = HEIGHTMAP_RES;
  const data = new Uint16Array(n * n * 4);
  const toHalf = THREE.DataUtils.toHalfFloat;
  for (let j = 0; j < n; j++) {
    const z = (j / (n - 1) - 0.5) * WORLD_SIZE;
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1) - 0.5) * WORLD_SIZE;
      const h = terrainHeight(x, z);
      const grassy = isGrassy(x, z, h) ? 1 : 0;
      const path = clamp(pathDist(x, z) / 6, 0, 1);
      const shore = smoothstep(112, 96, lakeDist(x, z)) * smoothstep(0.2, 1.4, h) * smoothstep(3.0, 1.2, h) * (1 - terraceMask(x, z)) * (pathDist(x, z) > 2.5 ? 1 : 0);
      const k = (j * n + i) * 4;
      data[k] = toHalf(h); data[k + 1] = toHalf(grassy); data[k + 2] = toHalf(path); data[k + 3] = toHalf(shore);
    }
  }
  const t = new THREE.DataTexture(data, n, n, THREE.RGBAFormat, THREE.HalfFloatType);
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearFilter;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  cached = t;
  return t;
}

export const heightmapGLSL = /* glsl */ `
uniform sampler2D uHeightMap; uniform float uWorldSize;
// .x height, .y grass mask, .z path distance (0..1 over 6m), .w lake shore band
vec4 sampleTerrain(vec2 xz) { return texture2D(uHeightMap, xz / uWorldSize + 0.5); }
`;

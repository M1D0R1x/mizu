"use client";
import { useMemo } from "react";
import * as THREE from "three";
import { terrainColor, terrainHeight, WORLD_SIZE } from "@/lib/world/terrain";
import { fbm, lerp, smoothstep } from "@/lib/world/noise";
import { tex } from "@/lib/game/textures";
import { withWetness } from "@/lib/game/materials";

export function buildTerrainGeometry(segments = 360) {
  const geo = new THREE.PlaneGeometry(WORLD_SIZE, WORLD_SIZE, segments, segments);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const n = pos.count;
  for (let i = 0; i < n; i++) pos.setY(i, terrainHeight(pos.getX(i), pos.getZ(i)));
  geo.computeVertexNormals();
  const nor = geo.attributes.normal as THREE.BufferAttribute;
  const colors = new Float32Array(n * 3);
  const c: [number, number, number] = [0, 0, 0];
  for (let i = 0; i < n; i++) {
    terrainColor(pos.getX(i), pos.getZ(i), pos.getY(i), 1 - nor.getY(i), c);
    colors[i * 3] = c[0]; colors[i * 3 + 1] = c[1]; colors[i * 3 + 2] = c[2];
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return geo;
}

export function Terrain() {
  const geo = useMemo(() => buildTerrainGeometry(), []);
  const mat = useMemo(() => {
    const detail = tex.noise().clone();
    detail.repeat.set(380, 380); detail.wrapS = detail.wrapT = THREE.RepeatWrapping; detail.needsUpdate = true;
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, map: detail, color: new THREE.Color(0.85, 0.85, 0.85) });
    withWetness(m, 0.7);
    // puddles gather in the low spots of the detail noise when the ground is wet
    const prev = m.onBeforeCompile;
    m.onBeforeCompile = (shader, renderer) => {
      prev.call(m, shader, renderer);
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <color_fragment>", `#include <color_fragment>
        float puddleN = texture2D(map, vMapUv * 0.37 + 0.3).g;
        float puddle = smoothstep(0.78, 0.86, puddleN) * smoothstep(0.15, 0.5, uWetness);
        diffuseColor.rgb *= 1.0 - puddle * 0.3;`)
        .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.08, puddle);`);
    };
    const prevKey = m.customProgramCacheKey;
    m.customProgramCacheKey = () => `${prevKey.call(m)}|puddle`;
    return m;
  }, []);
  return <mesh geometry={geo} material={mat} receiveShadow castShadow={false} frustumCulled={false} />;
}

/** Ring of far mountains beyond the playable terrain, fading into the haze. */
export function FarMountains() {
  const geo = useMemo(() => {
    const A = 256, R = 40, r0 = 385, r1 = 1700;
    const positions: number[] = [], colors: number[] = [], indices: number[] = [];
    for (let j = 0; j <= R; j++) {
      const t = j / R;
      const r = lerp(r0, r1, t * t);
      for (let i = 0; i <= A; i++) {
        const a = (i / A) * Math.PI * 2;
        const x = Math.cos(a) * r, z = Math.sin(a) * r;
        const far = smoothstep(390, 640, r);
        const ridge = fbm(x * 0.0035, z * 0.0035, 4) * 0.5 + 0.5;
        const peaks = 90 + 230 * Math.pow(ridge, 1.4) + 60 * fbm(x * 0.012, z * 0.012, 3);
        const outerFade = 1 - smoothstep(1200, 1700, r);
        const h = lerp(terrainHeight(x, z), peaks * outerFade, far);
        positions.push(x, h, z);
        const snow = smoothstep(190, 260, h + 40 * fbm(x * 0.02, z * 0.02, 2));
        const rockL = 0.4 + 0.12 * fbm(x * 0.01, z * 0.01, 2);
        const forest = smoothstep(170, 90, h) * (0.45 + 0.55 * smoothstep(-0.3, 0.4, fbm(x * 0.007 + 3, z * 0.007, 3)));
        let cr = lerp(rockL, 0.16, forest), cg = lerp(rockL, 0.24, forest), cb = lerp(rockL + 0.03, 0.14, forest);
        cr = lerp(cr, 0.92, snow); cg = lerp(cg, 0.94, snow); cb = lerp(cb, 0.98, snow);
        colors.push(cr, cg, cb);
      }
    }
    for (let j = 0; j < R; j++) for (let i = 0; i < A; i++) {
      const a = j * (A + 1) + i, b = a + 1, c = a + A + 1, d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    g.setIndex(indices);
    g.computeVertexNormals();
    return g;
  }, []);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }), []);
  return <mesh geometry={geo} material={mat} frustumCulled={false} />;
}

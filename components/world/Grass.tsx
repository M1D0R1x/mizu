"use client";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { U } from "@/lib/game/uniforms";
import { fogGLSL, noiseGLSL, windGLSL } from "@/lib/game/shaders/common";
import { heightmapGLSL, heightmapTexture } from "@/lib/world/heightmap";
import { QUALITY, useGame } from "@/store/gameStore";

// Grass, flowers and reeds are placed entirely on the GPU: a camera-anchored grid
// of instances reads ground height + grass mask from the baked heightmap.

const vert = /* glsl */ `
precision highp float;
attribute vec2 aCell; attribute float aRand;
uniform vec3 uCamPos; uniform float uSpacing; uniform float uRadius; uniform float uTime; uniform vec3 uWind;
uniform float uDaylight;
${heightmapGLSL}
${noiseGLSL}
${windGLSL}
varying vec3 vColor; varying vec3 vNormal; varying float vFade; varying float vHeight; varying vec3 vWorld; varying vec2 vUv;
void main() {
  vUv = uv;
  vec2 anchor = floor(uCamPos.xz / uSpacing) * uSpacing;
  vec2 cell = anchor + aCell * uSpacing;
  float h1 = hash12(cell * 0.731), h2 = hash12(cell * 1.173 + 5.0), h3 = hash12(cell * 0.377 + 11.0);
  vec2 wp = cell + (vec2(h1, h2) - 0.5) * uSpacing * 0.95;
  vec4 t = sampleTerrain(wp);
  float ground = t.x;
  float d = length(wp - uCamPos.xz);
  float fade = 1.0 - smoothstep(uRadius * 0.55, uRadius, d);
  float mask = t.y;
  #ifdef REED
    mask = smoothstep(0.45, 0.85, t.w) * step(0.3, h3);
    float bladeH = (0.9 + h3 * 0.7);
    float bladeW = 0.045;
  #elif defined(FLOWER)
    mask *= step(0.86, h3) * smoothstep(0.35, 0.8, t.z);
    float bladeH = 0.26 + h1 * 0.12;
    float bladeW = 0.1;
  #else
    // thinner near paths, taller in lush spots
    float lush = fbm(wp * 0.05);
    mask *= smoothstep(0.05, 0.4, t.z) * step(0.12, h3) * smoothstep(0.28, 0.42, lush + h3 * 0.15);
    float bladeH = (0.2 + h3 * 0.26) * (0.8 + lush * 0.4) * (1.0 - smoothstep(30.0, 80.0, ground) * 0.4);
    float bladeW = 0.03 + h1 * 0.015;
  #endif
  float scale = mask * fade;
  vFade = scale;
  // blade shape: taper + slight curl
  float y = position.y; // 0..1
  vec3 p = position;
  #ifdef FLOWER
    p.xz *= bladeW;
  #else
    p.x *= bladeW * (1.0 - y * 0.75);
  #endif
  p.y *= bladeH;
  float ang = h2 * 6.2831;
  float ca = cos(ang), sa = sin(ang);
  vec3 rp = vec3(p.x * ca - p.z * sa, p.y, p.x * sa + p.z * ca);
  // natural lean
  vec2 lean = vec2(ca, sa) * (h1 - 0.5) * 0.35 * y * y * bladeH;
  vec3 world = vec3(wp.x, ground + 0.01, wp.y) + rp * scale;
  world.xz += lean * scale;
  #ifdef FLOWER
    world += windOffset(vec3(wp.x, ground, wp.y), y * 0.5) * 0.35;
  #else
    world += windOffset(vec3(wp.x, ground, wp.y), y * y) * (0.55 + 0.45 * bladeH);
  #endif
  vWorld = world;
  vHeight = y;
  vNormal = normalize(mix(vec3(-sa, 0.0, ca), vec3(0.0, 1.0, 0.0), 0.55));
  // colour
  #ifdef FLOWER
    float pal = hash12(cell * 2.7 + 3.0);
    vec3 fc = pal < 0.35 ? vec3(1.0, 0.98, 0.95) : pal < 0.6 ? vec3(0.98, 0.72, 0.82) : pal < 0.8 ? vec3(0.98, 0.86, 0.35) : vec3(0.72, 0.6, 0.95);
    vColor = mix(vec3(0.22, 0.38, 0.14), fc, smoothstep(0.55, 0.75, y));
  #elif defined(REED)
    vColor = mix(vec3(0.24, 0.3, 0.12), vec3(0.6, 0.62, 0.32), y) * (0.85 + h1 * 0.3);
    vColor = mix(vColor, vec3(0.55, 0.42, 0.25), smoothstep(0.85, 1.0, y) * step(0.5, h2));
  #else
    float dry = smoothstep(25.0, 75.0, ground) * 0.6;
    vec3 lushCol = vec3(0.18, 0.33, 0.1), dryCol = vec3(0.42, 0.38, 0.16);
    vec3 base = mix(lushCol, dryCol, dry) * (0.75 + h1 * 0.3 + lush * 0.3);
    base = mix(base, vec3(0.3, 0.34, 0.12), fbm(wp * 0.13 + 4.0) * 0.5);
    base = mix(base * 0.5, base * 0.9, smoothstep(0.0, 0.9, y));
    vColor = base;
  #endif
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}`;

const frag = /* glsl */ `
precision highp float;
varying vec3 vColor; varying vec3 vNormal; varying float vFade; varying float vHeight; varying vec3 vWorld; varying vec2 vUv;
uniform vec3 uLightDir; uniform vec3 uLightColor; uniform float uSunIntensity; uniform vec3 uHemiSky; uniform vec3 uHemiGround;
uniform vec3 uCamPos; uniform float uWetness;
${fogGLSL}
void main() {
  if (vFade < 0.02) discard;
  #ifdef FLOWER
    if (vHeight > 0.6 && length(vUv - 0.5) > 0.47) discard;
  #endif
  vec3 N = normalize(vNormal);
  vec3 V = normalize(uCamPos - vWorld);
  float hemi = N.y * 0.5 + 0.5;
  vec3 amb = mix(uHemiGround, uHemiSky, hemi);
  float ndl = max(dot(N, uLightDir), 0.0) * 0.55 + 0.45 * max(uLightDir.y, 0.0);
  // translucency when lit from behind
  float back = pow(max(dot(-V, uLightDir), 0.0), 3.0) * 0.14 * vHeight;
  vec3 col = vColor * (amb * 0.55 + uLightColor * uSunIntensity * (ndl * 0.2 + back));
  col *= 1.0 - uWetness * 0.25;
  col = applyFog(col, length(uCamPos - vWorld));
  gl_FragColor = vec4(col, 1.0);
}`;

function bladeGeometry(kind: "grass" | "flower" | "reed") {
  if (kind === "flower") {
    // stem + small crossed petals near the top
    const stem = new THREE.PlaneGeometry(0.25, 1, 1, 2); stem.translate(0, 0.5, 0);
    const a = new THREE.PlaneGeometry(1, 0.45); a.translate(0, 0.86, 0);
    const b = a.clone(); b.rotateY(Math.PI / 2);
    const g = new THREE.BufferGeometry();
    const merged = [stem, a, b];
    const pos: number[] = [], uvs: number[] = [], idx: number[] = []; let off = 0;
    for (const m of merged) {
      const p = m.attributes.position, u = m.attributes.uv; const ix = m.index!;
      for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); uvs.push(u.getX(i), u.getY(i)); }
      for (let i = 0; i < ix.count; i++) idx.push(ix.getX(i) + off);
      off += p.count;
    }
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2)); g.setIndex(idx);
    return g;
  }
  const g = new THREE.PlaneGeometry(1, 1, 1, kind === "reed" ? 4 : 3);
  g.translate(0, 0.5, 0);
  return g;
}

function GrassLayer({ kind, count, radius }: { kind: "grass" | "flower" | "reed"; count: number; radius: number }) {
  const mesh = useMemo(() => {
    const n = Math.max(8, Math.floor(Math.sqrt(count)));
    const spacing = (radius * 2) / n;
    const base = bladeGeometry(kind);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = base.index; geo.setAttribute("position", base.attributes.position);
    const cells = new Float32Array(n * n * 2), rand = new Float32Array(n * n);
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const k = j * n + i; cells[k * 2] = i - n / 2; cells[k * 2 + 1] = j - n / 2; rand[k] = Math.random(); }
    geo.setAttribute("aCell", new THREE.InstancedBufferAttribute(cells, 2));
    geo.setAttribute("aRand", new THREE.InstancedBufferAttribute(rand, 1));
    geo.instanceCount = n * n;
    const mat = new THREE.ShaderMaterial({
      vertexShader: vert, fragmentShader: frag, side: THREE.DoubleSide,
      defines: kind === "flower" ? { FLOWER: 1 } : kind === "reed" ? { REED: 1 } : {},
      uniforms: {
        uCamPos: U.uCamPos, uSpacing: { value: spacing }, uRadius: { value: radius }, uTime: U.uTime, uWind: U.uWind, uDaylight: U.uDaylight,
        uHeightMap: U.uHeightMap, uWorldSize: U.uWorldSize, uLightDir: U.uLightDir, uLightColor: U.uLightColor, uSunIntensity: U.uSunIntensity,
        uHemiSky: U.uHemiSky, uHemiGround: U.uHemiGround, uFogColor: U.uFogColor, uFogDensity: U.uFogDensity, uWetness: U.uWetness,
      },
    });
    const m = new THREE.Mesh(geo, mat);
    m.frustumCulled = false;
    m.layers.set(1); // not mirrored in the lake
    m.renderOrder = 1;
    return m;
  }, [kind, count, radius]);
  useEffect(() => () => { mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose(); }, [mesh]);
  return <primitive object={mesh} />;
}

export function Grass() {
  const quality = useGame((s) => s.settings.quality);
  const q = QUALITY[quality];
  useEffect(() => { U.uHeightMap.value = heightmapTexture(); }, []);
  return (
    <>
      <GrassLayer kind="grass" count={Math.round(64000 * q.grass)} radius={46} />
      <GrassLayer kind="flower" count={Math.round(5200 * q.grass)} radius={40} />
      <GrassLayer kind="reed" count={9000} radius={110} />
    </>
  );
}

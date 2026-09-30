"use client";
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { U } from "@/lib/game/uniforms";
import { fogGLSL, noiseGLSL } from "@/lib/game/shaders/common";
import { heightmapGLSL } from "@/lib/world/heightmap";
import { tex } from "@/lib/game/textures";
import { world } from "@/lib/game/world";
import { BAMBOO, LAKE, LOOKOUT, MAPLE_GROVE, SAKURA, SHRINE, STATION, streamCenterX, terrainHeight, VILLAGE, lakeDist, WATER_LEVEL } from "@/lib/world/terrain";
import { mulberry32, range, smoothstep } from "@/lib/world/noise";
import { QUALITY, useGame } from "@/store/gameStore";
import { SMOKE_SOURCES } from "./Village";

// One vertex shader with defines for each particle kind. Particles that follow the
// camera live in a wrapping box; fireflies and smoke have fixed homes.

const vert = /* glsl */ `
precision highp float;
attribute vec4 aSeed; // xyz: -0.5..0.5 position seed, w: phase 0..1
attribute vec3 aHome; // fixed home (fireflies / smoke)
uniform vec3 uCamPos; uniform float uTime; uniform vec3 uWind; uniform vec3 uBox; uniform float uDensity; uniform float uNightGlow; uniform float uDaylight; uniform float uRain;
${heightmapGLSL}
${noiseGLSL}
varying vec2 vUv; varying float vAlpha; varying vec3 vColor; varying vec3 vWorld; varying float vGlow;
mat3 rotY(float a) { float c = cos(a), s = sin(a); return mat3(c, 0.0, -s, 0.0, 1.0, 0.0, s, 0.0, c); }
mat3 rotX(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
mat3 rotZ(float a) { float c = cos(a), s = sin(a); return mat3(c, s, 0.0, -s, c, 0.0, 0.0, 0.0, 1.0); }
void main() {
  vUv = uv;
  float ph = aSeed.w;
  vec3 world; float scale = 1.0; vAlpha = 1.0; vGlow = 0.0;
  #if defined(PETAL) || defined(LEAF)
    float fall = 0.45 + ph * 0.5;
    vec3 p = aSeed.xyz * uBox;
    p.y -= uTime * fall;
    p.xz += uWind.xy * uTime * (0.5 + uWind.z * 2.2) * (0.7 + 0.3 * ph);
    p.x += sin(uTime * 1.1 + ph * 25.0) * 0.7; p.z += cos(uTime * 0.8 + ph * 17.0) * 0.7;
    vec3 rel = mod(p - uCamPos + uBox * 0.5, uBox) - uBox * 0.5;
    world = uCamPos + rel;
    float ground = sampleTerrain(world.xz).x;
    float onGround = 0.0;
    if (world.y < ground + 0.03) { world.y = ground + 0.03; onGround = 1.0; }
    if (world.y < ${WATER_LEVEL.toFixed(1)} + 0.02 && ground < ${WATER_LEVEL.toFixed(1)}) { world.y = ${WATER_LEVEL.toFixed(1)} + 0.02; world.xz += uWind.xy * uTime * 0.3; onGround = 1.0; }
    // hide a share of the particles when there are few trees around
    scale = step(ph, uDensity);
    float near = smoothstep(0.6, 2.2, length(world - uCamPos));
    scale *= near;
    #ifdef PETAL
      float sz = 0.065;
      vColor = mix(vec3(1.0, 0.86, 0.9), vec3(0.98, 0.7, 0.8), ph);
    #else
      float sz = 0.13;
      vColor = mix(vec3(0.85, 0.35, 0.12), vec3(0.95, 0.7, 0.15), fract(ph * 7.0));
    #endif
    mat3 R = onGround > 0.5 ? rotY(ph * 6.28) * rotX(1.57) : rotY(uTime * 2.0 + ph * 9.0) * rotX(uTime * 1.6 + ph * 5.0) * rotZ(ph * 6.28);
    vec3 local = R * (position * sz * scale);
    world += local;
    vAlpha = 1.0;
  #elif defined(RAIN)
    float speed = 13.0 + ph * 4.0;
    vec3 p = aSeed.xyz * uBox;
    p.y -= uTime * speed;
    p.xz += uWind.xy * uTime * uWind.z * 3.0;
    vec3 rel = mod(p - uCamPos + uBox * 0.5, uBox) - uBox * 0.5;
    world = uCamPos + rel;
    float ground = sampleTerrain(world.xz).x;
    scale = step(ph, uRain) * step(ground, world.y);
    // slant with the wind, stretch along fall direction
    vec3 fallDir = normalize(vec3(uWind.x * uWind.z * 0.25, -1.0, uWind.y * uWind.z * 0.25));
    vec3 side = normalize(cross(fallDir, normalize(uCamPos - world) + vec3(0.0, 0.001, 0.0)));
    vec3 local = side * position.x * 0.012 + fallDir * position.y * (0.45 + ph * 0.3);
    world += local * scale;
    vColor = vec3(0.75, 0.8, 0.9);
    vAlpha = 0.28 * (1.0 - smoothstep(14.0, 26.0, length(world - uCamPos)));
  #elif defined(FIREFLY)
    vec3 home = aHome;
    float t = uTime * (0.25 + ph * 0.3);
    vec3 wander = vec3(sin(t + ph * 20.0) * 2.5 + sin(t * 2.3 + ph * 7.0) * 0.6, sin(t * 1.3 + ph * 11.0) * 0.8 + 0.9, cos(t * 0.9 + ph * 13.0) * 2.5 + cos(t * 2.7 + ph * 5.0) * 0.6);
    world = home + wander;
    float ground = sampleTerrain(world.xz).x;
    world.y = max(world.y, ground + 0.4);
    // emerge one by one as night deepens; blink softly
    float night = clamp((uNightGlow - 0.35) / 0.6, 0.0, 1.0) * (1.0 - uRain * 0.8);
    float appear = step(ph, night * night);
    float blink = 0.45 + 0.55 * pow(0.5 + 0.5 * sin(uTime * (1.2 + ph * 2.0) + ph * 40.0), 3.0);
    scale = appear;
    vGlow = blink * night;
    vec3 toCam = normalize(uCamPos - world);
    vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), toCam)); vec3 up = cross(toCam, right);
    world += (right * position.x + up * position.y) * 0.34 * scale;
    vColor = vec3(0.9, 1.0, 0.45);
    vAlpha = 1.0;
  #elif defined(SMOKE)
    float life = fract(uTime * 0.045 + ph);
    vec3 p = aHome;
    p.y += life * 9.0;
    p.xz += uWind.xy * life * life * 18.0 * (0.3 + uWind.z) + vec2(sin(uTime * 0.4 + ph * 30.0), cos(uTime * 0.3 + ph * 20.0)) * life * 0.8;
    world = p;
    float sz = 0.5 + life * 3.2;
    vec3 toCam = normalize(uCamPos - world);
    vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), toCam)); vec3 up = cross(toCam, right);
    mat3 R = rotZ(ph * 6.28 + uTime * 0.1);
    vec3 lp = R * position;
    world += (right * lp.x + up * lp.y) * sz;
    vAlpha = (1.0 - life) * (1.0 - life) * smoothstep(0.0, 0.12, life) * 0.09 * (0.5 + 0.5 * uDaylight) * (1.0 - uRain * 0.6);
    vColor = vec3(0.85, 0.85, 0.88);
  #endif
  vWorld = world;
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}`;

const frag = /* glsl */ `
precision highp float;
uniform sampler2D uMap; uniform vec3 uHemiSky; uniform vec3 uHemiGround; uniform vec3 uLightColor; uniform float uSunIntensity; uniform vec3 uLightDir; uniform vec3 uCamPos;
varying vec2 vUv; varying float vAlpha; varying vec3 vColor; varying vec3 vWorld; varying float vGlow;
${fogGLSL}
void main() {
  vec4 t = texture2D(uMap, vUv);
  #ifdef FIREFLY
    float d = length(vUv - 0.5) * 2.0;
    float core = smoothstep(0.22, 0.0, d);
    float halo = smoothstep(1.0, 0.1, d) * 0.28;
    vec3 fc = vColor * (core * 3.5 + halo) * vGlow;
    gl_FragColor = vec4(fc, (core + halo) * vGlow);
    return;
  #endif
  #ifdef SMOKE
    float a = t.a * vAlpha;
    vec3 sc = vColor * (uHemiSky * 0.7 + uLightColor * uSunIntensity * 0.15 + 0.35);
    sc = applyFog(sc, length(uCamPos - vWorld));
    gl_FragColor = vec4(sc, a);
    return;
  #endif
  #ifdef RAIN
    float a = vAlpha * (1.0 - abs(vUv.x - 0.5) * 2.0) * smoothstep(0.0, 0.2, vUv.y) * smoothstep(1.0, 0.8, vUv.y);
    gl_FragColor = vec4(vColor * (uHemiSky + 0.2), a);
    return;
  #endif
  if (t.a < 0.5) discard;
  vec3 amb = mix(uHemiGround, uHemiSky, 0.6);
  vec3 col = vColor * (amb + uLightColor * uSunIntensity * 0.32);
  col = applyFog(col, length(uCamPos - vWorld));
  gl_FragColor = vec4(col, 1.0);
}`;

type Kind = "PETAL" | "LEAF" | "RAIN" | "FIREFLY" | "SMOKE";

function makeSystem(kind: Kind, count: number, homes?: Float32Array, box = new THREE.Vector3(60, 26, 60)) {
  const geo = new THREE.InstancedBufferGeometry();
  const quad = new THREE.PlaneGeometry(1, 1);
  geo.index = quad.index; geo.setAttribute("position", quad.attributes.position); geo.setAttribute("uv", quad.attributes.uv);
  const rng = mulberry32(kind.length * 977 + count);
  const seeds = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) { seeds[i * 4] = rng() - 0.5; seeds[i * 4 + 1] = rng() - 0.5; seeds[i * 4 + 2] = rng() - 0.5; seeds[i * 4 + 3] = rng(); }
  geo.setAttribute("aSeed", new THREE.InstancedBufferAttribute(seeds, 4));
  geo.setAttribute("aHome", new THREE.InstancedBufferAttribute(homes ?? new Float32Array(count * 3), 3));
  geo.instanceCount = count;
  const map = kind === "PETAL" ? tex.petal() : kind === "LEAF" ? tex.leaf() : tex.soft();
  const mat = new THREE.ShaderMaterial({
    vertexShader: vert, fragmentShader: frag, defines: { [kind]: 1 },
    transparent: kind !== "PETAL" && kind !== "LEAF", depthWrite: kind === "PETAL" || kind === "LEAF",
    blending: kind === "FIREFLY" ? THREE.AdditiveBlending : THREE.NormalBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uCamPos: U.uCamPos, uTime: U.uTime, uWind: U.uWind, uBox: { value: box }, uDensity: { value: 1 }, uNightGlow: U.uNightGlow, uDaylight: U.uDaylight, uRain: U.uRain,
      uHeightMap: U.uHeightMap, uWorldSize: U.uWorldSize, uMap: { value: map }, uHemiSky: U.uHemiSky, uHemiGround: U.uHemiGround, uLightColor: U.uLightColor, uSunIntensity: U.uSunIntensity, uLightDir: U.uLightDir,
      uFogColor: U.uFogColor, uFogDensity: U.uFogDensity,
    },
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.layers.set(1);
  mesh.renderOrder = kind === "FIREFLY" ? 8 : kind === "SMOKE" ? 6 : 3;
  return mesh;
}

/** How "sakura" the surroundings are, 0..1 — drives petal density. */
function sakuraDensity(x: number, z: number) {
  const s = smoothstep(95, 30, Math.hypot(x - SAKURA.x, z - SAKURA.z));
  const l = smoothstep(55, 15, Math.hypot(x - LOOKOUT.x, z - LOOKOUT.z));
  const shore = smoothstep(150, 100, lakeDist(x, z)) * 0.35;
  const v = smoothstep(90, 60, Math.hypot(x - VILLAGE.x, z - VILLAGE.z)) * 0.3;
  return Math.min(1, Math.max(s, l, shore, v, 0.08));
}
function mapleDensity(x: number, z: number) {
  return smoothstep(60, 20, Math.hypot(x - MAPLE_GROVE.x, z - MAPLE_GROVE.z));
}

export function Particles() {
  const quality = useGame((s) => s.settings.quality);
  const q = QUALITY[quality];
  const petals = useMemo(() => makeSystem("PETAL", Math.round(3800 * q.particles)), [q.particles]);
  const leaves = useMemo(() => makeSystem("LEAF", Math.round(700 * q.particles), undefined, new THREE.Vector3(50, 22, 50)), [q.particles]);
  const rain = useMemo(() => makeSystem("RAIN", Math.round(9000 * q.particles), undefined, new THREE.Vector3(34, 22, 34)), [q.particles]);
  const fireflies = useMemo(() => {
    const rng = mulberry32(555);
    const homes: number[] = [];
    const add = (cx: number, cz: number, r: number, n: number, ymin = 0.6, ymax = 2.2) => {
      for (let i = 0; i < n; i++) {
        const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * r;
        const x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
        const g = terrainHeight(x, z);
        homes.push(x, Math.max(g, WATER_LEVEL) + range(rng, ymin, ymax), z);
      }
    };
    add(SHRINE.x, SHRINE.z - 2, 30, 150, 0.8, 3.5);
    add(0, -238, 12, 40, 1, 3);
    add(BAMBOO.x, BAMBOO.z + 40, 25, 50);
    add(SAKURA.x, SAKURA.z, 60, 90);
    add(MAPLE_GROVE.x, MAPLE_GROVE.z, 28, 50);
    for (let z = 110; z < 360; z += 25) add(streamCenterX(z), z, 9, 12, 0.4, 1.6);
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; add(LAKE.x + Math.cos(a) * 100, LAKE.z + Math.sin(a) * 100, 14, 10, 0.4, 1.8); }
    add(VILLAGE.x, VILLAGE.z, 60, 25);
    const count = homes.length / 3;
    return makeSystem("FIREFLY", count, new Float32Array(homes));
  }, []);
  const smoke = useMemo(() => {
    const homes: number[] = [];
    const per = 22;
    for (const s of SMOKE_SOURCES) for (let i = 0; i < per; i++) homes.push(s.x, s.y, s.z);
    // station stove + a fire at the terrace hut
    for (let i = 0; i < per; i++) homes.push(STATION.x - 4, STATION.height + 4.8, STATION.trackZ - 9.5);
    return makeSystem("SMOKE", homes.length / 3, new Float32Array(homes));
  }, []);
  const density = useRef({ petal: 1, leaf: 0 });

  useEffect(() => () => { for (const m of [petals, leaves, rain, fireflies, smoke]) { m.geometry.dispose(); (m.material as THREE.Material).dispose(); } }, [petals, leaves, rain, fireflies, smoke]);

  useFrame((_, dt) => {
    const p = world.player.pos;
    const target = sakuraDensity(p.x, p.z) * (0.6 + world.windStrength * 0.7) * (1 - world.rain * 0.6);
    density.current.petal += (Math.min(1, target) - density.current.petal) * Math.min(1, dt * 0.8);
    const leafT = Math.min(1, mapleDensity(p.x, p.z) * 0.9 + Math.max(0, world.windStrength - 0.55) * 0.5);
    density.current.leaf += (leafT - density.current.leaf) * Math.min(1, dt * 0.8);
    (petals.material as THREE.ShaderMaterial).uniforms.uDensity.value = density.current.petal;
    (leaves.material as THREE.ShaderMaterial).uniforms.uDensity.value = density.current.leaf;
    rain.visible = world.rain > 0.01;
    fireflies.visible = world.lanternGlow > 0.36;
  });

  return (
    <>
      <primitive object={petals} />
      <primitive object={leaves} />
      <primitive object={rain} />
      <primitive object={fireflies} />
      <primitive object={smoke} />
    </>
  );
}

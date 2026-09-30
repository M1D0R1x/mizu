"use client";
import { useMemo } from "react";
import * as THREE from "three";
import { U } from "@/lib/game/uniforms";
import { tex } from "@/lib/game/textures";
import { LAKE, lakeDist, streamCenterX, terrainHeight, WATER_LEVEL, MAPLE_GROVE, SAKURA, BAMBOO } from "@/lib/world/terrain";
import { mulberry32, range } from "@/lib/world/noise";
import { noiseGLSL } from "@/lib/game/shaders/common";

// Layered ground fog: soft horizontal sheets that drift with the wind and
// thicken at dawn, in misty weather, after rain and at night over water.

const vert = /* glsl */ `
attribute vec4 aInfo; // x: phase, y: scale, z: water(1)/land(0), w: seed
uniform float uTime; uniform vec3 uWind;
varying vec2 vUv; varying float vFade; varying vec3 vWorld; varying float vWater;
void main() {
  vUv = uv;
  vec4 center = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
  center.xz += uWind.xy * sin(uTime * 0.05 + aInfo.x) * 6.0 * (0.4 + uWind.z);
  center.y += sin(uTime * 0.2 + aInfo.x) * 0.25;
  // upright billboard facing the camera
  vec3 toCam = cameraPosition - center.xyz; toCam.y = 0.0; toCam = normalize(toCam + vec3(0.0001));
  vec3 right = vec3(-toCam.z, 0.0, toCam.x);
  vec4 wp = vec4(center.xyz + right * position.x * aInfo.y + vec3(0.0, 1.0, 0.0) * position.y * aInfo.y * 0.28, 1.0);
  vWorld = wp.xyz; vWater = aInfo.z;
  float d = length(wp.xyz - cameraPosition);
  vFade = smoothstep(4.0, 22.0, d) * (1.0 - smoothstep(260.0, 420.0, d));
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const frag = /* glsl */ `
uniform sampler2D uMap; uniform float uMist; uniform float uDaylight; uniform float uTime; uniform float uWetness; uniform float uRain;
uniform vec3 uFogColor; uniform vec3 uHorizon;
varying vec2 vUv; varying float vFade; varying vec3 vWorld; varying float vWater;
${noiseGLSL}
void main() {
  float a = texture2D(uMap, vUv).a;
  float n = fbm(vUv * 3.0 + vec2(uTime * 0.01, 0.0)) * 0.6 + 0.4;
  float dawnNight = (1.0 - uDaylight) * 0.35;
  float amount = clamp(uMist * 1.1 + dawnNight * vWater + uWetness * 0.25 * (1.0 - uRain) + 0.025, 0.0, 1.0);
  float alpha = a * n * vFade * amount * 0.5;
  vec3 col = mix(uFogColor, uHorizon, 0.4) * (0.75 + 0.25 * uDaylight);
  gl_FragColor = vec4(col, alpha);
}`;

export function Mist() {
  const mesh = useMemo(() => {
    const rng = mulberry32(31337);
    const items: { x: number; y: number; z: number; s: number; water: number }[] = [];
    // sheets over the lake
    for (let i = 0; i < 46; i++) {
      const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * 105;
      const x = LAKE.x + Math.cos(a) * r, z = LAKE.z + Math.sin(a) * r;
      items.push({ x, y: Math.max(WATER_LEVEL, terrainHeight(x, z)) + range(rng, 0.8, 2.6), z, s: range(rng, 22, 44), water: lakeDist(x, z) < 92 ? 1 : 0.4 });
    }
    // along the stream
    for (let z = 110; z < 370; z += 14) { const x = streamCenterX(z) + range(rng, -5, 5); items.push({ x, y: terrainHeight(x, z) + range(rng, 1.2, 2.4), z, s: range(rng, 14, 24), water: 0.8 }); }
    // valleys and groves
    for (const c of [SAKURA, MAPLE_GROVE, BAMBOO, { x: -80, z: 260 }, { x: 120, z: 240 }, { x: -240, z: 60 }]) for (let i = 0; i < 6; i++) {
      const x = c.x + range(rng, -45, 45), z = c.z + range(rng, -45, 45);
      items.push({ x, y: terrainHeight(x, z) + range(rng, 1.5, 4), z, s: range(rng, 24, 40), water: 0.25 });
    }
    // mountain flanks: high haze bands
    for (let i = 0; i < 16; i++) { const a = rng() * Math.PI * 2, r = range(rng, 240, 330); const x = Math.cos(a) * r, z = Math.sin(a) * r; items.push({ x, y: terrainHeight(x, z) + range(rng, 6, 14), z, s: range(rng, 60, 110), water: 0.5 }); }
    const geo = new THREE.InstancedBufferGeometry();
    const plane = new THREE.PlaneGeometry(1, 1);
    geo.index = plane.index; geo.setAttribute("position", plane.attributes.position); geo.setAttribute("uv", plane.attributes.uv);
    const info = new Float32Array(items.length * 4);
    const mat = new THREE.ShaderMaterial({
      vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false,
      uniforms: { uTime: U.uTime, uWind: U.uWind, uMap: { value: tex.mist() }, uMist: U.uMist, uDaylight: U.uDaylight, uWetness: U.uWetness, uRain: U.uRain, uFogColor: U.uFogColor, uHorizon: U.uHorizon },
    });
    const im = new THREE.InstancedMesh(geo, mat, items.length);
    const tm = new THREE.Matrix4();
    items.forEach((it, i) => {
      tm.makeTranslation(it.x, it.y, it.z);
      im.setMatrixAt(i, tm);
      info[i * 4] = rng() * 6.28; info[i * 4 + 1] = it.s; info[i * 4 + 2] = it.water; info[i * 4 + 3] = rng();
    });
    geo.setAttribute("aInfo", new THREE.InstancedBufferAttribute(info, 4));
    im.frustumCulled = false; im.renderOrder = 5; im.layers.set(1);
    return im;
  }, []);
  return <primitive object={mesh} />;
}

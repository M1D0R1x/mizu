"use client";
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { U } from "@/lib/game/uniforms";
import { fogGLSL, noiseGLSL, skyGLSL, skyUniformsGLSL } from "@/lib/game/shaders/common";
import { LAKE, terrainHeight, WATER_LEVEL } from "@/lib/world/terrain";
import { QUALITY, useGame } from "@/store/gameStore";
import { world } from "@/lib/game/world";

const vert = /* glsl */ `
attribute float aDepth;
varying vec3 vWorld; varying float vDepth; varying vec4 vReflUv;
uniform mat4 uTextureMatrix; uniform float uTime; uniform vec3 uWind;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  // very gentle swell
  wp.y += sin(wp.x * 0.15 + uTime * 0.7) * cos(wp.z * 0.13 + uTime * 0.5) * 0.04 * uWind.z;
  vWorld = wp.xyz; vDepth = aDepth;
  vReflUv = uTextureMatrix * wp;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const frag = /* glsl */ `
precision highp float;
varying vec3 vWorld; varying float vDepth; varying vec4 vReflUv;
${skyUniformsGLSL}
${noiseGLSL}
${skyGLSL}
${fogGLSL}
uniform sampler2D uReflection; uniform float uUseReflection; uniform float uRain; uniform float uNightGlow;
uniform vec3 uShallow; uniform vec3 uDeep; uniform float uScale; uniform float uFlow;

// analytic wave field: returns height and gradient
vec3 waves(vec2 p, float t) {
  float amp = 0.015 + uWind.z * 0.045;
  vec2 d1 = normalize(uWind.xy + vec2(0.3, 0.1)), d2 = normalize(uWind.xy + vec2(-0.6, 0.8)), d3 = vec2(0.7, -0.7), d4 = normalize(vec2(-0.2, 1.0));
  float h = 0.0; vec2 g = vec2(0.0);
  float k1 = 0.9 * uScale, k2 = 1.7 * uScale, k3 = 3.1 * uScale, k4 = 5.3 * uScale;
  float p1 = dot(p, d1) * k1 + t * 1.1, p2 = dot(p, d2) * k2 - t * 1.6, p3 = dot(p, d3) * k3 + t * 2.3, p4 = dot(p, d4) * k4 - t * 2.9;
  h += sin(p1) * amp; g += d1 * k1 * cos(p1) * amp;
  h += sin(p2) * amp * 0.6; g += d2 * k2 * cos(p2) * amp * 0.6;
  h += sin(p3) * amp * 0.25; g += d3 * k3 * cos(p3) * amp * 0.25;
  h += sin(p4) * amp * 0.12; g += d4 * k4 * cos(p4) * amp * 0.12;
  return vec3(h, g);
}
vec2 rainRipples(vec2 p, float t) {
  vec2 g = vec2(0.0);
  for (int i = 0; i < 2; i++) {
    vec2 q = p * 0.8 + float(i) * 13.7;
    vec2 cell = floor(q), f = fract(q) - 0.5;
    float h = hash12(cell + float(i));
    vec2 c = vec2(hash12(cell + 3.1), hash12(cell + 7.7)) - 0.5;
    float ph = fract(t * (0.8 + h * 0.6) + h * 7.0);
    float r = length(f - c * 0.6);
    float ring = sin((r - ph * 0.9) * 40.0) * exp(-r * 6.0) * (1.0 - ph) * step(r, ph * 0.9 + 0.05);
    g += normalize(f - c * 0.6 + 1e-4) * ring;
  }
  return g;
}
void main() {
  vec3 V = normalize(cameraPosition - vWorld);
  float dist = length(cameraPosition - vWorld);
  float t = uTime * uFlow;
  vec2 p = vWorld.xz;
  vec3 w = waves(p, t);
  // fine ripples from noise
  float e = 0.35;
  float n0 = fbm(p * 0.9 + uWind.xy * t * 0.35), nx = fbm((p + vec2(e, 0.0)) * 0.9 + uWind.xy * t * 0.35), nz = fbm((p + vec2(0.0, e)) * 0.9 + uWind.xy * t * 0.35);
  vec2 grad = w.yz + vec2(nx - n0, nz - n0) * (0.5 + uWind.z * 1.6) / e * 0.11;
  grad += rainRipples(p, uTime) * uRain * 0.7;
  // reduce detail in the distance so it doesn't alias
  float detail = 1.0 / (1.0 + dist * 0.012);
  vec3 N = normalize(vec3(-grad.x * detail, 1.0, -grad.y * detail));

  vec3 R = reflect(-V, N);
  R.y = abs(R.y) + 0.02;
  vec3 skyRefl = skyColor(normalize(R));
  vec3 refl = skyRefl;
  if (uUseReflection > 0.5) {
    vec2 uv = vReflUv.xy / vReflUv.w;
    uv += N.xz * 0.06 * detail;
    uv = clamp(uv, 0.001, 0.999);
    vec3 tex = texture2D(uReflection, uv).rgb;
    refl = mix(skyRefl, tex, uUseReflection);
  }

  float NdV = max(dot(N, V), 0.0);
  float fresnel = 0.09 + 0.91 * pow(1.0 - NdV, 2.8);
  vec3 ambient = mix(uHorizon, uZenith, 0.35) * (0.55 + 0.45 * uDaylight) + vec3(0.02, 0.03, 0.05);
  vec3 body = mix(uShallow, uDeep, smoothstep(0.0, 9.0, vDepth)) * ambient * 0.85;
  // sun sparkle
  float sunUp = smoothstep(-0.05, 0.05, uSunDir.y);
  float spec = pow(max(dot(R, uSunDir), 0.0), 380.0 - uWind.z * 200.0) * sunUp * (1.0 - uCloud * 0.85);
  float moonUp = smoothstep(-0.02, 0.05, uMoonDir.y);
  float mspec = pow(max(dot(R, uMoonDir), 0.0), 300.0) * moonUp * (1.0 - uDaylight) * (1.0 - uCloud * 0.85);
  vec3 col = mix(body, refl, fresnel);
  col += uSunColor * spec * 3.0 + uMoonColor * mspec * 0.9;
  col *= (1.0 - uRain * 0.15);
  col = applyFog(col, dist);
  float alpha = smoothstep(0.0, 0.7, vDepth);
  gl_FragColor = vec4(col, alpha);
}`;

export function createWaterMaterial(opts: { reflection?: boolean; shallow?: THREE.ColorRepresentation; deep?: THREE.ColorRepresentation; scale?: number; flow?: number } = {}) {
  return new THREE.ShaderMaterial({
    vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false,
    uniforms: {
      uSunDir: U.uSunDir, uMoonDir: U.uMoonDir, uZenith: U.uZenith, uHorizon: U.uHorizon, uSunColor: U.uSunColor, uMoonColor: U.uMoonColor,
      uSunGlow: U.uSunGlow, uStars: U.uStars, uCloud: U.uCloud, uTime: U.uTime, uDaylight: U.uDaylight, uCloudBright: U.uCloudBright, uCloudDark: U.uCloudDark,
      uWind: U.uWind, uFogColor: U.uFogColor, uFogDensity: U.uFogDensity, uRain: U.uRain, uNightGlow: U.uNightGlow,
      uReflection: { value: null }, uUseReflection: { value: opts.reflection ? 1 : 0 }, uTextureMatrix: { value: new THREE.Matrix4() },
      uShallow: { value: new THREE.Color(opts.shallow ?? 0x3a7a6a) }, uDeep: { value: new THREE.Color(opts.deep ?? 0x14384a) },
      uScale: { value: opts.scale ?? 1 }, uFlow: { value: opts.flow ?? 1 },
    },
  });
}

function buildLakeGeometry() {
  const size = 270, seg = 90;
  const g = new THREE.PlaneGeometry(size, size, seg, seg);
  g.rotateX(-Math.PI / 2);
  g.translate(LAKE.x, WATER_LEVEL, LAKE.z);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const depth = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) depth[i] = Math.max(0, WATER_LEVEL - terrainHeight(pos.getX(i), pos.getZ(i)));
  g.setAttribute("aDepth", new THREE.BufferAttribute(depth, 1));
  return g;
}

export const REFLECT_LAYER = 0; // objects on layer 0 are mirrored; particles/grass live on layer 1

export function Lake() {
  const quality = useGame((s) => s.settings.quality);
  const useReflection = QUALITY[quality].reflections;
  const { gl, scene, camera } = useThree();
  const mesh = useRef<THREE.Mesh>(null!);
  const geo = useMemo(buildLakeGeometry, []);
  const mat = useMemo(() => createWaterMaterial({ reflection: true }), []);
  const rt = useMemo(() => new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType }), []);
  const virtualCamera = useMemo(() => new THREE.PerspectiveCamera(), []);
  const tmp = useMemo(() => ({
    normal: new THREE.Vector3(0, 1, 0), view: new THREE.Vector3(), target: new THREE.Vector3(), lookAt: new THREE.Vector3(),
    q: new THREE.Quaternion(), plane: new THREE.Plane(), clip: new THREE.Vector4(), qc: new THREE.Vector4(), pos: new THREE.Vector3(LAKE.x, WATER_LEVEL, LAKE.z),
    textureMatrix: new THREE.Matrix4(),
  }), []);

  useEffect(() => {
    camera.layers.enable(1);
    mat.uniforms.uUseReflection.value = useReflection ? 1 : 0;
  }, [camera, mat, useReflection]);
  useEffect(() => () => rt.dispose(), [rt]);

  useFrame((state) => {
    if (!useReflection) return;
    // don't reflect if far away (reflection detail not visible) or under water
    const cam = state.camera as THREE.PerspectiveCamera;
    const distToLake = Math.hypot(cam.position.x - LAKE.x, cam.position.z - LAKE.z);
    const active = distToLake < 260 && cam.position.y > WATER_LEVEL;
    mat.uniforms.uUseReflection.value = active ? 1 : 0;
    if (!active) return;
    const w = Math.floor(state.size.width * state.viewport.dpr * 0.4), h = Math.floor(state.size.height * state.viewport.dpr * 0.4);
    if (rt.width !== w || rt.height !== h) rt.setSize(w, h);
    const { normal, view, target, lookAt, plane, clip, qc, pos, textureMatrix } = tmp;
    view.subVectors(pos, cam.position);
    view.reflect(normal).negate().add(pos);
    lookAt.set(0, 0, -1).applyQuaternion(cam.quaternion).add(cam.position);
    target.subVectors(pos, lookAt).reflect(normal).negate().add(pos);
    virtualCamera.position.copy(view);
    virtualCamera.up.set(0, 1, 0).applyQuaternion(cam.quaternion).reflect(normal);
    virtualCamera.lookAt(target);
    virtualCamera.far = cam.far; virtualCamera.near = cam.near;
    virtualCamera.updateMatrixWorld();
    virtualCamera.projectionMatrix.copy(cam.projectionMatrix);
    textureMatrix.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1);
    textureMatrix.multiply(virtualCamera.projectionMatrix).multiply(virtualCamera.matrixWorldInverse);
    mat.uniforms.uTextureMatrix.value.copy(textureMatrix);
    // oblique near plane so things under the surface don't leak into the mirror
    plane.setFromNormalAndCoplanarPoint(normal, pos).applyMatrix4(virtualCamera.matrixWorldInverse);
    clip.set(plane.normal.x, plane.normal.y, plane.normal.z, plane.constant);
    const pm = virtualCamera.projectionMatrix;
    qc.x = (Math.sign(clip.x) + pm.elements[8]) / pm.elements[0];
    qc.y = (Math.sign(clip.y) + pm.elements[9]) / pm.elements[5];
    qc.z = -1; qc.w = (1 + pm.elements[10]) / pm.elements[14];
    clip.multiplyScalar(2 / clip.dot(qc));
    pm.elements[2] = clip.x; pm.elements[6] = clip.y; pm.elements[10] = clip.z + 1 - 0.003; pm.elements[14] = clip.w;
    virtualCamera.layers.set(REFLECT_LAYER);

    mesh.current.visible = false;
    const prevRT = gl.getRenderTarget();
    const prevShadow = gl.shadowMap.autoUpdate;
    gl.shadowMap.autoUpdate = false;
    gl.setRenderTarget(rt);
    gl.clear();
    gl.render(scene, virtualCamera);
    gl.setRenderTarget(prevRT);
    gl.shadowMap.autoUpdate = prevShadow;
    mesh.current.visible = true;
    mat.uniforms.uReflection.value = rt.texture;
    void world;
  }, -5);

  return <mesh ref={mesh} geometry={geo} material={mat} renderOrder={2} frustumCulled={false} />;
}

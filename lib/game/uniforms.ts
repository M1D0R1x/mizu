// Shared shader uniforms. Every custom material references these same objects,
// so one update per frame in LightingSystem propagates to every shader.
import * as THREE from "three";

export const U = {
  uTime: { value: 0 },
  uWind: { value: new THREE.Vector3(0.8, 0.45, 0.35) }, // xy = direction (x,z), z = strength
  uCamPos: { value: new THREE.Vector3() },
  uSunDir: { value: new THREE.Vector3(0, 1, 0) },
  uMoonDir: { value: new THREE.Vector3(0, -1, 0) },
  uZenith: { value: new THREE.Color(0.2, 0.45, 0.9) },
  uHorizon: { value: new THREE.Color(0.75, 0.85, 0.95) },
  uSunColor: { value: new THREE.Color(1, 0.95, 0.85) },
  uSunGlow: { value: 1 },
  uStars: { value: 0 },
  uCloud: { value: 0.3 },
  uCloudBright: { value: new THREE.Color(1, 1, 1) },
  uCloudDark: { value: new THREE.Color(0.6, 0.65, 0.75) },
  uRain: { value: 0 },
  uMist: { value: 0 },
  uWetness: { value: 0 },
  uDaylight: { value: 1 },
  uNightGlow: { value: 0 }, // lantern / firefly intensity
  uFogColor: { value: new THREE.Color(0.75, 0.85, 0.95) },
  uFogDensity: { value: 0.002 },
  uMoonColor: { value: new THREE.Color(0.6, 0.7, 1.0) },
  uHemiSky: { value: new THREE.Color(0.5, 0.6, 0.8) },
  uHemiGround: { value: new THREE.Color(0.3, 0.25, 0.2) },
  uSunIntensity: { value: 3 },
  uLightDir: { value: new THREE.Vector3(0, 1, 0) }, // active key light (sun or moon)
  uLightColor: { value: new THREE.Color(1, 1, 1) },
  uHeightMap: { value: null as THREE.Texture | null },
  uWorldSize: { value: 800 },
};

export type GlobalUniforms = typeof U;

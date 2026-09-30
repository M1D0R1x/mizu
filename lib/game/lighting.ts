// Continuous cinematic lighting driven by sun elevation + time + weather.
import * as THREE from "three";
import { world } from "./world";
import { U } from "./uniforms";
import { clamp, lerp, smoothstep } from "@/lib/world/noise";

const C = (r: number, g: number, b: number) => new THREE.Color(r, g, b);

// palette
const P = {
  dayZenith: C(0.16, 0.38, 0.82),
  dayHorizon: C(0.7, 0.82, 0.94),
  duskZenith: C(0.12, 0.17, 0.42),
  sunsetHorizon: C(1.0, 0.5, 0.28),
  dawnHorizon: C(0.98, 0.7, 0.62),
  blueZenith: C(0.06, 0.08, 0.24),
  blueHorizon: C(0.35, 0.36, 0.6),
  nightZenith: C(0.012, 0.018, 0.05),
  nightHorizon: C(0.07, 0.09, 0.17),
  overcastZenith: C(0.4, 0.44, 0.5),
  overcastHorizon: C(0.6, 0.62, 0.66),
  sunNoon: C(1.0, 0.97, 0.9),
  sunLow: C(1.0, 0.62, 0.3),
  sunDawn: C(1.0, 0.8, 0.62),
  moon: C(0.55, 0.65, 0.95),
};

export interface LightingState {
  sunColor: THREE.Color;
  sunIntensity: number;
  lightDir: THREE.Vector3; // direction of the active key light (sun or moon)
  hemiSky: THREE.Color;
  hemiGround: THREE.Color;
  hemiIntensity: number;
  fogColor: THREE.Color;
  fogDensity: number;
  exposure: number;
  bloom: number;
}

export const lighting: LightingState = {
  sunColor: new THREE.Color(),
  sunIntensity: 3,
  lightDir: new THREE.Vector3(0, 1, 0),
  hemiSky: new THREE.Color(),
  hemiGround: new THREE.Color(),
  hemiIntensity: 1,
  fogColor: new THREE.Color(),
  fogDensity: 0.002,
  exposure: 1,
  bloom: 0.6,
};

const tmpA = new THREE.Color(), tmpB = new THREE.Color();

export const SUNRISE = 5.6, SUNSET = 18.8;
export function updateSunMoon() {
  // day and night each map onto half a circle so sunrise/sunset land where we want them
  const t = world.time;
  const theta = t >= SUNRISE && t < SUNSET
    ? ((t - SUNRISE) / (SUNSET - SUNRISE)) * Math.PI
    : Math.PI + (((t < SUNRISE ? t + 24 : t) - SUNSET) / (24 - (SUNSET - SUNRISE))) * Math.PI;
  world.sunDir.set(Math.cos(theta), Math.sin(theta) * 0.82, Math.sin(theta) * 0.55).normalize();
  world.moonDir.set(-Math.cos(theta) * 0.9 + 0.2, -Math.sin(theta) * 0.7 + 0.15, -Math.sin(theta) * 0.6 - 0.3).normalize();
  U.uSunDir.value.copy(world.sunDir);
  U.uMoonDir.value.copy(world.moonDir);
}

export function evaluateLighting() {
  updateSunMoon();
  const e = world.sunDir.y; // -1..1
  const daylight = smoothstep(-0.1, 0.16, e);
  const horizonBand = Math.exp(-(e * e) / (0.16 * 0.16)) * smoothstep(-0.25, -0.02, e); // strong near horizon
  const afternoon = smoothstep(11, 14, world.time) * smoothstep(23.5, 21, world.time);
  const blueHour = Math.exp(-((e + 0.12) * (e + 0.12)) / (0.08 * 0.08));
  const night = 1 - smoothstep(-0.22, -0.05, e);
  const rain = world.rain;
  const overcast = clamp(rain * 1.1 + world.mist * 0.55 + Math.max(0, world.cloud - 0.5) * 0.6, 0, 1);

  world.daylight = daylight;
  world.lanternGlow = clamp(1 - smoothstep(-0.12, 0.06, e), 0, 1) + overcast * 0.35 * daylight;
  world.lanternGlow = clamp(world.lanternGlow, 0, 1);

  // sky colours
  const zen = tmpA.copy(P.nightZenith).lerp(P.dayZenith, daylight);
  zen.lerp(P.duskZenith, horizonBand * 0.7 * daylight);
  zen.lerp(P.blueZenith, blueHour * (1 - daylight) * 0.8);
  zen.lerp(P.overcastZenith, overcast * daylight * 0.85);
  zen.lerp(P.nightZenith, overcast * (1 - daylight) * 0.4);

  const warmHorizon = tmpB.copy(P.dawnHorizon).lerp(P.sunsetHorizon, afternoon);
  const hor = new THREE.Color().copy(P.nightHorizon).lerp(P.dayHorizon, daylight);
  hor.lerp(warmHorizon, horizonBand * 0.95);
  hor.lerp(P.blueHorizon, blueHour * 0.7);
  hor.lerp(P.overcastHorizon, overcast * daylight * 0.9);
  hor.lerp(P.nightHorizon, overcast * (1 - daylight) * 0.5);

  U.uZenith.value.copy(zen);
  U.uHorizon.value.copy(hor);

  // sun
  const sunCol = lighting.sunColor.copy(P.sunNoon).lerp(afternoon > 0.5 ? P.sunLow : P.sunDawn, clamp(1.3 - e * 2.6, 0, 1) * 0.9);
  sunCol.lerp(C(0.8, 0.82, 0.88), overcast * 0.8);
  U.uSunColor.value.copy(sunCol);
  U.uSunGlow.value = lerp(0.6, 1.6, horizonBand) * (1 - overcast * 0.7);
  U.uStars.value = night * (1 - overcast) * (1 - world.mist * 0.5);
  U.uCloud.value = clamp(world.cloud + rain * 0.5 + world.mist * 0.25, 0, 1);
  U.uCloudBright.value.copy(C(1, 1, 1)).lerp(sunCol, horizonBand * 0.8).lerp(C(0.1, 0.1, 0.14), night * 0.92).lerp(C(0.55, 0.56, 0.6), overcast * daylight * 0.7);
  U.uCloudDark.value.copy(C(0.55, 0.62, 0.8)).lerp(C(0.45, 0.28, 0.4), horizonBand * 0.6).lerp(C(0.03, 0.03, 0.06), night * 0.9).lerp(C(0.3, 0.31, 0.35), overcast * daylight * 0.8);
  U.uRain.value = rain;
  U.uMist.value = world.mist;
  U.uWetness.value = world.wetness;
  U.uDaylight.value = daylight;
  U.uNightGlow.value = world.lanternGlow;
  U.uMoonColor.value.copy(P.moon);

  // key light
  const sunUp = smoothstep(-0.04, 0.08, e);
  if (sunUp > 0.5) {
    lighting.lightDir.copy(world.sunDir);
    lighting.sunIntensity = lerp(0.2, 2.4, smoothstep(-0.02, 0.35, e)) * (1 - overcast * 0.9);
  } else {
    lighting.lightDir.copy(world.moonDir);
    lighting.sunColor.copy(P.moon);
    lighting.sunIntensity = 0.5 * (1 - overcast * 0.6) * smoothstep(0.5, 0, sunUp);
  }

  // ambient
  lighting.hemiSky.copy(zen).lerp(hor, 0.6).multiplyScalar(1.15);
  lighting.hemiGround.copy(C(0.36, 0.31, 0.24)).lerp(hor, 0.4).multiplyScalar(lerp(0.35, 1, daylight));
  lighting.hemiIntensity = lerp(0.85, 1.25, daylight) * (1 + overcast * 0.5);
  U.uHemiSky.value.copy(lighting.hemiSky).multiplyScalar(lighting.hemiIntensity);
  U.uHemiGround.value.copy(lighting.hemiGround).multiplyScalar(lighting.hemiIntensity);
  U.uSunIntensity.value = lighting.sunIntensity;
  U.uLightDir.value.copy(lighting.lightDir);
  U.uLightColor.value.copy(lighting.sunColor);

  // fog
  lighting.fogColor.copy(hor).lerp(zen, 0.18 + 0.2 * night);
  lighting.fogColor.lerp(C(0.72, 0.74, 0.78), world.mist * daylight * 0.35);
  // alpenglow: distant ridges catch the low sun
  lighting.fogColor.lerp(sunCol, horizonBand * 0.3 * (1 - overcast));
  lighting.fogDensity = 0.00105 + world.mist * 0.0028 + rain * 0.0015 + night * 0.0004 + horizonBand * 0.0003;
  U.uFogColor.value.copy(lighting.fogColor);
  U.uFogDensity.value = lighting.fogDensity;

  lighting.exposure = lerp(1.2, 1.0, daylight) * (1 - overcast * 0.05);
  lighting.bloom = lerp(1.1, 0.55, daylight) + horizonBand * 0.3;
  return lighting;
}

"use client";
import { useFrame } from "@react-three/fiber";
import { world, type WeatherType } from "@/lib/game/world";
import { U } from "@/lib/game/uniforms";
import { clamp, lerp, smoothstep, valueNoise } from "@/lib/world/noise";
import * as THREE from "three";
import { debugStats } from "@/lib/game/debugStats";

const ORIGIN = new THREE.Vector2();

const TARGETS: Record<WeatherType, { rain: number; mist: number; cloud: number; wind: number }> = {
  clear: { rain: 0, mist: 0.04, cloud: 0.25, wind: 0.3 },
  windy: { rain: 0, mist: 0.02, cloud: 0.45, wind: 0.9 },
  lightRain: { rain: 0.45, mist: 0.22, cloud: 0.85, wind: 0.45 },
  heavyRain: { rain: 1, mist: 0.32, cloud: 1, wind: 0.65 },
  mist: { rain: 0, mist: 0.85, cloud: 0.55, wind: 0.12 },
};

function rollWeather(current: WeatherType): WeatherType {
  const r = Math.random();
  switch (current) {
    case "clear": return r < 0.45 ? "clear" : r < 0.65 ? "windy" : r < 0.82 ? "mist" : "lightRain";
    case "windy": return r < 0.5 ? "clear" : r < 0.75 ? "lightRain" : "windy";
    case "lightRain": return r < 0.35 ? "heavyRain" : r < 0.7 ? "clear" : "mist";
    case "heavyRain": return r < 0.6 ? "lightRain" : "mist";
    case "mist": return r < 0.7 ? "clear" : "lightRain";
  }
}

const approach = (v: number, target: number, rate: number, dt: number) => v + clamp(target - v, -rate * dt, rate * dt);

export function TimeSystem() {
  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    world.fps = lerp(world.fps, 1 / Math.max(rawDt, 1e-4), 0.05);
    state.gl.info.autoReset = false;
    debugStats.calls = state.gl.info.render.calls;
    debugStats.triangles = state.gl.info.render.triangles;
    state.gl.info.reset();
    U.uCamPos.value.copy(state.camera.position);
    if (world.frozen) return;

    world.clock += dt;
    U.uTime.value = world.clock;
    world.time = (world.time + (dt / 60) * world.hoursPerMinute) % 24;

    // weather state machine
    world.weatherTimer -= dt;
    if (world.weatherTimer <= 0) {
      world.targetWeather = rollWeather(world.targetWeather);
      world.weatherTimer = 70 + Math.random() * 110;
    }
    const t = TARGETS[world.targetWeather];
    world.weather = world.targetWeather;
    world.rain = approach(world.rain, t.rain, 0.06, dt);
    world.cloud = approach(world.cloud, t.cloud, 0.05, dt);
    // natural dawn mist and mist after rain
    const dawn = smoothstep(4.2, 5.6, world.time) * smoothstep(8.2, 6.4, world.time);
    const mistTarget = clamp(t.mist + dawn * 0.4 + world.wetness * 0.2 * (1 - world.rain), 0, 1);
    world.mist = approach(world.mist, mistTarget, 0.05, dt);
    world.wetness = world.rain > world.wetness ? approach(world.wetness, world.rain, 0.08, dt) : approach(world.wetness, 0, 0.012, dt);

    // wind with gusts
    world.windBase = approach(world.windBase, t.wind, 0.08, dt);
    world.gustPhase += dt;
    const gust = valueNoise(world.gustPhase * 0.18, 3.7) * 0.5 + 0.5;
    world.windStrength = clamp(world.windBase * (0.55 + gust * 0.9), 0.03, 1.3);
    world.windDir.rotateAround(ORIGIN, valueNoise(world.gustPhase * 0.03, 9.2) * 0.0015);
    U.uWind.value.set(world.windDir.x, world.windDir.y, world.windStrength);

    // world event timers
    world.trainTimer -= dt;
    world.distantBellTimer -= dt;
  });
  return null;
}

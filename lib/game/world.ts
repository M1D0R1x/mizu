// Mutable per-frame world state. Deliberately NOT in React state / Zustand:
// this changes every frame and is read directly by Three.js systems via refs.
import * as THREE from "three";
import type { AreaId } from "@/lib/world/terrain";

export type WeatherType = "clear" | "windy" | "lightRain" | "heavyRain" | "mist";

export const world = {
  time: 6.1, // hours, 0..24
  hoursPerMinute: 1.6, // day length ~15 real minutes
  frozen: false, // photo mode

  weather: "clear" as WeatherType,
  targetWeather: "clear" as WeatherType,
  rain: 0, // 0..1 current rain amount (smoothed)
  mist: 0, // 0..1
  cloud: 0.25, // 0..1 cloud cover
  wetness: 0, // 0..1 ground wetness, lingers after rain
  weatherTimer: 90, // seconds until next weather roll

  windDir: new THREE.Vector2(0.8, 0.45).normalize(),
  windBase: 0.35,
  windStrength: 0.35, // 0..1 (with gusts)
  gustPhase: 0,

  sunDir: new THREE.Vector3(0, 1, 0),
  moonDir: new THREE.Vector3(0, -1, 0),
  daylight: 1, // 0 night .. 1 day
  lanternGlow: 0, // 0..1 lanterns / windows lit

  player: {
    pos: new THREE.Vector3(-20, 5, 80),
    yaw: 0,
    pitch: 0,
    speed: 0,
    onGround: true,
    area: null as AreaId | null,
    sitting: false,
    tppMode: false,      // third-person camera active
    tppDist: 6.0,        // camera orbit distance (metres behind/above player)
    speedMult: 1.0,      // 0.5 = slow walk, 1 = normal, 2 = fast
  },

  // one-shot event timestamps (seconds since start) for audio/visual reactions
  clock: 0,
  bellRungAt: -100,
  fishFedAt: -100,
  trainActive: false,
  trainProgress: 0,
  trainTimer: 45,
  distantBellTimer: 60,
  cinematic: null as null | { kind: "shrine"; t: number },

  fps: 60,
};

export const seasonHints = {
  petalIntensity: 1,
};

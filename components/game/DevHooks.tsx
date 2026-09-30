"use client";
import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { world, type WeatherType } from "@/lib/game/world";
import { useGame } from "@/store/gameStore";
import { terrainHeight } from "@/lib/world/terrain";
import { debugStats } from "@/lib/game/debugStats";
import * as THREE from "three";

declare global {
  interface Window { __mizu?: { set: (s: Record<string, string>) => void; info: () => unknown } }
}

/** Development-only hooks used by tools/shot.mjs to jump the camera around for visual QA. */
export function DevHooks() {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    (window as unknown as { __scene: THREE.Scene }).__scene = scene;
    (window as unknown as { __camera: THREE.Camera }).__camera = camera;
    (window as unknown as { __THREE: typeof THREE }).__THREE = THREE;
    window.__mizu = {
      set: (s) => {
        const st = useGame.getState();
        if (s.mode) st.setMode(s.mode as never);
        else if (st.mode !== "playing") st.setMode("playing");
        if (s.time) world.time = parseFloat(s.time);
        if (s.weather) {
          const w = s.weather as WeatherType;
          world.targetWeather = w; world.weatherTimer = 1e6;
          world.rain = w === "heavyRain" ? 1 : w === "lightRain" ? 0.45 : 0;
          world.mist = w === "mist" ? 0.85 : 0.04;
          world.cloud = w === "clear" ? 0.25 : w === "mist" ? 0.55 : 0.9;
          world.wetness = world.rain;
        }
        if (s.x !== undefined && s.z !== undefined) {
          const x = parseFloat(s.x), z = parseFloat(s.z);
          world.player.pos.set(x, terrainHeight(x, z) + (s.dy ? parseFloat(s.dy) : 0), z);
        }
        if (s.yaw !== undefined) world.player.yaw = parseFloat(s.yaw);
        if (s.pitch !== undefined) world.player.pitch = parseFloat(s.pitch);
        if (s.hpm) world.hoursPerMinute = parseFloat(s.hpm);
        if (s.quality) st.setSettings({ quality: s.quality as never });
        if (s.noshadow) { gl.shadowMap.enabled = false; scene.traverse((o) => { if ((o as THREE.Light).isLight) (o as THREE.Light).castShadow = false; }); }
      },
      info: () => ({ fps: Math.round(world.fps), calls: debugStats.calls, tris: debugStats.triangles, time: world.time.toFixed(2), pos: world.player.pos.toArray().map((v) => +v.toFixed(1)), area: world.player.area, mem: gl.info.memory }),
    };
    return () => { delete window.__mizu; };
  }, [gl, scene, camera]);
  return null;
}

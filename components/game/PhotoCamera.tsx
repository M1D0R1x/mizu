"use client";
import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useGame } from "@/store/gameStore";
import { world, type WeatherType } from "@/lib/game/world";
import { keys } from "./Player";
import { clamp } from "@/lib/world/noise";
import { terrainHeight } from "@/lib/world/terrain";

const eul = new THREE.Euler(0, 0, 0, "YXZ");

/** Free camera for photo mode. Freezes the world, allows time/weather overrides. */
export function PhotoCamera() {
  const { camera, gl } = useThree();
  const mode = useGame((s) => s.mode);
  const ps = useGame((s) => s.photoSettings);
  const yaw = useRef(0), pitch = useRef(0), dragging = useRef(false);
  const saved = useRef<{ time: number; rain: number; mist: number; cloud: number; weather: WeatherType; fov: number } | null>(null);

  useEffect(() => {
    if (mode !== "photo") return;
    saved.current = { time: world.time, rain: world.rain, mist: world.mist, cloud: world.cloud, weather: world.targetWeather, fov: (camera as THREE.PerspectiveCamera).fov };
    world.frozen = true;
    eul.setFromQuaternion(camera.quaternion, "YXZ");
    yaw.current = eul.y; pitch.current = eul.x;
    const el = gl.domElement;
    const down = (e: MouseEvent) => { if (e.button === 2 || e.button === 0) dragging.current = true; };
    const up = () => { dragging.current = false; };
    const move = (e: MouseEvent) => {
      if (!dragging.current) return;
      yaw.current -= e.movementX * 0.0022;
      pitch.current = clamp(pitch.current - e.movementY * 0.0022, -1.5, 1.5);
    };
    const wheel = (e: WheelEvent) => {
      const s = useGame.getState();
      s.setPhotoSettings({ fov: clamp(s.photoSettings.fov + Math.sign(e.deltaY) * 2, 15, 110) });
    };
    const ctx = (e: Event) => e.preventDefault();
    el.addEventListener("mousedown", down); window.addEventListener("mouseup", up); window.addEventListener("mousemove", move);
    el.addEventListener("wheel", wheel, { passive: true }); el.addEventListener("contextmenu", ctx);
    return () => {
      el.removeEventListener("mousedown", down); window.removeEventListener("mouseup", up); window.removeEventListener("mousemove", move);
      el.removeEventListener("wheel", wheel); el.removeEventListener("contextmenu", ctx);
      const sv = saved.current;
      if (sv) {
        world.time = sv.time; world.rain = sv.rain; world.mist = sv.mist; world.cloud = sv.cloud; world.targetWeather = sv.weather;
        const cam = camera as THREE.PerspectiveCamera; cam.fov = sv.fov; cam.updateProjectionMatrix();
      }
      world.frozen = false;
      useGame.getState().setPhotoSettings({ timeOverride: null, weatherOverride: null });
    };
  }, [mode, camera, gl]);

  useFrame((_, rawDt) => {
    if (mode !== "photo") return;
    const dt = Math.min(rawDt, 0.05);
    const cam = camera as THREE.PerspectiveCamera;
    if (Math.abs(cam.fov - ps.fov) > 0.01) { cam.fov = ps.fov; cam.updateProjectionMatrix(); }
    eul.set(pitch.current, yaw.current, ps.tilt * 0.01745);
    cam.quaternion.setFromEuler(eul);
    const speed = (keys.has("ShiftLeft") ? 9 : 3.2) * dt;
    const fwd = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(cam.quaternion);
    if (keys.has("KeyW")) cam.position.addScaledVector(fwd, speed);
    if (keys.has("KeyS")) cam.position.addScaledVector(fwd, -speed);
    if (keys.has("KeyD")) cam.position.addScaledVector(right, speed);
    if (keys.has("KeyA")) cam.position.addScaledVector(right, -speed);
    if (keys.has("KeyE") || keys.has("Space")) cam.position.y += speed;
    if (keys.has("KeyQ") || keys.has("KeyC")) cam.position.y -= speed;
    // keep the photographer within a sensible bubble around the player and above ground
    const p = world.player.pos;
    const dx = cam.position.x - p.x, dz = cam.position.z - p.z, d = Math.hypot(dx, dz);
    if (d > 40) { cam.position.x = p.x + (dx / d) * 40; cam.position.z = p.z + (dz / d) * 40; }
    cam.position.y = clamp(cam.position.y, terrainHeight(cam.position.x, cam.position.z) + 0.3, p.y + 30);

    if (ps.timeOverride !== null) world.time = ps.timeOverride;
    if (ps.weatherOverride) {
      const w = ps.weatherOverride;
      world.rain = w === "heavyRain" ? 1 : w === "lightRain" ? 0.45 : 0;
      world.mist = w === "mist" ? 0.85 : w === "clear" ? 0.04 : 0.2;
      world.cloud = w === "clear" ? 0.2 : w === "mist" ? 0.5 : 0.9;
    }
  });
  return null;
}

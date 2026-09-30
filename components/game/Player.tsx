"use client";
import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { world } from "@/lib/game/world";
import { areaAt, terrainHeight, terrainNormal, WATER_LEVEL } from "@/lib/world/terrain";
import { resolveColliders } from "@/lib/game/colliders";
import { useGame } from "@/store/gameStore";
import { clamp, lerp } from "@/lib/world/noise";
import { audio } from "@/lib/game/audio";

const EYE = 1.68;
const WALK = 3.4, RUN = 6.8;

export const keys = new Set<string>();
if (typeof window !== "undefined") {
  window.addEventListener("keydown", (e) => keys.add(e.code));
  window.addEventListener("keyup", (e) => keys.delete(e.code));
  window.addEventListener("blur", () => keys.clear());
}

export function Player() {
  const { camera, gl } = useThree();
  const mode = useGame((s) => s.mode);
  const sensitivity = useGame((s) => s.settings.sensitivity);
  const baseFov = useGame((s) => s.settings.fov);
  const reduceMotion = useGame((s) => s.settings.reduceMotion);
  const vel = useRef(new THREE.Vector3());
  const vy = useRef(0);
  const bob = useRef(0);
  const areaTimer = useRef(0);
  const stepTimer = useRef(0);
  const euler = useRef(new THREE.Euler(0, 0, 0, "YXZ"));
  const fovRef = useRef(baseFov);

  // pointer lock + mouse look
  useEffect(() => {
    if (mode !== "playing") return;
    const el = gl.domElement;
    const lock = () => {
      if (document.pointerLockElement === el) return;
      try { (el.requestPointerLock?.() as unknown as Promise<void> | undefined)?.catch?.(() => {}); } catch { /* not available */ }
    };
    const onMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== el) return;
      const s = 0.0021 * sensitivity;
      world.player.yaw -= e.movementX * s;
      world.player.pitch = clamp(world.player.pitch - e.movementY * s, -Math.PI / 2 + 0.05, Math.PI / 2 - 0.05);
    };
    const onLockChange = () => {
      if (document.pointerLockElement !== el && useGame.getState().mode === "playing") useGame.getState().setMode("paused");
    };
    lock();
    el.addEventListener("click", lock);
    document.addEventListener("mousemove", onMove);
    document.addEventListener("pointerlockchange", onLockChange);
    return () => {
      el.removeEventListener("click", lock);
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("pointerlockchange", onLockChange);
    };
  }, [mode, gl, sensitivity]);

  useEffect(() => {
    if (mode !== "playing" && document.pointerLockElement === gl.domElement) document.exitPointerLock();
  }, [mode, gl]);

  useFrame((_, rawDt) => {
    if (mode !== "playing") return;
    const dt = Math.min(rawDt, 0.05);
    const p = world.player;
    const forward = new THREE.Vector3(-Math.sin(p.yaw), 0, -Math.cos(p.yaw));
    const right = new THREE.Vector3(-forward.z, 0, forward.x);
    const input = new THREE.Vector3();
    if (!p.sitting && !world.cinematic) {
      if (keys.has("KeyW") || keys.has("ArrowUp")) input.add(forward);
      if (keys.has("KeyS") || keys.has("ArrowDown")) input.sub(forward);
      if (keys.has("KeyD") || keys.has("ArrowRight")) input.add(right);
      if (keys.has("KeyA") || keys.has("ArrowLeft")) input.sub(right);
    }
    const running = keys.has("ShiftLeft") || keys.has("ShiftRight");
    const targetSpeed = input.lengthSq() > 0 ? (running ? RUN : WALK) : 0;
    if (input.lengthSq() > 0) input.normalize().multiplyScalar(targetSpeed);
    vel.current.lerp(input, 1 - Math.exp(-dt * (targetSpeed > 0 ? 8 : 11)));

    // horizontal move with terrain / water / collider constraints
    const nx = p.pos.x + vel.current.x * dt, nz = p.pos.z + vel.current.z * dt;
    const tryMove = (x: number, z: number) => {
      const h = terrainHeight(x, z);
      if (h < WATER_LEVEL - 0.55) return false;
      const n = terrainNormal(x, z);
      if (n[1] < 0.45 && h > terrainHeight(p.pos.x, p.pos.z)) return false;
      return true;
    };
    if (tryMove(nx, nz)) { p.pos.x = nx; p.pos.z = nz; }
    else if (tryMove(nx, p.pos.z)) p.pos.x = nx;
    else if (tryMove(p.pos.x, nz)) p.pos.z = nz;
    const c = { x: p.pos.x, z: p.pos.z };
    resolveColliders(c);
    p.pos.x = c.x; p.pos.z = c.z;

    // vertical: ground follow + tiny hop
    const ground = terrainHeight(p.pos.x, p.pos.z);
    if (keys.has("Space") && p.onGround && !p.sitting) { vy.current = 3.2; p.onGround = false; }
    if (!p.onGround) {
      vy.current -= 11 * dt;
      p.pos.y += vy.current * dt;
      if (p.pos.y <= ground) { p.pos.y = ground; p.onGround = true; vy.current = 0; }
    } else {
      p.pos.y = lerp(p.pos.y, ground, 1 - Math.exp(-dt * 14));
    }

    const speed = Math.hypot(vel.current.x, vel.current.z);
    p.speed = speed;
    const motion = reduceMotion ? 0.25 : 1;
    bob.current += dt * speed * 1.75;
    const bobY = Math.sin(bob.current) * 0.028 * (speed / WALK) * motion;
    const bobX = Math.cos(bob.current * 0.5) * 0.012 * (speed / WALK) * motion;
    const breathe = Math.sin(world.clock * 0.9) * 0.0035 * motion;

    // footsteps
    stepTimer.current -= dt * speed;
    if (stepTimer.current <= 0 && speed > 0.6 && p.onGround) { stepTimer.current = 1.9; audio.footstep(ground < WATER_LEVEL + 0.35 ? "wet" : "grass"); }

    if (p.sitting) {
      camera.position.lerp(new THREE.Vector3(p.pos.x, p.pos.y + 1.15 + breathe, p.pos.z), 1 - Math.exp(-dt * 4));
    } else if (!world.cinematic) {
      camera.position.set(p.pos.x + bobX * right.x, p.pos.y + EYE + bobY + breathe, p.pos.z + bobX * right.z);
    }
    if (!world.cinematic) {
      euler.current.set(p.pitch + Math.sin(bob.current * 0.5) * 0.004 * (speed / WALK) * motion, p.yaw, Math.cos(bob.current * 0.5) * 0.006 * (speed / WALK) * motion);
      camera.quaternion.setFromEuler(euler.current);
    }

    const cam = camera as THREE.PerspectiveCamera;
    fovRef.current = lerp(fovRef.current, baseFov + (running && speed > WALK ? 5 : 0), 1 - Math.exp(-dt * 3));
    if (Math.abs(cam.fov - fovRef.current) > 0.01) { cam.fov = fovRef.current; cam.updateProjectionMatrix(); }

    // area detection / discovery
    areaTimer.current -= dt;
    if (areaTimer.current <= 0) {
      areaTimer.current = 0.5;
      const a = areaAt(p.pos.x, p.pos.z);
      p.area = a?.id ?? null;
      if (a) useGame.getState().discover(a.id, a.name);
    }
  });

  return null;
}

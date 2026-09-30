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

// Speed multiplier steps cycled with [ / ] keys or scroll wheel
const SPEED_STEPS = [0.35, 0.6, 1.0, 1.6, 2.4];
const SPEED_LABELS = ["SLOW", "STROLL", "WALK", "JOG", "RUN"];

export const keys = new Set<string>();
if (typeof window !== "undefined") {
  window.addEventListener("keydown", (e) => keys.add(e.code));
  window.addEventListener("keyup", (e) => keys.delete(e.code));
  window.addEventListener("blur", () => keys.clear());
}

// Shared tmp objects — avoids per-frame allocations
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _input = new THREE.Vector3();
const _tppTarget = new THREE.Vector3();
const _tppPos = new THREE.Vector3();
const _euler = new THREE.Euler(0, 0, 0, "YXZ");

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
  const fovRef = useRef(baseFov);
  // TPP smooth camera position
  const tppCamPos = useRef(new THREE.Vector3());
  const tppCamInitialized = useRef(false);
  // Speed HUD flash
  const speedLabelTimer = useRef(0);
  const speedLabelRef = useRef<HTMLDivElement | null>(null);

  // ── Speed label DOM element (mounted once) ──────────────────────────────
  useEffect(() => {
    const el = document.createElement("div");
    el.style.cssText = [
      "position:fixed", "bottom:18%", "left:50%", "transform:translateX(-50%)",
      "font-size:10px", "letter-spacing:0.34em", "text-indent:0.34em",
      "text-transform:uppercase", "color:rgba(242,237,228,0.7)",
      "pointer-events:none", "transition:opacity 0.4s", "opacity:0",
      "font-family:var(--font-sans,sans-serif)", "font-weight:300",
    ].join(";");
    document.body.appendChild(el);
    speedLabelRef.current = el;
    return () => el.remove();
  }, []);

  const flashSpeedLabel = (mult: number) => {
    const idx = SPEED_STEPS.reduce((best, s, i) => Math.abs(s - mult) < Math.abs(SPEED_STEPS[best] - mult) ? i : best, 0);
    const el = speedLabelRef.current;
    if (!el) return;
    el.textContent = `SPEED — ${SPEED_LABELS[idx]}`;
    el.style.opacity = "1";
    speedLabelTimer.current = 1.8;
  };

  // ── Pointer lock + mouse look ────────────────────────────────────────────
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

  // ── Keyboard shortcuts: V = toggle TPP, Tab = cycle speed, [ / ] = step ─
  useEffect(() => {
    if (mode !== "playing") return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === "KeyV") {
        world.player.tppMode = !world.player.tppMode;
        tppCamInitialized.current = false;
      }
      // Tab / Shift+Tab cycles through speed presets (wraps around)
      if (e.code === "Tab") {
        e.preventDefault();
        const cur = world.player.speedMult;
        const idx = SPEED_STEPS.reduce((b, s, i) => Math.abs(s - cur) < Math.abs(SPEED_STEPS[b] - cur) ? i : b, 0);
        const next = e.shiftKey
          ? (idx - 1 + SPEED_STEPS.length) % SPEED_STEPS.length
          : (idx + 1) % SPEED_STEPS.length;
        world.player.speedMult = SPEED_STEPS[next];
        flashSpeedLabel(SPEED_STEPS[next]);
      }
      if (e.code === "BracketLeft") {
        const cur = world.player.speedMult;
        const idx = SPEED_STEPS.reduce((b, s, i) => Math.abs(s - cur) < Math.abs(SPEED_STEPS[b] - cur) ? i : b, 0);
        const next = Math.max(0, idx - 1);
        world.player.speedMult = SPEED_STEPS[next];
        flashSpeedLabel(SPEED_STEPS[next]);
      }
      if (e.code === "BracketRight") {
        const cur = world.player.speedMult;
        const idx = SPEED_STEPS.reduce((b, s, i) => Math.abs(s - cur) < Math.abs(SPEED_STEPS[b] - cur) ? i : b, 0);
        const next = Math.min(SPEED_STEPS.length - 1, idx + 1);
        world.player.speedMult = SPEED_STEPS[next];
        flashSpeedLabel(SPEED_STEPS[next]);
      }
    };
    // Scroll wheel adjusts TPP distance in TPP mode, speed in FPP mode
    const onWheel = (e: WheelEvent) => {
      if (document.pointerLockElement !== gl.domElement) return;
      const p = world.player;
      if (p.tppMode) {
        p.tppDist = clamp(p.tppDist + e.deltaY * 0.008, 2.0, 12.0);
      } else {
        const cur = p.speedMult;
        const idx = SPEED_STEPS.reduce((b, s, i) => Math.abs(s - cur) < Math.abs(SPEED_STEPS[b] - cur) ? i : b, 0);
        const next = clamp(idx + (e.deltaY > 0 ? -1 : 1), 0, SPEED_STEPS.length - 1);
        p.speedMult = SPEED_STEPS[next];
        flashSpeedLabel(SPEED_STEPS[next]);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("wheel", onWheel);
    };
  }, [mode, gl]); // eslint-disable-line react-hooks/exhaustive-deps

  useFrame((_, rawDt) => {
    if (mode !== "playing") return;
    const dt = Math.min(rawDt, 0.05);
    const p = world.player;

    // fade speed label
    if (speedLabelTimer.current > 0) {
      speedLabelTimer.current -= dt;
      if (speedLabelTimer.current <= 0 && speedLabelRef.current) speedLabelRef.current.style.opacity = "0";
    }

    _fwd.set(-Math.sin(p.yaw), 0, -Math.cos(p.yaw));
    _right.set(-_fwd.z, 0, _fwd.x);
    _input.set(0, 0, 0);
    if (!p.sitting && !world.cinematic) {
      if (keys.has("KeyW") || keys.has("ArrowUp"))    _input.add(_fwd);
      if (keys.has("KeyS") || keys.has("ArrowDown"))  _input.sub(_fwd);
      if (keys.has("KeyD") || keys.has("ArrowRight")) _input.add(_right);
      if (keys.has("KeyA") || keys.has("ArrowLeft"))  _input.sub(_right);
    }
    const shiftHeld = keys.has("ShiftLeft") || keys.has("ShiftRight");
    const baseSpeed = shiftHeld ? RUN : WALK;
    const targetSpeed = _input.lengthSq() > 0 ? baseSpeed * p.speedMult : 0;
    if (_input.lengthSq() > 0) _input.normalize().multiplyScalar(targetSpeed);
    vel.current.lerp(_input, 1 - Math.exp(-dt * (targetSpeed > 0 ? 8 : 11)));

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

    // vertical: ground follow + jump
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

    // ── Camera ────────────────────────────────────────────────────────────
    if (!world.cinematic) {
      if (p.tppMode) {
        // Third-person: position camera behind+above player, look at head
        const dist = p.tppDist;
        const pitchClamped = clamp(p.pitch, -0.6, 0.55);
        // orbit point: back along yaw, up along pitch
        const camX = p.pos.x + Math.sin(p.yaw) * dist * Math.cos(pitchClamped);
        const camY = p.pos.y + EYE + Math.sin(pitchClamped) * dist + 0.3;
        const camZ = p.pos.z + Math.cos(p.yaw) * dist * Math.cos(pitchClamped);
        // keep camera above terrain
        const camGround = terrainHeight(camX, camZ);
        _tppPos.set(camX, Math.max(camY, camGround + 0.4), camZ);
        // smooth follow (snap on first frame after toggle)
        const alpha = tppCamInitialized.current ? 1 - Math.exp(-dt * 10) : 1;
        tppCamPos.current.lerp(_tppPos, alpha);
        tppCamInitialized.current = true;
        camera.position.copy(tppCamPos.current);
        // look at player head
        _tppTarget.set(p.pos.x, p.pos.y + EYE * 0.85, p.pos.z);
        camera.lookAt(_tppTarget);
      } else {
        // First-person
        if (p.sitting) {
          camera.position.lerp(new THREE.Vector3(p.pos.x, p.pos.y + 1.15 + breathe, p.pos.z), 1 - Math.exp(-dt * 4));
        } else {
          camera.position.set(p.pos.x + bobX * _right.x, p.pos.y + EYE + bobY + breathe, p.pos.z + bobX * _right.z);
        }
        _euler.set(p.pitch + Math.sin(bob.current * 0.5) * 0.004 * (speed / WALK) * motion, p.yaw, Math.cos(bob.current * 0.5) * 0.006 * (speed / WALK) * motion);
        camera.quaternion.setFromEuler(_euler);
      }
    }

    const cam = camera as THREE.PerspectiveCamera;
    const running = shiftHeld && speed > WALK;
    fovRef.current = lerp(fovRef.current, baseFov + (running ? 5 : 0) + (p.tppMode ? 4 : 0), 1 - Math.exp(-dt * 3));
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

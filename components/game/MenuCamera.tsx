"use client";
import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useGame } from "@/store/gameStore";
import { world } from "@/lib/game/world";
import { LAKE, terrainHeight } from "@/lib/world/terrain";
import { smoothstep } from "@/lib/world/noise";
import { getSpawnSpot } from "@/lib/world/spawnGen";

export const PLAYER_START = getSpawnSpot().pos;
const START_YAW = getSpawnSpot().yaw;

const tmpPos = new THREE.Vector3(), tmpLook = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), fromPos = new THREE.Vector3(), fromQ = new THREE.Quaternion();
const eul = new THREE.Euler(0, 0, 0, "YXZ");

/** Floats above the lake during intro/menu and flies down into the player's eyes when entering. */
export function MenuCamera() {
  const mode = useGame((s) => s.mode);
  const previousMode = useGame((s) => s.previousMode);
  const enterT = useRef(0);
  const floatT = useRef(0);

  useEffect(() => {
    if (mode === "entering") {
      enterT.current = 0;
      const p = world.player;
      const spawn = getSpawnSpot();
      p.pos.copy(spawn.pos);
      p.yaw = spawn.yaw;
      p.facingYaw = spawn.yaw;
      p.pitch = 0.02;
    }
  }, [mode]);

  const floating = mode === "intro" || mode === "menu" || (mode === "gallery" && previousMode === "menu") || (mode === "settings" && previousMode === "menu");

  useFrame(({ camera }, dt) => {
    if (!floating && mode !== "entering") return;
    floatT.current += Math.min(dt, 0.05);
    const t = floatT.current * 0.028;
    // slow orbit over the water, drifting height
    const intro = mode === "intro" ? 1 - smoothstep(0, 9, floatT.current) : 0;
    const r = 78 - intro * 30;
    tmpPos.set(LAKE.x + Math.cos(t + 2.6) * r, 9 + Math.sin(t * 1.7) * 2.5 - intro * 6.5, LAKE.z + 40 + Math.sin(t + 2.6) * r * 0.75);
    tmpLook.set(LAKE.x - 10 + Math.sin(t * 0.4) * 30, 12 + intro * -8, LAKE.z - 140);
    if (mode !== "entering") {
      camera.position.copy(tmpPos);
      camera.lookAt(tmpLook);
      camera.position.y = Math.max(camera.position.y, 1.2);
      return;
    }
    // fly into the player's head
    if (enterT.current === 0) { fromPos.copy(camera.position); fromQ.copy(camera.quaternion); }
    enterT.current += dt;
    const k = smoothstep(0, 4.2, enterT.current);
    const ease = k * k * (3 - 2 * k);
    const p = world.player;
    const eye = new THREE.Vector3(p.pos.x, p.pos.y + 1.68, p.pos.z);
    eul.set(p.pitch, p.yaw, 0);
    tmpQ.setFromEuler(eul);
    camera.position.lerpVectors(fromPos, eye, ease);
    camera.quaternion.slerpQuaternions(fromQ, tmpQ, ease);
    if (enterT.current > 4.4) useGame.getState().setMode("playing");
  });
  return null;
}

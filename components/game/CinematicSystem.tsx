"use client";
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { world } from "@/lib/game/world";
import { SHRINE, SHRINE_HEIGHT } from "@/lib/world/terrain";
import { useGame } from "@/store/gameStore";
import { smoothstep } from "@/lib/world/noise";

const from = new THREE.Vector3(), fromQ = new THREE.Quaternion(), target = new THREE.Vector3(), look = new THREE.Vector3(), q = new THREE.Quaternion(), m = new THREE.Matrix4();

/** Once, on first arrival at the shrine: the camera drifts back and up to reveal the mountain. Then control returns. */
export function CinematicSystem() {
  const done = useRef(false);
  useFrame(({ camera }, dt) => {
    if (useGame.getState().mode !== "playing") return;
    const p = world.player;
    if (!world.cinematic) {
      if (done.current) return;
      const d = Math.hypot(p.pos.x - SHRINE.x, p.pos.z - (SHRINE.z + 18));
      if (d < 6 && p.pos.y > SHRINE_HEIGHT - 2) {
        done.current = true;
        world.cinematic = { kind: "shrine", t: 0 };
        from.copy(camera.position); fromQ.copy(camera.quaternion);
      }
      return;
    }
    const c = world.cinematic;
    c.t += dt;
    const T = 9;
    const k = smoothstep(0, T, c.t);
    const arc = Math.sin(k * Math.PI); // out and back
    target.set(from.x + 3 * arc, from.y + 9 * arc, from.z + 26 * arc);
    look.set(SHRINE.x, SHRINE_HEIGHT + 20 + 40 * arc, SHRINE.z - 60);
    m.lookAt(target, look, camera.up);
    q.setFromRotationMatrix(m);
    camera.position.copy(target);
    camera.quaternion.copy(fromQ).slerp(q, Math.min(1, arc * 2.2));
    if (c.t >= T) world.cinematic = null;
  });
  return null;
}

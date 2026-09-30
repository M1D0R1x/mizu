"use client";
import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { world } from "@/lib/game/world";
import { useGame } from "@/store/gameStore";

// Pre-load so it's ready before the player enters
useGLTF.preload("/character.glb");

const WALK_SPEED = 3.4;
const RUN_SPEED  = 6.0;

// Smoothly crossfades between three clips: Idle → Walk → Run
// based on actual player speed each frame.
export function Character() {
  const mode = useGame((s) => s.mode);
  const { scene, animations } = useGLTF("/character.glb");

  const mixer  = useRef<THREE.AnimationMixer | null>(null);
  const clips  = useRef<Record<string, THREE.AnimationAction>>({});
  const active = useRef<string>("Idle");
  const groupRef = useRef<THREE.Group>(null!);

  // Boot the mixer and cache all clips once
  useEffect(() => {
    const m = new THREE.AnimationMixer(scene);
    mixer.current = m;
    for (const clip of animations) {
      const a = m.clipAction(clip);
      a.play();
      a.setEffectiveWeight(0);
      clips.current[clip.name] = a;
    }
    // start fully on Idle
    if (clips.current["Idle"]) clips.current["Idle"].setEffectiveWeight(1);
    return () => { m.stopAllAction(); };
  }, [scene, animations]);

  useFrame((_, dt) => {
    if (!mixer.current || mode !== "playing") return;
    mixer.current.update(dt);

    const p = world.player;

    // Only show character in TPP mode
    if (groupRef.current) {
      groupRef.current.visible = p.tppMode;
    }
    if (!p.tppMode) return;

    // Position the character at the player's feet, facing their yaw
    groupRef.current.position.set(p.pos.x, p.pos.y, p.pos.z);
    groupRef.current.rotation.y = p.yaw + Math.PI; // model faces forward

    // Determine target animation from speed
    const speed = p.speed;
    let target = "Idle";
    if (speed > WALK_SPEED * 0.85) target = "Run";
    else if (speed > 0.4) target = "Walk";

    // Smooth crossfade: ramp target to 1, others to 0
    const FADE = 1 - Math.exp(-dt * 6);
    for (const [name, action] of Object.entries(clips.current)) {
      if (name === "TPose") { action.setEffectiveWeight(0); continue; }
      const want = name === target ? 1 : 0;
      const cur  = action.getEffectiveWeight();
      action.setEffectiveWeight(cur + (want - cur) * FADE);
    }
    active.current = target;
  });

  return (
    <group ref={groupRef} visible={false}>
      <primitive
        object={scene}
        scale={0.011}        // Soldier.glb is ~180 units tall → scale to ~2m
        position={[0, 0, 0]}
      />
    </group>
  );
}

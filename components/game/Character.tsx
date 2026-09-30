"use client";
import { Suspense, useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone as skeletonClone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { world } from "@/lib/game/world";
import { useGame } from "@/store/gameStore";

useGLTF.preload("/character.glb");

// -------------------------------------------------------------------
// Inner component — only mounts after GLB is loaded (Suspense gate)
// -------------------------------------------------------------------
function CharacterMesh() {
  const { scene: rawScene, animations } = useGLTF("/character.glb");
  const mode = useGame((s) => s.mode);

  // Clone the scene so AnimationMixer drives only this instance's bones
  const clonedScene = useRef<THREE.Object3D | null>(null);
  if (!clonedScene.current) {
    clonedScene.current = skeletonClone(rawScene);
  }

  const groupRef  = useRef<THREE.Group>(null!);
  const mixer     = useRef<THREE.AnimationMixer | null>(null);
  const actions   = useRef<Record<string, THREE.AnimationAction>>({});

  // Set up mixer once on mount (animations array is stable after preload)
  useEffect(() => {
    if (!clonedScene.current) return;
    const m = new THREE.AnimationMixer(clonedScene.current);
    mixer.current = m;
    for (const clip of animations) {
      const a = m.clipAction(clip);
      a.play();
      // Start on Idle, everything else at 0
      a.setEffectiveWeight(clip.name === "Idle" ? 1 : 0);
      actions.current[clip.name] = a;
    }
    return () => { m.stopAllAction(); mixer.current = null; };
  }, [animations]);

  useFrame((_, dt) => {
    if (mode !== "playing" || !groupRef.current) return;

    const p = world.player;

    // Visibility — only show in TPP
    groupRef.current.visible = p.tppMode;
    if (!p.tppMode) return;

    // Advance mixer every frame
    mixer.current?.update(dt);

    // Sync position & direction with player
    groupRef.current.position.set(p.pos.x, p.pos.y, p.pos.z);
    // +π because the Soldier model's forward faces +Z; player forward is -Z
    groupRef.current.rotation.y = p.yaw + Math.PI;

    // --- Animation blending ---
    // Normalise speed against base WALK so speedMult doesn't break thresholds
    const normSpeed = p.speed / (p.speedMult || 1);
    const targetName =
      normSpeed > 3.0 ? "Run" :
      normSpeed > 0.3 ? "Walk" :
                        "Idle";

    const FADE = 1 - Math.exp(-dt * 7);
    for (const [name, action] of Object.entries(actions.current)) {
      if (name === "TPose") { action.setEffectiveWeight(0); continue; }
      const want = name === targetName ? 1 : 0;
      const cur  = action.getEffectiveWeight();
      action.setEffectiveWeight(cur + (want - cur) * FADE);
    }
  });

  return (
    <group ref={groupRef} visible={false}>
      {/*
        Real measured height: 44.39 units.
        Scale = 1.8m / 44.39 = 0.04055  →  character is exactly 5'11"
        Model origin is at the waist (foot minY = -22.48 units).
        Lift by |minY| × scale = 22.48 × 0.04055 ≈ 0.912m so feet sit on ground.
      */}
      <primitive object={clonedScene.current!} scale={0.04055} position={[0, 0.912, 0]} />
    </group>
  );
}

// -------------------------------------------------------------------
// Public export — Suspense keeps the rest of the canvas alive while
// the GLB streams in; fallback=null means nothing shows until ready
// -------------------------------------------------------------------
export function Character() {
  return (
    <Suspense fallback={null}>
      <CharacterMesh />
    </Suspense>
  );
}

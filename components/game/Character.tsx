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

  // Traverse cloned scene once to enable shadows on all meshes
  useEffect(() => {
    if (!clonedScene.current) return;
    clonedScene.current.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;
      }
    });
  }, []);

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

    // Sync position & direction with player (feet flush on terrain at p.pos.y)
    groupRef.current.position.set(p.pos.x, p.pos.y, p.pos.z);
    // +π because the Soldier model's forward faces +Z; player forward is -Z
    groupRef.current.rotation.y = p.yaw + Math.PI;

    // --- Animation blending ---
    const speed = p.speed;
    const targetName =
      speed > 4.5 ? "Run" :
      speed > 0.25 ? "Walk" :
                     "Idle";

    // Adjust stride cadence to match travel speed so feet don't slide
    if (actions.current["Walk"]) {
      actions.current["Walk"].timeScale = Math.max(0.6, speed / 3.2);
    }
    if (actions.current["Run"]) {
      actions.current["Run"].timeScale = Math.max(0.7, speed / 5.5);
    }
    if (actions.current["Idle"]) {
      actions.current["Idle"].timeScale = 1.0;
    }

    const FADE = 1 - Math.exp(-dt * 9);
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
        Soldier.glb native dimensions in Three.js:
        Height: 1.832m (~6ft), Feet at y=0.
        Scale 0.985 brings height to exactly 1.803m (5'11").
        Position [0, 0, 0] ensures soles touch terrain directly.
      */}
      <primitive object={clonedScene.current!} scale={0.985} position={[0, 0, 0]} />
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

"use client";
import { Suspense, useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { clone as skeletonClone } from "three/examples/jsm/utils/SkeletonUtils.js";
import { world } from "@/lib/game/world";
import { useGame } from "@/store/gameStore";
import { clamp } from "@/lib/world/noise";

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

  const groupRef    = useRef<THREE.Group>(null!);
  const mixer       = useRef<THREE.AnimationMixer | null>(null);
  const actions     = useRef<Record<string, THREE.AnimationAction>>({});
  const currentYaw  = useRef<number>(0);
  const currentRoll = useRef<number>(0);
  const initialized = useRef<boolean>(false);

  // Traverse cloned scene once to enable shadows and enhance texture vibrancy
  useEffect(() => {
    if (!clonedScene.current) return;
    clonedScene.current.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;

        const mat = (child as THREE.Mesh).material as THREE.MeshStandardMaterial;
        if (mat) {
          const m = mat.clone();

          // 1. Boost texture brightness & contrast so patterns, seams & straps pop
          m.color.setRGB(1.28, 1.28, 1.28);

          // 2. Balanced roughness so surfaces catch soft sunlight & sky reflections
          m.roughness = 0.46;
          m.metalness = 0.16;

          // 3. Crisp normal mapping for cloth folds and armor plates
          if (m.normalMap) {
            m.normalScale.set(1.25, 1.25);
          }

          // 4. Subtle ambient emissive fill so shadows don't swallow texture details
          m.emissive.set(0x242d3a);
          m.emissiveIntensity = 0.24;

          // 5. Visor: sleek reflective sci-fi cyan glow
          if (child.name.includes("visor") || m.name.includes("Visor")) {
            m.color.set(0x38bdf8);
            m.emissive.set(0x0ea5e9);
            m.emissiveIntensity = 0.85;
            m.roughness = 0.1;
            m.metalness = 0.8;
          }

          (child as THREE.Mesh).material = m;
        }
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

    // Initialise yaw to current facing yaw on first frame
    if (!initialized.current) {
      currentYaw.current = p.facingYaw || p.yaw;
      initialized.current = true;
    }

    // Target facing yaw:
    // When moving, character turns to travel direction (for 'W', that is camera forward).
    // When idle in TPP, character stays facing his last direction so camera can orbit to look at his face.
    const targetYaw = p.facingYaw;

    // Shortest-arc angular difference across [-PI, PI] (handles full 360° wraps seamlessly)
    let diff = targetYaw - currentYaw.current;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));

    // Smooth exponential turn damping (snappy response when starting movement)
    const speed = p.speed;
    const turnSpeed = p.moving ? 22 : 12;
    currentYaw.current += diff * (1 - Math.exp(-dt * turnSpeed));

    // Dynamic banking / lean into turns while running
    const turnRate = diff / Math.max(dt, 0.001);
    const targetRoll = clamp(-turnRate * 0.022 * Math.min(speed / 3.4, 1.5), -0.12, 0.12);
    currentRoll.current = THREE.MathUtils.lerp(currentRoll.current, targetRoll, 1 - Math.exp(-dt * 10));

    // Sync position & rotation (feet flush on terrain at p.pos.y)
    groupRef.current.position.set(p.pos.x, p.pos.y, p.pos.z);
    groupRef.current.rotation.y = currentYaw.current;
    groupRef.current.rotation.z = currentRoll.current;

    // --- Animation blending ---
    const inAir = !p.onGround;
    const targetName =
      inAir ? (speed > 1.0 ? "Run" : "Walk") :
      speed > 4.5 ? "Run" :
      speed > 0.25 ? "Walk" :
                     "Idle";

    // Adjust stride cadence to match travel speed for 2x character proportions
    if (actions.current["Walk"]) {
      actions.current["Walk"].timeScale = Math.max(0.5, speed / 4.6);
    }
    if (actions.current["Run"]) {
      actions.current["Run"].timeScale = Math.max(0.6, speed / 7.0);
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
      {/* 2x scale: height ~3.6m, feet resting flush on ground surface */}
      <primitive object={clonedScene.current!} scale={1.97} position={[0, 0, 0]} />
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

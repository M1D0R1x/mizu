"use client";
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { evaluateLighting } from "@/lib/game/lighting";
import { updateGlow } from "@/lib/game/materials";
import { world } from "@/lib/game/world";
import { QUALITY, useGame } from "@/store/gameStore";

export function LightingSystem() {
  const sun = useRef<THREE.DirectionalLight>(null!);
  const hemi = useRef<THREE.HemisphereLight>(null!);
  const target = useMemo(() => new THREE.Object3D(), []);
  const { scene, gl } = useThree();
  const quality = useGame((s) => s.settings.quality);
  const q = QUALITY[quality];

  useEffect(() => {
    scene.fog = new THREE.FogExp2(0xbfd2e6, 0.002);
    scene.add(target);
    return () => { scene.remove(target); };
  }, [scene, target]);

  useEffect(() => {
    const l = sun.current;
    l.shadow.mapSize.set(q.shadowSize, q.shadowSize);
    l.castShadow = q.shadows;
    l.shadow.camera.left = -55; l.shadow.camera.right = 55; l.shadow.camera.top = 55; l.shadow.camera.bottom = -55;
    l.shadow.camera.near = 10; l.shadow.camera.far = 260;
    l.shadow.bias = -0.0006; l.shadow.normalBias = 0.06;
    l.shadow.camera.updateProjectionMatrix();
    gl.shadowMap.enabled = q.shadows;
    gl.shadowMap.type = THREE.PCFShadowMap;
    gl.shadowMap.needsUpdate = true;
  }, [q, gl]);

  useFrame(({ camera }) => {
    if (!scene.fog) scene.fog = new THREE.FogExp2(0xbfd2e6, 0.002);
    const L = evaluateLighting();
    const l = sun.current;
    l.color.copy(L.sunColor);
    l.intensity = L.sunIntensity;
    // key light follows the camera so the shadow map is always where the player looks
    const px = camera.position.x, pz = camera.position.z, py = camera.position.y;
    target.position.set(px, py - 1.6, pz);
    l.position.set(px + L.lightDir.x * 130, py - 1.6 + L.lightDir.y * 130, pz + L.lightDir.z * 130);
    l.target = target;
    hemi.current.color.copy(L.hemiSky);
    hemi.current.groundColor.copy(L.hemiGround);
    hemi.current.intensity = L.hemiIntensity;
    const fog = scene.fog as THREE.FogExp2;
    fog.color.copy(L.fogColor);
    fog.density = L.fogDensity;
    const s = useGame.getState();
    gl.toneMappingExposure = L.exposure * (s.mode === "photo" ? Math.pow(2, s.photoSettings.exposure) : 1);
    updateGlow(world.lanternGlow);
  });

  return (
    <>
      <directionalLight ref={sun} intensity={3} castShadow={q.shadows} />
      <hemisphereLight ref={hemi} intensity={1} />
    </>
  );
}

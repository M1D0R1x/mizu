"use client";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { QUALITY, useGame } from "@/store/gameStore";
import { TimeSystem } from "./TimeSystem";
import { LightingSystem } from "./LightingSystem";
import { Sky } from "./Sky";
import { Player } from "./Player";
import { MenuCamera } from "./MenuCamera";
import { PostFX } from "./PostFX";
import { World } from "./World";
import { PhotoCamera } from "./PhotoCamera";
import { AudioSystem } from "./AudioSystem";
import { InteractionSystem } from "./InteractionSystem";
import { CinematicSystem } from "./CinematicSystem";
import { CaptureSystem } from "./CaptureSystem";
import { DevHooks } from "./DevHooks";
import { LanternLights } from "./LanternLights";

export function GameCanvas() {
  const quality = useGame((s) => s.settings.quality);
  const q = QUALITY[quality];
  return (
    <Canvas
      dpr={q.dpr}
      shadows={q.shadows ? "percentage" : false}
      gl={{ antialias: !q.postfx, powerPreference: "high-performance", stencil: false, depth: true, alpha: false }}
      camera={{ fov: 62, near: 0.25, far: 3200, position: [-40, 10, 110] }}
      onCreated={({ gl }) => {
        gl.setClearColor(new THREE.Color(0x0a0c12));
        gl.toneMapping = THREE.NoToneMapping;
        gl.outputColorSpace = THREE.SRGBColorSpace;
      }}
      style={{ position: "fixed", inset: 0 }}
    >
      <TimeSystem />
      <LightingSystem />
      <LanternLights />
      <Sky />
      <World />
      <Player />
      <MenuCamera />
      <PhotoCamera />
      <InteractionSystem />
      <CinematicSystem />
      <AudioSystem />
      <CaptureSystem />
      <DevHooks />
      <PostFX />
    </Canvas>
  );
}

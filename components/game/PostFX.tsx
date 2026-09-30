"use client";
import { useEffect, useRef } from "react";
import { Bloom, DepthOfField, EffectComposer, Noise, SMAA, ToneMapping, Vignette } from "@react-three/postprocessing";
import { BlendFunction, ToneMappingMode } from "postprocessing";
import { useFrame, useThree } from "@react-three/fiber";
import { QUALITY, useGame } from "@/store/gameStore";
import { lighting } from "@/lib/game/lighting";
import type { BloomEffect, DepthOfFieldEffect } from "postprocessing";
import * as THREE from "three";
import { HueSaturation, BrightnessContrast } from "@react-three/postprocessing";

export function PostFX() {
  const quality = useGame((s) => s.settings.quality);
  const mode = useGame((s) => s.mode);
  const ps = useGame((s) => s.photoSettings);
  const q = QUALITY[quality];
  const bloom = useRef<BloomEffect>(null);
  const dof = useRef<DepthOfFieldEffect>(null);
  const { gl } = useThree();

  const photo = mode === "photo";
  const dofOn = photo && ps.dof;

  // the composer's ToneMapping pass handles tone mapping; fall back to renderer ACES on low quality
  useEffect(() => { gl.toneMapping = q.postfx ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping; }, [q.postfx, gl]);

  useFrame(() => {
    if (bloom.current) bloom.current.intensity = lighting.bloom * (photo && ps.preset === "NIGHT" ? 1.4 : 1);
    if (dof.current) {
      const cocMat = dof.current.cocMaterial;
      cocMat.focusDistance = ps.focus;
      cocMat.focusRange = 1.5 + ps.focus * 0.6;
      dof.current.bokehScale = 4;
    }
  });

  if (!q.postfx) return <PlainRender />;
  const mono = photo && ps.preset === "MONOCHROME";
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <Bloom ref={bloom} intensity={0.6} luminanceThreshold={0.82} luminanceSmoothing={0.35} mipmapBlur radius={0.7} />
      {dofOn ? <DepthOfField ref={dof} focusDistance={6} focusRange={5} bokehScale={4} /> : <></>}
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <HueSaturation saturation={mono ? 0 : 0.12} />
      <BrightnessContrast contrast={0.06} />
      <Vignette eskil={false} offset={0.25} darkness={photo ? 0.75 : 0.55} />
      <Noise premultiply blendFunction={BlendFunction.SOFT_LIGHT} opacity={photo && ps.preset === "CINEMA" ? 0.16 : 0.07} />
      {mono ? <MonoEffect /> : <></>}
      {q.dpr <= 1 ? <SMAA /> : <></>}
    </EffectComposer>
  );
}

/** Without the composer, someone still has to render (a priority>0 useFrame disables R3F's auto render). */
function PlainRender() {
  useFrame(({ gl, scene, camera }) => { gl.render(scene, camera); }, 1);
  return null;
}

function MonoEffect() {
  return (
    <>
      <HueSaturation saturation={-1} />
      <BrightnessContrast contrast={0.15} />
    </>
  );
}

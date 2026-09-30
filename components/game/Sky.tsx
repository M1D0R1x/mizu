"use client";
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { U } from "@/lib/game/uniforms";
import { noiseGLSL, skyGLSL, skyUniformsGLSL } from "@/lib/game/shaders/common";

const vert = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = normalize((modelMatrix * vec4(position, 1.0)).xyz - cameraPosition);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
}`;

const frag = /* glsl */ `
precision highp float;
varying vec3 vDir;
${skyUniformsGLSL}
${noiseGLSL}
${skyGLSL}
uniform vec3 uFogColor; uniform float uMist;
void main() {
  vec3 d = normalize(vDir);
  vec3 col = skyColor(d);
  // atmospheric haze hugging the horizon (mist thickens it)
  float haze = pow(1.0 - clamp(d.y, 0.0, 1.0), 12.0 - uMist * 5.0);
  col = mix(col, uFogColor, haze * (0.6 + uMist * 0.4));
  col = mix(col, uFogColor, smoothstep(0.02, -0.25, d.y));
  gl_FragColor = vec4(col, 1.0);
}`;

export function Sky() {
  const ref = useRef<THREE.Mesh>(null!);
  const mat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader: vert, fragmentShader: frag, side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      uSunDir: U.uSunDir, uMoonDir: U.uMoonDir, uZenith: U.uZenith, uHorizon: U.uHorizon, uSunColor: U.uSunColor, uMoonColor: U.uMoonColor,
      uSunGlow: U.uSunGlow, uStars: U.uStars, uCloud: U.uCloud, uTime: U.uTime, uDaylight: U.uDaylight, uCloudBright: U.uCloudBright, uCloudDark: U.uCloudDark,
      uWind: U.uWind, uFogColor: U.uFogColor, uMist: U.uMist,
    },
  }), []);
  useFrame(({ camera }) => { ref.current.position.copy(camera.position); });
  return (
    <mesh ref={ref} material={mat} frustumCulled={false} renderOrder={-10}>
      <sphereGeometry args={[2500, 40, 24]} />
    </mesh>
  );
}

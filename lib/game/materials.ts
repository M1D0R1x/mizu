// Shared PBR materials + shader patches (wind sway, night glow).
import * as THREE from "three";
import { tex } from "./textures";
import { U } from "./uniforms";
import { windGLSL } from "./shaders/common";

export interface WindOptions {
  heightScale?: number; // weight = clamp(localY * heightScale, 0, 1)^2
  base?: number; // constant weight added (for whole-object sway like canopies)
  amount?: number; // overall multiplier
}

type Shader = Parameters<NonNullable<THREE.Material["onBeforeCompile"]>>[0];
function chain(mat: THREE.Material, key: string, fn: (shader: Shader) => void) {
  const prev = mat.onBeforeCompile;
  const prevKey = mat.customProgramCacheKey;
  mat.onBeforeCompile = (shader, renderer) => { prev?.call(mat, shader, renderer); fn(shader); };
  mat.customProgramCacheKey = () => `${prevKey ? prevKey.call(mat) : ""}|${key}`;
}

/** Surfaces darken and get glossy when it rains. */
export function withWetness<T extends THREE.Material>(mat: T, amount = 1): T {
  chain(mat, `wet${amount}`, (shader) => {
    shader.uniforms.uWetness = U.uWetness;
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\nuniform float uWetness;`)
      .replace("#include <roughnessmap_fragment>", `#include <roughnessmap_fragment>\nroughnessFactor *= (1.0 - uWetness * ${(0.6 * amount).toFixed(2)});`)
      .replace("#include <color_fragment>", `#include <color_fragment>\ndiffuseColor.rgb *= (1.0 - uWetness * ${(0.22 * amount).toFixed(2)});`);
  });
  return mat;
}

/** Patches a standard material so its vertices sway in the global wind (works with InstancedMesh). */
export function withWind<T extends THREE.Material>(mat: T, opts: WindOptions = {}): T {
  const params = new THREE.Vector3(opts.heightScale ?? 0.3, opts.base ?? 0, opts.amount ?? 1);
  chain(mat, `wind${params.x}_${params.y}_${params.z}`, (shader) => {
    shader.uniforms.uTime = U.uTime;
    shader.uniforms.uWind = U.uWind;
    shader.uniforms.uWindParams = { value: params };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", `#include <common>\nuniform float uTime; uniform vec3 uWind; uniform vec3 uWindParams;\n${windGLSL}`)
      .replace(
        "#include <project_vertex>",
        `vec4 mvPosition = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          mvPosition = instanceMatrix * mvPosition;
        #endif
        vec4 wpos = modelMatrix * mvPosition;
        float wf = clamp(position.y * uWindParams.x, 0.0, 1.0);
        wf = wf * wf + uWindParams.y;
        wpos.xyz += windOffset(wpos.xyz, wf * uWindParams.z);
        mvPosition = viewMatrix * wpos;
        gl_Position = projectionMatrix * mvPosition;`
      );
  });
  return mat;
}

/** Materials whose emissive intensity follows lanternGlow (0 by day, 1 at night). */
const glowMats: { mat: THREE.MeshStandardMaterial; max: number; min: number }[] = [];
export function registerGlow(mat: THREE.MeshStandardMaterial, max = 1, min = 0) {
  glowMats.push({ mat, max, min });
  return mat;
}
export function updateGlow(glow: number) {
  for (const g of glowMats) g.mat.emissiveIntensity = g.min + (g.max - g.min) * glow;
}

let _m: ReturnType<typeof build> | null = null;
function build() {
  const std = (p: THREE.MeshStandardMaterialParameters) => new THREE.MeshStandardMaterial(p);
  const wood = tex.wood(), plank = tex.plank(), roof = tex.roof(), stone = tex.stone(), plaster = tex.plaster(), shoji = tex.shoji(), cobble = tex.cobble(), moss = tex.moss(), noise = tex.noise();
  const roughMap = noise;
  const wet = <T extends THREE.Material>(m: T, a = 1) => withWetness(m, a);
  return {
    wood: wet(std({ map: wood, color: 0x9a7a52, roughness: 0.85, roughnessMap: roughMap })),
    darkWood: wet(std({ map: wood, color: 0x4e3524, roughness: 0.9, roughnessMap: roughMap })),
    weatheredWood: wet(std({ map: plank, color: 0x7c6d5a, roughness: 0.95 })),
    plank: wet(std({ map: plank, color: 0x9a7f5c, roughness: 0.9, roughnessMap: roughMap })),
    plaster: wet(std({ map: plaster, color: 0xe6dfcf, roughness: 0.95 }), 0.5),
    roof: wet(std({ map: roof, color: 0x7a8290, roughness: 0.75, metalness: 0.05, side: THREE.DoubleSide })),
    roofDark: wet(std({ map: roof, color: 0x4a505a, roughness: 0.8, side: THREE.DoubleSide })),
    thatch: std({ map: plank, color: 0x8a7a48, roughness: 1 }),
    stone: wet(std({ map: stone, color: 0x8f8d86, roughness: 0.95, roughnessMap: roughMap })),
    darkStone: wet(std({ map: stone, color: 0x5a5955, roughness: 0.95 })),
    cobble: wet(std({ map: cobble, color: 0x8e887c, roughness: 1 })),
    mossyStone: std({ map: moss, color: 0x6f7f52, roughness: 1 }),
    vermilion: std({ color: 0xc8391f, roughness: 0.55, roughnessMap: roughMap }),
    black: std({ color: 0x1b1a1a, roughness: 0.6 }),
    metal: std({ color: 0x6d6f73, roughness: 0.4, metalness: 0.8 }),
    rust: std({ color: 0x6e4a32, roughness: 0.9, metalness: 0.3, map: stone }),
    rail: std({ color: 0x8a8d90, roughness: 0.35, metalness: 0.9 }),
    shoji: registerGlow(std({ map: shoji, color: 0xffffff, emissive: 0xffb865, emissiveMap: shoji, emissiveIntensity: 0, roughness: 0.9 }), 1.6),
    paper: registerGlow(std({ color: 0xe6d8bc, emissive: 0xff9a3a, emissiveIntensity: 0, roughness: 0.9 }), 2.6),
    lanternRed: registerGlow(std({ color: 0xd8452a, emissive: 0xff6a2a, emissiveIntensity: 0, roughness: 0.85 }), 2.2),
    stoneLantern: registerGlow(std({ color: 0xf5e6c8, emissive: 0xffa040, emissiveIntensity: 0, roughness: 1 }), 2.4),
    flame: registerGlow(std({ color: 0xffd28a, emissive: 0xffa540, emissiveIntensity: 0, roughness: 1 }), 3.5),
    vending: registerGlow(std({ color: 0xd8dde3, emissive: 0x9ad7ff, emissiveIntensity: 0.1, roughness: 0.5, metalness: 0.2 }), 1.8, 0.1),
    cloth: std({ color: 0xe6dccb, roughness: 1, side: THREE.DoubleSide }),
    clothBlue: std({ color: 0x4e6e9c, roughness: 1, side: THREE.DoubleSide }),
    bark: std({ map: wood, color: 0x5e4634, roughness: 1 }),
    barkLight: std({ map: wood, color: 0x8d7d6b, roughness: 1 }),
    trunkSakura: std({ map: wood, color: 0x4f3f36, roughness: 1 }),
    rock: std({ map: stone, color: 0x8c8c86, roughness: 1 }),
    boat: std({ map: plank, color: 0x5e4630, roughness: 0.9 }),
    fur: std({ color: 0x8b6b48, roughness: 1 }),
    furDark: std({ color: 0x3a3230, roughness: 1 }),
    furWhite: std({ color: 0xece4d8, roughness: 1 }),
    mossTex: moss,
  };
}
export function mats() {
  if (!_m) _m = build();
  return _m;
}

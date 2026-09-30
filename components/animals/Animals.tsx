"use client";
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { world } from "@/lib/game/world";
import { U } from "@/lib/game/uniforms";
import { fogGLSL } from "@/lib/game/shaders/common";
import { LAKE, MAPLE_GROVE, SAKURA, SHRINE, SHRINE_HEIGHT, STATION, VILLAGE, isGrassy, lakeDist, streamCenterX, streamSurface, terrainHeight, WATER_LEVEL, slopeAt } from "@/lib/world/terrain";
import { mats } from "@/lib/game/materials";
import { box, cyl, sphere } from "@/lib/world/builders";
import { mulberry32, range, clamp, lerp, smoothstep } from "@/lib/world/noise";
import { DOCK } from "@/components/world/LakeSide";
import { audio } from "@/lib/game/audio";

const tmpM = new THREE.Matrix4(), tmpP = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(1, 1, 1), tmpE = new THREE.Euler();

// ---------------------------------------------------------------- birds
const birdVert = /* glsl */ `
attribute float aPhase;
uniform float uTime;
varying float vDist;
void main() {
  vec3 p = position;
  // wings: flap the outer vertices
  float flap = sin(uTime * 9.0 + aPhase * 6.28) * 0.6;
  p.y += abs(p.x) * flap;
  vec4 wp = modelMatrix * instanceMatrix * vec4(p, 1.0);
  vDist = length(wp.xyz - cameraPosition);
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;
const birdFrag = /* glsl */ `
varying float vDist;
uniform float uDaylight;
${fogGLSL}
void main() {
  vec3 col = applyFog(vec3(0.06, 0.06, 0.08) * (0.6 + 0.4 * uDaylight), vDist);
  gl_FragColor = vec4(col, 1.0);
}`;

interface Flock { center: THREE.Vector3; heading: number; radius: number; speed: number; birds: { off: THREE.Vector3; phase: number }[]; scatter: number; alive: number }

export function Birds() {
  const N = 48;
  const mesh = useMemo(() => {
    const g = new THREE.BufferGeometry();
    // simple V-shaped bird: two triangles
    g.setAttribute("position", new THREE.Float32BufferAttribute([-0.42, 0, 0.08, 0, 0, -0.14, 0, 0, 0.14, 0.42, 0, 0.08, 0, 0, -0.14, 0, 0, 0.14], 3));
    const phases = new Float32Array(N); for (let i = 0; i < N; i++) phases[i] = Math.random();
    const ig = new THREE.InstancedBufferGeometry(); ig.setAttribute("position", g.attributes.position); ig.setAttribute("aPhase", new THREE.InstancedBufferAttribute(phases, 1)); ig.instanceCount = N;
    const mat = new THREE.ShaderMaterial({ vertexShader: birdVert, fragmentShader: birdFrag, side: THREE.DoubleSide, uniforms: { uTime: U.uTime, uDaylight: U.uDaylight, uFogColor: U.uFogColor, uFogDensity: U.uFogDensity } });
    const m = new THREE.InstancedMesh(ig, mat, N); m.frustumCulled = false; m.layers.set(1);
    return m;
  }, []);
  const flocks = useRef<Flock[]>([]);
  const bellSeen = useRef(-100);
  useEffect(() => {
    const rng = mulberry32(8);
    const mk = (cx: number, cz: number, y: number, n: number, r: number): Flock => ({
      center: new THREE.Vector3(cx, y, cz), heading: rng() * 6.28, radius: r, speed: range(rng, 5, 8), scatter: 0, alive: 1,
      birds: Array.from({ length: n }, () => ({ off: new THREE.Vector3(range(rng, -1, 1) * 14, range(rng, -1, 1) * 4, range(rng, -1, 1) * 14), phase: rng() })),
    });
    flocks.current = [mk(0, 30, 55, 14, 160), mk(-120, -100, 70, 10, 120), mk(80, 200, 45, 12, 110), mk(SHRINE.x, SHRINE.z, SHRINE_HEIGHT + 12, 12, 0)];
    flocks.current[3].alive = 0; // the shrine flock waits for the bell
  }, []);
  useFrame((_, rawDt) => {
    const dt = world.frozen ? 0 : Math.min(rawDt, 0.05);
    const t = world.clock;
    let i = 0;
    // bell: release the shrine flock
    if (world.bellRungAt !== bellSeen.current && world.clock - world.bellRungAt < 1) {
      bellSeen.current = world.bellRungAt;
      const f = flocks.current[3];
      f.alive = 1; f.scatter = 1; f.center.set(SHRINE.x, SHRINE_HEIGHT + 6, SHRINE.z - 6); f.heading = Math.PI * 0.5 + (Math.random() - 0.5);
    }
    for (const f of flocks.current) {
      if (f.alive > 0) {
        if (f.scatter > 0) {
          // burst away from the shrine, then settle into a wide circle
          f.center.x += Math.sin(f.heading) * 14 * dt; f.center.z += Math.cos(f.heading) * 14 * dt; f.center.y += 6 * dt * f.scatter;
          f.scatter = Math.max(0, f.scatter - dt * 0.08);
          if (f.scatter === 0) { f.radius = 140; f.speed = 7; }
        } else {
          f.heading += (f.speed / Math.max(f.radius, 1)) * dt;
          const cx = f.radius > 0 ? Math.cos(f.heading) * f.radius : f.center.x, cz = f.radius > 0 ? Math.sin(f.heading) * f.radius + 30 : f.center.z;
          if (f.radius > 0) { f.center.x = lerp(f.center.x, cx, dt * 0.5); f.center.z = lerp(f.center.z, cz, dt * 0.5); }
          f.center.y = lerp(f.center.y, 52 + Math.sin(t * 0.05 + f.radius) * 12, dt * 0.2);
        }
      }
      const dir = f.scatter > 0 ? f.heading : f.heading + Math.PI / 2;
      for (const b of f.birds) {
        if (i >= N) break;
        const wob = Math.sin(t * 0.7 + b.phase * 10) * 2;
        tmpP.set(f.center.x + b.off.x * (1 + f.scatter * 2), f.center.y + b.off.y + wob, f.center.z + b.off.z * (1 + f.scatter * 2));
        tmpE.set(0, dir, 0); tmpQ.setFromEuler(tmpE);
        const s = f.alive > 0 ? 1 : 0;
        tmpS.set(s, s, s);
        tmpM.compose(tmpP, tmpQ, tmpS);
        mesh.setMatrixAt(i++, tmpM);
      }
    }
    for (; i < N; i++) { tmpS.set(0, 0, 0); tmpM.compose(tmpP, tmpQ, tmpS); mesh.setMatrixAt(i, tmpM); }
    mesh.instanceMatrix.needsUpdate = true;
  });
  return <primitive object={mesh} />;
}

// ---------------------------------------------------------------- deer
interface DeerState { g: THREE.Group; legs: THREE.Object3D[]; head: THREE.Object3D; pos: THREE.Vector3; target: THREE.Vector3; yaw: number; state: "graze" | "walk" | "flee" | "look"; timer: number; home: THREE.Vector3; phase: number }

function makeDeer(antlers: boolean) {
  const m = mats();
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.28, 0.9, 4, 8), m.fur); body.rotation.z = Math.PI / 2; body.position.y = 0.95; body.castShadow = true; g.add(body);
  const belly = sphere(0.22, m.furWhite, 0, 0.8, 0, 1.6, 0.6, 1); g.add(belly);
  const neck = cyl(0.1, 0.14, 0.55, m.fur, 0.55, 1.28, 0, 7); neck.rotation.z = -0.7; g.add(neck);
  const head = new THREE.Group(); head.position.set(0.8, 1.5, 0);
  head.add(box(0.36, 0.22, 0.2, m.fur, 0.08, 0, 0)); head.add(box(0.14, 0.1, 0.12, m.furDark, 0.3, -0.02, 0, 0, false));
  for (const s of [-1, 1]) { const ear = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.16, 5), m.fur); ear.position.set(-0.08, 0.16, s * 0.1); ear.rotation.z = -0.3; head.add(ear); }
  if (antlers) for (const s of [-1, 1]) { const a = cyl(0.015, 0.025, 0.45, m.furDark, -0.05, 0.3, s * 0.07, 4, false); a.rotation.z = 0.3 * s; a.rotation.x = s * 0.5; head.add(a); const b = cyl(0.012, 0.02, 0.25, m.furDark, -0.02, 0.42, s * 0.16, 4, false); b.rotation.x = s * 1.1; head.add(b); }
  g.add(head);
  const legs: THREE.Object3D[] = [];
  for (const [lx, lz] of [[0.38, 0.14], [0.38, -0.14], [-0.38, 0.14], [-0.38, -0.14]]) {
    const leg = new THREE.Group(); leg.position.set(lx, 0.75, lz);
    leg.add(cyl(0.05, 0.07, 0.75, m.fur, 0, -0.37, 0, 6)); leg.add(cyl(0.05, 0.05, 0.06, m.furDark, 0, -0.75, 0, 6, false));
    g.add(leg); legs.push(leg);
  }
  const tail = box(0.08, 0.16, 0.06, m.furWhite, -0.6, 1.05, 0, 0, false); g.add(tail);
  return { g, legs, head };
}

export function Deer() {
  const deer = useRef<DeerState[]>([]);
  const group = useMemo(() => {
    const g = new THREE.Group();
    const rng = mulberry32(21);
    const homes = [[-40, -120], [50, -80], [-100, -160], [40, 250], [-60, 290]];
    deer.current = homes.map(([hx, hz], i) => {
      const d = makeDeer(i % 2 === 0);
      const y = terrainHeight(hx, hz);
      d.g.position.set(hx, y, hz);
      g.add(d.g);
      return { ...d, pos: new THREE.Vector3(hx, y, hz), target: new THREE.Vector3(hx, y, hz), yaw: rng() * 6.28, state: "graze" as const, timer: range(rng, 2, 6), home: new THREE.Vector3(hx, 0, hz), phase: rng() * 10 };
    });
    return g;
  }, []);
  useFrame((_, rawDt) => {
    const dt = world.frozen ? 0 : Math.min(rawDt, 0.05);
    if (dt === 0) return;
    const pp = world.player.pos;
    for (const d of deer.current) {
      const dist = Math.hypot(d.pos.x - pp.x, d.pos.z - pp.z);
      d.timer -= dt;
      if (dist < 11 && d.state !== "flee") { d.state = "flee"; d.timer = 5 + Math.random() * 3; }
      if (d.state === "flee") {
        const ang = Math.atan2(d.pos.x - pp.x, d.pos.z - pp.z);
        d.target.set(d.pos.x + Math.sin(ang) * 30, 0, d.pos.z + Math.cos(ang) * 30);
        if (d.timer <= 0) { d.state = "graze"; d.timer = 4; }
      } else if (d.timer <= 0) {
        if (d.state === "graze" && dist < 25 && Math.random() < 0.5) { d.state = "look"; d.timer = 2 + Math.random() * 2; }
        else if (d.state !== "walk") {
          d.state = "walk";
          for (let k = 0; k < 6; k++) {
            const tx = d.home.x + range(Math.random, -35, 35), tz = d.home.z + range(Math.random, -35, 35);
            if (isGrassy(tx, tz) && slopeAt(tx, tz) < 0.35) { d.target.set(tx, 0, tz); break; }
          }
          d.timer = 20;
        } else { d.state = "graze"; d.timer = 3 + Math.random() * 6; }
      }
      const moving = d.state === "walk" || d.state === "flee";
      const speed = d.state === "flee" ? 7.5 : 1.1;
      if (moving) {
        const dx = d.target.x - d.pos.x, dz = d.target.z - d.pos.z, l = Math.hypot(dx, dz);
        if (l < 0.8) { d.state = "graze"; d.timer = 3 + Math.random() * 5; }
        else {
          const wantYaw = Math.atan2(dx, dz);
          let dy = wantYaw - d.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
          d.yaw += dy * Math.min(1, dt * 4);
          const nx = d.pos.x + Math.sin(d.yaw) * speed * dt, nz = d.pos.z + Math.cos(d.yaw) * speed * dt;
          const nh = terrainHeight(nx, nz);
          if (nh > WATER_LEVEL + 0.3 && slopeAt(nx, nz) < 0.6) { d.pos.x = nx; d.pos.z = nz; } else { d.state = "graze"; d.timer = 2; }
        }
      }
      d.pos.y = lerp(d.pos.y, terrainHeight(d.pos.x, d.pos.z), Math.min(1, dt * 8));
      d.g.position.copy(d.pos);
      d.g.rotation.y = d.yaw - Math.PI / 2;
      // legs
      d.phase += dt * (moving ? speed * 2.4 : 0);
      d.legs.forEach((leg, i) => { leg.rotation.z = moving ? Math.sin(d.phase + (i % 2) * Math.PI + (i > 1 ? Math.PI / 2 : 0)) * 0.5 : 0; });
      // head: graze down, look toward player, up when moving
      const wantHead = d.state === "graze" ? 0.9 : d.state === "look" ? -0.15 : 0.1;
      d.head.rotation.z = lerp(d.head.rotation.z, wantHead + Math.sin(world.clock * 1.5 + d.phase) * 0.04, Math.min(1, dt * 3));
      if (d.state === "look") {
        const ang = Math.atan2(pp.x - d.pos.x, pp.z - d.pos.z) - d.yaw;
        d.head.rotation.y = lerp(d.head.rotation.y, clamp(Math.atan2(Math.sin(ang), Math.cos(ang)), -1, 1), Math.min(1, dt * 3));
      } else d.head.rotation.y = lerp(d.head.rotation.y, 0, Math.min(1, dt * 3));
    }
  });
  return <primitive object={group} />;
}

// ---------------------------------------------------------------- cats
interface CatState { g: THREE.Group; head: THREE.Object3D; tail: THREE.Object3D; body: THREE.Object3D; pos: THREE.Vector3; target: THREE.Vector3; yaw: number; state: "sit" | "sleep" | "walk" | "stretch"; timer: number; spots: [number, number][]; phase: number }

function makeCat(color: THREE.Material, dark: THREE.Material) {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.32, 4, 8), color); body.rotation.z = Math.PI / 2; body.position.y = 0.2; body.castShadow = true;
  g.add(body);
  const head = new THREE.Group(); head.position.set(0.26, 0.3, 0);
  head.add(sphere(0.11, color, 0, 0, 0));
  for (const s of [-1, 1]) { const ear = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.08, 4), color); ear.position.set(-0.02, 0.11, s * 0.06); head.add(ear); }
  head.add(sphere(0.02, dark, 0.09, 0.02, 0.04), sphere(0.02, dark, 0.09, 0.02, -0.04));
  g.add(head);
  const tail = cyl(0.015, 0.025, 0.32, color, -0.25, 0.28, 0, 5, false); tail.rotation.z = -0.9; g.add(tail);
  for (const [lx, lz] of [[0.14, 0.06], [0.14, -0.06], [-0.14, 0.06], [-0.14, -0.06]]) g.add(cyl(0.025, 0.03, 0.18, color, lx, 0.09, lz, 5, false));
  return { g, head, tail, body };
}

export function Cats() {
  const cats = useRef<CatState[]>([]);
  const group = useMemo(() => {
    const g = new THREE.Group();
    const m = mats();
    const orange = new THREE.MeshStandardMaterial({ color: 0xc77b3a, roughness: 1 }), grey = new THREE.MeshStandardMaterial({ color: 0x6e6a66, roughness: 1 });
    const V = VILLAGE;
    const defs: { mat: THREE.Material; spots: [number, number][] }[] = [
      { mat: orange, spots: [[V.x - 8, V.z - 6.8], [V.x - 12, V.z - 3.5], [V.x - 2, V.z - 5]] },
      { mat: m.furWhite, spots: [[V.x + 20, V.z + 4], [V.x + 26, V.z + 2], [V.x + 14, V.z + 7]] },
      { mat: grey, spots: [[V.x - 30, V.z - 4.5], [V.x - 34, V.z - 2], [V.x - 24, V.z + 1]] },
      { mat: m.furDark, spots: [[STATION.x + 6.8, 147.6], [STATION.x + 12.2, 147.6], [STATION.x + 3.5, 147.0]] }, // the black cat lives on the station platform
    ];
    cats.current = defs.map((d, i) => {
      const c = makeCat(d.mat, m.furDark);
      const [sx, sz] = d.spots[0];
      const y = i === 3 ? STATION.height + 1.0 : V.height;
      c.g.position.set(sx, y, sz);
      g.add(c.g);
      return { ...c, pos: new THREE.Vector3(sx, y, sz), target: new THREE.Vector3(sx, y, sz), yaw: Math.random() * 6.28, state: (i % 2 ? "sleep" : "sit") as CatState["state"], timer: 5 + Math.random() * 10, spots: d.spots, phase: Math.random() * 10 };
    });
    return g;
  }, []);
  useFrame((_, rawDt) => {
    const dt = world.frozen ? 0 : Math.min(rawDt, 0.05);
    if (dt === 0) return;
    const pp = world.player.pos;
    cats.current.forEach((c, ci) => {
      c.timer -= dt;
      if (c.timer <= 0) {
        if (c.state === "walk") { c.state = Math.random() < 0.5 ? "sit" : "sleep"; c.timer = 12 + Math.random() * 25; }
        else if (c.state === "sleep" && Math.random() < 0.5) { c.state = "stretch"; c.timer = 2.2; }
        else { const s = c.spots[Math.floor(Math.random() * c.spots.length)]; c.target.set(s[0], c.pos.y, s[1]); c.state = "walk"; c.timer = 30; }
      }
      if (c.state === "walk") {
        const dx = c.target.x - c.pos.x, dz = c.target.z - c.pos.z, l = Math.hypot(dx, dz);
        if (l < 0.3) { c.state = "sit"; c.timer = 10 + Math.random() * 20; }
        else {
          const want = Math.atan2(dx, dz); let dy = want - c.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); c.yaw += dy * Math.min(1, dt * 5);
          c.pos.x += Math.sin(c.yaw) * 0.9 * dt; c.pos.z += Math.cos(c.yaw) * 0.9 * dt;
        }
      }
      c.phase += dt;
      c.g.position.copy(c.pos);
      c.g.rotation.y = c.yaw - Math.PI / 2;
      const sleeping = c.state === "sleep", stretching = c.state === "stretch";
      c.body.scale.y = lerp(c.body.scale.y, sleeping ? 0.6 : 1, dt * 3);
      c.body.position.y = lerp(c.body.position.y, sleeping ? 0.14 : 0.2, dt * 3);
      c.g.scale.x = lerp(c.g.scale.x, stretching ? 1.35 : 1, dt * 3);
      c.head.position.y = lerp(c.head.position.y, sleeping ? 0.18 : c.state === "sit" ? 0.34 : 0.3, dt * 3);
      c.tail.rotation.x = Math.sin(c.phase * (sleeping ? 0.6 : 2.2) + ci) * 0.4;
      // look at the player when close
      const dist = Math.hypot(pp.x - c.pos.x, pp.z - c.pos.z);
      if (dist < 9 && !sleeping) {
        const ang = Math.atan2(pp.x - c.pos.x, pp.z - c.pos.z) - c.yaw;
        c.head.rotation.y = lerp(c.head.rotation.y, clamp(Math.atan2(Math.sin(ang), Math.cos(ang)), -1.2, 1.2), dt * 4);
      } else c.head.rotation.y = lerp(c.head.rotation.y, Math.sin(c.phase * 0.3) * 0.2, dt * 2);
    });
  });
  return <primitive object={group} />;
}

// ---------------------------------------------------------------- fish
export function Fish() {
  const N = 70;
  const data = useRef<{ cx: number; cz: number; r: number; speed: number; phase: number; depth: number; stream: boolean }[]>([]);
  const mesh = useMemo(() => {
    const geo = new THREE.SphereGeometry(1, 8, 6); geo.scale(0.3, 0.09, 0.07);
    const mat = new THREE.MeshStandardMaterial({ color: 0x9a8f78, roughness: 0.6, metalness: 0.3, transparent: true, opacity: 0.85 });
    const m = new THREE.InstancedMesh(geo, mat, N); m.frustumCulled = false; m.layers.set(1);
    const rng = mulberry32(64);
    data.current = Array.from({ length: N }, (_, i) => {
      const stream = i >= 56;
      if (stream) { const z = range(rng, 120, 340); return { cx: streamCenterX(z), cz: z, r: 1.2, speed: range(rng, 0.5, 1), phase: rng() * 6.28, depth: 0.25, stream }; }
      const a = rng() * 6.28, d = Math.sqrt(rng()) * 70;
      return { cx: LAKE.x + Math.cos(a) * d, cz: LAKE.z + Math.sin(a) * d, r: range(rng, 2, 7), speed: range(rng, 0.25, 0.6), phase: rng() * 6.28, depth: range(rng, 0.35, 1.6), stream };
    });
    return m;
  }, []);
  useFrame(() => {
    const t = world.clock;
    const fed = world.clock - world.fishFedAt;
    data.current.forEach((f, i) => {
      let cx = f.cx, cz = f.cz, r = f.r;
      if (!f.stream && fed < 40) {
        // gather near the end of the dock for a while
        const k = smoothstep(0, 6, fed) * (1 - smoothstep(25, 40, fed));
        cx = lerp(f.cx, DOCK.endX - DOCK.dx * 3, k); cz = lerp(f.cz, DOCK.endZ - DOCK.dz * 3, k); r = lerp(f.r, 2.5, k);
      }
      const a = t * f.speed + f.phase;
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r * (f.stream ? 0.3 : 1);
      const surface = Math.sin(t * 0.37 + f.phase * 3) > 0.985 ? 1 : 0; // brief rises
      const base = f.stream ? streamSurface(z) : WATER_LEVEL;
      const bed = terrainHeight(x, z);
      const y = Math.max(bed + 0.1, base - f.depth + surface * f.depth * 0.9);
      if (f.stream && bed > base - 0.1) { tmpS.set(0, 0, 0); } else tmpS.set(1, 1, 1);
      tmpP.set(x, y, z);
      tmpE.set(0, -a - Math.PI / 2 + Math.sin(t * 6 + f.phase) * 0.15, 0); tmpQ.setFromEuler(tmpE);
      tmpM.compose(tmpP, tmpQ, tmpS);
      mesh.setMatrixAt(i, tmpM);
      if (surface && !f.stream && Math.random() < 0.02) {
        const d = Math.hypot(x - world.player.pos.x, z - world.player.pos.z);
        if (d < 25) audio.splash();
      }
    });
    mesh.instanceMatrix.needsUpdate = true;
  });
  return <primitive object={mesh} />;
}

// ---------------------------------------------------------------- butterflies
const bfVert = /* glsl */ `
attribute vec3 aHome; attribute float aPhase;
uniform float uTime; uniform float uDaylight; uniform vec3 uCamPos;
varying vec2 vUv; varying float vId;
void main() {
  vUv = uv; vId = aPhase;
  float t = uTime * (0.5 + aPhase * 0.4);
  vec3 p = aHome + vec3(sin(t + aPhase * 30.0) * 3.0 + sin(t * 2.7) * 0.5, 0.6 + sin(t * 1.7 + aPhase * 9.0) * 0.5, cos(t * 0.8 + aPhase * 17.0) * 3.0);
  // a few butterflies wander near the visitor
  if (aPhase > 0.9) p = uCamPos + vec3(sin(t * 0.6 + aPhase * 50.0) * 2.5, -0.6 + sin(t * 1.3) * 0.5, cos(t * 0.5 + aPhase * 40.0) * 2.5);
  float flap = sin(uTime * 14.0 + aPhase * 6.28);
  vec3 local = position * 0.07;
  local.y += abs(local.x) * flap * 1.6;
  float heading = t + aPhase * 30.0;
  float c = cos(heading), s = sin(heading);
  local = vec3(local.x * c - local.z * s, local.y, local.x * s + local.z * c);
  float day = smoothstep(0.35, 0.7, uDaylight);
  gl_Position = projectionMatrix * viewMatrix * vec4(p + local * day, 1.0);
}`;
const bfFrag = /* glsl */ `
varying vec2 vUv; varying float vId;
void main() {
  vec3 a = vec3(0.98, 0.95, 0.85), b = vec3(0.95, 0.6, 0.2), c = vec3(0.55, 0.65, 0.95);
  vec3 col = vId < 0.4 ? a : vId < 0.75 ? b : c;
  // two rounded wing lobes
  float side = vUv.x < 0.5 ? 0.26 : 0.74;
  float lobe = length((vUv - vec2(side, 0.5)) * vec2(1.0, 1.25));
  if (lobe > 0.26 && abs(vUv.x - 0.5) > 0.04) discard;
  col *= 0.75 + 0.25 * smoothstep(0.26, 0.05, lobe);
  col = mix(col, vec3(0.15, 0.1, 0.08), step(0.9, 1.0 - abs(vUv.x - 0.5) * 2.0) * 0.6);
  gl_FragColor = vec4(col, 1.0);
}`;

export function Butterflies() {
  const mesh = useMemo(() => {
    const N = 90;
    const rng = mulberry32(12);
    const homes = new Float32Array(N * 3), phases = new Float32Array(N);
    const spots = [[VILLAGE.x, VILLAGE.z + 40], [VILLAGE.x - 20, VILLAGE.z - 40], [SAKURA.x + 20, SAKURA.z + 20], [SAKURA.x - 30, SAKURA.z - 10], [MAPLE_GROVE.x, MAPLE_GROVE.z + 20], [-40, 130], [30, 190], [130, 120]];
    for (let i = 0; i < N; i++) {
      const s = spots[i % spots.length];
      const x = s[0] + range(rng, -18, 18), z = s[1] + range(rng, -18, 18);
      homes[i * 3] = x; homes[i * 3 + 1] = Math.max(terrainHeight(x, z), WATER_LEVEL) + 0.5; homes[i * 3 + 2] = z;
      phases[i] = rng();
    }
    const quad = new THREE.PlaneGeometry(1, 1);
    const geo = new THREE.InstancedBufferGeometry(); geo.index = quad.index; geo.setAttribute("position", quad.attributes.position); geo.setAttribute("uv", quad.attributes.uv);
    geo.setAttribute("aHome", new THREE.InstancedBufferAttribute(homes, 3)); geo.setAttribute("aPhase", new THREE.InstancedBufferAttribute(phases, 1)); geo.instanceCount = N;
    const mat = new THREE.ShaderMaterial({ vertexShader: bfVert, fragmentShader: bfFrag, side: THREE.DoubleSide, uniforms: { uTime: U.uTime, uDaylight: U.uDaylight, uCamPos: U.uCamPos } });
    const m = new THREE.Mesh(geo, mat); m.frustumCulled = false; m.layers.set(1);
    return m;
  }, []);
  return <primitive object={mesh} />;
}

export function Animals() {
  return (
    <>
      <Birds />
      <Deer />
      <Cats />
      <Fish />
      <Butterflies />
    </>
  );
}

export { lakeDist };

"use client";
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { STATION, TRACK_HALF_LENGTH, streamCenterX, terrainHeight } from "@/lib/world/terrain";
import { bench, box, cyl, house, paperLantern , mergeStatic } from "@/lib/world/builders";
import { mats, registerGlow } from "@/lib/game/materials";
import { tex } from "@/lib/game/textures";
import { addCollider } from "@/lib/game/colliders";
import { addInteractable } from "@/lib/game/interactables";
import { sit, whisper } from "@/lib/game/actions";
import { world } from "@/lib/game/world";
import { audio } from "@/lib/game/audio";
import { useGame } from "@/store/gameStore";

const S = STATION, TZ = S.trackZ, Y = S.height;

export function Station() {
  const group = useMemo(() => {
    const g = new THREE.Group();
    const m = mats();
    // ---- tracks ----
    const len = TRACK_HALF_LENGTH * 2;
    for (const s of [-1, 1]) g.add(box(len, 0.14, 0.09, m.rail, 0, Y + 0.32, TZ + s * 0.72, 0, false));
    const nS = Math.floor(len / 0.85);
    const sleepers = new THREE.InstancedMesh(new THREE.BoxGeometry(0.24, 0.12, 2.3), m.darkWood, nS);
    const tm = new THREE.Matrix4();
    for (let i = 0; i < nS; i++) { tm.makeTranslation(-TRACK_HALF_LENGTH + (i + 0.5) * 0.85, Y + 0.2, TZ); sleepers.setMatrixAt(i, tm); }
    sleepers.receiveShadow = true; g.add(sleepers);
    // ballast ridge
    g.add(box(len, 0.28, 3.4, m.darkStone, 0, Y + 0.08, TZ, 0, false));
    // overhead poles + wire
    for (let x = -TRACK_HALF_LENGTH + 12; x < TRACK_HALF_LENGTH; x += 28) {
      g.add(cyl(0.09, 0.12, 6.5, m.metal, x, Y + 3.2, TZ + 2.4, 6));
      g.add(box(2.6, 0.08, 0.08, m.metal, x, Y + 6.2, TZ + 1.2, 0, false));
      g.add(cyl(0.05, 0.05, 0.6, m.rust, x, Y + 5.9, TZ + 0.5, 5, false));
    }
    g.add(box(len, 0.02, 0.02, m.black, 0, Y + 5.6, TZ, 0, false));
    // trestle over the stream
    const sx = streamCenterX(TZ);
    for (let i = -1; i <= 1; i++) for (const s of [-1, 1]) g.add(cyl(0.16, 0.2, 4, m.darkWood, sx + i * 3.2 + s * 1.1, Y - 1.5, TZ + s * 0.9, 6));
    g.add(box(12, 0.3, 2.8, m.darkWood, sx, Y - 0.1, TZ));
    // tunnel portals
    for (const s of [-1, 1]) {
      const px = s * (TRACK_HALF_LENGTH - 1);
      const portal = new THREE.Group();
      const shape = new THREE.Shape();
      shape.absarc(0, 0, 4.8, 0, Math.PI, false); shape.lineTo(-4.8, -0.2); shape.lineTo(4.8, -0.2); shape.closePath();
      const hole = new THREE.Path(); hole.absarc(0, 0, 3.4, 0, Math.PI, false); hole.lineTo(-3.4, -0.2); hole.lineTo(3.4, -0.2); hole.closePath();
      shape.holes.push(hole);
      const arch = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 2.4, bevelEnabled: false }), m.darkStone);
      arch.position.set(0, Y + 0.2, -1.2); arch.castShadow = true; arch.receiveShadow = true;
      portal.add(arch);
      const dark = new THREE.Mesh(new THREE.PlaneGeometry(6.8, 4.2), m.black); dark.position.set(0, Y + 2.0, 0);
      (dark.material as THREE.Material).side = THREE.DoubleSide;
      portal.add(dark);
      portal.position.set(px, 0, TZ); portal.rotation.y = Math.PI / 2;
      g.add(portal);
    }
    // ---- platform + building ----
    g.add(box(42, 1.0, 4.4, m.cobble, S.x, Y + 0.5, TZ - 3.6));
    g.add(box(42, 0.12, 0.3, m.plaster, S.x, Y + 1.02, TZ - 1.5, 0, false)); // white edge line
    g.add(house({ w: 8.5, d: 5.5, h: 3.1, x: S.x - 4, z: TZ - 9.5, y: Y + 0.9, ry: 0, seed: 7, weathered: true, veranda: false, roofMat: m.roofDark }));
    // platform canopy
    for (let i = -2; i <= 2; i++) g.add(cyl(0.1, 0.1, 3.2, m.rust, S.x + i * 6, Y + 2.6, TZ - 2.2, 6));
    g.add(box(28, 0.12, 3.6, m.roof, S.x, Y + 4.25, TZ - 3.4));
    g.add(box(28, 0.14, 0.14, m.rust, S.x, Y + 4.15, TZ - 1.7, 0, false));
    g.add(bench(S.x + 6, Y + 1.0, TZ - 4.4, Math.PI));
    g.add(bench(S.x + 13, Y + 1.0, TZ - 4.4, Math.PI));
    // vending machine, softly humming, always lit a little
    const vend = new THREE.Group();
    vend.add(box(0.95, 1.9, 0.75, m.metal, 0, 0.95, 0));
    const face = box(0.8, 1.2, 0.04, m.vending, 0, 1.25, 0.39, 0, false);
    vend.add(face);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) vend.add(box(0.12, 0.22, 0.02, r === 1 && c === 2 ? m.vermilion : m.black, -0.3 + c * 0.2, 1.6 - r * 0.32, 0.42, 0, false));
    vend.position.set(S.x + 3.2, Y + 1.0, TZ - 5.4);
    g.add(vend);
    // timetable board and a small hanging sign
    const board = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.4), new THREE.MeshStandardMaterial({ map: tex.timetable(), roughness: 0.9 }));
    board.position.set(S.x - 4, Y + 2.6, TZ - 6.68); g.add(board);
    g.add(box(1.5, 1.5, 0.06, m.darkWood, S.x - 4, Y + 2.6, TZ - 6.72));
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.5), registerGlow(new THREE.MeshStandardMaterial({ color: 0xf0ece0, emissive: 0xfff0d0, emissiveIntensity: 0, roughness: 0.8 }), 0.8));
    sign.position.set(S.x, Y + 3.7, TZ - 1.6); g.add(sign);
    for (const s of [-1, 1]) g.add(cyl(0.02, 0.02, 0.45, m.black, S.x + s * 1.0, Y + 4.0, TZ - 1.6, 4, false));
    g.add(paperLantern(S.x - 9, Y + 4.0, TZ - 6.6, true, 1.0));
    // a photograph tucked into the building's window ledge
    const photo = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.32), new THREE.MeshStandardMaterial({ map: tex.photo(), roughness: 1 }));
    photo.position.set(S.x - 4 + 2.2, Y + 2.15, TZ - 6.7); photo.rotation.x = -0.35; g.add(photo);
    // weeds between tracks: handled by grass mask; add a rusted bicycle and an old crate
    g.add(box(0.8, 0.6, 0.6, m.weatheredWood, S.x + 18, Y + 1.3, TZ - 5.0, 0.3));
    addCollider(S.x - 4, TZ - 9.5, 5.4);
    addCollider(S.x + 3.2, TZ - 5.4, 0.8);
    return mergeStatic(g);
  }, []);

  useEffect(() => {
    const offs = [
      addInteractable({ x: S.x - 4, y: Y + 2, z: TZ - 6, radius: 2.6, label: "READ THE TIMETABLE", action: () => whisper("THE LAST TRAIN IS NOT LISTED") }),
      addInteractable({ x: S.x - 1.8, y: Y + 2, z: TZ - 6, radius: 2.2, label: "LOOK AT THE PHOTOGRAPH", action: () => whisper("TWO PEOPLE. THE SAME LAKE. LONG AGO.") }),
      addInteractable({ x: S.x + 3.2, y: Y + 1.9, z: TZ - 4.6, radius: 2.2, label: "PRESS A BUTTON", action: () => { audio.ui(); whisper("SOLD OUT"); } }),
      ...[[S.x + 6, TZ - 4.4], [S.x + 13, TZ - 4.4]].map(([bx, bz]) => addInteractable({ x: bx, y: Y + 1, z: bz, radius: 2.2, label: "SIT", action: () => { sit(bx, bz, Math.PI); world.player.pos.y = Y + 1.0; } })),
    ];
    return () => offs.forEach((f) => f());
  }, []);

  return <primitive object={group} />;
}

/** A two-car local train that occasionally crosses the valley. Nobody controls it. */
export function Train() {
  const ref = useRef<THREE.Group>(null!);
  const dir = useRef(1);
  const rumbleTimer = useRef(0);
  const train = useMemo(() => {
    const g = new THREE.Group();
    const m = mats();
    const body = new THREE.MeshStandardMaterial({ color: 0xe8dcc0, roughness: 0.5, metalness: 0.2 });
    const stripe = new THREE.MeshStandardMaterial({ color: 0xc8391f, roughness: 0.5 });
    const glass = registerGlow(new THREE.MeshStandardMaterial({ color: 0x6f7f8a, emissive: 0xffd9a0, emissiveIntensity: 0, roughness: 0.2, metalness: 0.4 }), 1.4);
    for (let c = 0; c < 2; c++) {
      const car = new THREE.Group();
      car.add(box(15, 2.6, 2.7, body, 0, 1.9, 0));
      const top = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.35, 15, 12, 1, false, 0, Math.PI), m.roof);
      top.rotation.z = Math.PI / 2; top.position.set(0, 3.2, 0); top.castShadow = true; car.add(top);
      car.add(box(15.02, 0.35, 2.72, stripe, 0, 1.25, 0, 0, false));
      for (let w = -6; w <= 6; w += 1.5) car.add(box(1.0, 0.9, 2.76, glass, w, 2.35, 0, 0, false));
      for (const bx of [-4.5, 4.5]) car.add(box(3, 0.7, 2.2, m.black, bx, 0.45, 0));
      car.position.x = (c - 0.5) * 15.6;
      g.add(car);
    }
    const head = registerGlow(new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff4d6, emissiveIntensity: 0.4, roughness: 0.3 }), 4, 0.4);
    for (const s of [-1, 1]) { const l = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), head); l.position.set(s * 15.65, 2.0, 0); g.add(l); }
    g.visible = false;
    return g;
  }, []);

  useFrame((_, dt) => {
    if (world.frozen) return;
    const g = ref.current;
    if (!world.trainActive) {
      if (world.trainTimer <= 0 && useGame.getState().mode === "playing") {
        world.trainActive = true; world.trainProgress = 0; dir.current = Math.random() < 0.5 ? 1 : -1;
        const px = world.player.pos.x, pz = world.player.pos.z;
        audio.trainHorn(Math.hypot(px + dir.current * TRACK_HALF_LENGTH, pz - TZ));
      }
      g.visible = false;
      return;
    }
    g.visible = true;
    const speed = 11 / (TRACK_HALF_LENGTH * 2);
    world.trainProgress += dt * speed;
    const x = (-TRACK_HALF_LENGTH + world.trainProgress * TRACK_HALF_LENGTH * 2) * dir.current;
    g.position.set(x, Y + 0.3, TZ);
    g.rotation.y = dir.current > 0 ? 0 : Math.PI;
    const dist = Math.hypot(world.player.pos.x - x, world.player.pos.z - TZ);
    rumbleTimer.current -= dt;
    if (rumbleTimer.current <= 0) { rumbleTimer.current = 5.5; audio.trainRumble(dist, 6); }
    if (Math.abs(world.trainProgress - 0.42) < dt * speed && dist < 400) audio.trainHorn(dist);
    if (world.trainProgress >= 1) { world.trainActive = false; world.trainTimer = 200 + Math.random() * 260; }
  });

  return <primitive ref={ref} object={train} />;
}

export { terrainHeight };

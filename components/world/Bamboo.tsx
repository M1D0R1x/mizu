"use client";
import { useMemo } from "react";
import * as THREE from "three";
import { BAMBOO, terrainHeight, pathDist, slopeAt } from "@/lib/world/terrain";
import { mulberry32, range } from "@/lib/world/noise";
import { withWind } from "@/lib/game/materials";
import { tex } from "@/lib/game/textures";
import { QUALITY, useGame } from "@/store/gameStore";

const tmpM = new THREE.Matrix4(), tmpP = new THREE.Vector3(), tmpQ = new THREE.Quaternion(), tmpS = new THREE.Vector3(), tmpC = new THREE.Color(), eul = new THREE.Euler();

/** A dense grove of swaying bamboo with leaf clusters high above the path. */
export function BambooForest() {
  const quality = useGame((s) => s.settings.quality);
  const q = QUALITY[quality];
  const group = useMemo(() => {
    const g = new THREE.Group();
    const rng = mulberry32(777);
    const count = Math.round(1700 * (0.55 + 0.45 * q.grass));
    const stalks: { x: number; z: number; y: number; h: number; r: number; lean: [number, number]; tint: number }[] = [];
    let tries = 0;
    while (stalks.length < count && tries < count * 8) {
      tries++;
      const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * BAMBOO.radius;
      const x = BAMBOO.x + Math.cos(a) * d, z = BAMBOO.z + Math.sin(a) * d * 1.15;
      if (pathDist(x, z) < 2.6) continue;
      if (slopeAt(x, z) > 0.5) continue;
      const y = terrainHeight(x, z);
      stalks.push({ x, z, y: y - 0.2, h: range(rng, 8, 13), r: range(rng, 0.06, 0.11), lean: [range(rng, -0.05, 0.05), range(rng, -0.05, 0.05)], tint: rng() });
    }
    // stalk geometry: unit height cylinder from 0..1 (scaled per instance)
    const stalk = new THREE.CylinderGeometry(0.8, 1, 1, 7, 8, true);
    stalk.translate(0, 0.5, 0);
    const uv = stalk.attributes.uv as THREE.BufferAttribute;
    for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * 7); // 7 nodes per stalk
    const bandTex = tex.bamboo();
    const stalkMat = withWind(new THREE.MeshStandardMaterial({ map: bandTex, roughness: 0.6, color: 0xffffff }), { heightScale: 1.05, amount: 1.4 });
    const stalkMesh = new THREE.InstancedMesh(stalk, stalkMat, stalks.length);
    // leaf clusters: crossed quads with leaf alpha
    const leafGeo = new THREE.BufferGeometry();
    const pos: number[] = [], uvs: number[] = [], idx: number[] = [], nrm: number[] = [];
    let o = 0;
    for (let k = 0; k < 7; k++) {
      const ang = (k / 7) * Math.PI * 2 + 0.3, tilt = 0.5 + (k % 3) * 0.3;
      const L = 1.1, W = 0.32;
      const dir = new THREE.Vector3(Math.cos(ang), -Math.sin(tilt), Math.sin(ang)).normalize();
      const side = new THREE.Vector3(-Math.sin(ang), 0, Math.cos(ang)).multiplyScalar(W / 2);
      const base = new THREE.Vector3(0, (k % 2) * 0.6, 0);
      const tip = base.clone().addScaledVector(dir, L);
      const v = [base.clone().sub(side), base.clone().add(side), tip.clone().add(side), tip.clone().sub(side)];
      for (const p of v) { pos.push(p.x, p.y, p.z); nrm.push(0, 1, 0); }
      uvs.push(0, 0, 1, 0, 1, 1, 0, 1);
      idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
      o += 4;
    }
    leafGeo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    leafGeo.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
    leafGeo.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    leafGeo.setIndex(idx);
    const leafMat = withWind(new THREE.MeshStandardMaterial({ alphaMap: tex.leaf(), transparent: false, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.8, color: 0xffffff }), { heightScale: 0, base: 1, amount: 1.4 });
    const clustersPerStalk = 3;
    const leafMesh = new THREE.InstancedMesh(leafGeo, leafMat, stalks.length * clustersPerStalk);
    let li = 0;
    stalks.forEach((s, i) => {
      tmpP.set(s.x, s.y, s.z);
      eul.set(s.lean[0], rng() * 6.28, s.lean[1]);
      tmpQ.setFromEuler(eul);
      tmpS.set(s.r, s.h, s.r);
      tmpM.compose(tmpP, tmpQ, tmpS);
      stalkMesh.setMatrixAt(i, tmpM);
      stalkMesh.setColorAt(i, tmpC.setHSL(0.2 + s.tint * 0.08, 0.45, 0.55 + s.tint * 0.18, THREE.SRGBColorSpace));
      for (let c = 0; c < clustersPerStalk; c++) {
        const t = 0.62 + c * 0.14 + rng() * 0.06;
        const lx = s.x + s.lean[1] * s.h * t * 0.9, lz = s.z - s.lean[0] * s.h * t * 0.9; // approx follows lean
        tmpP.set(lx, s.y + s.h * t, lz);
        eul.set(0, rng() * 6.28, 0);
        tmpQ.setFromEuler(eul);
        const sc = range(rng, 0.8, 1.3);
        tmpS.set(sc, sc, sc);
        tmpM.compose(tmpP, tmpQ, tmpS);
        leafMesh.setMatrixAt(li, tmpM);
        leafMesh.setColorAt(li, tmpC.setHSL(0.25 + s.tint * 0.06, 0.5, 0.4 + rng() * 0.15, THREE.SRGBColorSpace));
        li++;
      }
    });
    stalkMesh.instanceMatrix.needsUpdate = true; leafMesh.instanceMatrix.needsUpdate = true;
    stalkMesh.castShadow = true; stalkMesh.receiveShadow = true; leafMesh.castShadow = true;
    stalkMesh.frustumCulled = false; leafMesh.frustumCulled = false;
    g.add(stalkMesh, leafMesh);
    return g;
  }, [q.grass]);
  return <primitive object={group} />;
}

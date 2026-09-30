// Procedural stylised trees: merged geometries meant to be instanced hundreds of times.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { mulberry32, range, type Rng, fbm } from "./noise";

const up = new THREE.Vector3(0, 1, 0);

function limb(rng: Rng, from: THREE.Vector3, dir: THREE.Vector3, length: number, r0: number, r1: number, segs = 6) {
  const g = new THREE.CylinderGeometry(r1, r0, length, segs, 1, true);
  g.translate(0, length / 2, 0);
  const q = new THREE.Quaternion().setFromUnitVectors(up, dir.clone().normalize());
  g.applyQuaternion(q);
  g.translate(from.x, from.y, from.z);
  void rng;
  return g;
}

/** Trunk + a few branches. Returns geometry and branch tip points (for canopy blobs). */
export function makeTrunk(seed: number, opts: { height: number; radius: number; branches: number; lean?: number; spread?: number }) {
  const rng = mulberry32(seed);
  const parts: THREE.BufferGeometry[] = [];
  const tips: THREE.Vector3[] = [];
  const lean = opts.lean ?? 0.08;
  const dir = new THREE.Vector3(range(rng, -lean, lean), 1, range(rng, -lean, lean)).normalize();
  const h = opts.height;
  parts.push(limb(rng, new THREE.Vector3(0, -0.3, 0), dir, h * 0.62 + 0.3, opts.radius, opts.radius * 0.55, 7));
  const fork = dir.clone().multiplyScalar(h * 0.62).add(new THREE.Vector3(0, -0.3, 0));
  const spread = opts.spread ?? 0.7;
  for (let i = 0; i < opts.branches; i++) {
    const a = (i / opts.branches) * Math.PI * 2 + range(rng, -0.4, 0.4);
    const bdir = new THREE.Vector3(Math.cos(a) * spread, range(rng, 0.7, 1.2), Math.sin(a) * spread).normalize();
    const len = h * range(rng, 0.3, 0.48);
    parts.push(limb(rng, fork, bdir, len, opts.radius * 0.5, opts.radius * 0.18, 5));
    const tip = fork.clone().add(bdir.clone().multiplyScalar(len));
    tips.push(tip);
    // secondary twig
    const tdir = bdir.clone().add(new THREE.Vector3(range(rng, -0.6, 0.6), 0.4, range(rng, -0.6, 0.6))).normalize();
    const tl = len * 0.55;
    parts.push(limb(rng, fork.clone().add(bdir.clone().multiplyScalar(len * 0.55)), tdir, tl, opts.radius * 0.25, opts.radius * 0.08, 4));
    tips.push(fork.clone().add(bdir.clone().multiplyScalar(len * 0.55)).add(tdir.multiplyScalar(tl)));
  }
  const geo = mergeGeometries(parts, false)!;
  geo.computeVertexNormals();
  return { geo, tips, top: fork.clone().add(dir.clone().multiplyScalar(h * 0.1)) };
}

/** Puffy canopy made of displaced icosahedron blobs around given anchor points. Vertex colour = shading gradient. */
export function makeCanopy(seed: number, anchors: THREE.Vector3[], opts: { radius: number; jitter?: number; flatten?: number; extra?: number }) {
  const rng = mulberry32(seed * 7 + 1);
  const parts: THREE.BufferGeometry[] = [];
  const pts = anchors.slice();
  for (let i = 0; i < (opts.extra ?? 2); i++) {
    const a = anchors[Math.floor(rng() * anchors.length)];
    pts.push(a.clone().add(new THREE.Vector3(range(rng, -1, 1), range(rng, -0.4, 0.8), range(rng, -1, 1)).multiplyScalar(opts.radius * 0.6)));
  }
  for (const p of pts) {
    const r = opts.radius * range(rng, 0.75, 1.25);
    const g = new THREE.IcosahedronGeometry(r, 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const jitter = opts.jitter ?? 0.22;
    const ox = rng() * 100, oz = rng() * 100;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      const n = fbm(x * 0.9 + ox, z * 0.9 + y * 0.7 + oz, 3);
      const s = 1 + n * jitter;
      pos.setXYZ(i, x * s, y * s * (opts.flatten ?? 0.8), z * s);
    }
    g.translate(p.x, p.y, p.z);
    parts.push(g);
  }
  const geo = mergeGeometries(parts, false)!;
  geo.computeVertexNormals();
  // vertex colour: darker underneath for depth
  const pos = geo.attributes.position as THREE.BufferAttribute;
  let minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < pos.count; i++) { minY = Math.min(minY, pos.getY(i)); maxY = Math.max(maxY, pos.getY(i)); }
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const t = (pos.getY(i) - minY) / (maxY - minY + 1e-3);
    const v = 0.74 + 0.26 * Math.pow(t, 0.8);
    col[i * 3] = v; col[i * 3 + 1] = v; col[i * 3 + 2] = v;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  return geo;
}

/** Conifer: layered cones with noisy edges. */
export function makeConifer(seed: number, opts: { height: number; tiers: number; width: number }) {
  const rng = mulberry32(seed * 13 + 5);
  const parts: THREE.BufferGeometry[] = [];
  const base = opts.height * 0.22;
  for (let i = 0; i < opts.tiers; i++) {
    const t = i / opts.tiers;
    const y = base + t * (opts.height - base) * 0.85;
    const w = opts.width * (1 - t * 0.72) * range(rng, 0.9, 1.1);
    const h = (opts.height - base) / opts.tiers * 1.9;
    const g = new THREE.ConeGeometry(w, h, 9, 2, true);
    const pos = g.attributes.position as THREE.BufferAttribute;
    for (let k = 0; k < pos.count; k++) {
      const x = pos.getX(k), yy = pos.getY(k), z = pos.getZ(k);
      const n = fbm(x * 1.3 + i * 3, z * 1.3, 2) * 0.18;
      pos.setXYZ(k, x * (1 + n), yy + Math.abs(n) * 0.6 - (Math.hypot(x, z) / Math.max(w, 0.01)) * 0.35 * h * 0.3, z * (1 + n));
    }
    g.translate(0, y + h / 2 - h * 0.25, 0);
    parts.push(g);
  }
  const geo = mergeGeometries(parts, false)!;
  geo.computeVertexNormals();
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const t = pos.getY(i) / opts.height;
    const v = 0.55 + 0.45 * t;
    col[i * 3] = v; col[i * 3 + 1] = v; col[i * 3 + 2] = v;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const trunk = new THREE.CylinderGeometry(opts.width * 0.12, opts.width * 0.2, base + 0.6, 6);
  trunk.translate(0, base / 2 - 0.3, 0);
  return { geo, trunk };
}

/** Rounded rock. */
export function makeRock(seed: number) {
  const rng = mulberry32(seed * 31 + 9);
  const g = new THREE.IcosahedronGeometry(1, 1);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const sx = range(rng, 0.7, 1.4), sy = range(rng, 0.45, 0.9), sz = range(rng, 0.7, 1.4), o = rng() * 50;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const n = 1 + fbm(x * 1.5 + o, z * 1.5 + y, 2) * 0.35;
    pos.setXYZ(i, x * sx * n, y * sy * n, z * sz * n);
  }
  g.computeVertexNormals();
  return g;
}

/**
 * Foliage as a cloud of randomly oriented leaf cards around the branch tips.
 * Normals point outward from the canopy centre so lighting reads as one soft volume.
 */
export function makeCardCanopy(seed: number, anchors: THREE.Vector3[], opts: { radius: number; cards: number; size: [number, number]; flatten?: number }) {
  const rng = mulberry32(seed * 11 + 3);
  const center = anchors.reduce((a, b) => a.add(b), new THREE.Vector3()).multiplyScalar(1 / anchors.length);
  const pos: number[] = [], nrm: number[] = [], uv: number[] = [], col: number[] = [], idx: number[] = [];
  const q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3();
  let minY = Infinity, maxY = -Infinity;
  const centers: THREE.Vector3[] = [];
  for (let i = 0; i < opts.cards; i++) {
    const a = anchors[Math.floor(rng() * anchors.length)];
    const dir = new THREE.Vector3(rng() - 0.5, (rng() - 0.5) * (opts.flatten ?? 0.75), rng() - 0.5).normalize();
    const c = a.clone().add(dir.multiplyScalar(Math.pow(rng(), 0.6) * opts.radius));
    centers.push(c);
    minY = Math.min(minY, c.y); maxY = Math.max(maxY, c.y);
  }
  centers.forEach((c, i) => {
    const size = range(rng, opts.size[0], opts.size[1]);
    e.set(range(rng, -0.6, 0.6), rng() * Math.PI * 2, range(rng, -0.6, 0.6));
    q.setFromEuler(e);
    const n = v.copy(c).sub(center).normalize();
    const t = (c.y - minY) / (maxY - minY + 1e-3);
    const shade = 0.72 + 0.28 * Math.pow(t, 0.7);
    const corners = [[-0.5, -0.5], [0.5, -0.5], [0.5, 0.5], [-0.5, 0.5]];
    for (const [cx, cy] of corners) {
      const p = new THREE.Vector3(cx * size, cy * size, 0).applyQuaternion(q).add(c);
      pos.push(p.x, p.y, p.z);
      nrm.push(n.x, n.y, n.z);
      uv.push(cx + 0.5, cy + 0.5);
      col.push(shade, shade, shade);
    }
    const o = i * 4;
    idx.push(o, o + 1, o + 2, o, o + 2, o + 3);
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  geo.setIndex(idx);
  return geo;
}

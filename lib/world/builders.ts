// Small helpers to compose stylised Japanese architecture from primitives.
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { mats } from "@/lib/game/materials";

/** World positions of every lantern; a small pool of point lights is assigned to the nearest ones at night. */
export const lanternPositions: THREE.Vector3[] = [];

const TEXEL = 1.6; // metres per texture tile

/** Scales BoxGeometry UVs so textures tile in world metres instead of stretching over the whole face. */
export function scaleBoxUVs(geo: THREE.BoxGeometry, w: number, h: number, d: number) {
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  const dims: [number, number][] = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let i = 0; i < 4; i++) {
    const k = f * 4 + i;
    uv.setXY(k, uv.getX(k) * dims[f][0] / TEXEL, uv.getY(k) * dims[f][1] / TEXEL);
  }
  return geo;
}

export function box(w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0, ry = 0, shadow = true) {
  const m = new THREE.Mesh(scaleBoxUVs(new THREE.BoxGeometry(w, h, d), w, h, d), mat);
  m.position.set(x, y, z); m.rotation.y = ry;
  m.castShadow = shadow; m.receiveShadow = true;
  return m;
}
export function cyl(rTop: number, rBot: number, h: number, mat: THREE.Material, x = 0, y = 0, z = 0, seg = 10, shadow = true) {
  const geo = new THREE.CylinderGeometry(rTop, rBot, h, seg);
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  const circ = Math.PI * (rTop + rBot);
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * Math.max(0.5, circ / TEXEL), uv.getY(i) * Math.max(0.3, h / TEXEL));
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z); m.castShadow = shadow; m.receiveShadow = true;
  return m;
}
export function sphere(r: number, mat: THREE.Material, x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, shadow = true) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), mat);
  m.position.set(x, y, z); m.scale.set(sx, sy, sz); m.castShadow = shadow;
  return m;
}

/** A gently curved roof plane: a PlaneGeometry bent so the eaves sweep up. */
function roofSlope(width: number, run: number, rise: number, curve: number) {
  const g = new THREE.PlaneGeometry(width, Math.hypot(run, rise), 1, 6);
  const pos = g.attributes.position as THREE.BufferAttribute;
  const len = Math.hypot(run, rise);
  for (let i = 0; i < pos.count; i++) {
    const t = pos.getY(i) / len + 0.5; // 0 at eave, 1 at ridge
    const y = t * rise + (1 - t) * (1 - t) * curve; // eave lifts
    const z = (1 - t) * run;
    // slight upward sweep at the corners
    const cx = Math.abs(pos.getX(i)) / (width / 2);
    pos.setXYZ(i, pos.getX(i), y + Math.pow(cx, 4) * (1 - t) * curve * 2.2, z);
  }
  g.computeVertexNormals();
  const nrm = g.attributes.normal as THREE.BufferAttribute;
  if (nrm.getY(0) < 0) for (let i = 0; i < nrm.count; i++) nrm.setXYZ(i, -nrm.getX(i), -nrm.getY(i), -nrm.getZ(i));
  return g;
}

export interface RoofOpts { width: number; depth: number; rise: number; overhang?: number; curve?: number; x?: number; y?: number; z?: number; mat?: THREE.Material; ridge?: boolean; gableMat?: THREE.Material }

/** Gabled roof with big eaves. The ridge runs along X. */
export function roof(o: RoofOpts) {
  const m = mats();
  const g = new THREE.Group();
  const over = o.overhang ?? 1.2, curve = o.curve ?? 0.28, mat = o.mat ?? m.roof;
  const w = o.width + over * 2, run = o.depth / 2 + over;
  const front = new THREE.Mesh(roofSlope(w, run, o.rise, curve), mat);
  front.position.set(0, 0, 0); front.castShadow = true; front.receiveShadow = true;
  const back = front.clone(); back.rotation.y = Math.PI;
  // ridge sits at z=0: slopes go outward; translate so eaves are at ±run
  front.position.z = 0; back.position.z = 0;
  g.add(front, back);
  // underside (dark) to avoid see-through eaves
  const under = new THREE.Mesh(new THREE.PlaneGeometry(w, run * 2), m.darkWood);
  under.rotation.x = Math.PI / 2; under.position.y = 0.02; under.material = m.darkWood; under.receiveShadow = false;
  g.add(under);
  if (o.ridge !== false) g.add(box(w * 0.98, 0.22, 0.5, m.roofDark, 0, o.rise + 0.05, 0));
  // gable ends
  const gm = o.gableMat ?? m.plaster;
  for (const s of [-1, 1]) {
    const shape = new THREE.Shape();
    shape.moveTo(-o.depth / 2, 0); shape.lineTo(o.depth / 2, 0); shape.lineTo(0, o.rise); shape.closePath();
    const gable = new THREE.Mesh(new THREE.ShapeGeometry(shape), gm);
    gable.rotation.y = s * Math.PI / 2; gable.position.set(s * (o.width / 2 - 0.02), -0.02, 0);
    (gable.material as THREE.Material).side = THREE.DoubleSide;
    g.add(gable);
  }
  g.position.set(o.x ?? 0, o.y ?? 0, o.z ?? 0);
  return g;
}

export interface HouseOpts { w: number; d: number; h?: number; x: number; z: number; y: number; ry?: number; seed?: number; weathered?: boolean; shop?: boolean; lantern?: boolean; veranda?: boolean; roofMat?: THREE.Material }

/** A traditional wooden house: stone base, plaster + timber walls, shoji panels, sweeping tiled roof. */
export function house(o: HouseOpts) {
  const m = mats();
  const g = new THREE.Group();
  const h = o.h ?? 3;
  const wallMat = o.weathered ? m.weatheredWood : m.plaster;
  g.add(box(o.w + 0.5, 0.5, o.d + 0.5, m.stone, 0, 0.25, 0));
  g.add(box(o.w, h, o.d, wallMat, 0, 0.5 + h / 2, 0));
  // timber frame
  const post = (x: number, z: number) => g.add(box(0.22, h, 0.22, m.darkWood, x, 0.5 + h / 2, z));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) post(sx * (o.w / 2 - 0.05), sz * (o.d / 2 - 0.05));
  for (let i = 1; i < Math.ceil(o.w / 2.2); i++) { const x = -o.w / 2 + i * (o.w / Math.ceil(o.w / 2.2)); post(x, o.d / 2 - 0.05); post(x, -o.d / 2 + 0.05); }
  g.add(box(o.w + 0.1, 0.18, o.d + 0.1, m.darkWood, 0, 0.5 + h - 0.09, 0));
  g.add(box(o.w + 0.1, 0.14, o.d + 0.1, m.darkWood, 0, 0.62, 0));
  g.add(box(o.w + 0.08, 0.9, o.d + 0.08, m.weatheredWood, 0, 1.05, 0)); // wooden lower panels
  g.add(box(o.w + 0.1, 0.1, o.d + 0.1, m.darkWood, 0, 1.52, 0));
  // shoji panels on the front (z+) and back
  const panelW = Math.min(1.6, o.w / 3);
  for (const sz of [1, -1]) for (let i = 0; i < 2; i++) {
    const x = (i - 0.5) * (panelW + 0.3);
    g.add(box(panelW, h * 0.62, 0.06, m.shoji, x, 0.5 + h * 0.45, sz * (o.d / 2 + 0.02)));
  }
  // small side window
  g.add(box(0.06, 0.9, 1.1, m.shoji, o.w / 2 + 0.02, 0.5 + h * 0.6, 0));
  if (o.veranda !== false) {
    g.add(box(o.w + 0.6, 0.12, 1.2, m.plank, 0, 0.5, o.d / 2 + 0.7));
    for (const x of [-o.w / 2 - 0.1, o.w / 2 + 0.1]) g.add(cyl(0.1, 0.1, h + 0.4, m.darkWood, x, 0.5 + (h + 0.4) / 2, o.d / 2 + 1.15, 6));
  }
  const rf = roof({ width: o.w, depth: o.d, rise: 1.5 + o.d * 0.14, overhang: 1.25, curve: 0.3, y: 0.5 + h, mat: o.roofMat ?? (o.seed && o.seed % 3 === 0 ? m.roofDark : m.roof) });
  g.add(rf);
  if (o.lantern) {
    g.add(cyl(0.03, 0.03, 0.5, m.darkWood, o.w / 2 - 0.6, 0.5 + h - 0.3, o.d / 2 + 1.1, 4, false));
    g.add(sphere(0.2, m.paper, o.w / 2 - 0.6, 0.5 + h - 0.65, o.d / 2 + 1.1, 1, 1.35, 1, false));
  }
  if (o.shop) {
    // noren curtain + wooden sign
    g.add(box(panelW * 2 + 0.3, 0.7, 0.03, m.clothBlue, 0, 0.5 + h * 0.86, o.d / 2 + 0.55, 0, false));
    g.add(box(1.2, 0.5, 0.06, m.weatheredWood, -o.w / 2 + 0.9, 0.5 + h - 0.6, o.d / 2 + 0.08));
  }
  g.position.set(o.x, o.y, o.z);
  g.rotation.y = o.ry ?? 0;
  return g;
}

/** Stone lantern (tōrō). */
export function stoneLantern(x: number, y: number, z: number, scale = 1) {
  const m = mats();
  const g = new THREE.Group();
  g.add(box(0.7, 0.25, 0.7, m.stone, 0, 0.12, 0));
  g.add(cyl(0.12, 0.16, 1.2, m.stone, 0, 0.85, 0, 8));
  g.add(box(0.55, 0.12, 0.55, m.stone, 0, 1.5, 0));
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(box(0.08, 0.45, 0.08, m.stone, sx * 0.19, 1.8, sz * 0.19, 0, false));
  g.add(box(0.3, 0.4, 0.3, m.stoneLantern, 0, 1.8, 0, 0, false));
  lanternPositions.push(new THREE.Vector3(x, y + 1.8 * scale, z));
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.35, 4), m.darkStone);
  cap.position.y = 2.2; cap.rotation.y = Math.PI / 4; cap.castShadow = true;
  g.add(cap);
  g.add(sphere(0.08, m.stone, 0, 2.42, 0));
  g.position.set(x, y, z); g.scale.setScalar(scale);
  return g;
}

/** Vermilion torii gate. */
export function torii(x: number, y: number, z: number, ry = 0, scale = 1) {
  const m = mats();
  const g = new THREE.Group();
  const W = 3.2, H = 4.2;
  for (const s of [-1, 1]) {
    const p = cyl(0.16, 0.2, H, m.vermilion, s * W / 2, H / 2, 0, 10);
    p.rotation.z = -s * 0.03;
    g.add(p);
    g.add(cyl(0.24, 0.26, 0.3, m.black, s * W / 2, 0.15, 0, 10));
  }
  // kasagi (top beam) with black cap, slight curve via two tilted halves
  const top = box(W + 1.6, 0.26, 0.42, m.black, 0, H + 0.1, 0);
  g.add(top);
  const shimaki = box(W + 1.2, 0.22, 0.34, m.vermilion, 0, H - 0.14, 0);
  g.add(shimaki);
  for (const s of [-1, 1]) { const tip = box(0.9, 0.26, 0.42, m.black, s * (W / 2 + 0.75), H + 0.22, 0); tip.rotation.z = s * 0.28; g.add(tip); }
  g.add(box(W + 0.6, 0.2, 0.26, m.vermilion, 0, H - 0.95, 0)); // nuki
  g.add(box(0.28, 0.6, 0.2, m.vermilion, 0, H - 0.52, 0)); // gakuzuka
  g.position.set(x, y, z); g.rotation.y = ry; g.scale.setScalar(scale);
  return g;
}

/** Paper lantern (chōchin) hanging at a point. */
export function paperLantern(x: number, y: number, z: number, red = false, scale = 1) {
  const m = mats();
  const g = new THREE.Group();
  g.add(cyl(0.01, 0.01, 0.4, m.black, 0, 0.2, 0, 3, false));
  const body = sphere(0.22, red ? m.lanternRed : m.paper, 0, -0.16, 0, 1, 1.35, 1, false);
  g.add(body);
  lanternPositions.push(new THREE.Vector3(x, y - 0.16 * scale, z));
  g.add(cyl(0.14, 0.14, 0.05, m.black, 0, 0.12, 0, 8, false));
  g.add(cyl(0.14, 0.14, 0.05, m.black, 0, -0.44, 0, 8, false));
  g.position.set(x, y, z); g.scale.setScalar(scale);
  return g;
}

/** Simple wooden fence along a polyline. */
export function fence(points: [number, number, number][], height = 1.1) {
  const m = mats();
  const g = new THREE.Group();
  for (let i = 0; i < points.length; i++) {
    const [x, y, z] = points[i];
    g.add(box(0.12, height, 0.12, m.weatheredWood, x, y + height / 2, z));
    if (i < points.length - 1) {
      const [x2, y2, z2] = points[i + 1];
      const len = Math.hypot(x2 - x, z2 - z), ang = Math.atan2(x2 - x, z2 - z);
      for (const yy of [0.45, 0.85]) {
        const rail = box(0.06, 0.08, len, m.weatheredWood, (x + x2) / 2, (y + y2) / 2 + yy * height, (z + z2) / 2, ang, false);
        rail.rotation.x = -Math.atan2(y2 - y, len);
        g.add(rail);
      }
    }
  }
  return g;
}

/** Arched plank bridge between two points. */
export function bridge(x1: number, y1: number, z1: number, x2: number, y2: number, z2: number, width = 2.2, arch = 0.9) {
  const m = mats();
  const g = new THREE.Group();
  const len = Math.hypot(x2 - x1, z2 - z1), ang = Math.atan2(x2 - x1, z2 - z1);
  const n = Math.ceil(len / 0.32);
  const plank = new THREE.BoxGeometry(width, 0.08, 0.28);
  const planks = new THREE.InstancedMesh(plank, m.plank, n);
  const tm = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const yAt = (t: number) => y1 + (y2 - y1) * t + Math.sin(t * Math.PI) * arch;
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    p.set(x1 + (x2 - x1) * t, yAt(t), z1 + (z2 - z1) * t);
    const slope = Math.atan2(yAt(t + 0.01) - yAt(t - 0.01), 0.02 * len);
    e.set(-slope, ang, 0); q.setFromEuler(e);
    tm.compose(p, q, new THREE.Vector3(1, 1, 1));
    planks.setMatrixAt(i, tm);
  }
  planks.castShadow = true; planks.receiveShadow = true;
  g.add(planks);
  // railings
  const posts = Math.max(3, Math.round(len / 1.6));
  for (let i = 0; i <= posts; i++) {
    const t = i / posts;
    for (const s of [-1, 1]) {
      const px = x1 + (x2 - x1) * t + Math.cos(ang) * s * (width / 2), pz = z1 + (z2 - z1) * t - Math.sin(ang) * s * (width / 2);
      g.add(box(0.1, 0.9, 0.1, m.vermilion, px, yAt(t) + 0.45, pz, ang));
      if (i < posts) {
        const t2 = (i + 1) / posts;
        const px2 = x1 + (x2 - x1) * t2 + Math.cos(ang) * s * (width / 2), pz2 = z1 + (z2 - z1) * t2 - Math.sin(ang) * s * (width / 2);
        const rail = box(0.08, 0.08, Math.hypot(px2 - px, pz2 - pz, yAt(t2) - yAt(t)), m.vermilion, (px + px2) / 2, (yAt(t) + yAt(t2)) / 2 + 0.9, (pz + pz2) / 2, ang, false);
        rail.rotation.x = -Math.atan2(yAt(t2) - yAt(t), Math.hypot(px2 - px, pz2 - pz));
        g.add(rail);
      }
    }
  }
  // supports
  for (const t of [0.15, 0.5, 0.85]) for (const s of [-1, 1]) {
    const px = x1 + (x2 - x1) * t + Math.cos(ang) * s * (width / 2 - 0.2), pz = z1 + (z2 - z1) * t - Math.sin(ang) * s * (width / 2 - 0.2);
    g.add(cyl(0.12, 0.14, 3, m.darkWood, px, yAt(t) - 1.4, pz, 6));
  }
  return g;
}

export function bench(x: number, y: number, z: number, ry = 0) {
  const m = mats();
  const g = new THREE.Group();
  g.add(box(1.8, 0.08, 0.45, m.weatheredWood, 0, 0.45, 0));
  for (const s of [-1, 1]) { g.add(box(0.1, 0.45, 0.4, m.darkWood, s * 0.75, 0.22, 0)); }
  g.position.set(x, y, z); g.rotation.y = ry;
  return g;
}

export function bicycle(x: number, y: number, z: number, ry = 0, lean = 0.25) {
  const m = mats();
  const g = new THREE.Group();
  const wheel = new THREE.TorusGeometry(0.33, 0.025, 6, 20);
  for (const dx of [-0.55, 0.55]) { const w = new THREE.Mesh(wheel, m.black); w.position.set(dx, 0.33, 0); w.castShadow = true; g.add(w); }
  g.add(box(1.0, 0.04, 0.04, m.rust, 0, 0.55, 0));
  const a = box(0.04, 0.7, 0.04, m.rust, -0.25, 0.75, 0); a.rotation.z = 0.35; g.add(a);
  const b = box(0.04, 0.6, 0.04, m.rust, 0.4, 0.75, 0); b.rotation.z = -0.25; g.add(b);
  g.add(box(0.04, 0.04, 0.5, m.rust, 0.55, 1.02, 0));
  g.add(box(0.28, 0.06, 0.16, m.furDark, -0.2, 1.0, 0));
  g.add(box(0.36, 0.22, 0.28, m.weatheredWood, -0.7, 0.85, 0)); // basket-ish rear box
  g.position.set(x, y, z); g.rotation.set(0, ry, lean);
  return g;
}

export function boat(x: number, y: number, z: number, ry = 0) {
  const m = mats();
  const g = new THREE.Group();
  const hull = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), m.boat);
  hull.scale.set(0.9, 0.55, 2.6); hull.position.y = 0.45; hull.castShadow = true;
  (hull.material as THREE.Material).side = THREE.DoubleSide;
  g.add(hull);
  g.add(box(1.6, 0.06, 0.3, m.plank, 0, 0.35, 0.4));
  g.add(box(1.4, 0.06, 0.3, m.plank, 0, 0.35, -0.9));
  const oar = box(0.05, 0.05, 2.6, m.wood, 0.5, 0.5, 0); oar.rotation.y = 0.3; g.add(oar);
  g.position.set(x, y, z); g.rotation.y = ry;
  return g;
}

/**
 * Collapses every static Mesh in a group into one merged mesh per material,
 * so a whole village costs a dozen draw calls instead of a thousand.
 * Subtrees flagged `userData.dynamic` (boats, animals) are kept as-is.
 */
export function mergeStatic(group: THREE.Group) {
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const buckets = new Map<string, { mat: THREE.Material; shadow: boolean; geos: THREE.BufferGeometry[] }>();
  const dynamic: THREE.Object3D[] = [];
  const visit = (o: THREE.Object3D) => {
    if (o.userData.dynamic) { dynamic.push(o); return; }
    if ((o as THREE.Mesh).isMesh && !(o as THREE.InstancedMesh).isInstancedMesh) {
      const mesh = o as THREE.Mesh;
      const mat = mesh.material as THREE.Material;
      let g = mesh.geometry.clone();
      if (g.index) g = g.toNonIndexed();
      for (const name of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(name)) g.deleteAttribute(name);
      if (!g.attributes.normal) g.computeVertexNormals();
      if (!g.attributes.uv) g.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
      g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, mesh.matrixWorld));
      const key = `${mat.uuid}|${mesh.castShadow ? 1 : 0}`;
      const b = buckets.get(key) ?? { mat, shadow: mesh.castShadow, geos: [] };
      b.geos.push(g);
      buckets.set(key, b);
    } else if ((o as THREE.InstancedMesh).isInstancedMesh) { dynamic.push(o); return; }
    for (const c of o.children) visit(c);
  };
  for (const c of group.children) visit(c);
  const out = new THREE.Group();
  out.position.copy(group.position); out.rotation.copy(group.rotation); out.scale.copy(group.scale);
  for (const b of buckets.values()) {
    const merged = mergeGeometries(b.geos, false);
    if (!merged) continue;
    const m = new THREE.Mesh(merged, b.mat);
    m.castShadow = b.shadow; m.receiveShadow = true;
    out.add(m);
  }
  for (const d of dynamic) {
    const rel = new THREE.Matrix4().multiplyMatrices(inv, d.matrixWorld);
    rel.decompose(d.position, d.quaternion, d.scale);
    out.add(d);
  }
  return out;
}

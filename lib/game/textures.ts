// Procedural textures painted on a canvas at startup. No external assets,
// nothing to download, everything deterministic.
import * as THREE from "three";
import { fbm, mulberry32 } from "@/lib/world/noise";

const cache = new Map<string, THREE.Texture>();

function make(name: string, size: number, paint: (ctx: CanvasRenderingContext2D, s: number) => void, opts: { repeat?: boolean; srgb?: boolean } = {}) {
  const hit = cache.get(name);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  paint(ctx, size);
  const t = new THREE.CanvasTexture(c);
  if (opts.repeat !== false) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (opts.srgb !== false) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  cache.set(name, t);
  return t;
}

const px = (ctx: CanvasRenderingContext2D, s: number, f: (x: number, y: number) => [number, number, number, number?]) => {
  const img = ctx.createImageData(s, s);
  for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) {
    const [r, g, b, a = 255] = f(x / s, y / s);
    const i = (y * s + x) * 4;
    img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = a;
  }
  ctx.putImageData(img, 0, 0);
};

export const tex = {
  wood: () => make("wood", 256, (ctx, s) => px(ctx, s, (u, v) => {
    const grain = fbm(u * 3 + 0.5, v * 40, 3) * 0.5 + 0.5;
    const rings = Math.sin((u * 6 + fbm(u * 2, v * 6, 2) * 1.2) * Math.PI * 2) * 0.5 + 0.5;
    const l = 0.78 + grain * 0.22 - rings * 0.14;
    return [l * 255, l * 238, l * 215];
  })),
  plank: () => make("plank", 256, (ctx, s) => px(ctx, s, (u, v) => {
    const row = Math.floor(v * 6);
    const seam = Math.abs(v * 6 - Math.round(v * 6)) < 0.03 ? 0.55 : 1;
    const grain = fbm(u * 6 + row * 7, v * 60, 3) * 0.5 + 0.5;
    const l = (0.74 + grain * 0.24 + (row % 2) * 0.04) * (0.7 + 0.3 * seam);
    return [l * 255, l * 240, l * 220];
  })),
  roof: () => make("roof", 256, (ctx, s) => px(ctx, s, (u, v) => {
    const rows = 8;
    const row = v * rows;
    const shift = Math.floor(row) % 2 ? 0.5 : 0;
    const col = (u * 8 + shift) % 1;
    const edge = Math.abs(row - Math.floor(row) - 0.92) < 0.06 ? 0.45 : 1;
    const curve = 0.8 + 0.25 * Math.cos((col - 0.5) * Math.PI);
    const n = fbm(u * 10, v * 10, 2) * 0.1;
    const l = (0.72 + n * 1.6) * curve * (0.75 + 0.25 * edge);
    return [l * 240, l * 245, l * 255];
  })),
  shoji: () => make("shoji", 128, (ctx, s) => {
    ctx.fillStyle = "#f4ecd8"; ctx.fillRect(0, 0, s, s);
    ctx.strokeStyle = "#5a3d24"; ctx.lineWidth = 4;
    for (let i = 0; i <= 4; i++) { const p = (i / 4) * s; ctx.beginPath(); ctx.moveTo(p, 0); ctx.lineTo(p, s); ctx.moveTo(0, p); ctx.lineTo(s, p); ctx.stroke(); }
  }),
  stone: () => make("stone", 256, (ctx, s) => px(ctx, s, (u, v) => {
    const n = fbm(u * 6, v * 6, 4) * 0.5 + 0.5;
    const cracks = Math.pow(Math.abs(fbm(u * 4 + 3, v * 4, 3)), 0.4);
    const l = 0.78 + n * 0.22 - (1 - cracks) * 0.2;
    return [l * 255, l * 252, l * 248];
  })),
  cobble: () => make("cobble", 256, (ctx, s) => px(ctx, s, (u, v) => {
    // irregular flagstones: jittered cells with soft joints
    const row = Math.floor(v * 5);
    const gx = u * 5 + (row % 2) * 0.5 + fbm(u * 3, v * 3, 2) * 0.35, gz = v * 5 + fbm(u * 3 + 7, v * 3, 2) * 0.35;
    const fx = Math.abs(gx - Math.floor(gx) - 0.5), fz = Math.abs(gz - Math.floor(gz) - 0.5);
    const edge = Math.max(fx, fz);
    const joint = edge > 0.44 ? 0.62 : 1 - (edge - 0.36) * 0.6 * (edge > 0.36 ? 1 : 0);
    const cell = fbm(Math.floor(gx) * 3.1, Math.floor(gz) * 2.7, 1) * 0.12;
    const n = fbm(u * 14, v * 14, 3) * 0.12;
    const l = (0.82 + n + cell) * joint;
    return [l * 255, l * 250, l * 240];
  })),
  plaster: () => make("plaster", 256, (ctx, s) => px(ctx, s, (u, v) => {
    const n = fbm(u * 8, v * 8, 4) * 0.5 + 0.5;
    const stain = Math.pow(Math.max(0, fbm(u * 3, v * 2 + 2, 3)), 2) * 0.35;
    const l = 0.82 + n * 0.12 - stain - Math.pow(v, 6) * 0.25;
    return [l * 235, l * 228, l * 210];
  })),
  moss: () => make("moss", 256, (ctx, s) => px(ctx, s, (u, v) => {
    const n = fbm(u * 10, v * 10, 4) * 0.5 + 0.5;
    return [(0.7 + n * 0.3) * 255, (0.85 + n * 0.15) * 255, (0.6 + n * 0.25) * 255];
  })),
  bamboo: () => make("bamboo", 64, (ctx, s) => px(ctx, s, (u, v) => {
    const node = Math.abs(v - 0.5) < 0.035 ? 0.55 : 1;
    const n = fbm(u * 4, v * 20, 2) * 0.08;
    const l = (0.86 + n) * (0.6 + 0.4 * node);
    return [l * 240, l * 255, l * 215];
  })),
  leaf: () => make("leaf", 64, (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath(); ctx.moveTo(s / 2, 0); ctx.quadraticCurveTo(s * 0.98, s * 0.45, s / 2, s); ctx.quadraticCurveTo(s * 0.02, s * 0.45, s / 2, 0); ctx.fill();
  }, { repeat: false }),
  petal: () => make("petal", 64, (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath(); ctx.moveTo(s / 2, s * 0.9); ctx.bezierCurveTo(s * 0.08, s * 0.55, s * 0.25, s * 0.08, s / 2, s * 0.28); ctx.bezierCurveTo(s * 0.75, s * 0.08, s * 0.92, s * 0.55, s / 2, s * 0.9); ctx.fill();
    ctx.clearRect(s * 0.46, s * 0.24, s * 0.08, s * 0.1); // the little notch of a sakura petal
  }, { repeat: false }),
  blossoms: () => make("blossoms", 128, (ctx, s) => {
    // a cluster of small blossoms, dense in the middle, sparse at the edge
    ctx.clearRect(0, 0, s, s);
    const r = mulberry32(3);
    ctx.fillStyle = "#ffffff";
    for (let i = 0; i < 150; i++) {
      const a = r() * Math.PI * 2, d = Math.pow(r(), 0.7) * s * 0.42;
      const x = s / 2 + Math.cos(a) * d, y = s / 2 + Math.sin(a) * d * 0.85;
      const rad = 3 + r() * 5;
      for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.arc(x + Math.cos(k * 1.256) * rad * 0.55, y + Math.sin(k * 1.256) * rad * 0.55, rad * 0.55, 0, 7); ctx.fill(); }
    }
  }, { repeat: false }),
  leaves: () => make("leaves", 128, (ctx, s) => {
    ctx.clearRect(0, 0, s, s);
    const r = mulberry32(9);
    ctx.fillStyle = "#ffffff";
    for (let i = 0; i < 110; i++) {
      const a = r() * Math.PI * 2, d = Math.pow(r(), 0.7) * s * 0.44;
      const x = s / 2 + Math.cos(a) * d, y = s / 2 + Math.sin(a) * d;
      const len = 7 + r() * 8, ang = r() * Math.PI;
      ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
      ctx.beginPath(); ctx.moveTo(0, -len / 2); ctx.quadraticCurveTo(len * 0.38, 0, 0, len / 2); ctx.quadraticCurveTo(-len * 0.38, 0, 0, -len / 2); ctx.fill();
      ctx.restore();
    }
  }, { repeat: false }),
  soft: () => make("soft", 64, (ctx, s) => {
    const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
    g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(0.4, "rgba(255,255,255,0.5)"); g.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = g; ctx.fillRect(0, 0, s, s);
  }, { repeat: false }),
  mist: () => make("mist", 256, (ctx, s) => px(ctx, s, (u, v) => {
    const dx = u - 0.5, dy = v - 0.5;
    const r = Math.sqrt(dx * dx + dy * dy) * 2;
    const n = fbm(u * 5, v * 5, 4) * 0.5 + 0.5;
    const a = Math.max(0, 1 - r) * (0.35 + 0.65 * n);
    return [255, 255, 255, a * 255];
  }), { repeat: false }),
  canopy: () => make("canopy", 128, (ctx, s) => px(ctx, s, (u, v) => {
    // leafy dapple for tree canopies (used as alpha cutout to break silhouettes)
    const n = fbm(u * 14, v * 14, 3) * 0.5 + 0.5;
    return [n * 255, n * 255, n * 255];
  })),
  timetable: () => make("timetable", 256, (ctx, s) => {
    ctx.fillStyle = "#e9e2cf"; ctx.fillRect(0, 0, s, s);
    ctx.fillStyle = "#2a2a2a"; ctx.font = "bold 22px serif"; ctx.fillText("MIZU", 16, 34);
    ctx.font = "13px serif"; ctx.fillText("時刻表 — TIMETABLE", 16, 56);
    ctx.strokeStyle = "#7a6a55"; ctx.lineWidth = 1;
    const r = mulberry32(7);
    for (let i = 0; i < 9; i++) {
      const y = 80 + i * 18;
      ctx.beginPath(); ctx.moveTo(16, y + 6); ctx.lineTo(s - 16, y + 6); ctx.stroke();
      ctx.fillStyle = "#3a3a3a"; ctx.font = "12px monospace";
      ctx.fillText(`${String(6 + i * 2).padStart(2, "0")}:${String(Math.floor(r() * 60)).padStart(2, "0")}   →  ${["Kawamura", "Yamato", "Hoshi", "Tsuki"][i % 4]}`, 20, y);
    }
    ctx.fillStyle = "#a33"; ctx.font = "11px serif"; ctx.fillText("last service: —", 16, s - 18);
  }, { repeat: false }),
  photo: () => make("photo", 128, (ctx, s) => {
    ctx.fillStyle = "#f2ecd9"; ctx.fillRect(0, 0, s, s);
    const g = ctx.createLinearGradient(0, 0, 0, s);
    g.addColorStop(0, "#9aa8b5"); g.addColorStop(0.55, "#d8cbb2"); g.addColorStop(1, "#6b6a5a");
    ctx.fillStyle = g; ctx.fillRect(10, 10, s - 20, s - 30);
    ctx.fillStyle = "#3d4a52"; ctx.beginPath(); ctx.moveTo(10, 70); ctx.lineTo(45, 40); ctx.lineTo(70, 62); ctx.lineTo(95, 35); ctx.lineTo(118, 70); ctx.fill();
    ctx.fillStyle = "rgba(40,30,20,0.6)"; ctx.fillRect(40, 80, 12, 18); ctx.fillRect(56, 84, 8, 14);
  }, { repeat: false }),
  noise: () => make("noise", 128, (ctx, s) => px(ctx, s, (u, v) => {
    const n = fbm(u * 8, v * 8, 4) * 0.5 + 0.5;
    const l = 0.72 + n * 0.28;
    return [l * 255, l * 255, l * 255];
  }), { srgb: false }),
};

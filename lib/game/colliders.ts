// Tiny circle-collider registry so the player can't walk through buildings.
export interface Collider { x: number; z: number; r: number }
const colliders: Collider[] = [];
export function addCollider(x: number, z: number, r: number) {
  const c = { x, z, r };
  colliders.push(c);
  return () => { const i = colliders.indexOf(c); if (i >= 0) colliders.splice(i, 1); };
}
/** Pushes (x,z) out of any collider it overlaps. Returns true if blocked. */
export function resolveColliders(p: { x: number; z: number }, radius = 0.4) {
  let hit = false;
  for (const c of colliders) {
    const dx = p.x - c.x, dz = p.z - c.z;
    const d = Math.hypot(dx, dz), min = c.r + radius;
    if (d < min && d > 1e-4) { p.x = c.x + (dx / d) * min; p.z = c.z + (dz / d) * min; hit = true; }
  }
  return hit;
}

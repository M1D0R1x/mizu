// Top-level world seed. Change this (or derive from a URL param) to get a different valley.
// Every generator that needs randomness imports `worldSeed` and offsets it by a local constant
// so systems don't interfere with each other.
export const WORLD_SEED = 1337;

// Derive a sub-seed for a named system, so each system gets its own independent RNG stream.
export function subSeed(name: string): number {
  let h = WORLD_SEED;
  for (let i = 0; i < name.length; i++) {
    h = Math.imul(h ^ name.charCodeAt(i), 0x9e3779b9) >>> 0;
    h ^= h >>> 16;
  }
  return h >>> 0;
}

// Top-level world seed system.
// Changing WORLD_SEED produces an entirely different valley:
// - Procedural terrain elevation & mountain profiles
// - Lake shoreline & lake basin shape
// - Path network meandering & connections
// - Village layout (building lots, shops, lanterns, roofs)
// - Tree & rock scatter distributions across all biomes
// - Ancient outpost & ruins generation
//
// You can also pass a seed via URL query parameter: ?seed=42 or ?seed=fuji

function resolveInitialSeed(): number {
  if (typeof window !== "undefined") {
    try {
      const params = new URLSearchParams(window.location.search);
      const querySeed = params.get("seed");
      if (querySeed) {
        const num = parseInt(querySeed, 10);
        if (!isNaN(num) && String(num) === querySeed.trim()) return num >>> 0;
        // Hash string seeds like "fuji", "zen", "kyoto"
        let h = 2166136261 >>> 0;
        for (let i = 0; i < querySeed.length; i++) {
          h = Math.imul(h ^ querySeed.charCodeAt(i), 16777619) >>> 0;
        }
        return h >>> 0;
      }
    } catch {
      // Fallback if URLSearchParams fails
    }
  }
  return 1337;
}

export let WORLD_SEED: number = resolveInitialSeed();

export function setWorldSeed(newSeed: number) {
  WORLD_SEED = newSeed >>> 0;
}

// Derive an independent, deterministic sub-seed for each distinct system
// so changing one system's code does not perturb the others.
export function subSeed(name: string): number {
  let h = WORLD_SEED;
  for (let i = 0; i < name.length; i++) {
    h = Math.imul(h ^ name.charCodeAt(i), 0x9e3779b9) >>> 0;
    h ^= h >>> 16;
  }
  return h >>> 0;
}

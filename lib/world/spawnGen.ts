import * as THREE from "three";
import { terrainHeight, VILLAGE, LAKE, SAKURA, LOOKOUT, STATION, TERRACES, MAPLE_GROVE } from "./terrain";
import { mulberry32 } from "./noise";
import { subSeed, WORLD_SEED } from "./seed";

export interface SpawnSpot {
  name: string;
  pos: THREE.Vector3;
  yaw: number;
}

/**
 * Returns a procedural starting spawn location determined by the world seed.
 * Different seeds will wake the player up in completely different corners of the valley:
 * Lakeside dock, village entrance, cherry blossom grove, high lookout ridge,
 * mountain terrace, quiet station trail, ancient ruins, or maple valley.
 */
export function getProceduralSpawn(): SpawnSpot {
  const rng = mulberry32(subSeed("spawn"));

  const candidateRegions = [
    { name: "Lakeside Pier", x: -52, z: 120, yaw: 0.45 },
    { name: "Kawamura Village Gate", x: VILLAGE.x + 48, z: VILLAGE.z + 4, yaw: Math.PI * 0.95 },
    { name: "Sakura Valley", x: SAKURA.x - 12, z: SAKURA.z + 28, yaw: 0.15 },
    { name: "Lookout Ridge", x: LOOKOUT.x + 22, z: LOOKOUT.z - 4, yaw: 1.35 },
    { name: "Station Trail Crossing", x: STATION.x + 8, z: STATION.z + 24, yaw: -0.25 },
    { name: "Rice Terrace Overlook", x: 95, z: 35, yaw: -1.2 },
    { name: "The Maple Grove", x: MAPLE_GROVE.x + 10, z: MAPLE_GROVE.z + 20, yaw: 0.6 },
    { name: "Mountain Pass", x: -75, z: -190, yaw: 0.05 },
  ];

  // Pick one of the scenic regions based on the seed
  const spotIdx = Math.floor(rng() * candidateRegions.length);
  const spot = candidateRegions[spotIdx];

  // Add organic jitter (+/- 6m) so it doesn't stand on an exact fixed pixel
  const jx = (rng() - 0.5) * 10;
  const jz = (rng() - 0.5) * 10;
  const sx = spot.x + jx;
  const sz = spot.z + jz;
  const sy = terrainHeight(sx, sz);

  return {
    name: spot.name,
    pos: new THREE.Vector3(sx, sy, sz),
    yaw: spot.yaw + (rng() - 0.5) * 0.25,
  };
}

let _cachedSpawn: SpawnSpot | null = null;
export function getSpawnSpot(): SpawnSpot {
  if (!_cachedSpawn) {
    _cachedSpawn = getProceduralSpawn();
  }
  return _cachedSpawn;
}

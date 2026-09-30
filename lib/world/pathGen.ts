// lib/world/pathGen.ts
// Generates the path network connecting all area centres.
// Output shape is identical to terrain.PATHS so pathDist() can consume it directly.

import { LAKE, VILLAGE, LOOKOUT, SAKURA, BAMBOO, STAIRS, STATION, SHRINE } from './terrain';

export type PathPolyline = [number, number][];

/**
 * Builds curved paths between key areas by inserting terrain-hugging midpoints.
 * Each path is a list of [x, z] waypoints; the pathDist() function in terrain.ts
 * measures segment distance, so more waypoints = smoother curve.
 */
export function buildPaths(): PathPolyline[] {
  // Helper: linear interpolation of midpoint with a lateral offset for natural feel
  const mid = (ax: number, az: number, bx: number, bz: number, ox = 0, oz = 0): [number, number] =>
    [(ax + bx) / 2 + ox, (az + bz) / 2 + oz];

  return [
    // village → lake dock
    [[VILLAGE.x + 18, VILLAGE.z + 4], mid(VILLAGE.x + 18, VILLAGE.z + 4, -62, 62, -8, 0), [-62, 62]],

    // village → lookout hill
    [[VILLAGE.x - 10, VILLAGE.z], [LOOKOUT.x + 20, LOOKOUT.z - 4], [LOOKOUT.x, LOOKOUT.z]],

    // lake → sakura valley → bamboo → shrine stairs
    [[-2, -48], [-14, -80], [-6, -110], [2, -140], [BAMBOO.x, BAMBOO.z], [STAIRS.x, STAIRS.zStart]],

    // lake → station
    [[-6, 108], [-18, 128], [STATION.x, STATION.z]],

    // lake → terraces
    [[70, 42], [95, 34], [110, 30]],

    // station → northern stream path
    [[STATION.x + 4, STATION.z + 8], [-4, 178], [10, 205], [16, 230], [10, 262]],

    // sakura → maple grove
    [[-60, -70], [-90, -110], [-110, -140]],

    // shrine platform → torii entrance (short connector)
    [[SHRINE.x - 6, SHRINE.z + 8], [SHRINE.x, SHRINE.z + 4]],
  ];
}

let _paths: PathPolyline[] | null = null;
export function getPaths(): PathPolyline[] {
  if (!_paths) _paths = buildPaths();
  return _paths;
}

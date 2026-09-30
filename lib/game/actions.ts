import { world } from "./world";
import { terrainHeight } from "@/lib/world/terrain";
import { useGame } from "@/store/gameStore";

/** Sit on a bench: park the player, face the view, let the world breathe. */
export function sit(x: number, z: number, ry: number) {
  if (world.player.sitting) { stand(); return; }
  world.player.sitting = true;
  world.player.pos.set(x, terrainHeight(x, z), z);
  world.player.yaw = ry;
  world.player.pitch = -0.03;
}
export function stand() { world.player.sitting = false; }

/** Show a two-second whisper of text, like a discovery label. */
export function whisper(text: string, ms = 2600) {
  const s = useGame.getState();
  s.setDiscoveryLabel(text);
  setTimeout(() => { if (useGame.getState().discoveryLabel === text) useGame.getState().setDiscoveryLabel(null); }, ms);
}

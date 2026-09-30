"use client";
import { useFrame, useThree } from "@react-three/fiber";
import { useGame } from "@/store/gameStore";
import { world } from "@/lib/game/world";
import { audio } from "@/lib/game/audio";
import { AREAS } from "@/lib/world/terrain";

function formatTime(t: number) {
  const h = Math.floor(t), m = Math.floor((t - h) * 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Grabs the composited frame right after the post-processing pass has drawn it. */
export function CaptureSystem() {
  const { gl } = useThree();
  useFrame(() => {
    const s = useGame.getState();
    if (!s.captureRequested) return;
    s.requestCapture(false);
    try {
      const src = gl.domElement;
      const scale = Math.min(1, 1280 / src.width);
      const c = document.createElement("canvas");
      c.width = Math.round(src.width * scale); c.height = Math.round(src.height * scale);
      c.getContext("2d")!.drawImage(src, 0, 0, c.width, c.height);
      const data = c.toDataURL("image/jpeg", 0.82);
      const area = AREAS.find((a) => a.id === world.player.area)?.name ?? "THE VALLEY";
      s.addPhoto({ id: `${Date.now()}`, data, time: formatTime(world.time), area, taken: Date.now() });
      audio.shutter();
      s.setFlash(Date.now());
    } catch (e) {
      console.warn("capture failed", e);
    }
  }, 100);
  return null;
}

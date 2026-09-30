"use client";
import { useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { audio } from "@/lib/game/audio";
import { useGame } from "@/store/gameStore";
import { world } from "@/lib/game/world";
import { SHRINE } from "@/lib/world/terrain";

export function AudioSystem() {
  const settings = useGame((s) => s.settings);
  const mode = useGame((s) => s.mode);

  useEffect(() => {
    const start = () => { audio.init(); audio.resume(); };
    window.addEventListener("pointerdown", start, { once: true });
    window.addEventListener("keydown", start, { once: true });
    return () => { window.removeEventListener("pointerdown", start); window.removeEventListener("keydown", start); };
  }, []);

  useEffect(() => { audio.setVolumes({ master: settings.master, music: settings.music, ambience: settings.ambience, sfx: settings.sfx }); }, [settings]);
  useEffect(() => { audio.setVolumes({ master: settings.master * (mode === "paused" || mode === "settings" || mode === "gallery" ? 0.35 : 1) }); }, [mode, settings.master]);

  useFrame((_, dt) => {
    audio.update(Math.min(dt, 0.1));
    // a distant temple bell, now and then, when you are far from the shrine
    if (!world.frozen && world.distantBellTimer <= 0) {
      world.distantBellTimer = 90 + Math.random() * 160;
      const d = Math.hypot(world.player.pos.x - SHRINE.x, world.player.pos.z - SHRINE.z);
      if (d > 60 && Math.random() < 0.7) {
        audio.bell(d);
        if (Math.random() < 0.5) setTimeout(() => audio.bell(d), 3200 + Math.random() * 1500);
      }
    }
  });
  return null;
}

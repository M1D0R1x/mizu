"use client";
import { useGame } from "@/store/gameStore";
import { audio } from "@/lib/game/audio";

export function PauseMenu() {
  const setMode = useGame((s) => s.setMode);
  const go = (m: "playing" | "gallery" | "settings" | "menu" | "photo") => { audio.ui(); setMode(m); };
  return (
    <div className="screen paused">
      <div className="title" style={{ fontSize: 46 }}>MIZU</div>
      <div className="hairline" />
      <nav className="menu">
        <button className="menu-item" onClick={() => go("playing")}>Return</button>
        <button className="menu-item" onClick={() => go("photo")}>Photograph</button>
        <button className="menu-item" onClick={() => go("gallery")}>Photo gallery</button>
        <button className="menu-item" onClick={() => go("settings")}>Settings</button>
        <button className="menu-item" onClick={() => go("menu")}>Leave the valley</button>
      </nav>
      <div className="corner bl">W A S D — walk · Shift — hurry · Space — step · E — touch · P — photograph</div>
      <div className="corner br">Esc — return</div>
    </div>
  );
}

"use client";
import { useGame } from "@/store/gameStore";
import { audio } from "@/lib/game/audio";

export function MainMenu() {
  const setMode = useGame((s) => s.setMode);
  const go = (m: "entering" | "gallery" | "settings") => { audio.init(); audio.resume(); audio.ui(); setMode(m); };
  return (
    <div className="screen">
      <div className="title">MIZU</div>
      <div className="subtitle">Where the seasons remember</div>
      <div className="hairline" />
      <nav className="menu">
        <button className="menu-item" onClick={() => go("entering")}>Enter world</button>
        <button className="menu-item" onClick={() => go("gallery")}>Photo gallery</button>
        <button className="menu-item" onClick={() => go("settings")}>Settings</button>
      </nav>
      <div className="corner bl">W A S D — walk · Shift — hurry · P — photograph · Esc — pause</div>
      <div className="corner br">A quiet place. Nothing is required of you.</div>
    </div>
  );
}

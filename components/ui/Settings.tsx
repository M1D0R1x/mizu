"use client";
import { useGame, type Quality } from "@/store/gameStore";
import { audio } from "@/lib/game/audio";
import { WORLD_SEED } from "@/lib/world/seed";

const QUALITIES: Quality[] = ["low", "medium", "high", "ultra"];

export function Settings() {
  const settings = useGame((s) => s.settings);
  const set = useGame((s) => s.setSettings);
  const setMode = useGame((s) => s.setMode);
  const prev = useGame((s) => s.previousMode);
  const back = () => { audio.ui(); setMode(prev === "paused" || prev === "playing" ? "paused" : "menu"); };

  const slider = (label: string, key: "master" | "music" | "ambience" | "sfx" | "sensitivity" | "fov", min: number, max: number, step: number, fmt: (v: number) => string) => (
    <div className="row">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={step} value={settings[key]} onChange={(e) => set({ [key]: parseFloat(e.target.value) })} />
      <span className="val">{fmt(settings[key])}</span>
    </div>
  );
  const pct = (v: number) => `${Math.round(v * 100)}`;

  return (
    <div className="screen paused">
      <div className="panel">
        <h2>SETTINGS</h2>
        {slider("Master volume", "master", 0, 1, 0.01, pct)}
        {slider("Music", "music", 0, 1, 0.01, pct)}
        {slider("Ambience", "ambience", 0, 1, 0.01, pct)}
        {slider("Sounds", "sfx", 0, 1, 0.01, pct)}
        {slider("Mouse sensitivity", "sensitivity", 0.2, 2.5, 0.05, (v) => v.toFixed(2))}
        {slider("Field of view", "fov", 55, 95, 1, (v) => `${v}°`)}
        <div className="row">
          <span>Graphics</span>
          <div className="seg">
            {QUALITIES.map((q) => <button key={q} className={settings.quality === q ? "on" : ""} onClick={() => set({ quality: q })}>{q}</button>)}
          </div>
          <span />
        </div>
        <div className="row">
          <span>Reduce motion</span>
          <button className={`toggle ${settings.reduceMotion ? "on" : ""}`} onClick={() => set({ reduceMotion: !settings.reduceMotion })}>{settings.reduceMotion ? "on" : "off"}</button>
          <span />
        </div>
        <div className="row">
          <span>World seed</span>
          <button
            className="toggle"
            style={{ justifySelf: "start", padding: "6px 12px", textTransform: "none", letterSpacing: "0.15em", color: "var(--ink)" }}
            onClick={() => {
              const next = Math.floor(Math.random() * 90000) + 1000;
              window.location.search = `?seed=${next}`;
            }}
            title="Click to generate a new procedural valley seed"
          >
            #{WORLD_SEED} &nbsp;·&nbsp; New Seed
          </button>
          <span />
        </div>
        <div className="back"><button className="menu-item" onClick={back}>Back</button></div>
      </div>
    </div>
  );
}

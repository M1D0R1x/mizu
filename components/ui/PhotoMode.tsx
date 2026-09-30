"use client";
import { useEffect, useState } from "react";
import { useGame } from "@/store/gameStore";

const PRESETS: Record<string, { fov: number; exposure: number; dof: boolean; timeOverride: number | null; weatherOverride: string | null }> = {
  CINEMA: { fov: 42, exposure: 0, dof: true, timeOverride: null, weatherOverride: null },
  SAKURA: { fov: 50, exposure: 0.2, dof: true, timeOverride: 16.8, weatherOverride: "clear" },
  RAIN: { fov: 55, exposure: -0.2, dof: false, timeOverride: 17.4, weatherOverride: "heavyRain" },
  GOLDEN: { fov: 48, exposure: 0.15, dof: true, timeOverride: 18.05, weatherOverride: "clear" },
  NIGHT: { fov: 55, exposure: 0.3, dof: false, timeOverride: 22.3, weatherOverride: "clear" },
  MONOCHROME: { fov: 40, exposure: 0.1, dof: true, timeOverride: null, weatherOverride: "mist" },
};

export function PhotoMode() {
  const ps = useGame((s) => s.photoSettings);
  const set = useGame((s) => s.setPhotoSettings);
  const flash = useGame((s) => s.flash);
  const [hideUi, setHideUi] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.code === "KeyH") setHideUi((h) => !h); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const applyPreset = (name: string) => set({ preset: name, ...PRESETS[name] });

  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {flash > 0 && <div key={flash} className="flash" />}
      {!hideUi && (
        <>
          <div className="frame" />
          <div className="photo-top">MIZU</div>
          <div className="photo-panel" style={{ pointerEvents: "auto" }} onMouseDown={(e) => e.stopPropagation()}>
            <div className="row"><span>FOV</span><input type="range" min={15} max={110} step={1} value={ps.fov} onChange={(e) => set({ fov: +e.target.value })} /></div>
            <div className="row"><span>Focus</span><input type="range" min={0.5} max={80} step={0.1} value={ps.focus} onChange={(e) => set({ focus: +e.target.value })} /></div>
            <div className="row"><span>Exposure</span><input type="range" min={-1} max={1} step={0.05} value={ps.exposure} onChange={(e) => set({ exposure: +e.target.value })} /></div>
            <div className="row"><span>Tilt</span><input type="range" min={-25} max={25} step={0.5} value={ps.tilt} onChange={(e) => set({ tilt: +e.target.value })} /></div>
            <div className="row"><span>Time</span><input type="range" min={0} max={24} step={0.05} value={ps.timeOverride ?? 12} onChange={(e) => set({ timeOverride: +e.target.value })} /></div>
            <div className="row"><span>DOF</span><button className={`toggle ${ps.dof ? "on" : ""}`} onClick={() => set({ dof: !ps.dof })}>{ps.dof ? "on" : "off"}</button></div>
            <div className="seg">
              {["clear", "windy", "lightRain", "heavyRain", "mist"].map((w) => (
                <button key={w} className={ps.weatherOverride === w ? "on" : ""} onClick={() => set({ weatherOverride: w })}>{w.replace("Rain", " rain")}</button>
              ))}
            </div>
            <div className="seg">
              {Object.keys(PRESETS).map((p) => <button key={p} className={ps.preset === p ? "on" : ""} onClick={() => applyPreset(p)}>{p}</button>)}
            </div>
          </div>
          <div className="photo-bottom">
            <div className="photo-readout">
              <span>FOV</span><b>{ps.fov}</b>
              <span>Focus</span><b>{ps.focus.toFixed(1)}m</b>
              <span>Exposure</span><b>{ps.exposure >= 0 ? "+" : ""}{ps.exposure.toFixed(2)}</b>
              <span>DOF</span><b>{ps.dof ? "on" : "off"}</b>
            </div>
            <div style={{ textAlign: "right", lineHeight: 1.9 }}>
              drag — look · W A S D — move · Q / E — height · scroll — zoom<br />
              P — capture · H — hide interface · Esc — exit
            </div>
          </div>
        </>
      )}
    </div>
  );
}

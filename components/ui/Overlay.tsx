"use client";
import { useEffect } from "react";
import { useGame } from "@/store/gameStore";
import { Intro } from "./Intro";
import { MainMenu } from "./MainMenu";
import { PauseMenu } from "./PauseMenu";
import { Settings } from "./Settings";
import { PhotoMode } from "./PhotoMode";
import { Gallery } from "./Gallery";
import { Hud } from "./Hud";
import { Debug } from "./Debug";
import { audio } from "@/lib/game/audio";

export function Overlay() {
  const mode = useGame((s) => s.mode);
  const debug = useGame((s) => s.debug);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const s = useGame.getState();
      if (e.ctrlKey && e.shiftKey && e.code === "KeyD") { e.preventDefault(); s.toggleDebug(); return; }
      switch (s.mode) {
        case "intro":
          if (e.code !== "Escape") s.setMode("menu");
          break;
        case "playing":
          if (e.code === "KeyP") { s.setMode("photo"); audio.ui(); }
          if (e.code === "Escape") s.setMode("paused");
          break;
        case "paused":
          if (e.code === "Escape" || e.code === "Enter") s.setMode("playing");
          if (e.code === "KeyP") s.setMode("photo");
          break;
        case "photo":
          if (e.code === "Escape") s.setMode("playing");
          if (e.code === "KeyP" || e.code === "Enter") s.requestCapture(true);
          break;
        case "gallery":
        case "settings":
          if (e.code === "Escape") s.setMode(s.previousMode === "playing" || s.previousMode === "paused" ? "paused" : "menu");
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="ui-layer">
      {mode === "intro" && <Intro />}
      {mode === "menu" && <MainMenu />}
      {(mode === "playing" || mode === "entering") && <Hud />}
      {mode === "paused" && <PauseMenu />}
      {mode === "photo" && <PhotoMode />}
      {mode === "gallery" && <Gallery />}
      {mode === "settings" && <Settings />}
      {debug && <Debug />}
    </div>
  );
}

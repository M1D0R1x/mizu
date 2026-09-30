"use client";
import { useEffect, useState } from "react";
import { useGame } from "@/store/gameStore";
import { world } from "@/lib/game/world";

/** Almost nothing. A place name for a moment, a whisper of a prompt. */
export function Hud() {
  const label = useGame((s) => s.discoveryLabel);
  const prompt = useGame((s) => s.prompt);
  const mode = useGame((s) => s.mode);
  const [locked, setLocked] = useState(true);
  const [tpp, setTpp] = useState(false);

  useEffect(() => {
    const f = () => setLocked(!!document.pointerLockElement);
    f();
    document.addEventListener("pointerlockchange", f);
    return () => document.removeEventListener("pointerlockchange", f);
  }, []);

  // Poll TPP state at low frequency (it's mutable, not React state)
  useEffect(() => {
    if (mode !== "playing") return;
    const id = setInterval(() => setTpp(world.player.tppMode), 200);
    return () => clearInterval(id);
  }, [mode]);

  return (
    <>
      {label && <div className="label" key={label}>{label}</div>}
      {prompt && <div className="prompt">{prompt}</div>}
      {mode === "playing" && !locked && <div className="prompt" style={{ bottom: "6%" }}>click to look around</div>}
      {mode === "playing" && tpp && (
        <div className="corner tr" style={{ opacity: 0.55 }}>TPP &nbsp;·&nbsp; scroll = zoom &nbsp;·&nbsp; V = FPP</div>
      )}
      {mode === "playing" && !tpp && locked && (
        <div className="corner tr" style={{ opacity: 0.35 }}>V = third person &nbsp;·&nbsp; Tab = speed</div>
      )}
    </>
  );
}

"use client";
import { useEffect, useState } from "react";
import { useGame } from "@/store/gameStore";
import { world } from "@/lib/game/world";
import { WORLD_SEED } from "@/lib/world/seed";
import { getSpawnSpot } from "@/lib/world/spawnGen";

/** Almost nothing. A place name for a moment, a whisper of a prompt. */
export function Hud() {
  const label = useGame((s) => s.discoveryLabel);
  const prompt = useGame((s) => s.prompt);
  const mode = useGame((s) => s.mode);
  const [locked, setLocked] = useState(true);
  const [tpp, setTpp] = useState(false);
  const [seedBadge, setSeedBadge] = useState(true);
  const spawn = getSpawnSpot();

  useEffect(() => {
    const timer = setTimeout(() => setSeedBadge(false), 7000);
    return () => clearTimeout(timer);
  }, []);

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
      {mode === "playing" && (
        <div className="corner tl" style={{ opacity: seedBadge ? 0.75 : 0.3, transition: "opacity 1.2s", pointerEvents: "none" }}>
          SEED #{WORLD_SEED} &nbsp;·&nbsp; {spawn.name} &nbsp;·&nbsp; N = new valley
        </div>
      )}
      {mode === "playing" && tpp && (
        <div className="corner tr" style={{ opacity: 0.55 }}>TPP &nbsp;·&nbsp; scroll = zoom &nbsp;·&nbsp; V = FPP</div>
      )}
      {mode === "playing" && !tpp && locked && (
        <div className="corner tr" style={{ opacity: 0.35 }}>V = third person &nbsp;·&nbsp; Tab = speed</div>
      )}
    </>
  );
}

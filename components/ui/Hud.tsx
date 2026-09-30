"use client";
import { useEffect, useState } from "react";
import { useGame } from "@/store/gameStore";

/** Almost nothing. A place name for a moment, a whisper of a prompt. */
export function Hud() {
  const label = useGame((s) => s.discoveryLabel);
  const prompt = useGame((s) => s.prompt);
  const mode = useGame((s) => s.mode);
  const [locked, setLocked] = useState(true);
  useEffect(() => {
    const f = () => setLocked(!!document.pointerLockElement);
    f();
    document.addEventListener("pointerlockchange", f);
    return () => document.removeEventListener("pointerlockchange", f);
  }, []);
  return (
    <>
      {label && <div className="label" key={label}>{label}</div>}
      {prompt && <div className="prompt">{prompt}</div>}
      {mode === "playing" && !locked && <div className="prompt" style={{ bottom: "6%" }}>click to look around</div>}
    </>
  );
}

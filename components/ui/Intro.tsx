"use client";
import { useEffect, useState } from "react";
import { useGame } from "@/store/gameStore";

/** Black. The sound of water. A single petal. Then the lake. */
export function Intro() {
  const [stage, setStage] = useState(0);
  const setMode = useGame((s) => s.setMode);
  useEffect(() => {
    const t1 = setTimeout(() => setStage(1), 1400); // petal starts
    const t2 = setTimeout(() => setStage(2), 3200); // black lifts
    const t3 = setTimeout(() => setMode("menu"), 9200);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [setMode]);
  return (
    <div style={{ position: "absolute", inset: 0 }} onClick={() => setMode("menu")}>
      <div className="black" style={{ opacity: stage >= 2 ? 0 : 1 }} />
      {stage >= 1 && <div className="petal" />}
      <div className="skip">click to skip</div>
    </div>
  );
}

"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { hydrateStore, useGame } from "@/store/gameStore";
import { Overlay } from "./ui/Overlay";

const GameCanvas = dynamic(() => import("./game/GameCanvas").then((m) => m.GameCanvas), {
  ssr: false,
  loading: () => <div className="loading" suppressHydrationWarning><span suppressHydrationWarning>MIZU</span></div>,
});

export function Mizu() {
  const [ready, setReady] = useState(false);
  const smallScreen = useGame((s) => s.smallScreen);

  useEffect(() => {
    hydrateStore();
    const check = () => useGame.getState().setSmallScreen(window.innerWidth < 900 || window.innerHeight < 500);
    check();
    window.addEventListener("resize", check);
    setReady(true);
    return () => window.removeEventListener("resize", check);
  }, []);

  if (!ready) return <div className="loading" suppressHydrationWarning><span suppressHydrationWarning>MIZU</span></div>;
  if (smallScreen) {
    return (
      <div className="gate">
        <div className="title" style={{ fontSize: 64 }}>MIZU</div>
        <p>This experience is designed for a larger screen.<br />Please open MIZU on a desktop or laptop.</p>
      </div>
    );
  }
  return (
    <>
      <GameCanvas />
      <Overlay />
    </>
  );
}

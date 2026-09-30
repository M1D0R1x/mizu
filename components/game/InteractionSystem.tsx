"use client";
import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { interactables, type Interactable } from "@/lib/game/interactables";
import { world } from "@/lib/game/world";
import { useGame } from "@/store/gameStore";
import { stand } from "@/lib/game/actions";

export function InteractionSystem() {
  const mode = useGame((s) => s.mode);
  const current = useRef<Interactable | null>(null);
  const timer = useRef(0);

  useEffect(() => {
    if (mode !== "playing") { useGame.getState().setPrompt(null); return; }
    const fire = () => {
      if (world.cinematic) return;
      if (world.player.sitting) { stand(); return; }
      current.current?.action();
    };
    const onKey = (e: KeyboardEvent) => { if (e.code === "KeyE" || e.code === "KeyF") fire(); };
    const onClick = () => { if (document.pointerLockElement) fire(); };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("mousedown", onClick); };
  }, [mode]);

  useFrame((_, dt) => {
    if (mode !== "playing") return;
    timer.current -= dt;
    if (timer.current > 0) return;
    timer.current = 0.15;
    const p = world.player;
    if (p.sitting) { current.current = null; useGame.getState().setPrompt("E  ·  STAND"); return; }
    const fx = -Math.sin(p.yaw), fz = -Math.cos(p.yaw);
    let best: Interactable | null = null, bestScore = Infinity;
    for (const it of interactables) {
      const dx = it.x - p.pos.x, dz = it.z - p.pos.z;
      const d = Math.hypot(dx, dz);
      if (d > it.radius) continue;
      const facing = (dx * fx + dz * fz) / Math.max(d, 0.01);
      if (facing < 0.35 && d > 1.2) continue;
      const score = d - facing;
      if (score < bestScore) { bestScore = score; best = it; }
    }
    current.current = best;
    useGame.getState().setPrompt(best ? `E  ·  ${best.label}` : null);
  });
  return null;
}

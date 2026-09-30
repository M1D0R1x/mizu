"use client";
import { useEffect, useState } from "react";
import { world, type WeatherType } from "@/lib/game/world";
import { debugStats } from "@/lib/game/debugStats";

export function Debug() {
  const [, tick] = useState(0);
  useEffect(() => { const id = setInterval(() => tick((t) => t + 1), 250); return () => clearInterval(id); }, []);
  const p = world.player.pos;
  const setTime = (t: number) => { world.time = t; };
  const setWeather = (w: WeatherType) => { world.targetWeather = w; world.weatherTimer = 240; };
  return (
    <div className="debug">
      <div>FPS {world.fps.toFixed(0)} · DRAW {debugStats.calls} · TRIS {(debugStats.triangles / 1000).toFixed(0)}k</div>
      <div>POS {p.x.toFixed(1)}, {p.y.toFixed(1)}, {p.z.toFixed(1)}</div>
      <div>TIME {world.time.toFixed(2)}h · SUN {world.sunDir.y.toFixed(2)}</div>
      <div>WEATHER {world.weather} → rain {world.rain.toFixed(2)} mist {world.mist.toFixed(2)} cloud {world.cloud.toFixed(2)}</div>
      <div>WIND {world.windStrength.toFixed(2)} · WET {world.wetness.toFixed(2)}</div>
      <div>AREA {world.player.area ?? "—"} · TRAIN {world.trainActive ? world.trainProgress.toFixed(2) : "idle"}</div>
      <div className="btns">
        <button onClick={() => setTime(5.6)}>dawn</button>
        <button onClick={() => setTime(12)}>noon</button>
        <button onClick={() => setTime(17.9)}>golden</button>
        <button onClick={() => setTime(18.7)}>sunset</button>
        <button onClick={() => setTime(19.6)}>blue</button>
        <button onClick={() => setTime(22.5)}>night</button>
        <button onClick={() => setWeather("clear")}>clear</button>
        <button onClick={() => setWeather("windy")}>windy</button>
        <button onClick={() => setWeather("lightRain")}>rain</button>
        <button onClick={() => setWeather("heavyRain")}>storm</button>
        <button onClick={() => setWeather("mist")}>mist</button>
        <button onClick={() => { world.trainTimer = 0; }}>train</button>
        <button onClick={() => { world.hoursPerMinute = world.hoursPerMinute > 2 ? 1.6 : 12; }}>time ×{world.hoursPerMinute > 2 ? "1" : "8"}</button>
      </div>
    </div>
  );
}

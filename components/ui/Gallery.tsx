"use client";
import { useGame } from "@/store/gameStore";
import { audio } from "@/lib/game/audio";

export function Gallery() {
  const photos = useGame((s) => s.photos);
  const remove = useGame((s) => s.removePhoto);
  const setMode = useGame((s) => s.setMode);
  const prev = useGame((s) => s.previousMode);
  const back = () => { audio.ui(); setMode(prev === "paused" || prev === "playing" ? "paused" : "menu"); };
  const download = (data: string, name: string) => {
    const a = document.createElement("a"); a.href = data; a.download = name; a.click();
  };
  return (
    <div className="screen paused">
      <div className="gallery">
        <h2>PHOTOGRAPHS</h2>
        {photos.length === 0 ? (
          <div className="empty">Nothing yet. Press P in the valley.</div>
        ) : (
          <div className="grid">
            {photos.map((p) => (
              <div className="shot" key={p.id}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.data} alt={`${p.area} ${p.time}`} />
                <div className="meta">
                  <span>{p.area} · {p.time}</span>
                  <span>
                    <button onClick={() => download(p.data, `mizu-${p.id}.jpg`)}>save</button>{" "}·{" "}
                    <button onClick={() => remove(p.id)}>forget</button>
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="back"><button className="menu-item" onClick={back}>Back</button></div>
      </div>
    </div>
  );
}

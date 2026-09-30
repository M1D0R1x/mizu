import { create } from "zustand";
import type { AreaId } from "@/lib/world/terrain";

export type Mode = "intro" | "menu" | "entering" | "playing" | "paused" | "photo" | "gallery" | "settings";
export type Quality = "low" | "medium" | "high" | "ultra";

export interface Settings {
  master: number; music: number; ambience: number; sfx: number;
  sensitivity: number; fov: number; quality: Quality; reduceMotion: boolean;
}

export interface Photo { id: string; data: string; time: string; area: string; taken: number }

export interface PhotoSettings {
  fov: number; focus: number; exposure: number; dof: boolean; tilt: number; preset: string; timeOverride: number | null; weatherOverride: string | null;
}

interface GameState {
  mode: Mode;
  previousMode: Mode;
  settings: Settings;
  discovered: AreaId[];
  photos: Photo[];
  debug: boolean;
  smallScreen: boolean;
  discoveryLabel: string | null;
  prompt: string | null;
  flash: number;
  photoSettings: PhotoSettings;
  captureRequested: boolean;
  hasEntered: boolean;
  setPrompt: (p: string | null) => void;
  setFlash: (n: number) => void;
  setMode: (m: Mode) => void;
  setSettings: (s: Partial<Settings>) => void;
  discover: (a: AreaId, label: string) => void;
  addPhoto: (p: Photo) => void;
  removePhoto: (id: string) => void;
  toggleDebug: () => void;
  setSmallScreen: (v: boolean) => void;
  setDiscoveryLabel: (l: string | null) => void;
  setPhotoSettings: (s: Partial<PhotoSettings>) => void;
  requestCapture: (v: boolean) => void;
}

const SETTINGS_KEY = "mizu.settings.v1", DISC_KEY = "mizu.discovered.v1", PHOTO_KEY = "mizu.photos.v1";

const defaultSettings: Settings = { master: 0.8, music: 0.6, ambience: 0.9, sfx: 0.8, sensitivity: 1, fov: 70, quality: "high", reduceMotion: false };

function load<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try { const v = localStorage.getItem(key); return v ? { ...fallback, ...JSON.parse(v) } : fallback; } catch { return fallback; }
}
function loadArr<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T[]) : []; } catch { return []; }
}
const save = (key: string, v: unknown) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* storage full */ } };

export const useGame = create<GameState>((set, get) => ({
  mode: "intro",
  previousMode: "menu",
  settings: defaultSettings,
  discovered: [],
  photos: [],
  debug: false,
  smallScreen: false,
  discoveryLabel: null,
  prompt: null,
  flash: 0,
  hasEntered: false,
  captureRequested: false,
  setPrompt: (p) => { if (get().prompt !== p) set({ prompt: p }); },
  setFlash: (n) => set({ flash: n }),
  photoSettings: { fov: 55, focus: 6, exposure: 0, dof: true, tilt: 0, preset: "CINEMA", timeOverride: null, weatherOverride: null },
  setMode: (m) => set((s) => ({ mode: m, previousMode: s.mode, hasEntered: s.hasEntered || m === "playing" })),
  setSettings: (p) => { const settings = { ...get().settings, ...p }; save(SETTINGS_KEY, settings); set({ settings }); },
  discover: (a, label) => {
    if (get().discovered.includes(a)) return;
    const discovered = [...get().discovered, a];
    save(DISC_KEY, discovered);
    set({ discovered, discoveryLabel: label });
    setTimeout(() => set((s) => (s.discoveryLabel === label ? { discoveryLabel: null } : {})), 2600);
  },
  addPhoto: (p) => { const photos = [p, ...get().photos].slice(0, 12); save(PHOTO_KEY, photos); set({ photos }); },
  removePhoto: (id) => { const photos = get().photos.filter((p) => p.id !== id); save(PHOTO_KEY, photos); set({ photos }); },
  toggleDebug: () => set((s) => ({ debug: !s.debug })),
  setSmallScreen: (v) => set({ smallScreen: v }),
  setDiscoveryLabel: (l) => set({ discoveryLabel: l }),
  setPhotoSettings: (p) => set((s) => ({ photoSettings: { ...s.photoSettings, ...p } })),
  requestCapture: (v) => set({ captureRequested: v }),
}));

/** Call once on the client to hydrate persisted state. */
export function hydrateStore() {
  useGame.setState({
    settings: load(SETTINGS_KEY, defaultSettings),
    discovered: loadArr<AreaId>(DISC_KEY),
    photos: loadArr<Photo>(PHOTO_KEY),
  });
}

export const QUALITY: Record<Quality, { dpr: number; shadows: boolean; shadowSize: number; particles: number; grass: number; postfx: boolean; reflections: boolean; drawDistance: number }> = {
  low: { dpr: 0.75, shadows: false, shadowSize: 1024, particles: 0.35, grass: 0.3, postfx: false, reflections: false, drawDistance: 600 },
  medium: { dpr: 1, shadows: true, shadowSize: 1024, particles: 0.6, grass: 0.6, postfx: true, reflections: false, drawDistance: 800 },
  high: { dpr: 1, shadows: true, shadowSize: 2048, particles: 1, grass: 1, postfx: true, reflections: true, drawDistance: 1000 },
  ultra: { dpr: 1.5, shadows: true, shadowSize: 4096, particles: 1.4, grass: 1.4, postfx: true, reflections: true, drawDistance: 1200 },
};

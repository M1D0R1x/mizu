<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# MIZU — project notes

Browser-only 3D exploration of a fictional Japanese valley. Next.js 16 (App Router) + React Three Fiber + Three.js. No backend, no assets: every texture, mesh and sound is generated procedurally at runtime.

## Commands
- `npm run dev -- --port 3210` — dev server (Turbopack)
- `npx tsc --noEmit` — typecheck (`LayoutProps` is a Next-generated global; run `next dev`/`build` once first)
- `npm run build` — production build (must pass before shipping; deploys to Vercel as static)
- `node tools/shot.mjs "name=lake;time=6;weather=clear;x=-50;z=130;yaw=0.45;pitch=0"` — visual QA screenshots into `shots/` via Playwright's cached Chromium (dev server must be running on :3210; dev-only hooks live in `components/game/DevHooks.tsx`, exposed as `window.__mizu`). Params: `time` (hours), `weather` (clear|windy|lightRain|heavyRain|mist), `x`/`z`, `yaw`/`pitch`, `mode`, `quality`, `wait` ms.

## Architecture
- `lib/world/terrain.ts` — single source of truth for the valley shape: `terrainHeight(x,z)`, area centres, paths, stream, terraces. Everything (mesh, player, placement, water) samples it.
- `lib/world/heightmap.ts` — bakes height/grass-mask into a texture for GPU grass/petals.
- `lib/game/world.ts` — mutable per-frame state (time, weather, wind, player). Zustand (`store/gameStore.ts`) only holds low-frequency state (mode, settings, photos).
- `lib/game/uniforms.ts` — shared shader uniforms (`U`), updated once per frame by `LightingSystem`.
- `lib/game/lighting.ts` — continuous sun/moon/sky/fog evaluation from time + weather.
- `lib/game/materials.ts` — shared PBR materials; `withWind`/`withWetness` shader patches; `registerGlow` for lantern/window emissives.
- `lib/world/builders.ts` — box/cyl/roof/house/torii/lantern builders + `mergeStatic()` (collapses static meshes per material — keep draw calls low).
- `components/world/*` — areas; `components/animals/*`; `components/game/*` — systems (player, camera, time, audio, photo mode, capture); `components/ui/*` — menus/HUD.

## Gotchas learned
- Textures used as `map` must be bright modulators (~0.7–1.0); material `color` is the albedo. Dark texture × dark color × dark instanceColor = black.
- `instanceColor` multiplies the material colour; for per-instance albedo set material colour white.
- `roof()` takes `x/z`; forgetting them floats roofs above the lake.
- Any `useFrame` with priority > 0 disables R3F auto-render — `PostFX` renders manually when post-processing is off.
- `PCFSoftShadowMap` was removed in three r186; use `shadows="percentage"`.
- Large boxes/cylinders need UV scaling (`scaleBoxUVs`) or textures stretch into swirls.

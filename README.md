# MIZU — Where the Seasons Remember

A browser-based, first-person exploration of a fictional Japanese valley. There are no missions, no score and nothing to win — only a lake, a village, a bamboo forest, a hilltop shrine, rice terraces, a forgotten station and the light changing over all of it.

Everything is generated at runtime: terrain, architecture, trees, water, weather, petals, fireflies and the entire soundscape. No assets are downloaded and nothing runs on a server.

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000 on a desktop or laptop (keyboard + mouse).

| Key | |
| --- | --- |
| `W A S D` | walk |
| `Shift` | hurry |
| `Space` | small step |
| `E` | touch (bells, doors, benches, fish…) |
| `P` | photo mode / capture |
| `Esc` | pause |
| `Ctrl+Shift+D` | debug overlay |

## Deploy

```bash
npm run build
```

Static output, deploys directly to Vercel — no environment variables, no backend.

Built with Next.js, React Three Fiber, Three.js, drei, @react-three/postprocessing and Zustand.

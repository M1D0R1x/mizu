// Dev-only: capture screenshots of MIZU at given world states for visual QA.
// usage: node tools/shot.mjs "name=lake-dawn;time=5.8;x=-34;z=98;yaw=0.2;pitch=0" ...
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH || "/Users/abhinavjha/.npm/_npx/e41f203b7505f1fb/node_modules/playwright");

const specs = process.argv.slice(2).map((s) => Object.fromEntries(s.split(";").map((kv) => kv.split("="))));
const browser = await chromium.launch({ headless: true, args: ["--use-angle=metal", "--enable-gpu", "--ignore-gpu-blocklist", "--enable-unsafe-webgpu", "--use-gl=angle"] });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });
page.on("console", (m) => { if (m.type() === "error" || m.type() === "warning") console.log("[browser]", m.type(), m.text().slice(0, 300)); });
page.on("pageerror", (e) => console.log("[pageerror]", e.message));
await page.goto(process.env.URL || "http://localhost:3210/", { waitUntil: "networkidle" });
await page.waitForTimeout(4000);
for (const s of specs) {
  await page.evaluate((s) => window.__mizu?.set(s), s);
  await page.waitForTimeout(Number(s.wait ?? 1800));
  await page.screenshot({ path: `shots/${s.name || "shot"}.jpg`, type: "jpeg", quality: 88 });
  const info = await page.evaluate(() => window.__mizu?.info());
  console.log(s.name, info);
}
await browser.close();

// Procedural ambient audio. Everything is synthesised with WebAudio at runtime:
// wind, water, rain, birds, crickets, wind chimes, footsteps, temple bells,
// a distant train and a sparse generative koto/piano score.
import { world } from "./world";
import { lakeDist, streamDist, VILLAGE, BAMBOO, SHRINE, SAKURA, STATION, MAPLE_GROVE } from "@/lib/world/terrain";
import { clamp, smoothstep } from "@/lib/world/noise";

type Layer = { gain: GainNode; filter?: BiquadFilterNode; filter2?: BiquadFilterNode };

const PENTA = [146.83, 174.61, 196.0, 220.0, 261.63, 293.66, 349.23, 392.0, 440.0, 523.25, 587.33];

class AudioManager {
  ctx: AudioContext | null = null;
  master!: GainNode; music!: GainNode; amb!: GainNode; sfx!: GainNode; reverb!: ConvolverNode; reverbGain!: GainNode;
  layers: Record<string, Layer> = {};
  noiseBuf!: AudioBuffer;
  vol = { master: 0.8, music: 0.6, ambience: 0.9, sfx: 0.8 };
  birdTimer = 2; cricketTimer = 1; chimeTimer = 5; musicTimer = 20; padTimer = 0;
  started = false;

  init() {
    if (this.ctx || typeof window === "undefined") return;
    const ctx = new AudioContext();
    this.ctx = ctx;
    this.master = ctx.createGain(); this.master.connect(ctx.destination);
    this.music = ctx.createGain(); this.amb = ctx.createGain(); this.sfx = ctx.createGain();
    this.music.connect(this.master); this.amb.connect(this.master); this.sfx.connect(this.master);
    // reverb
    this.reverb = ctx.createConvolver();
    const len = ctx.sampleRate * 3.2, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6) * 0.5; }
    this.reverb.buffer = ir;
    this.reverbGain = ctx.createGain(); this.reverbGain.gain.value = 0.5;
    this.reverb.connect(this.reverbGain); this.reverbGain.connect(this.master);
    // noise buffer
    const nl = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, nl, ctx.sampleRate);
    const nd = this.noiseBuf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < nl; i++) { const w = Math.random() * 2 - 1; b0 = 0.99765 * b0 + w * 0.099; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0526; nd[i] = (b0 + b1 + b2 + w * 0.1848) * 0.12; }
    this.layers.wind = this.noiseLayer("lowpass", 320, 0.6);
    this.layers.leaves = this.noiseLayer("bandpass", 2400, 0.9);
    this.layers.water = this.noiseLayer("bandpass", 900, 0.6);
    this.layers.stream = this.noiseLayer("bandpass", 1800, 0.8);
    this.layers.rain = this.noiseLayer("highpass", 1500, 0.4, "lowpass", 7000);
    this.layers.rainRoof = this.noiseLayer("bandpass", 600, 1.2);
    this.applyVolumes();
    this.started = true;
  }

  private noiseLayer(type: BiquadFilterType, freq: number, q: number, type2?: BiquadFilterType, freq2?: number): Layer {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
    const filter = ctx.createBiquadFilter(); filter.type = type; filter.frequency.value = freq; filter.Q.value = q;
    const gain = ctx.createGain(); gain.gain.value = 0;
    src.connect(filter);
    let filter2: BiquadFilterNode | undefined;
    if (type2) { filter2 = ctx.createBiquadFilter(); filter2.type = type2; filter2.frequency.value = freq2!; filter.connect(filter2); filter2.connect(gain); }
    else filter.connect(gain);
    gain.connect(this.amb);
    src.start();
    return { gain, filter, filter2 };
  }

  setVolumes(v: Partial<typeof this.vol>) { Object.assign(this.vol, v); this.applyVolumes(); }
  private applyVolumes() {
    if (!this.ctx) return;
    this.master.gain.value = this.vol.master;
    this.music.gain.value = this.vol.music * 0.5;
    this.amb.gain.value = this.vol.ambience;
    this.sfx.gain.value = this.vol.sfx;
  }
  resume() { this.ctx?.resume(); }
  suspend() { this.ctx?.suspend(); }

  private set(layer: Layer, g: number, t = 0.6) {
    const ctx = this.ctx!;
    layer.gain.gain.setTargetAtTime(g, ctx.currentTime, t);
  }

  update(dt: number) {
    if (!this.ctx || this.ctx.state !== "running") return;
    const p = world.player.pos;
    const ld = lakeDist(p.x, p.z) - 80, sd = streamDist(p.x, p.z);
    const nearLake = smoothstep(60, -10, ld), nearStream = smoothstep(30, 2, sd);
    const inBamboo = smoothstep(60, 20, Math.hypot(p.x - BAMBOO.x, p.z - BAMBOO.z));
    const inForest = Math.max(inBamboo, smoothstep(80, 30, Math.hypot(p.x - SAKURA.x, p.z - SAKURA.z)), smoothstep(50, 20, Math.hypot(p.x - MAPLE_GROVE.x, p.z - MAPLE_GROVE.z)), smoothstep(200, 260, Math.hypot(p.x, p.z)));
    const inVillage = smoothstep(70, 30, Math.hypot(p.x - VILLAGE.x, p.z - VILLAGE.z));
    const atShrine = smoothstep(50, 20, Math.hypot(p.x - SHRINE.x, p.z - SHRINE.z));
    const atStation = smoothstep(40, 15, Math.hypot(p.x - STATION.x, p.z - STATION.z));
    const w = world.windStrength, day = world.daylight, rain = world.rain;
    const frozen = world.frozen ? 0.35 : 1;

    this.set(this.layers.wind, (0.12 + w * 0.55) * frozen);
    this.layers.wind.filter!.frequency.setTargetAtTime(220 + w * 500, this.ctx.currentTime, 0.5);
    this.set(this.layers.leaves, w * (0.05 + inForest * 0.16 + inBamboo * 0.12) * frozen);
    this.set(this.layers.water, nearLake * (0.14 + w * 0.12) * frozen);
    this.set(this.layers.stream, nearStream * (0.28 + rain * 0.15) * frozen);
    this.set(this.layers.rain, rain * 0.42 * frozen);
    this.set(this.layers.rainRoof, rain * (inVillage * 0.25 + atStation * 0.2 + atShrine * 0.15) * frozen);
    if (world.frozen) return;

    // birds by day
    this.birdTimer -= dt;
    if (this.birdTimer <= 0) {
      const rate = day * (1 - rain * 0.85) * (0.4 + inForest * 0.6 + nearLake * 0.3);
      this.birdTimer = 0.6 + Math.random() * 4 / Math.max(rate, 0.05);
      if (rate > 0.08 && Math.random() < 0.8) this.bird(0.6 + Math.random() * 0.6);
    }
    // crickets at night
    this.cricketTimer -= dt;
    if (this.cricketTimer <= 0) {
      this.cricketTimer = 0.4 + Math.random() * 1.6;
      const n = (1 - day) * (1 - rain);
      if (n > 0.2 && Math.random() < 0.75) this.cricket(n * (0.5 + inForest * 0.5 + nearLake * 0.3));
    }
    // village wind chimes
    this.chimeTimer -= dt;
    if (this.chimeTimer <= 0) {
      this.chimeTimer = 1.5 + Math.random() * 6 / Math.max(w, 0.1);
      if (inVillage > 0.05 && Math.random() < w * 1.4) this.chime(inVillage);
    }
    // sparse music
    this.musicTimer -= dt;
    if (this.musicTimer <= 0) {
      this.musicTimer = 28 + Math.random() * 50;
      if (Math.random() < 0.55 && rain < 0.6) this.phrase();
    }
  }

  private tone(freq: number, dur: number, gain: number, type: OscillatorType, dest: AudioNode, attack = 0.01, detune = 0, when = 0) {
    const ctx = this.ctx!, t = ctx.currentTime + when;
    const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq; o.detune.value = detune;
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
    return o;
  }

  bird(v = 1) {
    const ctx = this.ctx!; const t = ctx.currentTime;
    const base = 1800 + Math.random() * 1600, n = 2 + Math.floor(Math.random() * 4);
    for (let i = 0; i < n; i++) {
      const o = ctx.createOscillator(); o.type = "sine";
      const g = ctx.createGain(); const s = t + i * (0.09 + Math.random() * 0.06);
      o.frequency.setValueAtTime(base * (0.9 + Math.random() * 0.2), s);
      o.frequency.exponentialRampToValueAtTime(base * (1.15 + Math.random() * 0.3), s + 0.05);
      o.frequency.exponentialRampToValueAtTime(base * 0.95, s + 0.09);
      g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(0.045 * v, s + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, s + 0.1);
      const pan = ctx.createStereoPanner(); pan.pan.value = Math.random() * 2 - 1;
      o.connect(g); g.connect(pan); pan.connect(this.amb); pan.connect(this.reverb); o.start(s); o.stop(s + 0.12);
    }
  }
  cricket(v = 1) {
    const ctx = this.ctx!; const t = ctx.currentTime;
    const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = 3800 + Math.random() * 900;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 18 + Math.random() * 14; const lg = ctx.createGain(); lg.gain.value = 0.5;
    const g = ctx.createGain(); g.gain.value = 0;
    lfo.connect(lg); lg.connect(g.gain);
    const env = ctx.createGain(); env.gain.setValueAtTime(0, t); env.gain.linearRampToValueAtTime(0.02 * v, t + 0.1); env.gain.setValueAtTime(0.02 * v, t + 0.5 + Math.random()); env.gain.linearRampToValueAtTime(0, t + 1.2 + Math.random());
    const pan = ctx.createStereoPanner(); pan.pan.value = Math.random() * 1.6 - 0.8;
    o.connect(g); g.connect(env); env.connect(pan); pan.connect(this.amb);
    o.start(t); lfo.start(t); o.stop(t + 2.5); lfo.stop(t + 2.5);
  }
  chime(v = 1) {
    const f = [2093, 2349, 2637, 3136, 3520][Math.floor(Math.random() * 5)];
    const g = this.ctx!.createGain(); g.gain.value = 0.35 * v; g.connect(this.amb); g.connect(this.reverb);
    this.tone(f, 1.8 + Math.random(), 0.05, "sine", g, 0.005);
    this.tone(f * 2.76, 0.6, 0.012, "sine", g, 0.005);
  }
  footstep(kind: "grass" | "wet" | "wood" | "stone") {
    if (!this.ctx || this.ctx.state !== "running") return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf; src.playbackRate.value = 0.7 + Math.random() * 0.5;
    const f = ctx.createBiquadFilter(); f.type = kind === "wood" ? "bandpass" : "lowpass"; f.frequency.value = kind === "grass" ? 700 : kind === "wet" ? 1400 : kind === "wood" ? 320 : 1100; f.Q.value = kind === "wood" ? 2 : 0.7;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(kind === "wet" ? 0.5 : 0.35, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + (kind === "wood" ? 0.18 : 0.13));
    src.connect(f); f.connect(g); g.connect(this.sfx); src.start(t, Math.random() * 1.5); src.stop(t + 0.25);
  }
  bell(distance = 0) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const atten = 1 / (1 + distance * 0.02);
    const dest = ctx.createGain(); dest.gain.value = 0.55 * atten; dest.connect(this.sfx); dest.connect(this.reverb);
    const partials: [number, number, number][] = [[1, 1, 9], [2.0, 0.55, 6], [2.98, 0.35, 5], [4.2, 0.2, 3.5], [5.4, 0.12, 2.5], [0.5, 0.3, 8]];
    const base = distance > 60 ? 110 : 165;
    for (const [r, a, d] of partials) this.tone(base * r, d, 0.28 * a, "sine", dest, 0.004, (Math.random() - 0.5) * 6);
    const strike = ctx.createBufferSource(); strike.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 900; f.Q.value = 1.5;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.35 * atten, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    strike.connect(f); f.connect(g); g.connect(this.sfx); strike.start(t); strike.stop(t + 0.15);
    if (distance < 40) world.bellRungAt = world.clock;
  }
  distantBell() { if (this.ctx) this.bell(240); }
  trainHorn(distance: number) {
    if (!this.ctx) return;
    const atten = clamp(1 / (1 + distance * 0.015), 0.05, 1);
    const ctx = this.ctx; const dest = ctx.createGain(); dest.gain.value = 0.22 * atten;
    const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 500 + 1200 * atten; dest.connect(f); f.connect(this.sfx); f.connect(this.reverb);
    for (const fr of [311, 370, 466]) { this.tone(fr, 1.6, 0.25, "sawtooth", dest, 0.25, -6); this.tone(fr, 1.6, 0.25, "sawtooth", dest, 0.25, 6); }
  }
  trainRumble(distance: number, dur = 6) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime, atten = clamp(1 / (1 + distance * 0.02), 0.02, 1);
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf; src.loop = true;
    const f = ctx.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 180 + 300 * atten;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.5 * atten, t + dur * 0.4); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.sfx); src.start(t); src.stop(t + dur + 0.1);
  }
  bicycleBell() {
    if (!this.ctx) return;
    const dest = this.ctx.createGain(); dest.gain.value = 0.5; dest.connect(this.sfx); dest.connect(this.reverb);
    this.tone(2900, 0.5, 0.12, "sine", dest, 0.003); this.tone(2900, 0.5, 0.12, "sine", dest, 0.003, 0, 0.09);
    this.tone(5800, 0.25, 0.03, "sine", dest, 0.003);
  }
  splash() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf; src.playbackRate.value = 1.4;
    const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 2200; f.Q.value = 0.8;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.4, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    src.connect(f); f.connect(g); g.connect(this.sfx); src.start(t, Math.random()); src.stop(t + 0.4);
  }
  door() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    const src = ctx.createBufferSource(); src.buffer = this.noiseBuf; src.playbackRate.value = 0.5;
    const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 260; f.Q.value = 3;
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.35, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    src.connect(f); f.connect(g); g.connect(this.sfx); src.start(t, Math.random()); src.stop(t + 0.8);
    this.footstep("wood");
  }
  ui() {
    if (!this.ctx) return;
    const dest = this.ctx.createGain(); dest.gain.value = 0.25; dest.connect(this.sfx);
    this.tone(880, 0.25, 0.08, "sine", dest, 0.005);
  }
  shutter() {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime;
    for (const [d, fr] of [[0, 1800], [0.07, 1200]] as [number, number][]) {
      const src = ctx.createBufferSource(); src.buffer = this.noiseBuf;
      const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = fr; f.Q.value = 2;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t + d); g.gain.exponentialRampToValueAtTime(0.4, t + d + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.05);
      src.connect(f); f.connect(g); g.connect(this.sfx); src.start(t + d); src.stop(t + d + 0.08);
    }
  }

  /** A short koto/piano-like pentatonic phrase with a soft pad underneath. */
  phrase() {
    const ctx = this.ctx!;
    const dest = ctx.createGain(); dest.gain.value = 1; dest.connect(this.music);
    const wet = ctx.createGain(); wet.gain.value = 0.8; dest.connect(wet); wet.connect(this.reverb);
    const n = 4 + Math.floor(Math.random() * 4);
    let when = 0, idx = Math.floor(Math.random() * 6) + 2;
    const root = PENTA[idx % PENTA.length];
    // pad
    const padDur = n * 1.6 + 4;
    this.tone(root / 2, padDur, 0.05, "sine", dest, 2.5);
    this.tone(root / 2 * 1.5, padDur, 0.03, "sine", dest, 3, 4);
    this.tone(root, padDur, 0.02, "triangle", dest, 3.5, -4);
    for (let i = 0; i < n; i++) {
      idx = clamp(idx + (Math.random() < 0.5 ? -1 : 1) * (Math.random() < 0.7 ? 1 : 2), 0, PENTA.length - 1);
      const f = PENTA[idx] * (Math.random() < 0.3 ? 2 : 1);
      this.tone(f, 2.6, 0.14, "triangle", dest, 0.004, 0, when);
      this.tone(f * 2, 0.5, 0.05, "sine", dest, 0.003, 0, when);
      this.tone(f, 2.2, 0.06, "sine", dest, 0.01, 3, when);
      when += 0.7 + Math.random() * 1.1 + (Math.random() < 0.2 ? 1.2 : 0);
    }
  }
}

export const audio = new AudioManager();

// 즉석 합성 효과음

let ctx: AudioContext | null = null;

export function unlockAudio(): void {
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      return;
    }
  }
  if (ctx.state === "suspended") void ctx.resume();
}

function tone(freq: number, end: number, dur: number, vol: number, type: OscillatorType = "square", delay = 0): void {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const gn = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, end), t + dur);
  gn.gain.setValueAtTime(0.0001, t);
  gn.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(gn).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}

export const sfx = {
  shot: () => tone(900, 500, 0.08, 0.04, "square"),
  zap: () => tone(1400, 400, 0.07, 0.04, "sawtooth"),
  fire: () => tone(220, 80, 0.3, 0.08, "sawtooth"),
  ice: () => tone(2000, 1000, 0.2, 0.04, "triangle"),
  wave: () => tone(300, 120, 0.35, 0.07, "triangle"),
  swing: () => tone(500, 150, 0.1, 0.06, "sawtooth"),
  quake: () => tone(90, 40, 0.4, 0.15, "square"),
  charge: () => tone(200, 500, 0.35, 0.04, "sine"),
  dash: () => tone(600, 1200, 0.08, 0.04, "triangle"),
  hit: () => tone(180, 60, 0.12, 0.1, "square"),
  heal: () => [523, 659, 784].forEach((f, i) => tone(f, f, 0.15, 0.05, "triangle", i * 0.06)),
  fizzle: () => tone(300, 120, 0.15, 0.04, "sawtooth"),
  blip: () => tone(700, 700, 0.04, 0.03, "square"),
  alert: () => [880, 1320].forEach((f, i) => tone(f, f, 0.08, 0.05, "square", i * 0.07)),
  learn: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, f, 0.18, 0.06, "triangle", i * 0.08)),
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, f, 0.22, 0.07, "square", i * 0.11)),
  lose: () => [392, 330, 262].forEach((f, i) => tone(f, f * 0.95, 0.28, 0.07, "square", i * 0.18)),
};

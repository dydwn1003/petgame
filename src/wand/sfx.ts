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
  bolt: () => tone(1200, 300, 0.15, 0.08, "square"),
  fire: () => {
    tone(200, 80, 0.4, 0.1, "sawtooth");
    tone(400, 120, 0.3, 0.05, "square", 0.02);
  },
  frost: () => tone(2000, 900, 0.3, 0.05, "triangle"),
  shield: () => tone(500, 900, 0.2, 0.07, "triangle"),
  heal: () => [523, 659, 784].forEach((f, i) => tone(f, f, 0.18, 0.06, "triangle", i * 0.07)),
  hit: () => tone(180, 50, 0.15, 0.12, "square"),
  block: () => tone(900, 600, 0.1, 0.07, "triangle"),
  fizzle: () => tone(300, 120, 0.15, 0.05, "sawtooth"),
  charge: () => tone(150, 300, 0.4, 0.04, "sine"),
  interrupt: () => tone(1500, 200, 0.25, 0.08, "square"),
  win: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, f, 0.25, 0.08, "square", i * 0.12)),
  lose: () => [392, 330, 262].forEach((f, i) => tone(f, f * 0.95, 0.3, 0.08, "square", i * 0.2)),
  blip: () => tone(700, 700, 0.03, 0.02, "square"),
};

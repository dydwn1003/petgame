// WebAudio로 즉석에서 만드는 효과음 (파일 없음)

let ctx: AudioContext | null = null;

export function unlockAudio(): void {
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      ctx = null;
    }
  }
  if (ctx?.state === "suspended") void ctx.resume();
}

function tone(
  freq: number,
  endFreq: number,
  dur: number,
  vol: number,
  type: OscillatorType = "sine",
  delay = 0,
  pan = 0,
): void {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const panner = ctx.createStereoPanner();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFreq), t + dur);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  panner.pan.value = pan;
  osc.connect(gain).connect(panner).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

/** 음파: 높은 핑 + 점점 작아지는 메아리 */
export function playPing(): void {
  tone(1500, 700, 0.25, 0.22);
  tone(1500, 700, 0.25, 0.08, "sine", 0.22, -0.4);
  tone(1500, 700, 0.25, 0.04, "sine", 0.42, 0.4);
  tone(1500, 700, 0.25, 0.02, "sine", 0.6, -0.2);
}

/** 벽에 부딪힘 */
export function playBump(): void {
  tone(160, 70, 0.09, 0.18, "triangle");
}

/** 괴물이 깨어남. pan: -1(왼쪽) ~ 1(오른쪽) */
export function playGrowl(pan: number, vol: number): void {
  tone(90, 55, 0.7, 0.16 * vol, "sawtooth", 0, pan);
  tone(95, 60, 0.6, 0.1 * vol, "square", 0.05, pan);
}

export function playHeartbeat(vol: number): void {
  tone(70, 40, 0.12, 0.35 * vol);
  tone(65, 38, 0.14, 0.25 * vol, "sine", 0.18);
}

export function playWin(): void {
  [523, 659, 784, 1047].forEach((f, i) => tone(f, f, 0.3, 0.15, "triangle", i * 0.1));
}

export function playCaught(): void {
  tone(400, 50, 0.8, 0.25, "sawtooth");
  tone(300, 40, 0.9, 0.2, "square", 0.05);
}

export function playExitHum(pan: number): void {
  tone(660, 660, 0.5, 0.05, "triangle", 0, pan);
  tone(880, 880, 0.5, 0.03, "triangle", 0.05, pan);
}

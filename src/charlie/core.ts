// 공통 기반: 화면 · 입력 · 글자 · 연출 스크립트 · 효과음

export const W = 480;
export const H = 270;
export const FONT = "11px Galmuri11";
export const GROUND = 214; // 거리 장면의 발 위치

export const canvas = document.getElementById("screen") as HTMLCanvasElement;
export const g = canvas.getContext("2d")!;
g.imageSmoothingEnabled = false;

export const clock = { t: 0 };

// ── 입력 ─────────────────────────────────────────────────
export const keys = new Set<string>();
export const pressed = new Set<string>();
export const mouse = { x: 0, y: 0, clicked: false };

export function took(...codes: string[]): boolean {
  return codes.some((c) => pressed.has(c));
}
export const ADVANCE = ["Space", "Enter", "KeyE", "KeyZ", "click"];

export function axis(): number {
  let x = 0;
  if (keys.has("ArrowLeft") || keys.has("KeyA")) x -= 1;
  if (keys.has("ArrowRight") || keys.has("KeyD")) x += 1;
  return x;
}
export const running = () => keys.has("ShiftLeft") || keys.has("ShiftRight");
export const sneaking = () => keys.has("ArrowDown") || keys.has("KeyS") || keys.has("ControlLeft");

// ── 연출 스크립트 (await 로 순서대로) ─────────────────────
type Waiter = { done: () => boolean; resolve: () => void };
let waiters: Waiter[] = [];

export function until(done: () => boolean): Promise<void> {
  return new Promise((resolve) => waiters.push({ done, resolve }));
}
export function wait(sec: number): Promise<void> {
  const end = clock.t + sec;
  return until(() => clock.t >= end);
}
export function tickScripts(): void {
  const ready = waiters.filter((w) => w.done());
  waiters = waiters.filter((w) => !ready.includes(w));
  for (const w of ready) w.resolve();
}
/** 진행 중인 연출을 모두 버린다 (장면 재시작 시) */
export function dropScripts(): void {
  waiters = [];
}

// ── 화면 효과 ────────────────────────────────────────────
export const fx = {
  fade: 1, // 0 = 보임, 1 = 검정
  fadeTarget: 1,
  fadeSpeed: 1.5,
  shake: 0,
  flash: 0,
  flashColor: "#ffffff",
  card: null as null | { title: string; sub: string; t0: number; dur: number },
};
export function fadeTo(v: number, dur = 0.7): Promise<void> {
  fx.fadeTarget = v;
  fx.fadeSpeed = 1 / Math.max(0.01, dur);
  return until(() => fx.fade === v);
}
export function shake(power: number): void {
  fx.shake = Math.max(fx.shake, power);
}
export function flash(color: string, power = 1): void {
  fx.flash = power;
  fx.flashColor = color;
}
export async function chapterCard(title: string, sub: string, dur = 2.6): Promise<void> {
  fx.card = { title, sub, t0: clock.t, dur };
  await wait(dur);
  fx.card = null;
}
export function updateFx(dt: number): void {
  if (fx.fade < fx.fadeTarget) fx.fade = Math.min(fx.fadeTarget, fx.fade + fx.fadeSpeed * dt);
  else if (fx.fade > fx.fadeTarget) fx.fade = Math.max(fx.fadeTarget, fx.fade - fx.fadeSpeed * dt);
  fx.shake = Math.max(0, fx.shake - dt * 1.5);
  fx.flash = Math.max(0, fx.flash - dt * 2.5);
}

// ── 글자 ─────────────────────────────────────────────────
export function text(str: string, x: number, y: number, color = "#f4ecff", align: CanvasTextAlign = "left", outline = "#000"): void {
  g.font = FONT;
  g.textAlign = align;
  g.textBaseline = "middle";
  if (outline) {
    g.fillStyle = outline;
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) g.fillText(str, Math.round(x) + dx, Math.round(y) + dy);
  }
  g.fillStyle = color;
  g.fillText(str, Math.round(x), Math.round(y));
}

export function wrap(str: string, maxW: number): string[] {
  g.font = FONT;
  const out: string[] = [];
  for (const para of str.split("\n")) {
    let line = "";
    for (const word of para.split(" ")) {
      const next = line ? `${line} ${word}` : word;
      if (g.measureText(next).width > maxW && line) {
        out.push(line);
        line = word;
      } else line = next;
    }
    out.push(line);
  }
  return out;
}

/** 스토리보드처럼 검은 말풍선. (x, y) = 꼬리 끝 */
export function bubble(str: string, x: number, y: number): void {
  const lines = wrap(str, 170);
  g.font = FONT;
  const w = Math.max(...lines.map((l) => g.measureText(l).width)) + 14;
  const h = lines.length * 14 + 8;
  let bx = Math.round(x - w / 2);
  bx = Math.max(4, Math.min(W - w - 4, bx));
  const by = Math.round(y - h - 6);
  g.fillStyle = "#0b0a0c";
  g.fillRect(bx, by, w, h);
  g.fillStyle = "#e8e2d6";
  g.fillRect(bx, by, w, 1);
  g.fillRect(bx, by + h - 1, w, 1);
  g.fillRect(bx, by, 1, h);
  g.fillRect(bx + w - 1, by, 1, h);
  g.fillStyle = "#0b0a0c";
  const tx = Math.max(bx + 6, Math.min(bx + w - 8, Math.round(x)));
  g.fillRect(tx - 3, by + h - 1, 6, 2);
  g.fillRect(tx - 2, by + h + 1, 4, 2);
  g.fillRect(tx - 1, by + h + 3, 2, 2);
  lines.forEach((l, i) => text(l, bx + 7, by + 11 + i * 14, "#f4ecff", "left", ""));
}

// ── 효과음 (즉석 합성) ───────────────────────────────────
let actx: AudioContext | null = null;
let noiseBuf: AudioBuffer | null = null;
export function unlockAudio(): void {
  if (!actx) {
    try {
      actx = new AudioContext();
      noiseBuf = actx.createBuffer(1, actx.sampleRate, actx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    } catch {
      return;
    }
  }
  if (actx.state === "suspended") void actx.resume();
}
function tone(f: number, f2: number, dur: number, vol: number, type: OscillatorType = "sine", delay = 0): void {
  if (!actx) return;
  const t = actx.currentTime + delay;
  const o = actx.createOscillator();
  const gn = actx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
  gn.gain.setValueAtTime(0.0001, t);
  gn.gain.exponentialRampToValueAtTime(vol, t + 0.02);
  gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(gn).connect(actx.destination);
  o.start(t);
  o.stop(t + dur + 0.05);
}
function noise(dur: number, vol: number, freq: number, delay = 0): void {
  if (!actx || !noiseBuf) return;
  const t = actx.currentTime + delay;
  const s = actx.createBufferSource();
  s.buffer = noiseBuf;
  const f = actx.createBiquadFilter();
  f.type = "lowpass";
  f.frequency.setValueAtTime(freq, t);
  f.frequency.exponentialRampToValueAtTime(60, t + dur);
  const gn = actx.createGain();
  gn.gain.setValueAtTime(vol, t);
  gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f).connect(gn).connect(actx.destination);
  s.start(t);
  s.stop(t + dur);
}
export const sfx = {
  step: () => noise(0.05, 0.05, 900),
  blip: () => tone(520, 520, 0.03, 0.02, "square"),
  meow: () => {
    tone(700, 1100, 0.18, 0.06, "triangle");
    tone(1100, 600, 0.25, 0.05, "triangle", 0.17);
  },
  purr: () => noise(0.6, 0.04, 200),
  boom: () => {
    noise(1.8, 0.6, 1200);
    tone(80, 30, 1.5, 0.4, "sine");
  },
  glass: () => {
    for (let i = 0; i < 6; i++) tone(2000 + Math.random() * 2000, 1500, 0.15, 0.03, "triangle", i * 0.04);
  },
  can: () => {
    tone(1800, 900, 0.08, 0.04, "square");
    noise(0.2, 0.05, 3000, 0.05);
  },
  fridge: () => tone(90, 90, 0.8, 0.04, "sawtooth"),
  groan: () => tone(110, 70, 0.9, 0.08, "sawtooth"),
  chant: () => [220, 247, 220].forEach((f, i) => tone(f, f, 0.25, 0.04, "square", i * 0.28)),
  croak: () => {
    tone(160, 120, 0.12, 0.1, "square");
    tone(170, 110, 0.12, 0.1, "square", 0.16);
  },
  item: () => [660, 880, 1100].forEach((f, i) => tone(f, f, 0.12, 0.04, "triangle", i * 0.07)),
  dead: () => [330, 262, 196, 131].forEach((f, i) => tone(f, f * 0.97, 0.4, 0.07, "triangle", i * 0.3)),
  heart: () => {
    tone(60, 40, 0.15, 0.3);
    tone(55, 38, 0.15, 0.22, "sine", 0.2);
  },
};

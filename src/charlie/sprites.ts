// 캐릭터 도트 (초고밀도): 찰리 · 샘 · 좀비 · 해골 · 개구리 인간 · 생존자 · 방호복 요원
//
// 화면 좌표 1칸 = 스프라이트 4도트. 캐릭터는 화면에서 32×54 크기로 그려지지만
// 실제로는 128×216 도트로 칠해져서, 작은 도트를 촘촘하게 찍은 부드러운 그림이 된다.
// 팔다리는 관절(엉덩이·무릎·어깨·팔꿈치) 각도로 움직이고, 몸 높이는
// 땅에 닿은 발에 맞춰 저절로 정해진다.
import { bakeVec, cached, ellipse, flip, makeCanvas, mix, type Px } from "./pixel";

export const HUMAN_W = 32; // 화면 기준 크기
export const HUMAN_H = 54;
const SW = 128; // 실제 도트 크기
const SH = 216;
const CX = 60;
const FEET = 208;
const OUTLINE = "#140d0b";

export type Pose = string;

/** 캐릭터 도트 밀도 (화면 1칸당 도트 수). 기본 6, 고해상도 화면에서는 8까지 */
let density = 6;
export function setSpriteDensity(d: number): void {
  density = Math.max(4, Math.min(8, Math.round(d)));
}
export function spriteDensity(): number {
  return density;
}

export interface Build {
  legLen: number;
  torsoLen: number;
}
export const BUILD_3: Build = { legLen: 60, torsoLen: 46 };
export const BUILD_25: Build = { legLen: 42, torsoLen: 38 };
export const BUILD_KID: Build = { legLen: 34, torsoLen: 30 };

export interface Look {
  skin: string;
  skinShade: string;
  skinLight: string;
  hair: string;
  hairShade: string;
  hairLight: string;
  hairStyle: "pomp" | "messy" | "skull" | "frog" | "hood" | "bun" | "pony" | "beanie" | "mask" | "comb";
  /** 몸통 무늬 (lx, ly = 몸통 안 좌표, 도트 단위) */
  shirt: (lx: number, ly: number, w: number, h: number) => string;
  sleeve: string;
  sleeveShade: string;
  sleeveStripe?: string;
  cuff?: string;
  collar?: string;
  pants: string;
  pantsShade: string;
  shoes: string;
  belt?: string;
  buckle?: string;
  glasses?: boolean;
  eye: string;
  mouth: string;
  brow?: string;
  hunch?: number;
  limb?: number;
  armsForward?: boolean;
  crown?: boolean;
  /** 콧수염 색 */
  mustache?: string;
}

// ── 그리기 도구 ──────────────────────────────────────────
function disk(p: Px, cx: number, cy: number, r: number, c: string): void {
  ellipse(p, cx, cy, r, r, c);
}
function capsule(p: Px, x0: number, y0: number, x1: number, y1: number, r: number, c: string): void {
  if (p.ctx) {
    const g = p.ctx;
    g.strokeStyle = c;
    g.fillStyle = c;
    g.lineCap = "round";
    g.lineWidth = Math.max(0.6, r * 2 + 0.8);
    g.beginPath();
    g.moveTo(x0 + 0.5, y0 + 0.5);
    g.lineTo(x1 + 0.5 + 0.001, y1 + 0.5);
    g.stroke();
    return;
  }
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 1.2));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    disk(p, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r, c);
  }
}
/** 원통형 팔다리: 그림자 → 바탕 → 중간빛 → 하이라이트 (4단 명암) */
function limb(p: Px, ax: number, ay: number, bx: number, by: number, r: number, base: string, stripe?: string): void {
  capsule(p, ax + 1.4, ay + 0.8, bx + 1.4, by + 0.8, r, mix(base, -0.32));
  capsule(p, ax + 0.4, ay + 0.2, bx + 0.4, by + 0.2, r - 1, mix(base, -0.12));
  capsule(p, ax - 0.4, ay, bx - 0.4, by, r - 2, base);
  if (stripe) {
    for (const t of [0.28, 0.66]) {
      const sx = ax + (bx - ax) * t;
      const sy = ay + (by - ay) * t;
      capsule(p, sx, sy, sx + (bx - ax) * 0.07, sy + (by - ay) * 0.07, r - 1.2, stripe);
    }
  }
  capsule(p, ax - r * 0.35, ay - 0.4, bx - r * 0.35, by - 0.4, Math.max(0.8, r * 0.32), mix(base, 0.12));
  capsule(p, ax - r * 0.5, ay - 0.6, bx - r * 0.5, by - 0.6, Math.max(0.5, r * 0.14), mix(base, 0.3));
}

function bend(x: number, y: number, len: number, ang: number): [number, number] {
  return [x + Math.sin(ang) * len, y + Math.cos(ang) * len];
}

/** 부드러운 곡선 위에 도트를 찍는다 (머리결, 주름) */
function curve(p: Px, x0: number, y0: number, cx: number, cy: number, x1: number, y1: number, col: string, w = 1): void {
  if (p.ctx) {
    const g = p.ctx;
    g.strokeStyle = col;
    g.lineCap = "round";
    g.lineWidth = w * 0.9;
    g.beginPath();
    g.moveTo(x0 + 0.5, y0 + 0.5);
    g.quadraticCurveTo(cx + 0.5, cy + 0.5, x1 + 0.5, y1 + 0.5);
    g.stroke();
    return;
  }
  for (let t = 0; t <= 1; t += 0.02) {
    const a = (1 - t) * (1 - t);
    const b = 2 * (1 - t) * t;
    const c = t * t;
    p(a * x0 + b * cx + c * x1, a * y0 + b * cy + c * y1, w, w, col);
  }
}

// ── 동작 (관절 각도) ─────────────────────────────────────
interface Rig {
  legs: [[number, number], [number, number]]; // [앞, 뒤] × [엉덩이 각, 무릎 굽힘]
  arms: [[number, number], [number, number]]; // [앞, 뒤] × [어깨 각, 팔꿈치 굽힘]
  lean: number;
  breath: number;
  sit: boolean;
  head: number;
}

function rig(pose: string, L: Look): Rig {
  const r: Rig = { legs: [[0.05, 0.03], [-0.05, 0.03]], arms: [[0.08, 0.18], [-0.06, 0.15]], lean: 0, breath: 0, sit: false, head: 0 };
  if (pose.startsWith("walk")) {
    const ph = (Number(pose.slice(4)) / 16) * Math.PI * 2;
    const leg = (q: number): [number, number] => {
      const v = Math.cos(q);
      return [Math.sin(q) * 0.5, v > 0 ? v * 1.0 + 0.05 : 0.05];
    };
    r.legs = [leg(ph), leg(ph + Math.PI)];
    r.arms = [[-Math.sin(ph) * 0.55, 0.3 + Math.max(0, -Math.sin(ph)) * 0.45], [Math.sin(ph) * 0.55, 0.3 + Math.max(0, Math.sin(ph)) * 0.45]];
    r.lean = 2;
  } else if (pose.startsWith("stair")) {
    // 옆에서 본 계단 오르기: 무릎을 높이 들고 몸을 앞으로 기울인다
    const ph = (Number(pose.slice(5)) / 8) * Math.PI * 2;
    const leg = (q: number): [number, number] => {
      const v = Math.cos(q);
      return [Math.sin(q) * 0.42 + 0.3, v > 0 ? v * 1.7 + 0.15 : 0.2];
    };
    r.legs = [leg(ph), leg(ph + Math.PI)];
    r.arms = [[-Math.sin(ph) * 0.5 + 0.1, 0.5], [Math.sin(ph) * 0.5 + 0.1, 0.5]];
    r.lean = 6;
    r.head = 2;
  } else if (pose.startsWith("crouch")) {
    const ph = (Number(pose.slice(6)) / 8) * Math.PI * 2;
    const leg = (q: number): [number, number] => [0.75 + Math.sin(q) * 0.3, 1.45 + Math.max(0, Math.cos(q)) * 0.35];
    r.legs = [leg(ph), leg(ph + Math.PI)];
    r.arms = [[0.65 + Math.sin(ph) * 0.1, 1.2], [0.5 - Math.sin(ph) * 0.1, 1.1]];
    r.lean = 10;
    r.head = 4;
  } else if (pose.startsWith("stand")) {
    const k = Number(pose.slice(5) || 0);
    r.breath = [0, 1, 2, 1][k % 4];
  } else if (pose === "sit" || pose === "drink" || pose === "sleep") {
    r.sit = true;
    r.legs = [[Math.PI / 2, Math.PI / 2], [Math.PI / 2 - 0.1, Math.PI / 2 - 0.05]];
    r.arms = [[0.55, 1.1], [0.45, 1.0]];
    if (pose === "drink") r.arms[0] = [0.35, 2.7];
    if (pose === "sleep") {
      r.arms = [[0.2, 0.3], [0.15, 0.25]];
      r.head = 6;
    }
  } else if (pose === "armsUp") {
    r.legs = [[0.18, 0.05], [-0.16, 0.05]];
    r.arms = [[Math.PI - 0.35, 0.3], [Math.PI - 0.6, 0.4]];
  } else if (pose === "flashlight") {
    r.arms = [[Math.PI / 2 - 0.05, 0.05], [0.1, 0.4]];
  }
  if (L.armsForward && !r.sit) {
    r.arms = [[Math.PI / 2 - 0.15, 0.1], [Math.PI / 2 - 0.05, 0.15]];
    r.lean += 2;
  }
  return r;
}

// ── 머리카락 ────────────────────────────────────────────
function paintHair(p: Px, L: Look, hx: number, ft: number): void {
  const H = L.hair;
  const S = L.hairShade;
  const Li = L.hairLight;
  const D = mix(S, -0.32);
  const X = mix(Li, 0.55);
  if (L.hairStyle === "pomp") {
    // 뒷머리와 옆머리
    ellipse(p, hx - 6, ft + 3, 20, 14, S);
    p(hx - 21, ft, 8, 21, S);
    p(hx - 21, ft + 6, 3, 15, D);
    p(hx - 15, ft + 18, 4, 7, S);
    p(hx - 14, ft + 18, 1, 7, D);
    // 정수리 (넓고 둥글게)
    ellipse(p, hx, ft - 5, 22, 10, H);
    ellipse(p, hx - 8, ft - 3, 12, 6, mix(H, -0.06));
    // 앞으로 넘긴 물결 앞머리 (2번 시안)
    ellipse(p, hx + 6, ft - 11, 19, 8, H);
    ellipse(p, hx + 10, ft - 13, 14, 5.5, mix(H, 0.1));
    ellipse(p, hx + 13, ft - 14, 10, 3.6, Li);
    ellipse(p, hx + 17, ft - 15, 5, 1.8, X);
    // 이마로 살짝 내려온 앞머리 (물결 끝)
    for (let x = hx - 12; x <= hx + 21; x++) {
      const drop = 2 + Math.round(Math.sin((x - hx) * 0.45) * 1.6 + (x > hx + 8 ? 2 : 0));
      p(x, ft - 2, 1, Math.max(2, drop + 2), x > hx + 10 ? H : S);
    }
    // 머리결: 뒤에서 앞으로 흐르는 곡선들
    for (let k = 0; k < 11; k++) {
      const col = k % 3 === 0 ? D : k % 3 === 1 ? Li : S;
      const sx = hx - 18 + k * 1.6;
      const sy = ft - 1 - k * 0.5;
      curve(p, sx, sy, hx + 2 + k * 0.5, ft - 20 - k * 0.6, hx + 22 - k * 0.6, ft - 6 - k * 1.1, col);
    }
    // 반짝임
    curve(p, hx + 2, ft - 16, hx + 10, ft - 21, hx + 19, ft - 15, X);
    p(hx - 8, ft - 12, 4, 1, X);
    p(hx - 18, ft - 4, 6, 1, D);
    // 위쪽 물결 윤곽
    for (const [wx, wy] of [[hx - 12, ft - 14], [hx - 3, ft - 17], [hx + 7, ft - 20], [hx + 17, ft - 18]]) {
      p(wx, wy, 5, 1, H);
      p(wx + 1, wy - 1, 3, 1, Li);
    }
  } else if (L.hairStyle === "messy") {
    ellipse(p, hx - 2, ft - 3, 20, 12, H);
    p(hx - 21, ft - 2, 8, 22, H);
    for (let i = 0; i < 16; i++) {
      const x = hx - 19 + i * 2.6;
      const tip = ft - 16 + ((i * 5) % 7);
      curve(p, x, ft - 2, x + 1, tip + 4, x + 3 * ((i % 2) * 2 - 1), tip, i % 2 ? H : S, 2);
      p(x + 1, ft - 1, 1, 3 + (i % 3) * 2, S);
    }
    p(hx - 8, ft - 9, 12, 1, D);
  } else if (L.hairStyle === "bun") {
    // 단정히 묶은 회색 머리 + 뒤통수 똥머리
    ellipse(p, hx - 3, ft - 1, 19, 11, H);
    p(hx - 20, ft - 1, 7, 18, H);
    p(hx - 20, ft + 4, 2, 13, S);
    ellipse(p, hx - 18, ft - 8, 7.5, 7, S);
    ellipse(p, hx - 18.5, ft - 8.5, 6, 5.6, H);
    curve(p, hx - 23, ft - 9, hx - 18, ft - 14, hx - 13, ft - 9, Li);
    for (let k = 0; k < 7; k++) curve(p, hx - 14 + k * 4, ft - 1, hx - 8 + k * 3, ft - 10, hx + 2 + k * 2.4, ft - 9 + k * 0.3, k % 2 ? Li : S);
    curve(p, hx - 4, ft - 9, hx + 6, ft - 11, hx + 15, ft - 5, X);
  } else if (L.hairStyle === "pony") {
    // 앞머리 + 뒤로 흔들리는 포니테일
    ellipse(p, hx - 2, ft - 2, 20, 12, H);
    p(hx - 21, ft - 1, 7, 20, H);
    curve(p, hx - 18, ft - 6, hx - 30, ft + 2, hx - 26, ft + 22, H, 5);
    curve(p, hx - 19, ft - 4, hx - 29, ft + 4, hx - 25, ft + 20, S, 2);
    p(hx - 21, ft - 7, 5, 5, "#e8506a");
    p(hx - 21, ft - 7, 5, 1, "#ff8aa0");
    for (let x = hx - 10; x <= hx + 18; x++) {
      const drop = 3 + Math.round(Math.abs(Math.sin((x - hx) * 0.5)) * 3);
      p(x, ft - 2, 1, drop, x % 4 === 0 ? S : H);
    }
    curve(p, hx - 6, ft - 10, hx + 4, ft - 13, hx + 14, ft - 8, Li);
    p(hx - 2, ft - 11, 5, 1, X);
  } else if (L.hairStyle === "comb") {
    // 옆머리만 남고, 정수리는 몇 가닥을 빗어 넘긴 머리
    p(hx - 20, ft + 4, 8, 14, H);
    p(hx - 20, ft + 8, 2, 10, S);
    ellipse(p, hx - 14, ft + 4, 6, 7, H);
    for (let k = 0; k < 5; k++) curve(p, hx - 16, ft + 2 - k * 1.2, hx - 2, ft - 8 - k * 0.6, hx + 12, ft - 4 + k * 0.4, k % 2 ? Li : H, 1);
    ellipse(p, hx + 2, ft - 4, 6, 2, "rgba(255,255,255,0.35)");
  } else if (L.hairStyle === "beanie") {
    // 짧은 옆머리 + 털모자
    p(hx - 19, ft + 2, 7, 14, H);
    p(hx - 19, ft + 6, 2, 10, S);
    ellipse(p, hx - 1, ft - 4, 22, 13, S);
    ellipse(p, hx - 1, ft - 5, 21, 12, "#a83a32");
    ellipse(p, hx - 6, ft - 9, 11, 5, "#c8544a");
    for (let x = hx - 20; x < hx + 20; x += 3) p(x, ft - 14 + Math.abs(x - hx) * 0.22, 1, 12 - Math.abs(x - hx) * 0.22, "#8a2a24");
    p(hx - 22, ft + 1, 43, 6, "#8a2a24");
    p(hx - 22, ft + 1, 43, 1, "#c8544a");
    for (let x = hx - 21; x < hx + 20; x += 2) p(x, ft + 3, 1, 3, "#6a1e1a");
  } else if (L.hairStyle === "hood") {
    ellipse(p, hx - 2, ft + 6, 25, 25, H);
    ellipse(p, hx + 4, ft + 12, 17, 20, mix(H, -0.5));
    p(hx - 25, ft + 8, 6, 26, S);
    for (let y = ft - 12; y < ft + 28; y += 5) curve(p, hx - 22, y, hx - 12, y - 4, hx - 2, y - 1, mix(H, 0.15));
    curve(p, hx - 18, ft + 30, hx - 6, ft + 34, hx + 4, ft + 30, mix(H, -0.25), 2);
  }
}

// ── 머리 ────────────────────────────────────────────────
function paintHead(p: Px, L: Look, hx: number, ft: number, mode: { closed?: boolean; back?: boolean; shock?: boolean }): void {
  if (L.hairStyle === "skull") {
    const b = L.skin;
    const s = L.skinShade;
    ellipse(p, hx, ft + 10, 20, 20, s);
    ellipse(p, hx + 1, ft + 9, 18.5, 18.5, b);
    ellipse(p, hx - 6, ft + 3, 11, 10, L.skinLight);
    p(hx - 10, ft + 28, 28, 12, b);
    ellipse(p, hx + 4, ft + 33, 13, 8, b);
    // 눈구멍
    for (const [ex, ey] of [[hx - 4, ft + 18], [hx + 10, ft + 18]]) {
      ellipse(p, ex, ey, 6, 6, "#2a2420");
      ellipse(p, ex + 1, ey + 1, 4, 4, "#120e0c");
      p(ex, ey, 2, 2, "#7a2a2a");
    }
    // 코 구멍
    p(hx + 4, ft + 26, 4, 5, "#1a1614");
    p(hx + 3, ft + 28, 1, 3, "#1a1614");
    // 이빨
    for (let i = 0; i < 9; i++) {
      p(hx - 6 + i * 2.6, ft + 34, 2, 6, b);
      p(hx - 6 + i * 2.6, ft + 34, 2, 1, L.skinLight);
      p(hx - 4 + i * 2.6, ft + 34, 1, 6, "#3a332c");
    }
    p(hx - 10, ft + 40, 26, 2, s);
    // 금
    curve(p, hx - 10, ft - 2, hx - 4, ft + 4, hx - 8, ft + 10, s);
    p(hx + 14, ft + 22, 4, 6, s);
    return;
  }
  if (L.hairStyle === "mask") {
    // 방호복 두건 + 투명 얼굴창 + 방독면 정화통
    const suit = L.hair;
    ellipse(p, hx - 1, ft + 18, 23, 26, L.hairShade);
    ellipse(p, hx, ft + 17, 21.5, 24.5, suit);
    ellipse(p, hx - 8, ft + 6, 10, 9, L.hairLight);
    for (let k = 0; k < 4; k++) curve(p, hx - 18, ft + 4 + k * 9, hx - 12, ft + 8 + k * 9, hx - 6, ft + 4 + k * 9, L.hairShade);
    // 얼굴창
    ellipse(p, hx + 8, ft + 17, 13, 11, "#1a2228");
    ellipse(p, hx + 8, ft + 17, 11.5, 9.5, "#2c3e48");
    ellipse(p, hx + 6, ft + 15, 7, 5, "#3e5662");
    p(hx + 3, ft + 15, 3, 2, "#1a1a1a");
    p(hx + 11, ft + 15, 3, 2, "#1a1a1a");
    p(hx + 13, ft + 9, 2, 6, "rgba(255,255,255,0.75)");
    p(hx + 15, ft + 11, 1, 3, "rgba(255,255,255,0.5)");
    // 정화통
    ellipse(p, hx + 12, ft + 33, 7, 6, "#24262c");
    ellipse(p, hx + 12, ft + 33, 5, 4.4, "#3a3e46");
    for (let i = -3; i <= 3; i += 2) p(hx + 12 + i, ft + 31, 1, 4, "#1a1c20");
    ellipse(p, hx - 2, ft + 34, 5, 4, "#2e3036");
    return;
  }
  if (L.hairStyle === "frog") {
    const gr = L.skin;
    ellipse(p, hx + 3, ft + 19, 27, 20, L.skinShade);
    ellipse(p, hx + 2, ft + 18, 25.5, 18.5, gr);
    ellipse(p, hx - 6, ft + 10, 16, 9, L.skinLight);
    ellipse(p, hx + 4, ft + 31, 20, 7, "#c8e09a");
    ellipse(p, hx + 2, ft + 29, 14, 3, "#dcecb4");
    // 입
    curve(p, hx - 16, ft + 23, hx + 4, ft + 28, hx + 26, ft + 20, "#1e2a14", 2);
    curve(p, hx - 14, ft + 25, hx + 4, ft + 30, hx + 24, ft + 22, mix(gr, 0.2));
    // 눈 (툭 튀어나온)
    for (const ex of [hx - 8, hx + 12]) {
      disk(p, ex + 1, ft - 1, 9, L.skinShade);
      disk(p, ex, ft - 2, 8.5, gr);
      disk(p, ex, ft - 2, 6.5, "#f4f0d8");
      p(ex - 5, ft - 3, 11, 3, "#0e0e0e");
      p(ex - 3, ft - 4, 7, 1, "#0e0e0e");
      p(ex - 4, ft - 6, 2, 2, "#ffffff");
      p(ex + 3, ft, 1, 1, "#ffffff");
      curve(p, ex - 8, ft - 6, ex, ft - 13, ex + 8, ft - 6, L.skinShade, 2);
    }
    // 콧구멍 + 점무늬
    p(hx + 20, ft + 14, 2, 1, L.skinShade);
    p(hx + 24, ft + 14, 2, 1, L.skinShade);
    for (const [sx, sy, sr] of [[hx - 12, ft + 18, 2.5], [hx + 6, ft + 8, 2], [hx - 2, ft + 22, 1.6], [hx + 14, ft + 14, 1.4]]) ellipse(p, sx, sy, sr, sr, L.skinShade);
    if (L.crown) {
      p(hx - 10, ft - 18, 28, 6, "#d8a82a");
      p(hx - 10, ft - 18, 28, 2, "#f8e070");
      for (let i = 0; i < 5; i++) {
        p(hx - 10 + i * 6.5, ft - 25, 3, 7, "#e8c83a");
        p(hx - 10 + i * 6.5, ft - 25, 1, 7, "#fff0a0");
        disk(p, hx - 9 + i * 6.5, ft - 26, 1.5, "#fff0a0");
      }
      disk(p, hx + 4, ft - 15, 2, "#c83a5a");
      p(hx + 3, ft - 16, 1, 1, "#ff8aa8");
    }
    return;
  }
  // 얼굴 (3/4 오른쪽): 그림자 테두리 → 피부 → 볼 빛
  ellipse(p, hx, ft + 19, 18, 20, L.skinShade);
  ellipse(p, hx + 6, ft + 33, 12, 7, L.skinShade);
  ellipse(p, hx + 2, ft + 19, 16.5, 19, L.skin);
  ellipse(p, hx + 7, ft + 32, 10.5, 6, L.skin);
  ellipse(p, hx - 12, ft + 26, 4, 9, L.skinShade);
  ellipse(p, hx + 9, ft + 22, 6, 5, L.skinLight);
  ellipse(p, hx + 10, ft + 21, 3, 2.5, mix(L.skinLight, 0.25));
  // 앞머리 그림자
  p(hx - 12, ft + 2, 30, 2, mix(L.skin, -0.1));
  // 턱선 그림자
  curve(p, hx - 8, ft + 34, hx + 2, ft + 40, hx + 14, ft + 37, mix(L.skinShade, -0.12));
  // 귀
  ellipse(p, hx - 16, ft + 21, 3.5, 5.5, L.skinShade);
  ellipse(p, hx - 15.5, ft + 20.5, 2.6, 4.6, L.skin);
  curve(p, hx - 16, ft + 17, hx - 14, ft + 21, hx - 16, ft + 24, L.skinShade);
  if (mode.back) {
    ellipse(p, hx - 2, ft + 12, 21, 22, L.hair);
    ellipse(p, hx - 2, ft + 26, 18, 8, L.hairShade);
    for (let k = 0; k < 9; k++) curve(p, hx - 16 + k * 3.6, ft - 4, hx - 14 + k * 3.6, ft + 12, hx - 15 + k * 3.6, ft + 28, k % 2 ? L.hairLight : L.hairShade);
    paintHair(p, L, hx, ft);
    return;
  }
  // 코
  ellipse(p, hx + 18, ft + 22, 2.6, 4.5, L.skin);
  p(hx + 19, ft + 18, 1, 4, L.skinLight);
  p(hx + 14, ft + 26, 7, 1, L.skinShade);
  p(hx + 17, ft + 25, 2, 1, mix(L.skinShade, -0.15));
  // 볼 홍조
  ellipse(p, hx + 11, ft + 27, 3.5, 1.6, "#f0a28e");
  // 눈
  const ey = ft + 18;
  const eye = (ex: number, w: number, h: number, far: boolean) => {
    if (mode.closed) {
      curve(p, ex - 1, ey + 2, ex + w / 2, ey + 4, ex + w + 1, ey + 2, mix(L.skinShade, -0.35), 1);
      return;
    }
    const g = p.ctx;
    if (!g || mode.shock) {
      ellipse(p, ex + w / 2, ey + h / 2, w / 2 + 0.5, h / 2 + 0.5, "#f8f4ec");
      p(ex + w / 2 - 0.5, ey + h / 2 - 0.5, 2, 2, "#0c0a08");
      return;
    }
    // 옆을 보는 눈: 뒤쪽은 둥글고 앞(코 방향)이 뾰족한 눈매, 홍채는 앞쪽에
    const cy = ey + h / 2;
    const shape = new Path2D();
    shape.moveTo(ex, cy);
    shape.bezierCurveTo(ex, cy - h * 0.62, ex + w * 0.62, cy - h * 0.64, ex + w + 0.8, cy - h * 0.08);
    shape.bezierCurveTo(ex + w * 0.62, cy + h * 0.6, ex, cy + h * 0.56, ex, cy);
    g.fillStyle = "#f8f4ec";
    g.fill(shape);
    g.save();
    g.clip(shape);
    g.fillStyle = L.eye;
    g.beginPath();
    g.ellipse(ex + w * 0.74, cy + 0.2, w * 0.34, h * 0.52, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = mix(L.eye, -0.35);
    g.fillRect(ex + w * 0.4, cy + h * 0.15, w, h);
    g.fillStyle = "#0c0a08";
    g.beginPath();
    g.ellipse(ex + w * 0.82, cy + 0.3, w * 0.15, h * 0.3, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "rgba(60,30,20,0.22)";
    g.fillRect(ex - 1, cy - h, w + 2, h * 0.62);
    g.restore();
    g.fillStyle = "#ffffff";
    g.beginPath();
    g.ellipse(ex + w * 0.68, cy - h * 0.16, far ? 0.6 : 0.85, far ? 0.6 : 0.85, 0, 0, Math.PI * 2);
    g.fill();
    // 윗눈꺼풀 + 바깥쪽 속눈썹
    const lid = mix(L.skinShade, -0.45);
    g.strokeStyle = lid;
    g.lineCap = "round";
    g.lineWidth = far ? 1.1 : 1.4;
    g.beginPath();
    g.moveTo(ex - 0.4, cy - 0.3);
    g.bezierCurveTo(ex, cy - h * 0.62, ex + w * 0.62, cy - h * 0.66, ex + w + 0.8, cy - h * 0.08);
    g.stroke();
    g.lineWidth = 0.9;
    g.beginPath();
    g.moveTo(ex, cy - h * 0.3);
    g.lineTo(ex - 1.6, cy - h * 0.55);
    g.stroke();
    p(ex + 1, ey + h, w - 1, 1, mix(L.skin, -0.06));
  };
  eye(hx - 7, 4.6, 6, true);
  eye(hx + 5, 8, 7, false);
  // 눈썹
  const brow = L.brow ?? L.hairShade;
  const lift = mode.shock ? 3 : 0;
  curve(p, hx - 11, ey - 5 - lift, hx - 7, ey - 7 - lift, hx - 2, ey - 6 - lift, brow, 2);
  curve(p, hx + 3, ey - 6 - lift, hx + 9, ey - 9 - lift, hx + 16, ey - 6 - lift, brow, 2);
  if (L.glasses) {
    const fr = "#6a3a1a";
    const frL = "#a8682e";
    const lens = (x0: number, w: number) => {
      g2(p, x0, ey - 4, w, 13, "rgba(200,230,236,0.28)");
      p(x0, ey - 4, w, 2, fr);
      p(x0, ey + 8, w, 2, fr);
      p(x0, ey - 4, 2, 14, fr);
      p(x0 + w - 2, ey - 4, 2, 14, fr);
      p(x0 + 1, ey - 4, w - 2, 1, frL);
      // 반사
      p(x0 + w - 5, ey - 1, 1, 3, "rgba(255,255,255,0.8)");
      p(x0 + w - 4, ey - 2, 1, 2, "rgba(255,255,255,0.6)");
      p(x0 + 3, ey + 5, 2, 1, "rgba(255,255,255,0.35)");
    };
    lens(hx - 12, 13);
    lens(hx + 3, 16);
    p(hx + 1, ey - 1, 2, 2, fr);
    p(hx - 18, ey - 2, 6, 2, fr);
  }
  // 입
  if (mode.shock) {
    ellipse(p, hx + 9, ft + 33, 4, 4, "#4a1e1a");
    p(hx + 6, ft + 30, 6, 1, "#f4f0e8");
    ellipse(p, hx + 9, ft + 35, 2.5, 1.5, "#c84a4a");
  } else {
    if (L.mustache) {
      ellipse(p, hx + 9, ft + 29, 5.5, 1.7, L.mustache);
      p(hx + 5, ft + 28, 6, 1, mix(L.mustache, 0.3));
    }
    curve(p, hx + 3, ft + 31, hx + 8, ft + 33, hx + 13, ft + 30, L.mouth, 1);
    p(hx + 3, ft + 31, 1, 1, mix(L.mouth, -0.3));
    curve(p, hx + 5, ft + 34, hx + 8, ft + 35, hx + 11, ft + 34, mix(L.skin, 0.15));
  }
  paintHair(p, L, hx, ft);
}

/** 반투명 사각형 (렌즈 색) */
function g2(p: Px, x: number, y: number, w: number, h: number, c: string): void {
  p(x, y, w, h, c);
}

// ── 사람 전체 ────────────────────────────────────────────
/** 뒤에서 본 계단 오르기 (현관 계단, 지하철 입구) */
function paintClimbBack(p: Px, L: Look, n: number, B: Build): void {
  const ph = (n / 8) * Math.PI * 2;
  const k = L.limb ?? 1;
  const footH = 8;
  const legLen = B.legLen - 8;
  const lift = [Math.max(0, Math.sin(ph)), Math.max(0, -Math.sin(ph))];
  const bob = Math.abs(Math.sin(ph)) * 3;
  const hipY = FEET - footH - 4 - legLen + bob;
  const hipX = CX;
  const torsoTop = hipY - B.torsoLen;
  // 다리 (들어 올린 쪽은 무릎이 앞으로 접혀 짧아 보이고 발이 위 계단에 놓인다)
  [-1, 1].forEach((side, i) => {
    const l = lift[i];
    const x = hipX + side * 8;
    const kneeY = hipY + 4 + legLen * 0.5 * (1 - l * 0.45);
    const footY = FEET - footH - l * 16;
    const base = side < 0 ? L.pantsShade : L.pants;
    limb(p, x, hipY + 4, x + side * 1, kneeY, 8.6 * k, base);
    limb(p, x + side * 1, kneeY, x, footY, 7.4 * k, base);
    ellipse(p, x, footY + 4, 7, 4, mix(L.shoes, -0.25));
    ellipse(p, x, footY + 3, 6, 3, L.shoes);
    p(x - 4, footY + 2, 8, 1, mix(L.shoes, 0.3));
  });
  ellipse(p, hipX, hipY + 6, 18, 8, L.pants);
  // 몸통 (뒷면)
  const th = hipY - torsoTop;
  for (let ly = 0; ly < th; ly++) {
    const round = ly < 5 ? Math.round((5 - ly) * 1.4) : 0;
    const w = 40 - round * 2;
    const x0 = hipX - Math.floor(w / 2);
    for (let lx = 0; lx < w; lx++) p(x0 + lx, torsoTop + ly, 1, 1, mix(L.shirt(lx, ly, w, th), 0.08 - (lx / w) * 0.25));
  }
  curve(p, hipX - 4, torsoTop + 10, hipX, torsoTop + th * 0.5, hipX - 2, hipY - 2, "rgba(0,0,0,0.18)");
  if (L.collar) p(hipX - 12, torsoTop, 24, 4, L.collar);
  if (L.belt) {
    p(hipX - 20, hipY - 3, 40, 6, L.belt);
    p(hipX - 20, hipY - 3, 40, 1, mix(L.belt, 0.25));
  }
  // 팔 (양옆에서 번갈아 흔들림)
  [-1, 1].forEach((side, i) => {
    const sw = (i === 0 ? 1 : -1) * Math.sin(ph) * 3;
    const sx = hipX + side * 16;
    const sy = torsoTop + 8;
    const ex = sx + side * 3;
    const ey = sy + B.torsoLen * 0.46 + sw * 0.3;
    const hx = ex + side * 1;
    const hy = ey + B.torsoLen * 0.42 - Math.abs(sw);
    const base = side < 0 ? L.sleeveShade : L.sleeve;
    limb(p, sx, sy, ex, ey, 7 * k, base, L.sleeveStripe);
    limb(p, ex, ey, hx, hy, 6.2 * k, base, L.sleeveStripe);
    if (L.cuff) capsule(p, hx, hy - 4, hx, hy - 2, 6 * k, L.cuff);
    disk(p, hx, hy + 2, 4.6, side < 0 ? L.skinShade : L.skin);
  });
  p(hipX - 6, torsoTop - 6, 12, 8, L.skinShade);
  paintHead(p, L, hipX - 2, torsoTop - 44, { back: true });
}

function paintHuman(p: Px, L: Look, pose: string, B: Build): void {
  if (pose.startsWith("climb")) return paintClimbBack(p, L, Number(pose.slice(5)), B);
  const R = rig(pose, L);
  const k = L.limb ?? 1;
  const thigh = B.legLen * 0.5;
  const shin = B.legLen * 0.5 - 8;
  const footH = 8;
  const legPts = R.legs.map(([ha, kn]) => {
    const [kx, ky] = bend(0, 0, thigh, ha);
    const [ax, ay] = bend(kx, ky, shin, ha - kn);
    return { kx, ky, ax, ay };
  });
  const low = Math.max(legPts[0].ay, legPts[1].ay);
  const hipY = FEET - footH - 4 - low;
  const hipX = CX;
  const torsoTop = hipY - B.torsoLen - R.breath;
  const lean = R.lean + (L.hunch ?? 0) * 2;
  const tw = 40;

  const shoulder = (front: boolean): [number, number] => [hipX + lean + (front ? 12 : -12), torsoTop + 8];
  const armLen = [B.torsoLen * 0.48, B.torsoLen * 0.44];
  const drawArm = (front: boolean) => {
    const [sa, el] = R.arms[front ? 0 : 1];
    const [sx, sy] = shoulder(front);
    const [ex, ey] = bend(sx, sy, armLen[0], sa);
    const [hx, hy] = bend(ex, ey, armLen[1], sa + el);
    const base = front ? L.sleeve : L.sleeveShade;
    const stripe = L.sleeveStripe ? (front ? L.sleeveStripe : mix(L.sleeveStripe, -0.3)) : undefined;
    limb(p, sx, sy, ex, ey, 7 * k, base, stripe);
    limb(p, ex, ey, hx, hy, 6.2 * k, base, stripe);
    // 팔꿈치 주름
    if (k >= 1) curve(p, ex - 3, ey - 1, ex, ey + 1, ex + 3, ey - 1, mix(base, -0.25));
    if (L.cuff) capsule(p, hx - (hx - ex) * 0.2, hy - (hy - ey) * 0.2, hx - (hx - ex) * 0.06, hy - (hy - ey) * 0.06, 6.2 * k, L.cuff);
    // 손
    const hs = Math.max(0.8, k);
    disk(p, hx + 0.5, hy + 2.5, 5.4 * hs, front ? L.skinShade : mix(L.skinShade, -0.15));
    disk(p, hx, hy + 2, 4.6 * hs, front ? L.skin : L.skinShade);
    p(hx - 2, hy, 3, 2, L.skinLight);
    for (let f = 0; f < 3; f++) p(hx - 2 + f * 2, hy + 5, 1, 2, mix(L.skinShade, -0.1));
    if (front && pose === "flashlight") {
      p(hx - 2, hy - 4, 18, 10, "#2a2a34");
      p(hx - 2, hy - 4, 18, 2, "#5a5a68");
      p(hx + 4, hy - 3, 2, 8, "#3e3e4a");
      p(hx + 16, hy - 6, 4, 14, "#fff3b8");
      p(hx + 17, hy - 5, 2, 12, "#ffffff");
    }
    if (front && pose === "drink") {
      p(hx - 4, hy - 14, 10, 18, "#c4302a");
      p(hx - 3, hy - 14, 2, 18, "#e86a5a");
      p(hx + 4, hy - 14, 2, 18, "#8a1e18");
      p(hx - 4, hy - 16, 10, 2, "#d8d8e0");
      p(hx - 3, hy - 17, 8, 1, "#a8a8b0");
      p(hx - 4, hy - 8, 10, 6, "#f0e2b0");
    }
  };
  const drawLeg = (i: number) => {
    const front = i === 0;
    const { kx, ky, ax, ay } = legPts[i];
    const hx = hipX + (front ? 6 : -6);
    const base = front ? L.pants : L.pantsShade;
    limb(p, hx, hipY + 4, hx + kx, hipY + 4 + ky, 8.6 * k, base);
    limb(p, hx + kx, hipY + 4 + ky, hx + ax, hipY + 4 + ay, 7.4 * k, base);
    // 바지 주름선과 무릎
    if (front && k >= 1) {
      capsule(p, hx + kx * 0.4 + 2, hipY + 4 + ky * 0.4, hx + kx + 2, hipY + 4 + ky, 0.5, mix(base, 0.25));
      curve(p, hx + kx - 3, hipY + 4 + ky, hx + kx, hipY + 6 + ky, hx + kx + 3, hipY + 4 + ky, mix(base, -0.2));
    }
    // 신발
    const fx = hx + ax;
    const fy = hipY + 4 + ay;
    const sh = L.shoes;
    ellipse(p, fx + 5, fy + 3, 10, 4, mix(sh, -0.25));
    ellipse(p, fx + 4, fy + 2, 9, 3.4, sh);
    p(fx - 5, fy + 5, 22, 2, mix(sh, -0.45));
    p(fx - 4, fy + 4, 20, 1, mix(sh, -0.2));
    ellipse(p, fx + 9, fy + 1, 4, 1.6, mix(sh, 0.3));
    p(fx + 1, fy - 1, 2, 1, mix(sh, 0.45));
    p(fx + 4, fy - 1, 2, 1, mix(sh, 0.45));
  };

  // 그리는 순서: 뒷팔 → 뒷다리 → 앞다리 → 몸통 → 앞팔 → 머리
  if (!R.sit) drawArm(false);
  drawLeg(1);
  drawLeg(0);
  // 엉덩이 (다리와 몸통 잇기)
  ellipse(p, hipX, hipY + 6, 18, 8, L.pants);
  p(hipX - 18, hipY + 9, 36, 3, L.pantsShade);
  // 몸통 (어깨가 둥글고 허리로 살짝 좁아짐, 왼쪽 빛 → 오른쪽 그림자)
  const th = hipY - torsoTop;
  for (let ly = 0; ly < th; ly++) {
    const t = ly / th;
    const off = Math.round(lean * (1 - t));
    const shoulderRound = ly < 5 ? Math.round((5 - ly) * 1.4) : 0;
    const w = tw - shoulderRound * 2 - (t > 0.7 ? Math.round((t - 0.7) * 10) : 0);
    const x0 = hipX - Math.floor(w / 2) + off;
    for (let lx = 0; lx < w; lx++) {
      let c = L.shirt(lx, ly, w, th);
      const u = lx / w;
      c = mix(c, 0.1 - u * 0.32);
      if (u > 0.9) c = mix(c, -0.12);
      if (ly > th - 6) c = mix(c, -0.1);
      p(x0 + lx, torsoTop + ly, 1, 1, c);
    }
  }
  // 옷 주름 (겨드랑이 → 허리)
  if (k >= 1) {
    curve(p, hipX + lean - 14, torsoTop + 12, hipX - 10, torsoTop + th * 0.6, hipX - 6, hipY - 2, "rgba(0,0,0,0.18)");
    curve(p, hipX + lean + 14, torsoTop + 12, hipX + 12, torsoTop + th * 0.6, hipX + 9, hipY - 2, "rgba(0,0,0,0.22)");
  }
  // 깃 (V넥) + 단추
  if (L.collar) {
    const cx = hipX + lean + 4;
    for (let i = 0; i < 8; i++) p(cx - 3 + i * 0.35, torsoTop + i, 6 - i * 0.7, 1, i < 2 ? L.skinShade : L.skin);
    // 깃 날개
    for (let i = 0; i < 7; i++) {
      p(cx - 10 + i * 0.6, torsoTop + i, 6 - i * 0.6, 1, L.collar);
      p(cx + 4, torsoTop + i, 6 - i * 0.6, 1, mix(L.collar, -0.08));
    }
    curve(p, cx - 10, torsoTop, cx - 6, torsoTop + 6, cx - 2, torsoTop + 8, mix(L.collar, -0.4));
    curve(p, cx + 10, torsoTop, cx + 7, torsoTop + 6, cx + 3, torsoTop + 8, mix(L.collar, -0.45));
    // 단추줄
    p(cx, torsoTop + 9, 1, th - 12, "rgba(0,0,0,0.2)");
    for (let by = torsoTop + 12; by < hipY - 4; by += 9) {
      disk(p, cx + 1, by, 1.4, "#f4e8cc");
      p(cx + 1, by, 1, 1, "#a8946a");
    }
  }
  // 허리띠
  if (L.belt) {
    p(hipX - 20, hipY - 3, 40, 6, L.belt);
    p(hipX - 20, hipY - 3, 40, 1, mix(L.belt, 0.25));
    p(hipX - 20, hipY + 2, 40, 1, mix(L.belt, -0.3));
    for (let x = hipX - 18; x < hipX + 18; x += 3) p(x, hipY - 1, 1, 1, mix(L.belt, 0.3));
    if (L.buckle) {
      p(hipX + 3, hipY - 3, 8, 6, L.buckle);
      p(hipX + 5, hipY - 1, 4, 2, L.belt);
      p(hipX + 3, hipY - 3, 8, 1, mix(L.buckle, 0.45));
      p(hipX + 10, hipY - 2, 1, 5, mix(L.buckle, -0.35));
    }
  }
  if (R.sit) drawArm(false);
  drawArm(true);
  // 목 + 머리
  const hx = hipX + lean + 4 + R.head;
  const ft = torsoTop - 4 - 40 + (R.head > 4 ? 4 : 0);
  p(hx - 6, torsoTop - 6, 12, 8, L.skinShade);
  p(hx - 5, torsoTop - 6, 4, 6, L.skin);
  paintHead(p, L, hx, ft, { closed: pose === "sleep", back: pose === "back", shock: pose === "armsUp" });
}

// ── 의상 ────────────────────────────────────────────────
/** 노랑·검정 체크 (12도트 반복, 굵은 띠 + 가는 선 + 트윌 결) */
const plaid = (lx: number, ly: number): string => {
  const v = lx % 12;
  const h = (ly + 4) % 12;
  const vb = v >= 5 && v <= 7;
  const hb = h >= 8 && h <= 10;
  if (vb && hb) return (lx + ly) % 2 ? "#140b05" : "#1e130a";
  if (vb || hb) return (lx + ly) % 3 === 0 ? "#4a3414" : (lx + ly) % 2 ? "#3a2810" : "#2e200c";
  if (v === 1 || h === 2) return "#b87a14";
  return (lx + ly) % 4 === 0 ? "#f6c444" : (lx - ly) % 4 === 0 ? "#dca228" : "#eab030";
};

export const CHARLIE: Look = {
  skin: "#f4c9a2",
  skinShade: "#d69a76",
  skinLight: "#ffe2c8",
  hair: "#ecc24a",
  hairShade: "#b98a28",
  hairLight: "#fbe496",
  hairStyle: "pomp",
  shirt: plaid,
  sleeve: "#e8ae2c",
  sleeveShade: "#a8740f",
  sleeveStripe: "#3a2810",
  cuff: "#c08216",
  collar: "#f8d468",
  pants: "#a8804e",
  pantsShade: "#7a5a34",
  shoes: "#5a321a",
  belt: "#3a2412",
  buckle: "#e8c45a",
  glasses: true,
  eye: "#4a7a3a",
  mouth: "#b06a58",
  brow: "#b08226",
};

function zombie(shirt: string, shirtB: string, pants: string, hair: string): Look {
  return {
    skin: "#9fae8e",
    skinShade: "#76886a",
    skinLight: "#b8c4a6",
    hair,
    hairShade: mix(hair, -0.3),
    hairLight: mix(hair, 0.2),
    hairStyle: "messy",
    shirt: (lx, ly, w) => {
      if ((lx * 7 + ly * 5) % 47 < 2) return "#1e1a18";
      if ((lx + ly * 3) % 37 === 0) return "#5a2a22";
      if (Math.abs(lx - w / 2) < 1 && ly < 16) return mix(shirt, -0.35);
      if (ly > 30 && lx % 7 === 0) return shirtB;
      return (lx + ly) % 5 === 0 ? mix(shirt, -0.06) : shirt;
    },
    sleeve: shirt,
    sleeveShade: shirtB,
    pants,
    pantsShade: mix(pants, -0.3),
    shoes: "#1e1e22",
    eye: "#d23a3a",
    mouth: "#3a1e1e",
    brow: "#4a5a40",
    hunch: 5,
    armsForward: true,
  };
}
export const ZOMBIES: Look[] = [
  zombie("#5c616e", "#454953", "#34405a", "#3a3430"),
  zombie("#7a4a3a", "#5a3428", "#3e3a34", "#5a4a36"),
  zombie("#4a5a4a", "#36443a", "#2c3240", "#2a2422"),
];

/** 운석 먼지에 넋이 나간 사람들 (좀비가 아니라, 멍하니 흔들리고 중얼거린다) */
export const STRANGERS: Look[] = ZOMBIES.map((z, i) => ({
  ...z,
  skin: ["#e4c6aa", "#c49674", "#f0d6c0"][i],
  skinShade: ["#c4a084", "#9a7054", "#d4b49c"][i],
  skinLight: ["#f4dcc6", "#d8ac8a", "#fbe6d4"][i],
  eye: "#4a3a2e",
  brow: ["#5a4a3a", "#2a1e18", "#7a5a3a"][i],
  armsForward: false,
  hunch: [4, 2, 5][i],
}));

export const ADDICT: Look = {
  ...ZOMBIES[0],
  skin: "#e2b898",
  skinShade: "#c09474",
  skinLight: "#f0d0b4",
  hairStyle: "hood",
  hair: "#4a4a54",
  hairShade: "#32323a",
  hairLight: "#5a5a64",
  armsForward: false,
  eye: "#3a2a22",
  brow: "#5a4a3a",
  hunch: 4,
};

export const SKELETON: Look = {
  skin: "#ece6d4",
  skinShade: "#bdb59e",
  skinLight: "#fffaec",
  hair: "#ece6d4",
  hairShade: "#bdb59e",
  hairLight: "#fffaec",
  hairStyle: "skull",
  shirt: (lx, ly, w) => {
    const mid = w / 2;
    if (Math.abs(lx - mid) < 2) return ly % 6 < 1 ? "#a8a08a" : "#e4dcc8";
    const arc = Math.abs(lx - mid) * 0.22;
    const rib = (ly + Math.round(arc)) % 8;
    if (rib < 3 && lx > 2 && lx < w - 3 && ly < 32) return rib === 0 ? "#fffaec" : rib === 2 ? "#bdb59e" : "#ece6d4";
    return "#201c18";
  },
  sleeve: "#ece6d4",
  sleeveShade: "#bdb59e",
  pants: "#e2dbc6",
  pantsShade: "#b5ad96",
  shoes: "#d8d0bc",
  eye: "#1e1a18",
  mouth: "#1e1a18",
  limb: 0.5,
};

export const FROGMAN: Look = {
  skin: "#6fae4c",
  skinShade: "#4c8434",
  skinLight: "#9ad070",
  hair: "#6fae4c",
  hairShade: "#4c8434",
  hairLight: "#8ac864",
  hairStyle: "frog",
  shirt: (lx, ly, w) => {
    if (ly >= 24 && ly <= 27) return ly === 24 ? "#6a4c24" : "#4a3418";
    if (Math.abs(lx - w / 2) < 2 + ly * 0.25 && ly < 16) return ly % 3 === 0 ? "#b8d08a" : "#c8e09a";
    if (Math.abs(lx - w / 2) < 3 + ly * 0.25 && ly < 16) return "#6a4e2a";
    if (lx === Math.floor(w / 2) + 6 && ly % 10 === 4) return "#d8c8a0";
    return (lx + ly) % 6 === 0 ? "#8a6a3c" : "#9a7444";
  },
  sleeve: "#9a7444",
  sleeveShade: "#6a4e2a",
  pants: "#4a3a28",
  pantsShade: "#32281c",
  shoes: "#5a9a3a",
  eye: "#101010",
  mouth: "#24301a",
  hunch: 3,
};

export const FROG_KING: Look = {
  ...FROGMAN,
  skin: "#5a9a3a",
  skinShade: "#3a7024",
  skinLight: "#80c060",
  shirt: (lx, ly, w) => {
    if (ly < 5 || lx < 2 || lx > w - 3) return ly % 2 ? "#e8c83a" : "#d8a82a";
    if ((lx + ly) % 9 === 0) return "#c84a8a";
    return (lx * 3 + ly) % 11 === 0 ? "#9a3a6a" : "#7a2a4a";
  },
  sleeve: "#7a2a4a",
  sleeveShade: "#5a1e3a",
  cuff: "#e8c83a",
  hunch: 4,
  crown: true,
};

/** 생존자: 루스 (전직 응급실 간호사, 녹색 카디건 + 수술복) */
export const RUTH: Look = {
  skin: "#eac4a4",
  skinShade: "#c89a7c",
  skinLight: "#f8dcc4",
  hair: "#c8c6c2",
  hairShade: "#9a9894",
  hairLight: "#ecebe8",
  hairStyle: "bun",
  shirt: (lx, ly, w) => {
    const edge = lx < 7 || lx > w - 8;
    if (edge) return (ly % 4 === 0) ? "#3e6a4a" : (lx + ly) % 3 === 0 ? "#4a7a56" : "#558862";
    if (ly < 4 && Math.abs(lx - w / 2) < 6) return "#e2bca0";
    return (lx * 2 + ly) % 9 === 0 ? "#5a9aa0" : "#6aaab0";
  },
  sleeve: "#558862",
  sleeveShade: "#3e6a4a",
  cuff: "#3e6a4a",
  pants: "#6aaab0",
  pantsShade: "#4a8a90",
  shoes: "#e8e4dc",
  eye: "#5a4a3a",
  mouth: "#a8685a",
  brow: "#8a8884",
  hunch: 1,
};

/** 생존자: 토마스 (부서진 편의점 주인, 털모자 + 앞치마) */
export const TOMAS: Look = {
  skin: "#b8825a",
  skinShade: "#8e6040",
  skinLight: "#d0a07a",
  hair: "#2a2220",
  hairShade: "#1a1412",
  hairLight: "#4a3e38",
  hairStyle: "beanie",
  shirt: (lx, ly, w) => {
    const apron = lx > 6 && lx < w - 7 && ly > 6;
    if (apron) return ly === 7 ? "#c8c4b8" : (lx + ly) % 7 === 0 ? "#d8d4c8" : "#ece8dc";
    if (ly < 7 && Math.abs(lx - w / 2) < 3) return "#ece8dc";
    return (lx + ly * 2) % 8 < 1 ? "#2c4870" : "#3a5a88";
  },
  sleeve: "#3a5a88",
  sleeveShade: "#2c4870",
  pants: "#3a3634",
  pantsShade: "#282624",
  shoes: "#3a2a1e",
  eye: "#2a1e16",
  mouth: "#7a4a3a",
  brow: "#1a1412",
  mustache: "#241c18",
};

/** 생존자: 릴리 (꼬마, 분홍 후드티 + 포니테일) */
export const LILY: Look = {
  skin: "#f6d2b4",
  skinShade: "#dca88a",
  skinLight: "#ffe6d0",
  hair: "#7a4a2a",
  hairShade: "#5a321a",
  hairLight: "#a8744a",
  hairStyle: "pony",
  shirt: (lx, ly, w, h) => {
    if (ly > h - 12 && Math.abs(lx - w / 2) < 9 && ly < h - 3) return ly === h - 12 ? "#d8708a" : "#e88aa2";
    if (Math.abs(lx - w / 2 - 1) < 1 && ly < 12) return "#fff0f4";
    return (lx + ly) % 7 === 0 ? "#f0a0b6" : "#f4b0c2";
  },
  sleeve: "#f4b0c2",
  sleeveShade: "#d8889e",
  cuff: "#e88aa2",
  pants: "#5a6a9a",
  pantsShade: "#44507a",
  shoes: "#e8e4ec",
  eye: "#4a3a2a",
  mouth: "#c86a6a",
  brow: "#6a3e22",
};

/** 블랙컴퍼니(주) 그림스 부장: 남색 정장, 빨간 넥타이, 빗어 넘긴 머리 */
export const BOSS: Look = {
  skin: "#eebc9c",
  skinShade: "#cc947a",
  skinLight: "#fcd6bc",
  hair: "#8a8682",
  hairShade: "#5e5a56",
  hairLight: "#b8b4ae",
  hairStyle: "comb",
  shirt: (lx, ly, w) => {
    const mid = w / 2 + 2;
    const v = 12 - ly * 0.45;
    if (Math.abs(lx - mid) < 1.6 && ly < 26) return ly < 3 ? "#8a1a1a" : ly % 5 === 0 ? "#9a2626" : "#c03030";
    if (Math.abs(lx - mid) < v && ly < 24) return ly % 7 === 0 ? "#dcd8d0" : "#f0ece4";
    if (lx === Math.floor(mid) + 5 && ly % 9 === 4 && ly > 24) return "#c8b070";
    return (lx + ly * 2) % 11 === 0 ? "#2a2e48" : "#323856";
  },
  sleeve: "#323856",
  sleeveShade: "#22263c",
  cuff: "#f0ece4",
  pants: "#2c3150",
  pantsShade: "#1e2238",
  shoes: "#1a1210",
  belt: "#1a1210",
  buckle: "#c8b070",
  eye: "#3a2a20",
  mouth: "#8a4a3a",
  brow: "#5e5a56",
  mustache: "#6e6a66",
};

/** 면역자를 찾는 방호복 요원 */
export const HAZMAT: Look = {
  skin: "#2e3036",
  skinShade: "#1e2024",
  skinLight: "#44464e",
  hair: "#e8d040",
  hairShade: "#b8a02a",
  hairLight: "#f8e880",
  hairStyle: "mask",
  shirt: (lx, ly, w) => {
    if (ly > 4 && ly < 8 && lx > 4 && lx < w - 5) return "#2e3036";
    if (Math.abs(lx - w / 2) < 1) return "#b8a02a";
    if (lx > w - 14 && lx < w - 6 && ly > 12 && ly < 20) return ly === 13 ? "#c83a2a" : (lx + ly) % 3 ? "#f4f0e0" : "#c83a2a";
    return (lx + ly * 3) % 13 === 0 ? "#d8c034" : "#e8d040";
  },
  sleeve: "#e8d040",
  sleeveShade: "#b8a02a",
  cuff: "#2e3036",
  pants: "#e0c83a",
  pantsShade: "#b09828",
  shoes: "#1e2024",
  belt: "#2e3036",
  eye: "#000",
  mouth: "#000",
};

/** 사람 스프라이트 (화면 32×54 자리에 128×216 도트) */
export function human(look: Look, lookId: string, pose: Pose, build: Build, facing: 1 | -1): HTMLCanvasElement {
  const key = `h:${lookId}:${pose}:${build.legLen}:${facing}`;
  return cached(key, () => {
    const right = cached(`h:${lookId}:${pose}:${build.legLen}:1`, () => bakeVec(SW, SH, density / 4, (p) => paintHuman(p, look, pose, build), OUTLINE, 2));
    return facing === 1 ? right : flip(right);
  });
}
/** 화면에 그릴 때 기준점 (발 가운데, 화면 좌표) */
export const HUMAN_ORIGIN = { x: CX / 4, y: FEET / 4 };

// ── 고양이 샘 (밝은 회색 페르시안, 실사풍) ─────────────────
// 몸을 타원·원뿔 조각으로 만든 실루엣에 빛과 그림자를 칠하고,
// 그 안에 몸의 결을 따라 가는 털을 수백 가닥 그린다.
export type CatPose = string;
const CW = 128;
const CH = 96;
const GROUND_Y = 88;

const C = {
  base: "#cfd2da",
  light: "#eef0f4",
  pale: "#fafbfc",
  shade: "#a9adba",
  deep: "#5d6272",
  ruff: "#e8eaee",
  earIn: "#d9a6ae",
  earDeep: "#8a6a72",
  nose: "#c98892",
  noseDark: "#7a4a52",
  iris: "#eea63a",
  irisIn: "#ffd98a",
  irisRim: "#b8701e",
  pupil: "#120a06",
  lid: "#3e3f4a",
};

/** 결정적 난수 */
function seeded(seed: number): () => number {
  let s2 = seed >>> 0;
  return () => {
    s2 = (s2 * 1664525 + 1013904223) >>> 0;
    return s2 / 4294967296;
  };
}

type Ell = { kind: "e"; x: number; y: number; rx: number; ry: number; rot?: number };
type Cap = { kind: "c"; x0: number; y0: number; r0: number; x1: number; y1: number; r1: number };
type Part = Ell | Cap;

function addPart(path: Path2D, s2: Part): void {
  if (s2.kind === "e") {
    path.moveTo(s2.x + s2.rx, s2.y);
    path.ellipse(s2.x, s2.y, s2.rx, s2.ry, s2.rot ?? 0, 0, Math.PI * 2);
    return;
  }
  const dx = s2.x1 - s2.x0;
  const dy = s2.y1 - s2.y0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  path.moveTo(s2.x0 + nx * s2.r0, s2.y0 + ny * s2.r0);
  path.lineTo(s2.x1 + nx * s2.r1, s2.y1 + ny * s2.r1);
  path.lineTo(s2.x1 - nx * s2.r1, s2.y1 - ny * s2.r1);
  path.lineTo(s2.x0 - nx * s2.r0, s2.y0 - ny * s2.r0);
  path.closePath();
  path.moveTo(s2.x0 + s2.r0, s2.y0);
  path.ellipse(s2.x0, s2.y0, s2.r0, s2.r0, 0, 0, Math.PI * 2);
  path.moveTo(s2.x1 + s2.r1, s2.y1);
  path.ellipse(s2.x1, s2.y1, s2.r1, s2.r1, 0, 0, Math.PI * 2);
}

/**
 * 털 덩어리 하나 그리기: 실루엣 → 빛/그림자 → 결 따라 털 → 가장자리 털
 * flow: 털이 흐르는 방향(라디안), far: 멀리 있는 쪽(어둡게)
 */
function furMass(g: CanvasRenderingContext2D, parts: Part[], o: { flow: number; seed: number; far?: boolean; tone?: number; strands?: number; edge?: number; light?: [number, number] }): void {
  const path = new Path2D();
  for (const s2 of parts) addPart(path, s2);
  // 경계 상자
  let x0 = 999, y0 = 999, x1 = -999, y1 = -999;
  for (const s2 of parts) {
    const bx = s2.kind === "e" ? [s2.x - s2.rx, s2.x + s2.rx] : [Math.min(s2.x0 - s2.r0, s2.x1 - s2.r1), Math.max(s2.x0 + s2.r0, s2.x1 + s2.r1)];
    const byy = s2.kind === "e" ? [s2.y - s2.ry, s2.y + s2.ry] : [Math.min(s2.y0 - s2.r0, s2.y1 - s2.r1), Math.max(s2.y0 + s2.r0, s2.y1 + s2.r1)];
    x0 = Math.min(x0, bx[0]);
    x1 = Math.max(x1, bx[1]);
    y0 = Math.min(y0, byy[0]);
    y1 = Math.max(y1, byy[1]);
  }
  const tone = (o.tone ?? 0) + (o.far ? -0.16 : 0);
  const base = mix(C.base, tone);
  const r = seeded(o.seed * 977 + 13);
  // 가장자리 털 (실루엣 밖으로 삐져나옴)
  const edge = (o.edge ?? 1.6) * 0.6;
  g.lineCap = "round";
  for (const s2 of parts) {
    if (s2.kind !== "e") continue;
    const per = (s2.rx + s2.ry) * 1.6;
    for (let i = 0; i < per; i++) {
      const a = (i / per) * Math.PI * 2;
      const px = s2.x + Math.cos(a) * s2.rx * 0.97;
      const py = s2.y + Math.sin(a) * s2.ry * 0.97;
      const out = edge * (0.5 + r());
      const fx = Math.cos(o.flow) * 0.8 + Math.cos(a) * 0.6;
      const fy = Math.sin(o.flow) * 0.8 + Math.sin(a) * 0.6;
      g.strokeStyle = Math.sin(a) > 0.3 ? mix(base, -0.08) : base;
      g.lineWidth = 1.15;
      g.beginPath();
      g.moveTo(px - fx * 0.6, py - fy * 0.6);
      g.quadraticCurveTo(px + fx * out * 0.6, py + fy * out * 0.6, px + fx * out, py + fy * out + 0.3);
      g.stroke();
    }
  }
  // 바탕
  g.fillStyle = base;
  g.fill(path);
  g.save();
  g.clip(path);
  // 빛 (왼쪽 위) + 그림자 (아래)
  const [lx, ly] = o.light ?? [x0 + (x1 - x0) * 0.35, y0 + (y1 - y0) * 0.2];
  const rad = Math.max(x1 - x0, y1 - y0);
  const lg = g.createRadialGradient(lx, ly, 0, lx, ly, rad * 0.75);
  lg.addColorStop(0, mix(C.light, tone + 0.05));
  lg.addColorStop(0.55, mix(C.base, tone + 0.06));
  lg.addColorStop(1, "rgba(0,0,0,0)");
  g.fillStyle = lg;
  g.fillRect(x0 - 2, y0 - 2, x1 - x0 + 4, y1 - y0 + 4);
  const sg = g.createLinearGradient(0, y0, 0, y1);
  sg.addColorStop(0, "rgba(40,44,60,0)");
  sg.addColorStop(0.6, "rgba(40,44,60,0.06)");
  sg.addColorStop(1, `rgba(60,64,84,${o.far ? 0.28 : 0.16})`);
  g.fillStyle = sg;
  g.fillRect(x0 - 2, y0 - 2, x1 - x0 + 4, y1 - y0 + 4);
  // 결을 따라 흐르는 털
  const n = Math.floor((o.strands ?? (x1 - x0) * (y1 - y0) * 0.55) * 0.16);
  for (let i = 0; i < n; i++) {
    const sx = x0 + r() * (x1 - x0);
    const sy = y0 + r() * (y1 - y0);
    const t = (sy - y0) / (y1 - y0 || 1);
    const len = 2.2 + r() * 3.2;
    const ang = o.flow + (r() - 0.5) * 0.5;
    const light = r() < 0.5 - t * 0.35;
    g.strokeStyle = light ? `rgba(252,252,255,${0.14 + r() * 0.18})` : `rgba(110,114,130,${0.03 + r() * 0.05})`;
    g.lineWidth = 0.45 + r() * 0.35;
    g.beginPath();
    g.moveTo(sx, sy);
    g.quadraticCurveTo(sx + Math.cos(ang) * len * 0.5 + (r() - 0.5), sy + Math.sin(ang) * len * 0.5, sx + Math.cos(ang) * len, sy + Math.sin(ang) * len + 0.4);
    g.stroke();
  }
  g.restore();
}

/** 머리 (오른쪽 3/4) */
function paintCatHead(g: CanvasRenderingContext2D, hx: number, hy: number, o: { closed?: boolean; wide?: boolean; happy?: boolean; hiss?: boolean; earsBack?: boolean; tilt?: number }, seed: number): void {
  g.save();
  g.translate(hx, hy - 1.5);
  g.rotate(o.tilt ?? 0);
  g.scale(1.2, 1.2); // 아기 고양이처럼 큰 머리
  // 귀
  const ear = (bx: number, tipX: number, tipY: number, w: number, near: boolean) => {
    const path = new Path2D();
    path.moveTo(bx - w, -4);
    path.quadraticCurveTo(bx - w * 0.75, tipY * 0.6, tipX - 1.6, tipY + 1.2);
    path.quadraticCurveTo(tipX, tipY - 0.8, tipX + 1.6, tipY + 1.2);
    path.quadraticCurveTo(bx + w * 0.8, tipY * 0.55, bx + w, -3);
    path.closePath();
    g.fillStyle = near ? C.base : mix(C.base, -0.15);
    g.fill(path);
    g.save();
    g.clip(path);
    const eg = g.createLinearGradient(0, tipY, 0, 0);
    eg.addColorStop(0, C.earDeep);
    eg.addColorStop(0.5, C.earIn);
    eg.addColorStop(1, mix(C.earIn, -0.15));
    g.fillStyle = eg;
    g.beginPath();
    g.moveTo(bx - w * 0.55, -3);
    g.quadraticCurveTo(bx - w * 0.35, tipY * 0.45, tipX + 0.5, tipY + 3);
    g.quadraticCurveTo(bx + w * 0.45, tipY * 0.45, bx + w * 0.6, -2);
    g.fill();
    // 귓속 털
    const r = seeded(seed + (near ? 7 : 3));
    g.lineCap = "round";
    for (let i = 0; i < 14; i++) {
      const sx = bx - w * 0.4 + r() * w * 0.8;
      g.strokeStyle = `rgba(248,248,252,${0.5 + r() * 0.4})`;
      g.lineWidth = 0.5;
      g.beginPath();
      g.moveTo(sx, -2);
      g.quadraticCurveTo(sx + (r() - 0.5) * 2, tipY * 0.35, tipX + (r() - 0.5) * 3, tipY * (0.5 + r() * 0.3));
      g.stroke();
    }
    g.restore();
    // 귀 테두리 털
    g.strokeStyle = mix(C.base, -0.28);
    g.lineWidth = 0.7;
    g.stroke(path);
  };
  if (o.earsBack) {
    ear(-8, -18, -2, 5.5, false);
    ear(4, -6, -4, 6, true);
  } else {
    ear(-9, -11.5, -15.5, 7, false);
    ear(5.5, 7, -16.5, 7.5, true);
  }
  // 머리통 + 볼털 + 주둥이
  furMass(g, [{ kind: "e", x: 0, y: 0, rx: 15, ry: 13.5 }], { flow: Math.PI * 0.85, seed: seed + 1, strands: 160, edge: 1.2, light: [-5, -7] });
  furMass(g, [{ kind: "e", x: 1, y: 8, rx: 16.5, ry: 8 }, { kind: "e", x: -10, y: 6, rx: 6.5, ry: 6.5 }], { flow: Math.PI * 0.7, seed: seed + 2, tone: 0.1, strands: 100, edge: 2, light: [0, 3] });
  // 볼 홍조
  g.fillStyle = "rgba(244,170,180,0.35)";
  g.beginPath();
  g.ellipse(-7, 6, 3.4, 1.8, 0, 0, Math.PI * 2);
  g.ellipse(12.5, 4.5, 3, 1.6, 0, 0, Math.PI * 2);
  g.fill();
  // 이마 줄무늬 (옅은 태비)
  g.strokeStyle = "rgba(110,114,130,0.18)";
  g.lineWidth = 0.6;
  for (const dx of [-3, 0, 3]) {
    g.beginPath();
    g.moveTo(dx + 1, -10);
    g.quadraticCurveTo(dx, -7, dx + 0.5, -5);
    g.stroke();
  }
  // 주둥이 (수염 자리 볼록)
  const pad = g.createRadialGradient(10, 5, 0.5, 10, 5, 6);
  pad.addColorStop(0, C.pale);
  pad.addColorStop(1, mix(C.light, -0.06));
  g.fillStyle = pad;
  g.beginPath();
  g.ellipse(9.5, 5.2, 4.2, 3.3, 0, 0, Math.PI * 2);
  g.ellipse(13.4, 5.6, 3.2, 2.9, 0, 0, Math.PI * 2);
  g.fill();
  // 수염 모공
  g.fillStyle = "rgba(90,94,110,0.6)";
  for (const [dx, dy] of [[8, 4.4], [9.6, 5.6], [11, 4.6], [12.6, 5.8], [14, 4.8]]) g.fillRect(dx, dy, 0.5, 0.5);
  // 턱
  g.fillStyle = C.pale;
  g.beginPath();
  g.ellipse(11, 8.8, 3, 1.8, 0, 0, Math.PI * 2);
  g.fill();
  // 코 (분홍 가죽 + 콧구멍) 와 콧등
  g.strokeStyle = "rgba(120,124,140,0.4)";
  g.lineWidth = 0.6;
  g.beginPath();
  g.moveTo(5.5, -3);
  g.quadraticCurveTo(9.5, -1, 11.5, 1.5);
  g.stroke();
  g.fillStyle = C.nose;
  g.beginPath();
  g.moveTo(10.2, 1.2);
  g.lineTo(14.4, 1.0);
  g.quadraticCurveTo(13.8, 3.2, 12.2, 3.6);
  g.quadraticCurveTo(10.8, 3.0, 10.2, 1.2);
  g.fill();
  g.fillStyle = C.noseDark;
  g.fillRect(11, 2, 0.8, 0.6);
  g.fillRect(13, 1.9, 0.8, 0.6);
  g.fillStyle = "rgba(255,230,236,0.8)";
  g.fillRect(11.6, 1.2, 1.2, 0.5);
  // 입 (인중 → 양쪽)
  g.strokeStyle = C.lid;
  g.lineWidth = 0.55;
  g.beginPath();
  g.moveTo(12.2, 3.6);
  g.lineTo(12.2, 5.2);
  if (o.hiss) {
    g.stroke();
    g.fillStyle = "#3a1a1e";
    g.beginPath();
    g.ellipse(12, 7.4, 3.2, 2.2, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#ffffff";
    g.fillRect(9.6, 5.8, 0.8, 1.8);
    g.fillRect(13.8, 5.8, 0.8, 1.8);
  } else {
    g.quadraticCurveTo(10.6, 6.6, 9.2, 5.6);
    g.moveTo(12.2, 5.2);
    g.quadraticCurveTo(13.6, 6.5, 15, 5.3);
    g.stroke();
  }
  // 눈
  const eye = (ex: number, ey: number, w: number, h: number, near: boolean) => {
    if (o.closed || o.happy) {
      g.strokeStyle = C.lid;
      g.lineWidth = 0.9;
      g.beginPath();
      g.moveTo(ex - w / 2, ey);
      g.quadraticCurveTo(ex, ey + (o.happy ? -h * 0.5 : h * 0.4), ex + w / 2 + 0.6, ey - 0.4);
      g.stroke();
      return;
    }
    const shape = new Path2D();
    // 옆에서 본 눈: 뒤쪽은 둥글고 앞쪽(코 방향)으로 살짝 뾰족한 아몬드꼴
    shape.moveTo(ex - w / 2, ey);
    shape.bezierCurveTo(ex - w / 2, ey - h * 0.62, ex + w * 0.2, ey - h * 0.66, ex + w / 2 + 0.6, ey - h * 0.08);
    shape.bezierCurveTo(ex + w * 0.25, ey + h * 0.62, ex - w / 2, ey + h * 0.6, ex - w / 2, ey);
    // 눈가 그늘
    g.strokeStyle = "rgba(70,74,90,0.3)";
    g.lineWidth = 1.4;
    g.stroke(shape);
    g.fillStyle = C.lid;
    g.fill(shape);
    g.save();
    g.clip(shape);
    const ig = g.createRadialGradient(ex - w * 0.08, ey + h * 0.12, 0.2, ex, ey, w * 0.62);
    ig.addColorStop(0, C.irisIn);
    ig.addColorStop(0.55, C.iris);
    ig.addColorStop(1, C.irisRim);
    g.fillStyle = ig;
    g.beginPath();
    g.ellipse(ex + w * 0.16, ey, w * 0.42, h / 2 - 0.1, 0, 0, Math.PI * 2);
    g.fill();
    // 홍채 결
    g.strokeStyle = "rgba(150,80,20,0.35)";
    g.lineWidth = 0.3;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      g.beginPath();
      g.moveTo(ex + w * 0.24 + Math.cos(a) * w * 0.1, ey + Math.sin(a) * h * 0.12);
      g.lineTo(ex + w * 0.24 + Math.cos(a) * w * 0.36, ey + Math.sin(a) * h * 0.4);
      g.stroke();
    }
    // 동공 (세로로 긴 고양이 동공)
    g.fillStyle = C.pupil;
    g.beginPath();
    g.ellipse(ex + w * 0.27, ey + 0.1, o.wide ? w * 0.26 : w * 0.17, o.wide ? h * 0.38 : h * 0.33, 0, 0, Math.PI * 2);
    g.fill();
    // 윗눈꺼풀 그림자
    g.fillStyle = "rgba(20,16,24,0.22)";
    g.fillRect(ex - w, ey - h, w * 2, h * 0.55);
    g.restore();
    // 반사광
    g.fillStyle = "#ffffff";
    g.beginPath();
    g.ellipse(ex + w * 0.12, ey - h * 0.18, near ? 1.2 : 0.9, near ? 1.1 : 0.85, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.ellipse(ex + w * 0.34, ey + h * 0.2, near ? 0.55 : 0.45, near ? 0.5 : 0.4, 0, 0, Math.PI * 2);
    g.fill();
    // 아래 눈꺼풀 촉촉한 빛 + 눈물 자국 라인
    g.strokeStyle = "rgba(240,240,248,0.6)";
    g.lineWidth = 0.4;
    g.beginPath();
    g.moveTo(ex - w / 3, ey + h * 0.5);
    g.quadraticCurveTo(ex, ey + h * 0.62, ex + w / 3, ey + h * 0.45);
    g.stroke();
    g.strokeStyle = "rgba(90,94,110,0.25)";
    g.lineWidth = 0.5;
    g.beginPath();
    g.moveTo(ex + w / 2 + 0.6, ey + 0.2);
    g.quadraticCurveTo(ex + w / 2 + 1.6, ey + 2.2, ex + w / 2 + 1.2, ey + 4);
    g.stroke();
  };
  eye(-4, -1.8, 4.6, 5.6, false);
  eye(6, -2, 6.8, 6.8, true);
  g.restore();
  whiskerAt = { x: hx + 12, y: hy + 5, tilt: o.tilt ?? 0 };
}

/** 마지막으로 그린 고양이 얼굴 위치 (수염을 외곽선 위에 그리기 위해) */
let whiskerAt: { x: number; y: number; tilt: number } | null = null;

/** 다리 하나 (어깨/엉덩이 → 관절 → 발) */
function catLegPath(pts: Array<[number, number]>, radii: number[]): Part[] {
  const parts: Part[] = [];
  for (let i = 0; i < pts.length - 1; i++) parts.push({ kind: "c", x0: pts[i][0], y0: pts[i][1], r0: radii[i], x1: pts[i + 1][0], y1: pts[i + 1][1], r1: radii[i + 1] });
  return parts;
}

function paw(g: CanvasRenderingContext2D, x: number, y: number, far: boolean): void {
  g.fillStyle = far ? mix(C.pale, -0.15) : C.pale;
  g.beginPath();
  g.ellipse(x + 1.6, y, 4.4, 2.6, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "rgba(80,84,100,0.6)";
  g.lineWidth = 0.45;
  for (const dx of [0.6, 2.4]) {
    g.beginPath();
    g.moveTo(x + dx, y + 0.4);
    g.lineTo(x + dx + 0.3, y + 2.2);
    g.stroke();
  }
}

function frontLegParts(sx: number, sy: number, ang: number, lift: number): { parts: Part[]; foot: [number, number] } {
  const [ex, ey] = bend(sx, sy, 8, ang);
  const [wx, wy] = bend(ex, ey, 7, ang + lift * 0.9);
  const [fx, fy] = bend(wx, wy, 2.5, ang + lift * 1.4 + 0.2);
  return { parts: catLegPath([[sx, sy], [ex, ey], [wx, wy], [fx, fy]], [5, 3.6, 2.8, 2.6]), foot: [fx, fy] };
}

function hindLegParts(hx: number, hy: number, ang: number, lift: number): { parts: Part[]; foot: [number, number] } {
  const [kx, ky] = bend(hx + 2, hy + 3, 7.5, ang + 0.6);
  const [ax, ay] = bend(kx, ky, 7, ang - 0.7 - lift * 0.5);
  const [fx, fy] = bend(ax, ay, 4.5, ang + 0.15 - lift * 0.2);
  return { parts: [{ kind: "e", x: hx + 1, y: hy + 3, rx: 8.5, ry: 9.5, rot: 0.2 }, ...catLegPath([[kx, ky], [ax, ay], [fx, fy]], [4.2, 2.8, 2.6])], foot: [fx, fy] };
}

/** 꼬리 (풍성하게 퍼지는 긴 털) */
function catTail(g: CanvasRenderingContext2D, a: [number, number], b: [number, number], c: [number, number], thick: number, seed: number): void {
  const pts: Array<[number, number]> = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    pts.push([(1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * b[0] + t * t * c[0], (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * b[1] + t * t * c[1]]);
  }
  const radii = pts.map((_, i) => thick * (0.7 + Math.sin((i / 10) * Math.PI) * 0.5) * (i === 10 ? 0.6 : 1));
  const dir = Math.atan2(c[1] - a[1], c[0] - a[0]);
  furMass(g, catLegPath(pts, radii), { flow: dir, seed, strands: 260, edge: 3, tone: -0.02 });
  // 꼬리 끝 조금 진하게
  g.fillStyle = "rgba(80,84,100,0.25)";
  g.beginPath();
  g.ellipse(c[0], c[1], thick * 0.9, thick * 0.8, 0, 0, Math.PI * 2);
  g.fill();
}

function paintCat(p: Px, pose: string): void {
  const g = p.ctx!;
  if (pose.startsWith("sit") || pose === "blink") {
    const k = pose.startsWith("sitT") ? Number(pose.slice(4)) : 0;
    const flick = Math.sin((k / 8) * Math.PI * 2);
    catTail(g, [42, 82], [62, 92], [88 + flick * 2, 85 - flick * 4], 4.6, 21);
    // 엉덩이 + 세운 몸통 + 가슴 갈기
    furMass(g, [{ kind: "e", x: 50, y: 68, rx: 17, ry: 16 }, { kind: "e", x: 62, y: 54, rx: 12.5, ry: 19, rot: 0.15 }, { kind: "e", x: 70, y: 40, rx: 8, ry: 9 }], { flow: Math.PI * 0.55, seed: 1, light: [52, 44] });
    // 앞다리 (먼 쪽, 가까운 쪽)
    const legFar = catLegPath([[66, 60], [66, 76], [66.5, 85]], [4.2, 3.2, 2.8]);
    furMass(g, legFar, { flow: Math.PI / 2, seed: 4, far: true, strands: 50, edge: 0.8 });
    paw(g, 65, 86, true);
    furMass(g, [{ kind: "e", x: 70, y: 50, rx: 8.5, ry: 13 }], { flow: Math.PI * 0.55, seed: 9, tone: 0.18, strands: 180, edge: 2.6 });
    const legNear = catLegPath([[73, 62], [73, 77], [73.5, 85]], [4.4, 3.4, 2.9]);
    furMass(g, legNear, { flow: Math.PI / 2, seed: 5, tone: 0.06, strands: 60, edge: 0.8 });
    paw(g, 72, 86, false);
    // 뒷발
    furMass(g, [{ kind: "e", x: 54, y: 84, rx: 9, ry: 3.4 }], { flow: 0, seed: 6, strands: 30, edge: 0.8 });
    paintCatHead(g, 73, 25, { closed: pose === "blink" }, 30);
    return;
  }
  if (pose === "loaf") {
    catTail(g, [36, 84], [30, 88], [52, 87], 4, 22);
    furMass(g, [{ kind: "e", x: 58, y: 73, rx: 27, ry: 13 }, { kind: "e", x: 78, y: 70, rx: 12, ry: 12 }], { flow: Math.PI, seed: 2, light: [50, 62] });
    furMass(g, [{ kind: "e", x: 82, y: 78, rx: 9, ry: 7 }], { flow: Math.PI / 2, seed: 3, tone: 0.18, strands: 90, edge: 2 });
    paintCatHead(g, 88, 57, { closed: true }, 31);
    return;
  }
  if (pose === "jump") {
    catTail(g, [32, 50], [14, 46], [6, 32], 4.6, 23);
    const hf = hindLegParts(34, 50, -0.9, 0);
    furMass(g, hf.parts, { flow: Math.PI * 0.9, seed: 11, far: true, strands: 80 });
    const ff = frontLegParts(84, 52, 1.35, -0.4);
    furMass(g, ff.parts, { flow: 0.2, seed: 12, far: true, strands: 50 });
    furMass(g, [{ kind: "e", x: 44, y: 50, rx: 13, ry: 11 }, { kind: "e", x: 62, y: 50, rx: 19, ry: 10 }, { kind: "e", x: 80, y: 50, rx: 12, ry: 11 }], { flow: Math.PI, seed: 13 });
    const hn = hindLegParts(38, 52, -1.0, 0.1);
    furMass(g, hn.parts, { flow: Math.PI * 0.9, seed: 14, strands: 80 });
    const fn = frontLegParts(88, 54, 1.45, -0.3);
    furMass(g, fn.parts, { flow: 0.2, seed: 15, strands: 50 });
    paw(g, fn.foot[0], fn.foot[1], false);
    furMass(g, [{ kind: "e", x: 88, y: 48, rx: 9, ry: 10 }], { flow: Math.PI * 0.6, seed: 16, tone: 0.16, strands: 100, edge: 2.2 });
    paintCatHead(g, 98, 37, { wide: true, earsBack: true, tilt: 0.1 }, 32);
    return;
  }
  if (pose === "startle") {
    catTail(g, [32, 46], [20, 28], [28, 6], 7, 24);
    for (const [x, far] of [[36, true], [80, true]] as const) {
      const leg = x < 50 ? hindLegParts(x, 50, -0.3, 0) : frontLegParts(x, 50, 0, 0);
      furMass(g, leg.parts, { flow: Math.PI / 2, seed: x, far, strands: 60 });
      paw(g, leg.foot[0], leg.foot[1], true);
    }
    furMass(g, [{ kind: "e", x: 44, y: 44, rx: 14, ry: 13 }, { kind: "e", x: 60, y: 34, rx: 20, ry: 13 }, { kind: "e", x: 80, y: 44, rx: 12, ry: 12 }], { flow: Math.PI * 1.1, seed: 17, edge: 3.4 });
    for (const [x, far] of [[42, false], [84, false]] as const) {
      const leg = x < 50 ? hindLegParts(x, 52, -0.3, 0) : frontLegParts(x, 52, 0, 0);
      furMass(g, leg.parts, { flow: Math.PI / 2, seed: x + 1, far, strands: 60 });
      paw(g, leg.foot[0], leg.foot[1], false);
    }
    paintCatHead(g, 95, 44, { wide: true, hiss: true, earsBack: true }, 33);
    return;
  }
  // 걷기 16프레임 (+ 박치기)
  const butt = pose === "butt";
  const ph = butt ? 0 : (Number(pose.slice(4)) / 16) * Math.PI * 2;
  const swing = (q: number) => Math.sin(q) * 0.42;
  const lift = (q: number) => Math.max(0, Math.cos(q)) * 0.95;
  // 다리를 먼저 계산해 낮은 발이 땅에 닿도록 몸 높이를 정한다
  const legsAt = (by: number) => ({
    hf: hindLegParts(42, by + 33, swing(ph + Math.PI), lift(ph + Math.PI)),
    ff: frontLegParts(76, by + 36, swing(ph), lift(ph)),
    hn: hindLegParts(46, by + 34, swing(ph), lift(ph)),
    fn: frontLegParts(81, by + 37, swing(ph + Math.PI), lift(ph + Math.PI)),
  });
  const probe = legsAt(0);
  const low = Math.max(probe.hf.foot[1], probe.ff.foot[1], probe.hn.foot[1], probe.fn.foot[1]);
  const by = GROUND_Y - 2 - low;
  const L = legsAt(by);
  const sway = Math.sin(ph + 1) * 2.5;
  catTail(g, [32, by + 28], [12, by + 20], [16 + sway, by], 5, 25);
  furMass(g, L.hf.parts, { flow: Math.PI * 0.6, seed: 41, far: true, strands: 90 });
  paw(g, L.hf.foot[0], L.hf.foot[1], true);
  furMass(g, L.ff.parts, { flow: Math.PI * 0.55, seed: 42, far: true, strands: 60 });
  paw(g, L.ff.foot[0], L.ff.foot[1], true);
  // 몸통: 엉덩이 · 허리 · 깊은 가슴 · 목
  furMass(g, [{ kind: "e", x: 44, y: by + 29, rx: 14, ry: 13 }, { kind: "e", x: 60, y: by + 30, rx: 16, ry: 12 }, { kind: "e", x: 76, y: by + 29, rx: 13, ry: 13.5 }, { kind: "e", x: 86, y: by + 20, rx: 8, ry: 9, rot: -0.4 }], { flow: Math.PI * 1.02, seed: 43 });
  furMass(g, [{ kind: "e", x: 62, y: by + 39, rx: 15, ry: 4.5 }], { flow: Math.PI * 0.55, seed: 44, tone: 0.16, strands: 120, edge: 2 });
  furMass(g, L.hn.parts, { flow: Math.PI * 0.6, seed: 45, strands: 90 });
  paw(g, L.hn.foot[0], L.hn.foot[1], false);
  furMass(g, L.fn.parts, { flow: Math.PI * 0.55, seed: 46, tone: 0.04, strands: 60 });
  paw(g, L.fn.foot[0], L.fn.foot[1], false);
  // 가슴 갈기
  furMass(g, [{ kind: "e", x: 86, y: by + 28, rx: 8.5, ry: 10 }], { flow: Math.PI * 0.55, seed: 47, tone: 0.2, strands: 140, edge: 2 });
  const nod = Math.sin(ph * 2) * 0.7;
  if (butt) paintCatHead(g, 97, by + 19, { happy: true, tilt: 0.25 }, 34);
  else paintCatHead(g, 96, by + 11 + nod, {}, 34);
}

/** 고양이 스프라이트 (화면 32×24 자리에 촘촘한 도트) */
export function cat(pose: CatPose, facing: 1 | -1, silhouette = false): HTMLCanvasElement {
  const key = `c:${pose}:${facing}:${silhouette}`;
  return cached(key, () => {
    const base = cached(`c:${pose}:1:false`, () => {
      whiskerAt = null;
      const k = density / 4;
      const c = bakeVec(CW, CH, k, (p) => paintCat(p, pose), "#4a4d5c", 0.7);
      const w = whiskerAt as { x: number; y: number; tilt: number } | null;
      if (w) {
        // 수염은 외곽선 위에, 가늘고 길게
        const g = c.getContext("2d")!;
        g.setTransform(k, 0, 0, k, 0, 0);
        g.translate(w.x, w.y);
        g.rotate(w.tilt);
        g.lineCap = "round";
        for (const [dy, len, b] of [[-1.5, 14, -3], [0, 16, -0.5], [1.5, 15, 2], [3, 12, 4]]) {
          g.strokeStyle = "rgba(252,252,255,0.85)";
          g.lineWidth = 0.35;
          g.beginPath();
          g.moveTo(-2, dy);
          g.quadraticCurveTo(len * 0.45, dy + b * 0.3, len, dy + b);
          g.stroke();
        }
        // 눈썹 수염
        g.beginPath();
        g.moveTo(-8, -12);
        g.quadraticCurveTo(-4, -18, 2, -19);
        g.moveTo(-6, -12);
        g.quadraticCurveTo(-1, -16, 5, -16);
        g.stroke();
        g.setTransform(1, 0, 0, 1, 0, 0);
      }
      return c;
    });
    let out = facing === 1 ? base : flip(base);
    if (silhouette) {
      const c = makeCanvas(out.width, out.height);
      const g = c.getContext("2d")!;
      g.drawImage(out, 0, 0);
      g.globalCompositeOperation = "source-in";
      g.fillStyle = "#07060a";
      g.fillRect(0, 0, c.width, c.height);
      out = c;
    }
    return out;
  });
}

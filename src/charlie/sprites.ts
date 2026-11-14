// 캐릭터 도트 (초고밀도): 찰리 · 샘 · 좀비 · 해골 · 개구리 인간
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

export interface Look {
  skin: string;
  skinShade: string;
  skinLight: string;
  hair: string;
  hairShade: string;
  hairLight: string;
  hairStyle: "pomp" | "messy" | "skull" | "frog" | "hood";
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
  const eye = (ex: number, w: number, h: number) => {
    if (mode.closed) {
      curve(p, ex - 1, ey + 2, ex + w / 2, ey + 4, ex + w + 1, ey + 2, mix(L.skinShade, -0.35), 1);
      return;
    }
    ellipse(p, ex + w / 2, ey + h / 2, w / 2 + 0.5, h / 2, "#f8f4ec");
    ellipse(p, ex + w - 2, ey + h / 2, 2.6, h / 2 - 0.3, L.eye);
    p(ex + w - 3, ey + h / 2, 3, h / 2 - 0.5, mix(L.eye, -0.35));
    p(ex + w - 2.5, ey + 1.5, 1.6, h - 2.5, "#0c0a08");
    p(ex + w - 3, ey + 1, 1, 1, "#ffffff");
    p(ex + w - 1, ey + h - 2, 1, 1, "rgba(255,255,255,0.7)");
    // 윗눈꺼풀 (굵게) + 속눈썹
    curve(p, ex - 1, ey + 1, ex + w / 2, ey - 1.5, ex + w + 1, ey + 0.5, mix(L.skinShade, -0.45), 1);
    p(ex + w, ey - 1, 2, 1, mix(L.skinShade, -0.45));
    p(ex, ey + h, w, 1, mix(L.skin, -0.06));
    if (mode.shock) ellipse(p, ex + w / 2, ey + h / 2, w / 2, h / 2 + 0.5, "#f8f4ec");
    if (mode.shock) p(ex + w / 2 - 0.5, ey + h / 2 - 0.5, 2, 2, "#0c0a08");
  };
  eye(hx - 9, 6, 6);
  eye(hx + 5, 8, 7);
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

// ── 고양이 샘 (밝은 회색 아기 페르시안) ─────────────────────
// 머리를 크게, 눈을 크고 동그랗게, 다리는 짧게: 아기 고양이 비율
export type CatPose = string;
const CW = 128;
const CH = 96;
const CFEET = 88;

const F = "#c8cbd5";
const FL = "#e4e7ed";
const FLL = "#f8f9fc";
const FS = "#a5a9b8";
const FD = "#8a8fa0";
const FDD = "#6a6f82";
const IRIS_T = "#c86a1c";
const IRIS = "#f0a23a";
const IRIS_B = "#ffd27a";
const PUP = "#24140c";
const NOSE = "#f29aaa";
const EAR = "#f4b6c2";
const BLUSH = "#f7b2c0";

/** 털 덩어리: 그림자 → 바탕 → 빛 → 하이라이트, 가장자리 털 가닥과 안쪽 털 결 */
function fur(p: Px, cx: number, cy: number, rx: number, ry: number, base = F, light = FL, shade = FS, seed = 1): void {
  ellipse(p, cx + 1.5, cy + 2, rx, ry, shade);
  ellipse(p, cx + 0.5, cy + 0.8, Math.max(1, rx - 1.2), Math.max(1, ry - 1.2), mix(base, -0.05));
  ellipse(p, cx, cy, Math.max(1, rx - 2), Math.max(1, ry - 2), base);
  ellipse(p, cx - rx * 0.28, cy - ry * 0.32, Math.max(1, rx * 0.55), Math.max(1, ry * 0.42), light);
  ellipse(p, cx - rx * 0.38, cy - ry * 0.45, Math.max(0.8, rx * 0.25), Math.max(0.6, ry * 0.18), mix(light, 0.4));
  // 가장자리: 구름처럼 동글동글한 털 뭉치
  const step = Math.max(0.3, 3.2 / Math.max(rx, ry));
  for (let a = 0; a < Math.PI * 2; a += step) {
    const up = Math.sin(a) < 0.3;
    const r = 2.2 + ((Math.floor(a * 11) + seed) % 3) * 0.5;
    const tx = cx + Math.cos(a) * (rx - r * 1.05);
    const ty = cy + Math.sin(a) * (ry - r * 1.05);
    ellipse(p, tx + 0.6, ty + 0.8, r, r, up ? base : shade);
  }
  // 안쪽 털 결 (짧은 사선)
  const n = Math.floor(rx * ry * 0.08);
  for (let i = 0; i < n; i++) {
    const a = (i * 2.399 + seed) % (Math.PI * 2);
    const d = ((i * 0.618 + seed * 0.1) % 1) * 0.8;
    const tx = cx + Math.cos(a) * rx * d;
    const ty = cy + Math.sin(a) * ry * d;
    const col = ty < cy - ry * 0.2 ? light : ty > cy + ry * 0.3 ? shade : mix(base, -0.07);
    curve(p, tx, ty, tx + 0.8, ty + 1.2, tx + 1.2, ty + 2.6, col, 0.9);
  }
}

function catLeg(p: Px, hx: number, hy: number, ang: number, kn: number, near: boolean): [number, number] {
  const L1 = 8.5;
  const [kx, ky] = bend(hx, hy, L1, ang);
  const [ax, ay] = bend(kx, ky, L1, ang - kn);
  const c = near ? F : FS;
  capsule(p, hx + 1, hy, kx + 1, ky, 6.6, mix(c, -0.2));
  capsule(p, hx - 0.5, hy, kx - 0.5, ky, 5.6, c);
  capsule(p, kx + 0.8, ky, ax + 0.8, ay, 5.4, mix(c, -0.18));
  capsule(p, kx - 0.4, ky, ax - 0.4, ay, 4.6, c);
  if (near) capsule(p, kx - 2, ky, ax - 2, ay, 1.4, FL);
  // 동글동글한 발
  ellipse(p, ax + 2.5, ay + 1.5, 6.5, 3.8, near ? mix(FL, -0.08) : F);
  ellipse(p, ax + 2, ay + 0.8, 5.5, 2.8, near ? FL : F);
  if (near) {
    p(ax + 1, ay - 1, 4, 1, FLL);
    p(ax + 3, ay + 2, 1, 2, FD);
    p(ax + 6, ay + 2, 1, 2, FD);
  }
  return [ax, ay];
}

/** 마지막으로 그린 고양이 얼굴 위치 (수염을 외곽선 위에 그리기 위해) */
let whiskerAt: { x: number; y: number } | null = null;

function catFace(p: Px, hx: number, hy: number, o: { closed?: boolean; wide?: boolean; happy?: boolean; hiss?: boolean }): void {
  // 귀: 작고 둥글며 안쪽에 분홍빛 + 털 뭉치
  for (const [ex, tilt] of [[hx - 13, -1], [hx + 8, 1]] as const) {
    ellipse(p, ex + tilt, hy - 17, 7.5, 9, FS);
    ellipse(p, ex + tilt * 0.5, hy - 17.5, 6.5, 8, F);
    ellipse(p, ex + tilt * 0.8, hy - 16, 3.6, 5, EAR);
    for (let i = 0; i < 3; i++) curve(p, ex - 1 + i * 1.4, hy - 13, ex + i * 1.2, hy - 17, ex + i * 1.5 + tilt, hy - 21, FLL, 1);
  }
  // 동그란 큰 머리
  fur(p, hx, hy, 22, 19, F, FL, FS, 3);
  // 볼 갈기 (통통한 볼)
  fur(p, hx + 3, hy + 11, 20, 9, FL, FLL, F, 5);
  // 볼 홍조
  ellipse(p, hx - 9, hy + 9, 4.5, 2.2, BLUSH);
  ellipse(p, hx + 15, hy + 9, 5, 2.4, BLUSH);
  // 눈 (크고 동그란 구리빛, 반짝이 3개)
  const ey = hy - 5;
  const eye = (ex: number, w: number, h: number) => {
    if (o.closed || o.happy) {
      if (o.happy) curve(p, ex, ey + h * 0.6, ex + w / 2, ey + h * 0.15, ex + w, ey + h * 0.6, FDD, 2.2);
      else curve(p, ex, ey + h * 0.45, ex + w / 2, ey + h * 0.7, ex + w, ey + h * 0.45, FDD, 2.2);
      return;
    }
    const cx = ex + w / 2;
    const cy = ey + h / 2;
    ellipse(p, cx, cy + 0.5, w / 2 + 1.4, h / 2 + 1.4, FDD);
    ellipse(p, cx, cy, w / 2, h / 2, IRIS_T);
    ellipse(p, cx, cy + h * 0.12, w / 2 - 0.4, h / 2 - 1.4, IRIS);
    ellipse(p, cx, cy + h * 0.28, w / 2 - 1.6, h / 4, IRIS_B);
    const pw = o.wide ? w * 0.42 : w * 0.3;
    ellipse(p, cx, cy, pw, h / 2 - (o.wide ? 0.6 : 1.6), PUP);
    // 반짝이
    ellipse(p, cx - w * 0.2, cy - h * 0.22, w * 0.2, w * 0.2, "#ffffff");
    ellipse(p, cx + w * 0.22, cy + h * 0.2, w * 0.09, w * 0.09, "#ffffff");
    p(cx - w * 0.05, cy - h * 0.38, 1, 1, "#ffffff");
    // 윗눈꺼풀
    curve(p, ex - 1.5, ey + 1.5, cx, ey - 3, ex + w + 1.5, ey + 1.5, FDD, 1.8);
  };
  eye(hx - 13, 11, 14);
  eye(hx + 4, 13, 15);
  // 작은 하트 코
  ellipse(p, hx + 17, ey + 15, 2.4, 1.8, NOSE);
  ellipse(p, hx + 20, ey + 15, 2.4, 1.8, NOSE);
  for (let i = 0; i < 3; i++) p(hx + 16.5 + i * 0.6, ey + 16 + i, 5 - i * 1.6, 1, NOSE);
  p(hx + 17, ey + 14, 1.5, 1, "#ffd4dc");
  if (o.hiss) {
    ellipse(p, hx + 18, ey + 23, 6, 4.5, "#4a1e24");
    p(hx + 13, ey + 20, 2, 4, "#ffffff");
    p(hx + 22, ey + 20, 2, 4, "#ffffff");
    ellipse(p, hx + 18, ey + 25, 3, 1.5, "#e07a8a");
  } else {
    // ω 입
    p(hx + 18.5, ey + 18, 1, 2, FD);
    curve(p, hx + 14, ey + 20, hx + 16, ey + 23, hx + 19, ey + 20, FD, 1.1);
    curve(p, hx + 19, ey + 20, hx + 22, ey + 23, hx + 24, ey + 20, FD, 1.1);
  }
  whiskerAt = { x: hx + 26, y: ey + 12 };
}

function paintCat(p: Px, pose: string): void {
  if (pose.startsWith("sit") || pose === "blink") {
    const k = pose.startsWith("sitT") ? Number(pose.slice(4)) : 0;
    const flick = Math.sin((k / 8) * Math.PI * 2);
    // 앞으로 감싼 꼬리
    for (let i = 0; i < 9; i++) {
      const tx = 24 + i * 6.5;
      const ty = 82 - Math.sin(i * 0.35) * 3 + (i === 8 ? -flick * 7 : i === 7 ? -flick * 4 : i === 6 ? -flick * 1.5 : 0);
      fur(p, tx, ty, 8 - Math.abs(i - 4) * 0.35, 6.2, i > 6 ? FL : F, FLL, FS, i);
    }
    // 동그란 몸통
    fur(p, 56, 64, 22, 20, F, FL, FS, 7);
    fur(p, 46, 70, 11, 12, FS, F, FD, 2);
    // 가슴 갈기 (솜사탕처럼)
    fur(p, 66, 58, 15, 16, FL, FLL, F, 9);
    fur(p, 68, 53, 9, 8, FLL, "#ffffff", FL, 11);
    // 짧은 앞발
    for (const fx of [61, 73]) {
      capsule(p, fx + 1, 70, fx + 1, 82, 5.6, mix(fx > 66 ? FL : F, -0.15));
      capsule(p, fx, 70, fx, 82, 4.8, fx > 66 ? FL : F);
      ellipse(p, fx + 2, 84, 6.4, 3.6, FLL);
      p(fx + 1, 85, 1, 2, FD);
      p(fx + 4, 85, 1, 2, FD);
    }
    catFace(p, 68, 30, { closed: pose === "blink" });
    return;
  }
  if (pose === "loaf") {
    for (let i = 0; i < 6; i++) fur(p, 14 + i * 7, 80, 7, 5, F, FL, FS, i);
    fur(p, 54, 70, 30, 16, F, FL, FS, 4);
    fur(p, 58, 78, 20, 7, FL, FLL, F, 6);
    catFace(p, 84, 56, { closed: true });
    return;
  }
  if (pose === "jump") {
    // 쭉 뻗은 점프: 앞발은 앞으로, 뒷발은 뒤로
    for (let i = 0; i < 8; i++) fur(p, 22 - i * 2.5, 52 - i * 3, 8.4 - i * 0.3, 6.6, i > 5 ? FL : F, FLL, FS, i);
    catLeg(p, 40, 60, -1.0, 0.2, false);
    catLeg(p, 80, 56, 1.1, -0.2, false);
    fur(p, 60, 54, 28, 13, F, FL, FS, 1);
    fur(p, 64, 62, 18, 5, FL, FLL, F, 4);
    catLeg(p, 46, 62, -1.2, 0.3, true);
    catLeg(p, 86, 58, 1.25, -0.1, true);
    fur(p, 86, 50, 11, 12, FL, FLL, F, 6);
    catFace(p, 96, 36, { wide: true });
    return;
  }
  if (pose === "startle") {
    // 아치형 등 + 곤두선 털 + 부푼 꼬리
    const legs: Array<[number, boolean]> = [[30, false], [42, true], [74, false], [86, true]];
    for (const [lx, near] of legs) catLeg(p, lx, 58, 0, 0, near);
    for (let i = 0; i < 7; i++) fur(p, 22 - i * 1.2, 48 - i * 7, 11 - i * 0.5, 9, i > 4 ? FL : F, FLL, FS, i);
    fur(p, 58, 46, 30, 15, F, FL, FS, 2);
    fur(p, 58, 34, 20, 9, F, FL, FS, 8);
    for (let x = 32; x < 84; x += 3) curve(p, x, 24 - Math.sin(((x - 32) / 52) * Math.PI) * 5, x + 1, 18 - Math.sin(((x - 32) / 52) * Math.PI) * 6, x - 1, 14 - Math.sin(((x - 32) / 52) * Math.PI) * 7, FL);
    fur(p, 62, 56, 18, 6, FL, FLL, F, 3);
    catFace(p, 94, 44, { wide: true, hiss: true });
    return;
  }
  // 걷기 16프레임 (+ 박치기): 짧은 다리로 총총
  const butt = pose === "butt";
  const ph = butt ? 0 : (Number(pose.slice(4)) / 16) * Math.PI * 2;
  const legA = (q: number): [number, number] => {
    const v = Math.cos(q);
    return [Math.sin(q) * 0.6, v > 0 ? v * 0.95 : 0.05];
  };
  const probe = (q: number) => {
    const [a, kn] = legA(q);
    const [kx, ky] = bend(0, 0, 8.5, a);
    return bend(kx, ky, 8.5, a - kn)[1];
  };
  const low = Math.max(probe(ph), probe(ph + Math.PI));
  const by = CFEET - 3.8 - low - 46;
  const tailSway = Math.sin(ph + 1) * 0.35;
  // 꼬리 (깃털처럼 풍성하게, 위로 살랑)
  for (let i = 0; i < 9; i++) {
    const t = i / 8;
    const tx = 26 - Math.sin(t * 1.5 + tailSway) * 16;
    const ty = by + 36 - t * 30;
    fur(p, tx, ty, 8 + Math.sin(t * Math.PI) * 3.2, 7, t > 0.7 ? FL : F, FLL, FS, i);
  }
  // 먼 쪽 다리
  catLeg(p, 38, by + 44, ...legA(ph + Math.PI), false);
  catLeg(p, 76, by + 44, ...legA(ph), false);
  // 몸통 (짧고 동그랗게)
  fur(p, 57, by + 36, 26, 15, F, FL, FS, 1);
  fur(p, 60, by + 45, 17, 6, FL, FLL, F, 4);
  // 가까운 쪽 다리
  catLeg(p, 44, by + 46, ...legA(ph), true);
  catLeg(p, 82, by + 46, ...legA(ph + Math.PI), true);
  // 가슴 갈기 + 큰 머리
  fur(p, 84, by + 34, 12, 13, FL, FLL, F, 6);
  const nod = Math.sin(ph * 2) * 1.2;
  if (butt) catFace(p, 98, by + 24, { happy: true });
  else catFace(p, 94, by + 14 + nod, {});
}

/** 고양이 스프라이트 (화면 32×24 자리에 촘촘한 도트) */
export function cat(pose: CatPose, facing: 1 | -1, silhouette = false): HTMLCanvasElement {
  const key = `c:${pose}:${facing}:${silhouette}`;
  return cached(key, () => {
    const base = cached(`c:${pose}:1:false`, () => {
      whiskerAt = null;
      const k = density / 4;
      // 고양이는 털이 부드럽게 보이도록 옅은 회색 외곽선을 얇게 두른다
      const c = bakeVec(CW, CH, k, (p) => paintCat(p, pose), "#5c5e6e", 1);
      const w = whiskerAt as { x: number; y: number } | null;
      if (w) {
        const g = c.getContext("2d")!;
        g.setTransform(k, 0, 0, k, 0, 0);
        const px = ((x: number, y: number, ww: number, hh: number, col: string) => {
          g.fillStyle = col;
          g.fillRect(x, y, ww, hh);
        }) as Px;
        px.ctx = g;
        for (const [dy, len, bend2] of [[-1, 13, -2], [2, 15, 0], [5, 12, 2]]) curve(px, w.x, w.y + dy, w.x + len / 2, w.y + dy + bend2 * 0.5, w.x + len, w.y + dy + bend2, "rgba(255,255,255,0.9)", 0.9);
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

// 캐릭터 도트 (고해상도): 찰리 · 샘 · 좀비 · 해골 · 개구리 인간
//
// 화면 좌표 1칸 = 스프라이트 2도트. 캐릭터는 화면에서 32×54 크기로 그려지지만
// 실제로는 64×108 도트로 칠해져서 같은 크기 안에 4배의 디테일이 들어간다.
// 팔다리는 관절(엉덩이·무릎·어깨·팔꿈치) 각도로 움직이고, 몸 높이는
// 땅에 닿은 발에 맞춰 저절로 정해진다.
import { bake, cached, ellipse, flip, makeCanvas, mix, type Px } from "./pixel";

export const HUMAN_W = 32; // 화면 기준 크기
export const HUMAN_H = 54;
const SW = 64; // 실제 도트 크기
const SH = 108;
const CX = 30;
const FEET = 104;
const OUTLINE = "#140d0b";

export type Pose = string;

export interface Build {
  legLen: number;
  torsoLen: number;
}
export const BUILD_3: Build = { legLen: 30, torsoLen: 23 };
export const BUILD_25: Build = { legLen: 21, torsoLen: 19 };

export interface Look {
  skin: string;
  skinShade: string;
  skinLight: string;
  hair: string;
  hairShade: string;
  hairLight: string;
  hairStyle: "pomp" | "messy" | "skull" | "frog" | "hood";
  /** 몸통 무늬 (lx, ly = 몸통 안 좌표) */
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
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 1.5));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    disk(p, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r, c);
  }
}
/** 원통형 팔다리: 뒤쪽 그림자 → 몸통 색 → 앞쪽 빛 */
function limb(p: Px, ax: number, ay: number, bx: number, by: number, r: number, base: string, stripe?: string): void {
  capsule(p, ax + 0.8, ay + 0.4, bx + 0.8, by + 0.4, r, mix(base, -0.28));
  capsule(p, ax - 0.2, ay, bx - 0.2, by, r - 0.7, base);
  if (stripe) {
    for (const t of [0.3, 0.72]) {
      const sx = ax + (bx - ax) * t;
      const sy = ay + (by - ay) * t;
      capsule(p, sx, sy, sx + (bx - ax) * 0.08, sy + (by - ay) * 0.08, r - 0.6, stripe);
    }
  }
  capsule(p, ax - r * 0.45, ay - 0.2, bx - r * 0.45, by - 0.2, Math.max(0.5, r * 0.28), mix(base, 0.22));
}

function bend(x: number, y: number, len: number, ang: number): [number, number] {
  return [x + Math.sin(ang) * len, y + Math.cos(ang) * len];
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
    r.lean = 1;
  } else if (pose.startsWith("crouch")) {
    const ph = (Number(pose.slice(6)) / 8) * Math.PI * 2;
    const leg = (q: number): [number, number] => [0.75 + Math.sin(q) * 0.3, 1.45 + Math.max(0, Math.cos(q)) * 0.35];
    r.legs = [leg(ph), leg(ph + Math.PI)];
    r.arms = [[0.65 + Math.sin(ph) * 0.1, 1.2], [0.5 - Math.sin(ph) * 0.1, 1.1]];
    r.lean = 5;
    r.head = 2;
  } else if (pose.startsWith("stand")) {
    const k = Number(pose.slice(5) || 0);
    r.breath = [0, 1, 1, 0][k % 4];
  } else if (pose === "sit" || pose === "drink" || pose === "sleep") {
    r.sit = true;
    r.legs = [[Math.PI / 2, Math.PI / 2], [Math.PI / 2 - 0.1, Math.PI / 2 - 0.05]];
    r.arms = [[0.55, 1.1], [0.45, 1.0]];
    if (pose === "drink") r.arms[0] = [0.35, 2.7];
    if (pose === "sleep") {
      r.arms = [[0.2, 0.3], [0.15, 0.25]];
      r.head = 3;
    }
  } else if (pose === "armsUp") {
    r.legs = [[0.18, 0.05], [-0.16, 0.05]];
    r.arms = [[Math.PI - 0.35, 0.3], [Math.PI - 0.6, 0.4]];
  } else if (pose === "flashlight") {
    r.arms = [[Math.PI / 2 - 0.05, 0.05], [0.1, 0.4]];
  }
  if (L.armsForward && !r.sit) {
    r.arms = [[Math.PI / 2 - 0.15, 0.1], [Math.PI / 2 - 0.05, 0.15]];
    r.lean += 1;
  }
  return r;
}

// ── 머리 ────────────────────────────────────────────────
function paintHair(p: Px, L: Look, hx: number, ft: number): void {
  const H = L.hair;
  const S = L.hairShade;
  const Li = L.hairLight;
  const D = mix(S, -0.32);
  const X = mix(Li, 0.55);
  if (L.hairStyle === "pomp") {
    // 뒷머리와 옆머리
    ellipse(p, hx - 3, ft + 1, 10, 7, S);
    p(hx - 10, ft, 4, 10, S);
    p(hx - 10, ft + 3, 2, 7, D);
    p(hx - 7, ft + 9, 2, 3, S);
    // 정수리 (넓고 둥글게)
    ellipse(p, hx, ft - 3, 11, 5, H);
    // 앞으로 넘긴 물결 앞머리 (2번 시안)
    ellipse(p, hx + 3, ft - 5.5, 9.5, 4, H);
    ellipse(p, hx + 6, ft - 6.5, 6.5, 2.6, Li);
    ellipse(p, hx + 8, ft - 7, 3, 1.2, X);
    // 이마로 살짝 내려온 앞머리
    for (let x = hx - 6; x <= hx + 10; x++) {
      const drop = 1 + ((x * 7) % 3 === 0 ? 1 : 0) + (x > hx + 4 ? 1 : 0);
      p(x, ft - 1, 1, drop + 1, x > hx + 5 ? H : S);
    }
    // 물결 머리결 (완만한 곡선)
    for (let k = 0; k < 6; k++) {
      const col = k % 2 ? Li : S;
      for (let t = 0; t <= 1; t += 0.05) {
        const x = hx - 9 + k * 1.2 + t * (19 - k);
        const y = ft - 1 - k * 0.7 - Math.sin(t * Math.PI) * (3 + k * 0.5) - Math.sin(t * Math.PI * 3) * 0.6;
        p(x, y, 1, 1, col);
      }
    }
    // 위쪽 물결 윤곽
    for (const [wx, wy] of [[hx - 6, ft - 8], [hx - 1, ft - 9], [hx + 4, ft - 10], [hx + 9, ft - 9]]) p(wx, wy, 3, 1, H);
    p(hx + 4, ft - 10, 2, 1, X);
    p(hx - 4, ft - 7, 2, 1, X);
    p(hx - 9, ft - 2, 3, 1, D);
  } else if (L.hairStyle === "messy") {
    ellipse(p, hx - 1, ft - 2, 10, 6, H);
    p(hx - 10, ft - 1, 4, 11, H);
    for (let i = 0; i < 9; i++) {
      const x = hx - 9 + i * 2.2;
      p(x, ft - 8 + (i % 3), 2, 3, i % 2 ? H : S);
      p(x + 1, ft - 1, 1, 2 + (i % 3), S);
    }
    p(hx - 4, ft - 5, 6, 1, D);
  } else if (L.hairStyle === "hood") {
    ellipse(p, hx - 1, ft + 3, 12, 12, H);
    ellipse(p, hx + 2, ft + 6, 8.5, 10, mix(H, -0.45));
    p(hx - 12, ft + 4, 3, 12, S);
    for (let y = ft - 6; y < ft + 14; y += 3) p(hx - 11, y, 2, 1, mix(H, 0.15));
  }
}

function paintHead(p: Px, L: Look, hx: number, ft: number, mode: { closed?: boolean; back?: boolean; shock?: boolean }): void {
  if (L.hairStyle === "skull") {
    const b = L.skin;
    const s = L.skinShade;
    ellipse(p, hx, ft + 5, 10, 10, b);
    ellipse(p, hx - 3, ft + 2, 6, 6, L.skinLight);
    p(hx - 9, ft + 6, 3, 7, s);
    p(hx - 5, ft + 14, 14, 6, b);
    ellipse(p, hx - 2, ft + 9, 3, 3, "#1a1614");
    ellipse(p, hx + 5, ft + 9, 3, 3, "#1a1614");
    p(hx - 2, ft + 9, 1, 1, "#6a2a2a");
    p(hx + 5, ft + 9, 1, 1, "#6a2a2a");
    p(hx + 2, ft + 13, 2, 3, "#1a1614");
    for (let i = 0; i < 6; i++) {
      p(hx - 3 + i * 2, ft + 17, 1, 3, b);
      p(hx - 2 + i * 2, ft + 17, 1, 3, "#3a332c");
    }
    p(hx - 5, ft + 20, 12, 1, s);
    p(hx + 7, ft + 11, 2, 3, s);
    return;
  }
  if (L.hairStyle === "frog") {
    const gr = L.skin;
    ellipse(p, hx + 1, ft + 9, 13, 10, gr);
    ellipse(p, hx - 3, ft + 5, 8, 5, L.skinLight);
    p(hx - 12, ft + 8, 3, 8, L.skinShade);
    ellipse(p, hx + 2, ft + 15, 10, 4, "#c8e09a");
    for (let x = hx - 8; x <= hx + 13; x++) p(x, ft + 12 + (x > hx + 8 ? -1 : 0), 1, 1, "#1e2a14");
    for (const ex of [hx - 4, hx + 6]) {
      disk(p, ex, ft - 1, 4.5, gr);
      disk(p, ex, ft - 1, 3.2, "#f4f0d8");
      p(ex - 2, ft - 1, 5, 2, "#0e0e0e");
      p(ex - 2, ft - 2, 1, 1, "#ffffff");
      p(ex - 3, ft - 5, 7, 1, L.skinShade);
    }
    p(hx + 10, ft + 7, 1, 1, L.skinShade);
    p(hx + 12, ft + 7, 1, 1, L.skinShade);
    for (const [sx, sy] of [[hx - 6, ft + 9], [hx + 3, ft + 4], [hx - 1, ft + 11]]) p(sx, sy, 2, 2, L.skinShade);
    if (L.crown) {
      p(hx - 5, ft - 9, 14, 3, "#e8c83a");
      for (let i = 0; i < 4; i++) p(hx - 5 + i * 4, ft - 12, 2, 3, "#e8c83a");
      p(hx + 1, ft - 8, 2, 1, "#c83a5a");
      p(hx - 5, ft - 9, 14, 1, "#fff0a0");
    }
    return;
  }
  // 얼굴 (3/4 오른쪽)
  const insetL = [3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3, 4, 6];
  const insetR = [3, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 2, 4];
  for (let r = 0; r < 20; r++) {
    const l = hx - 9 + insetL[r];
    const rr = hx + 9 - insetR[r];
    p(l, ft + r, rr - l, 1, L.skin);
    p(l, ft + r, 2, 1, L.skinShade);
    if (r > 6 && r < 14) p(rr - 6, ft + r, 4, 1, L.skinLight);
  }
  p(hx - 7, ft + 17, 6, 2, L.skinShade);
  p(hx - 6, ft + 1, 12, 2, mix(L.skin, -0.08));
  // 귀
  ellipse(p, hx - 8, ft + 10, 2, 3, L.skin);
  p(hx - 8, ft + 9, 1, 3, L.skinShade);
  if (mode.back) {
    ellipse(p, hx - 1, ft + 6, 10.5, 11, L.hair);
    ellipse(p, hx - 1, ft + 13, 9, 4, L.hairShade);
    for (let k = 0; k < 5; k++) p(hx - 7 + k * 3, ft - 2, 1, 14, k % 2 ? L.hairLight : L.hairShade);
    paintHair(p, L, hx, ft);
    return;
  }
  // 코
  p(hx + 9, ft + 8, 2, 4, L.skin);
  p(hx + 10, ft + 8, 1, 2, L.skinLight);
  p(hx + 7, ft + 12, 4, 1, L.skinShade);
  // 볼
  p(hx + 5, ft + 13, 3, 1, mix(L.skin, -0.06));
  p(hx + 5, ft + 13, 2, 1, "#eea08a");
  // 눈
  const ey = ft + 9;
  const eye = (ex: number, w: number) => {
    if (mode.closed) {
      p(ex - 1, ey + 1, w + 1, 1, mix(L.skinShade, -0.3));
      return;
    }
    p(ex - 1, ey - 1, w + 1, 1, mix(L.skinShade, -0.35));
    p(ex, ey, w, 3, "#f6f2ea");
    p(ex + w - 2, ey, 2, 3, L.eye);
    p(ex + w - 2, ey + 1, 1, 2, mix(L.eye, -0.5));
    p(ex + w - 2, ey, 1, 1, "#ffffff");
    if (mode.shock) p(ex, ey - 1, w, 1, "#f6f2ea");
  };
  eye(hx - 4, 3);
  eye(hx + 3, 4);
  // 눈썹
  const brow = L.brow ?? L.hairShade;
  p(hx - 5, ey - 4 - (mode.shock ? 1 : 0), 4, 1, brow);
  p(hx + 2, ey - 4 - (mode.shock ? 2 : 0), 6, 1, brow);
  p(hx + 7, ey - 3, 1, 1, brow);
  if (L.glasses) {
    const fr = "#6a3a1a";
    const frL = "#9a5a2a";
    // 렌즈 + 테
    p(hx - 6, ey - 2, 7, 1, fr);
    p(hx - 6, ey + 4, 7, 1, fr);
    p(hx - 6, ey - 2, 1, 7, fr);
    p(hx, ey - 2, 1, 7, fr);
    p(hx + 2, ey - 2, 8, 1, fr);
    p(hx + 2, ey + 4, 8, 1, fr);
    p(hx + 2, ey - 2, 1, 7, fr);
    p(hx + 9, ey - 2, 1, 7, fr);
    p(hx + 1, ey - 1, 1, 1, fr);
    p(hx - 6, ey - 2, 4, 1, frL);
    p(hx + 3, ey - 2, 4, 1, frL);
    p(hx - 9, ey - 1, 3, 1, fr);
    // 유리 반사
    p(hx + 7, ey - 1, 1, 2, "rgba(255,255,255,0.75)");
    p(hx + 6, ey + 2, 1, 1, "rgba(255,255,255,0.55)");
    p(hx - 2, ey - 1, 1, 1, "rgba(255,255,255,0.6)");
  }
  // 입
  if (mode.shock) {
    p(hx + 3, ft + 15, 4, 3, "#4a1e1a");
    p(hx + 4, ft + 17, 2, 1, "#c84a4a");
  } else {
    p(hx + 2, ft + 15, 5, 1, L.mouth);
    p(hx + 6, ft + 14, 1, 1, L.mouth);
    p(hx + 3, ft + 16, 3, 1, mix(L.skin, 0.12));
  }
  paintHair(p, L, hx, ft);
}

// ── 사람 전체 ────────────────────────────────────────────
function paintHuman(p: Px, L: Look, pose: string, B: Build): void {
  const R = rig(pose, L);
  const k = L.limb ?? 1;
  const thigh = B.legLen * 0.5;
  const shin = B.legLen * 0.5 - 4;
  const footH = 4;
  // 엉덩이를 원점으로 두고 다리를 계산한 뒤, 낮은 발이 땅에 닿게 몸 높이를 정한다
  const legPts = R.legs.map(([ha, kn]) => {
    const [kx, ky] = bend(0, 0, thigh, ha);
    const [ax, ay] = bend(kx, ky, shin, ha - kn);
    return { kx, ky, ax, ay };
  });
  const low = Math.max(legPts[0].ay, legPts[1].ay);
  const hipY = FEET - footH - 2 - low;
  const hipX = CX;
  const torsoTop = hipY - B.torsoLen - R.breath;
  const lean = R.lean + (L.hunch ?? 0);
  const tw = 20;

  const shoulder = (front: boolean): [number, number] => [hipX + lean + (front ? 6 : -6), torsoTop + 4];
  const armLen = [B.torsoLen * 0.48, B.torsoLen * 0.44];
  const drawArm = (front: boolean) => {
    const [sa, el] = R.arms[front ? 0 : 1];
    const [sx, sy] = shoulder(front);
    const [ex, ey] = bend(sx, sy, armLen[0], sa);
    const [hx, hy] = bend(ex, ey, armLen[1], sa + el);
    const base = front ? L.sleeve : L.sleeveShade;
    const stripe = L.sleeveStripe ? (front ? L.sleeveStripe : mix(L.sleeveStripe, -0.3)) : undefined;
    limb(p, sx, sy, ex, ey, 3.4 * k, base, stripe);
    limb(p, ex, ey, hx, hy, 3 * k, base, stripe);
    if (L.cuff) capsule(p, hx - (hx - ex) * 0.18, hy - (hy - ey) * 0.18, hx - (hx - ex) * 0.06, hy - (hy - ey) * 0.06, 3 * k, L.cuff);
    disk(p, hx, hy + 1, 2.7 * Math.max(0.8, k), front ? L.skin : L.skinShade);
    p(hx + 1, hy + 1, 1, 2, mix(L.skinShade, -0.1));
    if (front && pose === "flashlight") {
      p(hx - 1, hy - 2, 9, 5, "#2e2e38");
      p(hx - 1, hy - 2, 9, 1, "#5a5a68");
      p(hx + 8, hy - 3, 2, 7, "#fff3b8");
    }
    if (front && pose === "drink") {
      p(hx - 2, hy - 7, 5, 9, "#c4302a");
      p(hx - 1, hy - 7, 1, 9, "#e86a5a");
      p(hx - 2, hy - 8, 5, 1, "#d8d8e0");
      p(hx - 2, hy - 4, 5, 3, "#f0e2b0");
    }
  };
  const drawLeg = (i: number) => {
    const front = i === 0;
    const { kx, ky, ax, ay } = legPts[i];
    const hx = hipX + (front ? 3 : -3);
    const base = front ? L.pants : L.pantsShade;
    limb(p, hx, hipY + 2, hx + kx, hipY + 2 + ky, 4.2 * k, base);
    limb(p, hx + kx, hipY + 2 + ky, hx + ax, hipY + 2 + ay, 3.6 * k, base);
    // 신발
    const fx = hx + ax;
    const fy = hipY + 2 + ay;
    const lifted = fy < FEET - footH - 1;
    p(fx - 3, fy + 1, 10, 3, L.shoes);
    p(fx - 2, fy, 7, 1, L.shoes);
    p(fx - 3, fy + 3, 11, 1, mix(L.shoes, -0.4));
    p(fx + 3, fy + 1, 3, 1, mix(L.shoes, 0.35));
    if (lifted) p(fx + 6, fy + 3, 2, 1, mix(L.shoes, -0.4));
  };

  // 그리는 순서: 뒷팔 → 뒷다리 → 앞다리 → 몸통 → 앞팔 → 머리
  if (!R.sit) drawArm(false);
  drawLeg(1);
  drawLeg(0);
  // 엉덩이 (다리와 몸통 잇기)
  p(hipX - 9, hipY, 18, 6, L.pants);
  p(hipX - 9, hipY + 4, 18, 2, L.pantsShade);
  // 몸통
  const th = hipY - torsoTop;
  for (let ly = 0; ly < th; ly++) {
    const t = ly / th;
    const off = Math.round(lean * (1 - t));
    const w = ly < 2 ? tw - 4 + ly * 2 : ly > th - 3 ? tw - 2 : tw;
    const x0 = hipX - Math.floor(w / 2) + off;
    for (let lx = 0; lx < w; lx++) {
      let c = L.shirt(lx, ly, w, th);
      if (lx < 2) c = mix(c, 0.1);
      else if (lx >= w - 3) c = mix(c, -0.22);
      if (ly > th - 4) c = mix(c, -0.08);
      if ((lx === Math.floor(w * 0.3) || lx === Math.floor(w * 0.7)) && ly > th - 7) c = mix(c, -0.14);
      p(x0 + lx, torsoTop + ly, 1, 1, c);
    }
  }
  // 깃 (V넥) + 단추
  if (L.collar) {
    const cx = hipX + lean + 2;
    for (let i = 0; i < 4; i++) p(cx - 1 - i * 0.5, torsoTop + i, 3 - i * 0.6, 1, L.skin);
    p(cx - 5, torsoTop, 4, 2, L.collar);
    p(cx - 4, torsoTop + 2, 3, 2, L.collar);
    p(cx + 2, torsoTop, 4, 2, L.collar);
    p(cx + 2, torsoTop + 2, 3, 2, mix(L.collar, -0.1));
    for (let by = torsoTop + 5; by < hipY - 2; by += 5) p(cx, by, 1, 1, "#f6ead0");
  }
  // 허리띠
  if (L.belt) {
    p(hipX - 10, hipY - 1, 20, 3, L.belt);
    p(hipX - 10, hipY - 1, 20, 1, mix(L.belt, 0.2));
    if (L.buckle) {
      p(hipX + 2, hipY - 1, 4, 3, L.buckle);
      p(hipX + 3, hipY, 2, 1, mix(L.buckle, -0.4));
    }
  }
  if (R.sit) drawArm(false);
  drawArm(true);
  // 목 + 머리
  const hx = hipX + lean + 2 + R.head;
  const ft = torsoTop - 2 - 20 + (R.head > 2 ? 2 : 0);
  p(hx - 3, torsoTop - 3, 6, 4, L.skinShade);
  paintHead(p, L, hx, ft, { closed: pose === "sleep", back: pose === "back", shock: pose === "armsUp" });
}

// ── 의상 ────────────────────────────────────────────────
const plaid = (lx: number, ly: number): string => {
  const v = lx % 8;
  const h = (ly + 3) % 8;
  const vb = v === 3 || v === 4;
  const hb = h === 5 || h === 6;
  if (vb && hb) return "#160d06";
  if (vb || hb) return (lx + ly) % 2 ? "#3a2810" : "#4a3414";
  if (v === 0 || h === 1) return "#c08216";
  return (lx + ly) % 3 === 0 ? "#f4c040" : "#e8ae2c";
};

export const CHARLIE: Look = {
  skin: "#f4c9a2",
  skinShade: "#d69a76",
  skinLight: "#ffe0c4",
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
  brow: "#b98a28",
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
      if ((lx * 7 + ly * 5) % 23 === 0) return "#1e1a18";
      if ((lx + ly * 3) % 17 === 0) return "#5a2a22";
      if (lx === Math.floor(w / 2) && ly < 8) return mix(shirt, -0.3);
      return ly > 14 && lx % 4 === 0 ? shirtB : shirt;
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
    const mid = Math.floor(w / 2);
    if (lx === mid || lx === mid - 1) return ly % 3 === 0 ? "#bdb59e" : "#e4dcc8";
    const arc = Math.abs(lx - mid) * 0.25;
    if ((ly + Math.round(arc)) % 4 === 1 && lx > 1 && lx < w - 2 && ly < 16) return "#ece6d4";
    return "#24201c";
  },
  sleeve: "#ece6d4",
  sleeveShade: "#bdb59e",
  pants: "#e2dbc6",
  pantsShade: "#b5ad96",
  shoes: "#d8d0bc",
  eye: "#1e1a18",
  mouth: "#1e1a18",
  limb: 0.55,
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
    if (ly === 12 || ly === 13) return "#4a3418";
    if (Math.abs(lx - w / 2) < 1 + ly * 0.25 && ly < 8) return "#c8e09a";
    if (lx === Math.floor(w / 2) + 3 && ly % 5 === 2) return "#d8c8a0";
    return ly % 9 === 0 ? "#8a6a3c" : "#9a7444";
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
  shirt: (lx, ly, w) => (ly < 3 || lx === 0 || lx === w - 1 ? "#e8c83a" : (lx + ly) % 7 === 0 ? "#9a3a6a" : "#7a2a4a"),
  sleeve: "#7a2a4a",
  sleeveShade: "#5a1e3a",
  cuff: "#e8c83a",
  hunch: 4,
  crown: true,
};

/** 사람 스프라이트 (화면 32×54 자리에 64×108 도트) */
export function human(look: Look, lookId: string, pose: Pose, build: Build, facing: 1 | -1): HTMLCanvasElement {
  const key = `h:${lookId}:${pose}:${build.legLen}:${facing}`;
  return cached(key, () => {
    const right = cached(`h:${lookId}:${pose}:${build.legLen}:1`, () => bake(SW, SH, (p) => paintHuman(p, look, pose, build), OUTLINE));
    return facing === 1 ? right : flip(right);
  });
}
/** 화면에 그릴 때 기준점 (발 가운데, 화면 좌표) */
export const HUMAN_ORIGIN = { x: CX / 2, y: FEET / 2 };

// ── 고양이 샘 (밝은 회색 페르시안) ─────────────────────────
export type CatPose = string;
const CW = 64;
const CH = 48;
const CFEET = 44;

const F = "#c6c9d3";
const FL = "#e3e6ec";
const FLL = "#f7f8fb";
const FS = "#a2a6b5";
const FD = "#878c9d";
const FDD = "#6c7183";
const EYE = "#ec9a30";
const EYE2 = "#b8621a";
const PUP = "#1c1009";
const NOSE = "#e8909e";
const EAR = "#ecb0ba";

/** 털 덩어리: 그림자 → 바탕 → 빛 → 가장자리 털 결 */
function fur(p: Px, cx: number, cy: number, rx: number, ry: number, base = F, light = FL, shade = FS, seed = 1): void {
  ellipse(p, cx + 0.8, cy + 1, rx, ry, shade);
  ellipse(p, cx, cy, Math.max(1, rx - 0.8), Math.max(1, ry - 0.8), base);
  ellipse(p, cx - rx * 0.28, cy - ry * 0.32, Math.max(1, rx * 0.55), Math.max(0.8, ry * 0.42), light);
  // 가장자리로 삐져나온 털
  for (let a = 0; a < Math.PI * 2; a += 0.32) {
    const up = Math.sin(a) < 0.35;
    const len = 1 + ((Math.floor(a * 10) + seed) % 3);
    for (let l = 0; l < len; l++) {
      const tx = cx + Math.cos(a) * (rx + l * 0.9);
      const ty = cy + Math.sin(a) * (ry + l * 0.9) - l * 0.3;
      p(tx, ty, 1, 1, up ? (l === len - 1 ? light : base) : shade);
    }
  }
  // 안쪽 털 결
  for (let i = 0; i < Math.floor(rx * ry * 0.15); i++) {
    const a = (i * 2.399 + seed) % (Math.PI * 2);
    const d = ((i * 0.618 + seed * 0.1) % 1) * 0.75;
    const tx = cx + Math.cos(a) * rx * d;
    const ty = cy + Math.sin(a) * ry * d;
    p(tx, ty, 1, 2, ty < cy ? light : shade);
  }
}

function catLeg(p: Px, hx: number, hy: number, ang: number, kn: number, near: boolean): [number, number] {
  const [kx, ky] = bend(hx, hy, 5.5, ang);
  const [ax, ay] = bend(kx, ky, 5.5, ang - kn);
  const c = near ? F : FS;
  capsule(p, hx, hy, kx, ky, 3.2, mix(c, -0.15));
  capsule(p, hx - 0.3, hy, kx - 0.3, ky, 2.6, c);
  capsule(p, kx, ky, ax, ay, 2.5, c);
  if (near) capsule(p, kx - 1, ky, ax - 1, ay, 0.8, FL);
  ellipse(p, ax + 1, ay + 0.5, 3, 1.8, near ? FL : F);
  if (near) p(ax + 1, ay + 1, 2, 1, FLL);
  return [ax, ay];
}

function catFace(p: Px, hx: number, hy: number, o: { closed?: boolean; wide?: boolean; happy?: boolean; hiss?: boolean }): void {
  // 귀 (작고 둥근 페르시안 귀 + 털)
  for (const [ex, dir] of [[hx - 5, -1], [hx + 3, 1]] as const) {
    for (let i = 0; i < 5; i++) p(ex - 2 + (dir < 0 ? i * 0.3 : 0), hy - 8 - i, 5 - i, 1, F);
    p(ex - 1, hy - 9, 2, 2, EAR);
    p(ex, hy - 12, 1, 2, FL);
  }
  fur(p, hx, hy, 9, 8, F, FL, FS, 3);
  // 볼 갈기
  fur(p, hx + 1, hy + 5, 8.5, 4, FL, FLL, F, 5);
  // 눈
  const ey = hy - 1;
  const eye = (ex: number, w: number) => {
    if (o.closed || o.happy) {
      for (let i = 0; i < w; i++) p(ex + i, ey + 1 - (o.happy && i > 0 && i < w - 1 ? 1 : 0), 1, 1, FDD);
      return;
    }
    const h = o.wide ? 6 : 5;
    p(ex, ey - 1, w, h, EYE);
    p(ex, ey + h - 3, w, 2, EYE2);
    p(ex + Math.floor(w / 2) - (o.wide ? 1 : 0), ey - 1, o.wide ? 3 : 2, h, PUP);
    p(ex, ey - 1, 1, 1, "#ffffff");
    p(ex + 1, ey, 1, 1, "#ffffff");
    p(ex + w - 1, ey + h - 2, 1, 1, "#fff6e0");
    p(ex - 1, ey - 2, w + 2, 1, FDD);
  };
  eye(hx - 4, 4);
  eye(hx + 3, 5);
  // 코와 입
  p(hx + 7, ey + 4, 3, 2, NOSE);
  p(hx + 8, ey + 4, 1, 1, "#ffc0c8");
  if (o.hiss) {
    p(hx + 4, ey + 7, 5, 3, "#4a1e24");
    p(hx + 4, ey + 7, 1, 2, "#ffffff");
    p(hx + 8, ey + 7, 1, 2, "#ffffff");
  } else {
    p(hx + 7, ey + 6, 1, 1, FD);
    p(hx + 6, ey + 7, 1, 1, FD);
    p(hx + 8, ey + 7, 1, 1, FD);
  }
  // 수염
  for (const dy of [5, 7]) p(hx + 11, ey + dy, 4, 1, "rgba(255,255,255,0.8)");
}

function paintCat(p: Px, pose: string): void {
  if (pose.startsWith("sit") || pose === "blink") {
    const k = pose.startsWith("sitT") ? Number(pose.slice(4)) : 0;
    const flick = Math.sin((k / 8) * Math.PI * 2);
    // 앞으로 감싼 꼬리
    for (let i = 0; i < 7; i++) {
      const tx = 12 + i * 4;
      const ty = 41 - Math.sin(i * 0.4) * 1.5 + (i === 6 ? -flick * 3 : i === 5 ? -flick * 1.5 : 0);
      fur(p, tx, ty, 4 - Math.abs(i - 3) * 0.25, 3, i > 4 ? FL : F, FLL, FS, i);
    }
    // 몸통 (배 모양)
    fur(p, 28, 30, 12, 12, F, FL, FS, 7);
    fur(p, 24, 34, 6, 7, FS, F, FD, 2);
    // 가슴 갈기
    fur(p, 34, 26, 8, 10, FL, FLL, F, 9);
    // 앞발
    for (const fx of [31, 37]) {
      capsule(p, fx, 34, fx, 41, 2.6, fx > 33 ? FL : F);
      ellipse(p, fx + 1, 42, 3, 1.8, FLL);
    }
    catFace(p, 34, 13, { closed: pose === "blink" });
    return;
  }
  if (pose === "loaf") {
    for (let i = 0; i < 5; i++) fur(p, 8 + i * 4, 40, 3.5, 2.6, F, FL, FS, i);
    fur(p, 28, 34, 17, 9, F, FL, FS, 4);
    fur(p, 30, 38, 11, 4, FL, FLL, F, 6);
    catFace(p, 42, 27, { closed: true });
    return;
  }
  if (pose === "startle") {
    // 아치형 등 + 곤두선 털 + 부푼 꼬리
    const legs: Array<[number, boolean]> = [[14, false], [20, true], [38, false], [44, true]];
    for (const [lx, near] of legs) catLeg(p, lx, 26, 0, 0, near);
    for (let i = 0; i < 6; i++) fur(p, 10 - i * 0.6, 22 - i * 4, 5.5 - i * 0.3, 4.5, i > 3 ? FL : F, FLL, FS, i);
    fur(p, 29, 20, 16, 8, F, FL, FS, 2);
    fur(p, 29, 14, 11, 5, F, FL, FS, 8);
    for (let x = 16; x < 42; x += 2) p(x, 8 - Math.sin(((x - 16) / 26) * Math.PI) * 3, 1, 3, FL);
    fur(p, 31, 25, 10, 3, FL, FLL, F, 3);
    catFace(p, 47, 21, { wide: true, hiss: true });
    return;
  }
  // 걷기 16프레임 (+ 박치기)
  const butt = pose === "butt";
  const ph = butt ? 0 : (Number(pose.slice(4)) / 16) * Math.PI * 2;
  const legA = (q: number): [number, number] => {
    const v = Math.cos(q);
    return [Math.sin(q) * 0.55, v > 0 ? v * 0.9 : 0.05];
  };
  // 낮은 발에 맞춰 몸 높이 결정
  const probe = (q: number) => {
    const [a, kn] = legA(q);
    const [kx, ky] = bend(0, 0, 5.5, a);
    return bend(kx, ky, 5.5, a - kn)[1];
  };
  const low = Math.max(probe(ph), probe(ph + Math.PI));
  const by = CFEET - 1.8 - low - 23;
  const tailSway = Math.sin(ph + 1) * 0.35;
  // 꼬리 (큰 깃털 모양)
  for (let i = 0; i < 7; i++) {
    const t = i / 6;
    const tx = 12 - Math.sin(t * 1.6 + tailSway) * 9;
    const ty = by + 18 - t * 16;
    fur(p, tx, ty, 4.2 + Math.sin(t * Math.PI) * 1.6, 3.6, t > 0.7 ? FL : F, FLL, FS, i);
  }
  // 먼 쪽 다리
  catLeg(p, 18, by + 22, ...legA(ph + Math.PI), false);
  catLeg(p, 40, by + 22, ...legA(ph), false);
  // 몸통
  fur(p, 29, by + 17, 15, 8, F, FL, FS, 1);
  fur(p, 31, by + 22, 10, 3.5, FL, FLL, F, 4);
  // 가까운 쪽 다리
  catLeg(p, 21, by + 23, ...legA(ph), true);
  catLeg(p, 43, by + 23, ...legA(ph + Math.PI), true);
  // 가슴 갈기 + 머리
  fur(p, 43, by + 16, 6, 7, FL, FLL, F, 6);
  const nod = Math.sin(ph * 2) > 0.6 ? 1 : 0;
  if (butt) catFace(p, 50, by + 13, { happy: true });
  else catFace(p, 48, by + 8 + nod, {});
}

/** 고양이 스프라이트 (화면 32×24 자리에 64×48 도트) */
export function cat(pose: CatPose, facing: 1 | -1, silhouette = false): HTMLCanvasElement {
  const key = `c:${pose}:${facing}:${silhouette}`;
  return cached(key, () => {
    const base = cached(`c:${pose}:1:false`, () => bake(CW, CH, (p) => paintCat(p, pose), "#3a3846"));
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

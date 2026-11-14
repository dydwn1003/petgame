// 캐릭터 도트: 찰리 · 샘(고양이) · 좀비 · 해골 시위대 · 개구리 인간
import { bake, cached, ellipse, flip, makeCanvas, mix, type Px } from "./pixel";

// ── 사람 ────────────────────────────────────────────────
export interface Look {
  skin: string;
  skinShade: string;
  hair: string;
  hairShade: string;
  hairLight: string;
  hairStyle: "pomp" | "messy" | "skull" | "frog" | "hood";
  shirt: (lx: number, ly: number, w: number) => string;
  sleeve: (i: number) => string;
  sleeveBack: (i: number) => string;
  pants: string;
  pantsShade: string;
  shoes: string;
  belt?: string;
  buckle?: string;
  glasses?: boolean;
  eye: string;
  mouth: string;
  hunch?: number;
  limb?: number;
  armsForward?: boolean;
}

export type Pose =
  | "stand"
  | "stand1"
  | `walk${0 | 1 | 2 | 3 | 4 | 5 | 6 | 7}`
  | `crouch${0 | 1 | 2 | 3}`
  | "back"
  | "sit"
  | "drink"
  | "sleep"
  | "armsUp"
  | "flashlight";

export interface Build {
  legLen: number;
  torsoLen: number;
}
export const BUILD_3: Build = { legLen: 12, torsoLen: 11 };
export const BUILD_25: Build = { legLen: 8, torsoLen: 9 };

export const HUMAN_W = 32;
export const HUMAN_H = 54;
const CX = 14;
const FEET = 52;

/**
 * 동작별 [앞다리, 뒷다리, 앞다리 들림, 뒷다리 들림, 앞팔, 뒷팔, 몸 들림]
 * 걷기는 8프레임 사인 곡선: 다리가 모일 때 몸이 1px 올라가고, 앞으로 나가는 다리가 살짝 들린다.
 */
function gait(pose: string): [number, number, number, number, number, number, number] {
  if (pose.startsWith("walk")) {
    const ph = (Number(pose.slice(4)) / 8) * Math.PI * 2;
    const s = Math.sin(ph);
    const c = Math.cos(ph);
    const legF = Math.round(s * 3.5);
    const armF = Math.round(-s * 2.2);
    return [legF, -legF, c > 0.6 ? 1 : 0, c < -0.6 ? 1 : 0, armF, -armF, Math.abs(s) < 0.4 ? 1 : 0];
  }
  if (pose.startsWith("crouch")) {
    const ph = (Number(pose.slice(6)) / 4) * Math.PI * 2;
    const s = Math.sin(ph);
    const legF = Math.round(s * 2.5);
    return [legF, -legF, 0, 0, -Math.round(s), Math.round(s), 0];
  }
  if (pose === "stand1") return [1, -1, 0, 0, 0, 0, 1];
  return [1, -1, 0, 0, 0, 0, 0];
}

function paintHead(p: Px, L: Look, hx: number, ft: number, opts: { closed?: boolean; back?: boolean; shock?: boolean }): void {
  if (L.hairStyle === "skull") {
    const b = L.skin;
    const s = L.skinShade;
    p(hx - 4, ft - 3, 9, 3, b);
    p(hx - 5, ft, 11, 6, b);
    p(hx - 3, ft + 6, 8, 3, b);
    p(hx - 5, ft, 1, 6, s);
    p(hx - 2, ft + 2, 2, 3, "#1e1a18");
    p(hx + 2, ft + 2, 2, 3, "#1e1a18");
    p(hx + 1, ft + 5, 1, 1, "#1e1a18");
    for (let i = 0; i < 7; i++) p(hx - 2 + i, ft + 7, 1, 1, i % 2 ? "#3a332c" : b);
    p(hx - 3, ft + 8, 8, 1, s);
    return;
  }
  if (L.hairStyle === "frog") {
    const gr = L.skin;
    p(hx - 5, ft - 1, 12, 10, gr);
    p(hx - 5, ft - 1, 1, 10, L.skinShade);
    p(hx - 4, ft + 5, 11, 4, "#b8d88a");
    p(hx - 3, ft + 4, 10, 1, "#24301a");
    ellipse(p, hx - 1, ft - 2, 2, 2, gr);
    ellipse(p, hx + 4, ft - 2, 2, 2, gr);
    p(hx - 2, ft - 3, 3, 2, "#f4f0d8");
    p(hx + 3, ft - 3, 3, 2, "#f4f0d8");
    p(hx - 1, ft - 3, 2, 1, "#101010");
    p(hx + 4, ft - 3, 2, 1, "#101010");
    p(hx + 1, ft + 1, 1, 1, L.skinShade);
    p(hx + 4, ft + 1, 1, 1, L.skinShade);
    return;
  }
  // 얼굴
  p(hx - 4, ft, 9, 9, L.skin);
  p(hx - 4, ft, 1, 9, L.skinShade);
  p(hx - 3, ft + 8, 7, 1, L.skinShade);
  p(hx + 5, ft + 4, 1, 2, L.skin);
  p(hx + 5, ft + 6, 1, 1, L.skinShade);
  p(hx - 3, ft + 3, 1, 2, L.skinShade);
  p(hx - 1, ft + 1, 4, 1, mix(L.skin, 0.25));
  p(hx + 4, ft + 7, 1, 1, mix(L.skin, -0.12));
  if (opts.back) {
    p(hx - 5, ft - 1, 11, 8, L.hair);
    p(hx - 5, ft + 5, 11, 1, L.hairShade);
    p(hx - 2, ft + 1, 1, 4, L.hairShade);
    p(hx + 2, ft, 1, 4, L.hairLight);
  } else {
    if (L.glasses) {
      const fr = "#7a4422";
      const lens = "#cfe0e4";
      p(hx - 3, ft + 3, 9, 1, fr);
      p(hx - 3, ft + 4, 1, 2, fr);
      p(hx - 2, ft + 4, 3, 2, lens);
      p(hx + 1, ft + 4, 1, 2, fr);
      p(hx + 2, ft + 4, 3, 2, lens);
      p(hx + 5, ft + 4, 1, 2, fr);
      p(hx - 2, ft + 6, 3, 1, fr);
      p(hx + 2, ft + 6, 3, 1, fr);
      if (opts.closed) {
        p(hx - 2, ft + 5, 2, 1, L.eye);
        p(hx + 2, ft + 5, 2, 1, L.eye);
      } else {
        p(hx - 1, ft + 4, 1, 2, L.eye);
        p(hx + 3, ft + 4, 1, 2, L.eye);
        p(hx - 1, ft + 4, 1, 1, "#4a6a3a");
        p(hx + 3, ft + 4, 1, 1, "#4a6a3a");
      }
    } else if (opts.closed) {
      p(hx - 2, ft + 5, 2, 1, L.eye);
      p(hx + 2, ft + 5, 2, 1, L.eye);
    } else {
      p(hx - 1, ft + 4, 1, 2, L.eye);
      p(hx + 3, ft + 4, 1, 2, L.eye);
    }
    if (opts.shock) p(hx + 2, ft + 7, 2, 2, "#5a2a22");
    else p(hx + 2, ft + 7, 2, 1, L.mouth);
  }
  // 머리카락
  const H = L.hair;
  const S = L.hairShade;
  const Li = L.hairLight;
  if (L.hairStyle === "pomp") {
    const D = mix(S, -0.3);
    const X = mix(Li, 0.5);
    p(hx - 2, ft - 7, 5, 1, H);
    p(hx - 3, ft - 6, 8, 1, H);
    p(hx - 4, ft - 5, 10, 1, H);
    p(hx - 5, ft - 4, 12, 3, H);
    p(hx - 5, ft - 1, 11, 1, S);
    p(hx - 5, ft, 8, 1, H);
    p(hx - 5, ft + 1, 4, 1, H);
    p(hx - 5, ft + 2, 2, 4, S);
    p(hx - 5, ft - 4, 1, 4, S);
    p(hx - 4, ft - 5, 1, 2, S);
    p(hx - 5, ft + 2, 1, 4, D);
    // 앞머리 물결 (2번 시안)
    p(hx - 1, ft - 6, 4, 1, Li);
    p(hx, ft - 5, 5, 1, Li);
    p(hx + 2, ft - 4, 4, 1, Li);
    p(hx + 4, ft - 3, 2, 1, Li);
    p(hx + 1, ft - 6, 2, 1, X);
    p(hx + 3, ft - 5, 1, 1, X);
    p(hx - 3, ft - 4, 3, 1, Li);
    p(hx - 2, ft - 3, 1, 2, S);
    p(hx + 1, ft - 3, 1, 2, S);
    p(hx + 3, ft - 2, 3, 1, S);
    p(hx - 1, ft - 2, 2, 1, D);
    p(hx + 4, ft - 1, 2, 1, D);
    p(hx + 3, ft, 2, 1, S);
    p(hx - 4, ft, 2, 1, Li);
    p(hx - 4, ft + 1, 1, 1, S);
  } else if (L.hairStyle === "messy") {
    p(hx - 4, ft - 3, 9, 3, H);
    p(hx - 5, ft - 1, 11, 2, H);
    p(hx - 5, ft + 1, 2, 4, H);
    p(hx - 3, ft - 4, 2, 1, H);
    p(hx + 1, ft - 4, 2, 1, H);
    p(hx + 4, ft + 1, 1, 2, H);
    p(hx - 1, ft + 1, 1, 1, H);
    p(hx - 2, ft - 2, 3, 1, S);
  } else if (L.hairStyle === "hood") {
    p(hx - 5, ft - 3, 11, 3, H);
    p(hx - 6, ft - 1, 3, 10, H);
    p(hx + 5, ft - 1, 1, 3, H);
    p(hx - 6, ft + 7, 2, 2, S);
    p(hx - 4, ft - 1, 9, 1, S);
  }
}

function paintHuman(p: Px, L: Look, pose: Pose, B: Build): void {
  const sit = pose === "sit" || pose === "drink" || pose === "sleep";
  const crouch = pose.startsWith("crouch");
  const [legF, legB, liftF, liftB, armF0, armB0, rise] = gait(pose);
  const lw = L.limb ?? 4;
  const hunch = (L.hunch ?? 0) + (crouch ? 2 : 0) + (pose === "sleep" ? 1 : 0);

  let beltY: number;
  if (sit) beltY = FEET - 2 - Math.round(B.legLen * 0.55) - 4;
  else if (crouch) beltY = FEET - 2 - Math.round(B.legLen * 0.7);
  else beltY = FEET - 2 - B.legLen - rise;
  const torsoTop = beltY - B.torsoLen;
  const ft = torsoTop - 1 - 9 + (pose === "sleep" ? 2 : 0);
  const hx = CX + hunch;
  const tl = CX - 5;
  const tw = 11;

  // 다리
  if (sit) {
    const shin = Math.round(B.legLen * 0.55);
    p(CX - 4, beltY + 1, 13, 4, L.pants);
    p(CX - 4, beltY + 4, 13, 1, L.pantsShade);
    p(CX + 5, beltY + 5, lw, shin, L.pants);
    p(CX + 5, beltY + 5, 1, shin, L.pantsShade);
    p(CX + 5, FEET - 1, lw + 2, 2, L.shoes);
  } else {
    const leg = (x0: number, off: number, lift: number, col: string) => {
      const len = FEET - 2 - beltY;
      for (let i = 0; i < len - lift; i++) {
        const t = i / Math.max(1, len - 1);
        const knee = crouch ? Math.round(Math.sin(t * Math.PI) * 4) : 0;
        const lx = x0 + Math.round(off * t) + knee;
        p(lx, beltY + 1 + i, lw, 1, col);
        if (lw >= 4) {
          p(lx + 1, beltY + 1 + i, 1, 1, mix(col, 0.16));
          p(lx + lw - 1, beltY + 1 + i, 1, 1, mix(col, -0.18));
        }
        if (lw >= 4 && i === len - lift - 1) p(lx, beltY + 1 + i, lw, 1, mix(col, -0.22));
      }
      p(x0 + off, FEET - 1 - lift, lw + 2, 2, L.shoes);
      p(x0 + off + lw, FEET - 1 - lift, 1, 1, mix(L.shoes, 0.35));
      p(x0 + off, FEET - lift, lw + 2, 1, mix(L.shoes, -0.35));
    };
    leg(CX - 3, legB, liftB, L.pantsShade);
    leg(CX + 1 - (lw < 4 ? 0 : 0), legF, liftF, L.pants);
  }

  const armLen = B.torsoLen - 1;
  const arm = (x: number, swing: number, col: (i: number) => string) => {
    for (let i = 0; i < armLen; i++) p(x + Math.round((swing * i) / armLen), torsoTop + 1 + i, 2, 1, col(i));
    p(x + swing, torsoTop + 1 + armLen, 2, 2, L.skin);
  };

  // 뒤쪽 팔
  if (pose === "armsUp") {
    p(tl - 2, torsoTop - 7, 2, 9, L.sleeveBack(2));
    p(tl - 2, torsoTop - 9, 2, 2, L.skin);
  } else if (L.armsForward) {
    p(tl + tw - 4, torsoTop + 3, 10, 2, L.sleeveBack(0));
    p(tl + tw + 6, torsoTop + 3, 2, 2, L.skinShade);
  } else if (!sit) {
    arm(tl - 1, armB0, L.sleeveBack);
  }

  // 몸통
  for (let ly = 0; ly < B.torsoLen; ly++) {
    const lean = crouch ? Math.round(((B.torsoLen - ly) / B.torsoLen) * 2) : 0;
    for (let lx = 0; lx < tw; lx++) p(tl + lx + lean, torsoTop + ly, 1, 1, L.shirt(lx, ly, tw));
  }
  p(tl, beltY, tw, 1, L.belt ?? L.pantsShade);
  if (L.buckle) {
    p(CX + 1, beltY, 2, 1, L.buckle);
    p(CX + 1, beltY, 1, 1, mix(L.buckle, 0.4));
  }

  // 앞쪽 팔
  if (pose === "armsUp") {
    p(tl + tw, torsoTop - 7, 2, 9, L.sleeve(2));
    p(tl + tw, torsoTop - 9, 2, 2, L.skin);
  } else if (L.armsForward) {
    p(tl + tw - 2, torsoTop + 2, 10, 2, L.sleeve(0));
    p(tl + tw + 8, torsoTop + 2, 2, 2, L.skin);
  } else if (pose === "drink") {
    p(tl + tw - 2, torsoTop + 1, 2, 5, L.sleeve(1));
    p(tl + tw, torsoTop - 3, 2, 6, L.sleeve(2));
    p(hx + 4, ft + 5, 3, 5, "#c8352a");
    p(hx + 4, ft + 5, 3, 1, "#d8d8e0");
    p(hx + 5, ft + 7, 1, 2, "#f0e0a0");
  } else if (pose === "flashlight") {
    p(tl + tw - 2, torsoTop + 2, 7, 2, L.sleeve(1));
    p(tl + tw + 4, torsoTop + 2, 2, 2, L.skin);
    p(tl + tw + 5, torsoTop + 1, 6, 3, "#3a3a46");
    p(tl + tw + 10, torsoTop + 1, 1, 3, "#fff3b8");
  } else if (sit) {
    p(tl + tw - 2, torsoTop + 1, 2, armLen - 2, L.sleeve(1));
    p(tl + tw, torsoTop + armLen - 1, 4, 2, L.skin);
  } else {
    arm(tl + tw - 2, armF0, L.sleeve);
  }

  // 목, 머리
  p(hx - 1, torsoTop - 1, 3, 1, L.skinShade);
  paintHead(p, L, hx, ft, { closed: pose === "sleep", back: pose === "back", shock: pose === "armsUp" });
}

// ── 의상 ────────────────────────────────────────────────
const plaid = (lx: number, ly: number, w: number) => {
  // 깃 (V넥) 과 단추
  if (ly === 0 && lx >= 4 && lx <= 6) return lx === 5 ? "#d69a76" : "#f3c7a1";
  if (ly === 1 && lx === 5) return "#d69a76";
  if ((ly === 0 && (lx === 3 || lx === 7)) || (ly === 1 && (lx === 4 || lx === 6))) return "#f8d468";
  if (lx === 5 && ly % 3 === 2) return "#f4e8c0";
  const v = lx % 4 === 1;
  const h = ly % 4 === 3;
  const line = v || h;
  if (lx === 0) return line ? "#24190b" : "#b07610";
  if (lx === w - 1) return line ? "#2e2010" : "#c8891a";
  if (v && h) return "#1a120a";
  if (line) return (lx + ly) % 2 ? "#3c2a12" : "#4a3416";
  return (lx + ly) % 3 === 0 ? "#f0b834" : "#e6ac2c";
};

export const CHARLIE: Look = {
  skin: "#f3c7a1",
  skinShade: "#d69a76",
  hair: "#ebc24a",
  hairShade: "#b98a28",
  hairLight: "#fff3ac",
  hairStyle: "pomp",
  shirt: plaid,
  sleeve: (i) => (i % 4 === 1 ? "#3c2a12" : "#e8b02e"),
  sleeveBack: (i) => (i % 4 === 1 ? "#24190b" : "#a8700f"),
  pants: "#a47e4e",
  pantsShade: "#7a5a34",
  shoes: "#4b2b16",
  belt: "#3a2412",
  buckle: "#e0bd52",
  glasses: true,
  eye: "#2a2220",
  mouth: "#b8705a",
};

function zombieLook(shirtA: string, shirtB: string, pants: string, hair: string): Look {
  return {
    skin: "#9fae8e",
    skinShade: "#788a68",
    hair,
    hairShade: "#201c1a",
    hairLight: hair,
    hairStyle: "messy",
    shirt: (lx, ly, w) => ((lx * 7 + ly * 3) % 11 === 0 ? "#2a2622" : lx === w - 1 ? shirtB : ly > 8 && lx % 3 === 0 ? shirtB : shirtA),
    sleeve: () => shirtA,
    sleeveBack: () => shirtB,
    pants,
    pantsShade: "#22262e",
    shoes: "#1e1e22",
    eye: "#d23a3a",
    mouth: "#4a2a2a",
    hunch: 3,
    armsForward: true,
  };
}
export const ZOMBIES: Look[] = [
  zombieLook("#5c616e", "#454953", "#34405a", "#3a3430"),
  zombieLook("#7a4a3a", "#5a3428", "#3e3a34", "#5a4a36"),
  zombieLook("#4a5a4a", "#36443a", "#2c3240", "#2a2422"),
];

export const SKELETON: Look = {
  skin: "#ebe5d3",
  skinShade: "#bdb59e",
  hair: "#ebe5d3",
  hairShade: "#bdb59e",
  hairLight: "#ebe5d3",
  hairStyle: "skull",
  shirt: (lx, ly, w) => (lx === Math.floor(w / 2) ? "#e4dcc8" : ly % 3 === 0 && lx > 1 && lx < w - 2 ? "#ebe5d3" : "#2a2420"),
  sleeve: () => "#ebe5d3",
  sleeveBack: () => "#bdb59e",
  pants: "#e2dbc6",
  pantsShade: "#b5ad96",
  shoes: "#d8d0bc",
  eye: "#1e1a18",
  mouth: "#1e1a18",
  limb: 2,
};

export const FROGMAN: Look = {
  skin: "#6fae4c",
  skinShade: "#4c8434",
  hair: "#6fae4c",
  hairShade: "#4c8434",
  hairLight: "#8ac864",
  hairStyle: "frog",
  shirt: (lx, ly, w) => (ly === 6 ? "#5a4224" : lx === Math.floor(w / 2) ? "#6a4e2a" : lx === w - 1 ? "#7a5a30" : "#9a7444"),
  sleeve: () => "#9a7444",
  sleeveBack: () => "#6a4e2a",
  pants: "#4a3a28",
  pantsShade: "#32281c",
  shoes: "#6fae4c",
  eye: "#101010",
  mouth: "#24301a",
  hunch: 2,
};

/** 사람 스프라이트 (오른쪽을 봄, facing -1 이면 뒤집음) */
export function human(look: Look, lookId: string, pose: Pose, build: Build, facing: 1 | -1): HTMLCanvasElement {
  const key = `h:${lookId}:${pose}:${build.legLen}:${facing}`;
  return cached(key, () => {
    const right = cached(`h:${lookId}:${pose}:${build.legLen}:1`, () => bake(HUMAN_W, HUMAN_H, (p) => paintHuman(p, look, pose, build)));
    return facing === 1 ? right : flip(right);
  });
}

// ── 고양이 샘 (밝은 회색 페르시안) ─────────────────────────
export type CatPose = `walk${0 | 1 | 2 | 3 | 4 | 5 | 6 | 7}` | "sit" | "sit1" | "blink" | "startle" | "loaf" | "butt";
export const CAT_W = 32;
export const CAT_H = 24;

const F = "#c3c6d0";
const FL = "#e2e4ea";
const FLL = "#f4f5f8";
const FS = "#9a9eac";
const FD = "#7e8292";
const EYE = "#e8962e";
const PUP = "#2a1a10";
const NOSE = "#e89aa6";
const EAR = "#ecb2ba";

/** 복슬복슬한 덩어리: 아래쪽 그림자, 위쪽 빛, 가장자리 털 */
function fluff(p: Px, cx: number, cy: number, rx: number, ry: number, base = F, light = FL, shade = FS): void {
  ellipse(p, cx + 0.6, cy + 0.8, rx, ry, shade);
  ellipse(p, cx, cy, Math.max(1, rx - 0.5), Math.max(1, ry - 0.5), base);
  ellipse(p, cx - rx * 0.3, cy - ry * 0.35, Math.max(1, rx * 0.5), Math.max(0.6, ry * 0.4), light);
  for (let a = 0; a < Math.PI * 2; a += 0.7) {
    const tx = Math.round(cx + Math.cos(a) * (rx + 0.6));
    const ty = Math.round(cy + Math.sin(a) * (ry + 0.6));
    if (Math.sin(a) < 0.6) p(tx, ty, 1, 1, Math.sin(a) < 0 ? base : shade);
  }
}

function catHead(p: Px, hx: number, hy: number, wide = false, closed = false): void {
  // 귀
  p(hx - 4, hy - 5, 3, 2, F);
  p(hx - 4, hy - 6, 2, 1, F);
  p(hx - 3, hy - 5, 1, 1, EAR);
  p(hx + 1, hy - 5, 3, 2, F);
  p(hx + 2, hy - 6, 2, 1, F);
  p(hx + 2, hy - 5, 1, 1, EAR);
  fluff(p, hx, hy, 5, 4.5);
  // 볼 털
  fluff(p, hx + 1, hy + 3, 4, 1.6, FL, FLL, F);
  p(hx - 5, hy + 1, 1, 2, FS);
  // 큰 구리빛 눈 (페르시안)
  if (closed) {
    p(hx, hy, 3, 1, FD);
    p(hx + 2, hy - 1, 1, 1, FD);
  } else if (wide) {
    p(hx, hy - 2, 3, 4, EYE);
    p(hx + 1, hy - 2, 1, 4, PUP);
    p(hx, hy - 2, 1, 1, "#ffffff");
  } else {
    p(hx, hy - 1, 3, 3, EYE);
    p(hx, hy + 1, 3, 1, mix(EYE, -0.25));
    p(hx + 1, hy - 1, 2, 2, PUP);
    p(hx + 1, hy - 1, 1, 1, "#ffffff");
  }
  p(hx + 4, hy + 1, 1, 1, NOSE);
  p(hx + 3, hy + 2, 1, 1, FS);
  p(hx + 4, hy + 3, 1, 1, FS);
}

function paintCat(p: Px, pose: CatPose): void {
  if (pose === "sit" || pose === "sit1" || pose === "blink") {
    // 꼬리 끝이 살랑살랑
    const tip = pose === "sit1" ? -2 : 0;
    fluff(p, 9, 20, 7, 2.2);
    fluff(p, 4, 19 + tip / 2, 3, 2, FS, F, FD);
    fluff(p, 2, 18 + tip, 2, 1.5, F, FL, FS);
    fluff(p, 14, 15, 6, 6.5);
    ellipse(p, 11, 16, 2, 4.5, FS);
    fluff(p, 17, 14, 3, 4.5, FL, FLL, F);
    p(16, 19, 2, 3, F);
    p(19, 19, 2, 3, FL);
    p(16, 21, 2, 1, FL);
    catHead(p, 17, 6, false, pose === "blink");
    return;
  }
  if (pose === "loaf") {
    fluff(p, 6, 19, 5, 2, FS, F, FD);
    fluff(p, 14, 17, 9, 5);
    fluff(p, 15, 15, 6, 2, FL, FLL, F);
    p(18, 9, 3, 2, F);
    p(23, 9, 3, 2, F);
    p(19, 10, 1, 1, EAR);
    p(24, 10, 1, 1, EAR);
    fluff(p, 22, 13, 5, 4);
    fluff(p, 22, 15, 3.5, 1.5, FL, FLL, F);
    p(21, 13, 2, 1, FD);
    p(24, 13, 2, 1, FD);
    p(26, 14, 1, 1, NOSE);
    return;
  }
  if (pose === "startle") {
    for (const x of [7, 10, 19, 22]) {
      p(x, 12, 2, 10, x < 15 ? FS : F);
      p(x, 21, 2, 1, FL);
    }
    fluff(p, 5, 7, 3.5, 3.5);
    fluff(p, 4, 3, 3, 3);
    fluff(p, 4, 1, 2, 1.5, FL, FLL, F);
    fluff(p, 14, 9, 9, 4);
    fluff(p, 14, 6, 6, 2);
    for (let x = 8; x < 21; x += 2) p(x, 3 + (x % 4 === 0 ? 0 : 1), 1, 2, FL);
    fluff(p, 15, 11, 6, 1.5, FL, FLL, F);
    catHead(p, 24, 10, true);
    return;
  }
  // 걷기 (+ 박치기)
  // 8프레임 걸음: 대각선 다리 짝이 번갈아 나가고, 몸통과 꼬리가 출렁인다
  const ph = pose === "butt" ? 0 : (Number(pose.slice(4)) / 8) * Math.PI * 2;
  const sn = Math.sin(ph);
  const cs = Math.cos(ph);
  const swing = Math.round(sn * 1.6);
  const liftA = cs > 0.5 ? 1 : 0;
  const liftB = cs < -0.5 ? 1 : 0;
  const bob = Math.abs(sn) < 0.4 ? -1 : 0;
  const tail = Math.round(Math.sin(ph + 1) * 1.2);
  const q: Px = (x, y, w, h, c) => p(x, y + bob, w, h, c);
  const leg = (x: number, lift: number, col: string, light?: string) => {
    p(x, 15 + bob, 2, 6 - lift - bob, col);
    if (light) p(x, 15 + bob, 1, 6 - lift - bob, light);
    p(x - 1, 20 - lift, 3, 1, light ? FLL : col);
  };
  // 꼬리 (복슬복슬)
  fluff(q, 6, 10 - tail, 3.5, 3);
  fluff(q, 4 + tail, 7 - tail, 3, 3);
  fluff(q, 3 + tail, 4 - tail, 2.5, 2.5, FL, FLL, F);
  // 뒷다리 (멀리)
  leg(9 - swing, liftB, FD);
  leg(19 + swing, liftA, FS);
  // 몸통
  fluff(q, 14, 12, 8, 5);
  fluff(q, 15, 15, 5, 1.5, FL, FLL, F);
  // 앞다리 (가까이)
  leg(12 + swing, liftA, F, FL);
  leg(22 - swing, liftB, F, FL);
  // 가슴 털
  fluff(q, 20, 12, 2.5, 3, FL, FLL, F);
  if (pose === "butt") catHead(q, 24, 10);
  else catHead(q, 23, 8 + (sn > 0.7 ? 1 : 0));
}

export function cat(pose: CatPose, facing: 1 | -1, silhouette = false): HTMLCanvasElement {
  const key = `c:${pose}:${facing}:${silhouette}`;
  return cached(key, () => {
    const base = cached(`c:${pose}:1:false`, () => bake(CAT_W, CAT_H, (p) => paintCat(p, pose), "#3c3a46"));
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

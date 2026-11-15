// 배경: 뉴욕 거리 · 찰리의 집 · 냉장고 · 골목
import { FONT, GROUND, H } from "./core";
import { makeDense, mix, pixelize, rng } from "./pixel";

/** 배경은 논리 좌표의 4배 밀도로 칠한다 (1/4 칸 = 1도트) */
export const BG_SCALE = 2;

type G = CanvasRenderingContext2D;

function vgrad(g: G, x: number, y0: number, w: number, y1: number, stops: Array<[number, string]>): void {
  const gr = g.createLinearGradient(0, y0, 0, y1);
  for (const [k, c] of stops) gr.addColorStop(k, c);
  g.fillStyle = gr;
  g.fillRect(x, y0, w, y1 - y0);
}

const q = (v: number) => Math.round(v * BG_SCALE) / BG_SCALE;
function rect(g: G, x: number, y: number, w: number, h: number, c: string): void {
  g.fillStyle = c;
  g.fillRect(q(x), q(y), q(w), q(h));
}

/** 벽돌: 반 칸짜리 줄눈과 하이라이트, 벽돌마다 얼룩과 결 */
function bricks(g: G, x: number, y: number, w: number, h: number, base: string, mortar: string, vary: string[], r: () => number): void {
  rect(g, x, y, w, h, mortar);
  for (let by = 0; by < h; by += 4) {
    const off = (by / 4) % 2 ? 4 : 0;
    const bh = Math.min(3.5, h - by);
    for (let bx = -off; bx < w; bx += 8) {
      const cx = Math.max(0, bx);
      const cw = Math.min(w, bx + 7.5) - cx;
      if (cw <= 0) continue;
      const col = r() < 0.3 ? vary[Math.floor(r() * vary.length)] : base;
      rect(g, x + cx, y + by, cw, bh, col);
      rect(g, x + cx, y + by, cw, 0.25, mix(col, 0.22));
      rect(g, x + cx, y + by + 0.25, cw, 0.25, mix(col, 0.1));
      rect(g, x + cx, y + by + 0.5, 0.25, bh - 0.5, mix(col, 0.08));
      if (bx + 7 < w && bx + 7 >= 0) rect(g, x + bx + 7, y + by + 0.5, 0.5, bh - 0.5, mix(col, -0.2));
      rect(g, x + cx, y + by + bh - 0.5, cw, 0.5, mix(col, -0.14));
      // 얼룩과 결
      for (let k = 0; k < 5; k++) if (r() < 0.6) rect(g, x + cx + 0.5 + Math.floor(r() * (cw - 1) * 4) / 4, y + by + 1 + Math.floor(r() * 8) / 4, 0.25, 0.25, mix(col, r() < 0.5 ? -0.24 : 0.14));
      if (r() < 0.2) rect(g, x + cx + 1, y + by + 1.5, Math.min(3, cw - 1.5), 0.5, mix(col, -0.1));
      if (r() < 0.07) rect(g, x + cx, y + by, 1, 1, mortar);
    }
    rect(g, x, y + by + 3.5, w, 0.5, mix(mortar, -0.15));
  }
}

function smallText(g: G, s: string, x: number, y: number, c: string, size = 8): void {
  g.font = size >= 11 ? FONT : `${size}px Galmuri11`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillStyle = c;
  g.fillText(s, Math.round(x), Math.round(y));
}

// ── 창문 · 비상계단 · 포스터 ──────────────────────────────
function windowAt(g: G, x: number, y: number, w: number, h: number, state: "dark" | "lit" | "broken" | "fire", r: () => number, frame = "#d8cfc0"): void {
  const lt = mix(frame, 0.25);
  const dk = mix(frame, -0.3);
  // 석재 상인방 + 쐐기돌
  rect(g, x - 3, y - 5, w + 6, 4, frame);
  rect(g, x - 3, y - 5, w + 6, 0.5, lt);
  rect(g, x - 3, y - 1.5, w + 6, 0.5, dk);
  rect(g, x + w / 2 - 2, y - 6, 4, 5, mix(frame, 0.12));
  // 유리 + 깊이
  rect(g, x - 1, y - 1, w + 2, h + 2, dk);
  rect(g, x, y, w, h, "#1c1c26");
  if (state === "lit") {
    vgrad(g, x + 1, y + 1, w - 2, y + h - 1, [[0, "#ffe2a0"], [0.7, "#e8a050"], [1, "#b86a30"]]);
    rect(g, x + 1, y + 1, 3, h - 2, "#8a3a2a");
    rect(g, x + w - 4, y + 1, 3, h - 2, "#8a3a2a");
    rect(g, x + 2, y + 1, 1, h - 2, "#a84a34");
    const deco = r();
    if (deco < 0.3) {
      rect(g, x + 6, y + h - 10, 5, 9, "#3a2420");
      rect(g, x + 7, y + h - 13, 3, 3, "#3a2420");
    } else if (deco < 0.55) {
      rect(g, x + w - 9, y + h - 6, 5, 4, "#6a3a1a");
      rect(g, x + w - 10, y + h - 10, 3, 4, "#3a6a2a");
      rect(g, x + w - 7, y + h - 12, 3, 6, "#4a8a3a");
    }
  } else if (state === "fire") {
    // 정지 그림용 불: 달아오른 방 안에 혀 모양 불길 (거리 장면에선 위에 움직이는 불이 덧그려진다)
    vgrad(g, x + 1, y + 1, w - 2, y + h - 1, [[0, "#3a120c"], [0.5, "#a83a14"], [1, "#ff9a3a"]]);
    const n = 3;
    for (let i = 0; i < n; i++) {
      const fx = x + 1 + ((i + 0.5) / n) * (w - 2);
      const fh = (h - 2) * (0.6 + r() * 0.35);
      const fw = ((w - 2) / n) * 0.7;
      for (const [hk, wk, col] of [[1, 1, "#ff5a1a"], [0.68, 0.6, "#ffb03a"], [0.38, 0.32, "#fff0b0"]] as Array<[number, number, string]>) {
        g.fillStyle = col;
        g.beginPath();
        g.moveTo(fx - fw * wk, y + h - 1);
        g.bezierCurveTo(fx - fw * wk, y + h - 1 - fh * hk * 0.45, fx - fw * wk * 0.3, y + h - 1 - fh * hk * 0.7, fx, y + h - 1 - fh * hk);
        g.bezierCurveTo(fx + fw * wk * 0.3, y + h - 1 - fh * hk * 0.7, fx + fw * wk, y + h - 1 - fh * hk * 0.45, fx + fw * wk, y + h - 1);
        g.fill();
      }
    }
  } else if (state === "broken") {
    rect(g, x + 1, y + 1, w - 2, h - 2, "#0c0c10");
    g.fillStyle = "#9aaaba";
    for (let i = 0; i < 5; i++) {
      const sx = x + 1 + Math.floor(r() * (w - 3));
      const sh = 2 + Math.floor(r() * 6);
      g.fillRect(sx, y + 1, 1, sh);
      g.fillRect(sx + 1, y + 1, 1, Math.max(1, sh - 3));
    }
    rect(g, x + 2, y + h - 3, 4, 1, "#9aaaba");
  } else {
    vgrad(g, x + 1, y + 1, w - 2, y + h - 1, [[0, "#3c4c70"], [1, "#1a2032"]]);
    // 유리 반사
    g.fillStyle = "rgba(160,190,230,0.35)";
    for (let i = 0; i < 8; i++) g.fillRect(x + 3 + i * 0.5, y + h - 4 - i, 0.5, 1);
    g.fillRect(x + w - 6, y + 2, 0.5, 3);
    g.fillRect(x + w - 5, y + 2.5, 0.5, 1.5);
    if (r() < 0.3) for (let by = y + 1; by < y + h / 2; by += 2) rect(g, x + 1, by, w - 2, 1, "#5a5e6a");
  }
  // 창틀
  rect(g, x + Math.floor(w / 2) - 0.5, y, 1, h, frame);
  rect(g, x + Math.floor(w / 2) - 0.5, y, 0.5, h, lt);
  rect(g, x, y + Math.floor(h / 2) - 0.5, w, 1, frame);
  rect(g, x, y + Math.floor(h / 2) - 0.5, w, 0.5, lt);
  rect(g, x, y, w, 0.5, dk);
  rect(g, x, y, 0.5, h, dk);
  // 창턱 + 그림자
  rect(g, x - 2, y + h, w + 4, 2, frame);
  rect(g, x - 2, y + h, w + 4, 0.5, lt);
  rect(g, x - 2, y + h + 1.5, w + 4, 0.5, dk);
  rect(g, x - 1, y + h + 2, w + 2, 1, "rgba(0,0,0,0.35)");
}

function acUnit(g: G, x: number, y: number): void {
  rect(g, x, y, 12, 8, "#b8b8b0");
  rect(g, x, y, 12, 1, "#d8d8d0");
  for (let i = 1; i < 11; i += 2) rect(g, x + i, y + 2, 1, 5, "#7a7a74");
  rect(g, x + 1, y + 8, 10, 1, "rgba(0,0,0,0.4)");
}

function fireEscape(g: G, x: number, w: number, top: number, floors: number, gap: number): void {
  const c = "#14141a";
  for (let i = 0; i < floors; i++) {
    const y = top + i * gap;
    rect(g, x, y, w, 2, c);
    for (let k = 0; k <= w; k += 3) rect(g, x + k, y - 7, 1, 7, c);
    rect(g, x, y - 8, w, 1, c);
    if (i < floors - 1) {
      for (let s = 0; s < gap; s += 3) rect(g, x + 4 + Math.round((s / gap) * (w - 12)), y + s, 6, 1, c);
    }
  }
}

/** 스프레이 낙서: 표면 안쪽에만, 반투명으로 칠해 바탕 결이 비친다 (흘러내린 자국 포함) */
function graffiti(g: G, x: number, y: number, w: number, r: () => number, h = 16): void {
  if (w < 16) return;
  const cols = ["#d84a8a", "#4ac0d8", "#e8d04a", "#8a4ad8", "#4ad86a", "#e86a3a"];
  const words = ["NYC", "MEOW", "KAT", "ZAP", "LUV", "BX", "YO"];
  const word = words[Math.floor(r() * words.length)];
  const col = cols[Math.floor(r() * cols.length)];
  g.save();
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  const size = Math.max(7, Math.min(h - 3, 12));
  g.font = `bold ${size}px Galmuri11`;
  g.textAlign = "center";
  g.textBaseline = "middle";
  const cx = x + w / 2 + (r() - 0.5) * Math.max(0, w - word.length * size * 0.7) * 0.6;
  const cy = y + h / 2;
  g.translate(cx, cy);
  g.rotate((r() - 0.5) * 0.18);
  // 뿌연 스프레이 테두리 → 굵은 외곽 → 글자 색
  g.globalAlpha = 0.18;
  g.fillStyle = col;
  g.fillRect(-word.length * size * 0.4 - 2, -size / 2 - 1, word.length * size * 0.8 + 4, size + 2);
  g.globalAlpha = 0.75;
  g.lineWidth = 1.5;
  g.strokeStyle = "#141018";
  g.strokeText(word, 0, 0);
  g.fillStyle = col;
  g.fillText(word, 0, 0);
  // 흘러내린 페인트
  g.globalAlpha = 0.55;
  for (let i = 0; i < 3; i++) {
    const dx = (r() - 0.5) * word.length * size * 0.7;
    g.fillRect(dx, size / 2 - 1, 0.5, 2 + r() * 4);
  }
  g.restore();
}

/** 벽에 붙은 대자보: 테이프 네 귀퉁이, 살짝 들뜬 모서리와 그림자 */
function poster(g: G, x: number, y: number, w: number, h: number, paper: string, ink: string, lines: string[], r: () => number): void {
  rect(g, x + 1, y + 1, w, h, "rgba(0,0,0,0.35)");
  rect(g, x, y, w, h, paper);
  vgrad(g, x, y, w, y + h, [[0, "rgba(255,255,255,0.10)"], [1, "rgba(0,0,0,0.12)"]]);
  // 구김과 얼룩
  for (let i = 0; i < 3; i++) rect(g, x + 2 + Math.floor(r() * (w - 4)), y + 2 + Math.floor(r() * (h - 4)), 0.5, 3 + r() * 5, "rgba(0,0,0,0.08)");
  // 들뜬 귀퉁이 하나
  g.fillStyle = mix(paper, -0.2);
  g.beginPath();
  g.moveTo(x + w, y + h - 4);
  g.lineTo(x + w, y + h);
  g.lineTo(x + w - 4, y + h);
  g.fill();
  lines.forEach((l, i) => smallText(g, l, x + w / 2, y + 7 + i * 9, ink, 7));
  // 투명 테이프
  for (const [tx, ty] of [[x - 1, y - 1], [x + w - 4, y - 1], [x - 1, y + h - 2], [x + w - 4, y + h - 2]]) rect(g, tx, ty, 5, 3, "rgba(240,236,210,0.55)");
}

// ── 거리 ────────────────────────────────────────────────
export interface StreetInfo {
  canvas: HTMLCanvasElement;
  lamps: number[];
  dumpsters: number[];
  door: number;
  posters: Array<{ x: number; text: string }>;
  fires: Array<{ x: number; y: number; w: number; h: number }>;
  bodega: number;
  alley: number;
}

const POSTERS: Array<[string[], string, string, string]> = [
  [["오늘 밤", "운석의", "아름다움!"], "#f4ead0", "#2a3a8a", "오늘 밤, 운석의 아름다움!"],
  [["외계인이", "우릴", "침공한다!!"], "#e8f0d8", "#a8201a", "외계인이 우릴 침공한다!!"],
  [["세상", "종말론", "회개하라"], "#f0e0c8", "#1a1a1a", "세상 종말론 — 회개하라"],
  [["채식이", "인류를", "구한다"], "#d8f0d0", "#2a6a2a", "채식이 인류를 구한다"],
];

/** 거리 건물 줄을 인도 뒤로 물린 높이 (인도가 그만큼 넓어진다) */
export const STREET_SHIFT = 24;

export function buildStreet(width: number, after: boolean, seed: number, home = true): StreetInfo {
  const c = makeDense(width, H, BG_SCALE);
  const g = c.getContext("2d")!;
  const r = rng(seed);
  const info: StreetInfo = { canvas: c, lamps: [], dumpsters: [], door: 170, posters: [], fires: [], bodega: -1, alley: -1 };

  // 하늘
  if (after) {
    vgrad(g, 0, 0, width, 200, [[0, "#1a0a10"], [0.5, "#5a1a14"], [1, "#c8461a"]]);
  } else {
    vgrad(g, 0, 0, width, 200, [[0, "#070912"], [0.6, "#151a30"], [1, "#2a2440"]]);
    for (let i = 0; i < width / 6; i++) rect(g, Math.floor(r() * width), Math.floor(r() * 80), 1, 1, r() < 0.3 ? "#fff6c8" : "#8a90b8");
  }
  // 먼 빌딩 실루엣
  for (let x = 0; x < width; ) {
    const w = 20 + Math.floor(r() * 40);
    const h = 70 + Math.floor(r() * 90);
    rect(g, x, 200 - h, w, h, after ? "#2a1014" : "#11142a");
    for (let wy = 200 - h + 6; wy < 190; wy += 7) {
      for (let wx = x + 3; wx < x + w - 3; wx += 5) {
        if (r() < (after ? 0.08 : 0.25)) rect(g, wx, wy, 2, 3, after ? "#ff8a3a" : "#e8c070");
      }
    }
    if (r() < 0.2) rect(g, x + w / 2 - 1, 200 - h - 14, 2, 14, after ? "#2a1014" : "#11142a");
    x += w + Math.floor(r() * 4);
  }
  if (after) {
    for (let i = 0; i < width / 50; i++) {
      g.fillStyle = "rgba(20,10,12,0.5)";
      g.beginPath();
      g.ellipse(r() * width, 20 + r() * 60, 40 + r() * 50, 10 + r() * 10, 0, 0, Math.PI * 2);
      g.fill();
    }
  }

  // 건물 줄: 찰리(키 54)보다 뒤에 있으므로 조금 작게, 인도 깊숙이 물러나 있다
  const D = STREET_SHIFT;
  const wallBase = 200 - D;
  g.save();
  g.translate(0, -D);
  const firesBefore = info.fires.length;
  let x = 0;
  const apt = { x: 30, w: 260 };
  if (home) {
    drawBrownstone(g, apt.x, apt.w, after, r);
    info.door = apt.x + apt.w / 2;
    x = apt.x + apt.w + 6;
  }
  let posterIdx = 0;
  let k = 0;
  while (x < width - 40) {
    const kind = k === 1 ? "shop" : (["brick", "shop", "blue", "brick", "brown"] as const)[Math.floor(r() * 5)];
    const w = kind === "shop" ? 150 : 130 + Math.floor(r() * 60);
    const top = 30 + Math.floor(r() * 40);
    const isBodega = k === 1;
    let spec: PosterSpec | null = null;
    if (posterIdx < POSTERS.length && kind !== "shop") {
      const [lines, paper, ink, label] = POSTERS[posterIdx];
      spec = { lines, paper, ink, label };
    }
    drawFacade(g, x, w, top, kind, after, r, info, isBodega, spec);
    if (spec?.used) posterIdx++;
    x += w + 6;
    k++;
  }
  g.restore();
  for (let i = firesBefore; i < info.fires.length; i++) info.fires[i].y -= D;

  // 인도: 건물 밑에서 연석까지 깊게 (멀수록 좁은 보도블록)
  const sw = after ? "#5a4a48" : "#6a6670";
  const joint = after ? "#4a3a38" : "#58545e";
  rect(g, 0, wallBase, width, 232 - wallBase, sw);
  rect(g, 0, wallBase, width, 2, "rgba(0,0,0,0.35)");
  const rows: Array<[number, number, number]> = [[wallBase, 186, 22], [186, 198, 26], [198, 214, 30], [214, 232, 36]];
  rows.forEach(([y0, y1, step], ri) => {
    rect(g, 0, y1 - 0.5, width, 0.5, joint);
    rect(g, 0, y0 + 0.5, width, 0.5, mix(sw, 0.06));
    for (let sx = (ri % 2) * (step / 2); sx < width; sx += step) rect(g, sx, y0, 0.5, y1 - y0, joint);
  });
  for (let i = 0; i < width / 20; i++) rect(g, Math.floor(r() * width), wallBase + 4 + Math.floor(r() * 50), 2 + r() * 3, 1, mix(sw, (r() - 0.5) * 0.2));
  // 연석
  rect(g, 0, 232, width, 3, after ? "#8a7a74" : "#9a96a0");
  rect(g, 0, 232, width, 1, after ? "#a89890" : "#b8b4c0");
  rect(g, 0, 235, width, 1, "#1e1e24");
  // 도로: 한 차선만 보인다 (중앙선 없음)
  rect(g, 0, 236, width, H - 236, after ? "#2a2224" : "#2c2c34");
  rect(g, 0, 236, width, 3, after ? "#221c1e" : "#24242c");
  for (let i = 0; i < width / 26; i++) rect(g, Math.floor(r() * width), 242 + Math.floor(r() * 26), 3, 1, "#1e1e24");
  for (let mx = 180 + Math.floor(r() * 200); mx < width; mx += 420 + Math.floor(r() * 200)) {
    g.fillStyle = "#1a1a20";
    g.beginPath();
    g.ellipse(mx, 254, 14, 4, 0, 0, Math.PI * 2);
    g.fill();
    rect(g, mx - 10, 253, 20, 0.5, "#3a3a44");
  }

  if (home) drawStoop(g, info.door, 176 - D, 212);

  // 소품: 가로등 · 소화전 · 볼라드 (연석 쪽), 쓰레기통 · 대형 쓰레기통 (벽 쪽)
  for (let lx = 330; lx < width - 20; lx += 260 + Math.floor(r() * 60)) {
    info.lamps.push(lx);
    rect(g, lx, 120, 3, 92, "#1a1a20");
    rect(g, lx - 1, 210, 5, 3, "#1a1a20");
    rect(g, lx - 6, 118, 15, 3, "#1a1a20");
    rect(g, lx - 6, 121, 6, 4, after && r() < 0.5 ? "#3a3a40" : "#fff2b8");
  }
  const hyd = 380 + Math.floor(r() * 100);
  rect(g, hyd, 198, 8, 14, after ? "#5a2a24" : "#a82a2a");
  rect(g, hyd - 2, 202, 12, 3, after ? "#5a2a24" : "#a82a2a");
  rect(g, hyd + 1, 196, 6, 2, "#c8c0b8");
  for (const bx of [hyd - 30, hyd + 30]) {
    rect(g, bx, 196, 5, 16, "#2a3a8a");
    rect(g, bx, 198, 5, 2, "#d8d8e8");
  }
  const DB = wallBase + 10; // 벽에 붙여 둔 대형 쓰레기통 바닥
  for (let dx = 620; dx < width - 120; dx += 380 + Math.floor(r() * 120)) {
    info.dumpsters.push(dx + 20);
    const body = after ? "#2a4a34" : "#2e5a3c";
    rect(g, dx, DB - 26, 40, 26, body);
    rect(g, dx, DB - 26, 40, 1, mix(body, 0.2));
    rect(g, dx - 2, DB - 29, 44, 4, after ? "#1e3426" : "#22442e");
    rect(g, dx + 4, DB - 20, 32, 1, "#1e3426");
    for (let k2 = 6; k2 < 40; k2 += 8) rect(g, dx + k2, DB - 18, 0.5, 16, mix(body, -0.15));
    rect(g, dx + 2, DB, 4, 2, "#111");
    rect(g, dx + 34, DB, 4, 2, "#111");
    graffiti(g, dx + 2, DB - 19, 36, r, 16);
    rect(g, dx - 2, DB + 1, 46, 2, "rgba(0,0,0,0.35)");
  }
  // 철제 쓰레기통 (주름진 몸통 + 뚜껑 + 손잡이)
  for (let i = 0; i < width / 160; i++) {
    const tx = Math.floor(r() * (width - 20));
    if (home && Math.abs(tx - info.door) < 50) continue;
    const metal = after ? "#5a5a5e" : "#8a8c94";
    rect(g, tx - 1, DB + 1, 12, 1.5, "rgba(0,0,0,0.35)");
    rect(g, tx, DB - 12, 10, 12, metal);
    for (let k2 = 1; k2 < 10; k2 += 2) rect(g, tx + k2, DB - 11, 0.5, 10, mix(metal, -0.18));
    rect(g, tx, DB - 12, 2, 12, mix(metal, 0.15));
    rect(g, tx, DB - 8, 10, 0.5, mix(metal, -0.25));
    rect(g, tx, DB - 4, 10, 0.5, mix(metal, -0.25));
    rect(g, tx - 1, DB - 14, 12, 2, mix(metal, 0.1));
    rect(g, tx + 3.5, DB - 15.5, 3, 1.5, mix(metal, -0.2));
    if (r() < 0.5) rect(g, tx + 2, DB - 16, 4, 2, ["#e8e0c8", "#6a8a4a", "#c84a3a"][Math.floor(r() * 3)]);
  }

  if (after) {
    // 잔해와 도로 균열
    for (let i = 0; i < width / 25; i++) rect(g, Math.floor(r() * width), wallBase + 6 + Math.floor(r() * 50), 2 + Math.floor(r() * 4), 2, r() < 0.5 ? "#6a5a50" : "#3a3030");
    for (let i = 0; i < width / 120; i++) {
      g.strokeStyle = "#1a1416";
      g.lineWidth = 1;
      g.beginPath();
      let cx = r() * width;
      let cy = 242 + r() * 22;
      g.moveTo(cx, cy);
      for (let s2 = 0; s2 < 5; s2++) {
        cx += (r() - 0.3) * 14;
        cy += (r() - 0.5) * 6;
        g.lineTo(cx, cy);
      }
      g.stroke();
    }
  }
  info.canvas = pixelize(c, width, H, { opaque: true });
  return info;
}

function drawBrownstone(g: G, x: number, w: number, after: boolean, r: () => number): void {
  const top = 24;
  const stone = after ? "#5a3a30" : "#7a4a36";
  bricks(g, x, top, w, 176, stone, after ? "#4a2e26" : "#64392a", [after ? "#523428" : "#86543e", after ? "#4c3024" : "#6e4230"], r);
  rect(g, x - 4, top - 6, w + 8, 6, "#b8a890");
  for (let i = 0; i < w + 8; i += 6) rect(g, x - 4 + i, top, 3, 3, "#a8987e");
  // 위층 창문
  for (let fl = 0; fl < 3; fl++) {
    for (let i = 0; i < 5; i++) {
      const wx = x + 16 + i * 48;
      const lit = !after && r() < 0.35;
      windowAt(g, wx, top + 12 + fl * 36, 22, 24, after ? (r() < 0.3 ? "broken" : "dark") : lit ? "lit" : "dark", r, "#d8c8a8");
    }
  }
  // 1층 아치 창 + 철창
  rect(g, x, 130, w, 4, "#b8a890");
  for (const ax of [x + 14, x + 60, x + w - 92, x + w - 46]) {
    rect(g, ax, 146, 32, 46, "#d8c8a8");
    rect(g, ax + 2, 148, 28, 44, after ? "#101016" : "#2a3048");
    g.fillStyle = "#d8c8a8";
    g.beginPath();
    g.arc(ax + 16, 150, 16, Math.PI, 0);
    g.fill();
    g.fillStyle = after ? "#101016" : "#2a3048";
    g.beginPath();
    g.arc(ax + 16, 150, 14, Math.PI, 0);
    g.fill();
    if (!after && r() < 0.5) vgrad(g, ax + 4, 150, 24, 190, [[0, "#ffd88a"], [1, "#a8602a"]]);
    for (let k = 0; k <= 32; k += 4) rect(g, ax + k, 168, 1, 30, "#14141a");
    rect(g, ax - 2, 168, 36, 2, "#14141a");
    rect(g, ax - 2, 196, 36, 2, "#14141a");
  }
  // 현관 아치 문 + 계단
  const dx = x + w / 2;
  rect(g, dx - 22, 112, 44, 66, "#d8c8a8");
  g.fillStyle = "#d8c8a8";
  g.beginPath();
  g.arc(dx, 116, 22, Math.PI, 0);
  g.fill();
  rect(g, dx - 16, 116, 32, 60, "#3a2418");
  g.fillStyle = "#3a2418";
  g.beginPath();
  g.arc(dx, 118, 16, Math.PI, 0);
  g.fill();
  rect(g, dx - 1, 110, 2, 66, "#22140c");
  rect(g, dx - 6, 146, 2, 3, "#d8b048");
  rect(g, dx + 4, 146, 2, 3, "#d8b048");
  smallText(g, "31", dx, 102, "#3a2418");
}

/** 브라운스톤 현관 계단: 문 아래(doorY)에서 인도(groundY)까지, 앞으로 갈수록 넓어진다 */
function drawStoop(g: G, dx: number, doorY: number, groundY: number): void {
  const n = Math.round((groundY - doorY) / 6);
  for (let s = 0; s < n; s++) {
    const sy = doorY + s * 6;
    rect(g, dx - 26 - s * 1.6, sy, 52 + s * 3.2, 6, s % 2 ? "#a89880" : "#b8a890");
    rect(g, dx - 26 - s * 1.6, sy, 52 + s * 3.2, 1, "#d8c8a8");
    rect(g, dx - 26 - s * 1.6, sy + 5, 52 + s * 3.2, 1, "#8a7a64");
  }
  // 난간
  g.strokeStyle = "#14141a";
  g.lineWidth = 2;
  const end = n * 1.6;
  for (const side of [-1, 1]) {
    g.beginPath();
    g.moveTo(dx + side * 26, doorY - 10);
    g.lineTo(dx + side * (28 + end), groundY - 4);
    g.stroke();
    for (let k = 0; k < n; k++) rect(g, dx + side * (27 + k * 1.6) - 0.5, doorY - 8 + k * 6, 1, 10, "#14141a");
    rect(g, dx + side * (28 + end) - 2, groundY - 8, 4, 8, "#14141a");
  }
}

interface PosterSpec { lines: string[]; paper: string; ink: string; label: string; used?: boolean }
function drawFacade(g: G, x: number, w: number, top: number, kind: "brick" | "shop" | "blue" | "brown", after: boolean, r: () => number, info: StreetInfo, bodega: boolean, spec: PosterSpec | null = null): void {
  const colors = {
    brick: ["#8a3a2a", "#6a2a1e", ["#9a4430", "#7a3224"]],
    shop: ["#7a3424", "#5e281c", ["#8a3c2a", "#6a2e20"]],
    blue: ["#3a6a7a", "#2e5462", ["#447a8a", "#305a68"]],
    brown: ["#6a4a3a", "#523828", ["#7a5644", "#5a3e30"]],
  } as const;
  const [base, mortar, vary] = colors[kind];
  const dim = (c: string) => (after ? shade(c, 0.6) : c);
  if (kind === "blue") {
    rect(g, x, top, w, 200 - top, dim(base));
    for (let yy = top; yy < 200; yy += 6) rect(g, x, yy, w, 1, dim(mortar));
  } else {
    bricks(g, x, top, w, 200 - top, dim(base), dim(mortar), vary.map(dim), r);
  }
  // 코니스(처마 장식): 돌출 띠 + 치아 모양 장식 + 그림자
  const stone = dim("#c8b8a0");
  rect(g, x - 4, top - 7, w + 8, 4, stone);
  rect(g, x - 4, top - 7, w + 8, 1, mix(stone, 0.25));
  for (let dx = 0; dx < w + 6; dx += 4) rect(g, x - 3 + dx, top - 3, 2, 3, mix(stone, -0.08));
  rect(g, x - 3, top, w + 6, 2, "rgba(0,0,0,0.35)");
  // 배수관
  const pipeX = x + w - 5;
  rect(g, pipeX, top, 3, 200 - top, dim("#4a4a50"));
  rect(g, pipeX, top, 1, 200 - top, dim("#6a6a72"));
  for (let py = top + 20; py < 196; py += 34) rect(g, pipeX - 1, py, 5, 2, dim("#3a3a40"));

  const floors = Math.floor((150 - top) / 34);
  for (let fl = 0; fl < floors; fl++) {
    for (let wx = x + 12; wx < x + w - 24; wx += 34) {
      const st = after ? (r() < 0.25 ? "fire" : r() < 0.4 ? "broken" : "dark") : r() < 0.3 ? "lit" : "dark";
      const wy = top + 10 + fl * 34;
      windowAt(g, wx, wy, 20, 22, st, r);
      if (st === "fire") info.fires.push({ x: wx + 1, y: wy + 1, w: 18, h: 20 });
      else if (r() < 0.18) acUnit(g, wx + 4, wy + 14);
    }
  }
  if (kind !== "shop" && r() < 0.7) fireEscape(g, x + w / 2 - 22, 44, top + 34, floors, 34);
  rect(g, x, 149, w, 4, stone);
  rect(g, x, 149, w, 1, mix(stone, 0.25));
  rect(g, x, 153, w, 1, "rgba(0,0,0,0.4)");

  if (kind === "shop") {
    // 1층 가게
    rect(g, x + 6, 156, w - 12, 44, "#16161c");
    rect(g, x + 4, 156, 3, 44, mix(stone, -0.1));
    rect(g, x + w - 7, 156, 3, 44, mix(stone, -0.1));
    if (bodega) {
      info.bodega = x + w / 2;
      // 줄무늬 차양
      for (let i = 0; i < w - 8; i += 6) {
        rect(g, x + 4 + i, 152, 6, 9, after ? (i % 12 ? "#3a2020" : "#4a3a30") : i % 12 ? "#c83a2a" : "#f0e8d8");
      }
      for (let i = 0; i < w - 8; i += 6) {
        rect(g, x + 4 + i, 161, 6, 2, after ? "#2a1818" : i % 12 ? "#9a2a1e" : "#c8c0b0");
        rect(g, x + 5 + i, 163, 4, 1, after ? "#2a1818" : i % 12 ? "#9a2a1e" : "#c8c0b0");
      }
      rect(g, x + 4, 164, w - 8, 2, "rgba(0,0,0,0.4)");
      // 간판
      rect(g, x + 24, 140, w - 48, 10, after ? "#2a1414" : "#1e1e24");
      smallText(g, "DELI & GROCERY 24H", x + w / 2, 145, after ? "#6a4a3a" : "#ff6a8a", 7);
      rect(g, x + 14, 168, w - 28, 30, after ? "#0e0e12" : "#ffe8a0");
      if (!after) {
        for (const sy of [172, 181, 190]) {
          rect(g, x + 16, sy + 6, w - 32, 1, "#a88a5a");
          for (let i = 0; i < 9; i++) {
            const c = ["#c83a2a", "#3a8ac8", "#e8c83a", "#4ab84a", "#e8e0d0", "#8a5a3a", "#d87a3a"][(i + sy) % 7];
            rect(g, x + 18 + i * 12, sy, 8, 6, c);
            rect(g, x + 18 + i * 12, sy, 8, 1, mix(c, 0.3));
          }
        }
        rect(g, x + w / 2 - 12, 172, 24, 26, "#d8c890");
        smallText(g, "OPEN", x + w / 2, 180, "#d82a2a", 6);
      } else {
        for (let i = 0; i < 14; i++) rect(g, x + 16 + Math.floor(r() * (w - 36)), 170 + Math.floor(r() * 26), 3 + Math.floor(r() * 3), 1, "#8a9aaa");
        rect(g, x + 20, 194, w - 40, 4, "#2a2020");
        rect(g, x + 30, 190, 10, 6, "#3a2a20");
      }
    } else {
      for (let sx = x + 8; sx < x + w - 8; sx += 3) {
        rect(g, sx, 158, 2, 42, after ? "#4a4a50" : "#6a6a74");
        rect(g, sx, 158, 1, 42, after ? "#5a5a60" : "#84848e");
      }
      rect(g, x + 8, 196, w - 16, 4, after ? "#3a3a40" : "#54545c");
      graffiti(g, x + 10, 164, w / 2 - 14, r, 18);
      if (r() < 0.6) graffiti(g, x + w / 2 + 4, 172, w / 2 - 14, r, 16);
      const names = ["PIZZA", "LAUNDRY", "VINYL", "REPAIR", "NAILS"];
      rect(g, x + 4, 150, w - 8, 7, after ? "#2a2a30" : "#e8d8a0");
      rect(g, x + 4, 150, w - 8, 1, after ? "#3a3a40" : "#fff0c0");
      smallText(g, names[Math.floor(r() * names.length)], x + w / 2, 154, "#2a2a30", 6);
    }
  } else {
    // 현관문 (계단 1칸 + 문틀 + 판넬)
    const dx = x + 14 + Math.floor(r() * (w - 60));
    rect(g, dx - 3, 158, 28, 42, stone);
    rect(g, dx - 3, 158, 28, 1, mix(stone, 0.25));
    rect(g, dx, 161, 22, 39, dim("#2a1e2a"));
    rect(g, dx + 2, 164, 8, 14, dim("#3a2a3a"));
    rect(g, dx + 12, 164, 8, 14, dim("#3a2a3a"));
    rect(g, dx + 2, 182, 8, 15, dim("#3a2a3a"));
    rect(g, dx + 12, 182, 8, 15, dim("#3a2a3a"));
    rect(g, dx + 18, 180, 2, 3, "#c8a83a");
    rect(g, dx - 4, 198, 30, 2, mix(stone, -0.15));
    // 문 양옆의 빈 벽: 넓은 쪽엔 대자보, 다른 쪽엔 낙서
    const left: [number, number] = [x + 6, dx - 8];
    const right: [number, number] = [dx + 30, x + w - 12];
    const spans = [left, right].sort((a, b) => b[1] - b[0] - (a[1] - a[0]));
    const [big, small] = spans;
    if (spec && big[1] - big[0] >= 44) {
      const px = Math.round((big[0] + big[1]) / 2 - 18);
      poster(g, px, 160, 36, 32, spec.paper, spec.ink, spec.lines, r);
      info.posters.push({ x: px + 18, text: spec.label });
      spec.used = true;
      if (r() < 0.7) graffiti(g, small[0], 172, small[1] - small[0], r, 16);
    } else if (r() < 0.7) graffiti(g, big[0], 170, big[1] - big[0], r, 18);
  }
}

function shade(hex: string, k: number): string {
  const n = parseInt(hex.slice(1), 16);
  const rr = Math.round(((n >> 16) & 255) * k);
  const gg = Math.round(((n >> 8) & 255) * k);
  const bb = Math.round((n & 255) * k);
  return `rgb(${rr},${gg},${bb})`;
}

// ── 찰리의 집 ────────────────────────────────────────────
export const ROOM = {
  width: 720,
  door: 38,
  radiator: 110,
  desk: 210,
  windowExit: 210,
  armchair: 296,
  lamp: 334,
  bed: 420,
  wardrobe: 528,
  fridge: 606,
  coat: 672,
};

export function buildRoom(): HTMLCanvasElement {
  const W2 = ROOM.width;
  const c = makeDense(W2, H, BG_SCALE);
  const g = c.getContext("2d")!;
  const r = rng(777);
  bricks(g, 0, 0, W2, GROUND, "#5a3428", "#40241c", ["#64392c", "#4e2c22", "#6a4030"], r);
  // 떨어진 회반죽
  for (let i = 0; i < 7; i++) {
    const px = Math.floor(r() * W2);
    const py = 30 + Math.floor(r() * 110);
    const pw = 16 + Math.floor(r() * 26);
    for (let row = 0; row < 14; row += 2) {
      const inset = Math.floor(Math.abs(row - 7) * (1 + r()));
      g.fillStyle = row % 4 ? "#6e5648" : "#76604f";
      g.fillRect(px + inset, py + row, Math.max(2, pw - inset * 2 + Math.floor(r() * 6)), 2);
    }
  }
  // 천장 들보
  rect(g, 0, 0, W2, 14, "#2a1a12");
  for (let bx = 0; bx < W2; bx += 90) rect(g, bx, 0, 10, 20, "#22140e");
  // 바닥
  for (let y = GROUND - 4; y < H; y += 6) {
    for (let fx = ((y / 6) % 2) * 20; fx < W2; fx += 40) rect(g, fx, y, 39, 5, y % 12 ? "#5a3a24" : "#4e321e");
  }
  rect(g, 0, GROUND - 6, W2, 3, "#2a1a12");

  // 걸레받이
  rect(g, 0, GROUND - 9, W2, 3, "#3a2418");
  rect(g, 0, GROUND - 9, W2, 1, "#5a3a26");

  // 현관문 (판넬 + 문틀 명암)
  box(g, 16, 108, 46, 106, "#2a1a12");
  box(g, 21, 113, 36, 101, "#5a3822");
  for (const [py, ph] of [[119, 36], [161, 46]] as const) {
    rect(g, 25, py, 28, ph, "#4a2e1c");
    rect(g, 25, py, 28, 1, "#3a2214");
    rect(g, 25, py + ph - 1, 28, 1, "#6a442a");
    rect(g, 25, py, 1, ph, "#3a2214");
  }
  rect(g, 50, 160, 4, 6, "#c8a83a");
  rect(g, 50, 160, 4, 1, "#f0d878");
  rect(g, 30, 124, 18, 10, "#d8d0b8");
  rect(g, 32, 126, 14, 1, "#8a8a7a");
  rect(g, 32, 129, 10, 1, "#8a8a7a");
  // 창문 1 + 라디에이터
  roomWindow(g, 82, 58, 60, 88, r);
  box(g, 84, 166, 56, 40, "#8a8a92");
  for (let k = 0; k < 52; k += 5) {
    rect(g, 86 + k, 170, 3, 32, "#a4a4ac");
    rect(g, 86 + k, 170, 1, 32, "#c4c4cc");
    rect(g, 88 + k, 170, 1, 32, "#76767e");
  }
  rect(g, 132, 160, 4, 6, "#6a6a72");
  // 창문 2 (책상 위, 샘이 나가는 창)
  roomWindow(g, 178, 52, 64, 82, r);
  // 책상
  box(g, 166, 166, 90, 6, "#7a5430");
  for (let i = 0; i < 90; i += 11) rect(g, 168 + i, 168, 6, 1, "#8a6038");
  box(g, 170, 172, 4, 42, "#4a3220");
  box(g, 248, 172, 4, 42, "#4a3220");
  box(g, 224, 172, 24, 26, "#5e4026");
  rect(g, 226, 184, 20, 1, "#3a2818");
  rect(g, 234, 178, 4, 2, "#c8a83a");
  rect(g, 234, 190, 4, 2, "#c8a83a");
  // 모니터
  box(g, 186, 142, 34, 22, "#1a1a20");
  vgrad(g, 188, 144, 30, 162, [[0, "#3a6a9a"], [1, "#1a3a5a"]]);
  rect(g, 190, 147, 14, 2, "#e8eef4");
  rect(g, 190, 151, 22, 1, "#8ab0d0");
  rect(g, 190, 154, 18, 1, "#8ab0d0");
  rect(g, 190, 157, 20, 1, "#8ab0d0");
  rect(g, 212, 146, 4, 4, "#e84a4a");
  rect(g, 200, 164, 6, 3, "#1a1a20");
  rect(g, 196, 166, 14, 1, "#2a2a30");
  box(g, 180, 166, 30, 2, "#2a2a30");
  // 탁상 스탠드 + 서류 더미 + 머그
  rect(g, 232, 150, 2, 16, "#2a2a30");
  rect(g, 228, 145, 12, 5, "#c8b86a");
  rect(g, 228, 145, 12, 1, "#e8d88a");
  for (let i = 0; i < 6; i++) rect(g, 170 + (i % 2), 164 - i * 2, 14, 2, i % 2 ? "#d8d0b8" : "#efe8d8");
  rect(g, 244, 160, 6, 6, "#e8e0d8");
  rect(g, 250, 162, 2, 3, "#e8e0d8");
  rect(g, 245, 161, 4, 1, "#5a3a24");
  // 의자
  box(g, 192, 180, 26, 5, "#2a2a32");
  box(g, 212, 156, 5, 26, "#2a2a32");
  rect(g, 204, 185, 3, 21, "#18181e");
  rect(g, 194, 206, 22, 2, "#18181e");
  rect(g, 194, 208, 2, 2, "#18181e");
  rect(g, 214, 208, 2, 2, "#18181e");
  // 책장 (벽)
  box(g, 266, 78, 74, 4, "#5a3a22");
  rect(g, 268, 82, 3, 6, "#3a2414");
  rect(g, 333, 82, 3, 6, "#3a2414");
  let bxp = 270;
  for (let i = 0; i < 13; i++) {
    const bw = 3 + Math.floor(r() * 3);
    const bh = 12 + Math.floor(r() * 5);
    const col = ["#8a2a2a", "#2a4a8a", "#c8a83a", "#3a6a3a", "#6a3a6a", "#d8d0c0"][i % 6];
    rect(g, bxp, 78 - bh, bw, bh, col);
    rect(g, bxp, 78 - bh, 1, bh, mix(col, 0.2));
    rect(g, bxp, 78 - bh + 3, bw, 1, mix(col, -0.3));
    bxp += bw + (i === 8 ? 6 : 0);
  }
  rect(g, bxp + 2, 70, 10, 8, "#c8c0b0");
  // 안락의자
  armchair(g, ROOM.armchair);
  // 스탠드 조명
  rect(g, ROOM.lamp, 124, 2, 90, "#1a1a20");
  rect(g, ROOM.lamp, 124, 1, 90, "#3a3a44");
  rect(g, ROOM.lamp - 6, 210, 14, 4, "#1a1a20");
  for (let row = 0; row < 14; row++) {
    const half = 5 + Math.floor(row / 2.5);
    rect(g, ROOM.lamp + 1 - half, 114 + row, half * 2, 1, row % 4 === 3 ? "#c8b880" : "#e0d0a0");
  }
  rect(g, ROOM.lamp - 10, 127, 22, 1, "#a89870");
  // 샹들리에
  rect(g, 470, 14, 1, 16, "#2a2a30");
  rect(g, 456, 30, 30, 2, "#3a3a40");
  rect(g, 456, 30, 30, 1, "#6a6a70");
  for (const lx of [457, 470, 483]) {
    rect(g, lx, 25, 2, 5, "#3a3a40");
    rect(g, lx - 1, 20, 4, 5, "#fff0b0");
    rect(g, lx, 20, 1, 5, "#ffffff");
  }
  // 액자
  box(g, 386, 70, 40, 30, "#3a2414");
  rect(g, 389, 73, 34, 24, "#c8d8e0");
  vgrad(g, 389, 73, 34, 86, [[0, "#9ac0d8"], [1, "#e8d0a8"]]);
  rect(g, 389, 86, 34, 11, "#6a8a5a");
  rect(g, 400, 82, 10, 4, "#4a6a4a");
  rect(g, 412, 84, 8, 2, "#4a6a4a");
  // 침대
  box(g, 366, 146, 8, 68, "#4a2c18");
  rect(g, 366, 146, 8, 3, "#6a4428");
  box(g, 370, 186, 114, 18, "#6a4630");
  for (let i = 0; i < 110; i += 9) rect(g, 372 + i, 190, 5, 1, "#7a5438");
  rect(g, 372, 176, 110, 11, "#d8d2c8");
  rect(g, 372, 176, 110, 1, "#f0ece4");
  rect(g, 372, 186, 110, 1, "#a8a29a");
  box(g, 376, 168, 26, 11, "#ece6dc");
  rect(g, 380, 172, 16, 1, "#c8c2b8");
  g.fillStyle = "#4a5a8a";
  g.beginPath();
  g.moveTo(398, 174);
  g.lineTo(484, 171);
  g.lineTo(488, 199);
  g.lineTo(418, 201);
  g.lineTo(402, 189);
  g.fill();
  g.fillStyle = "#5a6a9a";
  g.beginPath();
  g.moveTo(400, 175);
  g.lineTo(484, 172);
  g.lineTo(484, 176);
  g.lineTo(404, 180);
  g.fill();
  for (const [fx, fy, fw] of [[420, 182, 30], [440, 190, 26], [410, 194, 14]] as const) rect(g, fx, fy, fw, 1, "#3a4a72");
  rect(g, 452, 180, 18, 8, "#c8a840");
  rect(g, 452, 180, 18, 1, "#e8c860");
  box(g, 370, 204, 5, 10, "#3a2414");
  box(g, 479, 204, 5, 10, "#3a2414");
  // 옷장
  box(g, 502, 88, 58, 126, "#3a2416");
  rect(g, 500, 86, 62, 4, "#4e3220");
  rect(g, 500, 86, 62, 1, "#6a462c");
  for (const dx of [506, 532]) {
    box(g, dx, 94, 24, 112, "#553722");
    rect(g, dx + 3, 98, 18, 46, "#4a2e1c");
    rect(g, dx + 3, 98, 18, 1, "#3a2414");
    rect(g, dx + 3, 143, 18, 1, "#6a4428");
    rect(g, dx + 3, 152, 18, 50, "#4a2e1c");
    rect(g, dx + 3, 152, 18, 1, "#3a2414");
    rect(g, dx + 3, 201, 18, 1, "#6a4428");
  }
  rect(g, 527, 146, 2, 6, "#c8a83a");
  rect(g, 533, 146, 2, 6, "#c8a83a");
  rect(g, 510, 76, 22, 10, "#8a6a4a");
  rect(g, 510, 76, 22, 1, "#a8886a");
  rect(g, 536, 70, 16, 16, "#a8845a");
  rect(g, 536, 70, 16, 1, "#c8a47a");
  rect(g, 536, 77, 16, 1, "#7a5a3a");
  // 냉장고 (레트로 2도어)
  fridgeOutside(g, 582, 104);
  // 코트걸이
  rect(g, ROOM.coat, 118, 3, 96, "#2a1a12");
  rect(g, ROOM.coat, 118, 1, 96, "#4a3020");
  rect(g, ROOM.coat - 8, 210, 19, 4, "#2a1a12");
  rect(g, ROOM.coat - 4, 118, 11, 2, "#2a1a12");
  box(g, ROOM.coat - 10, 122, 10, 38, "#5a4a3a");
  rect(g, ROOM.coat - 8, 126, 1, 30, "#4a3a2c");
  box(g, ROOM.coat + 3, 124, 10, 30, "#3a4a5a");
  rect(g, ROOM.coat + 5, 126, 1, 24, "#2e3c4a");
  // 어질러진 것들: 고양이 화장실, 옷 더미, 피자 박스, 고양이 밥그릇, 가방
  box(g, 64, 202, 26, 12, "#9a9a8a");
  rect(g, 66, 202, 22, 3, "#c8c0a8");
  for (let i = 0; i < 6; i++) rect(g, 68 + i * 3, 203, 1, 1, "#a89a7a");
  rect(g, 338, 206, 26, 8, "#6a4a7a");
  rect(g, 346, 203, 16, 4, "#3a6a8a");
  rect(g, 340, 206, 8, 1, "#8a6a9a");
  box(g, 488, 206, 28, 4, "#c8a870");
  rect(g, 490, 204, 24, 2, "#d8b880");
  rect(g, 496, 207, 10, 1, "#b83a2a");
  box(g, 562, 208, 12, 6, "#e8e0d8");
  rect(g, 564, 208, 8, 2, "#8a5a3a");
  rect(g, 574, 210, 8, 4, "#4a8ac8");
  box(g, 644, 200, 20, 14, "#3a3a44");
  rect(g, 648, 196, 12, 4, "#2a2a30");
  // 카펫
  rect(g, 296, 213, 180, 5, "#7a2a2a");
  for (let i = 0; i < 180; i += 6) rect(g, 296 + i, 214, 3, 3, i % 12 ? "#9a4a3a" : "#c88a4a");
  rect(g, 296, 218, 180, 1, "#5a1e1e");
  return pixelize(c, c.width / BG_SCALE, c.height / BG_SCALE, { opaque: true });
}

/** 한 칸짜리 상자: 위쪽 빛, 오른쪽·아래 그림자 */
function box(g: G, x: number, y: number, w: number, h: number, col: string): void {
  rect(g, x, y, w, h, col);
  rect(g, x, y, w, 0.5, mix(col, 0.25));
  rect(g, x, y + 0.5, w, 0.5, mix(col, 0.1));
  rect(g, x, y, 0.5, h, mix(col, 0.12));
  rect(g, x + w - 0.5, y + 0.5, 0.5, h - 0.5, mix(col, -0.3));
  rect(g, x + w - 1, y + 1, 0.5, h - 1.5, mix(col, -0.12));
  rect(g, x + 0.5, y + h - 0.5, w - 0.5, 0.5, mix(col, -0.35));
}

function fridgeOutside(g: G, x: number, y: number): void {
  const w = 48;
  const h = GROUND - y;
  // 몸체 (둥근 윗모서리 + 세로 명암)
  for (let i = 0; i < w; i++) {
    const k = i / w;
    const col = k < 0.15 ? "#f0f0ea" : k > 0.85 ? "#b8bab4" : "#dcdcd4";
    const top = i < 3 || i > w - 4 ? 2 : 0;
    rect(g, x + i, y + top, 1, h - top, col);
  }
  rect(g, x + 2, y, w - 4, 1, "#f8f8f2");
  // 냉동실 / 냉장실 경계
  rect(g, x, y + 34, w, 2, "#8a8c86");
  rect(g, x, y + 36, w, 1, "#f0f0ea");
  // 손잡이 (크롬)
  for (const [hy, hh] of [[y + 10, 18], [y + 44, 34]] as const) {
    rect(g, x + w - 8, hy, 3, hh, "#9aa0a8");
    rect(g, x + w - 8, hy, 1, hh, "#f4f8fc");
    rect(g, x + w - 6, hy, 1, hh, "#6a7078");
  }
  // 아래 통풍구
  rect(g, x + 2, GROUND - 8, w - 4, 6, "#6a6c66");
  for (let i = 4; i < w - 4; i += 3) rect(g, x + i, GROUND - 7, 2, 4, "#3a3c38");
  // 자석 · 메모 · 샘 사진
  rect(g, x + 6, y + 8, 5, 5, "#e84a4a");
  rect(g, x + 6, y + 8, 5, 1, "#ff8a7a");
  rect(g, x + 16, y + 14, 5, 5, "#4a8ae8");
  rect(g, x + 16, y + 14, 5, 1, "#8ab8ff");
  rect(g, x + 5, y + 46, 16, 19, "#f4f4f0");
  rect(g, x + 7, y + 48, 12, 11, "#8a9aaa");
  rect(g, x + 9, y + 53, 7, 5, "#c3c6d0");
  rect(g, x + 10, y + 51, 2, 2, "#c3c6d0");
  rect(g, x + 14, y + 51, 2, 2, "#c3c6d0");
  rect(g, x + 11, y + 44, 4, 3, "#e8c84a");
  rect(g, x + 24, y + 60, 12, 14, "#fff6a0");
  rect(g, x + 26, y + 63, 8, 1, "#8a8a6a");
  rect(g, x + 26, y + 66, 6, 1, "#8a8a6a");
  rect(g, x + 26, y + 69, 7, 1, "#8a8a6a");
  rect(g, x + 28, y + 58, 4, 3, "#4ab84a");
  // 그림자
  rect(g, x - 1, GROUND - 1, w + 4, 2, "rgba(0,0,0,0.35)");
}

function roomWindow(g: G, x: number, y: number, w: number, h: number, r: () => number): void {
  box(g, x - 5, y - 5, w + 10, h + 10, "#d8d0c0");
  vgrad(g, x, y, w, y + h, [[0, "#0a0e1e"], [1, "#22284a"]]);
  for (let i = 0; i < 6; i++) {
    const bx = x + Math.floor(r() * (w - 10));
    const bh = 20 + Math.floor(r() * 50);
    const bw = 10 + Math.floor(r() * 10);
    rect(g, bx, y + h - bh, bw, bh, "#141a30");
    rect(g, bx, y + h - bh, 1, bh, "#1e2640");
    for (let k = 0; k < 5; k++) if (r() < 0.6) rect(g, bx + 2 + Math.floor(r() * (bw - 4)), y + h - bh + 4 + k * 8, 2, 2, "#e8c070");
  }
  // 비상계단 창살
  for (let k = 0; k < w; k += 5) rect(g, x + k, y + h - 20, 1, 20, "#0a0a10");
  rect(g, x, y + h - 21, w, 2, "#0a0a10");
  rect(g, x + w / 2 - 1, y, 2, h, "#d8d0c0");
  rect(g, x, y + h / 2 - 1, w, 2, "#d8d0c0");
  rect(g, x, y + h / 2 + 1, w, 1, "rgba(0,0,0,0.3)");
  // 창틀 아래 받침
  rect(g, x - 7, y + h + 4, w + 14, 3, "#e0d8c8");
  rect(g, x - 7, y + h + 7, w + 14, 1, "rgba(0,0,0,0.4)");
  // 커튼 (주름)
  for (const cx of [x - 12, x + w + 2]) {
    for (let i = 0; i < 10; i++) rect(g, cx + i, y - 8, 1, h + 16, i % 3 === 0 ? "#8a2a2a" : i % 3 === 1 ? "#6a1e1e" : "#521616");
  }
  rect(g, x - 14, y - 11, w + 28, 3, "#2a1a12");
  rect(g, x - 14, y - 11, w + 28, 1, "#4a3020");
}

function armchair(g: G, x: number): void {
  const c = "#6a3232";
  box(g, x - 25, 152, 12, 54, "#5a2a2a");
  for (let i = 0; i < 4; i++) rect(g, x - 22, 160 + i * 11, 2, 2, "#3a1818");
  box(g, x - 20, 180, 46, 16, c);
  rect(g, x - 18, 182, 42, 2, "#8a4444");
  box(g, x - 23, 172, 9, 26, "#542626");
  box(g, x + 22, 172, 9, 26, "#542626");
  rect(g, x - 23, 172, 9, 2, "#7a3a3a");
  rect(g, x + 22, 172, 9, 2, "#7a3a3a");
  box(g, x - 20, 196, 50, 7, "#4a2222");
  box(g, x - 19, 203, 4, 11, "#2a1a12");
  box(g, x + 23, 203, 4, 11, "#2a1a12");
}

// ── 냉장고 안 ────────────────────────────────────────────
export const FRIDGE_SPOTS = {
  beer: { x: 104, y: 86 },
  energy: { x: 190, y: 86 },
  fish: { x: 318, y: 66 },
  meat: { x: 276, y: 156 },
  catfood: { x: 92, y: 158 },
  sausage: { x: 168, y: 214 },
};

function can(g: G, x: number, y: number, w: number, h: number, body: string, label: string, mark: string): void {
  rect(g, x, y + 2, w, h - 3, body);
  rect(g, x + 1, y + 2, 1, h - 3, mix(body, 0.35));
  rect(g, x + 2, y + 2, 1, h - 3, mix(body, 0.15));
  rect(g, x + w - 2, y + 2, 2, h - 3, mix(body, -0.35));
  rect(g, x + 1, y, w - 2, 2, "#c8c8d0");
  rect(g, x + 2, y, w - 4, 1, "#e8e8f0");
  rect(g, x + 1, y + h - 1, w - 2, 1, "#9a9aa4");
  if (label) {
    rect(g, x, y + Math.floor(h * 0.35), w, Math.floor(h * 0.3), label);
    rect(g, x + w - 2, y + Math.floor(h * 0.35), 2, Math.floor(h * 0.3), mix(label, -0.3));
    rect(g, x + Math.floor(w / 2) - 1, y + Math.floor(h * 0.42), 3, 3, mark);
  }
}

function hangingFish(g: G, x: number, top: number, len: number): void {
  rect(g, x, 22, 1, top - 22, "#8a8270");
  rect(g, x - 1, top - 2, 3, 2, "#a89a70");
  // 꼬리 (위)
  for (let i = 0; i < 7; i++) {
    rect(g, x - 1 - Math.floor((6 - i) * 0.8), top + i, 1, 1, "#4a5a6a");
    rect(g, x + 1 + Math.floor((6 - i) * 0.8), top + i, 1, 1, "#4a5a6a");
  }
  rect(g, x - 1, top + 4, 3, 4, "#5a6a7a");
  // 몸통 (아래로 갈수록 굵어지다 머리)
  for (let i = 0; i < len; i++) {
    const t = i / len;
    const half = Math.round(1 + Math.sin(Math.min(1, t * 1.25) * Math.PI * 0.55) * 6);
    const y = top + 8 + i;
    rect(g, x - half, y, half * 2 + 1, 1, "#a8b8c8");
    rect(g, x - half, y, 2, 1, "#5a6a7c");
    rect(g, x + half - 1, y, 2, 1, "#d8e2ea");
    if (i % 3 === 0 && t < 0.8) rect(g, x - half + 3 + (i % 2), y, 1, 1, "#8898a8");
  }
  // 지느러미
  rect(g, x - 9, top + 8 + Math.floor(len * 0.45), 3, 5, "#6a7a8a");
  rect(g, x + 7, top + 8 + Math.floor(len * 0.55), 3, 4, "#6a7a8a");
  // 머리: 아가미, 눈, 입
  const hy = top + 8 + len;
  for (let i = 0; i < 8; i++) {
    const half = 6 - Math.floor(i * 0.75);
    rect(g, x - half, hy + i, half * 2 + 1, 1, i < 2 ? "#98a8b8" : "#b8c8d6");
  }
  rect(g, x - 5, hy - 1, 11, 1, "#6a5a6a");
  rect(g, x - 3, hy + 3, 3, 3, "#f0f0e8");
  rect(g, x - 2, hy + 4, 1, 1, "#101010");
  rect(g, x, hy + 7, 2, 1, "#6a4a4a");
}

export function buildFridge(): HTMLCanvasElement {
  const c = makeDense(480, H, BG_SCALE);
  const g = c.getContext("2d")!;
  const r = rng(99);
  // 부엌 벽 (타일)
  rect(g, 0, 0, 480, H, "#3a2e30");
  for (let ty = 0; ty < H; ty += 10) for (let tx = (ty / 10) % 2 ? 5 : 0; tx < 480; tx += 10) {
    rect(g, tx, ty, 9, 9, "#463a3c");
    rect(g, tx, ty, 9, 1, "#52464a");
  }
  // 냉장고 바깥 껍데기
  box(g, 20, 8, 380, 262, "#dedcd4");
  rect(g, 24, 12, 372, 258, "#cfcdc4");
  // 안쪽 공간
  const ix = 34;
  const iy = 20;
  const iw = 352;
  const ih = 246;
  vgrad(g, ix, iy, iw, iy + ih, [[0, "#f4fafc"], [0.5, "#dbe8ee"], [1, "#b4c8d2"]]);
  // 양옆 벽 (원근)
  for (let i = 0; i < 12; i++) {
    rect(g, ix + i, iy + i, 1, ih - i * 2, mix("#c4d4dc", -i * 0.012));
    rect(g, ix + iw - 1 - i, iy + i, 1, ih - i * 2, mix("#b8c8d2", -i * 0.012));
  }
  rect(g, ix, iy, iw, 2, "#a8bcc8");
  // 전구와 빛
  const glow = g.createRadialGradient(210, 24, 2, 210, 24, 150);
  glow.addColorStop(0, "rgba(255,252,230,0.85)");
  glow.addColorStop(1, "rgba(255,252,230,0)");
  g.fillStyle = glow;
  g.fillRect(ix, iy, iw, ih);
  rect(g, 198, 20, 24, 6, "#e8e8e0");
  rect(g, 202, 24, 16, 3, "#fffbe0");
  // 유리 선반
  for (const sy of [104, 180]) {
    rect(g, ix + 4, sy, iw - 8, 4, "rgba(170,210,230,0.55)");
    rect(g, ix + 4, sy, iw - 8, 1, "#ffffff");
    rect(g, ix + 4, sy + 3, iw - 8, 2, "#8aa8b8");
    rect(g, ix + 4, sy + 5, iw - 8, 3, "rgba(60,90,110,0.18)");
    for (const ex of [ix + 2, ix + iw - 4]) rect(g, ex, sy - 1, 2, 7, "#9ab0bc");
  }

  // ── 위 칸: 맥주 · 에너지 드링크 · 매달린 생선
  for (let i = 0; i < 7; i++) can(g, 52 + i * 15, 70, 13, 34, "#c4302a", "#f0e2b0", "#c4302a");
  rect(g, 50, 96, 54, 8, "#a8845a");
  rect(g, 50, 96, 54, 1, "#c8a47a");
  rect(g, 62, 98, 30, 3, "#6a4a2a");
  for (let i = 0; i < 4; i++) {
    can(g, 166 + i * 12, 64, 10, 40, "#1c1c24", "", "");
    for (let k = 0; k < 5; k++) rect(g, 169 + i * 12 + (k % 2), 74 + k * 4, 2, 3, "#5aff5a");
  }
  hangingFish(g, 304, 30, 46);
  hangingFish(g, 332, 38, 40);
  rect(g, 300, 22, 40, 2, "#b8b0a0");

  // ── 가운데 칸: 고양이 통조림 탑 · 랩 씌운 고기 · 중국집 포장 박스
  const tin = (tx: number, ty: number) => {
    rect(g, tx, ty, 20, 12, "#e8862a");
    rect(g, tx, ty, 20, 2, "#d8d8e0");
    rect(g, tx, ty + 1, 20, 1, "#a8a8b0");
    rect(g, tx + 1, ty + 2, 1, 10, "#f8a84a");
    rect(g, tx + 18, ty + 2, 2, 10, "#b8601a");
    rect(g, tx + 5, ty + 4, 10, 6, "#fff8f0");
    rect(g, tx + 7, ty + 5, 1, 1, "#7a7a8a");
    rect(g, tx + 12, ty + 5, 1, 1, "#7a7a8a");
    rect(g, tx + 8, ty + 6, 4, 3, "#c3c6d0");
    rect(g, tx + 9, ty + 7, 1, 1, "#2a2a2a");
    rect(g, tx + 11, ty + 7, 1, 1, "#2a2a2a");
  };
  for (let k = 0; k < 3; k++) tin(52 + k * 22, 168);
  for (let k = 0; k < 2; k++) tin(63 + k * 22, 156);
  tin(74, 144);
  // 접시
  rect(g, 228, 172, 100, 4, "#f4f4f0");
  rect(g, 236, 170, 84, 2, "#ffffff");
  rect(g, 232, 176, 92, 1, "#b8bcc0");
  // 고기
  for (let row = 0; row < 22; row++) {
    const half = Math.round(Math.sqrt(1 - ((row - 11) / 11.5) ** 2) * 34);
    const col = row < 4 ? "#7a3a22" : row < 14 ? "#9a4e2e" : "#7a3a22";
    rect(g, 278 - half, 148 + row, half * 2, 1, col);
    if (row > 3 && row < 18) rect(g, 278 - half, 148 + row, 3, 1, "#5a2814");
  }
  for (let i = 0; i < 9; i++) rect(g, 256 + Math.floor(r() * 40), 152 + Math.floor(r() * 12), 3, 1, "#c8724a");
  rect(g, 306, 146, 18, 4, "#ece4d0");
  rect(g, 322, 143, 4, 3, "#ece4d0");
  rect(g, 322, 149, 4, 3, "#ece4d0");
  rect(g, 306, 149, 18, 1, "#c8c0a8");
  // 랩 반사
  g.fillStyle = "rgba(255,255,255,0.45)";
  for (let i = 0; i < 3; i++) g.fillRect(250 + i * 22, 146 + i, 10, 1);
  g.fillRect(244, 150, 1, 18);
  // 포장 박스
  rect(g, 340, 150, 30, 26, "#f4f0e8");
  rect(g, 340, 150, 30, 1, "#ffffff");
  rect(g, 368, 150, 2, 26, "#c8c4bc");
  rect(g, 344, 146, 22, 4, "#e8e4dc");
  rect(g, 352, 158, 8, 8, "#c83a2a");
  rect(g, 354, 156, 4, 2, "#c83a2a");
  rect(g, 354, 140, 1, 8, "#9a9a9a");

  // ── 아래 칸: 매달린 소시지 · 야채 서랍
  rect(g, 52, 186, 236, 1, "#8a8270");
  for (let i = 0; i < 10; i++) {
    const sx = 58 + i * 23;
    const drop = (i % 3) * 3;
    rect(g, sx + 4, 187, 1, 3 + drop, "#8a8270");
    for (let link = 0; link < 2; link++) {
      const ly = 190 + drop + link * 17;
      rect(g, sx + 1, ly, 7, 14, "#9a3a26");
      rect(g, sx + 2, ly - 1, 5, 1, "#9a3a26");
      rect(g, sx + 2, ly + 14, 5, 1, "#9a3a26");
      rect(g, sx + 2, ly + 1, 2, 12, "#c8604a");
      rect(g, sx + 6, ly + 1, 2, 12, "#6a2416");
      rect(g, sx + 3, ly + 4, 1, 1, "#e8a080");
      if (link === 0) rect(g, sx + 3, ly + 15, 3, 2, "#e8d8b0");
    }
  }
  for (const [dx, dw] of [[40, 166], [212, 168]] as const) {
    rect(g, dx, 228, dw, 34, "rgba(200,225,235,0.55)");
    rect(g, dx, 228, dw, 1, "#ffffff");
    rect(g, dx, 228, 1, 34, "#e8f4f8");
    rect(g, dx + dw - 1, 228, 1, 34, "#8aa8b8");
    rect(g, dx + dw / 2 - 12, 234, 24, 3, "#9ab4c4");
  }
  // 시든 상추
  for (let i = 0; i < 8; i++) {
    rect(g, 70 + i * 6, 244 - (i % 3) * 2, 7, 10, i % 2 ? "#8a9a4a" : "#a8a85a");
    rect(g, 72 + i * 6, 244 - (i % 3) * 2, 1, 6, "#6a6a2a");
  }
  rect(g, 240, 246, 30, 10, "#d87a2a");
  rect(g, 244, 244, 6, 3, "#4a8a3a");

  // ── 열린 문 (오른쪽)
  for (let i = 0; i < 76; i++) {
    const k = i / 76;
    rect(g, 402 + i, 8 + Math.round(k * 10), 1, 254 - Math.round(k * 20), mix("#e4e2da", -0.05 - k * 0.12));
  }
  rect(g, 402, 8, 4, 254, "#9a9a92");
  rect(g, 403, 8, 1, 254, "#6a6a64");
  for (const by of [60, 130, 200]) {
    rect(g, 410, by, 64, 4, "#c8d8e0");
    rect(g, 410, by, 64, 1, "#ffffff");
    rect(g, 410, by + 4, 64, 2, "rgba(0,0,0,0.2)");
  }
  // 문 칸 내용물: 케첩 · 머스터드 · 우유 · 계란
  rect(g, 416, 40, 9, 20, "#c82a22");
  rect(g, 418, 36, 5, 4, "#e8e8e8");
  rect(g, 417, 42, 2, 16, "#e85a4a");
  rect(g, 430, 42, 9, 18, "#e8c82a");
  rect(g, 432, 38, 5, 4, "#c83a2a");
  rect(g, 431, 44, 2, 14, "#fff07a");
  rect(g, 446, 30, 18, 30, "#f4f4f4");
  rect(g, 446, 26, 18, 4, "#e4e4e4");
  rect(g, 450, 22, 10, 4, "#4a8ae8");
  rect(g, 448, 38, 14, 10, "#4a8ae8");
  rect(g, 446, 30, 2, 30, "#ffffff");
  rect(g, 462, 30, 2, 30, "#c8c8c8");
  for (let i = 0; i < 4; i++) {
    rect(g, 416 + i * 13, 120, 10, 10, "#f0e4cc");
    rect(g, 418 + i * 13, 120, 4, 2, "#fffaf0");
  }
  rect(g, 414, 128, 56, 2, "#a8a090");
  // 메모
  rect(g, 412, 150, 50, 36, "#fff6a0");
  rect(g, 412, 150, 50, 2, "#f0e070");
  rect(g, 434, 147, 6, 5, "#e84a4a");
  smallText(g, "샘 밥", 437, 162, "#2a2a2a");
  smallText(g, "잊지마!", 437, 176, "#2a2a2a");
  return pixelize(c, c.width / BG_SCALE, c.height / BG_SCALE, { opaque: true });
}

// ── 골목 ────────────────────────────────────────────────
export const ALLEY = { width: 600, lamp: 330, dumpster: 150, cat: 420 };

export function buildAlley(): HTMLCanvasElement {
  const c = makeDense(ALLEY.width, H, BG_SCALE);
  const g = c.getContext("2d")!;
  const r = rng(4242);
  bricks(g, 0, 0, ALLEY.width, 168, "#3a3434", "#262222", ["#423c3a", "#322c2c", "#2e2a2a"], r);
  for (let i = 0; i < 70; i++) rect(g, Math.floor(r() * ALLEY.width), Math.floor(r() * 160), 2, 2, r() < 0.5 ? "#3a5a2a" : "#4a6a30");
  rect(g, 0, 168, ALLEY.width, 46, "#1e1c22");
  for (let fx = 0; fx < ALLEY.width; fx += 4) rect(g, fx, 170, 1, 44, "#16141a");
  for (let fy = 172; fy < 214; fy += 4) rect(g, 0, fy, ALLEY.width, 1, "#16141a");
  rect(g, 0, 214, ALLEY.width, H - 214, "#121116");
  for (let i = 0; i < 8; i++) {
    g.fillStyle = "#1c1e2a";
    g.beginPath();
    g.ellipse(r() * ALLEY.width, 230 + r() * 30, 14 + r() * 14, 2 + r() * 2, 0, 0, Math.PI * 2);
    g.fill();
  }
  // 벽등
  rect(g, ALLEY.lamp - 1, 40, 2, 128, "#16141a");
  rect(g, ALLEY.lamp - 5, 34, 10, 14, "#16141a");
  rect(g, ALLEY.lamp - 3, 36, 6, 10, "#fff2b8");
  // 대형 쓰레기통
  const dx = ALLEY.dumpster - 22;
  rect(g, dx, 186, 46, 28, "#1e3426");
  rect(g, dx - 2, 183, 50, 4, "#16281c");
  rect(g, dx + 4, 210, 4, 4, "#0a0a0a");
  rect(g, dx + 38, 210, 4, 4, "#0a0a0a");
  // 박스, 쓰레기
  rect(g, 230, 196, 22, 18, "#5a4630");
  rect(g, 240, 186, 18, 12, "#4a3a28");
  rect(g, 500, 204, 12, 10, "#1e1e24");
  return pixelize(c, c.width / BG_SCALE, c.height / BG_SCALE, { opaque: true });
}

// ── 제2장: 지하철역 (개구리 굴) ───────────────────────────
export const SUBWAY = {
  width: 1840,
  lights: [140, 330, 520, 710, 900, 1090, 1280, 1470, 1660],
  pillars: [250, 440, 630, 820, 1240, 1430],
  tv: 520,
  ad: 360,
  train: [900, 1160] as [number, number],
  den: 1500,
  treats: 1556,
  turnstile: 1700,
  exit: 1800,
};

export function buildSubway(): HTMLCanvasElement {
  const Wd = SUBWAY.width;
  const c = makeDense(Wd, H, BG_SCALE);
  const g = c.getContext("2d")!;
  const r = rng(2077);
  // 천장
  rect(g, 0, 0, Wd, 30, "#16161a");
  for (let x = 0; x < Wd; x += 24) rect(g, x, 22, 20, 8, "#1e1e24");
  rect(g, 0, 29, Wd, 1, "#0a0a0c");
  // 하얀 타일 벽 (때 묻음)
  for (let ty = 30; ty < 184; ty += 4) {
    for (let tx = (ty / 4) % 2 ? 4 : 0; tx < Wd; tx += 8) {
      const grime = ty > 150 ? 0.25 : r() < 0.15 ? 0.15 : 0.05;
      const col = mix("#d8d4c4", -grime - r() * 0.05);
      rect(g, tx, ty, 7.5, 3.5, col);
      rect(g, tx, ty, 7.5, 0.5, mix(col, 0.2));
      rect(g, tx + 7, ty, 0.5, 3.5, mix(col, -0.1));
    }
    rect(g, 0, ty + 3.5, Wd, 0.5, "#7a766a");
  }
  // 물 얼룩 줄
  for (let i = 0; i < Wd / 40; i++) {
    const sx = Math.floor(r() * Wd);
    const len = 20 + Math.floor(r() * 60);
    rect(g, sx, 30, 2, len, "rgba(90,80,50,0.35)");
  }
  // 모자이크 역명 띠
  rect(g, 0, 70, Wd, 14, "#2a5a4a");
  rect(g, 0, 70, Wd, 1, "#c8a85a");
  rect(g, 0, 83, Wd, 1, "#c8a85a");
  for (let x = 6; x < Wd; x += 12) rect(g, x, 76, 4, 2, "#c8a85a");
  for (let x = 60; x < Wd; x += 300) {
    rect(g, x, 66, 120, 22, "#f0e8d0");
    rect(g, x + 2, 68, 116, 18, "#2a5a4a");
    smallText(g, "HOLLOW ST", x + 60, 77, "#f0e8d0", 11);
  }
  // 승강장 바닥 + 노란 안전선
  rect(g, 0, 184, Wd, 38, "#6a6660");
  for (let x = 0; x < Wd; x += 16) rect(g, x, 184, 1, 38, "#5a5650");
  rect(g, 0, 184, Wd, 2, "#3a3834");
  for (let i = 0; i < Wd / 30; i++) {
    g.fillStyle = "rgba(30,40,50,0.45)";
    g.beginPath();
    g.ellipse(r() * Wd, 200 + r() * 18, 10 + r() * 16, 2 + r() * 2, 0, 0, Math.PI * 2);
    g.fill();
  }
  rect(g, 0, 216, Wd, 6, "#d8b82a");
  for (let x = 0; x < Wd; x += 3) rect(g, x, 217, 1, 4, "#a88a1a");
  rect(g, 0, 222, Wd, 3, "#3a3834");
  // 선로 (물에 잠김)
  rect(g, 0, 225, Wd, H - 225, "#121216");
  vgrad(g, 0, 238, Wd, H, [[0, "#1a2630"], [1, "#0a1016"]]);
  for (let x = 0; x < Wd; x += 10) rect(g, x, 232, 6, 3, "#2a2420");
  rect(g, 0, 230, Wd, 2, "#6a6a72");
  rect(g, 0, 248, Wd, 2, "#6a6a72");
  for (let i = 0; i < Wd / 20; i++) rect(g, Math.floor(r() * Wd), 242 + Math.floor(r() * 26), 6 + Math.floor(r() * 10), 1, "#3a5a6a");

  // 광고판 (풍자)
  const ad = (x: number, lines: string[], bg: string, ink: string) => {
    box(g, x - 3, 96, 86, 54, "#2a2a30");
    rect(g, x, 99, 80, 48, bg);
    lines.forEach((l, i) => smallText(g, l, x + 40, 109 + i * 12, ink));
    rect(g, x + 50, 120, 20, 22, "rgba(0,0,0,0.12)");
  };
  ad(SUBWAY.ad - 40, ["야근은 열정이다!", "블랙컴퍼니(주)", "인재 상시 채용"], "#e8e0c8", "#1a1a1a");
  ad(760, ["운석 기념", "한정판 굿즈", "SALE"], "#c83a2a", "#fff0c8");
  ad(1340, ["실종 고양이를", "찾습니다", "☎ ???"], "#f4f4ec", "#2a2a2a");
  // 기둥 (초록 철골 + 리벳)
  for (const px of SUBWAY.pillars) {
    rect(g, px - 7, 30, 14, 186, "#2e4a3a");
    rect(g, px - 7, 30, 3, 186, "#3e5e4a");
    rect(g, px + 4, 30, 3, 186, "#1e3428");
    for (let y = 40; y < 210; y += 12) {
      rect(g, px - 5, y, 2, 2, "#5a7a64");
      rect(g, px + 3, y, 2, 2, "#5a7a64");
    }
    rect(g, px - 9, 206, 18, 10, "#26402e");
  }
  // TV (뉴스)
  box(g, SUBWAY.tv - 18, 92, 36, 26, "#1a1a1e");
  rect(g, SUBWAY.tv - 15, 95, 30, 20, "#3a5a6a");
  rect(g, SUBWAY.tv - 13, 97, 12, 8, "#c8c8c8");
  rect(g, SUBWAY.tv - 15, 110, 30, 5, "#c82a2a");
  rect(g, SUBWAY.tv - 1, 86, 2, 6, "#1a1a1e");
  // 벤치
  for (const bx of [180, 600, 1060]) {
    box(g, bx, 196, 40, 4, "#7a5430");
    box(g, bx, 186, 40, 4, "#7a5430");
    rect(g, bx + 3, 200, 3, 14, "#2a2a2e");
    rect(g, bx + 34, 200, 3, 14, "#2a2a2e");
  }
  // 버려진 열차 (승강장 뒤편)
  const [t0, t1] = SUBWAY.train;
  rect(g, t0, 92, t1 - t0, 92, "#9aa0a8");
  rect(g, t0, 92, t1 - t0, 3, "#c8ccd2");
  rect(g, t0, 150, t1 - t0, 4, "#6a3a8a");
  for (let wx = t0 + 10; wx < t1 - 30; wx += 36) {
    rect(g, wx, 104, 26, 26, "#14161c");
    rect(g, wx, 104, 26, 1, "#6a6e76");
    rect(g, wx + 2, 106, 4, 8, "rgba(160,190,220,0.3)");
  }
  rect(g, t0 + 120, 104, 22, 80, "#0c0c10");
  rect(g, t0 + 120, 104, 1, 80, "#6a6e76");
  for (let i = 0; i < 4; i++) graffiti(g, t0 + 20 + i * 60, 136, 50, r);
  // 개구리 굴: 훔친 물건 더미
  const dx = SUBWAY.den;
  for (let i = 0; i < 70; i++) {
    const ix = dx - 30 + Math.floor(r() * 120);
    const iy = 196 + Math.floor(r() * 18);
    const kind = Math.floor(r() * 5);
    const col = ["#3a2a1a", "#1a1a20", "#c83a2a", "#4a6a9a", "#d8c8a8"][kind];
    rect(g, ix, iy, 5 + Math.floor(r() * 6), 3 + Math.floor(r() * 3), col);
    if (kind === 1) rect(g, ix + 1, iy + 1, 3, 2, "#3a6a8a");
  }
  for (let i = 0; i < 4; i++) graffiti(g, dx - 40 + i * 40, 120, 40, r);
  smallText(g, "개굴 왕국", dx + 30, 160, "#4ab84a", 11);
  // 개찰구 + 출구 계단
  const tx = SUBWAY.turnstile;
  rect(g, tx - 4, 180, 8, 34, "#6a6a72");
  rect(g, tx - 4, 180, 8, 2, "#a8a8b0");
  rect(g, tx + 4, 192, 14, 2, "#c8c8d0");
  rect(g, tx + 4, 198, 12, 2, "#c8c8d0");
  // 위로 올라가는 계단 (옆에서 본 모습)
  const sx0 = SUBWAY.exit - 36;
  for (let st = 0; st < 9; st++) {
    const y = 214 - (st + 1) * 10;
    rect(g, sx0 + st * 9, y, 80 - st * 9, 10, st % 2 ? "#7a766e" : "#86827a");
    rect(g, sx0 + st * 9, y, 80 - st * 9, 1, "#b8b4ac");
    rect(g, sx0 + st * 9, y + 1, 1, 9, "#5a5650");
  }
  g.strokeStyle = "#9a9aa2";
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(sx0 - 2, 196);
  g.lineTo(sx0 + 78, 110);
  g.stroke();
  box(g, SUBWAY.exit - 40, 40, 44, 14, "#1a3a1a");
  smallText(g, "EXIT", SUBWAY.exit - 18, 47, "#6aff6a", 11);
  return pixelize(c, c.width / BG_SCALE, c.height / BG_SCALE, { opaque: true });
}

// ── 제3장: 지붕 위 ─────────────────────────────────────────
export const ROOFS = {
  width: 2000,
  /** 건물 사이 틈 [시작, 끝] */
  gaps: [
    [420, 470],
    [900, 958],
    [1380, 1436],
    [1760, 1818],
  ] as Array<[number, number]>,
  /** 숨을 수 있는 엄폐물 (물탱크 · 굴뚝 · 계단실) */
  cover: [
    { x: 250, kind: "tank" },
    { x: 640, kind: "chimney" },
    { x: 830, kind: "stair" },
    { x: 1110, kind: "tank" },
    { x: 1300, kind: "chimney" },
    { x: 1560, kind: "stair" },
    { x: 1700, kind: "chimney" },
  ] as Array<{ x: number; kind: "tank" | "chimney" | "stair" }>,
  skylight: 1920,
};

export function buildRoofs(): HTMLCanvasElement {
  const Wd = ROOFS.width;
  const c = makeDense(Wd, H, BG_SCALE);
  const g = c.getContext("2d")!;
  const r = rng(3131);
  // 불타는 도시의 밤하늘
  vgrad(g, 0, 0, Wd, 214, [[0, "#0c0612"], [0.45, "#2a0e1a"], [0.8, "#6a2214"], [1, "#b8461a"]]);
  for (let i = 0; i < Wd / 8; i++) rect(g, Math.floor(r() * Wd), Math.floor(r() * 70), 0.5, 0.5, r() < 0.3 ? "#fff0c8" : "#a8a0c8");
  // 달 (구름에 반쯤 가림)
  const mx = 300;
  g.fillStyle = "rgba(255,240,200,0.12)";
  g.beginPath();
  g.arc(mx, 40, 26, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#f4e8c8";
  g.beginPath();
  g.arc(mx, 40, 14, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#d8c8a0";
  for (const [dx, dy, rr] of [[-4, -3, 3], [5, 4, 2], [2, -6, 1.5]]) {
    g.beginPath();
    g.arc(mx + dx, 40 + dy, rr, 0, Math.PI * 2);
    g.fill();
  }
  // 멀리 보이는 스카이라인 (두 겹)
  for (const [layer, col, lit, base] of [[0, "#1e0c14", 0.05, 190], [1, "#140810", 0.1, 200]] as Array<[number, string, number, number]>) {
    for (let x = -10; x < Wd; ) {
      const w = 18 + Math.floor(r() * (layer ? 40 : 30));
      const h = (layer ? 50 : 90) + Math.floor(r() * (layer ? 60 : 80));
      rect(g, x, base - h, w, h + 20, col);
      if (r() < 0.12) {
        // 첨탑 빌딩
        rect(g, x + w / 2 - 4, base - h - 18, 8, 18, col);
        rect(g, x + w / 2 - 1, base - h - 34, 2, 16, col);
        rect(g, x + w / 2 - 0.25, base - h - 34, 0.5, 1, "#ff3a2a");
      }
      for (let wy = base - h + 5; wy < base; wy += 6) for (let wx = x + 2; wx < x + w - 2; wx += 4) if (r() < lit) rect(g, wx, wy, 1.5, 2, r() < 0.5 ? "#ff9a3a" : "#ffd27a");
      x += w + Math.floor(r() * 3);
    }
  }
  // 연기 기둥
  for (let i = 0; i < Wd / 160; i++) {
    const sx = r() * Wd;
    for (let k = 0; k < 9; k++) {
      g.fillStyle = `rgba(30,14,18,${0.35 - k * 0.03})`;
      g.beginPath();
      g.ellipse(sx + k * 10 + Math.sin(k) * 6, 170 - k * 18, 14 + k * 4, 9 + k * 2, 0, 0, Math.PI * 2);
      g.fill();
    }
  }
  // 지붕들
  const roofs: Array<[number, number]> = [];
  let x0 = 0;
  for (const [a, b] of ROOFS.gaps) {
    roofs.push([x0, a]);
    x0 = b;
  }
  roofs.push([x0, Wd]);
  roofs.forEach(([a, b], i) => {
    const col = ["#4a2e2a", "#3a3240", "#4a3a2e", "#3a2c34", "#423630"][i % 5];
    // 건물 벽 (지붕 아래로)
    bricks(g, a, 222, b - a, H - 222, mix(col, -0.1), mix(col, -0.4), [mix(col, -0.2), mix(col, 0.05)], r);
    for (let wx = a + 14; wx < b - 24; wx += 34) windowAt(g, wx, 238, 14, 22, r() < 0.15 ? "fire" : r() < 0.3 ? "broken" : "dark", r, "#8a7a6a");
    // 지붕 바닥 (타르)
    rect(g, a, 214, b - a, 8, "#2a2628");
    rect(g, a, 214, b - a, 1, "#5a5250");
    for (let k = 0; k < (b - a) / 6; k++) rect(g, a + r() * (b - a - 4), 216 + r() * 5, 2 + r() * 4, 0.5, "#1e1a1c");
    // 난간 (코니스)
    rect(g, a, 221, b - a, 3, "#8a7e72");
    rect(g, a, 221, b - a, 0.5, "#b8ab9a");
    rect(g, a, 223.5, b - a, 0.5, "#4a423a");
    // 모서리 기둥
    for (const ex of [a, b - 3]) {
      if (ex <= 0 || ex >= Wd - 3) continue;
      rect(g, ex, 206, 3, 16, "#8a7e72");
      rect(g, ex, 206, 3, 1, "#b8ab9a");
    }
    // 안테나 · 빨랫줄
    if (b - a > 200) {
      const ax = a + 40 + r() * 60;
      rect(g, ax, 160, 1, 54, "#2a2a30");
      for (let k = 0; k < 4; k++) rect(g, ax - 6 + k, 166 + k * 6, 12 - k * 2, 0.5, "#2a2a30");
      const lx = a + (b - a) * 0.55;
      rect(g, lx, 186, 1, 28, "#3a3238");
      rect(g, lx + 60, 186, 1, 28, "#3a3238");
      g.strokeStyle = "#5a5058";
      g.lineWidth = 0.4;
      g.beginPath();
      g.moveTo(lx, 187);
      g.quadraticCurveTo(lx + 30, 193, lx + 60, 187);
      g.stroke();
      for (let k = 0; k < 4; k++) {
        const cx = lx + 8 + k * 13;
        const cy = 189 + Math.sin((k + 1) / 5 * Math.PI) * 3;
        rect(g, cx, cy, 7, 9, ["#8a3a3a", "#d8d0c0", "#3a5a8a", "#c8a83a"][k]);
        rect(g, cx, cy, 7, 0.5, "rgba(255,255,255,0.3)");
      }
    }
  });
  // 틈: 아래로 깊은 어둠
  for (const [a, b] of ROOFS.gaps) {
    vgrad(g, a, 150, b - a, H, [[0, "rgba(0,0,0,0)"], [0.5, "#0a0608"], [1, "#000"]]);
    rect(g, a, 214, b - a, H - 214, "#060406");
    for (let k = 0; k < 4; k++) rect(g, a + 4 + r() * (b - a - 8), 236 + k * 8, 3, 1, "rgba(255,140,60,0.25)");
  }
  // 엄폐물
  for (const cv of ROOFS.cover) {
    const x = cv.x;
    if (cv.kind === "tank") {
      // 나무 물탱크
      for (const lx of [-16, -6, 6, 16]) rect(g, x + lx, 186, 2, 28, "#2a2224");
      rect(g, x - 18, 190, 36, 1, "#2a2224");
      rect(g, x - 18, 186, 36, 2, "#3a3034");
      for (let k = 0; k < 9; k++) {
        const c2 = k % 2 ? "#6a4630" : "#7a5236";
        rect(g, x - 18 + k * 4, 146, 4, 40, c2);
        rect(g, x - 18 + k * 4, 146, 0.5, 40, mix(c2, 0.15));
      }
      for (const by of [152, 166, 180]) rect(g, x - 19, by, 38, 1.5, "#2a2224");
      g.fillStyle = "#4a3428";
      g.beginPath();
      g.moveTo(x - 20, 146);
      g.lineTo(x, 132);
      g.lineTo(x + 20, 146);
      g.fill();
      rect(g, x - 20, 145, 40, 1.5, "#2a1e18");
      rect(g, x + 10, 160, 8, 26, "rgba(0,0,0,0.25)");
    } else if (cv.kind === "chimney") {
      bricks(g, x - 12, 164, 24, 50, "#7a3a2a", "#3a2018", ["#8a4430", "#6a3022"], r);
      rect(g, x - 14, 160, 28, 5, "#5a5048");
      rect(g, x - 14, 160, 28, 1, "#8a7e72");
      rect(g, x - 8, 154, 6, 6, "#3a3034");
      rect(g, x + 2, 156, 5, 4, "#3a3034");
      rect(g, x + 4, 166, 8, 48, "rgba(0,0,0,0.22)");
    } else {
      // 옥상 계단실
      rect(g, x - 24, 156, 48, 58, "#5a5048");
      rect(g, x - 24, 156, 48, 1, "#8a7e72");
      rect(g, x - 26, 152, 52, 5, "#3a3236");
      rect(g, x - 8, 176, 16, 38, "#3a2a24");
      rect(g, x - 7, 177, 14, 36, "#4a3a30");
      rect(g, x + 4, 194, 2, 2, "#c8a83a");
      rect(g, x + 12, 160, 12, 54, "rgba(0,0,0,0.2)");
      for (let k = 0; k < 6; k++) rect(g, x - 22 + r() * 40, 160 + r() * 50, 3, 0.5, "#4a423c");
    }
  }
  // 마지막 건물: 깨진 채광창 (교회 지붕)
  const sx = ROOFS.skylight;
  g.fillStyle = "#2a2a34";
  g.beginPath();
  g.moveTo(sx - 26, 214);
  g.lineTo(sx - 18, 196);
  g.lineTo(sx + 18, 196);
  g.lineTo(sx + 26, 214);
  g.fill();
  for (let k = 0; k < 4; k++) {
    const px = sx - 16 + k * 9;
    rect(g, px, 198, 7, 14, k === 1 ? "#060608" : "#3a5a7a");
    if (k !== 1) rect(g, px + 1, 199, 1, 6, "rgba(200,230,255,0.4)");
  }
  rect(g, sx - 6, 199, 1, 3, "#9aaaba");
  rect(g, sx - 3, 199, 1, 5, "#9aaaba");
  // 십자가 (교회 지붕 끝)
  rect(g, 1975, 150, 4, 64, "#5a5048");
  rect(g, 1967, 164, 20, 4, "#5a5048");
  return pixelize(c, c.width / BG_SCALE, c.height / BG_SCALE, { opaque: true });
}

// ── 제3장: 생존자들의 교회 ──────────────────────────────────
export const CHURCH = {
  width: 960,
  door: 70,
  confessional: 230,
  pews: [340, 450, 560],
  tomas: 600,
  ruth: 690,
  radio: 750,
  lily: 820,
  altar: 880,
  hole: 860,
  windows: [130, 300, 470, 640, 810],
};

export function buildChurch(): HTMLCanvasElement {
  const Wd = CHURCH.width;
  const c = makeDense(Wd, H, BG_SCALE);
  const g = c.getContext("2d")!;
  const r = rng(777);
  // 돌벽
  rect(g, 0, 0, Wd, 214, "#2e2a30");
  for (let by = 0; by < 214; by += 8) {
    const off = (by / 8) % 2 ? 10 : 0;
    for (let bx = -off; bx < Wd; bx += 20) {
      const col = mix("#3a3640", (r() - 0.5) * 0.12);
      rect(g, bx + 0.5, by + 0.5, 19, 7, col);
      rect(g, bx + 0.5, by + 0.5, 19, 0.5, mix(col, 0.12));
      rect(g, bx + 0.5, by + 7, 19, 0.5, mix(col, -0.2));
    }
  }
  // 기둥과 아치
  for (let x = 40; x < Wd; x += 170) {
    rect(g, x, 30, 14, 184, "#4a4450");
    rect(g, x, 30, 2, 184, "#5e5864");
    rect(g, x + 12, 30, 2, 184, "#2a262e");
    rect(g, x - 3, 30, 20, 5, "#5e5864");
    rect(g, x - 3, 206, 20, 8, "#5e5864");
  }
  rect(g, 0, 0, Wd, 26, "#1e1a22");
  for (let x = 0; x < Wd; x += 30) rect(g, x, 18, 3, 8, "#2a2630");
  // 스테인드글라스
  CHURCH.windows.forEach((wx, i) => {
    const x = wx - 22;
    const y = 50;
    const w = 44;
    const h = 90;
    g.fillStyle = "#14121a";
    g.beginPath();
    g.moveTo(x - 3, y + h + 3);
    g.lineTo(x - 3, y + 20);
    g.quadraticCurveTo(x + w / 2, y - 22, x + w + 3, y + 20);
    g.lineTo(x + w + 3, y + h + 3);
    g.fill();
    g.save();
    g.beginPath();
    g.moveTo(x, y + h);
    g.lineTo(x, y + 20);
    g.quadraticCurveTo(x + w / 2, y - 16, x + w, y + 20);
    g.lineTo(x + w, y + h);
    g.clip();
    const pal = ["#2a4a9a", "#9a2a3a", "#c8a03a", "#2a7a5a", "#6a3a8a"];
    for (let py = y - 20; py < y + h; py += 6) {
      for (let px = x; px < x + w; px += 6) {
        const broken = i === 1 && py > y + 40 && px > x + 14;
        const col = broken ? "#0a0a10" : pal[Math.floor(r() * pal.length)];
        rect(g, px, py, 6, 6, col);
        if (!broken) rect(g, px + 1, py + 1, 2, 1, mix(col, 0.35));
      }
    }
    // 납 선
    for (let py = y - 20; py < y + h; py += 6) rect(g, x, py, w, 0.5, "#14121a");
    for (let px = x; px < x + w; px += 6) rect(g, px, y - 20, 0.5, h + 20, "#14121a");
    // 가운데 고양이 무늬 (원형 장식)
    g.fillStyle = "#e8d8a0";
    g.beginPath();
    g.arc(x + w / 2, y + 22, 9, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#14121a";
    g.beginPath();
    g.arc(x + w / 2, y + 22, 9, 0, Math.PI * 2);
    g.lineWidth = 1;
    g.strokeStyle = "#14121a";
    g.stroke();
    g.restore();
    rect(g, x - 4, y + h + 2, w + 8, 3, "#5e5864");
  });
  // 천장 구멍 (찰리가 떨어지는 곳) + 달빛
  const hx = CHURCH.hole;
  rect(g, hx - 18, 0, 36, 26, "#0a0a14");
  for (let k = 0; k < 6; k++) rect(g, hx - 18 + k * 6, 24 + (k % 2) * 3, 4, 3, "#1e1a22");
  g.fillStyle = "rgba(180,200,255,0.08)";
  g.beginPath();
  g.moveTo(hx - 18, 26);
  g.lineTo(hx + 18, 26);
  g.lineTo(hx + 40, 214);
  g.lineTo(hx - 30, 214);
  g.fill();
  // 바닥
  rect(g, 0, 214, Wd, H - 214, "#3a3034");
  for (let x = 0; x < Wd; x += 12) {
    rect(g, x, 214, 11.5, H - 214, (x / 12) % 2 ? "#3e3438" : "#362e32");
    rect(g, x, 214, 11.5, 0.5, "#4e4448");
  }
  // 붉은 융단
  rect(g, 0, 224, Wd, 10, "#6a1e22");
  rect(g, 0, 224, Wd, 1, "#c8a03a");
  rect(g, 0, 233, Wd, 1, "#c8a03a");
  // 문 (왼쪽)
  const dx = CHURCH.door;
  g.fillStyle = "#1e1418";
  g.beginPath();
  g.moveTo(dx - 26, 214);
  g.lineTo(dx - 26, 140);
  g.quadraticCurveTo(dx, 110, dx + 26, 140);
  g.lineTo(dx + 26, 214);
  g.fill();
  for (let k = 0; k < 2; k++) {
    const x = dx - 23 + k * 24;
    rect(g, x, 142, 22, 72, "#5a3424");
    for (let p = 0; p < 5; p++) rect(g, x + p * 4.5, 142, 0.5, 72, "#3a2018");
    for (const by of [156, 196]) rect(g, x, by, 22, 2, "#2a2a30");
  }
  rect(g, dx - 2, 176, 1.5, 8, "#c8a03a");
  rect(g, dx + 1, 176, 1.5, 8, "#c8a03a");
  // 바리케이드 (문 앞 의자 더미)
  rect(g, dx + 30, 200, 26, 14, "#4a2e22");
  rect(g, dx + 32, 192, 20, 8, "#5a3a2a");
  // 고해실
  const cx = CHURCH.confessional;
  rect(g, cx - 30, 120, 60, 94, "#3a2218");
  rect(g, cx - 30, 120, 60, 2, "#6a4a32");
  g.fillStyle = "#4a2c1e";
  g.beginPath();
  g.moveTo(cx - 34, 122);
  g.lineTo(cx, 104);
  g.lineTo(cx + 34, 122);
  g.fill();
  for (const ox of [-26, 4]) {
    rect(g, cx + ox, 130, 22, 84, "#5a3828");
    rect(g, cx + ox + 2, 134, 18, 30, "#2a1810");
    for (let k = 0; k < 6; k++) rect(g, cx + ox + 3 + k * 3, 134, 1, 30, "#6a4432");
    rect(g, cx + ox + 2, 170, 18, 40, "#4a2e20");
  }
  rect(g, cx - 2, 120, 4, 94, "#2a1810");
  // 신도석 (장의자)
  for (let x = 300; x < 640; x += 55) {
    rect(g, x, 186, 40, 4, "#5a3828");
    rect(g, x, 186, 40, 1, "#7a5038");
    rect(g, x, 172, 4, 42, "#4a2e20");
    rect(g, x + 36, 190, 4, 24, "#3a2218");
    rect(g, x, 172, 40, 3, "#5a3828");
    rect(g, x + 2, 175, 2, 11, "#3a2218");
  }
  // 생존자 캠프: 간이침대 · 물자 · 촛불 테이블
  for (const bx of [650, 720]) {
    rect(g, bx, 200, 46, 6, "#4a5a3a");
    rect(g, bx, 200, 46, 1, "#6a7a5a");
    rect(g, bx + 2, 206, 2, 8, "#2a2a2a");
    rect(g, bx + 42, 206, 2, 8, "#2a2a2a");
    rect(g, bx + 2, 196, 12, 5, "#d8d0c0");
  }
  for (let k = 0; k < 6; k++) {
    const bx = 590 + k * 9;
    const bh = 8 + (k % 3) * 4;
    rect(g, bx, 214 - bh, 8, bh, k % 2 ? "#8a6a3a" : "#a07a42");
    rect(g, bx, 214 - bh, 8, 1, "#c8a060");
  }
  smallText(g, "물", 594, 205, "#2a1e10", 7);
  // 라디오 테이블
  const rx = CHURCH.radio;
  rect(g, rx - 14, 196, 28, 3, "#5a3828");
  rect(g, rx - 12, 199, 2, 15, "#3a2218");
  rect(g, rx + 10, 199, 2, 15, "#3a2218");
  rect(g, rx - 9, 186, 18, 10, "#3a3a40");
  rect(g, rx - 9, 186, 18, 1, "#6a6a72");
  rect(g, rx - 7, 188, 6, 6, "#1a1a1e");
  for (let k = 0; k < 3; k++) rect(g, rx - 6, 189 + k * 2, 4, 0.5, "#5a5a62");
  rect(g, rx + 2, 189, 5, 2, "#c8a03a");
  rect(g, rx + 6, 176, 0.5, 10, "#8a8a92");
  // 제단 + 촛대
  const ax = CHURCH.altar;
  rect(g, ax - 34, 182, 68, 32, "#d8d0c0");
  rect(g, ax - 34, 182, 68, 2, "#f0e8d8");
  rect(g, ax - 30, 188, 60, 22, "#c8b8a0");
  rect(g, ax - 6, 188, 12, 22, "#8a2a2a");
  rect(g, ax - 1, 190, 2, 16, "#c8a03a");
  rect(g, ax - 5, 195, 10, 2, "#c8a03a");
  for (const cx2 of [ax - 26, ax + 22]) {
    rect(g, cx2, 168, 4, 14, "#c8a03a");
    rect(g, cx2 - 2, 180, 8, 2, "#a8802a");
    rect(g, cx2 + 1, 162, 2, 6, "#f4ecd8");
  }
  return pixelize(c, c.width / BG_SCALE, c.height / BG_SCALE, { opaque: true });
}

// ── 제4장: 허드슨 강 부두 ────────────────────────────────────
export const PIER = {
  width: 1400,
  hide: [270, 530, 770, 1010, 1190],
  lamps: [150, 450, 700, 950, 1250],
  dock: 1350,
};

/** 화물 컨테이너 (숨을 수 있는 크기) */
function container(g: G, x: number, w: number, h: number, col: string, r: () => number): void {
  const top = 214 - h;
  rect(g, x, top, w, h, col);
  for (let k = 2; k < w - 1; k += 3) {
    rect(g, x + k, top + 2, 1, h - 4, mix(col, -0.18));
    rect(g, x + k + 1, top + 2, 0.5, h - 4, mix(col, 0.1));
  }
  rect(g, x, top, w, 2, mix(col, 0.2));
  rect(g, x, top + h - 2, w, 2, mix(col, -0.3));
  rect(g, x, top, 1.5, h, mix(col, -0.25));
  rect(g, x + w - 1.5, top, 1.5, h, mix(col, -0.25));
  for (let k = 0; k < 8; k++) rect(g, x + r() * (w - 4), top + r() * (h - 4), 2 + r() * 4, 1 + r() * 2, "rgba(120,60,30,0.35)");
  rect(g, x + w - 1, top + 2, 8, h - 2, "rgba(0,0,0,0.25)");
}

export function buildPier(): HTMLCanvasElement {
  const Wd = PIER.width;
  const c = makeDense(Wd, H, BG_SCALE);
  const g = c.getContext("2d")!;
  const r = rng(4242);
  vgrad(g, 0, 0, Wd, 120, [[0, "#060814"], [0.7, "#141a32"], [1, "#2a2a44"]]);
  for (let i = 0; i < Wd / 7; i++) rect(g, Math.floor(r() * Wd), Math.floor(r() * 70), 0.5, 0.5, "#9aa0c8");
  for (let i = 0; i < Wd / 90; i++) {
    g.fillStyle = "rgba(40,44,70,0.6)";
    g.beginPath();
    g.ellipse(r() * Wd, 20 + r() * 50, 50 + r() * 60, 6 + r() * 6, 0, 0, Math.PI * 2);
    g.fill();
  }
  // 강 건너 뉴저지 불빛
  for (let x = 0; x < Wd; ) {
    const w = 10 + r() * 26;
    const h = 8 + r() * 26;
    rect(g, x, 120 - h, w, h, "#10132a");
    for (let wy = 120 - h + 2; wy < 119; wy += 4) for (let wx = x + 1; wx < x + w - 1; wx += 3) if (r() < 0.2) rect(g, wx, wy, 1, 1.5, "#e8c070");
    x += w + r() * 6;
  }
  // 강물 + 불빛 반사
  vgrad(g, 0, 120, Wd, 190, [[0, "#141a30"], [1, "#0a0e1a"]]);
  for (let i = 0; i < Wd / 3; i++) {
    const y = 122 + r() * 66;
    rect(g, r() * Wd, y, 2 + r() * 8, 0.5, r() < 0.3 ? "rgba(232,192,112,0.35)" : "rgba(120,140,190,0.25)");
  }
  // 철조망 울타리
  rect(g, 0, 160, Wd, 1, "#4a4a56");
  rect(g, 0, 190, Wd, 1, "#4a4a56");
  g.strokeStyle = "rgba(110,110,126,0.45)";
  g.lineWidth = 0.35;
  for (let x = -40; x < Wd; x += 4) {
    g.beginPath();
    g.moveTo(x, 160);
    g.lineTo(x + 30, 214);
    g.moveTo(x + 30, 160);
    g.lineTo(x, 214);
    g.stroke();
  }
  for (let x = 0; x < Wd; x += 40) rect(g, x, 152, 1.5, 62, "#3a3a46");
  for (let x = 0; x < Wd; x += 2) rect(g, x, 152 + (x % 4 === 0 ? 0 : 1), 1, 1, "#6a6a78");
  // 부두 바닥
  rect(g, 0, 214, Wd, H - 214, "#3a3632");
  for (let x = 0; x < Wd; x += 10) rect(g, x, 214, 0.5, H - 214, "#2a2622");
  rect(g, 0, 214, Wd, 1, "#5a5448");
  for (let x = 0; x < Wd; x += 6) rect(g, x, 236, 3, 1, "#c8a82a");
  for (let i = 0; i < Wd / 30; i++) {
    g.fillStyle = "rgba(20,24,34,0.5)";
    g.beginPath();
    g.ellipse(r() * Wd, 240 + r() * 25, 8 + r() * 14, 1.5 + r() * 2, 0, 0, Math.PI * 2);
    g.fill();
  }
  // 가로등
  for (const lx of PIER.lamps) {
    rect(g, lx, 120, 2, 94, "#26262e");
    rect(g, lx - 6, 118, 10, 3, "#26262e");
    rect(g, lx - 6, 121, 6, 2, "#fff0c0");
  }
  // 컨테이너 (숨는 곳)
  const cols = ["#8a3a2a", "#2a5a7a", "#3a6a3a", "#9a7a2a", "#6a3a5a"];
  PIER.hide.forEach((x, i) => {
    if (i % 2 === 0) {
      // 두 단으로 쌓인 컨테이너
      g.save();
      g.translate(0, -40);
      container(g, x - 24, 50, 30, cols[(i + 2) % cols.length], r);
      g.restore();
    }
    container(g, x - 30, 60, 40, cols[i % cols.length], r);
    smallText(g, ["MAERSK", "COSCO", "EVERGRN", "HAPAG", "ONE"][i], x, 214 - 20, "rgba(255,255,255,0.45)", 7);
  });
  // 컨벤션 센터 (격리 센터) 유리 건물
  const bx = 1220;
  rect(g, bx, 40, Wd - bx, 174, "#1a2232");
  for (let gy = 44; gy < 210; gy += 10) {
    for (let gx = bx + 2; gx < Wd; gx += 12) {
      const lit = r() < 0.25;
      rect(g, gx, gy, 11, 9, lit ? "#5a7a8a" : "#22303e");
      rect(g, gx, gy, 11, 0.5, "#3a4a5a");
      if (lit) rect(g, gx + 1, gy + 1, 2, 7, "rgba(255,255,255,0.15)");
    }
  }
  g.fillStyle = "#2a3244";
  g.beginPath();
  g.moveTo(bx - 10, 44);
  for (let k = 0; k <= 6; k++) g.lineTo(bx - 10 + k * 30, 40 - (k % 2) * 10);
  g.lineTo(Wd, 44);
  g.fill();
  rect(g, bx + 10, 60, 160, 22, "#e8e0c8");
  smallText(g, "특별대응단 격리 센터", bx + 90, 67, "#8a1a1a", 8);
  smallText(g, "후원: 블랙컴퍼니(주)", bx + 90, 76, "#1a1a1a", 7);
  // 하역장 셔터
  const dx = PIER.dock;
  rect(g, dx - 26, 160, 52, 54, "#4a4e56");
  for (let y = 162; y < 214; y += 3) rect(g, dx - 25, y, 50, 0.5, "#2a2e36");
  rect(g, dx - 28, 156, 56, 4, "#c8a82a");
  for (let x = dx - 28; x < dx + 28; x += 6) rect(g, x, 156, 3, 4, "#1a1a1a");
  rect(g, dx + 14, 132, 10, 6, "#2a2e36");
  for (let k = 0; k < 4; k++) rect(g, dx + 15, 133 + k * 1.4, 8, 0.5, "#6a6e76");
  smallText(g, "환기구", dx + 19, 128, "#8a8e96", 6);
  return pixelize(c, c.width / BG_SCALE, c.height / BG_SCALE, { opaque: true });
}

// ── 제4장: 격리 센터 내부 ────────────────────────────────────
export const CENTER = {
  width: 1300,
  button: 80,
  vent: 200,
  carts: [380, 520, 860, 1010],
  desk: 660,
  labDoor: 1220,
  lights: [120, 300, 480, 660, 840, 1020, 1200],
};

export function buildCenter(): HTMLCanvasElement {
  const Wd = CENTER.width;
  const c = makeDense(Wd, H, BG_SCALE);
  const g = c.getContext("2d")!;
  const r = rng(5151);
  // 천장 + 벽
  rect(g, 0, 0, Wd, 24, "#1a1e24");
  for (const lx of CENTER.lights) {
    rect(g, lx - 20, 20, 40, 3, "#d8e8f0");
    rect(g, lx - 20, 23, 40, 0.5, "#8a9aa0");
  }
  vgrad(g, 0, 24, Wd, 214, [[0, "#c8ccd0"], [1, "#9aa0a6"]]);
  for (let y = 30; y < 214; y += 16) rect(g, 0, y, Wd, 0.5, "rgba(0,0,0,0.08)");
  for (let x = 0; x < Wd; x += 32) rect(g, x, 24, 0.5, 190, "rgba(0,0,0,0.06)");
  rect(g, 0, 150, Wd, 8, "#6a7a86");
  rect(g, 0, 150, Wd, 1, "#8a9aa6");
  // 경고 띠
  for (let x = 0; x < Wd; x += 8) {
    rect(g, x, 206, 4, 8, "#d8b82a");
    rect(g, x + 4, 206, 4, 8, "#1a1a1a");
  }
  // 하역장 셔터 (왼쪽)
  rect(g, 20, 120, 100, 94, "#5a5e66");
  for (let y = 122; y < 214; y += 3) rect(g, 21, y, 98, 0.5, "#3a3e46");
  rect(g, 16, 116, 108, 4, "#c8a82a");
  // 열림 버튼
  rect(g, CENTER.button + 44, 160, 8, 12, "#3a3e46");
  rect(g, CENTER.button + 46, 162, 4, 4, "#3ac83a");
  rect(g, CENTER.button + 46, 167, 4, 4, "#c83a3a");
  // 환기구
  rect(g, CENTER.vent - 12, 28, 24, 12, "#5a5e66");
  for (let k = 0; k < 5; k++) rect(g, CENTER.vent - 11, 30 + k * 2, 22, 0.75, "#2a2e36");
  // 격리실 (유리방 + 사람 실루엣)
  for (let x = 150; x < 1160; x += 110) {
    if (Math.abs(x - CENTER.desk) < 70) continue;
    rect(g, x, 60, 80, 90, "#2a3a44");
    rect(g, x + 2, 62, 76, 86, "#5a7a88");
    vgrad(g, x + 2, 62, 76, 148, [[0, "rgba(220,240,250,0.35)"], [1, "rgba(120,160,180,0.2)"]]);
    for (let k = 0; k < 3; k++) rect(g, x + 8 + k * 9, 66, 1, 70, "rgba(255,255,255,0.25)");
    // 앉아 있는 사람 실루엣
    const px = x + 24 + r() * 30;
    g.fillStyle = "rgba(30,40,50,0.65)";
    g.beginPath();
    g.ellipse(px, 112, 6, 6.5, 0, 0, Math.PI * 2);
    g.fill();
    rect(g, px - 8, 118, 16, 22, "rgba(30,40,50,0.65)");
    rect(g, px - 10, 136, 22, 6, "rgba(30,40,50,0.65)");
    rect(g, x + 64, 140, 12, 4, "#8a9aa6");
    rect(g, x + 2, 52, 76, 8, "#e8e4d8");
    smallText(g, `면역자 ${String(100 + Math.floor(r() * 899))}`, x + 40, 56, "#3a3a3a", 6);
  }
  // 현수막
  rect(g, 300, 30, 420, 16, "#1a1a2a");
  smallText(g, "면역은 자산이다 — 블랙컴퍼니(주) 특별대응단", 510, 38, "#e8c84a", 8);
  // 경비 책상 + 모니터
  const dx = CENTER.desk;
  rect(g, dx - 36, 180, 72, 34, "#5a5e66");
  rect(g, dx - 38, 176, 76, 5, "#7a7e86");
  rect(g, dx - 38, 176, 76, 1, "#9a9ea6");
  for (const mx of [-28, -6, 16]) {
    rect(g, mx + dx, 156, 18, 14, "#1a1e24");
    rect(g, mx + dx + 1, 157, 16, 12, "#2a4a5a");
    rect(g, mx + dx + 2, 159, 8, 1, "#6ac8e8");
    rect(g, mx + dx + 2, 162, 12, 1, "#4a8aa8");
    rect(g, mx + dx + 8, 170, 2, 6, "#2a2e36");
  }
  // 의료용 수레 (숨는 곳)
  for (const cx of CENTER.carts) {
    rect(g, cx - 16, 190, 32, 3, "#c8ccd0");
    rect(g, cx - 16, 202, 32, 2, "#9aa0a6");
    rect(g, cx - 15, 176, 2, 34, "#8a9096");
    rect(g, cx + 13, 176, 2, 34, "#8a9096");
    rect(g, cx - 16, 175, 32, 2, "#c8ccd0");
    rect(g, cx - 10, 180, 8, 10, "#e8e8f0");
    rect(g, cx + 2, 182, 6, 8, "#c84a4a");
    for (const wx of [-14, 12]) {
      g.fillStyle = "#2a2a2a";
      g.beginPath();
      g.arc(cx + wx, 212, 2, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = "rgba(240,240,248,0.7)";
    g.fillRect(cx - 16, 193, 32, 9);
    for (let k = 0; k < 4; k++) rect(g, cx - 16 + k * 8, 193, 0.5, 9, "rgba(160,160,170,0.6)");
  }
  // 실험실 문 + 카드 리더
  const lx = CENTER.labDoor;
  rect(g, lx - 26, 120, 52, 94, "#3a3e46");
  rect(g, lx - 24, 122, 23, 92, "#8a9aa6");
  rect(g, lx + 1, 122, 23, 92, "#8a9aa6");
  rect(g, lx - 20, 132, 15, 24, "#4a6a78");
  rect(g, lx + 5, 132, 15, 24, "#4a6a78");
  rect(g, lx - 28, 106, 56, 12, "#c83a3a");
  smallText(g, "실험실 · 관계자 외 출입금지", lx, 112, "#ffffff", 6);
  rect(g, lx + 32, 160, 8, 12, "#1a1e24");
  rect(g, lx + 34, 162, 4, 2, "#c83a3a");
  // 바닥
  rect(g, 0, 214, Wd, H - 214, "#7a8086");
  for (let x = 0; x < Wd; x += 16) rect(g, x, 214, 0.5, H - 214, "#6a7076");
  for (let y = 222; y < H; y += 12) rect(g, 0, y, Wd, 0.5, "#6a7076");
  rect(g, 0, 214, Wd, 1, "#9aa0a6");
  return pixelize(c, c.width / BG_SCALE, c.height / BG_SCALE, { opaque: true });
}

// ── 제4장: 실험실 ──────────────────────────────────────────
export const LAB = { width: 480, gurney: 230, door: 40, lift: 440 };

export function buildLab(): HTMLCanvasElement {
  const c = makeDense(LAB.width, H, BG_SCALE);
  const g = c.getContext("2d")!;
  const r = rng(6161);
  vgrad(g, 0, 0, LAB.width, 214, [[0, "#20282e"], [1, "#3a464e"]]);
  for (let x = 0; x < LAB.width; x += 24) rect(g, x, 0, 0.5, 214, "rgba(0,0,0,0.15)");
  // 큰 창: 밤하늘과 초록빛
  rect(g, 120, 30, 240, 90, "#0a0e18");
  vgrad(g, 122, 32, 236, 118, [[0, "#06081a"], [1, "#1a2a3a"]]);
  g.fillStyle = "rgba(140,255,170,0.25)";
  g.beginPath();
  g.ellipse(300, 50, 40, 10, 0, 0, Math.PI * 2);
  g.fill();
  for (let i = 0; i < 30; i++) rect(g, 122 + r() * 234, 34 + r() * 40, 0.5, 0.5, "#9aa0c8");
  for (let x = 120; x <= 360; x += 60) rect(g, x, 30, 2, 90, "#5a6670");
  rect(g, 118, 120, 244, 4, "#5a6670");
  // 기계 + 혈액 팩
  for (const mx of [80, 300, 360]) {
    rect(g, mx - 14, 140, 28, 74, "#5a6670");
    rect(g, mx - 12, 144, 24, 16, "#1a2a2e");
    for (let k = 0; k < 4; k++) rect(g, mx - 10 + k * 5, 148 + (k % 2) * 4, 3, 1, k % 2 ? "#3ae86a" : "#e8c83a");
    for (let k = 0; k < 5; k++) rect(g, mx - 10, 166 + k * 8, 20, 1, "#4a565e");
  }
  rect(g, 186, 120, 2, 60, "#8a9aa6");
  rect(g, 180, 120, 14, 2, "#8a9aa6");
  rect(g, 182, 124, 8, 14, "#a82a2a");
  rect(g, 183, 125, 2, 12, "#c84a4a");
  // 수술대
  const gx = LAB.gurney;
  rect(g, gx - 34, 184, 68, 5, "#c8ccd0");
  rect(g, gx - 34, 184, 68, 1, "#e8ecf0");
  rect(g, gx - 30, 189, 3, 25, "#8a9096");
  rect(g, gx + 27, 189, 3, 25, "#8a9096");
  // 문 / 옥상 엘리베이터
  rect(g, LAB.door - 20, 124, 40, 90, "#3a464e");
  rect(g, LAB.door - 18, 126, 36, 88, "#6a7a86");
  const ex = LAB.lift;
  rect(g, ex - 24, 120, 48, 94, "#5a6670");
  rect(g, ex - 22, 124, 21, 90, "#a8b0b8");
  rect(g, ex + 1, 124, 21, 90, "#a8b0b8");
  rect(g, ex - 18, 110, 36, 9, "#1a1e24");
  smallText(g, "▲ 옥상", ex, 115, "#e8c84a", 6);
  rect(g, 0, 214, LAB.width, H - 214, "#5a6268");
  for (let x = 0; x < LAB.width; x += 16) rect(g, x, 214, 0.5, H - 214, "#4a5258");
  rect(g, 0, 214, LAB.width, 1, "#7a848a");
  return pixelize(c, c.width / BG_SCALE, c.height / BG_SCALE, { opaque: true });
}

// ── 최종장: 격리 센터 옥상 헬기장 ──────────────────────────────
export const HELIPAD = { width: 960, hide: [230, 400, 570], cage: 820, door: 60 };

export function buildHelipad(): HTMLCanvasElement {
  const Wd = HELIPAD.width;
  const c = makeDense(Wd, H, BG_SCALE);
  const g = c.getContext("2d")!;
  const r = rng(7373);
  // 폭풍 하늘
  vgrad(g, 0, 0, Wd, 214, [[0, "#04060c"], [0.5, "#0e1a1e"], [1, "#1e3a32"]]);
  for (let i = 0; i < Wd / 40; i++) {
    g.fillStyle = `rgba(${20 + r() * 20},${40 + r() * 30},${40 + r() * 20},0.6)`;
    g.beginPath();
    g.ellipse(r() * Wd, 20 + r() * 80, 60 + r() * 80, 12 + r() * 14, 0, 0, Math.PI * 2);
    g.fill();
  }
  // 아래로 보이는 도시 불빛
  for (let x = 0; x < Wd; ) {
    const w = 12 + r() * 30;
    const h = 20 + r() * 60;
    rect(g, x, 200 - h, w, h + 14, "#0a1214");
    for (let wy = 200 - h + 3; wy < 210; wy += 5) for (let wx = x + 2; wx < x + w - 2; wx += 4) if (r() < 0.12) rect(g, wx, wy, 1.5, 2, r() < 0.5 ? "#ff9a3a" : "#e8c070");
    x += w + r() * 4;
  }
  // 옥상 바닥 + 난간
  rect(g, 0, 206, Wd, 8, "#4a4e52");
  rect(g, 0, 206, Wd, 1, "#7a7e82");
  for (let x = 0; x < Wd; x += 12) rect(g, x, 190, 1.5, 16, "#6a6e72");
  rect(g, 0, 190, Wd, 1.5, "#8a8e92");
  rect(g, 0, 214, Wd, H - 214, "#3a3e42");
  for (let x = 0; x < Wd; x += 20) rect(g, x, 214, 0.5, H - 214, "#2e3236");
  rect(g, 0, 214, Wd, 1, "#5a5e62");
  // 헬기장 H
  g.fillStyle = "rgba(232,200,74,0.6)";
  g.beginPath();
  g.ellipse(HELIPAD.cage - 40, 238, 110, 14, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#3a3e42";
  g.beginPath();
  g.ellipse(HELIPAD.cage - 40, 238, 104, 12, 0, 0, Math.PI * 2);
  g.fill();
  smallText(g, "H", HELIPAD.cage - 40, 238, "rgba(232,200,74,0.8)", 11);
  // 옥상 출입문
  const dx = HELIPAD.door;
  rect(g, dx - 26, 150, 52, 64, "#5a5e62");
  rect(g, dx - 28, 146, 56, 5, "#3a3e42");
  rect(g, dx - 9, 172, 18, 42, "#3a2e28");
  rect(g, dx + 4, 192, 2, 2, "#c8a83a");
  // 냉각탑 / 환풍기 (숨는 곳)
  HELIPAD.hide.forEach((x, i) => {
    if (i === 1) {
      rect(g, x - 20, 164, 40, 50, "#6a6e72");
      rect(g, x - 20, 164, 40, 1, "#9a9ea2");
      for (let k = 0; k < 8; k++) rect(g, x - 18, 168 + k * 5, 36, 2, "#4a4e52");
      rect(g, x - 22, 160, 44, 5, "#5a5e62");
    } else {
      rect(g, x - 18, 176, 36, 38, "#7a7e82");
      rect(g, x - 18, 176, 36, 1, "#aaaeb2");
      g.fillStyle = "#3a3e42";
      g.beginPath();
      g.arc(x, 194, 12, 0, Math.PI * 2);
      g.fill();
      for (let k = 0; k < 4; k++) {
        g.strokeStyle = "#6a6e72";
        g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(x, 194);
        g.lineTo(x + Math.cos(k * 1.57 + 0.4) * 11, 194 + Math.sin(k * 1.57 + 0.4) * 11);
        g.stroke();
      }
    }
    rect(g, x + 14, 168, 10, 46, "rgba(0,0,0,0.2)");
  });
  // 안테나 탑
  rect(g, 680, 60, 3, 146, "#2a2e32");
  for (let k = 0; k < 10; k++) {
    g.strokeStyle = "#2a2e32";
    g.lineWidth = 0.6;
    g.beginPath();
    g.moveTo(676, 70 + k * 14);
    g.lineTo(687, 84 + k * 14);
    g.stroke();
  }
  rect(g, 680, 56, 3, 3, "#ff3a2a");
  return pixelize(c, c.width / BG_SCALE, c.height / BG_SCALE, { opaque: true });
}

// ── 실내 미로 공용 배경 ──────────────────────────────────────
export type Theme = "hall" | "flat" | "lobby" | "tunnel" | "pump" | "staff" | "crypt" | "vault" | "security" | "archive" | "cells" | "museum" | "egypt" | "planet" | "gem";
export interface DoorDef {
  x: number;
  kind: "door" | "stairs" | "elevator" | "grate" | "arch" | "window" | "steel";
  label?: string;
}

function woodDoor(g: G, x: number, label: string | undefined, col = "#5a3828"): void {
  rect(g, x - 15, 146, 30, 68, mix(col, -0.4));
  rect(g, x - 13, 148, 26, 66, col);
  for (const [py, ph] of [[152, 24], [182, 28]]) {
    rect(g, x - 10, py, 9, ph, mix(col, -0.12));
    rect(g, x + 1, py, 9, ph, mix(col, -0.12));
    rect(g, x - 10, py, 9, 0.5, mix(col, 0.15));
    rect(g, x + 1, py, 9, 0.5, mix(col, 0.15));
  }
  rect(g, x + 8, 182, 2, 3, "#d8b84a");
  if (label) {
    rect(g, x - 6, 138, 12, 6, "#c8b070");
    smallText(g, label, x, 141, "#2a1a10", 6);
  }
}

export type PropKind =
  | "reception" | "gate" | "plant" | "board" | "alarm" | "cage" | "sink" | "fridge" | "frame" | "toolbox" | "bed" | "fusebox"
  | "debris" | "shelf" | "safe" | "whiteboard" | "lostbox" | "prints" | "locker" | "desk" | "radio" | "bag" | "sign" | "lectern"
  | "books" | "medbox" | "glass" | "monitors" | "logbook" | "filecab" | "memo" | "workdesk" | "cups" | "coffee" | "copier" | "boxes"
  | "trophy" | "diary" | "golfbag" | "pharmshelf" | "counter" | "batteries" | "poster" | "display" | "tv"
  | "cooler" | "vending" | "clock" | "motto" | "chair" | "bin" | "sofa" | "blinds" | "printer" | "cubicle" | "microwave"
  | "tallplant" | "sink2" | "notice" | "bench" | "rack" | "flag" | "aquarium" | "papers"
  | "dino" | "meteorcase" | "mummy" | "sarco" | "mural" | "telescope" | "projector" | "gemcase" | "ticket" | "rope" | "statue" | "billboard"
  | "moai" | "greek" | "pharaoh" | "sphinx" | "totem" | "whale" | "crystal" | "pottery" | "probe" | "orrery" | "banner" | "spot" | "anubis" | "obelisk" | "vase";

/** 조사 지점에 놓이는 소품 (바닥 y=214 기준) */
function drawProp(g: G, kind: PropKind, x: number, r: () => number): void {
  const F = 214;
  switch (kind) {
    case "reception":
      rect(g, x - 34, F - 30, 68, 30, "#5a3a28");
      rect(g, x - 36, F - 33, 72, 4, "#8a6a4a");
      rect(g, x - 36, F - 33, 72, 1, "#b8946a");
      rect(g, x - 30, F - 24, 60, 18, "#4a2e20");
      smallText(g, "안내 INFORMATION", x, F - 15, "#e8c84a", 6);
      rect(g, x - 14, F - 44, 14, 11, "#1a1e24");
      rect(g, x - 13, F - 43, 12, 9, "#2a4a5a");
      rect(g, x + 10, F - 38, 8, 5, "#c8c0b0");
      rect(g, x + 22, F - 36, 3, 3, "#e8d84a");
      break;
    case "gate":
      for (const dx of [-16, 0, 16]) {
        rect(g, x + dx - 3, F - 30, 6, 30, "#6a6e76");
        rect(g, x + dx - 3, F - 30, 6, 2, "#9aa0a6");
        rect(g, x + dx - 1, F - 26, 3, 2, "#3ae86a");
      }
      rect(g, x - 13, F - 20, 10, 2, "#c8ccd0");
      rect(g, x + 3, F - 20, 10, 2, "#c8ccd0");
      break;
    case "plant":
      rect(g, x - 8, F - 16, 16, 16, "#8a5a3a");
      rect(g, x - 9, F - 17, 18, 3, "#a87a52");
      for (let i = 0; i < 9; i++) {
        g.fillStyle = i % 2 ? "#3a7a3a" : "#4a9a4a";
        g.beginPath();
        g.ellipse(x - 8 + i * 2, F - 22 - (i % 3) * 6, 3, 8, (i - 4) * 0.25, 0, Math.PI * 2);
        g.fill();
      }
      break;
    case "board":
      rect(g, x - 20, 100, 40, 30, "#6a4a2a");
      rect(g, x - 18, 102, 36, 26, "#a87a4a");
      for (let i = 0; i < 4; i++) rect(g, x - 16 + i * 9, 104 + (i % 2) * 4, 7, 9, ["#f4f0e0", "#f8e888", "#e8c8c8", "#d8e8f8"][i]);
      rect(g, x - 6, 118, 14, 8, "#f4f0e0");
      for (let i = 0; i < 5; i++) rect(g, x - 14 + i * 7, 103 + (i % 2) * 4, 1, 1, "#c83a3a");
      break;
    case "alarm":
      rect(g, x - 5, 104, 10, 12, "#c83a32");
      rect(g, x - 5, 104, 10, 1, "#e85a4a");
      rect(g, x - 3, 107, 6, 5, "#f4f0e8");
      g.fillStyle = "#e83a3a";
      g.beginPath();
      g.arc(x, 99, 3, Math.PI, 0);
      g.fill();
      break;
    case "cage":
      rect(g, x - 2, 132, 4, 82, "#5a4a3a");
      rect(g, x - 8, 130, 16, 2, "#5a4a3a");
      g.strokeStyle = "#c8a83a";
      g.lineWidth = 0.6;
      g.beginPath();
      g.arc(x, 112, 10, Math.PI, 0);
      g.stroke();
      for (let i = -9; i <= 9; i += 3) {
        g.beginPath();
        g.moveTo(x + i, 112 - Math.sqrt(Math.max(0, 100 - i * i)));
        g.lineTo(x + i, 128);
        g.stroke();
      }
      rect(g, x - 11, 128, 22, 2, "#c8a83a");
      rect(g, x + 2, 116, 10, 1, "#c8a83a");
      break;
    case "sink":
      rect(g, x - 30, F - 34, 60, 34, "#d8d0c0");
      rect(g, x - 32, F - 36, 64, 4, "#8a8a92");
      for (const dx of [-28, -2]) {
        rect(g, x + dx, F - 30, 24, 26, "#c8beac");
        rect(g, x + dx + 20, F - 18, 2, 4, "#5a5a5a");
      }
      rect(g, x - 6, F - 44, 2, 8, "#9aa0a6");
      rect(g, x - 6, F - 44, 8, 2, "#9aa0a6");
      break;
    case "fridge":
      rect(g, x - 14, F - 64, 28, 64, "#e8e8ec");
      rect(g, x - 14, F - 64, 28, 1, "#ffffff");
      rect(g, x - 14, F - 40, 28, 1, "#9aa0a6");
      rect(g, x + 9, F - 58, 2, 12, "#9aa0a6");
      rect(g, x + 9, F - 34, 2, 14, "#9aa0a6");
      rect(g, x - 8, F - 56, 8, 10, "#f8e888");
      rect(g, x + 1, F - 52, 4, 4, "#e85a6a");
      break;
    case "frame":
      rect(g, x - 9, 96, 18, 22, "#8a6a3a");
      rect(g, x - 7, 98, 14, 18, "#d8c8a8");
      rect(g, x - 5, 104, 10, 9, "#a8b8c8");
      g.fillStyle = "#f4f4f4";
      g.beginPath();
      g.ellipse(x, 110, 3, 2.5, 0, 0, Math.PI * 2);
      g.fill();
      break;
    case "toolbox":
      rect(g, x - 12, F - 12, 24, 12, "#c83a32");
      rect(g, x - 12, F - 12, 24, 2, "#e85a4a");
      rect(g, x - 4, F - 16, 8, 4, "#3a3a3a");
      rect(g, x - 10, F - 7, 20, 1, "#8a2a24");
      break;
    case "bed":
      rect(g, x - 30, F - 18, 60, 12, "#d8d0c0");
      rect(g, x - 30, F - 20, 60, 3, "#4a6a9a");
      rect(g, x - 30, F - 6, 4, 6, "#5a3a24");
      rect(g, x + 26, F - 6, 4, 6, "#5a3a24");
      rect(g, x - 32, F - 34, 4, 34, "#5a3a24");
      rect(g, x - 26, F - 24, 14, 6, "#f4f0e8");
      break;
    case "fusebox":
      rect(g, x - 10, 120, 20, 28, "#5a5e66");
      rect(g, x - 10, 120, 20, 2, "#8a8e96");
      for (let i = 0; i < 3; i++) rect(g, x - 6 + i * 5, 128, 3, 8, i === 1 ? "#1a1a1a" : "#c8a83a");
      smallText(g, "⚡", x, 142, "#e8d84a", 7);
      break;
    case "debris":
      for (let i = 0; i < 9; i++) rect(g, x - 24 + r() * 44, F - 8 - r() * 30, 6 + r() * 14, 3 + r() * 5, ["#6a6058", "#4a4038", "#8a7a68"][i % 3]);
      rect(g, x - 26, F - 6, 52, 6, "#5a5048");
      break;
    case "shelf":
      rect(g, x - 18, 120, 36, 3, "#6a4a2a");
      rect(g, x - 18, 140, 36, 3, "#6a4a2a");
      for (let i = 0; i < 5; i++) rect(g, x - 16 + i * 7, 108 + (i % 2) * 2, 5, 12 - (i % 2) * 2, ["#a83a3a", "#3a6aa8", "#e8c84a", "#5a8a4a", "#e8e0d0"][i]);
      rect(g, x - 8, 130, 12, 10, "#f4e8c8");
      rect(g, x - 8, 130, 12, 1, "#e85a6a");
      break;
    case "safe":
      rect(g, x - 12, F - 26, 24, 26, "#3a3e46");
      rect(g, x - 12, F - 26, 24, 2, "#6a6e76");
      g.fillStyle = "#9aa0a6";
      g.beginPath();
      g.arc(x - 2, F - 14, 5, 0, Math.PI * 2);
      g.fill();
      rect(g, x + 6, F - 18, 3, 8, "#1a1e24");
      break;
    case "whiteboard":
      rect(g, x - 26, 94, 52, 34, "#9aa0a6");
      rect(g, x - 24, 96, 48, 30, "#f8f8fc");
      smallText(g, "현관 0 4 □ 7", x, 106, "#3a5ab8", 7);
      rect(g, x - 18, 114, 30, 0.75, "#c83a3a");
      rect(g, x - 18, 119, 22, 0.75, "#3a5ab8");
      rect(g, x - 24, 126, 48, 2, "#6a6e76");
      break;
    case "lostbox":
      rect(g, x - 14, F - 18, 28, 18, "#a87a4a");
      rect(g, x - 15, F - 20, 30, 3, "#8a5a32");
      smallText(g, "분실물", x, F - 9, "#2a1a10", 6);
      rect(g, x - 8, F - 24, 6, 5, "#e85a6a");
      rect(g, x + 2, F - 23, 6, 4, "#3a6aa8");
      break;
    case "prints":
      for (let i = 0; i < 6; i++) {
        g.fillStyle = "rgba(60,120,80,0.45)";
        g.beginPath();
        g.ellipse(x - 30 + i * 12, F + 4 + (i % 2) * 4, 3, 1.5, 0, 0, Math.PI * 2);
        g.fill();
      }
      break;
    case "locker":
      for (let i = 0; i < 3; i++) {
        rect(g, x - 18 + i * 12, F - 70, 11, 70, i === 1 ? "#4a7a9a" : "#5a6a7a");
        rect(g, x - 16 + i * 12, F - 62, 7, 1, "#3a4a5a");
        rect(g, x - 16 + i * 12, F - 58, 7, 1, "#3a4a5a");
      }
      rect(g, x - 4, F - 40, 3, 5, "#1a1e24");
      rect(g, x - 3, F - 39, 1, 1, "#3ae86a");
      break;
    case "desk":
    case "workdesk":
      rect(g, x - 26, F - 26, 52, 4, "#7a5a3a");
      rect(g, x - 24, F - 22, 4, 22, "#5a3a24");
      rect(g, x + 20, F - 22, 4, 22, "#5a3a24");
      rect(g, x + 4, F - 22, 18, 14, "#6a4a2e");
      rect(g, x + 10, F - 16, 6, 1, "#c8a83a");
      if (kind === "workdesk") {
        rect(g, x - 16, F - 44, 22, 16, "#1a1e24");
        rect(g, x - 15, F - 43, 20, 13, "#2a3a4a");
        rect(g, x - 7, F - 28, 4, 2, "#3a3e46");
        rect(g, x + 8, F - 30, 6, 4, "#f4f0e8");
        rect(g, x - 20, F - 40, 3, 3, "#f8e888");
      } else {
        rect(g, x - 18, F - 30, 12, 4, "#f4f0e8");
        rect(g, x - 2, F - 31, 5, 5, "#e8e0d0");
      }
      break;
    case "radio":
      rect(g, x - 9, F - 40, 18, 10, "#3a3a40");
      rect(g, x - 7, F - 38, 6, 6, "#1a1a1e");
      rect(g, x + 2, F - 37, 5, 2, "#c8a03a");
      rect(g, x + 6, F - 50, 0.75, 10, "#8a8a92");
      rect(g, x - 14, F - 30, 28, 3, "#5a3828");
      rect(g, x - 12, F - 27, 2, 27, "#3a2218");
      rect(g, x + 10, F - 27, 2, 27, "#3a2218");
      break;
    case "bag":
      rect(g, x - 10, F - 12, 20, 12, "#6a4a2a");
      rect(g, x - 10, F - 12, 20, 2, "#8a6a4a");
      g.strokeStyle = "#4a3020";
      g.lineWidth = 1;
      g.beginPath();
      g.arc(x, F - 12, 5, Math.PI, 0);
      g.stroke();
      break;
    case "sign":
    case "memo":
      rect(g, x - 16, 100, 32, 22, "#f4f0e0");
      rect(g, x - 16, 100, 32, 3, kind === "sign" ? "#c83a32" : "#e8c84a");
      for (let i = 0; i < 4; i++) rect(g, x - 12, 106 + i * 4, 22 - (i % 2) * 6, 0.75, "#3a3a3a");
      break;
    case "lectern":
      rect(g, x - 3, F - 40, 6, 40, "#5a3a24");
      rect(g, x - 12, F - 4, 24, 4, "#4a2e1e");
      g.fillStyle = "#6a4a2e";
      g.beginPath();
      g.moveTo(x - 14, F - 40);
      g.lineTo(x + 14, F - 46);
      g.lineTo(x + 14, F - 42);
      g.lineTo(x - 14, F - 36);
      g.fill();
      rect(g, x - 8, F - 46, 14, 5, "#f4ecd8");
      break;
    case "books":
      for (let i = 0; i < 6; i++) rect(g, x - 14 + i * 5, F - 14 - (i % 3) * 2, 4, 14 + (i % 3) * 2, ["#5a2a2a", "#2a3a5a", "#3a4a2a", "#6a5a3a"][i % 4]);
      break;
    case "medbox":
      rect(g, x - 14, F - 34, 28, 22, "#e8e4dc");
      rect(g, x - 14, F - 34, 28, 2, "#ffffff");
      rect(g, x - 3, F - 30, 6, 14, "#c83a32");
      rect(g, x - 7, F - 26, 14, 6, "#c83a32");
      rect(g, x - 16, F - 12, 32, 12, "#5a3a24");
      break;
    case "glass":
      for (let i = 0; i < 5; i++) rect(g, x - 12 + i * 5, 118 + (i % 2) * 3, 5, 10, ["#5a9a6a", "#c8a03a", "#3a5aa8", "#a83a5a", "#5ae8a8"][i]);
      rect(g, x - 13, 117, 27, 1, "#14121a");
      rect(g, x - 13, 131, 27, 1, "#14121a");
      break;
    case "monitors":
      rect(g, x - 34, F - 34, 68, 34, "#2a2e34");
      for (let j = 0; j < 4; j++) {
        rect(g, x - 32 + j * 17, F - 58, 15, 12, "#1a1e24");
        rect(g, x - 31 + j * 17, F - 57, 13, 10, ["#2a4a3a", "#3a4a2a", "#2a3a4a", "#2a4a4a"][j]);
        rect(g, x - 30 + j * 17, F - 55, 6, 1, "#6ae88a");
      }
      rect(g, x - 20, F - 38, 24, 4, "#4a4e56");
      break;
    case "logbook":
      rect(g, x - 16, F - 26, 32, 4, "#5a5e66");
      rect(g, x - 14, F - 22, 3, 22, "#3a3e46");
      rect(g, x + 11, F - 22, 3, 22, "#3a3e46");
      rect(g, x - 8, F - 30, 16, 4, "#2a4a8a");
      rect(g, x - 7, F - 30, 14, 1, "#f4f0e8");
      break;
    case "filecab":
      rect(g, x - 14, F - 56, 28, 56, "#5a5a62");
      for (let y = F - 52; y < F - 4; y += 13) {
        rect(g, x - 12, y, 24, 11, "#6a6a72");
        rect(g, x - 3, y + 4, 6, 2, "#c8c8d0");
      }
      rect(g, x - 10, F - 62, 18, 6, "#f4f0e0");
      break;
    case "cups":
      rect(g, x - 18, 124, 36, 2, "#6a4a2a");
      for (let i = 0; i < 6; i++) rect(g, x - 16 + i * 6, 118, 4, 6, i === 3 ? "#f4f4f4" : "#3a5a8a");
      rect(g, x + 2, 120, 2, 2, "#e85a6a");
      break;
    case "coffee":
      rect(g, x - 10, F - 52, 20, 26, "#2a2a30");
      rect(g, x - 10, F - 52, 20, 2, "#5a5a62");
      rect(g, x - 6, F - 44, 12, 6, "#1a1a1e");
      rect(g, x - 4, F - 36, 8, 4, "#5a3a24");
      rect(g, x + 4, F - 50, 3, 2, "#e83a3a");
      rect(g, x - 16, F - 26, 32, 4, "#8a8a92");
      rect(g, x - 14, F - 22, 28, 22, "#6a6e76");
      break;
    case "copier":
      rect(g, x - 18, F - 38, 36, 38, "#d8d8e0");
      rect(g, x - 18, F - 40, 36, 4, "#a8a8b0");
      rect(g, x - 14, F - 30, 20, 6, "#6a6e76");
      rect(g, x + 8, F - 30, 6, 3, "#e83a3a");
      rect(g, x - 16, F - 16, 32, 2, "#9a9aa2");
      smallText(g, "용지 걸림", x - 4, F - 27, "#ffd36a", 5);
      break;
    case "boxes":
      rect(g, x - 16, F - 14, 18, 14, "#a87a4a");
      rect(g, x, F - 22, 16, 22, "#8a6a3a");
      rect(g, x - 10, F - 26, 14, 12, "#b88a5a");
      break;
    case "trophy":
      rect(g, x - 14, F - 40, 28, 40, "#4a2e1e");
      rect(g, x - 4, F - 52, 8, 3, "#c8a03a");
      g.fillStyle = "#e8c84a";
      g.beginPath();
      g.moveTo(x - 6, F - 64);
      g.lineTo(x + 6, F - 64);
      g.lineTo(x + 3, F - 54);
      g.lineTo(x - 3, F - 54);
      g.fill();
      rect(g, x - 1, F - 54, 2, 3, "#c8a03a");
      break;
    case "diary":
      rect(g, x - 22, F - 26, 44, 4, "#5a3a24");
      rect(g, x - 20, F - 22, 4, 22, "#3a2218");
      rect(g, x + 16, F - 22, 4, 22, "#3a2218");
      rect(g, x - 8, F - 30, 14, 4, "#8a2a2a");
      rect(g, x - 7, F - 29, 12, 1, "#f4ecd8");
      rect(g, x + 10, F - 34, 2, 8, "#2a2a2a");
      break;
    case "golfbag":
      rect(g, x - 6, F - 34, 12, 34, "#2a5a3a");
      rect(g, x - 6, F - 34, 12, 3, "#c8c8d0");
      for (let i = 0; i < 3; i++) rect(g, x - 4 + i * 3, F - 46 + i * 2, 1, 12, "#9aa0a6");
      break;
    case "pharmshelf":
      rect(g, x - 26, F - 74, 52, 74, "#d8dce0");
      for (let y = F - 70; y < F - 4; y += 16) {
        rect(g, x - 24, y + 12, 48, 2, "#9aa0a6");
        for (let i = 0; i < 8; i++) if (r() < 0.75) rect(g, x - 23 + i * 6, y + 4, 4, 8, ["#e85a5a", "#f4f4f4", "#5a9ae8", "#e8c84a"][Math.floor(r() * 4)]);
      }
      rect(g, x - 26, F - 78, 52, 5, "#3a8a5a");
      smallText(g, "PHARMACY", x, F - 75.5, "#f4f4f4", 5);
      break;
    case "counter":
      rect(g, x - 30, F - 30, 60, 30, "#e8e4dc");
      rect(g, x - 32, F - 33, 64, 4, "#3a8a5a");
      rect(g, x - 12, F - 42, 14, 9, "#2a2e34");
      rect(g, x - 11, F - 41, 12, 6, "#3a5a4a");
      rect(g, x + 8, F - 38, 10, 5, "#c8c0b0");
      break;
    case "batteries":
      rect(g, x - 16, F - 50, 32, 50, "#3a3a44");
      for (let y = F - 46; y < F - 6; y += 10) for (let i = 0; i < 5; i++) {
        rect(g, x - 14 + i * 6, y, 4, 7, i % 2 ? "#e8c84a" : "#c83a32");
        rect(g, x - 14 + i * 6, y, 4, 1.5, "#2a2a2a");
      }
      smallText(g, "건전지", x, F - 54, "#e8c84a", 6);
      break;
    case "poster":
      rect(g, x - 14, 96, 28, 36, "#f4e8c8");
      rect(g, x - 14, 96, 28, 6, "#c83a32");
      smallText(g, "1+1", x, 112, "#c83a32", 9);
      smallText(g, "SALE", x, 124, "#2a2a2a", 6);
      break;
    case "display":
      g.save();
      g.translate(x, F - 4);
      g.rotate(-0.5);
      rect(g, -20, -10, 40, 10, "#d8dce0");
      g.restore();
      for (let i = 0; i < 7; i++) rect(g, x - 20 + r() * 40, F - 3 - r() * 4, 3, 2, ["#e85a5a", "#f4f4f4", "#5a9ae8"][i % 3]);
      break;
    case "tv":
      break;
    case "cooler":
      rect(g, x - 7, F - 30, 14, 30, "#d8dce0");
      rect(g, x - 7, F - 30, 14, 2, "#f4f6f8");
      rect(g, x - 6, F - 52, 12, 22, "rgba(140,190,230,0.75)");
      rect(g, x - 5, F - 50, 2, 18, "rgba(255,255,255,0.5)");
      rect(g, x - 3, F - 54, 6, 2, "#5a8ab8");
      rect(g, x + 2, F - 24, 2, 3, "#3a6ab8");
      rect(g, x - 4, F - 24, 2, 3, "#c83a3a");
      break;
    case "vending":
      rect(g, x - 16, F - 64, 32, 64, "#c83a32");
      rect(g, x - 16, F - 64, 32, 2, "#e85a4a");
      rect(g, x - 13, F - 58, 20, 36, "#1a2a3a");
      for (let yy = 0; yy < 4; yy++) for (let i = 0; i < 4; i++) rect(g, x - 12 + i * 5, F - 56 + yy * 9, 3, 6, ["#e8c84a", "#5ae88a", "#f4f4f4", "#e85a6a"][(i + yy) % 4]);
      rect(g, x + 9, F - 54, 5, 14, "#2a2a2a");
      rect(g, x - 12, F - 16, 20, 6, "#1a1a1a");
      smallText(g, "COLA", x - 2, F - 61, "#ffffff", 5);
      break;
    case "clock":
      g.fillStyle = "#2a2a2a";
      g.beginPath();
      g.arc(x, 62, 8, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#f4f0e8";
      g.beginPath();
      g.arc(x, 62, 7, 0, Math.PI * 2);
      g.fill();
      rect(g, x - 0.4, 57, 0.8, 5, "#1a1a1a");
      rect(g, x, 61.6, 4, 0.8, "#1a1a1a");
      rect(g, x - 0.3, 62, 0.6, 4, "#c83a3a");
      break;
    case "motto":
      rect(g, x - 26, 60, 52, 20, "#3a2a1a");
      rect(g, x - 24, 62, 48, 16, "#f4ecd8");
      smallText(g, ["야근은 열정이다", "고객은 왕, 직원은 노예", "웃으며 야근합시다", "칼퇴는 배신이다"][Math.floor(r() * 4)], x, 70, "#8a1a1a", 6);
      break;
    case "chair":
      rect(g, x - 7, F - 22, 14, 3, "#2a2e3a");
      rect(g, x + 4, F - 40, 4, 20, "#2a2e3a");
      rect(g, x + 3, F - 42, 6, 6, "#3a3e4a");
      rect(g, x - 1, F - 19, 2, 14, "#5a5e66");
      rect(g, x - 8, F - 5, 16, 2, "#5a5e66");
      rect(g, x - 8, F - 3, 2, 2, "#2a2a2a");
      rect(g, x + 6, F - 3, 2, 2, "#2a2a2a");
      break;
    case "bin":
      rect(g, x - 5, F - 12, 10, 12, "#6a6e76");
      rect(g, x - 6, F - 13, 12, 2, "#8a8e96");
      rect(g, x - 3, F - 16, 6, 4, "#f4f0e0");
      break;
    case "sofa":
      rect(g, x - 30, F - 22, 60, 16, "#4a5a7a");
      rect(g, x - 30, F - 34, 60, 14, "#3a4a6a");
      rect(g, x - 34, F - 28, 8, 22, "#3a4a6a");
      rect(g, x + 26, F - 28, 8, 22, "#3a4a6a");
      rect(g, x - 28, F - 6, 3, 6, "#2a1e14");
      rect(g, x + 25, F - 6, 3, 6, "#2a1e14");
      rect(g, x - 20, F - 28, 12, 8, "#c8a83a");
      break;
    case "blinds":
      rect(g, x - 22, 70, 44, 50, "#d8d8dc");
      rect(g, x - 20, 72, 40, 46, "#2a3a5a");
      for (let yy = 72; yy < 118; yy += 3) rect(g, x - 20, yy, 40, 1.6, "rgba(220,224,230,0.85)");
      rect(g, x - 22, 120, 44, 3, "#c8c8cc");
      break;
    case "printer":
      rect(g, x - 12, F - 40, 24, 12, "#e8e8ec");
      rect(g, x - 10, F - 43, 20, 4, "#c8c8d0");
      rect(g, x - 8, F - 33, 16, 2, "#5a5e66");
      rect(g, x + 6, F - 38, 3, 2, "#3ae86a");
      rect(g, x - 16, F - 28, 32, 28, "#6a6e76");
      rect(g, x - 14, F - 24, 28, 10, "#5a5e66");
      break;
    case "cubicle":
      rect(g, x - 34, F - 46, 3, 46, "#7a8290");
      rect(g, x + 31, F - 46, 3, 46, "#7a8290");
      rect(g, x - 34, F - 48, 68, 3, "#9aa2b0");
      rect(g, x - 31, F - 45, 62, 20, "rgba(110,120,140,0.55)");
      rect(g, x - 26, F - 26, 52, 3, "#a8a090");
      rect(g, x - 12, F - 42, 18, 13, "#1a1e24");
      rect(g, x - 11, F - 41, 16, 10, "#2a3a4a");
      rect(g, x - 20, F - 40, 4, 4, "#f8e888");
      rect(g, x + 14, F - 38, 3, 3, "#e88aa8");
      rect(g, x + 10, F - 31, 7, 5, "#f4f0e8");
      break;
    case "microwave":
      rect(g, x - 26, F - 32, 52, 4, "#a8a8b0");
      rect(g, x - 24, F - 28, 48, 28, "#c8c8d0");
      rect(g, x - 12, F - 46, 24, 14, "#e8e8ec");
      rect(g, x - 10, F - 44, 14, 10, "#2a2a30");
      rect(g, x + 6, F - 44, 4, 10, "#5a5a62");
      rect(g, x + 7, F - 42, 2, 1, "#3ae86a");
      break;
    case "tallplant":
      rect(g, x - 7, F - 14, 14, 14, "#3a3a3a");
      rect(g, x - 1, F - 46, 2, 32, "#4a3a24");
      for (let i = 0; i < 7; i++) {
        g.fillStyle = i % 2 ? "#3a8a4a" : "#2a6a3a";
        g.beginPath();
        g.ellipse(x + (i % 2 ? 6 : -6), F - 44 + i * 4, 7, 3, (i % 2 ? 0.5 : -0.5), 0, Math.PI * 2);
        g.fill();
      }
      break;
    case "sink2":
      rect(g, x - 20, F - 30, 40, 30, "#e8e4dc");
      rect(g, x - 22, F - 32, 44, 4, "#9aa0a6");
      rect(g, x - 2, F - 42, 2, 10, "#9aa0a6");
      rect(g, x - 2, F - 42, 8, 2, "#9aa0a6");
      rect(g, x + 10, F - 38, 6, 6, "#e8c84a");
      break;
    case "notice":
      rect(g, x - 18, 92, 36, 26, "#3a5a3a");
      rect(g, x - 16, 94, 32, 22, "#4a7a4a");
      for (let i = 0; i < 3; i++) rect(g, x - 14 + i * 10, 96 + (i % 2) * 3, 8, 10, "#f4f0e0");
      smallText(g, "공지", x, 112, "#f4f0e0", 6);
      break;
    case "bench":
      rect(g, x - 26, F - 16, 52, 4, "#6a4a2a");
      rect(g, x - 24, F - 12, 3, 12, "#3a2a1a");
      rect(g, x + 21, F - 12, 3, 12, "#3a2a1a");
      break;
    case "rack":
      rect(g, x - 2, F - 56, 2, 56, "#3a3a3a");
      rect(g, x - 10, F - 56, 20, 2, "#3a3a3a");
      rect(g, x - 9, F - 54, 8, 22, "#2a3a5a");
      rect(g, x + 2, F - 54, 7, 18, "#5a2a2a");
      rect(g, x - 8, F - 2, 16, 2, "#3a3a3a");
      break;
    case "flag":
      rect(g, x - 1, F - 70, 2, 70, "#c8a83a");
      rect(g, x + 1, F - 68, 22, 14, "#1a1a2a");
      smallText(g, "BLACK", x + 12, F - 63, "#e8c84a", 5);
      smallText(g, "CO.", x + 12, F - 58, "#e8c84a", 5);
      break;
    case "aquarium":
      rect(g, x - 20, F - 30, 40, 30, "#3a2a1a");
      rect(g, x - 18, F - 52, 36, 22, "rgba(80,150,200,0.7)");
      rect(g, x - 18, F - 52, 36, 2, "#9aa0a6");
      for (let i = 0; i < 3; i++) rect(g, x - 12 + i * 10, F - 44 + (i % 2) * 6, 4, 2, ["#f0a050", "#e85a6a", "#e8c84a"][i]);
      rect(g, x - 14, F - 34, 2, 4, "#3a8a4a");
      break;
    case "dino": {
      // 공룡 뼈 (긴 목 · 꼬리 · 갈비뼈)
      g.strokeStyle = "#e8e0c8";
      g.lineCap = "round";
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(x - 90, F - 50);
      g.quadraticCurveTo(x - 40, F - 70, x, F - 74);
      g.quadraticCurveTo(x + 50, F - 80, x + 70, F - 130);
      g.stroke();
      g.lineWidth = 1.4;
      for (let i = 0; i < 9; i++) {
        g.beginPath();
        g.arc(x - 20 + i * 6, F - 74, 14 - Math.abs(i - 4) * 1.5, 0.2, Math.PI - 0.2);
        g.stroke();
      }
      g.lineWidth = 2.4;
      for (const lx of [-24, -12, 20, 30]) {
        g.beginPath();
        g.moveTo(x + lx, F - 70);
        g.lineTo(x + lx + 3, F - 38);
        g.lineTo(x + lx, F - 6);
        g.stroke();
      }
      g.fillStyle = "#e8e0c8";
      g.beginPath();
      g.ellipse(x + 74, F - 134, 8, 5, -0.3, 0, Math.PI * 2);
      g.fill();
      rect(g, x - 60, F - 6, 130, 6, "#5a4a38");
      break;
    }
    case "meteorcase": {
      rect(g, x - 22, F - 30, 44, 30, "#3a3028");
      rect(g, x - 20, F - 66, 40, 36, "rgba(170,220,230,0.25)");
      rect(g, x - 20, F - 66, 40, 1, "#e8f0f4");
      const mg = g.createRadialGradient(x, F - 44, 0, x, F - 44, 14);
      mg.addColorStop(0, "#c8ffd8");
      mg.addColorStop(0.4, "#4ac87a");
      mg.addColorStop(1, "rgba(40,120,70,0)");
      g.fillStyle = mg;
      g.fillRect(x - 18, F - 62, 36, 32);
      g.fillStyle = "#3a4a3a";
      g.beginPath();
      g.ellipse(x, F - 40, 9, 6, 0.3, 0, Math.PI * 2);
      g.fill();
      smallText(g, "운석 GX-7", x, F - 22, "#e8d8a8", 6);
      break;
    }
    case "mummy":
      rect(g, x - 10, F - 56, 20, 56, "#3a2a1a");
      rect(g, x - 8, F - 54, 16, 52, "rgba(170,210,220,0.2)");
      g.fillStyle = "#c8b080";
      g.beginPath();
      g.ellipse(x, F - 24, 5, 16, 0, 0, Math.PI * 2);
      g.ellipse(x, F - 44, 4.5, 5, 0, 0, Math.PI * 2);
      g.fill();
      g.fillRect(x - 3, F - 52, 1.5, 4);
      g.fillRect(x + 2, F - 52, 1.5, 4);
      for (let y = F - 38; y < F - 10; y += 3) rect(g, x - 4, y, 8, 0.6, "#8a7050");
      smallText(g, "고양이 미라", x, F - 60, "#e8d8a8", 5);
      break;
    case "sarco":
      rect(g, x - 30, F - 22, 60, 22, "#c8962a");
      rect(g, x - 28, F - 20, 56, 4, "#2a4a8a");
      rect(g, x - 30, F - 26, 60, 4, "#e8c84a");
      for (let i = 0; i < 6; i++) rect(g, x - 24 + i * 9, F - 12, 5, 6, i % 2 ? "#8a2a1a" : "#2a6a4a");
      break;
    case "mural":
      rect(g, x - 34, 70, 68, 60, "#d8b478");
      rect(g, x - 34, 70, 68, 2, "#8a5a24");
      g.fillStyle = "#4ac87a";
      g.beginPath();
      g.arc(x, 82, 6, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = "rgba(74,200,122,0.7)";
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x, 88);
      g.lineTo(x - 14, 118);
      g.moveTo(x, 88);
      g.lineTo(x + 14, 118);
      g.stroke();
      g.fillStyle = "#1a1a1a";
      for (const dx of [-12, 0, 12]) {
        g.beginPath();
        g.ellipse(x + dx, 122, 3, 4, 0, 0, Math.PI * 2);
        g.ellipse(x + dx + 1, 116, 2, 2, 0, 0, Math.PI * 2);
        g.fill();
      }
      break;
    case "telescope":
      rect(g, x - 1, F - 40, 2, 40, "#3a3a44");
      rect(g, x - 10, F - 2, 20, 2, "#3a3a44");
      g.save();
      g.translate(x, F - 40);
      g.rotate(-0.6);
      rect(g, -4, -3, 26, 6, "#8a8a9a");
      rect(g, 20, -4, 4, 8, "#5a5a6a");
      g.restore();
      break;
    case "projector":
      g.fillStyle = "#2a2a3a";
      g.beginPath();
      g.arc(x, F - 34, 12, 0, Math.PI * 2);
      g.fill();
      for (let i = 0; i < 8; i++) {
        g.fillStyle = "#e8e8a0";
        g.beginPath();
        g.arc(x + Math.cos(i * 0.8) * 9, F - 34 + Math.sin(i * 0.8) * 9, 1, 0, Math.PI * 2);
        g.fill();
      }
      rect(g, x - 2, F - 22, 4, 22, "#3a3a44");
      rect(g, x - 12, F - 3, 24, 3, "#3a3a44");
      break;
    case "gemcase": {
      rect(g, x - 16, F - 28, 32, 28, "#1a1420");
      rect(g, x - 14, F - 52, 28, 24, "rgba(170,200,255,0.18)");
      rect(g, x - 14, F - 52, 28, 1, "#c8d8ff");
      const col = ["#e84a8a", "#4ac8e8", "#e8c84a", "#8a4ae8"][Math.floor(r() * 4)];
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(x, F - 46);
      g.lineTo(x + 6, F - 40);
      g.lineTo(x, F - 32);
      g.lineTo(x - 6, F - 40);
      g.fill();
      rect(g, x - 2, F - 44, 1.5, 3, "rgba(255,255,255,0.8)");
      break;
    }
    case "ticket":
      rect(g, x - 26, F - 34, 52, 34, "#8a1e22");
      rect(g, x - 28, F - 36, 56, 3, "#c8a83a");
      rect(g, x - 20, F - 58, 40, 22, "rgba(200,220,230,0.25)");
      rect(g, x - 20, F - 58, 40, 1, "#e8f0f4");
      smallText(g, "TICKETS", x, F - 26, "#e8c84a", 6);
      break;
    case "rope":
      for (const dx of [-24, 24]) {
        rect(g, x + dx - 1.5, F - 22, 3, 22, "#c8a83a");
        rect(g, x + dx - 3, F - 2, 6, 2, "#c8a83a");
      }
      g.strokeStyle = "#8a1e22";
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(x - 24, F - 18);
      g.quadraticCurveTo(x, F - 10, x + 24, F - 18);
      g.stroke();
      break;
    case "statue":
      rect(g, x - 12, F - 20, 24, 20, "#d8d0c0");
      g.fillStyle = "#1a1a1a";
      g.beginPath();
      g.ellipse(x, F - 36, 7, 14, 0, 0, Math.PI * 2);
      g.ellipse(x + 2, F - 54, 5, 5, 0, 0, Math.PI * 2);
      g.fill();
      g.fillRect(x - 2, F - 62, 1.5, 5);
      g.fillRect(x + 4, F - 62, 1.5, 5);
      rect(g, x + 1, F - 50, 2, 1, "#e8c84a");
      smallText(g, "바스테트", x, F - 10, "#5a4a38", 5);
      break;
    case "billboard":
      break;
    case "moai": {
      // 이스터섬 모아이 (큰 머리, 긴 코, 깊은 눈두덩)
      rect(g, x - 20, F - 10, 40, 10, "#5a5048");
      const mg = g.createLinearGradient(x - 18, 0, x + 18, 0);
      mg.addColorStop(0, "#8a7a6a");
      mg.addColorStop(0.5, "#6a5e52");
      mg.addColorStop(1, "#4a4038");
      g.fillStyle = mg;
      g.beginPath();
      g.moveTo(x - 15, F - 10);
      g.lineTo(x - 17, F - 64);
      g.quadraticCurveTo(x - 16, F - 86, x, F - 88);
      g.quadraticCurveTo(x + 16, F - 86, x + 15, F - 64);
      g.lineTo(x + 14, F - 10);
      g.fill();
      rect(g, x - 13, F - 66, 26, 4, "#3a3028");
      rect(g, x - 2, F - 64, 5, 20, "#7a6e60");
      rect(g, x - 10, F - 62, 6, 4, "#2a2420");
      rect(g, x + 5, F - 62, 6, 4, "#2a2420");
      rect(g, x - 7, F - 38, 15, 2.5, "#3a3028");
      rect(g, x - 17, F - 60, 3, 18, "#5a4e44");
      rect(g, x + 14, F - 60, 3, 18, "#4a4038");
      smallText(g, "모아이 (복제품)", x, F - 4, "#e8dcc0", 5);
      break;
    }
    case "greek": {
      // 대리석 여신상 (주름진 옷자락)
      rect(g, x - 14, F - 18, 28, 18, "#d8d0c0");
      rect(g, x - 16, F - 20, 32, 3, "#e8e0d0");
      g.fillStyle = "#ece6da";
      g.beginPath();
      g.moveTo(x - 9, F - 20);
      g.quadraticCurveTo(x - 11, F - 50, x - 6, F - 70);
      g.lineTo(x + 6, F - 70);
      g.quadraticCurveTo(x + 11, F - 50, x + 9, F - 20);
      g.fill();
      g.strokeStyle = "rgba(150,140,125,0.6)";
      g.lineWidth = 0.6;
      for (let i = 0; i < 5; i++) {
        g.beginPath();
        g.moveTo(x - 6 + i * 3, F - 22);
        g.quadraticCurveTo(x - 7 + i * 3.2, F - 44, x - 4 + i * 2, F - 66);
        g.stroke();
      }
      g.fillStyle = "#ece6da";
      g.beginPath();
      g.ellipse(x, F - 76, 5, 6, 0, 0, Math.PI * 2);
      g.fill();
      rect(g, x - 5, F - 82, 10, 3, "#d8d0c0");
      g.strokeStyle = "#ece6da";
      g.lineWidth = 2.4;
      g.beginPath();
      g.moveTo(x + 6, F - 66);
      g.quadraticCurveTo(x + 14, F - 74, x + 12, F - 86);
      g.stroke();
      smallText(g, "승리의 여신", x, F - 9, "#5a4a38", 5);
      break;
    }
    case "pharaoh": {
      rect(g, x - 16, F - 28, 32, 28, "#3a2a1a");
      rect(g, x - 16, F - 28, 32, 2, "#c8a03a");
      // 네메스 두건 줄무늬
      g.fillStyle = "#e8c048";
      g.beginPath();
      g.moveTo(x - 16, F - 30);
      g.lineTo(x - 10, F - 66);
      g.lineTo(x + 10, F - 66);
      g.lineTo(x + 16, F - 30);
      g.fill();
      for (let i = 0; i < 6; i++) rect(g, x - 15 + i * 1, F - 34 - i * 6, 30 - i * 2, 2, "#2a4a9a");
      rect(g, x - 7, F - 60, 14, 22, "#a87a42");
      rect(g, x - 5, F - 54, 3, 1.5, "#1a1a1a");
      rect(g, x + 2, F - 54, 3, 1.5, "#1a1a1a");
      rect(g, x - 1, F - 50, 2, 5, "#8a5a2a");
      rect(g, x - 3, F - 44, 6, 1.2, "#5a2a1a");
      rect(g, x - 1.5, F - 38, 3, 8, "#2a4a9a");
      g.fillStyle = "#e8c048";
      g.beginPath();
      g.arc(x, F - 66, 3, Math.PI, 0);
      g.fill();
      break;
    }
    case "sphinx": {
      rect(g, x - 34, F - 10, 68, 10, "#8a7050");
      g.fillStyle = "#c8a468";
      g.beginPath();
      g.moveTo(x - 30, F - 10);
      g.quadraticCurveTo(x - 28, F - 30, x - 6, F - 30);
      g.lineTo(x + 14, F - 30);
      g.lineTo(x + 30, F - 10);
      g.fill();
      rect(g, x + 14, F - 14, 20, 4, "#b89458");
      rect(g, x + 10, F - 54, 16, 26, "#c8a468");
      g.fillStyle = "#d8b478";
      g.beginPath();
      g.moveTo(x + 6, F - 30);
      g.lineTo(x + 8, F - 56);
      g.lineTo(x + 28, F - 56);
      g.lineTo(x + 30, F - 30);
      g.fill();
      for (let i = 0; i < 4; i++) rect(g, x + 7, F - 52 + i * 6, 22, 1.5, "#8a6a3a");
      rect(g, x + 14, F - 50, 10, 14, "#c8a468");
      rect(g, x + 20, F - 46, 2, 1.5, "#3a2a1a");
      break;
    }
    case "totem": {
      // 북서부 해안 토템 기둥: 얼굴이 층층이
      const cols = [["#8a2a1a", "#e8e0c8"], ["#2a5a6a", "#e8c84a"], ["#1a1a1a", "#c83a2a"], ["#5a3a24", "#4ac8a8"]];
      for (let i = 0; i < 4; i++) {
        const y = F - 22 - i * 24;
        const [c1, c2] = cols[i];
        rect(g, x - 10, y, 20, 22, "#6a4a2e");
        rect(g, x - 9, y + 2, 18, 4, c1);
        rect(g, x - 7, y + 7, 5, 4, c2);
        rect(g, x + 2, y + 7, 5, 4, c2);
        rect(g, x - 5.5, y + 8, 2, 2, "#1a1a1a");
        rect(g, x + 3.5, y + 8, 2, 2, "#1a1a1a");
        rect(g, x - 2, y + 11, 4, 5, c1);
        rect(g, x - 6, y + 17, 12, 3, c2);
      }
      g.fillStyle = "#8a2a1a";
      g.beginPath();
      g.moveTo(x - 24, F - 104);
      g.lineTo(x, F - 112);
      g.lineTo(x + 24, F - 104);
      g.lineTo(x, F - 98);
      g.fill();
      break;
    }
    case "whale": {
      // 천장에 매달린 대왕고래 모형
      for (const dx of [-60, 0, 60]) rect(g, x + dx, 22, 0.6, 20, "#9a9aa2");
      const wg = g.createLinearGradient(0, 40, 0, 74);
      wg.addColorStop(0, "#4a6a8a");
      wg.addColorStop(1, "#8aa8c8");
      g.fillStyle = wg;
      g.beginPath();
      g.moveTo(x - 90, 52);
      g.quadraticCurveTo(x - 20, 34, x + 60, 46);
      g.quadraticCurveTo(x + 84, 52, x + 82, 60);
      g.quadraticCurveTo(x + 40, 74, x - 70, 64);
      g.lineTo(x - 100, 72);
      g.lineTo(x - 96, 56);
      g.lineTo(x - 104, 44);
      g.closePath();
      g.fill();
      g.strokeStyle = "rgba(220,230,240,0.6)";
      g.lineWidth = 0.5;
      for (let i = 0; i < 8; i++) {
        g.beginPath();
        g.moveTo(x + 10 + i * 6, 64 - i * 0.4);
        g.lineTo(x + 6 + i * 6, 70 - i * 0.6);
        g.stroke();
      }
      rect(g, x + 66, 52, 2, 2, "#1a1a2a");
      g.fillStyle = "#5a7a9a";
      g.beginPath();
      g.ellipse(x + 10, 68, 12, 3, 0.4, 0, Math.PI * 2);
      g.fill();
      break;
    }
    case "crystal": {
      rect(g, x - 16, F - 22, 32, 22, "#2a2230");
      const cc = ["#a87ae8", "#7ac8e8", "#e87ab8"];
      for (let i = 0; i < 5; i++) {
        g.fillStyle = cc[i % 3];
        const bx = x - 12 + i * 6;
        const h = 12 + ((i * 7) % 10);
        g.beginPath();
        g.moveTo(bx - 3, F - 22);
        g.lineTo(bx, F - 22 - h);
        g.lineTo(bx + 3, F - 22);
        g.fill();
        rect(g, bx - 0.5, F - 20 - h, 1, h - 4, "rgba(255,255,255,0.5)");
      }
      break;
    }
    case "pottery":
      rect(g, x - 26, F - 26, 52, 26, "#4a3020");
      rect(g, x - 26, F - 60, 52, 34, "rgba(200,220,230,0.18)");
      rect(g, x - 26, F - 60, 52, 1, "#e8f0f4");
      for (const [dx, c, w, h] of [[-16, "#b8643a", 9, 16], [-3, "#3a5a8a", 8, 20], [11, "#c8a03a", 10, 14]] as Array<[number, string, number, number]>) {
        g.fillStyle = c;
        g.beginPath();
        g.ellipse(x + dx, F - 26 - h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
        g.fill();
        rect(g, x + dx - 1.5, F - 28 - h, 3, 3, c);
        rect(g, x + dx - w / 2 + 1, F - 27 - h / 2, w - 2, 1, "#1a1a1a");
      }
      break;
    case "probe":
      rect(g, x - 1, F - 40, 2, 40, "#3a3a44");
      rect(g, x - 14, F - 4, 28, 4, "#3a3a44");
      rect(g, x - 6, F - 58, 12, 10, "#c8b06a");
      g.fillStyle = "#e8e8f0";
      g.beginPath();
      g.arc(x, F - 64, 9, Math.PI, 0);
      g.fill();
      rect(g, x - 26, F - 56, 18, 6, "#2a4a8a");
      rect(g, x + 8, F - 56, 18, 6, "#2a4a8a");
      for (let i = 0; i < 4; i++) {
        rect(g, x - 26 + i * 4.5, F - 56, 0.5, 6, "#8ab0e8");
        rect(g, x + 8 + i * 4.5, F - 56, 0.5, 6, "#8ab0e8");
      }
      smallText(g, "보이저 (모형)", x, F - 10, "#c8c8e0", 5);
      break;
    case "orrery": {
      // 천장에 매달린 태양계 모형
      g.fillStyle = "#f0c048";
      g.beginPath();
      g.arc(x, 60, 9, 0, Math.PI * 2);
      g.fill();
      const pl: Array<[number, number, string]> = [[18, 2, "#a8a8a8"], [28, 3, "#e8c890"], [40, 3.4, "#4a8ae8"], [52, 2.6, "#c85a3a"], [70, 6, "#d8b088"], [88, 5, "#e8d8a8"]];
      pl.forEach(([d, rr, c], i) => {
        g.strokeStyle = "rgba(200,200,230,0.2)";
        g.lineWidth = 0.4;
        g.beginPath();
        g.ellipse(x, 60, d, d * 0.3, 0, 0, Math.PI * 2);
        g.stroke();
        const a = i * 1.3;
        g.fillStyle = c;
        g.beginPath();
        g.arc(x + Math.cos(a) * d, 60 + Math.sin(a) * d * 0.3, rr, 0, Math.PI * 2);
        g.fill();
      });
      rect(g, x - 0.3, 22, 0.6, 30, "#8a8a92");
      break;
    }
    case "banner":
      rect(g, x - 14, 30, 28, 60, ["#8a1e22", "#1e4a8a", "#2a6a3a", "#6a2a7a"][Math.floor(r() * 4)]);
      rect(g, x - 14, 30, 28, 3, "#c8a83a");
      g.fillStyle = "#c8a83a";
      g.beginPath();
      g.moveTo(x - 14, 90);
      g.lineTo(x, 98);
      g.lineTo(x + 14, 90);
      g.fill();
      smallText(g, ["고대", "별", "공룡", "바다"][Math.floor(r() * 4)], x, 60, "#f4e8c8", 8);
      break;
    case "spot": {
      const sg = g.createLinearGradient(0, 24, 0, F);
      sg.addColorStop(0, "rgba(255,240,200,0.28)");
      sg.addColorStop(1, "rgba(255,240,200,0.02)");
      g.fillStyle = sg;
      g.beginPath();
      g.moveTo(x - 4, 24);
      g.lineTo(x + 4, 24);
      g.lineTo(x + 34, F);
      g.lineTo(x - 34, F);
      g.fill();
      rect(g, x - 4, 22, 8, 4, "#2a2a30");
      break;
    }
    case "anubis":
      rect(g, x - 10, F - 16, 20, 16, "#3a2a1a");
      g.fillStyle = "#1a1a1a";
      g.beginPath();
      g.ellipse(x, F - 32, 7, 16, 0, 0, Math.PI * 2);
      g.ellipse(x + 3, F - 54, 5, 5, 0, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.moveTo(x + 4, F - 56);
      g.lineTo(x + 14, F - 52);
      g.lineTo(x + 6, F - 50);
      g.fill();
      rect(g, x, F - 66, 2, 8, "#1a1a1a");
      rect(g, x + 4, F - 66, 2, 8, "#1a1a1a");
      rect(g, x - 6, F - 44, 12, 3, "#c8a03a");
      rect(g, x + 5, F - 55, 1.5, 1, "#e8c84a");
      break;
    case "obelisk":
      g.fillStyle = "#b89a6a";
      g.beginPath();
      g.moveTo(x - 9, F);
      g.lineTo(x - 6, F - 110);
      g.lineTo(x, F - 120);
      g.lineTo(x + 6, F - 110);
      g.lineTo(x + 9, F);
      g.fill();
      for (let y = F - 100; y < F - 10; y += 9) rect(g, x - 3, y, 6, 4, ["#8a6a3a", "#5a3a1a"][(y / 9) % 2 | 0]);
      break;
    case "vase":
      rect(g, x - 6, F - 12, 12, 12, "#d8d0c0");
      g.fillStyle = "#3a6aa8";
      g.beginPath();
      g.ellipse(x, F - 24, 7, 10, 0, 0, Math.PI * 2);
      g.fill();
      rect(g, x - 3, F - 36, 6, 4, "#3a6aa8");
      for (let i = 0; i < 3; i++) rect(g, x - 6, F - 28 + i * 4, 12, 0.8, "#e8e4dc");
      break;
    case "papers":
      for (let i = 0; i < 4; i++) rect(g, x - 10 + i * 2, F - 6 - i * 3, 18, 3, i % 2 ? "#f4f0e0" : "#e8e4d4");
      break;
  }
}

// 최근에 지은 방 몇 개는 다시 짓지 않는다 (문으로 오갈 때 빠르게)
const roomCache = new Map<string, HTMLCanvasElement>();
export function buildInterior(theme: Theme, width: number, seed: number, doors: DoorDef[], props: Array<[PropKind, number]> = []): HTMLCanvasElement {
  const key = JSON.stringify([theme, width, seed, doors, props]);
  const hit = roomCache.get(key);
  if (hit) {
    roomCache.delete(key);
    roomCache.set(key, hit);
    return hit;
  }
  const c = buildInteriorRaw(theme, width, seed, doors, props);
  roomCache.set(key, c);
  if (roomCache.size > 6) roomCache.delete(roomCache.keys().next().value as string);
  return c;
}
function buildInteriorRaw(theme: Theme, width: number, seed: number, doors: DoorDef[], props: Array<[PropKind, number]>): HTMLCanvasElement {
  const c = makeDense(width, H, BG_SCALE);
  const g = c.getContext("2d")!;
  const r = rng(seed);
  const P: Record<Theme, { wall: string; wall2: string; floor: string; trim: string }> = {
    hall: { wall: "#8a7458", wall2: "#7a6448", floor: "#5a2e2a", trim: "#4a3020" },
    flat: { wall: "#9a8a72", wall2: "#8a7a62", floor: "#6a4a32", trim: "#5a3a26" },
    lobby: { wall: "#7a6a5a", wall2: "#6a5a4a", floor: "#c8c0b0", trim: "#3a2a20" },
    tunnel: { wall: "#4a4a46", wall2: "#3e3e3a", floor: "#2a2a28", trim: "#1e1e1c" },
    pump: { wall: "#4a524e", wall2: "#3e4642", floor: "#2e3432", trim: "#1e2422" },
    staff: { wall: "#7a8a8a", wall2: "#6a7a7a", floor: "#4a4e52", trim: "#2a2e32" },
    crypt: { wall: "#4a4038", wall2: "#3e352e", floor: "#2e2824", trim: "#1e1a16" },
    vault: { wall: "#3e3630", wall2: "#342c26", floor: "#2a2420", trim: "#1a1612" },
    security: { wall: "#3a4450", wall2: "#323a44", floor: "#2a3036", trim: "#1a1e24" },
    archive: { wall: "#5a5448", wall2: "#4e483e", floor: "#3a3630", trim: "#2a241e" },
    cells: { wall: "#b8bcc0", wall2: "#a8acb0", floor: "#7a8086", trim: "#5a6066" },
    museum: { wall: "#c8bca4", wall2: "#b0a48c", floor: "#8a7a64", trim: "#5a4a38" },
    egypt: { wall: "#c8a468", wall2: "#a8844c", floor: "#7a6040", trim: "#4a3a24" },
    planet: { wall: "#0a0c1a", wall2: "#10142a", floor: "#1a1a2a", trim: "#0a0a14" },
    gem: { wall: "#2a2238", wall2: "#221a2e", floor: "#1e1a26", trim: "#120e18" },
  };
  const pal = P[theme];
  // 천장
  rect(g, 0, 0, width, 22, mix(pal.wall, -0.55));
  rect(g, 0, 21, width, 1, mix(pal.wall, -0.7));
  // 벽
  vgrad(g, 0, 22, width, 214, [[0, mix(pal.wall, -0.15)], [1, pal.wall]]);
  if (theme === "hall" || theme === "flat") {
    // 빛바랜 줄무늬 벽지 + 징두리
    for (let x = 0; x < width; x += 8) rect(g, x, 22, 3, 128, "rgba(0,0,0,0.06)");
    for (let x = 4; x < width; x += 16) for (let y = 30; y < 148; y += 14) rect(g, x, y, 1.5, 1.5, "rgba(255,240,200,0.12)");
    rect(g, 0, 150, width, 64, pal.wall2);
    for (let x = 0; x < width; x += 24) {
      rect(g, x + 3, 156, 18, 52, mix(pal.wall2, -0.06));
      rect(g, x + 3, 156, 18, 0.5, mix(pal.wall2, 0.12));
    }
    rect(g, 0, 148, width, 3, pal.trim);
    rect(g, 0, 148, width, 0.5, mix(pal.trim, 0.3));
  } else if (theme === "tunnel" || theme === "pump") {
    for (let y = 22; y < 214; y += 6) for (let x = (y / 6) % 2 ? 6 : 0; x < width; x += 12) {
      const col = mix(pal.wall, (r() - 0.5) * 0.1);
      rect(g, x + 0.5, y + 0.5, 11, 5, col);
      rect(g, x + 0.5, y + 0.5, 11, 0.5, mix(col, 0.1));
    }
    // 파이프
    for (const [py, pc] of [[40, "#6a5a3a"], [52, "#3a5a6a"], [60, "#5a3a2a"]] as Array<[number, string]>) {
      rect(g, 0, py, width, 5, pc);
      rect(g, 0, py, width, 1, mix(pc, 0.3));
      rect(g, 0, py + 4, width, 1, mix(pc, -0.3));
      for (let x = 20 + r() * 40; x < width; x += 70 + r() * 50) rect(g, x, py - 1, 3, 7, mix(pc, -0.2));
    }
    for (let i = 0; i < width / 40; i++) rect(g, r() * width, 70 + r() * 120, 1, 6 + r() * 30, "rgba(90,110,60,0.35)");
    for (let x = 60; x < width; x += 140) {
      rect(g, x, 26, 14, 4, "#2a2a28");
      rect(g, x + 2, 30, 10, 2, "#e8e0a0");
    }
  } else if (theme === "crypt" || theme === "vault") {
    for (let y = 22; y < 214; y += 10) for (let x = (y / 10) % 2 ? 12 : 0; x < width; x += 24) {
      const col = mix(pal.wall, (r() - 0.5) * 0.14);
      rect(g, x + 0.5, y + 0.5, 23, 9, col);
      rect(g, x + 0.5, y + 0.5, 23, 0.5, mix(col, 0.12));
      rect(g, x + 0.5, y + 9, 23, 0.5, mix(col, -0.2));
    }
    // 아치형 벽감
    for (let x = 40; x < width - 40; x += 120) {
      g.fillStyle = mix(pal.wall, -0.45);
      g.beginPath();
      g.moveTo(x - 18, 150);
      g.lineTo(x - 18, 90);
      g.quadraticCurveTo(x, 66, x + 18, 90);
      g.lineTo(x + 18, 150);
      g.fill();
      if (theme === "crypt") {
        for (let k = 0; k < 3; k++) {
          rect(g, x - 12, 104 + k * 15, 24, 2, "#5a4a38");
          for (let j = 0; j < 4; j++) if (r() < 0.7) rect(g, x - 10 + j * 6, 98 + k * 15, 4, 6, ["#8a7a5a", "#5a3a2a", "#3a4a5a", "#e8dcc0"][j]);
        }
      } else {
        rect(g, x - 2, 112, 4, 30, "#c8b88a");
        g.fillStyle = "#f4d88a";
        g.beginPath();
        g.ellipse(x, 108, 2, 4, 0, 0, Math.PI * 2);
        g.fill();
      }
    }
  } else if (theme === "staff" || theme === "security" || theme === "archive" || theme === "lobby" || theme === "cells") {
    for (let x = 0; x < width; x += 32) rect(g, x, 22, 0.5, 192, "rgba(0,0,0,0.08)");
    rect(g, 0, 150, width, 6, mix(pal.wall, -0.2));
    for (let x = 50; x < width; x += 130) {
      rect(g, x, 23, 30, 3, "#e8ecf0");
      rect(g, x, 26, 30, 0.5, "#9aa0a6");
    }
    if (theme === "lobby") {
      // 대리석 바닥 무늬 + 우편함
      rect(g, 0, 160, width, 54, pal.wall2);
      for (let x = 0; x < width; x += 20) rect(g, x, 160, 0.5, 54, "rgba(0,0,0,0.1)");
    }
  }
  if (theme === "museum") {
    // 위쪽 벽: 네모난 격자 장식 (우물 천장 같은 사각 패널)
    for (let x = 0; x < width; x += 20) for (let y = 40; y < 140; y += 20) {
      rect(g, x + 2, y + 2, 16, 16, mix(pal.wall, -0.06));
      rect(g, x + 2, y + 2, 16, 1, mix(pal.wall, -0.18));
      rect(g, x + 2, y + 2, 1, 16, mix(pal.wall, -0.14));
      rect(g, x + 2, y + 17, 16, 1, mix(pal.wall, 0.12));
      rect(g, x + 17, y + 2, 1, 16, mix(pal.wall, 0.1));
      rect(g, x + 8, y + 8, 4, 4, mix(pal.wall, 0.05));
    }
    // 그리스 뇌문(네모 소용돌이) 띠
    rect(g, 0, 140, width, 10, "#7a5a3a");
    for (let x = 0; x < width; x += 10) {
      rect(g, x + 1, 141, 8, 1, "#d8b86a");
      rect(g, x + 8, 141, 1, 7, "#d8b86a");
      rect(g, x + 3, 147, 6, 1, "#d8b86a");
      rect(g, x + 3, 143, 1, 4, "#d8b86a");
      rect(g, x + 3, 143, 3, 1, "#d8b86a");
    }
    // 아래쪽: 짙은 나무 징두리 판
    rect(g, 0, 150, width, 56, "#5a3e2a");
    for (let x = 0; x < width; x += 30) {
      rect(g, x + 3, 155, 24, 46, "#6a4a32");
      rect(g, x + 3, 155, 24, 1, "#8a6444");
      rect(g, x + 3, 155, 1, 46, "#7a5a3c");
      rect(g, x + 3, 200, 24, 1, "#3e2a1c");
      rect(g, x + 26, 155, 1, 46, "#46301e");
      rect(g, x + 8, 162, 14, 32, "#5e422c");
      rect(g, x + 8, 162, 14, 1, "#4a3220");
    }
    rect(g, 0, 150, width, 2, "#8a6a48");
    // 대리석 기둥 (네모 기둥머리와 받침)
    for (let x = 30; x < width; x += 150) {
      rect(g, x, 34, 16, 176, "#e0d6c0");
      for (let k = 2; k < 16; k += 4) rect(g, x + k, 38, 1, 168, "#c8bca4");
      rect(g, x, 34, 2, 176, "#f4ecd8");
      rect(g, x + 14, 34, 2, 176, "#a89a80");
      rect(g, x - 5, 26, 26, 4, "#efe6d2");
      rect(g, x - 3, 30, 22, 4, "#d8cdb6");
      rect(g, x - 5, 29, 26, 1, "#a89a80");
      rect(g, x - 4, 202, 24, 4, "#d8cdb6");
      rect(g, x - 6, 206, 28, 4, "#efe6d2");
    }
    // 붉은 휘장 (네모 술)
    rect(g, 0, 22, width, 6, "#8a1e22");
    rect(g, 0, 22, width, 1, "#b03a3a");
    for (let x = 0; x < width; x += 8) {
      rect(g, x, 28, 6, x % 16 === 0 ? 6 : 4, "#8a1e22");
      rect(g, x + 2, x % 16 === 0 ? 34 : 32, 2, 2, "#d8b040");
    }
  } else if (theme === "egypt") {
    // 사암 벽돌 (엇갈린 네모 돌)
    for (let y = 22; y < 206; y += 12) for (let x = (y / 12) % 2 ? -12 : 0; x < width; x += 24) {
      const col = mix(pal.wall, (r() - 0.5) * 0.12);
      rect(g, x + 0.5, y + 0.5, 23, 11, col);
      rect(g, x + 0.5, y + 0.5, 23, 1, mix(col, 0.12));
      rect(g, x + 0.5, y + 10.5, 23, 1, mix(col, -0.16));
      if (r() < 0.2) rect(g, x + 4 + r() * 14, y + 3 + r() * 5, 2, 1, mix(col, -0.2));
    }
    // 상형문자: 작은 도트 그림 (가로 5 × 세로 8)
    const GL: string[][] = [
      [".###.", "#...#", ".#.#.", "..#..", "#####", "..#..", "..#..", "..#.."], // 앙크
      [".....", ".###.", "#.#.#", "#####", ".#...", "..#..", "...#.", "....."], // 눈
      ["..##.", ".###.", "..##.", ".###.", "####.", ".###.", "..#..", ".#.#."], // 새
      ["#...#", "##.##", "#####", "#.#.#", "#####", ".###.", ".###.", "##.##"], // 고양이
      [".....", "#.#.#", ".#.#.", ".....", "#.#.#", ".#.#.", ".....", "....."], // 물결
      ["..#..", "..#..", ".###.", ".###.", "#####", "#####", "#####", "....."], // 피라미드
      ["#####", "#...#", "#.#.#", "#...#", "#####", ".....", "#####", "....."], // 상자
    ];
    const glyph = (gx: number, gy: number, k: number, col: string) => {
      const m = GL[k % GL.length];
      for (let yy = 0; yy < 8; yy++) for (let xx = 0; xx < 5; xx++) if (m[yy][xx] === "#") rect(g, gx + xx, gy + yy, 1, 1, col);
    };
    const GCOL = ["#1e3a7a", "#8a2a1a", "#1a1a1a", "#1e6a4a", "#b8761a"];
    // 위쪽 띠 (상형문자 줄)
    const frieze = (by: number) => {
      rect(g, 0, by, width, 22, "#e0c088");
      rect(g, 0, by, width, 2, "#2a4a8a");
      rect(g, 0, by + 2, width, 1, "#c8862a");
      rect(g, 0, by + 19, width, 1, "#c8862a");
      rect(g, 0, by + 20, width, 2, "#2a4a8a");
      for (let x = 6; x < width; x += 10) glyph(x, by + 7, Math.floor(r() * 7), GCOL[Math.floor(r() * 5)]);
    };
    frieze(36);
    // 벽화 판: 옆모습 사람과 고양이 행렬 (네모 도트)
    for (let x = 90; x < width - 60; x += 260) {
      rect(g, x - 2, 82, 104, 64, "#5a3a1a");
      rect(g, x, 84, 100, 60, "#e8cc90");
      for (let k = 0; k < 3; k++) {
        const fx = x + 10 + k * 32;
        const skin = k === 1 ? "#a85a2a" : "#8a4a24";
        rect(g, fx + 4, 96, 6, 6, skin); // 머리
        rect(g, fx + 3, 95, 6, 3, "#1a1a1a"); // 가발
        rect(g, fx + 3, 98, 2, 6, "#1a1a1a");
        rect(g, fx + 9, 98, 1, 1, "#1a1a1a"); // 눈
        rect(g, fx + 4, 102, 6, 10, skin);
        rect(g, fx + 3, 104, 8, 2, "#2a6a9a"); // 목걸이
        rect(g, fx + 4, 112, 7, 12, "#f4ecd8"); // 치마
        rect(g, fx + 4, 124, 2, 10, skin);
        rect(g, fx + 8, 124, 2, 10, skin);
        rect(g, fx + 10, 104, 6, 2, skin); // 내민 팔
        rect(g, fx + 16, 100, 2, 6, ["#c8862a", "#1e6a4a", "#8a2a1a"][k]);
      }
      // 맨 앞의 앉은 고양이 (바스테트)
      rect(g, x + 88, 118, 6, 16, "#1a1a1a");
      rect(g, x + 87, 112, 7, 7, "#1a1a1a");
      rect(g, x + 87, 110, 2, 2, "#1a1a1a");
      rect(g, x + 92, 110, 2, 2, "#1a1a1a");
      rect(g, x + 88, 114, 1, 1, "#c8a030");
      rect(g, x + 84, 130, 4, 3, "#1a1a1a");
      for (let k = 0; k < 8; k++) glyph(x + 4 + k * 12, 136 - 1, Math.floor(r() * 7), "#3a2a1a");
    }
    // 아래 띠: 연꽃 무늬 (네모 꽃잎)
    rect(g, 0, 172, width, 34, "#2a4a8a");
    rect(g, 0, 172, width, 2, "#c8862a");
    for (let x = 0; x < width; x += 12) {
      rect(g, x + 5, 178, 2, 22, "#1e6a4a");
      rect(g, x + 3, 178, 6, 6, "#d8b478");
      rect(g, x + 4, 176, 4, 2, "#e8d0a0");
      rect(g, x + 1, 190, 3, 4, "#c8862a");
      rect(g, x + 8, 190, 3, 4, "#c8862a");
    }
    rect(g, 0, 204, width, 2, "#c8862a");
  } else if (theme === "planet") {
    // 별이 가득한 돔
    for (let i = 0; i < width / 2; i++) {
      const b2 = r();
      rect(g, r() * width, 22 + r() * 170, b2 < 0.1 ? 1 : 0.5, b2 < 0.1 ? 1 : 0.5, b2 < 0.3 ? "#fff4c8" : "#9aa8d8");
    }
    g.strokeStyle = "rgba(120,140,220,0.25)";
    g.lineWidth = 0.4;
    for (let x = -100; x < width + 100; x += 60) {
      g.beginPath();
      g.arc(x, 260, 200, Math.PI * 1.1, Math.PI * 1.9);
      g.stroke();
    }
  } else if (theme === "gem") {
    // 어두운 전시실, 벽의 보석 진열 조명 자국
    for (let x = 60; x < width; x += 120) {
      const gr = g.createRadialGradient(x, 90, 0, x, 90, 50);
      gr.addColorStop(0, "rgba(160,140,255,0.18)");
      gr.addColorStop(1, "rgba(160,140,255,0)");
      g.fillStyle = gr;
      g.fillRect(x - 50, 40, 100, 100);
    }
  }
  // ── 공통 디테일: 천장 몰딩 · 조명 기구 · 벽 얼룩과 금 · 콘센트 · 걸레받이
  rect(g, 0, 22, width, 2, mix(pal.wall, 0.12));
  rect(g, 0, 24, width, 1, mix(pal.wall, -0.25));
  if (theme !== "planet") {
    for (let x = 65; x < width; x += 130) {
      if (theme === "crypt" || theme === "vault" || theme === "egypt") {
        // 벽걸이 횃불 · 촛대
        rect(g, x - 1, 96, 2, 10, "#3a2a1a");
        rect(g, x - 3, 94, 6, 2, "#5a3a24");
        g.fillStyle = "rgba(255,180,90,0.9)";
        g.beginPath();
        g.ellipse(x, 90, 2, 4, 0, 0, Math.PI * 2);
        g.fill();
      } else if (theme === "tunnel" || theme === "pump") {
        rect(g, x - 6, 24, 12, 4, "#2a2a28");
        g.fillStyle = "rgba(255,240,180,0.5)";
        g.fillRect(x - 5, 28, 10, 1);
      } else {
        // 천장 등: 갓과 줄
        rect(g, x - 0.5, 22, 1, 8, "#2a2a2a");
        g.fillStyle = mix(pal.wall, -0.5);
        g.beginPath();
        g.moveTo(x - 8, 36);
        g.lineTo(x - 4, 30);
        g.lineTo(x + 4, 30);
        g.lineTo(x + 8, 36);
        g.fill();
        g.fillStyle = "rgba(255,240,200,0.85)";
        g.fillRect(x - 6, 36, 12, 1);
      }
    }
  }
  for (let i = 0; i < width / 60; i++) {
    const sx = r() * width;
    const sy = 40 + r() * 120;
    if (r() < 0.5) {
      // 물 얼룩
      const sg2 = g.createRadialGradient(sx, sy, 0, sx, sy, 10 + r() * 14);
      sg2.addColorStop(0, "rgba(40,30,20,0.12)");
      sg2.addColorStop(1, "rgba(40,30,20,0)");
      g.fillStyle = sg2;
      g.fillRect(sx - 26, sy - 26, 52, 52);
    } else {
      // 벽 금
      g.strokeStyle = "rgba(20,14,10,0.35)";
      g.lineWidth = 0.4;
      g.beginPath();
      g.moveTo(sx, sy);
      let cx2 = sx;
      let cy2 = sy;
      for (let k = 0; k < 4; k++) {
        cx2 += (r() - 0.5) * 8;
        cy2 += 3 + r() * 5;
        g.lineTo(cx2, cy2);
      }
      g.stroke();
    }
  }
  if (theme !== "planet" && theme !== "tunnel" && theme !== "crypt") {
    for (let x = 90 + r() * 60; x < width; x += 160 + r() * 80) {
      rect(g, x, 196, 4, 6, "#e8e4dc");
      rect(g, x + 1, 198, 0.6, 1.4, "#3a3a3a");
      rect(g, x + 2.4, 198, 0.6, 1.4, "#3a3a3a");
    }
  }
  rect(g, 0, 206, width, 8, mix(pal.trim, 0.1));
  rect(g, 0, 206, width, 1, mix(pal.trim, 0.35));
  // 바닥
  rect(g, 0, 214, width, H - 214, pal.floor);
  if (theme === "museum") {
    // 체크무늬 대리석 바닥 (네모 타일 + 결)
    for (let x = 0; x < width; x += 16) for (let y = 214; y < H; y += 14) {
      const on = ((x / 16 + (y - 214) / 14) | 0) % 2 === 0;
      const col = on ? "#c8bca2" : "#8a7a62";
      rect(g, x, y, 15.5, 13.5, col);
      rect(g, x, y, 15.5, 1, mix(col, 0.12));
      if (r() < 0.35) rect(g, x + 2 + r() * 8, y + 3 + r() * 6, 4, 1, mix(col, -0.1));
    }
  } else if (theme === "egypt") {
    for (let x = 0; x < width; x += 24) for (let y = 214; y < H; y += 12) {
      const col = mix(pal.floor, ((x + y) / 12) % 3 === 0 ? 0.06 : -0.04);
      rect(g, x + ((y / 12) % 2) * 12, y, 23.5, 11.5, col);
      rect(g, x + ((y / 12) % 2) * 12, y, 23.5, 1, mix(col, 0.1));
    }
  }
  if (theme === "hall") {
    rect(g, 0, 218, width, 30, "#7a2a2a");
    for (let x = 0; x < width; x += 12) rect(g, x + 2, 224, 8, 0.75, "#c8a03a");
    rect(g, 0, 218, width, 0.75, "#c8a03a");
    rect(g, 0, 247, width, 0.75, "#c8a03a");
  } else if (theme === "lobby") {
    for (let x = 0; x < width; x += 16) for (let y = 214; y < H; y += 16) rect(g, x, y, 15.5, 15.5, ((x + y) / 16) % 2 ? "#d8d0c0" : "#2a2a2a");
  } else if (theme === "tunnel") {
    rect(g, 0, 214, width, 6, "#3a3a36");
    for (let x = 0; x < width; x += 8) rect(g, x, 214, 0.5, 6, "#2a2a26");
  } else if (theme !== "museum" && theme !== "egypt") {
    for (let x = 0; x < width; x += 18) rect(g, x, 214, 0.5, H - 214, mix(pal.floor, -0.2));
  }
  rect(g, 0, 214, width, 1, mix(pal.floor, 0.25));
  rect(g, 0, 210, width, 4, pal.trim);
  // 바닥 광택과 조명 웅덩이
  vgrad(g, 0, 215, width, 228, [[0, "rgba(255,255,255,0.07)"], [1, "rgba(255,255,255,0)"]]);
  if (theme !== "planet") {
    for (let x = 65; x < width; x += 130) {
      const pg = g.createRadialGradient(x, 236, 0, x, 236, 46);
      pg.addColorStop(0, theme === "crypt" || theme === "vault" || theme === "egypt" ? "rgba(255,180,90,0.10)" : "rgba(255,240,200,0.09)");
      pg.addColorStop(1, "rgba(255,240,200,0)");
      g.fillStyle = pg;
      g.fillRect(x - 46, 216, 92, 50);
    }
  }
  // 소품
  const randomProp = (x: number) => {
    const k = r();
    if (theme === "hall") {
      if (k < 0.35) {
        rect(g, x - 6, 90, 12, 16, "#c8b890");
        rect(g, x - 5, 91, 10, 14, ["#6a8aa8", "#a86a5a", "#7a9a6a"][Math.floor(r() * 3)]);
      } else if (k < 0.6) {
        rect(g, x - 1, 60, 2, 10, "#2a2a2a");
        rect(g, x - 6, 70, 12, 6, "#e8d8a8");
      }
    } else if (theme === "flat") {
      if (k < 0.3) {
        rect(g, x - 22, 186, 44, 20, "#5a6a8a");
        rect(g, x - 24, 178, 48, 10, "#4a5a7a");
        rect(g, x - 22, 206, 4, 8, "#3a2a20");
        rect(g, x + 18, 206, 4, 8, "#3a2a20");
      } else if (k < 0.55) {
        rect(g, x - 14, 130, 28, 84, "#6a4a32");
        for (let y = 140; y < 210; y += 18) {
          rect(g, x - 12, y, 24, 2, "#4a3020");
          for (let j = 0; j < 4; j++) if (r() < 0.8) rect(g, x - 11 + j * 6, y - 10, 4, 10, ["#a83a3a", "#3a6aa8", "#e8c84a", "#5a8a4a"][j]);
        }
      } else if (k < 0.75) {
        rect(g, x - 16, 70, 32, 40, "#d8d0c0");
        rect(g, x - 14, 72, 28, 36, "#1a2440");
        rect(g, x - 1, 72, 2, 36, "#d8d0c0");
      }
    } else if (theme === "crypt" || theme === "vault") {
      if (k < 0.4) {
        rect(g, x - 1, 190, 2, 24, "#3a2a1e");
        rect(g, x - 1, 182, 2, 8, "#f4ecd8");
      }
    } else if (theme === "archive") {
      rect(g, x - 20, 120, 40, 94, "#4a4a50");
      for (let y = 124; y < 210; y += 16) {
        rect(g, x - 18, y, 36, 14, "#5a5a62");
        rect(g, x - 2, y + 6, 4, 2, "#c8c8d0");
      }
    } else if (theme === "security") {
      rect(g, x - 30, 176, 60, 38, "#2a2e34");
      for (let j = 0; j < 3; j++) {
        rect(g, x - 28 + j * 20, 150, 18, 14, "#1a1e24");
        rect(g, x - 27 + j * 20, 151, 16, 12, "#2a4a3a");
      }
    } else if (theme === "cells") {
      rect(g, x - 26, 60, 52, 90, "#5a6066");
      for (let j = 0; j < 7; j++) rect(g, x - 24 + j * 8, 62, 2, 86, "#8a9096");
      g.fillStyle = "rgba(30,40,50,0.6)";
      g.beginPath();
      g.ellipse(x, 116, 5, 6, 0, 0, Math.PI * 2);
      g.fill();
      rect(g, x - 7, 122, 14, 22, "rgba(30,40,50,0.6)");
    } else if (theme === "staff" || theme === "lobby") {
      // 사무실 장식: 화분 · 정수기 · 의자 · 휴지통 · 사훈 액자 · 블라인드 창 · 벽시계
      const pick = Math.floor(r() * 7);
      const kinds: PropKind[] = ["tallplant", "cooler", "chair", "bin", "motto", "blinds", "clock"];
      drawProp(g, kinds[pick], x, r);
      if (pick === 2) drawProp(g, "bin", x + 14, r);
      if (theme === "staff" && k < 0.3) for (let j = 0; j < 4; j++) {
        rect(g, x - 24 + j * 12, 140, 11, 74, "#5a6a7a");
        rect(g, x - 22 + j * 12, 150, 7, 1, "#3a4a5a");
        rect(g, x - 22 + j * 12, 154, 7, 1, "#3a4a5a");
      }
    }
  };
  const taken = [...doors.map((d) => d.x), ...props.map((q) => q[1])];
  for (let x = 60; x < width - 40; x += 70 + r() * 40) if (taken.every((dx) => Math.abs(dx - x) > 40)) randomProp(x);
  for (const [kind, px] of props) drawProp(g, kind, px, r);
  // 문
  for (const d of doors) {
    if (d.kind === "door") woodDoor(g, d.x, d.label, theme === "staff" || theme === "security" || theme === "archive" ? "#6a7a8a" : "#5a3828");
    else if (d.kind === "stairs") {
      woodDoor(g, d.x, undefined, "#4a4a52");
      rect(g, d.x - 12, 128, 24, 8, "#2a8a3a");
      smallText(g, d.label ?? "계단", d.x, 132, "#ffffff", 6);
    } else if (d.kind === "elevator") {
      rect(g, d.x - 18, 140, 36, 74, "#5a5e66");
      rect(g, d.x - 16, 144, 15, 70, "#a8b0b8");
      rect(g, d.x + 1, 144, 15, 70, "#a8b0b8");
      rect(g, d.x - 8, 130, 16, 8, "#1a1a1a");
      rect(g, d.x + 22, 170, 4, 8, "#3a3a3a");
    } else if (d.kind === "grate") {
      rect(g, d.x - 18, 150, 36, 64, "#1a1a1a");
      for (let j = 0; j < 7; j++) rect(g, d.x - 16 + j * 5.2, 150, 1.5, 64, "#6a5a4a");
      for (let y = 160; y < 214; y += 14) rect(g, d.x - 18, y, 36, 1.5, "#6a5a4a");
    } else if (d.kind === "arch") {
      g.fillStyle = "#0e0a08";
      g.beginPath();
      g.moveTo(d.x - 18, 214);
      g.lineTo(d.x - 18, 160);
      g.quadraticCurveTo(d.x, 136, d.x + 18, 160);
      g.lineTo(d.x + 18, 214);
      g.fill();
    } else if (d.kind === "window") {
      rect(g, d.x - 18, 100, 36, 50, "#d8d0c0");
      rect(g, d.x - 16, 102, 32, 46, "#3a1a14");
      vgrad(g, d.x - 16, 102, 32, 148, [[0, "#1a0a10"], [1, "#a8401a"]]);
      for (let k = 0; k < 6; k++) rect(g, d.x - 16 + k * 6, 132, 1, 16, "#0a0a10");
      rect(g, d.x - 1, 102, 2, 46, "#d8d0c0");
    } else if (d.kind === "steel") {
      rect(g, d.x - 18, 140, 36, 74, "#4a5058");
      rect(g, d.x - 16, 142, 32, 72, "#6a7480");
      rect(g, d.x - 16, 142, 32, 1, "#8a949e");
      for (let j = 0; j < 6; j++) rect(g, d.x - 14 + j * 5.6, 146, 1, 1, "#3a4048");
      rect(g, d.x + 20, 170, 6, 10, "#1a1e24");
      rect(g, d.x + 21, 172, 4, 2, "#c83a3a");
      if (d.label) {
        rect(g, d.x - 14, 128, 28, 9, "#c8a83a");
        smallText(g, d.label, d.x, 132.5, "#1a1a1a", 6);
      }
    }
  }
  return pixelize(c, c.width / BG_SCALE, c.height / BG_SCALE, { opaque: true });
}

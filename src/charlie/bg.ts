// 배경: 뉴욕 거리 · 찰리의 집 · 냉장고 · 골목
import { FONT, GROUND, H } from "./core";
import { makeDense, mix, rng } from "./pixel";

/** 배경은 논리 좌표의 4배 밀도로 칠한다 (1/4 칸 = 1도트) */
export const BG_SCALE = 4;

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
    vgrad(g, x + 1, y + 1, w - 2, y + h - 1, [[0, "#ffd86a"], [0.5, "#ff7a1a"], [1, "#a82a10"]]);
    rect(g, x + 1, y + 1, w - 2, 3, "#2a1410");
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

function poster(g: G, x: number, y: number, w: number, h: number, paper: string, ink: string, lines: string[], r: () => number): void {
  rect(g, x + 1, y + 1, w, h, "#00000055");
  rect(g, x, y, w, h, paper);
  for (let i = 0; i < 3; i++) rect(g, x + Math.floor(r() * w), y + h - 1 - Math.floor(r() * 3), 2, 2, "#00000033");
  lines.forEach((l, i) => smallText(g, l, x + w / 2, y + 8 + i * 10, ink));
  rect(g, x + w / 2 - 1, y + 1, 2, 2, "#c0c0c0");
}

function graffiti(g: G, x: number, y: number, w: number, r: () => number): void {
  const cols = ["#d84a8a", "#4ac0d8", "#e8d04a", "#8a4ad8", "#4ad86a", "#e86a3a"];
  for (let i = 0; i < 5; i++) {
    g.strokeStyle = cols[Math.floor(r() * cols.length)];
    g.lineWidth = 2;
    g.beginPath();
    const sx = x + r() * w;
    const sy = y + r() * 14;
    g.moveTo(sx, sy);
    for (let k = 0; k < 4; k++) g.lineTo(sx + (r() - 0.3) * 26, sy + (r() - 0.5) * 14);
    g.stroke();
  }
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

  // 건물 줄
  const facades: Array<"brick" | "shop" | "blue" | "brown"> = [];
  let x = 0;
  const apt = { x: 30, w: 260 };
  // 찰리의 아파트 (브라운스톤)
  if (home) {
    drawBrownstone(g, apt.x, apt.w, after, r);
    info.door = apt.x + apt.w / 2;
    x = apt.x + apt.w + 6;
  } else {
    x = 0;
  }
  let posterIdx = 0;
  let k = 0;
  while (x < width - 40) {
    const kind = k === 1 ? "shop" : (["brick", "shop", "blue", "brick", "brown"] as const)[Math.floor(r() * 5)];
    facades.push(kind);
    const w = kind === "shop" ? 150 : 130 + Math.floor(r() * 60);
    const top = 30 + Math.floor(r() * 40);
    const isBodega = k === 1;
    drawFacade(g, x, w, top, kind, after, r, info, isBodega);
    // 포스터
    if (posterIdx < POSTERS.length && kind !== "shop") {
      const [lines, paper, ink, label] = POSTERS[posterIdx++];
      const px = x + 20 + Math.floor(r() * (w - 80));
      poster(g, px, 156, 44, 36, paper, ink, lines, r);
      info.posters.push({ x: px + 22, text: label });
    }
    x += w + 6;
    k++;
  }

  // 인도 · 도로
  rect(g, 0, 200, width, 22, after ? "#5a4a48" : "#6a6670");
  for (let sx = 0; sx < width; sx += 24) rect(g, sx, 200, 1, 22, after ? "#4a3a38" : "#58545e");
  rect(g, 0, 210, width, 1, after ? "#4a3a38" : "#5a5662");
  rect(g, 0, 222, width, 4, after ? "#8a7a74" : "#9a96a0");
  rect(g, 0, 226, width, H - 226, after ? "#2a2224" : "#2c2c34");
  for (let sx = 0; sx < width; sx += 40) rect(g, sx, 250, 20, 2, after ? "#8a6a30" : "#c8a83a");
  for (let i = 0; i < width / 30; i++) rect(g, Math.floor(r() * width), 228 + Math.floor(r() * 40), 3, 1, "#1e1e24");

  // 소품: 가로등, 소화전, 볼라드, 쓰레기통, 대형 쓰레기통
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
  for (let dx = 620; dx < width - 120; dx += 380 + Math.floor(r() * 120)) {
    info.dumpsters.push(dx + 20);
    rect(g, dx, 186, 40, 26, after ? "#2a4a34" : "#2e5a3c");
    rect(g, dx - 2, 183, 44, 4, after ? "#1e3426" : "#22442e");
    rect(g, dx + 4, 192, 32, 1, "#1e3426");
    rect(g, dx + 2, 210, 4, 3, "#111");
    rect(g, dx + 34, 210, 4, 3, "#111");
    graffiti(g, dx + 4, 194, 30, r);
  }
  for (let i = 0; i < width / 140; i++) {
    const tx = Math.floor(r() * width);
    rect(g, tx, 204, 9, 8, "#1e1e22");
    rect(g, tx + 2, 202, 6, 3, "#2a2a30");
  }

  if (after) {
    // 잔해, 균열, 부서진 차
    for (let i = 0; i < width / 25; i++) rect(g, Math.floor(r() * width), 205 + Math.floor(r() * 18), 2 + Math.floor(r() * 4), 2, r() < 0.5 ? "#6a5a50" : "#3a3030");
    for (let i = 0; i < width / 120; i++) {
      g.strokeStyle = "#1a1416";
      g.lineWidth = 1;
      g.beginPath();
      let cx = r() * width;
      let cy = 228 + r() * 30;
      g.moveTo(cx, cy);
      for (let s = 0; s < 5; s++) {
        cx += (r() - 0.3) * 14;
        cy += (r() - 0.5) * 6;
        g.lineTo(cx, cy);
      }
      g.stroke();
    }
    const carX = 820;
    drawCar(g, carX, 228, true);
    info.fires.push({ x: carX + 14, y: 220, w: 22, h: 12 });
  } else {
    drawCar(g, 700, 230, false);
  }
  return info;
}

function drawCar(g: G, x: number, y: number, wrecked: boolean): void {
  const body = wrecked ? "#3a2a2a" : "#5a6a8a";
  rect(g, x, y + 8, 70, 14, body);
  rect(g, x + 12, y, 40, 10, body);
  rect(g, x + 15, y + 2, 15, 7, wrecked ? "#101014" : "#8aa8c8");
  rect(g, x + 33, y + 2, 15, 7, wrecked ? "#101014" : "#8aa8c8");
  rect(g, x + 8, y + 20, 12, 10, "#111");
  rect(g, x + 50, y + 20, 12, 10, "#111");
  rect(g, x + 66, y + 10, 4, 4, wrecked ? "#3a2a2a" : "#ffe8a0");
  if (wrecked) {
    rect(g, x + 20, y + 8, 16, 3, "#1a1414");
    rect(g, x + 40, y + 12, 10, 2, "#1a1414");
  }
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
  for (let s = 0; s < 6; s++) {
    const sy = 176 + s * 6;
    rect(g, dx - 26 - s * 2, sy, 52 + s * 4, 6, s % 2 ? "#a89880" : "#b8a890");
    rect(g, dx - 26 - s * 2, sy, 52 + s * 4, 1, "#d8c8a8");
  }
  // 난간
  g.strokeStyle = "#14141a";
  g.lineWidth = 2;
  for (const side of [-1, 1]) {
    g.beginPath();
    g.moveTo(dx + side * 26, 166);
    g.lineTo(dx + side * 40, 202);
    g.stroke();
    for (let k = 0; k < 5; k++) rect(g, dx + side * (27 + k * 3), 168 + k * 7, 1, 10, "#14141a");
  }
}

function drawFacade(g: G, x: number, w: number, top: number, kind: "brick" | "shop" | "blue" | "brown", after: boolean, r: () => number, info: StreetInfo, bodega: boolean): void {
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
      graffiti(g, x + 10, 168, w - 20, r);
      graffiti(g, x + 30, 178, w - 60, r);
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
    if (r() < 0.6) graffiti(g, dx + 30, 170, Math.min(70, w - (dx - x) - 40), r);
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
  return c;
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
  return c;
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
  return c;
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
  return c;
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
  return c;
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
  return c;
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
  return c;
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
  return c;
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
  return c;
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
  return c;
}

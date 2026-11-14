// 배경: 뉴욕 거리 · 찰리의 집 · 냉장고 · 골목
import { FONT, GROUND, H } from "./core";
import { makeCanvas, mix, rng } from "./pixel";

type G = CanvasRenderingContext2D;

function vgrad(g: G, x: number, y0: number, w: number, y1: number, stops: Array<[number, string]>): void {
  const gr = g.createLinearGradient(0, y0, 0, y1);
  for (const [k, c] of stops) gr.addColorStop(k, c);
  g.fillStyle = gr;
  g.fillRect(x, y0, w, y1 - y0);
}

function rect(g: G, x: number, y: number, w: number, h: number, c: string): void {
  g.fillStyle = c;
  g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

/** 벽돌: 한 장마다 위쪽 빛, 오른쪽 그림자, 얼룩 */
function bricks(g: G, x: number, y: number, w: number, h: number, base: string, mortar: string, vary: string[], r: () => number): void {
  rect(g, x, y, w, h, mortar);
  for (let by = 0; by < h; by += 4) {
    const off = (by / 4) % 2 ? 4 : 0;
    const bh = Math.min(3, h - by);
    for (let bx = -off; bx < w; bx += 8) {
      const cx = Math.max(0, bx);
      const cw = Math.min(w, bx + 7) - cx;
      if (cw <= 0) continue;
      const col = r() < 0.3 ? vary[Math.floor(r() * vary.length)] : base;
      rect(g, x + cx, y + by, cw, bh, col);
      rect(g, x + cx, y + by, cw, 1, mix(col, 0.1));
      if (bx + 6 < w && bx + 6 >= 0) rect(g, x + bx + 6, y + by + 1, 1, bh - 1, mix(col, -0.15));
      if (bh === 3) rect(g, x + cx, y + by + 2, cw, 1, mix(col, -0.06));
      if (r() < 0.35) rect(g, x + cx + Math.floor(r() * cw), y + by + 1, 1, 1, mix(col, -0.22));
      if (r() < 0.06) rect(g, x + cx, y + by, 1, 1, mortar);
    }
    rect(g, x, y + by + 3, w, 1, mix(mortar, -0.12));
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
  rect(g, x - 3, y - 5, w + 6, 1, lt);
  rect(g, x - 3, y - 2, w + 6, 1, dk);
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
    for (let i = 0; i < 4; i++) g.fillRect(x + 3 + i, y + h - 4 - i * 2, 1, 2);
    g.fillRect(x + w - 6, y + 2, 1, 3);
    if (r() < 0.3) for (let by = y + 1; by < y + h / 2; by += 2) rect(g, x + 1, by, w - 2, 1, "#5a5e6a");
  }
  // 창틀
  rect(g, x + Math.floor(w / 2), y, 1, h, frame);
  rect(g, x, y + Math.floor(h / 2), w, 1, frame);
  rect(g, x, y, w, 1, dk);
  // 창턱 + 그림자
  rect(g, x - 2, y + h, w + 4, 2, frame);
  rect(g, x - 2, y + h, w + 4, 1, lt);
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

export function buildStreet(width: number, after: boolean, seed: number): StreetInfo {
  const c = makeCanvas(width, H);
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
  drawBrownstone(g, apt.x, apt.w, after, r);
  info.door = apt.x + apt.w / 2;
  x = apt.x + apt.w + 6;
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
  const c = makeCanvas(W2, H);
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
  rect(g, x, y, w, 1, mix(col, 0.18));
  rect(g, x, y, 1, h, mix(col, 0.1));
  rect(g, x + w - 1, y + 1, 1, h - 1, mix(col, -0.25));
  rect(g, x + 1, y + h - 1, w - 1, 1, mix(col, -0.3));
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
  const c = makeCanvas(480, H);
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
  const c = makeCanvas(ALLEY.width, H);
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

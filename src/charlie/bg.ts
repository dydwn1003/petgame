// 배경: 뉴욕 거리 · 찰리의 집 · 냉장고 · 골목
import { FONT, GROUND, H } from "./core";
import { makeCanvas, rng } from "./pixel";

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

function bricks(g: G, x: number, y: number, w: number, h: number, base: string, mortar: string, vary: string[], r: () => number): void {
  rect(g, x, y, w, h, mortar);
  for (let by = 0; by < h; by += 4) {
    const off = (by / 4) % 2 ? 4 : 0;
    for (let bx = -off; bx < w; bx += 8) {
      const cx = Math.max(0, bx);
      const cw = Math.min(w, bx + 7) - cx;
      if (cw <= 0) continue;
      rect(g, x + cx, y + by, cw, Math.min(3, h - by), r() < 0.25 ? vary[Math.floor(r() * vary.length)] : base);
    }
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
  rect(g, x - 2, y - 3, w + 4, 3, frame);
  rect(g, x - 1, y + h, w + 2, 2, frame);
  rect(g, x, y, w, h, "#2a2a36");
  if (state === "lit") {
    vgrad(g, x + 1, y + 1, w - 2, y + h - 1, [[0, "#ffd88a"], [1, "#d88a3a"]]);
    if (r() < 0.5) rect(g, x + 2 + Math.floor(r() * (w - 8)), y + h - 9, 4, 8, "#5a3a2a");
  } else if (state === "fire") {
    vgrad(g, x + 1, y + 1, w - 2, y + h - 1, [[0, "#ffcf5a"], [0.6, "#ff6a1a"], [1, "#a82a10"]]);
  } else if (state === "broken") {
    rect(g, x + 1, y + 1, w - 2, h - 2, "#101016");
    g.fillStyle = "#8a9aaa";
    for (let i = 0; i < 4; i++) {
      const sx = x + 1 + Math.floor(r() * (w - 3));
      g.fillRect(sx, y + 1, 1, 2 + Math.floor(r() * 5));
    }
  } else {
    vgrad(g, x + 1, y + 1, w - 2, y + h - 1, [[0, "#3a4a6a"], [1, "#1e2436"]]);
    rect(g, x + 2, y + 2, 2, h - 6, "#4a5a7a");
  }
  rect(g, x + Math.floor(w / 2), y, 1, h, frame);
  rect(g, x, y + Math.floor(h / 2), w, 1, frame);
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
  rect(g, x - 3, top - 4, w + 6, 4, dim("#c8b8a0"));
  const floors = Math.floor((150 - top) / 34);
  for (let fl = 0; fl < floors; fl++) {
    for (let wx = x + 12; wx < x + w - 24; wx += 34) {
      const st = after ? (r() < 0.25 ? "fire" : r() < 0.4 ? "broken" : "dark") : r() < 0.3 ? "lit" : "dark";
      const wy = top + 10 + fl * 34;
      windowAt(g, wx, wy, 20, 22, st, r);
      if (st === "fire") info.fires.push({ x: wx + 1, y: wy + 1, w: 18, h: 20 });
    }
  }
  if (kind !== "shop" && r() < 0.7) fireEscape(g, x + w / 2 - 22, 44, top + 34, floors, 34);
  rect(g, x, 150, w, 3, dim("#c8b8a0"));

  if (kind === "shop") {
    // 1층 가게
    rect(g, x + 6, 156, w - 12, 44, "#1a1a20");
    if (bodega) {
      info.bodega = x + w / 2;
      rect(g, x + 4, 152, w - 8, 14, after ? "#3a2020" : "#c83a2a");
      smallText(g, "DELI & GROCERY 24H", x + w / 2, 159, after ? "#8a6a5a" : "#fff0c8");
      rect(g, x + 14, 168, w - 28, 30, after ? "#101014" : "#ffe8a0");
      if (!after) {
        for (let i = 0; i < 8; i++) rect(g, x + 18 + i * 14, 178, 10, 4, ["#c83a2a", "#3a8ac8", "#e8c83a", "#4ab84a"][i % 4]);
        for (let i = 0; i < 8; i++) rect(g, x + 18 + i * 14, 188, 10, 4, ["#e8e0d0", "#8a5a3a", "#3a3a3a", "#d87a3a"][i % 4]);
      } else {
        for (let i = 0; i < 10; i++) rect(g, x + 16 + Math.floor(r() * (w - 36)), 170 + Math.floor(r() * 26), 4, 1, "#8a9aaa");
        rect(g, x + 20, 194, w - 40, 4, "#2a2020");
      }
    } else {
      for (let sx = x + 8; sx < x + w - 8; sx += 3) rect(g, sx, 158, 2, 42, after ? "#4a4a50" : "#6a6a74");
      graffiti(g, x + 10, 168, w - 20, r);
      graffiti(g, x + 30, 178, w - 60, r);
      const names = ["PIZZA", "LAUNDRY", "VINYL", "REPAIR", "NAILS"];
      rect(g, x + 4, 152, w - 8, 6, after ? "#2a2a30" : "#e8d8a0");
      smallText(g, names[Math.floor(r() * names.length)], x + w / 2, 155, "#2a2a30", 6);
    }
  } else {
    // 현관문
    const dx = x + 14 + Math.floor(r() * (w - 60));
    rect(g, dx, 162, 22, 38, dim("#2a1e2a"));
    rect(g, dx + 17, 180, 2, 3, "#c8a83a");
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

  // 현관문
  rect(g, 18, 110, 42, 104, "#2a1a12");
  rect(g, 22, 114, 34, 100, "#4a2e1c");
  rect(g, 26, 120, 26, 36, "#3e2616");
  rect(g, 26, 162, 26, 46, "#3e2616");
  rect(g, 50, 164, 3, 4, "#c8a83a");
  // 창문 1 + 라디에이터
  roomWindow(g, 82, 58, 60, 88, r);
  rect(g, 86, 168, 52, 36, "#8a8a92");
  for (let k = 0; k < 52; k += 5) rect(g, 86 + k, 170, 3, 32, "#a8a8b0");
  rect(g, 84, 166, 56, 3, "#6a6a72");
  // 창문 2 (책상 위, 샘이 나가는 창)
  roomWindow(g, 178, 52, 64, 82, r);
  // 책상 + 모니터 + 의자 + 스탠드
  rect(g, 168, 168, 86, 5, "#6a4a2a");
  rect(g, 170, 173, 4, 41, "#4a3220");
  rect(g, 248, 173, 4, 41, "#4a3220");
  rect(g, 226, 173, 22, 22, "#5a3e24");
  rect(g, 228, 182, 18, 1, "#3a2818");
  rect(g, 188, 144, 30, 20, "#1a1a20");
  rect(g, 190, 146, 26, 16, "#2a4a6a");
  rect(g, 201, 164, 4, 4, "#1a1a20");
  rect(g, 182, 166, 26, 2, "#2a2a30");
  rect(g, 232, 150, 2, 18, "#2a2a30");
  rect(g, 228, 146, 10, 5, "#c8b86a");
  for (let i = 0; i < 5; i++) rect(g, 172 + i * 3, 162 - i, 8, 3, ["#e8e0d0", "#d0c8b0", "#e8e0d0"][i % 3]);
  // 의자
  rect(g, 194, 180, 22, 4, "#2a2a30");
  rect(g, 212, 160, 4, 22, "#2a2a30");
  rect(g, 203, 184, 3, 24, "#1a1a20");
  rect(g, 196, 208, 18, 2, "#1a1a20");
  // 책장 (벽)
  rect(g, 268, 78, 70, 3, "#4a3220");
  for (let i = 0; i < 12; i++) rect(g, 270 + i * 5, 62 + Math.floor(r() * 4), 4, 16 - Math.floor(r() * 4), ["#8a2a2a", "#2a4a8a", "#c8a83a", "#3a6a3a", "#6a3a6a"][i % 5]);
  rect(g, 326, 66, 8, 12, "#d8d0c0");
  // 안락의자
  armchair(g, ROOM.armchair);
  // 스탠드 조명
  rect(g, ROOM.lamp, 124, 2, 90, "#1a1a20");
  rect(g, ROOM.lamp - 6, 210, 14, 4, "#1a1a20");
  g.fillStyle = "#d8c89a";
  g.beginPath();
  g.moveTo(ROOM.lamp - 9, 128);
  g.lineTo(ROOM.lamp + 11, 128);
  g.lineTo(ROOM.lamp + 6, 114);
  g.lineTo(ROOM.lamp - 4, 114);
  g.fill();
  // 샹들리에
  rect(g, 470, 14, 1, 16, "#2a2a30");
  rect(g, 458, 30, 26, 2, "#2a2a30");
  for (const lx of [458, 470, 482]) {
    rect(g, lx, 26, 2, 4, "#2a2a30");
    rect(g, lx - 1, 22, 4, 4, "#fff0b0");
  }
  // 액자
  rect(g, 386, 70, 40, 30, "#2a1a12");
  rect(g, 389, 73, 34, 24, "#c8b890");
  rect(g, 392, 84, 28, 10, "#6a8a5a");
  // 침대
  rect(g, 368, 150, 6, 64, "#3a2414");
  rect(g, 372, 186, 110, 18, "#6a4a3a");
  rect(g, 372, 176, 108, 12, "#c8c0b8");
  rect(g, 376, 170, 24, 10, "#e8e0d8");
  g.fillStyle = "#4a5a8a";
  g.beginPath();
  g.moveTo(400, 174);
  g.lineTo(482, 172);
  g.lineTo(486, 198);
  g.lineTo(420, 200);
  g.lineTo(404, 188);
  g.fill();
  rect(g, 440, 180, 20, 6, "#3a4a7a");
  rect(g, 372, 204, 4, 10, "#3a2414");
  rect(g, 478, 204, 4, 10, "#3a2414");
  // 옷장
  rect(g, 504, 90, 54, 124, "#3a2416");
  rect(g, 507, 94, 23, 112, "#4e3220");
  rect(g, 532, 94, 23, 112, "#4e3220");
  rect(g, 527, 146, 2, 6, "#c8a83a");
  rect(g, 533, 146, 2, 6, "#c8a83a");
  rect(g, 512, 86, 20, 6, "#6a5a4a");
  rect(g, 536, 80, 14, 12, "#8a6a4a");
  // 냉장고
  rect(g, 584, 108, 44, 106, "#c8ccd0");
  rect(g, 584, 108, 44, 2, "#e8ecf0");
  rect(g, 584, 146, 44, 2, "#8a8e94");
  rect(g, 622, 116, 2, 22, "#8a8e94");
  rect(g, 622, 156, 2, 30, "#8a8e94");
  for (const [mx, my, mc] of [[592, 120, "#e84a4a"], [604, 126, "#4a8ae8"], [596, 164, "#e8c84a"], [610, 160, "#ffffff"]] as const) rect(g, mx, my, 6, 6, mc);
  // 코트걸이
  rect(g, ROOM.coat, 120, 3, 94, "#2a1a12");
  rect(g, ROOM.coat - 8, 210, 19, 4, "#2a1a12");
  rect(g, ROOM.coat - 8, 124, 8, 34, "#5a4a3a");
  rect(g, ROOM.coat + 3, 126, 9, 28, "#3a4a5a");
  // 어질러진 것들
  rect(g, 60, 206, 26, 8, "#8a8a7a");
  rect(g, 62, 204, 22, 3, "#a8a898");
  rect(g, 340, 208, 22, 6, "#6a4a7a");
  rect(g, 350, 205, 14, 4, "#3a6a8a");
  rect(g, 488, 208, 26, 4, "#c8a870");
  rect(g, 490, 206, 22, 2, "#d8b880");
  rect(g, 566, 208, 8, 6, "#e8e0d8");
  rect(g, 567, 208, 6, 2, "#8a5a3a");
  rect(g, 646, 208, 18, 6, "#2a2a30");
  // 카펫
  rect(g, 300, 214, 170, 4, "#7a2a2a");
  rect(g, 300, 218, 170, 2, "#9a4a3a");
  return c;
}

function roomWindow(g: G, x: number, y: number, w: number, h: number, r: () => number): void {
  rect(g, x - 4, y - 4, w + 8, h + 8, "#d8d0c0");
  vgrad(g, x, y, w, y + h, [[0, "#0a0e1e"], [1, "#22284a"]]);
  for (let i = 0; i < 6; i++) {
    const bx = x + Math.floor(r() * (w - 10));
    const bh = 20 + Math.floor(r() * 50);
    rect(g, bx, y + h - bh, 10 + Math.floor(r() * 10), bh, "#141a30");
    for (let k = 0; k < 5; k++) if (r() < 0.6) rect(g, bx + 2 + Math.floor(r() * 6), y + h - bh + 4 + k * 8, 2, 2, "#e8c070");
  }
  // 비상계단 창살
  for (let k = 0; k < w; k += 5) rect(g, x + k, y + h - 20, 1, 20, "#0a0a10");
  rect(g, x, y + h - 21, w, 2, "#0a0a10");
  rect(g, x + w / 2 - 1, y, 2, h, "#d8d0c0");
  rect(g, x, y + h / 2 - 1, w, 2, "#d8d0c0");
  // 커튼
  rect(g, x - 10, y - 8, 10, h + 14, "#6a1e1e");
  rect(g, x + w, y - 8, 10, h + 14, "#6a1e1e");
  rect(g, x - 8, y - 8, 2, h + 14, "#8a2a2a");
  rect(g, x + w + 4, y - 8, 2, h + 14, "#8a2a2a");
  rect(g, x - 12, y - 10, w + 24, 3, "#2a1a12");
}

function armchair(g: G, x: number): void {
  rect(g, x - 24, 156, 10, 50, "#5a2a2a");
  rect(g, x - 20, 182, 44, 14, "#6a3232");
  rect(g, x - 22, 176, 8, 22, "#4a2222");
  rect(g, x + 22, 176, 8, 22, "#4a2222");
  rect(g, x - 20, 196, 48, 6, "#4a2222");
  rect(g, x - 20, 202, 4, 12, "#2a1a12");
  rect(g, x + 22, 202, 4, 12, "#2a1a12");
}

// ── 냉장고 안 ────────────────────────────────────────────
export const FRIDGE_SPOTS = {
  beer: { x: 120, y: 92 },
  energy: { x: 232, y: 92 },
  fish: { x: 356, y: 120 },
  meat: { x: 330, y: 170 },
  catfood: { x: 120, y: 170 },
  sausage: { x: 220, y: 238 },
};

export function buildFridge(): HTMLCanvasElement {
  const c = makeCanvas(480, H);
  const g = c.getContext("2d")!;
  rect(g, 0, 0, 480, H, "#c8ccd0");
  rect(g, 30, 14, 420, 246, "#e8f0f4");
  vgrad(g, 34, 18, 412, 256, [[0, "#f4fbff"], [1, "#c8dce6"]]);
  rect(g, 34, 108, 412, 5, "#d8e4ea");
  rect(g, 34, 186, 412, 5, "#d8e4ea");
  rect(g, 34, 112, 412, 1, "#9ab0bc");
  rect(g, 34, 190, 412, 1, "#9ab0bc");
  rect(g, 214, 18, 50, 6, "#ffffff");
  // 맥주 캔 줄
  for (let i = 0; i < 7; i++) {
    const bx = 60 + i * 18;
    rect(g, bx, 72, 14, 36, i % 2 ? "#c8352a" : "#b42a22");
    rect(g, bx, 72, 14, 3, "#d8d8e0");
    rect(g, bx + 3, 84, 8, 12, "#f0e0a0");
    rect(g, bx + 1, 76, 2, 30, "#e85a4a");
  }
  // 에너지 드링크
  for (let i = 0; i < 4; i++) {
    const bx = 196 + i * 18;
    rect(g, bx, 66, 13, 42, "#1a1a20");
    rect(g, bx, 66, 13, 3, "#c8c8d0");
    rect(g, bx + 3, 76, 7, 18, "#4ae84a");
  }
  // 매달린 생선 (이상한 보관법)
  rect(g, 356, 18, 1, 40, "#8a8a8a");
  rect(g, 380, 18, 1, 34, "#8a8a8a");
  for (const [fx, fy] of [[350, 58], [374, 52]] as const) {
    rect(g, fx, fy, 14, 58, "#7a8a9a");
    rect(g, fx + 2, fy + 4, 10, 50, "#a8b8c8");
    rect(g, fx + 4, fy + 8, 2, 2, "#1a1a1a");
    rect(g, fx - 2, fy + 54, 18, 8, "#6a7a8a");
  }
  // 정체불명의 고기
  g.fillStyle = "#e8e8f0";
  g.beginPath();
  g.ellipse(330, 178, 46, 8, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#a85a3a";
  g.beginPath();
  g.ellipse(330, 166, 30, 14, 0, 0, Math.PI * 2);
  g.fill();
  rect(g, 310, 150, 4, 10, "#a85a3a");
  rect(g, 346, 150, 4, 10, "#a85a3a");
  rect(g, 318, 160, 24, 3, "#c87a5a");
  // 고양이 통조림 탑
  for (let i = 0; i < 4; i++) for (let k = 0; k < 3 - (i > 1 ? 1 : 0); k++) {
    const bx = 82 + k * 22 + (i > 1 ? 11 : 0);
    const by = 170 - Math.floor(i / 2) * 16 - (i % 2) * 0;
    rect(g, bx, by, 20, 14, "#e8c83a");
    rect(g, bx, by, 20, 2, "#c8c8d0");
    rect(g, bx + 6, by + 5, 8, 5, "#ffffff");
  }
  // 매달린 소시지
  rect(g, 120, 196, 200, 2, "#8a8a8a");
  for (let i = 0; i < 9; i++) {
    const sx = 126 + i * 22;
    rect(g, sx + 4, 198, 1, 8 + (i % 3) * 3, "#8a8a8a");
    rect(g, sx, 206 + (i % 3) * 3, 10, 30, "#8a3a2a");
    rect(g, sx + 2, 208 + (i % 3) * 3, 2, 24, "#a85a3a");
  }
  // 메모
  rect(g, 400, 200, 36, 30, "#fff8a0");
  smallText(g, "샘 밥", 418, 210, "#2a2a2a");
  smallText(g, "잊지마", 418, 222, "#2a2a2a");
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

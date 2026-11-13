// 도트 스프라이트 (몬스터 · 사람 · 타일) — 문자열 지도를 캔버스로 굽는다

type Palette = Record<string, string>;

function bake(rows: string[], pal: Palette, size = 16): HTMLCanvasElement {
  const c = document.createElement("canvas");
  const w = Math.max(size, ...rows.map((r) => Math.min(r.length, size)));
  c.width = w;
  c.height = size;
  const g = c.getContext("2d")!;
  rows.slice(0, size).forEach((row, y) => {
    for (let x = 0; x < Math.min(row.length, w); x++) {
      const col = pal[row[x]];
      if (!col) continue;
      g.fillStyle = col;
      g.fillRect(x, y, 1, 1);
    }
  });
  return c;
}

// ── 마법사 (위에서 내려다본 모습) ───────────────────────
export type Facing = "down" | "up" | "side";

const WIZ_DOWN = [
  ".....HH.....",
  "....HHHH....",
  "...HHHHHH...",
  ".HHHHHHHHHH.",
  "..hSSSSSSh..",
  "...SESSES...",
  "...SSSSSS...",
  "..RRRRRRRR..",
  ".SRRRTTRRRS.",
  ".SRRRTTRRRS.",
  "..RRRTTRRR..",
  "..RRRTTRRR..",
  "..RRRRRRRR..",
  "..RR....RR..",
  "..BB....BB..",
];
const WIZ_UP = WIZ_DOWN.map((r, i) =>
  i === 4 ? "..hhhhhhhh.." : i === 5 || i === 6 ? "...hhhhhh..." : i >= 8 && i <= 11 ? r.replace(/T/g, "R") : r,
);
const WIZ_SIDE = WIZ_DOWN.map((r, i) =>
  i === 4 ? "..hhSSSSS..." : i === 5 ? "..hhSSSES..." : i === 6 ? "...hSSSS...." : i === 8 ? ".RRRRTTRRSW." : i === 9 ? ".RRRRTTRR.W." : r,
);
const WALK = (rows: string[]) =>
  rows.map((r, i) => (i === 12 ? "..RRRRRRRR.." : i === 13 ? "...RR..RR..." : i === 14 ? "...BB..BB..." : r));

export interface LookPal {
  hat: string;
  robe: string;
  trim: string;
  hair: string;
}

const wizCache = new Map<string, HTMLCanvasElement>();
export function wizardSprite(look: LookPal, face: Facing, walk: boolean): HTMLCanvasElement {
  const key = `${look.hat}${look.robe}${look.trim}${look.hair}_${face}_${walk}`;
  let c = wizCache.get(key);
  if (!c) {
    const base = face === "up" ? WIZ_UP : face === "side" ? WIZ_SIDE : WIZ_DOWN;
    c = bake(walk ? WALK(base) : base, {
      H: look.hat,
      h: look.hair,
      S: "#f2c9a0",
      E: "#1a1a1a",
      R: look.robe,
      T: look.trim,
      B: "#2a1a14",
      W: "#a07040",
    }, 15);
    wizCache.set(key, c);
  }
  return c;
}

export function wizardDataUrl(look: LookPal, scale = 4): string {
  const s = wizardSprite(look, "down", false);
  const c = document.createElement("canvas");
  c.width = s.width * scale;
  c.height = s.height * scale;
  const g = c.getContext("2d")!;
  g.imageSmoothingEnabled = false;
  g.drawImage(s, 0, 0, c.width, c.height);
  return c.toDataURL();
}

// ── 타일 ────────────────────────────────────────────────
export const T = {
  GRASS: 0,
  TALL: 1,
  TREE: 2,
  WATER: 3,
  PATH: 4,
  SAND: 5,
  ROCK: 6,
  WALL: 7,
  ROOF: 8,
  FOUNTAIN: 9,
  FLOWER: 10,
  FOREST: 11,
  DIRT: 12,
  STONE: 13,
  PILLAR: 14,
  DOOR: 15,
} as const;

export const SOLID = new Set<number>([T.TREE, T.WATER, T.ROCK, T.WALL, T.ROOF, T.FOUNTAIN, T.PILLAR, T.DOOR]);

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function tileCanvas(draw: (g: CanvasRenderingContext2D, r: () => number) => void, seed: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 16;
  c.height = 16;
  draw(c.getContext("2d")!, rng(seed));
  return c;
}

function speckle(g: CanvasRenderingContext2D, r: () => number, base: string, dots: string[], n: number): void {
  g.fillStyle = base;
  g.fillRect(0, 0, 16, 16);
  for (let i = 0; i < n; i++) {
    g.fillStyle = dots[Math.floor(r() * dots.length)];
    g.fillRect(Math.floor(r() * 16), Math.floor(r() * 16), 1, 1);
  }
}

const grassBase = (g: CanvasRenderingContext2D, r: () => number) => speckle(g, r, "#6ab85a", ["#5aa84a", "#7ac86a", "#5aa84a"], 18);

const TILE_DRAW: Record<number, (g: CanvasRenderingContext2D, r: () => number, frame: number) => void> = {
  [T.GRASS]: grassBase,
  [T.TALL]: (g, r) => {
    grassBase(g, r);
    for (const [x, y] of [[1, 2], [6, 0], [11, 3], [3, 8], [9, 9], [13, 10]]) {
      g.fillStyle = "#2e7a32";
      g.fillRect(x, y + 2, 1, 5);
      g.fillRect(x + 2, y + 1, 1, 6);
      g.fillStyle = "#3a9a3e";
      g.fillRect(x + 1, y, 1, 7);
      g.fillStyle = "#8ad87a";
      g.fillRect(x + 1, y, 1, 1);
    }
  },
  [T.TREE]: (g, r) => {
    grassBase(g, r);
    g.fillStyle = "#6a4a2a";
    g.fillRect(7, 11, 2, 5);
    g.fillStyle = "#1e4a24";
    g.fillRect(2, 1, 12, 11);
    g.fillRect(1, 3, 14, 7);
    g.fillStyle = "#2e6a34";
    g.fillRect(3, 2, 10, 8);
    g.fillRect(2, 4, 12, 4);
    g.fillStyle = "#4a8a4a";
    g.fillRect(5, 3, 3, 2);
    g.fillRect(4, 5, 2, 1);
  },
  [T.WATER]: (g, _r, frame) => {
    g.fillStyle = "#3a7ad0";
    g.fillRect(0, 0, 16, 16);
    g.fillStyle = "#6aa8f0";
    const o = frame ? 4 : 0;
    g.fillRect((2 + o) % 16, 4, 4, 1);
    g.fillRect((9 + o) % 16, 10, 5, 1);
    g.fillRect((5 + o) % 16, 14, 3, 1);
  },
  [T.PATH]: (g, r) => speckle(g, r, "#d8c088", ["#c8b078", "#e8d098"], 14),
  [T.SAND]: (g, r) => speckle(g, r, "#e8d8a0", ["#d8c890", "#f4e8b8"], 12),
  [T.ROCK]: (g, r) => {
    speckle(g, r, "#b89870", ["#a88860", "#c8a880"], 10);
    g.fillStyle = "#4a4a54";
    g.fillRect(2, 4, 12, 11);
    g.fillRect(3, 3, 10, 1);
    g.fillStyle = "#8a8a98";
    g.fillRect(3, 4, 10, 9);
    g.fillStyle = "#a8a8b8";
    g.fillRect(4, 5, 4, 3);
  },
  [T.WALL]: (g) => {
    g.fillStyle = "#e8d8c0";
    g.fillRect(0, 0, 16, 16);
    g.fillStyle = "#c8b8a0";
    g.fillRect(0, 15, 16, 1);
    g.fillStyle = "#6a8ad0";
    g.fillRect(4, 4, 8, 6);
    g.fillStyle = "#4a3a2a";
    g.fillRect(4, 4, 8, 1);
    g.fillRect(7, 4, 1, 6);
  },
  [T.DOOR]: (g) => {
    g.fillStyle = "#e8d8c0";
    g.fillRect(0, 0, 16, 16);
    g.fillStyle = "#7a4a2a";
    g.fillRect(4, 3, 8, 13);
    g.fillStyle = "#e8c35a";
    g.fillRect(10, 9, 1, 1);
  },
  [T.ROOF]: (g) => {
    g.fillStyle = "#c84a3a";
    g.fillRect(0, 0, 16, 16);
    g.fillStyle = "#a83a2a";
    for (let y = 3; y < 16; y += 4) g.fillRect(0, y, 16, 1);
    g.fillStyle = "#e86a5a";
    for (let y = 0; y < 16; y += 4) g.fillRect((y * 3) % 16, y, 3, 1);
  },
  [T.FOUNTAIN]: (g, r, frame) => {
    speckle(g, r, "#d8c088", ["#c8b078"], 6);
    g.fillStyle = "#8a8a98";
    g.fillRect(1, 3, 14, 12);
    g.fillStyle = "#4aa8ff";
    g.fillRect(3, 5, 10, 8);
    g.fillStyle = "#c8ecff";
    g.fillRect(7, 1 + frame, 2, 7);
    g.fillRect(frame ? 5 : 9, 6, 1, 1);
  },
  [T.FLOWER]: (g, r) => {
    grassBase(g, r);
    const cols = ["#ff8ab0", "#ffe04a", "#ffffff", "#c8a0ff"];
    for (let i = 0; i < 4; i++) {
      const x = 2 + Math.floor(r() * 12);
      const y = 2 + Math.floor(r() * 12);
      g.fillStyle = cols[i % cols.length];
      g.fillRect(x, y, 2, 2);
    }
  },
  [T.FOREST]: (g, r) => speckle(g, r, "#3a7a3a", ["#2e6a2e", "#468a46"], 16),
  [T.DIRT]: (g, r) => speckle(g, r, "#b89870", ["#a88860", "#c8a880"], 14),
  [T.STONE]: (g) => {
    g.fillStyle = "#a8a8b8";
    g.fillRect(0, 0, 16, 16);
    g.fillStyle = "#8a8a9a";
    g.fillRect(0, 0, 16, 1);
    g.fillRect(0, 0, 1, 16);
    g.fillRect(8, 8, 8, 1);
    g.fillRect(8, 8, 1, 8);
  },
  [T.PILLAR]: (g) => {
    g.fillStyle = "#a8a8b8";
    g.fillRect(0, 0, 16, 16);
    g.fillStyle = "#e8e8f0";
    g.fillRect(4, 0, 8, 16);
    g.fillStyle = "#c8c8d8";
    g.fillRect(6, 0, 2, 16);
  },
};

const tileCache = new Map<string, HTMLCanvasElement>();
/** variant: 같은 타일도 위치마다 살짝 다르게 */
export function tileSprite(id: number, variant: number, frame: number): HTMLCanvasElement {
  const v = variant % 4;
  const key = `${id}_${v}_${frame}`;
  let c = tileCache.get(key);
  if (!c) {
    c = tileCanvas((g, r) => TILE_DRAW[id](g, r, frame), id * 97 + v * 13 + 1);
    tileCache.set(key, c);
  }
  return c;
}

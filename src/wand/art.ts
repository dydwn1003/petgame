// 도트 그림: 캐릭터 스프라이트와 장면 배경을 코드로 그린다

export const W = 480;
export const H = 270;
export const GROUND = 204;

export type CharId = "rio" | "bello" | "kairen" | "serafin" | "noct" | "dummy" | "wolf";

// 12×16 마법사 기본 틀 (오른쪽을 바라봄)
const WIZARD = [
  "....HHH.....",
  "...HHHHH....",
  "..HHHHHHH...",
  "HHHHHHHHHHH.",
  "...ASSSA....",
  "...ASSES....",
  "....SSS.....",
  "...RRRRR...*",
  "..RRRRRRRSW.",
  "..RRTRRRR.W.",
  "..RRTRRRR...",
  "..RRTRRRR...",
  "..RRTRRRR...",
  ".RRRTRRRRR..",
  ".RRRTRRRRR..",
  "..BB...BB...",
];

const WIZARD_BEARD = WIZARD.map((row, i) => {
  if (i === 6) return "...DDDDD....";
  if (i === 7) return "...RDDDR...*";
  if (i === 8) return "..RRRDRRRSW.";
  return row;
});

const DUMMY = [
  "....YYYY....",
  "...YSSSSY...",
  "...SESSES...",
  "...SSSSSS...",
  "....SDDS....",
  "YYYYBBBBYYYY",
  "...BBBBBB...",
  "...BBTTBB...",
  "....BBBB....",
  ".....PP.....",
  ".....PP.....",
  ".....PP.....",
  ".....PP.....",
  ".....PP.....",
  "....PPPP....",
  "...PPPPPP...",
];

const WOLF = [
  "................",
  "................",
  "................",
  "...........K.K..",
  "..........KKKK..",
  "K........KKKEKK.",
  "KK......KKKKKKKK",
  ".KKKKKKKKKKKKK..",
  "..KKKKKKKKKKK...",
  "..KKKKKKKKKK....",
  "..KKKKKKKKKK....",
  "..KK.KK..KK.KK..",
  "..KK.KK..KK.KK..",
  "..KK.KK..KK.KK..",
  "..K..K....K..K..",
  "................",
];

type Palette = Record<string, string>;

const BASE: Palette = { S: "#f2c9a0", E: "#1a1a2a", B: "#3a2a20", W: "#8a5a2b", "*": "#fff3b0" };

const CHARS: Record<CharId, { rows: string[]; pal: Palette }> = {
  rio: { rows: WIZARD, pal: { ...BASE, H: "#2b3a8c", A: "#6b3e1f", R: "#33408f", T: "#e8c35a" } },
  bello: {
    rows: WIZARD_BEARD,
    pal: { ...BASE, H: "#4a5a4a", A: "#d8d8d8", R: "#5a6b5a", T: "#c9b26a", D: "#ececec" },
  },
  kairen: { rows: WIZARD, pal: { ...BASE, H: "#8a2222", A: "#1a1a1a", R: "#b83a3a", T: "#2a2a2a" } },
  serafin: { rows: WIZARD, pal: { ...BASE, H: "#2a6aa8", A: "#f0d070", R: "#3a8ad0", T: "#dfe8f0" } },
  noct: {
    rows: WIZARD,
    pal: { ...BASE, H: "#1a1024", A: "#3a2a4a", S: "#c8c0d8", E: "#ff3355", R: "#24163a", T: "#8a2be2", "*": "#c070ff" },
  },
  dummy: { rows: DUMMY, pal: { Y: "#e0c060", S: "#c8a878", E: "#3a2a1a", D: "#8a6a4a", B: "#6a5a8a", T: "#e8c35a", P: "#7a5a3a" } },
  wolf: { rows: WOLF, pal: { K: "#1c1430", E: "#ff3355" } },
};

const spriteCache = new Map<CharId, HTMLCanvasElement>();

export function sprite(id: CharId): HTMLCanvasElement {
  const hit = spriteCache.get(id);
  if (hit) return hit;
  const { rows, pal } = CHARS[id];
  const c = document.createElement("canvas");
  c.width = rows[0].length;
  c.height = rows.length;
  const g = c.getContext("2d")!;
  rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const col = pal[ch];
      if (!col) return;
      g.fillStyle = col;
      g.fillRect(x, y, 1, 1);
    });
  });
  spriteCache.set(id, c);
  return c;
}

/** 캐릭터의 지팡이 끝 위치 (스프라이트 좌표) */
export function wandTip(id: CharId): { x: number; y: number } {
  if (id === "wolf") return { x: 13, y: 6 };
  if (id === "dummy") return { x: 11, y: 5 };
  return { x: 11, y: 7 };
}

// ── 배경 ────────────────────────────────────────────────
export type BgId = "hall" | "court" | "forest" | "arena" | "tower";

function rng(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function vgrad(g: CanvasRenderingContext2D, y0: number, y1: number, a: string, b: string): void {
  const gr = g.createLinearGradient(0, y0, 0, y1);
  gr.addColorStop(0, a);
  gr.addColorStop(1, b);
  g.fillStyle = gr;
  g.fillRect(0, y0, W, y1 - y0);
}

function stars(g: CanvasRenderingContext2D, n: number, maxY: number, seed: number): void {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    g.fillStyle = r() < 0.2 ? "#fff3b0" : "#c8d0ff";
    g.fillRect(Math.floor(r() * W), Math.floor(r() * maxY), 1, 1);
  }
}

function moon(g: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  g.fillStyle = "#e8e6d0";
  for (let dy = -r; dy <= r; dy++) {
    const dx = Math.floor(Math.sqrt(r * r - dy * dy));
    g.fillRect(x - dx, y + dy, dx * 2, 1);
  }
  g.fillStyle = "#cfcdb8";
  g.fillRect(x - 4, y - 3, 3, 3);
  g.fillRect(x + 3, y + 4, 4, 2);
}

function drawHall(g: CanvasRenderingContext2D): void {
  g.fillStyle = "#2a2238";
  g.fillRect(0, 0, W, H);
  g.fillStyle = "#231c30";
  for (let y = 0; y < GROUND; y += 10) {
    const off = (y / 10) % 2 ? 0 : 12;
    for (let x = -12 + off; x < W; x += 24) g.fillRect(x, y, 1, 10);
    g.fillRect(0, y, W, 1);
  }
  for (const wx of [90, 220, 350]) {
    const gr = g.createLinearGradient(0, 40, 0, 150);
    gr.addColorStop(0, "#5a7ad0");
    gr.addColorStop(1, "#22305a");
    g.fillStyle = gr;
    g.fillRect(wx, 60, 40, 90);
    for (let i = 1; i <= 20; i++) {
      const half = Math.round(Math.sqrt(400 - (20 - i) * (20 - i)));
      g.fillRect(wx + 20 - half, 40 + i, half * 2, 1);
    }
    g.fillStyle = "#1a1426";
    g.fillRect(wx + 19, 40, 2, 110);
    g.fillRect(wx, 100, 40, 2);
  }
  g.fillStyle = "#6a3a5a";
  g.fillRect(0, GROUND - 6, W, 6);
  for (let x = 0; x < W; x += 24) {
    for (let y = GROUND; y < H; y += 12) {
      g.fillStyle = ((x / 24 + (y - GROUND) / 12) % 2) ? "#3a2e48" : "#30263c";
      g.fillRect(x, y, 24, 12);
    }
  }
}

function drawCourt(g: CanvasRenderingContext2D): void {
  vgrad(g, 0, GROUND, "#2a1f4a", "#d07a6a");
  stars(g, 40, 70, 3);
  g.fillStyle = "#1e1830";
  g.fillRect(40, 90, 400, GROUND - 90);
  for (const [x, w, h] of [[60, 30, 80], [180, 40, 110], [300, 34, 95], [400, 28, 70]]) {
    g.fillRect(x, GROUND - h - 40, w, h);
    for (let i = 0; i < w; i += 8) g.fillRect(x + i, GROUND - h - 46, 5, 6);
  }
  const r = rng(9);
  g.fillStyle = "#ffd36a";
  for (let i = 0; i < 26; i++) g.fillRect(50 + Math.floor(r() * 380), 100 + Math.floor(r() * 60), 2, 3);
  vgrad(g, GROUND, H, "#2e5a3a", "#1c3a26");
  g.fillStyle = "#3a6a46";
  for (let x = 0; x < W; x += 6) g.fillRect(x, GROUND + ((x * 7) % 11), 2, 2);
}

function drawForest(g: CanvasRenderingContext2D): void {
  vgrad(g, 0, GROUND, "#05050f", "#141a2a");
  stars(g, 70, 120, 5);
  moon(g, 390, 50, 18);
  const r = rng(11);
  for (const [col, base, hmin] of [["#0f1a1a", 60, 80], ["#0a120f", 30, 110]] as const) {
    g.fillStyle = col;
    for (let x = -10; x < W + 20; x += 18 + Math.floor(r() * 16)) {
      const h = hmin + Math.floor(r() * 60);
      const top = GROUND - h - base / 3;
      for (let y = 0; y < h; y++) {
        const half = Math.floor((y / h) * 18) + 1;
        g.fillRect(x - half, top + y, half * 2, 1);
      }
      g.fillRect(x - 2, top + h, 4, GROUND - top - h);
    }
  }
  vgrad(g, GROUND, H, "#101814", "#070a08");
  g.fillStyle = "rgba(160,180,210,0.07)";
  g.fillRect(0, GROUND - 24, W, 30);
  g.fillRect(0, GROUND - 12, W, 18);
}

function drawArena(g: CanvasRenderingContext2D): void {
  vgrad(g, 0, 120, "#1c1630", "#3a2a40");
  stars(g, 30, 40, 7);
  g.fillStyle = "#3a2a2a";
  g.fillRect(0, 70, W, GROUND - 70);
  const r = rng(13);
  const crowd = ["#e8c35a", "#b83a3a", "#3a8ad0", "#5a9a5a", "#d8d8d8", "#a070d0"];
  for (let row = 0; row < 5; row++) {
    for (let x = 4 + (row % 2) * 4; x < W; x += 8) {
      g.fillStyle = crowd[Math.floor(r() * crowd.length)];
      g.fillRect(x, 80 + row * 14, 4, 4);
      g.fillStyle = "#f2c9a0";
      g.fillRect(x + 1, 77 + row * 14, 2, 3);
    }
  }
  g.fillStyle = "#2a1e1e";
  g.fillRect(0, 150, W, GROUND - 150);
  const banners = ["#b83a3a", "#3a8ad0", "#e8c35a", "#5a9a5a"];
  for (let i = 0; i < 8; i++) {
    const x = 20 + i * 60;
    g.fillStyle = banners[i % 4];
    g.fillRect(x, 150, 20, 26);
    for (let k = 0; k < 10; k++) g.fillRect(x + k, 176 + k, 20 - k * 2, 1);
  }
  vgrad(g, GROUND, H, "#9a8060", "#6a5440");
  g.fillStyle = "#e8d8a0";
  g.fillRect(40, GROUND + 30, W - 80, 1);
}

function drawTower(g: CanvasRenderingContext2D): void {
  vgrad(g, 0, GROUND, "#07061a", "#2a1a4a");
  stars(g, 140, GROUND - 20, 17);
  moon(g, 90, 60, 26);
  g.fillStyle = "#3a3448";
  g.fillRect(0, GROUND - 22, W, 22);
  for (let x = 0; x < W; x += 30) g.fillRect(x, GROUND - 34, 18, 12);
  g.fillStyle = "#2a2438";
  for (let x = 0; x < W; x += 30) g.fillRect(x, GROUND - 22, 1, 22);
  vgrad(g, GROUND, H, "#3a3448", "#1e1a28");
  g.fillStyle = "#2c2638";
  for (let y = GROUND; y < H; y += 10) g.fillRect(0, y, W, 1);
}

const DRAW: Record<BgId, (g: CanvasRenderingContext2D) => void> = {
  hall: drawHall,
  court: drawCourt,
  forest: drawForest,
  arena: drawArena,
  tower: drawTower,
};

const bgCache = new Map<BgId, HTMLCanvasElement>();

export function background(id: BgId): HTMLCanvasElement {
  const hit = bgCache.get(id);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  DRAW[id](c.getContext("2d")!);
  bgCache.set(id, c);
  return c;
}

/** 배경 중 움직이는 부분 (횃불, 수정 등) */
export function animateBg(g: CanvasRenderingContext2D, id: BgId, t: number): void {
  if (id === "hall") {
    for (const x of [40, 190, 320, 440]) {
      g.fillStyle = "#4a3a2a";
      g.fillRect(x, 110, 4, 14);
      const f = Math.floor(t * 10) % 3;
      g.fillStyle = "#ff8a3a";
      g.fillRect(x - 1, 104 - f, 6, 7 + f);
      g.fillStyle = "#ffe08a";
      g.fillRect(x + 1, 106 - f, 2, 4);
      g.fillStyle = "rgba(255,160,80,0.06)";
      g.fillRect(x - 6, 96, 16, 18);
    }
  } else if (id === "tower") {
    const cx = 240;
    const cy = 120 + Math.sin(t * 1.5) * 3;
    g.fillStyle = "rgba(120,220,255,0.12)";
    g.fillRect(cx - 26, cy - 34, 52, 68);
    for (let i = 0; i < 26; i++) {
      const half = i < 13 ? i : 26 - i;
      g.fillStyle = i < 13 ? "#8ae8ff" : "#4ab0e0";
      g.fillRect(cx - half, cy - 26 + i * 2, half * 2, 2);
    }
    g.fillStyle = "#ffffff";
    g.fillRect(cx - 3, cy - 10, 2, 6);
  } else if (id === "forest") {
    g.fillStyle = "rgba(160,180,210,0.05)";
    const off = (t * 6) % W;
    g.fillRect(off - W, GROUND - 40, W, 14);
    g.fillRect(off, GROUND - 40, W, 14);
  }
}

// Procedural pixel-art generator.
// Draws crisp, nearest-neighbor pixel grids to canvases and registers them
// as Phaser textures at boot time, per the GDD's art spec:
//   - tiles: 16x16px fixed
//   - characters: 32x32px fixed
//   - outline: dark brown #3D2314
//   - palette: warm, low-saturation pastels

export const OUTLINE = "#3D2314";

export type Grid = (string | null)[][];

export function newGrid(size: number): Grid {
  return Array.from({ length: size }, () => Array<string | null>(size).fill(null));
}

export function setPx(g: Grid, x: number, y: number, color: string | null): void {
  if (y < 0 || y >= g.length || x < 0 || x >= g[0].length) return;
  g[y][x] = color;
}

export function getPx(g: Grid, x: number, y: number): string | null {
  if (y < 0 || y >= g.length || x < 0 || x >= g[0].length) return null;
  return g[y][x];
}

export function fillRect(g: Grid, x: number, y: number, w: number, h: number, color: string | null): void {
  for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) setPx(g, xx, yy, color);
}

export function fillCircle(g: Grid, cx: number, cy: number, r: number, color: string | null): void {
  const r2 = (r + 0.35) * (r + 0.35);
  for (let yy = Math.floor(cy - r); yy <= Math.ceil(cy + r); yy++) {
    for (let xx = Math.floor(cx - r); xx <= Math.ceil(cx + r); xx++) {
      const dx = xx - cx + 0.5;
      const dy = yy - cy + 0.5;
      if (dx * dx + dy * dy <= r2) setPx(g, xx, yy, color);
    }
  }
}

export function fillEllipse(g: Grid, cx: number, cy: number, rx: number, ry: number, color: string | null): void {
  for (let yy = Math.floor(cy - ry); yy <= Math.ceil(cy + ry); yy++) {
    for (let xx = Math.floor(cx - rx); xx <= Math.ceil(cx + rx); xx++) {
      const dx = (xx - cx + 0.5) / rx;
      const dy = (yy - cy + 0.5) / ry;
      if (dx * dx + dy * dy <= 1.05) setPx(g, xx, yy, color);
    }
  }
}

export function polygon(g: Grid, pts: [number, number][], color: string): void {
  let minY = Infinity, maxY = -Infinity;
  for (const [, y] of pts) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
  for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
    const xs: number[] = [];
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = pts[i];
      const [x2, y2] = pts[(i + 1) % pts.length];
      if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) {
        const t = (y - y1) / (y2 - y1);
        xs.push(x1 + t * (x2 - x1));
      }
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i < xs.length; i += 2) {
      const xStart = Math.round(xs[i]);
      const xEnd = Math.round(xs[i + 1] ?? xs[i]);
      for (let x = xStart; x <= xEnd; x++) setPx(g, x, y, color);
    }
  }
}

/** Outlines the silhouette of all non-null pixels with `color`, only onto currently-null cells. */
export function autoOutline(g: Grid, color: string = OUTLINE): void {
  const h = g.length, w = g[0].length;
  const stamp: (string | null)[][] = g.map((row) => row.slice());
  const isFilled = (x: number, y: number) => {
    if (y < 0 || y >= h || x < 0 || x >= w) return false;
    return stamp[y][x] !== null;
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (stamp[y][x] !== null) continue;
      if (isFilled(x - 1, y) || isFilled(x + 1, y) || isFilled(x, y - 1) || isFilled(x, y + 1)) {
        g[y][x] = color;
      }
    }
  }
}

export function cloneGrid(g: Grid): Grid {
  return g.map((row) => row.slice());
}

export function flipGridX(g: Grid): Grid {
  return g.map((row) => row.slice().reverse());
}

export function shiftGrid(g: Grid, dx: number, dy: number): Grid {
  const size = g.length;
  const out = newGrid(size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const v = getPx(g, x - dx, y - dy);
      if (v) setPx(out, x, y, v);
    }
  }
  return out;
}

/** Rasterizes a grid to an offscreen canvas at 1 logical pixel = 1 real pixel. */
export function gridToCanvas(g: Grid): HTMLCanvasElement {
  const size = g.length;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const c = g[y][x];
      if (c) {
        ctx.fillStyle = c;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
  return canvas;
}

export function registerGrid(scene: Phaser.Scene, key: string, g: Grid): void {
  if (scene.textures.exists(key)) scene.textures.remove(key);
  scene.textures.addCanvas(key, gridToCanvas(g));
}

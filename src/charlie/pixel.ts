// 도트 스프라이트 굽기: 칠한 다음 자동으로 검은 외곽선을 두른다

export type Px = (x: number, y: number, w: number, h: number, c: string) => void;

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

export function bake(w: number, h: number, paint: (p: Px) => void, outline: string | null = "#140d0b"): HTMLCanvasElement {
  const c = makeCanvas(w, h);
  const g = c.getContext("2d")!;
  paint((x, y, ww, hh, col) => {
    g.fillStyle = col;
    g.fillRect(Math.round(x), Math.round(y), Math.round(ww), Math.round(hh));
  });
  if (outline) {
    const img = g.getImageData(0, 0, w, h);
    const d = img.data;
    const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 0;
    const marks: number[] = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (solid(x, y)) continue;
        if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) marks.push(x, y);
      }
    }
    g.fillStyle = outline;
    for (let i = 0; i < marks.length; i += 2) g.fillRect(marks[i], marks[i + 1], 1, 1);
  }
  return c;
}

export function flip(src: HTMLCanvasElement): HTMLCanvasElement {
  const c = makeCanvas(src.width, src.height);
  const g = c.getContext("2d")!;
  g.translate(src.width, 0);
  g.scale(-1, 1);
  g.drawImage(src, 0, 0);
  return c;
}

export function ellipse(p: Px, cx: number, cy: number, rx: number, ry: number, col: string): void {
  for (let y = Math.ceil(-ry); y <= Math.floor(ry); y++) {
    const half = Math.floor(rx * Math.sqrt(Math.max(0, 1 - (y * y) / (ry * ry))) + 0.35);
    if (half >= 0) p(cx - half, cy + y, half * 2 + 1, 1, col);
  }
}

export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** 이름별 캐시 */
const cache = new Map<string, HTMLCanvasElement>();
export function cached(key: string, make: () => HTMLCanvasElement): HTMLCanvasElement {
  let c = cache.get(key);
  if (!c) {
    c = make();
    cache.set(key, c);
  }
  return c;
}
export function clearCache(prefix: string): void {
  for (const k of [...cache.keys()]) if (k.startsWith(prefix)) cache.delete(k);
}

// 도트 스프라이트 굽기: 칠한 다음 자동으로 검은 외곽선을 두른다

/** 도트 찍기 함수. ctx 가 붙어 있으면 도형을 벡터로 그린 뒤 나중에 도트로 굽는다 */
export type Px = ((x: number, y: number, w: number, h: number, c: string) => void) & { ctx?: CanvasRenderingContext2D };

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

export function bake(w: number, h: number, paint: (p: Px) => void, outline: string | null = "#140d0b", thick = 1): HTMLCanvasElement {
  const c = makeCanvas(w, h);
  const g = c.getContext("2d")!;
  paint((x, y, ww, hh, col) => {
    g.fillStyle = col;
    g.fillRect(Math.round(x), Math.round(y), Math.round(ww), Math.round(hh));
  });
  // 외곽선: 바깥쪽으로 thick 번 넓혀 칠한다 (두 번째 줄부터는 살짝 옅게)
  for (let pass = 0; outline && pass < thick; pass++) {
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
    g.fillStyle = pass === 0 ? outline : `${outline}cc`;
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
  if (p.ctx) {
    const g = p.ctx;
    g.fillStyle = col;
    g.beginPath();
    g.ellipse(cx + 0.5, cy + 0.5, Math.max(0.35, rx + 0.4), Math.max(0.35, ry + 0.4), 0, 0, Math.PI * 2);
    g.fill();
    return;
  }
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

/** 색을 밝게(k>0) 또는 어둡게(k<0). "#rrggbb" 와 "rgb(r,g,b)" 모두 받는다 */
export function mix(c: string, k: number): string {
  let r: number, gg: number, b: number;
  if (c.startsWith("#")) {
    const n = parseInt(c.slice(1, 7), 16);
    r = (n >> 16) & 255;
    gg = (n >> 8) & 255;
    b = n & 255;
  } else {
    [r, gg, b] = (c.match(/\d+/g) ?? ["0", "0", "0"]).map(Number);
  }
  const t = k > 0 ? 255 : 0;
  const a = Math.abs(k);
  const f = (v: number) => Math.round(v + (t - v) * a);
  return `rgb(${f(r)},${f(gg)},${f(b)})`;
}


/** 고밀도 캔버스: 논리 좌표로 그리되 실제로는 scale 배 촘촘하게 칠한다 */
export function makeDense(w: number, h: number, scale: number): HTMLCanvasElement {
  const c = makeCanvas(Math.round(w * scale), Math.round(h * scale));
  const g = c.getContext("2d")!;
  g.scale(scale, scale);
  g.imageSmoothingEnabled = false;
  return c;
}

/**
 * 해상도와 상관없이 그리기: 설계 좌표(w×h)로 그린 그림을 k배 촘촘한 도트로 굽는다.
 * 가장자리 반투명은 잘라서 또렷한 도트 실루엣을 만들고, 외곽선을 두른다.
 */
export function bakeVec(w: number, h: number, k: number, paint: (p: Px) => void, outline: string | null, thick: number): HTMLCanvasElement {
  const c = makeCanvas(Math.round(w * k), Math.round(h * k));
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.scale(k, k);
  const p = ((x: number, y: number, ww: number, hh: number, col: string) => {
    g.fillStyle = col;
    g.fillRect(x, y, ww, hh);
  }) as Px;
  p.ctx = g;
  paint(p);
  g.setTransform(1, 0, 0, 1, 0, 0);
  const W = c.width;
  const H = c.height;
  const img = g.getImageData(0, 0, W, H);
  const d = img.data;
  // 가장자리 반투명을 잘라 또렷한 실루엣으로
  for (let i = 3; i < d.length; i += 4) d[i] = d[i] < 110 ? 0 : 255;
  // 외곽선: 메모리에서 바로 바깥쪽 한 줄씩 넓힌다 (빠름)
  if (outline) {
    const n = parseInt(outline.slice(1, 7), 16);
    const or = (n >> 16) & 255;
    const og = (n >> 8) & 255;
    const ob = n & 255;
    const passes = Math.max(1, Math.round(thick * k));
    const solid = new Uint8Array(W * H);
    for (let i = 0; i < W * H; i++) solid[i] = d[i * 4 + 3] > 0 ? 1 : 0;
    for (let pass = 0; pass < passes; pass++) {
      const alpha = pass < passes - 1 || passes === 1 ? 255 : 176;
      const add: number[] = [];
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const i = y * W + x;
          if (solid[i]) continue;
          if ((x > 0 && solid[i - 1]) || (x < W - 1 && solid[i + 1]) || (y > 0 && solid[i - W]) || (y < H - 1 && solid[i + W])) add.push(i);
        }
      }
      for (const i of add) {
        solid[i] = 1;
        d[i * 4] = or;
        d[i * 4 + 1] = og;
        d[i * 4 + 2] = ob;
        d[i * 4 + 3] = alpha;
      }
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

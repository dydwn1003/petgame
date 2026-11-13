// 허공에 그린 모양을 주문으로 알아보는 간단한 인식기

export type SpellId = "bolt" | "fire" | "shield" | "frost" | "heal";

export interface Pt {
  x: number;
  y: number;
}

const N = 32;

function pathLength(pts: Pt[]): number {
  let d = 0;
  for (let i = 1; i < pts.length; i++) d += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return d;
}

function resample(src: Pt[], n: number): Pt[] {
  const pts = src.map((p) => ({ ...p }));
  const step = pathLength(pts) / (n - 1);
  const out: Pt[] = [{ ...pts[0] }];
  let acc = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    const d = Math.hypot(b.x - a.x, b.y - a.y);
    if (acc + d >= step && d > 0) {
      const t = (step - acc) / d;
      const q = { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
      out.push(q);
      pts.splice(i, 0, q);
      acc = 0;
    } else {
      acc += d;
    }
  }
  while (out.length < n) out.push({ ...pts[pts.length - 1] });
  return out.slice(0, n);
}

function normalize(pts: Pt[]): Pt[] {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const size = Math.max(maxX - minX, maxY - minY) || 1;
  const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  return pts.map((p) => ({ x: (p.x - cx) / size, y: (p.y - cy) / size }));
}

function polyline(corners: Array<[number, number]>): Pt[] {
  return resample(corners.map(([x, y]) => ({ x, y })), N);
}

interface Template {
  id: SpellId;
  pts: Pt[];
}

const RAW: Array<[SpellId, Array<[number, number]>]> = [
  ["bolt", [[0, 0], [1, 0], [0, 1], [1, 1]]], // Z
  ["bolt", [[1, 0], [0, 0], [1, 1], [0, 1]]], // 거꾸로 Z
  ["bolt", [[0.3, 0], [0, 0.5], [1, 0.5], [0.7, 1]]], // 번개 모양
  ["frost", [[0, 0], [0.5, 1], [1, 0]]], // V
  ["heal", [[0, 1], [0.5, 0], [1, 1]]], // ^
];

const TEMPLATES: Template[] = [];
for (const [id, corners] of RAW) {
  TEMPLATES.push({ id, pts: normalize(polyline(corners)) });
  TEMPLATES.push({ id, pts: normalize(polyline([...corners].reverse())) });
}

/** 인식 결과. 알아보지 못하면 null */
export function recognize(raw: Pt[], minSize: number): SpellId | null {
  if (raw.length < 4) return null;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of raw) {
    minX = Math.min(minX, p.x);
    minY = Math.min(minY, p.y);
    maxX = Math.max(maxX, p.x);
    maxY = Math.max(maxY, p.y);
  }
  const w = maxX - minX;
  const h = maxY - minY;
  const size = Math.max(w, h);
  if (size < minSize) return null;
  const len = pathLength(raw);

  // ─ 가로선: 납작하고 거의 곧은 선
  if (h < w * 0.3 && len < w * 1.35) return "shield";

  // ○ 원: 시작과 끝이 가깝고 한 바퀴 돈 길이
  const first = raw[0];
  const last = raw[raw.length - 1];
  const closed = Math.hypot(last.x - first.x, last.y - first.y) < size * 0.35;
  if (closed && len > size * 2.3 && Math.min(w, h) > size * 0.5) return "fire";

  const pts = normalize(resample(raw, N));
  let best: SpellId | null = null;
  let bestD = Infinity;
  for (const t of TEMPLATES) {
    let d = 0;
    for (let i = 0; i < N; i++) d += Math.hypot(pts[i].x - t.pts[i].x, pts[i].y - t.pts[i].y);
    d /= N;
    if (d < bestD) {
      bestD = d;
      best = t.id;
    }
  }
  return bestD < 0.2 ? best : null;
}

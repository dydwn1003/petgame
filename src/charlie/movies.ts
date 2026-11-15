// 애니메이션 컷: 오프닝 · 샘의 기억 · 엔딩 영상
// 각 컷은 시간 t(초)와 진행도 k(0~1)를 받아 화면 전체를 그린다.
import { H, W, clock, g } from "./core";
import { ALLEY, buildAlley } from "./bg";
import { BUILD_3, CHARLIE, catSoft as cat, human, tintCat } from "./sprites";
import { PIX, rng } from "./pixel";

export interface Shot {
  dur: number;
  text?: string;
  draw: (t: number, k: number) => void;
}

const ease = (k: number) => k * k * (3 - 2 * k);
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

function sky(stops: Array<[number, string]>, y1 = H): void {
  const gr = g.createLinearGradient(0, 0, 0, y1);
  for (const [k, c] of stops) gr.addColorStop(k, c);
  g.fillStyle = gr;
  g.fillRect(0, 0, W, y1);
}

function stars(seed: number, n: number, maxY: number, drift = 0): void {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const x = (r() * W * 1.2 - drift * (0.3 + r())) % (W * 1.2);
    const y = r() * maxY;
    const tw = 0.5 + 0.5 * Math.sin(clock.t * (1 + r() * 3) + i);
    g.fillStyle = `rgba(${r() < 0.3 ? "255,240,200" : "180,190,255"},${(0.3 + tw * 0.7).toFixed(2)})`;
    const s = r() < 0.08 ? 1 : 0.5;
    g.fillRect(x < 0 ? x + W * 1.2 : x, y, s, s);
  }
}

/** 빌딩 실루엣 한 줄 (창문 불빛 포함) */
function skyline(seed: number, base: number, minH: number, maxH: number, col: string, lit: number, shift: number, litCol = "#ffd27a"): void {
  const r = rng(seed);
  let x = -40 - (shift % 60);
  while (x < W + 40) {
    const w = 14 + r() * 34;
    const h = minH + r() * (maxH - minH);
    g.fillStyle = col;
    g.fillRect(x, base - h, w, h + 2);
    if (r() < 0.15) {
      g.fillRect(x + w / 2 - 3, base - h - 14, 6, 14);
      g.fillRect(x + w / 2 - 0.5, base - h - 30, 1, 16);
    }
    for (let wy = base - h + 4; wy < base - 2; wy += 5) {
      for (let wx = x + 2; wx < x + w - 2; wx += 4) {
        if (r() < lit) {
          g.fillStyle = litCol;
          g.fillRect(wx, wy, 1.5, 2);
        }
      }
    }
    x += w + r() * 3;
  }
}

function meteor(x: number, y: number, ang: number, len: number, size: number): void {
  const tx = x - Math.cos(ang) * len;
  const ty = y - Math.sin(ang) * len;
  const gr = g.createLinearGradient(x, y, tx, ty);
  gr.addColorStop(0, "rgba(255,250,220,0.95)");
  gr.addColorStop(0.15, "rgba(180,255,190,0.7)");
  gr.addColorStop(1, "rgba(120,255,170,0)");
  g.strokeStyle = gr;
  g.lineCap = "round";
  g.lineWidth = size * 1.6;
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(tx, ty);
  g.stroke();
  const glow = g.createRadialGradient(x, y, 0, x, y, size * 6);
  glow.addColorStop(0, "rgba(220,255,220,0.9)");
  glow.addColorStop(1, "rgba(120,255,170,0)");
  g.fillStyle = glow;
  g.beginPath();
  g.arc(x, y, size * 6, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#fffbe8";
  g.beginPath();
  g.arc(x, y, size, 0, Math.PI * 2);
  g.fill();
}

function rain(alpha: number, speed = 1, slant = 0.3): void {
  g.strokeStyle = `rgba(170,200,230,${alpha})`;
  g.lineWidth = 0.5;
  g.beginPath();
  for (let i = 0; i < 120; i++) {
    const x = (i * 47.3 + clock.t * 120 * slant * speed) % (W + 30) - 15;
    const y = (i * 23.9 + clock.t * 380 * speed) % (H + 20) - 10;
    g.moveTo(x, y);
    g.lineTo(x - 6 * slant, y + 7);
  }
  g.stroke();
}

function catSilhouette(x: number, y: number, s: number, tail: number): void {
  g.fillStyle = "#0a1410";
  g.beginPath();
  g.ellipse(x, y - 5 * s, 4 * s, 5.5 * s, 0, 0, Math.PI * 2);
  g.ellipse(x + 0.5 * s, y - 12 * s, 3.2 * s, 3 * s, 0, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.moveTo(x - 2.6 * s, y - 13 * s);
  g.lineTo(x - 2 * s, y - 17 * s);
  g.lineTo(x - 0.4 * s, y - 14.5 * s);
  g.moveTo(x + 3.4 * s, y - 13 * s);
  g.lineTo(x + 3 * s, y - 17 * s);
  g.lineTo(x + 1.4 * s, y - 14.5 * s);
  g.fill();
  g.strokeStyle = "#0a1410";
  g.lineWidth = 1.2 * s;
  g.beginPath();
  g.moveTo(x - 3 * s, y - 1 * s);
  g.quadraticCurveTo(x - 9 * s, y - 2 * s, x - 8 * s, y - 8 * s + Math.sin(tail) * 2 * s);
  g.stroke();
}

function drawUfoAt(x: number, y: number, s: number): void {
  g.fillStyle = "rgba(140,255,170,0.2)";
  g.beginPath();
  g.ellipse(x, y + 2 * s, 44 * s, 12 * s, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#2e2e3a";
  g.beginPath();
  g.ellipse(x, y, 36 * s, 8 * s, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#5a5a6a";
  g.beginPath();
  g.ellipse(x, y - 2 * s, 34 * s, 5 * s, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#9ab8c8";
  g.beginPath();
  g.ellipse(x, y - 6 * s, 14 * s, 7 * s, 0, Math.PI, 0);
  g.fill();
  for (let i = 0; i < 7; i++) {
    g.fillStyle = Math.floor(clock.t * 6 + i) % 2 ? "#aaffcc" : "#2a6a4a";
    g.fillRect(x - 30 * s + i * 10 * s, y + s, 3 * s, 1.5 * s);
  }
}

// ── 오프닝 ──────────────────────────────────────────────
export function introShots(): Shot[] {
  earthTexture();
  return [
    {
      // 1. 우주: 미세하게 반짝이는 별, 지구를 향해 다가오는 초록 운석
      dur: 7,
      text: "그날 밤, 아득한 우주 저편에서 초록빛 하나가 지구를 향해 다가오고 있었다.",
      draw: (t, k) => {
        g.fillStyle = "#010208";
        g.fillRect(0, 0, W, H);
        starfield(t);
        const e = ease(k);
        const er = lerp(124, 136, e);
        drawEarth(380, 262, er, t);
        const ang = Math.atan2(150, 250);
        const mx = lerp(40, 288, e);
        const my = lerp(30, 178, e);
        const sz = lerp(1.4, 3.2, e);
        meteorRock(mx, my, ang, sz, t, lerp(50, 120, e));
        sparks(mx, my, ang, t, sz);
        if (k > 0.86) {
          g.fillStyle = `rgba(160,255,190,${((k - 0.86) / 0.14) * 0.4})`;
          g.fillRect(0, 0, W, H);
        }
      },
    },
    {
      // 2. 뉴욕의 밤: 찰리네 브라운스톤 바깥, 불 켜진 3층 창에 샘의 그림자
      dur: 7,
      text: "뉴욕 브루클린의 밤. 오래된 브라운스톤 3층, 불 켜진 창가.",
      draw: (t, k) => {
        const z = lerp(1, 1.7, ease(k));
        g.save();
        g.translate(WIN.x, WIN.y);
        g.scale(z, z);
        g.translate(-WIN.x, -WIN.y);
        exteriorScene(t);
        g.restore();
      },
    },
    {
      // 3. 창가에서 야경을 바라보는 샘 (뒷모습)
      dur: 7,
      text: "샘은 오늘도 창가에 앉아 도시의 불빛을 바라보고 있었다.",
      draw: (t, k) => {
        const z = lerp(1, 1.12, ease(k));
        g.save();
        g.translate(W / 2, 170);
        g.scale(z, z);
        g.translate(-W / 2, -170);
        windowScene(t);
        g.restore();
      },
    },
  ];
}

/** 미세하게 반짝이는 별: 크기·색이 다양하고, 밝은 별엔 작은 십자 빛 */
function starfield(t: number): void {
  const r = rng(303);
  for (let i = 0; i < 260; i++) {
    const x = r() * W;
    const y = r() * H;
    const big = r();
    const hue = r();
    const sp = 0.6 + r() * 2.2;
    const ph = r() * 6.28;
    const tw = 0.82 + 0.18 * Math.sin(clock.t * sp + ph);
    const col = hue < 0.2 ? "255,226,190" : hue < 0.35 ? "190,210,255" : "236,240,255";
    const base = big < 0.06 ? 1 : big < 0.3 ? 0.75 : 0.45;
    g.fillStyle = `rgba(${col},${(base * tw).toFixed(2)})`;
    const s2 = big < 0.06 ? 1 : 0.5;
    g.fillRect(x - t * 0.6 * (big + 0.2), y, s2, s2);
    if (big < 0.025) {
      g.fillStyle = `rgba(${col},${(0.35 * tw).toFixed(2)})`;
      g.fillRect(x - t * 0.6 * (big + 0.2) - 1.5, y + 0.25, 4, 0.5);
      g.fillRect(x - t * 0.6 * (big + 0.2) + 0.25, y - 1.5, 0.5, 4);
    }
  }
}

// ── 지구: 3차원 잡음으로 대륙·구름을 만들고 햇빛·밤의 도시 불빛까지 구워 둔다 ──
function hash3(x: number, y: number, z: number): number {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x: number, y: number, z: number): number {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf), w = zf * zf * (3 - 2 * zf);
  const l = (a: number, b: number, k: number) => a + (b - a) * k;
  const c = (dx: number, dy: number, dz: number) => hash3(xi + dx, yi + dy, zi + dz);
  return l(
    l(l(c(0, 0, 0), c(1, 0, 0), u), l(c(0, 1, 0), c(1, 1, 0), u), v),
    l(l(c(0, 0, 1), c(1, 0, 1), u), l(c(0, 1, 1), c(1, 1, 1), u), v),
    w,
  );
}
function fbm(x: number, y: number, z: number, oct: number): number {
  let a = 0.5, f = 1, sum = 0, norm = 0;
  for (let i = 0; i < oct; i++) {
    sum += a * vnoise(x * f, y * f, z * f);
    norm += a;
    a *= 0.5;
    f *= 2.03;
  }
  return sum / norm;
}
let earthTex: { surf: HTMLCanvasElement; cloud: HTMLCanvasElement } | null = null;
export function earthTexture(): { surf: HTMLCanvasElement; cloud: HTMLCanvasElement } {
  if (earthTex) return earthTex;
  const N = 400;
  const mk = () => {
    const c = document.createElement("canvas");
    c.width = c.height = N;
    return c;
  };
  const surf = mk();
  const cloud = mk();
  const sg = surf.getContext("2d")!;
  const cg = cloud.getContext("2d")!;
  const si = sg.createImageData(N, N);
  const ci = cg.createImageData(N, N);
  const L = [-0.62, -0.5, 0.6];
  const ln = Math.hypot(L[0], L[1], L[2]);
  for (let py = 0; py < N; py++) {
    for (let px = 0; px < N; px++) {
      const nx = (px + 0.5) / (N / 2) - 1;
      const ny = (py + 0.5) / (N / 2) - 1;
      const d2 = nx * nx + ny * ny;
      if (d2 > 1) continue;
      const nz = Math.sqrt(1 - d2);
      // 살짝 기운 자전축
      const tx = nx * 0.96 - ny * 0.28;
      const ty = nx * 0.28 + ny * 0.96;
      const tz = nz;
      const h = fbm(tx * 2.1 + 7, ty * 2.1 + 3, tz * 2.1 + 11, 6);
      const lat = Math.abs(ty);
      const diff = Math.max(0, (nx * L[0] + ny * L[1] + nz * L[2]) / ln);
      const light = 0.08 + 0.92 * Math.pow(diff, 0.8);
      let r: number, gg: number, b: number;
      const sea = 0.53;
      const iceEdge = 0.86 + (fbm(tx * 5 + 3, ty * 5, tz * 5 + 9, 3) - 0.5) * 0.22;
      if (lat > iceEdge || (lat > iceEdge - 0.08 && h > 0.5)) {
        [r, gg, b] = [232, 238, 246];
      } else if (h > sea) {
        const el = (h - sea) / (1 - sea);
        const dry = fbm(tx * 4 + 20, ty * 4, tz * 4, 3);
        if (el > 0.45) [r, gg, b] = [130, 112, 86];
        else if (dry > 0.56 && lat < 0.5) [r, gg, b] = [196, 168, 112];
        else [r, gg, b] = [64 + el * 60, 108 + el * 30, 52 + el * 20];
        if (el < 0.04) [r, gg, b] = [176, 168, 124];
      } else {
        const depth = (sea - h) / sea;
        [r, gg, b] = [12 + (1 - depth) * 30, 44 + (1 - depth) * 70, 98 + (1 - depth) * 80];
        if (depth < 0.05) [r, gg, b] = [40, 120, 170];
        // 바다의 햇빛 반짝임
        const hx = nx - L[0] / ln * 0.4, hy = ny - L[1] / ln * 0.4;
        const spec = Math.max(0, 1 - Math.hypot(hx + 0.18, hy + 0.14) * 3.2);
        r += spec * 120;
        gg += spec * 120;
        b += spec * 110;
      }
      let R = r * light, G = gg * light, B = b * light;
      // 밤 쪽 도시 불빛
      if (diff < 0.12 && h > sea && lat < 0.75) {
        const city = fbm(tx * 18, ty * 18, tz * 18, 2);
        if (city > 0.62) {
          const k = (city - 0.62) * 4 * (1 - diff / 0.12);
          R += 255 * k;
          G += 190 * k;
          B += 90 * k;
        }
      }
      // 가장자리로 갈수록 대기의 푸른빛
      const rim = Math.pow(1 - nz, 2.2);
      R = R * (1 - rim * 0.6) + 90 * rim * (0.3 + diff);
      G = G * (1 - rim * 0.6) + 150 * rim * (0.3 + diff);
      B = B * (1 - rim * 0.6) + 255 * rim * (0.3 + diff);
      const o = (py * N + px) * 4;
      si.data[o] = Math.min(255, R);
      si.data[o + 1] = Math.min(255, G);
      si.data[o + 2] = Math.min(255, B);
      si.data[o + 3] = 255;
      // 구름: 위도 방향으로 늘어진 소용돌이
      const cl = fbm(tx * 3.2 + 40, ty * 7 + fbm(tx * 2, ty * 2, tz * 2, 2) * 2.2, tz * 3.2, 5);
      const ca = Math.max(0, Math.min(1, (cl - 0.52) * 4.2));
      const cLight = 0.1 + 0.9 * diff;
      ci.data[o] = 250 * cLight;
      ci.data[o + 1] = 252 * cLight;
      ci.data[o + 2] = 255 * cLight;
      ci.data[o + 3] = ca * 235 * (1 - rim * 0.5);
    }
  }
  sg.putImageData(si, 0, 0);
  cg.putImageData(ci, 0, 0);
  earthTex = { surf, cloud };
  return earthTex;
}
function drawEarth(x: number, y: number, r: number, t: number): void {
  const tex = earthTexture();
  // 바깥 대기 빛
  const atm = g.createRadialGradient(x, y, r * 0.98, x, y, r * 1.12);
  atm.addColorStop(0, "rgba(120,190,255,0.55)");
  atm.addColorStop(0.4, "rgba(80,150,255,0.18)");
  atm.addColorStop(1, "rgba(80,150,255,0)");
  g.fillStyle = atm;
  g.beginPath();
  g.arc(x, y, r * 1.12, 0, Math.PI * 2);
  g.fill();
  g.imageSmoothingEnabled = true;
  g.drawImage(tex.surf, x - r, y - r, r * 2, r * 2);
  // 구름은 천천히 흘러간다
  g.save();
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.clip();
  g.drawImage(tex.cloud, x - r + t * 0.8, y - r, r * 2, r * 2);
  g.restore();
  g.imageSmoothingEnabled = false;
}

/**
 * 운석: 조금 찌그러진 자연스러운 구. 겉은 그을린 암석 껍질,
 * 갈라진 틈과 얇은 껍질 너머로 안에 든 초록 바이러스가 은은히 비친다.
 * 뒤로는 타면서 흩어지는 가스 꼬리.
 */
function meteorRock(x: number, y: number, ang: number, size: number, t: number, len: number): void {
  const R = size * 2.1;
  const ca = Math.cos(ang), sa = Math.sin(ang);
  // 가스 꼬리: 뒤로 갈수록 커지고 옅어지는 둥근 연기 덩어리들
  for (let i = 26; i >= 1; i--) {
    const k = i / 26;
    const wob = Math.sin(t * 3 + i * 1.7) * R * 0.5 * k;
    const px = x - ca * len * k - sa * wob;
    const py = y - sa * len * k + ca * wob;
    const rad = R * (0.9 + k * 2.2);
    const a = (1 - k) * 0.28;
    const gr = g.createRadialGradient(px, py, 0, px, py, rad);
    gr.addColorStop(0, `rgba(${Math.round(180 + 60 * (1 - k))},255,${Math.round(190 + 40 * (1 - k))},${a.toFixed(3)})`);
    gr.addColorStop(1, "rgba(90,220,140,0)");
    g.fillStyle = gr;
    g.beginPath();
    g.arc(px, py, rad, 0, Math.PI * 2);
    g.fill();
  }
  // 앞쪽 공기 마찰로 빛나는 플라스마 막
  const glow = g.createRadialGradient(x + ca * R * 0.3, y + sa * R * 0.3, R * 0.6, x, y, R * 3.4);
  glow.addColorStop(0, "rgba(210,255,220,0.55)");
  glow.addColorStop(0.5, "rgba(110,255,160,0.18)");
  glow.addColorStop(1, "rgba(110,255,160,0)");
  g.fillStyle = glow;
  g.beginPath();
  g.arc(x, y, R * 3.4, 0, Math.PI * 2);
  g.fill();
  // 본체: 살짝 울퉁불퉁한 구 (윤곽에 잔물결)
  g.save();
  g.translate(x, y);
  const rot = t * 0.7;
  const outline = (scale: number) => {
    g.beginPath();
    for (let i = 0; i <= 36; i++) {
      const a = (i / 36) * Math.PI * 2;
      const bump = 1 + Math.sin(a * 3 + rot) * 0.05 + Math.sin(a * 5 - rot * 1.3) * 0.035 + Math.sin(a * 2 + 1) * 0.04;
      const px = Math.cos(a) * R * bump * scale;
      const py = Math.sin(a) * R * bump * 0.94 * scale;
      if (i === 0) g.moveTo(px, py);
      else g.lineTo(px, py);
    }
    g.closePath();
  };
  // 암석 껍질: 앞(진행 방향)은 달아올라 밝고, 뒤는 어둡다
  const sh = g.createRadialGradient(ca * R * 0.45, sa * R * 0.45 - R * 0.2, R * 0.1, 0, 0, R * 1.1);
  sh.addColorStop(0, "#7a8a72");
  sh.addColorStop(0.45, "#3e4a3c");
  sh.addColorStop(1, "#141a14");
  outline(1);
  g.fillStyle = sh;
  g.fill();
  g.save();
  outline(1);
  g.clip();
  // 얇아진 껍질 너머 비치는 초록 바이러스 (맥동)
  const pulse = 0.55 + 0.25 * Math.sin(t * 4);
  const inner = g.createRadialGradient(-R * 0.15, R * 0.1, 0, 0, 0, R * 0.9);
  inner.addColorStop(0, `rgba(170,255,190,${(pulse * 0.6).toFixed(2)})`);
  inner.addColorStop(1, "rgba(80,220,130,0)");
  g.fillStyle = inner;
  g.fillRect(-R, -R, R * 2, R * 2);
  // 바이러스 알갱이 (돌기 달린 작은 구)
  for (let i = 0; i < 5; i++) {
    const a = rot * 0.6 + i * 1.3;
    const vx = Math.cos(a) * R * 0.42;
    const vy = Math.sin(a * 1.2) * R * 0.36;
    g.fillStyle = `rgba(150,255,170,${(0.35 + pulse * 0.3).toFixed(2)})`;
    g.beginPath();
    g.arc(vx, vy, R * 0.12, 0, Math.PI * 2);
    g.fill();
  }
  // 크레이터
  for (const [cx2, cy2, cr] of [[-0.35, -0.3, 0.2], [0.3, 0.25, 0.16], [-0.1, 0.45, 0.12], [0.45, -0.25, 0.1]] as Array<[number, number, number]>) {
    const px = Math.cos(rot) * cx2 * R - Math.sin(rot) * cy2 * R;
    const py = Math.sin(rot) * cx2 * R + Math.cos(rot) * cy2 * R;
    g.fillStyle = "rgba(10,14,10,0.55)";
    g.beginPath();
    g.ellipse(px, py, cr * R, cr * R * 0.8, rot, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "rgba(160,180,150,0.35)";
    g.beginPath();
    g.ellipse(px + cr * R * 0.25, py + cr * R * 0.25, cr * R * 0.7, cr * R * 0.4, rot, 0, Math.PI);
    g.fill();
  }
  // 갈라진 틈으로 새어 나오는 초록빛
  g.strokeStyle = `rgba(170,255,190,${(0.6 + 0.35 * Math.sin(t * 6)).toFixed(2)})`;
  g.lineWidth = Math.max(0.5, R * 0.07);
  g.lineCap = "round";
  g.beginPath();
  g.moveTo(-R * 0.7, -R * 0.1);
  g.quadraticCurveTo(-R * 0.2, R * 0.05, R * 0.05, -R * 0.15);
  g.quadraticCurveTo(R * 0.35, -R * 0.4, R * 0.6, -R * 0.55);
  g.moveTo(R * 0.05, -R * 0.15);
  g.quadraticCurveTo(R * 0.15, R * 0.3, R * 0.05, R * 0.7);
  g.stroke();
  g.restore();
  // 달아오른 앞쪽 가장자리
  g.strokeStyle = "rgba(230,255,220,0.55)";
  g.lineWidth = Math.max(0.5, R * 0.1);
  g.beginPath();
  g.arc(0, 0, R * 0.98, ang - 1.1, ang + 1.1);
  g.stroke();
  g.restore();
}

/** 바깥에서 본 찰리네 창 (화면 좌표) */
const WIN = { x: 252, y: 118, w: 26, h: 34 };
function exteriorScene(t: number): void {
  // 밤하늘과 멀리 맨해튼
  sky([[0, "#05071a"], [0.65, "#141836"], [1, "#2a2440"]]);
  stars(61, 90, 120, 0);
  g.fillStyle = "#efe6cc";
  g.beginPath();
  g.arc(420, 40, 9, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "rgba(239,230,204,0.12)";
  g.beginPath();
  g.arc(420, 40, 18, 0, Math.PI * 2);
  g.fill();
  skyline(71, 205, 60, 150, "#151a34", 0.18, 0);
  skyline(72, 222, 40, 100, "#0e1226", 0.24, 30);
  // 찰리네 브라운스톤 (가운데) + 양옆 이웃 건물
  const r = rng(9);
  const bldg = (x0: number, w: number, top: number, col: string, mortar: string) => {
    g.fillStyle = col;
    g.fillRect(x0, top, w, H - top);
    for (let y = top; y < H; y += 3) {
      g.fillStyle = mortar;
      g.fillRect(x0, y, w, 0.5);
    }
    g.fillStyle = "#c8b89a";
    g.fillRect(x0 - 2, top - 4, w + 4, 4);
  };
  bldg(70, 120, 70, "#3e2a2a", "#33221f");
  bldg(330, 130, 60, "#2e3440", "#262b35");
  bldg(190, 140, 50, "#5a3a2c", "#4a2e22");
  // 이웃 창문들 (드문드문 불)
  for (const [x0, w, top] of [[70, 120, 70], [330, 130, 60]] as Array<[number, number, number]>) {
    for (let fy = top + 14; fy < 240; fy += 40) {
      for (let fx = x0 + 12; fx < x0 + w - 20; fx += 30) {
        const lit = r() < 0.3;
        g.fillStyle = "#c8b89a";
        g.fillRect(fx - 2, fy - 2, 22, 30);
        g.fillStyle = lit ? "#e8b860" : "#141a2a";
        g.fillRect(fx, fy, 18, 26);
        g.fillStyle = "#c8b89a";
        g.fillRect(fx + 8.5, fy, 1, 26);
        g.fillRect(fx, fy + 12.5, 18, 1);
      }
    }
  }
  // 찰리네 창문 줄: 3층 가운데 창만 따뜻하게 켜져 있다
  for (let fl = 0; fl < 4; fl++) {
    for (let i = 0; i < 3; i++) {
      const fx = 206 + i * 46;
      const fy = 64 + fl * 54;
      const isHome = fl === 1 && i === 1;
      g.fillStyle = "#d8c8a8";
      g.fillRect(fx - 3, fy - 5, WIN.w + 6, 5);
      g.fillRect(fx - 2, fy + WIN.h, WIN.w + 4, 3);
      if (isHome) {
        const lg = g.createLinearGradient(0, fy, 0, fy + WIN.h);
        lg.addColorStop(0, "#ffe2a8");
        lg.addColorStop(1, "#d8904a");
        g.fillStyle = lg;
      } else g.fillStyle = r() < 0.2 ? "#a8783a" : "#121828";
      g.fillRect(fx, fy, WIN.w, WIN.h);
      if (isHome) {
        // 커튼 자락
        g.fillStyle = "rgba(140,40,40,0.75)";
        g.fillRect(fx, fy, 4, WIN.h);
        g.fillRect(fx + WIN.w - 4, fy, 4, WIN.h);
        // 창턱에 앉은 샘의 그림자 (옅게, 꼬리 살랑)
        const cx = fx + WIN.w / 2 + 2;
        const cy = fy + WIN.h - 1;
        g.fillStyle = "rgba(60,30,20,0.32)";
        g.beginPath();
        g.ellipse(cx, cy - 4, 4, 4.5, 0, 0, Math.PI * 2);
        g.ellipse(cx, cy - 10, 3, 2.8, 0, 0, Math.PI * 2);
        g.fill();
        g.beginPath();
        g.moveTo(cx - 2.6, cy - 11);
        g.lineTo(cx - 2, cy - 14.5);
        g.lineTo(cx - 0.6, cy - 12.4);
        g.moveTo(cx + 2.6, cy - 11);
        g.lineTo(cx + 2, cy - 14.5);
        g.lineTo(cx + 0.6, cy - 12.4);
        g.fill();
        g.strokeStyle = "rgba(60,30,20,0.32)";
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(cx, cy);
        g.quadraticCurveTo(cx + 3 + Math.sin(t * 1.8) * 2, cy + 1, cx + 5 + Math.sin(t * 1.8) * 3, cy - 3);
        g.stroke();
        // 창밖으로 번지는 불빛
        const halo = g.createRadialGradient(fx + WIN.w / 2, fy + WIN.h / 2, 4, fx + WIN.w / 2, fy + WIN.h / 2, 40);
        halo.addColorStop(0, "rgba(255,210,140,0.18)");
        halo.addColorStop(1, "rgba(255,210,140,0)");
        g.fillStyle = halo;
        g.fillRect(fx - 40, fy - 40, WIN.w + 80, WIN.h + 80);
      }
      g.fillStyle = "#d8c8a8";
      g.fillRect(fx + WIN.w / 2 - 0.5, fy, 1, WIN.h);
      g.fillRect(fx, fy + WIN.h / 2 - 0.5, WIN.w, 1);
    }
  }
  // 비상계단
  g.fillStyle = "#101014";
  for (let fl = 0; fl < 3; fl++) {
    const y = 104 + fl * 54;
    g.fillRect(186, y, 4, 1.5);
    for (let k2 = 0; k2 < 3; k2++) g.fillRect(186 + k2 * 1.5, y - 6, 0.5, 6);
  }
  // 거리: 가로등 불빛
  const lamp = g.createRadialGradient(150, 250, 0, 150, 250, 70);
  lamp.addColorStop(0, "rgba(255,220,150,0.22)");
  lamp.addColorStop(1, "rgba(255,220,150,0)");
  g.fillStyle = lamp;
  g.fillRect(80, 180, 140, 90);
  g.fillStyle = "#0c0c12";
  g.fillRect(149, 200, 2, 70);
  g.fillRect(144, 198, 10, 2);
  g.fillStyle = "#fff0c0";
  g.fillRect(145, 200, 4, 2);
}

/** 운석 꼬리에서 흩날리는 불티 */
function sparks(x: number, y: number, ang: number, t: number, size: number): void {
  for (let i = 0; i < 10; i++) {
    const kk = (t * 1.3 + i / 10) % 1;
    const d = kk * 60 * size * 0.5;
    const off = Math.sin(i * 12.9) * 6 * kk;
    g.fillStyle = `rgba(${i % 3 ? "170,255,190" : "255,240,200"},${(1 - kk).toFixed(2)})`;
    g.fillRect(x - Math.cos(ang) * d - Math.sin(ang) * off, y - Math.sin(ang) * d + Math.cos(ang) * off, 1, 1);
  }
}

/** 창가 장면: 방 안 벽, 알맞은 크기의 창문, 창턱 위 뒷모습의 샘 */
function windowScene(t: number): void {
  // 방 벽 (어두운 벽지)
  g.fillStyle = "#231816";
  g.fillRect(0, 0, W, H);
  for (let x = 0; x < W; x += 12) {
    g.fillStyle = "rgba(255,220,180,0.03)";
    g.fillRect(x, 0, 5, H);
  }
  // 방 안의 따뜻한 스탠드 불빛 (왼쪽)
  const lamp = g.createRadialGradient(60, 150, 0, 60, 150, 170);
  lamp.addColorStop(0, "rgba(255,200,130,0.18)");
  lamp.addColorStop(1, "rgba(255,200,130,0)");
  g.fillStyle = lamp;
  g.fillRect(0, 0, W, H);
  // 창문: 가로 150 × 세로 132 (고양이 앉은 키의 약 3배)
  const wx = 165;
  const wy = 40;
  const ww = 150;
  const wh = 132;
  g.save();
  g.beginPath();
  g.rect(wx, wy, ww, wh);
  g.clip();
  const sk = g.createLinearGradient(0, wy, 0, wy + wh);
  sk.addColorStop(0, "#070a1e");
  sk.addColorStop(0.7, "#1c1e40");
  sk.addColorStop(1, "#3a2c4a");
  g.fillStyle = sk;
  g.fillRect(wx, wy, ww, wh);
  const r = rng(51);
  for (let i = 0; i < 60; i++) {
    const tw = 0.5 + 0.5 * Math.sin(clock.t * (1 + r() * 2) + i);
    g.fillStyle = `rgba(230,230,255,${(0.3 + tw * 0.6).toFixed(2)})`;
    g.fillRect(wx + r() * ww, wy + r() * 70, 0.5, 0.5);
  }
  // 달
  g.fillStyle = "#f4ead0";
  g.beginPath();
  g.arc(wx + 118, wy + 26, 8, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "rgba(244,234,208,0.12)";
  g.beginPath();
  g.arc(wx + 118, wy + 26, 16, 0, Math.PI * 2);
  g.fill();
  // 야경: 멀고 가까운 빌딩 세 줄 (불빛이 깜빡인다)
  g.translate(wx, 0);
  skylineIn(61, wy + wh + 2, 30, 70, "#141832", 0.18, ww, t);
  skylineIn(62, wy + wh + 2, 18, 50, "#0d1024", 0.26, ww, t);
  skylineIn(63, wy + wh + 2, 8, 28, "#07080f", 0.32, ww, t);
  g.restore();
  // 유리 반사
  g.fillStyle = "rgba(255,255,255,0.05)";
  g.beginPath();
  g.moveTo(wx + 10, wy);
  g.lineTo(wx + 40, wy);
  g.lineTo(wx + 10, wy + 60);
  g.fill();
  // 창틀과 십자 창살
  g.fillStyle = "#e4dccc";
  g.fillRect(wx - 6, wy - 6, ww + 12, 6);
  g.fillRect(wx - 6, wy, 6, wh);
  g.fillRect(wx + ww, wy, 6, wh);
  g.fillRect(wx + ww / 2 - 2, wy, 4, wh);
  g.fillRect(wx, wy + 58, ww, 4);
  g.fillStyle = "#b8ae9c";
  g.fillRect(wx - 6, wy - 1, ww + 12, 1);
  // 창턱
  g.fillStyle = "#efe8da";
  g.fillRect(wx - 14, wy + wh, ww + 28, 6);
  g.fillStyle = "#b8ae9c";
  g.fillRect(wx - 14, wy + wh + 6, ww + 28, 3);
  // 커튼
  for (const [cx, dir] of [[wx - 22, 1], [wx + ww + 6, -1]] as Array<[number, number]>) {
    for (let i = 0; i < 4; i++) {
      g.fillStyle = i % 2 ? "#6a1e26" : "#7e2630";
      g.fillRect(cx + i * 4, wy - 12, 4, wh + 40);
    }
    g.fillStyle = "#4a141a";
    g.fillRect(dir > 0 ? cx + 15 : cx, wy - 12, 1, wh + 40);
  }
  g.fillStyle = "#2a2a2a";
  g.fillRect(wx - 30, wy - 16, ww + 60, 3);
  // 창턱의 작은 화분
  g.fillStyle = "#a85a3a";
  g.fillRect(wx + 6, wy + wh - 10, 12, 10);
  g.fillStyle = "#3a7a3a";
  g.beginPath();
  g.ellipse(wx + 12, wy + wh - 14, 8, 6, 0, 0, Math.PI * 2);
  g.fill();
  // 샘: 창턱 위 뒷모습 (앉은 키 약 44)
  cuteCatBack(wx + ww / 2 + 22, wy + wh, 1, t);
  // 창턱 아래 라디에이터와 바닥
  g.fillStyle = "#3a302c";
  g.fillRect(wx + 10, wy + wh + 14, ww - 20, 40);
  for (let x = wx + 14; x < wx + ww - 14; x += 8) {
    g.fillStyle = "#4a3e38";
    g.fillRect(x, wy + wh + 16, 5, 36);
  }
  g.fillStyle = "#140c0a";
  g.fillRect(0, 236, W, H - 236);
}

/** 창 안쪽 폭에 맞춘 빌딩 줄 */
function skylineIn(seed: number, base: number, minH: number, maxH: number, col: string, lit: number, width: number, t: number): void {
  const r = rng(seed);
  let x = -10;
  while (x < width + 10) {
    const w = 10 + r() * 22;
    const h = minH + r() * (maxH - minH);
    g.fillStyle = col;
    g.fillRect(x, base - h, w, h + 2);
    if (r() < 0.2) {
      g.fillRect(x + w / 2 - 2, base - h - 8, 4, 8);
      g.fillRect(x + w / 2 - 0.5, base - h - 18, 1, 10);
      if (Math.floor(t * 1.5 + seed) % 2) {
        g.fillStyle = "#ff4a4a";
        g.fillRect(x + w / 2 - 0.5, base - h - 19, 1, 1);
      }
    }
    for (let wy = base - h + 3; wy < base - 2; wy += 4) {
      for (let wx = x + 2; wx < x + w - 2; wx += 3) {
        const v = r();
        if (v < lit) {
          const blink = v < lit * 0.08 && Math.sin(t * 0.8 + wx * 3 + wy) > 0.6;
          g.fillStyle = blink ? "#3a3020" : v < lit * 0.5 ? "#ffd27a" : "#f4e4b0";
          g.fillRect(wx, wy, 1, 1.5);
        }
      }
    }
    x += w + r() * 2;
  }
}

/** 부드럽고 동글동글한 샘 뒷모습 (애니메이션용). 발 가운데 (x, y), 크기 s */
export function cuteCatBack(x: number, y: number, s: number, t: number): void {
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  const tilt = Math.sin(t * 0.7) * 0.08;
  const fur = g.createLinearGradient(-14, -44, 14, 0);
  fur.addColorStop(0, "#ffffff");
  fur.addColorStop(1, "#d6dae6");
  // 몸통: 아래가 넓은 물방울 (등을 보이고 앉음)
  g.fillStyle = fur;
  g.beginPath();
  g.moveTo(0, -30);
  g.bezierCurveTo(10, -30, 15, -16, 15, -6);
  g.bezierCurveTo(15, 0, 9, 1, 0, 1);
  g.bezierCurveTo(-9, 1, -15, 0, -15, -6);
  g.bezierCurveTo(-15, -16, -10, -30, 0, -30);
  g.fill();
  // 부드러운 명암: 아래쪽 그늘, 오른쪽 위 달빛
  const sh = g.createLinearGradient(0, -14, 0, 1);
  sh.addColorStop(0, "rgba(150,160,190,0)");
  sh.addColorStop(1, "rgba(150,160,190,0.22)");
  g.fillStyle = sh;
  g.beginPath();
  g.ellipse(0, -5, 14.5, 6, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "rgba(190,210,255,0.3)";
  g.beginPath();
  g.ellipse(9, -18, 3, 9, 0.3, 0, Math.PI * 2);
  g.fill();
  // 꼬리: 엉덩이 한가운데에서 나와 창턱 위를 좌우로 살랑
  const sw = Math.sin(t * 1.8);
  const tip = Math.sin(t * 1.8 - 0.7);
  g.lineCap = "round";
  for (const [w, c] of [[5, "#dfe3ec"], [3.4, "#ffffff"]] as Array<[number, string]>) {
    g.strokeStyle = c;
    g.lineWidth = w;
    g.beginPath();
    g.moveTo(0, -1);
    g.bezierCurveTo(sw * 6, 1.5, sw * 14, 1.5, sw * 18 + tip * 2, -3 - Math.abs(tip) * 4);
    g.stroke();
  }
  // 머리 (살짝 갸웃): 뒤에서는 귀의 바깥쪽 털만 보인다
  g.save();
  g.translate(0, -32);
  g.rotate(tilt);
  const ear = (dir: number, twitch: number) => {
    g.save();
    g.translate(dir * 6, -6);
    g.rotate(dir * (0.25 + twitch));
    g.fillStyle = "#eef0f6";
    g.beginPath();
    g.moveTo(-4.5, 2);
    g.quadraticCurveTo(-1.5, -9, 0, -10);
    g.quadraticCurveTo(1.5, -9, 4.5, 2);
    g.fill();
    // 귀 뒷면의 옅은 결 (분홍 안쪽은 보이지 않음)
    g.fillStyle = "rgba(170,178,200,0.35)";
    g.beginPath();
    g.moveTo(-1, 1);
    g.quadraticCurveTo(0, -6, 0.3, -7);
    g.quadraticCurveTo(0.8, -5, 1, 1);
    g.fill();
    g.restore();
  };
  const tw = (Math.floor(t * 0.8) % 4 === 0 ? Math.max(0, Math.sin(t * 12)) : 0) * 0.25;
  ear(-1, 0);
  ear(1, tw);
  g.fillStyle = "#fbfbfe";
  g.beginPath();
  g.ellipse(0, 0, 10, 8.5, 0, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.ellipse(-6.5, 3, 5, 4, 0, 0, Math.PI * 2);
  g.ellipse(6.5, 3, 5, 4, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "rgba(160,170,200,0.2)";
  g.beginPath();
  g.ellipse(0, 6, 8, 2.5, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();
  g.restore();
}

// ── 샘의 기억 (최종장) ───────────────────────────────────────
let alleyBg: HTMLCanvasElement | null = null;
export function memoryShots(): Shot[] {
  return [
    {
      dur: 6,
      text: "「아주 먼 별. 고양이들이 사는 초록빛 별에서」",
      draw: (t, k) => {
        sky([[0, "#020308"], [1, "#081018"]]);
        stars(31, 200, H, t * 3);
        // 행성
        const px = 240;
        const py = 330 - ease(Math.min(1, k * 1.5)) * 40;
        const pg = g.createRadialGradient(px - 60, py - 120, 20, px, py, 220);
        pg.addColorStop(0, "#9af0b8");
        pg.addColorStop(0.5, "#3a9a6a");
        pg.addColorStop(1, "#0a2a1e");
        g.fillStyle = pg;
        g.beginPath();
        g.arc(px, py, 200, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = "rgba(200,255,220,0.35)";
        g.lineWidth = 3;
        g.beginPath();
        g.ellipse(px, py - 40, 280, 40, -0.12, Math.PI * 1.05, Math.PI * 1.95);
        g.stroke();
        // 지평선 위 고양이들
        for (let i = 0; i < 9; i++) {
          const a = -Math.PI / 2 + (i - 4) * 0.14;
          catSilhouette(px + Math.cos(a) * 200, py + Math.sin(a) * 200 + 1, 1.2, t * 2 + i);
        }
        // 작은 빛 덩어리가 떠난다
        if (k > 0.45) {
          const kk = ease((k - 0.45) / 0.55);
          const x = lerp(260, 420, kk);
          const y = lerp(py - 210, 20, kk);
          meteor(x, y, Math.atan2(-190, 160) + Math.PI, 40 * kk + 6, 1.6);
        }
      },
    },
    {
      dur: 5,
      text: "「작은 아이 하나가 길을 잃고, 낯선 별로 떨어졌다」",
      draw: (t, k) => {
        sky([[0, "#0e1424"], [1, lerp(0, 1, k) > 0.5 ? "#2a2a40" : "#1a1e30"]]);
        // 구름을 뚫고
        for (let i = 0; i < 14; i++) {
          const y = ((i * 41 - t * 160) % (H + 80)) + H + 40;
          const yy = y > H + 40 ? y - (H + 80) : y;
          g.fillStyle = `rgba(${60 + (i % 3) * 10},${66 + (i % 3) * 10},${90 + (i % 3) * 10},0.75)`;
          g.beginPath();
          g.ellipse((i * 97) % W, yy, 70 + (i % 4) * 20, 14, 0, 0, Math.PI * 2);
          g.fill();
        }
        if (k > 0.5) skyline(41, H + 20, 40, 120, `rgba(10,12,24,${((k - 0.5) * 2).toFixed(2)})`, 0.15, 0);
        meteor(240 + Math.sin(t * 3) * 6, 120 + k * 30, Math.PI / 2, 70, 2);
        rain(0.25 + k * 0.2, 1.3, 0.1);
      },
    },
    {
      dur: 7.5,
      text: "「...야, 너 혼자야? 비 맞으면 감기 걸려. 우리 집 갈래?」",
      draw: (t, k) => {
        if (!alleyBg) alleyBg = buildAlley();
        const cam = lerp(60, 110, ease(k));
        g.drawImage(alleyBg, cam * PIX, 0, W * PIX, H * PIX, 0, 0, W, H);
        g.fillStyle = "rgba(10,14,30,0.45)";
        g.fillRect(0, 0, W, H);
        void ALLEY;
        // 가로등 빛
        const lg = g.createRadialGradient(250, 120, 0, 250, 120, 160);
        lg.addColorStop(0, "rgba(255,220,160,0.25)");
        lg.addColorStop(1, "rgba(255,220,160,0)");
        g.fillStyle = lg;
        g.fillRect(0, 0, W, H);
        // 상자 속 아기 고양이
        const bx = 250;
        g.fillStyle = "#8a6a3a";
        g.fillRect(bx - 22, 196, 44, 18);
        g.fillStyle = "#6a4e2a";
        g.fillRect(bx - 22, 196, 44, 2);
        g.fillStyle = "#a8844a";
        g.beginPath();
        g.moveTo(bx - 22, 196);
        g.lineTo(bx - 30, 186);
        g.lineTo(bx - 14, 190);
        g.fill();
        const kit = cat(k > 0.6 ? "startle" : "loaf", -1);
        g.imageSmoothingEnabled = true;
        g.drawImage(kit, bx - 12, 182, 24, 18);
        // 찰리가 다가와 우산을 씌운다
        const cx = lerp(420, 284, ease(Math.min(1, k * 1.8)));
        const pose = k < 0.55 ? `walk${Math.floor(t * 8) % 16}` : "crouch0";
        g.drawImage(human(CHARLIE, "charlie", pose, BUILD_3, -1), cx - 21, 214 - 52, 36, 54);
        g.imageSmoothingEnabled = false;
        const ux = cx - 8 - (k > 0.55 ? ease((k - 0.55) / 0.45) * 22 : 0);
        g.strokeStyle = "#2a2a30";
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(cx - 4, 190);
        g.lineTo(ux, 150);
        g.stroke();
        g.fillStyle = "#c83a3a";
        g.beginPath();
        g.ellipse(ux, 150, 26, 9, 0, Math.PI, 0);
        g.fill();
        g.fillStyle = "#e85a5a";
        g.beginPath();
        g.ellipse(ux - 6, 147, 12, 4, 0, Math.PI, 0);
        g.fill();
        rain(0.35, 1, 0.25);
        // 우산 아래는 비가 없다
        if (k > 0.75) {
          g.fillStyle = "rgba(255,200,210,0.6)";
          const hy = 176 - ((t * 10) % 12);
          g.beginPath();
          g.moveTo(bx, hy + 2);
          g.arc(bx - 1.2, hy, 1.4, Math.PI, 0);
          g.arc(bx + 1.2, hy, 1.4, Math.PI, 0);
          g.lineTo(bx, hy + 3);
          g.fill();
        }
      },
    },
  ];
}

// ── 엔딩 영상 ────────────────────────────────────────────
export function farewellShots(stay: boolean): Shot[] {
  return [
    {
      dur: 6.5,
      text: "초록빛 비가 도시를 적시자, 먼지가 하나둘 빛이 되어 하늘로 돌아갔다.",
      draw: (t, k) => {
        const dawn = ease(k);
        sky([[0, `rgb(${lerp(8, 60, dawn)},${lerp(12, 80, dawn)},${lerp(30, 140, dawn)})`], [1, `rgb(${lerp(30, 255, dawn)},${lerp(30, 170, dawn)},${lerp(60, 120, dawn)})`]]);
        stars(51, 80, 120 * (1 - dawn), 0);
        drawUfoAt(lerp(240, 300, dawn), lerp(90, -30, dawn), lerp(1, 0.35, dawn));
        skyline(52, 230, 50, 150, "#141428", 0.15 * (1 - dawn), 0);
        skyline(53, 275, 30, 100, "#0a0a16", 0.2 * (1 - dawn), 0);
        // 위로 올라가는 빛 알갱이
        for (let i = 0; i < 70; i++) {
          const kk = (t * 0.25 + i / 70) % 1;
          const x = (i * 73.1) % W + Math.sin(t + i) * 4;
          const y = H - kk * H * 1.1;
          g.fillStyle = `rgba(170,255,200,${(Math.sin(kk * Math.PI) * 0.9).toFixed(2)})`;
          g.fillRect(x, y, 1, 1);
        }
      },
    },
    stay
      ? {
          dur: 6,
          text: "그리고 뉴욕에, 아주 오랜만에 평범한 아침이 왔다.",
          draw: (t, k) => {
            sky([[0, "#8ab8e8"], [0.6, "#f8c890"], [1, "#ffb070"]]);
            const sy = lerp(260, 200, ease(k));
            const sg = g.createRadialGradient(240, sy, 0, 240, sy, 140);
            sg.addColorStop(0, "rgba(255,250,220,1)");
            sg.addColorStop(0.15, "rgba(255,220,150,0.8)");
            sg.addColorStop(1, "rgba(255,200,120,0)");
            g.fillStyle = sg;
            g.fillRect(0, 0, W, H);
            skyline(61, 240, 40, 140, "#3a3a5a", 0.05, t * 3, "#ffe8b0");
            g.fillStyle = "#4a6a9a";
            g.fillRect(0, 240, W, H - 240);
            for (let i = 0; i < 40; i++) {
              g.fillStyle = `rgba(255,230,180,${(0.3 + 0.3 * Math.sin(t * 2 + i)).toFixed(2)})`;
              g.fillRect((i * 53) % W, 244 + (i * 7) % 24, 6, 0.6);
            }
            // 날아가는 새
            for (let i = 0; i < 4; i++) {
              const bx = ((t * 30 + i * 60) % (W + 40)) - 20;
              const by = 90 + i * 10 + Math.sin(t * 3 + i) * 3;
              g.strokeStyle = "#3a3a4a";
              g.lineWidth = 0.8;
              g.beginPath();
              g.moveTo(bx - 4, by - Math.abs(Math.sin(t * 8 + i)) * 2);
              g.lineTo(bx, by);
              g.lineTo(bx + 4, by - Math.abs(Math.sin(t * 8 + i)) * 2);
              g.stroke();
            }
          },
        }
      : {
          dur: 6,
          text: "그날 이후, 뉴욕의 밤하늘에는 초록 별 하나가 늘었다.",
          draw: (t, k) => {
            sky([[0, "#02030a"], [1, "#141830"]]);
            stars(71, 200, H, 0);
            const a = ease(k);
            const pulse = 0.6 + 0.4 * Math.sin(t * 3);
            const sg = g.createRadialGradient(330, 70, 0, 330, 70, 30);
            sg.addColorStop(0, `rgba(200,255,220,${(a * pulse).toFixed(2)})`);
            sg.addColorStop(1, "rgba(120,255,170,0)");
            g.fillStyle = sg;
            g.fillRect(290, 30, 80, 80);
            g.fillStyle = `rgba(230,255,235,${a.toFixed(2)})`;
            g.fillRect(329.5, 69.5, 1.5, 1.5);
            skyline(72, 275, 40, 130, "#06070e", 0.2, 0);
            // 창가에 앉은 찰리 실루엣
            g.fillStyle = "#06070e";
            g.fillRect(60, 200, 70, 75);
            g.imageSmoothingEnabled = true;
            g.globalAlpha = 0.9;
            g.drawImage(human(CHARLIE, "charlie", "back", BUILD_3, 1), 80, 150, 36, 54);
            g.globalAlpha = 1;
            g.imageSmoothingEnabled = false;
          },
        },
  ];
}

// ── 비밀 엔딩: 지구의 모든 고양이가 하늘로 ──────────────────────
export function catsRiseShots(): Shot[] {
  const cols = ["#f0a050", "#3a3a44", "#c8a878", "#e8e0d0", "#8a8aa0", "#b86a3a", "#ffffff"];
  return [
    {
      dur: 7,
      text: "그날 밤, 지구의 모든 고양이가 초록빛을 타고 하늘로 올라갔다.",
      draw: (t, k) => {
        sky([[0, "#04060e"], [1, "#16203a"]]);
        stars(81, 140, H, 0);
        drawUfoAt(240, 40, 1.4);
        // 빛기둥들
        for (const bx of [80, 200, 330, 430]) {
          const gr = g.createLinearGradient(0, 50, 0, H);
          gr.addColorStop(0, "rgba(160,255,190,0.25)");
          gr.addColorStop(1, "rgba(120,255,170,0.06)");
          g.fillStyle = gr;
          g.beginPath();
          g.moveTo(240 - 10, 50);
          g.lineTo(240 + 10, 50);
          g.lineTo(bx + 24, H);
          g.lineTo(bx - 24, H);
          g.fill();
        }
        skyline(82, 275, 40, 130, "#080a14", 0.18, 0);
        // 떠오르는 고양이들
        g.imageSmoothingEnabled = true;
        for (let i = 0; i < 26; i++) {
          const p = (k * 1.3 + i / 26) % 1;
          const lane = [80, 200, 330, 430][i % 4];
          const x = lane + (240 - lane) * p + Math.sin(t * 2 + i) * 6;
          const y = 250 - p * 200;
          const s = 1 - p * 0.6;
          g.globalAlpha = Math.min(1, (1 - p) * 2);
          g.drawImage(tintCat(i % 3 ? `sitT${(i + Math.floor(t * 5)) % 8}` : "jump", i % 2 ? 1 : -1, cols[i % cols.length], true), x - 16 * s, y - 12 * s, 32 * s, 24 * s);
        }
        g.globalAlpha = 1;
        g.imageSmoothingEnabled = false;
      },
    },
    {
      dur: 6,
      text: "「고마웠다, 인간들. 고양이는 우리가 잘 키우겠다. 츄르도 챙겨 가겠다.」",
      draw: (t, k) => {
        sky([[0, "#02030a"], [1, "#0c1020"]]);
        stars(83, 220, H, t * 4);
        const e = ease(k);
        drawUfoAt(lerp(240, 420, e), lerp(120, 30, e), lerp(1.2, 0.25, e));
      },
    },
  ];
}

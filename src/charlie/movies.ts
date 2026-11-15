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
  return [
    {
      // 1. 은하수 저편에서 지구를 향해 다가오는 초록 운석
      dur: 7,
      text: "그날 밤, 은하수 저편에서 초록빛 하나가 지구를 향해 다가오고 있었다.",
      draw: (t, k) => {
        sky([[0, "#010108"], [1, "#05061a"]]);
        milkyWay(t);
        const e = ease(k);
        // 지구: 오른쪽 아래에서 천천히 커진다
        const er = lerp(118, 132, e);
        earth(392, 268, er, t);
        // 운석: 왼쪽 위 → 지구 대기권 가장자리
        const mx = lerp(40, 300, e);
        const my = lerp(26, 168, e);
        const sz = lerp(1.2, 2.6, e);
        meteor(mx, my, Math.atan2(142, 260), lerp(40, 110, e), sz);
        sparks(mx, my, Math.atan2(142, 260), t, sz);
        if (k > 0.85) {
          g.fillStyle = `rgba(160,255,190,${((k - 0.85) / 0.15) * 0.35})`;
          g.fillRect(0, 0, W, H);
        }
      },
    },
    {
      // 2. 밤하늘을 가르는 운석 (아직 도시에 닿지 않는다)
      dur: 6,
      text: "초록빛 꼬리가 밤하늘을 길게 갈랐다.",
      draw: (t, k) => {
        sky([[0, "#03040e"], [0.6, "#0c1030"], [1, "#1e1c3c"]]);
        milkyWay(t * 0.3, 0.55);
        stars(41, 160, 200, 0);
        // 엷은 구름
        for (let i = 0; i < 4; i++) {
          const cx = ((i * 157 + t * 6) % (W + 200)) - 100;
          const gr = g.createRadialGradient(cx, 170 + i * 12, 0, cx, 170 + i * 12, 90);
          gr.addColorStop(0, "rgba(60,60,100,0.28)");
          gr.addColorStop(1, "rgba(60,60,100,0)");
          g.fillStyle = gr;
          g.fillRect(cx - 90, 80 + i * 12, 180, 180);
        }
        // 지평선 너머 아득한 도시 불빛
        const hz = g.createLinearGradient(0, 220, 0, H);
        hz.addColorStop(0, "rgba(255,190,120,0)");
        hz.addColorStop(1, "rgba(255,190,120,0.28)");
        g.fillStyle = hz;
        g.fillRect(0, 220, W, H - 220);
        skyline(42, H + 2, 6, 22, "#05060c", 0.25, 0, "#c89a5a");
        const e = ease(k);
        const ang = Math.atan2(70, 520);
        const mx = lerp(-40, 520, e);
        const my = lerp(40, 110, e);
        meteor(mx, my, ang, 180, 2.2);
        sparks(mx, my, ang, t, 2.2);
        // 하늘이 잠깐 초록빛으로 물든다
        const glow = g.createRadialGradient(mx, my, 0, mx, my, 160);
        glow.addColorStop(0, "rgba(140,255,170,0.14)");
        glow.addColorStop(1, "rgba(140,255,170,0)");
        g.fillStyle = glow;
        g.fillRect(0, 0, W, H);
      },
    },
    {
      // 3. 창가에서 야경을 바라보는 샘 (운석은 없다)
      dur: 7,
      text: "뉴욕의 한 아파트 창가. 샘은 오늘도 도시의 불빛을 바라보고 있었다.",
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

/** 은하수: 비스듬한 빛의 띠와 촘촘한 별 */
function milkyWay(t: number, a = 1): void {
  g.save();
  g.translate(W / 2, H / 2);
  g.rotate(-0.42);
  for (const [w, c] of [[110, `rgba(120,110,190,${0.16 * a})`], [60, `rgba(200,170,220,${0.14 * a})`], [24, `rgba(255,230,210,${0.12 * a})`]] as Array<[number, string]>) {
    const gr = g.createLinearGradient(0, -w, 0, w);
    gr.addColorStop(0, "rgba(0,0,0,0)");
    gr.addColorStop(0.5, c);
    gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr;
    g.fillRect(-W, -w, W * 2, w * 2);
  }
  // 어두운 먼지 띠
  const dg = g.createLinearGradient(0, -10, 0, 14);
  dg.addColorStop(0, "rgba(2,2,10,0)");
  dg.addColorStop(0.5, `rgba(2,2,10,${0.45 * a})`);
  dg.addColorStop(1, "rgba(2,2,10,0)");
  g.fillStyle = dg;
  g.fillRect(-W, -10, W * 2, 24);
  const r = rng(77);
  for (let i = 0; i < 520; i++) {
    const x = (r() - 0.5) * W * 2;
    const y = (r() + r() + r() - 1.5) * 60;
    const tw = 0.6 + 0.4 * Math.sin(clock.t * (1 + r() * 2) + i);
    g.fillStyle = `rgba(${r() < 0.3 ? "255,236,210" : "210,215,255"},${(tw * a * (r() < 0.1 ? 1 : 0.6)).toFixed(2)})`;
    g.fillRect(x - t * 0.5, y, r() < 0.06 ? 1 : 0.5, r() < 0.06 ? 1 : 0.5);
  }
  g.restore();
  stars(43, 140, H, t * 0.5);
}

/** 우주에서 본 지구: 바다·대륙·구름·밤의 도시 불빛·대기 */
function earth(x: number, y: number, r: number, t: number): void {
  const atm = g.createRadialGradient(x, y, r * 0.96, x, y, r * 1.14);
  atm.addColorStop(0, "rgba(110,180,255,0.55)");
  atm.addColorStop(1, "rgba(110,180,255,0)");
  g.fillStyle = atm;
  g.beginPath();
  g.arc(x, y, r * 1.14, 0, Math.PI * 2);
  g.fill();
  g.save();
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.clip();
  const sea = g.createRadialGradient(x - r * 0.4, y - r * 0.5, r * 0.1, x, y, r);
  sea.addColorStop(0, "#3a7ac8");
  sea.addColorStop(1, "#0c2a5a");
  g.fillStyle = sea;
  g.fillRect(x - r, y - r, r * 2, r * 2);
  const rr = rng(91);
  const rot = t * 2;
  for (let i = 0; i < 14; i++) {
    const cx = x - r + ((rr() * r * 2 + rot) % (r * 2));
    const cy = y - r + rr() * r * 1.2;
    g.fillStyle = rr() < 0.5 ? "#4a7a3a" : "#7a7a4a";
    g.beginPath();
    g.ellipse(cx, cy, 8 + rr() * 22, 5 + rr() * 12, rr() * 3, 0, Math.PI * 2);
    g.fill();
  }
  for (let i = 0; i < 16; i++) {
    const cx = x - r + ((rr() * r * 2 + rot * 1.6) % (r * 2));
    const cy = y - r + rr() * r * 1.3;
    g.fillStyle = "rgba(240,246,255,0.55)";
    g.beginPath();
    g.ellipse(cx, cy, 10 + rr() * 26, 2 + rr() * 4, -0.2, 0, Math.PI * 2);
    g.fill();
  }
  // 밤 쪽 그림자와 도시 불빛
  const sh = g.createLinearGradient(x - r * 0.2, 0, x + r * 0.7, 0);
  sh.addColorStop(0, "rgba(2,4,14,0)");
  sh.addColorStop(1, "rgba(2,4,14,0.88)");
  g.fillStyle = sh;
  g.fillRect(x - r, y - r, r * 2, r * 2);
  for (let i = 0; i < 70; i++) {
    const px = x + r * 0.2 + rr() * r * 0.8;
    const py = y - r + rr() * r * 1.1;
    g.fillStyle = `rgba(255,210,130,${(0.4 + rr() * 0.5).toFixed(2)})`;
    g.fillRect(px, py, 0.5, 0.5);
  }
  g.restore();
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
  const sway = Math.sin(t * 1.6);
  const tilt = Math.sin(t * 0.7) * 0.08;
  const fur = g.createLinearGradient(-14, -44, 14, 0);
  fur.addColorStop(0, "#ffffff");
  fur.addColorStop(1, "#d6dae6");
  // 꼬리: 창턱 아래로 늘어뜨려 끝만 살랑
  g.strokeStyle = "#e8ebf2";
  g.lineCap = "round";
  g.lineWidth = 5;
  g.beginPath();
  g.moveTo(8, -3);
  g.bezierCurveTo(18, -2, 22, 4, 20 + sway * 2, 14);
  g.stroke();
  g.strokeStyle = "#ffffff";
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(8, -4);
  g.bezierCurveTo(17, -3, 21, 3, 19 + sway * 2, 12);
  g.stroke();
  // 몸통: 아래가 넓은 물방울
  g.fillStyle = fur;
  g.beginPath();
  g.moveTo(0, -30);
  g.bezierCurveTo(10, -30, 15, -16, 15, -6);
  g.bezierCurveTo(15, 0, 9, 1, 0, 1);
  g.bezierCurveTo(-9, 1, -15, 0, -15, -6);
  g.bezierCurveTo(-15, -16, -10, -30, 0, -30);
  g.fill();
  // 등줄기 그림자와 달빛 테두리
  g.fillStyle = "rgba(150,160,190,0.18)";
  g.beginPath();
  g.ellipse(0, -10, 4, 13, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "rgba(190,210,255,0.35)";
  g.beginPath();
  g.ellipse(9, -18, 3, 9, 0.3, 0, Math.PI * 2);
  g.fill();
  // 머리 (살짝 갸웃)
  g.save();
  g.translate(0, -32);
  g.rotate(tilt);
  // 귀: 둥근 끝의 삼각형, 안쪽 분홍이 살짝
  const ear = (dir: number, twitch: number) => {
    g.save();
    g.translate(dir * 6, -6);
    g.rotate(dir * (0.25 + twitch));
    g.fillStyle = "#f4f5fa";
    g.beginPath();
    g.moveTo(-4.5, 2);
    g.quadraticCurveTo(-1.5, -9, 0, -10);
    g.quadraticCurveTo(1.5, -9, 4.5, 2);
    g.fill();
    g.fillStyle = "#f2b8c6";
    g.beginPath();
    g.moveTo(dir * 1.2 - 1.5, 0);
    g.quadraticCurveTo(dir * 1.2, -6, dir * 1.2 + 0.6, -7);
    g.quadraticCurveTo(dir * 1.2 + 1.5, -4, dir * 1.2 + 1.5, 0);
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
  // 볼살 (뒤에서 보이는 동글한 뺨)
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

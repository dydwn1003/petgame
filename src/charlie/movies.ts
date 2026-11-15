// 애니메이션 컷: 오프닝 · 샘의 기억 · 엔딩 영상
// 각 컷은 시간 t(초)와 진행도 k(0~1)를 받아 화면 전체를 그린다.
import { H, W, clock, g } from "./core";
import { ALLEY, BG_SCALE, buildAlley } from "./bg";
import { BUILD_3, CHARLIE, cat, human, tintCat } from "./sprites";
import { rng } from "./pixel";

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
const shotLen = 6.5;
export function introShots(): Shot[] {
  return [
    {
      dur: 6,
      text: "그날 밤, 하늘 저편에서 무언가가 떨어지고 있었다.",
      draw: (t, k) => {
        sky([[0, "#02030a"], [1, "#0a0c1e"]]);
        stars(11, 220, H, t * 6);
        // 멀리 초록 별
        g.fillStyle = "rgba(140,255,170,0.25)";
        g.beginPath();
        g.arc(400, 50, 6 + Math.sin(t * 2) * 1, 0, Math.PI * 2);
        g.fill();
        const e = ease(k);
        const mx = lerp(-60, 560, e);
        const my = lerp(30, 190, e);
        meteor(mx, my, Math.atan2(160, 620), 140, 2.4);
        for (let i = 0; i < 6; i++) {
          const kk = (t * 0.9 + i / 6) % 1;
          g.fillStyle = `rgba(255,220,160,${(1 - kk).toFixed(2)})`;
          g.fillRect(mx - kk * 70 - i * 3, my - kk * 18 + Math.sin(i * 7) * 6, 1, 1);
        }
      },
    },
    {
      dur: 6,
      text: "뉴욕. 잠들지 않는 도시.",
      draw: (t, k) => {
        sky([[0, "#060816"], [0.7, "#1a1c38"], [1, "#2e2848"]]);
        stars(12, 120, 120, 0);
        g.fillStyle = "#f4e8c8";
        g.beginPath();
        g.arc(390, 46, 12, 0, Math.PI * 2);
        g.fill();
        const pan = t * 8;
        skyline(21, 210, 60, 140, "#121630", 0.12, pan * 0.3);
        skyline(22, 235, 40, 110, "#0c0e22", 0.2, pan * 0.6);
        skyline(23, 275, 30, 80, "#07080f", 0.28, pan);
        const e = ease(k);
        meteor(lerp(80, 300, e), lerp(10, 120, e), 0.55, 50, 1.2);
      },
    },
    {
      dur: shotLen,
      text: "그 빛을 가장 먼저 알아챈 것은... 한 마리 고양이였다.",
      draw: (t, k) => {
        // 창밖 하늘
        sky([[0, "#0a0c1e"], [1, "#2a2648"]]);
        stars(13, 80, 160, 0);
        const e = ease(k);
        meteor(lerp(140, 330, e), lerp(30, 110, e), 0.5, 60, 1.4);
        // 창틀과 벽
        g.fillStyle = "#3a2420";
        g.fillRect(0, 0, 90, H);
        g.fillRect(W - 90, 0, 90, H);
        g.fillRect(0, 0, W, 24);
        g.fillStyle = "#2a1816";
        for (let y = 0; y < H; y += 8) {
          g.fillRect(0, y, 90, 0.5);
          g.fillRect(W - 90, y, 90, 0.5);
        }
        g.fillStyle = "#d8cfc0";
        g.fillRect(88, 22, 4, 200);
        g.fillRect(W - 92, 22, 4, 200);
        g.fillRect(238, 22, 4, 200);
        g.fillRect(88, 120, W - 176, 3);
        g.fillStyle = "#e8e0d0";
        g.fillRect(70, 218, W - 140, 8);
        g.fillStyle = "#b8ae9c";
        g.fillRect(70, 224, W - 140, 3);
        g.fillStyle = "#1a1012";
        g.fillRect(0, 227, W, H - 227);
        // 창턱 위의 샘: 꼬리를 살랑이다가 별똥별을 보고 귀를 쫑긋
        const spr = cat(`sitT${Math.floor(t * 6) % 8}`, -1);
        g.imageSmoothingEnabled = true;
        g.drawImage(spr, 300, 146, 96, 72);
        g.imageSmoothingEnabled = false;
        if (k > 0.5) {
          // 털에 비친 초록빛
          const gl = g.createRadialGradient(330, 170, 0, 330, 170, 40);
          gl.addColorStop(0, `rgba(140,255,170,${(0.18 + 0.08 * Math.sin(t * 6)).toFixed(2)})`);
          gl.addColorStop(1, "rgba(140,255,170,0)");
          g.fillStyle = gl;
          g.fillRect(290, 130, 80, 90);
          // 「!」
          const pt = (k - 0.5) * shotLen;
          const pop = pt < 0.15 ? (pt / 0.15) * 1.25 : pt < 0.25 ? 1.25 - (pt - 0.15) * 2.5 : 1;
          g.save();
          g.translate(318, 132);
          g.scale(pop, pop);
          g.fillStyle = "#0b0a0c";
          g.beginPath();
          g.ellipse(0, 0, 8, 7, 0, 0, Math.PI * 2);
          g.fill();
          g.fillStyle = "#f4ecff";
          g.beginPath();
          g.ellipse(0, 0, 7, 6, 0, 0, Math.PI * 2);
          g.fill();
          g.font = "bold 9px Galmuri11";
          g.textAlign = "center";
          g.textBaseline = "middle";
          g.fillStyle = "#e83a3a";
          g.fillText("!", 0, 0.5);
          g.restore();
        }
      },
    },
  ];
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
        g.drawImage(alleyBg, cam * BG_SCALE, 0, W * BG_SCALE, H * BG_SCALE, 0, 0, W, H);
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
          g.drawImage(tintCat(i % 3 ? `sitT${(i + Math.floor(t * 5)) % 8}` : "jump", i % 2 ? 1 : -1, cols[i % cols.length]), x - 16 * s, y - 12 * s, 32 * s, 24 * s);
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

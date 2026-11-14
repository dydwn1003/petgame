import "../fonts.css";
import "./style.css";
import { FONT, H, W, canvas, clock, fx, g, keys, mouse, pressed, render, tickScripts, unlockAudio, updateFx } from "./core";
import { setSpriteDensity } from "./sprites";
import { S, bakeIdle, debug, drawPlay, drawTitle, goScene, prewarm, update, updateTitle } from "./game";

const stage = document.getElementById("stage")!;

function resize(): void {
  const k = Math.min(window.innerWidth / W, window.innerHeight / H);
  const u = k >= 2 ? Math.floor(k) : k;
  stage.style.width = `${W * u}px`;
  stage.style.height = `${H * u}px`;
  // 캔버스는 실제 화면 도트 수에 맞춘다 (1080p = 4배, 1440p ≈ 5.3배, 4K = 8배)
  const dpr = window.devicePixelRatio || 1;
  const scale = Math.max(2, Math.min(8, u * dpr));
  canvas.width = Math.round(W * scale);
  canvas.height = Math.round(H * scale);
  render.scale = canvas.width / W;
}

function drawOverlays(): void {
  if (fx.card) {
    const k = (clock.t - fx.card.t0) / fx.card.dur;
    const a = Math.min(1, k * 4, (1 - k) * 4);
    g.globalAlpha = Math.max(0, a);
    g.fillStyle = "#000";
    g.fillRect(0, 100, W, 64);
    g.font = "bold 22px Galmuri11";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = "#ebc24a";
    g.fillText(fx.card.title, W / 2, 122);
    g.font = FONT;
    g.fillStyle = "#d8d0e0";
    g.fillText(fx.card.sub, W / 2, 146);
    g.globalAlpha = 1;
  }
  if (fx.flash > 0) {
    g.globalAlpha = Math.min(1, fx.flash) * 0.8;
    g.fillStyle = fx.flashColor;
    g.fillRect(0, 0, W, H);
    g.globalAlpha = 1;
  }
  if (fx.fade > 0) {
    g.globalAlpha = fx.fade;
    g.fillStyle = "#000";
    g.fillRect(0, 0, W, H);
    g.globalAlpha = 1;
  }
}

let last = performance.now();
const cost = { avg: 0, max: 0 };
function frame(now: number): void {
  const start = performance.now();
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  clock.t += dt;
  if (S.mode === "title") updateTitle();
  else update(dt);
  tickScripts();
  updateFx(dt);
  // 게임 좌표 1칸 = render.scale 도트
  g.setTransform(render.scale, 0, 0, render.scale, 0, 0);
  g.imageSmoothingEnabled = false;
  g.fillStyle = "#000";
  g.fillRect(0, 0, W, H);
  if (S.mode === "title") drawTitle();
  else drawPlay();
  drawOverlays();
  pressed.clear();
  mouse.clicked = false;
  const spent = performance.now() - start;
  cost.avg = cost.avg * 0.95 + spent * 0.05;
  cost.max = Math.max(cost.max * 0.999, spent);
  // 144Hz 한 프레임(약 6.9ms) 안에서 남는 시간에만 미리 굽기
  bakeIdle(start + 5);
  requestAnimationFrame(frame);
}

window.addEventListener("keydown", (e) => {
  unlockAudio();
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Tab"].includes(e.code)) e.preventDefault();
  if (!e.repeat) pressed.add(e.code);
  keys.add(e.code);
});
window.addEventListener("keyup", (e) => keys.delete(e.code));
window.addEventListener("blur", () => keys.clear());
canvas.addEventListener("pointerdown", (e) => {
  unlockAudio();
  const r = canvas.getBoundingClientRect();
  mouse.x = ((e.clientX - r.left) / r.width) * W;
  mouse.y = ((e.clientY - r.top) / r.height) * H;
  mouse.clicked = true;
  pressed.add("click");
});

// 터치 버튼 → 키 입력으로 바꿔 준다
document.querySelectorAll<HTMLButtonElement>("#touch [data-key]").forEach((b) => {
  const key = b.dataset.key!;
  const down = (e: Event) => {
    e.preventDefault();
    unlockAudio();
    keys.add(key);
    pressed.add(key);
    b.classList.add("on");
  };
  const up = () => {
    keys.delete(key);
    b.classList.remove("on");
  };
  b.addEventListener("pointerdown", down);
  b.addEventListener("pointerup", up);
  b.addEventListener("pointercancel", up);
  b.addEventListener("pointerleave", up);
});

window.addEventListener("resize", resize);
resize();
fx.fade = 0;
fx.fadeTarget = 0;
void document.fonts.load(FONT).finally(() => {
  const t0 = performance.now();
  // 캐릭터 도트 밀도: 기본 6배, 더 촘촘한 화면이면 그만큼 (최대 8배)
  setSpriteDensity(Math.max(6, Math.ceil(render.scale)));
  prewarm();
  console.info(`sprites ready in ${Math.round(performance.now() - t0)}ms`);
  last = performance.now();
  requestAnimationFrame(frame);
});

// 테스트용
(window as unknown as { __game: unknown }).__game = { S, debug, goScene, cost };

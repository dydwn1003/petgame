import "../fonts.css";
import "./style.css";
import { FONT, H, W, canvas, clock, fx, g, keys, mouse, pressed, tickScripts, unlockAudio, updateFx } from "./core";
import { S, debug, drawPlay, drawTitle, goScene, update, updateTitle } from "./game";

const stage = document.getElementById("stage")!;

function resize(): void {
  const k = Math.min(window.innerWidth / W, window.innerHeight / H);
  const u = k >= 1 ? Math.max(1, Math.floor(k)) : k;
  stage.style.width = `${W * u}px`;
  stage.style.height = `${H * u}px`;
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
function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  clock.t += dt;
  if (S.mode === "title") updateTitle();
  else update(dt);
  tickScripts();
  updateFx(dt);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = "#000";
  g.fillRect(0, 0, W, H);
  if (S.mode === "title") drawTitle();
  else drawPlay();
  drawOverlays();
  pressed.clear();
  mouse.clicked = false;
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

window.addEventListener("resize", resize);
resize();
fx.fade = 0;
fx.fadeTarget = 0;
void document.fonts.load(FONT).finally(() => requestAnimationFrame(frame));

// 테스트용
(window as unknown as { __game: unknown }).__game = { S, debug, goScene };

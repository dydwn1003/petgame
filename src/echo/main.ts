import "../fonts.css";
import "./style.css";
import { DIRS, bfs, generateMaze, isWall, type Maze } from "./maze";
import {
  playBump,
  playCaught,
  playExitHum,
  playGrowl,
  playHeartbeat,
  playPing,
  playWin,
  unlockAudio,
} from "./audio";

// ── 튜닝 값 ───────────────────────────────────────────────
const PLAYER_SPEED = 3.4; // 타일/초
const PLAYER_R = 0.28;
const ECHO_SPEED = 11; // 음파 전파 속도 (타일/초)
const ECHO_RANGE = 9; // 음파가 닿는 최대 거리 (길 따라 타일 수)
const ECHO_COOLDOWN = 0.7;
const BUMP_RANGE = 2;
const BUMP_COOLDOWN = 0.8;
const REVEAL_FADE = 2.2; // 벽이 보였다가 사라지는 시간
const MEMORY_ALPHA = 0.06; // 한 번 본 벽은 아주 희미하게 기억
const CATCH_DIST = 0.55;
const SEARCH_TIME = 5;
const SAVE_KEY = "echo_maze_v1";

// ── 타입 ─────────────────────────────────────────────────
interface Echo {
  ox: number;
  oy: number;
  t0: number;
  range: number;
  dist: Int16Array;
  heard: Set<Monster>;
  exitHeard: boolean;
}

type MonsterState = "sleep" | "hunt" | "search";

interface Monster {
  tx: number;
  ty: number;
  nx: number;
  ny: number;
  p: number;
  state: MonsterState;
  flow: Int16Array | null;
  searchUntil: number;
  lastSeen: number;
  speed: number;
}

interface Level {
  n: number;
  maze: Maze;
  exit: { x: number; y: number };
  exitKnown: boolean;
  exitSeen: number;
  memory: Uint8Array;
  monsters: Monster[];
}

type Phase = "title" | "play" | "dead" | "win";

// ── 상태 ─────────────────────────────────────────────────
const canvas = document.getElementById("view") as HTMLCanvasElement;
const g = canvas.getContext("2d")!;
const $ = (id: string) => document.getElementById(id)!;
const ui = {
  hudLevel: $("hudLevel"),
  hudEchoes: $("hudEchoes"),
  hudTime: $("hudTime"),
  echoBtn: $("echoBtn") as HTMLButtonElement,
  overlay: $("overlay"),
  ovTitle: $("ovTitle"),
  ovBody: $("ovBody"),
  ovButtons: $("ovButtons"),
};

let phase: Phase = "title";
let level: Level;
let clock = 0; // 게임 시간 (플레이 중에만 흐름)
let player = { x: 1.5, y: 1.5, face: 1 };
let echoes: Echo[] = [];
let lastEcho = -99;
let lastBump = -99;
let nextHeartbeat = 0;
let echoesUsed = 0;
let shake = 0;

const keys = new Set<string>();
const joy = { id: -1, sx: 0, sy: 0, x: 0, y: 0 };

function loadBest(): number {
  try {
    return Math.max(1, Number(localStorage.getItem(SAVE_KEY)) || 1);
  } catch {
    return 1;
  }
}
function saveBest(n: number): void {
  try {
    if (n > loadBest()) localStorage.setItem(SAVE_KEY, String(n));
  } catch {
    /* 무시 */
  }
}

// ── 레벨 만들기 ───────────────────────────────────────────
function buildLevel(n: number): Level {
  const cw = Math.min(6 + n * 2, 26);
  const ch = Math.min(5 + n * 2, 22);
  const maze = generateMaze(cw, ch, Math.min(0.06 + n * 0.012, 0.15));
  const fromStart = bfs(maze, 1, 1);

  // 출구: 시작점에서 가장 먼 칸
  let best = 0;
  let exit = { x: 1, y: 1 };
  for (let i = 0; i < fromStart.length; i++) {
    if (fromStart[i] > best) {
      best = fromStart[i];
      exit = { x: i % maze.w, y: Math.floor(i / maze.w) };
    }
  }

  // 괴물: 시작점에서 충분히 먼 셀 중앙에 배치
  const count = n === 1 ? 1 : Math.min(n + 1, 12);
  const spots: Array<[number, number]> = [];
  for (let y = 1; y < maze.h; y += 2) {
    for (let x = 1; x < maze.w; x += 2) {
      const d = fromStart[y * maze.w + x];
      if (d > 12 && !(x === exit.x && y === exit.y)) spots.push([x, y]);
    }
  }
  const monsters: Monster[] = [];
  for (let k = 0; k < count && spots.length; k++) {
    const [x, y] = spots.splice(Math.floor(Math.random() * spots.length), 1)[0];
    monsters.push({
      tx: x,
      ty: y,
      nx: x,
      ny: y,
      p: 0,
      state: "sleep",
      flow: null,
      searchUntil: 0,
      lastSeen: -99,
      speed: Math.min(2.0 + n * 0.12, 3.0),
    });
  }

  return { n, maze, exit, exitKnown: false, exitSeen: -99, memory: new Uint8Array(maze.w * maze.h), monsters };
}

function startLevel(n: number): void {
  level = buildLevel(n);
  player = { x: 1.5, y: 1.5, face: 1 };
  echoes = [];
  clock = 0;
  lastEcho = -99;
  lastBump = -99;
  echoesUsed = 0;
  nextHeartbeat = 0;
  phase = "play";
  ui.overlay.classList.add("hidden");
  // 시작할 때 한 번 공짜로 주변을 보여준다
  emitEcho(1, 1, 4, false);
}

// ── 음파 ─────────────────────────────────────────────────
function emitEcho(ox: number, oy: number, range: number, count: boolean): void {
  echoes.push({ ox, oy, t0: clock, range, dist: bfs(level.maze, ox, oy, range), heard: new Set(), exitHeard: false });
  if (count) echoesUsed++;
}

function tryPing(): void {
  if (phase !== "play" || clock - lastEcho < ECHO_COOLDOWN) return;
  lastEcho = clock;
  emitEcho(Math.floor(player.x), Math.floor(player.y), ECHO_RANGE, true);
  playPing();
}

function panFor(x: number): number {
  return Math.max(-1, Math.min(1, (x - player.x) / 8));
}

// ── 업데이트 ─────────────────────────────────────────────
function inputVector(): { x: number; y: number } {
  let x = 0;
  let y = 0;
  if (keys.has("ArrowLeft") || keys.has("KeyA")) x -= 1;
  if (keys.has("ArrowRight") || keys.has("KeyD")) x += 1;
  if (keys.has("ArrowUp") || keys.has("KeyW")) y -= 1;
  if (keys.has("ArrowDown") || keys.has("KeyS")) y += 1;
  if (joy.id !== -1) {
    const dx = joy.x - joy.sx;
    const dy = joy.y - joy.sy;
    const len = Math.hypot(dx, dy);
    if (len > 8) {
      const k = Math.min(1, len / 50) / len;
      x += dx * k;
      y += dy * k;
    }
  }
  const len = Math.hypot(x, y);
  if (len > 1) {
    x /= len;
    y /= len;
  }
  return { x, y };
}

function collides(x: number, y: number): boolean {
  const m = level.maze;
  for (let ty = Math.floor(y - PLAYER_R); ty <= Math.floor(y + PLAYER_R); ty++) {
    for (let tx = Math.floor(x - PLAYER_R); tx <= Math.floor(x + PLAYER_R); tx++) {
      if (isWall(m, tx, ty)) return true;
    }
  }
  return false;
}

/** 한 축으로 이동. 막히면 통로 중앙 쪽으로 살짝 밀어 모서리에 걸리지 않게 한다. */
function moveAxis(dx: number, dy: number, step: number): boolean {
  const nx = player.x + dx;
  const ny = player.y + dy;
  if (!collides(nx, ny)) {
    player.x = nx;
    player.y = ny;
    return false;
  }
  if (dx !== 0) {
    const cy = Math.floor(player.y) + 0.5;
    if (!collides(nx, cy)) player.y += Math.sign(cy - player.y) * Math.min(step, Math.abs(cy - player.y));
  } else {
    const cx = Math.floor(player.x) + 0.5;
    if (!collides(cx, ny)) player.x += Math.sign(cx - player.x) * Math.min(step, Math.abs(cx - player.x));
  }
  return true;
}

function updatePlayer(dt: number): void {
  const v = inputVector();
  const step = PLAYER_SPEED * dt;
  if (v.x) player.face = Math.sign(v.x);
  let bumped = false;
  if (v.x) bumped = moveAxis(v.x * step, 0, step) || bumped;
  if (v.y) bumped = moveAxis(0, v.y * step, step) || bumped;
  if (bumped && clock - lastBump > BUMP_COOLDOWN) {
    lastBump = clock;
    // 부딪힌 소리도 작은 음파: 주변이 살짝 보이지만 근처 괴물이 들을 수 있다
    emitEcho(Math.floor(player.x), Math.floor(player.y), BUMP_RANGE, false);
    playBump();
  }
}

function setHunt(m: Monster, ox: number, oy: number): void {
  const wasSleeping = m.state === "sleep";
  m.state = "hunt";
  m.flow = bfs(level.maze, ox, oy);
  if (wasSleeping) {
    const d = Math.hypot(m.tx - player.x, m.ty - player.y);
    playGrowl(panFor(m.tx), Math.max(0.25, 1 - d / 20));
  }
}

function updateEchoes(): void {
  const m = level.maze;
  for (const e of echoes) {
    const front = (clock - e.t0) * ECHO_SPEED;
    for (const mon of level.monsters) {
      if (e.heard.has(mon)) continue;
      const d = e.dist[mon.ty * m.w + mon.tx];
      if (d >= 0 && front >= d) {
        e.heard.add(mon);
        mon.lastSeen = clock;
        setHunt(mon, e.ox, e.oy);
      }
    }
    if (!e.exitHeard) {
      const d = e.dist[level.exit.y * m.w + level.exit.x];
      if (d >= 0 && front >= d) {
        e.exitHeard = true;
        level.exitKnown = true;
        level.exitSeen = clock;
        playExitHum(panFor(level.exit.x));
      }
    }
  }
  echoes = echoes.filter((e) => (clock - e.t0) * ECHO_SPEED < e.range + ECHO_SPEED * REVEAL_FADE);
}

function chooseNext(mon: Monster): void {
  const m = level.maze;
  if (mon.state === "hunt" && mon.flow) {
    const here = mon.flow[mon.ty * m.w + mon.tx];
    if (here <= 0) {
      mon.state = "search";
      mon.searchUntil = clock + SEARCH_TIME;
    } else {
      for (const [dx, dy] of DIRS) {
        const d = mon.flow[(mon.ty + dy) * m.w + (mon.tx + dx)];
        if (d >= 0 && d < here) {
          mon.nx = mon.tx + dx;
          mon.ny = mon.ty + dy;
          return;
        }
      }
    }
  }
  if (mon.state === "search") {
    if (clock > mon.searchUntil) {
      mon.state = "sleep";
      return;
    }
    const opts = DIRS.filter(([dx, dy]) => !isWall(m, mon.tx + dx, mon.ty + dy));
    if (opts.length) {
      const [dx, dy] = opts[Math.floor(Math.random() * opts.length)];
      mon.nx = mon.tx + dx;
      mon.ny = mon.ty + dy;
    }
  }
}

function monsterPos(mon: Monster): { x: number; y: number } {
  return {
    x: mon.tx + (mon.nx - mon.tx) * mon.p + 0.5,
    y: mon.ty + (mon.ny - mon.ty) * mon.p + 0.5,
  };
}

function updateMonsters(dt: number): void {
  let nearest = Infinity;
  for (const mon of level.monsters) {
    if (mon.nx === mon.tx && mon.ny === mon.ty) chooseNext(mon);
    if (mon.nx !== mon.tx || mon.ny !== mon.ty) {
      const speed = mon.state === "search" ? mon.speed * 0.6 : mon.speed;
      mon.p += speed * dt;
      if (mon.p >= 1) {
        mon.tx = mon.nx;
        mon.ty = mon.ny;
        mon.p = 0;
      }
    }
    const pos = monsterPos(mon);
    const d = Math.hypot(pos.x - player.x, pos.y - player.y);
    if (d < CATCH_DIST) {
      lose();
      return;
    }
    if (mon.state !== "sleep") nearest = Math.min(nearest, d);
  }
  // 깨어난 괴물이 가까우면 심장 소리
  if (nearest < 7 && clock >= nextHeartbeat) {
    playHeartbeat(1 - nearest / 9);
    nextHeartbeat = clock + 0.35 + nearest * 0.12;
  }
}

function update(dt: number): void {
  clock += dt;
  updatePlayer(dt);
  updateEchoes();
  updateMonsters(dt);
  if (phase !== "play") return;
  if (Math.floor(player.x) === level.exit.x && Math.floor(player.y) === level.exit.y) win();
}

// ── 결과 화면 ────────────────────────────────────────────
function showOverlay(title: string, cls: string, body: string, buttons: Array<[string, () => void, boolean?]>): void {
  ui.ovTitle.textContent = title;
  ui.ovTitle.className = cls;
  ui.ovBody.innerHTML = body;
  ui.ovButtons.innerHTML = "";
  for (const [label, fn, secondary] of buttons) {
    const b = document.createElement("button");
    b.textContent = label;
    if (secondary) b.className = "secondary";
    b.addEventListener("click", () => {
      unlockAudio();
      fn();
    });
    ui.ovButtons.appendChild(b);
  }
  ui.overlay.classList.remove("hidden");
  (ui.ovButtons.firstElementChild as HTMLButtonElement | null)?.focus();
}

function lose(): void {
  phase = "dead";
  shake = 0.5;
  playCaught();
  setTimeout(() => {
    showOverlay("잡혔다!", "danger", `<p>레벨 ${level.n}에서 어둠 속의 무언가에게 붙잡혔어요.</p><p>음파는 괴물도 듣는다는 걸 잊지 마세요.</p>`, [
      ["다시 도전", () => startLevel(level.n)],
      ["처음 화면", showTitle, true],
    ]);
  }, 700);
}

function win(): void {
  phase = "win";
  playWin();
  saveBest(level.n + 1);
  const awake = level.monsters.filter((m) => m.state !== "sleep").length;
  showOverlay(
    "탈출 성공!",
    "win",
    `<p class="stats">레벨 ${level.n} · ${clock.toFixed(1)}초 · 음파 ${echoesUsed}번</p>` +
      `<p>${echoesUsed <= 3 ? "거의 소리 없이 빠져나갔어요. 🦇" : awake === 0 ? "괴물을 하나도 깨우지 않았어요!" : `괴물 ${awake}마리를 깨우고도 살아남았어요.`}</p>`,
    [
      [`레벨 ${level.n + 1} 도전`, () => startLevel(level.n + 1)],
      ["처음 화면", showTitle, true],
    ],
  );
}

function showTitle(): void {
  phase = "title";
  const best = loadBest();
  const buttons: Array<[string, () => void, boolean?]> = [["레벨 1부터 시작", () => startLevel(1)]];
  if (best > 1) buttons.unshift([`레벨 ${best}부터 계속`, () => startLevel(best)]);
  showOverlay(
    "🦇 메아리 미로",
    "",
    `<p>완전히 깜깜한 미로에 갇힌 박쥐가 되어 <b>금빛 출구</b>를 찾으세요.</p>` +
      `<p><b>음파</b>를 쏘면 소리가 길을 따라 퍼지면서 벽이 잠깐 보였다가 사라져요.<br>` +
      `하지만 미로 속에 잠든 <b style="color:var(--danger)">괴물</b>도 그 소리를 듣고 음파를 쏜 자리로 찾아와요.</p>` +
      `<p>벽에 부딪히는 작은 소리도 가까운 괴물을 깨울 수 있어요.<br>본 길을 기억해서 최대한 조용히 빠져나가세요.</p>` +
      `<p><b>이동</b> 방향키/WASD · 화면 드래그<br><b>음파</b> Space · 클릭 · )) 버튼</p>`,
    buttons,
  );
}

// ── 그리기 ───────────────────────────────────────────────
let dpr = 1;
let vw = 0;
let vh = 0;

function resize(): void {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  vw = window.innerWidth;
  vh = window.innerHeight;
  canvas.width = Math.round(vw * dpr);
  canvas.height = Math.round(vh * dpr);
}

function fade(age: number): number {
  if (age < 0) return 0;
  const k = 1 - age / REVEAL_FADE;
  return k <= 0 ? 0 : k * k;
}

/** 벽 타일이 음파에 얼마나 밝게 비치는지 (0~1) */
function wallLight(x: number, y: number): number {
  const m = level.maze;
  let best = 0;
  for (const e of echoes) {
    let dmin = Infinity;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= m.w || ny >= m.h) continue;
      const d = e.dist[ny * m.w + nx];
      if (d >= 0 && d < dmin) dmin = d;
    }
    if (dmin === Infinity) continue;
    const a = fade(clock - e.t0 - dmin / ECHO_SPEED) * (1 - (dmin / (e.range + 1)) * 0.6);
    if (a > best) best = a;
  }
  return best;
}

function floorWave(i: number): number {
  let glow = 0;
  for (const e of echoes) {
    const d = e.dist[i];
    if (d < 0) continue;
    const diff = (clock - e.t0) * ECHO_SPEED - d;
    if (diff >= 0 && diff < 1.5) glow += (1 - diff / 1.5) * (1 - d / (e.range + 1)) * 0.22;
  }
  return glow;
}

function draw(): void {
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.fillStyle = "#04030a";
  g.fillRect(0, 0, vw, vh);
  if (!level) return;

  const m = level.maze;
  const T = Math.max(26, Math.min(46, Math.min(vw, vh) / 13));
  let camX = player.x * T - vw / 2;
  let camY = player.y * T - vh / 2;
  if (shake > 0) {
    camX += (Math.random() - 0.5) * shake * 20;
    camY += (Math.random() - 0.5) * shake * 20;
  }
  const x0 = Math.max(0, Math.floor(camX / T));
  const y0 = Math.max(0, Math.floor(camY / T));
  const x1 = Math.min(m.w - 1, Math.ceil((camX + vw) / T));
  const y1 = Math.min(m.h - 1, Math.ceil((camY + vh) / T));

  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = y * m.w + x;
      const sx = x * T - camX;
      const sy = y * T - camY;
      if (m.tiles[i]) {
        let a = wallLight(x, y);
        if (a > 0.25) level.memory[i] = 1;
        if (level.memory[i] && a < MEMORY_ALPHA) a = MEMORY_ALPHA;
        if (a <= 0.005) continue;
        g.fillStyle = `rgba(140,220,255,${(a * 0.25).toFixed(3)})`;
        g.fillRect(sx, sy, T, T);
        // 바닥과 맞닿은 면만 선으로 그려서 "윤곽"처럼 보이게
        g.strokeStyle = `rgba(160,230,255,${a.toFixed(3)})`;
        g.lineWidth = 2;
        g.beginPath();
        if (!isWall(m, x - 1, y)) { g.moveTo(sx + 1, sy); g.lineTo(sx + 1, sy + T); }
        if (!isWall(m, x + 1, y)) { g.moveTo(sx + T - 1, sy); g.lineTo(sx + T - 1, sy + T); }
        if (!isWall(m, x, y - 1)) { g.moveTo(sx, sy + 1); g.lineTo(sx + T, sy + 1); }
        if (!isWall(m, x, y + 1)) { g.moveTo(sx, sy + T - 1); g.lineTo(sx + T, sy + T - 1); }
        g.stroke();
      } else {
        const w = floorWave(i);
        if (w > 0.005) {
          g.fillStyle = `rgba(120,200,255,${Math.min(0.5, w).toFixed(3)})`;
          g.fillRect(sx, sy, T, T);
        }
      }
    }
  }

  // 출구
  {
    const ex = (level.exit.x + 0.5) * T - camX;
    const ey = (level.exit.y + 0.5) * T - camY;
    const fresh = fade(clock - level.exitSeen);
    const a = Math.max(fresh, level.exitKnown ? 0.3 : 0);
    if (a > 0) {
      const pulse = 0.85 + Math.sin(clock * 4) * 0.15;
      const grad = g.createRadialGradient(ex, ey, 0, ex, ey, T * 1.4);
      grad.addColorStop(0, `rgba(255,209,102,${(a * 0.6 * pulse).toFixed(3)})`);
      grad.addColorStop(1, "rgba(255,209,102,0)");
      g.fillStyle = grad;
      g.fillRect(ex - T * 1.5, ey - T * 1.5, T * 3, T * 3);
      g.strokeStyle = `rgba(255,220,130,${a.toFixed(3)})`;
      g.lineWidth = 2;
      g.strokeRect(ex - T * 0.3, ey - T * 0.38, T * 0.6, T * 0.76);
    }
  }

  // 괴물: 음파에 맞았을 때와 아주 가까울 때만 눈이 보인다
  for (const mon of level.monsters) {
    const pos = monsterPos(mon);
    const d = Math.hypot(pos.x - player.x, pos.y - player.y);
    const near = d < 2 ? (1 - d / 2) * 0.6 : 0;
    const a = Math.max(fade(clock - mon.lastSeen), near);
    if (a <= 0.01) continue;
    const sx = pos.x * T - camX;
    const sy = pos.y * T - camY;
    const r = mon.state === "sleep" ? T * 0.05 : T * 0.08;
    const eyeH = mon.state === "sleep" ? r * 0.35 : r;
    g.fillStyle = `rgba(255,60,90,${(a * 0.25).toFixed(3)})`;
    g.beginPath();
    g.arc(sx, sy, T * 0.45, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = `rgba(255,80,110,${a.toFixed(3)})`;
    for (const ox of [-T * 0.13, T * 0.13]) {
      g.beginPath();
      g.ellipse(sx + ox, sy - T * 0.05, r, eyeH, 0, 0, Math.PI * 2);
      g.fill();
    }
  }

  // 플레이어 (박쥐)
  {
    const sx = player.x * T - camX;
    const sy = player.y * T - camY;
    const glow = g.createRadialGradient(sx, sy, 0, sx, sy, T * 0.9);
    glow.addColorStop(0, "rgba(140,220,255,0.18)");
    glow.addColorStop(1, "rgba(140,220,255,0)");
    g.fillStyle = glow;
    g.fillRect(sx - T, sy - T, T * 2, T * 2);

    const flap = Math.sin(performance.now() / 70) * T * 0.12;
    g.fillStyle = "#cfeeff";
    g.beginPath();
    g.moveTo(sx - T * 0.08, sy);
    g.lineTo(sx - T * 0.34, sy - T * 0.06 - flap);
    g.lineTo(sx - T * 0.26, sy + T * 0.08);
    g.lineTo(sx - T * 0.14, sy + T * 0.04);
    g.closePath();
    g.moveTo(sx + T * 0.08, sy);
    g.lineTo(sx + T * 0.34, sy - T * 0.06 - flap);
    g.lineTo(sx + T * 0.26, sy + T * 0.08);
    g.lineTo(sx + T * 0.14, sy + T * 0.04);
    g.closePath();
    g.fill();
    g.beginPath();
    g.arc(sx, sy, T * 0.11, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#04030a";
    g.fillRect(sx + player.face * T * 0.04 - 1, sy - T * 0.03, 2, 2);
  }

  // 음파 쿨타임 링
  const cd = (clock - lastEcho) / ECHO_COOLDOWN;
  ui.echoBtn.classList.toggle("cooling", phase === "play" && cd < 1);

  // 가상 조이스틱
  if (joy.id !== -1) {
    g.strokeStyle = "rgba(140,220,255,0.25)";
    g.lineWidth = 2;
    g.beginPath();
    g.arc(joy.sx, joy.sy, 50, 0, Math.PI * 2);
    g.stroke();
    const dx = joy.x - joy.sx;
    const dy = joy.y - joy.sy;
    const len = Math.hypot(dx, dy);
    const k = len > 50 ? 50 / len : 1;
    g.fillStyle = "rgba(140,220,255,0.3)";
    g.beginPath();
    g.arc(joy.sx + dx * k, joy.sy + dy * k, 20, 0, Math.PI * 2);
    g.fill();
  }

  ui.hudLevel.textContent = `레벨 ${level.n}`;
  ui.hudEchoes.textContent = `음파 ${echoesUsed}`;
  ui.hudTime.textContent = `${clock.toFixed(1)}초`;
}

// ── 루프 ─────────────────────────────────────────────────
let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (phase === "play") update(dt);
  if (shake > 0) shake = Math.max(0, shake - dt);
  draw();
  requestAnimationFrame(frame);
}

// ── 입력 ─────────────────────────────────────────────────
window.addEventListener("keydown", (e) => {
  unlockAudio();
  if (e.code === "Space") {
    e.preventDefault();
    if (!e.repeat) tryPing();
    return;
  }
  if (e.code.startsWith("Arrow")) e.preventDefault();
  keys.add(e.code);
});
window.addEventListener("keyup", (e) => keys.delete(e.code));
window.addEventListener("blur", () => keys.clear());

canvas.addEventListener("pointerdown", (e) => {
  unlockAudio();
  if (e.pointerType === "mouse") {
    tryPing();
    return;
  }
  if (joy.id === -1) {
    joy.id = e.pointerId;
    joy.sx = joy.x = e.clientX;
    joy.sy = joy.y = e.clientY;
  }
});
canvas.addEventListener("pointermove", (e) => {
  if (e.pointerId === joy.id) {
    joy.x = e.clientX;
    joy.y = e.clientY;
  }
});
const endJoy = (e: PointerEvent) => {
  if (e.pointerId === joy.id) joy.id = -1;
};
canvas.addEventListener("pointerup", endJoy);
canvas.addEventListener("pointercancel", endJoy);
ui.echoBtn.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  unlockAudio();
  tryPing();
});

window.addEventListener("resize", resize);
resize();
level = buildLevel(1);
showTitle();
requestAnimationFrame(frame);

// 디버그/테스트용
(window as unknown as { __echo: unknown }).__echo = {
  get state() {
    return { phase, player, level, echoesUsed, clock };
  },
  startLevel,
};

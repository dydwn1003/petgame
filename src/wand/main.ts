import "../fonts.css";
import "./style.css";
import { GROUND, H, W, animateBg, background, sprite, wandTip, type CharId } from "./art";
import { recognize, type Pt, type SpellId } from "./gesture";
import {
  CHAPTERS,
  SPEAKER_CHAR,
  SPEAKER_NAME,
  SPELL_INFO,
  unlockedUpTo,
  type EnemyDef,
  type EnemySpell,
  type Line,
} from "./story";
import { sfx, unlockAudio } from "./sfx";

// ── 기본 설정 ─────────────────────────────────────────────
const SCALE = 3; // 스프라이트 확대 배율
const PX = 110; // 플레이어 중심 x
const EX = 370; // 적 중심 x
const FONT = "11px Galmuri11";
const SAVE_KEY = "wand_save_v1";

const MANA_MAX = 100;
const MANA_REGEN = 14;
const PLAYER_HP = 100;
const SHIELD_TIME = 1.4;

const SPELL_POWER: Record<SpellId, { dmg: number; travel: number }> = {
  bolt: { dmg: 7, travel: 0.32 },
  fire: { dmg: 16, travel: 0.55 },
  frost: { dmg: 5, travel: 0.42 },
  shield: { dmg: 0, travel: 0 },
  heal: { dmg: 25, travel: 0 },
};

const canvas = document.getElementById("screen") as HTMLCanvasElement;
const g = canvas.getContext("2d")!;
g.imageSmoothingEnabled = false;
const stage = document.getElementById("stage")!;
const $ = (id: string) => document.getElementById(id)!;
const ui = {
  card: $("card"),
  dialog: $("dialog"),
  who: $("who"),
  text: $("text"),
  menu: $("menu"),
  menuTitle: $("menuTitle"),
  menuSub: $("menuSub"),
  menuButtons: $("menuButtons"),
};

// ── 저장 ─────────────────────────────────────────────────
function loadCleared(): number {
  try {
    return Number(localStorage.getItem(SAVE_KEY)) || 0;
  } catch {
    return 0;
  }
}
function saveCleared(n: number): void {
  try {
    if (n > loadCleared()) localStorage.setItem(SAVE_KEY, String(n));
  } catch {
    /* 무시 */
  }
}

// ── 상태 ─────────────────────────────────────────────────
type Mode = "title" | "card" | "story" | "battle" | "lost" | "end";
let mode: Mode = "title";
let chIdx = 0;
let storyPart: "intro" | "outro" = "intro";
let lines: Line[] = [];
let lineIdx = 0;
let typed = 0;
let rightChar: CharId | null = null;
let time = 0;
let shake = 0;

interface Fighter {
  hp: number;
  maxHp: number;
  shieldUntil: number;
  flash: number;
}

interface Projectile {
  owner: "p" | "e";
  sx: number;
  sy: number;
  tx: number;
  ty: number;
  t0: number;
  dur: number;
  color: string;
  size: number;
  onHit: () => void;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  color: string;
  s: number;
}

interface Floater {
  x: number;
  y: number;
  text: string;
  color: string;
  t0: number;
}

interface Battle {
  t: number;
  def: EnemyDef;
  player: Fighter & { mana: number };
  enemy: Fighter & {
    charging: { spell: EnemySpell; start: number; end: number } | null;
    nextAt: number;
    stunUntil: number;
    used: Set<EnemySpell>;
    shieldReadyAt: number;
  };
  unlocked: SpellId[];
  projectiles: Projectile[];
  particles: Particle[];
  floaters: Floater[];
  stroke: Pt[] | null;
  lastStroke: { pts: Pt[]; until: number; color: string } | null;
  banner: { text: string; color: string; until: number } | null;
  casts: number;
  over: boolean;
}

let battle: Battle | null = null;

// ── 화면 크기 ─────────────────────────────────────────────
function resize(): void {
  const k = Math.min(window.innerWidth / W, window.innerHeight / H);
  const u = k >= 2 ? Math.floor(k) : k; // 크면 정수배로 선명하게
  stage.style.width = `${W * u}px`;
  stage.style.height = `${H * u}px`;
  document.documentElement.style.setProperty("--u", `${u}px`);
}

// ── 메뉴 / 카드 / 대화 ────────────────────────────────────
function showMenu(title: string, sub: string, buttons: Array<[string, () => void, boolean?]>): void {
  ui.menuTitle.textContent = title;
  ui.menuSub.innerHTML = sub;
  ui.menuButtons.innerHTML = "";
  for (const [label, fn, primary] of buttons) {
    const b = document.createElement("button");
    b.textContent = label;
    if (primary) b.className = "primary";
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      unlockAudio();
      sfx.blip();
      ui.menu.classList.add("hidden");
      fn();
    });
    ui.menuButtons.appendChild(b);
  }
  ui.menu.classList.remove("hidden");
  ui.dialog.classList.add("hidden");
}

function showTitle(): void {
  mode = "title";
  battle = null;
  rightChar = null;
  chIdx = 0;
  const cleared = loadCleared();
  const buttons: Array<[string, () => void, boolean?]> = [];
  if (cleared > 0 && cleared < CHAPTERS.length) {
    buttons.push([`이어하기 · ${CHAPTERS[cleared].title}`, () => startChapter(cleared), true]);
    buttons.push(["처음부터", () => startChapter(0)]);
  } else {
    buttons.push(["새 이야기 시작", () => startChapter(0), true]);
  }
  if (cleared >= CHAPTERS.length) {
    CHAPTERS.forEach((c, i) => buttons.push([c.title, () => startChapter(i)]));
  }
  showMenu(
    "별의 지팡이",
    "아스테리아 마법학교 이야기<br>허공에 모양을 그려 주문을 거는 도트 마법 결투",
    buttons,
  );
}

let cardTimer = 0;
function startChapter(i: number): void {
  chIdx = i;
  mode = "card";
  battle = null;
  rightChar = null;
  ui.menu.classList.add("hidden");
  ui.dialog.classList.add("hidden");
  ui.card.textContent = CHAPTERS[i].title;
  ui.card.classList.remove("hidden");
  window.clearTimeout(cardTimer);
  cardTimer = window.setTimeout(endCard, 1800);
}

function endCard(): void {
  if (mode !== "card") return;
  window.clearTimeout(cardTimer);
  ui.card.classList.add("hidden");
  startStory("intro");
}

function startStory(part: "intro" | "outro"): void {
  const ch = CHAPTERS[chIdx];
  storyPart = part;
  lines = part === "intro" ? ch.intro : ch.outro;
  lineIdx = 0;
  mode = "story";
  rightChar = part === "outro" && ch.enemy.char !== "wolf" ? ch.enemy.char : null;
  ui.dialog.classList.remove("hidden");
  showLine();
}

function showLine(): void {
  const [who] = lines[lineIdx];
  const c = SPEAKER_CHAR[who];
  if (c) rightChar = c;
  ui.who.textContent = SPEAKER_NAME[who];
  ui.dialog.classList.toggle("narr", who === "narr");
  typed = 0;
  ui.text.textContent = "";
}

function advance(): void {
  const text = lines[lineIdx][1];
  if (typed < text.length) {
    typed = text.length;
    ui.text.textContent = text;
    return;
  }
  sfx.blip();
  lineIdx++;
  if (lineIdx < lines.length) {
    showLine();
    return;
  }
  ui.dialog.classList.add("hidden");
  if (storyPart === "intro") startBattle();
  else if (chIdx + 1 < CHAPTERS.length) startChapter(chIdx + 1);
  else {
    mode = "end";
    showMenu("— 끝 —", "별의 지팡이를 끝까지 플레이해 줘서 고마워요!<br>타이틀에서 원하는 장을 다시 할 수 있어요.", [
      ["타이틀로", showTitle, true],
    ]);
  }
}

// ── 결투 ─────────────────────────────────────────────────
function startBattle(): void {
  window.clearTimeout(cardTimer);
  ui.card.classList.add("hidden");
  ui.dialog.classList.add("hidden");
  ui.menu.classList.add("hidden");
  const def = CHAPTERS[chIdx].enemy;
  battle = {
    t: 0,
    def,
    player: { hp: PLAYER_HP, maxHp: PLAYER_HP, shieldUntil: 0, flash: 0, mana: MANA_MAX },
    enemy: {
      hp: def.hp,
      maxHp: def.hp,
      shieldUntil: 0,
      flash: 0,
      charging: null,
      nextAt: 2.2,
      stunUntil: 0,
      used: new Set(),
      shieldReadyAt: 0,
    },
    unlocked: unlockedUpTo(chIdx),
    projectiles: [],
    particles: [],
    floaters: [],
    stroke: null,
    lastStroke: null,
    banner: { text: "결투 시작!", color: "#ffd36a", until: 1.4 },
    casts: 0,
    over: false,
  };
  rightChar = def.char;
  mode = "battle";
}

function spriteBox(id: CharId, cx: number): { left: number; top: number; w: number; h: number } {
  const s = sprite(id);
  const w = s.width * SCALE;
  const h = s.height * SCALE;
  return { left: Math.round(cx - w / 2), top: GROUND - h, w, h };
}

function tipOf(side: "p" | "e"): { x: number; y: number } {
  if (side === "p") {
    const b = spriteBox("rio", PX);
    const t = wandTip("rio");
    return { x: b.left + t.x * SCALE + 1, y: b.top + t.y * SCALE + 1 };
  }
  const id = battle!.def.char;
  const b = spriteBox(id, EX);
  const t = wandTip(id);
  return { x: b.left + b.w - t.x * SCALE - 2, y: b.top + t.y * SCALE + 1 };
}

function bodyOf(side: "p" | "e"): { x: number; y: number } {
  const b = side === "p" ? spriteBox("rio", PX) : spriteBox(battle!.def.char, EX);
  return { x: b.left + b.w / 2, y: b.top + b.h * 0.5 };
}

function burst(x: number, y: number, color: string, n: number, speed = 60): void {
  const b = battle!;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = speed * (0.3 + Math.random());
    b.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: 0.3 + Math.random() * 0.4, color, s: Math.random() < 0.3 ? 2 : 1 });
  }
}

function float(side: "p" | "e", text: string, color: string): void {
  const b = battle!;
  const p = bodyOf(side);
  b.floaters.push({ x: p.x, y: p.y - 34, text, color, t0: b.t });
}

function damage(side: "p" | "e", amount: number, color: string): void {
  const b = battle!;
  const f = side === "p" ? b.player : b.enemy;
  f.hp = Math.max(0, f.hp - amount);
  f.flash = 0.25;
  shake = Math.max(shake, amount > 15 ? 0.35 : 0.15);
  const p = bodyOf(side);
  burst(p.x, p.y, color, 10 + amount);
  float(side, `-${amount}`, side === "p" ? "#ff6a7a" : "#ffffff");
  sfx.hit();
}

function launch(owner: "p" | "e", color: string, size: number, dur: number, onHit: () => void): void {
  const b = battle!;
  const from = tipOf(owner);
  const to = bodyOf(owner === "p" ? "e" : "p");
  b.projectiles.push({ owner, sx: from.x, sy: from.y, tx: to.x, ty: to.y, t0: b.t, dur, color, size, onHit });
}

function cast(id: SpellId): void {
  const b = battle;
  if (!b || b.over) return;
  if (!b.unlocked.includes(id)) {
    float("p", "아직 모르는 주문", "#b4a8cc");
    sfx.fizzle();
    return;
  }
  const info = SPELL_INFO[id];
  if (b.player.mana < info.cost) {
    float("p", "마나 부족!", "#7fa8ff");
    sfx.fizzle();
    return;
  }
  b.player.mana -= info.cost;
  b.casts++;
  const tip = tipOf("p");
  burst(tip.x, tip.y, info.color, 8, 40);
  float("p", info.name, info.color);
  const power = SPELL_POWER[id];

  if (id === "shield") {
    b.player.shieldUntil = b.t + SHIELD_TIME;
    sfx.shield();
    return;
  }
  if (id === "heal") {
    b.player.hp = Math.min(b.player.maxHp, b.player.hp + power.dmg);
    const p = bodyOf("p");
    burst(p.x, p.y, info.color, 24, 40);
    float("p", `+${power.dmg}`, info.color);
    sfx.heal();
    return;
  }

  sfx[id]();
  launch("p", info.color, id === "fire" ? 5 : 3, power.travel, () => {
    damage("e", power.dmg, info.color);
    if (id === "frost") {
      const e = b.enemy;
      if (e.charging) {
        e.charging = null;
        float("e", "주문 끊김!", "#a8e8ff");
        sfx.interrupt();
      }
      e.stunUntil = b.t + 1.2;
      e.nextAt = Math.max(e.nextAt, b.t + 1.6);
    }
  });

  // 적이 방어막으로 반응
  const e = b.enemy;
  if (!e.charging && b.t >= e.shieldReadyAt && b.t >= e.stunUntil && Math.random() < b.def.shieldReact) {
    e.shieldUntil = b.t + power.travel + 0.35;
    e.shieldReadyAt = b.t + 2.5;
  }
}

function pickEnemySpell(): EnemySpell | null {
  const b = battle!;
  const ratio = b.enemy.hp / b.enemy.maxHp;
  const opts = b.def.spells.filter((s) => (!s.belowHp || ratio < s.belowHp) && !(s.once && b.enemy.used.has(s)));
  const total = opts.reduce((s, o) => s + o.weight, 0);
  let r = Math.random() * total;
  for (const o of opts) {
    r -= o.weight;
    if (r <= 0) return o;
  }
  return opts[0] ?? null;
}

function updateBattle(dt: number): void {
  const b = battle!;
  b.t += dt;
  const { player: p, enemy: e } = b;
  p.mana = Math.min(MANA_MAX, p.mana + MANA_REGEN * dt);
  p.flash = Math.max(0, p.flash - dt);
  e.flash = Math.max(0, e.flash - dt);

  // 적 행동
  if (!b.over && b.t >= e.stunUntil) {
    const enraged = b.def.enrage && e.hp < e.maxHp / 2;
    if (e.charging) {
      const tip = tipOf("e");
      if (Math.random() < 0.6) {
        b.particles.push({
          x: tip.x + (Math.random() - 0.5) * 16,
          y: tip.y + (Math.random() - 0.5) * 16,
          vx: 0,
          vy: 0,
          life: 0,
          max: 0.3,
          color: e.charging.spell.color,
          s: 1,
        });
      }
      if (b.t >= e.charging.end) {
        const s = e.charging.spell;
        e.charging = null;
        e.used.add(s);
        if (s.kind === "heal") {
          e.hp = Math.min(e.maxHp, e.hp + s.amount);
          const pos = bodyOf("e");
          burst(pos.x, pos.y, s.color, 24, 40);
          float("e", `+${s.amount}`, s.color);
          sfx.heal();
        } else {
          sfx.bolt();
          launch("e", s.color, s.amount >= 20 ? 6 : 3, 0.5, () => damage("p", s.amount, s.color));
        }
        const [lo, hi] = b.def.idle;
        e.nextAt = b.t + (lo + Math.random() * (hi - lo)) * (enraged ? 0.7 : 1);
      }
    } else if (b.t >= e.nextAt) {
      const s = pickEnemySpell();
      if (s) {
        e.charging = { spell: s, start: b.t, end: b.t + s.charge * (enraged ? 0.75 : 1) };
        sfx.charge();
      }
    }
  }

  // 주문 탄환
  b.projectiles = b.projectiles.filter((pr) => {
    if (b.t - pr.t0 < pr.dur) {
      if (Math.random() < 0.7) {
        const pos = projPos(pr);
        b.particles.push({ x: pos.x, y: pos.y, vx: (Math.random() - 0.5) * 10, vy: (Math.random() - 0.5) * 10, life: 0, max: 0.25, color: pr.color, s: 1 });
      }
      return true;
    }
    const target = pr.owner === "p" ? e : p;
    if (target.shieldUntil > b.t) {
      const pos = bodyOf(pr.owner === "p" ? "e" : "p");
      burst(pos.x + (pr.owner === "p" ? -20 : 20), pos.y, "#7fe0ff", 14);
      float(pr.owner === "p" ? "e" : "p", "막음!", "#7fe0ff");
      sfx.block();
    } else if (!b.over) {
      pr.onHit();
    }
    return false;
  });

  for (const pt of b.particles) {
    pt.life += dt;
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vy += 40 * dt;
  }
  b.particles = b.particles.filter((pt) => pt.life < pt.max);
  b.floaters = b.floaters.filter((f) => b.t - f.t0 < 1);

  // 승패
  if (!b.over && e.hp <= 0) {
    b.over = true;
    e.charging = null;
    b.banner = { text: "승리!", color: "#ffd36a", until: b.t + 99 };
    sfx.win();
    saveCleared(chIdx + 1);
    window.setTimeout(() => startStory("outro"), 1800);
  } else if (!b.over && p.hp <= 0) {
    b.over = true;
    b.banner = { text: "패배…", color: "#ff6a7a", until: b.t + 99 };
    sfx.lose();
    window.setTimeout(() => {
      mode = "lost";
      showMenu("패배…", `${b.def.name}에게 지고 말았다.<br>상대가 힘을 모을 때를 노려보세요.`, [
        ["다시 결투", startBattle, true],
        ["이 장 처음부터", () => startChapter(chIdx)],
        ["타이틀로", showTitle],
      ]);
    }, 1500);
  }
}

function projPos(pr: Projectile): { x: number; y: number } {
  const k = Math.min(1, (battle!.t - pr.t0) / pr.dur);
  return { x: pr.sx + (pr.tx - pr.sx) * k, y: pr.sy + (pr.ty - pr.sy) * k - Math.sin(Math.PI * k) * 14 };
}

// ── 그리기 ───────────────────────────────────────────────
function drawChar(id: CharId, cx: number, flip: boolean, flash = 0, bob = 0): void {
  const s = sprite(id);
  const b = spriteBox(id, cx);
  g.save();
  if (flip) {
    g.translate(b.left + b.w, b.top + bob);
    g.scale(-1, 1);
    g.drawImage(s, 0, 0, b.w, b.h);
  } else {
    g.drawImage(s, b.left, b.top + bob, b.w, b.h);
  }
  g.restore();
  if (flash > 0 && Math.floor(flash * 30) % 2 === 0) {
    g.globalCompositeOperation = "lighter";
    g.globalAlpha = 0.6;
    if (flip) {
      g.save();
      g.translate(b.left + b.w, b.top + bob);
      g.scale(-1, 1);
      g.drawImage(s, 0, 0, b.w, b.h);
      g.restore();
    } else g.drawImage(s, b.left, b.top + bob, b.w, b.h);
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
  }
  // 그림자
  g.fillStyle = "rgba(0,0,0,0.35)";
  g.fillRect(b.left + 4, GROUND - 2, b.w - 8, 3);
}

function bar(x: number, y: number, w: number, h: number, ratio: number, color: string): void {
  g.fillStyle = "#000";
  g.fillRect(x - 1, y - 1, w + 2, h + 2);
  g.fillStyle = "#2a2238";
  g.fillRect(x, y, w, h);
  g.fillStyle = color;
  g.fillRect(x, y, Math.round(w * Math.max(0, Math.min(1, ratio))), h);
  g.fillStyle = "rgba(255,255,255,0.25)";
  g.fillRect(x, y, Math.round(w * Math.max(0, Math.min(1, ratio))), 1);
}

function text(str: string, x: number, y: number, color: string, align: CanvasTextAlign = "left", outline = true): void {
  g.font = FONT;
  g.textAlign = align;
  g.textBaseline = "middle";
  if (outline) {
    g.fillStyle = "#000";
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) g.fillText(str, x + dx, y + dy);
  }
  g.fillStyle = color;
  g.fillText(str, x, y);
}

function shieldArc(cx: number, cy: number, facing: 1 | -1, alpha: number): void {
  g.fillStyle = `rgba(127,224,255,${alpha.toFixed(2)})`;
  for (let i = -14; i <= 14; i++) {
    const x = cx + facing * (22 + Math.round(Math.sqrt(196 - i * i) * 0.5));
    g.fillRect(x, cy + i * 2, 2, 2);
  }
}

function drawShape(id: SpellId, x: number, y: number, s: number, color: string): void {
  g.strokeStyle = color;
  g.lineWidth = 2;
  g.beginPath();
  const P = (px: number, py: number) => [x + px * s, y + py * s] as const;
  const path: Record<SpellId, Array<readonly [number, number]>> = {
    bolt: [P(0, 0), P(1, 0), P(0, 1), P(1, 1)],
    shield: [P(0, 0.5), P(1, 0.5)],
    frost: [P(0, 0), P(0.5, 1), P(1, 0)],
    heal: [P(0, 1), P(0.5, 0), P(1, 1)],
    fire: [],
  };
  if (id === "fire") {
    g.arc(x + s / 2, y + s / 2, s / 2, 0, Math.PI * 2);
  } else {
    path[id].forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py)));
  }
  g.stroke();
}

function drawBattleHud(b: Battle): void {
  // 체력/마나
  text("리오", 12, 10, "#f4ecff");
  bar(12, 18, 150, 7, b.player.hp / b.player.maxHp, "#ff5a6a");
  bar(12, 29, 110, 4, b.player.mana / MANA_MAX, "#5a8aff");
  text(`${Math.ceil(b.player.hp)}`, 168, 21, "#ffb0b8");
  text(b.def.name, W - 12, 10, "#f4ecff", "right");
  bar(W - 162, 18, 150, 7, b.enemy.hp / b.enemy.maxHp, "#c05aff");
  text(`${Math.ceil(b.enemy.hp)}`, W - 168, 21, "#e0b0ff", "right");

  // 적이 모으는 주문
  const e = b.enemy;
  if (e.charging) {
    const box = spriteBox(b.def.char, EX);
    const k = (b.t - e.charging.start) / (e.charging.end - e.charging.start);
    const big = e.charging.spell.amount >= 20;
    bar(EX - 34, box.top - 12, 68, 4, k, e.charging.spell.color);
    text(e.charging.spell.name + (big ? "!!" : ""), EX, box.top - 24, e.charging.spell.color, "center");
  } else if (b.t < e.stunUntil) {
    const box = spriteBox(b.def.char, EX);
    text("얼어붙음", EX, box.top - 14, "#a8e8ff", "center");
  }

  // 주문 안내판
  const n = b.unlocked.length;
  const bw = 88;
  const gap = 4;
  const x0 = Math.round((W - (n * bw + (n - 1) * gap)) / 2);
  b.unlocked.forEach((id, i) => {
    const info = SPELL_INFO[id];
    const x = x0 + i * (bw + gap);
    const y = 232;
    const ok = b.player.mana >= info.cost;
    g.fillStyle = "rgba(10,8,20,0.75)";
    g.fillRect(x, y, bw, 32);
    g.strokeStyle = ok ? info.color : "#3a3450";
    g.lineWidth = 1;
    g.strokeRect(x + 0.5, y + 0.5, bw - 1, 31);
    drawShape(id, x + 6, y + 7, 18, ok ? info.color : "#4a4460");
    text(info.name, x + 30, y + 10, ok ? "#f4ecff" : "#6a6480", "left", false);
    text(`${info.key} · ${info.cost}`, x + 30, y + 23, "#8a80a8", "left", false);
  });

  if (chIdx === 0 && b.casts < 4 && !b.over) {
    text("화면에 Z를 그리면 번개! ─ 를 그으면 방어막!", W / 2, 52, "#ffd36a", "center");
  }
}

function draw(): void {
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = "#0b0814";
  g.fillRect(0, 0, W, H);
  if (mode === "title") {
    g.drawImage(background("tower"), 0, 0);
    animateBg(g, "tower", time);
    drawChar("rio", PX, false, 0, Math.round(Math.sin(time * 2)));
    drawChar("noct", EX, true, 0, Math.round(Math.sin(time * 2 + 1)));
    return;
  }
  const ch = CHAPTERS[chIdx];
  const sx = shake > 0 ? Math.round((Math.random() - 0.5) * shake * 16) : 0;
  const sy = shake > 0 ? Math.round((Math.random() - 0.5) * shake * 16) : 0;
  g.setTransform(1, 0, 0, 1, sx, sy);
  g.drawImage(background(ch.bg), 0, 0);
  animateBg(g, ch.bg, time);

  const b = battle;
  const bob = (o: number) => Math.round(Math.sin(time * 2.4 + o));
  if (mode === "battle" && b) {
    if (b.player.hp > 0 || !b.over) drawChar("rio", PX, false, b.player.flash, bob(0));
    if (b.enemy.hp > 0) drawChar(b.def.char, EX, true, b.enemy.flash, b.t < b.enemy.stunUntil ? 0 : bob(1));
    if (b.player.shieldUntil > b.t) shieldArc(bodyOf("p").x, bodyOf("p").y, 1, 0.5 + Math.sin(time * 20) * 0.2);
    if (b.enemy.shieldUntil > b.t) shieldArc(bodyOf("e").x, bodyOf("e").y, -1, 0.5 + Math.sin(time * 20) * 0.2);
    if (b.t < b.enemy.stunUntil) {
      const box = spriteBox(b.def.char, EX);
      g.fillStyle = "rgba(168,232,255,0.25)";
      g.fillRect(box.left, box.top, box.w, box.h);
    }
    for (const pr of b.projectiles) {
      const p = projPos(pr);
      g.fillStyle = pr.color;
      g.fillRect(Math.round(p.x - pr.size / 2), Math.round(p.y - pr.size / 2), pr.size, pr.size);
      g.fillStyle = "#fff";
      g.fillRect(Math.round(p.x - 1), Math.round(p.y - 1), 2, 2);
    }
    for (const pt of b.particles) {
      g.globalAlpha = 1 - pt.life / pt.max;
      g.fillStyle = pt.color;
      g.fillRect(Math.round(pt.x), Math.round(pt.y), pt.s, pt.s);
    }
    g.globalAlpha = 1;
    g.setTransform(1, 0, 0, 1, 0, 0);
    drawBattleHud(b);
    for (const f of b.floaters) {
      const k = b.t - f.t0;
      text(f.text, f.x, f.y - k * 20, f.color, "center");
    }
    // 그리는 중인 선
    const drawStroke = (pts: Pt[], color: string, alpha: number) => {
      g.globalAlpha = alpha;
      g.fillStyle = color;
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1];
        const c = pts[i];
        const steps = Math.max(1, Math.ceil(Math.hypot(c.x - a.x, c.y - a.y) / 2));
        for (let k = 0; k <= steps; k++) {
          g.fillRect(Math.round(a.x + ((c.x - a.x) * k) / steps) - 1, Math.round(a.y + ((c.y - a.y) * k) / steps) - 1, 3, 3);
        }
      }
      g.globalAlpha = 1;
    };
    if (b.stroke) drawStroke(b.stroke, "#fff3b0", 0.9);
    if (b.lastStroke && b.t < b.lastStroke.until) drawStroke(b.lastStroke.pts, b.lastStroke.color, (b.lastStroke.until - b.t) / 0.4);
    if (b.banner && b.t < b.banner.until) {
      g.fillStyle = "rgba(0,0,0,0.45)";
      g.fillRect(0, 100, W, 40);
      g.save();
      g.font = "bold 22px Galmuri11";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillStyle = "#000";
      g.fillText(b.banner.text, W / 2 + 2, 122);
      g.fillStyle = b.banner.color;
      g.fillText(b.banner.text, W / 2, 120);
      g.restore();
    }
  } else {
    drawChar("rio", PX, false, 0, bob(0));
    if (rightChar) drawChar(rightChar, EX, true, 0, bob(1));
  }
}

// ── 루프 ─────────────────────────────────────────────────
let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  time += dt;
  shake = Math.max(0, shake - dt);
  if (mode === "battle" && battle) updateBattle(dt);
  if (mode === "story") {
    const full = lines[lineIdx][1];
    if (typed < full.length) {
      typed = Math.min(full.length, typed + dt * 38);
      ui.text.textContent = full.slice(0, Math.floor(typed));
    }
  }
  draw();
  requestAnimationFrame(frame);
}

// ── 입력 ─────────────────────────────────────────────────
function toCanvas(e: PointerEvent): Pt {
  const r = canvas.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
}

canvas.addEventListener("pointerdown", (e) => {
  unlockAudio();
  if (mode === "card") return endCard();
  if (mode === "story") return advance();
  if (mode === "battle" && battle && !battle.over) {
    canvas.setPointerCapture(e.pointerId);
    battle.stroke = [toCanvas(e)];
  }
});
canvas.addEventListener("pointermove", (e) => {
  if (battle?.stroke) battle.stroke.push(toCanvas(e));
});
const endStroke = () => {
  const b = battle;
  if (!b?.stroke) return;
  const pts = b.stroke;
  b.stroke = null;
  const id = recognize(pts, 18);
  if (id) {
    b.lastStroke = { pts, until: b.t + 0.4, color: SPELL_INFO[id].color };
    cast(id);
  } else if (pts.length > 3) {
    b.lastStroke = { pts, until: b.t + 0.4, color: "#6a6480" };
    float("p", "주문 실패…", "#8a80a8");
    sfx.fizzle();
  }
};
canvas.addEventListener("pointerup", endStroke);
canvas.addEventListener("pointercancel", endStroke);
ui.dialog.addEventListener("pointerdown", () => {
  unlockAudio();
  if (mode === "story") advance();
});
ui.card.addEventListener("pointerdown", endCard);

const KEY_SPELL: Record<string, SpellId> = { "1": "bolt", "2": "shield", "3": "fire", "4": "frost", "5": "heal" };
window.addEventListener("keydown", (e) => {
  unlockAudio();
  if (e.repeat) return;
  if (mode === "card" && (e.code === "Space" || e.code === "Enter")) {
    e.preventDefault();
    endCard();
  } else if (mode === "story" && (e.code === "Space" || e.code === "Enter")) {
    e.preventDefault();
    advance();
  } else if (mode === "battle" && KEY_SPELL[e.key]) {
    cast(KEY_SPELL[e.key]);
  }
});

window.addEventListener("resize", resize);
resize();
void document.fonts.load(FONT).finally(() => {
  showTitle();
  requestAnimationFrame(frame);
});

// 테스트용
(window as unknown as { __wand: unknown }).__wand = {
  get mode() {
    return mode;
  },
  get battle() {
    return battle;
  },
  startChapter,
  startBattle,
  cast,
};

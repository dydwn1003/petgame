import "../fonts.css";
import "./style.css";
import {
  ARCHMAGE,
  ELEM,
  MASTERS,
  PROF_LOOK,
  REGIONS,
  SCHOOLS,
  SPELLS,
  SPELL_IDS,
  STARTER_SPELLS,
  HERO_LOOK,
  enemyStats,
  gainXp,
  heroStats,
  xpNeed,
  type Elem,
  type Hero,
  type Look,
  type Master,
  type RegionId,
  type SpellId,
} from "./data";
import { Battle, type BattleInput, type Foe } from "./battle";
import { T, tileSprite, wizardSprite, type Facing } from "./sprites";
import { FOUNTAIN, MAP_H, MAP_W, PROF_POS, START_POS, TILE, buildWorld, isSolid, regionAt, tileAt } from "./world";
import { sfx, unlockAudio } from "./sfx";

const W = 480;
const H = 270;
const FONT = "11px Galmuri11";
const SAVE_KEY = "wizard_world_v1";
const WALK_SPEED = 72;
const RUN_SPEED = 115;
const MAX_WANDERERS = 16;

const canvas = document.getElementById("screen") as HTMLCanvasElement;
const g = canvas.getContext("2d")!;
g.imageSmoothingEnabled = false;
const stage = document.getElementById("stage")!;
const $ = (id: string) => document.getElementById(id)!;
const ui = { dialog: $("dialog"), who: $("who"), text: $("text"), panel: $("panel") };

// ── 저장 ─────────────────────────────────────────────────
function freshHero(): Hero {
  const s = heroStats(1);
  return {
    lv: 1, xp: 0, hp: s.maxHp, mana: s.maxMana, known: [], equip: [null, null], potions: 3, seals: [],
    x: (START_POS.x + 0.5) * TILE, y: (START_POS.y + 0.5) * TILE, started: false, champion: false,
  };
}
function loadHero(): Hero | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const h = { ...freshHero(), ...JSON.parse(raw) } as Hero;
    return h.started ? h : null;
  } catch {
    return null;
  }
}
function save(): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(hero));
  } catch {
    /* 무시 */
  }
}

// ── 상태 ─────────────────────────────────────────────────
type Mode = "title" | "world" | "dialog" | "battle" | "panel";
let mode: Mode = "title";
let hero: Hero = freshHero();
const world = buildWorld();
let time = 0;
let face: Facing = "down";
let faceLeft = false;
let walking = false;
let invuln = 0;
let saveTimer = 0;
let lastRegion: RegionId | null = null;
let banner = { text: "", until: 0 };

interface Wanderer {
  x: number;
  y: number;
  school: Elem;
  lv: number;
  tx: number;
  ty: number;
  wait: number;
  alert: number;
  chasing: boolean;
  calm: number;
  face: Facing;
  left: boolean;
}
let wanderers: Wanderer[] = [];
let spawnTimer = 0;

let battle: Battle | null = null;
type BattleCtx = { kind: "wild"; w: Wanderer } | { kind: "master"; m: Master };
let battleCtx: BattleCtx | null = null;

// ── 입력 ─────────────────────────────────────────────────
const keys = new Set<string>();
const pressed = new Set<string>();
const touchHeld = new Set<string>();
const joy = { id: -1, sx: 0, sy: 0, x: 0, y: 0 };
let mouseHeld = false;

function press(code: string): void {
  pressed.add(code);
}
function took(...codes: string[]): boolean {
  let hit = false;
  for (const c of codes) if (pressed.has(c)) hit = true;
  return hit;
}

function moveVector(): { x: number; y: number } {
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
    if (len > 4) {
      const k = Math.min(1, len / 24) / len;
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

// ── 화면 크기 ─────────────────────────────────────────────
function resize(): void {
  const k = Math.min(window.innerWidth / W, window.innerHeight / H);
  const u = k >= 2 ? Math.floor(k) : k;
  stage.style.width = `${W * u}px`;
  stage.style.height = `${H * u}px`;
  document.documentElement.style.setProperty("--u", `${u}px`);
}

function setMode(m: Mode): void {
  mode = m;
  document.body.dataset.mode = m;
}

// ── 대화 ─────────────────────────────────────────────────
type Line = [string, string];
let dlg: { lines: Line[]; i: number; typed: number; onDone?: () => void } | null = null;

function say(lines: Line[], onDone?: () => void): void {
  dlg = { lines, i: 0, typed: 0, onDone };
  setMode("dialog");
  ui.dialog.classList.remove("hidden");
  showLine();
}
function showLine(): void {
  if (!dlg) return;
  const [who] = dlg.lines[dlg.i];
  ui.who.textContent = who;
  ui.dialog.classList.toggle("narr", !who);
  ui.text.textContent = "";
  dlg.typed = 0;
}
function advanceDialog(): void {
  if (!dlg) return;
  const full = dlg.lines[dlg.i][1];
  if (dlg.typed < full.length) {
    dlg.typed = full.length;
    ui.text.textContent = full;
    return;
  }
  sfx.blip();
  dlg.i++;
  if (dlg.i < dlg.lines.length) return showLine();
  const done = dlg.onDone;
  dlg = null;
  ui.dialog.classList.add("hidden");
  setMode("world");
  done?.();
}

// ── 패널 (타이틀 · 주문 선택 · 수첩) ──────────────────────
function openPanel(html: string, bind: (root: HTMLElement) => void): void {
  ui.panel.innerHTML = html;
  ui.panel.classList.remove("hidden");
  setMode("panel");
  bind(ui.panel);
}
function closePanel(): void {
  ui.panel.classList.add("hidden");
  setMode("world");
}

function showTitle(): void {
  setMode("title");
  const saved = loadHero();
  openPanel(
    `<div class="title">
      <h1>마법사의 여정</h1>
      <p>도트 마법사가 되어 넓은 대륙을 여행하세요.<br>떠돌이 마법사와 결투하며 주문을 모으고, 네 마스터의 인장을 손에 넣으세요.</p>
      <div class="btns">
        ${saved ? `<button data-a="continue" class="primary">이어하기 · Lv${saved.lv} · 인장 ${saved.seals.length}/4</button>` : ""}
        <button data-a="new" class="${saved ? "" : "primary"}">새 모험</button>
      </div>
    </div>`,
    (root) => {
      root.querySelector('[data-a="continue"]')?.addEventListener("click", () => {
        hero = saved!;
        closePanel();
        enterWorld();
      });
      root.querySelector('[data-a="new"]')?.addEventListener("click", () => {
        hero = freshHero();
        closePanel();
        enterWorld();
        say(
          [
            ["오린 교수", "어서 오너라! 오늘부터 너도 별빛 마을의 견습 마법사구나."],
            ["오린 교수", "이 대륙에는 여러 유파의 떠돌이 마법사들이 돌아다닌단다. 눈이 마주치면 결투를 걸어오지."],
            ["오린 교수", "이기면 그들이 떨어뜨린 주문서로 새 주문을 배울 수 있어."],
            ["오린 교수", "각 지역 마스터 네 명을 이기고 인장을 모으면, 북쪽 탑의 대마법사에게 도전할 수 있단다."],
            ["오린 교수", "자, 첫 주문을 하나 골라 보거라!"],
          ],
          chooseStarter,
        );
      });
    },
  );
}

function spellCard(id: SpellId, extra = ""): string {
  const s = SPELLS[id];
  const c = ELEM[s.elem];
  return `<div class="spell" style="--c:${c.color}">
    <div class="spell-name">${s.name} <span class="tag">${c.name}</span></div>
    <div class="spell-desc">${s.desc}</div>
    <div class="spell-cost">마나 ${s.cost} · 재사용 ${s.cd}초</div>${extra}</div>`;
}

function chooseStarter(): void {
  openPanel(
    `<div class="choose"><h2>첫 주문 고르기</h2>
      <div class="cards">${STARTER_SPELLS.map((id) => `<button data-s="${id}" class="card-btn">${spellCard(id)}</button>`).join("")}</div>
      <p class="hint">나머지 주문은 결투에서 이기면 주문서로 얻을 수 있어요.</p></div>`,
    (root) => {
      root.querySelectorAll<HTMLButtonElement>("[data-s]").forEach((b) =>
        b.addEventListener("click", () => {
          learn(b.dataset.s as SpellId);
          hero.started = true;
          save();
          closePanel();
          sfx.learn();
          say([
            ["오린 교수", `「${SPELLS[b.dataset.s as SpellId].name}」! 좋은 선택이야.`],
            ["오린 교수", "J로 마법 화살, K·L로 주문, Space로 회피, H로 물약이란다."],
            ["오린 교수", "지치면 마을 분수 앞에서 E를 눌러 쉬어 가렴. M을 누르면 마법사 수첩이 열린단다."],
            ["오린 교수", "남쪽 들판부터 천천히 둘러보거라. 행운을 빈다!"],
          ]);
        }),
      );
    },
  );
}

const SEAL_ICON: Record<string, string> = { forest: "🌿", lake: "💧", rocky: "🪨", plains: "⚡" };

function openBook(): void {
  const hs = heroStats(hero.lv);
  const render = () => {
    ui.panel.innerHTML = `<div class="book">
      <h2>마법사 수첩</h2>
      <div class="stat">Lv${hero.lv} · 경험치 ${hero.xp}/${xpNeed(hero.lv)} · 체력 ${Math.ceil(hero.hp)}/${hs.maxHp} · 마나 ${Math.floor(hero.mana)}/${hs.maxMana} · 물약 ×${hero.potions}</div>
      <div class="seals">${MASTERS.map((m) => `<span class="${hero.seals.includes(m.id) ? "on" : ""}" title="${m.name}">${SEAL_ICON[m.id]}</span>`).join("")}<b>인장 ${hero.seals.length}/4</b></div>
      <div class="grid">${SPELL_IDS.map((id) => {
        if (!hero.known.includes(id)) {
          const school = (Object.values(SCHOOLS).find((s) => s.spell === id))!;
          return `<div class="spell unknown"><div class="spell-name">???</div><div class="spell-desc">${school.title}에게서 얻을 수 있다</div></div>`;
        }
        const slot = hero.equip.indexOf(id);
        return spellCard(
          id,
          `<div class="equip"><button data-eq="${id}" data-slot="0" class="${slot === 0 ? "on" : ""}">K</button><button data-eq="${id}" data-slot="1" class="${slot === 1 ? "on" : ""}">L</button></div>`,
        );
      }).join("")}</div>
      <button data-a="close" class="close">닫기 (M)</button></div>`;
    ui.panel.querySelector('[data-a="close"]')!.addEventListener("click", closePanel);
    ui.panel.querySelectorAll<HTMLButtonElement>("[data-eq]").forEach((b) =>
      b.addEventListener("click", () => {
        const id = b.dataset.eq as SpellId;
        const slot = Number(b.dataset.slot) as 0 | 1;
        const other = (1 - slot) as 0 | 1;
        if (hero.equip[other] === id) hero.equip[other] = hero.equip[slot];
        hero.equip[slot] = id;
        sfx.blip();
        save();
        render();
      }),
    );
  };
  openPanel("", render);
}

// ── 월드 ─────────────────────────────────────────────────
function enterWorld(): void {
  setMode("world");
  wanderers = [];
  invuln = 2;
  lastRegion = null;
}

function learn(id: SpellId): void {
  if (hero.known.includes(id)) return;
  hero.known.push(id);
  if (!hero.equip[0]) hero.equip[0] = id;
  else if (!hero.equip[1]) hero.equip[1] = id;
}

function blockedAt(x: number, y: number): boolean {
  for (const [px, py] of [[x - 5, y - 5], [x + 5, y - 5], [x - 5, y], [x + 5, y]]) {
    if (isSolid(world, Math.floor(px / TILE), Math.floor(py / TILE))) return true;
  }
  return false;
}

function moveEntity(o: { x: number; y: number }, dx: number, dy: number): boolean {
  let moved = false;
  if (dx && !blockedAt(o.x + dx, o.y)) {
    o.x += dx;
    moved = true;
  }
  if (dy && !blockedAt(o.x, o.y + dy)) {
    o.y += dy;
    moved = true;
  }
  return moved;
}

function facingFrom(dx: number, dy: number): { face: Facing; left: boolean } {
  if (Math.abs(dx) >= Math.abs(dy)) return { face: "side", left: dx < 0 };
  return { face: dy < 0 ? "up" : "down", left: false };
}

function spawnWanderer(): void {
  for (let tries = 0; tries < 40; tries++) {
    const tx = 2 + Math.floor(Math.random() * (MAP_W - 4));
    const ty = 2 + Math.floor(Math.random() * (MAP_H - 4));
    const reg = REGIONS[regionAt(tx, ty)];
    if (!reg.spawns.length || isSolid(world, tx, ty)) continue;
    const tile = tileAt(world, tx, ty);
    if (tile === T.PATH || (tile !== T.TALL && Math.random() < 0.7)) continue;
    const x = (tx + 0.5) * TILE;
    const y = (ty + 0.7) * TILE;
    if (Math.hypot(x - hero.x, y - hero.y) < 10 * TILE) continue;
    const total = reg.spawns.reduce((s, [, w]) => s + w, 0);
    let r = Math.random() * total;
    let school: Elem = reg.spawns[0][0];
    for (const [s, w] of reg.spawns) {
      r -= w;
      if (r <= 0) {
        school = s;
        break;
      }
    }
    const lv = reg.lv[0] + Math.floor(Math.random() * (reg.lv[1] - reg.lv[0] + 1));
    wanderers.push({ x, y, school, lv, tx: x, ty: y, wait: Math.random() * 2, alert: -1, chasing: false, calm: 0, face: "down", left: false });
    return;
  }
}

function updateWanderers(dt: number): void {
  for (const w of wanderers) {
    w.calm = Math.max(0, w.calm - dt);
    const d = Math.hypot(w.x - hero.x, w.y - hero.y);
    if (w.alert >= 0) {
      w.alert -= dt;
      if (w.alert < 0) w.chasing = true;
      continue;
    }
    if (w.chasing) {
      const k = (82 * dt) / (d || 1);
      const f = facingFrom(hero.x - w.x, hero.y - w.y);
      w.face = f.face;
      w.left = f.left;
      moveEntity(w, (hero.x - w.x) * k, (hero.y - w.y) * k);
      if (d > 9 * TILE) w.chasing = false;
      continue;
    }
    if (d < 4 * TILE && invuln <= 0 && w.calm <= 0 && mode === "world") {
      w.alert = 0.55;
      const f = facingFrom(hero.x - w.x, hero.y - w.y);
      w.face = f.face;
      w.left = f.left;
      sfx.alert();
      continue;
    }
    if (w.wait > 0) {
      w.wait -= dt;
      continue;
    }
    const dx = w.tx - w.x;
    const dy = w.ty - w.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 1) {
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      const [ddx, ddy] = dirs[Math.floor(Math.random() * 4)];
      const steps = 1 + Math.floor(Math.random() * 3);
      const ntx = Math.floor(w.x / TILE) + ddx * steps;
      const nty = Math.floor(w.y / TILE) + ddy * steps;
      if (!isSolid(world, ntx, nty) && REGIONS[regionAt(ntx, nty)].spawns.length) {
        w.tx = (ntx + 0.5) * TILE;
        w.ty = (nty + 0.7) * TILE;
      }
      w.wait = 0.5 + Math.random() * 1.8;
      continue;
    }
    const step = Math.min(dist, 30 * dt);
    const f = facingFrom(dx, dy);
    w.face = f.face;
    w.left = f.left;
    if (!moveEntity(w, (dx / dist) * step, (dy / dist) * step)) {
      w.tx = w.x;
      w.ty = w.y;
    }
  }
  wanderers = wanderers.filter((w) => Math.hypot(w.x - hero.x, w.y - hero.y) < 34 * TILE);
}

function npcList(): Array<{ x: number; y: number; look: Look; name: string; master?: Master; prof?: boolean }> {
  const list: Array<{ x: number; y: number; look: Look; name: string; master?: Master; prof?: boolean }> = [
    { x: (PROF_POS.x + 0.5) * TILE, y: (PROF_POS.y + 0.8) * TILE, look: PROF_LOOK, name: "오린 교수", prof: true },
  ];
  for (const m of [...MASTERS, ARCHMAGE]) {
    const look = m.look ?? { ...SCHOOLS[m.school].look, trim: "#ffd36a" };
    list.push({ x: (m.pos.x + 0.5) * TILE, y: (m.pos.y + 0.8) * TILE, look, name: m.name, master: m });
  }
  return list;
}

function interact(): void {
  for (const n of npcList()) {
    if (Math.hypot(n.x - hero.x, n.y - hero.y) > 24) continue;
    if (n.prof) return talkProf();
    if (n.master) return talkMaster(n.master);
  }
  const fx = (FOUNTAIN.x + 0.5) * TILE;
  const fy = (FOUNTAIN.y + 0.5) * TILE;
  if (Math.hypot(fx - hero.x, fy - hero.y) < 28) {
    const s = heroStats(hero.lv);
    hero.hp = s.maxHp;
    hero.mana = s.maxMana;
    hero.potions = Math.max(hero.potions, 3);
    save();
    sfx.heal();
    say([["", "분수의 맑은 물을 마셨다. 체력과 마나가 모두 회복되었다! (물약 3개 보충)"]]);
  }
}

function talkProf(): void {
  const n = hero.seals.length;
  const tip: Line =
    hero.champion
      ? ["오린 교수", "대마법사를 이기다니! 이제 네가 이 대륙 최고의 마법사로구나."]
      : n === 0
        ? ["오린 교수", "서쪽 위 숲의 마스터 리아나가 가장 가까운 마스터란다. 먼저 들판에서 실력을 키우렴."]
        : n < 4
          ? ["오린 교수", `인장 ${n}개! 훌륭하구나. 아직 ${4 - n}명의 마스터가 남았어.`]
          : ["오린 교수", "인장 네 개가 모였구나! 북쪽 탑의 대마법사가 기다리고 있단다."];
  say([
    tip,
    ["오린 교수", "속성끼리는 상성이 있단다. 불은 숲과 서리에, 물은 불과 바위에 강하지. 수첩에서 주문을 바꿔 끼워 보렴."],
  ]);
}

function talkMaster(m: Master): void {
  if (m === ARCHMAGE) {
    if (hero.champion) return say([[m.name, "또 왔느냐. 탑의 주인답게 당당히 다녀라."]]);
    if (hero.seals.length < 4) return say([[m.name, `인장이 ${hero.seals.length}개뿐이로구나. 네 개를 모아 오너라.`]]);
  } else if (hero.seals.includes(m.id)) {
    return say([[m.name, m.outro[0]]]);
  }
  say(m.intro.map((t): Line => [m.name, t]), () => startMasterBattle(m));
}

// ── 결투 시작 / 끝 ────────────────────────────────────────
function wildFoe(w: Wanderer): Foe {
  const s = SCHOOLS[w.school];
  const st = enemyStats(s, w.lv, 1);
  return { name: s.title, look: s.look, elem: s.elem, lv: w.lv, ...st, spd: s.spd, melee: s.melee, spells: [s.spell], boss: false };
}

function startWildBattle(w: Wanderer): void {
  battle = new Battle(hero, wildFoe(w), true, regionAt(Math.floor(hero.x / TILE), Math.floor(hero.y / TILE)));
  battleCtx = { kind: "wild", w };
  dlg = null;
  ui.dialog.classList.add("hidden");
  setMode("battle");
}

function startMasterBattle(m: Master): void {
  const s = SCHOOLS[m.school];
  const st = enemyStats(s, m.lv, m === ARCHMAGE ? 2.2 : 1.7);
  const foe: Foe = {
    name: m.name, look: m.look ?? { ...s.look, trim: "#ffd36a" }, elem: s.elem, lv: m.lv, ...st,
    spd: s.spd * 1.05, melee: s.melee, spells: m.spells, boss: true,
  };
  battle = new Battle(hero, foe, false, m === ARCHMAGE ? "arena" : regionAt(m.pos.x, m.pos.y));
  battleCtx = { kind: "master", m };
  dlg = null;
  ui.dialog.classList.add("hidden");
  setMode("battle");
}

function endBattle(): void {
  const b = battle!;
  const ctx = battleCtx!;
  battle = null;
  battleCtx = null;
  invuln = 2.5;
  setMode("world");
  const lines: Line[] = [];

  if (b.outcome === "lose") {
    const s = heroStats(hero.lv);
    hero.hp = s.maxHp;
    hero.mana = s.maxMana;
    hero.x = (FOUNTAIN.x + 0.5) * TILE;
    hero.y = (FOUNTAIN.y + 1.8) * TILE;
    wanderers = [];
    lines.push(["", "눈앞이 캄캄해졌다…"], ["", "정신을 차려 보니 마을 분수 앞이었다."]);
  } else if (b.outcome === "run") {
    if (ctx.kind === "wild") {
      ctx.w.chasing = false;
      ctx.w.calm = 6;
    }
    save();
    return;
  } else {
    const isMaster = ctx.kind === "master";
    const lv = isMaster ? ctx.m.lv : ctx.w.lv;
    const xp = (lv * 8 + 6) * (isMaster ? 3 : 1);
    const ups = gainXp(hero, xp);
    lines.push(["", `경험치를 ${xp} 얻었다!`]);
    if (ups) {
      sfx.learn();
      lines.push(["", `레벨 업! Lv${hero.lv}이(가) 되었다. 체력과 마나가 회복되었다.`]);
    }
    if (ctx.kind === "wild") {
      wanderers = wanderers.filter((w) => w !== ctx.w);
      const spell = SCHOOLS[ctx.w.school].spell;
      if (!hero.known.includes(spell) && Math.random() < 0.45) {
        learn(spell);
        sfx.learn();
        lines.push(["", `${SCHOOLS[ctx.w.school].title}가 떨어뜨린 주문서를 주웠다! 「${SPELLS[spell].name}」을(를) 배웠다!`]);
        if (!hero.equip.includes(spell)) lines.push(["", "M을 눌러 수첩에서 주문 칸에 끼울 수 있다."]);
      } else if (Math.random() < 0.25) {
        hero.potions++;
        lines.push(["", "물약을 하나 주웠다!"]);
      }
    } else if (ctx.m === ARCHMAGE) {
      hero.champion = true;
      lines.push(...ctx.m.outro.map((t): Line => [ctx.m.name, t]), ["", "— 축하합니다! 대마법사의 탑을 손에 넣었다 —"]);
    } else {
      const m = ctx.m;
      lines.push(...m.outro.map((t): Line => [m.name, t]));
      if (!hero.seals.includes(m.id)) hero.seals.push(m.id);
      const spell = SCHOOLS[m.school].spell;
      if (!hero.known.includes(spell)) {
        learn(spell);
        lines.push(["", `「${SPELLS[spell].name}」 주문서도 받았다!`]);
      }
      sfx.learn();
    }
  }
  save();
  say(lines);
}

// ── 업데이트 ─────────────────────────────────────────────
function updateWorld(dt: number): void {
  const v = moveVector();
  const running = keys.has("ShiftLeft") || keys.has("ShiftRight");
  const speed = (running ? RUN_SPEED : WALK_SPEED) * dt;
  walking = Math.hypot(v.x, v.y) > 0.1;
  if (walking) {
    moveEntity(hero, v.x * speed, v.y * speed);
    const f = facingFrom(v.x, v.y);
    face = f.face;
    faceLeft = f.left;
  }
  invuln = Math.max(0, invuln - dt);
  const s = heroStats(hero.lv);
  hero.mana = Math.min(s.maxMana, hero.mana + 4 * dt);
  hero.hp = Math.min(s.maxHp, hero.hp + 0.5 * dt);

  const reg = regionAt(Math.floor(hero.x / TILE), Math.floor(hero.y / TILE));
  if (reg !== lastRegion) {
    lastRegion = reg;
    banner = { text: REGIONS[reg].name, until: time + 2.2 };
  }

  spawnTimer -= dt;
  if (spawnTimer <= 0 && wanderers.length < MAX_WANDERERS) {
    spawnWanderer();
    spawnTimer = 0.8;
  }
  updateWanderers(dt);
  if (invuln <= 0) {
    const w = wanderers.find((w) => Math.hypot(w.x - hero.x, w.y - hero.y) < 13);
    if (w) return startWildBattle(w);
  }
  if (took("KeyE", "Space", "Enter", "act")) interact();
  else if (took("KeyM", "Tab", "menu")) openBook();

  saveTimer -= dt;
  if (saveTimer <= 0) {
    save();
    saveTimer = 5;
  }
}

function battleInput(): BattleInput {
  const v = moveVector();
  return {
    mx: v.x,
    my: v.y,
    basic: keys.has("KeyJ") || touchHeld.has("basic") || mouseHeld,
    s1: took("KeyK", "s1"),
    s2: took("KeyL", "s2"),
    dash: took("Space", "dash"),
    potion: took("KeyH", "potion"),
    run: took("KeyX", "Escape", "run"),
  };
}

// ── 그리기 ───────────────────────────────────────────────
function text(str: string, x: number, y: number, color: string, align: CanvasTextAlign = "left"): void {
  g.font = FONT;
  g.textAlign = align;
  g.textBaseline = "middle";
  g.fillStyle = "#000";
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) g.fillText(str, x + dx, y + dy);
  g.fillStyle = color;
  g.fillText(str, x, y);
}

function drawWizard(look: Look, x: number, y: number, f: Facing, left: boolean, walk: boolean): void {
  const spr = wizardSprite(look, f, walk);
  const left0 = Math.round(x - spr.width / 2);
  const top = Math.round(y - spr.height);
  g.fillStyle = "rgba(0,0,0,0.25)";
  g.fillRect(left0 + 2, Math.round(y) - 1, spr.width - 4, 2);
  if (f === "side" && left) {
    g.save();
    g.translate(left0 + spr.width, top);
    g.scale(-1, 1);
    g.drawImage(spr, 0, 0);
    g.restore();
  } else g.drawImage(spr, left0, top);
  // 풀숲 속이면 발을 가린다
  if (tileAt(world, Math.floor(x / TILE), Math.floor((y - 2) / TILE)) === T.TALL) {
    g.fillStyle = "#3a9a3e";
    g.fillRect(left0, Math.round(y) - 4, spr.width, 4);
    g.fillStyle = "#2e7a32";
    for (let i = 0; i < spr.width; i += 3) g.fillRect(left0 + i, Math.round(y) - 6, 1, 3);
  }
}

const ZOOM = 2;
let labels: Array<[string, number, number, string]> = [];

function drawWorld(): void {
  const VW = W / ZOOM;
  const VH = H / ZOOM;
  const camX = Math.round(Math.max(0, Math.min(MAP_W * TILE - VW, hero.x - VW / 2)));
  const camY = Math.round(Math.max(0, Math.min(MAP_H * TILE - VH, hero.y - 8 - VH / 2)));
  const frame = Math.floor(time * 2) % 2;
  const x0 = Math.floor(camX / TILE);
  const y0 = Math.floor(camY / TILE);
  labels = [];
  const label = (s: string, x: number, y: number, c: string) => labels.push([s, (x - camX) * ZOOM, (y - camY) * ZOOM, c]);
  g.setTransform(ZOOM, 0, 0, ZOOM, 0, 0);
  for (let ty = y0; ty <= y0 + Math.ceil(VH / TILE); ty++) {
    for (let tx = x0; tx <= x0 + Math.ceil(VW / TILE); tx++) {
      if (tx >= MAP_W || ty >= MAP_H) continue;
      const i = ty * MAP_W + tx;
      g.drawImage(tileSprite(world.tiles[i], world.variant[i], frame), tx * TILE - camX, ty * TILE - camY);
    }
  }

  g.translate(-camX, -camY);
  type Ent = { y: number; draw: () => void };
  const ents: Ent[] = [];
  for (const n of npcList()) {
    ents.push({
      y: n.y,
      draw: () => {
        drawWizard(n.look, n.x, n.y, "down", false, false);
        const near = Math.hypot(n.x - hero.x, n.y - hero.y) < 60;
        if (near) label(n.name, n.x, n.y - 20, n.master ? "#ffd36a" : "#f4ecff");
        if (n.master && n.master !== ARCHMAGE && hero.seals.includes(n.master.id)) label("✓", n.x + 8, n.y - 14, "#8aff9a");
      },
    });
  }
  for (const w of wanderers) {
    ents.push({
      y: w.y,
      draw: () => {
        drawWizard(SCHOOLS[w.school].look, w.x, w.y, w.face, w.left, (w.chasing || w.wait <= 0) && Math.floor(time * 6) % 2 === 1);
        if (w.alert >= 0) {
          g.fillStyle = "#fff";
          g.fillRect(Math.round(w.x) - 3, Math.round(w.y) - 25, 6, 8);
          g.fillStyle = "#e02a2a";
          g.fillRect(Math.round(w.x) - 1, Math.round(w.y) - 24, 2, 4);
          g.fillRect(Math.round(w.x) - 1, Math.round(w.y) - 19, 2, 1);
        } else if (Math.hypot(w.x - hero.x, w.y - hero.y) < 56) label(`Lv${w.lv}`, w.x, w.y - 19, ELEM[w.school].color);
      },
    });
  }
  ents.push({
    y: hero.y,
    draw: () => {
      if (invuln > 0 && Math.floor(time * 10) % 2) g.globalAlpha = 0.6;
      drawWizard(HERO_LOOK, hero.x, hero.y, face, faceLeft, walking && Math.floor(time * 8) % 2 === 1);
      g.globalAlpha = 1;
    },
  });
  ents.sort((a, b) => a.y - b.y).forEach((e) => e.draw());
  g.setTransform(1, 0, 0, 1, 0, 0);
  for (const [s, x, y, c] of labels) text(s, x, y, c, "center");

  // HUD
  const s = heroStats(hero.lv);
  g.fillStyle = "rgba(10,8,20,0.7)";
  g.fillRect(6, 6, 132, 30);
  text(`Lv${hero.lv}`, 12, 14, "#ffd36a");
  const bar = (x: number, y: number, w: number, h: number, k: number, c: string) => {
    g.fillStyle = "#000";
    g.fillRect(x - 1, y - 1, w + 2, h + 2);
    g.fillStyle = "#2a2238";
    g.fillRect(x, y, w, h);
    g.fillStyle = c;
    g.fillRect(x, y, Math.round(w * Math.max(0, Math.min(1, k))), h);
  };
  bar(40, 11, 92, 5, hero.hp / s.maxHp, "#ff5a6a");
  bar(40, 20, 92, 3, hero.mana / s.maxMana, "#5a8aff");
  bar(12, 28, 120, 2, hero.xp / xpNeed(hero.lv), "#ffd36a");
  const info = `인장 ${hero.seals.length}/4 · 주문 ${hero.known.length}/8 · 물약 ${hero.potions}`;
  g.fillStyle = "rgba(10,8,20,0.7)";
  g.fillRect(W - 186, 6, 180, 16);
  text(info, W - 12, 14, "#f4ecff", "right");
  if (time < banner.until) {
    g.globalAlpha = Math.min(1, (banner.until - time) * 2);
    g.fillStyle = "rgba(10,8,20,0.7)";
    g.fillRect(W / 2 - 80, 40, 160, 22);
    text(banner.text, W / 2, 51, "#ffd36a", "center");
    g.globalAlpha = 1;
  }
  if (mode === "world" && !matchMedia("(pointer: coarse)").matches) text("E 대화·조사   M 수첩   Shift 달리기", W / 2, H - 9, "rgba(244,236,255,0.6)", "center");
}

function draw(): void {
  g.setTransform(1, 0, 0, 1, 0, 0);
  if (mode === "battle" && battle) {
    battle.draw(g, text);
    return;
  }
  drawWorld();
}

// ── 루프 ─────────────────────────────────────────────────
let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  time += dt;
  if (mode === "world") updateWorld(dt);
  else if (mode === "battle" && battle) {
    battle.update(dt, battleInput());
    if (battle.isDone()) endBattle();
  } else if (mode === "dialog" && dlg) {
    const full = dlg.lines[dlg.i][1];
    if (dlg.typed < full.length) {
      dlg.typed = Math.min(full.length, dlg.typed + dt * 40);
      ui.text.textContent = full.slice(0, Math.floor(dlg.typed));
    }
    if (took("KeyE", "Space", "Enter", "act")) advanceDialog();
  } else if (mode === "panel" && took("KeyM", "Tab", "Escape", "menu") && hero.started) {
    closePanel();
  }
  pressed.clear();
  draw();
  requestAnimationFrame(frame);
}

// ── 입력 연결 ────────────────────────────────────────────
window.addEventListener("keydown", (e) => {
  unlockAudio();
  if (["Space", "Tab", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
  if (!e.repeat) press(e.code);
  keys.add(e.code);
});
window.addEventListener("keyup", (e) => keys.delete(e.code));
window.addEventListener("blur", () => {
  keys.clear();
  touchHeld.clear();
  mouseHeld = false;
});

function toCanvas(e: PointerEvent): { x: number; y: number } {
  const r = canvas.getBoundingClientRect();
  return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
}
canvas.addEventListener("pointerdown", (e) => {
  unlockAudio();
  if (e.pointerType === "mouse") {
    if (mode === "battle") mouseHeld = true;
    return;
  }
  if (joy.id === -1) {
    canvas.setPointerCapture(e.pointerId);
    const p = toCanvas(e);
    joy.id = e.pointerId;
    joy.sx = joy.x = p.x;
    joy.sy = joy.y = p.y;
  }
});
canvas.addEventListener("pointermove", (e) => {
  if (e.pointerId === joy.id) {
    const p = toCanvas(e);
    joy.x = p.x;
    joy.y = p.y;
  }
});
const endPointer = (e: PointerEvent) => {
  if (e.pointerId === joy.id) joy.id = -1;
  if (e.pointerType === "mouse") mouseHeld = false;
};
canvas.addEventListener("pointerup", endPointer);
canvas.addEventListener("pointercancel", endPointer);
window.addEventListener("pointerup", (e) => {
  if (e.pointerType === "mouse") mouseHeld = false;
});

ui.dialog.addEventListener("pointerdown", () => {
  unlockAudio();
  advanceDialog();
});
document.querySelectorAll<HTMLButtonElement>("[data-k]").forEach((b) => {
  const k = b.dataset.k!;
  b.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    unlockAudio();
    press(k);
    touchHeld.add(k);
  });
  const up = () => touchHeld.delete(k);
  b.addEventListener("pointerup", up);
  b.addEventListener("pointercancel", up);
  b.addEventListener("pointerleave", up);
});

window.addEventListener("resize", resize);
resize();
void document.fonts.load(FONT).finally(() => {
  showTitle();
  requestAnimationFrame(frame);
});

// 테스트용
(window as unknown as { __game: unknown }).__game = {
  get hero() {
    return hero;
  },
  get mode() {
    return mode;
  },
  get wanderers() {
    return wanderers;
  },
  get battle() {
    return battle;
  },
  startWildBattle,
  startMasterBattle,
  masters: MASTERS,
  archmage: ARCHMAGE,
};

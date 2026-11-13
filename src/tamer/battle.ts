// 실시간 마법 결투 (위에서 내려다보는 아레나)
import {
  ELEM,
  REGIONS,
  SPELLS,
  heroStats,
  typeMult,
  type Elem,
  type Hero,
  type Look,
  type RegionId,
  type SpellId,
} from "./data";
import { wizardSprite, type Facing } from "./sprites";
import { sfx } from "./sfx";

export const W = 480;
export const H = 270;
const AX0 = 16;
const AY0 = 44;
const AX1 = 464;
const AY1 = 232;
const SCALE = 3;
const BODY_R = 12;
const MANA_REGEN = 7;
const ARROW_CD = 0.36;
const DASH_CD = 0.9;

export interface Foe {
  name: string;
  look: Look;
  elem: Elem;
  lv: number;
  maxHp: number;
  atk: number;
  def: number;
  spd: number;
  melee: boolean;
  spells: SpellId[];
  boss: boolean;
}

export interface BattleInput {
  mx: number;
  my: number;
  basic: boolean; // 누르고 있는 동안
  s1: boolean;
  s2: boolean;
  dash: boolean;
  potion: boolean;
  run: boolean;
}

export type BattleOutcome = "win" | "lose" | "run";

interface Fighter {
  side: "p" | "e";
  look: Look;
  elem: Elem | null;
  lv: number;
  x: number;
  y: number;
  kx: number;
  ky: number;
  face: Facing;
  left: boolean;
  walking: boolean;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  speed: number;
  melee: boolean;
  spells: SpellId[];
  cds: Partial<Record<SpellId, number>>;
  cdBasic: number;
  cdDash: number;
  dashT: number;
  dashX: number;
  dashY: number;
  iframe: number;
  flash: number;
  slowUntil: number;
  windup: { action: "basic" | SpellId; t: number; total: number } | null;
  queue: Array<{ t: number; fn: () => void }>;
  strafe: number;
  strafeT: number;
  dodgedIds: Set<number>;
}

interface Shot {
  id: number;
  owner: "p" | "e";
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  power: number;
  elem: Elem | null;
  color: string;
  slow: number;
  life: number;
}

interface Zone {
  owner: "p" | "e";
  x: number;
  y: number;
  r: number;
  delay: number;
  t: number;
  dur: number;
  power: number;
  elem: Elem;
  color: string;
  tick: number;
  acc: number;
  follow: Fighter | null;
  done: boolean;
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

interface Ring {
  x: number;
  y: number;
  r0: number;
  r1: number;
  t: number;
  dur: number;
  color: string;
}

export class Battle {
  t = 0;
  phase: "intro" | "fight" | "end" = "intro";
  outcome: BattleOutcome | null = null;
  banner = "결투 시작!";
  bannerColor = "#ffd36a";
  private endAt = 0;
  private p: Fighter;
  private e: Fighter;
  private shots: Shot[] = [];
  private zones: Zone[] = [];
  private particles: Particle[] = [];
  private rings: Ring[] = [];
  private floaters: Array<{ x: number; y: number; text: string; color: string; t0: number }> = [];
  private shotId = 0;
  private potionCd = 0;
  private shake = 0;
  private hero: Hero;
  private foe: Foe;
  private region: RegionId;
  readonly canRun: boolean;

  constructor(hero: Hero, foe: Foe, canRun: boolean, region: RegionId) {
    this.hero = hero;
    this.foe = foe;
    this.canRun = canRun;
    this.region = region;
    const hs = heroStats(hero.lv);
    this.p = this.makeFighter("p", {
      look: { hat: "#2b3a8c", robe: "#33408f", trim: "#e8c35a", hair: "#6b3e1f" },
      elem: null,
      lv: hero.lv,
      hp: hero.hp,
      maxHp: hs.maxHp,
      atk: hs.atk,
      def: hs.def,
      speed: 95,
      melee: false,
      spells: hero.equip.filter((s): s is SpellId => !!s),
      x: 110,
      y: 150,
    });
    this.e = this.makeFighter("e", {
      look: foe.look,
      elem: foe.elem,
      lv: foe.lv,
      hp: foe.maxHp,
      maxHp: foe.maxHp,
      atk: foe.atk,
      def: foe.def,
      speed: 70 * foe.spd,
      melee: foe.melee,
      spells: foe.spells,
      x: 370,
      y: 140,
    });
    this.e.left = true;
    this.e.face = "side";
    for (const s of this.e.spells) this.e.cds[s] = 2 + Math.random() * 2;
  }

  private makeFighter(
    side: "p" | "e",
    o: { look: Look; elem: Elem | null; lv: number; hp: number; maxHp: number; atk: number; def: number; speed: number; melee: boolean; spells: SpellId[]; x: number; y: number },
  ): Fighter {
    return {
      side, look: o.look, elem: o.elem, lv: o.lv, x: o.x, y: o.y, kx: 0, ky: 0, face: "side", left: false, walking: false,
      hp: o.hp, maxHp: o.maxHp, atk: o.atk, def: o.def, speed: o.speed, melee: o.melee, spells: o.spells, cds: {},
      cdBasic: 0, cdDash: 0, dashT: 0, dashX: 0, dashY: 0, iframe: 0, flash: 0, slowUntil: 0, windup: null, queue: [],
      strafe: 1, strafeT: 0, dodgedIds: new Set(),
    };
  }

  // ── 결과를 주인공에게 돌려주기 ─────────────────────────
  writeBack(): void {
    this.hero.hp = Math.max(0, Math.round(this.p.hp));
    this.hero.mana = Math.round(this.hero.mana);
  }

  // ── 업데이트 ───────────────────────────────────────────
  update(dt: number, inp: BattleInput): void {
    this.t += dt;
    this.shake = Math.max(0, this.shake - dt);
    if (this.phase === "intro" && this.t > 1.1) this.phase = "fight";
    if (this.phase === "end" && this.t >= this.endAt) return;

    const p = this.p;
    const e = this.e;
    const maxMana = heroStats(this.hero.lv).maxMana;
    this.hero.mana = Math.min(maxMana, this.hero.mana + MANA_REGEN * dt);
    this.potionCd = Math.max(0, this.potionCd - dt);

    if (this.phase === "fight") {
      this.playerControl(dt, inp);
      this.enemyAI(dt);
    }
    for (const f of [p, e]) this.stepFighter(f, dt);
    this.updateShots(dt);
    this.updateZones(dt);

    for (const pt of this.particles) {
      pt.life += dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 0.94;
      pt.vy *= 0.94;
    }
    this.particles = this.particles.filter((pt) => pt.life < pt.max);
    this.rings = this.rings.filter((r) => this.t - r.t < r.dur);
    this.floaters = this.floaters.filter((f) => this.t - f.t0 < 0.9);

    if (this.phase === "fight") {
      if (e.hp <= 0) this.finish("win", "승리!", "#ffd36a");
      else if (p.hp <= 0) this.finish("lose", "쓰러졌다…", "#ff6a7a");
    }
  }

  isDone(): boolean {
    return this.phase === "end" && this.t >= this.endAt;
  }

  private finish(o: BattleOutcome, text: string, color: string): void {
    this.phase = "end";
    this.outcome = o;
    this.banner = text;
    this.bannerColor = color;
    this.endAt = this.t + (o === "run" ? 0.6 : 1.6);
    if (o === "win") sfx.win();
    else if (o === "lose") sfx.lose();
    else sfx.blip();
    this.writeBack();
  }

  private playerControl(dt: number, inp: BattleInput): void {
    const p = this.p;
    const e = this.e;
    let mx = inp.mx;
    let my = inp.my;
    const len = Math.hypot(mx, my);
    if (len > 1) {
      mx /= len;
      my /= len;
    }
    if (p.dashT <= 0) {
      const slow = this.t < p.slowUntil ? 0.55 : 1;
      p.x += mx * p.speed * slow * dt;
      p.y += my * p.speed * slow * dt;
    }
    p.walking = len > 0.1;
    if (p.walking) this.setFacing(p, mx, my);
    else this.setFacing(p, e.x - p.x, e.y - p.y);

    if (inp.dash && p.cdDash <= 0) {
      let dx = mx;
      let dy = my;
      if (Math.hypot(dx, dy) < 0.1) {
        const a = Math.atan2(p.y - e.y, p.x - e.x) + Math.PI / 2;
        dx = Math.cos(a);
        dy = Math.sin(a);
      }
      const l = Math.hypot(dx, dy) || 1;
      p.dashX = dx / l;
      p.dashY = dy / l;
      p.dashT = 0.16;
      p.iframe = 0.28;
      p.cdDash = DASH_CD;
      sfx.dash();
      this.burst(p.x, p.y, "#c8d8ff", 8, 30);
    }
    if (inp.basic && p.cdBasic <= 0) {
      p.cdBasic = ARROW_CD;
      this.fireShot(p, e, Math.atan2(e.y - p.y, e.x - p.x), 8, 270, null, "#e0e8ff", 3, 0);
      sfx.shot();
    }
    const trySpell = (slot: 0 | 1) => {
      const id = this.hero.equip[slot];
      if (!id) {
        this.float(p, "빈 슬롯", "#8a80a8");
        return;
      }
      const def = SPELLS[id];
      if ((p.cds[id] ?? 0) > 0) return;
      if (this.hero.mana < def.cost) {
        this.float(p, "마나 부족!", "#7fa8ff");
        sfx.fizzle();
        return;
      }
      this.hero.mana -= def.cost;
      p.cds[id] = def.cd;
      this.castSpell(p, e, id);
    };
    if (inp.s1) trySpell(0);
    if (inp.s2) trySpell(1);
    if (inp.potion && this.potionCd <= 0) {
      if (this.hero.potions > 0 && p.hp < p.maxHp) {
        this.hero.potions--;
        this.potionCd = 1;
        const heal = Math.round(p.maxHp * 0.4);
        p.hp = Math.min(p.maxHp, p.hp + heal);
        this.float(p, `+${heal}`, "#8aff9a");
        this.burst(p.x, p.y, "#8aff9a", 16, 30);
        sfx.heal();
      } else if (this.hero.potions <= 0) {
        this.float(p, "물약이 없다", "#8a80a8");
      }
    }
    if (inp.run) {
      if (this.canRun) this.finish("run", "도망쳤다!", "#c8d8ff");
      else this.float(p, "도망칠 수 없다!", "#ff9a9a");
    }
  }

  private enemyAI(dt: number): void {
    const e = this.e;
    const p = this.p;
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const dist = Math.hypot(dx, dy) || 1;

    // 날아오는 화살 피하기
    if (e.cdDash <= 0 && !e.windup) {
      for (const s of this.shots) {
        if (s.owner !== "p" || e.dodgedIds.has(s.id)) continue;
        if (Math.hypot(s.x - e.x, s.y - e.y) < 60) {
          e.dodgedIds.add(s.id);
          if (Math.random() < (this.foe.boss ? 0.3 : 0.15)) {
            const a = Math.atan2(s.vy, s.vx) + (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2;
            e.dashX = Math.cos(a);
            e.dashY = Math.sin(a);
            e.dashT = 0.16;
            e.iframe = 0.25;
            e.cdDash = 2;
          }
        }
      }
    }

    if (e.windup) {
      e.windup.t += dt;
      e.walking = false;
      this.setFacing(e, dx, dy);
      if (e.windup.t >= e.windup.total) {
        const a = e.windup.action;
        e.windup = null;
        if (a === "basic") this.basicAttack(e, p);
        else this.castSpell(e, p, a);
      }
      return;
    }

    const want = e.melee ? 26 : 130;
    let mx = 0;
    let my = 0;
    if (dist > want + 15) {
      mx = dx / dist;
      my = dy / dist;
    } else if (dist < want - 25) {
      mx = -dx / dist;
      my = -dy / dist;
    }
    e.strafeT -= dt;
    if (e.strafeT <= 0) {
      e.strafe = Math.random() < 0.5 ? -1 : 1;
      e.strafeT = 0.8 + Math.random() * 1.2;
    }
    mx += (-dy / dist) * e.strafe * 0.6;
    my += (dx / dist) * e.strafe * 0.6;
    const l = Math.hypot(mx, my) || 1;
    if (e.dashT <= 0) {
      const slow = this.t < e.slowUntil ? 0.5 : 1;
      e.x += (mx / l) * e.speed * slow * dt;
      e.y += (my / l) * e.speed * slow * dt;
    }
    e.walking = true;
    this.setFacing(e, mx, my);

    const bossK = this.foe.boss ? 0.8 : 1;
    const ready = e.spells.filter((s) => (e.cds[s] ?? 0) <= 0);
    if (ready.length && Math.random() < dt * 2) {
      const s = ready[Math.floor(Math.random() * ready.length)];
      e.cds[s] = SPELLS[s].cd * 1.5 * bossK + Math.random();
      e.windup = { action: s, t: 0, total: 0.7 * bossK };
      sfx.charge();
    } else if (e.cdBasic <= 0 && dist < (e.melee ? 48 : 230)) {
      e.cdBasic = (e.melee ? 1.0 : 1.2) * bossK + Math.random() * 0.4;
      e.windup = { action: "basic", t: 0, total: 0.35 * bossK };
    }
  }

  private setFacing(f: Fighter, dx: number, dy: number): void {
    if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return;
    if (Math.abs(dx) >= Math.abs(dy)) {
      f.face = "side";
      f.left = dx < 0;
    } else {
      f.face = dy < 0 ? "up" : "down";
    }
  }

  private stepFighter(f: Fighter, dt: number): void {
    f.cdBasic = Math.max(0, f.cdBasic - dt);
    f.cdDash = Math.max(0, f.cdDash - dt);
    f.iframe = Math.max(0, f.iframe - dt);
    f.flash = Math.max(0, f.flash - dt);
    for (const k of Object.keys(f.cds) as SpellId[]) f.cds[k] = Math.max(0, (f.cds[k] ?? 0) - dt);
    if (f.dashT > 0) {
      f.dashT -= dt;
      f.x += f.dashX * 520 * dt;
      f.y += f.dashY * 520 * dt;
    }
    f.x += f.kx * dt;
    f.y += f.ky * dt;
    f.kx *= Math.pow(0.02, dt);
    f.ky *= Math.pow(0.02, dt);
    f.x = Math.max(AX0 + BODY_R, Math.min(AX1 - BODY_R, f.x));
    f.y = Math.max(AY0 + 34, Math.min(AY1 - 16, f.y));
    for (const q of f.queue) q.t -= dt;
    const due = f.queue.filter((q) => q.t <= 0);
    f.queue = f.queue.filter((q) => q.t > 0);
    for (const q of due) q.fn();
  }

  // ── 공격 ───────────────────────────────────────────────
  private basicAttack(f: Fighter, t: Fighter): void {
    const a = Math.atan2(t.y - f.y, t.x - f.x);
    if (f.melee) {
      f.kx += Math.cos(a) * 200;
      f.ky += Math.sin(a) * 200;
      this.rings.push({ x: f.x + Math.cos(a) * 20, y: f.y + Math.sin(a) * 20, r0: 6, r1: 22, t: this.t, dur: 0.18, color: ELEM[f.elem ?? "rock"].color });
      sfx.swing();
      f.queue.push({
        t: 0.09,
        fn: () => {
          const cx = f.x + Math.cos(a) * 20;
          const cy = f.y + Math.sin(a) * 20;
          if (Math.hypot(t.x - cx, t.y - cy) < 22 + BODY_R) this.hit(f, t, 9, f.elem, { knock: 140, dir: a });
        },
      });
    } else {
      this.fireShot(f, t, a, 8, 230, f.elem, ELEM[f.elem ?? "wind"].color, 3, 0);
      sfx.shot();
    }
  }

  private fireShot(f: Fighter, _t: Fighter, a: number, power: number, speed: number, elem: Elem | null, color: string, r: number, slow: number): void {
    this.shots.push({
      id: this.shotId++, owner: f.side, x: f.x + Math.cos(a) * 14, y: f.y + Math.sin(a) * 14,
      vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, r, power, elem, color, slow, life: 2.5,
    });
  }

  private castSpell(f: Fighter, t: Fighter, id: SpellId): void {
    const def = SPELLS[id];
    const color = ELEM[def.elem].color;
    const aim = () => Math.atan2(t.y - f.y, t.x - f.x);
    this.float(f, def.name, color);
    this.burst(f.x, f.y - 8, color, 10, 40);
    switch (id) {
      case "fan":
        sfx.fire();
        for (const d of [-0.28, 0, 0.28]) this.fireShot(f, t, aim() + d, 10, 230, "fire", color, 5, 0);
        break;
      case "shards":
        sfx.ice();
        for (const d of [-0.42, -0.21, 0, 0.21, 0.42]) this.fireShot(f, t, aim() + d, 5, 250, "ice", color, 3, 1.6);
        break;
      case "chain":
        for (let i = 0; i < 5; i++) {
          f.queue.push({
            t: i * 0.09,
            fn: () => {
              sfx.zap();
              this.fireShot(f, t, aim() + (Math.random() - 0.5) * 0.15, 4.5, 330, "electric", color, 3, 0);
            },
          });
        }
        break;
      case "wave":
        sfx.wave();
        this.rings.push({ x: f.x, y: f.y, r0: 10, r1: 90, t: this.t, dur: 0.35, color });
        if (Math.hypot(t.x - f.x, t.y - f.y) < 90 + BODY_R) this.hit(f, t, 14, "water", { knock: 300, dir: aim() });
        break;
      case "gust": {
        sfx.wave();
        const a = aim();
        for (let i = 0; i < 24; i++) {
          const aa = a + (Math.random() - 0.5) * 1.4;
          const v = 150 + Math.random() * 150;
          this.particles.push({ x: f.x, y: f.y, vx: Math.cos(aa) * v, vy: Math.sin(aa) * v, life: 0, max: 0.5, color, s: 2 });
        }
        const d = Math.hypot(t.x - f.x, t.y - f.y);
        const diff = Math.abs(((Math.atan2(t.y - f.y, t.x - f.x) - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
        if (d < 130 && diff < 0.8) this.hit(f, t, 11, "wind", { knock: 420, dir: a });
        break;
      }
      case "thorns":
        sfx.heal();
        f.hp = Math.min(f.maxHp, f.hp + Math.round(f.maxHp * 0.12));
        this.float(f, `+${Math.round(f.maxHp * 0.12)}`, "#8aff9a");
        this.zones.push({ owner: f.side, x: f.x, y: f.y, r: 50, delay: 0, t: 0, dur: 2.6, power: 5, elem: "grass", color, tick: 0.45, acc: 0.4, follow: f, done: false });
        break;
      case "quake":
        sfx.charge();
        this.zones.push({ owner: f.side, x: t.x, y: t.y, r: 32, delay: 0.7, t: 0, dur: 0.7, power: 18, elem: "rock", color, tick: 0, acc: 0, follow: null, done: false });
        break;
      case "blink": {
        const a = aim();
        this.burst(f.x, f.y, color, 14, 40);
        f.x = t.x + Math.cos(a) * 28;
        f.y = t.y + Math.sin(a) * 28;
        f.iframe = Math.max(f.iframe, 0.3);
        this.burst(f.x, f.y, color, 14, 40);
        sfx.swing();
        f.queue.push({
          t: 0.14,
          fn: () => {
            if (Math.hypot(t.x - f.x, t.y - f.y) < 40) this.hit(f, t, 16, "shadow", { knock: 220, dir: Math.atan2(t.y - f.y, t.x - f.x) });
          },
        });
        break;
      }
    }
  }

  private hit(from: Fighter, to: Fighter, power: number, elem: Elem | null, o: { knock?: number; dir?: number; slow?: number } = {}): void {
    if (this.phase !== "fight") return;
    if (to.iframe > 0) {
      this.float(to, "회피!", "#c8d8ff");
      return;
    }
    const mult = typeMult(elem, to.elem);
    const dmg = Math.max(1, Math.round(power * (1 + from.lv * 0.15) * (from.atk / to.def) * mult * (0.9 + Math.random() * 0.2)));
    to.hp = Math.max(0, to.hp - dmg);
    to.flash = 0.2;
    if (o.knock && o.dir !== undefined) {
      to.kx += Math.cos(o.dir) * o.knock;
      to.ky += Math.sin(o.dir) * o.knock;
    }
    if (o.slow) to.slowUntil = this.t + o.slow;
    // 맞으면 모으던 기술이 가끔 끊긴다
    if (to.windup && (power >= 10 || Math.random() < 0.25)) {
      to.windup = null;
      this.float(to, "끊김!", "#ffd36a");
    }
    this.shake = Math.max(this.shake, dmg > 14 ? 0.25 : 0.12);
    this.burst(to.x, to.y - 6, elem ? ELEM[elem].color : "#e0e8ff", 6 + Math.min(14, dmg), 70);
    const tag = mult > 1 ? " 효과 굉장!" : mult < 1 ? " 별로…" : "";
    this.float(to, `-${dmg}${tag}`, to === this.p ? "#ff6a7a" : mult > 1 ? "#ffd36a" : "#ffffff");
    sfx.hit();
  }

  private updateShots(dt: number): void {
    this.shots = this.shots.filter((s) => {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
      if (Math.random() < 0.6) this.particles.push({ x: s.x, y: s.y, vx: 0, vy: 0, life: 0, max: 0.18, color: s.color, s: 1 });
      if (s.life <= 0 || s.x < AX0 || s.x > AX1 || s.y < AY0 || s.y > AY1) return false;
      const target = s.owner === "p" ? this.e : this.p;
      const from = s.owner === "p" ? this.p : this.e;
      if (Math.hypot(target.x - s.x, target.y - s.y) < BODY_R + s.r) {
        this.hit(from, target, s.power, s.elem, { knock: 60, dir: Math.atan2(s.vy, s.vx), slow: s.slow });
        return false;
      }
      return true;
    });
  }

  private updateZones(dt: number): void {
    for (const z of this.zones) {
      z.t += dt;
      if (z.follow) {
        z.x = z.follow.x;
        z.y = z.follow.y;
      }
      const target = z.owner === "p" ? this.e : this.p;
      const from = z.owner === "p" ? this.p : this.e;
      if (z.tick > 0) {
        z.acc += dt;
        if (z.acc >= z.tick) {
          z.acc = 0;
          if (Math.hypot(target.x - z.x, target.y - z.y) < z.r + BODY_R) this.hit(from, target, z.power, z.elem, { slow: 0.4 });
        }
      } else if (!z.done && z.t >= z.delay) {
        z.done = true;
        sfx.quake();
        this.shake = 0.3;
        this.burst(z.x, z.y, z.color, 24, 90);
        if (Math.hypot(target.x - z.x, target.y - z.y) < z.r + BODY_R) this.hit(from, target, z.power, z.elem, { knock: 120, dir: -Math.PI / 2 });
      }
    }
    this.zones = this.zones.filter((z) => z.t < z.dur);
  }

  private burst(x: number, y: number, color: string, n: number, speed: number): void {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.3 + Math.random());
      this.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0, max: 0.25 + Math.random() * 0.35, color, s: Math.random() < 0.3 ? 2 : 1 });
    }
  }

  private float(f: Fighter, text: string, color: string): void {
    this.floaters.push({ x: f.x, y: f.y - 38, text, color, t0: this.t });
  }

  // ── 그리기 ─────────────────────────────────────────────
  draw(g: CanvasRenderingContext2D, text: (s: string, x: number, y: number, c: string, align?: CanvasTextAlign) => void): void {
    const sx = this.shake > 0 ? Math.round((Math.random() - 0.5) * this.shake * 14) : 0;
    const sy = this.shake > 0 ? Math.round((Math.random() - 0.5) * this.shake * 14) : 0;
    const [c1, c2] = REGIONS[this.region].ground;
    g.fillStyle = "#14101e";
    g.fillRect(0, 0, W, H);
    g.save();
    g.translate(sx, sy);
    for (let y = AY0; y < AY1; y += 16) {
      for (let x = AX0; x < AX1; x += 16) {
        g.fillStyle = ((x + y) / 16) % 2 ? c1 : c2;
        g.fillRect(x, y, 16, 16);
      }
    }
    g.strokeStyle = "#000";
    g.lineWidth = 2;
    g.strokeRect(AX0 - 1, AY0 - 1, AX1 - AX0 + 2, AY1 - AY0 + 2);

    // 장판
    for (const z of this.zones) {
      if (z.tick > 0) {
        g.fillStyle = "rgba(90,208,106,0.22)";
        this.circle(g, z.x, z.y, z.r);
        g.fillStyle = z.color;
        for (let i = 0; i < 10; i++) {
          const a = i * 0.63 + this.t;
          g.fillRect(Math.round(z.x + Math.cos(a) * z.r * 0.7), Math.round(z.y + Math.sin(a) * z.r * 0.5), 2, 4);
        }
      } else if (!z.done) {
        const k = z.t / z.delay;
        g.fillStyle = `rgba(255,80,80,${(0.15 + k * 0.25).toFixed(2)})`;
        this.circle(g, z.x, z.y, z.r);
        g.fillStyle = "#6a5a4a";
        const fy = z.y - 120 * (1 - k);
        g.fillRect(Math.round(z.x - 9), Math.round(fy - 9), 18, 16);
        g.fillStyle = "#9a8a6a";
        g.fillRect(Math.round(z.x - 7), Math.round(fy - 8), 8, 5);
      }
    }

    // 캐릭터 (아래쪽이 앞)
    for (const f of [this.p, this.e].sort((a, b) => a.y - b.y)) this.drawFighter(g, f);

    for (const s of this.shots) {
      g.fillStyle = s.color;
      g.fillRect(Math.round(s.x - s.r), Math.round(s.y - s.r), s.r * 2, s.r * 2);
      g.fillStyle = "#fff";
      g.fillRect(Math.round(s.x - 1), Math.round(s.y - 1), 2, 2);
    }
    for (const r of this.rings) {
      const k = (this.t - r.t) / r.dur;
      g.strokeStyle = r.color;
      g.globalAlpha = 1 - k;
      g.lineWidth = 3;
      g.beginPath();
      g.arc(r.x, r.y, r.r0 + (r.r1 - r.r0) * k, 0, Math.PI * 2);
      g.stroke();
      g.globalAlpha = 1;
    }
    for (const pt of this.particles) {
      g.globalAlpha = 1 - pt.life / pt.max;
      g.fillStyle = pt.color;
      g.fillRect(Math.round(pt.x), Math.round(pt.y), pt.s, pt.s);
    }
    g.globalAlpha = 1;
    for (const f of this.floaters) text(f.text, f.x, f.y - (this.t - f.t0) * 22, f.color, "center");
    g.restore();

    this.drawHud(g, text);

    if (this.phase !== "fight") {
      g.fillStyle = "rgba(0,0,0,0.45)";
      g.fillRect(0, 118, W, 34);
      g.save();
      g.font = "bold 22px Galmuri11";
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillStyle = "#000";
      g.fillText(this.banner, W / 2 + 2, 137);
      g.fillStyle = this.bannerColor;
      g.fillText(this.banner, W / 2, 135);
      g.restore();
    }
  }

  private circle(g: CanvasRenderingContext2D, x: number, y: number, r: number): void {
    g.beginPath();
    g.ellipse(x, y, r, r * 0.7, 0, 0, Math.PI * 2);
    g.fill();
  }

  private drawFighter(g: CanvasRenderingContext2D, f: Fighter): void {
    const walk = f.walking && Math.floor(this.t * 8) % 2 === 1;
    const spr = wizardSprite(f.look, f.face, walk);
    const w = spr.width * SCALE;
    const h = spr.height * SCALE;
    const left = Math.round(f.x - w / 2);
    const top = Math.round(f.y + 14 - h);
    g.fillStyle = "rgba(0,0,0,0.3)";
    g.beginPath();
    g.ellipse(f.x, f.y + 14, 14, 5, 0, 0, Math.PI * 2);
    g.fill();
    if (f.iframe > 0) g.globalAlpha = 0.5;
    g.save();
    if (f.face === "side" && f.left) {
      g.translate(left + w, top);
      g.scale(-1, 1);
      g.drawImage(spr, 0, 0, w, h);
    } else {
      g.drawImage(spr, left, top, w, h);
    }
    g.restore();
    if (f.flash > 0) {
      g.globalCompositeOperation = "lighter";
      g.globalAlpha = 0.5;
      g.save();
      if (f.face === "side" && f.left) {
        g.translate(left + w, top);
        g.scale(-1, 1);
        g.drawImage(spr, 0, 0, w, h);
      } else g.drawImage(spr, left, top, w, h);
      g.restore();
      g.globalCompositeOperation = "source-over";
    }
    g.globalAlpha = 1;
    if (this.t < f.slowUntil) {
      g.fillStyle = "rgba(191,239,255,0.3)";
      g.fillRect(left, top, w, h);
    }
    if (f.windup) {
      const k = f.windup.t / f.windup.total;
      const color = f.windup.action === "basic" ? "#ffffff" : ELEM[SPELLS[f.windup.action].elem].color;
      g.strokeStyle = color;
      g.lineWidth = 2;
      g.globalAlpha = 0.4 + k * 0.6;
      g.beginPath();
      g.arc(f.x, f.y, 26 - k * 10, 0, Math.PI * 2);
      g.stroke();
      g.globalAlpha = 1;
    }
  }

  private drawHud(g: CanvasRenderingContext2D, text: (s: string, x: number, y: number, c: string, align?: CanvasTextAlign) => void): void {
    const bar = (x: number, y: number, w: number, h: number, k: number, c: string) => {
      g.fillStyle = "#000";
      g.fillRect(x - 1, y - 1, w + 2, h + 2);
      g.fillStyle = "#2a2238";
      g.fillRect(x, y, w, h);
      g.fillStyle = c;
      g.fillRect(x, y, Math.round(w * Math.max(0, Math.min(1, k))), h);
    };
    const hs = heroStats(this.hero.lv);
    text(`나 Lv${this.hero.lv}`, 12, 10, "#f4ecff");
    bar(12, 18, 150, 7, this.p.hp / this.p.maxHp, "#ff5a6a");
    bar(12, 29, 110, 4, this.hero.mana / hs.maxMana, "#5a8aff");
    text(`${Math.ceil(this.p.hp)}`, 168, 21, "#ffb0b8");
    const ec = ELEM[this.foe.elem];
    text(`${this.foe.name} Lv${this.foe.lv}`, W - 12, 10, "#f4ecff", "right");
    bar(W - 162, 18, 150, 7, this.e.hp / this.e.maxHp, ec.color);
    text(ec.name, W - 168, 21, ec.color, "right");

    // 아래 기술 칸
    const slots: Array<[string, string, number, string]> = [
      ["J", "마법 화살", this.p.cdBasic / ARROW_CD, "#e0e8ff"],
      ...[0, 1].map((i): [string, string, number, string] => {
        const id = this.hero.equip[i];
        if (!id) return [i ? "L" : "K", "비어 있음", 0, "#5a5470"];
        const d = SPELLS[id];
        const ok = this.hero.mana >= d.cost;
        return [i ? "L" : "K", d.name, (this.p.cds[id] ?? 0) / d.cd, ok ? ELEM[d.elem].color : "#5a5470"];
      }),
      ["␣", "회피", this.p.cdDash / DASH_CD, "#c8d8ff"],
      ["H", `물약 ×${this.hero.potions}`, this.potionCd, "#8aff9a"],
    ];
    if (this.canRun) slots.push(["X", "도망", 0, "#b4a8cc"]);
    const bw = Math.floor((W - 16 - (slots.length - 1) * 4) / slots.length);
    slots.forEach(([key, label, cd, color], i) => {
      const x = 8 + i * (bw + 4);
      const y = 240;
      g.fillStyle = "rgba(10,8,20,0.85)";
      g.fillRect(x, y, bw, 24);
      if (cd > 0) {
        g.fillStyle = "rgba(255,255,255,0.12)";
        g.fillRect(x, y, Math.round(bw * cd), 24);
      }
      g.strokeStyle = color;
      g.lineWidth = 1;
      g.strokeRect(x + 0.5, y + 0.5, bw - 1, 23);
      text(key, x + 7, y + 12, "#8a80a8");
      text(label, x + 16, y + 12, color);
    });
  }
}

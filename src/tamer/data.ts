// 마법 · 마법사 · 지역 데이터 (오리지널)

export type Elem = "fire" | "water" | "grass" | "electric" | "rock" | "wind" | "shadow" | "ice";

export const ELEM: Record<Elem, { name: string; color: string }> = {
  fire: { name: "불", color: "#ff7a3a" },
  water: { name: "물", color: "#4aa8ff" },
  grass: { name: "숲", color: "#5ad06a" },
  electric: { name: "번개", color: "#ffe04a" },
  rock: { name: "바위", color: "#c8a878" },
  wind: { name: "바람", color: "#9ae8d8" },
  shadow: { name: "그림자", color: "#b080f0" },
  ice: { name: "서리", color: "#bfefff" },
};

const STRONG: Record<Elem, Elem[]> = {
  fire: ["grass", "ice"],
  water: ["fire", "rock"],
  grass: ["water", "rock"],
  electric: ["water", "wind"],
  rock: ["fire", "electric", "ice"],
  wind: ["grass", "shadow"],
  shadow: ["electric", "ice"],
  ice: ["grass", "wind"],
};

export function typeMult(atk: Elem | null, def: Elem | null): number {
  if (!atk || !def) return 1;
  if (STRONG[atk].includes(def)) return 1.5;
  if (STRONG[def].includes(atk)) return 0.7;
  return 1;
}

// ── 주문 ────────────────────────────────────────────────
export type SpellId = "fan" | "wave" | "thorns" | "chain" | "quake" | "gust" | "blink" | "shards";

export interface SpellDef {
  id: SpellId;
  name: string;
  elem: Elem;
  cost: number;
  cd: number;
  desc: string;
}

export const SPELLS: Record<SpellId, SpellDef> = {
  fan: { id: "fan", name: "불씨 부채", elem: "fire", cost: 18, cd: 3.2, desc: "불덩이 세 개를 부채꼴로 날린다" },
  wave: { id: "wave", name: "물결 파동", elem: "water", cost: 20, cd: 4, desc: "주변의 적을 크게 밀쳐낸다" },
  thorns: { id: "thorns", name: "가시 덩굴", elem: "grass", cost: 22, cd: 6, desc: "발밑에 가시밭을 깔고 체력을 회복한다" },
  chain: { id: "chain", name: "연쇄 번개", elem: "electric", cost: 20, cd: 4, desc: "빠른 번개를 다섯 번 쏜다" },
  quake: { id: "quake", name: "바위 떨구기", elem: "rock", cost: 18, cd: 3.5, desc: "잠시 뒤 적의 머리 위로 바위가 떨어진다" },
  gust: { id: "gust", name: "돌풍", elem: "wind", cost: 16, cd: 3.5, desc: "앞쪽의 적을 멀리 날려버린다" },
  blink: { id: "blink", name: "그림자 습격", elem: "shadow", cost: 20, cd: 4.5, desc: "적 뒤로 순간이동해 일격을 날린다" },
  shards: { id: "shards", name: "얼음 조각", elem: "ice", cost: 18, cd: 4, desc: "맞은 적을 느리게 만드는 얼음 다섯 발" },
};

export const SPELL_IDS = Object.keys(SPELLS) as SpellId[];

// ── 마법사 유파 ──────────────────────────────────────────
export interface Look {
  hat: string;
  robe: string;
  trim: string;
  hair: string;
}

export interface School {
  elem: Elem;
  title: string;
  spell: SpellId;
  look: Look;
  hp: number;
  atk: number;
  def: number;
  spd: number;
  melee: boolean;
}

export const SCHOOLS: Record<Elem, School> = {
  fire: { elem: "fire", title: "불꽃술사", spell: "fan", hp: 55, atk: 1.15, def: 0.9, spd: 1.05, melee: false, look: { hat: "#8a2222", robe: "#c83a2a", trim: "#ffb03a", hair: "#2a1a1a" } },
  water: { elem: "water", title: "물결술사", spell: "wave", hp: 62, atk: 1.0, def: 1.0, spd: 1.0, melee: false, look: { hat: "#1a4a8a", robe: "#2a7ad0", trim: "#c8ecff", hair: "#3a2a1a" } },
  grass: { elem: "grass", title: "드루이드", spell: "thorns", hp: 70, atk: 1.0, def: 1.1, spd: 0.9, melee: true, look: { hat: "#2a5a2a", robe: "#3a8a3a", trim: "#d8c070", hair: "#6a4a2a" } },
  electric: { elem: "electric", title: "번개술사", spell: "chain", hp: 52, atk: 1.1, def: 0.85, spd: 1.15, melee: false, look: { hat: "#5a4a10", robe: "#d8b020", trim: "#fff8b0", hair: "#f0e0a0" } },
  rock: { elem: "rock", title: "바위술사", spell: "quake", hp: 75, atk: 1.05, def: 1.3, spd: 0.8, melee: true, look: { hat: "#4a3a2a", robe: "#8a6a4a", trim: "#c8c8d0", hair: "#2a2a2a" } },
  wind: { elem: "wind", title: "바람술사", spell: "gust", hp: 50, atk: 1.0, def: 0.85, spd: 1.3, melee: false, look: { hat: "#2a6a6a", robe: "#5ac0b0", trim: "#f0fffa", hair: "#8a6a3a" } },
  shadow: { elem: "shadow", title: "그림자술사", spell: "blink", hp: 55, atk: 1.2, def: 0.85, spd: 1.2, melee: true, look: { hat: "#1a1024", robe: "#3a2a5a", trim: "#b080f0", hair: "#d0d0e0" } },
  ice: { elem: "ice", title: "서리술사", spell: "shards", hp: 60, atk: 1.0, def: 1.0, spd: 0.95, melee: false, look: { hat: "#4a7aa0", robe: "#a8d8f0", trim: "#ffffff", hair: "#e8f0ff" } },
};

export const HERO_LOOK: Look = { hat: "#2b3a8c", robe: "#33408f", trim: "#e8c35a", hair: "#6b3e1f" };
export const PROF_LOOK: Look = { hat: "#4a5a4a", robe: "#5a6b5a", trim: "#c9b26a", hair: "#e0e0e0" };
export const ARCH_LOOK: Look = { hat: "#0e0a18", robe: "#1e1430", trim: "#ffd36a", hair: "#e0e0f0" };

// ── 주인공 ──────────────────────────────────────────────
export interface Hero {
  lv: number;
  xp: number;
  hp: number;
  mana: number;
  known: SpellId[];
  equip: [SpellId | null, SpellId | null];
  potions: number;
  seals: string[];
  x: number;
  y: number;
  started: boolean;
  champion: boolean;
}

export function heroStats(lv: number): { maxHp: number; maxMana: number; atk: number; def: number } {
  return { maxHp: 80 + lv * 12, maxMana: 60 + lv * 4, atk: 10 + lv * 2, def: 10 + lv * 2 };
}

export function enemyStats(s: School, lv: number, boss: number): { maxHp: number; atk: number; def: number } {
  return {
    maxHp: Math.round(s.hp * (1 + lv * 0.15) * boss),
    atk: s.atk * (10 + lv * 2),
    def: s.def * (10 + lv * 2),
  };
}

export const xpNeed = (lv: number) => lv * 20;

/** 경험치를 주고 오른 레벨 수를 돌려준다 */
export function gainXp(h: Hero, amount: number): number {
  let ups = 0;
  h.xp += amount;
  while (h.xp >= xpNeed(h.lv) && h.lv < 50) {
    h.xp -= xpNeed(h.lv);
    h.lv++;
    ups++;
    const s = heroStats(h.lv);
    h.hp = s.maxHp;
    h.mana = s.maxMana;
  }
  return ups;
}

// ── 지역 ────────────────────────────────────────────────
export type RegionId = "town" | "meadow" | "forest" | "lake" | "rocky" | "plains" | "arena";

export interface Region {
  name: string;
  spawns: Array<[Elem, number]>;
  lv: [number, number];
  ground: [string, string];
}

export const REGIONS: Record<RegionId, Region> = {
  town: { name: "별빛 마을", spawns: [], lv: [1, 1], ground: ["#7ac06a", "#6ab05a"] },
  meadow: { name: "산들 들판", spawns: [["wind", 3], ["grass", 2], ["fire", 1], ["water", 1]], lv: [1, 3], ground: ["#7ac06a", "#6ab05a"] },
  forest: { name: "속삭이는 숲", spawns: [["grass", 3], ["shadow", 2], ["wind", 1]], lv: [3, 6], ground: ["#3a7a3a", "#336e33"] },
  lake: { name: "안개 호수", spawns: [["water", 3], ["ice", 2]], lv: [3, 6], ground: ["#d8c890", "#cbbb82"] },
  rocky: { name: "붉은 바위 언덕", spawns: [["rock", 3], ["fire", 2]], lv: [4, 7], ground: ["#b89870", "#ab8b64"] },
  plains: { name: "번개 평원", spawns: [["electric", 3], ["wind", 2], ["ice", 1]], lv: [5, 8], ground: ["#a8c860", "#9aba52"] },
  arena: { name: "대마법사의 탑", spawns: [], lv: [1, 1], ground: ["#a8a8b8", "#9a9aaa"] },
};

// ── 마스터 (지역 보스) ───────────────────────────────────
export interface Master {
  id: string;
  name: string;
  school: Elem;
  lv: number;
  pos: { x: number; y: number };
  spells: SpellId[];
  look?: Look;
  intro: string[];
  outro: string[];
}

export const MASTERS: Master[] = [
  {
    id: "forest", name: "숲의 마스터 리아나", school: "grass", lv: 7, pos: { x: 8, y: 8 }, spells: ["thorns", "gust"],
    intro: ["숲이 네 발소리를 들려주더구나.", "이 숲의 인장을 원한다면, 뿌리보다 단단함을 증명해 보렴!"],
    outro: ["후후, 새싹이 이렇게 빨리 자랄 줄이야.", "'숲의 인장'을 가져가렴."],
  },
  {
    id: "lake", name: "호수의 마스터 시엘", school: "ice", lv: 8, pos: { x: 72, y: 44 }, spells: ["shards", "wave"],
    intro: ["안개 너머에서 누가 오나 했더니.", "얼어붙지 않고 버틸 수 있을까?"],
    outro: ["녹아버렸네… 내가.", "'호수의 인장'이야. 소중히 해."],
  },
  {
    id: "rocky", name: "바위의 마스터 고른", school: "rock", lv: 9, pos: { x: 8, y: 52 }, spells: ["quake", "fan"],
    intro: ["흠. 바위는 서두르지 않는다.", "하지만 한번 구르기 시작하면 멈추지 않지!"],
    outro: ["…좋은 마법이다. 단단했어.", "'바위의 인장'을 받아라."],
  },
  {
    id: "plains", name: "번개의 마스터 볼트라", school: "electric", lv: 10, pos: { x: 72, y: 7 }, spells: ["chain", "gust"],
    intro: ["빠르다고? 내 번개보다?", "눈 깜빡이면 끝이야!"],
    outro: ["와, 진짜 빨랐어!", "'번개의 인장'! 이제 탑에 갈 자격이 있어."],
  },
];

export const ARCHMAGE: Master = {
  id: "arch", name: "대마법사 엘드린", school: "shadow", lv: 13, pos: { x: 40, y: 5 }, spells: ["blink", "fan", "chain", "quake"],
  look: ARCH_LOOK,
  intro: ["인장 네 개를 모아 여기까지 왔구나.", "이 탑은 가장 강한 마법사만이 지킬 수 있다.", "네 모든 주문을 보여다오!"],
  outro: ["…훌륭하다. 이 탑은 이제 너의 것이다.", "하지만 기억해라. 마법사의 길에 끝은 없단다."],
};

export const STARTER_SPELLS: SpellId[] = ["fan", "wave", "thorns"];

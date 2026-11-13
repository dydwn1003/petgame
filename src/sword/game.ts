// 검 강화 게임 — 순수 게임 로직 (UI와 분리)

export const MAX_LEVEL = 20;

export type FailRule = "stay" | "down" | "risk";

export interface LevelInfo {
  /** 이 단계에서 다음 단계로 갈 확률 (0~1) */
  rate: number;
  /** 강화 1회 비용 */
  cost: number;
  /** 이 단계 검을 팔 때 받는 골드 */
  sell: number;
  /** 실패 시 규칙: 유지 / 1단계 하락 / 파괴 위험 */
  fail: FailRule;
  /** fail === "risk" 일 때 실패 중 파괴될 확률 */
  destroyChance: number;
}

const RATES = [
  0.95, 0.9, 0.85, 0.8, 0.75, // +0 ~ +4  실패해도 유지
  0.7, 0.65, 0.6, 0.55, 0.5, // +5 ~ +9  실패 시 하락
  0.45, 0.4, 0.35, 0.3, 0.25, // +10~+14 실패 시 파괴 위험
  0.2, 0.15, 0.1, 0.07, 0.05, // +15~+19 파괴 위험 큼
];

export function levelInfo(lv: number): LevelInfo {
  const fail: FailRule = lv < 5 ? "stay" : lv < 10 ? "down" : "risk";
  return {
    rate: RATES[lv] ?? 0,
    cost: Math.round(10 * Math.pow(1.42, lv) / 5) * 5 || 10,
    sell: lv === 0 ? 0 : Math.round(12 * Math.pow(1.62, lv)),
    fail,
    destroyChance: lv < 10 ? 0 : lv < 15 ? 0.35 : 0.6,
  };
}

/** 방지권 가격: 파괴 위험 구간에서만 사용 가능 */
export function protectCost(lv: number): number {
  return levelInfo(lv).cost * 3;
}

export const SWORD_NAMES = [
  "나뭇가지", "녹슨 단검", "낡은 검", "견습생의 검", "강철 검",
  "기사의 검", "푸른 강철검", "달빛 검", "서리 검", "화염 검",
  "폭풍의 검", "용비늘 검", "심연의 검", "별조각 검", "천공의 검",
  "태양의 검", "혼돈의 검", "용왕의 검", "신화의 검", "창세의 검",
  "전설의 검 ★",
];

export interface SaveData {
  gold: number;
  level: number;
  best: number;
  tries: number;
  destroyed: number;
  sold: number;
  protect: boolean;
}

export function freshSave(): SaveData {
  return { gold: 500, level: 0, best: 0, tries: 0, destroyed: 0, sold: 0, protect: false };
}

export type Outcome = "success" | "stay" | "down" | "destroy" | "protected";

export interface EnhanceResult {
  outcome: Outcome;
  from: number;
  to: number;
  paid: number;
}

export function canEnhance(s: SaveData): boolean {
  if (s.level >= MAX_LEVEL) return false;
  return s.gold >= totalCost(s);
}

export function usingProtect(s: SaveData): boolean {
  return s.protect && levelInfo(s.level).fail === "risk";
}

export function totalCost(s: SaveData): number {
  const info = levelInfo(s.level);
  return info.cost + (usingProtect(s) ? protectCost(s.level) : 0);
}

export function enhance(s: SaveData, rng: () => number = Math.random): EnhanceResult {
  const from = s.level;
  const info = levelInfo(from);
  const paid = totalCost(s);
  const protectedTry = usingProtect(s);
  s.gold -= paid;
  s.tries += 1;

  let outcome: Outcome;
  if (rng() < info.rate) {
    s.level += 1;
    outcome = "success";
  } else if (info.fail === "stay") {
    outcome = "stay";
  } else if (info.fail === "down") {
    s.level -= 1;
    outcome = "down";
  } else if (rng() < info.destroyChance) {
    if (protectedTry) {
      s.level -= 1;
      outcome = "protected";
    } else {
      s.level = 0;
      s.destroyed += 1;
      outcome = "destroy";
    }
  } else {
    s.level -= 1;
    outcome = "down";
  }
  s.best = Math.max(s.best, s.level);
  return { outcome, from, to: s.level, paid };
}

export function sell(s: SaveData): number {
  const price = levelInfo(s.level).sell;
  s.gold += price;
  s.level = 0;
  s.sold += 1;
  return price;
}

/** 돈이 다 떨어졌을 때 손으로 버는 골드 */
export const WORK_GOLD = 5;

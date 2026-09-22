import type { Species } from "../gfx/characters";
import { ITEMS, getItem } from "../data/items";
import { QUESTS, questsForStage } from "../data/quests";
import type { NpcId } from "../data/npcs";

export const DAY_START_MIN = 6 * 60; // 06:00
export const DAY_END_MIN = 24 * 60; // 24:00
export const MAX_STAGE = 4;

export interface FarmPlotState {
  tilled: boolean;
  watered: boolean;
  cropId?: string;
  plantedDay?: number;
}

export type ToolId = "hoe" | "water" | "seed_carrot" | "seed_straw";

export interface SaveData {
  species: Species;
  x: number;
  y: number;
  gold: number;
  stamina: number;
  maxStamina: number;
  day: number;
  timeMinutes: number;
  stage: number;
  completedQuests: string[];
  inventory: Record<string, number>;
  npcAffinity: Record<string, number>;
  farmPlots: Record<string, FarmPlotState>;
  shippingBin: Record<string, number>;
  giftedToday: string[];
  selectedTool: ToolId;
}

const SAVE_KEY = "petvillage_save_v1";

function freshSave(species: Species): SaveData {
  return {
    species,
    x: 400,
    y: 420,
    gold: 300,
    stamina: 100,
    maxStamina: 100,
    day: 1,
    timeMinutes: DAY_START_MIN,
    stage: 1,
    completedQuests: [],
    inventory: { SEED_BONE_CARROT: 5, SEED_STRAWBERRY: 3 },
    npcAffinity: { NPC_DOG_MARO: 0, NPC_CAT_SASHA: 0, NPC_HAM_BOLBOL: 0 },
    farmPlots: {},
    shippingBin: {},
    giftedToday: [],
    selectedTool: "hoe",
  };
}

class GameStateStore {
  data: SaveData = freshSave("dog");
  listeners: Array<() => void> = [];
  started = false;
  private autosaveTimer: ReturnType<typeof setTimeout> | null = null;

  onChange(fn: () => void): void {
    this.listeners.push(fn);
  }

  private notify(): void {
    for (const l of this.listeners) l();
    this.scheduleAutosave();
  }

  /** Debounces writes so a burst of mutations (e.g. sleep) only saves once. */
  private scheduleAutosave(): void {
    if (this.autosaveTimer !== null) return;
    this.autosaveTimer = setTimeout(() => {
      this.autosaveTimer = null;
      this.save();
    }, 400);
  }

  newGame(species: Species): void {
    this.data = freshSave(species);
    this.started = true;
    this.save();
    this.notify();
  }

  hasSave(): boolean {
    return localStorage.getItem(SAVE_KEY) !== null;
  }

  load(): boolean {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    try {
      this.data = { ...freshSave("dog"), ...JSON.parse(raw) };
      this.started = true;
      this.notify();
      return true;
    } catch {
      return false;
    }
  }

  save(): void {
    localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
  }

  resetSave(): void {
    localStorage.removeItem(SAVE_KEY);
  }

  // --- inventory ---
  addItem(itemId: string, qty = 1): void {
    this.data.inventory[itemId] = (this.data.inventory[itemId] ?? 0) + qty;
    this.notify();
  }

  removeItem(itemId: string, qty = 1): boolean {
    const have = this.data.inventory[itemId] ?? 0;
    if (have < qty) return false;
    this.data.inventory[itemId] = have - qty;
    if (this.data.inventory[itemId] <= 0) delete this.data.inventory[itemId];
    this.notify();
    return true;
  }

  itemCount(itemId: string): number {
    return this.data.inventory[itemId] ?? 0;
  }

  // --- gold ---
  addGold(amount: number): void {
    this.data.gold += amount;
    this.notify();
  }

  spendGold(amount: number): boolean {
    if (this.data.gold < amount) return false;
    this.data.gold -= amount;
    this.notify();
    return true;
  }

  // --- stamina / time ---
  spendStamina(amount: number): boolean {
    if (this.data.stamina < amount) return false;
    this.data.stamina = Math.max(0, this.data.stamina - amount);
    this.notify();
    return true;
  }

  advanceMinutes(min: number): void {
    // Ticks every frame; intentionally skips notify()/autosave to avoid
    // hammering localStorage on this hot path.
    this.data.timeMinutes += min;
  }

  isDayOver(): boolean {
    return this.data.timeMinutes >= DAY_END_MIN || this.data.stamina <= 0;
  }

  timeString(): string {
    const total = Math.floor(this.data.timeMinutes);
    const h = Math.floor(total / 60) % 24;
    const m = total % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
  }

  // --- shipping bin ---
  shipItem(itemId: string, qty: number): boolean {
    if (!this.removeItem(itemId, qty)) return false;
    this.data.shippingBin[itemId] = (this.data.shippingBin[itemId] ?? 0) + qty;
    this.notify();
    return true;
  }

  // --- sleep / new day ---
  sleepAndAdvance(): number {
    let earned = 0;
    for (const [id, qty] of Object.entries(this.data.shippingBin)) {
      earned += getItem(id).sell_price * qty;
    }
    this.data.shippingBin = {};
    this.data.gold += earned;

    // grow crops
    for (const plot of Object.values(this.data.farmPlots)) {
      if (plot.cropId && plot.watered) {
        // growth tracked via plantedDay vs current day already; just reset watered flag
      }
      plot.watered = false;
    }

    this.data.day += 1;
    this.data.timeMinutes = DAY_START_MIN;
    this.data.stamina = this.data.maxStamina;
    this.data.giftedToday = [];
    this.checkStageUp();
    this.save();
    this.notify();
    return earned;
  }

  // --- farming ---
  plotKey(tx: number, ty: number): string {
    return `${tx},${ty}`;
  }

  getPlot(tx: number, ty: number): FarmPlotState | undefined {
    return this.data.farmPlots[this.plotKey(tx, ty)];
  }

  tillPlot(tx: number, ty: number): void {
    const k = this.plotKey(tx, ty);
    this.data.farmPlots[k] = this.data.farmPlots[k] ?? { tilled: true, watered: false };
    this.data.farmPlots[k].tilled = true;
    this.notify();
  }

  waterPlot(tx: number, ty: number): void {
    const k = this.plotKey(tx, ty);
    const p = this.data.farmPlots[k];
    if (p) {
      p.watered = true;
      this.notify();
    }
  }

  plantSeed(tx: number, ty: number, cropId: string): boolean {
    const k = this.plotKey(tx, ty);
    const p = this.data.farmPlots[k];
    if (!p || !p.tilled || p.cropId) return false;
    p.cropId = cropId;
    p.plantedDay = this.data.day;
    this.notify();
    return true;
  }

  cropGrowthStage(plot: FarmPlotState): number {
    if (!plot.cropId || plot.plantedDay === undefined) return -1;
    const def = getItem(plot.cropId);
    const growthDays = def.growth_days ?? 4;
    const age = this.data.day - plot.plantedDay;
    const pct = Math.max(0, Math.min(1, age / growthDays));
    if (pct >= 1) return 3; // ready
    if (pct > 0.66) return 2;
    if (pct > 0.33) return 1;
    return 0;
  }

  harvestPlot(tx: number, ty: number): string | null {
    const k = this.plotKey(tx, ty);
    const p = this.data.farmPlots[k];
    if (!p || !p.cropId) return null;
    if (this.cropGrowthStage(p) < 3) return null;
    const cropId = p.cropId;
    p.cropId = undefined;
    p.plantedDay = undefined;
    this.addItem(cropId, 1);
    this.notify();
    return cropId;
  }

  // --- NPCs ---
  giveGift(npcId: NpcId, _itemId: string, loved: boolean, liked: boolean): number {
    if (this.data.giftedToday.includes(npcId)) return -1; // already gifted today
    this.data.giftedToday.push(npcId);
    const gain = loved ? 80 : liked ? 40 : 10;
    this.data.npcAffinity[npcId] = (this.data.npcAffinity[npcId] ?? 0) + gain;
    this.notify();
    return gain;
  }

  affinity(npcId: NpcId): number {
    return this.data.npcAffinity[npcId] ?? 0;
  }

  // --- quests ---
  availableQuests() {
    return questsForStage(this.data.stage).filter((q) => !this.data.completedQuests.includes(q.quest_id));
  }

  canTurnIn(questId: string): boolean {
    const q = QUESTS.find((qq) => qq.quest_id === questId);
    if (!q) return false;
    return this.itemCount(q.required_item) >= q.required_amount;
  }

  turnInQuest(questId: string): boolean {
    const q = QUESTS.find((qq) => qq.quest_id === questId);
    if (!q) return false;
    if (!this.canTurnIn(questId)) return false;
    this.removeItem(q.required_item, q.required_amount);
    this.addGold(q.reward_gold);
    this.data.completedQuests.push(questId);
    this.notify();
    return true;
  }

  // --- progression ---
  stageGoldThresholds: Record<number, number> = { 2: 800, 3: 2200, 4: 4500 };

  checkStageUp(): void {
    while (this.data.stage < MAX_STAGE) {
      const need = this.stageGoldThresholds[this.data.stage + 1];
      if (need !== undefined && this.data.gold >= need) {
        this.data.stage += 1;
      } else {
        break;
      }
    }
  }

  allItems = ITEMS;
}

export const GameState = new GameStateStore();

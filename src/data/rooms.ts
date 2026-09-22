import type { NpcId } from "./npcs";

export type ZoneId = "plaza" | "farm" | "harbor" | "mine";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PortalDef {
  rect: Rect;
  to: ZoneId;
  spawn: { x: number; y: number };
  hint: string;
}

export interface FarmGridDef {
  x0: number;
  y0: number;
  cols: number;
  rows: number;
  cell: number;
}

export interface RoomDef {
  id: ZoneId;
  bg: string;
  w: number;
  h: number;
  solids: Rect[];
  portals: PortalDef[];
  npcIds: NpcId[];
  defaultSpawn: { x: number; y: number };
  questBoard?: { x: number; y: number };
  shippingBin?: { x: number; y: number };
  bed?: { x: number; y: number };
  fishingSpots?: { x: number; y: number }[];
  mineEntrance?: { x: number; y: number };
  farmGrid?: FarmGridDef;
}

const PLAZA_SPAWN = { x: 1140, y: 900 };
const FARM_SPAWN = { x: 160, y: 190 };
const HARBOR_SPAWN = { x: 650, y: 460 };
const MINE_SPAWN = { x: 600, y: 300 };

export const ROOMS: Record<ZoneId, RoomDef> = {
  plaza: {
    id: "plaza",
    bg: "bg_plaza",
    w: 2000,
    h: 1091,
    defaultSpawn: PLAZA_SPAWN,
    npcIds: [],
    solids: [
      { x: 90, y: 0, w: 310, h: 235 }, // top-left cottage
      { x: 1610, y: 0, w: 390, h: 340 }, // village cafe building
      { x: 0, y: 680, w: 270, h: 320 }, // bottom-left cottage
      { x: 1730, y: 860, w: 270, h: 231 }, // bottom-right cottage
      { x: 990, y: 470, w: 280, h: 230 }, // fountain + inner sunflower ring
      { x: 690, y: 175, w: 150, h: 100 }, // quest board post
    ],
    questBoard: { x: 735, y: 225 },
    bed: { x: 140, y: 1015 },
    portals: [
      { rect: { x: 0, y: 420, w: 30, h: 260 }, to: "farm", spawn: FARM_SPAWN, hint: "농장으로 이동" },
      { rect: { x: 1970, y: 650, w: 30, h: 260 }, to: "harbor", spawn: HARBOR_SPAWN, hint: "항구로 이동" },
      { rect: { x: 900, y: 1061, w: 220, h: 30 }, to: "mine", spawn: MINE_SPAWN, hint: "광산으로 이동" },
    ],
  },

  farm: {
    id: "farm",
    bg: "bg_farm",
    w: 1408,
    h: 768,
    defaultSpawn: FARM_SPAWN,
    npcIds: ["NPC_DOG_MARO"],
    solids: [
      { x: 205, y: 60, w: 250, h: 190 }, // farmhouse
      { x: 630, y: 70, w: 170, h: 165 }, // barn
      { x: 795, y: 15, w: 95, h: 220 }, // silo
      { x: 915, y: 95, w: 125, h: 155 }, // greenhouse
      { x: 1035, y: 140, w: 100, h: 95 }, // coop
      { x: 75, y: 285, w: 245, h: 150 }, // second cottage / well
      { x: 0, y: 590, w: 270, h: 178 }, // round pond
      { x: 0, y: 575, w: 440, h: 40 }, // river (west of first bridge)
      { x: 500, y: 575, w: 480, h: 40 }, // river (between bridges)
      { x: 1050, y: 575, w: 358, h: 40 }, // river (east of second bridge)
    ],
    farmGrid: { x0: 520, y0: 260, cols: 5, rows: 4, cell: 42 },
    shippingBin: { x: 490, y: 195 },
    portals: [{ rect: { x: 20, y: 40, w: 70, h: 70 }, to: "plaza", spawn: { x: 100, y: 750 }, hint: "광장으로 이동" }],
  },

  harbor: {
    id: "harbor",
    bg: "bg_harbor",
    w: 1408,
    h: 768,
    defaultSpawn: HARBOR_SPAWN,
    npcIds: ["NPC_CAT_SASHA"],
    solids: [
      { x: 0, y: 0, w: 190, h: 230 }, // left cottage
      { x: 155, y: 0, w: 230, h: 120 }, // pink-roof cottage
      { x: 590, y: 0, w: 230, h: 100 }, // yellow cottage
      { x: 820, y: 0, w: 230, h: 100 }, // yellow cottage 2
      { x: 520, y: 170, w: 260, h: 260 }, // teahouse building
      { x: 930, y: 0, w: 478, h: 768 }, // open water, east
      { x: 230, y: 0, w: 700, h: 255 }, // open water, north strip
    ],
    fishingSpots: [{ x: 905, y: 430 }, { x: 905, y: 600 }],
    portals: [
      { rect: { x: 380, y: 0, w: 140, h: 35 }, to: "plaza", spawn: { x: 1880, y: 600 }, hint: "광장으로 이동" },
    ],
  },

  mine: {
    id: "mine",
    bg: "bg_mine",
    w: 1408,
    h: 768,
    defaultSpawn: MINE_SPAWN,
    npcIds: ["NPC_HAM_BOLBOL"],
    solids: [],
    mineEntrance: { x: 570, y: 100 },
    portals: [{ rect: { x: 95, y: 40, w: 110, h: 100 }, to: "plaza", spawn: { x: 1010, y: 980 }, hint: "광장으로 이동" }],
  },
};

export function getRoom(id: ZoneId): RoomDef {
  return ROOMS[id];
}

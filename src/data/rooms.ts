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
  /** How much bigger this room's background was resized to bring it onto
   * the same implied real-world scale as the others (measured off each
   * scene's door/tunnel height; farm and harbor were originally drawn at a
   * noticeably smaller scale than plaza/mine, so their images and every
   * pixel coordinate below were scaled up by this factor). Movement speed
   * and interaction radius are scaled by it too, so traversal and reach
   * feel the same in every room despite the different pixel grids. */
  worldScale: number;
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
const FARM_SPAWN = { x: 256, y: 304 };
const HARBOR_SPAWN = { x: 945, y: 669 };
const MINE_SPAWN = { x: 600, y: 300 };

export const ROOMS: Record<ZoneId, RoomDef> = {
  plaza: {
    id: "plaza",
    bg: "bg_plaza",
    w: 2000,
    h: 1091,
    worldScale: 1,
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

  // Background was resized 1.6x (1408x768 -> 2253x1229) to match plaza's
  // implied real-world scale, so every coordinate below is the original
  // layout scaled by the same 1.6x.
  farm: {
    id: "farm",
    bg: "bg_farm",
    w: 2253,
    h: 1229,
    worldScale: 1.6,
    defaultSpawn: FARM_SPAWN,
    npcIds: ["NPC_DOG_MARO"],
    solids: [
      { x: 328, y: 96, w: 400, h: 304 }, // farmhouse
      { x: 1008, y: 112, w: 272, h: 264 }, // barn
      { x: 1272, y: 24, w: 152, h: 352 }, // silo
      { x: 1464, y: 152, w: 200, h: 248 }, // greenhouse
      { x: 1656, y: 224, w: 160, h: 152 }, // coop
      { x: 120, y: 456, w: 392, h: 240 }, // second cottage / well
      { x: 0, y: 944, w: 432, h: 285 }, // round pond
      { x: 0, y: 920, w: 704, h: 64 }, // river (west of first bridge)
      { x: 800, y: 920, w: 768, h: 64 }, // river (between bridges)
      { x: 1680, y: 920, w: 573, h: 64 }, // river (east of second bridge)
    ],
    farmGrid: { x0: 832, y0: 416, cols: 5, rows: 4, cell: 67 },
    shippingBin: { x: 784, y: 312 },
    portals: [{ rect: { x: 32, y: 64, w: 112, h: 112 }, to: "plaza", spawn: { x: 100, y: 750 }, hint: "광장으로 이동" }],
  },

  // Background was resized 1.4545x (1408x768 -> 2048x1117) to match
  // plaza's implied real-world scale.
  harbor: {
    id: "harbor",
    bg: "bg_harbor",
    w: 2048,
    h: 1117,
    worldScale: 2048 / 1408,
    defaultSpawn: HARBOR_SPAWN,
    npcIds: ["NPC_CAT_SASHA"],
    solids: [
      { x: 0, y: 0, w: 276, h: 335 }, // left cottage
      { x: 225, y: 0, w: 335, h: 175 }, // pink-roof cottage
      { x: 858, y: 0, w: 335, h: 145 }, // yellow cottage
      { x: 1193, y: 0, w: 335, h: 145 }, // yellow cottage 2
      { x: 756, y: 247, w: 378, h: 378 }, // teahouse building
      { x: 1353, y: 0, w: 695, h: 1117 }, // open water, east
      { x: 335, y: 0, w: 1018, h: 371 }, // open water, north strip
    ],
    fishingSpots: [{ x: 1316, y: 625 }, { x: 1316, y: 873 }],
    portals: [
      { rect: { x: 553, y: 0, w: 204, h: 51 }, to: "plaza", spawn: { x: 1880, y: 600 }, hint: "광장으로 이동" },
    ],
  },

  mine: {
    id: "mine",
    bg: "bg_mine",
    w: 1408,
    h: 768,
    worldScale: 1,
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

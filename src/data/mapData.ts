import { TILE_KEYS, type TileKey } from "../gfx/tiles";

export const TILE_SIZE = 16;
export const MAP_W = 60;
export const MAP_H = 40;

export interface MapInfo {
  tiles: TileKey[][]; // [y][x]
  farmArea: { x0: number; y0: number; x1: number; y1: number };
  fishingSpots: { x: number; y: number }[];
  mineEntrance: { x: number; y: number };
  questBoard: { x: number; y: number };
  shippingBin: { x: number; y: number };
  bed: { x: number; y: number };
  spawn: { x: number; y: number };
}

function rand(seed: { v: number }): number {
  seed.v = (seed.v * 1103515245 + 12345) & 0x7fffffff;
  return (seed.v % 1000) / 1000;
}

export function buildMap(): MapInfo {
  const tiles: TileKey[][] = Array.from({ length: MAP_H }, () => Array<TileKey>(MAP_W).fill("grass"));
  const seed = { v: 12345 };

  const set = (x: number, y: number, t: TileKey) => {
    if (x < 0 || x >= MAP_W || y < 0 || y >= MAP_H) return;
    tiles[y][x] = t;
  };
  const rect = (x0: number, y0: number, x1: number, y1: number, t: TileKey) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, t);
  };

  // scattered grass variety
  for (let y = 1; y < MAP_H - 1; y++) {
    for (let x = 1; x < MAP_W - 1; x++) {
      if (rand(seed) < 0.04) set(x, y, "grass_speck");
      else if (rand(seed) < 0.01) set(x, y, "flower_patch");
    }
  }

  // border walls
  for (let x = 0; x < MAP_W; x++) {
    set(x, 0, "wall");
    set(x, MAP_H - 1, "wall");
  }
  for (let y = 0; y < MAP_H; y++) {
    set(0, y, "wall");
    set(MAP_W - 1, y, "wall");
  }

  // --- Plaza (center hub): 중앙 해바라기 광장 ---
  const plaza = { x0: 24, y0: 12, x1: 38, y1: 27 };
  rect(plaza.x0, plaza.y0, plaza.x1, plaza.y1, "path");
  rect(plaza.x0 + 3, plaza.y0 + 2, plaza.x0 + 4, plaza.y0 + 3, "flower_patch");
  rect(plaza.x1 - 4, plaza.y0 + 2, plaza.x1 - 3, plaza.y0 + 3, "flower_patch");
  rect(plaza.x0 + 3, plaza.y1 - 3, plaza.x0 + 4, plaza.y1 - 2, "flower_patch");
  rect(plaza.x1 - 4, plaza.y1 - 3, plaza.x1 - 3, plaza.y1 - 2, "flower_patch");

  // --- Farm zone: 멍멍 흙빛 농장 ---
  const farm = { x0: 4, y0: 5, x1: 20, y1: 33 };
  rect(farm.x0, farm.y0, farm.x1, farm.y1, "dirt");
  // fence border
  for (let x = farm.x0 - 1; x <= farm.x1 + 1; x++) {
    set(x, farm.y0 - 1, "fence");
    set(x, farm.y1 + 1, "fence");
  }
  for (let y = farm.y0 - 1; y <= farm.y1 + 1; y++) {
    set(farm.x0 - 1, y, "fence");
    set(farm.x1 + 1, y, "fence");
  }
  // gate opening toward plaza (east side, mid-height)
  const farmGateY0 = Math.floor((farm.y0 + farm.y1) / 2) - 1;
  for (let y = farmGateY0; y <= farmGateY0 + 2; y++) {
    set(farm.x1 + 1, y, "path");
  }

  // --- Harbor zone: 냥냥 에메랄드 항구 ---
  const harbor = { x0: 41, y0: 2, x1: 58, y1: 19 };
  rect(harbor.x0, harbor.y0, harbor.x1, harbor.y0 + 6, "water");
  rect(harbor.x0, harbor.y0 + 7, harbor.x1, harbor.y1, "sand");
  // short wooden pier jutting from the sand up to the water's edge, so
  // standing at its tip and facing "up" faces open water.
  const pierTipY = harbor.y0 + 4;
  rect(48, pierTipY, 51, harbor.y0 + 7, "wood_floor");
  const fishingSpots = [
    { x: 49, y: pierTipY - 1 },
    { x: 50, y: pierTipY - 1 },
  ];

  // --- Mine zone: 햄햄 지하 굴 & 협곡 ---
  const mine = { x0: 41, y0: 21, x1: 58, y1: 37 };
  rect(mine.x0, mine.y0, mine.x1, mine.y1, "stone_floor");
  for (let x = mine.x0 - 1; x <= mine.x1 + 1; x++) {
    set(x, mine.y0 - 1, "wall");
    set(x, mine.y1 + 1, "wall");
  }
  for (let y = mine.y0 - 1; y <= mine.y1 + 1; y++) {
    set(mine.x0 - 1, y, "wall");
    set(mine.x1 + 1, y, "wall");
  }
  const mineGateY0 = mine.y0 - 1;
  set(mine.x0 - 1, mineGateY0, "path");
  const mineEntrance = { x: 47, y: mine.y0 + 3 };
  set(mineEntrance.x, mineEntrance.y, "cave_entrance");

  // --- connecting paths ---
  rect(21, farmGateY0, 24, farmGateY0 + 1, "path"); // farm -> plaza
  rect(38, 9, 44, 10, "path"); // plaza -> harbor
  rect(43, 10, 44, 19, "path");
  rect(38, 26, 44, 27, "path"); // plaza -> mine
  rect(43, 20, 44, 26, "path");

  const questBoard = { x: plaza.x0 + 1, y: plaza.y0 + 1 };
  set(questBoard.x, questBoard.y, "wood_floor");
  const shippingBin = { x: plaza.x1 - 1, y: plaza.y0 + 1 };
  set(shippingBin.x, shippingBin.y, "wood_floor");
  const bed = { x: plaza.x0 + 1, y: plaza.y1 - 1 };
  set(bed.x, bed.y, "wood_floor");

  const spawn = { x: (plaza.x0 + plaza.x1) / 2, y: (plaza.y0 + plaza.y1) / 2 };

  return {
    tiles,
    farmArea: farm,
    fishingSpots,
    mineEntrance,
    questBoard,
    shippingBin,
    bed,
    spawn,
  };
}

export const ALL_TILE_KEYS = TILE_KEYS;

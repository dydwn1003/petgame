import { fillCircle, fillRect, newGrid, setPx, type Grid } from "./pixelart";

const TS = 16;

export const TILE_KEYS = [
  "grass",
  "grass_speck",
  "dirt",
  "tilled_dry",
  "tilled_wet",
  "path",
  "water",
  "sand",
  "stone_floor",
  "wood_floor",
  "wall",
  "fence",
  "cave_entrance",
  "flower_patch",
  "sunflower_patch",
  "fountain",
  "ore_deposit",
  "bridge",
] as const;
export type TileKey = (typeof TILE_KEYS)[number];

// Tile indices for solidity checks (must not be walkable).
export const SOLID_TILES = new Set<TileKey>(["wall", "fence", "water", "fountain"]);

function speckle(g: Grid, base: string, spots: string, density: number, seed: number): void {
  fillRect(g, 0, 0, TS, TS, base);
  speckleOver(g, spots, density, seed);
}

function speckleOver(g: Grid, spots: string, density: number, seed: number): void {
  let s = seed;
  const rand = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return (s % 1000) / 1000;
  };
  for (let y = 0; y < TS; y++) {
    for (let x = 0; x < TS; x++) {
      if (rand() < density) setPx(g, x, y, spots);
    }
  }
}

function buildGrass(seed: number, extra?: string): Grid {
  const g = newGrid(TS);
  speckle(g, "#a9d18f", "#9bc880", 0.12, seed);
  // extra darker blades
  let s = seed + 99;
  const rand = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return (s % 1000) / 1000;
  };
  for (let y = 0; y < TS; y++) {
    for (let x = 0; x < TS; x++) {
      if (rand() < 0.05) setPx(g, x, y, "#7fb066");
    }
  }
  if (extra) {
    // tiny flower accent
    setPx(g, 4, 5, extra);
    setPx(g, 5, 5, "#fff6e0");
    setPx(g, 11, 10, extra);
    setPx(g, 12, 10, "#fff6e0");
  }
  return g;
}

function buildDirt(): Grid {
  const g = newGrid(TS);
  speckle(g, "#c9a876", "#bb9765", 0.15, 7);
  speckleOver(g, "#a8875a", 0.05, 21);
  return g;
}

function buildTilled(wet: boolean): Grid {
  const g = newGrid(TS);
  const base = wet ? "#6b4f36" : "#8b6b47";
  fillRect(g, 0, 0, TS, TS, base);
  // furrow rows
  for (let y = 2; y < TS; y += 4) {
    fillRect(g, 0, y, TS, 1, wet ? "#573e28" : "#725637");
  }
  if (wet) {
    for (let x = 1; x < TS; x += 5) setPx(g, x, 1, "#8fc4d8");
  }
  return g;
}

function buildPath(): Grid {
  const g = newGrid(TS);
  speckle(g, "#e8d9b8", "#ddc9a0", 0.18, 33);
  return g;
}

function buildWater(): Grid {
  const g = newGrid(TS);
  fillRect(g, 0, 0, TS, TS, "#a8d8e8");
  for (let y = 2; y < TS; y += 4) {
    fillRect(g, 0, y, TS, 1, "#8fc4d8");
  }
  for (let x = 3; x < TS; x += 6) setPx(g, x, 6, "#cdeaf3");
  return g;
}

function buildSand(): Grid {
  const g = newGrid(TS);
  speckle(g, "#eddcb0", "#e2cf9c", 0.15, 44);
  return g;
}

function buildStoneFloor(): Grid {
  const g = newGrid(TS);
  fillRect(g, 0, 0, TS, TS, "#bdb2b8");
  fillRect(g, 0, 0, TS, 1, "#a89ca3");
  fillRect(g, 0, 8, TS, 1, "#a89ca3");
  fillRect(g, 0, 0, 1, TS, "#a89ca3");
  fillRect(g, 8, 0, 1, TS, "#a89ca3");
  return g;
}

function buildWoodFloor(): Grid {
  const g = newGrid(TS);
  fillRect(g, 0, 0, TS, TS, "#c9a876");
  for (let y = 0; y < TS; y += 4) fillRect(g, 0, y, TS, 1, "#b3925f");
  return g;
}

function buildWall(): Grid {
  const g = newGrid(TS);
  fillRect(g, 0, 0, TS, TS, "#8a7f86");
  fillRect(g, 0, 0, TS, 6, "#786d74");
  for (let x = 0; x < TS; x += 4) fillRect(g, x, 6, 1, 10, "#786d74");
  fillRect(g, 0, 12, TS, 4, "#6b6067");
  return g;
}

function buildFence(): Grid {
  const g = buildGrass(88);
  fillRect(g, 2, 2, 2, 12, "#a9805a");
  fillRect(g, 12, 2, 2, 12, "#a9805a");
  fillRect(g, 0, 6, TS, 2, "#8a6644");
  fillRect(g, 0, 11, TS, 2, "#8a6644");
  return g;
}

function buildCaveEntrance(): Grid {
  const g = buildStoneFloor();
  fillRect(g, 3, 3, 10, 12, "#2a2430");
  fillRect(g, 4, 2, 8, 2, "#3d3444");
  return g;
}

function buildFlowerPatch(): Grid {
  const g = buildGrass(51, "#f2a4c1");
  setPx(g, 8, 7, "#f2d24a");
  setPx(g, 9, 7, "#fff6e0");
  setPx(g, 2, 12, "#c9a2f2");
  setPx(g, 3, 12, "#fff6e0");
  return g;
}

function buildSunflowerPatch(): Grid {
  const g = buildGrass(63);
  // big sunflower: brown/black seed center ringed by yellow petals
  fillCircle(g, 8, 8, 5, "#e8a93c");
  fillCircle(g, 8, 8, 3, "#5a3a1e");
  fillCircle(g, 8, 8, 2, "#3d2814");
  setPx(g, 3, 3, "#c97f2a");
  setPx(g, 13, 4, "#c97f2a");
  setPx(g, 4, 13, "#c97f2a");
  setPx(g, 12, 12, "#c97f2a");
  return g;
}

function buildFountain(): Grid {
  const g = newGrid(TS);
  fillRect(g, 0, 0, TS, TS, "#8fc4d8");
  fillCircle(g, 8, 8, 7, "#7ec0e0");
  fillCircle(g, 8, 8, 5, "#a8dcf0");
  for (let x = 2; x < TS; x += 5) setPx(g, x, (x * 3) % TS, "#e6f5fb");
  fillRect(g, 0, 0, TS, 1, "#5f96ab");
  fillRect(g, 0, TS - 1, TS, 1, "#5f96ab");
  fillRect(g, 0, 0, 1, TS, "#5f96ab");
  fillRect(g, TS - 1, 0, 1, TS, "#5f96ab");
  return g;
}

function buildOreDeposit(): Grid {
  const g = buildStoneFloor();
  fillCircle(g, 5, 6, 3, "#8f8296");
  fillCircle(g, 5, 6, 2, "#6f6478");
  setPx(g, 10, 9, "#f2d24a");
  setPx(g, 11, 9, "#e8b82c");
  setPx(g, 10, 10, "#e8b82c");
  setPx(g, 4, 11, "#a4e8e0");
  setPx(g, 5, 11, "#7ec9c0");
  return g;
}

function buildBridge(): Grid {
  const g = newGrid(TS);
  fillRect(g, 0, 0, TS, TS, "#a9805a");
  for (let x = 0; x < TS; x += 3) fillRect(g, x, 0, 1, TS, "#8a6644");
  fillRect(g, 0, 0, TS, 2, "#c9a876");
  fillRect(g, 0, 14, TS, 2, "#c9a876");
  return g;
}

export function buildTileGrids(): Record<TileKey, Grid> {
  return {
    grass: buildGrass(1),
    grass_speck: buildGrass(2, "#f2a4c1"),
    dirt: buildDirt(),
    tilled_dry: buildTilled(false),
    tilled_wet: buildTilled(true),
    path: buildPath(),
    water: buildWater(),
    sand: buildSand(),
    stone_floor: buildStoneFloor(),
    wood_floor: buildWoodFloor(),
    wall: buildWall(),
    fence: buildFence(),
    cave_entrance: buildCaveEntrance(),
    flower_patch: buildFlowerPatch(),
    sunflower_patch: buildSunflowerPatch(),
    fountain: buildFountain(),
    ore_deposit: buildOreDeposit(),
    bridge: buildBridge(),
  };
}

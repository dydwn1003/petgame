import { fillCircle, fillRect, newGrid, registerGrid, setPx, type Grid } from "./pixelart";

/** Decorative, non-interactive map dressing: buildings, trees, benches.
 * Each prop is drawn once at boot and placed as a static image in the
 * world, anchored by its bottom-center so it "stands" on its tile. */

export interface PropDef {
  key: string;
  w: number;
  h: number;
  solid: boolean; // blocks movement (small rect at the base) when true
}

function outlineRect(g: Grid, x: number, y: number, w: number, h: number, fill: string, edge: string): void {
  fillRect(g, x, y, w, h, fill);
  fillRect(g, x, y, w, 1, edge);
  fillRect(g, x, y + h - 1, w, 1, edge);
  fillRect(g, x, y, 1, h, edge);
  fillRect(g, x + w - 1, y, 1, h, edge);
}

function buildTree(variant: number): Grid {
  const g = newGrid(24, 30);
  const trunk = "#8a6644";
  const canopy = variant === 0 ? "#6fa855" : variant === 1 ? "#5f9c4a" : "#79b066";
  const canopyDark = variant === 0 ? "#5c8e46" : variant === 1 ? "#4f8a3d" : "#679c56";
  fillRect(g, 10, 20, 4, 9, trunk);
  fillRect(g, 10, 27, 4, 2, "#6b4f36");
  fillCircle(g, 12, 12, 11, canopy);
  fillCircle(g, 7, 15, 7, canopyDark);
  fillCircle(g, 17, 15, 6, canopyDark);
  fillCircle(g, 9, 8, 4, "#89c26f");
  return g;
}

function buildBush(): Grid {
  const g = newGrid(16, 12);
  fillCircle(g, 8, 7, 6, "#6fa855");
  fillCircle(g, 4, 8, 4, "#5c8e46");
  fillCircle(g, 12, 8, 4, "#5c8e46");
  fillCircle(g, 8, 4, 3, "#89c26f");
  return g;
}

function buildBench(): Grid {
  const g = newGrid(20, 14);
  const wood = "#c9a876";
  const dark = "#8a6644";
  fillRect(g, 2, 4, 16, 2, wood);
  fillRect(g, 2, 8, 16, 2, wood);
  fillRect(g, 3, 6, 14, 1, dark);
  fillRect(g, 2, 10, 2, 4, dark);
  fillRect(g, 16, 10, 2, 4, dark);
  return g;
}

function buildLampPost(): Grid {
  const g = newGrid(10, 30);
  const pole = "#6b6067";
  fillRect(g, 4, 10, 2, 18, pole);
  fillRect(g, 2, 26, 6, 2, "#4f4650");
  fillRect(g, 1, 2, 8, 9, "#3d3444");
  fillRect(g, 2, 3, 6, 7, "#ffd98a");
  fillRect(g, 0, 1, 10, 1, "#241b2e");
  return g;
}

function buildFarmhouse(): Grid {
  const g = newGrid(48, 42);
  const wall = "#f2e6cc";
  const wallShade = "#e2d3b0";
  const roof = "#b3543a";
  const roofDark = "#943f2a";
  const dark = "#4a3a2a";
  // walls
  outlineRect(g, 4, 18, 40, 22, wall, dark);
  fillRect(g, 4, 34, 40, 6, wallShade);
  // roof (triangular)
  for (let i = 0; i < 12; i++) {
    fillRect(g, 2 + i, 16 - i, 44 - i * 2, 1, i % 3 === 0 ? roofDark : roof);
  }
  fillRect(g, 0, 16, 48, 3, roofDark);
  // chimney
  fillRect(g, 34, 4, 6, 13, "#8a7f86");
  fillRect(g, 33, 3, 8, 2, "#786d74");
  // door
  outlineRect(g, 20, 26, 8, 14, "#8a6644", dark);
  setPx(g, 26, 33, "#f2d24a");
  // windows
  outlineRect(g, 8, 24, 8, 8, "#a8dcf0", dark);
  fillRect(g, 11, 24, 1, 8, dark);
  outlineRect(g, 32, 24, 8, 8, "#a8dcf0", dark);
  fillRect(g, 35, 24, 1, 8, dark);
  return g;
}

function buildBarn(): Grid {
  const g = newGrid(44, 38);
  const wall = "#b3543a";
  const wallDark = "#943f2a";
  const trim = "#f2e6cc";
  const dark = "#3d2e22";
  outlineRect(g, 2, 16, 40, 20, wall, dark);
  fillRect(g, 2, 30, 40, 6, wallDark);
  for (let i = 0; i < 10; i++) {
    fillRect(g, i, 16 - i, 44 - i * 2, 1, i % 3 === 0 ? "#8a3624" : "#a3492f");
  }
  outlineRect(g, 16, 22, 12, 14, trim, dark);
  fillRect(g, 21, 22, 2, 14, dark);
  fillRect(g, 16, 28, 12, 1, dark);
  fillRect(g, 4, 20, 6, 6, trim);
  fillRect(g, 34, 20, 6, 6, trim);
  return g;
}

function buildSilo(): Grid {
  const g = newGrid(18, 34);
  const body = "#c9a876";
  const dark = "#8a6644";
  fillCircle(g, 9, 6, 8, "#b3543a");
  fillRect(g, 2, 6, 14, 24, body);
  fillRect(g, 2, 6, 1, 24, dark);
  fillRect(g, 15, 6, 1, 24, dark);
  for (let y = 10; y < 30; y += 5) fillRect(g, 2, y, 14, 1, dark);
  fillCircle(g, 9, 6, 7, "#c9a876");
  return g;
}

function buildCafe(): Grid {
  const g = newGrid(46, 44);
  const wall = "#f2c9d8";
  const wallDark = "#e0aebe";
  const roof = "#5c6b8a";
  const roofDark = "#4a5670";
  const dark = "#4a3a2a";
  outlineRect(g, 3, 20, 40, 20, wall, dark);
  fillRect(g, 3, 34, 40, 6, wallDark);
  for (let i = 0; i < 10; i++) {
    fillRect(g, 1 + i, 18 - i, 44 - i * 2, 1, i % 3 === 0 ? roofDark : roof);
  }
  fillRect(g, 0, 18, 46, 2, roofDark);
  outlineRect(g, 18, 28, 8, 12, "#8a6644", dark);
  outlineRect(g, 6, 26, 8, 8, "#a8dcf0", dark);
  outlineRect(g, 32, 26, 8, 8, "#a8dcf0", dark);
  // sign
  fillRect(g, 15, 21, 16, 5, "#f2e6cc");
  fillRect(g, 15, 21, 16, 1, dark);
  fillRect(g, 15, 25, 16, 1, dark);
  setPx(g, 18, 23, "#b3543a");
  setPx(g, 20, 23, "#b3543a");
  setPx(g, 22, 23, "#b3543a");
  return g;
}

function buildBoat(): Grid {
  const g = newGrid(28, 16);
  const hull = "#8a6644";
  const hullDark = "#6b4f36";
  for (let x = 0; x < 28; x++) {
    const inset = Math.min(x, 27 - x, 4);
    fillRect(g, x, 4 + (4 - Math.min(inset, 4)), 1, 8, hull);
  }
  fillRect(g, 4, 10, 20, 3, hullDark);
  fillRect(g, 12, 0, 2, 8, "#c9a876");
  fillRect(g, 13, 1, 9, 5, "#fdf6ec");
  return g;
}

const TREE_KEYS = ["prop_tree0", "prop_tree1", "prop_tree2"];

export const PROPS: Record<string, PropDef> = {
  prop_tree0: { key: "prop_tree0", w: 24, h: 30, solid: true },
  prop_tree1: { key: "prop_tree1", w: 24, h: 30, solid: true },
  prop_tree2: { key: "prop_tree2", w: 24, h: 30, solid: true },
  prop_bush: { key: "prop_bush", w: 16, h: 12, solid: false },
  prop_bench: { key: "prop_bench", w: 20, h: 14, solid: true },
  prop_lamp: { key: "prop_lamp", w: 10, h: 30, solid: true },
  prop_farmhouse: { key: "prop_farmhouse", w: 48, h: 42, solid: true },
  prop_barn: { key: "prop_barn", w: 44, h: 38, solid: true },
  prop_silo: { key: "prop_silo", w: 18, h: 34, solid: true },
  prop_cafe: { key: "prop_cafe", w: 46, h: 44, solid: true },
  prop_boat: { key: "prop_boat", w: 28, h: 16, solid: false },
};

export { TREE_KEYS };

export function registerProps(scene: Phaser.Scene): void {
  registerGrid(scene, "prop_tree0", buildTree(0));
  registerGrid(scene, "prop_tree1", buildTree(1));
  registerGrid(scene, "prop_tree2", buildTree(2));
  registerGrid(scene, "prop_bush", buildBush());
  registerGrid(scene, "prop_bench", buildBench());
  registerGrid(scene, "prop_lamp", buildLampPost());
  registerGrid(scene, "prop_farmhouse", buildFarmhouse());
  registerGrid(scene, "prop_barn", buildBarn());
  registerGrid(scene, "prop_silo", buildSilo());
  registerGrid(scene, "prop_cafe", buildCafe());
  registerGrid(scene, "prop_boat", buildBoat());
}

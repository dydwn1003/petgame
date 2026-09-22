import { autoOutline, fillCircle, fillEllipse, fillRect, newGrid, OUTLINE, polygon, setPx, type Grid } from "./pixelart";

const S = 16;

function icon(draw: (g: Grid) => void): Grid {
  const g = newGrid(S);
  draw(g);
  autoOutline(g, OUTLINE);
  return g;
}

export function buildIconGrids(): Record<string, Grid> {
  return {
    spr_bone_carrot: icon((g) => {
      fillRect(g, 6, 3, 4, 8, "#f2a94c");
      fillCircle(g, 5, 3, 1.6, "#f2a94c");
      fillCircle(g, 11, 3, 1.6, "#f2a94c");
      fillRect(g, 5, 12, 6, 2, "#78b04a");
      setPx(g, 6, 13, "#5c8f38");
    }),
    spr_seed_bag: icon((g) => {
      fillEllipse(g, 8, 10, 5, 4, "#c9a876");
      fillRect(g, 6, 3, 4, 4, "#8a6644");
      fillCircle(g, 6, 10, 1, "#5c4326");
      fillCircle(g, 10, 9, 1, "#5c4326");
    }),
    spr_strawberry: icon((g) => {
      polygon(g, [[4, 5], [12, 5], [8, 14]], "#e0546a");
      fillRect(g, 5, 2, 2, 3, "#5c8f38");
      fillRect(g, 9, 2, 2, 3, "#5c8f38");
      setPx(g, 6, 8, "#f2d24a");
      setPx(g, 9, 10, "#f2d24a");
      setPx(g, 7, 11, "#f2d24a");
    }),
    spr_fish_small: icon((g) => {
      fillEllipse(g, 8, 8, 6, 3, "#a8c4e0");
      polygon(g, [[13, 8], [16, 5], [16, 11]], "#8fa8cc");
      setPx(g, 4, 7, "#2a1d15");
    }),
    spr_fish_dried: icon((g) => {
      fillEllipse(g, 8, 8, 6, 2.6, "#e0b478");
      polygon(g, [[13, 8], [16, 6], [16, 10]], "#c99a5e");
      for (let x = 3; x < 13; x += 2) setPx(g, x, 8, "#b3925f");
    }),
    spr_catnip: icon((g) => {
      fillRect(g, 7, 6, 2, 8, "#5c8f38");
      fillEllipse(g, 5, 6, 2.4, 3, "#78b04a");
      fillEllipse(g, 11, 6, 2.4, 3, "#78b04a");
      fillEllipse(g, 8, 3, 2.4, 3, "#8fc45a");
    }),
    spr_ore_copper: icon((g) => {
      polygon(g, [[3, 10], [6, 3], [11, 4], [13, 10], [8, 14]], "#c9784c");
      setPx(g, 7, 7, "#e0a06c");
      setPx(g, 8, 8, "#e0a06c");
    }),
    spr_ore_gold: icon((g) => {
      polygon(g, [[3, 10], [6, 3], [11, 4], [13, 10], [8, 14]], "#f2c14a");
      setPx(g, 7, 7, "#fde48a");
      setPx(g, 8, 8, "#fde48a");
    }),
    spr_gem_blue: icon((g) => {
      polygon(g, [[8, 2], [13, 7], [8, 14], [3, 7]], "#6ec3e0");
      polygon(g, [[8, 2], [13, 7], [8, 9]], "#a6e0f2");
    }),
    spr_gold_coin: icon((g) => {
      fillCircle(g, 8, 8, 6, "#f2c14a");
      fillCircle(g, 8, 8, 4, "#f2d24a");
      setPx(g, 7, 6, "#fde48a");
    }),
    spr_hoe: icon((g) => {
      fillRect(g, 7, 2, 2, 10, "#8a6644");
      fillRect(g, 4, 11, 8, 3, "#9ca3ad");
    }),
    spr_watering_can: icon((g) => {
      fillRect(g, 3, 6, 8, 6, "#6ec3e0");
      fillRect(g, 10, 5, 4, 2, "#6ec3e0");
      fillRect(g, 4, 4, 5, 2, "#6ec3e0");
    }),
    spr_rod: icon((g) => {
      fillRect(g, 3, 12, 10, 2, "#8a6644");
      fillRect(g, 12, 3, 1, 10, "#5c4326");
    }),
    spr_sprout0: icon((g) => {
      fillRect(g, 7, 11, 2, 3, "#5c8f38");
      fillEllipse(g, 8, 10, 2, 1.4, "#78b04a");
    }),
    spr_sprout1: icon((g) => {
      fillRect(g, 7, 8, 2, 6, "#5c8f38");
      fillEllipse(g, 6, 8, 2.2, 1.6, "#78b04a");
      fillEllipse(g, 10, 9, 2.2, 1.6, "#78b04a");
    }),
    spr_sprout2: icon((g) => {
      fillRect(g, 7, 6, 2, 8, "#5c8f38");
      fillEllipse(g, 5, 6, 2.6, 1.8, "#78b04a");
      fillEllipse(g, 11, 7, 2.6, 1.8, "#78b04a");
      fillEllipse(g, 8, 4, 2.2, 1.8, "#8fc45a");
    }),
    spr_pickaxe: icon((g) => {
      fillRect(g, 7, 4, 2, 10, "#8a6644");
      polygon(g, [[2, 5], [14, 2], [14, 5], [2, 8]], "#9ca3ad");
    }),
  };
}

import {
  autoOutline,
  fillCircle,
  fillEllipse,
  fillRect,
  flipGridX,
  newGrid,
  OUTLINE,
  polygon,
  setPx,
  type Grid,
} from "./pixelart";

const CS = 32; // character sprite size, per GDD spec (32x32 fixed)

export type Species = "dog" | "cat" | "hamster";

export interface SpeciesPalette {
  body: string;
  bodyShade: string;
  belly: string;
  ear: string;
  nose: string;
}

export const SPECIES_PALETTES: Record<Species, SpeciesPalette> = {
  dog: { body: "#e8a662", bodyShade: "#d18f4a", belly: "#fdf6ec", ear: "#c97f3c", nose: "#3d2314" },
  cat: { body: "#f0eef2", bodyShade: "#d7d2dc", belly: "#ffffff", ear: "#f2b8c6", nose: "#e0879c" },
  hamster: { body: "#e0b478", bodyShade: "#c99a5e", belly: "#f7e2bb", ear: "#f2c9c9", nose: "#a85d5d" },
};

type Facing = "down" | "up" | "side";

function drawEars(g: Grid, species: Species, pal: SpeciesPalette, facing: Facing): void {
  if (species === "dog") {
    if (facing === "side") {
      fillEllipse(g, 22, 9, 3, 5, pal.bodyShade);
    } else {
      fillEllipse(g, 8, 9, 3, 5, pal.bodyShade);
      fillEllipse(g, 24, 9, 3, 5, pal.bodyShade);
    }
  } else if (species === "cat") {
    if (facing === "side") {
      polygon(g, [[19, 6], [25, 6], [23, 0]], pal.body);
      polygon(g, [[21, 5], [24, 5], [23, 2]], pal.ear);
    } else {
      polygon(g, [[5, 6], [11, 6], [6, 0]], pal.body);
      polygon(g, [[21, 6], [27, 6], [26, 0]], pal.body);
      polygon(g, [[6, 5], [9.5, 5], [7, 2]], pal.ear);
      polygon(g, [[22.5, 5], [26, 5], [25, 2]], pal.ear);
    }
  } else {
    if (facing === "side") {
      fillCircle(g, 23, 6, 2.6, pal.bodyShade);
      fillCircle(g, 23, 6, 1.3, pal.ear);
    } else {
      fillCircle(g, 8, 6, 2.6, pal.bodyShade);
      fillCircle(g, 24, 6, 2.6, pal.bodyShade);
      fillCircle(g, 8, 6, 1.3, pal.ear);
      fillCircle(g, 24, 6, 1.3, pal.ear);
    }
  }
}

function drawTail(g: Grid, species: Species, pal: SpeciesPalette, facing: Facing): void {
  if (species === "hamster") return;
  if (species === "dog") {
    if (facing === "up") fillEllipse(g, 16, 18, 2.4, 4, pal.bodyShade);
    if (facing === "side") fillEllipse(g, 8, 17, 2.2, 4, pal.bodyShade);
  } else if (species === "cat") {
    if (facing === "up") {
      fillRect(g, 15, 14, 2, 8, pal.bodyShade);
      fillCircle(g, 16, 13, 1.6, pal.bodyShade);
    }
    if (facing === "side") {
      fillRect(g, 5, 16, 6, 2, pal.bodyShade);
      fillCircle(g, 4, 15, 1.6, pal.bodyShade);
    }
  }
}

function drawBase(species: Species, pal: SpeciesPalette, facing: Facing, step: 0 | 1): Grid {
  const g = newGrid(CS);
  const bob = step === 1 ? -1 : 0;
  const headCX = facing === "side" ? 18 : 16;
  const headCY = 12 + bob;
  const bodyCX = facing === "side" ? 17 : 16;
  const bodyCY = 21 + bob;

  drawTail(g, species, pal, facing);

  // body
  fillEllipse(g, bodyCX, bodyCY, 8, 7, pal.body);
  // feet (alternate raised on step frame for a walk bounce)
  const footY = 28 + (step === 1 ? -1 : 0);
  const footY2 = 28 + (step === 1 ? 1 : 0);
  fillEllipse(g, bodyCX - 4, footY, 2.6, 1.8, pal.bodyShade);
  fillEllipse(g, bodyCX + 4, footY2, 2.6, 1.8, pal.bodyShade);

  // ears (behind head)
  drawEars(g, species, pal, facing);

  // head
  fillCircle(g, headCX, headCY, 9, pal.body);

  // belly patch
  if (facing === "down") {
    fillEllipse(g, bodyCX, bodyCY + 2, 5, 4, pal.belly);
  } else if (facing === "side") {
    fillEllipse(g, bodyCX + 2, bodyCY + 2, 4, 3.4, pal.belly);
  }

  // face
  if (facing === "down") {
    setPx(g, headCX - 4, headCY - 1, "#2a1d15");
    setPx(g, headCX - 3, headCY - 1, "#2a1d15");
    setPx(g, headCX + 3, headCY - 1, "#2a1d15");
    setPx(g, headCX + 4, headCY - 1, "#2a1d15");
    fillRect(g, headCX - 1, headCY + 2, 2, 2, pal.nose);
  } else if (facing === "side") {
    setPx(g, headCX + 5, headCY - 1, "#2a1d15");
    setPx(g, headCX + 6, headCY - 1, "#2a1d15");
    fillRect(g, headCX + 7, headCY + 2, 2, 2, pal.nose);
  }
  // "up" (back) view intentionally has no face — just head + ears silhouette.

  autoOutline(g, OUTLINE);
  return g;
}

export interface CharacterFrames {
  down: Grid[];
  up: Grid[];
  side: Grid[]; // faces right; flip for left
}

export function buildCharacter(species: Species, palOverride?: Partial<SpeciesPalette>): CharacterFrames {
  const pal = { ...SPECIES_PALETTES[species], ...palOverride };
  return {
    down: [drawBase(species, pal, "down", 0), drawBase(species, pal, "down", 1)],
    up: [drawBase(species, pal, "up", 0), drawBase(species, pal, "up", 1)],
    side: [drawBase(species, pal, "side", 0), drawBase(species, pal, "side", 1)],
  };
}

export function frameLeft(g: Grid): Grid {
  return flipGridX(g);
}

// --- NPC accessory overlays (drawn onto the down-frame only, kept simple) ---

export function addBandana(g: Grid, color: string): Grid {
  const out = g.map((row) => row.slice());
  fillRect(out, 10, 17, 12, 3, color);
  fillRect(out, 14, 20, 4, 3, color);
  autoOutline(out, OUTLINE);
  return out;
}

export function addApron(g: Grid, color: string): Grid {
  const out = g.map((row) => row.slice());
  fillRect(out, 11, 19, 10, 9, color);
  fillRect(out, 12, 17, 2, 3, color);
  fillRect(out, 18, 17, 2, 3, color);
  autoOutline(out, OUTLINE);
  return out;
}

export function addVest(g: Grid, color: string): Grid {
  const out = g.map((row) => row.slice());
  fillRect(out, 10, 18, 4, 8, color);
  fillRect(out, 18, 18, 4, 8, color);
  autoOutline(out, OUTLINE);
  return out;
}

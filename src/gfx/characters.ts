import {
  autoOutline,
  fillCircle,
  fillEllipse,
  fillRect,
  flipGridX,
  newGrid,
  OUTLINE,
  polygon,
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

interface Anchor {
  headCX: number;
  headCY: number;
  headR: number;
  bodyCX: number;
  bodyCY: number;
  bodyRX: number;
  bodyRY: number;
}

// All characters walk on four legs; each facing has its own on-all-fours
// layout (head at the leading edge, body trailing behind it).
const ANCHORS: Record<Facing, Anchor> = {
  down: { headCX: 16, headCY: 23, headR: 6, bodyCX: 16, bodyCY: 13, bodyRX: 7, bodyRY: 6.5 },
  up: { headCX: 16, headCY: 9, headR: 6, bodyCX: 16, bodyCY: 19, bodyRX: 7, bodyRY: 6.5 },
  side: { headCX: 25, headCY: 13, headR: 6, bodyCX: 14, bodyCY: 17, bodyRX: 9, bodyRY: 6 },
};

interface Leg {
  x: number;
  y: number;
  group: "A" | "B";
}

// Legs poke out sideways at shoulder height (near the head) and hip height
// (near the tail) rather than below the head, so they clear the head/torso
// silhouette instead of being painted over by it.
function legsFor(facing: Facing): Leg[] {
  if (facing === "down") {
    return [
      { x: 7, y: 19, group: "A" }, // front-left (shoulder)
      { x: 25, y: 19, group: "B" }, // front-right (shoulder)
      { x: 8, y: 8, group: "B" }, // back-left (hip)
      { x: 24, y: 8, group: "A" }, // back-right (hip)
    ];
  }
  if (facing === "up") {
    return [
      { x: 7, y: 13, group: "A" }, // front-left (shoulder)
      { x: 25, y: 13, group: "B" }, // front-right (shoulder)
      { x: 8, y: 24, group: "B" }, // back-left (hip)
      { x: 24, y: 24, group: "A" }, // back-right (hip)
    ];
  }
  // side (facing right): all four legs hang below the torso.
  return [
    { x: 7, y: 25, group: "A" }, // back-far (hip)
    { x: 11, y: 26, group: "B" }, // back-near (hip)
    { x: 19, y: 25, group: "B" }, // front-far (shoulder)
    { x: 23, y: 26, group: "A" }, // front-near (shoulder)
  ];
}

function drawLegs(g: Grid, legs: Leg[], step: 0 | 1, color: string): void {
  for (const leg of legs) {
    const raised = (step === 0 && leg.group === "B") || (step === 1 && leg.group === "A");
    const y = leg.y + (raised ? -1.5 : 1);
    fillEllipse(g, leg.x, y, 2.3, 3, color);
  }
}

function drawEars(g: Grid, species: Species, pal: SpeciesPalette, facing: Facing, a: Anchor): void {
  const { headCX: hx, headCY: hy } = a;
  if (species === "dog") {
    if (facing === "side") {
      fillEllipse(g, hx - 3, hy - 4, 2.6, 4.4, pal.bodyShade);
    } else {
      fillEllipse(g, hx - 6, hy - 3, 2.6, 4.4, pal.bodyShade);
      fillEllipse(g, hx + 6, hy - 3, 2.6, 4.4, pal.bodyShade);
    }
  } else if (species === "cat") {
    if (facing === "side") {
      polygon(
        g,
        [
          [hx - 4, hy - 4],
          [hx + 1, hy - 4],
          [hx - 2, hy - 9],
        ],
        pal.body
      );
      polygon(
        g,
        [
          [hx - 3, hy - 5],
          [hx - 0.5, hy - 5],
          [hx - 2, hy - 7.5],
        ],
        pal.ear
      );
    } else {
      polygon(
        g,
        [
          [hx - 6, hy - 3],
          [hx - 1, hy - 3],
          [hx - 5, hy - 9],
        ],
        pal.body
      );
      polygon(
        g,
        [
          [hx + 1, hy - 3],
          [hx + 6, hy - 3],
          [hx + 5, hy - 9],
        ],
        pal.body
      );
      polygon(
        g,
        [
          [hx - 5, hy - 4],
          [hx - 2.2, hy - 4],
          [hx - 4, hy - 6.8],
        ],
        pal.ear
      );
      polygon(
        g,
        [
          [hx + 2.2, hy - 4],
          [hx + 5, hy - 4],
          [hx + 4, hy - 6.8],
        ],
        pal.ear
      );
    }
  } else {
    if (facing === "side") {
      fillCircle(g, hx - 2, hy - 5, 2.4, pal.bodyShade);
      fillCircle(g, hx - 2, hy - 5, 1.2, pal.ear);
    } else {
      fillCircle(g, hx - 5, hy - 4, 2.4, pal.bodyShade);
      fillCircle(g, hx + 5, hy - 4, 2.4, pal.bodyShade);
      fillCircle(g, hx - 5, hy - 4, 1.2, pal.ear);
      fillCircle(g, hx + 5, hy - 4, 1.2, pal.ear);
    }
  }
}

function drawTail(g: Grid, species: Species, pal: SpeciesPalette, facing: Facing, a: Anchor): void {
  if (species === "hamster" || facing === "down") return;
  const { bodyCX: bx, bodyCY: by } = a;
  if (species === "dog") {
    if (facing === "up") fillEllipse(g, bx, by + 8, 2.2, 3.6, pal.bodyShade);
    if (facing === "side") fillEllipse(g, bx - 9, by - 3, 2.2, 3.6, pal.bodyShade);
  } else if (species === "cat") {
    if (facing === "up") {
      fillRect(g, bx - 1, by + 4, 2, 7, pal.bodyShade);
      fillCircle(g, bx, by + 11, 1.6, pal.bodyShade);
    }
    if (facing === "side") {
      fillRect(g, bx - 12, by - 5, 6, 2, pal.bodyShade);
      fillCircle(g, bx - 13, by - 6, 1.6, pal.bodyShade);
    }
  }
}

function drawBase(species: Species, pal: SpeciesPalette, facing: Facing, step: 0 | 1): Grid {
  const g = newGrid(CS);
  const a = ANCHORS[facing];

  drawTail(g, species, pal, facing, a);

  // torso (trails behind the head)
  fillEllipse(g, a.bodyCX, a.bodyCY, a.bodyRX, a.bodyRY, pal.body);

  // legs drawn on top of the torso so all four stay visible
  drawLegs(g, legsFor(facing), step, pal.bodyShade);

  drawEars(g, species, pal, facing, a);

  // head (leads the body, at the front of the walking direction)
  fillCircle(g, a.headCX, a.headCY, a.headR, pal.body);

  // belly / chest patch
  if (facing === "down") {
    fillEllipse(g, a.bodyCX, a.bodyCY + 5, 4, 3.4, pal.belly);
  } else if (facing === "side") {
    fillEllipse(g, a.bodyCX + 1, a.bodyCY + 4, 4.5, 2.6, pal.belly);
  }

  // face
  if (facing === "down") {
    fillRect(g, a.headCX - 4, a.headCY - 1, 2, 2, "#2a1d15");
    fillRect(g, a.headCX + 2, a.headCY - 1, 2, 2, "#2a1d15");
    fillRect(g, a.headCX - 1, a.headCY + 2, 2, 2, pal.nose);
  } else if (facing === "side") {
    fillRect(g, a.headCX + 4, a.headCY - 1, 2, 2, "#2a1d15");
    fillRect(g, a.headCX + 6, a.headCY + 2, 2, 2, pal.nose);
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

// --- NPC accessory overlays (drawn onto the down/side frames, kept simple) ---
// Positioned around the down-facing neck/chest (head centered near y=23,
// body centered near y=15) so they read as worn around the collar.

export function addBandana(g: Grid, color: string): Grid {
  const out = g.map((row) => row.slice());
  fillRect(out, 10, 18, 12, 3, color);
  fillRect(out, 14, 21, 4, 2, color);
  autoOutline(out, OUTLINE);
  return out;
}

export function addApron(g: Grid, color: string): Grid {
  const out = g.map((row) => row.slice());
  fillRect(out, 11, 15, 10, 8, color);
  fillRect(out, 12, 12, 2, 4, color);
  fillRect(out, 18, 12, 2, 4, color);
  autoOutline(out, OUTLINE);
  return out;
}

export function addVest(g: Grid, color: string): Grid {
  const out = g.map((row) => row.slice());
  fillRect(out, 9, 12, 4, 9, color);
  fillRect(out, 19, 12, 4, 9, color);
  autoOutline(out, OUTLINE);
  return out;
}

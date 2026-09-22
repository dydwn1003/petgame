import {
  autoOutline,
  fillCircle,
  fillEllipse,
  fillEllipseMasked,
  fillRect,
  fillRectMasked,
  flipGridX,
  newGrid,
  OUTLINE,
  polygon,
  setPx,
  type Grid,
} from "./pixelart";
import type { BreedDef, BreedPalette, PatternKind } from "../data/breeds";

const CS = 64; // character sprite resolution (upscaled for finer breed detail)

export type Species = "dog" | "cat" | "hamster";

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
  down: { headCX: 32, headCY: 46, headR: 12, bodyCX: 32, bodyCY: 26, bodyRX: 14, bodyRY: 13 },
  up: { headCX: 32, headCY: 18, headR: 12, bodyCX: 32, bodyCY: 38, bodyRX: 14, bodyRY: 13 },
  side: { headCX: 50, headCY: 26, headR: 12, bodyCX: 28, bodyCY: 34, bodyRX: 18, bodyRY: 12 },
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
      { x: 14, y: 38, group: "A" }, // front-left (shoulder)
      { x: 50, y: 38, group: "B" }, // front-right (shoulder)
      { x: 16, y: 16, group: "B" }, // back-left (hip)
      { x: 48, y: 16, group: "A" }, // back-right (hip)
    ];
  }
  if (facing === "up") {
    return [
      { x: 14, y: 26, group: "A" }, // front-left (shoulder)
      { x: 50, y: 26, group: "B" }, // front-right (shoulder)
      { x: 16, y: 48, group: "B" }, // back-left (hip)
      { x: 48, y: 48, group: "A" }, // back-right (hip)
    ];
  }
  // side (facing right): all four legs hang below the torso.
  return [
    { x: 14, y: 50, group: "A" }, // back-far (hip)
    { x: 22, y: 52, group: "B" }, // back-near (hip)
    { x: 38, y: 50, group: "B" }, // front-far (shoulder)
    { x: 46, y: 52, group: "A" }, // front-near (shoulder)
  ];
}

function drawLegs(g: Grid, legs: Leg[], step: 0 | 1, color: string): void {
  for (const leg of legs) {
    const raised = (step === 0 && leg.group === "B") || (step === 1 && leg.group === "A");
    const y = leg.y + (raised ? -3 : 2);
    fillEllipse(g, leg.x, y, 4.6, 6, color);
  }
}

function drawEars(g: Grid, species: Species, pal: BreedPalette, facing: Facing, a: Anchor, fluffy: boolean): void {
  const { headCX: hx, headCY: hy } = a;
  const earSize = fluffy ? 1.25 : 1;
  if (species === "dog") {
    if (facing === "side") {
      fillEllipse(g, hx - 6, hy - 8, 5.2 * earSize, 8.8 * earSize, pal.bodyShade);
    } else {
      fillEllipse(g, hx - 12, hy - 6, 5.2 * earSize, 8.8 * earSize, pal.bodyShade);
      fillEllipse(g, hx + 12, hy - 6, 5.2 * earSize, 8.8 * earSize, pal.bodyShade);
    }
  } else if (species === "cat") {
    if (facing === "side") {
      polygon(
        g,
        [
          [hx - 8, hy - 8],
          [hx + 2, hy - 8],
          [hx - 4, hy - 18],
        ],
        pal.body
      );
      polygon(
        g,
        [
          [hx - 6, hy - 10],
          [hx - 1, hy - 10],
          [hx - 4, hy - 15],
        ],
        pal.ear
      );
    } else {
      polygon(
        g,
        [
          [hx - 12, hy - 6],
          [hx - 2, hy - 6],
          [hx - 10, hy - 18],
        ],
        pal.body
      );
      polygon(
        g,
        [
          [hx + 2, hy - 6],
          [hx + 12, hy - 6],
          [hx + 10, hy - 18],
        ],
        pal.body
      );
      polygon(
        g,
        [
          [hx - 10, hy - 8],
          [hx - 4.4, hy - 8],
          [hx - 8, hy - 13.6],
        ],
        pal.ear
      );
      polygon(
        g,
        [
          [hx + 4.4, hy - 8],
          [hx + 10, hy - 8],
          [hx + 8, hy - 13.6],
        ],
        pal.ear
      );
    }
  } else {
    if (facing === "side") {
      fillCircle(g, hx - 4, hy - 10, 4.8, pal.bodyShade);
      fillCircle(g, hx - 4, hy - 10, 2.4, pal.ear);
    } else {
      fillCircle(g, hx - 10, hy - 8, 4.8, pal.bodyShade);
      fillCircle(g, hx + 10, hy - 8, 4.8, pal.bodyShade);
      fillCircle(g, hx - 10, hy - 8, 2.4, pal.ear);
      fillCircle(g, hx + 10, hy - 8, 2.4, pal.ear);
    }
  }
}

function drawTail(g: Grid, species: Species, pal: BreedPalette, facing: Facing, a: Anchor): void {
  if (species === "hamster" || facing === "down") return;
  const { bodyCX: bx, bodyCY: by } = a;
  if (species === "dog") {
    if (facing === "up") fillEllipse(g, bx, by + 16, 4.4, 7.2, pal.bodyShade);
    if (facing === "side") fillEllipse(g, bx - 18, by - 6, 4.4, 7.2, pal.bodyShade);
  } else if (species === "cat") {
    if (facing === "up") {
      fillRect(g, bx - 2, by + 8, 4, 14, pal.bodyShade);
      fillCircle(g, bx, by + 22, 3.2, pal.bodyShade);
    }
    if (facing === "side") {
      fillRect(g, bx - 24, by - 10, 12, 4, pal.bodyShade);
      fillCircle(g, bx - 26, by - 12, 3.2, pal.bodyShade);
    }
  }
}

// --- breed fur-pattern overlays, applied on top of the base silhouette but
// masked to it, and always before the outline pass ---

function applyPattern(g: Grid, pattern: PatternKind, pal: BreedPalette, facing: Facing, a: Anchor): void {
  const color = pal.patternColor ?? pal.bodyShade;
  if (pattern === "tabby") {
    const stripeXs = facing === "side" ? [18, 24, 30, 36] : [24, 32, 40];
    for (const x of stripeXs) {
      fillRectMasked(g, x, a.bodyCY - a.bodyRY, 3, a.bodyRY * 2 + 4, color);
    }
    fillRectMasked(g, a.headCX - 2, a.headCY - a.headR, 4, 6, color);
  } else if (pattern === "calico" || pattern === "tuxedo") {
    const c1 = pal.patternColor ?? "#e8923c";
    const c2 = pal.patternColor2;
    // A patch over one side of the head/back (looks natural on any facing).
    fillEllipseMasked(g, a.headCX + (facing === "side" ? 4 : 10), a.headCY - 4, 8, 8, c1);
    fillEllipseMasked(g, a.bodyCX - (facing === "side" ? 6 : 8), a.bodyCY - 4, 9, 7, c1);
    if (c2) {
      fillEllipseMasked(g, a.bodyCX + (facing === "side" ? 8 : 8), a.bodyCY + 2, 7, 6, c2);
    }
    if (pattern === "tuxedo") {
      // Bold white muzzle/chest blaze — tuxedo cats read mostly by this.
      if (facing !== "up") {
        fillEllipseMasked(g, a.headCX, a.headCY + 4, 5, 6, "#ffffff");
      }
    }
  } else if (pattern === "dorsalStripe") {
    if (facing === "side") {
      fillRectMasked(g, a.bodyCX - a.bodyRX + 2, a.bodyCY - a.bodyRY, a.bodyRX * 2 - 4, 3, color);
    } else {
      fillRectMasked(g, a.bodyCX - 2, a.bodyCY - a.bodyRY, 4, a.bodyRY * 2, color);
    }
  } else if (pattern === "eyebrows" && facing !== "up") {
    const y = a.headCY - a.headR + (facing === "side" ? 5 : 4);
    if (facing === "side") {
      fillRectMasked(g, a.headCX + 2, y, 5, 2, color);
    } else {
      fillRectMasked(g, a.headCX - 8, y, 4, 2, color);
      fillRectMasked(g, a.headCX + 4, y, 4, 2, color);
    }
  } else if (pattern === "curly") {
    // Scattered lighter scallops across the torso/head to suggest curls.
    let seed = 71;
    const rand = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return (seed % 1000) / 1000;
    };
    for (let i = 0; i < 16; i++) {
      const x = a.bodyCX + (rand() - 0.5) * a.bodyRX * 2.4;
      const y = a.bodyCY + (rand() - 0.5) * a.bodyRY * 2.4;
      fillEllipseMasked(g, x, y, 2.4, 2.4, pal.bodyShade);
    }
  }
  // "fluffy" is handled as a shape modifier (bigger ears/ruff) rather than a
  // color overlay — see drawEars(fluffy) and the neck-ruff pass below.
}

function drawRuff(g: Grid, pal: BreedPalette, facing: Facing, a: Anchor): void {
  // A puffy ring of fur bumps around the neck for fluffy breeds.
  const cx = facing === "side" ? a.headCX - 8 : a.headCX;
  const cy = facing === "side" ? a.headCY + 6 : a.headCY + a.headR - 4;
  const bumps = 7;
  for (let i = 0; i < bumps; i++) {
    const t = (i / (bumps - 1)) * Math.PI - Math.PI / 2;
    const bx = cx + Math.cos(t) * 14;
    const by = cy + Math.sin(t) * 8 + 6;
    fillCircle(g, bx, by, 5, pal.body);
  }
}

function drawBase(breed: BreedDef, facing: Facing, step: 0 | 1): Grid {
  const g = newGrid(CS);
  const a = ANCHORS[facing];
  const species = breed.species;
  const pal = breed.palette;
  const fluffy = breed.pattern === "fluffy";

  drawTail(g, species, pal, facing, a);

  if (fluffy && facing !== "down") drawRuff(g, pal, facing, a);

  // torso (trails behind the head)
  fillEllipse(g, a.bodyCX, a.bodyCY, a.bodyRX, a.bodyRY, pal.body);

  // legs drawn on top of the torso so all four stay visible
  drawLegs(g, legsFor(facing), step, pal.bodyShade);

  drawEars(g, species, pal, facing, a, fluffy);

  if (fluffy && facing === "down") drawRuff(g, pal, facing, a);

  // head (leads the body, at the front of the walking direction)
  fillCircle(g, a.headCX, a.headCY, a.headR, pal.body);

  // belly / chest patch
  if (facing === "down") {
    fillEllipse(g, a.bodyCX, a.bodyCY + 10, 8, 6.8, pal.belly);
  } else if (facing === "side") {
    fillEllipse(g, a.bodyCX + 2, a.bodyCY + 8, 9, 5.2, pal.belly);
  }

  applyPattern(g, breed.pattern, pal, facing, a);

  // face
  if (facing === "down") {
    fillRect(g, a.headCX - 8, a.headCY - 2, 4, 4, "#2a1d15");
    fillRect(g, a.headCX + 4, a.headCY - 2, 4, 4, "#2a1d15");
    setPx(g, a.headCX - 7, a.headCY - 3, "#fdf6ec");
    setPx(g, a.headCX + 5, a.headCY - 3, "#fdf6ec");
    fillRect(g, a.headCX - 2, a.headCY + 4, 4, 4, pal.nose);
    // blush
    fillCircle(g, a.headCX - 10, a.headCY + 4, 2.4, "#f2a4c1");
    fillCircle(g, a.headCX + 10, a.headCY + 4, 2.4, "#f2a4c1");
  } else if (facing === "side") {
    fillRect(g, a.headCX + 8, a.headCY - 2, 4, 4, "#2a1d15");
    setPx(g, a.headCX + 9, a.headCY - 3, "#fdf6ec");
    fillRect(g, a.headCX + 12, a.headCY + 4, 4, 4, pal.nose);
    fillCircle(g, a.headCX + 2, a.headCY + 6, 2.4, "#f2a4c1");
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

export function buildCharacter(breed: BreedDef): CharacterFrames {
  return {
    down: [drawBase(breed, "down", 0), drawBase(breed, "down", 1)],
    up: [drawBase(breed, "up", 0), drawBase(breed, "up", 1)],
    side: [drawBase(breed, "side", 0), drawBase(breed, "side", 1)],
  };
}

export function frameLeft(g: Grid): Grid {
  return flipGridX(g);
}

// --- NPC accessory overlays (drawn onto the down/side frames, kept simple) ---
// Positioned around the down-facing neck/chest (head centered near y=46,
// body centered near y=26 at this 64px resolution).

export function addBandana(g: Grid, color: string): Grid {
  const out = g.map((row) => row.slice());
  fillRect(out, 20, 36, 24, 6, color);
  fillRect(out, 28, 42, 8, 4, color);
  autoOutline(out, OUTLINE);
  return out;
}

export function addApron(g: Grid, color: string): Grid {
  const out = g.map((row) => row.slice());
  // Kept above y=34 (the down-facing head's top edge) so it never bleeds
  // onto the face — the apron covers the chest/body, not the head.
  fillRect(out, 22, 16, 20, 18, color);
  fillRect(out, 24, 10, 4, 8, color);
  fillRect(out, 36, 10, 4, 8, color);
  autoOutline(out, OUTLINE);
  return out;
}

export function addVest(g: Grid, color: string): Grid {
  const out = g.map((row) => row.slice());
  fillRect(out, 18, 24, 8, 18, color);
  fillRect(out, 38, 24, 8, 18, color);
  autoOutline(out, OUTLINE);
  return out;
}

import { flipGridX, registerGrid, type Grid } from "./pixelart";
import { buildIconGrids } from "./icons";
import { addApron, addBandana, addVest, buildCharacter } from "./characters";
import { BREEDS, getBreed } from "../data/breeds";
import { NPCS } from "../data/npcs";
import { hasImageArt, IMAGE_BREEDS } from "./spriteAssets";

const DIRS = ["down", "up", "left", "right"] as const;
type Dir = (typeof DIRS)[number];

export function registerIcons(scene: Phaser.Scene): void {
  const grids = buildIconGrids();
  for (const [key, g] of Object.entries(grids)) {
    registerGrid(scene, `icon_${key}`, g);
  }
}

/** Registers a horizontally-flipped copy of an existing (possibly image-based) texture. */
function mirrorTexture(scene: Phaser.Scene, srcKey: string, destKey: string): void {
  if (scene.textures.exists(destKey)) return;
  const src = scene.textures.get(srcKey).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  const canvas = document.createElement("canvas");
  canvas.width = src.width;
  canvas.height = src.height;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  ctx.translate(canvas.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(src, 0, 0);
  scene.textures.addCanvas(destKey, canvas);
}

/** Fraction of a frame's height, from the top, where the legs/feet start. */
const LEG_TOP_FRAC = 0.74;

/** Guards against re-synthesizing the same breed+direction on every scene restart
 * (the game's texture manager persists across scene.restart() calls). */
const walkCycleDone = new Set<string>();

/** Clones `src` onto a same-size canvas, then "lifts" one half (left or right of
 * the frame's own midline) of the leg region: that half is redrawn shifted up
 * by `liftPx`, shortening it on screen and leaving the other half planted —
 * a cheap way to fake an alternating walk step from a single static pose. */
function buildLegLiftCanvas(
  src: CanvasImageSource,
  w: number,
  h: number,
  legTop: number,
  mid: number,
  liftSide: "left" | "right",
  liftPx: number,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, 0, 0);

  const x0 = liftSide === "left" ? 0 : mid;
  const x1 = liftSide === "left" ? mid : w;
  const regionW = x1 - x0;
  const regionH = h - legTop;
  if (regionW <= 0 || regionH <= 0) return canvas;

  const strip = document.createElement("canvas");
  strip.width = regionW;
  strip.height = regionH;
  const sctx = strip.getContext("2d")!;
  sctx.imageSmoothingEnabled = false;
  sctx.drawImage(canvas, x0, legTop, regionW, regionH, 0, 0, regionW, regionH);

  ctx.clearRect(x0, legTop, regionW, regionH);
  ctx.drawImage(strip, 0, 0, regionW, regionH, x0, legTop - liftPx, regionW, regionH);
  return canvas;
}

/** Synthesizes a 3-frame walk cycle (neutral, left-leg-lifted, right-leg-lifted)
 * for a breed+direction from its single extracted pose, so idle art stays the
 * clean original (`_0`) while walking actually shows the legs alternate —
 * the reference sheets only ever gave duplicate/near-duplicate poses per
 * direction, so real leg movement has to be faked at texture-registration time. */
function synthesizeWalkCycle(scene: Phaser.Scene, breedId: string, dir: Dir): void {
  const marker = `${breedId}_${dir}`;
  if (walkCycleDone.has(marker)) return;
  const key0 = `char_${breedId}_${dir}_0`;
  if (!scene.textures.exists(key0)) return;
  walkCycleDone.add(marker);

  const src = scene.textures.get(key0).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
  const w = src.width;
  const h = src.height;
  const legTop = Math.min(h - 2, Math.round(h * LEG_TOP_FRAC));
  const regionH = h - legTop;
  if (regionH < 4) return;
  const mid = Math.round(w / 2);
  const liftPx = Math.max(2, Math.min(10, Math.round(regionH * 0.4)));

  const liftLeft = buildLegLiftCanvas(src, w, h, legTop, mid, "left", liftPx);
  const liftRight = buildLegLiftCanvas(src, w, h, legTop, mid, "right", liftPx);

  const key1 = `char_${breedId}_${dir}_1`;
  if (scene.textures.exists(key1)) scene.textures.remove(key1);
  scene.textures.addCanvas(key1, liftLeft);

  const key2 = `char_${breedId}_${dir}_2`;
  if (scene.textures.exists(key2)) scene.textures.remove(key2);
  scene.textures.addCanvas(key2, liftRight);
}

/** Real photo-style art loaded in BootScene.preload(); fills in a mirrored "left" if the source lacked one. */
function registerImageBreed(scene: Phaser.Scene, breedId: string): void {
  const frames = IMAGE_BREEDS[breedId];
  if (frames.left.length === 0) {
    frames.right.forEach((_url, i) => {
      mirrorTexture(scene, `char_${breedId}_right_${i}`, `char_${breedId}_left_${i}`);
    });
  }
  for (const dir of DIRS) {
    synthesizeWalkCycle(scene, breedId, dir);
  }
}

function regProceduralFrames(scene: Phaser.Scene, prefix: string, frames: { down: Grid[]; up: Grid[]; side: Grid[] }): void {
  frames.down.forEach((g, i) => registerGrid(scene, `${prefix}_down_${i}`, g));
  frames.up.forEach((g, i) => registerGrid(scene, `${prefix}_up_${i}`, g));
  frames.side.forEach((g, i) => registerGrid(scene, `${prefix}_right_${i}`, g));
  frames.side.forEach((g, i) => registerGrid(scene, `${prefix}_left_${i}`, flipGridX(g)));
}

export function registerCharacters(scene: Phaser.Scene): void {
  for (const breed of BREEDS) {
    if (hasImageArt(breed.id)) {
      registerImageBreed(scene, breed.id);
    } else {
      regProceduralFrames(scene, `char_${breed.id}`, buildCharacter(breed));
    }
  }

  for (const npc of NPCS) {
    // NPCs whose breed has real art just reuse the player's breed textures
    // (char_<breedId>_*) directly — see spritePrefixFor() below. Accessory
    // overlays (bandana/apron/vest) currently only work on procedural
    // (canvas-drawn) breeds, so image-art NPCs render without their prop.
    if (hasImageArt(npc.breedId)) continue;

    const frames = buildCharacter(getBreed(npc.breedId));
    if (npc.npc_id === "NPC_DOG_MARO") {
      frames.down = frames.down.map((g) => addBandana(g, "#d9534f"));
      frames.side = frames.side.map((g) => addBandana(g, "#d9534f"));
      frames.up = frames.up.map((g) => addBandana(g, "#d9534f"));
    } else if (npc.npc_id === "NPC_CAT_SASHA") {
      frames.down = frames.down.map((g) => addApron(g, "#a8d8e8"));
      frames.side = frames.side.map((g) => addApron(g, "#a8d8e8"));
    } else if (npc.npc_id === "NPC_HAM_BOLBOL") {
      frames.down = frames.down.map((g) => addVest(g, "#8a6644"));
      frames.side = frames.side.map((g) => addVest(g, "#8a6644"));
    }
    regProceduralFrames(scene, `npc_${npc.npc_id}`, frames);
  }
}

/** The texture-key prefix to use for a given NPC (some alias straight to their breed's player textures). */
export function spritePrefixFor(npcId: string, breedId: string): string {
  return hasImageArt(breedId) ? `char_${breedId}` : `npc_${npcId}`;
}

function frameCount(scene: Phaser.Scene, prefix: string, dir: Dir): number {
  let n = 0;
  while (scene.textures.exists(`${prefix}_${dir}_${n}`)) n++;
  return n;
}

export function createAnimations(scene: Phaser.Scene): void {
  const actors = [
    ...BREEDS.map((b) => `char_${b.id}`),
    ...NPCS.filter((n) => !hasImageArt(n.breedId)).map((n) => `npc_${n.npc_id}`),
  ];
  for (const actor of actors) {
    for (const dir of DIRS) {
      const key = `${actor}_walk_${dir}`;
      if (scene.anims.exists(key)) continue;
      const n = frameCount(scene, actor, dir);
      if (n === 0) continue;
      scene.anims.create({
        key,
        frames: Array.from({ length: n }, (_, i) => ({ key: `${actor}_${dir}_${i}` })),
        frameRate: n > 2 ? 8 : 4,
        repeat: -1,
      });
    }
  }
}

export function registerAllArt(scene: Phaser.Scene): void {
  registerIcons(scene);
  registerCharacters(scene);
  createAnimations(scene);
}

/**
 * Scale factor that makes a texture display at `targetWidth` world/screen
 * pixels, regardless of the texture's own native resolution — procedural
 * breeds are drawn at 64x64, extracted photo breeds are ~130px wide, and
 * future breeds may differ again.
 */
export function fitScale(scene: Phaser.Scene, textureKey: string, targetWidth: number): number {
  const src = scene.textures.get(textureKey).getSourceImage();
  return targetWidth / src.width;
}

/**
 * Like fitScale, but sized off the texture's height instead of its width.
 * A standing character's on-screen HEIGHT should stay constant across
 * facing directions even though a side-view pose's bounding box is much
 * wider than a front/back pose's — scaling by width instead would make the
 * same breed look taller or shorter depending which way it's walking.
 */
export function fitScaleByHeight(scene: Phaser.Scene, textureKey: string, targetHeight: number): number {
  const src = scene.textures.get(textureKey).getSourceImage();
  return targetHeight / src.height;
}

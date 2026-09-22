import { flipGridX, gridToCanvas, registerGrid, type Grid } from "./pixelart";
import { buildTileGrids, TILE_KEYS, type TileKey } from "./tiles";
import { buildIconGrids } from "./icons";
import { addApron, addBandana, addVest, buildCharacter } from "./characters";
import { BREEDS, getBreed } from "../data/breeds";
import { NPCS } from "../data/npcs";
import { hasImageArt, IMAGE_BREEDS } from "./spriteAssets";
import { registerProps } from "./props";

export const TILESET_KEY = "tileset";
const DIRS = ["down", "up", "left", "right"] as const;
type Dir = (typeof DIRS)[number];

export function tileIndex(key: TileKey): number {
  return TILE_KEYS.indexOf(key);
}

export function registerTileset(scene: Phaser.Scene): void {
  const grids = buildTileGrids();
  const canvas = document.createElement("canvas");
  canvas.width = 16 * TILE_KEYS.length;
  canvas.height = 16;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  TILE_KEYS.forEach((key, i) => {
    const tileCanvas = gridToCanvas(grids[key]);
    ctx.drawImage(tileCanvas, i * 16, 0);
  });
  if (scene.textures.exists(TILESET_KEY)) scene.textures.remove(TILESET_KEY);
  const texture = scene.textures.addCanvas(TILESET_KEY, canvas)!;
  TILE_KEYS.forEach((_key, i) => {
    texture.add(i, 0, i * 16, 0, 16, 16);
  });
}

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

/** Real photo-style art loaded in BootScene.preload(); fills in a mirrored "left" if the source lacked one. */
function registerImageBreed(scene: Phaser.Scene, breedId: string): void {
  const frames = IMAGE_BREEDS[breedId];
  if (frames.left.length === 0) {
    frames.right.forEach((_url, i) => {
      mirrorTexture(scene, `char_${breedId}_right_${i}`, `char_${breedId}_left_${i}`);
    });
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
  registerTileset(scene);
  registerIcons(scene);
  registerCharacters(scene);
  createAnimations(scene);
  registerProps(scene);
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

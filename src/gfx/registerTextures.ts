import { gridToCanvas, registerGrid, type Grid } from "./pixelart";
import { buildTileGrids, TILE_KEYS, type TileKey } from "./tiles";
import { buildIconGrids } from "./icons";
import { addApron, addBandana, addVest, buildCharacter } from "./characters";
import { BREEDS, getBreed } from "../data/breeds";
import { NPCS } from "../data/npcs";

export const TILESET_KEY = "tileset";

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

function regFrames(scene: Phaser.Scene, prefix: string, frames: { down: Grid[]; up: Grid[]; side: Grid[] }): void {
  frames.down.forEach((g, i) => registerGrid(scene, `${prefix}_down_${i}`, g));
  frames.up.forEach((g, i) => registerGrid(scene, `${prefix}_up_${i}`, g));
  frames.side.forEach((g, i) => registerGrid(scene, `${prefix}_side_${i}`, g));
}

export function registerCharacters(scene: Phaser.Scene): void {
  for (const breed of BREEDS) {
    const frames = buildCharacter(breed);
    regFrames(scene, `char_${breed.id}`, frames);
  }

  for (const npc of NPCS) {
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
    regFrames(scene, `npc_${npc.npc_id}`, frames);
  }
}

export function createAnimations(scene: Phaser.Scene): void {
  const dirs: Array<"down" | "up" | "side"> = ["down", "up", "side"];
  const actors = [...BREEDS.map((b) => `char_${b.id}`), ...NPCS.map((n) => `npc_${n.npc_id}`)];
  for (const actor of actors) {
    for (const dir of dirs) {
      const key = `${actor}_walk_${dir}`;
      if (scene.anims.exists(key)) continue;
      scene.anims.create({
        key,
        frames: [{ key: `${actor}_${dir}_0` }, { key: `${actor}_${dir}_1` }],
        frameRate: 4,
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
}

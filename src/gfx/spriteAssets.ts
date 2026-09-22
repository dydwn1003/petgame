// Real extracted sprite images (from the user's reference sheets), keyed by
// breed id. Populated via Vite's import.meta.glob so adding new files under
// src/assets/<species>/<breed>/<direction>_<frame>.png is picked up
// automatically with no code changes.

export type Facing4 = "down" | "up" | "left" | "right";

export interface ImageBreedFrames {
  down: string[];
  up: string[];
  left: string[]; // may be empty — mirror `right` at boot time when so
  right: string[];
}

const modules = import.meta.glob<string>("../assets/**/*.png", { eager: true, import: "default" });

export const IMAGE_BREEDS: Record<string, ImageBreedFrames> = {};

const FILE_RE = /\/([^/]+)\/([a-z]+)_(\d+)\.png$/;

for (const [path, url] of Object.entries(modules)) {
  const m = path.match(FILE_RE);
  if (!m) continue;
  const [, breedId, dir, idxStr] = m;
  if (dir !== "down" && dir !== "up" && dir !== "left" && dir !== "right") continue;
  const idx = parseInt(idxStr, 10);
  if (!IMAGE_BREEDS[breedId]) {
    IMAGE_BREEDS[breedId] = { down: [], up: [], left: [], right: [] };
  }
  IMAGE_BREEDS[breedId][dir as Facing4][idx] = url;
}

export function hasImageArt(breedId: string): boolean {
  return breedId in IMAGE_BREEDS;
}

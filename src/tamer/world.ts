// 오픈월드 지도 만들기
import { ARCHMAGE, MASTERS, type RegionId } from "./data";
import { SOLID, T } from "./sprites";

export const MAP_W = 80;
export const MAP_H = 60;
export const TILE = 16;

export const FOUNTAIN = { x: 40, y: 46 };
export const PROF_POS = { x: 37, y: 47 };
export const START_POS = { x: 40, y: 49 };

export function regionAt(tx: number, ty: number): RegionId {
  if (tx >= 33 && tx <= 47 && ty <= 10) return "arena";
  if (tx >= 31 && tx <= 49 && ty >= 39 && ty <= 54) return "town";
  if (tx < 30 && ty < 32) return "forest";
  if (tx >= 52 && ty < 22) return "plains";
  if (tx >= 50 && ty >= 22) return "lake";
  if (tx < 30 && ty >= 32) return "rocky";
  return "meadow";
}

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export interface World {
  tiles: Uint8Array;
  variant: Uint8Array;
}

export function buildWorld(): World {
  const r = rng(20261113);
  const tiles = new Uint8Array(MAP_W * MAP_H).fill(T.GRASS);
  const variant = new Uint8Array(MAP_W * MAP_H);
  const set = (x: number, y: number, t: number) => {
    if (x >= 0 && y >= 0 && x < MAP_W && y < MAP_H) tiles[y * MAP_W + x] = t;
  };
  const get = (x: number, y: number) => tiles[y * MAP_W + x];

  // 지역별 바닥
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      variant[y * MAP_W + x] = Math.floor(r() * 4);
      const reg = regionAt(x, y);
      if (reg === "forest") set(x, y, r() < 0.33 ? T.TREE : T.FOREST);
      else if (reg === "rocky") set(x, y, r() < 0.1 ? T.ROCK : T.DIRT);
      else if (reg === "plains") set(x, y, r() < 0.08 ? T.FLOWER : T.GRASS);
      else if (reg === "meadow" || reg === "town") set(x, y, r() < 0.04 ? T.FLOWER : T.GRASS);
      else if (reg === "arena") set(x, y, T.STONE);
    }
  }

  // 호수
  const lx = 64;
  const ly = 38;
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      if (regionAt(x, y) !== "lake") continue;
      const d = ((x - lx) / 10) ** 2 + ((y - ly) / 8) ** 2;
      if (d < 1) set(x, y, T.WATER);
      else if (d < 1.6) set(x, y, T.SAND);
      else set(x, y, r() < 0.05 ? T.FLOWER : T.GRASS);
    }
  }

  // 풀숲 덩어리
  const patches: Array<[RegionId, number]> = [["meadow", 16], ["forest", 14], ["lake", 10], ["rocky", 12], ["plains", 16]];
  for (const [reg, count] of patches) {
    let placed = 0;
    for (let tries = 0; placed < count && tries < 2000; tries++) {
      const cx = Math.floor(r() * MAP_W);
      const cy = Math.floor(r() * MAP_H);
      if (regionAt(cx, cy) !== reg) continue;
      const rad = 2 + Math.floor(r() * 2);
      for (let y = cy - rad; y <= cy + rad; y++) {
        for (let x = cx - rad; x <= cx + rad; x++) {
          if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) continue;
          if (regionAt(x, y) !== reg) continue;
          if ((x - cx) ** 2 + (y - cy) ** 2 > rad * rad + 1) continue;
          if (get(x, y) === T.WATER) continue;
          set(x, y, T.TALL);
        }
      }
      placed++;
    }
  }

  // 길 (2칸 폭)
  const hline = (y: number, x0: number, x1: number) => {
    for (let x = x0; x <= x1; x++) for (const dy of [0, 1]) if (get(x, y + dy) !== T.WATER) set(x, y + dy, T.PATH);
  };
  const vline = (x: number, y0: number, y1: number) => {
    for (let y = y0; y <= y1; y++) for (const dx of [0, 1]) if (get(x + dx, y) !== T.WATER) set(x + dx, y, T.PATH);
  };
  vline(39, 8, 52);
  hline(24, 5, 75);
  hline(50, 6, 72);
  vline(12, 6, 54);
  vline(62, 5, 24);
  hline(14, 12, 39);

  // 마을
  for (let y = 40; y <= 53; y++) for (let x = 32; x <= 48; x++) if (get(x, y) === T.TALL) set(x, y, T.GRASS);
  const house = (x0: number, y0: number) => {
    for (let x = x0; x < x0 + 5; x++) {
      set(x, y0, T.ROOF);
      set(x, y0 + 1, T.ROOF);
      set(x, y0 + 2, x === x0 + 2 ? T.DOOR : T.WALL);
    }
  };
  house(33, 41);
  house(43, 41);
  house(33, 51);
  house(43, 51);
  set(FOUNTAIN.x, FOUNTAIN.y, T.FOUNTAIN);
  for (let y = 44; y <= 48; y++) for (let x = 37; x <= 43; x++) if (get(x, y) !== T.FOUNTAIN) set(x, y, T.PATH);

  // 투기장
  for (let y = 2; y <= 10; y++) for (let x = 34; x <= 46; x++) set(x, y, T.STONE);
  for (const [x, y] of [[34, 3], [46, 3], [34, 9], [46, 9], [36, 2], [44, 2]]) set(x, y, T.PILLAR);

  // 테두리 숲
  for (let y = 0; y < MAP_H; y++) {
    for (let x = 0; x < MAP_W; x++) {
      if (x < 2 || y < 2 || x >= MAP_W - 2 || y >= MAP_H - 2) set(x, y, T.TREE);
    }
  }
  // 투기장 입구가 테두리에 막히지 않게
  for (let y = 2; y <= 10; y++) for (let x = 34; x <= 46; x++) if (get(x, y) === T.TREE) set(x, y, T.STONE);

  // 마스터 자리는 비워 두고 가까운 길과 이어 준다
  for (const m of [...MASTERS, ARCHMAGE]) {
    const floor = regionAt(m.pos.x, m.pos.y) === "forest" ? T.FOREST : regionAt(m.pos.x, m.pos.y) === "rocky" ? T.DIRT : regionAt(m.pos.x, m.pos.y) === "arena" ? T.STONE : T.GRASS;
    for (let y = m.pos.y - 2; y <= m.pos.y + 2; y++) for (let x = m.pos.x - 2; x <= m.pos.x + 2; x++) if (get(x, y) !== T.PATH && get(x,y) !== T.SAND && x > 1 && y > 1 && x < MAP_W - 2 && y < MAP_H - 2) set(x, y, floor);
  }
  // 숲 마스터 → x=12 길
  for (let x = 8; x <= 12; x++) set(x, 8, T.PATH), set(x, 9, T.PATH);
  // 바위 마스터 → y=50 길
  for (let y = 50; y <= 52; y++) set(8, y, T.PATH), set(9, y, T.PATH);
  // 번개 마스터 → x=62 길
  for (let x = 62; x <= 72; x++) set(x, 7, T.PATH), set(x, 8, T.PATH);
  // 호수 마스터 → y=50 길
  for (let y = 44; y <= 50; y++) set(72, y, get(72, y) === T.WATER ? T.WATER : T.PATH);

  return { tiles, variant };
}

export function isSolid(w: World, tx: number, ty: number): boolean {
  if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return true;
  return SOLID.has(w.tiles[ty * MAP_W + tx]);
}

export function tileAt(w: World, tx: number, ty: number): number {
  if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return T.TREE;
  return w.tiles[ty * MAP_W + tx];
}

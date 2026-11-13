// 미로 생성과 길찾기(BFS) — 타일 기반: 1 = 벽, 0 = 바닥

export const WALL = 1;

export interface Maze {
  w: number;
  h: number;
  tiles: Uint8Array;
}

export const DIRS: ReadonlyArray<readonly [number, number]> = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** 셀 cw×ch 짜리 미로를 (2cw+1)×(2ch+1) 타일로 만든다. loopChance 만큼 벽을 더 뚫어 순환 경로를 만든다. */
export function generateMaze(cw: number, ch: number, loopChance: number, rng = Math.random): Maze {
  const w = cw * 2 + 1;
  const h = ch * 2 + 1;
  const tiles = new Uint8Array(w * h).fill(WALL);
  const visited = new Uint8Array(cw * ch);
  const stack: Array<[number, number]> = [[0, 0]];
  visited[0] = 1;
  tiles[1 * w + 1] = 0;

  while (stack.length) {
    const [cx, cy] = stack[stack.length - 1];
    const options: Array<[number, number, number, number]> = [];
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx >= 0 && ny >= 0 && nx < cw && ny < ch && !visited[ny * cw + nx]) options.push([nx, ny, dx, dy]);
    }
    if (!options.length) {
      stack.pop();
      continue;
    }
    const [nx, ny, dx, dy] = options[Math.floor(rng() * options.length)];
    visited[ny * cw + nx] = 1;
    tiles[(2 * cy + 1 + dy) * w + (2 * cx + 1 + dx)] = 0;
    tiles[(2 * ny + 1) * w + (2 * nx + 1)] = 0;
    stack.push([nx, ny]);
  }

  // 순환 경로: 셀 사이에 있는 벽만 골라서 일부 제거
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const between = (x % 2 === 0 && y % 2 === 1) || (x % 2 === 1 && y % 2 === 0);
      if (between && tiles[y * w + x] === WALL && rng() < loopChance) tiles[y * w + x] = 0;
    }
  }
  return { w, h, tiles };
}

export function isWall(m: Maze, x: number, y: number): boolean {
  if (x < 0 || y < 0 || x >= m.w || y >= m.h) return true;
  return m.tiles[y * m.w + x] === WALL;
}

/** 바닥 타일 기준 BFS 거리. 닿지 않거나 maxDist 보다 멀면 -1. */
export function bfs(m: Maze, sx: number, sy: number, maxDist = Infinity): Int16Array {
  const dist = new Int16Array(m.w * m.h).fill(-1);
  if (isWall(m, sx, sy)) return dist;
  const queue = new Int32Array(m.w * m.h);
  let head = 0;
  let tail = 0;
  const start = sy * m.w + sx;
  dist[start] = 0;
  queue[tail++] = start;
  while (head < tail) {
    const i = queue[head++];
    const d = dist[i];
    if (d >= maxDist) continue;
    const x = i % m.w;
    const y = (i - x) / m.w;
    for (const [dx, dy] of DIRS) {
      const nx = x + dx;
      const ny = y + dy;
      if (isWall(m, nx, ny)) continue;
      const n = ny * m.w + nx;
      if (dist[n] !== -1) continue;
      dist[n] = d + 1;
      queue[tail++] = n;
    }
  }
  return dist;
}

// 게임 본체: 장면 · 배우 · 조사 지점 · 스토리 연출
import {
  ADVANCE,
  FONT,
  GROUND,
  pressed,
  H,
  W,
  axis,
  bubble,
  chapterCard,
  clock,
  dropScripts,
  fadeTo,
  flash,
  fx,
  g,
  mouse,
  render,
  running,
  sfx,
  shake,
  sneaking,
  text,
  took,
  until,
  wait,
  wrap,
} from "./core";
import {
  ALLEY,
  CENTER,
  CHURCH,
  FRIDGE_SPOTS,
  HELIPAD,
  LAB,
  PIER,
  ROOFS,
  ROOM,
  SUBWAY,
  buildAlley,
  buildCenter,
  buildChurch,
  buildFridge,
  buildHelipad,
  buildLab,
  buildPier,
  buildRoofs,
  buildRoom,
  buildStreet,
  buildSubway,
  STREET_SHIFT,
  type StreetInfo,
} from "./bg";
import {
  BUILD_25,
  BUILD_3,
  BUILD_KID,
  BOSS,
  GARCIA,
  MINJI,
  MRLEE,
  TONY,
  STRANGERS,
  CHARLIE,
  HAZMAT,
  LILY,
  RUTH,
  TOMAS,
  ADDICT,
  FROG_KING,
  FROGMAN,
  HUMAN_ORIGIN,
  HUMAN_W,
  catHead,
  lightTip,
  tintCat,
  SKELETON,
  cat,
  human,
  type Build,
  type CatPose,
  type Look,
  type Pose,
} from "./sprites";
import { PIX, makeCanvas, mix } from "./pixel";
import { catsRiseShots, farewellShots, introShots, memoryShots, type Shot } from "./movies";

// ── 타입 ─────────────────────────────────────────────────
type Kind = "charlie" | "sam" | "person";

export interface Actor {
  kind: Kind;
  look?: Look;
  lookId?: string;
  x: number;
  y: number;
  facing: 1 | -1;
  pose: string | null; // null = 움직임에 따라 자동
  walkDist: number;
  moving: boolean;
  visible: boolean;
  silhouette?: boolean;
  bubble: string | null;
  role?: "zombie" | "skeleton" | "frog" | "agent";
  /** 체형 (기본 3등신, 아이는 작게) */
  build?: Build;
  state?: string;
  home?: number;
  sign?: string;
  hop?: number;
  /** 연출 중 반복 재생할 동작 (예: 계단 오르기) */
  anim?: { prefix: string; frames: number; fps: number } | null;
  /** 엄폐물 뒤에 웅크려 숨은 모습으로 그린다 */
  hideLook?: boolean;
  /** 손전등을 들고 다니는 인물 (요원 등) */
  torch?: boolean;
  /** 이 인물을 그릴 때 잘라 낼 영역 (계단·문 안으로 사라질 때) */
  clip?: { x0: number; y0: number; x1: number; y1: number } | null;
  /** 마지막으로 그린 자세 (손전등 빛 위치 계산용) */
  lastPose?: string;
  /** 머리 위 감정 아이콘 */
  emote?: { kind: Emote; t0: number } | null;
}
type Emote = "!" | "?" | "♥" | "…" | "💢" | "💧" | "♪";

interface Hotspot {
  x: number;
  iconY: number;
  label: string;
  range?: number;
  enabled: () => boolean;
  use: () => Promise<void>;
}

interface Zone {
  x: number;
  dir: 1 | -1;
  when?: () => boolean;
  run: () => Promise<void>;
  fired?: boolean;
  repeat?: boolean;
}

interface Light {
  x: number;
  y: number;
  r: number;
  a: number;
  warm?: string;
  cone?: { dir: 1 | -1; len: number; spread: number };
}

interface Scene {
  id: string;
  width: number;
  bg: HTMLCanvasElement;
  ambient: number;
  tint?: string;
  lights: () => Light[];
  minX: number;
  maxX: number;
  actors: Actor[];
  hotspots: Hotspot[];
  zones: Zone[];
  update?: (dt: number) => void;
  back?: (camX: number) => void;
  front?: (camX: number) => void;
  start: () => Promise<void>;
  noPlayer?: boolean;
  useLight?: boolean;
  overlay?: (camX: number) => void;
  /** 화면 왼쪽 위에 보여 줄 장소 이름 (미로 방) */
  label?: string;
}

// ── 상태 ─────────────────────────────────────────────────
const SAVE_KEY = "charlie_cat_save_v1";

export const S = {
  mode: "title" as "title" | "play" | "gameover",
  scene: null as Scene | null,
  control: false,
  hidden: false,
  build: BUILD_3 as Build,
  flags: {} as Record<string, number>,
  camX: 0,
  gen: 0,
  loading: false,
  talk: null as null | { actor: Actor | null; text: string; typed: number; caption: boolean },
  over: null as null | { title: string; msg: string; checkpoint: number; scene: string },
  help: 0,
  titleSel: 0,
  titleSub: false,
  backpack: false,
  fridgeSel: 0,
  choice: null as null | { options: string[]; sel: number; picked: number },
  movie: null as null | { shots: Shot[]; i: number; t: number },
  pad: null as null | { title: string; code: string; input: string; result: boolean | null; sel: number; shake: number },
  simon: null as null | { title: string; seq: number[]; labels: string[]; phase: "show" | "input"; t: number; idx: number; result: boolean | null; lit: number; litT: number },
  album: 0,
  /** 연출용 카메라: 초점 x, 확대 */
  cam: { focus: null as number | null, zoom: 1, zoomTarget: 1 },
  bars: 0,
  /** 문 여닫기 연출 */
  door: null as null | { x: number; kind: "in" | "down" | "up"; open: number; target: number; w: number; top: number; col: string; panel: boolean; fade: number },
  /** 찰리의 수첩 열림 */
  diary: false,
  /** 손전등을 켜고 끈 시각 (드는/내리는 동작용) */
  lightT: -9,
};

/** 지금 찰리가 손전등을 켜 들고 있는가 */
function lightOn(): boolean {
  const sc = S.scene;
  return !!sc?.useLight && !!S.flags.supplies && S.flags.light !== 0;
}
/** 다른 인물이 든 손전등의 빛 (손끝에서 나간다) */
function actorCone(a: Actor, len: number, spread = 0.28): Light {
  const tip = (a.lastPose && lightTip(a.lastPose, a.build ?? BUILD_3)) || lightTip("flashlight", BUILD_3) || [5, -8.5];
  return { x: a.x + a.facing * tip[0], y: a.y + tip[1], r: 0, a: 0.95, cone: { dir: a.facing, len, spread } };
}
/** 손에 든 손전등 끝에서 뻗어 나가는 빛 */
function flashCone(len = 160, spread = 0.3): Light | null {
  if (!lightOn() || S.hidden || !charlie.visible) return null;
  const tip = (charlie.lastPose && lightTip(charlie.lastPose, S.build)) || lightTip("flashlight", S.build) || [5, -8.5];
  return { x: charlie.x + charlie.facing * tip[0], y: charlie.y + tip[1], r: 0, a: 0.95, cone: { dir: charlie.facing, len, spread } };
}

// ── 연출 도구 ────────────────────────────────────────────
/** 머리 위에 감정 아이콘을 띄운다 */
function emote(a: Actor, kind: Emote): void {
  a.emote = { kind, t0: clock.t };
  if (kind === "!") sfx.blip();
}
/** 카메라를 x 에 맞추고 확대한다 (조작이 돌아오면 자동으로 풀린다) */
function focusCam(x: number | null, zoom = 1): void {
  S.cam.focus = x;
  S.cam.zoomTarget = zoom;
}
/** 애니메이션 컷을 끝까지 재생한다 (Space 로 넘기기) */
function playMovie(shots: Shot[]): Promise<void> {
  S.movie = { shots, i: 0, t: 0 };
  return until(() => S.movie === null);
}
const ZOOM_Y = 0.66;
/** 확대 중인 월드 좌표 → 화면 좌표 */
function toScreen(x: number, y: number): [number, number] {
  const z = S.cam.zoom;
  return [W / 2 + (x - W / 2) * z, H * ZOOM_Y + (y - H * ZOOM_Y) * z];
}

function mkActor(kind: Kind, x: number, facing: 1 | -1 = 1, extra: Partial<Actor> = {}): Actor {
  return { kind, x, y: GROUND, facing, pose: null, walkDist: 0, moving: false, visible: true, bubble: null, ...extra };
}

let charlie = mkActor("charlie", 0);
let sam = mkActor("sam", 0);

// ── 저장 ─────────────────────────────────────────────────
interface Save {
  scene: string;
  checkpoint: number;
  flags: Record<string, number>;
  tall: boolean;
}
export function loadSave(): Save | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? (JSON.parse(raw) as Save) : null;
  } catch {
    return null;
  }
}
function writeSave(scene: string, checkpoint: number): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ scene, checkpoint, flags: S.flags, tall: S.build === BUILD_3 }));
  } catch {
    /* 무시 */
  }
}

// ── 대사 ─────────────────────────────────────────────────
export function say(actor: Actor | null, str: string): Promise<void> {
  S.talk = { actor, text: str, typed: 0, caption: false };
  return until(() => S.talk === null);
}
export function caption(str: string): Promise<void> {
  S.talk = { actor: null, text: str, typed: 0, caption: true };
  return until(() => S.talk === null);
}
function advanceTalk(): void {
  const t = S.talk;
  if (!t) return;
  if (t.typed < t.text.length) {
    t.typed = t.text.length;
    return;
  }
  sfx.blip();
  S.talk = null;
}

// ── 이동 연출 ────────────────────────────────────────────
function walkTo(a: Actor, x: number, speed = 50): Promise<void> {
  return new Promise((resolve) => {
    a.pose = null;
    walkers.push({ a, x, speed, resolve });
  });
}
const walkers: Array<{ a: Actor; x: number; speed: number; resolve: () => void }> = [];

function tween(a: Actor, x: number, y: number, dur: number, arc = 0): Promise<void> {
  return new Promise((resolve) => tweens.push({ a, x0: a.x, y0: a.y, x, y, t: 0, dur, arc, resolve }));
}
const tweens: Array<{ a: Actor; x0: number; y0: number; x: number; y: number; t: number; dur: number; arc: number; resolve: () => void }> = [];

function stepMovers(dt: number): void {
  for (const w of [...walkers]) {
    const d = w.x - w.a.x;
    const step = Math.sign(d) * Math.min(Math.abs(d), w.speed * dt);
    w.a.x += step;
    w.a.walkDist += Math.abs(step);
    w.a.moving = Math.abs(d) > 0.5;
    if (Math.abs(d) > 0.5) w.a.facing = d > 0 ? 1 : -1;
    else {
      w.a.moving = false;
      walkers.splice(walkers.indexOf(w), 1);
      w.resolve();
    }
  }
  for (const t of [...tweens]) {
    t.t += dt;
    const k = Math.min(1, t.t / t.dur);
    t.a.x = t.x0 + (t.x - t.x0) * k;
    t.a.y = t.y0 + (t.y - t.y0) * k - Math.sin(k * Math.PI) * t.arc;
    if (k >= 1) {
      tweens.splice(tweens.indexOf(t), 1);
      t.resolve();
    }
  }
}

// ── 장면 전환 ────────────────────────────────────────────
const SCENES: Record<string, (checkpoint: number) => Scene> = {};

export async function goScene(id: string, checkpoint = 0, fade = true): Promise<void> {
  S.gen++;
  const myGen = S.gen;
  S.control = false;
  if (fade && fx.fade < 1) await fadeTo(1, 0.6);
  if (myGen !== S.gen) return;
  // 한 프레임 동안 "로딩 중" 을 띄운 다음 장면을 만든다
  S.loading = true;
  await wait(0);
  if (myGen !== S.gen) return;
  dropScripts();
  walkers.length = 0;
  tweens.length = 0;
  S.talk = null;
  S.hidden = false;
  S.over = null;
  S.movie = null;
  S.door = null;
  S.cam.focus = null;
  S.cam.zoom = S.cam.zoomTarget = 1;
  S.mode = "play";
  fx.card = null;
  charlie = mkActor("charlie", 0);
  sam = mkActor("sam", 0, 1, { visible: false });
  S.backpack = id === "street1" || (id === "room" && !S.flags.bagDown);
  const sc = SCENES[id](checkpoint);
  S.loading = false;
  S.scene = sc;
  S.camX = 0;
  void sc.start();
}

/** 조작을 잠시 막고 연출을 돌린 뒤 돌려준다 */
async function cutscene(fn: () => Promise<void>): Promise<void> {
  const myGen = S.gen;
  S.control = false;
  await fn();
  if (myGen === S.gen && S.mode === "play") S.control = true;
}

function gameOver(title: string, msg: string, checkpoint: number): void {
  if (S.mode !== "play") return;
  S.control = false;
  S.mode = "gameover";
  sfx.dead();
  S.over = { title, msg, checkpoint, scene: S.scene?.id ?? "chapter1" };
}

// ── 공통 소품 ────────────────────────────────────────────
const lampLights = (info: StreetInfo, broken: boolean) =>
  info.lamps.map((x, i): Light => ({ x: x + 1, y: 124, r: broken && i % 2 ? 0 : 78, a: 0.85, warm: "rgba(255,210,140,0.10)", cone: undefined }));

/** 혀 모양 불길 여러 겹 (바깥 빨강 → 주황 → 노란 속불), 바닥 by 기준 */
function flameTongues(x0: number, by: number, w: number, h: number, n: number, seed: number): void {
  const prev = g.globalCompositeOperation;
  g.globalCompositeOperation = "lighter";
  for (let i = 0; i < n; i++) {
    const fx = x0 + ((i + 0.5) / n) * w;
    const fl = 0.7 + 0.3 * Math.sin(clock.t * 9 + i * 1.7 + seed) * Math.sin(clock.t * 5.3 + i + seed * 0.3);
    const hh0 = h * (0.65 + 0.45 * fl) * (i % 2 ? 0.8 : 1);
    const sway = Math.sin(clock.t * 6 + i + seed) * w * 0.06;
    const ww0 = (w / n) * 0.75;
    for (const [hk, wk, c0, c1] of [
      [1, 1, "rgba(255,70,20,0.8)", "rgba(255,120,30,0)"],
      [0.7, 0.62, "rgba(255,170,50,0.85)", "rgba(255,200,80,0)"],
      [0.4, 0.34, "rgba(255,245,190,0.9)", "rgba(255,240,170,0)"],
    ] as Array<[number, number, string, string]>) {
      const hh = hh0 * hk;
      const ww = ww0 * wk;
      const gr = g.createLinearGradient(0, by, 0, by - hh);
      gr.addColorStop(0, c0);
      gr.addColorStop(1, c1);
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(fx - ww, by);
      g.bezierCurveTo(fx - ww, by - hh * 0.45, fx + sway - ww * 0.4, by - hh * 0.7, fx + sway, by - hh);
      g.bezierCurveTo(fx + sway + ww * 0.4, by - hh * 0.7, fx + ww, by - hh * 0.45, fx + ww, by);
      g.closePath();
      g.fill();
    }
  }
  g.globalCompositeOperation = prev;
}

/** 부드러운 검은 연기 뭉치 (아래는 불빛에 물든다) */
function smokePuffs(x: number, y: number, n: number, rise: number, size: number, seed: number, alpha = 0.85): void {
  for (let i = 0; i < n; i++) {
    const p = (clock.t * 0.12 + i / n + seed * 0.13) % 1;
    const sx = x + p * size * 1.6 + Math.sin(p * 5 + i + seed) * size * 0.3;
    const sy = y - p * rise;
    const r = size * (0.45 + p * 1.2);
    const a = alpha * Math.pow(1 - p, 0.5);
    const lit = Math.max(0, 1 - p * 3);
    const sg = g.createRadialGradient(sx, sy, 0, sx, sy, r);
    sg.addColorStop(0, `rgba(${Math.round(14 + lit * 60)},${Math.round(11 + lit * 22)},${Math.round(13 + lit * 8)},${a.toFixed(2)})`);
    sg.addColorStop(0.65, `rgba(14,10,12,${(a * 0.7).toFixed(2)})`);
    sg.addColorStop(1, "rgba(14,10,12,0)");
    g.fillStyle = sg;
    g.beginPath();
    g.arc(sx, sy, r, 0, Math.PI * 2);
    g.fill();
  }
}

/** 불타는 창문 · 불타는 차: 창 안은 일렁이는 불, 창 위로 불길이 혀를 내밀고 연기가 피어오른다 */
function drawFires(fires: StreetInfo["fires"], camX: number): void {
  for (const f of fires) {
    const sx = f.x - camX;
    if (sx < -60 || sx > W + 60) continue;
    const seed = f.x * 0.37;
    const win = f.h >= 16;
    // 주변 불빛
    const glow = g.createRadialGradient(sx + f.w / 2, f.y + f.h * 0.6, 0, sx + f.w / 2, f.y + f.h * 0.6, f.w * 1.6);
    glow.addColorStop(0, `rgba(255,140,50,${(0.28 + 0.06 * Math.sin(clock.t * 11 + seed)).toFixed(2)})`);
    glow.addColorStop(1, "rgba(255,90,30,0)");
    g.fillStyle = glow;
    g.fillRect(sx - f.w * 1.2, f.y - f.w, f.w * 3.4, f.h + f.w * 2);
    if (win) {
      // 창 안: 붉게 달아오른 방 + 불길
      g.save();
      g.beginPath();
      g.rect(sx, f.y, f.w, f.h);
      g.clip();
      const room = g.createLinearGradient(0, f.y, 0, f.y + f.h);
      room.addColorStop(0, "#3a120c");
      room.addColorStop(0.5, "#a83a14");
      room.addColorStop(1, "#ff9a3a");
      g.fillStyle = room;
      g.fillRect(sx, f.y, f.w, f.h);
      flameTongues(sx - 1, f.y + f.h + 1, f.w + 2, f.h * 1.05, 4, seed);
      g.restore();
      // 창 위로 넘실대는 불길과 연기
      flameTongues(sx + 1, f.y + 2, f.w - 2, 9, 3, seed + 3);
      smokePuffs(sx + f.w / 2, f.y - 6, 6, 70, 8, seed, 0.9);
    } else {
      flameTongues(sx - 2, f.y + f.h, f.w + 4, f.h * 1.9, 4, seed);
      smokePuffs(sx + f.w / 2, f.y - 8, 5, 70, 7, seed, 0.8);
    }
  }
}

// ═════════════════════════════════════════════════════════
// 프롤로그 1: 퇴근길
// ═════════════════════════════════════════════════════════

/** 제자리 근처를 서성이는 행인: 가까이 지나가면 말풍선 */
interface Passerby {
  a: Actor;
  x0: number;
  range: number;
  speed: number;
  lines: string[];
  target: number;
  rest: number;
  talk: number;
  line: number;
}
function passerby(x: number, range: number, speed: number, look: Look, lookId: string, lines: string[], build: Build = BUILD_3): Passerby {
  const a = mkActor("person", x, -1, { look, lookId, build });
  return { a, x0: x, range, speed, lines, target: x, rest: Math.random() * 2, talk: 0, line: Math.floor(Math.random() * lines.length) };
}
function tickPassers(list: Passerby[], dt: number): void {
  for (const p of list) {
    const a = p.a;
    // 서성이기: 목표 지점까지 걷고, 잠깐 멈췄다가, 다른 지점으로
    if (p.rest > 0) {
      p.rest -= dt;
      a.moving = false;
      a.pose = "stand";
      if (p.rest <= 0) p.target = p.x0 + (Math.random() * 2 - 1) * p.range;
    } else {
      const d = p.target - a.x;
      if (Math.abs(d) < 1) {
        p.rest = 1 + Math.random() * 2.5;
        // 멈추면 가끔 찰리 쪽을 본다
        if (Math.abs(charlie.x - a.x) < 90) a.facing = charlie.x > a.x ? 1 : -1;
      } else {
        const step = Math.sign(d) * Math.min(Math.abs(d), p.speed * dt);
        a.x += step;
        a.walkDist += Math.abs(step) * 0.7;
        a.facing = d > 0 ? 1 : -1;
        a.moving = true;
        a.pose = null;
      }
    }
    // 찰리가 가까이 지나가면 한마디씩
    const near = Math.abs(charlie.x - a.x) < 70;
    p.talk -= dt;
    if (near && p.talk <= 0) {
      a.bubble = p.lines[p.line % p.lines.length];
      p.line++;
      p.talk = 3.2;
    } else if ((!near && p.talk < 1.5) || p.talk < 0.6) {
      a.bubble = null;
    }
  }
}
/** 평범한 행인 (재앙 전): 넋 나간 사람들과 같은 얼굴이지만 허리가 곧다 */
const NORMAL = STRANGERS.map((l) => ({ ...l, hunch: 0 }));

SCENES.street1 = () => {
  const info = buildStreet(1200, false, 11);
  const addict = passerby(930, 8, 6, ADDICT, "addict", ["...약... 약이 필요해...", "흐흐... 초록색... 예쁘다...", "머리가... 웅웅거려..."]);
  let backT = 0;
  let backCD = 0;
  let backLine = 0;
  let backBubble = 0;
  const BACK_LINES = ["너무 피곤해... 얼른 집에 가야겠어.", "집은 반대쪽이야... 3일 만의 침대가 기다린다고.", "다리가 천근만근이야. 돌아가자.", "회사 쪽으로는 다시 안 가. 절대."];
  const passers = [
    addict,
    passerby(640, 26, 14, NORMAL[0], "pro0", ["오늘 밤 운석우래요! 꼭 하늘 보세요!", "망원경 싸게 팝니다~ 운석 구경하세요!", "저기요, 전단지 하나만 받아 가세요!"]),
    passerby(790, 34, 12, NORMAL[1], "pro1", ["응, 엄마. 뉴스 봤어? 운석 온대.", "아니, 별일 없을 거야... 아마도.", "근데 오늘 동네 고양이들이 이상하게 울더라."]),
    passerby(420, 20, 10, NORMAL[2], "pro2", ["배달이 왜 이렇게 안 와...", "어휴, 야근 또 했어요? 얼굴이 말이 아니네.", "요즘 길에 멍하니 서 있는 사람이 많아요."]),
  ];
  const sc: Scene = {
    id: "street1",
    width: 1200,
    bg: info.canvas,
    ambient: 0.42,
    lights: () => [...lampLights(info, false), { x: info.door, y: 150 - STREET_SHIFT, r: 60, a: 0.6, warm: "rgba(255,200,120,0.08)" }],
    minX: 60,
    maxX: 1180,
    actors: passers.map((p) => p.a),
    hotspots: [
      ...info.posters.map((p, i): Hotspot => ({
        x: p.x,
        iconY: 148 - STREET_SHIFT,
        label: "살펴보다",
        enabled: () => true,
        use: async () => {
          await caption(`「${p.text}」`);
          await say(charlie, ["운석...? 뭐, 나랑은 상관없지.", "누가 이런 걸 붙이고 다니는 거야.", "종말이 오면... 출근은 안 해도 되나.", "채식이든 뭐든, 지금은 맥주가 필요해."][i] ?? "...");
        },
      })),
      {
        get x() {
          return addict.a.x;
        },
        iconY: 150,
        label: "살펴보다",
        enabled: () => true,
        use: async () => {
          await caption("고개를 푹 숙인 채, 몇 시간째 제자리를 맴돌고 있다.");
          await say(charlie, "...요즘 이런 사람이 부쩍 늘었어.");
        },
      },
    ],
    zones: [
      {
        // 현관 계단 앞에 도착했을 때
        x: info.door + 34,
        dir: -1,
        run: async () => {
          charlie.facing = -1;
          await say(charlie, "3일 만에 집이군...");
          await wait(0.5);
          await say(charlie, "3일 내내 잠도 못 잤군.");
          await wait(0.3);
          await say(charlie, "맥주와 휴식이 필요해...");
          await walkTo(charlie, info.door, 40);
          charlie.anim = { prefix: "climb", frames: 8, fps: 8 };
          for (let s = 0; s < 10; s++) {
            sfx.step();
            await tween(charlie, info.door, GROUND - (s + 1) * 6, 0.22, 0);
          }
          charlie.anim = null;
          charlie.pose = "climb0";
          await wait(0.3);
          await goScene("room");
        },
      },
    ],
    update: (dt) => {
      tickPassers(passers, dt);
      // 집과 반대쪽으로 걸으면 한마디 (막지는 않는다)
      if (S.control && charlie.moving && charlie.facing === 1) backT += dt;
      else backT = 0;
      backCD -= dt;
      if (backT > 0.5 && backCD <= 0) {
        charlie.bubble = BACK_LINES[backLine++ % BACK_LINES.length];
        backBubble = 2.4;
        backCD = 5;
      }
      if (backBubble > 0) {
        backBubble -= dt;
        if (backBubble <= 0) charlie.bubble = null;
      }
    },
    back: (camX) => {
      // 문 위 번지수 조명 등은 배경에 포함
      void camX;
    },
    start: async () => {
      charlie.x = 1150;
      charlie.facing = -1;
      S.help = 8;
      await fadeTo(0, 1.2);
      await chapterCard("프롤로그", "퇴근길");
      await say(charlie, "너무 피곤해...");
      S.control = true;
    },
  };
  return sc;
};

// ═════════════════════════════════════════════════════════
// 프롤로그 2: 찰리의 집
// ═════════════════════════════════════════════════════════
SCENES.room = () => {
  const F = S.flags;
  let meteor = -1; // 운석 연출 시간
  let zzz = false;
  let catOut = -1; // 샘이 창밖으로 나가는 연출 시간
  const IMPACT = 1.9;
  const IMPACT_X = 232;
  const shards: Array<{ x: number; y: number; vx: number; vy: number; r: number; vr: number }> = [];
  const burstGlass = () => {
    for (let i = 0; i < 22; i++) {
      shards.push({ x: 196 + Math.random() * 30, y: 80 + Math.random() * 40, vx: 20 + Math.random() * 70, vy: -30 + Math.random() * 30, r: Math.random() * 6, vr: (Math.random() - 0.5) * 14 });
    }
  };
  // 창밖 빌딩 실루엣 (두 창문이 같은 바깥 풍경을 본다)
  const towers: Array<[number, number, number]> = [];
  for (let x = 60, i = 0; x < 300; i++) {
    const w = 12 + ((i * 37) % 17);
    towers.push([x, w, 26 + ((i * 53) % 46)]);
    x += w + 1;
  }
  const FIRES: Array<[number, number, number]> = [
    [200, 26, 6], [214, 38, 7], [228, 46, 8], [242, 40, 7], [256, 30, 6], [270, 22, 5], [120, 16, 4], [134, 20, 5],
  ];
  /** 창밖 풍경: 운석이 떨어지기 전 · 떨어지는 순간 · 불타는 도시 */
  const paintOutside = (m: number, camX: number) => {
    const X = (v: number) => v - camX;
    const k = Math.min(1, m / IMPACT);
    const after = m >= IMPACT;
    const t2 = m - IMPACT;
    // 하늘
    const sky = g.createLinearGradient(0, 50, 0, 150);
    if (!after) {
      sky.addColorStop(0, "#0a0e1e");
      sky.addColorStop(1, "#22284a");
    } else {
      sky.addColorStop(0, "#4a2018");
      sky.addColorStop(0.5, "#9a4418");
      sky.addColorStop(1, "#f08a2a");
    }
    g.fillStyle = sky;
    g.fillRect(X(70), 50, 240, 100);
    if (!after) {
      for (let i = 0; i < 40; i++) {
        g.fillStyle = `rgba(200,210,255,${(0.4 + 0.4 * Math.sin(clock.t * 2 + i)).toFixed(2)})`;
        g.fillRect(X(70 + ((i * 53) % 240)), 52 + ((i * 29) % 50), 0.5, 0.5);
      }
      // 다가오는 초록빛이 하늘을 물들인다
      const mx = 150 + (IMPACT_X - 150) * k * k;
      const my = -30 + 180 * k * k;
      const glow = g.createRadialGradient(X(mx), my, 0, X(mx), my, 30 + k * 90);
      glow.addColorStop(0, `rgba(170,255,200,${(0.25 + k * 0.5).toFixed(2)})`);
      glow.addColorStop(1, "rgba(120,255,170,0)");
      g.fillStyle = glow;
      g.fillRect(X(70), 50, 240, 100);
      // 운석 본체 + 꼬리
      const size = 0.8 + k * k * 2.6;
      const ang = Math.atan2(180, IMPACT_X - 150);
      const tail = 20 + k * 40;
      const tg = g.createLinearGradient(X(mx), my, X(mx - Math.cos(ang) * tail), my - Math.sin(ang) * tail);
      tg.addColorStop(0, "rgba(240,255,240,0.95)");
      tg.addColorStop(0.2, "rgba(150,255,180,0.75)");
      tg.addColorStop(1, "rgba(80,220,140,0)");
      g.strokeStyle = tg;
      g.lineCap = "round";
      g.lineWidth = size * 1.5;
      g.beginPath();
      g.moveTo(X(mx), my);
      g.lineTo(X(mx - Math.cos(ang) * tail), my - Math.sin(ang) * tail);
      g.stroke();
      g.fillStyle = "#f4fff6";
      g.beginPath();
      g.arc(X(mx), my, size, 0, Math.PI * 2);
      g.fill();
    } else {
      // 불빛 번짐
      const fg = g.createRadialGradient(X(IMPACT_X), 160, 0, X(IMPACT_X), 160, 130);
      fg.addColorStop(0, `rgba(255,150,60,${(0.55 + 0.1 * Math.sin(clock.t * 11)).toFixed(2)})`);
      fg.addColorStop(1, "rgba(255,90,30,0)");
      g.fillStyle = fg;
      g.fillRect(X(70), 50, 240, 100);
    }
    // 빌딩 실루엣
    for (const [tx, tw, th] of towers) {
      g.fillStyle = after ? "#140a0a" : "#141a30";
      g.fillRect(X(tx), 150 - th, tw, th);
      if (!after) {
        g.fillStyle = "#e8c070";
        for (let wy = 150 - th + 4; wy < 146; wy += 6) if ((tx + wy) % 3 === 0) g.fillRect(X(tx + 3), wy, 1.5, 1.5);
      } else {
        g.fillStyle = "rgba(255,120,40,0.5)";
        g.fillRect(X(tx), 150 - th, 0.5, th);
      }
    }
    if (!after) return;
    const grow = Math.min(1, t2 / 0.9);
    // 불길: 겹겹이 흔들리는 혀 모양
    g.globalCompositeOperation = "lighter";
    FIRES.forEach(([fx, fh, fw], i) => {
      const fl = 0.7 + 0.3 * Math.sin(clock.t * 9 + i * 1.7) * Math.sin(clock.t * 5.3 + i);
      const h = fh * 1.5 * (0.75 + 0.35 * fl) * grow;
      const sway = Math.sin(clock.t * 6 + i) * 2.5;
      for (const [hk, wk, c0, c1] of [
        [1, 1, "rgba(255,70,20,0.85)", "rgba(255,120,30,0)"],
        [0.7, 0.62, "rgba(255,170,50,0.9)", "rgba(255,200,80,0)"],
        [0.4, 0.34, "rgba(255,245,190,0.95)", "rgba(255,240,170,0)"],
      ] as Array<[number, number, string, string]>) {
        const hh = h * hk;
        const ww = fw * wk;
        const by = 152;
        const gr = g.createLinearGradient(0, by, 0, by - hh);
        gr.addColorStop(0, c0);
        gr.addColorStop(1, c1);
        g.fillStyle = gr;
        g.beginPath();
        g.moveTo(X(fx - ww), by);
        g.bezierCurveTo(X(fx - ww), by - hh * 0.45, X(fx + sway - ww * 0.4), by - hh * 0.7, X(fx + sway), by - hh);
        g.bezierCurveTo(X(fx + sway + ww * 0.4), by - hh * 0.7, X(fx + ww), by - hh * 0.45, X(fx + ww), by);
        g.closePath();
        g.fill();
      }
    });
    // 불티
    for (let i = 0; i < 26; i++) {
      const p = (clock.t * 0.45 + i / 26) % 1;
      const ex = 196 + ((i * 37) % 80) + Math.sin(p * 8 + i) * 5 + p * 14;
      g.fillStyle = `rgba(255,${160 + ((i * 13) % 80)},60,${((1 - p) * grow).toFixed(2)})`;
      g.fillRect(X(ex), 146 - p * 90, 0.75, 0.75);
    }
    g.globalCompositeOperation = "source-over";
    // 초록빛 핵: 불 속에서 맥박처럼 깜빡인다
    const pulse = 0.5 + 0.5 * Math.sin(clock.t * 3.2);
    const cg = g.createRadialGradient(X(IMPACT_X), 146, 0, X(IMPACT_X), 146, 16);
    cg.addColorStop(0, `rgba(190,255,210,${(0.5 + pulse * 0.4).toFixed(2)})`);
    cg.addColorStop(1, "rgba(120,255,170,0)");
    g.fillStyle = cg;
    g.fillRect(X(IMPACT_X - 16), 130, 32, 22);
    // 검은 연기: 아래는 불빛에 물들고 위로 갈수록 짙게 퍼진다
    const smokeIn = Math.min(1, t2 / 1.6);
    for (let i = 0; i < 22; i++) {
      const p = (clock.t * 0.1 + i / 22) % 1;
      const src = FIRES[i % 8][0];
      const sx = src + p * 40 + Math.sin(p * 5 + i) * 7;
      const sy = 112 - p * 100;
      const r = 8 + p * 26;
      const a = 0.95 * Math.pow(1 - p, 0.45) * smokeIn;
      const sg = g.createRadialGradient(X(sx), sy, 0, X(sx), sy, r);
      const lit = Math.max(0, 1 - p * 3);
      sg.addColorStop(0, `rgba(${Math.round(12 + lit * 60)},${Math.round(10 + lit * 22)},${Math.round(12 + lit * 8)},${a.toFixed(2)})`);
      sg.addColorStop(0.65, `rgba(14,10,12,${(a * 0.75).toFixed(2)})`);
      sg.addColorStop(1, "rgba(16,12,14,0)");
      g.fillStyle = sg;
      g.beginPath();
      g.arc(X(sx), sy, r, 0, Math.PI * 2);
      g.fill();
    }
    // 충돌 순간 섬광
    if (t2 < 0.5) {
      g.fillStyle = `rgba(220,255,230,${(1 - t2 / 0.5).toFixed(2)})`;
      g.fillRect(X(70), 50, 240, 100);
    }
  };
  const searched = new Set<string>();

  const findSam = async () => {
    F.found = 1;
    sam.visible = true;
    sam.x = 470;
    sam.facing = -1;
    sfx.meow();
    await wait(0.4);
    await walkTo(sam, charlie.x + 40 * (charlie.x < 470 ? 1 : -1), 40);
    charlie.facing = sam.x > charlie.x ? 1 : -1;
    await walkTo(charlie, sam.x - 22 * charlie.facing, 45);
    // 머리 박치기 + 다리 사이 빙글빙글
    sam.facing = charlie.x > sam.x ? 1 : -1;
    sam.pose = "butt";
    sfx.purr();
    await wait(0.6);
    sam.pose = null;
    await walkTo(sam, charlie.x + 20 * sam.facing, 30);
    await walkTo(sam, charlie.x - 18 * sam.facing, 30);
    await walkTo(sam, charlie.x + 14, 30);
    sam.facing = -1;
    sam.pose = "butt";
    sfx.meow();
    emote(charlie, "!");
    await say(charlie, "샘! 여기 있었구나!");
    sam.pose = "sit";
    await wait(0.4);
    await say(charlie, "...맥주를 꺼내야겠어.");
    F.followCat = 1;
  };

  const search = (id: string, x: number, lines: string[]): Hotspot => ({
    x,
    iconY: 150,
    label: "살펴보다",
    enabled: () => !F.found,
    use: async () => {
      await walkTo(charlie, x - 10, 50);
      for (const l of lines) await caption(l);
      searched.add(id);
      if (searched.size >= 3) await findSam();
    },
  });

  const sleepScene = async () => {
    await walkTo(charlie, ROOM.armchair + 2, 45);
    charlie.facing = 1;
    charlie.pose = "sit";
    charlie.y = 200;
    sam.pose = null;
    await walkTo(sam, ROOM.armchair + 30, 30);
    sam.facing = -1;
    sam.pose = "loaf";
    for (let i = 0; i < 4; i++) {
      charlie.pose = "drink";
      sfx.can();
      await wait(0.9);
      charlie.pose = "sit";
      F.cans = (F.cans ?? 0) + 1;
      await wait(0.6);
    }
    await say(charlie, "너무 많이 마셨군...");
    charlie.pose = "sleep";
    zzz = true;
    S.scene!.ambient = 0.7;
    await wait(2.6);
    // 운석 낙하: 창밖 하늘에 초록빛이 번지고, 별똥별이 점점 커지며 떨어진다
    meteor = 0;
    await wait(0.7);
    sam.pose = "sit";
    sam.facing = -1;
    emote(sam, "!");
    await until(() => meteor >= IMPACT);
    sfx.boom();
    sfx.glass();
    shake(1.2);
    flash("#d8ffe0", 1);
    burstGlass();
    zzz = false;
    charlie.pose = "armsUp";
    charlie.y = GROUND;
    sam.pose = "startle";
    await tween(sam, sam.x + 4, GROUND - 12, 0.18, 0);
    await tween(sam, sam.x + 2, GROUND, 0.16, 0);
    emote(charlie, "!");
    await say(charlie, "씨...!? 뭐, 뭐야!");
    charlie.pose = null;
    focusCam(205, 1.25);
    await caption("창밖에서 불길이 치솟고, 검은 연기가 하늘을 덮는다.");
    await caption("그 불길 한가운데서... 초록빛이 심장처럼 깜빡이고 있었다.");
    await say(charlie, "운석...? 진짜로 떨어진 거야?");
    // 샘은 초록빛에 홀린 듯 창가로 다가간다
    focusCam(null, 1);
    sam.pose = "sit";
    emote(sam, "…");
    await wait(0.8);
    sam.pose = null;
    await walkTo(sam, ROOM.desk + 30, 20);
    sam.pose = "sit";
    emote(charlie, "?");
    await say(charlie, "샘...? 왜 그래?");
    sam.pose = "jump";
    await tween(sam, ROOM.desk + 14, 168, 0.4, 16);
    sam.pose = "sit";
    await wait(0.5);
    sam.pose = "jump";
    await tween(sam, ROOM.windowExit + 4, 139, 0.35, 12);
    sam.pose = "sit";
    await wait(0.4);
    void walkTo(charlie, ROOM.desk + 56, 80);
    emote(charlie, "!");
    await say(charlie, "샘, 거기 위험해! 이리 와!");
    // 깨진 창으로 뛰어나가 비상계단을 타고 사라진다
    sam.visible = false;
    catOut = 0;
    sfx.step();
    await until(() => catOut >= 1.7);
    catOut = -1;
    await walkTo(charlie, ROOM.desk + 40, 70);
    charlie.facing = -1;
    shake(0.4);
    emote(charlie, "!");
    await say(charlie, "샘! 안 돼!");
    await wait(0.4);
    await goScene("apt4", 0);
  };

  const sc: Scene = {
    id: "room",
    width: ROOM.width,
    bg: buildRoom(),
    ambient: 0.55,
    lights: () => {
      const L: Light[] = [
        { x: 112, y: 100, r: meteor >= IMPACT ? 90 : 70, a: meteor >= IMPACT ? 0.75 : 0.5, warm: meteor >= IMPACT ? "rgba(255,110,40,0.14)" : "rgba(120,150,255,0.05)" },
        meteor >= IMPACT
          ? { x: 210, y: 96, r: 135 + Math.sin(clock.t * 11) * 8, a: 0.95, warm: `rgba(255,${Math.round(100 + Math.sin(clock.t * 7) * 20)},40,0.22)` }
          : meteor >= 0
            ? { x: 210, y: 92, r: 70 + (meteor / IMPACT) * 80, a: 0.5 + (meteor / IMPACT) * 0.45, warm: `rgba(120,255,170,${(0.05 + (meteor / IMPACT) * 0.2).toFixed(2)})` }
            : { x: 210, y: 92, r: 70, a: 0.5, warm: "rgba(120,150,255,0.05)" },
        { x: 203, y: 154, r: 34, a: 0.7, warm: "rgba(90,150,255,0.10)" },
        { x: 470, y: 30, r: 110, a: 0.4 },
        { x: ROOM.lamp + 1, y: 124, r: zzz ? 70 : 95, a: 0.85, warm: "rgba(255,200,130,0.12)" },
      ];
      return L;
    },
    minX: 30,
    maxX: 690,
    actors: [],
    hotspots: [
      search("radiator", ROOM.radiator, ["라디에이터 뒤를 들여다봤다.", "여기엔 없는 것 같다."]),
      search("desk", ROOM.desk, ["책상 밑... 없다.", "모니터에 회사 메일 알림이 37개 떠 있다. 보지 말자."]),
      search("bed", ROOM.bed, ["침대 위엔 하얀 털만 잔뜩 묻어 있다.", "여기엔 없는 것 같다."]),
      search("wardrobe", ROOM.wardrobe, ["옷장 안에는 똑같은 체크 셔츠만 일곱 벌.", "샘은 없다."]),
      photoSpot("p12", ROOM.bed + 44, 176, "침대 옆 협탁"),
      {
        x: ROOM.door,
        iconY: 100,
        label: "살펴보다",
        enabled: () => !F.found,
        use: async () => {
          await say(charlie, "문은 잠겨 있어. 밖으로 나간 건 아닐 거야.");
        },
      },
      {
        x: ROOM.fridge,
        iconY: 98,
        label: "냉장고 열기",
        enabled: () => !!F.found && !F.beer,
        use: async () => {
          await walkTo(charlie, ROOM.fridge - 22, 50);
          charlie.facing = 1;
          sfx.fridge();
          await goScene("fridge");
        },
      },
      {
        x: ROOM.armchair,
        iconY: 150,
        label: "앉아서 쉬기",
        enabled: () => !!F.beer && !F.slept,
        use: async () => {
          F.slept = 1;
          await sleepScene();
        },
      },
      {
        x: ROOM.coat,
        iconY: 110,
        label: "살펴보다",
        enabled: () => !!F.found,
        use: async () => {
          await say(charlie, "출근용 코트... 내일 생각은 하지 말자.");
        },
      },
    ],
    zones: [],
    update: (dt) => {
      if (meteor >= 0) meteor += dt;
      if (catOut >= 0) catOut += dt;
      for (const sh of [...shards]) {
        sh.vy += 160 * dt;
        sh.x += sh.vx * dt;
        sh.y += sh.vy * dt;
        sh.r += sh.vr * dt;
        if (sh.y > GROUND + 2) {
          sh.y = GROUND + 2;
          sh.vx *= 0.3;
          sh.vy = 0;
          sh.vr = 0;
        }
      }
      // 샘이 찰리를 따라다님
      if (F.followCat && !F.slept && sam.visible && S.control) {
        const target = charlie.x - charlie.facing * 26;
        if (Math.abs(target - sam.x) > 30) {
          sam.pose = null;
          const d = Math.sign(target - sam.x);
          sam.x += d * 48 * dt;
          sam.walkDist += 48 * dt;
          sam.moving = true;
          sam.facing = d > 0 ? 1 : -1;
        } else {
          sam.moving = false;
          sam.pose = "sit";
        }
      }
    },
    back: (camX) => {
      // 현관 옆에 내려 둔 백팩
      if (F.bagDown) {
        const bx = half(ROOM.door + 20 - camX);
        g.fillStyle = "rgba(0,0,0,0.3)";
        g.fillRect(bx - 1, GROUND - 1, 12, 2);
        g.fillStyle = "#1c2e44";
        g.fillRect(bx - 0.5, GROUND - 11.5, 11, 11);
        g.fillStyle = "#2e4a6a";
        g.fillRect(bx, GROUND - 11, 10, 10);
        g.fillStyle = "#46688e";
        g.fillRect(bx, GROUND - 11, 10, 1);
        g.fillStyle = "#3a5a7e";
        g.fillRect(bx + 2, GROUND - 6, 6, 4.5);
        g.fillStyle = "#c8c8d0";
        g.fillRect(bx + 2, GROUND - 6, 6, 0.5);
        g.fillStyle = "#1c2e44";
        g.fillRect(bx + 3.5, GROUND - 13, 3, 2);
        g.fillRect(bx + 9.5, GROUND - 10, 1, 8);
      }
      // 창밖 풍경 (창유리 안쪽만 칠하고 창틀·비상계단을 다시 그린다)
      if (meteor >= 0) {
        for (const [x0, y0, w, h] of [[178, 52, 64, 82], [82, 58, 60, 88]]) {
          g.save();
          g.beginPath();
          g.rect(x0 - camX, y0, w, h);
          g.clip();
          paintOutside(meteor, camX);
          // 창밖으로 나간 샘: 비상계단에 내려앉아 불빛 쪽으로 사라진다
          if (catOut >= 0 && x0 === 178) {
            const c = Math.min(1, catOut / 0.45);
            const cx = catOut < 0.45 ? 214 + c * 10 : 224 + (catOut - 0.45) * 34;
            const cy = catOut < 0.45 ? 139 - Math.sin(c * Math.PI) * 14 - c * 26 : 113;
            const pose = catOut < 0.45 ? "jump" : `walk${Math.floor(catOut * 18) % 16}`;
            smoothDraw(cat(pose, 1), half(cx - camX - 10), half(cy - 15), 20, 15);
          }
          if (meteor >= IMPACT && x0 === 178) {
            // 깨진 유리 가장자리
            g.strokeStyle = "rgba(200,225,240,0.7)";
            g.lineWidth = 0.5;
            g.beginPath();
            g.moveTo(x0 + 6 - camX, y0 + h / 2 + 1);
            g.lineTo(x0 + 12 - camX, y0 + h / 2 + 9);
            g.lineTo(x0 + 4 - camX, y0 + h / 2 + 16);
            g.moveTo(x0 + w / 2 + 2 - camX, y0 + 2);
            g.lineTo(x0 + w / 2 + 10 - camX, y0 + 8);
            g.lineTo(x0 + w / 2 + 5 - camX, y0 + 15);
            g.lineTo(x0 + w / 2 + 14 - camX, y0 + 22);
            g.stroke();
          }
          g.restore();
          g.fillStyle = "#0a0a10";
          for (let k2 = 0; k2 < w; k2 += 5) g.fillRect(half(x0 + k2 - camX), y0 + h - 20, 1, 20);
          g.fillRect(half(x0 - camX), y0 + h - 21, w, 2);
          g.fillStyle = "#d8d0c0";
          g.fillRect(half(x0 + w / 2 - 1 - camX), y0, 2, h);
          g.fillRect(half(x0 - camX), y0 + h / 2 - 1, w, 2);
        }
      }
      // 빈 맥주캔
      for (let i = 0; i < (F.cans ?? 0); i++) {
        const cx = ROOM.armchair - 30 + i * 9 - camX;
        g.fillStyle = "#c8352a";
        if (i % 2) g.fillRect(cx, 208, 8, 5);
        else g.fillRect(cx, 205, 5, 8);
        g.fillStyle = "#d8d8e0";
        g.fillRect(cx, i % 2 ? 208 : 205, i % 2 ? 1 : 5, i % 2 ? 5 : 1);
      }
    },
    front: (camX) => {
      for (const sh of shards) {
        g.save();
        g.translate(sh.x - camX, sh.y);
        g.rotate(sh.r);
        g.fillStyle = "rgba(200,230,245,0.8)";
        g.beginPath();
        g.moveTo(-1.5, -1);
        g.lineTo(1.8, -0.4);
        g.lineTo(-0.2, 1.6);
        g.fill();
        g.restore();
      }
      if (zzz) {
        for (let i = 0; i < 3; i++) {
          const k = (clock.t * 0.5 + i / 3) % 1;
          text("z", charlie.x - camX + 10 + k * 14, 160 - k * 30, `rgba(220,220,255,${(1 - k).toFixed(2)})`, "center");
        }
      }
    },
    start: async () => {
      if (F.beer) {
        charlie.x = ROOM.fridge - 22;
        charlie.facing = -1;
        sam.visible = true;
        sam.x = ROOM.fridge - 54;
        sam.pose = "sit";
        await fadeTo(0, 0.6);
        await say(charlie, "좋아, 맥주다. 좀 앉아서 쉬자.");
        S.control = true;
        return;
      }
      charlie.x = ROOM.door + 6;
      charlie.facing = 1;
      await fadeTo(0, 1);
      if (!F.bagDown) {
        // 현관문 옆에 가방부터 내려놓는다
        await walkTo(charlie, ROOM.door + 30, 40);
        charlie.facing = -1;
        await wait(0.3);
        sfx.step();
        F.bagDown = 1;
        S.backpack = false;
        await say(charlie, "후우... 가방부터 내려놓자.");
        charlie.facing = 1;
      }
      await walkTo(charlie, ROOM.door + 48, 40);
      await say(charlie, "샘을 찾아보자.");
      await wait(0.3);
      await say(charlie, "샘? 어딨지?");
      await caption("돋보기가 있는 곳에서 [Space]를 누르거나 돋보기를 클릭해 살펴보세요.");
      S.control = true;
    },
  };
  return sc;
};

// ═════════════════════════════════════════════════════════
// 프롤로그 3: 냉장고 안
// ═════════════════════════════════════════════════════════
const FRIDGE_ITEMS: Array<{ key: keyof typeof FRIDGE_SPOTS; label: string; lines: string[]; take?: boolean }> = [
  { key: "beer", label: "맥주 꺼내기", lines: ["맥주 일곱 캔. 오늘 저녁 메뉴다."], take: true },
  { key: "energy", label: "에너지 드링크", lines: ["에너지 드링크. 3일 밤샘의 비결이자 원흉."] },
  { key: "fish", label: "매달린 생선", lines: ["생선을 왜 매달아 놨더라...", "한 달 전에 산 것 같다."] },
  { key: "meat", label: "정체불명의 고기", lines: ["뭔지 모를 고기. 언제 산 건지 기억나지 않는다."] },
  { key: "catfood", label: "샘의 통조림", lines: ["샘의 통조림만큼은 유통기한 순서대로 정리돼 있다."] },
  { key: "sausage", label: "매달린 소시지", lines: ["소시지는 매달아야 맛있다고 누가 그랬다.", "...아마 나였던 것 같다."] },
];

SCENES.fridge = () => {
  const sc: Scene = {
    id: "fridge",
    width: W,
    bg: buildFridge(),
    ambient: 0,
    lights: () => [],
    minX: 0,
    maxX: W,
    actors: [],
    hotspots: [],
    zones: [],
    noPlayer: true,
    start: async () => {
      await fadeTo(0, 0.4);
      await caption("이상한 음식에, 더 이상한 보관법. 찰리다운 냉장고다.");
      S.control = true;
    },
  };
  return sc;
};

async function useFridgeItem(i: number): Promise<void> {
  const it = FRIDGE_ITEMS[i];
  for (const l of it.lines) await caption(l);
  if (it.take) {
    sfx.can();
    S.flags.beer = 1;
    await caption("맥주를 꺼냈다.");
    await goScene("room");
  }
}

// ═════════════════════════════════════════════════════════
// 제1장: 무너진 거리
// ═════════════════════════════════════════════════════════
const CHANTS = ["채식만이 살 길이다!", "고기를 버려라!", "우리처럼 가벼워져라!", "육식은 죄악이다!"];
const SIGNS = ["채식", "VEGAN", "육식X", "회개"];

SCENES.chapter1 = (checkpoint) => {
  const F = S.flags;
  const info = buildStreet(1900, true, 11);
  const PET = 1380;
  const NEWS = 760;
  const LEE = 1000;
  const lee = mkActor("person", LEE + 16, -1, { look: MRLEE, lookId: "mrlee", pose: "stand" });
  // 넋이 나간 사람들: 배경처럼 흔들리고 중얼거릴 뿐, 찰리에게 관심이 없다
  type Stranger = Actor & { mode: "sway" | "wander" | "sit" | "sky"; a: number; b: number; lines: string[]; talkT: number };
  const mkStranger = (x: number, look: Look, id: string, mode: Stranger["mode"], lines: string[], a = x, b = x): Stranger =>
    Object.assign(mkActor("person", x, -1, { look, lookId: id, pose: mode === "sit" ? "sit" : "stand" }), { mode, a, b, lines, talkT: 2 + Math.random() * 4 });
  const strangers: Stranger[] = [
    mkStranger(520, STRANGERS[0], "st0", "sway", ["초록... 초록빛이 보여...", "들려...? 하늘이 부르는 소리..."]),
    mkStranger(905, STRANGERS[1], "st1", "wander", ["출근... 출근해야 하는데...", "보고서... 보고서가..."], 860, 990),
    mkStranger(1150, STRANGERS[2], "st2", "sky", ["...", "별이... 떨어졌어..."]),
    mkStranger(1240, ADDICT, "addict", "sway", ["한 번만... 딱 한 번만 더...", "..."]),
    mkStranger(1640, STRANGERS[0], "st0", "wander", ["내 고양이... 어디 갔지...", "나비야... 나비야..."], 1600, 1720),
  ];
  strangers[2].y = GROUND;
  // 멀리 지나가는 해골 시위대 (배경)
  const march: Actor[] = [];
  let marchX = -1;
  let chantT = 1.5;
  let frog: Actor | null = null;
  const exitX = 1860;

  const sc: Scene = {
    id: "chapter1",
    width: 1900,
    bg: info.canvas,
    ambient: 0.5,
    tint: "rgba(120,30,10,0.12)",
    lights: () => [
      ...lampLights(info, true),
      ...info.fires.map((f): Light => ({ x: f.x + f.w / 2, y: f.y + f.h / 2, r: 46 + Math.sin(clock.t * 10 + f.x) * 4, a: 0.7, warm: "rgba(255,110,40,0.12)" })),
      { x: PET, y: 176, r: 50, a: 0.5, warm: "rgba(255,150,200,0.06)" },
    ],
    minX: 60,
    maxX: 1880,
    get actors() {
      return [...strangers, lee, ...(frog ? [frog] : [])];
    },
    hotspots: [
      {
        x: info.bodega,
        iconY: 150 - STREET_SHIFT,
        label: "살펴보다",
        enabled: () => !F.supplies,
        use: async () => {
          await caption("부서진 편의점. 선반은 거의 비어 있다.");
          sfx.item();
          F.supplies = 1;
          await caption("손전등을 챙겼다.");
          await caption("...그런데 고양이 간식 칸은 텅 비어 있다. 누가 몽땅 털어 간 모양이다.");
          emote(charlie, "💧");
          await say(charlie, "츄르가 없으면 샘을 불러낼 수가 없는데...");
          emote(charlie, "!");
          await say(charlie, "그래, 펫숍! 이 길 끝에 '냥이네 펫숍'이 있었지.");
          writeSave("chapter1", info.bodega);
        },
      },
      ...info.posters.slice(1, 3).map((p, i): Hotspot => ({
        x: p.x,
        iconY: 148 - STREET_SHIFT,
        label: "살펴보다",
        enabled: () => true,
        use: async () => {
          await caption(`불에 그을린 포스터. 「${p.text}」`);
          await say(charlie, i === 0 ? "...설마. 그냥 운석이 떨어진 것뿐이야." : "회개는 나중에 하고, 샘부터 찾자.");
        },
      })),
      {
        x: LEE,
        iconY: 140,
        label: "핫도그 아저씨",
        range: 28,
        enabled: () => true,
        use: async () => {
          charlie.facing = 1;
          if (!F.metLee) {
            F.metLee = 1;
            await say(lee, "어서 와! 종말 기념 핫도그, 오늘은 공짜다!");
            await say(charlie, "...아저씨는 멀쩡하세요? 다들 이상해졌는데.");
            await say(lee, "나? 40년 동안 이 자리에서 핫도그만 팔았지. 붙들고 있는 게 핫도그뿐이라 그런가, 멀쩡해.");
            await say(lee, "고양이 찾는 거면 조심해. 요즘 개구리 같은 놈들이 고양이를 자루에 담아 가더라. 어디 '회사'에 판다나.");
            emote(charlie, "!");
            await say(charlie, "고양이를... 판다고요?");
            await say(lee, "펫숍에 츄르 남은 게 있을 거다. 고양이는 츄르 소리엔 못 버티거든. 힘내라, 청년!");
            sfx.item();
            await caption("미스터 리가 핫도그를 건넸다. 사흘 만에 먹는 따뜻한 음식이다.");
          } else {
            const lines = ["핫도그는 케첩이지. 머스터드파는 해골이 됐어.", "개구리 놈들, 내 소시지도 훔쳐 갔어. 지하철로 들어가더라.", "청년, 고양이 찾으면 꼭 데리고 와. 소시지 하나 줄게."];
            await say(lee, lines[(F.leeTalk = (F.leeTalk ?? 0) + 1) % lines.length]);
          }
        },
      },
      {
        x: NEWS,
        iconY: 168,
        label: "신문 가판대",
        enabled: () => true,
        use: async () => {
          await caption("바람에 날리는 호외. 「운석 낙하 세 시간째... 시민들 '이상 행동' 잇따라」");
          await caption("「전문가: 운석에서 퍼진 미세 먼지와 관련 있을 가능성」");
          await say(charlie, "먼지...? 그럼 저 사람들도...");
        },
      },
      {
        x: PET,
        iconY: 128,
        label: "펫숍 뒤지기",
        enabled: () => !!F.supplies && !F.treats && !F.robbed,
        use: async () => {
          await caption("깨진 진열장 너머, 쓰러진 캣타워와 흩어진 사료 봉지.");
          await caption("선반 맨 아래 칸에 손을 넣어 더듬어 본다...");
          sfx.item();
          F.treats = 1;
          emote(charlie, "♥");
          await caption("츄르를 찾았다! 딱 한 봉지 남아 있었다.");
          await say(charlie, "됐다! 샘, 이거면 어디에 있든 달려올 거야.");
          writeSave("chapter1", 1400);
        },
      },
      {
        x: PET + 46,
        iconY: 190,
        label: "작은 고양이 문?",
        range: 16,
        enabled: () => !!F.supplies && !F.robbed,
        use: async () => {
          await caption("펫숍 문 아래쪽에 고양이 전용 작은 문이 있다. 안쪽에서 '냐옹' 소리가 여럿 들린다...");
          await say(charlie, "...기어서라도 들어가 볼까.");
          await descend(2);
          await goScene("catMeet", 60);
        },
      },
      {
        x: PET,
        iconY: 128,
        label: "살펴보다",
        enabled: () => !F.supplies,
        use: async () => {
          await caption("'냥이네 펫숍'. 진열장이 깨져 있다. 맨손으로 뒤지기엔 너무 어둡다.");
        },
      },
    ],
    zones: [
      {
        x: 700,
        dir: 1,
        repeat: true,
        when: () => !F.supplies,
        run: async () => {
          await say(charlie, "맨손으로는 안 돼. 아까 그 편의점에서 뭐라도 챙기자.");
          await walkTo(charlie, 680, 60);
        },
      },
      {
        x: 470,
        dir: 1,
        when: () => !F.metStrange,
        run: async () => {
          F.metStrange = 1;
          charlie.facing = 1;
          focusCam(510, 1.2);
          await say(charlie, "저기요... 괜찮으세요?");
          await wait(0.6);
          await caption("대답이 없다. 남자는 하늘을 향해 고개를 든 채 천천히 흔들릴 뿐이다.");
          emote(charlie, "💧");
          await say(charlie, "...요즘 이런 사람이 부쩍 늘었다 싶었는데. 운석이 떨어지고 나서 더 심해졌어.");
          focusCam(null, 1);
        },
      },
      {
        x: 1060,
        dir: 1,
        when: () => !F.marchSeen,
        run: async () => {
          F.marchSeen = 1;
          marchX = S.camX + W + 40;
          for (let i = 0; i < 7; i++) march.push(mkActor("person", 0, -1, { look: SKELETON, lookId: "sk", sign: SIGNS[i % SIGNS.length] }));
          sfx.chant();
          charlie.facing = 1;
          await wait(1.2);
          emote(charlie, "?");
          await say(charlie, "저건... 채식 시위대? 뼈만 남았잖아...");
          await caption("시위대는 찰리를 거들떠보지도 않고, 구호만 외치며 길 건너편을 지나간다.");
        },
      },
      {
        x: 1500,
        dir: 1,
        when: () => !!F.treats && !F.robbed,
        run: async () => {
          F.robbed = 1;
          frog = mkActor("person", 1720, -1, { look: FROGMAN, lookId: "frog", role: "frog", hop: 0 });
          charlie.facing = 1;
          sfx.croak();
          await tween(frog, charlie.x + 40, GROUND, 0.35, 30);
          await tween(frog, charlie.x + 8, GROUND, 0.25, 16);
          shake(0.5);
          sfx.croak();
          F.treats = 0;
          frog.facing = 1;
          await tween(frog, charlie.x + 50, GROUND, 0.3, 26);
          await caption("개구리 인간이 츄르를 낚아채 달아났다!");
          emote(charlie, "💢");
          await say(charlie, "야! 그건 샘 거야!");
          for (let i = 0; i < 5; i++) await tween(frog, frog.x + 70, GROUND, 0.3, 24);
          frog.visible = false;
          writeSave("chapter1", 1500);
          await caption("쫓아가자! (Shift 달리기)");
        },
      },
      {
        x: exitX,
        dir: 1,
        when: () => !!F.robbed,
        run: async () => {
          await goScene("alley");
        },
      },
      {
        x: 1780,
        dir: 1,
        repeat: true,
        when: () => !F.robbed,
        run: async () => {
          await say(charlie, F.treats ? "츄르는 구했어. 이제 샘을 찾아보자... 어느 쪽이지?" : "샘 간식부터 구해야 해. 펫숍이 이 근처였는데...");
          await walkTo(charlie, 1760, 60);
        },
      },
    ],
    update: (dt) => {
      // 넋이 나간 사람들 (조작 여부와 관계없이 배경처럼 움직인다)
      for (const st of strangers) {
        if (st.mode === "sway") {
          st.pose = "stand";
          st.x = st.a + Math.sin(clock.t * 0.9 + st.a) * 1.5;
        } else if (st.mode === "wander") {
          const target = st.facing > 0 ? st.b : st.a;
          const step = Math.sign(target - st.x) * 9 * dt;
          st.x += step;
          st.walkDist += Math.abs(step) * 0.7;
          st.moving = true;
          st.pose = null;
          if (Math.abs(target - st.x) < 1) st.facing = st.facing > 0 ? -1 : 1;
        } else if (st.mode === "sky") {
          st.pose = "back";
        }
        st.talkT -= dt;
        if (st.talkT <= 0) {
          const near = Math.abs(st.x - charlie.x) < 200;
          st.bubble = st.bubble || !near ? null : st.lines[Math.floor(Math.random() * st.lines.length)];
          st.talkT = st.bubble ? 2.6 : 3 + Math.random() * 5;
        }
      }
      // 배경 시위대
      if (marchX > 0) {
        marchX -= 26 * dt;
        march.forEach((m, i) => {
          m.x = marchX + i * 34;
          m.walkDist += 26 * dt;
        });
        chantT -= dt;
        if (chantT <= 0) {
          chantT = 2.6;
          sfx.chant();
        }
        if (marchX + march.length * 34 < S.camX - 40) {
          marchX = -1;
          march.length = 0;
        }
      }
    },
    back: (camX) => {
      drawFires(info.fires, camX);
      // 냥이네 펫숍
      const px = PET - camX;
      if (px > -80 && px < W + 80) {
        g.fillStyle = "#24181c";
        g.fillRect(px - 52, 136, 104, 78);
        g.fillStyle = "#e88aa8";
        g.fillRect(px - 48, 139, 96, 14);
        g.fillStyle = "#b85a7a";
        g.fillRect(px - 48, 152, 96, 1);
        g.save();
        g.font = "8px Galmuri11";
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillStyle = "#3a1424";
        g.fillText("냥이네 펫숍  PET SHOP", px + 4, 146);
        g.restore();
        g.fillStyle = "#3a1424";
        g.beginPath();
        g.moveTo(px - 42, 149);
        g.lineTo(px - 41, 142);
        g.lineTo(px - 38, 145);
        g.lineTo(px - 35, 142);
        g.lineTo(px - 34, 149);
        g.fill();
        // 깨진 진열장
        g.fillStyle = "#0e0a10";
        g.fillRect(px - 46, 158, 60, 44);
        g.fillStyle = "#c8b490";
        g.fillRect(px - 38, 176, 6, 26);
        g.fillRect(px - 44, 172, 18, 4);
        g.fillRect(px - 30, 186, 14, 3);
        g.fillStyle = "#8a6a4a";
        g.fillRect(px - 14, 194, 8, 8);
        g.fillStyle = "#4a8ac8";
        g.fillRect(px - 2, 197, 5, 5);
        g.fillStyle = "#e85a6a";
        g.fillRect(px + 6, 198, 4, 4);
        g.strokeStyle = "rgba(200,225,240,0.6)";
        g.lineWidth = 0.5;
        g.beginPath();
        g.moveTo(px - 46, 158);
        g.lineTo(px - 36, 166);
        g.lineTo(px - 42, 172);
        g.moveTo(px + 14, 160);
        g.lineTo(px + 4, 168);
        g.lineTo(px + 10, 176);
        g.lineTo(px + 2, 184);
        g.stroke();
        g.fillStyle = "#3a2a24";
        g.fillRect(px + 20, 160, 26, 54);
        g.fillStyle = "#c8a83a";
        g.fillRect(px + 24, 188, 2, 3);
      }
      // 신문 가판대
      const nx = NEWS - camX;
      g.fillStyle = "#2a5a8a";
      g.fillRect(nx - 8, 186, 16, 28);
      g.fillStyle = "#e8e4d8";
      g.fillRect(nx - 6, 189, 12, 9);
      g.fillStyle = "#1a1a1a";
      for (let i = 0; i < 3; i++) g.fillRect(nx - 5, 191 + i * 2.5, 10 - i * 2, 0.75);
      for (let i = 0; i < 3; i++) {
        const k = (clock.t * 0.3 + i / 3) % 1;
        g.fillStyle = "rgba(232,228,216,0.7)";
        g.fillRect(nx + 10 + k * 60, 200 - Math.sin(k * 6 + i) * 8 - k * 20, 4, 3);
      }
      // 미스터 리의 핫도그 수레
      const lx2 = LEE - camX;
      if (lx2 > -60 && lx2 < W + 60) {
        g.fillStyle = "#c8c8d0";
        g.fillRect(lx2 - 26, 186, 40, 22);
        g.fillStyle = "#e8e8f0";
        g.fillRect(lx2 - 26, 186, 40, 2);
        g.fillStyle = "#e8a83a";
        g.fillRect(lx2 - 24, 192, 36, 8);
        g.fillStyle = "#c83a32";
        for (let i = 0; i < 4; i++) g.fillRect(lx2 - 26 + i * 10, 166, 10, 6);
        g.fillStyle = "#f4f0e8";
        for (let i = 0; i < 4; i++) g.fillRect(lx2 - 21 + i * 10, 166, 5, 6);
        g.fillStyle = "#5a5a62";
        g.fillRect(lx2 - 25, 172, 1, 14);
        g.fillRect(lx2 + 12, 172, 1, 14);
        g.fillStyle = "#2a2a2a";
        g.beginPath();
        g.arc(lx2 - 18, 210, 3, 0, Math.PI * 2);
        g.arc(lx2 + 6, 210, 3, 0, Math.PI * 2);
        g.fill();
        smokePuffs(lx2 - 6, 182, 3, 20, 3, 7, 0.25);
        text("HOT DOG", lx2 - 6, 162, "#ffd36a", "center", "");
      }
      // 멀리 길 건너편을 지나가는 해골 시위대
      for (const m of march) {
        const sx = m.x - camX;
        if (sx < -40 || sx > W + 40) continue;
        const spr = human(SKELETON, "sk", `walk${Math.floor(m.walkDist / 2) % 16}`, BUILD_3, -1);
        g.globalAlpha = 0.78;
        smoothDraw(spr, half(sx - 23 + 9), half(GROUND - 16 - 39), 23, 39);
        g.globalAlpha = 1;
        g.fillStyle = "#5a3e24";
        g.fillRect(half(sx - 2), GROUND - 74, 1.5, 24);
        g.fillStyle = "#c8c0a8";
        g.fillRect(half(sx - 11), GROUND - 86, 20, 12);
        g.save();
        g.font = "8px Galmuri11";
        g.textAlign = "center";
        g.textBaseline = "middle";
        g.fillStyle = "#2a5a2a";
        g.fillText(m.sign ?? "", sx - 1, GROUND - 80);
        g.restore();
      }
      if (march.length && Math.floor(clock.t / 2.6) % 2 === 0) {
        const lead = march[Math.floor(clock.t / 5.2) % march.length];
        const sx = lead.x - camX;
        if (sx > 20 && sx < W - 20) {
          g.save();
          g.font = "8px Galmuri11";
          g.textAlign = "center";
          g.fillStyle = "rgba(232,224,200,0.75)";
          g.fillText(CHANTS[Math.floor(clock.t / 5.2) % CHANTS.length], sx, GROUND - 94);
          g.restore();
        }
      }
    },
    start: async () => {
      if (checkpoint > 0) {
        charlie.x = checkpoint;
        for (const z of sc.zones) if (z.dir > 0 && z.x < checkpoint && !z.repeat) z.fired = true;
        if (F.robbed) F.treats = 0;
        await fadeTo(0, 0.6);
        S.control = true;
        return;
      }
      writeSave("chapter1", 0);
      charlie.x = info.door;
      charlie.y = GROUND - 60;
      charlie.pose = "stand";
      charlie.facing = 1;
      await fadeTo(0, 1.2);
      await wait(0.6);
      charlie.pose = null;
      charlie.anim = { prefix: "front", frames: 8, fps: 9 };
      for (let s = 0; s < 10; s++) {
        sfx.step();
        await tween(charlie, info.door + s * 2.4, GROUND - 54 + s * 6, 0.18, 0);
      }
      charlie.anim = null;
      await wait(0.4);
      focusCam(charlie.x + 120, 1);
      await caption("불타는 건물, 깨진 유리, 텅 빈 인도. 하룻밤 사이에 거리가 무너졌다.");
      focusCam(null, 1);
      await say(charlie, "샘을 찾으러 가야겠어. 그 전에... 샘이 좋아하는 츄르부터 구하자.");
      await chapterCard("제1장", "무너진 거리");
      S.help = 10;
      S.control = true;
    },
  };
  return sc;
};


// ═════════════════════════════════════════════════════════
// 제1장 끝: 어두운 골목
// ═════════════════════════════════════════════════════════
SCENES.alley = () => {
  const shadow = mkActor("sam", ALLEY.cat, -1, { pose: "sit", silhouette: true });
  let lit = false;
  const sc: Scene = {
    id: "alley",
    useLight: true,
    width: ALLEY.width,
    bg: buildAlley(),
    ambient: 0.9,
    lights: () => {
      const L: Light[] = [
        { x: ALLEY.lamp, y: 40, r: 90, a: 0.55, warm: "rgba(255,220,150,0.07)" },
        { x: charlie.x, y: charlie.y - 24, r: 38, a: 0.45 },
      ];
      const cone = flashCone(170, 0.32);
      if (cone) L.push(cone);
      return L;
    },
    minX: 20,
    maxX: 580,
    actors: [shadow],
    hotspots: [
      photoSpot("p1", 90, 170, "젖은 상자"),
      {
        x: ALLEY.cat,
        iconY: 170,
        label: "살펴보다",
        range: 70,
        enabled: () => shadow.visible && !lit,
        use: async () => {
          lit = true;
          await walkTo(charlie, ALLEY.cat - 60, 30);
          charlie.facing = 1;
          charlie.pose = "flashlight";
          await wait(0.8);
          shadow.silhouette = false;
          await wait(0.6);
          await say(charlie, "샘...?");
          sfx.meow();
          await wait(0.5);
          shadow.facing = 1;
          shadow.pose = null;
          await walkTo(shadow, ALLEY.width + 40, 110);
          shadow.visible = false;
          await caption("고양이는 어둠 속으로 사라졌다.");
          await say(charlie, "기다려, 샘!");
          sfx.croak();
          await caption("어딘가에서... 개구리 울음소리가 들렸다.");
          S.flags.ch1 = 1;
          unlock(2);
          await fadeTo(1, 1.5);
          await caption("...그때, 손전등이 깜빡이더니 툭 꺼졌다.");
          emote(charlie, "💧");
          await say(charlie, "건전지가 다 됐어... 길 건너 24시 약국에 건전지가 있을 거야.");
          await chapterCard("제1장 끝", "");
          await goScene("night1", 0, false);
        },
      },
    ],
    zones: [],
    front: () => {
      if (lit && shadow.visible && !shadow.silhouette) return;
      if (shadow.visible && shadow.silhouette) {
        const sx = Math.round(shadow.x - S.camX);
        const blink = Math.floor(clock.t * 1.5) % 5 !== 0;
        if (blink) {
          g.fillStyle = "#e8b04a";
          g.fillRect(sx - 4, GROUND - 16.9, 2, 0.8);
          g.fillRect(sx - 0.7, GROUND - 16.9, 1.7, 0.8);
        }
      }
    },
    start: async () => {
      charlie.x = 40;
      charlie.facing = 1;
      await fadeTo(0, 1);
      await say(charlie, "어디로 간 거지... 아무것도 안 보여.");
      await caption("손전등을 켰다.");
      charlie.pose = null;
      S.control = true;
    },
  };
  return sc;
};


// ═════════════════════════════════════════════════════════
// 제2장: 개구리 굴
// ═════════════════════════════════════════════════════════
const UNLOCK_KEY = "charlie_cat_unlocked";
function unlocked(): number {
  try {
    return Number(localStorage.getItem(UNLOCK_KEY)) || 1;
  } catch {
    return 1;
  }
}
function unlock(n: number): void {
  try {
    if (n > unlocked()) localStorage.setItem(UNLOCK_KEY, String(n));
  } catch {
    /* 무시 */
  }
}


/** 지하철 입구 (거리) */
SCENES.subwayGate = () => {
  const info = buildStreet(720, true, 31, false);
  const gateX = 520;
  const sc: Scene = {
    id: "subwayGate",
    width: 720,
    bg: info.canvas,
    ambient: 0.55,
    tint: "rgba(120,30,10,0.12)",
    lights: () => [
      ...lampLights(info, true),
      { x: gateX - 28, y: 150, r: 40, a: 0.8, warm: "rgba(120,255,140,0.10)" },
      { x: gateX + 28, y: 150, r: 40, a: 0.8, warm: "rgba(120,255,140,0.10)" },
    ],
    minX: 40,
    maxX: 690,
    actors: [],
    hotspots: [
      {
        x: 300,
        iconY: 196,
        label: "살펴보다",
        enabled: () => !S.flags.tracks,
        use: async () => {
          S.flags.tracks = 1;
          await caption("젖은 물갈퀴 자국이 길게 이어져 있다.");
          await say(charlie, "개구리 녀석... 지하철역으로 들어갔군.");
        },
      },
      {
        x: gateX,
        iconY: 168,
        label: "내려가기",
        enabled: () => true,
        use: async () => {
          if (!S.flags.tracks) await say(charlie, "어디로 간 거지...? 바닥에 뭔가 있는 것 같은데.");
          else {
            charlie.clip = { x0: gateX - 40, y0: -200, x1: gateX + 40, y1: GROUND };
            charlie.anim = { prefix: "front", frames: 8, fps: 9 };
            for (let i = 0; i < 4; i++) {
              sfx.step();
              await tween(charlie, gateX, GROUND + (i + 1) * 3, 0.26, 0);
            }
            charlie.anim = null;
            await goScene("tun1");
          }
        },
      },
    ],
    zones: [],
    back: (camX) => {
      drawFires(info.fires, camX);
      // 지하철 입구: 초록 난간 + 구형 등 + 간판 + 계단
      const x = gateX - camX;
      g.fillStyle = "#0a0a0e";
      g.fillRect(x - 22, 200, 44, 22);
      for (let s2 = 0; s2 < 5; s2++) {
        g.fillStyle = s2 % 2 ? "#4a4a50" : "#5a5a62";
        g.fillRect(x - 20, 202 + s2 * 4, 40, 3);
      }
      g.fillStyle = "#1e4a2a";
      g.fillRect(x - 26, 176, 3, 30);
      g.fillRect(x + 23, 176, 3, 30);
      g.fillRect(x - 26, 176, 52, 3);
      for (let k = -22; k < 24; k += 4) g.fillRect(x + k, 179, 1, 22);
      for (const side of [-28, 28]) {
        g.fillStyle = "#1e4a2a";
        g.fillRect(x + side - 1, 150, 3, 28);
        g.fillStyle = "#6aff8a";
        g.beginPath();
        g.arc(x + side, 148, 5, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = "#e8fff0";
        g.fillRect(x + side - 2, 145, 2, 2);
      }
      g.fillStyle = "#14141a";
      g.fillRect(x - 30, 164, 60, 11);
      text("SUBWAY", x, 170, "#e8e8e8", "center", "");
    },
    start: async () => {
      writeSave("subwayGate", 0);
      charlie.x = 60;
      charlie.facing = 1;
      await fadeTo(0, 1);
      await say(charlie, "샘은 분명 이쪽으로 갔어. 그리고 그 개구리 녀석도...");
      await say(charlie, "츄르를 되찾아야 해. 샘을 부를 수 있는 건 그것뿐이야.");
      S.help = 6;
      S.control = true;
    },
  };
  return sc;
};

/** 지하철역 */
SCENES.subway = (checkpoint) => {
  const F = S.flags;
  F.light = F.light ?? 1;
  type Frog = Actor & { a: number; b: number; pause: number; alert: number };
  const mkFrog = (x: number, a: number, b: number): Frog =>
    Object.assign(mkActor("person", x, 1, { look: FROGMAN, lookId: "frog", role: "frog" as const }), { a, b, pause: 0, alert: 0 });
  const frogs: Frog[] = [mkFrog(560, 470, 700), mkFrog(980, 860, 1180), mkFrog(1300, 1220, 1460)];
  const king = mkActor("person", SUBWAY.den, 1, { look: FROG_KING, lookId: "frogking", pose: "sit", role: "frog", state: "sleep" });
  let chase = false;
  let chaseDelay = 0;
  let caught = false;
  let gateOpen = false;
  const spotted = (f: Frog): boolean => {
    if (S.hidden || caught) return false;
    const d = charlie.x - f.x;
    const dist = Math.abs(d);
    const front = Math.sign(d) === f.facing;
    if (F.light && front && dist < 140) return true;
    // 발소리는 등 뒤에서도 들린다. 살금살금이면 등 뒤로 지나갈 수 있다
    if (dist < 30 && charlie.moving && !sneaking()) return true;
    return front && dist < 14;
  };
  const busted = async (who: Actor) => {
    if (caught) return;
    caught = true;
    S.control = false;
    sfx.croak();
    who.bubble = "개굴!!";
    await tween(who, charlie.x - 8 * Math.sign(charlie.x - who.x), GROUND, 0.35, 26);
    shake(0.6);
    gameOver("GAME OVER", "개구리 인간들에게 소지품을 몽땅 털렸다...", checkpointNow2());
  };
  const checkpointNow2 = () => (F.gotTreats ? 1360 : F.cp2 ? 1180 : 0);
  const pillarHide = (x: number): Hotspot & { cover?: { kind: CoverKind; back: boolean } } => ({
    cover: { kind: "pillar", back: false },
    x,
    iconY: 150,
    label: "숨기",
    range: 18,
    enabled: () => !S.hidden && !chase,
    use: async () => {
      charlie.x = x;
      S.hidden = true;
      charlie.visible = false;
      charlie.hideLook = true;
      sfx.step();
    },
  });

  const sc: Scene = {
    id: "subway",
    width: SUBWAY.width,
    bg: buildSubway(),
    ambient: 0.82,
    useLight: true,
    tint: "rgba(20,40,30,0.12)",
    lights: () => {
      const L: Light[] = SUBWAY.lights.map((x, i): Light => {
        const broken = i % 3 === 1;
        const flick = broken ? (Math.sin(clock.t * 23 + i) > 0.6 ? 0.6 : 0) : 0.55;
        return { x, y: 32, r: broken ? 70 : 80, a: flick, warm: flick ? "rgba(200,255,220,0.05)" : undefined };
      });
      const cone = flashCone(160, 0.3);
      if (cone) L.push(cone);
      L.push({ x: charlie.x, y: charlie.y - 24, r: F.light ? 36 : 24, a: 0.5 });
      return L;
    },
    minX: 30,
    maxX: SUBWAY.exit - 10,
    get actors() {
      return [...frogs, king];
    },
    hotspots: [
      ...SUBWAY.pillars.map(pillarHide),
      { ...pillarHide(SUBWAY.train[0] + 131), label: "열차에 숨기" },
      {
        x: SUBWAY.tv,
        iconY: 80,
        label: "TV 보기",
        enabled: () => !chase,
        use: async () => {
          await caption("치직... 「운석 낙하 이후 뉴욕 전역에서 원인 불명의 변이가 보고되고 있습니다.」");
          await caption("「일부 시민은 아무 증상이 없는 '면역자'로 추정되며, 당국은 이들을 찾고 있...」 치지직.");
          await say(charlie, "...나 아무렇지도 않은데. 설마 내가?");
        },
      },
      {
        x: SUBWAY.ad,
        iconY: 88,
        label: "살펴보다",
        enabled: () => !chase,
        use: async () => {
          await caption("「야근은 열정이다! 블랙컴퍼니(주) 인재 상시 채용」");
          await say(charlie, "...우리 회사 광고잖아. 세상이 망해도 이건 그대로네.");
        },
      },
      {
        x: 1380,
        iconY: 92,
        label: "살펴보다",
        enabled: () => !chase,
        use: async () => {
          await caption("「실종 고양이를 찾습니다」 전단지가 수십 장 붙어 있다.");
          await say(charlie, "나만 고양이를 찾는 게 아니구나...");
        },
      },
      {
        x: SUBWAY.treats,
        iconY: 186,
        label: "츄르 되찾기",
        range: 20,
        enabled: () => !F.gotTreats && !chase,
        use: async () => {
          await walkTo(charlie, SUBWAY.treats, 30);
          charlie.facing = -1;
          F.gotTreats = 1;
          F.treats = 1;
          sfx.item();
          await caption("훔친 물건 더미 속에서 샘의 츄르를 찾았다!");
          await caption("그 옆, 묶여 있는 자루 하나가 꿈틀거린다. 자루에 붙은 쪽지: 「흰 고양이 1마리 — 블랙컴퍼니 납품용」");
          sfx.meow();
          emote(charlie, "!");
          await say(charlie, "이 울음소리... 샘?!");
          await wait(0.4);
          king.state = "awake";
          king.pose = null;
          king.facing = 1;
          sfx.croak();
          shake(0.6);
          king.bubble = "개구우우울!!";
          emote(charlie, "💧");
          await say(charlie, "...깼다.");
          king.bubble = null;
          shake(0.3);
          await caption("개구리 왕이 펄쩍 뛰는 순간 자루가 찢어지고, 하얀 그림자가 출구 쪽으로 쏜살같이 달아났다!");
          await say(charlie, "샘! 기다려!");
          writeSave("subway", 1360);
          await caption("도망쳐! (Shift 달리기) 출구는 오른쪽 개찰구 너머다.");
          chase = true;
        },
      },
      {
        x: SUBWAY.turnstile - 10,
        iconY: 172,
        label: "넘기",
        range: 22,
        enabled: () => !gateOpen,
        use: async () => {
          if (!F.gotTreats) {
            await say(charlie, "츄르를 되찾기 전엔 못 나가.");
            return;
          }
          gateOpen = true;
          charlie.pose = "armsUp";
          sfx.step();
          await tween(charlie, SUBWAY.turnstile + 18, GROUND, 0.35, 14);
          charlie.pose = null;
        },
      },
    ],
    zones: [
      {
        x: 300,
        dir: 1,
        run: async () => {
          await say(charlie, "어둡군... 저 안쪽에서 뭔가 움직여.");
          await caption("개구리 인간들은 빛을 보면 달려든다. F키(휴대폰은 '불' 버튼)로 손전등을 끄고 지나가자.");
          await caption("불을 끄면 녀석들의 눈만 보인다. 기둥 뒤에 [Space]로 숨어서 녀석이 앞을 지나가게 하자.");
          await caption("녀석이 지나가면 등 뒤로 살금살금(↓) 빠져나가자. 정면으로 마주치면 들킨다.");
        },
      },
      {
        x: 1180,
        dir: 1,
        when: () => !F.cp2,
        run: async () => {
          F.cp2 = 1;
          writeSave("subway", 1180);
          await say(charlie, "저기... 물건이 산더미처럼 쌓여 있어. 녀석들의 소굴이야.");
          await caption("커다란 개구리가 물건 더미 위에서 자고 있다. 불을 끄고 살금살금 다가가자.");
        },
      },
      {
        x: SUBWAY.turnstile - 14,
        dir: 1,
        repeat: true,
        when: () => !gateOpen,
        run: async () => {
          if (!F.gotTreats) {
            await say(charlie, "츄르를 되찾기 전엔 못 나가.");
            await walkTo(charlie, SUBWAY.turnstile - 30, 60);
            return;
          }
          gateOpen = true;
          charlie.pose = "armsUp";
          sfx.step();
          await tween(charlie, SUBWAY.turnstile + 18, GROUND, 0.3, 14);
          charlie.pose = null;
        },
      },
      {
        x: SUBWAY.exit - 30,
        dir: 1,
        when: () => !!F.gotTreats,
        run: async () => {
          chase = false;
          charlie.facing = 1;
          charlie.anim = { prefix: "stair", frames: 8, fps: 10 };
          for (let st = 0; st < 7; st++) {
            sfx.step();
            await tween(charlie, charlie.x + 9, charlie.y - 10, 0.2, 0);
          }
          charlie.anim = null;
          await goScene("rooftop");
        },
      },
    ],
    update: (dt) => {
      if (!S.control) return;
      // 보초 개구리: 왔다 갔다 하며 앞을 본다 (추격이 시작되면 왕에게 맡기고 멈춘다)
      for (const f of chase ? [] : frogs) {
        if (f.alert > 0) {
          f.alert -= dt;
          if (f.alert <= 0) void busted(f);
          continue;
        }
        if (spotted(f)) {
          f.alert = 0.35;
          f.bubble = "!";
          sfx.croak();
          continue;
        }
        if (f.pause > 0) {
          f.pause -= dt;
          f.moving = false;
          continue;
        }
        const target = f.facing > 0 ? f.b : f.a;
        const step = Math.sign(target - f.x) * 22 * dt;
        f.x += step;
        f.walkDist += Math.abs(step);
        f.moving = true;
        if (Math.abs(target - f.x) < 1) {
          f.facing = f.facing > 0 ? -1 : 1;
          f.pause = 1.2 + Math.random();
        }
      }
      // 개구리 왕: 자는 중엔 빛에 깬다, 깨어나면 쫓아온다
      if (king.state === "sleep") {
        const d = Math.abs(charlie.x - king.x);
        if (F.light && d < 120 && !S.hidden) {
          king.state = "awake";
          king.pose = null;
          void busted(king);
        }
      } else if (chase) {
        if (chaseDelay > 0) {
          chaseDelay -= dt;
          return;
        }
        const d = charlie.x - king.x;
        king.hop = (king.hop ?? 0) + dt;
        const step = Math.sign(d) * 80 * dt;
        king.x += step;
        king.walkDist += Math.abs(step);
        king.moving = true;
        king.facing = d > 0 ? 1 : -1;
        king.y = GROUND - Math.abs(Math.sin((king.hop ?? 0) * 7)) * 10;
        if (Math.abs(d) < 14) void busted(king);
      }
    },
    overlay: (camX) => {
      // 어둠 속에서 빛나는 개구리 눈
      for (const f of [...frogs, king]) {
        const sx = Math.round(f.x - camX);
        if (sx < -20 || sx > W + 20) continue;
        const ey = Math.round(f.y) - 48 - (f === king && king.state === "sleep" ? -10 : 0);
        const blink = Math.floor(clock.t * 2 + f.x) % 7 === 0;
        if (blink || (f === king && king.state === "sleep")) continue;
        g.fillStyle = ((f as { alert?: number }).alert ?? 0) > 0 ? "#ff4a3a" : "#e8f04a";
        g.fillRect(sx - 1 + f.facing * 1, ey, 2, 1);
        g.fillRect(sx + 4 + f.facing * 1, ey, 2, 1);
      }
      if (king.state === "sleep") {
        const sx = king.x - camX;
        for (let i = 0; i < 3; i++) {
          const k = (clock.t * 0.4 + i / 3) % 1;
          text("z", sx + 10 + k * 12, GROUND - 46 - k * 24, `rgba(180,255,180,${(1 - k).toFixed(2)})`, "center", "");
        }
      }
      if (!F.gotTreats) {
        const sx = SUBWAY.treats - camX;
        if (Math.floor(clock.t * 3) % 3 === 0) {
          g.fillStyle = "#ff8ab8";
          g.fillRect(Math.round(sx), 204, 2, 2);
        }
      }
      text(F.light ? "손전등 켜짐 [F]" : "손전등 꺼짐 [F]", 8, H - 26, F.light ? "#ffd36a" : "#8a8aa0", "left");
    },
    start: async () => {
      charlie.y = GROUND;
      if (checkpoint > 0) {
        charlie.x = checkpoint;
        for (const z of sc.zones) if (z.dir > 0 && z.x < checkpoint && !z.repeat) z.fired = true;
        if (checkpoint >= 1360) {
          // 츄르를 들고 도망치는 장면부터
          F.gotTreats = 1;
          F.treats = 1;
          king.state = "awake";
          king.pose = null;
          king.x = charlie.x - 120;
          king.facing = 1;
          chase = true;
          chaseDelay = 1.2;
        }
        await fadeTo(0, 0.6);
        S.control = true;
        return;
      }
      writeSave("subway", 0);
      charlie.x = 60;
      charlie.facing = 1;
      await fadeTo(0, 1);
      await say(charlie, "물 비린내... 그리고 개구리 울음소리.");
      S.control = true;
    },
  };
  return sc;
};

/** 제2장 끝: 지상으로 */
SCENES.rooftop = () => {
  const info = buildStreet(600, true, 47, false);
  let ufo = -1;
  const sc: Scene = {
    id: "rooftop",
    width: 600,
    bg: info.canvas,
    ambient: 0.6,
    tint: "rgba(120,30,10,0.12)",
    lights: () => {
      const L: Light[] = [...lampLights(info, true)];
      if (ufo >= 0) L.push({ x: 300 + Math.sin(ufo * 0.8) * 120, y: 10, r: 170, a: 0.6, warm: "rgba(120,255,160,0.18)" });
      return L;
    },
    minX: 40,
    maxX: 560,
    actors: [],
    hotspots: [],
    zones: [],
    update: (dt) => {
      if (ufo >= 0) ufo += dt;
    },
    back: (camX) => drawFires(info.fires, camX),
    front: (camX) => {
      if (ufo < 0) return;
      const ux = 300 + Math.sin(ufo * 0.8) * 120 - camX;
      g.fillStyle = "rgba(140,255,170,0.16)";
      g.beginPath();
      g.moveTo(ux - 10, 30);
      g.lineTo(ux + 10, 30);
      g.lineTo(ux + 70, 210);
      g.lineTo(ux - 70, 210);
      g.fill();
      g.fillStyle = "#3a3a46";
      g.beginPath();
      g.ellipse(ux, 24, 36, 8, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = "#8a9ab0";
      g.beginPath();
      g.ellipse(ux, 18, 14, 7, 0, Math.PI, 0);
      g.fill();
      for (let i = 0; i < 6; i++) {
        g.fillStyle = Math.floor(clock.t * 6 + i) % 2 ? "#aaffcc" : "#2a6a4a";
        g.fillRect(Math.round(ux - 28 + i * 11), 25, 3, 2);
      }
    },
    start: async () => {
      unlock(2);
      writeSave("rooftop", 0);
      charlie.x = 120;
      charlie.facing = 1;
      sam.visible = false;
      await fadeTo(0, 1);
      await say(charlie, "하아... 하아... 따돌렸나.");
      await say(charlie, "샘이 먼저 이쪽으로 올라왔을 거야. 개구리 녀석들, 샘을 블랙컴퍼니에 팔아넘기려고...");
      await say(charlie, "(츄르 봉지를 흔든다) 샘~ 츄르 있다~");
      S.flags.samFed = 1;
      sfx.meow();
      await wait(0.6);
      sam.visible = true;
      sam.x = 380;
      sam.y = 150;
      sam.facing = -1;
      sam.pose = "sit";
      emote(charlie, "!");
      await say(charlie, "샘!! 거기 있었구나!");
      await walkTo(charlie, 330, 60);
      ufo = 0;
      shake(0.5);
      sfx.boom();
      await wait(1.2);
      sam.pose = "startle";
      await caption("하늘에서 이상한 초록빛이 내려왔다.");
      emote(charlie, "?");
      await say(charlie, "...이번엔 또 뭐야.");
      sam.pose = "jump";
      sam.facing = 1;
      await tween(sam, 470, 120, 0.6, 30);
      await tween(sam, 640, 100, 0.6, 30);
      sam.visible = false;
      await say(charlie, "샘! 그쪽으로 가면 안 돼!");
      F_end2();
      await fadeTo(1, 1.6);
      await chapterCard("제2장 끝", "");
      await goScene("roofs", 0, false);
    },
  };
  return sc;
};

function F_end2(): void {
  S.flags.ch2 = 1;
  unlock(3);
  writeSave("end2", 0);
}

// ═════════════════════════════════════════════════════════
// 제3장: 지붕 위의 추격 → 생존자들의 교회
// ═════════════════════════════════════════════════════════

/** 초록빛 비행접시와 빛기둥 (beamX 가 null 이면 빛을 끈다) */
function drawUfo(ux: number, beamX: number | null, camX: number): void {
  const sx = ux - camX;
  if (beamX !== null) {
    const bx = beamX - camX;
    const gr = g.createLinearGradient(0, 30, 0, 214);
    gr.addColorStop(0, "rgba(170,255,200,0.34)");
    gr.addColorStop(1, "rgba(120,255,170,0.14)");
    g.fillStyle = gr;
    g.beginPath();
    g.moveTo(sx - 8, 30);
    g.lineTo(sx + 8, 30);
    g.lineTo(bx + 18, 214);
    g.lineTo(bx - 18, 214);
    g.closePath();
    g.fill();
    g.fillStyle = "rgba(180,255,210,0.35)";
    g.beginPath();
    g.ellipse(bx, 214, 20, 3, 0, 0, Math.PI * 2);
    g.fill();
    for (let i = 0; i < 8; i++) {
      const k = (clock.t * 0.6 + i / 8) % 1;
      g.fillStyle = `rgba(210,255,225,${((1 - k) * 0.85).toFixed(2)})`;
      g.fillRect(half(bx - 12 + ((i * 37) % 24) + (sx - bx) * k * 0.8), half(212 - k * 170), 1, 1);
    }
  }
  const bob = Math.sin(clock.t * 2) * 1.5;
  g.fillStyle = "rgba(140,255,170,0.18)";
  g.beginPath();
  g.ellipse(sx, 26 + bob, 44, 12, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#2e2e3a";
  g.beginPath();
  g.ellipse(sx, 24 + bob, 36, 8, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#5a5a6a";
  g.beginPath();
  g.ellipse(sx, 22 + bob, 34, 5, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = "#9ab8c8";
  g.beginPath();
  g.ellipse(sx, 18 + bob, 14, 7, 0, Math.PI, 0);
  g.fill();
  g.fillStyle = "rgba(255,255,255,0.6)";
  g.fillRect(half(sx - 8), half(13 + bob), 4, 1);
  for (let i = 0; i < 7; i++) {
    g.fillStyle = Math.floor(clock.t * 6 + i) % 2 ? "#aaffcc" : "#2a6a4a";
    g.fillRect(half(sx - 30 + i * 10), half(25 + bob), 3, 1.5);
  }
}

SCENES.roofs = (checkpoint) => {
  const segs: Array<[number, number]> = [];
  {
    let a = 0;
    for (const [x0, x1] of ROOFS.gaps) {
      segs.push([a, x0]);
      a = x1;
    }
    segs.push([a, ROOFS.width]);
  }
  const segOf = (x: number) => Math.max(0, segs.findIndex(([a, b]) => x >= a - 2 && x <= b + 2));
  const SAM_SPOTS = [380, 860, 1340, 1720, ROOFS.skylight];
  const cpOf = (i: number) => (i === 0 ? 60 : segs[i][0] + 24);
  let beamOn = false;
  let bx = 200;
  let dir = 1;
  let blind = 0;
  let hunting = false;
  /** 다른 지붕으로 날아가는 중 (빛을 끈다) */
  let flying = false;
  let ufoX = 120;
  let lock = 0;
  let grace = 0;
  let jumping = false;
  let caught = false;
  let hinted = false;
  let samStage = 0;
  let samBusy = false;
  let saved = 0;

  /** 빛기둥: 평소엔 지붕을 오가며 훑고, 찰리를 보면 쫓아온다. 숨으면 놓치고 지나간다 */
  const moveBeam = (dt: number) => {
    const i = Math.min(segOf(charlie.x), segs.length - 2);
    const lo = segs[i][0] + 20;
    const hi = segs[i][1] - 20;
    blind = Math.max(0, blind - dt);
    const visible = !S.hidden && !jumping && grace <= 0;
    // 쫓던 중에 숨으면 놓친다: 잠시 엉뚱한 곳을 훑는다
    if (hunting && S.hidden) blind = 3.2;
    const seen = visible && blind <= 0 && Math.abs(charlie.x - bx) < 140;
    hunting = seen;
    let target: number;
    let speed: number;
    if (flying || bx < lo - 1 || bx > hi + 1) {
      // 찰리가 다음 지붕으로 건너가면 비행접시가 앞질러 가서 반대편부터 훑는다
      flying = true;
      hunting = false;
      target = hi;
      speed = 230;
      if (Math.abs(bx - hi) < 1) {
        flying = false;
        dir = -1;
        sfx.beam();
      }
    } else if (seen) {
      target = charlie.x;
      speed = 72;
      if (Math.abs(target - bx) > 2) dir = target > bx ? 1 : -1;
    } else {
      target = dir > 0 ? hi : lo;
      speed = 58;
      if (Math.abs(bx - target) < 1) dir = -dir;
    }
    probe.hunt = seen ? 1 : 0;
    probe.blind = blind;
    probe.flying = flying ? 1 : 0;
    bx += Math.sign(target - bx) * Math.min(Math.abs(target - bx), speed * dt);
  };
  const abduct = async () => {
    if (caught) return;
    caught = true;
    S.control = false;
    S.hidden = false;
    charlie.visible = true;
    charlie.pose = "armsUp";
    sfx.beam();
    flash("#aaffcc", 0.5);
    await tween(charlie, charlie.x, 110, 1.3, 0);
    gameOver("GAME OVER", "초록빛에 빨려 올라갔다... 눈을 떠 보니 다시 지붕 위였다.", cpOf(segOf(charlie.x)));
  };
  const samRun = async () => {
    samBusy = true;
    const s0 = samStage;
    const [ga, gb] = ROOFS.gaps[s0];
    sam.pose = "startle";
    sfx.meow();
    await wait(0.35);
    sam.facing = 1;
    await walkTo(sam, ga - 6, 110);
    sam.pose = "jump";
    await tween(sam, gb + 8, GROUND, 0.45, 22);
    sam.pose = null;
    await walkTo(sam, SAM_SPOTS[s0 + 1], 95);
    sam.facing = -1;
    sam.pose = "sit";
    samStage = s0 + 1;
    samBusy = false;
  };
  const landed = () => {
    const i = segOf(charlie.x);
    if (i > saved) {
      saved = i;
      writeSave("roofs", cpOf(i));
    }
  };
  const tryJump = (to: number) => {
    if (running()) {
      jumping = true;
      void cutscene(async () => {
        charlie.pose = "walk3";
        sfx.step();
        await tween(charlie, to, GROUND, 0.55, 26);
        charlie.pose = null;
        sfx.step();
        shake(0.15);
        jumping = false;
        grace = 1.2;
        landed();
      });
    } else if (!hinted) {
      hinted = true;
      void cutscene(() => say(charlie, "틈이 너무 넓어... 달려서(Shift) 뛰어넘어야겠어."));
    }
  };

  const sc: Scene = {
    id: "roofs",
    width: ROOFS.width,
    bg: buildRoofs(),
    ambient: 0.3,
    tint: "rgba(120,30,10,0.10)",
    lights: () => {
      const L: Light[] = [{ x: charlie.x, y: charlie.y - 24, r: 40, a: 0.35 }];
      if (beamOn && !flying) L.push({ x: bx, y: 190, r: 70, a: 0.8, warm: "rgba(120,255,170,0.16)" });
      return L;
    },
    minX: 30,
    maxX: ROOFS.width - 30,
    actors: [],
    hotspots: [photoSpot("p9", 1480, 176, "버려진 카메라"), ...ROOFS.cover.map(
      (cv): Hotspot & { cover?: { kind: CoverKind; back: boolean } } => ({
        cover: { kind: cv.kind === "tank" ? "tank" : cv.kind === "chimney" ? "chimney" : "stairbox", back: false },
        x: cv.x,
        iconY: 130,
        label: cv.kind === "tank" ? "물탱크 밑에 숨기" : cv.kind === "chimney" ? "굴뚝 뒤에 숨기" : "계단실 그늘에 숨기",
        range: 20,
        enabled: () => !S.hidden && !jumping && beamOn,
        use: async () => {
          charlie.x = cv.x;
          S.hidden = true;
          charlie.visible = false;
          charlie.hideLook = true;
          sfx.step();
        },
      }),
    )],
    zones: [
      {
        x: ROOFS.skylight - 40,
        dir: 1,
        run: async () => {
          await until(() => samStage >= 4);
          beamOn = false;
          await say(charlie, "하아... 하아... 샘!");
          sam.pose = "jump";
          await tween(sam, ROOFS.skylight - 4, 204, 0.35, 12);
          sam.visible = false;
          sfx.glass();
          emote(charlie, "?");
          await say(charlie, "채광창 안으로 들어갔어... 여긴, 교회?");
          await walkTo(charlie, ROOFS.skylight - 8, 40);
          await say(charlie, "...에라, 모르겠다!");
          charlie.pose = "armsUp";
          await tween(charlie, ROOFS.skylight - 4, 300, 0.5, 10);
          await goScene("church");
        },
      },
    ],
    update: (dt) => {
      if (!beamOn) bx -= 150 * dt;
      else if (S.control && !caught) moveBeam(dt);
      ufoX += (bx - 30 - ufoX) * Math.min(1, dt * 1.5);
      probe.bx = bx;
      probe.beam = beamOn ? 1 : 0;
      if (!S.control || caught) return;
      grace = Math.max(0, grace - dt);
      // 건물 사이 틈
      if (!jumping && !S.hidden) {
        const ax = axis();
        for (const [a, b] of ROOFS.gaps) {
          if (ax > 0 && charlie.x > a - 5 && charlie.x < a + 12) {
            charlie.x = a - 5;
            tryJump(b + 12);
          } else if (ax < 0 && charlie.x < b + 5 && charlie.x > b - 12) {
            charlie.x = b + 5;
            tryJump(a - 12);
          }
        }
      }
      // 샘은 찰리가 다가오면 다음 지붕으로 달아난다
      if (!samBusy && samStage < 4 && charlie.x > SAM_SPOTS[samStage] - 90) void samRun();
      // 빛기둥
      if (beamOn && !flying && segOf(charlie.x) < segs.length - 1 && !S.hidden && !jumping && grace <= 0 && Math.abs(charlie.x - bx) < 17) {
        lock += dt;
        if (lock > 0.14) void abduct();
      } else lock = Math.max(0, lock - dt * 2);
    },
    overlay: (camX) => {
      if (beamOn || Math.abs(ufoX - S.camX) < W + 60) drawUfo(ufoX, beamOn && !flying ? bx : null, camX);
      if (lock > 0) {
        g.fillStyle = `rgba(170,255,200,${Math.min(0.5, lock * 3).toFixed(2)})`;
        g.fillRect(0, 0, W, H);
      }
    },
    start: async () => {
      unlock(3);
      charlie.y = GROUND;
      sam.visible = true;
      sam.y = GROUND;
      sam.pose = "sit";
      sam.facing = -1;
      if (checkpoint > 0) {
        charlie.x = checkpoint;
        charlie.facing = 1;
        const i = segOf(checkpoint);
        saved = i;
        samStage = i;
        sam.x = SAM_SPOTS[i];
        beamOn = true;
        dir = 1;
        bx = segs[i][1] - 60;
        ufoX = bx;
        grace = 1.5;
        S.camX = Math.max(0, charlie.x - W / 2);
        await fadeTo(0, 0.6);
        S.control = true;
        return;
      }
      writeSave("roofs", 0);
      charlie.x = 60;
      charlie.facing = 1;
      sam.x = SAM_SPOTS[0];
      await fadeTo(0, 1);
      await chapterCard("제3장", "지붕 위의 추격");
      await say(charlie, "샘! 거기 가만히 있어!");
      sfx.meow();
      ufoX = 200;
      bx = 320;
      dir = 1;
      beamOn = true;
      sfx.beam();
      shake(0.3);
      await wait(1.2);
      await caption("초록빛이 지붕을 훑고 지나간다. 마치 샘을 찾는 것처럼.");
      await caption("빛에 닿으면 끌려 올라간다! 물탱크·굴뚝·계단실 앞에서 [Space]로 숨어 빛이 지나가길 기다리자.");
      await caption("건물 사이 틈은 달리면서(Shift) 뛰어넘을 수 있다.");
      S.help = 8;
      S.control = true;
    },
  };
  return sc;
};

SCENES.church = (checkpoint) => {
  const F = S.flags;
  const tomas = mkActor("person", CHURCH.tomas, 1, { look: TOMAS, lookId: "tomas", pose: "stand" });
  const tony = mkActor("person", 400, 1, { look: TONY, lookId: "tony", pose: "stand" });
  const garcia = mkActor("person", 500, -1, { look: GARCIA, lookId: "garcia", pose: "stand" });
  const ruth = mkActor("person", CHURCH.ruth, 1, { look: RUTH, lookId: "ruth", pose: "stand" });
  const lily = mkActor("person", CHURCH.lily, -1, { look: LILY, lookId: "lily", pose: "stand", build: BUILD_KID });
  type Agent = Actor & { a: number; b: number; pause: number; alert: number };
  const agents: Agent[] = [];
  let raid = false;
  let caught = false;
  let ending = false;

  const spotted = (f: Agent): boolean => {
    if (S.hidden || caught) return false;
    const d = charlie.x - f.x;
    const dist = Math.abs(d);
    const front = Math.sign(d) === f.facing;
    if (front && dist < 100) return true;
    if (dist < 28 && charlie.moving && !sneaking()) return true;
    return dist < 12;
  };
  const busted = async (who: Actor) => {
    if (caught) return;
    caught = true;
    S.control = false;
    who.bubble = "면역자 발견!";
    sfx.siren();
    await walkTo(who, charlie.x - 14 * Math.sign(charlie.x - who.x), 90);
    shake(0.4);
    gameOver("GAME OVER", "특별대응단에게 붙잡혀 격리 센터로 끌려갔다...", 1);
  };
  const talkDone = () => !!(F.c3ruth && F.c3lily && F.c3radio && F.medGiven);
  const beginRaid = async () => {
    raid = true;
    sfx.boom();
    shake(0.6);
    for (const [a, b] of [[110, 400], [330, 620]]) {
      agents.push(Object.assign(mkActor("person", CHURCH.door + agents.length * 50, 1, { look: HAZMAT, lookId: "hazmat", role: "agent" as const, torch: true }), { a, b, pause: 0, alert: 0 }));
    }
    await caption("쾅! 문이 부서지듯 열리고, 방호복 차림의 요원들이 들이닥쳤다.");
    await caption("손전등에 비치지 않게 의자 밑에 숨어 가며, 고해실까지 가자. 가까이에선 ↓(살금살금)로 걷자.");
  };
  const startRaid = async () => {
    sfx.siren();
    shake(0.3);
    emote(charlie, "!");
    emote(ruth, "!");
    emote(tomas, "!");
    await caption("밖에서 사이렌이 울린다. 확성기 소리가 교회 벽을 울렸다.");
    await caption("「특별대응단이다. 면역자 검사를 실시한다. 즉시 문을 열어라.」");
    await say(ruth, "찰리, 넌 명단에 없어. 들키면 그대로 끌려가. 저 고해실에 숨어!");
    await say(tomas, "릴리, 제단 뒤로! 소리 내지 마.");
    void walkTo(lily, CHURCH.altar + 14, 70).then(() => {
      lily.visible = false;
    });
    sam.pose = "jump";
    await tween(sam, charlie.x + 2, GROUND - 18, 0.4, 16);
    sam.visible = false;
    await caption("샘이 찰리의 품으로 뛰어들었다.");
    await Promise.all([walkTo(ruth, 130, 80), walkTo(tomas, 170, 80)]);
    ruth.pose = "stand";
    tomas.pose = "stand";
    ruth.facing = -1;
    tomas.facing = -1;
    F.raid = 1;
    writeSave("church", 1);
    await beginRaid();
  };
  const after = async () => {
    if (talkDone() && !raid && !F.raid) await startRaid();
  };
  const talk = (a: Actor, label: string, fn: () => Promise<void>): Hotspot => ({
    get x() {
      return a.x;
    },
    iconY: 136,
    label,
    range: 30,
    enabled: () => !raid && !ending && a.visible,
    use: async () => {
      charlie.facing = a.x > charlie.x ? 1 : -1;
      a.facing = a.x > charlie.x ? -1 : 1;
      await fn();
      await after();
    },
  });

  const finale = async () => {
    ending = true;
    raid = false;
    S.hidden = true;
    charlie.visible = false;
    charlie.x = CHURCH.confessional;
    await caption("고해실 칸막이 틈으로 밖이 보인다. 숨소리조차 크게 들린다.");
    const [a1, a2] = agents;
    a1.bubble = a2.bubble = null;
    await Promise.all([walkTo(a1, 150, 40), walkTo(a2, CHURCH.confessional + 26, 34)]);
    a2.facing = -1;
    await wait(0.7);
    await caption("품 안에서 샘이 꿈틀거린다. 안 돼, 샘... 조금만...");
    focusCam(CHURCH.confessional + 10, 1.4);
    await say(a2, "...이 안에 누구 있나?");
    focusCam(null, 1);
    emote(a2, "?");
    await say(ruth, "거긴 비었어요! 찾는 게 면역자라면... 나예요.");
    a2.facing = -1;
    await walkTo(a2, 160, 60);
    a2.facing = -1;
    await say(a1, "체온 정상. 혈중 반응 양성. 면역자 확인.");
    await say(tomas, "콜록, 콜록... 저, 저는 열이 나요. 감염됐나 봐요.");
    await say(a1, "감염자는 관심 없다. 노인, 이송한다.");
    await say(tomas, "루스!");
    await say(ruth, "토마스, 애들 부탁해.");
    ruth.facing = 1;
    emote(ruth, "♥");
    await say(ruth, "...저기 덩치 큰 애도.");
    await Promise.all([walkTo(a1, CHURCH.door - 10, 40), walkTo(ruth, CHURCH.door, 40), walkTo(a2, CHURCH.door + 10, 40)]);
    a1.visible = a2.visible = ruth.visible = false;
    sfx.boom();
    shake(0.3);
    await wait(1.2);
    S.hidden = false;
    charlie.visible = true;
    charlie.facing = -1;
    sfx.step();
    lily.visible = true;
    lily.x = CHURCH.altar - 10;
    await walkTo(lily, 330, 70);
    emote(lily, "💧");
    await say(lily, "루스 할머니...");
    sam.visible = true;
    sam.x = charlie.x + 10;
    sam.y = GROUND;
    sam.pose = null;
    await walkTo(sam, lily.x - 14, 60);
    sam.facing = 1;
    sam.pose = "butt";
    sfx.purr();
    await caption("샘이 릴리의 다리에 머리를 비볐다.");
    await walkTo(tomas, 280, 50);
    await say(tomas, "격리 센터는 허드슨 강변의 옛 컨벤션 센터야. 거기 끌려간 사람은... 아무도 돌아오지 않았어.");
    charlie.facing = 1;
    await say(charlie, "루스 할머니는 저를 숨겨 주셨어요. 저 대신 나가신 거예요.");
    focusCam(charlie.x, 1.3);
    await say(charlie, "...제가 데려올게요.");
    sam.pose = "sit";
    sam.facing = -1;
    sfx.meow();
    await say(charlie, "그래, 샘. 이번엔 같이 가자.");
    F.ch3 = 1;
    unlock(4);
    writeSave("end3", 0);
    await fadeTo(1, 1.6);
    await say(tomas, "그런데 찰리, 격리 센터는 블랙컴퍼니 사원증 없이는 근처에도 못 가.");
    await say(charlie, "...내 사원증. 회사 책상 서랍에 두고 왔어요. 회사가 여기서 멀지 않아요.");
    await say(lily, "아저씨, 아까 라디오에서 박물관 박사님이 초록빛 얘기를 했어요. '그건 고양이를 부르는 신호'래요.");
    await say(charlie, "...샘을 부르는 그 빛이 뭔지 알아야 해. 가는 길에 박물관부터 들르자.");
    await chapterCard("제3장 끝", "");
    await goScene("mLobby", 70, false);
  };

  const hideSpot = (x: number): Hotspot & { cover?: { kind: CoverKind; back: boolean } } => ({
    cover: { kind: "pew", back: false },
    x,
    iconY: 158,
    label: "의자 뒤에 웅크리기",
    range: 18,
    enabled: () => raid && !S.hidden,
    use: async () => {
      charlie.x = x;
      S.hidden = true;
      charlie.visible = false;
      charlie.hideLook = true;
      sfx.step();
    },
  });

  const sc: Scene = {
    id: "church",
    width: CHURCH.width,
    back: (camX) => {
      const x = 905 - camX;
      g.fillStyle = "#2a1a12";
      g.fillRect(x - 12, 168, 24, 46);
      g.fillStyle = "#4a3020";
      g.fillRect(x - 10, 170, 20, 44);
      g.fillStyle = "#1a100a";
      for (let k = 0; k < 4; k++) g.fillRect(x - 10 + k * 5, 170, 0.6, 44);
      g.fillStyle = "#c8a83a";
      g.fillRect(x + 6, 190, 2, 3);
      text("지하", x, 162, "#c8b890", "center");
    },
    bg: buildChurch(),
    ambient: 0.55,
    tint: "rgba(30,20,50,0.10)",
    lights: () => {
      const L: Light[] = [
        { x: CHURCH.altar - 24, y: 160, r: 46, a: 0.8, warm: "rgba(255,190,110,0.14)" },
        { x: CHURCH.altar + 24, y: 160, r: 46, a: 0.8, warm: "rgba(255,190,110,0.14)" },
        { x: CHURCH.hole, y: 120, r: 90, a: 0.55, warm: "rgba(170,190,255,0.06)" },
        { x: CHURCH.radio, y: 188, r: 30, a: 0.5, warm: "rgba(255,200,120,0.08)" },
        { x: 620, y: 196, r: 40, a: 0.6, warm: "rgba(255,180,100,0.10)" },
        ...CHURCH.windows.map((x): Light => ({ x, y: 96, r: 52, a: 0.35, warm: "rgba(120,140,255,0.05)" })),
        { x: charlie.x, y: charlie.y - 24, r: 30, a: 0.3 },
      ];
      for (const f of agents) {
        if (!f.visible) continue;
        L.push({ x: f.x, y: f.y - 26, r: 34, a: 0.55 });
        if (raid) L.push(actorCone(f, 100));
      }
      return L;
    },
    minX: 40,
    maxX: CHURCH.width - 40,
    get actors() {
      return [tomas, ruth, lily, ...(raid || ending ? [] : [tony, garcia]), ...agents];
    },
    hotspots: [
      talk(ruth, "루스와 이야기", async () => {
        if (F.c3ruth && has("med")) {
          take("med");
          F.medGiven = 1;
          await say(charlie, "할머니, 성물실에서 약 찾아왔어요!");
          emote(ruth, "♥");
          await say(ruth, "고맙다, 찰리. 종 퍼즐까지 풀다니, 제법인걸.");
          await caption("루스가 릴리에게 흡입기를 건넨다. 릴리의 쌕쌕거리던 숨이 조금씩 가라앉는다.");
          emote(lily, "♥");
          await say(lily, "고마워요, 찰리 아저씨...");
          return;
        }
        if (F.c3ruth && !F.medGiven) {
          await say(ruth, "릴리 약은 지하 '성물실'에 있어. 제단 오른쪽 계단으로 내려가렴.");
          return;
        }
        if (F.c3ruth) {
          await say(ruth, "응급실에서 30년을 일했어. 세상이 망해도 할 일은 똑같아. 다친 사람을 돌보는 것.");
          return;
        }
        F.c3ruth = 1;
        await say(ruth, "운석이 떨어진 날부터 공기 중에 이상한 가루가 떠다녀. 그걸 마신 사람들이 변했지.");
        await say(ruth, "그런데 아무렇게나 변하는 게 아니야. 원래 그 사람이 붙들고 있던 걸 따라가.");
        await say(ruth, "약에 매달리던 사람은 좀비처럼, 남을 가르치려 들던 사람은 뼈만 남은 설교꾼으로, 남의 걸 탐내던 사람은 개구리로.");
        await say(charlie, "그럼... 저는 왜 멀쩡한 거죠?");
        await say(ruth, "글쎄. 아무것도 붙들지 않았거나... 딱 하나만 소중히 붙들고 있었거나.");
        await caption("루스가 샘 쪽을 보며 빙그레 웃었다.");
        await caption("그때, 릴리가 쌕쌕거리며 기침을 했다.");
        await say(ruth, "...릴리 천식약이 다 떨어졌어. 지하 성물실에 예비 약을 숨겨 뒀는데, 다리가 아파서 못 내려가겠구나.");
        await say(ruth, "찰리, 부탁 좀 하자. 제단 오른쪽 계단으로 내려가면 돼.");
        await say(charlie, "맡겨 주세요.");
      }),
      {
        x: 905,
        iconY: 150,
        label: "지하로 내려가기",
        range: 22,
        enabled: () => !raid && !ending && !!F.c3ruth,
        use: async () => {
          await walkTo(charlie, 880, 50);
          await doorTransition(905, "down", { top: 170, w: 20, col: "#4a3020" });
          await goScene("crypt1", 60);
        },
      },
      photoSpot("p6", 760, 176, "릴리의 그림"),
      talk(tomas, "토마스와 이야기", async () => {
        if (F.c3tomas) {
          await say(tomas, "문은 내가 지켜. 해골 시위대가 지나갈 때마다 바리케이드를 다시 쌓아야 하거든.");
          return;
        }
        F.c3tomas = 1;
        await say(tomas, "...잠깐. 당신, 우리 가게에서 츄르랑 손전등 가져간 사람이지?");
        charlie.pose = "armsUp";
        await say(charlie, "아... 그, 그게... 돈은 나중에 꼭...");
        charlie.pose = null;
        await say(tomas, "됐어. 세상이 망했는데 돈이 무슨 소용이야. 저 녀석이 맛있게 먹었으면 됐지.");
      }),
      talk(tony, "토니와 이야기", async () => {
        if (!F.c3tony) {
          F.c3tony = 1;
          await say(tony, "어? 4층 찰리 형! 형도 면역자였어요?");
          await say(charlie, "토니? 2B호 토니? 네 금고... 아, 아니야.");
          await say(tony, "지하철 통로에 숨어 있다가 여기로 왔어요. 개구리들이 제 배달 스쿠터 키까지 훔쳐 갔거든요.");
          await say(tony, "그거 알아요? 개구리 녀석들, 고양이를 잡아서 블랙컴퍼니에 갖다 바쳐요. 고양이 한 마리에 츄르 백 봉지래요.");
          emote(charlie, "💢");
          await say(charlie, "...그래서 샘이 자루에 들어 있었구나.");
        } else {
          await say(tony, ["형, 다 끝나면 피자 쏠게요. 페퍼로니로.", "가르시아 아줌마가 형 걱정 많이 했어요.", "제 생일 4월 12일인 거 어떻게 알았어요...?"][(F.tonyTalk = (F.tonyTalk ?? 0) + 1) % 3]);
        }
      }),
      talk(garcia, "가르시아 부인", async () => {
        if (!F.c3garcia) {
          F.c3garcia = 1;
          emote(garcia, "♥");
          await say(garcia, "찰리! 무사했구나! 우리 '작은 구름'도 찾았네!");
          await caption("가르시아 부인의 손에는 빈 새장이 들려 있다.");
          await say(garcia, "피코가... 초록빛을 보더니 창밖으로 날아가 버렸어. 새들도 그 빛을 따라가더라.");
          if (F.gotExt) {
            await say(charlie, "부인 집 소화기 덕분에 불을 끄고 빠져나왔어요. 허락도 없이 죄송해요.");
            await say(garcia, "어머, 잘했다! 그러라고 둔 거야. 넌 착한 아이야, 찰리.");
          }
          await say(garcia, "넌 모르겠지만, 네가 야근하는 동안 내가 샘한테 간식 몰래 줬단다. 호호.");
          await say(charlie, "...어쩐지 샘이 살이 쪘더라.");
        } else {
          await say(garcia, ["피코는 노래를 잘했어. 언젠가 돌아오겠지.", "찰리, 밥은 먹고 다니니? 얼굴이 반쪽이야.", "샘은 날 보면 배를 보여 준단다. 너한텐 안 보여 주지? 호호."][(F.garTalk = (F.garTalk ?? 0) + 1) % 3]);
        }
      }),
      talk(lily, "릴리와 샘", async () => {
        if (F.c3lily) {
          sfx.purr();
          await say(lily, "샘은 꼬리를 살랑살랑 흔들 때가 제일 귀여워요.");
          return;
        }
        F.c3lily = 1;
        await say(lily, "샘이 내 무릎에서 잤어요. 엄청 따뜻해요.");
        await say(lily, "아저씨도 샘 많이 쓰다듬어 주세요. (C) 고양이는 그런 걸 다 기억한대요.");
        sfx.purr();
        await say(lily, "있잖아요, 하늘에 초록빛 봤어요? 그 빛이 오면 고양이들이 막 그쪽으로 걸어가요.");
        await say(lily, "우리 동네 고양이들 다 그렇게 없어졌어요. 우리 나비도요.");
        await say(charlie, "...샘이 자꾸 도망친 게 그래서였구나.");
        await say(charlie, "걱정 마. 샘은 내가 꼭 붙잡고 있을게.");
      }),
      {
        x: CHURCH.radio,
        iconY: 160,
        label: "라디오 듣기",
        range: 20,
        enabled: () => !raid && !ending,
        use: async () => {
          F.c3radio = 1;
          await caption("치직... 「특별대응단은 면역자 보호를 위해 격리 센터로의 이송을 진행하고 있습니다.」");
          await caption("「면역자를 발견한 시민은 즉시 신고해 주십시오. 신고자에게는 깨끗한 물과 식량이...」 치지직.");
          await say(charlie, "보호해 준다는데요? 차라리 거기 가는 게...");
          await say(tomas, "데려간 사람 중에 돌아온 사람은 아무도 없어. 아무도.");
          await after();
        },
      },
      {
        x: CHURCH.windows[1],
        iconY: 150,
        label: "깨진 창문 보기",
        range: 24,
        enabled: () => !raid && !ending,
        use: async () => {
          await caption("깨진 스테인드글라스 너머로 초록빛이 천천히 맴돌고 있다.");
          await say(charlie, "아직도 저기 있어... 샘을 찾고 있는 건가.");
        },
      },
      ...CHURCH.pews.map(hideSpot),
      {
        x: CHURCH.confessional,
        iconY: 98,
        label: "고해실에 숨기",
        range: 22,
        enabled: () => raid && !ending,
        use: finale,
      },
    ],
    zones: [],
    update: (dt) => {
      if (!S.control || !raid) return;
      for (const f of agents) {
        if (f.alert > 0) {
          f.alert -= dt;
          if (f.alert <= 0) void busted(f);
          continue;
        }
        if (spotted(f)) {
          f.alert = 0.4;
          f.bubble = "!";
          sfx.blip();
          continue;
        }
        if (f.pause > 0) {
          f.pause -= dt;
          f.moving = false;
          continue;
        }
        const target = f.facing > 0 ? f.b : f.a;
        const step = Math.sign(target - f.x) * 24 * dt;
        f.x += step;
        f.walkDist += Math.abs(step);
        f.moving = true;
        if (Math.abs(target - f.x) < 1) {
          f.facing = f.facing > 0 ? -1 : 1;
          f.pause = 1.4 + Math.random();
        }
      }
    },
    start: async () => {
      charlie.y = GROUND;
      sam.visible = true;
      sam.x = CHURCH.lily + 16;
      sam.y = GROUND;
      sam.facing = -1;
      sam.pose = "sit";
      if (checkpoint === 2) {
        charlie.x = 900;
        charlie.facing = -1;
        S.camX = CHURCH.width - W;
        await fadeTo(0, 0.6);
        S.control = true;
        return;
      }
      if (checkpoint > 0) {
        Object.assign(F, { c3ruth: 1, c3lily: 1, c3radio: 1, medGiven: 1, raid: 1 });
        charlie.x = 780;
        charlie.facing = -1;
        sam.visible = false;
        lily.visible = false;
        ruth.x = 130;
        tomas.x = 170;
        ruth.facing = tomas.facing = -1;
        S.camX = Math.max(0, Math.min(CHURCH.width - W, charlie.x - W / 2));
        await fadeTo(0, 0.6);
        await beginRaid();
        S.control = true;
        return;
      }
      writeSave("church", 0);
      charlie.x = CHURCH.hole;
      charlie.y = -40;
      charlie.facing = -1;
      charlie.pose = "armsUp";
      S.camX = CHURCH.width - W;
      await fadeTo(0, 0.6);
      await tween(charlie, CHURCH.hole, GROUND, 0.5, 0);
      sfx.boom();
      shake(0.5);
      charlie.pose = null;
      await say(charlie, "으윽... 허리...");
      await walkTo(tomas, charlie.x - 40, 110);
      tomas.pose = "stand";
      emote(tomas, "!");
      focusCam(charlie.x - 20, 1.25);
      await say(tomas, "움직이지 마! 물렸어? 어디 물린 데 있어?");
      charlie.pose = "armsUp";
      emote(charlie, "💧");
      await say(charlie, "아, 아니에요! 고양이를 쫓아왔을 뿐이에요!");
      charlie.pose = null;
      await walkTo(ruth, charlie.x - 64, 50);
      ruth.pose = "stand";
      await say(ruth, "토마스, 진정해. 눈을 봐. 멀쩡하잖아.");
      await say(ruth, "열은? 환청은? 갑자기 고기가 싫어지거나, 손가락 사이가 끈적해지진 않고?");
      await say(charlie, "...없는데요. 3일 밤샌 피로 말고는.");
      await say(ruth, "그럼 너도 우리처럼 '면역자'구나. 난 루스. 이쪽은 토마스, 저 애는 릴리.");
      emote(lily, "♪");
      focusCam(CHURCH.lily, 1.2);
      await say(lily, "아저씨! 이 고양이 아저씨 거예요?");
      charlie.facing = -1;
      emote(charlie, "♥");
      emote(sam, "♥");
      await say(charlie, "샘!! ...다행이다. 다친 데는 없구나.");
      focusCam(null);
      sfx.purr();
      await Promise.all([walkTo(tomas, CHURCH.tomas, 50), walkTo(ruth, CHURCH.ruth, 40)]);
      tomas.pose = ruth.pose = "stand";
      tomas.facing = 1;
      ruth.facing = 1;
      await caption("교회를 둘러보며 생존자들과 이야기하자. (돋보기에서 [Space])");
      S.control = true;
    },
  };
  return sc;
};

// ═════════════════════════════════════════════════════════
// 공통: 순찰 요원 · 숨는 곳 · 선택지
// ═════════════════════════════════════════════════════════
type Guard = Actor & { a: number; b: number; pause: number; alert: number };

/** 손전등을 든 순찰 요원 묶음. 정면 range 안에 보이면 들킨다 */
function patrolKit(o: { look: Look; lookId: string; range: number; quiet?: () => boolean; shout: string; onCaught: () => void }) {
  const guards: Guard[] = [];
  let caught = false;
  let frozen = false;
  const add = (x: number, a: number, b: number, facing: 1 | -1 = 1): Guard => {
    const gd = Object.assign(mkActor("person", x, facing, { look: o.look, lookId: o.lookId, role: "agent" as const, torch: o.look === HAZMAT }), { a, b, pause: 0, alert: 0 });
    guards.push(gd);
    return gd;
  };
  const spotted = (f: Guard): boolean => {
    if (S.hidden || caught || !f.visible) return false;
    const d = charlie.x - f.x;
    const dist = Math.abs(d);
    const front = Math.sign(d) === f.facing;
    if (front && dist < o.range) return true;
    if (!o.quiet?.() && dist < 28 && charlie.moving && !sneaking()) return true;
    return dist < 12;
  };
  const update = (dt: number) => {
    if (!S.control || caught || frozen) return;
    for (const f of guards) {
      if (!f.visible) continue;
      if (f.alert > 0) {
        f.alert -= dt;
        if (f.alert <= 0) {
          caught = true;
          S.control = false;
          f.bubble = o.shout;
          sfx.siren();
          void walkTo(f, charlie.x - 14 * Math.sign(charlie.x - f.x || 1), 90).then(() => {
            shake(0.4);
            o.onCaught();
          });
        }
        continue;
      }
      if (spotted(f)) {
        f.alert = 0.4;
        f.bubble = "!";
        sfx.blip();
        continue;
      }
      if (f.pause > 0) {
        f.pause -= dt;
        f.moving = false;
        continue;
      }
      const target = f.facing > 0 ? f.b : f.a;
      const step = Math.sign(target - f.x) * 24 * dt;
      f.x += step;
      f.walkDist += Math.abs(step);
      f.moving = true;
      if (Math.abs(target - f.x) < 1) {
        f.facing = f.facing > 0 ? -1 : 1;
        f.pause = 1.4 + Math.random();
      }
    }
  };
  const lights = (): Light[] =>
    guards
      .filter((f) => f.visible)
      .flatMap((f): Light[] => [
        { x: f.x, y: f.y - 26, r: 34, a: 0.55 },
        // 손전등을 든 요원은 손끝에서, 개구리는 눈에서 희미한 시선이 나간다
        ...(frozen ? [] : [f.torch ? actorCone(f, o.range) : { x: f.x + f.facing * 6, y: f.y - 44, r: 0, a: 0.45, cone: { dir: f.facing, len: o.range, spread: 0.22 } }]),
      ]);
  return {
    guards,
    add,
    update,
    lights,
    unfreeze: () => {
      frozen = false;
    },
    freeze: () => {
      frozen = true;
      for (const f of guards) {
        f.bubble = null;
        f.moving = false;
      }
    },
  };
}

export type CoverKind = "crates" | "case" | "cart" | "pew" | "container" | "chimney" | "tank" | "stairbox" | "doorway" | "counter" | "pillar" | "vent";
/** 숨는 곳의 엄폐물. back=true 면 배경에도 그려 두고, 숨으면 찰리 앞을 가린다 */
function drawCover(kind: CoverKind, x: number, front: boolean): void {
  const F = GROUND + 1;
  const R = (xx: number, y: number, w: number, h: number, c: string) => {
    g.fillStyle = c;
    g.fillRect(half(xx), half(y), w, h);
  };
  switch (kind) {
    case "crates":
      for (const [dx, w, h, y0] of [[-16, 22, 18, 0], [4, 16, 24, 0], [-12, 16, 13, 18]] as Array<[number, number, number, number]>) {
        R(x + dx, F - y0 - h, w, h, "#7a5432");
        R(x + dx, F - y0 - h, w, 1.5, "#a87a4a");
        R(x + dx, F - y0 - h, 1.2, h, "#5a3a20");
        R(x + dx + w - 1.2, F - y0 - h, 1.2, h, "#5a3a20");
        g.strokeStyle = "#5a3a20";
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(x + dx + 1, F - y0 - 1);
        g.lineTo(x + dx + w - 1, F - y0 - h + 1);
        g.stroke();
      }
      break;
    case "case":
      R(x - 16, F - 26, 32, 26, "#2a2230");
      R(x - 16, F - 26, 32, 2, "#5a4a6a");
      R(x - 13, F - 20, 26, 14, "#3a3044");
      R(x - 2, F - 14, 4, 2, "#c8a83a");
      break;
    case "cart":
      R(x - 16, F - 30, 32, 3, "#c8ccd0");
      R(x - 15, F - 27, 30, 22, "rgba(240,242,248,0.95)");
      for (let i = 0; i < 4; i++) R(x - 15 + i * 8, F - 27, 0.6, 22, "rgba(160,160,170,0.7)");
      R(x - 15, F - 5, 2, 4, "#8a9096");
      R(x + 13, F - 5, 2, 4, "#8a9096");
      break;
    case "pew":
      R(x - 22, F - 30, 44, 4, "#7a5038");
      R(x - 22, F - 26, 44, 18, "#5a3828");
      for (let i = 0; i < 4; i++) R(x - 20 + i * 11, F - 24, 9, 14, "#4a2e20");
      R(x - 22, F - 8, 4, 8, "#3a2218");
      R(x + 18, F - 8, 4, 8, "#3a2218");
      break;
    case "container":
      R(x - 10, F - 40, 22, 40, "#7a3a2a");
      for (let i = 0; i < 6; i++) R(x - 9 + i * 3.6, F - 38, 1, 36, "#5a2a1e");
      R(x - 10, F - 40, 22, 2, "#9a4a3a");
      break;
    case "chimney":
      R(x - 12, F - 36, 24, 36, "#7a3a2a");
      for (let y = F - 36; y < F; y += 4) R(x - 12 + ((y / 4) % 2) * 4, y, 24, 0.6, "#4a2018");
      break;
    case "tank":
      for (const lx of [-14, -4, 6, 14]) R(x + lx, F - 30, 2.5, 30, "#2a2224");
      R(x - 16, F - 22, 32, 1.5, "#2a2224");
      R(x - 16, F - 12, 32, 1.5, "#2a2224");
      R(x - 14, F - 8, 28, 8, "rgba(20,16,18,0.6)");
      break;
    case "stairbox":
      R(x - 14, F - 34, 28, 34, "#5a5048");
      R(x - 14, F - 34, 28, 1.5, "#8a7e72");
      break;
    case "doorway":
      R(x - 17, F - 60, 4, 60, "#3a2a22");
      R(x + 13, F - 60, 4, 60, "#3a2a22");
      if (front) {
        g.fillStyle = "rgba(6,4,8,0.45)";
        g.fillRect(half(x - 13), F - 58, 26, 58);
      }
      break;
    case "counter":
      R(x - 18, F - 30, 36, 30, "#e8e4dc");
      R(x - 20, F - 33, 40, 4, "#3a8a5a");
      R(x - 16, F - 26, 32, 1, "#c8c4bc");
      break;
    case "pillar":
      R(x - 8, F - 120, 16, 120, "#c8c0b0");
      R(x - 8, F - 120, 3, 120, "#e0d8c8");
      R(x + 5, F - 120, 3, 120, "#9a9284");
      break;
    case "vent":
      R(x - 18, F - 34, 36, 34, "#7a7e82");
      R(x - 18, F - 34, 36, 1.5, "#aaaeb2");
      for (let i = 0; i < 6; i++) R(x - 16, F - 30 + i * 5, 32, 2, "#5a5e62");
      break;
  }
}
function hideAt(x: number, label: string, iconY: number, when: () => boolean = () => true, cover: CoverKind = "crates", back = false): Hotspot & { cover?: { kind: CoverKind; back: boolean } } {
  return {
    cover: { kind: cover, back },
    x,
    iconY,
    label,
    range: 18,
    enabled: () => !S.hidden && when(),
    use: async () => {
      charlie.x = x;
      S.hidden = true;
      charlie.visible = false;
      charlie.hideLook = true;
      sfx.step();
    },
  };
}

/** 선택지: 고른 번호를 돌려준다 */
function choose(options: string[]): Promise<number> {
  S.choice = { options, sel: 0, picked: -1 };
  return until(() => (S.choice?.picked ?? -1) >= 0).then(() => {
    const i = S.choice!.picked;
    S.choice = null;
    return i;
  });
}
function updateChoice(): void {
  const c = S.choice;
  if (!c || c.picked >= 0) return;
  if (took("ArrowUp", "KeyW")) {
    c.sel = (c.sel + c.options.length - 1) % c.options.length;
    sfx.blip();
  }
  if (took("ArrowDown", "KeyS")) {
    c.sel = (c.sel + 1) % c.options.length;
    sfx.blip();
  }
  const top = H / 2 - (c.options.length * 22) / 2;
  if (mouse.clicked) {
    c.options.forEach((_, i) => {
      if (Math.abs(mouse.y - (top + i * 22 + 11)) < 10 && Math.abs(mouse.x - W / 2) < 150) c.picked = i;
    });
  }
  if (took("Space", "Enter", "KeyE")) c.picked = c.sel;
}
function drawChoice(): void {
  const c = S.choice;
  if (!c) return;
  const top = H / 2 - (c.options.length * 22) / 2;
  g.fillStyle = "rgba(6,5,10,0.86)";
  g.fillRect(W / 2 - 160, top - 10, 320, c.options.length * 22 + 20);
  g.fillStyle = "#e8e2d6";
  g.fillRect(W / 2 - 160, top - 10, 320, 1);
  g.fillRect(W / 2 - 160, top + c.options.length * 22 + 9, 320, 1);
  c.options.forEach((o, i) => {
    const sel = i === c.sel;
    text(sel ? `▶ ${o}` : `   ${o}`, W / 2 - 140, top + i * 22 + 11, sel ? "#ffd36a" : "#d8d0e0", "left");
  });
}

/** 빗줄기 */
function drawRain(camX: number, alpha = 0.35): void {
  g.fillStyle = `rgba(170,200,220,${alpha})`;
  for (let i = 0; i < 90; i++) {
    const x = ((i * 53.7 + clock.t * 260 + camX * 0.2) % (W + 40)) - 20;
    const y = (i * 37.3 + clock.t * 420) % (H + 20) - 10;
    g.fillRect(half(x), half(y), 0.5, 5);
  }
}

// ═════════════════════════════════════════════════════════
// 제4장: 격리 센터
// ═════════════════════════════════════════════════════════
SCENES.pier = (checkpoint) => {
  const kit = patrolKit({
    look: HAZMAT,
    lookId: "hazmat",
    range: 100,
    shout: "침입자다!",
    onCaught: () => gameOver("GAME OVER", "특별대응단에게 붙잡혀 격리실에 갇혔다...", charlie.x > 740 ? 740 : 0),
  });
  kit.add(420, 380, 640);
  kit.add(900, 700, 960, -1);
  kit.add(1100, 1060, 1270);
  const sc: Scene = {
    id: "pier",
    width: PIER.width,
    bg: buildPier(),
    ambient: 0.5,
    tint: "rgba(20,30,60,0.12)",
    lights: () => [
      ...PIER.lamps.map((x): Light => ({ x: x - 2, y: 122, r: 70, a: 0.8, warm: "rgba(255,220,150,0.10)" })),
      ...kit.lights(),
      { x: charlie.x, y: charlie.y - 24, r: 30, a: 0.3 },
    ],
    minX: 30,
    maxX: PIER.width - 30,
    get actors() {
      return kit.guards;
    },
    hotspots: [...PIER.hide.map((x) => hideAt(x, "컨테이너 뒤에 숨기", 150, undefined, "container")), photoSpot("p11", 640, 176, "젖은 상자")],
    zones: [
      {
        x: 740,
        dir: 1,
        run: async () => {
          writeSave("pier", 740);
          await say(charlie, "절반 왔어. 샘, 조금만 참아.");
        },
      },
      {
        x: PIER.dock - 30,
        dir: 1,
        run: async () => {
          kit.freeze();
          await say(charlie, "셔터는 안에서만 열리는 모양이야...");
          await say(charlie, "저 환기구... 나는 못 들어가도, 너라면.");
          sam.visible = true;
          sam.x = charlie.x + 6;
          sam.y = GROUND;
          sam.facing = 1;
          sam.pose = "sit";
          sfx.meow();
          await say(charlie, "안으로 들어가서 셔터 버튼을 눌러 줘. 할 수 있지, 샘?");
          sam.pose = "jump";
          await tween(sam, PIER.dock + 19, 140, 0.5, 30);
          sam.visible = false;
          sfx.step();
          await goScene("center");
        },
      },
    ],
    update: (dt) => kit.update(dt),
    start: async () => {
      charlie.y = GROUND;
      if (checkpoint > 0) {
        charlie.x = checkpoint;
        charlie.facing = 1;
        for (const z of sc.zones) if (z.x <= checkpoint) z.fired = true;
        S.camX = Math.max(0, charlie.x - W / 2);
        await fadeTo(0, 0.6);
        S.control = true;
        return;
      }
      writeSave("pier", 0);
      charlie.x = 60;
      charlie.facing = 1;
      await fadeTo(0, 1);
      await chapterCard("제5장", "격리 센터");
      await caption("철조망 쪽문에 사원증을 대자, 「삑— 블랙컴퍼니 직원 확인」. 문이 열렸다.");
      await say(charlie, "허드슨 강변의 컨벤션 센터... 루스 할머니는 저 안에 있어.");
      await caption("샘은 찰리의 가방 속에서 숨을 죽이고 있다.");
      await caption("요원들의 손전등에 비치지 않게, 컨테이너 뒤에 [Space]로 숨으며 하역장까지 가자. 가까이에선 ↓(살금살금)로.");
      S.help = 8;
      S.control = true;
    },
  };
  return sc;
};

SCENES.center = (checkpoint) => {
  const F = S.flags;
  const man = mkActor("charlie", 70, 1);
  let open = false;
  const asCat = () => charlie.kind === "sam";
  const kit = patrolKit({
    look: HAZMAT,
    lookId: "hazmat",
    range: 96,
    quiet: () => asCat(),
    shout: "거기 서!",
    onCaught: () =>
      asCat() ? gameOver("GAME OVER", "샘이 요원에게 붙잡혔다... 「고양이도 확보 대상이다.」", 0) : gameOver("GAME OVER", "특별대응단에게 붙잡혀 격리실에 갇혔다...", 1),
  });
  kit.add(560, 280, 600, -1);
  kit.add(800, 760, 1130);
  const sc: Scene = {
    id: "center",
    width: CENTER.width,
    bg: buildCenter(),
    ambient: 0.38,
    tint: "rgba(20,40,60,0.10)",
    lights: () => [
      ...CENTER.lights.map((x): Light => ({ x, y: 26, r: 90, a: 0.6, warm: "rgba(200,230,255,0.05)" })),
      { x: CENTER.desk, y: 162, r: 40, a: 0.6, warm: "rgba(110,200,232,0.10)" },
      ...kit.lights(),
      { x: charlie.x, y: charlie.y - (asCat() ? 10 : 24), r: 30, a: 0.3 },
    ],
    minX: 30,
    maxX: CENTER.width - 30,
    get actors() {
      return kit.guards;
    },
    hotspots: [
      ...CENTER.carts.map((x) => hideAt(x, "수레 천 뒤에 숨기", 160, undefined, "cart")),
      {
        x: CENTER.desk,
        iconY: 140,
        label: "카드키 물어 오기",
        range: 22,
        enabled: () => asCat() && !F.keycard,
        use: async () => {
          charlie.pose = "jump";
          await tween(charlie, CENTER.desk - 4, 176, 0.35, 12);
          charlie.pose = "sit";
          sfx.item();
          F.keycard = 1;
          await caption("샘이 책상 위의 카드키를 물었다!");
          charlie.pose = "jump";
          await tween(charlie, CENTER.desk - 20, GROUND, 0.35, 8);
          charlie.pose = null;
          await caption("이제 왼쪽 끝 셔터의 열림 버튼을 누르자.");
        },
      },
      {
        x: CENTER.button + 48,
        iconY: 150,
        label: "열림 버튼 누르기",
        range: 22,
        enabled: () => asCat() && !!F.keycard,
        use: async () => {
          kit.freeze();
          charlie.pose = "jump";
          await tween(charlie, CENTER.button + 48, 168, 0.3, 10);
          sfx.blip();
          charlie.pose = "jump";
          await tween(charlie, CENTER.button + 30, GROUND, 0.3, 6);
          charlie.pose = "sit";
          sfx.fridge();
          open = true;
          shake(0.2);
          await wait(0.6);
          // 찰리로 바꾼다
          const cat = charlie;
          charlie = man;
          charlie.x = 60;
          charlie.facing = 1;
          sam.visible = true;
          sam.x = cat.x;
          sam.facing = -1;
          sam.pose = "sit";
          await walkTo(charlie, 100, 50);
          await say(charlie, "잘했어, 샘! 역시 넌 최고야.");
          sam.pose = "butt";
          sfx.purr();
          await caption("샘이 카드키를 찰리 손에 떨어뜨렸다.");
          sam.visible = false;
          F.cardMan = 1;
          writeSave("center", 1);
          await caption("요원들을 피해 수레 밑에 숨으며, 오른쪽 끝 실험실 문까지 가자.");
          kit.unfreeze();
        },
      },
      {
        x: CENTER.labDoor,
        iconY: 100,
        label: "카드키 대기",
        range: 30,
        enabled: () => !asCat() && !!F.keycard,
        use: async () => {
          sfx.blip();
          if (!F.labCode) {
            await caption("삑. 「카드 확인. 비밀번호 4자리를 입력하세요.」");
            const ok = await openKeypad("실험실 비밀번호", "7395");
            if (!ok) {
              await say(charlie, "비밀번호를 모르겠어. 보안실이나 기록 보관실에서 단서를 찾아보자.");
              return;
            }
            F.labCode = 1;
          }
          await caption("철컥.");
          await goScene("lab");
        },
      },
      ...([
        [960, "보안실", "sec4"],
        [1100, "기록 보관실", "arch4"],
        [300, "격리 구역", "cells4"],
      ] as Array<[number, string, string]>).map(
        ([x, name, id]): Hotspot => ({
          x,
          iconY: 112,
          label: `${name} 들어가기`,
          range: 18,
          enabled: () => !asCat(),
          use: async () => {
            await doorTransition(x, "in", { top: 152, w: 26, col: "#6a7480" });
            await goScene(id, 70);
          },
        }),
      ),
    ],
    zones: [],
    update: (dt) => kit.update(dt),
    back: (camX) => {
      // 옆방 문 (보안실 · 기록 보관실 · 격리 구역)
      for (const [x, name] of [[960, "보안실"], [1100, "기록실"], [300, "격리 구역"]] as Array<[number, string]>) {
        const sx = x - camX;
        g.fillStyle = "#3a4048";
        g.fillRect(sx - 15, 150, 30, 64);
        g.fillStyle = "#6a7480";
        g.fillRect(sx - 13, 152, 26, 62);
        g.fillStyle = "#c8a83a";
        g.fillRect(sx - 15, 140, 30, 8);
        text(name, sx, 144, "#1a1a1a", "center", "");
      }
      if (!open) return;
      g.fillStyle = "#0a0c12";
      g.fillRect(half(21 - camX), 122, 98, 60);
    },
    start: async () => {
      if (checkpoint > 0) {
        Object.assign(F, { keycard: 1, cardMan: 1 });
        open = true;
        charlie.x = checkpoint > 1 ? checkpoint : 100;
        charlie.y = GROUND;
        charlie.facing = 1;
        await fadeTo(0, 0.6);
        S.control = true;
        return;
      }
      F.keycard = 0;
      writeSave("center", 0);
      // 샘으로 플레이
      charlie = mkActor("sam", CENTER.vent, 1);
      charlie.y = 40;
      charlie.pose = "jump";
      await fadeTo(0, 0.8);
      sfx.step();
      await tween(charlie, CENTER.vent + 10, GROUND, 0.5, 0);
      charlie.pose = null;
      sfx.meow();
      await caption("이번엔 샘이 움직일 차례다!");
      await caption("경비 책상 위의 카드키를 물어 오자. 요원 손전등에 걸리지 않게 수레 밑에 [Space]로 숨자. 샘은 발소리가 나지 않는다.");
      S.control = true;
    },
  };
  return sc;
};

SCENES.lab = () => {
  const F = S.flags;
  const ruth = mkActor("person", LAB.gurney, 1, { look: RUTH, lookId: "ruth", pose: "sleep" });
  ruth.y = 200;
  const boss = mkActor("person", LAB.lift, -1, { look: BOSS, lookId: "boss", visible: false });
  let cage = false;
  const sc: Scene = {
    id: "lab",
    width: LAB.width,
    bg: buildLab(),
    ambient: 0.35,
    tint: "rgba(20,40,40,0.10)",
    lights: () => [
      { x: LAB.gurney, y: 150, r: 80, a: 0.7, warm: "rgba(200,240,255,0.06)" },
      { x: 300, y: 60, r: 90, a: 0.5, warm: "rgba(120,255,170,0.08)" },
      { x: charlie.x, y: charlie.y - 24, r: 30, a: 0.3 },
    ],
    minX: 30,
    maxX: LAB.width - 30,
    get actors() {
      return [ruth, boss];
    },
    hotspots: [],
    zones: [],
    front: (camX) => {
      if (!cage || !boss.visible) return;
      const cx = half(boss.x - camX + boss.facing * 12);
      g.fillStyle = "#2a2a30";
      for (let k = 0; k < 6; k++) g.fillRect(cx - 9 + k * 3.4, GROUND - 40, 0.8, 16);
      g.fillRect(cx - 9, GROUND - 40, 18, 1);
      g.fillRect(cx - 9, GROUND - 25, 18, 1);
      g.fillStyle = "#cfd2da";
      g.fillRect(cx - 6, GROUND - 32, 10, 6);
    },
    start: async () => {
      writeSave("lab", 0);
      charlie.x = LAB.door;
      charlie.facing = 1;
      await fadeTo(0, 0.8);
      await walkTo(charlie, LAB.gurney - 30, 50);
      await say(charlie, "루스 할머니!");
      ruth.pose = "sit";
      await say(ruth, "찰리...? 바보 같은 녀석, 왜 왔어.");
      await say(charlie, "할머니가 저를 숨겨 주셨잖아요. 이번엔 제 차례예요.");
      sfx.fridge();
      boss.visible = true;
      boss.pose = null;
      await walkTo(boss, LAB.lift - 50, 40);
      boss.pose = "stand";
      focusCam((boss.x + charlie.x) / 2, 1.3);
      emote(boss, "…");
      await say(boss, "이런, 이런. 찰리 군 아닌가?");
      charlie.facing = 1;
      charlie.pose = "armsUp";
      emote(charlie, "!");
      shake(0.2);
      await say(charlie, "부... 부장님?!");
      charlie.pose = null;
      await say(boss, "3일 연속 야근 끝에 무단 퇴근이라니. 자네 인사고과는 이미 바닥이야.");
      await say(charlie, "부장님이 왜 여기 계세요?!");
      await say(boss, "특별대응단? 우리 블랙컴퍼니가 따낸 용역이지. 면역자의 피로 백신을 만들면, 세상에서 제일 비싼 상품이 되거든.");
      emote(ruth, "💢");
      await say(ruth, "사람을 상품 취급하다니.");
      await say(boss, "그리고 저 초록빛. 녀석들은 고양이만 찾아. 고양이를 미끼로 쓰면 외계 기술까지 손에 넣을 수 있지.");
      sam.visible = true;
      sam.x = charlie.x + 10;
      sam.y = GROUND;
      sam.facing = 1;
      sam.pose = "startle";
      sfx.meow();
      emote(sam, "💢");
      await say(boss, "오호, 마침 미끼가 제 발로 왔군.");
      await caption("부장이 그물을 던졌다!");
      sam.pose = "jump";
      await tween(sam, boss.x - 12, GROUND - 10, 0.4, 20);
      sam.visible = false;
      cage = true;
      shake(0.3);
      emote(charlie, "💢");
      focusCam(null);
      await say(charlie, "샘!!");
      await say(boss, "옥상에서 기다리지. 정시 퇴근은 꿈도 꾸지 말게, 찰리 군.");
      boss.facing = 1;
      await walkTo(boss, LAB.lift, 50);
      boss.visible = false;
      sfx.fridge();
      await wait(0.6);
      charlie.facing = -1;
      await caption("찰리가 루스의 손목 끈을 풀었다.");
      ruth.pose = "stand";
      ruth.y = GROUND;
      ruth.x = LAB.gurney + 14;
      await say(ruth, "가, 찰리! 옥상이야. 난 갇힌 사람들을 풀어 줄게.");
      await say(charlie, "...기다려, 샘. 금방 갈게.");
      F.ch4 = 1;
      unlock(6);
      await fadeTo(1, 1.4);
      await chapterCard("제5장 끝", "");
      await goScene("helipad", 0, false);
    },
  };
  return sc;
};

// ═════════════════════════════════════════════════════════
// 최종장: 초록빛
// ═════════════════════════════════════════════════════════
SCENES.helipad = (checkpoint) => {
  const F = S.flags;
  const boss = mkActor("person", HELIPAD.cage - 30, -1, { look: BOSS, lookId: "boss", pose: "stand" });
  let ufo = true;
  let beamX: number | null = null;
  let ufoX = 500;
  let cageOpen = false;
  let greenRain = 0;
  const kit = patrolKit({
    look: HAZMAT,
    lookId: "hazmat",
    range: 100,
    shout: "놓치지 마!",
    onCaught: () => gameOver("GAME OVER", "요원들에게 붙잡혔다... 샘이 멀어져 간다.", 0),
  });
  kit.add(300, 180, 460);
  kit.add(560, 450, 680, -1);
  const sc: Scene = {
    id: "helipad",
    width: HELIPAD.width,
    bg: buildHelipad(),
    ambient: 0.45,
    tint: "rgba(10,30,30,0.15)",
    lights: () => {
      const L: Light[] = [{ x: HELIPAD.door, y: 160, r: 50, a: 0.6, warm: "rgba(255,210,150,0.08)" }, ...kit.lights(), { x: charlie.x, y: charlie.y - 24, r: 30, a: 0.3 }];
      if (beamX !== null) L.push({ x: beamX, y: 190, r: 80, a: 0.9, warm: "rgba(120,255,170,0.2)" });
      L.push({ x: ufoX, y: 30, r: 100, a: 0.5, warm: "rgba(120,255,170,0.10)" });
      return L;
    },
    minX: 30,
    maxX: HELIPAD.width - 40,
    get actors() {
      return [...kit.guards, boss];
    },
    hotspots: HELIPAD.hide.map((x) => hideAt(x, "환풍기 뒤에 숨기", 150, undefined, "vent")),
    zones: [
      {
        x: 700,
        dir: 1,
        run: async () => {
          kit.freeze();
          await finale();
        },
      },
    ],
    update: (dt) => {
      kit.update(dt);
      if (beamX === null) ufoX += (500 + Math.sin(clock.t * 0.5) * 160 - ufoX) * Math.min(1, dt);
      if (greenRain > 0) greenRain += dt;
    },
    front: (camX) => {
      // 우리 (샘이 갇힌 철창)
      if (!cageOpen && sam.visible) {
        const cx = half(sam.x - camX);
        g.fillStyle = "#1e1e24";
        for (let k = 0; k < 7; k++) g.fillRect(cx - 14 + k * 4.6, GROUND - 26, 0.9, 26);
        g.fillRect(cx - 15, GROUND - 27, 30, 1.5);
        g.fillRect(cx - 15, GROUND - 1, 30, 1.5);
      }
    },
    overlay: (camX) => {
      if (ufo) drawUfo(ufoX, beamX, camX);
      drawRain(camX, greenRain > 0 ? 0.15 : 0.35);
      if (greenRain > 0) {
        for (let i = 0; i < 80; i++) {
          const x = (i * 61.3 + clock.t * 30) % W;
          const y = (i * 29.7 + clock.t * 50) % H;
          g.fillStyle = `rgba(170,255,200,${(0.4 + 0.4 * Math.sin(i + clock.t * 3)).toFixed(2)})`;
          g.fillRect(half(x), half(y), 1, 1);
        }
      }
    },
    start: async () => {
      writeSave("helipad", 0);
      charlie.x = HELIPAD.door;
      charlie.y = GROUND;
      charlie.facing = 1;
      sam.visible = true;
      sam.x = HELIPAD.cage;
      sam.y = GROUND;
      sam.facing = -1;
      sam.pose = "sit";
      if (checkpoint > 0 || F.helipadSeen) {
        await fadeTo(0, 0.6);
        S.control = true;
        return;
      }
      await fadeTo(0, 1);
      await chapterCard("최종장", "초록빛");
      await caption("폭풍우 치는 옥상. 하늘에는 그 초록빛이 낮게 떠 있다.");
      boss.bubble = "어서 와라, 초록빛! 고양이는 여기 있다!";
      await wait(2.2);
      boss.bubble = null;
      await say(charlie, "샘...!");
      await caption("요원들을 피해 환풍기 뒤에 숨으며 헬기장까지 가자.");
      F.helipadSeen = 1;
      S.help = 6;
      S.control = true;
    },
  };

  const finale = async () => {
    charlie.moving = false;
    await walkTo(charlie, 720, 50);
    focusCam((boss.x + charlie.x) / 2, 1.3);
    await say(boss, "늦었네, 찰리 군. 정시 퇴근은 꿈도 꾸지 말라고 했지?");
    await say(charlie, "샘을 돌려주세요, 부장님!");
    if (F.bossSafe) {
      await say(charlie, "부장님... 이거, 부장님 금고에서 봤어요.");
      await caption("찰리가 낡은 사진을 내밀었다. 고양이를 안고 웃는 어린 소년.");
      emote(boss, "…");
      await say(boss, "...나비. 그걸 어디서.");
      await say(charlie, "부장님도 알잖아요. 고양이를 잃어버리는 게 어떤 기분인지.");
      await say(boss, "...알아. 그래서 다시는 아무것도 잃지 않으려고, 전부 가지려고 했지.");
      await say(boss, "하지만 이미 늦었네, 찰리 군. 저 빛은 이미 여기 와 있어.");
    }
    await say(boss, "이건 회사 자산이야. 자, 초록빛이여! 고양이를 바치마! 그 대신 기술을 내놔라!");
    beamX = boss.x;
    ufoX = boss.x - 20;
    sfx.beam();
    flash("#aaffcc", 0.5);
    await wait(1);
    await caption("빛이 부장을 감쌌다. 고양이가 아니라... 부장을?");
    boss.pose = "armsUp";
    emote(boss, "💧");
    await say(boss, "자, 잠깐! 나는 고양이가 아니야! 나는 부장이라고!");
    await tween(boss, boss.x, 40, 1.8, 0);
    boss.visible = false;
    await caption("「욕심으로 가득 찬 마음... 표본으로 가져가겠다.」");
    focusCam(null, 1);
    if (F.bossSafe) await say(charlie, "...부장님. 저 별에서 나비를 만나시길.");
    else await say(charlie, "...부장님, 드디어 퇴근하셨네요.");
    for (const f of kit.guards) {
      f.bubble = "으, 으악!";
      f.facing = -1;
      void walkTo(f, -40, 110).then(() => {
        f.visible = false;
        f.bubble = null;
      });
    }
    await wait(1);
    // 샘을 부르는 빛
    beamX = sam.x;
    ufoX = sam.x - 20;
    cageOpen = true;
    sfx.beam();
    await caption("철창이 녹듯이 사라지고, 빛이 샘을 감쌌다.");
    sam.pose = "jump";
    await tween(sam, sam.x, GROUND - 40, 1.6, 0);
    focusCam(sam.x, 1.45);
    await caption("「돌아오렴, 작은 별의 아이야. 너는 원래 우리의 아이란다.」");
    await say(charlie, "샘이... 저 별에서 왔다고?");
    await caption("초록빛이 깜빡인다. 무언가를 묻는 것처럼, 일정한 순서로.");
    await say(charlie, "...말을 거는 거야? 그럼 손전등으로 대답해 보자.");
    for (;;) {
      const ok = await playSimon("빛의 언어: 같은 순서로 비추기", [2, 0, 3, 1, 2, 3, 0]);
      if (ok) break;
      await caption("빛이 갸웃거리듯 흔들린다. 다시 한 번...");
    }
    await caption("초록빛이 부드럽게 퍼지며, 찰리의 머릿속에 장면 하나가 흘러들어 왔다.");
    await playMovie(memoryShots());
    await say(charlie, "...그날 비 오는 골목. 상자 속에서 떨던 게 너였구나.");
    await caption("샘이 빛 속에서 찰리를 돌아본다.");
    const sc3 = scores();
    const opts = ["샘, 가지 마! 내 곁에 있어 줘.", "...가고 싶으면, 가도 돼."];
    const ids = ["stay", "go"];
    // 비밀 집회소의 대장 고양이가 알려 준 질문
    if (secretOn("charlie_cat_secret")) {
      opts.push("(대장 고양이의 말이 떠올랐다) ...사람은요?");
      ids.push("people");
    }
    // 진 엔딩: 별 조각 다섯 개 + 부장의 사진 + 샘과의 깊은 유대
    const trueOpen = (F.shards ?? 0) >= 5 && !!F.bossSafe && sc3.bond >= BOND_OK;
    if (trueOpen) {
      opts.unshift("(별 조각 다섯 개가 빛난다) 샘의 별에게, 샘과 함께 말을 건다.");
      ids.unshift("true");
    }
    const id = ids[await choose(opts)];
    const pick = id === "stay" ? (sc3.bond >= BOND_OK ? 0 : 3) : id === "go" ? 1 : id === "people" ? 2 : 4;
    markEnding(["A", "B", "C", "D", "T"][pick]);
    if (pick === 4) {
      await trueFinale();
      return;
    }
    if (pick === 3) {
      // 배드 엔딩: 샘과 충분히 가까워지지 못했다
      await say(charlie, "샘, 가지 마! 내 곁에 있어 줘!");
      await caption("샘이 빛 속에서 찰리를 내려다본다. 하지만... 그 눈빛엔 망설임이 없었다.");
      await caption("「이 아이는 이 별에 붙들 것이 없구나.」");
      emote(charlie, "💧");
      await say(charlie, "...내가, 너무 바빴나. 사흘씩 집에 안 들어가고. 밥도, 놀아 주는 것도...");
      await tween(sam, sam.x, 20, 2, 0);
      sam.visible = false;
      await caption("「먼지는... 너희가 감당하라.」 초록빛이 구름 속으로 사라졌다. 거리를 뒤덮은 가루를 그대로 남긴 채.");
      F.endD = 1;
      await fadeTo(1, 1.6);
      await goScene("epiD", 0, false);
      return;
    }
    if (pick === 2) {
      await say(charlie, "...저기요. 고양이 말고, 사람은요? 사람은 어떻게 되는 거죠?");
      await caption("빛이 잠시 멈췄다. 그리고—");
      await caption("「인간? 필요 없다.」");
      await caption("「우리가 운석을 떨어뜨렸다. 이 별의 고양이를 전부 데려가기 위해. 이 별의 고양이는... 너무 귀여우니까.」");
      emote(charlie, "💧");
      await say(charlie, "그, 그럼 운석도, 좀비도, 해골도, 개구리도 전부...");
      await caption("「부작용이다. 미안하다. 하지만 고양이는 귀엽다.」");
      await say(charlie, "그 이유 하나로 지구를 망쳤다고?!");
      await caption("「너도 고양이를 키우지 않나. 이해할 텐데.」");
      await say(charlie, "...반박을 못 하겠네.");
      sam.pose = "jump";
      await tween(sam, sam.x, 20, 1.6, 0);
      sam.visible = false;
      emote(charlie, "💢");
      await say(charlie, "샘!! 안 돼!!");
      focusCam(null, 1);
      await playMovie(catsRiseShots());
      F.endC = 1;
      await fadeTo(1, 1.4);
      await goScene("epiC", 0, false);
      return;
    }
    if (pick === 0) {
      F.endA = 1;
      await say(charlie, "샘, 가지 마! 너 없으면 난... 맥주만 마시다 잠드는 사람이야.");
      sfx.meow();
      await caption("샘이 빛 속에서 몸을 비틀더니—");
      await tween(sam, charlie.x + 8, GROUND, 0.5, 20);
      sam.pose = "butt";
      sfx.purr();
      emote(sam, "♥");
      emote(charlie, "♥");
      focusCam(charlie.x, 1.35);
      await say(charlie, "...샘!");
      await caption("「그 아이가 너를 골랐구나. 작은 별의 아이를 부탁한다, 지구의 친구여.」");
    } else {
      F.endB = 1;
      emote(charlie, "💧");
      await say(charlie, "가고 싶으면, 가도 돼. 네가 행복하다면... 그걸로 됐어.");
      sfx.meow();
      await caption("샘이 오래, 오래 찰리를 바라보았다.");
      await tween(sam, sam.x, 30, 2.2, 0);
      sam.visible = false;
      await caption("「고맙다, 지구의 친구여. 너의 마음을 잊지 않으마.」");
    }
    await caption("「너희 별에 흩뿌린 먼지는 우리가 거두어 가마.」");
    greenRain = 0.01;
    beamX = null;
    flash("#ccffdd", 0.8);
    sfx.item();
    await wait(1.5);
    await caption("초록빛 비가 뉴욕 위로 부드럽게 내렸다.");
    focusCam(null, 1);
    await playMovie(farewellShots(pick === 0));
    ufo = false;
    flash("#ffffff", 1);
    await fadeTo(1, 1.6);
    await goScene(pick === 0 ? "epiA" : "epiB", 0, false);
  };
  return sc;
};


/** 진 엔딩: 별 조각으로 빛과 대화한다 */
async function trueFinale(): Promise<void> {
  const F = S.flags;
  F.endT = 1;
  await caption("찰리의 주머니에서 별 조각 다섯 개가 떠올라, 샘을 감싼 빛줄기 속으로 날아갔다.");
  flash("#ccffdd", 0.9);
  sfx.beam();
  await caption("빛이 멈췄다. 그리고 처음으로, 목소리가 찰리에게 말을 걸었다.");
  await caption("「...별의 조각을 모은 지구인. 너는 우리 아이를 붙잡으러 왔느냐, 보내러 왔느냐.」");
  await say(charlie, "둘 다 아니에요. 샘한테 물어보러 왔어요.");
  await say(charlie, "샘. 넌 저 별에서 왔대. 엄마가 너를 찾고 있었대. 가고 싶으면 가도 돼. 남고 싶으면... 우리 집에 소파 아직 있어.");
  sfx.meow();
  await caption("샘이 빛 속에서 한참 찰리를 보더니, 천천히 고개를 들어 하늘에 대고 길게 울었다.");
  await caption("「...그렇구나. 이 아이는 이미 여기서 '집'을 찾았구나.」");
  await caption("「좋다. 아이는 남는다. 그리고 우리의 숨결, 이 별에 흩뿌린 먼지는 모두 거두어 가마.」");
  await caption("「덤으로, 빛에 실려 간 이 별의 고양이들도 돌려보내마. 그리고... 한 사람도.」");
  sam.pose = "jump";
  await tween(sam, charlie.x + 8, GROUND, 0.6, 20);
  sam.pose = "butt";
  sfx.purr();
  emote(sam, "♥");
  emote(charlie, "♥");
  await caption("빛기둥이 한 번 더 내려왔다. 그 속에서 천천히 내려오는 사람 그림자— 그림스 부장이다.");
  await say(charlie, "부장님?!");
  await caption("부장은 아무 말 없이, 품에 안은 주황색 고양이 한 마리를 내려다보며 울고 있었다.");
  await caption("「그도 오래전에 고양이를 잃었더구나. 저 별에서, 나비는 그를 기억하고 있었다.」");
  await say(charlie, "...부장님의 나비구나.");
  await caption("「고맙다, 지구의 친구여. 언젠가 하늘을 올려다보면, 초록 별이 두 번 깜빡일 거다. 안부 인사다.」");
  await playMovie(farewellShots(true));
  await fadeTo(1, 1.4);
  await goScene("epiT", 0, false);
}
/** 엔딩 크레디트 */
async function credits(title: string): Promise<void> {
  await chapterCard("찰리와 고양이", title, 3.2);
  await chapterCard("등장", "찰리 · 샘 · 루스 · 토마스 · 릴리 · 그림스 부장", 2.8);
  await chapterCard("그리고", "어딘가의 초록빛 별, 고양이들의 고향", 2.8);
  await chapterCard("플레이해 주셔서 고맙습니다", "", 2.6);
  writeSave("end", 0);
  S.mode = "title";
  S.scene = null;
  await fadeTo(0, 0.8);
}

let nabiShow = false;
SCENES.epiA = () => {
  nabiShow = !!S.flags.nabi;
  const friends: Actor[] = [];
  if (S.flags.c3tony) friends.push(mkActor("person", 440, -1, { look: TONY, lookId: "tony", pose: "stand" }));
  if (S.flags.c3garcia) friends.push(mkActor("person", 470, -1, { look: GARCIA, lookId: "garcia", pose: "stand" }));
  if (S.flags.internUp) friends.push(mkActor("person", 500, -1, { look: MINJI, lookId: "minji", pose: "stand" }));
  if (S.flags.metLee) friends.push(mkActor("person", 530, -1, { look: MRLEE, lookId: "mrlee", pose: "stand" }));
  const info = buildStreet(800, false, 11, true);
  const ruth = mkActor("person", 360, -1, { look: RUTH, lookId: "ruth", pose: "stand" });
  const tomas = mkActor("person", 400, -1, { look: TOMAS, lookId: "tomas", pose: "stand" });
  const lily = mkActor("person", 330, -1, { look: LILY, lookId: "lily", pose: "stand", build: BUILD_KID });
  const sc: Scene = {
    id: "epiA",
    width: 800,
    bg: info.canvas,
    ambient: 0,
    tint: "rgba(255,190,140,0.22)",
    lights: () => [],
    minX: 40,
    maxX: 760,
    get actors() {
      return [ruth, tomas, lily, ...friends];
    },
    back: (camX) => {
      if (nabiShow) smoothDraw(tintedCat(`sitT${Math.floor(clock.t * 5) % 8}`, -1, "#f0a050"), half(312 - camX - 15), GROUND - 22, 32, 24);
    },
    hotspots: [],
    zones: [],
    start: async () => {
      unlock(7);
      charlie.x = info.door;
      charlie.facing = 1;
      sam.visible = true;
      sam.x = info.door + 18;
      sam.y = GROUND;
      sam.facing = 1;
      await fadeTo(0, 1.2);
      await caption("한 달 뒤.");
      void walkTo(sam, 300, 40);
      await walkTo(charlie, 280, 40);
      await say(lily, "샘! 찰리 아저씨!");
      await say(tomas, "가게 다시 열었어. 츄르는 평생 공짜야. 샘 한정으로.");
      await say(ruth, "좀비였던 사람들은 재활 센터에 다니고, 해골 시위대는 다시 살이 붙더니... 고기 한 점 두고 싸우더군.");
      emote(lily, "♪");
      if (S.flags.nabi) {
        await say(lily, "찰리 아저씨가 격리 센터에서 나비를 찾아 줬잖아요! 나비가 아저씨 좋대요!");
        nabiShow = true;
        sfx.meow();
      } else await say(lily, "나비도 돌아왔어요! 초록빛이 고양이들을 다 돌려보내 줬대요!");
      if (S.flags.freed) await say(ruth, "격리 센터에서 풀려난 사람들이 자네한테 고맙다고 전해 달라더군. 레버 당긴 사람이 누군지 다 알아.");
      for (const f of friends) {
        if (f.lookId === "tony") await say(f, "형! 약속대로 피자 쐈어요. 페퍼로니로!");
        if (f.lookId === "garcia") await say(f, "피코가 돌아왔단다! 오늘 아침 창가에서 노래하더구나.");
        if (f.lookId === "minji") await say(f, "선배! 저 회사 때려치우고 고양이 카페 차렸어요. 1호 단골 해 주세요!");
        if (f.lookId === "mrlee") await say(f, "약속한 소시지다, 청년! 고양이 것도 하나.");
      }
      await caption("휴대폰 알림: 「블랙컴퍼니(주) 파산. 그림스 부장 행방불명.」");
      emote(charlie, "♪");
      await say(charlie, "...출근은 안 해도 되겠네.");
      sam.pose = "butt";
      sfx.purr();
      emote(sam, "♥");
      await say(charlie, "가자, 샘. 오늘은 맥주 말고 우유로 건배다.");
      sfx.meow();
      sam.pose = null;
      await fadeTo(1, 2);
      await credits("— 끝 —");
    },
  };
  return sc;
};

SCENES.epiB = () => {
  const sc: Scene = {
    id: "epiB",
    width: ROOM.width,
    bg: buildRoom(),
    ambient: 0.35,
    tint: "rgba(60,80,120,0.12)",
    lights: () => [
      { x: 210, y: 92, r: 90, a: 0.6, warm: "rgba(120,150,255,0.06)" },
      { x: ROOM.lamp + 1, y: 124, r: 95, a: 0.85, warm: "rgba(255,200,130,0.12)" },
    ],
    minX: 30,
    maxX: ROOM.width - 30,
    actors: [],
    hotspots: [],
    zones: [],
    start: async () => {
      unlock(7);
      charlie.x = ROOM.armchair + 2;
      charlie.y = 200;
      charlie.facing = 1;
      charlie.pose = "sit";
      S.camX = Math.max(0, ROOM.armchair - W / 2);
      await fadeTo(0, 1.2);
      await caption("석 달 뒤. 세상은 다시 평범해졌다.");
      await say(charlie, "샘 밥그릇... 아직도 못 치웠네.");
      await say(charlie, "정시 퇴근하는 새 직장도 구했는데. 자랑할 상대가 없어.");
      await wait(1);
      sfx.meow();
      await caption("...창문 쪽에서 익숙한 소리가 들렸다.");
      charlie.pose = null;
      charlie.y = GROUND;
      sam.visible = true;
      sam.x = ROOM.windowExit + 10;
      sam.y = 150;
      sam.facing = 1;
      sam.pose = "jump";
      await tween(sam, ROOM.armchair + 40, GROUND, 0.6, 20);
      sam.pose = "sit";
      await caption("샘의 목에는 초록빛으로 반짝이는 방울이 달려 있었다. 꼬리표에는 서툰 글씨로 「가끔 들를게」.");
      emote(charlie, "💧");
      focusCam(ROOM.armchair + 20, 1.35);
      await say(charlie, "...어서 와, 샘.");
      emote(sam, "♥");
      sam.pose = "butt";
      sfx.purr();
      await fadeTo(1, 2);
      await credits("— 또 다른 끝 —");
    },
  };
  return sc;
};

/** 오프닝 애니메이션 */
SCENES.intro = () => {
  const c = makeCanvas(W * PIX, H * PIX);
  const sc: Scene = {
    id: "intro",
    width: W,
    bg: c,
    ambient: 0,
    lights: () => [],
    minX: 0,
    maxX: W,
    actors: [],
    hotspots: [],
    zones: [],
    start: async () => {
      charlie.visible = false;
      S.movie = { shots: introShots(), i: 0, t: 0 };
      await fadeTo(0, 0.8);
      await until(() => S.movie === null);
      await fadeTo(1, 0.6);
      await goScene("street1", 0, false);
    },
  };
  return sc;
};

// ═════════════════════════════════════════════════════════
// 퍼즐 도구: 가방 · 비밀번호 · 순서 기억 · 추억 사진
// ═════════════════════════════════════════════════════════
/** 아이템 이름표 (stages.ts 에서 채운다) */
export const ITEMS: Record<string, string> = {};
function has(id: string): boolean {
  return !!S.flags[`i_${id}`];
}
async function give(id: string): Promise<void> {
  S.flags[`i_${id}`] = 1;
  sfx.item();
  await caption(`「${ITEMS[id] ?? id}」을(를) 가방에 넣었다.`);
}
function take(id: string): void {
  delete S.flags[`i_${id}`];
}

function drawBag(sc: Scene): void {
  if (!S.control || sc.noPlayer) return;
  const items = Object.keys(S.flags).filter((k) => k.startsWith("i_") && S.flags[k]);
  let y = 6;
  if (sc.label) {
    g.fillStyle = "rgba(6,5,10,0.6)";
    g.fillRect(6, y, 100, 15);
    text(sc.label, 12, y + 7.5, "#ece6f4", "left");
    y += 18;
  }
  if (sc.useLight && S.flags.supplies && sc.id !== "subway") text(S.flags.light === 0 ? "손전등 꺼짐 [F]" : "손전등 켜짐 [F]", 8, H - 26, S.flags.light === 0 ? "#8a8aa0" : "#ffd36a", "left");
  if (items.length) {
    const line = `가방: ${items.map((k) => ITEMS[k.slice(2)] ?? k.slice(2)).join(" · ")}`;
    g.font = FONT;
    const w = g.measureText(line).width + 14;
    g.fillStyle = "rgba(6,5,10,0.6)";
    g.fillRect(6, y, w, 15);
    text(line, 12, y + 7.5, "#ffd36a", "left");
  }
}

/** 숫자 자물쇠: 맞으면 true, 그만두면 false */
function openKeypad(title: string, code: string): Promise<boolean> {
  S.pad = { title, code, input: "", result: null, sel: 0, shake: 0 };
  return until(() => S.pad?.result !== null).then(() => {
    const ok = !!S.pad!.result;
    S.pad = null;
    return ok;
  });
}
const PAD_KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "←", "0", "OK"];
function padPress(key: string): void {
  const pd = S.pad!;
  if (key === "←") pd.input = pd.input.slice(0, -1);
  else if (key === "OK") {
    if (pd.input === pd.code) {
      sfx.item();
      pd.result = true;
    } else {
      sfx.croak();
      pd.shake = 0.4;
      pd.input = "";
    }
  } else if (pd.input.length < pd.code.length) {
    pd.input += key;
    sfx.blip();
    if (pd.input.length === pd.code.length) padPress("OK");
  }
}
function updatePad(dt: number): void {
  const pd = S.pad!;
  pd.shake = Math.max(0, pd.shake - dt);
  for (let d = 0; d <= 9; d++) if (took(`Digit${d}`, `Numpad${d}`)) padPress(String(d));
  if (took("Backspace")) padPress("←");
  if (took("Escape")) pd.result = false;
  if (took("ArrowLeft", "KeyA")) pd.sel = (pd.sel + 11) % 12;
  if (took("ArrowRight", "KeyD")) pd.sel = (pd.sel + 1) % 12;
  if (took("ArrowUp", "KeyW")) pd.sel = (pd.sel + 9) % 12;
  if (took("ArrowDown", "KeyS")) pd.sel = (pd.sel + 3) % 12;
  if (took("Space", "Enter")) padPress(PAD_KEYS[pd.sel]);
  if (mouse.clicked) {
    PAD_KEYS.forEach((k, i) => {
      const bx = W / 2 - 45 + (i % 3) * 30;
      const by = 108 + Math.floor(i / 3) * 26;
      if (Math.abs(mouse.x - bx) < 13 && Math.abs(mouse.y - by) < 11) {
        pd.sel = i;
        padPress(k);
      }
    });
    if (mouse.y > 222) pd.result = false;
  }
}
function drawPad(): void {
  const pd = S.pad;
  if (!pd) return;
  const ox = pd.shake > 0 ? Math.sin(pd.shake * 60) * 3 : 0;
  g.fillStyle = "rgba(0,0,0,0.6)";
  g.fillRect(0, 0, W, H);
  g.fillStyle = "#1e2026";
  g.fillRect(W / 2 - 70 + ox, 40, 140, 196);
  g.fillStyle = "#3a3e46";
  g.fillRect(W / 2 - 70 + ox, 40, 140, 2);
  text(pd.title, W / 2 + ox, 52, "#ece6f4", "center");
  g.fillStyle = "#0e1a12";
  g.fillRect(W / 2 - 50 + ox, 64, 100, 22);
  const shown = pd.input.padEnd(pd.code.length, "_").split("").join(" ");
  text(shown, W / 2 + ox, 75, "#6ae88a", "center", "");
  PAD_KEYS.forEach((k, i) => {
    const bx = W / 2 - 45 + (i % 3) * 30 + ox;
    const by = 108 + Math.floor(i / 3) * 26;
    g.fillStyle = i === pd.sel ? "#ffd36a" : "#4a4e58";
    g.fillRect(bx - 12, by - 10, 24, 20);
    g.fillStyle = i === pd.sel ? "#e8b84a" : "#5a5e68";
    g.fillRect(bx - 12, by - 10, 24, 2);
    text(k, bx, by, i === pd.sel ? "#1a1a1a" : "#ece6f4", "center", "");
  });
  text("숫자키·방향키+Space · Esc 그만두기", W / 2, 228, "rgba(220,214,232,0.6)", "center", "");
}

/** 순서 기억 퍼즐: 보여 준 순서대로 누르면 true, 틀리면 false */
function playSimon(title: string, seq: number[], labels = ["◀", "▲", "▶", "▼"]): Promise<boolean> {
  S.simon = { title, seq, labels, phase: "show", t: -0.6, idx: 0, result: null, lit: -1, litT: 0 };
  return until(() => S.simon?.result !== null).then(() => {
    const ok = !!S.simon!.result;
    S.simon = null;
    return ok;
  });
}
const SIMON_COL = ["#e85a5a", "#5ae88a", "#5a9ae8", "#e8d05a"];
const SIMON_TONE = [330, 392, 494, 587];
function simonBeep(i: number): void {
  // 짧은 종소리 (효과음 재사용)
  void SIMON_TONE[i];
  sfx.blip();
}
function updateSimon(dt: number): void {
  const sm = S.simon!;
  sm.litT = Math.max(0, sm.litT - dt);
  if (sm.litT <= 0) sm.lit = -1;
  if (sm.phase === "show") {
    sm.t += dt;
    const step = Math.floor(sm.t / 0.7);
    const inStep = sm.t - step * 0.7;
    if (sm.t >= 0 && step < sm.seq.length && inStep < 0.45) {
      if (sm.lit !== sm.seq[step]) simonBeep(sm.seq[step]);
      sm.lit = sm.seq[step];
      sm.litT = 0.05;
    }
    if (step >= sm.seq.length) {
      sm.phase = "input";
      sm.idx = 0;
    }
    return;
  }
  let press = -1;
  const keysMap: Array<[string[], number]> = [
    [["ArrowLeft", "KeyA", "Digit1"], 0],
    [["ArrowUp", "KeyW", "Digit2"], 1],
    [["ArrowRight", "KeyD", "Digit3"], 2],
    [["ArrowDown", "KeyS", "Digit4"], 3],
  ];
  for (const [ks, i] of keysMap) if (took(...ks)) press = i;
  if (mouse.clicked) {
    for (let i = 0; i < 4; i++) {
      const bx = W / 2 - 75 + i * 50;
      if (Math.abs(mouse.x - bx) < 20 && Math.abs(mouse.y - 140) < 20) press = i;
    }
  }
  if (took("Escape")) sm.result = false;
  if (press < 0) return;
  sm.lit = press;
  sm.litT = 0.25;
  simonBeep(press);
  if (press !== sm.seq[sm.idx]) {
    sfx.croak();
    sm.result = false;
    return;
  }
  sm.idx++;
  if (sm.idx >= sm.seq.length) {
    sfx.item();
    sm.result = true;
  }
}
function drawSimon(): void {
  const sm = S.simon;
  if (!sm) return;
  g.fillStyle = "rgba(0,0,0,0.62)";
  g.fillRect(0, 0, W, H);
  text(sm.title, W / 2, 88, "#ece6f4", "center");
  text(sm.phase === "show" ? "잘 보고 기억하자..." : `순서대로 누르기 (${sm.idx}/${sm.seq.length})`, W / 2, 104, sm.phase === "show" ? "#b8b0c8" : "#ffd36a", "center");
  for (let i = 0; i < 4; i++) {
    const bx = W / 2 - 75 + i * 50;
    const on = sm.lit === i;
    g.fillStyle = on ? SIMON_COL[i] : mix(SIMON_COL[i], -0.6);
    g.beginPath();
    g.arc(bx, 140, on ? 19 : 16, 0, Math.PI * 2);
    g.fill();
    if (on) {
      g.fillStyle = "rgba(255,255,255,0.35)";
      g.beginPath();
      g.arc(bx - 5, 134, 6, 0, Math.PI * 2);
      g.fill();
    }
    text(sm.labels[i], bx, 172, "#d8d0e0", "center");
  }
  text("방향키 또는 1~4 · Esc 그만두기", W / 2, 196, "rgba(220,214,232,0.55)", "center", "");
}

// ── 추억 사진 (수집 요소) ─────────────────────────────────────
export const PHOTOS: Array<{ id: string; title: string; text: string }> = [
  { id: "p1", title: "처음 만난 날", text: "비 오는 골목, 상자 속에서 떨던 회색 털뭉치. 우산을 씌워 줬더니 내 손가락을 핥았다." },
  { id: "p2", title: "첫 목걸이", text: "분홍 목걸이에 금방울. 샘은 사흘 동안 방울 소리에 스스로 놀랐다." },
  { id: "p3", title: "야근하던 밤", text: "새벽 3시, 키보드 위에 드러누운 샘. 덕분에 보고서에 'ㅋㅋㅋㅋㅋㅋㅋ'가 들어갔다." },
  { id: "p4", title: "첫 생일", text: "생선 모양 케이크. 샘은 케이크 대신 상자를 더 좋아했다." },
  { id: "p5", title: "도둑맞은 양말", text: "침대 밑에서 발견된 내 양말 열두 짝. 범인은 시치미를 뗐다." },
  { id: "p6", title: "창가의 낮잠", text: "햇빛 한 줌을 따라 하루 종일 자리를 옮기는 샘. 해시계보다 정확하다." },
  { id: "p7", title: "가르시아 부인과", text: "옆집 가르시아 부인은 샘을 '작은 구름'이라고 불렀다. 간식도 몰래 줬다." },
  { id: "p8", title: "아픈 날", text: "독감으로 앓아누운 날, 샘이 하루 종일 내 가슴 위에서 골골송을 불러 줬다." },
  { id: "p9", title: "별 보는 고양이", text: "옥상에서 밤하늘을 올려다보던 샘. 그때도 어느 별을 찾고 있었던 걸까." },
  { id: "p10", title: "이삿날", text: "텅 빈 새집에서 가장 먼저 자기 자리를 찾은 건 샘이었다. 창틀 위." },
  { id: "p11", title: "츄르 한 봉지", text: "츄르 봉지 뜯는 소리만 나면 어디서든 달려온다. 순간이동이 분명하다." },
  { id: "p12", title: "우리 집", text: "맥주 한 캔, 고양이 한 마리, 낡은 소파. 그거면 충분했다." },
];
const PHOTO_KEY = "charlie_cat_photos";
export function photosFound(): string[] {
  try {
    return JSON.parse(localStorage.getItem(PHOTO_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}
async function findPhoto(id: string): Promise<void> {
  const ph = PHOTOS.find((q) => q.id === id)!;
  const got = photosFound();
  if (!got.includes(id)) {
    got.push(id);
    try {
      localStorage.setItem(PHOTO_KEY, JSON.stringify(got));
    } catch {
      /* 무시 */
    }
  }
  S.flags[`ph_${id}`] = 1;
  sfx.item();
  await caption(`추억 사진을 찾았다! 「${ph.title}」 (${got.length}/${PHOTOS.length})`);
  await caption(ph.text);
}
/** 사진이 숨어 있는 곳 */
function photoSpot(id: string, x: number, iconY = 160, label = "살펴보다"): Hotspot {
  return { x, iconY, label, enabled: () => !S.flags[`ph_${id}`], use: () => findPhoto(id) };
}
const END_KEY = "charlie_cat_endings";
export function endingsSeen(): string[] {
  try {
    return JSON.parse(localStorage.getItem(END_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}
function markEnding(e: string): void {
  const got = endingsSeen();
  if (!got.includes(e)) got.push(e);
  try {
    localStorage.setItem(END_KEY, JSON.stringify(got));
  } catch {
    /* 무시 */
  }
}

// ── 참치캔 (수집 → 샘 꾸미기 해금) ─────────────────────────────
export const CANS_TOTAL = 25;
const CAN_KEY = "charlie_cat_cans";
export function cansFound(): string[] {
  try {
    return JSON.parse(localStorage.getItem(CAN_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}
export const COSTUMES = [
  { id: "none", name: "없음", need: 0 },
  { id: "ribbon", name: "분홍 리본", need: 3 },
  { id: "glasses", name: "선글라스", need: 8 },
  { id: "crown", name: "왕관", need: 13 },
  { id: "helmet", name: "우주 헬멧", need: 20 },
  { id: "rainbow", name: "무지개 목도리", need: 999 },
];
function secretOn(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}
/** 이 꾸미기를 쓸 수 있나 (참치캔 개수 · 비밀 집회소 · 코나미 코드) */
function costumeOpen(c: { id: string; need: number }): boolean {
  if (secretOn("charlie_cat_konami")) return true;
  if (c.id === "rainbow") return secretOn("charlie_cat_secret");
  return cansFound().length >= c.need;
}
const tintedCat = tintCat;
export function costume(): string {
  try {
    return localStorage.getItem("charlie_cat_costume") ?? "none";
  } catch {
    return "none";
  }
}
function setCostume(id: string): void {
  try {
    localStorage.setItem("charlie_cat_costume", id);
  } catch {
    /* 무시 */
  }
}
async function findCan(id: string): Promise<void> {
  const got = cansFound();
  if (!got.includes(id)) {
    got.push(id);
    try {
      localStorage.setItem(CAN_KEY, JSON.stringify(got));
    } catch {
      /* 무시 */
    }
  }
  S.flags[`can_${id}`] = 1;
  sfx.can();
  await caption(`참치캔을 찾았다! (${got.length}/${CANS_TOTAL})`);
  const unlockedNow = COSTUMES.find((c) => c.need === got.length && c.need > 0);
  if (unlockedNow) {
    sfx.item();
    await caption(`샘 꾸미기 「${unlockedNow.name}」 해금! 타이틀 화면에서 씌워 줄 수 있다.`);
  }
}
/** 참치캔이 숨어 있는 곳 */
function canSpot(id: string, x: number, iconY = 176, label = "뒤져 보기"): Hotspot {
  return { x, iconY, label, enabled: () => !S.flags[`can_${id}`] && !cansFound().includes(id), use: () => findCan(id) };
}

/** 샘 머리에 꾸미기 소품을 씌운다 (left, top = 고양이 그림 왼쪽 위) */
function drawCostume(left: number, top: number, facing: 1 | -1, pose: string, id = costume()): void {
  if (id === "none") return;
  const h = catHead(pose);
  if (!h) return;
  const f = facing;
  const hx = left + (f === 1 ? h.x : 32 - h.x);
  const hy = top + h.y;
  g.save();
  g.translate(hx, hy);
  g.rotate(h.tilt * f);
  if (id === "ribbon") {
    g.fillStyle = "#f06a9a";
    g.beginPath();
    g.moveTo(-f * 1, -3.4);
    g.lineTo(-f * 3.6, -5);
    g.lineTo(-f * 3.4, -2);
    g.closePath();
    g.moveTo(-f * 1, -3.4);
    g.lineTo(f * 1.4, -5.4);
    g.lineTo(f * 1.2, -2.2);
    g.closePath();
    g.fill();
    g.fillStyle = "#c8466a";
    g.beginPath();
    g.arc(-f * 1, -3.4, 0.8, 0, Math.PI * 2);
    g.fill();
  } else if (id === "glasses") {
    g.strokeStyle = "#111";
    g.lineWidth = 0.45;
    g.beginPath();
    g.moveTo(f * 0.6, -0.9);
    g.lineTo(-f * 2.8, -1.2);
    g.stroke();
    g.fillStyle = "#14141a";
    g.beginPath();
    g.ellipse(f * 1.6, -0.6, 1.5, 1.1, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "rgba(255,255,255,0.7)";
    g.fillRect(f * 1.6 - 0.8, -1.2, 0.6, 0.4);
  } else if (id === "crown") {
    g.fillStyle = "#f0c43a";
    g.beginPath();
    g.moveTo(-2.4, -4.2);
    g.lineTo(-2.6, -6.6);
    g.lineTo(-1.2, -5.2);
    g.lineTo(0, -7);
    g.lineTo(1.2, -5.2);
    g.lineTo(2.6, -6.6);
    g.lineTo(2.4, -4.2);
    g.closePath();
    g.fill();
    g.fillStyle = "#e84a6a";
    g.beginPath();
    g.arc(0, -5, 0.55, 0, Math.PI * 2);
    g.fill();
  } else if (id === "rainbow") {
    const cols = ["#e84a4a", "#f0a03a", "#f0e04a", "#5ac85a", "#4a8ae8", "#9a5ae8"];
    cols.forEach((c, i) => {
      g.strokeStyle = c;
      g.lineWidth = 0.55;
      g.beginPath();
      g.arc(f * 0.5, 2.6 + i * 0.5, 3.4, Math.PI * 0.15, Math.PI * 0.85);
      g.stroke();
    });
    g.fillStyle = "#e84a4a";
    g.fillRect(-f * 2.6 - 0.6, 4, 1.2, 3.4 + Math.sin(clock.t * 4));
  } else if (id === "helmet") {
    g.fillStyle = "rgba(190,225,255,0.22)";
    g.strokeStyle = "rgba(220,240,255,0.85)";
    g.lineWidth = 0.5;
    g.beginPath();
    g.arc(0, -1.6, 5.4, 0, Math.PI * 2);
    g.fill();
    g.stroke();
    g.strokeStyle = "rgba(255,255,255,0.8)";
    g.beginPath();
    g.arc(-1.2, -2.8, 3.4, Math.PI * 1.1, Math.PI * 1.5);
    g.stroke();
    g.strokeStyle = "#8a9aaa";
    g.beginPath();
    g.moveTo(1.5, -6.6);
    g.lineTo(2.6, -9);
    g.stroke();
    g.fillStyle = Math.floor(clock.t * 3) % 2 ? "#6ae88a" : "#2a6a4a";
    g.beginPath();
    g.arc(2.7, -9.2, 0.6, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

// ── 샘 쓰다듬기 ─────────────────────────────────────────────
let petUntil = 0;
let petPrev: string | null = null;
function petCount(): number {
  try {
    return Number(localStorage.getItem("charlie_cat_pets")) || 0;
  } catch {
    return 0;
  }
}
function canPet(): boolean {
  const sc = S.scene;
  return !!sc && !sc.noPlayer && S.control && !S.talk && !S.hidden && sam.visible && charlie.kind === "charlie" && Math.abs(sam.x - charlie.x) < 34 && Math.abs(sam.y - charlie.y) < 20;
}
function petSam(): void {
  S.flags.pets = (S.flags.pets ?? 0) + 1;
  const n = petCount() + 1;
  try {
    localStorage.setItem("charlie_cat_pets", String(n));
  } catch {
    /* 무시 */
  }
  if (clock.t > petUntil) petPrev = sam.pose;
  petUntil = clock.t + 1.1;
  sam.pose = "butt";
  sam.facing = charlie.x > sam.x ? 1 : -1;
  emote(sam, n % 7 === 0 ? "♪" : "♥");
  sfx.purr();
  if ([10, 30, 77].includes(n)) void cutscene(() => caption(n === 10 ? "샘이 찰리 다리에 몸을 비빈다. (쓰다듬은 횟수 10회)" : n === 30 ? "샘이 배를 보여 준다! 최고의 신뢰 표시다. (30회)" : "골골골골... 샘의 골골송이 멈추질 않는다. (77회 달성!)"));
}
function updatePet(): void {
  if (petUntil > 0 && clock.t > petUntil) {
    petUntil = 0;
    sam.pose = petPrev ?? "sit";
  }
  if (canPet() && took("KeyC")) petSam();
}


// ── 문 여닫기 · 계단 오르내리기 ─────────────────────────────────
/** 문틀 안쪽: 어두운 실내와 계단 */
function drawDoorBack(camX: number): void {
  const d = S.door;
  if (!d || d.open <= 0.01) return;
  const x0 = d.x - d.w / 2 - camX;
  const h = GROUND - d.top;
  const gr = g.createLinearGradient(0, d.top, 0, GROUND);
  gr.addColorStop(0, "#07060a");
  gr.addColorStop(1, "#16121a");
  g.fillStyle = gr;
  g.fillRect(x0, d.top, d.w, h);
  if (d.kind === "up") {
    // 위로 올라가는 계단 (안쪽으로 멀어질수록 어둡게)
    for (let i = 0; i < 7; i++) {
      const sy = GROUND - 4 - i * 7;
      const k = 1 - i / 7;
      g.fillStyle = `rgba(${Math.round(90 * k + 20)},${Math.round(80 * k + 18)},${Math.round(70 * k + 18)},1)`;
      g.fillRect(x0 + 2 + i * 1.5, sy, d.w - 4 - i * 3, 3);
      g.fillStyle = `rgba(0,0,0,${(0.35 + i * 0.07).toFixed(2)})`;
      g.fillRect(x0 + 2 + i * 1.5, sy + 3, d.w - 4 - i * 3, 4);
    }
    g.fillStyle = "rgba(160,150,130,0.6)";
    g.fillRect(x0 + d.w - 5, d.top + 10, 1, h - 12);
  } else if (d.kind === "down") {
    // 아래로 내려가는 계단: 문턱 바로 아래로 꺾여 내려가는 난간과 첫 계단들
    for (let i = 0; i < 4; i++) {
      const sy = GROUND - 2 - i * 3;
      g.fillStyle = `rgba(${110 - i * 22},${100 - i * 20},${90 - i * 18},1)`;
      g.fillRect(x0 + 3, sy, d.w - 6, 1.5);
    }
    g.strokeStyle = "rgba(170,160,140,0.7)";
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x0 + 3, d.top + 18);
    g.lineTo(x0 + d.w - 3, GROUND - 6);
    g.stroke();
    const dg2 = g.createLinearGradient(0, d.top, 0, GROUND);
    dg2.addColorStop(0, "rgba(0,0,0,0.6)");
    dg2.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = dg2;
    g.fillRect(x0, d.top, d.w, h);
  }
}
/** 문짝 (경첩 쪽으로 접히며 열린다) + 안으로 들어갈수록 어둠 */
function drawDoorFront(camX: number): void {
  const d = S.door;
  if (!d) return;
  const x0 = d.x - d.w / 2 - camX;
  const h = GROUND - d.top;
  if (d.fade > 0) {
    g.fillStyle = `rgba(6,5,10,${Math.min(1, d.fade).toFixed(2)})`;
    g.fillRect(x0, d.top, d.w, h);
  }
  if (!d.panel) return;
  const pw = Math.max(2, d.w * (1 - d.open));
  g.fillStyle = mix(d.col, -0.35);
  g.fillRect(half(x0), d.top, pw, h);
  g.fillStyle = d.col;
  g.fillRect(half(x0 + 0.5), d.top + 1, Math.max(1, pw - 1.5), h - 1);
  if (pw > 8) {
    g.fillStyle = mix(d.col, -0.12);
    g.fillRect(half(x0 + 3), d.top + 5, pw - 6, h * 0.35);
    g.fillRect(half(x0 + 3), d.top + h * 0.5, pw - 6, h * 0.42);
    g.fillStyle = "#d8b84a";
    g.fillRect(half(x0 + pw - 4), d.top + h * 0.52, 1.5, 2.5);
  }
}
/** 문을 열고 들어가서(또는 계단을 오르내려서) 사라진 뒤 문을 닫는다 */
async function doorTransition(x: number, kind: "in" | "down" | "up", o: { top?: number; w?: number; col?: string; panel?: boolean } = {}): Promise<void> {
  const top = o.top ?? 148;
  const w = o.w ?? 26;
  S.door = { x, kind, open: o.panel === false ? 1 : 0, target: 1, w, top, col: o.col ?? "#5a3828", panel: o.panel !== false, fade: 0 };
  sfx.step();
  await until(() => !S.door || S.door.open >= 0.99);
  if (!S.door) return;
  await walkTo(charlie, x, 42);
  // 문틀 밖으로 삐져나오지 않게, 내려갈 땐 문턱 아래(다리)가 먼저 사라지게
  charlie.clip = { x0: x - w / 2, y0: top, x1: x + w / 2, y1: GROUND + (kind === "down" ? 0 : 1) };
  if (kind === "down") {
    charlie.anim = { prefix: "front", frames: 8, fps: 9 };
    for (let i = 0; i < 5; i++) {
      sfx.step();
      await tween(charlie, x, charlie.y + 8, 0.26, 0);
      if (S.door) S.door.fade = i / 5;
    }
  } else if (kind === "up") {
    charlie.anim = { prefix: "climb", frames: 8, fps: 8 };
    for (let i = 0; i < 5; i++) {
      sfx.step();
      await tween(charlie, x + 1, charlie.y - 5, 0.26, 0);
      if (S.door) S.door.fade = i / 4;
    }
  } else {
    charlie.pose = "back";
    for (let i = 0; i < 6; i++) {
      await wait(0.08);
      if (S.door) S.door.fade = i / 5;
    }
  }
  charlie.anim = null;
  charlie.visible = false;
  if (!S.door) return;
  S.door.fade = 0;
  if (S.door.panel) {
    S.door.target = 0;
    await until(() => !S.door || S.door.open <= 0.01);
    sfx.step();
  }
}
/** 정면을 보고 계단을 내려간다 */
async function descend(steps: number, dx = 0): Promise<void> {
  charlie.clip = { x0: charlie.x - 40, y0: -200, x1: charlie.x + 40 + dx * steps, y1: GROUND };
  charlie.anim = { prefix: "front", frames: 8, fps: 9 };
  for (let i = 0; i < steps; i++) {
    sfx.step();
    await tween(charlie, charlie.x + dx, charlie.y + 5, 0.26, 0);
  }
  charlie.anim = null;
}
/** 등을 보이며 계단을 오른다 */
async function ascend(steps: number): Promise<void> {
  charlie.anim = { prefix: "climb", frames: 8, fps: 8 };
  for (let i = 0; i < steps; i++) {
    sfx.step();
    await tween(charlie, charlie.x, charlie.y - 5, 0.26, 0);
  }
  charlie.anim = null;
}

// ═════════════════════════════════════════════════════════
// 매 프레임
// ═════════════════════════════════════════════════════════
export function update(dt: number): void {
  if (S.help > 0) S.help -= dt;
  const sc = S.scene;
  // 컷신 레터박스
  const cine = S.mode === "play" && !!S.scene && !S.control && !S.scene.noPlayer;
  S.bars += ((cine ? 1 : 0) - S.bars) * Math.min(1, dt * 5);
  S.cam.zoom += (S.cam.zoomTarget - S.cam.zoom) * Math.min(1, dt * 3);
  if (S.control) {
    S.cam.focus = null;
    S.cam.zoomTarget = 1;
  }
  if (S.diary) {
    if (took("KeyJ", "Escape", "Space", "Enter", "click")) S.diary = false;
    return;
  }
  if (S.mode === "play" && S.scene && !S.scene.noPlayer && S.control && !S.talk && took("KeyJ")) {
    S.diary = true;
    sfx.blip();
    return;
  }
  if (S.movie) {
    const m = S.movie;
    m.t += dt;
    const shot = m.shots[m.i];
    if (took(...ADVANCE) && m.t > 0.6) m.t = Math.max(m.t, shot.dur - 0.4);
    if (took("Escape")) m.i = m.shots.length;
    if (m.t >= shot.dur || m.i >= m.shots.length) {
      m.i++;
      m.t = 0;
      if (m.i >= m.shots.length) S.movie = null;
    }
    return;
  }
  if (S.talk) {
    S.talk.typed = Math.min(S.talk.text.length, S.talk.typed + dt * 32);
    if (took(...ADVANCE)) advanceTalk();
  } else if (S.choice) updateChoice();
  else if (S.pad) updatePad(dt);
  else if (S.simon) updateSimon(dt);
  if (S.mode === "gameover") {
    if (took("Space", "Enter", "click")) void goScene(S.over!.scene, S.over!.checkpoint);
    else if (took("Escape")) {
      S.mode = "title";
      S.scene = null;
    }
    return;
  }
  if (!sc || S.mode !== "play") return;
  stepMovers(dt);
  updatePet();
  if (S.door) {
    const d = S.door;
    d.open += Math.sign(d.target - d.open) * Math.min(Math.abs(d.target - d.open), dt * 3.2);
  }

  if (sc.noPlayer) {
    if (S.control && !S.talk) {
      if (took("ArrowLeft", "KeyA")) S.fridgeSel = (S.fridgeSel + FRIDGE_ITEMS.length - 1) % FRIDGE_ITEMS.length;
      if (took("ArrowRight", "KeyD")) S.fridgeSel = (S.fridgeSel + 1) % FRIDGE_ITEMS.length;
      let use = took("Space", "Enter", "KeyE") ? S.fridgeSel : -1;
      if (mouse.clicked) {
        FRIDGE_ITEMS.forEach((it, i) => {
          const p = FRIDGE_SPOTS[it.key];
          if (Math.hypot(mouse.x - p.x, mouse.y - p.y) < 34) use = i;
        });
      }
      if (use >= 0) {
        S.fridgeSel = use;
        void cutscene(() => useFridgeItem(use));
      }
    }
    return;
  }

  // 플레이어 조작
  if (S.control && !S.talk) {
    if (S.hidden) {
      charlie.moving = false;
      if (took("Space", "Enter", "KeyE", "click", "ArrowUp", "KeyW")) {
        S.hidden = false;
        charlie.visible = true;
        charlie.hideLook = false;
        sfx.step();
      }
    } else {
      if (took("KeyF") && sc.useLight && S.flags.supplies) {
        S.flags.light = S.flags.light === 0 ? 1 : 0;
        S.lightT = clock.t;
        sfx.blip();
      }
      const ax = axis();
      const speed = sneaking() ? 24 : running() ? 96 : 56;
      if (ax) {
        const nx = Math.max(sc.minX, Math.min(sc.maxX, charlie.x + ax * speed * dt));
        charlie.walkDist += Math.abs(nx - charlie.x) * (sneaking() ? 1.6 : 1);
        if (Math.floor((charlie.walkDist) / 12) !== Math.floor((charlie.walkDist - Math.abs(nx - charlie.x)) / 12)) sfx.step();
        charlie.x = nx;
        charlie.facing = ax > 0 ? 1 : -1;
        charlie.moving = true;
      } else charlie.moving = false;

      // 조사 지점
      const near = nearestHotspot();
      let use: Hotspot | null = null;
      if (near && took("Space", "Enter", "KeyE")) use = near;
      if (mouse.clicked) {
        for (const h of sc.hotspots) {
          if (!h.enabled()) continue;
          if (Math.hypot(mouse.x - (h.x - S.camX), mouse.y - h.iconY) < 14) use = h;
        }
      }
      if (use) {
        const h = use;
        charlie.moving = false;
        void cutscene(async () => {
          if (Math.abs(h.x - charlie.x) > (h.range ?? 26)) await walkTo(charlie, h.x - Math.sign(h.x - charlie.x) * 14, 56);
          await h.use();
        });
      }
    }
    // 구역 트리거
    for (const z of sc.zones) {
      if (z.fired && !z.repeat) continue;
      const hit = z.dir > 0 ? charlie.x >= z.x : charlie.x <= z.x;
      if (hit && (!z.when || z.when())) {
        z.fired = true;
        charlie.moving = false;
        void cutscene(z.run);
        break;
      }
    }
  } else if (!walkers.some((w) => w.a === charlie)) {
    charlie.moving = false;
  }
  sc.update?.(dt);

  // 카메라
  const target = Math.max(0, Math.min(sc.width - W, (S.cam.focus ?? charlie.x) - W / 2));
  S.camX += (target - S.camX) * Math.min(1, dt * 6);
}

function nearestHotspot(): Hotspot | null {
  const sc = S.scene;
  if (!sc) return null;
  let best: Hotspot | null = null;
  let bd = Infinity;
  for (const h of sc.hotspots) {
    if (!h.enabled()) continue;
    const d = Math.abs(h.x - charlie.x);
    if (d < (h.range ?? 26) && d < bd) {
      bd = d;
      best = h;
    }
  }
  return best;
}

// ═════════════════════════════════════════════════════════
// 그리기
// ═════════════════════════════════════════════════════════
/** 화면 도트 단위로 반올림 (해상도에 따라 1/4 ~ 1/8 칸) */
const half = (v: number) => Math.round(v * render.scale) / render.scale;

/** 스프라이트 밀도가 화면과 다르면 고품질로 줄여 그린다 */
function smoothDraw(img: HTMLCanvasElement, x: number, y: number, w: number, h: number): void {
  // 네모 도트 그대로 (도트 경계에 맞춰서)
  g.drawImage(img, Math.round(x * render.scale) / render.scale, Math.round(y * render.scale) / render.scale, w, h);
  g.imageSmoothingEnabled = false;
}

const dark = makeCanvas(W, H);
const dg = dark.getContext("2d")!;

/** 인물 머리 꼭대기의 높이 (발 기준, 화면 칸). 말풍선 · 감정 아이콘을 머리 바로 위에 붙이기 위해 */
function headTop(a: Actor): number {
  if (a.kind === "sam") {
    if (a.pose === "loaf" || a.pose === "butt") return 15;
    return a.pose === "sit" || (a.pose ?? "").startsWith("sitT") || !a.moving ? 22 : 19;
  }
  const B = a.kind === "charlie" ? S.build : (a.build ?? BUILD_3);
  let h = (B.legLen - 8 + 12 + B.torsoLen + 46) / 4;
  const hair = a.look?.hairStyle;
  if (hair === "pomp" || hair === "bun" || hair === "messy" || hair === "comb") h += 3;
  if (hair === "frog") h -= 1;
  if (a.pose === "sit" || a.pose === "drink" || a.pose === "sleep") h -= B.legLen * 0.14;
  if ((a.lastPose ?? "").startsWith("crouch")) h -= 6;
  return h;
}

/** 그늘 속에 숨은 모습: 어둡게 물든 실루엣 */
const shadeCache = new WeakMap<HTMLCanvasElement, HTMLCanvasElement>();
function shaded(src: HTMLCanvasElement): HTMLCanvasElement {
  let c = shadeCache.get(src);
  if (!c) {
    c = makeCanvas(src.width, src.height);
    const cg = c.getContext("2d")!;
    cg.drawImage(src, 0, 0);
    cg.globalCompositeOperation = "multiply";
    cg.fillStyle = "#3a3648";
    cg.fillRect(0, 0, c.width, c.height);
    cg.globalCompositeOperation = "destination-in";
    cg.drawImage(src, 0, 0);
    shadeCache.set(src, c);
  }
  return c;
}
function drawHidden(a: Actor, camX: number): void {
  const sx = half(a.x - camX);
  const breathe = Math.sin(clock.t * 2.4) * 0.3;
  g.save();
  g.globalAlpha = 0.8;
  if (a.kind === "sam") {
    smoothDraw(shaded(cat("loaf", a.facing)), sx - 15, half(a.y + breathe) - 22, 32, 24);
  } else {
    const spr = shaded(human(a.look ?? CHARLIE, a.lookId ?? "charlie", "crouch0", S.build, a.facing));
    const ox = a.facing === 1 ? HUMAN_ORIGIN.x : HUMAN_W - HUMAN_ORIGIN.x;
    smoothDraw(spr, sx - ox, half(a.y + breathe) - HUMAN_ORIGIN.y, HUMAN_W, 54);
  }
  g.restore();
}

function drawActor(a: Actor, camX: number): void {
  if (!a.visible) {
    if (a.hideLook && S.hidden && a === charlie) drawHidden(a, camX);
    return;
  }
  if (a.clip) {
    g.save();
    g.beginPath();
    g.rect(a.clip.x0 - camX, a.clip.y0, a.clip.x1 - a.clip.x0, a.clip.y1 - a.clip.y0);
    g.clip();
    const c = a.clip;
    a.clip = null;
    drawActor(a, camX);
    a.clip = c;
    g.restore();
    return;
  }
  const sx = half(a.x - camX);
  if (sx < -40 || sx > W + 40) return;
  const talking = S.talk && !S.talk.caption && S.talk.actor === a && S.talk.typed < S.talk.text.length;
  const bob = talking ? -Math.abs(Math.sin(clock.t * 12)) * 0.8 : 0;
  if (a.kind === "sam") {
    let pose: CatPose;
    const idle = (): CatPose => {
      const t = (clock.t + a.x * 0.01) % 4;
      if (t > 3.82) return "blink";
      return `sitT${Math.floor(clock.t * 6) % 8}`;
    };
    if (a.anim) pose = `${a.anim.prefix}${Math.floor(clock.t * a.anim.fps) % a.anim.frames}`;
    else if (a.pose === "sit") pose = idle();
    else if (a.pose) pose = a.pose as CatPose;
    else pose = a.moving ? `walk${Math.floor(a.walkDist / 1.5) % 16}` : idle();
    const spr = cat(pose, a.facing, !!a.silhouette);
    smoothDraw(spr, sx - 15, half(a.y + bob) - 22, 32, 24);
    if (!a.silhouette && a === sam) drawCostume(sx - 15, half(a.y + bob) - 22, a.facing, pose);
    if (a === sam && canPet()) text("[C] 쓰담쓰담", sx, half(a.y) - headTop(a) - 6, "#ffd6e6", "center");
    return;
  }
  const isCharlie = a.kind === "charlie";
  const look = isCharlie ? (a.look ?? CHARLIE) : a.look!;
  const id = isCharlie ? (a.lookId ?? "charlie") : a.lookId!;
  let pose: Pose;
  const sneakNow = isCharlie && sneaking() && S.control;
  const breath: Pose = `stand${Math.floor(clock.t / 0.55 + a.x * 0.01) % 4}`;
  if (a.anim) pose = `${a.anim.prefix}${Math.floor(clock.t * a.anim.fps) % a.anim.frames}`;
  else if (a.pose === "stand") pose = breath;
  else if (a.pose) pose = a.pose as Pose;
  else if (!isCharlie && a.torch) {
    pose = a.moving ? `walk${Math.floor(a.walkDist / 2) % 16}L` : "flashlight";
  } else {
    const held = isCharlie && lightOn();
    const L = held ? "L" : "";
    const since = clock.t - S.lightT;
    if (a.moving) pose = (sneakNow ? `crouch${Math.floor(a.walkDist / 2.5) % 8}` : `walk${Math.floor(a.walkDist / 2) % 16}`) + L;
    else if (isCharlie && since < 0.28 && !!S.flags.supplies && S.scene?.useLight) {
      const f = Math.min(3, Math.floor(since / 0.07));
      pose = `raise${held ? f : 3 - f}`;
    } else if (sneakNow) pose = `crouch0${L}`;
    else if (held) pose = "flashlight";
    else pose = breath;
  }
  a.lastPose = pose;
  const build = isCharlie ? S.build : (a.build ?? BUILD_3);
  const spr = human(look, id, pose, build, a.facing);
  const ox = a.facing === 1 ? HUMAN_ORIGIN.x : HUMAN_W - HUMAN_ORIGIN.x;
  g.fillStyle = "rgba(0,0,0,0.3)";
  g.fillRect(sx - 9, half(a.y) - 1, 18, 2);
  const pack = isCharlie && S.backpack ? backpackView(pose) : null;
  if (pack === "side") drawBackpack(sx, a.y + bob, a.facing, build, "behind");
  smoothDraw(spr, sx - ox, half(a.y + bob) - HUMAN_ORIGIN.y, HUMAN_W, 54);
  if (pack === "side") drawBackpack(sx, a.y + bob, a.facing, build, "strap");
  else if (pack === "back") drawBackpack(sx, a.y + bob, a.facing, build, "back");
  else if (pack === "front") drawBackpack(sx, a.y + bob, a.facing, build, "front");
}

/** 퇴근길 백팩: 옆모습은 등 뒤로, 뒷모습은 등 한가운데, 앞모습은 어깨끈만 */
function backpackView(pose: string): "side" | "back" | "front" | null {
  if (pose.startsWith("climb") || pose === "back") return "back";
  if (pose.startsWith("front") || pose.startsWith("stair")) return "front";
  if (pose === "sit" || pose === "sleep" || pose === "drink") return null;
  return "side";
}
function drawBackpack(sx: number, y: number, facing: 1 | -1, B: Build, part: "behind" | "strap" | "back" | "front"): void {
  const shoulder = y - (B.legLen + B.torsoLen + 4) / 4;
  const hip = y - (B.legLen + 4) / 4;
  const h = Math.max(8, (hip - shoulder) * 0.95);
  const top = half(shoulder + 1);
  const body = "#2e4a6a";
  const dark = "#1c2e44";
  const light = "#46688e";
  if (part === "behind") {
    const x = half(sx - facing * 6.5 - 3.5);
    g.fillStyle = dark;
    g.fillRect(x - 0.5, top - 0.5, 8, h + 1);
    g.fillStyle = body;
    g.fillRect(x, top, 7, h);
    g.fillStyle = light;
    g.fillRect(x, top, 7, 1);
    // 앞주머니와 지퍼
    g.fillStyle = "#3a5a7e";
    g.fillRect(facing === 1 ? x : x + 3, top + h * 0.5, 4, h * 0.42);
    g.fillStyle = "#c8c8d0";
    g.fillRect(facing === 1 ? x + 1 : x + 5, top + 2, 0.5, h * 0.35);
    // 손잡이 고리
    g.fillStyle = dark;
    g.fillRect(x + 2.5, top - 1.5, 2, 1.5);
  } else if (part === "strap") {
    // 어깨끈: 어깨에서 겨드랑이로 비스듬히
    g.fillStyle = dark;
    for (let i = 0; i < 6; i++) g.fillRect(half(sx - facing * (2.5 - i * 0.5)), half(top + 0.5 + i * 1.2), 1, 1.5);
  } else if (part === "back") {
    const x = half(sx - 4.5);
    g.fillStyle = dark;
    g.fillRect(x - 0.5, top - 0.5, 10, h + 1);
    g.fillStyle = body;
    g.fillRect(x, top, 9, h);
    g.fillStyle = light;
    g.fillRect(x, top, 9, 1);
    g.fillStyle = "#3a5a7e";
    g.fillRect(x + 1.5, top + h * 0.5, 6, h * 0.4);
    g.fillStyle = "#c8c8d0";
    g.fillRect(x + 2, top + h * 0.5, 5, 0.5);
  } else {
    g.fillStyle = dark;
    g.fillRect(half(sx - 4), top, 1, h * 0.7);
    g.fillRect(half(sx + 3), top, 1, h * 0.7);
  }
}

function drawLighting(sc: Scene, camX: number): void {
  if (sc.ambient <= 0) return;
  dg.globalCompositeOperation = "source-over";
  dg.clearRect(0, 0, W, H);
  dg.fillStyle = `rgba(6,5,14,${sc.ambient})`;
  dg.fillRect(0, 0, W, H);
  dg.globalCompositeOperation = "destination-out";
  const lights = sc.lights();
  for (const l of lights) {
    const lx = l.x - camX;
    if (l.cone) {
      const len = l.cone.len;
      const gr = dg.createRadialGradient(lx, l.y, 2, lx, l.y, len);
      gr.addColorStop(0, `rgba(0,0,0,${l.a})`);
      gr.addColorStop(1, "rgba(0,0,0,0)");
      dg.fillStyle = gr;
      dg.beginPath();
      dg.moveTo(lx, l.y);
      dg.lineTo(lx + l.cone.dir * len, l.y - len * l.cone.spread);
      dg.lineTo(lx + l.cone.dir * len, l.y + len * l.cone.spread * 1.6);
      dg.closePath();
      dg.fill();
      continue;
    }
    if (l.r <= 0 || lx < -l.r || lx > W + l.r) continue;
    const gr = dg.createRadialGradient(lx, l.y, 0, lx, l.y, l.r);
    gr.addColorStop(0, `rgba(0,0,0,${l.a})`);
    gr.addColorStop(1, "rgba(0,0,0,0)");
    dg.fillStyle = gr;
    dg.fillRect(lx - l.r, l.y - l.r, l.r * 2, l.r * 2 + 60);
  }
  g.imageSmoothingEnabled = true;
  g.drawImage(dark, 0, 0);
  g.imageSmoothingEnabled = false;
  // 따뜻한 빛 번짐
  g.globalCompositeOperation = "lighter";
  for (const l of lights) {
    const lx = l.x - camX;
    if (l.cone) {
      const len = l.cone.len;
      g.fillStyle = "rgba(255,240,180,0.10)";
      g.beginPath();
      g.moveTo(lx, l.y);
      g.lineTo(lx + l.cone.dir * len, l.y - len * l.cone.spread);
      g.lineTo(lx + l.cone.dir * len, l.y + len * l.cone.spread * 1.6);
      g.closePath();
      g.fill();
      continue;
    }
    if (!l.warm || l.r <= 0) continue;
    const gr = g.createRadialGradient(lx, l.y, 0, lx, l.y, l.r);
    gr.addColorStop(0, l.warm);
    gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr;
    g.fillRect(lx - l.r, l.y - l.r, l.r * 2, l.r * 2);
  }
  g.globalCompositeOperation = "source-over";
  if (sc.tint) {
    g.fillStyle = sc.tint;
    g.fillRect(0, 0, W, H);
  }
}

function magnifier(x: number, y: number, active: boolean): void {
  // 위치는 고정 (스크롤 중 떨림 방지). 금테 둥근 렌즈 + 나무 손잡이, 가까이 가면 빛나며 반짝인다
  const cx = x - 1;
  const cy = y - 1.5;
  g.save();
  if (active) {
    const pulse = 0.5 + 0.5 * Math.sin(clock.t * 4);
    const glow = g.createRadialGradient(cx, cy, 0, cx, cy, 11);
    glow.addColorStop(0, `rgba(255,224,130,${(0.35 + pulse * 0.25).toFixed(2)})`);
    glow.addColorStop(1, "rgba(255,210,100,0)");
    g.fillStyle = glow;
    g.beginPath();
    g.arc(cx, cy, 11, 0, Math.PI * 2);
    g.fill();
  } else g.globalAlpha = 0.82;
  // 그림자
  g.fillStyle = "rgba(0,0,0,0.35)";
  g.beginPath();
  g.arc(cx + 0.6, cy + 0.8, 5.2, 0, Math.PI * 2);
  g.fill();
  // 손잡이
  g.save();
  g.translate(cx, cy);
  g.rotate(Math.PI / 4);
  g.fillStyle = "#2a1a10";
  g.fillRect(4.2, -1.6, 6.4, 3.2);
  const wood = g.createLinearGradient(0, -1.2, 0, 1.2);
  wood.addColorStop(0, "#b8743a");
  wood.addColorStop(1, "#6a3a1a");
  g.fillStyle = wood;
  g.fillRect(4.6, -1.1, 5.6, 2.2);
  g.fillStyle = "#e8c050";
  g.fillRect(4.2, -1.4, 1.2, 2.8);
  g.restore();
  // 금테
  const rim = g.createLinearGradient(cx - 5, cy - 5, cx + 5, cy + 5);
  rim.addColorStop(0, "#fff0a8");
  rim.addColorStop(0.5, "#e8b840");
  rim.addColorStop(1, "#8a5a18");
  g.fillStyle = rim;
  g.beginPath();
  g.arc(cx, cy, 5, 0, Math.PI * 2);
  g.fill();
  // 유리
  const glass = g.createRadialGradient(cx - 1.5, cy - 1.5, 0.3, cx, cy, 4);
  glass.addColorStop(0, "#f4fcff");
  glass.addColorStop(0.45, "#a8d8f0");
  glass.addColorStop(1, "#4a88b0");
  g.fillStyle = glass;
  g.beginPath();
  g.arc(cx, cy, 3.7, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = "rgba(255,255,255,0.9)";
  g.lineWidth = 0.7;
  g.beginPath();
  g.arc(cx, cy, 2.5, Math.PI * 1.05, Math.PI * 1.55);
  g.stroke();
  g.restore();
  // 반짝이 (가까이 있을 때)
  if (active) {
    const t = clock.t * 2.2;
    const sx = cx + 5.5;
    const sy = cy - 5.5;
    const r = 1.4 + Math.abs(Math.sin(t)) * 1.4;
    g.fillStyle = "#fffbe0";
    g.beginPath();
    g.moveTo(sx, sy - r);
    g.lineTo(sx + r * 0.3, sy - r * 0.3);
    g.lineTo(sx + r, sy);
    g.lineTo(sx + r * 0.3, sy + r * 0.3);
    g.lineTo(sx, sy + r);
    g.lineTo(sx - r * 0.3, sy + r * 0.3);
    g.lineTo(sx - r, sy);
    g.lineTo(sx - r * 0.3, sy - r * 0.3);
    g.closePath();
    g.fill();
  }
}

export function drawPlay(): void {
  const sc = S.scene;
  if (!sc) return;
  const camX = half(S.camX);
  const sx = fx.shake > 0 ? Math.round((Math.random() - 0.5) * fx.shake * 10) : 0;
  const sy = fx.shake > 0 ? Math.round((Math.random() - 0.5) * fx.shake * 10) : 0;
  g.save();
  g.translate(sx, sy);
  const z = S.cam.zoom;
  if (Math.abs(z - 1) > 0.001) {
    g.translate(W / 2, H * ZOOM_Y);
    g.scale(z, z);
    g.translate(-W / 2, -H * ZOOM_Y);
  }
  g.drawImage(sc.bg, camX * PIX, 0, W * PIX, H * PIX, 0, 0, W, H);
  sc.back?.(camX);
  drawDoorBack(camX);
  for (const h of sc.hotspots as Array<Hotspot & { cover?: { kind: CoverKind; back: boolean } }>) if (h.cover?.back) drawCover(h.cover.kind, h.x - camX, false);
  if (!sc.noPlayer) {
    const all = [...sc.actors, charlie, sam].filter((a, i, arr) => arr.indexOf(a) === i);
    for (const a of all.sort((p, q) => (p.kind === "sam" ? 1 : 0) - (q.kind === "sam" ? 1 : 0))) drawActor(a, camX);
  }
  drawDoorFront(camX);
  // 숨으면 엄폐물이 찰리 앞을 가린다
  if (S.hidden && !sc.noPlayer) {
    for (const h of sc.hotspots as Array<Hotspot & { cover?: { kind: CoverKind; back: boolean } }>) if (h.cover && Math.abs(h.x - charlie.x) < 3) drawCover(h.cover.kind, h.x - camX, true);
  }
  sc.front?.(camX);
  drawLighting(sc, camX);
  sc.overlay?.(camX);
  if (!sc.noPlayer) for (const a of [...sc.actors, charlie, sam]) drawEmote(a, camX);
  g.restore();

  // 말풍선
  if (!sc.noPlayer) {
    for (const a of [...sc.actors, charlie]) {
      if (a.bubble && a.visible && !S.talk) bubble(a.bubble, ...toScreen(a.x - camX, a.y - headTop(a) - 2));
    }
  }
  // 조사 아이콘
  const near = S.control ? nearestHotspot() : null;
  if (sc.noPlayer) {
    if (S.control && !S.talk) {
      FRIDGE_ITEMS.forEach((it, i) => {
        const p = FRIDGE_SPOTS[it.key];
        magnifier(p.x, p.y - 20, i === S.fridgeSel);
      });
      const it = FRIDGE_ITEMS[S.fridgeSel];
      const p = FRIDGE_SPOTS[it.key];
      void p;
      g.fillStyle = "rgba(6,5,10,0.78)";
      g.fillRect(0, H - 20, W, 20);
      text(`← → 고르기   [Space] ${it.label}`, W / 2, H - 10, "#ffd36a", "center");
    }
  } else if (S.control) {
    // 돋보기는 가까이 다가갔을 때만 스르르 나타난다
    for (const h of sc.hotspots) {
      if (!h.enabled() || (S.hidden && !h.label.includes("숨기"))) continue;
      const d = Math.abs(h.x - charlie.x) - (h.range ?? 26);
      const vis = h === near ? 1 : Math.max(0, 1 - d / 24);
      if (vis <= 0) continue;
      g.save();
      g.globalAlpha = vis;
      magnifier(h.x - camX, h.iconY, h === near);
      g.restore();
    }
    if (S.hidden) text("[Space] 나오기", charlie.x - camX, 176, "#d8d0c0", "center");
    else if (near) text(`[Space] ${near.label}`, near.x - camX, near.iconY - 14, "#d8d0c0", "center");
  }

  // 컷신 레터박스
  if (S.bars > 0.01) {
    const bh = Math.round(S.bars * 20 * render.scale) / render.scale;
    g.fillStyle = "#000";
    g.fillRect(0, 0, W, bh);
    g.fillRect(0, H - bh, W, bh);
  }

  // 대사
  if (S.talk) {
    const shown = S.talk.text.slice(0, Math.floor(S.talk.typed));
    if (S.talk.caption || !S.talk.actor || sc.noPlayer) {
      const lines = wrap(S.talk.text, W - 60);
      const h = lines.length * 14 + 12;
      g.fillStyle = "rgba(6,5,10,0.82)";
      g.fillRect(20, H - h - 12, W - 40, h);
      let rest = shown;
      lines.forEach((l, i) => {
        const part = rest.slice(0, l.length);
        rest = rest.slice(l.length + 1);
        text(part, W / 2, H - h - 12 + 12 + i * 14, "#ece6f4", "center", "");
      });
    } else {
      const a = S.talk.actor;
      const topY = a.y - headTop(a) - 2;
      bubble(shown || " ", ...toScreen(a.x - camX, topY));
    }
  }

  drawChoice();
  drawPad();
  drawSimon();
  drawBag(sc);

  // HUD
  if (sc.id === "chapter1" || sc.id === "alley") {
    if (S.flags.supplies) {
      g.fillStyle = "rgba(6,5,10,0.6)";
      g.fillRect(W - 92, 6, 86, 16);
      text(`손전등${S.flags.treats ? " · 츄르" : ""}`, W - 12, 14, "#d8d0c0", "right");
    }
    if (sc.id === "chapter1" && S.flags.supplies && !S.flags.treats && !S.flags.robbed) {
      g.fillStyle = "rgba(6,5,10,0.6)";
      g.fillRect(W - 128, 24, 122, 16);
      text("목표: 샘의 츄르 찾기", W - 12, 32, "#ffd36a", "right");
    }
  }
  if (S.help > 0 && S.control) {
    g.globalAlpha = Math.min(1, S.help);
    g.fillStyle = "rgba(6,5,10,0.6)";
    g.fillRect(0, H - 18, W, 18);
    text(
      ["church", "pier", "center", "helipad"].includes(sc.id)
        ? "←→ 이동  Shift 달리기  ↓ 살금살금  Space 조사/숨기"
        : sc.id === "roofs"
          ? "←→ 이동  Shift 달리기(틈 뛰어넘기)  Space 숨기"
          : sc.id === "chapter1"
            ? "←→ 이동  Shift 달리기  Space 살펴보기 (클릭도 가능)"
            : "←→ 이동  Space 살펴보기 (클릭도 가능)",
      W / 2,
      H - 9,
      "#ece6f4",
      "center",
    );
    g.globalAlpha = 1;
  }

  if (S.mode === "gameover" && S.over) {
    g.fillStyle = "rgba(10,0,0,0.7)";
    g.fillRect(0, 0, W, H);
    g.save();
    g.font = "bold 26px Galmuri11";
    g.textAlign = "center";
    g.fillStyle = "#c82a2a";
    g.fillText(S.over.title, W / 2, 110);
    g.restore();
    text(S.over.msg, W / 2, 138, "#ece6f4", "center");
    text("[Space] 다시 하기     [Esc] 타이틀로", W / 2, 176, "#b8b0c8", "center");
  }
  drawMovie();
  if (S.diary) drawDiary(sc);
  else if (S.control && !sc.noPlayer) text("J 수첩", W - 8, H - 8, "rgba(220,214,232,0.45)", "right", "");
}

/** 엔딩을 가르는 세 가지 점수 */
export function scores(): { bond: number; friends: number; truth: number } {
  const F = S.flags;
  const photos = PHOTOS.filter((p2) => F[`ph_${p2.id}`]).length;
  const bond = Math.min(12, F.pets ?? 0) + photos + (F.samFed ? 2 : 0);
  const friends = ["metLee", "c3tony", "c3garcia", "internUp", "medGiven", "freed", "nabi", "metAda", "c3lily", "minjiHint"].filter((k) => F[k]).length;
  const truth = (F.shards ?? 0) + (F.bossSafe ? 1 : 0) + (F.meetAll ? 1 : 0) + (F.adaDone ? 1 : 0);
  return { bond, friends, truth };
}
const BOND_OK = 10;
const hearts = (n: number, max: number) => "♥".repeat(Math.min(5, Math.round((n / max) * 5))).padEnd(5, "♡");

/** 지금 할 일 */
function objective(id: string): string {
  const F = S.flags;
  if (id.startsWith("apt") || id.startsWith("flat") || id === "office1") return "불타는 아파트를 빠져나가자. 1층 현관 비밀번호는 관리실에.";
  if (id === "chapter1") return !F.supplies ? "편의점에서 쓸 만한 걸 챙기자." : !F.treats ? "냥이네 펫숍에서 샘의 츄르를 찾자." : "샘을 찾아 거리 끝까지.";
  if (id === "catMeet") return "동네 고양이들을 모두 쓰다듬어 보자.";
  if (id === "alley") return "어둠 속 그림자를 손전등으로 비추자.";
  if (id.startsWith("night")) return "(샘) 개구리들을 피해 도망치자!";
  if (id.startsWith("drug")) return "약국에서 건전지 찾기. 선반을 쳐서 사람들을 유인하자.";
  if (id === "subwayGate") return "물갈퀴 자국을 따라 지하철로.";
  if (id.startsWith("tun") || id === "staff2" || id === "pump2") return !F.grateOpen ? "철창을 열 도구를 찾자." : !F.drained ? "펌프실에서 물을 빼자." : "승강장으로!";
  if (id === "subway") return !F.gotTreats ? "개구리 소굴에서 츄르를 되찾자." : "개찰구 너머로 도망쳐!";
  if (id === "rooftop" || id === "roofs") return "샘을 쫓아 지붕을 건너자. 초록빛을 피해서.";
  if (id === "church" || id.startsWith("crypt") || id === "vault3")
    return !F.c3ruth ? "생존자들과 이야기하자." : !F.medGiven ? "지하 성물실에서 릴리의 약을 찾아 루스에게." : F.raid ? "고해실에 숨자!" : "모두와 이야기하자. 라디오도.";
  if (id.startsWith("bc")) return "7층 내 책상 서랍에서 사원증을 찾자.";
  if (id === "march5") return "시위대에 닿지 않게 부두까지.";
  if (id === "pier") return "하역장 환기구까지 잠입하자.";
  if (id === "center" || id === "sec4" || id === "arch4" || id === "cells4") return charlie.kind === "sam" ? "(샘) 카드키를 물어 와 셔터를 열자." : !F.labCode ? "실험실 비밀번호를 알아내자. (보안실 · 기록 보관실)" : "실험실로!";
  if (id === "helipad") return "헬기장의 샘에게!";
  return "샘을 찾자.";
}
const STORY_NOTES: Array<[string, string]> = [
  ["slept", "운석이 떨어진 밤, 샘이 깨진 창으로 뛰어나갔다."],
  ["frontOpen", "불타는 아파트를 빠져나왔다. 가르시아 부인과 토니의 집은 비어 있었다."],
  ["metLee", "핫도그 아저씨: 개구리들이 고양이를 자루에 담아 '회사'에 판단다."],
  ["robbed", "개구리 인간이 샘의 츄르를 훔쳐 달아났다."],
  ["ch1", "골목에서 샘을 봤지만 놓쳤다. 개구리 울음소리..."],
  ["battery", "약국에서 건전지를 구했다. 약을 찾는 사람들은... 좀비 같았다."],
  ["drained", "토니를 만났다. 터널의 물을 빼고 승강장으로."],
  ["gotTreats", "개구리 소굴의 자루 속에 샘이 있었다! 「블랙컴퍼니 납품용」"],
  ["ch2", "옥상에서 샘을 만났지만, 초록빛이 나타나 샘이 또 달아났다."],
  ["c3ruth", "교회의 생존자들. 루스: 사람은 붙들고 있던 것을 따라 변한다."],
  ["c3lily", "릴리: 초록빛이 오면 고양이들이 그쪽으로 걸어간다. 나비도 사라졌다."],
  ["ch3", "루스가 나 대신 격리 센터로 끌려갔다."],
  ["internUp", "인턴 민지가 커피 한 잔에 정신을 차렸다."],
  ["bossSafe", "부장의 금고 속 사진: 어린 그림스와 고양이 '나비'."],
  ["freed", "격리된 면역자들을 풀어 주었다."],
  ["nabi", "릴리의 고양이 나비를 찾았다!"],
  ["ch4", "그림스 부장이 샘을 옥상으로 데려갔다. 고양이로 외계 기술을 사려고."],
];
function drawDiary(sc: Scene): void {
  g.fillStyle = "rgba(6,5,10,0.6)";
  g.fillRect(0, 0, W, H);
  g.fillStyle = "#e8dcc0";
  g.fillRect(40, 18, W - 80, H - 36);
  g.fillStyle = "#c8b890";
  g.fillRect(40, 18, W - 80, 2);
  g.fillStyle = "#b8a878";
  for (let y = 56; y < H - 24; y += 14) g.fillRect(52, y, W - 104, 0.5);
  text("찰리의 수첩", W / 2, 32, "#3a2a1a", "center", "");
  text(`지금 할 일 · ${objective(sc.id)}`, 56, 48, "#a82a24", "left", "");
  const notes = STORY_NOTES.filter(([f]) => S.flags[f]).map(([, t]) => t);
  notes.slice(-12).forEach((t, i) => text(`· ${t}`, 56, 63 + i * 14, "#2a1e14", "left", ""));
  const sc2 = scores();
  text(`샘과의 유대 ${hearts(sc2.bond, 16)}  ·  인연 ${hearts(sc2.friends, 10)}  ·  별의 진실 ${hearts(sc2.truth, 8)}`, W / 2, H - 44, "#8a3a5a", "center", "");
  text(`추억 사진 ${photosFound().length}/${PHOTOS.length} · 참치캔 ${cansFound().length}/${CANS_TOTAL} · 별 조각 ${S.flags.shards ?? 0}/5`, W / 2, H - 30, "#6a5a40", "center", "");
}

/** 애니메이션 컷: 시네마 비율 화면 + 자막 */
function drawMovie(): void {
  const m = S.movie;
  if (!m || m.i >= m.shots.length) return;
  const shot = m.shots[m.i];
  const k = Math.min(1, m.t / shot.dur);
  g.save();
  g.fillStyle = "#000";
  g.fillRect(0, 0, W, H);
  shot.draw(m.t, k);
  g.restore();
  g.imageSmoothingEnabled = false;
  // 컷 사이 페이드
  const edge = Math.min(m.t / 0.6, (shot.dur - m.t) / 0.6, 1);
  if (edge < 1) {
    g.fillStyle = `rgba(0,0,0,${(1 - Math.max(0, edge)).toFixed(2)})`;
    g.fillRect(0, 0, W, H);
  }
  // 시네마 바 + 자막
  g.fillStyle = "#000";
  g.fillRect(0, 0, W, 30);
  g.fillRect(0, H - 34, W, 34);
  if (shot.text) {
    const shown = shot.text.slice(0, Math.floor(Math.max(0, m.t - 0.4) * 26));
    const lines = wrap(shot.text, W - 60);
    let rest = shown;
    lines.forEach((l, i) => {
      const part = rest.slice(0, l.length);
      rest = rest.slice(l.length + 1);
      text(part, W / 2, H - 22 + i * 13 - (lines.length - 1) * 6, "#ece6f4", "center", "");
    });
  }
  text("Space 넘기기 · Esc 건너뛰기", W - 8, 12, "rgba(220,214,232,0.35)", "right", "");
}

/** 머리 위 감정 아이콘 (톡 튀어나왔다가 사라진다) */
function drawEmote(a: Actor, camX: number): void {
  const e = a.emote;
  if (!e || !a.visible) return;
  const t = clock.t - e.t0;
  if (t > 1.8) {
    a.emote = null;
    return;
  }
  const pop = t < 0.15 ? t / 0.15 * 1.25 : t < 0.25 ? 1.25 - (t - 0.15) * 2.5 : 1;
  const fade = t > 1.5 ? 1 - (t - 1.5) / 0.3 : 1;
  const cat2 = a.kind === "sam";
  // 말풍선과 겹치지 않게 머리 옆(바라보는 반대쪽)에 띄운다
  const x = a.x - camX + (cat2 ? a.facing * 6 : -a.facing * 14);
  const y = a.y - headTop(a) + (cat2 ? -4 : 8) - Math.min(t, 0.3) * 6;
  g.save();
  g.globalAlpha = fade;
  g.translate(x, y);
  g.scale(pop, pop);
  g.fillStyle = "#0b0a0c";
  g.beginPath();
  g.ellipse(0, 0, 8, 7, 0, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.moveTo(-2, 5);
  g.lineTo(-4, 10);
  g.lineTo(2, 6);
  g.fill();
  g.fillStyle = "#f4ecff";
  g.beginPath();
  g.ellipse(0, 0, 7, 6, 0, 0, Math.PI * 2);
  g.fill();
  if (e.kind === "♥") {
    g.fillStyle = "#e84a6a";
    g.beginPath();
    g.moveTo(0, 3.5);
    g.bezierCurveTo(-6, -1, -3, -5.5, 0, -2);
    g.bezierCurveTo(3, -5.5, 6, -1, 0, 3.5);
    g.fill();
  } else if (e.kind === "💧") {
    g.fillStyle = "#4a9ae8";
    g.beginPath();
    g.moveTo(0, -4.5);
    g.quadraticCurveTo(3.5, 1, 0, 3.5);
    g.quadraticCurveTo(-3.5, 1, 0, -4.5);
    g.fill();
  } else if (e.kind === "💢") {
    g.strokeStyle = "#e83a3a";
    g.lineWidth = 1.2;
    for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      g.beginPath();
      g.moveTo(dx * 1, dy * 3.5);
      g.quadraticCurveTo(dx * 1, dy * 1, dx * 3.5, dy * 1);
      g.stroke();
    }
  } else {
    const col = e.kind === "!" ? "#e83a3a" : e.kind === "?" ? "#3a6ae8" : e.kind === "♪" ? "#3aa86a" : "#3a3a4a";
    g.font = "bold 9px Galmuri11";
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillStyle = col;
    g.fillText(e.kind, 0, 0.5);
  }
  g.restore();
}

// ═════════════════════════════════════════════════════════
// 타이틀
// ═════════════════════════════════════════════════════════
let titleBg: StreetInfo | null = null;
export function titleItems(): string[] {
  if (S.titleSub) {
    const save = loadSave();
    const items: string[] = [];
    if (save && !save.scene.startsWith("end")) items.push("마지막 저장에서");
    const un = unlocked();
    items.push("제1장부터");
    if (un >= 2) items.push("제2장부터");
    if (un >= 3) items.push("제3장부터");
    if (un >= 4) items.push("제4장부터");
    if (un >= 5) items.push("제5장부터");
    if (un >= 6) items.push("최종장부터");
    items.push("돌아가기");
    return items;
  }
  return [
    "새 게임",
    "이어하기",
    `추억 앨범 ${photosFound().length}/${PHOTOS.length}`,
    `샘 꾸미기: ${COSTUMES.find((c) => c.id === costume())?.name ?? "없음"} (참치캔 ${cansFound().length}/${CANS_TOTAL})`,
  ];
}

const titleTop = (_n: number) => 112;
const titleGap = () => (S.titleSub ? 14 : 17);
const KONAMI = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight"];
const konamiBuf: string[] = [];
let konamiMsg = 0;
export function updateTitle(): void {
  for (const k of pressed) {
    if (!k.startsWith("Arrow")) continue;
    konamiBuf.push(k);
    if (konamiBuf.length > 8) konamiBuf.shift();
    if (konamiBuf.join() === KONAMI.join()) {
      try {
        localStorage.setItem("charlie_cat_konami", "1");
      } catch {
        /* 무시 */
      }
      konamiMsg = clock.t + 3.5;
      sfx.meow();
      sfx.item();
    }
  }
  if (S.album > 0) {
    const n = PHOTOS.length;
    if (took("ArrowUp", "KeyW", "ArrowLeft")) S.album = ((S.album - 2 + n) % n) + 1;
    if (took("ArrowDown", "KeyS", "ArrowRight")) S.album = (S.album % n) + 1;
    if (took("Escape", "Enter", "Space") || mouse.clicked) S.album = 0;
    return;
  }
  if (S.titleSub && took("Escape")) {
    S.titleSub = false;
    S.titleSel = 1;
    return;
  }
  const items = titleItems();
  if (took("ArrowUp", "KeyW")) S.titleSel = (S.titleSel + items.length - 1) % items.length;
  if (took("ArrowDown", "KeyS")) S.titleSel = (S.titleSel + 1) % items.length;
  S.titleSel = Math.min(S.titleSel, items.length - 1);
  let pick = took("Space", "Enter") ? S.titleSel : -1;
  if (mouse.clicked) {
    items.forEach((_, i) => {
      const y = titleTop(items.length) + i * titleGap();
      if (mouse.y > y - 8 && mouse.y < y + 8 && Math.abs(mouse.x - W / 2) < 80) pick = i;
    });
  }
  if (pick < 0) return;
  S.titleSel = pick;
  const label = items[pick];
  sfx.blip();
  if (label === "새 게임") {
    S.flags = {};
    void goScene("intro", 0, false);
  } else if (label === "이어하기") {
    S.titleSub = true;
    S.titleSel = 0;
  } else if (label === "돌아가기") {
    S.titleSub = false;
    S.titleSel = 1;
  } else if (label === "제1장부터") {
    S.titleSub = false;
    S.flags = {};
    void goScene("chapter1", 0, false);
  } else if (label === "제2장부터") {
    S.flags = { supplies: 1, ch1: 1 };
    void goScene("drug1", 0, false);
  } else if (label === "제3장부터") {
    S.flags = { supplies: 1, ch1: 1, ch2: 1, treats: 1 };
    void goScene("roofs", 0, false);
  } else if (label === "제4장부터") {
    S.flags = { supplies: 1, ch1: 1, ch2: 1, ch3: 1, treats: 1 };
    void goScene("mLobby", 70, false);
  } else if (label === "제5장부터") {
    S.flags = { supplies: 1, ch1: 1, ch2: 1, ch3: 1, ch4a: 1, treats: 1 };
    void goScene("pier", 0, false);
  } else if (label === "최종장부터") {
    S.flags = { supplies: 1, ch1: 1, ch2: 1, ch3: 1, ch4: 1, treats: 1 };
    void goScene("helipad", 0, false);
  } else if (label.startsWith("샘 꾸미기")) {
    const open2 = COSTUMES.filter(costumeOpen);
    const i = open2.findIndex((c) => c.id === costume());
    setCostume(open2[(i + 1) % open2.length].id);
    if (open2.length === 1) sfx.croak();
  } else if (label.startsWith("추억 앨범")) {
    S.album = 1;
  } else if (label === "마지막 저장에서") {
    const s = loadSave()!;
    S.flags = { ...s.flags };
    S.build = s.tall ? BUILD_3 : BUILD_25;
    void goScene(s.scene, s.checkpoint, false);
  }
  if (label.endsWith("부터") || label === "마지막 저장에서") S.titleSub = false;
}

export function drawTitle(): void {
  if (!titleBg) titleBg = buildStreet(1200, false, 11);
  // 배경은 멈춰 있고, 찰리와 샘만 움직인다
  g.drawImage(titleBg.canvas, 120 * PIX, 0, W * PIX, H * PIX, 0, 0, W, H);
  g.fillStyle = "rgba(6,5,14,0.5)";
  g.fillRect(0, 0, W, H);
  drawTitleDuo();
  g.save();
  g.font = "bold 30px Galmuri11";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillStyle = "#1a0e08";
  g.fillText("찰리와 고양이", W / 2 + 2, 50);
  g.fillStyle = "#ebc24a";
  g.fillText("찰리와 고양이", W / 2, 48);
  g.restore();
  text("CHARLIE & THE CAT", W / 2, 76, "#b8b0c8", "center");
  const items = titleItems();
  const top = titleTop(items.length);
  {
    // 메뉴는 반투명 판 위에 (배경과 겹쳐도 잘 읽히게)
    const pw = S.titleSub ? 148 : 196;
    g.fillStyle = S.titleSub ? "rgba(10,8,18,0.82)" : "rgba(10,8,18,0.6)";
    g.fillRect(W / 2 - pw / 2, top - 12, pw, items.length * titleGap() + 8);
    g.fillStyle = "#ebc24a";
    g.fillRect(W / 2 - pw / 2, top - 12, pw, 1);
  }
  items.forEach((it, i) => {
    const sel = i === S.titleSel;
    text(sel ? `▶ ${it} ◀` : it, W / 2, top + i * titleGap(), sel ? "#ffd36a" : "#d8d0e0", "center");
  });
  text("↑↓ 선택 · Space 결정", W / 2, H - 10, "rgba(220,214,232,0.6)", "center");
  const ends = endingsSeen();
  if (ends.length) {
    const names: Array<[string, string]> = [["T", "진"], ["A", "해피"], ["D", "배드"], ["B", "애매1"], ["C", "애매2"]];
    text(`엔딩 ${names.map(([k, n]) => (ends.includes(k) ? `${n}✓` : "??")).join(" ")}  (${ends.length}/5)`, W - 8, 12, "#ffd36a", "right");
  }
  if (S.album > 0) drawAlbum();
  if (clock.t < konamiMsg) {
    g.fillStyle = "rgba(6,5,10,0.85)";
    g.fillRect(W / 2 - 150, 40, 300, 22);
    text("★ 치트 냥! 모든 꾸미기가 해금되었다냥 ★", W / 2, 51, "#ffd36a", "center");
  }
}

/** 타이틀: 샘이 찰리 다리에 머리를 비비고(헤드번팅), 찰리 머리 위로 하트 */
const HEART = [".##.##.", "#######", "#######", ".#####.", "..###..", "...#..."];
function pixelHeart(x: number, y: number, a: number, s = 1): void {
  g.globalAlpha = a;
  for (let yy = 0; yy < HEART.length; yy++)
    for (let xx = 0; xx < 7; xx++) {
      if (HEART[yy][xx] !== "#") continue;
      g.fillStyle = yy === 1 && xx === 1 ? "#ffd0dc" : "#ff5a7e";
      g.fillRect(Math.round((x + (xx - 3.5) * s) * 2) / 2, Math.round((y + yy * s) * 2) / 2, s, s);
    }
  g.globalAlpha = 1;
}
function drawTitleDuo(): void {
  const t = clock.t;
  const P = 2.6;
  const ph = t % P;
  const cyc = Math.floor(t / P);
  const cx = 112; // 찰리 발 가운데
  const fx = cx - HUMAN_ORIGIN.x;
  const spr = human(CHARLIE, "charlie", `stand${Math.floor(t / 0.55) % 4}`, S.build, 1);
  g.drawImage(spr, fx, GROUND - 52, HUMAN_W, 54);
  // 샘: 앉아서 꼬리 살랑 → 다가와 머리 비비기 → 다시 앉기
  let pose: CatPose;
  let sx: number;
  if (ph < 1.2) {
    pose = `sitT${Math.floor(t * 6) % 8}` as CatPose;
    sx = cx + 16;
  } else if (ph < 2.2) {
    pose = "butt";
    const k = (ph - 1.2) / 1.0;
    sx = cx + 11 + Math.sin(k * Math.PI * 3) * 1.2 + (k < 0.15 ? (1 - k / 0.15) * 5 : 0);
  } else {
    pose = `sitT${Math.floor(t * 6) % 8}` as CatPose;
    sx = cx + 11 + ((ph - 2.2) / 0.4) * 5;
  }
  const catX = Math.round((sx - 16) * 2) / 2;
  g.drawImage(cat(pose, -1), catX, GROUND - 22, 32, 24);
  drawCostume(catX, GROUND - 22, -1, pose);
  // 하트: 비빌 때마다 찰리 머리 위로 몽글몽글
  const headY = GROUND - 56;
  for (const c of [cyc - 1, cyc]) {
    for (const [emit, ox] of [[1.3, -4], [1.65, 5], [2.0, 0]] as Array<[number, number]>) {
      const age = t - (c * P + emit);
      if (age < 0 || age > 1.6) continue;
      const a = age < 0.2 ? age / 0.2 : 1 - (age - 0.2) / 1.4;
      pixelHeart(cx + ox + Math.sin(age * 5 + ox) * 2, headY - age * 16, Math.max(0, a), age < 0.15 ? 0.7 + age * 2 : 1);
    }
  }
}

function drawAlbum(): void {
  const got = photosFound();
  g.fillStyle = "rgba(6,5,10,0.92)";
  g.fillRect(0, 0, W, H);
  text(`추억 앨범  ${got.length}/${PHOTOS.length}`, W / 2, 18, "#ffd36a", "center");
  PHOTOS.forEach((ph, i) => {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const x = 70 + col * 113;
    const y = 50 + row * 52;
    const found = got.includes(ph.id);
    const sel = S.album === i + 1;
    g.fillStyle = sel ? "#ffd36a" : "#3a3440";
    g.fillRect(x - 46, y - 18, 92, 44);
    g.fillStyle = found ? "#e8dcc0" : "#1a1820";
    g.fillRect(x - 44, y - 16, 88, 40);
    if (found) {
      // 작은 폴라로이드 그림: 샘 실루엣
      g.fillStyle = "#8aa0b8";
      g.fillRect(x - 40, y - 13, 80, 24);
      g.drawImage(cat(`sitT${i % 8}`, 1), x - 12, y - 14, 24, 18);
    }
    text(found ? ph.title : "???", x, y + 18, found ? "#2a1a10" : "#6a6470", "center", "");
  });
  const ph = PHOTOS[S.album - 1];
  const found = got.includes(ph.id);
  const lines = wrap(found ? ph.text : "아직 찾지 못한 사진이다. 어딘가에 숨어 있다.", W - 60);
  lines.forEach((l, i) => text(l, W / 2, 222 + i * 13, "#ece6f4", "center"));
  text("←→ 넘기기 · Esc 닫기", W / 2, H - 8, "rgba(220,214,232,0.5)", "center", "");
}


/** 테스트용: 찰리 위치 조회/이동 */
export const probe: Record<string, number> = {};
export const debug = {
  probe,
  get charlie() {
    return charlie;
  },
  get sam() {
    return sam;
  },
};

/** 첫 등장 때 끊기지 않도록 자주 쓰는 프레임을 미리 굽는다 */
export function prewarm(): void {
  const poses: string[] = [];
  for (let i = 0; i < 16; i++) poses.push(`walk${i}`);
  for (let i = 0; i < 8; i++) poses.push(`crouch${i}`);
  for (let i = 0; i < 4; i++) poses.push(`stand${i}`);
  poses.push("flashlight", "sit", "drink", "sleep", "armsUp", "back");
  for (let i = 0; i < 8; i++) poses.push(`climb${i}`, `stair${i}`, `front${i}`, `crouch${i}L`);
  for (let i = 0; i < 16; i++) poses.push(`walk${i}L`);
  for (let i = 0; i < 4; i++) poses.push(`raise${i}`);
  // 처음 화면에 꼭 필요한 것만 바로 굽고, 나머지는 게임 중 남는 시간에
  const now = new Set(poses.slice(0, 28));
  for (const p of poses) for (const f of [1, -1] as const) {
    if (now.has(p) && f === 1) human(CHARLIE, "charlie", p, S.build, f);
    else bakeQueue.push(() => human(CHARLIE, "charlie", p, S.build, f));
  }
  const catPoses: string[] = ["blink", "startle", "loaf", "butt", "jump"];
  for (let i = 0; i < 16; i++) catPoses.push(`walk${i}`);
  for (let i = 0; i < 8; i++) catPoses.push(`sitT${i}`);
  for (const p of catPoses) for (const f of [1, -1] as const) bakeQueue.push(() => cat(p, f));
  // 다른 등장인물은 게임 중 남는 시간에 조금씩 굽는다
  const others: Array<[Look, string]> = [[ADDICT, "addict"], [STRANGERS[0], "st0"], [STRANGERS[1], "st1"], [STRANGERS[2], "st2"], [SKELETON, "sk"], [FROGMAN, "frog"], [FROG_KING, "frogking"], [RUTH, "ruth"], [TOMAS, "tomas"], [HAZMAT, "hazmat"], [BOSS, "boss"]];
  for (const [look, id] of others) {
    for (const p of [...poses.slice(0, 20), "sit"]) for (const f of [1, -1] as const) bakeQueue.push(() => human(look, id, p, BUILD_3, f));
  }
  for (const p of [...poses.slice(0, 20), "sit"]) for (const f of [1, -1] as const) bakeQueue.push(() => human(LILY, "lily", p, BUILD_KID, f));
}

const bakeQueue: Array<() => void> = [];
/** 프레임 여유가 있을 때 미리 굽기를 조금씩 진행한다 */
export function bakeIdle(deadline: number): void {
  while (bakeQueue.length && performance.now() < deadline) bakeQueue.shift()!();
}

// stages.ts (추가 스테이지) 에서 쓰는 도구들
export { SCENES, mkActor, doorTransition, flashCone, canSpot, tintedCat, credits, patrolKit as patrol, walkTo, tween, writeSave, emote, focusCam, gameOver, hideAt, patrolKit, choose, unlock, flameTongues, smokePuffs, half, smoothDraw, playMovie, has, give, take, openKeypad, playSimon, photoSpot, findPhoto, descend, ascend, charlie, sam, drawFires };
export type { Scene, Hotspot, Light, Zone };

/** 플레이어를 바꾼다 (샘으로 플레이하는 장면) */
export function setPlayer(a: Actor): void {
  charlie = a;
}

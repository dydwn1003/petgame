// 게임 본체: 장면 · 배우 · 조사 지점 · 스토리 연출
import {
  ADVANCE,
  GROUND,
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
import { ALLEY, BG_SCALE, FRIDGE_SPOTS, ROOM, SUBWAY, buildAlley, buildFridge, buildRoom, buildStreet, buildSubway, type StreetInfo } from "./bg";
import {
  BUILD_25,
  BUILD_3,
  CHARLIE,
  ADDICT,
  FROG_KING,
  FROGMAN,
  HUMAN_ORIGIN,
  SKELETON,
  ZOMBIES,
  cat,
  human,
  spriteDensity,
  type Build,
  type CatPose,
  type Look,
  type Pose,
} from "./sprites";
import { makeCanvas } from "./pixel";

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
  role?: "zombie" | "skeleton" | "frog";
  state?: string;
  home?: number;
  sign?: string;
  hop?: number;
  /** 연출 중 반복 재생할 동작 (예: 계단 오르기) */
  anim?: { prefix: string; frames: number; fps: number } | null;
}

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
  talk: null as null | { actor: Actor | null; text: string; typed: number; caption: boolean },
  over: null as null | { title: string; msg: string; checkpoint: number; scene: string },
  help: 0,
  titleSel: 0,
  fridgeSel: 0,
};

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
  dropScripts();
  walkers.length = 0;
  tweens.length = 0;
  S.talk = null;
  S.hidden = false;
  S.over = null;
  S.mode = "play";
  fx.card = null;
  charlie = mkActor("charlie", 0);
  sam = mkActor("sam", 0, 1, { visible: false });
  const sc = SCENES[id](checkpoint);
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

function drawFires(fires: StreetInfo["fires"], camX: number): void {
  for (const f of fires) {
    const sx = f.x - camX;
    if (sx < -40 || sx > W + 40) continue;
    for (let i = 0; i < 6; i++) {
      const fl = Math.sin(clock.t * 9 + i * 1.7 + f.x) * 0.5 + 0.5;
      const h = f.h * (0.4 + fl * 0.6);
      g.fillStyle = i % 2 ? "#ffb02a" : "#ff5a1a";
      g.fillRect(Math.round(sx + (i / 6) * f.w), Math.round(f.y + f.h - h), Math.ceil(f.w / 6), Math.round(h));
    }
    g.fillStyle = "#fff0a0";
    g.fillRect(Math.round(sx + f.w / 3), Math.round(f.y + f.h - 3), Math.round(f.w / 3), 3);
  }
}

function smoke(x: number, y: number, n: number, camX: number, color = "rgba(40,30,34,0.5)"): void {
  g.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const t = (clock.t * 0.25 + i / n) % 1;
    g.beginPath();
    g.ellipse(x - camX + Math.sin(t * 6 + i) * 8, y - t * 70, 6 + t * 16, 4 + t * 8, 0, 0, Math.PI * 2);
    g.fill();
  }
}

// ═════════════════════════════════════════════════════════
// 프롤로그 1: 퇴근길
// ═════════════════════════════════════════════════════════

SCENES.street1 = () => {
  const info = buildStreet(1200, false, 11);
  const addict = mkActor("person", 930, -1, { look: ADDICT, lookId: "addict", pose: "stand" });
  const sc: Scene = {
    id: "street1",
    width: 1200,
    bg: info.canvas,
    ambient: 0.42,
    lights: () => [...lampLights(info, false), { x: info.door, y: 150, r: 60, a: 0.6, warm: "rgba(255,200,120,0.08)" }],
    minX: 60,
    maxX: 1180,
    actors: [addict],
    hotspots: [
      ...info.posters.map((p, i): Hotspot => ({
        x: p.x,
        iconY: 148,
        label: "살펴보다",
        enabled: () => true,
        use: async () => {
          await caption(`「${p.text}」`);
          await say(charlie, ["운석...? 뭐, 나랑은 상관없지.", "누가 이런 걸 붙이고 다니는 거야.", "종말이 오면... 출근은 안 해도 되나.", "채식이든 뭐든, 지금은 맥주가 필요해."][i] ?? "...");
        },
      })),
      {
        x: 930,
        iconY: 150,
        label: "살펴보다",
        enabled: () => true,
        use: async () => {
          await caption("고개를 푹 숙인 채, 몇 시간째 제자리에서 흔들리고 있다.");
          await say(charlie, "...요즘 이런 사람이 부쩍 늘었어.");
        },
      },
    ],
    zones: [
      {
        x: 400,
        dir: -1,
        run: async () => {
          await walkTo(charlie, info.door + 46, 45);
          charlie.facing = -1;
          await say(charlie, "3일 만에 집이군...");
          await wait(0.5);
          await say(charlie, "3일 내내 잠도 못 잤군.");
          await wait(0.3);
          await say(charlie, "맥주와 휴식이 필요해...");
          await walkTo(charlie, info.door, 40);
          charlie.anim = { prefix: "climb", frames: 8, fps: 8 };
          for (let s = 0; s < 6; s++) {
            sfx.step();
            await tween(charlie, info.door, GROUND - (s + 1) * 6, 0.25, 0);
          }
          charlie.anim = null;
          charlie.pose = "climb0";
          await wait(0.3);
          await goScene("room");
        },
      },
    ],
    update: () => {
      addict.x = 930 + Math.round(Math.sin(clock.t * 0.8) * 1);
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
    await wait(3.2);
    // 운석 낙하
    meteor = 0;
    await wait(1.4);
    sfx.boom();
    sfx.glass();
    shake(1.2);
    flash("#ff6a2a", 1);
    zzz = false;
    charlie.pose = "armsUp";
    charlie.y = GROUND;
    sam.pose = "startle";
    charlie.bubble = null;
    await say(charlie, "씨...!? 뭐, 뭐야!");
    sam.facing = -1;
    sam.pose = "jump";
    await tween(sam, ROOM.desk + 20, 168, 0.45, 26);
    sam.pose = "startle";
    await wait(0.25);
    sam.pose = "jump";
    await tween(sam, ROOM.windowExit, 128, 0.4, 20);
    sfx.glass();
    sam.visible = false;
    charlie.pose = null;
    await wait(0.3);
    await walkTo(charlie, ROOM.desk + 40, 70);
    charlie.facing = -1;
    shake(0.4);
    await say(charlie, "샘! 안 돼!");
    await wait(0.4);
    await goScene("chapter1", 0);
  };

  const sc: Scene = {
    id: "room",
    width: ROOM.width,
    bg: buildRoom(),
    ambient: 0.55,
    lights: () => {
      const L: Light[] = [
        { x: 112, y: 100, r: 70, a: 0.5, warm: "rgba(120,150,255,0.05)" },
        { x: 210, y: 92, r: meteor >= 0 ? 130 : 70, a: meteor >= 1.4 ? 0.95 : 0.5, warm: meteor >= 1.4 ? "rgba(255,90,30,0.22)" : "rgba(120,150,255,0.05)" },
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
      // 창밖 운석
      const wx = 178 - camX;
      if (meteor >= 0 && meteor < 1.4) {
        for (let i = 0; i < 3; i++) {
          const k = (meteor * 1.3 + i * 0.3) % 1;
          const mx = wx + 64 - k * 70;
          const my = 52 + k * 70;
          g.strokeStyle = "#ff6a2a";
          g.lineWidth = 2;
          g.beginPath();
          g.moveTo(mx, my);
          g.lineTo(mx + 14, my - 14);
          g.stroke();
          g.fillStyle = "#fff0a0";
          g.fillRect(mx - 1, my - 1, 3, 3);
        }
      }
      if (meteor >= 1.4) {
        g.fillStyle = "#0e0a0c";
        g.fillRect(wx, 52, 64, 82);
        for (let i = 0; i < 4; i++) {
          const fl = Math.sin(clock.t * 8 + i * 2) * 0.5 + 0.5;
          g.fillStyle = i % 2 ? "#ff8a2a" : "#ff4a1a";
          g.fillRect(wx + 4 + i * 15, 134 - 30 - fl * 30, 12, 30 + fl * 30);
        }
        g.fillStyle = "#8a9aaa";
        for (const [sx, sy, sh] of [[6, 52, 12], [24, 52, 6], [50, 52, 10], [58, 120, 8]]) g.fillRect(wx + sx, sy, 2, sh);
        smoke(210, 60, 6, camX, "rgba(60,50,56,0.6)");
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
      await walkTo(charlie, ROOM.door + 40, 40);
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
  const zombies: Actor[] = [
    mkActor("person", 780, -1, { look: ZOMBIES[0], lookId: "z0", role: "zombie", state: "idle", home: 780 }),
    mkActor("person", 1040, -1, { look: ZOMBIES[1], lookId: "z1", role: "zombie", state: "idle", home: 1040 }),
    mkActor("person", 1640, -1, { look: ZOMBIES[2], lookId: "z2", role: "zombie", state: "idle", home: 1640 }),
  ];
  const march: Actor[] = [];
  let frog: Actor | null = null;
  let chantT = 2;
  const hideSpots = [...info.dumpsters, 1340];
  const exitX = 1860;

  const spawnMarch = () => {
    for (let i = 0; i < 5; i++) {
      march.push(mkActor("person", S.camX + W + 110 + i * 44, -1, { look: SKELETON, lookId: "sk", role: "skeleton", sign: SIGNS[i % SIGNS.length] }));
    }
  };

  const hide = (x: number): Hotspot => ({
    x,
    iconY: 172,
    label: "숨기",
    range: 22,
    enabled: () => !S.hidden,
    use: async () => {
      charlie.x = x;
      S.hidden = true;
      charlie.visible = false;
      sfx.step();
    },
  });

  const sc: Scene = {
    id: "chapter1",
    width: 1900,
    bg: info.canvas,
    ambient: 0.5,
    tint: "rgba(120,30,10,0.12)",
    lights: () => [
      ...lampLights(info, true),
      ...info.fires.map((f): Light => ({ x: f.x + f.w / 2, y: f.y + f.h / 2, r: 46 + Math.sin(clock.t * 10 + f.x) * 4, a: 0.7, warm: "rgba(255,110,40,0.12)" })),
    ],
    minX: 60,
    maxX: 1880,
    get actors() {
      return [...zombies, ...march, ...(frog ? [frog] : [])];
    },
    hotspots: [
      {
        x: info.bodega,
        iconY: 150,
        label: "살펴보다",
        enabled: () => !F.supplies,
        use: async () => {
          await caption("부서진 편의점. 선반은 거의 비어 있다.");
          sfx.item();
          F.supplies = 1;
          F.treats = 1;
          await caption("고양이 간식(츄르)과 손전등을 챙겼다.");
          await say(charlie, "샘은 이걸 정말 좋아하지. 어디선가 배고파하고 있을 거야.");
          writeSave("chapter1", info.bodega);
        },
      },
      ...info.posters.slice(1, 3).map((p, i): Hotspot => ({
        x: p.x,
        iconY: 148,
        label: "살펴보다",
        enabled: () => true,
        use: async () => {
          await caption(`불에 그을린 포스터. 「${p.text}」`);
          await say(charlie, i === 0 ? "...설마. 그냥 운석이 떨어진 것뿐이야." : "회개는 나중에 하고, 샘부터 찾자.");
        },
      })),
      ...hideSpots.map(hide),
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
        x: 640,
        dir: 1,
        when: () => !!F.supplies,
        run: async () => {
          charlie.facing = 1;
          await say(charlie, "저 사람... 아까 퇴근길에 흔들리던 그 사람인가?");
          await caption("발소리에 반응하는 것 같다. ↓(살금) 버튼을 누른 채로 걸으면 들키지 않고 옆을 지나갈 수 있다.");
          await caption("들켜서 쫓기면 쓰레기통에 숨어 따돌리자.");
        },
      },
      {
        x: 1260,
        dir: 1,
        when: () => !F.marchDone,
        run: async () => {
          spawnMarch();
          sfx.chant();
          charlie.facing = 1;
          await wait(0.6);
          await say(charlie, "저건... 시위대?");
          await caption("해골이 된 채식 시위대다. 닿으면 해골이 된다! 근처 문틈이나 쓰레기통에 숨자.");
          writeSave("chapter1", 1200);
        },
      },
      {
        x: 1500,
        dir: 1,
        when: () => !!F.marchDone && !F.robbed,
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
          await say(charlie, "샘이 이쪽으로 갔을 리 없어... 오던 길을 다시 살펴보자.");
          await walkTo(charlie, 1760, 60);
        },
      },
    ],
    update: (dt) => {
      if (!S.control) return; // 대사·연출 중에는 멈춤
      // 좀비
      for (const z of zombies) {
        const d = charlie.x - z.x;
        const dist = Math.abs(d);
        if (z.state === "idle") {
          z.pose = "stand";
          z.x = (z.home ?? z.x) + Math.sin(clock.t * 0.9 + (z.home ?? 0)) * 1.2;
          // 멈춰 있는 좀비는 '움직임'에만 반응한다: 살금살금 걷거나 가만히 있으면 들키지 않는다
          const noticeR = S.hidden || sneaking() || !charlie.moving ? 0 : running() ? 150 : 74;
          if (S.control && dist < noticeR) {
            z.state = "chase";
            z.bubble = "으어어...";
            sfx.groan();
          }
        } else {
          z.pose = null;
          if (dist > 240 || S.hidden) {
            z.state = "idle";
            z.home = z.x;
            z.bubble = null;
          } else {
            const step = Math.sign(d) * 30 * dt;
            z.x += step;
            z.walkDist += Math.abs(step) * 0.6;
            z.moving = true;
            z.facing = d > 0 ? 1 : -1;
            if (dist < 12 && S.mode === "play") gameOver("GAME OVER", "찰리는 마약에 취한 좀비들에게 붙잡혔다...", checkpointNow());
          }
        }
      }
      // 해골 시위대
      if (march.length) {
        for (const s of march) {
          s.x -= 34 * dt;
          s.walkDist += 34 * dt;
          s.moving = true;
          s.facing = -1;
          if (!S.hidden && Math.abs(s.x - charlie.x) < 10 && S.mode === "play") {
            charlie.look = SKELETON;
            charlie.lookId = "sk";
            flash("#ffffff", 1);
            gameOver("GAME OVER", "찰리는 해골이 되었다... 채식 시위대에 닿고 말았다.", 1200);
          }
        }
        chantT -= dt;
        if (chantT <= 0) {
          chantT = 2.4;
          for (const s of march) s.bubble = null;
          const s = march[Math.floor(Math.random() * march.length)];
          s.bubble = CHANTS[Math.floor(Math.random() * CHANTS.length)];
          sfx.chant();
        }
        if (march.every((s) => s.x < S.camX - 30 || s.x < charlie.x - 260)) {
          march.length = 0;
          F.marchDone = 1;
          writeSave("chapter1", 1400);
        }
      }
    },
    back: (camX) => {
      // 무너진 문틈 (숨을 곳)
      const dx = 1340 - camX;
      g.fillStyle = "#0a080a";
      g.fillRect(dx - 12, 160, 24, 52);
      g.fillStyle = "#3a2a22";
      g.fillRect(dx - 14, 158, 4, 54);
      g.fillRect(dx + 10, 164, 4, 48);
      g.fillRect(dx - 6, 168, 14, 3);
      drawFires(info.fires, camX);
      for (const f of info.fires) smoke(f.x + f.w / 2, f.y, 4, camX);
      // 쓰레기통 숨는 중 표시
      if (S.hidden) {
        g.fillStyle = "rgba(255,255,255,0.15)";
        g.fillRect(Math.round(charlie.x - camX - 20), 183, 40, 4);
      }
    },
    front: (camX) => {
      for (const s of march) {
        const sx = Math.round(s.x - camX);
        g.fillStyle = "#6a4a2a";
        g.fillRect(sx - 2, GROUND - 74, 2, 34);
        g.fillStyle = "#e8e0c8";
        g.fillRect(sx - 15, GROUND - 90, 28, 16);
        g.fillStyle = "#2a6a2a";
        g.fillRect(sx - 15, GROUND - 90, 28, 2);
        text(s.sign ?? "", sx - 1, GROUND - 81, "#2a6a2a", "center", "");
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
      charlie.y = GROUND - 36;
      charlie.pose = "stand";
      charlie.facing = 1;
      await fadeTo(0, 1.2);
      await wait(0.6);
      charlie.pose = null;
      charlie.anim = { prefix: "walk", frames: 16, fps: 20 };
      for (let s = 0; s < 6; s++) {
        sfx.step();
        await tween(charlie, info.door + s * 4, GROUND - 30 + s * 6, 0.2, 0);
      }
      charlie.anim = null;
      await wait(0.4);
      await say(charlie, "샘을 찾으러 가야겠어.");
      await chapterCard("제1장", "무너진 거리");
      S.help = 10;
      S.control = true;
    },
  };
  return sc;
};

function checkpointNow(): number {
  const F = S.flags;
  if (F.robbed) return 1500;
  if (F.marchDone) return 1400;
  if (F.supplies) return 600;
  return 0;
}

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
      if (S.flags.supplies) L.push({ x: charlie.x + charlie.facing * 16, y: charlie.y - 34, r: 0, a: 0.95, cone: { dir: charlie.facing, len: 170, spread: 0.32 } });
      return L;
    },
    minX: 20,
    maxX: 580,
    actors: [shadow],
    hotspots: [
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
          await chapterCard("제1장 끝", "");
          await goScene("subwayGate", 0, false);
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
          g.fillRect(sx - 3, GROUND - 17, 2, 1);
          g.fillRect(sx + 0, GROUND - 17, 2, 1);
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
            charlie.anim = { prefix: "climb", frames: 8, fps: 8 };
            for (let i = 0; i < 4; i++) {
              sfx.step();
              await tween(charlie, gateX, GROUND + (i + 1) * 3, 0.26, 0);
            }
            charlie.anim = null;
            await goScene("subway");
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
      await chapterCard("제2장", "개구리 굴");
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
  const pillarHide = (x: number): Hotspot => ({
    x,
    iconY: 150,
    label: "숨기",
    range: 18,
    enabled: () => !S.hidden && !chase,
    use: async () => {
      charlie.x = x;
      S.hidden = true;
      charlie.visible = false;
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
      if (F.light && !S.hidden) L.push({ x: charlie.x + charlie.facing * 16, y: charlie.y - 34, r: 0, a: 0.95, cone: { dir: charlie.facing, len: 160, spread: 0.3 } });
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
          await wait(0.4);
          king.state = "awake";
          king.pose = null;
          king.facing = 1;
          sfx.croak();
          shake(0.6);
          king.bubble = "개구우우울!!";
          await say(charlie, "...깼다.");
          king.bubble = null;
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
      if (took("KeyF") && S.control && !S.hidden) {
        F.light = F.light ? 0 : 1;
        sfx.blip();
      }
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
      await say(charlie, "(츄르 봉지를 흔든다) 샘~ 츄르 있다~");
      sfx.meow();
      await wait(0.6);
      sam.visible = true;
      sam.x = 380;
      sam.y = 150;
      sam.facing = -1;
      sam.pose = "sit";
      await say(charlie, "샘!! 거기 있었구나!");
      await walkTo(charlie, 330, 60);
      ufo = 0;
      shake(0.5);
      sfx.boom();
      await wait(1.2);
      sam.pose = "startle";
      await caption("하늘에서 이상한 초록빛이 내려왔다.");
      await say(charlie, "...이번엔 또 뭐야.");
      sam.pose = "jump";
      sam.facing = 1;
      await tween(sam, 470, 120, 0.6, 30);
      await tween(sam, 640, 100, 0.6, 30);
      sam.visible = false;
      await say(charlie, "샘! 그쪽으로 가면 안 돼!");
      F_end2();
      await fadeTo(1, 1.6);
      await chapterCard("제2장 끝", "다음 이야기에서 계속됩니다");
      S.mode = "title";
      S.scene = null;
      await fadeTo(0, 0.8);
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
// 매 프레임
// ═════════════════════════════════════════════════════════
export function update(dt: number): void {
  if (S.help > 0) S.help -= dt;
  const sc = S.scene;
  if (S.talk) {
    S.talk.typed = Math.min(S.talk.text.length, S.talk.typed + dt * 32);
    if (took(...ADVANCE)) advanceTalk();
  }
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
        sfx.step();
      }
    } else {
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
  const target = Math.max(0, Math.min(sc.width - W, charlie.x - W / 2));
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
  const same = Math.abs(spriteDensity() - render.scale) < 0.01;
  if (!same) {
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = "low";
  }
  g.drawImage(img, x, y, w, h);
  g.imageSmoothingEnabled = false;
}

const dark = makeCanvas(W, H);
const dg = dark.getContext("2d")!;

function drawActor(a: Actor, camX: number): void {
  if (!a.visible) return;
  const sx = half(a.x - camX);
  if (sx < -40 || sx > W + 40) return;
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
    smoothDraw(spr, sx - 15, half(a.y) - 22, 32, 24);
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
  else if (a.moving) pose = sneakNow ? `crouch${Math.floor(a.walkDist / 2.5) % 8}` : `walk${Math.floor(a.walkDist / 2) % 16}`;
  else if (sneakNow) pose = "crouch0";
  else if (isCharlie && S.scene?.useLight && S.flags.supplies && (S.scene.id !== "subway" || S.flags.light)) pose = "flashlight";
  else pose = breath;
  const build = isCharlie ? S.build : BUILD_3;
  const spr = human(look, id, pose, build, a.facing);
  const ox = a.facing === 1 ? HUMAN_ORIGIN.x : 32 - HUMAN_ORIGIN.x;
  g.fillStyle = "rgba(0,0,0,0.3)";
  g.fillRect(sx - 9, half(a.y) - 1, 18, 2);
  smoothDraw(spr, sx - ox, half(a.y) - HUMAN_ORIGIN.y, 32, 54);
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
  const by = Math.round(y + Math.sin(clock.t * 3 + x) * 2);
  g.fillStyle = "#000";
  g.fillRect(x - 5, by - 6, 11, 11);
  g.fillStyle = active ? "#ffd36a" : "#d8d0c0";
  g.fillRect(x - 4, by - 5, 7, 1);
  g.fillRect(x - 4, by + 1, 7, 1);
  g.fillRect(x - 4, by - 5, 1, 7);
  g.fillRect(x + 2, by - 5, 1, 7);
  g.fillRect(x + 3, by + 2, 2, 2);
  g.fillRect(x + 4, by + 3, 2, 2);
  g.fillStyle = "#8ab8d8";
  g.fillRect(x - 3, by - 4, 5, 5);
}

export function drawPlay(): void {
  const sc = S.scene;
  if (!sc) return;
  const camX = half(S.camX);
  const sx = fx.shake > 0 ? Math.round((Math.random() - 0.5) * fx.shake * 10) : 0;
  const sy = fx.shake > 0 ? Math.round((Math.random() - 0.5) * fx.shake * 10) : 0;
  g.save();
  g.translate(sx, sy);
  g.drawImage(sc.bg, camX * BG_SCALE, 0, W * BG_SCALE, H * BG_SCALE, 0, 0, W, H);
  sc.back?.(camX);
  if (!sc.noPlayer) {
    const all = [...sc.actors, charlie, sam].filter((a, i, arr) => arr.indexOf(a) === i);
    for (const a of all.sort((p, q) => (p.kind === "sam" ? 1 : 0) - (q.kind === "sam" ? 1 : 0))) drawActor(a, camX);
  }
  sc.front?.(camX);
  drawLighting(sc, camX);
  sc.overlay?.(camX);
  g.restore();

  // 말풍선
  if (!sc.noPlayer) {
    for (const a of [...sc.actors, charlie]) {
      if (a.bubble && a.visible && !S.talk) bubble(a.bubble, a.x - camX, a.y - 58);
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
    for (const h of sc.hotspots) if (h.enabled() && !(S.hidden && !h.label.includes("숨기"))) magnifier(h.x - camX, h.iconY, h === near);
    if (S.hidden) text("[Space] 나오기", charlie.x - camX, 176, "#d8d0c0", "center");
    else if (near) text(`[Space] ${near.label}`, near.x - camX, near.iconY - 14, "#d8d0c0", "center");
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
      const topY = a.pose === "sit" || a.pose === "drink" || a.pose === "sleep" ? a.y - 46 : a.y - 58;
      bubble(shown || " ", a.x - camX, topY);
    }
  }

  // HUD
  if (sc.id === "chapter1" || sc.id === "alley") {
    if (S.flags.supplies) {
      g.fillStyle = "rgba(6,5,10,0.6)";
      g.fillRect(W - 92, 6, 86, 16);
      text(`손전등${S.flags.treats ? " · 츄르" : ""}`, W - 12, 14, "#d8d0c0", "right");
    }
  }
  if (S.help > 0 && S.control) {
    g.globalAlpha = Math.min(1, S.help);
    g.fillStyle = "rgba(6,5,10,0.6)";
    g.fillRect(0, H - 18, W, 18);
    text(sc.id === "chapter1" ? "←→ 이동  Shift 달리기  ↓ 살금살금  Space 조사/숨기" : "←→ 이동  Space 살펴보기 (클릭도 가능)", W / 2, H - 9, "#ece6f4", "center");
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
}

// ═════════════════════════════════════════════════════════
// 타이틀
// ═════════════════════════════════════════════════════════
let titleBg: StreetInfo | null = null;
export function titleItems(): string[] {
  const save = loadSave();
  const items = ["새 게임"];
  if (save && !save.scene.startsWith("end")) items.push("이어하기");
  const un = unlocked();
  if (un >= 2) items.push("제2장부터");
  items.push(`체형: ${S.build === BUILD_3 ? "3등신" : "2.5등신"}`);
  return items;
}

export function updateTitle(): void {
  const items = titleItems();
  if (took("ArrowUp", "KeyW")) S.titleSel = (S.titleSel + items.length - 1) % items.length;
  if (took("ArrowDown", "KeyS")) S.titleSel = (S.titleSel + 1) % items.length;
  S.titleSel = Math.min(S.titleSel, items.length - 1);
  let pick = took("Space", "Enter") ? S.titleSel : -1;
  if (mouse.clicked) {
    items.forEach((_, i) => {
      if (mouse.y > 132 + i * 20 - 9 && mouse.y < 132 + i * 20 + 9 && Math.abs(mouse.x - W / 2) < 80) pick = i;
    });
  }
  if (pick < 0) return;
  S.titleSel = pick;
  const label = items[pick];
  sfx.blip();
  if (label === "새 게임") {
    S.flags = {};
    void goScene("street1", 0, false);
  } else if (label === "제2장부터") {
    S.flags = { supplies: 1, ch1: 1 };
    void goScene("subwayGate", 0, false);
  } else if (label === "이어하기") {
    const s = loadSave()!;
    S.flags = { ...s.flags };
    S.build = s.tall ? BUILD_3 : BUILD_25;
    void goScene(s.scene, s.checkpoint, false);
  } else {
    S.build = S.build === BUILD_3 ? BUILD_25 : BUILD_3;
  }
}

export function drawTitle(): void {
  if (!titleBg) titleBg = buildStreet(1200, false, 11);
  const pan = (clock.t * 8) % (1200 - W);
  g.drawImage(titleBg.canvas, pan * BG_SCALE, 0, W * BG_SCALE, H * BG_SCALE, 0, 0, W, H);
  g.fillStyle = "rgba(6,5,14,0.55)";
  g.fillRect(0, 0, W, H);
  const spr = human(CHARLIE, "charlie", `stand${Math.floor(clock.t / 0.55) % 4}`, S.build, 1);
  g.drawImage(spr, W / 2 - 120, GROUND - 52, 32, 54);
  g.drawImage(cat(`sitT${Math.floor(clock.t * 6) % 8}`, -1), W / 2 - 92, GROUND - 22, 32, 24);
  g.save();
  g.font = "bold 30px Galmuri11";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillStyle = "#1a0e08";
  g.fillText("찰리와 고양이", W / 2 + 2, 72);
  g.fillStyle = "#ebc24a";
  g.fillText("찰리와 고양이", W / 2, 70);
  g.restore();
  text("CHARLIE & THE CAT", W / 2, 98, "#b8b0c8", "center");
  titleItems().forEach((it, i) => {
    const sel = i === S.titleSel;
    text(sel ? `▶ ${it} ◀` : it, W / 2, 132 + i * 20, sel ? "#ffd36a" : "#d8d0e0", "center");
  });
  text("↑↓ 선택 · Space 결정", W / 2, H - 10, "rgba(220,214,232,0.6)", "center");
}


/** 테스트용: 찰리 위치 조회/이동 */
export const debug = {
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
  for (let i = 0; i < 8; i++) poses.push(`climb${i}`, `stair${i}`);
  for (const p of poses) for (const f of [1, -1] as const) human(CHARLIE, "charlie", p, S.build, f);
  const catPoses: string[] = ["blink", "startle", "loaf", "butt", "jump"];
  for (let i = 0; i < 16; i++) catPoses.push(`walk${i}`);
  for (let i = 0; i < 8; i++) catPoses.push(`sitT${i}`);
  for (const p of catPoses) for (const f of [1, -1] as const) cat(p, f);
  // 다른 등장인물은 게임 중 남는 시간에 조금씩 굽는다
  const others: Array<[Look, string]> = [[ADDICT, "addict"], [ZOMBIES[0], "z0"], [ZOMBIES[1], "z1"], [ZOMBIES[2], "z2"], [SKELETON, "sk"], [FROGMAN, "frog"], [FROG_KING, "frogking"]];
  for (const [look, id] of others) {
    for (const p of [...poses.slice(0, 20), "sit"]) for (const f of [1, -1] as const) bakeQueue.push(() => human(look, id, p, BUILD_3, f));
  }
}

const bakeQueue: Array<() => void> = [];
/** 프레임 여유가 있을 때 미리 굽기를 조금씩 진행한다 */
export function bakeIdle(deadline: number): void {
  while (bakeQueue.length && performance.now() < deadline) bakeQueue.shift()!();
}

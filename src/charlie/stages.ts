// 추가 스테이지: 방과 방을 문으로 잇는 미로 + 퍼즐
//  · 제1장 앞: 불타는 아파트 탈출 (4층 → 1층)
//  · 제2장: 지하철 점검 통로 (사물함 비밀번호, 쇠지렛대, 밸브 퍼즐)
//  · 제3장: 교회 지하 납골당 (악보와 종 퍼즐, 릴리의 약)
//  · 제4장: 격리 센터 보안실 · 기록 보관실 · 격리 구역
import { GROUND, W, chapterCard, clock, fadeTo, flash, g, keys, sfx, shake, sneaking, text, wait } from "./core";
import { ROOFS, ROOM, buildInterior, buildRoofs, buildRoom, buildStreet, type DoorDef, type PropKind, type Theme } from "./bg";
import { ADA, BOSS, BUILD_3, BUILD_KID, FROGMAN, GARCIA, LILY, MINJI, MRLEE, RUTH, SKELETON, STRANGERS, TOMAS, TONY, ZOMBIES, human } from "./sprites";
import {
  ITEMS,
  S,
  SCENES,
  caption,
  charlie,
  canSpot,
  sam,
  doorTransition,
  credits,
  patrol,
  setPlayer,
  tween,
  emote,
  gameOver,
  hideAt,
  tintedCat,
  smoothDraw,
  half,
  flashCone,
  flameTongues,
  give,
  goScene,
  has,
  mkActor,
  openKeypad,
  photoSpot,
  playSimon,
  say,
  smokePuffs,
  take,
  walkTo,
  writeSave,
  type Actor,
  type Hotspot,
  type Light,
  type Scene,
} from "./game";

Object.assign(ITEMS, {
  ext: "소화기",
  driver: "드라이버",
  fuse: "퓨즈",
  crowbar: "쇠지렛대",
  sheet: "찢어진 악보",
  med: "릴리의 천식약",
  mug: "샘 머그컵",
  coffee: "뜨거운 커피",
  bosskey: "부장실 열쇠",
  drawerkey: "내 서랍 열쇠",
  badge: "블랙컴퍼니 사원증",
  battery: "새 건전지",
});

type Door = DoorDef & {
  to?: string;
  toX?: number;
  dir?: "down" | "up" | "in";
  /** 막혀 있으면 이유를 돌려준다 */
  lock?: () => Promise<string | null> | string | null;
  use?: () => Promise<void>;
};

interface RoomOpts {
  id: string;
  label: string;
  theme: Theme;
  width: number;
  seed: number;
  startX: number;
  doors: Door[];
  /** 조사 지점에 그려 둘 소품 */
  props?: Array<[PropKind, number]>;
  hotspots?: () => Hotspot[];
  actors?: () => Actor[];
  dark?: boolean;
  ambient?: number;
  tint?: string;
  lights?: () => Light[];
  update?: (dt: number) => void;
  back?: (camX: number) => void;
  front?: (camX: number) => void;
  enter?: () => Promise<void>;
  minX?: number;
  maxX?: number;
}

const F = () => S.flags;

/** 방 하나를 장면으로 등록한다. checkpoint = 들어올 때의 x 위치 */
function room(o: RoomOpts): void {
  SCENES[o.id] = (checkpoint) => {
    const doors = o.doors;
    const actors = o.actors ? o.actors() : [];
    const sc: Scene = {
      id: o.id,
      label: o.label,
      width: o.width,
      bg: buildInterior(o.theme, o.width, o.seed, doors, o.props ?? []),
      ambient: o.ambient ?? (o.dark ? 0.86 : 0.45),
      tint: o.tint,
      useLight: o.dark && !!F().supplies,
      lights: () => {
        const L: Light[] = o.lights ? o.lights() : [];
        if (!o.dark) for (let x = 65; x < o.width; x += 130) L.push({ x, y: 26, r: 80, a: 0.6, warm: "rgba(255,230,180,0.05)" });
        const cone = o.dark ? flashCone(160, 0.3) : null;
        if (cone && o.id === "drug1" && !F().battery) {
          // 건전지가 다 돼 가는 손전등: 짧고 깜빡인다
          cone.a = Math.sin(clock.t * 37) > 0.75 ? 0.1 : 0.55;
          if (cone.cone) cone.cone.len = 80;
        }
        if (cone) L.push(cone);
        L.push({ x: charlie.x, y: charlie.y - 24, r: o.dark ? (F().supplies ? 38 : 52) : 30, a: 0.55 });
        return L;
      },
      minX: o.minX ?? 30,
      maxX: o.maxX ?? o.width - 30,
      actors,
      hotspots: [
        ...doors.map(
          (d): Hotspot => ({
            x: d.x,
            iconY: 124,
            label: d.label && d.kind === "door" ? `${d.label} 문` : d.dir === "down" ? "내려가기" : d.dir === "up" ? "올라가기" : "들어가기",
            range: 20,
            enabled: () => true,
            use: async () => {
              const why = d.lock ? await d.lock() : null;
              if (why) {
                await say(charlie, why);
                return;
              }
              if (d.use) {
                await d.use();
                return;
              }
              if (!d.to) return;
              // 문이 열리고, 안쪽 계단으로 오르내리거나 들어간 뒤 문이 닫힌다
              const kind = d.dir === "down" ? "down" : d.dir === "up" ? "up" : "in";
              const spec =
                d.kind === "steel" ? { top: 144, w: 30, col: "#6a7480" } :
                d.kind === "grate" ? { top: 152, w: 34, col: "#3a3028", panel: false } :
                d.kind === "arch" ? { top: 158, w: 34, panel: false } :
                d.kind === "stairs" ? { top: 148, w: 26, col: "#4a4a52" } :
                { top: 148, w: 26, col: "#5a3828" };
              await doorTransition(d.x, kind, spec);
              await goScene(d.to, d.toX ?? 60);
            },
          }),
        ),
        ...(o.hotspots ? o.hotspots() : []),
      ],
      zones: [],
      update: o.update,
      back: o.back,
      front: o.front,
      start: async () => {
        charlie.y = GROUND;
        charlie.x = checkpoint > 0 ? checkpoint : o.startX;
        charlie.facing = charlie.x > o.width / 2 ? -1 : 1;
        writeSave(o.id, charlie.x);
        await fadeTo(0, 0.45);
        if (o.enter && !F()[`seen_${o.id}`]) {
          F()[`seen_${o.id}`] = 1;
          await o.enter();
        }
        S.control = true;
      },
    };
    return sc;
  };
}

/** 짧은 생각/관찰 */
const look = (x: number, iconY: number, lines: string[], label = "살펴보다"): Hotspot => ({
  x,
  iconY,
  label,
  enabled: () => true,
  use: async () => {
    for (const l of lines) await (l.startsWith("찰리:") ? say(charlie, l.slice(3)) : caption(l));
  },
});

/** 넋 나간 사람 (배경) */
function zoned(x: number, i: number, lines: string[], pose: "stand" | "sit" | "back" = "stand"): Actor {
  const a = mkActor("person", x, -1, { look: STRANGERS[i % 3], lookId: `st${i % 3}`, pose });
  let t = 2 + i;
  const tick = () => {
    t -= 1 / 60;
    if (t <= 0) {
      a.bubble = a.bubble ? null : lines[Math.floor(Math.random() * lines.length)];
      t = a.bubble ? 2.6 : 4 + Math.random() * 4;
    }
    if (!a.moving) a.x = (a.home ?? x) + Math.sin(clock.t * 0.8 + x) * 1.2;
  };
  a.home = x;
  (a as Actor & { tick?: () => void }).tick = tick;
  return a;
}
const tickAll = (list: Actor[]) => () => list.forEach((a) => (a as Actor & { tick?: () => void }).tick?.());

/** 연기가 낀 복도 */
const haze = (camX: number, n = 6) => {
  for (let i = 0; i < n; i++) smokePuffs(((i * 173) % 800) - camX, 40, 3, 20, 26, i * 3, 0.25);
};

// ═════════════════════════════════════════════════════════
// 제1장 앞: 아파트 탈출
// ═════════════════════════════════════════════════════════
room({
  id: "apt4",
  props: [["board", 380], ["alarm", 600], ["plant", 540]],
  label: "4층 복도",
  theme: "hall",
  width: 760,
  seed: 401,
  startX: 96,
  tint: "rgba(90,60,50,0.18)",
  doors: [
    { x: 90, kind: "door", label: "4A", lock: () => "샘은 창밖으로 나갔어. 지금은 집에 있을 때가 아니야." },
    { x: 280, kind: "door", label: "4B", to: "flat4B", toX: 70, dir: "in" },
    { x: 470, kind: "door", label: "4C", lock: () => "문 너머에서 누군가 중얼거린다. '초록빛... 초록빛...' 문을 열어 주지 않는다." },
    { x: 700, kind: "stairs", label: "계단 ↓", to: "apt3", toX: 690, dir: "down" },
  ],
  hotspots: () => [canSpot("c1", 540, 176, "신발장 위"), 
    look(380, 120, ["관리실 공지: 「현관 비밀번호가 바뀌었습니다. 새 번호는 1층 관리실 화이트보드를 확인하세요.」", "찰리:현관 비밀번호...? 하필 이럴 때."]),
    look(600, 116, ["화재경보기가 미친 듯이 울리고 있다.", "찰리:아래층 어딘가에서 불이 났나 봐."]),
  ],
  back: (camX) => haze(camX),
  enter: async () => {
    emote(charlie, "!");
    await say(charlie, "샘이 비상계단으로 나갔어. 나도 1층으로 내려가서 밖으로 나가야 해!");
    await caption("복도에 연기가 자욱하다. 계단으로 아래층까지 내려가자.");
  },
});

room({
  id: "flat4B",
  props: [["cage", 200], ["sink", 330], ["fridge", 450], ["frame", 530], ["shelf", 270]],
  label: "4B호 · 가르시아 부인 집",
  theme: "flat",
  width: 600,
  seed: 402,
  startX: 70,
  doors: [{ x: 50, kind: "door", label: "현관", to: "apt4", toX: 280, dir: "in" }],
  hotspots: () => [canSpot("c2", 270, 176, "찬장"), 
    look(200, 120, ["빈 새장. 문이 활짝 열려 있다.", "카나리아 '피코'도, 가르시아 부인도 보이지 않는다."]),
    {
      x: 340,
      iconY: 150,
      label: "싱크대 아래",
      enabled: () => !F().gotExt,
      use: async () => {
        await caption("싱크대 아래를 열어 보니... 빨간 소화기가 있다!");
        F().gotExt = 1;
        await give("ext");
        await say(charlie, "가르시아 부인, 잠깐만 빌릴게요.");
      },
    },
    look(450, 130, ["냉장고 메모: 「찰리네 고양이 간식 사 둘 것!」", "찰리:...부인은 샘을 정말 예뻐하셨지."]),
    photoSpot("p7", 530, 140, "사진 액자"),
  ],
  enter: async () => {
    await caption("문이 열려 있다. 식탁 위의 차는 아직 따뜻하다.");
  },
});

room({
  id: "apt3",
  label: "3층 복도",
  theme: "hall",
  width: 760,
  seed: 403,
  startX: 690,
  tint: "rgba(120,50,30,0.16)",
  doors: [
    { x: 60, kind: "stairs", label: "계단 ↓", to: "apt2", toX: 690, dir: "down" },
    { x: 140, kind: "door", label: "3A", lock: () => "잠겨 있다. 안에서 텔레비전 소리만 난다." },
    { x: 470, kind: "door", label: "3B", to: "flat3B", toX: 70, dir: "in" },
    { x: 700, kind: "stairs", label: "계단 ↑", to: "apt4", toX: 700, dir: "up" },
  ],
  lights: () => (F().fire3 ? [] : [{ x: 260, y: 190, r: 90, a: 0.9, warm: "rgba(255,110,40,0.2)" }]),
  hotspots: () => [
    {
      x: 345,
      iconY: 140,
      label: "불 끄기",
      enabled: () => !F().fire3,
      use: async () => {
        if (!has("ext")) {
          await say(charlie, "맨손으로는 무리야. 소화기 같은 게 있으면...");
          return;
        }
        charlie.facing = -1;
        charlie.pose = "flashlight";
        sfx.can();
        for (let i = 0; i < 12; i++) {
          extFoam.push({ x: charlie.x - 14, y: charlie.y - 30, vx: -60 - Math.random() * 40, vy: -10 + Math.random() * 20, t: 0 });
          await wait(0.08);
        }
        await wait(0.6);
        F().fire3 = 1;
        charlie.pose = null;
        take("ext");
        await caption("치이익—. 불길이 잦아들었다.");
      },
    },
  ],
  update: () => {
    if (!F().fire3 && charlie.x < 330 && S.control) {
      charlie.x = 330;
      if (!blockedMsg) {
        blockedMsg = true;
        void say(charlie, "불길 때문에 지나갈 수가 없어!").then(() => (blockedMsg = false));
      }
    }
    for (const f of extFoam) {
      f.t += 1 / 60;
      f.x += f.vx / 60;
      f.y += f.vy / 60;
    }
    while (extFoam.length && extFoam[0].t > 1.2) extFoam.shift();
  },
  back: (camX) => {
    haze(camX, 8);
    if (!F().fire3) {
      flameTongues(200 - camX, 214, 100, 70, 6, 3);
      smokePuffs(250 - camX, 140, 6, 90, 14, 4, 0.8);
    } else {
      g.fillStyle = "rgba(20,14,12,0.6)";
      g.fillRect(190 - camX, 150, 120, 64);
      smokePuffs(250 - camX, 190, 3, 60, 10, 5, 0.4);
    }
  },
  front: (camX) => {
    g.fillStyle = "rgba(240,244,250,0.8)";
    for (const f of extFoam) {
      g.beginPath();
      g.arc(f.x - camX, f.y, 2 + f.t * 6, 0, Math.PI * 2);
      g.fill();
    }
  },
  enter: async () => {
    await caption("3층은 더 뜨겁다. 복도 저편에서 불길이 일렁인다.");
  },
});
let blockedMsg = false;
const extFoam: Array<{ x: number; y: number; vx: number; vy: number; t: number }> = [];

const tv3B: Actor[] = [];
room({
  id: "flat3B",
  props: [["toolbox", 480], ["bed", 170], ["tv", 400]],
  label: "3B호",
  theme: "flat",
  width: 560,
  seed: 404,
  startX: 70,
  doors: [{ x: 50, kind: "door", label: "현관", to: "apt3", toX: 470, dir: "in" }],
  actors: () => {
    tv3B.length = 0;
    tv3B.push(zoned(330, 1, ["...", "채널... 채널을 돌려야 해...", "초록 화면... 예쁘다..."], "sit"));
    return tv3B;
  },
  update: tickAll(tv3B),
  lights: () => [{ x: 400, y: 170, r: 60, a: 0.6, warm: `rgba(120,255,170,${(0.08 + Math.random() * 0.05).toFixed(2)})` }],
  back: (camX) => {
    // 초록 잡음 TV
    g.fillStyle = "#1a1a1a";
    g.fillRect(380 - camX, 166, 40, 30);
    for (let i = 0; i < 40; i++) {
      g.fillStyle = Math.random() < 0.5 ? "#4ae88a" : "#1a5a3a";
      g.fillRect(382 - camX + Math.random() * 36, 168 + Math.random() * 26, 1, 1);
    }
    g.fillStyle = "#3a3a3a";
    g.fillRect(392 - camX, 196, 16, 18);
  },
  hotspots: () => [canSpot("c3", 260, 176, "소파 쿠션 밑"), 
    look(400, 150, ["화면엔 지지직거리는 초록 잡음뿐.", "남자는 눈도 깜빡이지 않고 화면만 보고 있다."], "TV"),
    {
      x: 480,
      iconY: 150,
      label: "공구함",
      enabled: () => !F().gotDriver,
      use: async () => {
        await caption("낡은 공구함. 녹슨 못과 테이프 사이에...");
        F().gotDriver = 1;
        await give("driver");
      },
    },
    photoSpot("p5", 170, 170, "침대 밑"),
  ],
  enter: async () => {
    await caption("문이 반쯤 열려 있다. 안에서 초록빛이 깜빡인다.");
    emote(charlie, "💧");
    await say(charlie, "실례합니다... 괜찮으세요?");
    await caption("대답이 없다.");
  },
});

room({
  id: "apt2",
  props: [["fusebox", 560], ["debris", 80]],
  label: "2층 복도",
  theme: "hall",
  width: 760,
  seed: 405,
  startX: 690,
  dark: true,
  doors: [
    { x: 60, kind: "stairs", label: "계단 ↓", lock: () => "무너진 천장 잔해가 계단을 꽉 막고 있다. 다른 길을 찾아야 해." },
    {
      x: 260,
      kind: "elevator",
      lock: () => (F().power2 ? null : "엘리베이터 버튼이 눌리지 않는다. 전기가 나갔어."),
      use: async () => {
        sfx.fridge();
        await caption("덜컹... 위이잉. 엘리베이터 문이 열렸다.");
        await walkTo(charlie, 260, 40);
        charlie.visible = false;
        sfx.step();
        await wait(0.6);
        await goScene("apt1", 120);
      },
    },
    { x: 420, kind: "door", label: "2B", to: "flat2B", toX: 70, dir: "in" },
    { x: 700, kind: "stairs", label: "계단 ↑", to: "apt3", toX: 60, dir: "up" },
  ],
  hotspots: () => [
    {
      x: 560,
      iconY: 150,
      label: "두꺼비집",
      enabled: () => !F().power2,
      use: async () => {
        if (!F().panelOpen) {
          if (!has("driver")) {
            await say(charlie, "두꺼비집 덮개가 나사로 꽉 조여 있어. 드라이버가 필요해.");
            return;
          }
          F().panelOpen = 1;
          sfx.step();
          await caption("드라이버로 덮개를 열었다. 퓨즈 하나가 빠져 있다.");
        }
        if (!has("fuse")) {
          await say(charlie, "퓨즈가 있어야 전기가 들어올 거야. 어디 예비 퓨즈 없나...");
          return;
        }
        take("fuse");
        take("driver");
        F().power2 = 1;
        sfx.fridge();
        shake(0.2);
        await caption("퓨즈를 끼우자, 딸깍— 복도 불이 깜빡이며 들어왔다.");
        await say(charlie, "됐다! 엘리베이터를 탈 수 있겠어.");
      },
    },
    look(60, 150, ["무너진 천장 잔해가 계단을 막고 있다."], "계단"),
  ],
  lights: () => (F().power2 ? [130, 330, 520, 700].map((x): Light => ({ x, y: 26, r: 90, a: 0.7, warm: "rgba(255,230,180,0.05)" })) : []),
  enter: async () => {
    await caption("2층은 정전이다. 휴대폰 불빛에 의지해 걷는다.");
  },
});

room({
  id: "flat2B",
  props: [["fridge", 220], ["shelf", 330], ["safe", 450], ["frame", 140], ["boxes", 390]],
  label: "2B호 · 토니네",
  theme: "flat",
  width: 560,
  seed: 406,
  startX: 70,
  dark: true,
  doors: [{ x: 50, kind: "door", label: "현관", to: "apt2", toX: 420, dir: "in" }],
  hotspots: () => [canSpot("c4", 390, 176, "쓰레기통 옆"), 
    look(220, 130, ["냉장고 메모: 「금고 비밀번호 = 내 생일! 이번엔 까먹지 말 것」"], "냉장고"),
    look(330, 140, ["선반 위의 생일 카드.", "「사랑하는 토니에게. 생일 축하해! 4월 12일, 엄마가」"], "선반"),
    {
      x: 450,
      iconY: 160,
      label: "작은 금고",
      enabled: () => !F().gotFuse,
      use: async () => {
        const ok = await openKeypad("작은 금고 (3자리)", "412");
        if (!ok) return;
        F().gotFuse = 1;
        await caption("철컥. 금고 안에 예비 퓨즈와 현금 봉투가 있다.");
        await give("fuse");
        await say(charlie, "돈은 두고, 퓨즈만 빌릴게요 토니.");
      },
    },
    photoSpot("p10", 140, 150, "벽에 붙은 사진"),
  ],
});

const super1: Actor[] = [];
room({
  id: "apt1",
  props: [["sofa", 560], ["tallplant", 340], ["notice", 500], ["clock", 260]],
  label: "1층 로비",
  theme: "lobby",
  width: 720,
  seed: 407,
  startX: 120,
  doors: [
    { x: 120, kind: "elevator", lock: () => "올라갈 일은 없어. 밖으로 나가자." },
    { x: 420, kind: "door", label: "관리실", to: "office1", toX: 70, dir: "in" },
    {
      x: 660,
      kind: "steel",
      label: "현관",
      use: async () => {
        if (!F().frontOpen) {
          const ok = await openKeypad("현관 비밀번호 (4자리)", "0437");
          if (!ok) {
            await say(charlie, "비밀번호를 모르겠어. 관리실을 뒤져 보자.");
            return;
          }
          F().frontOpen = 1;
          await caption("삐리릭— 현관문이 열렸다!");
        }
        await doorTransition(660, "in", { top: 144, w: 30, col: "#6a7480" });
        await goScene("chapter1", 0);
      },
    },
  ],
  hotspots: () => [
    look(260, 140, ["우편함이 줄지어 있다.", "「1번 4A 찰리」 「2번 4B 가르시아」 「3번 관리인」 「4번 2B 토니」..."], "우편함"),
  ],
  back: (camX) => {
    // 우편함
    for (let i = 0; i < 8; i++) {
      g.fillStyle = "#8a7a5a";
      g.fillRect(236 + (i % 4) * 12 - camX, 120 + Math.floor(i / 4) * 14, 11, 13);
      g.fillStyle = "#3a2a1a";
      g.fillRect(238 + (i % 4) * 12 - camX, 124 + Math.floor(i / 4) * 14, 7, 1);
    }
  },
  enter: async () => {
    await caption("1층 로비. 현관문 옆의 키패드가 빨갛게 깜빡인다.");
  },
});

room({
  id: "office1",
  props: [["whiteboard", 200], ["lostbox", 430], ["toolbox", 370], ["chair", 250], ["clock", 330], ["rack", 120], ["bin", 470]],
  label: "관리실",
  theme: "staff",
  width: 520,
  seed: 408,
  startX: 70,
  doors: [{ x: 50, kind: "door", label: "로비", to: "apt1", toX: 420, dir: "in" }],
  actors: () => {
    super1.length = 0;
    super1.push(zoned(300, 0, ["먼지... 먼지를 쓸어야 해...", "깨끗하게... 깨끗하게...", "..."]));
    return super1;
  },
  update: tickAll(super1),
  hotspots: () => [canSpot("c5", 370, 176, "공구 상자"), 
    look(200, 120, ["화이트보드: 「새 현관 비밀번호: 0 4 □ 7」", "「가운데 빈칸 = 내 우편함 번호. (까먹으면 우편함 확인!)」 — 관리인"], "화이트보드"),
    look(300, 140, ["관리인 아저씨는 빈 바닥을 계속 쓸고 있다. 빗자루에는 털이 하나도 없다."], "관리인"),
    photoSpot("p2", 430, 160, "분실물 상자"),
  ],
});

// ═════════════════════════════════════════════════════════
// 제2장: 지하철 점검 통로
// ═════════════════════════════════════════════════════════
room({
  id: "tun1",
  props: [["prints", 560]],
  label: "점검 통로 입구",
  theme: "tunnel",
  width: 820,
  seed: 501,
  startX: 70,
  dark: true,
  doors: [
    { x: 40, kind: "stairs", label: "출구 ↑", lock: () => "개구리 녀석은 아래로 갔어. 돌아갈 순 없어." },
    { x: 300, kind: "steel", label: "직원 전용", to: "staff2", toX: 70, dir: "in" },
    {
      x: 760,
      kind: "grate",
      lock: async () => {
        if (F().grateOpen) return null;
        if (!has("crowbar")) return "철창이 녹슬어 꽉 붙어 있어. 뭔가 지렛대 같은 게 필요해.";
        sfx.can();
        shake(0.3);
        await caption("쇠지렛대를 끼워 힘껏 젖혔다. 끼이익— 철창이 열렸다!");
        F().grateOpen = 1;
        return null;
      },
      to: "tun2",
      toX: 60,
      dir: "in",
    },
  ],
  hotspots: () => [canSpot("c6", 440, 176, "배관 틈"), look(560, 170, ["물갈퀴 자국이 철창 너머로 길게 이어져 있다.", "찰리:개구리 녀석, 이쪽으로 갔군."], "발자국")],
  enter: async () => {
    await caption("역 아래 점검 통로. 퀴퀴한 물 냄새와 개구리 울음소리.");
  },
});

const tonyHere: Actor[] = [];
room({
  id: "staff2",
  props: [["memo", 170], ["locker", 330], ["desk", 450], ["radio", 240], ["fridge", 400], ["microwave", 120], ["clock", 330], ["bench", 280]],
  label: "역무원 휴게실",
  theme: "staff",
  width: 540,
  seed: 502,
  startX: 70,
  actors: () => {
    tonyHere.length = 0;
    tonyHere.push(mkActor("person", 500, -1, { look: TONY, lookId: "tony", pose: "stand" }));
    return tonyHere;
  },
  enter: async () => {
    emote(tonyHere[0], "!");
    await say(tonyHere[0], "으악! ...아, 사람이네. 4층 찰리 형?");
    await say(charlie, "토니? 2B호 피자 배달하는 토니?");
    await say(tonyHere[0], "배달 가다가 하늘에서 뭐가 떨어져서 여기 숨었어요. 개구리들이 제 스쿠터 키까지 훔쳐 갔어요.");
    await say(tonyHere[0], "철창 너머로 가려면 쇠지렛대가 필요해요. 사물함에 있을 텐데... 비번은 근무표 어딘가에 있대요.");
  },
  doors: [{ x: 50, kind: "steel", label: "통로", to: "tun1", toX: 300, dir: "in" }],
  hotspots: () => [canSpot("c7", 400, 176, "냉장고 위"), 
    look(170, 120, ["야간 근무표: 「월 2번 · 화 0번 · 수 1번 · 목 9번」", "아래에 볼펜 낙서: 「사물함 비번 = 근무표 순서대로 (외우기 싫음)」"], "근무표"),
    {
      x: 330,
      iconY: 130,
      label: "사물함",
      enabled: () => !F().gotCrowbar,
      use: async () => {
        const ok = await openKeypad("사물함 자물쇠 (4자리)", "2019");
        if (!ok) return;
        F().gotCrowbar = 1;
        await caption("사물함 안에 작업복과... 묵직한 쇠지렛대.");
        await give("crowbar");
      },
    },
    photoSpot("p3", 450, 160, "책상 위"),
    {
      x: 500,
      iconY: 140,
      label: "토니",
      range: 24,
      enabled: () => true,
      use: async () => {
        if (has("crowbar")) {
          await say(tonyHere[0], "형, 저는 교회 쪽으로 가 볼게요. 거기 생존자들이 모여 있대요. 나중에 봐요!");
        } else await say(tonyHere[0], "근무표 낙서 봤어요? '근무표 순서대로'래요. 월, 화, 수, 목...");
      },
    },
    look(240, 160, ["라디오에서 치지직 소리만 난다.", "「...지하철 운행 전면 중단...」"], "라디오"),
  ],
});

room({
  id: "tun2",
  props: [["bag", 820]],
  label: "배수 터널",
  theme: "tunnel",
  width: 1000,
  seed: 503,
  startX: 60,
  dark: true,
  doors: [
    { x: 40, kind: "grate", to: "tun1", toX: 760, dir: "in" },
    { x: 200, kind: "steel", label: "펌프실", to: "pump2", toX: 70, dir: "in" },
    { x: 960, kind: "arch", to: "subway", toX: 0, dir: "in" },
  ],
  hotspots: () => [canSpot("c8", 900, 176, "선로 옆"), photoSpot("p4", 820, 170, "버려진 가방"), look(350, 170, ["앞쪽 터널이 허리까지 물에 잠겨 있다.", "찰리:물을 빼지 않으면 못 지나가."], "물")],
  update: () => {
    if (!F().drained && charlie.x > 360 && S.control) {
      charlie.x = 360;
      if (!blockedMsg) {
        blockedMsg = true;
        void say(charlie, "물이 너무 깊어. 펌프실에서 물을 뺄 수 있을지도.").then(() => (blockedMsg = false));
      }
    }
  },
  back: (camX) => {
    const lvl = F().drained ? 0 : 1;
    if (lvl) {
      const gr = g.createLinearGradient(0, 170, 0, 230);
      gr.addColorStop(0, "rgba(40,70,80,0.75)");
      gr.addColorStop(1, "rgba(10,20,30,0.95)");
      g.fillStyle = gr;
      g.fillRect(380 - camX, 172, 300, 60);
      g.fillStyle = "rgba(160,200,220,0.4)";
      for (let i = 0; i < 12; i++) g.fillRect(390 - camX + ((i * 47 + clock.t * 12) % 280), 173 + (i % 3), 8, 0.6);
    } else {
      g.fillStyle = "rgba(30,40,40,0.5)";
      g.fillRect(380 - camX, 206, 300, 8);
    }
  },
  enter: async () => {
    await caption("배수 터널. 저 멀리 승강장 불빛이 보인다.");
  },
});

/** 밸브 퍼즐: 하나를 돌리면 양옆 밸브도 같이 돌아간다. 네 개를 모두 '열림'으로 */
room({
  id: "pump2",
  props: [["sign", 130]],
  label: "펌프실",
  theme: "pump",
  width: 520,
  seed: 504,
  startX: 70,
  doors: [{ x: 50, kind: "steel", label: "터널", to: "tun2", toX: 200, dir: "in" }],
  hotspots: () => [canSpot("c9", 460, 176, "계기판 밑"), 
    look(130, 110, ["벽에 붙은 안내문: 「배수 밸브 4개를 모두 열어야 펌프가 돈다.」", "「※ 낡은 배관이라 밸브 하나를 돌리면 옆 밸브까지 같이 돌아감」"], "안내문"),
    ...[180, 250, 320, 390].map(
      (x, i): Hotspot => ({
        x,
        iconY: 140,
        label: `${i + 1}번 밸브`,
        range: 16,
        enabled: () => !F().drained,
        use: async () => {
          const v = valves();
          for (const j of [i - 1, i, i + 1]) if (j >= 0 && j < 4) v[j] = v[j] ? 0 : 1;
          F().valves = v.reduce((a, b, j) => a + (b << j), 0);
          sfx.can();
          if (v.every((b) => b)) {
            await wait(0.3);
            await caption("밸브 네 개가 모두 열렸다! 저 안쪽에서 펌프가 웅웅 돌기 시작한다.");
            F().drained = 1;
            shake(0.3);
            await say(charlie, "물이 빠지는 소리야. 터널로 돌아가자.");
          }
        },
      }),
    ),
  ],
  back: (camX) => {
    const v = valves();
    [180, 250, 320, 390].forEach((x, i) => {
      const sx = x - camX;
      g.fillStyle = "#5a6a6a";
      g.fillRect(sx - 2, 150, 4, 64);
      g.strokeStyle = v[i] ? "#3ae86a" : "#e83a3a";
      g.lineWidth = 3;
      g.beginPath();
      g.arc(sx, 160, 9, 0, Math.PI * 2);
      g.stroke();
      g.fillStyle = v[i] ? "#3ae86a" : "#e83a3a";
      g.fillRect(sx - 3, 132, 6, 6);
      text(`${i + 1}`, sx, 180, "#d8d0c0", "center");
    });
  },
  enter: async () => {
    if (F().valves === undefined) F().valves = 2;
    await caption("녹슨 밸브 네 개. 초록불이 '열림', 빨간불이 '닫힘'이다.");
  },
});
function valves(): number[] {
  const n = F().valves ?? 2;
  return [0, 1, 2, 3].map((j) => (n >> j) & 1);
}

// ═════════════════════════════════════════════════════════
// 제3장: 교회 지하 납골당
// ═════════════════════════════════════════════════════════
room({
  id: "crypt1",
  label: "지하 납골당",
  theme: "crypt",
  width: 780,
  seed: 601,
  startX: 60,
  dark: true,
  doors: [
    { x: 40, kind: "stairs", label: "교회 ↑", to: "church", toX: 2, dir: "up" },
    { x: 320, kind: "arch", to: "crypt2", toX: 60, dir: "in" },
    {
      x: 720,
      kind: "steel",
      label: "성물실",
      lock: async () => {
        if (F().bells) return null;
        if (!has("sheet")) return "문에 종 네 개가 매달려 있다. 순서대로 울려야 열리는 것 같은데... 순서를 모르겠어.";
        await caption("악보를 보며 종을 울려 보자. 종이 먼저 한 번 노래를 들려준다.");
        const ok = await playSimon("종을 울리는 순서", [0, 2, 1, 3, 2, 0], ["도", "미", "솔", "높은 도"]);
        if (!ok) return "음이 틀렸다. 문이 꿈쩍도 하지 않는다. 다시 해 보자.";
        F().bells = 1;
        await caption("마지막 종소리가 울리자, 그르릉— 돌문이 열렸다.");
        return null;
      },
      to: "vault3",
      toX: 60,
      dir: "in",
    },
  ],
  enter: async () => {
    await caption("교회 지하. 촛불 몇 개만이 어둠을 버티고 있다.");
    await say(charlie, "릴리 약은 '성물실'에 있다고 했지.");
  },
  hotspots: () => [canSpot("c10", 520, 176, "촛대 아래")],
});

room({
  id: "crypt2",
  props: [["lectern", 330], ["books", 500]],
  label: "유골 안치실",
  theme: "crypt",
  width: 620,
  seed: 602,
  startX: 60,
  dark: true,
  doors: [{ x: 40, kind: "arch", to: "crypt1", toX: 320, dir: "in" }],
  hotspots: () => [canSpot("c11", 420, 176, "선반 구석"), 
    {
      x: 330,
      iconY: 140,
      label: "낡은 악보대",
      enabled: () => !has("sheet") && !F().bells,
      use: async () => {
        await caption("악보대 위에 찢어진 악보 한 장. 종 그림 네 개와 순서가 적혀 있다.");
        await caption("「종탑 성가: 도 · 솔 · 미 · 높은 도 · 솔 · 도」 ...뒷부분은 찢어졌다.");
        await give("sheet");
      },
    },
    photoSpot("p8", 500, 160, "기도서 사이"),
    look(180, 150, ["찍찍! 쥐 몇 마리가 발밑으로 달아났다.", "찰리:...샘이 여기 있었으면 신났겠다."], "구석"),
  ],
});

room({
  id: "vault3",
  props: [["medbox", 300], ["glass", 420]],
  label: "성물실",
  theme: "vault",
  width: 500,
  seed: 603,
  startX: 60,
  dark: true,
  doors: [{ x: 40, kind: "steel", label: "납골당", to: "crypt1", toX: 720, dir: "in" }],
  hotspots: () => [canSpot("c12", 160, 176, "성배 뒤"), 
    {
      x: 300,
      iconY: 140,
      label: "약품 상자",
      enabled: () => !F().gotMed && !F().medGiven,
      use: async () => {
        await caption("성배와 촛대 사이, 루스가 숨겨 둔 약품 상자.");
        F().gotMed = 1;
        await give("med");
        await say(charlie, "찾았다. 얼른 릴리한테 가져다주자.");
      },
    },
    look(420, 150, ["오래된 스테인드글라스 조각. 초록 별과 고양이가 그려져 있다.", "찰리:...고양이가 별에서 내려오는 그림?"], "유리 조각"),
  ],
});

// ═════════════════════════════════════════════════════════
// 제4장: 격리 센터 안쪽 방들
// ═════════════════════════════════════════════════════════
const CAMS = [
  ["CAM 1 · 로비", "텅 빈 로비. 경비 둘이 하품을 한다."],
  ["CAM 2 · 격리실 B", "...루스 할머니가 휠체어에 묶여 실험실 쪽으로 끌려간다!"],
  ["CAM 3 · 실험실 문 앞", "요원이 비밀번호를 누른다. 7... 3... 9... 마지막 숫자는 손에 가려 안 보인다."],
  ["CAM 4 · 옥상", "헬기장. 초록빛이 구름 사이에서 맴돈다."],
];
const minjiSec: Actor[] = [];
room({
  id: "sec4",
  props: [["monitors", 260], ["logbook", 420], ["desk", 340], ["chair", 280], ["cooler", 140], ["clock", 260], ["notice", 420]],
  label: "보안실",
  actors: () => {
    minjiSec.length = 0;
    if (F().internUp) minjiSec.push(mkActor("person", 430, -1, { look: MINJI, lookId: "minji", pose: "stand" }));
    return minjiSec;
  },
  enter: async () => {
    if (!minjiSec.length) return;
    emote(minjiSec[0], "!");
    await say(minjiSec[0], "선배! 진짜 왔네요. 저 여기 보안실 인턴으로 끌려왔어요.");
    await say(minjiSec[0], "실험실 비밀번호요? 끝자리는 매주 제가 바꿔요. 이번 주는... 5예요. 앞자리는 카메라를 보면 알 수 있어요.");
    F().minjiHint = 1;
  },
  theme: "security",
  width: 520,
  seed: 701,
  startX: 70,
  doors: [{ x: 50, kind: "steel", label: "복도", to: "center", toX: 960, dir: "in" }],
  hotspots: () => [canSpot("c18", 340, 176, "서랍"), 
    {
      x: 260,
      iconY: 130,
      label: "감시 카메라",
      enabled: () => true,
      use: async () => {
        const i = (F().cam ?? 0) % CAMS.length;
        F().cam = i + 1;
        sfx.blip();
        await caption(`[${CAMS[i][0]}] ${CAMS[i][1]}`);
        if (i === 2) {
          F().code3 = 1;
          await say(charlie, "7, 3, 9... 마지막 한 자리만 알면 돼.");
        }
        if (i === 1) {
          emote(charlie, "💢");
          await say(charlie, "할머니...!");
        }
      },
    },
    look(420, 150, ["경비 일지: 「실험실 비밀번호는 매주 바뀜. 규정은 기록 보관실 참조」"], "경비 일지"),
  ],
});

room({
  id: "arch4",
  props: [["filecab", 150], ["desk", 250], ["filecab", 370], ["diary", 480], ["boxes", 560], ["papers", 300], ["clock", 250], ["rack", 420]],
  label: "기록 보관실",
  theme: "archive",
  width: 600,
  seed: 702,
  startX: 70,
  dark: true,
  doors: [{ x: 50, kind: "steel", label: "복도", to: "center", toX: 1100, dir: "in" }],
  hotspots: () => [canSpot("c19", 560, 176, "서류 더미"), 
    look(150, 140, ["「실험실 보안 규정」", "「비밀번호 끝자리 = 이번 주 격리된 면역자 수의 끝자리」", "「금주 격리 인원: 125명」"], "보안 규정"),
    look(250, 140, ["「프로젝트 초록 고양이」 — 블랙컴퍼니 대외비", "「초록빛은 고양이에게 반응한다. 고양이를 미끼로 외계 기술 확보 가능.」"], "서류철"),
    look(370, 140, ["「면역자 명단」 ... 루스 오코너(67) — 전직 응급실 간호사. 혈청 적합도 '최상'.", "찰리:...절대 그냥 두지 않을 거야."], "명단"),
    look(480, 140, ["그림스 부장이 회장에게 보낸 메일: 「백신 독점 판매로 올해 매출 300% 달성 예정.」", "「추신: 직원 찰리는 무단 퇴근으로 해고 처리 바람.」", "찰리:...해고라니. 오히려 좋아."], "인쇄된 메일"),
  ],
});

room({
  id: "cells4",
  props: [["memo", 180]],
  label: "격리 구역",
  theme: "cells",
  width: 640,
  seed: 703,
  startX: 70,
  doors: [{ x: 50, kind: "steel", label: "복도", to: "center", toX: 300, dir: "in" }],
  hotspots: () => [canSpot("c20", 560, 176, "빈 침대 밑"), 
    look(180, 130, ["정비 메모: 「비상 해제: 레버를 '셋 → 하나 → 둘' 순서로 내릴 것. 틀리면 처음부터.」"], "정비 메모"),
    {
      x: 515,
      iconY: 160,
      label: "나비 안아 주기",
      enabled: () => !!F().freed && !F().nabi,
      use: async () => {
        F().nabi = 1;
        sfx.purr();
        emote(charlie, "♥");
        await caption("나비가 찰리 품으로 쏙 안겼다. 블랙컴퍼니가 '미끼'로 쓰려고 잡아 둔 고양이였다.");
        await say(charlie, "릴리가 엄청 보고 싶어 했어. 같이 가자, 나비.");
      },
    },
    ...[300, 380, 460].map(
      (x, i): Hotspot => ({
        x,
        iconY: 140,
        label: `${i + 1}번 레버`,
        range: 16,
        enabled: () => !F().freed,
        use: async () => {
          const order = [2, 0, 1];
          const step = F().lever ?? 0;
          sfx.can();
          if (order[step] !== i) {
            F().lever = 0;
            await caption("덜컥. 레버가 전부 다시 올라갔다. 순서가 틀렸나 보다.");
            return;
          }
          F().lever = step + 1;
          if (F().lever >= 3) {
            F().freed = 1;
            shake(0.3);
            await caption("철컹, 철컹, 철컹! 격리실 문이 전부 열렸다.");
            await caption("갇혀 있던 면역자들이 조용히 손을 흔들며 비상구로 빠져나간다.");
            await say(charlie, "다들 무사히 나가세요!");
            await caption("...맨 끝 우리 안에서 작은 울음소리. 주황색 고양이 한 마리가 웅크리고 있다.");
            await caption("목걸이 이름표: 「나비 — 릴리네 고양이」");
          } else await caption(`${i + 1}번 레버를 내렸다. (${F().lever}/3)`);
        },
      }),
    ),
  ],
  back: (camX) => {
    if (F().freed && !F().nabi) smoothDraw(tintedCat(`sitT${Math.floor(clock.t * 5) % 8}`, -1, "#f0a050"), half(515 - camX - 15), GROUND - 22, 32, 24);
    [300, 380, 460].forEach((x, i) => {
      const down = F().freed || (F().lever ?? 0) > [2, 0, 1].indexOf(i);
      g.fillStyle = "#3a3e44";
      g.fillRect(x - 4 - camX, 150, 8, 30);
      g.fillStyle = down ? "#3ae86a" : "#e83a3a";
      g.fillRect(x - 2 - camX, down ? 172 : 146, 4, 10);
    });
  },
});


// ═════════════════════════════════════════════════════════
// 제3장 끝 → 제4장 앞: 블랙컴퍼니 사무실 (아이템 찾기 미로)
//  머그컵 → 커피 → 인턴 → 복사기 속 부장실 열쇠 → 부장 책상의 내 서랍 열쇠 → 사원증
// ═════════════════════════════════════════════════════════
const lobbyGuard: Actor[] = [];
room({
  id: "bcLobby",
  props: [["reception", 200], ["gate", 300], ["plant", 520], ["flag", 120], ["clock", 200], ["motto", 330], ["sofa", 600], ["aquarium", 460], ["notice", 560], ["tallplant", 680]],
  label: "블랙컴퍼니 로비",
  theme: "lobby",
  width: 720,
  seed: 801,
  startX: 70,
  doors: [
    {
      x: 60,
      kind: "steel",
      label: "정문",
      lock: () => (has("badge") ? null : "사원증부터 찾자. 그게 있어야 격리 센터에 들어갈 수 있어."),
      use: async () => {
        await say(charlie, "사원증 챙겼다. 이제 허드슨 강변 격리 센터로!");
        await doorTransition(60, "in", { top: 144, w: 30, col: "#6a7480" });
        await goScene("march5", 0);
      },
    },
    { x: 400, kind: "elevator", lock: () => "엘리베이터에 팻말: 「야근 중 점검. 계단을 이용하세요 :)」" },
    { x: 650, kind: "stairs", label: "계단 ↑", to: "bc7", toX: 60, dir: "up" },
  ],
  actors: () => {
    lobbyGuard.length = 0;
    lobbyGuard.push(zoned(300, 2, ["출근 확인... 출근 확인...", "지각... 지각입니다...", "..."]));
    return lobbyGuard;
  },
  update: tickAll(lobbyGuard),
  hotspots: () => [
    canSpot("c13", 520, 176, "화분 뒤"),
    look(200, 140, ["안내 데스크 팻말: 「웃으며 야근합시다 — 블랙컴퍼니」", "찰리:세상이 망해도 이 팻말은 멀쩡하네."], "안내 데스크"),
    look(300, 140, ["경비 아저씨가 출입 게이트 앞에서 허공에 사원증을 찍고 있다.", "삑... 삑... 아무 소리도 나지 않는다."], "경비"),
  ],
  enter: async () => {
    await caption("블랙컴퍼니 본사. 사흘 내내 갇혀 지냈던 그 건물이다.");
    await say(charlie, "다시는 안 올 줄 알았는데... 내 사원증은 7층 내 책상 서랍에 있어.");
  },
});

const team7: Actor[] = [];
room({
  id: "bc7",
  props: [["workdesk", 360], ["chair", 386], ["cubicle", 600], ["cubicle", 690], ["cubicle", 770], ["printer", 470], ["cooler", 250], ["motto", 520], ["clock", 700], ["blinds", 360], ["blinds", 800], ["bin", 330], ["papers", 560], ["tallplant", 940]],
  label: "7층 · 영업2팀",
  theme: "staff",
  width: 980,
  seed: 802,
  startX: 60,
  doors: [
    { x: 40, kind: "stairs", label: "계단 ↓", to: "bcLobby", toX: 650, dir: "down" },
    { x: 200, kind: "door", label: "탕비실", to: "bcPantry", toX: 70, dir: "in" },
    { x: 520, kind: "door", label: "복사실", to: "bcCopy", toX: 70, dir: "in" },
    { x: 880, kind: "steel", label: "부장실", lock: () => (has("bosskey") || F().bossOpen ? null : "부장실은 잠겨 있다. 문패: 「노크 금지. 성과로 말하라」"), to: "bcBoss", toX: 70, dir: "in" },
  ],
  actors: () => {
    team7.length = 0;
    team7.push(zoned(680, 0, ["보고서... 보고서...", "엑셀... 엑셀이...", "..."]));
    team7.push(zoned(760, 1, ["네 부장님... 네 부장님...", "바로 하겠습니다...", "..."]));
    return team7;
  },
  update: tickAll(team7),
  hotspots: () => [
    canSpot("c14", 600, 176, "동료 책상 밑"),
    look(320, 120, ["모니터 포스트잇: 「샘 밥 7시!!」 내 글씨다.", "찰리:...사흘 동안 한 번도 못 지켰지."], "내 모니터"),
    {
      x: 400,
      iconY: 150,
      label: "내 책상 서랍",
      enabled: () => !has("badge"),
      use: async () => {
        if (!has("drawerkey")) {
          await say(charlie, "잠겨 있어. 열쇠는... 부장님이 '업무 태만'이라며 압수해 갔었지.");
          return;
        }
        take("drawerkey");
        await caption("서랍을 열자 사원증과... 샘 사진이 붙은 컵받침이 나왔다.");
        await give("badge");
        emote(charlie, "♥");
        await say(charlie, "됐다. 이제 이 회사엔 볼일 없어.");
      },
    },
  ],
  enter: async () => {
    await caption("영업2팀. 동료들이 꺼진 모니터 앞에서 계속 타자를 치고 있다.");
    await say(charlie, "...다들 여기 있었구나. 세상이 망한 줄도 모르고.");
  },
});

room({
  id: "bcPantry",
  props: [["shelf", 130], ["cups", 220], ["coffee", 330], ["fridge", 440], ["microwave", 270], ["vending", 490], ["bin", 380], ["clock", 330], ["notice", 130]],
  label: "탕비실",
  theme: "flat",
  width: 520,
  seed: 803,
  startX: 70,
  doors: [{ x: 50, kind: "door", label: "사무실", to: "bc7", toX: 200, dir: "in" }],
  hotspots: () => [
    canSpot("c15", 130, 150, "찬장 위"),
    {
      x: 220,
      iconY: 130,
      label: "컵 선반",
      enabled: () => !F().gotMug,
      use: async () => {
        F().gotMug = 1;
        await caption("수십 개의 똑같은 회사 머그컵 사이에, 샘 얼굴이 그려진 내 컵이 있다.");
        await give("mug");
      },
    },
    {
      x: 330,
      iconY: 140,
      label: "커피 머신",
      enabled: () => !F().gotCoffee,
      use: async () => {
        if (!has("mug")) {
          await say(charlie, "컵이 없으면 커피를 받을 수가 없어. 종이컵도 다 떨어졌네.");
          return;
        }
        take("mug");
        F().gotCoffee = 1;
        sfx.fridge();
        await caption("위이잉... 커피 머신은 세상이 망해도 돌아간다. 진한 커피 한 잔.");
        await give("coffee");
      },
    },
    look(440, 140, ["냉장고 안: 「그림스 부장 전용」이라고 적힌 푸딩 열두 개.", "푸딩 뚜껑에 메모: 「부장님 금고 비번 아직도 0000이세요?? 바꾸세요!! — 정보보안팀」", "찰리:...하나 정도는 괜찮겠지."], "냉장고"),
  ],
});

const intern: Actor[] = [];
room({
  id: "bcCopy",
  props: [["copier", 400], ["boxes", 470], ["printer", 230], ["papers", 300], ["rack", 140], ["notice", 250], ["bin", 350]],
  label: "복사실",
  theme: "staff",
  width: 520,
  seed: 804,
  startX: 70,
  doors: [{ x: 50, kind: "door", label: "사무실", to: "bc7", toX: 520, dir: "in" }],
  actors: () => {
    intern.length = 0;
    const a = zoned(F().internUp ? 150 : 300, 2, F().internUp ? ["커피 맛있다...", "선배, 고마워요."] : ["커피... 커피...", "복사... 복사..."]);
    a.look = MINJI;
    a.lookId = "minji";
    intern.push(a);
    return intern;
  },
  update: tickAll(intern),
  hotspots: () => [
    canSpot("c16", 470, 176, "종이 상자"),
    {
      x: 300,
      iconY: 140,
      label: "인턴",
      enabled: () => !F().internUp,
      use: async () => {
        if (!has("coffee")) {
          await caption("인턴이 복사기 앞에 붙박이처럼 서서 중얼거린다. 「커피... 커피...」");
          await say(charlie, "비켜 줄 생각이 없어 보이네. 커피라도 있으면...");
          return;
        }
        take("coffee");
        F().internUp = 1;
        await caption("커피를 건네자, 인턴이 두 손으로 컵을 받아 한 모금 마셨다.");
        emote(intern[0], "!");
        intern[0].bubble = "...어? 찰리 선배? 저 여기서 뭐 하고 있었죠?";
        await wait(1.8);
        intern[0].bubble = null;
        await walkTo(intern[0], 150, 40);
        intern[0].home = 150;
        await say(intern[0], "인턴 민지예요. 기억 안 나시죠... 저 선배 옆자리였는데.");
        await say(intern[0], "부장님이 격리 센터 보안실로 발령 낸다고 했었어요. 혹시 거기 가시면... 제가 도울게요.");
        intern[0].home = 150;
        intern[0].pose = "stand";
        await say(charlie, "커피 한 잔에 정신이 돌아오다니... 역시 직장인이야.");
      },
    },
    {
      x: 400,
      iconY: 130,
      label: "복사기",
      enabled: () => !has("bosskey") && !F().bossOpen,
      use: async () => {
        if (!F().internUp) {
          await say(charlie, "인턴이 복사기를 막고 서 있어.");
          return;
        }
        await caption("「용지 걸림」 표시가 깜빡인다. 덮개를 열어 보니... 구겨진 종이 사이에 열쇠 하나!");
        await give("bosskey");
        await say(charlie, "부장실 열쇠잖아. 열쇠를 복사하려다 걸렸나 봐...");
      },
    },
  ],
});

room({
  id: "bcBoss",
  props: [["trophy", 170], ["safe", 230], ["diary", 300], ["books", 410], ["golfbag", 500], ["flag", 360], ["blinds", 300], ["motto", 450], ["sofa", 100], ["aquarium", 410], ["chair", 322]],
  label: "부장실",
  theme: "archive",
  width: 560,
  seed: 805,
  startX: 70,
  doors: [{ x: 50, kind: "steel", label: "사무실", to: "bc7", toX: 880, dir: "in" }],
  hotspots: () => [
    canSpot("c17", 500, 176, "골프백 속"),
    look(170, 140, ["트로피: 「사내 골프대회 우승 — 그림스」", "찰리:...참가자는 부장님이랑 회장님 둘뿐이었지."], "트로피"),
    {
      x: 290,
      iconY: 140,
      label: "부장 책상",
      enabled: () => !F().gotDrawer,
      use: async () => {
        F().gotDrawer = 1;
        F().bossOpen = 1;
        take("bosskey");
        await caption("책상 위에 「압수품」 상자. 직원들 휴대폰, 간식, 그리고... 내 서랍 열쇠.");
        await give("drawerkey");
      },
    },
    {
      x: 230,
      iconY: 170,
      label: "작은 금고",
      enabled: () => !F().bossSafe,
      use: async () => {
        const ok = await openKeypad("부장의 금고 (4자리)", "0000");
        if (!ok) return;
        F().bossSafe = 1;
        await caption("...열렸다. 안에는 돈 대신 낡은 사진 한 장.");
        await caption("어린 그림스가 고양이를 품에 안고 활짝 웃고 있다. 뒷면: 「나비야, 사랑해. 꼭 다시 만나자.」");
        await say(charlie, "...부장님도 고양이를 잃어버린 적이 있었구나.");
      },
    },
    look(410, 140, ["부장의 다이어리.", "「초록빛은 고양이를 원한다. 찰리 그 녀석 고양이... 하얀 놈. 쓸 만하겠어.」", "찰리:...처음부터 샘을 노리고 있었던 거야?"], "다이어리"),
  ],
  enter: async () => {
    await caption("부장실. 벽에는 「야근은 열정이다」 액자와 부장 본인의 초상화.");
  },
});


// ═════════════════════════════════════════════════════════
// 제2장 앞: 24시 약국 (기획안의 '좀비 = 약을 갈망하는 사람들')
//  손전등 건전지가 다 됐다. 약국에는 약을 찾아 서성이는 사람들.
//  선반을 쳐서 약통 소리를 내면 그쪽으로 몰려간다 → 그 틈에 지나가기
// ═════════════════════════════════════════════════════════
type Zed = Actor & { a: number; b: number; lure: number; lureX: number; chase: boolean };
room({
  id: "drug1",
  props: [["display", 120], ["poster", 160], ["pharmshelf", 250], ["counter", 560], ["pharmshelf", 600], ["pharmshelf", 780], ["batteries", 860]],
  label: "24시 약국",
  theme: "staff",
  width: 960,
  seed: 901,
  startX: 60,
  dark: true,
  ambient: 0.8,
  doors: [
    { x: 40, kind: "steel", label: "입구", lock: () => "샘은 지하철 쪽으로 갔어. 건전지만 챙겨서 나가자." },
    { x: 470, kind: "door", label: "창고", to: "drug2", toX: 70, dir: "in" },
    {
      x: 920,
      kind: "steel",
      label: "뒷문",
      lock: () => (F().battery ? null : "건전지부터 찾자. 이대로는 지하철에서 아무것도 안 보여."),
      use: async () => {
        await say(charlie, "됐다. 이제 지하철역으로!");
        await goScene("subwayGate", 0);
      },
    },
  ],
  actors: () => {
    zeds.length = 0;
    const mk = (x: number, a: number, b: number, i: number): Zed => Object.assign(mkActor("person", x, -1, { look: ZOMBIES[i], lookId: `z${i}` }), { a, b, lure: 0, lureX: x, chase: false });
    zeds.push(mk(300, 200, 420, 0), mk(640, 540, 760, 1), mk(820, 760, 880, 2));
    return zeds;
  },
  hotspots: () => [
    ...[250, 600, 780].map(
      (x): Hotspot => ({
        x,
        iconY: 150,
        label: "약 선반 치기",
        range: 22,
        enabled: () => true,
        use: async () => {
          sfx.glass();
          sfx.can();
          shake(0.15);
          await caption("와르르— 약통이 바닥에 쏟아지며 요란한 소리가 났다!");
          for (const z of zeds) {
            if (Math.abs(z.x - x) < 300) {
              z.lure = 7;
              z.lureX = x + (z.x < x ? -10 : 10);
              z.chase = false;
              z.bubble = "약...! 약이다...!";
            }
          }
        },
      }),
    ),
    hideAt(560, "계산대 뒤에 숨기", 160, undefined, "counter"),
    {
      x: 860,
      iconY: 140,
      label: "건전지 진열대",
      enabled: () => !F().battery,
      use: async () => {
        F().battery = 1;
        await give("battery");
        take("battery");
        sfx.blip();
        await caption("건전지를 갈아 끼웠다. 딸깍— 손전등이 환하게 살아났다!");
      },
    },
    canSpot("c21", 120, 176, "쓰러진 진열대"),
    look(160, 140, ["벽 포스터: 「진통제 1+1! 종말 기념 세일」", "찰리:...이 와중에 세일이라니."], "포스터"),
  ],
  lights: () => [
    // 깜빡이는 녹색 약국 십자 간판과 비상구 등, 서성이는 사람들의 실루엣
    { x: 330, y: 40, r: 70, a: Math.sin(clock.t * 9) > -0.6 ? 0.5 : 0.1, warm: "rgba(80,255,120,0.08)" },
    { x: 920, y: 120, r: 50, a: 0.5, warm: "rgba(255,60,60,0.08)" },
    ...zeds.map((z): Light => ({ x: z.x, y: z.y - 26, r: 30, a: 0.35, warm: z.chase ? "rgba(255,80,60,0.08)" : undefined })),
  ],
  update: (dt) => {
    if (!S.control) return;
    for (const z of zeds) {
      const d = charlie.x - z.x;
      const dist = Math.abs(d);
      if (z.lure > 0) {
        z.lure -= dt;
        const t = z.lureX - z.x;
        if (Math.abs(t) > 2) {
          z.x += Math.sign(t) * 40 * dt;
          z.walkDist += 40 * dt * 0.6;
          z.moving = true;
          z.facing = t > 0 ? 1 : -1;
        } else {
          z.moving = false;
          z.pose = "crouch2";
        }
        if (z.lure <= 0) {
          z.pose = null;
          z.bubble = null;
        }
        continue;
      }
      z.pose = null;
      const hear = S.hidden ? 0 : sneaking() ? 22 : charlie.moving ? 60 : 30;
      if (!z.chase && dist < hear) {
        z.chase = true;
        z.bubble = "으어어... 약... 약 줘...";
        sfx.groan();
      }
      if (z.chase) {
        if (dist > 170 || S.hidden) {
          z.chase = false;
          z.bubble = null;
        } else {
          z.x += Math.sign(d) * 30 * dt;
          z.walkDist += 30 * dt * 0.6;
          z.moving = true;
          z.facing = d > 0 ? 1 : -1;
          if (dist < 12) gameOver("GAME OVER", "약에 취한 사람들에게 둘러싸여 주머니를 다 털렸다...", 0);
        }
        continue;
      }
      // 느릿느릿 서성이기
      const target = z.facing > 0 ? z.b : z.a;
      z.x += Math.sign(target - z.x) * 12 * dt;
      z.walkDist += 12 * dt * 0.6;
      z.moving = true;
      if (Math.abs(target - z.x) < 1) z.facing = z.facing > 0 ? -1 : 1;
    }
  },
  enter: async () => {
    await caption("24시 약국. 셔터는 반쯤 부서졌고, 안에서 약통 흔드는 소리가 들린다.");
    await say(charlie, "건전지만 찾으면 돼. 계산대 너머 진열대에 있을 거야.");
    await caption("약을 찾아 서성이는 사람들이 있다. 가까이 가면 달려든다. ↓(살금살금)로 걷거나...");
    await caption("약 선반을 쳐서 [Space] 약통 소리를 내면, 그쪽으로 몰려간다. 그 틈에 지나가자!");
  },
});
const zeds: Zed[] = [];

room({
  id: "drug2",
  props: [["desk", 200], ["boxes", 300], ["shelf", 420]],
  label: "약국 창고",
  theme: "archive",
  width: 520,
  seed: 902,
  startX: 70,
  dark: true,
  doors: [{ x: 50, kind: "door", label: "매장", to: "drug1", toX: 470, dir: "in" }],
  hotspots: () => [
    canSpot("c22", 300, 176, "상자 더미"),
    look(200, 140, ["처방전 더미. 맨 위 처방전: 「환자: 그림스 / 처방: 수면제 · 위장약 · 탈모약」", "찰리:...부장님 처방전이 왜 여기."], "처방전"),
    look(420, 140, ["유통기한 지난 고양이 영양제 상자.", "찰리:샘이 이거 먹으면 토하던데."], "선반"),
  ],
});

// ═════════════════════════════════════════════════════════
// 제4장 앞: 채식 시위대 행진 (기획안의 '닿으면 해골, 게임오버')
// ═════════════════════════════════════════════════════════
const MARCH_DOORS = [180, 360, 540, 720, 900];
const CHANT = ["고기를 버려라!", "우리처럼 가벼워져라!", "채식만이 살 길!", "단백질은 죄악이다!", "뼈만 남아도 행복하다!"];
SCENES.march5 = () => {
  const info = buildStreet(1100, true, 61, false);
  const marchers: Actor[] = [];
  let spawnX = 700;
  let caught = false;
  const spawnGroup = (x: number) => {
    const n = 3 + Math.floor(Math.random() * 2);
    for (let i = 0; i < n; i++) marchers.push(mkActor("person", x + i * 30, -1, { look: SKELETON, lookId: "sk", sign: CHANT[(i + marchers.length) % CHANT.length].slice(0, 4) }));
  };
  const sc: Scene = {
    id: "march5",
    label: "브로드웨이",
    width: 1100,
    bg: info.canvas,
    ambient: 0.45,
    tint: "rgba(120,30,10,0.10)",
    lights: () => [{ x: charlie.x, y: charlie.y - 24, r: 40, a: 0.4 }],
    minX: 30,
    maxX: 1080,
    get actors() {
      return marchers;
    },
    hotspots: MARCH_DOORS.map((x) => hideAt(x, "문간 그늘에 웅크리기", 160, undefined, "doorway")),
    zones: [
      {
        x: 1050,
        dir: 1,
        run: async () => {
          await say(charlie, "하아... 겨우 빠져나왔다. 부두는 이쪽이야.");
          await goScene("pier", 0);
        },
      },
    ],
    update: (dt) => {
      if (S.mode !== "play") return;
      for (const m of marchers) {
        m.x -= 34 * dt;
        m.walkDist += 34 * dt;
        m.moving = true;
        m.facing = -1;
        if (!caught && S.control && !S.hidden && Math.abs(m.x - charlie.x) < 10) {
          caught = true;
          S.control = false;
          charlie.look = SKELETON;
          charlie.lookId = "sk";
          flash("#ffffff", 1);
          gameOver("GAME OVER", "시위대에 휩쓸려... 찰리도 뼈만 남았다. (채식만이 살 길!)", 0);
        }
      }
      while (marchers.length && marchers[0].x < S.camX - 60) marchers.shift();
      // 무리와 무리 사이 간격을 두고 계속 행진해 온다
      spawnX -= 34 * dt;
      if (spawnX < S.camX + W + 60) {
        spawnGroup(Math.max(spawnX, S.camX + W + 60));
        spawnX = S.camX + W + 60 + 520;
      }
      if (Math.floor(clock.t * 0.6) !== Math.floor((clock.t - dt) * 0.6)) {
        for (const m of marchers) m.bubble = null;
        const vis = marchers.filter((m) => m.x > S.camX && m.x < S.camX + W);
        if (vis.length) {
          vis[Math.floor(Math.random() * vis.length)].bubble = CHANT[Math.floor(Math.random() * CHANT.length)];
          sfx.chant();
        }
      }
    },
    back: (camX) => {
      // 움푹 들어간 건물 현관: 계단 두 칸 · 문 · 깊은 그늘
      for (const x of MARCH_DOORS) {
        const sx = x - camX;
        g.fillStyle = "#3a2a22";
        g.fillRect(half(sx - 18), 150, 36, 6);
        g.fillStyle = "#1a1210";
        g.fillRect(half(sx - 16), 156, 32, 58);
        g.fillStyle = "#4a3024";
        g.fillRect(half(sx - 11), 160, 22, 46);
        g.fillStyle = "#3a2418";
        g.fillRect(half(sx - 9), 164, 8, 18);
        g.fillRect(half(sx + 1), 164, 8, 18);
        g.fillStyle = "#c8a83a";
        g.fillRect(half(sx + 7), 184, 1.5, 2);
        g.fillStyle = "#6a5a4a";
        g.fillRect(half(sx - 18), 206, 36, 4);
        g.fillRect(half(sx - 20), 210, 40, 4);
        const sh = g.createLinearGradient(sx - 16, 0, sx + 16, 0);
        sh.addColorStop(0, "rgba(0,0,0,0.55)");
        sh.addColorStop(0.5, "rgba(0,0,0,0.15)");
        sh.addColorStop(1, "rgba(0,0,0,0.55)");
        g.fillStyle = sh;
        g.fillRect(sx - 16, 156, 32, 58);
      }
    },
    front: (camX) => {
      for (const m of marchers) {
        const sx = Math.round(m.x - camX);
        if (sx < -30 || sx > W + 30) continue;
        g.fillStyle = "#6a4a2a";
        g.fillRect(sx - 1, GROUND - 74, 2, 34);
        g.fillStyle = "#e8e0c8";
        g.fillRect(sx - 14, GROUND - 88, 26, 14);
        g.fillStyle = "#2a6a2a";
        g.fillRect(sx - 14, GROUND - 88, 26, 2);
        text(m.sign ?? "", sx - 1, GROUND - 80, "#2a6a2a", "center", "");
      }
    },
    start: async () => {
      charlie.x = 60;
      charlie.y = GROUND;
      charlie.facing = 1;
      writeSave("march5", 0);
      spawnGroup(560);
      spawnX = 560 + 520;
      await fadeTo(0, 0.8);
      if (!F().seenMarch) {
        F().seenMarch = 1;
        sfx.chant();
        await caption("브로드웨이가 해골이 된 채식 시위대로 가득 찼다. 「고기를 버려라! 우리처럼 가벼워져라!」");
        const kale = mkActor("person", 240, -1, { look: SKELETON, lookId: "sk" });
        marchers.unshift(kale);
        kale.bubble = null;
        await say(kale, "형제여! 나는 케일 목사다! 고기를 버리고 우리처럼 가벼워져라!");
        await say(charlie, "...목사님, 저 고기 안 먹은 지 사흘 됐어요. 야근 때문에.");
        await say(kale, "오오! 이미 반쯤 해탈했구나! 그럼 남은 반도 함께 버리자꾸나! 이리 와서 손을 잡거라!");
        await say(charlie, "손... 은 사양할게요. 닿으면 해골 되잖아요.");
        await say(charlie, "저 사람들... 운석 가루를 마시고 정말로 뼈만 남았어.");
        await caption("닿으면 찰리도 해골이 된다! 행렬이 다가오면 문틈에 [Space]로 숨고, 지나가면 달려(Shift) 다음 문틈으로!");
      }
      S.control = true;
    },
  };
  return sc;
};

// ═════════════════════════════════════════════════════════
// 이스터에그: 펫숍 뒤 '냥이 집회소' — 초록빛을 피해 숨은 동네 고양이들
// ═════════════════════════════════════════════════════════
const MEET = [
  { x: 150, col: "#f0a050", name: "치즈", line: "「냐옹. 초록빛이 부르면 귀를 막아라냥. 츄르 냄새로 버티는 거다냥.」" },
  { x: 220, col: "#3a3a44", name: "까망이", line: "「...저 하얀 녀석(샘) 말이냐옹. 원래 저 별 왕족이다냥. 비밀이다냥.」" },
  { x: 290, col: "#c8a878", name: "고등어", line: "「인간, 너 냄새가 좋다냥. 츄르 냄새냥. 쓰다듬는 걸 허락한다냥.」" },
  { x: 360, col: "#e8e0d0", name: "삼색이", line: "「개구리 녀석들이 우리 생선을 다 훔쳐 갔다냥! 지하철에 소굴이 있다냥!」" },
  { x: 430, col: "#8a8aa0", name: "회색이", line: "「옆 동네 나비는... 빛 따라 올라갔다냥. 언젠가 돌아올 거다냥.」" },
  { x: 500, col: "#b86a3a", name: "대장", line: "「인간이 여기까지 오다니. 좋다, 비밀 하나 알려 주지냥. 마지막 순간, 빛에게 '사람은?' 하고 물어봐라냥.」" },
];
room({
  id: "catMeet",
  label: "??? 냥이 집회소",
  theme: "vault",
  width: 600,
  seed: 999,
  startX: 60,
  ambient: 0.55,
  doors: [{ x: 40, kind: "arch", to: "chapter1", toX: 1420, dir: "in" }],
  lights: () => MEET.map((m): Light => ({ x: m.x, y: 180, r: 40, a: 0.6, warm: "rgba(255,210,150,0.10)" })),
  hotspots: () => [
    ...MEET.map(
      (m, i): Hotspot => ({
        x: m.x,
        iconY: 160,
        label: `${m.name} 쓰다듬기`,
        range: 22,
        enabled: () => true,
        use: async () => {
          sfx.purr();
          await caption(`${m.name}: ${m.line}`);
          F()[`meet${i}`] = 1;
          if (MEET.every((_, j) => F()[`meet${j}`]) && !F().meetAll) {
            F().meetAll = 1;
            try {
              localStorage.setItem("charlie_cat_secret", "1");
            } catch {
              /* 무시 */
            }
            sfx.item();
            await caption("집회소의 고양이들이 모두 찰리를 인정했다! (비밀 꾸미기 「무지개 목도리」 해금)");
            await caption("대장 고양이가 마지막 말을 남겼다. 「잊지 마라냥. 마지막에 빛에게 물어봐라냥.」");
          }
        },
      }),
    ),
    canSpot("c23", 560, 176, "방석 밑"),
  ],
  back: (camX) => {
    // 박스와 방석 위에 앉은 고양이들
    MEET.forEach((m, i) => {
      const sx = m.x - camX;
      g.fillStyle = "#6a4a2a";
      g.fillRect(half(sx - 14), 200, 28, 14);
      g.fillStyle = "#8a6a3a";
      g.fillRect(half(sx - 14), 200, 28, 2);
      const pose = `sitT${Math.floor(clock.t * 5 + i * 3) % 8}`;
      smoothDraw(tintedCat(pose, i % 2 ? -1 : 1, m.col), half(sx - 15), 178, 32, 24);
    });
    text("냥냥 비밀 집회 · 인간 출입 금지", 300 - camX, 60, "#c8b890", "center");
  },
  enter: async () => {
    await caption("작은 고양이 문을 기어서 통과했다... 그 너머엔 촛불과 방석, 그리고 동네 고양이들의 비밀 집회!");
    emote(charlie, "!");
    await say(charlie, "여, 여기 이런 곳이...?");
  },
});


// ═════════════════════════════════════════════════════════
// 비밀 엔딩 C: 월요일 아침, 블랙컴퍼니
// ═════════════════════════════════════════════════════════
SCENES.epiC = () => {
  const crew = [zoned(330, 0, ["보고서... 보고서...", "..."]), zoned(420, 1, ["네 부장님...", "..."])];
  const sc: Scene = {
    id: "epiC",
    width: 600,
    bg: buildInterior("staff", 600, 802, []),
    ambient: 0.3,
    tint: "rgba(40,60,90,0.12)",
    lights: () => [{ x: 220, y: 160, r: 60, a: 0.7, warm: "rgba(120,255,170,0.06)" }],
    minX: 30,
    maxX: 570,
    actors: crew,
    hotspots: [],
    zones: [],
    update: tickAll(crew),
    back: (camX) => {
      g.fillStyle = "#3a3e46";
      g.fillRect(200 - camX, 176, 50, 38);
      g.fillStyle = "#1a1e24";
      g.fillRect(208 - camX, 156, 30, 20);
      g.fillStyle = "#1a3a2a";
      g.fillRect(210 - camX, 158, 26, 16);
    },
    start: async () => {
      charlie.x = 230;
      charlie.y = 200;
      charlie.pose = "sit";
      charlie.facing = -1;
      await fadeTo(0, 1.2);
      await caption("월요일 아침. 지구에서 고양이가 모두 사라졌다.");
      await caption("좀비도, 해골도, 개구리도 그대로다. 그리고 블랙컴퍼니는... 정상 영업 중이다.");
      await say(charlie, "...샘, 보고 싶다.");
      await wait(1);
      sfx.blip();
      await caption("그때, 모니터에 초록 글씨가 떴다.");
      await caption("「샘은 잘 지낸다. 새 별에서도 츄르를 제일 좋아한다. 가끔 너를 찾는다. — 우주에서」");
      emote(charlie, "💧");
      await say(charlie, "...그래. 잘 지내라, 샘. 나도 열심히... 아니, 적당히 살게.");
      await fadeTo(1, 2);
      await credits("— 병맛 엔딩: 고양이는 귀엽다 —");
    },
  };
  return sc;
};


// ═════════════════════════════════════════════════════════
// 막간 「샘의 밤」 — 샘으로 플레이: 창밖으로 나간 뒤 무슨 일이 있었나
//  초록빛에 홀려 지붕을 건너던 샘을, 자루를 든 개구리들이 쫓는다.
//  (개구리들은 고양이를 잡아 블랙컴퍼니에 판다)
// ═════════════════════════════════════════════════════════
function catJumpGaps(gaps: Array<[number, number]>, state: { jumping: boolean; hinted: boolean }): void {
  if (state.jumping || S.hidden || !S.control) return;
  const ax = (keysDown("ArrowRight") || keysDown("KeyD") ? 1 : 0) - (keysDown("ArrowLeft") || keysDown("KeyA") ? 1 : 0);
  for (const [a, b] of gaps) {
    let to = 0;
    if (ax > 0 && charlie.x > a - 5 && charlie.x < a + 12) {
      charlie.x = a - 5;
      to = b + 12;
    } else if (ax < 0 && charlie.x < b + 5 && charlie.x > b - 12) {
      charlie.x = b + 5;
      to = a - 12;
    }
    if (!to) continue;
    if (keysDown("ShiftLeft") || keysDown("ShiftRight")) {
      state.jumping = true;
      S.control = false;
      charlie.pose = "jump";
      sfx.step();
      void tween(charlie, to, GROUND, 0.5, 22).then(() => {
        charlie.pose = null;
        state.jumping = false;
        S.control = true;
      });
    } else if (!state.hinted) {
      state.hinted = true;
      void caption("너무 멀다냥. Shift를 누르고 달려서 뛰어넘자.");
    }
  }
}
function keysDown(k: string): boolean {
  return keys.has(k);
}

SCENES.night1 = (checkpoint) => {
  const st = { jumping: false, hinted: false };
  const kit = patrol({
    look: FROGMAN,
    lookId: "frog",
    range: 90,
    quiet: () => true,
    shout: "고양이다! 잡아라, 개굴!",
    onCaught: () => gameOver("GAME OVER", "샘이 개구리 자루에 담기고 말았다... 「흰 고양이 확보, 개굴!」", charlie.x > 960 ? 980 : 0),
  });
  kit.add(700, 520, 860, -1);
  kit.add(1160, 1000, 1340);
  kit.add(1600, 1480, 1720, -1);
  const sc: Scene = {
    id: "night1",
    label: "막간 · 샘의 밤",
    width: ROOFS.width,
    bg: buildRoofs(),
    ambient: 0.5,
    tint: "rgba(40,120,80,0.10)",
    lights: () => [...kit.lights(), { x: charlie.x, y: charlie.y - 10, r: 30, a: 0.4 }, { x: 1900, y: 60, r: 120, a: 0.4, warm: "rgba(120,255,170,0.10)" }],
    minX: 30,
    maxX: ROOFS.width - 30,
    get actors() {
      return kit.guards;
    },
    hotspots: ROOFS.cover.map((cv) => hideAt(cv.x, cv.kind === "tank" ? "물탱크 밑으로 쏙" : "그늘에 웅크리기", 150, undefined, cv.kind === "tank" ? "tank" : cv.kind === "chimney" ? "chimney" : "stairbox")),
    zones: [
      {
        x: 1880,
        dir: 1,
        run: async () => {
          kit.freeze();
          await caption("초록빛이 구름 뒤로 사라지자, 샘은 정신을 차렸다. 배가 고프다. 그리고... 생선 냄새.");
          await goScene("night2", 0);
        },
      },
    ],
    update: (dt) => {
      kit.update(dt);
      catJumpGaps(ROOFS.gaps, st);
    },
    start: async () => {
      setPlayer(mkActor("sam", checkpoint || 60, 1));
      charlie.y = GROUND;
      writeSave("night1", checkpoint);
      await fadeTo(0, 1);
      if (!checkpoint) {
        await chapterCard("막간", "샘의 밤");
        await caption("같은 밤. 깨진 창밖으로 뛰어나간 샘은, 초록빛이 부르는 소리를 따라 지붕을 건넜다.");
        await caption("그런데 지붕 위에는 자루를 든 개구리 인간들이 어슬렁거리고 있었다.");
        await caption("(샘으로 플레이) 개구리 눈에 띄지 않게 물탱크·굴뚝 아래로 [Space] 숨자. 틈은 Shift+방향키로 뛰어넘자. 샘은 발소리가 나지 않는다.");
      }
      S.control = true;
    },
  };
  return sc;
};

const STALLS = [260, 520, 740];
SCENES.night2 = () => {
  const info = buildStreet(940, true, 77, false);
  const lureT = [0, 0];
  const kit = patrol({
    look: FROGMAN,
    lookId: "frog",
    range: 90,
    quiet: () => true,
    shout: "고양이다! 개굴!",
    onCaught: () => gameOver("GAME OVER", "샘이 개구리 자루에 담기고 말았다...", 0),
  });
  const f1 = kit.add(380, 300, 470, -1);
  const f2 = kit.add(640, 580, 800);
  const home: Array<[number, number]> = [[300, 470], [580, 800]];
  const sc: Scene = {
    id: "night2",
    label: "막간 · 생선 시장",
    width: 940,
    bg: info.canvas,
    ambient: 0.5,
    tint: "rgba(20,40,80,0.12)",
    lights: () => [...kit.lights(), ...STALLS.map((x): Light => ({ x, y: 160, r: 40, a: 0.5, warm: "rgba(255,200,120,0.08)" })), { x: charlie.x, y: charlie.y - 10, r: 30, a: 0.4 }],
    minX: 30,
    maxX: 920,
    get actors() {
      return kit.guards;
    },
    hotspots: [
      ...STALLS.map(
        (x): Hotspot => ({
          x,
          iconY: 150,
          label: "생선 떨어뜨리기",
          range: 20,
          enabled: () => true,
          use: async () => {
            charlie.pose = "jump";
            await tween(charlie, x, 186, 0.3, 10);
            sfx.can();
            await tween(charlie, x + 10, GROUND, 0.3, 6);
            charlie.pose = null;
            await caption("철퍼덕! 생선이 바닥에 우수수 떨어졌다.");
            [f1, f2].forEach((f, i) => {
              if (Math.abs(f.x - x) < 300) {
                f.a = f.b = x - 14;
                f.pause = 0;
                f.bubble = "개굴! 생선이다!";
                lureT[i] = 6;
              }
            });
          },
        }),
      ),
      hideAt(390, "상자 사이로 쏙", 170, undefined, "crates", true),
      hideAt(680, "생선 상자 뒤로 쏙", 170, undefined, "crates", true),
    ],
    zones: [
      {
        x: 890,
        dir: 1,
        run: async () => {
          kit.freeze();
          await caption("샘은 지하철 환기구 틈으로 몸을 밀어 넣었다. 아래에서 개구리 울음소리와 물건 부딪히는 소리.");
          await caption("환기구 아래 개구리 소굴. 벽에 붙은 전단: 「흰 고양이 생포 시 츄르 100봉지 — 블랙컴퍼니 특별대응단」");
          sfx.croak();
          shake(0.4);
          await caption("덥석! 어둠 속에서 자루가 덮쳤다.");
          sfx.meow();
          await caption("...샘은 자루 속에 갇히고 말았다. (찰리, 빨리 와 줘냥...)");
          await fadeTo(1, 1);
          await chapterCard("막간 끝", "");
          await goScene("drug1", 0, false);
        },
      },
    ],
    update: (dt) => {
      [f1, f2].forEach((f, i) => {
        if (lureT[i] > 0) {
          lureT[i] -= dt;
          if (lureT[i] <= 0) {
            f.a = home[i][0];
            f.b = home[i][1];
            f.bubble = null;
          }
        }
      });
      kit.update(dt);
    },
    back: (camX) => {
      for (const x of STALLS) {
        const sx = x - camX;
        g.fillStyle = "#5a3a24";
        g.fillRect(half(sx - 26), 186, 52, 28);
        g.fillStyle = "#8a6a4a";
        g.fillRect(half(sx - 28), 184, 56, 3);
        g.fillStyle = "#2a5a8a";
        for (let i = 0; i < 4; i++) g.fillRect(half(sx - 30 + i * 15), 150, 15, 8);
        g.fillStyle = "#e8e4dc";
        for (let i = 0; i < 4; i++) g.fillRect(half(sx - 22 + i * 15), 150, 7, 8);
        for (let i = 0; i < 5; i++) {
          g.fillStyle = i % 2 ? "#9ab0c0" : "#c8d8e0";
          g.beginPath();
          g.ellipse(sx - 18 + i * 9, 182, 4, 1.8, 0, 0, Math.PI * 2);
          g.fill();
        }
      }
      text("풀턴 생선 시장", 470 - camX, 120, "#e8d8a8", "center");
    },
    start: async () => {
      setPlayer(mkActor("sam", 60, 1));
      charlie.y = GROUND;
      writeSave("night2", 0);
      await fadeTo(0, 0.8);
      if (!F().seenNight2) {
        F().seenNight2 = 1;
        await caption("새벽의 생선 시장. 개구리들이 생선 상자를 뒤지고 있다.");
        await caption("(샘) 좌판 위로 뛰어올라 [Space] 생선을 떨어뜨리면 개구리들이 몰려간다. 그 틈에 지나가자!");
      }
      S.control = true;
    },
  };
  return sc;
};


// ═════════════════════════════════════════════════════════
// 제3.5장: 자연사 박물관 — 초록빛의 정체를 찾아서
//  에이다 박사, 별 조각 다섯 개, 이집트 벽화 · 별자리 · 보석 도둑 개구리
// ═════════════════════════════════════════════════════════
const SHARD_LORE = [
  "운석관의 파편: 만지자 따뜻하다. 귓가에 아주 먼 곳의 골골송이 들린다.",
  "이집트관의 파편: 고대인들은 이것을 '바스테트 여신의 눈물'이라 불렀다.",
  "천체투영관의 파편: 돔에 비추자 별 하나가 초록색으로 깜빡였다. 고양이자리의 꼬리 끝.",
  "보석관의 파편: 개구리들이 보석인 줄 알고 훔쳐 둔 것. 보석보다 훨씬 오래된 빛이다.",
  "에이다 박사가 해독한 마지막 조각: 「돌아오렴, 작은 별의 아이야. 그러나 네가 원할 때만.」",
];
async function getShard(n: number): Promise<void> {
  if (F()[`shard${n}`]) return;
  F()[`shard${n}`] = 1;
  F().shards = (F().shards ?? 0) + 1;
  sfx.item();
  flash("#aaffcc", 0.4);
  await caption(`초록 별 조각을 손에 넣었다! (${F().shards}/5)`);
  await caption(SHARD_LORE[n - 1]);
}
const shardSpot = (n: number, x: number, label: string, when: () => boolean = () => true): Hotspot => ({
  x,
  iconY: 150,
  label,
  enabled: () => !F()[`shard${n}`] && when(),
  use: () => getShard(n),
});

const preachers: Actor[] = [];
room({
  id: "mLobby",
  label: "자연사 박물관 · 로비",
  theme: "museum",
  width: 940,
  seed: 1101,
  startX: 70,
  props: [["whale", 470], ["ticket", 170], ["rope", 330], ["dino", 470], ["rope", 640], ["tallplant", 80], ["bench", 560], ["clock", 470], ["moai", 820], ["totem", 380], ["banner", 120], ["banner", 690], ["spot", 820], ["spot", 470]],
  doors: [
    {
      x: 40,
      kind: "steel",
      label: "정문",
      lock: () => (F().metAda ? null : "에이다 박사부터 찾자. 초록빛이 뭔지 알아야 샘을 지킬 수 있어."),
      use: async () => {
        await doorTransition(40, "in", { top: 144, w: 30, col: "#6a7480" });
        await goScene("times", 0);
      },
    },
    { x: 730, kind: "door", label: "운석관", to: "mMeteor", toX: 70, dir: "in" },
    { x: 610, kind: "arch", to: "mEgypt", toX: 60, dir: "in" },
    { x: 880, kind: "stairs", label: "천체 ↑", to: "mPlanet", toX: 60, dir: "up" },
    { x: 250, kind: "stairs", label: "보석관 ↓", to: "mGem", toX: 60, dir: "down" },
  ],
  hotspots: () => [
    look(170, 140, ["매표소 유리창에 쪽지: 「운석 특별전 무기한 연장 — 이유: 운석이 진짜로 떨어짐」"], "매표소"),
    look(470, 120, ["거대한 공룡 뼈 위에서 해골 시위대 둘이 설교 중이다.", "「보라! 공룡도 풀만 먹었다! 그래서 이렇게 가볍게 뼈만 남았다!」", "찰리:...공룡은 운석 때문에 멸종했는데."], "공룡 뼈"),
    look(610, 130, ["안내판: 「이집트관 — 고양이 미라 특별 전시」"], "안내판"),
  ],
  actors: () => {
    preachers.length = 0;
    return preachers;
  },
  back: (camX) => {
    // 공룡 뼈 위의 해골 설교자들 (배경)
    for (const [dx, i] of [[-30, 0], [26, 1]] as Array<[number, number]>) {
      const sx = 470 + dx - camX;
      g.globalAlpha = 0.9;
      smoothDraw(human(SKELETON, "sk", `stand${Math.floor(clock.t * 2 + i) % 4}`, BUILD_3, i ? -1 : 1), half(sx - 13), 214 - 92, 27, 40);
      g.globalAlpha = 1;
    }
  },
  enter: async () => {
    await caption("미국 자연사 박물관. 깨진 천장 유리 사이로 초록빛이 스며든다.");
    await say(charlie, "라디오에서 말한 박사님은 '운석관'에 있다고 했지.");
  },
});

const adaHere: Actor[] = [];
room({
  id: "mMeteor",
  label: "운석관",
  theme: "museum",
  width: 620,
  seed: 1102,
  startX: 70,
  props: [["meteorcase", 300], ["telescope", 480], ["rope", 200], ["notice", 130], ["crystal", 560], ["probe", 220], ["banner", 400], ["spot", 300], ["orrery", 420]],
  doors: [{ x: 40, kind: "door", label: "로비", to: "mLobby", toX: 730, dir: "in" }],
  actors: () => {
    adaHere.length = 0;
    adaHere.push(mkActor("person", 420, -1, { look: ADA, lookId: "ada", pose: "stand" }));
    return adaHere;
  },
  hotspots: () => [
    shardSpot(1, 300, "운석 파편 진열장"),
    {
      x: 420,
      iconY: 136,
      label: "에이다 박사",
      range: 26,
      enabled: () => true,
      use: async () => {
        const ada = adaHere[0];
        const n = F().shards ?? 0;
        if (!F().metAda) {
          F().metAda = 1;
          emote(ada, "!");
          await say(ada, "오, 사람이네! 면역자? 좋아, 좋아. 나는 에이다. 천문학자고, 이 박물관 운석 담당이지.");
          await say(charlie, "초록빛이 제 고양이를 계속 데려가려고 해요. 그게 뭔지 아세요?");
          await say(ada, "흥미롭군! 그 빛은 무작위가 아니야. 고양이에게만 반응하는 신호지. 해독하려면 '초록 별 조각'이 필요해.");
          await say(ada, "운석이 깨지면서 박물관 곳곳으로 튀었어. 운석관 진열장, 이집트관, 2층 천체투영관, 지하 보석관.");
          await say(ada, "네 개를 모아 오면 내가 신호를 풀어 볼게. 아, 보석관엔 개구리 도둑들이 있으니 조심하고.");
          emote(charlie, "💧");
          await say(charlie, "...개구리는 이제 지긋지긋한데.");
          return;
        }
        if (F().adaDone) {
          await say(ada, ["그 빛은 엄마의 목소리야. 겁먹지 마.", "네 고양이에게 선택권을 줘. 그게 진짜 사랑이지.", "별 조각 다섯 개면, 빛에게 직접 말을 걸 수 있을 거야."][(F().adaTalk = (F().adaTalk ?? 0) + 1) % 3]);
          return;
        }
        if (n < 4) {
          await say(ada, `조각은 지금 ${n}개. 네 개가 필요해! 이집트관, 천체투영관, 보석관을 뒤져 봐.`);
          return;
        }
        F().adaDone = 1;
        await say(ada, "네 개 모두! 좋아, 운석 파편과 겹쳐서... 신호를 비춰 보자.");
        flash("#aaffcc", 0.8);
        sfx.beam();
        await caption("조각들이 공중에 떠올라 원을 그리며 돌더니, 초록 글자가 허공에 새겨졌다.");
        await say(ada, "...이건 침략 신호가 아니야. 「돌아오렴, 작은 별의 아이야.」 엄마가 아이를 부르는 소리야.");
        await say(ada, "운석 가루는 그들의 '숨결'이야. 고양이에겐 길잡이지만, 사람에게는... 지금 거리의 모습 그대로지.");
        await say(charlie, "그럼 샘이...");
        await say(ada, "네 고양이, 아마 그 별에서 길을 잃고 떨어진 아이일 거야. 오래전에.");
        await say(ada, "마지막 조각은 해독하면서 생겨났어. 이걸 가져가. 다섯 개가 모이면 빛과 직접 이야기할 수 있을 거야.");
        await getShard(5);
        await say(ada, "그리고 하나만 기억해. 붙잡지도, 내쫓지도 말고... 그 아이가 고르게 해 줘.");
      },
    },
    look(130, 120, ["전시 설명: 「운석 GX-7: 7일 전 맨해튼에 낙하. 성분 미상. 초록빛을 냄.」", "그 아래 매직으로: 「만지지 마시오. 고양이가 모여듦.」"], "설명판"),
  ],
});

room({
  id: "mEgypt",
  label: "이집트관",
  theme: "egypt",
  width: 760,
  seed: 1103,
  startX: 60,
  props: [["sarco", 220], ["mummy", 340], ["mural", 470], ["statue", 620], ["rope", 470], ["pharaoh", 140], ["sphinx", 520], ["anubis", 400], ["obelisk", 720], ["vase", 280], ["pottery", 680], ["spot", 140], ["spot", 620]],
  doors: [{ x: 40, kind: "arch", to: "mLobby", toX: 610, dir: "in" }],
  hotspots: () => [
    look(340, 140, ["고양이 미라. 이름표: 「바스테트의 사자(使者), 기원전 1200년」", "찰리:...샘도 미라처럼 자는데."], "고양이 미라"),
    look(470, 100, ["벽화: 하늘의 초록 별에서 빛줄기가 내려오고, 고양이 세 마리가 그 아래 앉아 있다.", "그 아래 상형문자: 해 → 별 → 고양이 → 달 ... 그다음은 지워졌다."], "벽화"),
    {
      x: 620,
      iconY: 130,
      label: "바스테트 석상",
      enabled: () => !F().shard2,
      use: async () => {
        await caption("석상 받침대에 버튼 네 개: 해 · 달 · 별 · 고양이. 벽화의 순서를 따라 눌러야 할 것 같다.");
        const ok = await playSimon("석상의 수수께끼", [0, 2, 3, 1, 2, 3], ["해", "달", "별", "고양이"]);
        if (!ok) {
          await caption("석상의 눈이 잠깐 빛나다 꺼졌다. 순서가 틀렸다.");
          return;
        }
        shake(0.3);
        await caption("그르릉— 석상의 받침이 열리고, 초록빛이 새어 나왔다.");
        await getShard(2);
      },
    },
    canSpot("c24", 700, 176, "항아리 속"),
  ],
  enter: async () => {
    await caption("이집트관. 벽마다 고양이 그림이 가득하다.");
  },
});

room({
  id: "mPlanet",
  label: "천체투영관",
  theme: "planet",
  width: 640,
  seed: 1104,
  startX: 60,
  ambient: 0.3,
  props: [["projector", 320], ["telescope", 520], ["bench", 180], ["bench", 450], ["orrery", 320], ["probe", 590]],
  doors: [{ x: 40, kind: "stairs", label: "로비 ↓", to: "mLobby", toX: 880, dir: "down" }],
  hotspots: () => [
    {
      x: 320,
      iconY: 140,
      label: "투영기 작동",
      enabled: () => !F().shard3,
      use: async () => {
        sfx.fridge();
        await caption("투영기가 웅웅 돌며 돔에 별자리를 비춘다. 별 네 개가 차례로 깜빡인다.");
        const ok = await playSimon("별자리 순서 기억", [2, 0, 3, 1, 3, 2, 0], ["큰곰", "오리온", "고양이", "초록별"]);
        if (!ok) {
          await caption("별빛이 흩어졌다. 다시 해 보자.");
          return;
        }
        flash("#aaffcc", 0.5);
        await caption("마지막 별, '고양이자리'의 꼬리 끝이 초록색으로 빛났다. 투영기 렌즈 안에서 무언가 떨어졌다.");
        await getShard(3);
        await say(charlie, "고양이자리 꼬리 끝... 샘이 온 곳이 저기인가.");
      },
    },
    look(520, 130, ["망원경을 들여다보니 구름 사이로 초록빛 비행접시가 보인다.", "...뭔가를 찾는 듯 맨해튼 위를 맴돈다."], "망원경"),
  ],
  back: (camX) => {
    // 천천히 도는 별빛
    for (let i = 0; i < 30; i++) {
      const a = clock.t * 0.05 + i * 0.7;
      const x = 320 - camX + Math.cos(a) * (60 + (i % 5) * 40);
      const y = 120 + Math.sin(a) * (30 + (i % 4) * 15);
      g.fillStyle = i % 7 === 0 ? "rgba(140,255,170,0.9)" : "rgba(255,244,200,0.7)";
      g.fillRect(half(x), half(y), 1, 1);
    }
  },
});

room({
  id: "mGem",
  label: "보석관",
  theme: "gem",
  width: 820,
  seed: 1105,
  startX: 60,
  dark: true,
  props: [["gemcase", 180], ["gemcase", 320], ["gemcase", 470], ["gemcase", 600], ["boxes", 740], ["crystal", 400], ["crystal", 540], ["greek", 90]],
  doors: [{ x: 40, kind: "stairs", label: "로비 ↑", to: "mLobby", toX: 250, dir: "up" }],
  actors: () => {
    gemKit.guards.length = 0;
    gemKit.add(380, 250, 520);
    gemKit.add(640, 560, 700, -1);
    return gemKit.guards;
  },
  hotspots: () => [
    ...[180, 470, 600].map((x) => hideAt(x + 26, "진열장 뒤에 웅크리기", 160, undefined, "case", true)),
    shardSpot(4, 740, "개구리들의 장물 더미"),
    look(320, 140, ["깨진 진열장. 「호프 다이아몬드」 자리가 비어 있다.", "찰리:...개구리 녀석들, 취향 한번 고급이네."], "빈 진열장"),
  ],
  update: (dt) => gemKit.update(dt),
  lights: () => gemKit.lights(),
  enter: async () => {
    await caption("지하 보석관. 어둠 속에서 개구리들이 진열장을 털고 있다.");
    await caption("녀석들의 장물 더미는 맨 안쪽. 시선에 걸리지 않게 진열장 그늘에 숨어 가자.");
  },
});
const gemKit = patrol({
  look: FROGMAN,
  lookId: "frog",
  range: 90,
  shout: "개굴! 도둑이다!",
  onCaught: () => gameOver("GAME OVER", "개구리들에게 주머니를 탈탈 털렸다... (도둑이 도둑이라니)", 60),
});

// ── 타임스퀘어: 광고판과 넋 나간 군중 ───────────────────────────
const crowd: Actor[] = [];
SCENES.times = () => {
  const info = buildStreet(1100, true, 91, false);
  crowd.length = 0;
  const lines = [["광고... 광고를 봐야 해...", "할인... 할인..."], ["셀카... 셀카 찍어야 해...", "좋아요... 좋아요..."], ["출근... 출근..."], ["뉴스... 뉴스 속보...", "..."]];
  for (let i = 0; i < 7; i++) crowd.push(zoned(160 + i * 130, i, lines[i % lines.length], i % 3 === 0 ? "back" : "stand"));
  const ADS = [
    { x: 160, col: "#1a1a2a", t1: "블랙컴퍼니", t2: "야근은 열정이다", c: "#e8c84a" },
    { x: 430, col: "#c83a5a", t1: "실종 고양이를", t2: "찾습니다 · 수천 장", c: "#ffffff" },
    { x: 700, col: "#2a6a4a", t1: "운석 낙하 7일째", t2: "외출 자제 바람", c: "#e8f0e8" },
    { x: 960, col: "#3a2a7a", t1: "츄르 1+1", t2: "세상이 망해도 간식은", c: "#ffd6e6" },
  ];
  const sc: Scene = {
    id: "times",
    label: "타임스퀘어",
    width: 1100,
    bg: info.canvas,
    ambient: 0.35,
    tint: "rgba(60,20,80,0.10)",
    lights: () => [...ADS.map((a): Light => ({ x: a.x, y: 70, r: 110, a: 0.7, warm: "rgba(255,120,200,0.07)" })), { x: charlie.x, y: charlie.y - 24, r: 40, a: 0.4 }],
    minX: 30,
    maxX: 1080,
    actors: crowd,
    hotspots: [
      canSpot("c22b", 600, 176, "버려진 쇼핑백"),
      {
        x: 430,
        iconY: 150,
        label: "실종 전단 벽",
        enabled: () => true,
        use: async () => {
          await caption("벽 한 면이 고양이 실종 전단으로 덮여 있다. 수백 장. 전부 같은 날 사라졌다.");
          await say(charlie, "...초록빛이 온 날이야. 다들 고양이를 잃었구나.");
          if (!F().timesNote) {
            F().timesNote = 1;
            await caption("전단 사이에 낯익은 사진. 「찾습니다: 흰 고양이 '샘' — 연락처: 가르시아」");
            emote(charlie, "♥");
            await say(charlie, "가르시아 부인... 샘 전단을 붙여 줬구나.");
          }
        },
      },
    ],
    zones: [
      {
        x: 1060,
        dir: 1,
        run: async () => {
          await say(charlie, "블랙컴퍼니 본사가 이 근처야. 사원증을 찾으러 가자.");
          await goScene("bcLobby", 70);
        },
      },
    ],
    update: tickAll(crowd),
    back: (camX) => {
      // 거대한 전광판들 (깜빡이며 흐르는 글자)
      for (const a of ADS) {
        const sx = a.x - camX;
        if (sx < -120 || sx > W + 120) continue;
        const on = Math.sin(clock.t * 3 + a.x) > -0.85;
        g.fillStyle = "#0a0a0e";
        g.fillRect(half(sx - 62), 26, 124, 64);
        g.fillStyle = on ? a.col : "#1a1a22";
        g.fillRect(half(sx - 58), 30, 116, 56);
        if (on) {
          text(a.t1, sx, 48, a.c, "center", "");
          text(a.t2, sx, 68, a.c, "center", "");
        }
        g.fillStyle = "#2a2a30";
        g.fillRect(half(sx - 2), 90, 4, 20);
      }
      // 아래쪽 뉴스 띠
      g.fillStyle = "#c83a32";
      g.fillRect(0, 112, W, 10);
      const news = "속보 · 초록빛 비행물체 맨해튼 상공 7일째 · 블랙컴퍼니 '면역자 보호' 사업 독점 수주 · 고양이 실종 신고 3만 건 돌파 · ";
      const off = (clock.t * 40) % 600;
      text(news + news, W - off, 117, "#ffffff", "left", "");
    },
    start: async () => {
      charlie.x = 60;
      charlie.y = GROUND;
      charlie.facing = 1;
      writeSave("times", 0);
      await fadeTo(0, 0.8);
      if (!F().seenTimes) {
        F().seenTimes = 1;
        await caption("타임스퀘어. 전광판은 여전히 번쩍이고, 사람들은 넋이 나간 채 화면만 올려다본다.");
      }
      S.control = true;
    },
  };
  return sc;
};


// ═════════════════════════════════════════════════════════
// 배드 엔딩: 붙들 것이 없는 별
// ═════════════════════════════════════════════════════════
SCENES.epiD = () => {
  const sc: Scene = {
    id: "epiD",
    width: ROOM.width,
    bg: buildRoom(),
    ambient: 0.6,
    tint: "rgba(40,80,50,0.18)",
    lights: () => [{ x: 210, y: 92, r: 90, a: 0.6, warm: "rgba(120,255,170,0.10)" }],
    minX: 30,
    maxX: ROOM.width - 30,
    actors: [],
    hotspots: [],
    zones: [],
    overlay: () => {
      for (let i = 0; i < 40; i++) {
        g.fillStyle = "rgba(140,220,160,0.25)";
        g.fillRect(half((i * 73 + clock.t * 8) % W), half((i * 37 + clock.t * 12) % 270), 1, 1);
      }
    },
    start: async () => {
      charlie.x = ROOM.windowExit + 6;
      charlie.y = GROUND;
      charlie.facing = -1;
      charlie.pose = "back";
      S.camX = 0;
      await fadeTo(0, 1.4);
      await caption("한 달 뒤. 초록 가루는 아직도 도시 위를 떠다닌다.");
      await caption("샘의 밥그릇엔 먼지가 쌓였다. 찰리는 매일 밤 창가에 서 있다.");
      await say(charlie, "...초록... 초록빛...");
      await wait(1);
      await say(charlie, "출근... 출근해야 하는데...");
      await caption("찰리의 눈빛이, 거리의 사람들과 조금씩 닮아 가고 있었다.");
      await caption("(샘과 더 많은 시간을 보냈다면... 쓰다듬어 주고, 추억을 모았다면, 결말이 달라졌을지도 모른다.)");
      await fadeTo(1, 2);
      await credits("— 배드 엔딩: 붙들 것이 없는 별 —");
    },
  };
  return sc;
};

// ═════════════════════════════════════════════════════════
// 진 엔딩: 집으로
// ═════════════════════════════════════════════════════════
SCENES.epiT = () => {
  const info = buildStreet(820, false, 11, true);
  const cast: Actor[] = [];
  const add = (x: number, look: typeof RUTH, id: string, build = BUILD_3) => {
    const a = mkActor("person", x, -1, { look, lookId: id, pose: "stand", build });
    cast.push(a);
    return a;
  };
  const boss = add(360, BOSS, "boss");
  const ruth = add(400, RUTH, "ruth");
  const lily = add(430, LILY, "lily", BUILD_KID);
  const ada = add(470, ADA, "ada");
  const tomas = add(510, TOMAS, "tomas");
  const tony = add(545, TONY, "tony");
  const garcia = add(580, GARCIA, "garcia");
  const minji = add(615, MINJI, "minji");
  const lee = add(650, MRLEE, "mrlee");
  let blink = -1;
  const sc: Scene = {
    id: "epiT",
    width: 820,
    bg: info.canvas,
    ambient: 0,
    tint: "rgba(255,200,150,0.18)",
    lights: () => [],
    minX: 40,
    maxX: 780,
    actors: cast,
    hotspots: [],
    zones: [],
    back: (camX) => {
      // 새 간판: 고양이 쉼터 '샘의 집'
      const sx = info.door + 120 - camX;
      g.fillStyle = "#f4e8c8";
      g.fillRect(half(sx - 50), 132, 100, 18);
      g.fillStyle = "#c8466a";
      g.fillRect(half(sx - 50), 132, 100, 3);
      text("고양이 쉼터 · 샘의 집", sx, 142, "#5a2a3a", "center", "");
      // 동네 고양이들
      const cols = ["#f0a050", "#3a3a44", "#c8a878", "#e8e0d0", "#8a8aa0"];
      cols.forEach((c, i) => smoothDraw(tintedCat(`sitT${Math.floor(clock.t * 5 + i * 2) % 8}`, i % 2 ? 1 : -1, c), half(sx - 60 + i * 26 - camX * 0 - 15), 192, 32, 24));
      // 초록 별 두 번 깜빡
      if (blink >= 0) {
        const on = Math.floor(blink * 3) % 2 === 0 && blink < 1.4;
        if (on) {
          const gr = g.createRadialGradient(400, 30, 0, 400, 30, 14);
          gr.addColorStop(0, "rgba(200,255,220,1)");
          gr.addColorStop(1, "rgba(120,255,170,0)");
          g.fillStyle = gr;
          g.fillRect(386, 16, 28, 28);
        }
      }
    },
    update: (dt) => {
      if (blink >= 0) blink += dt;
    },
    start: async () => {
      charlie.x = info.door;
      charlie.y = GROUND;
      charlie.facing = 1;
      sam.visible = true;
      sam.x = info.door + 20;
      sam.y = GROUND;
      sam.facing = 1;
      await fadeTo(0, 1.4);
      await caption("석 달 뒤. 초록 가루는 사라졌고, 사람들은 하나둘 제정신으로 돌아왔다.");
      await caption("그리고 찰리네 아파트 1층에, 작은 가게가 문을 열었다.");
      await walkTo(charlie, 320, 40);
      await say(boss, "...찰리 군. 아니, 찰리 '점장'. 오늘 사료 입고는 내가 정리해 두겠네.");
      await say(charlie, "부장님, 아니 그림스 씨. 정시 퇴근하세요. 그게 우리 가게 사훈이에요.");
      emote(boss, "♥");
      await say(boss, "...정시 퇴근. 좋은 말이군. 나비랑 저녁 먹어야지.");
      await say(ruth, "네 고양이 덕분에 다들 돌아왔어. 붙들고 있던 게 하나씩 있었던 덕분이지.");
      await say(lily, "아저씨! 나비가 샘이랑 같이 낮잠 잤어요!");
      await say(ada, "그 별에서 매주 신호가 와. 해독해 보니까... '츄르 레시피 좀 보내 달라'더라.");
      await say(tomas, "가게 츄르는 내가 평생 대 주지.");
      await say(tony, "피자 배달 경로에 쉼터 추가했어요, 형!");
      await say(garcia, "피코가 쉼터 고양이들한테 노래를 불러 준단다.");
      await say(minji, "저는 여기 매니저로 이직했어요! 연봉은 츄르로 받아요.");
      await say(lee, "개업 기념 핫도그다! 고양이용 소시지도 있지!");
      await caption("그날 밤, 찰리와 샘은 옥상에서 하늘을 올려다보았다.");
      blink = 0;
      sfx.item();
      await wait(1.8);
      sfx.meow();
      await say(charlie, "...봤어, 샘? 두 번. 안부 인사래.");
      sam.pose = "butt";
      sfx.purr();
      emote(sam, "♥");
      await say(charlie, "우리 집에 와 줘서 고마워.");
      await fadeTo(1, 2.2);
      await credits("— 진 엔딩: 집으로 —");
    },
  };
  return sc;
};

export const STAGES_READY = true;
void W;

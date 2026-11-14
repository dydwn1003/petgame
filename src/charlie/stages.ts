// 추가 스테이지: 방과 방을 문으로 잇는 미로 + 퍼즐
//  · 제1장 앞: 불타는 아파트 탈출 (4층 → 1층)
//  · 제2장: 지하철 점검 통로 (사물함 비밀번호, 쇠지렛대, 밸브 퍼즐)
//  · 제3장: 교회 지하 납골당 (악보와 종 퍼즐, 릴리의 약)
//  · 제4장: 격리 센터 보안실 · 기록 보관실 · 격리 구역
import { GROUND, W, clock, fadeTo, flash, g, sfx, shake, sneaking, text, wait } from "./core";
import { buildInterior, buildStreet, type DoorDef, type Theme } from "./bg";
import { SKELETON, STRANGERS, ZOMBIES } from "./sprites";
import {
  ITEMS,
  S,
  SCENES,
  ascend,
  caption,
  charlie,
  descend,
  canSpot,
  credits,
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
      bg: buildInterior(o.theme, o.width, o.seed, doors),
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
              await walkTo(charlie, d.x, 50);
              if (d.dir === "down") await descend(4);
              else if (d.dir === "up") await ascend(4);
              else sfx.step();
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
        await walkTo(charlie, 660, 50);
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

room({
  id: "staff2",
  label: "역무원 휴게실",
  theme: "staff",
  width: 540,
  seed: 502,
  startX: 70,
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
    look(240, 160, ["라디오에서 치지직 소리만 난다.", "「...지하철 운행 전면 중단...」"], "라디오"),
  ],
});

room({
  id: "tun2",
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
room({
  id: "sec4",
  label: "보안실",
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
  label: "격리 구역",
  theme: "cells",
  width: 640,
  seed: 703,
  startX: 70,
  doors: [{ x: 50, kind: "steel", label: "복도", to: "center", toX: 300, dir: "in" }],
  hotspots: () => [canSpot("c20", 560, 176, "빈 침대 밑"), 
    look(180, 130, ["정비 메모: 「비상 해제: 레버를 '셋 → 하나 → 둘' 순서로 내릴 것. 틀리면 처음부터.」"], "정비 메모"),
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
          } else await caption(`${i + 1}번 레버를 내렸다. (${F().lever}/3)`);
        },
      }),
    ),
  ],
  back: (camX) => {
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
  label: "복사실",
  theme: "staff",
  width: 520,
  seed: 804,
  startX: 70,
  doors: [{ x: 50, kind: "door", label: "사무실", to: "bc7", toX: 520, dir: "in" }],
  actors: () => {
    intern.length = 0;
    const a = zoned(F().internUp ? 150 : 300, 2, F().internUp ? ["커피 맛있다...", "선배, 고마워요."] : ["커피... 커피...", "복사... 복사..."]);
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
        intern[0].bubble = "...어? 선배? 저 여기서 뭐 하고 있었죠?";
        await wait(1.8);
        intern[0].bubble = null;
        await walkTo(intern[0], 150, 40);
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
    hideAt(560, "계산대 뒤에 숨기", 160),
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
    hotspots: MARCH_DOORS.map((x) => hideAt(x, "문틈에 숨기", 160)),
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
      for (const x of MARCH_DOORS) {
        const sx = x - camX;
        g.fillStyle = "#0a0808";
        g.fillRect(half(sx - 13), 160, 26, 54);
        g.fillStyle = "#3a2a22";
        g.fillRect(half(sx - 15), 156, 30, 4);
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

export const STAGES_READY = true;
void W;

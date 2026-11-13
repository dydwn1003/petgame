// 이야기와 적 데이터 — 아스테리아 마법학교 (오리지널 세계관)
import type { BgId, CharId } from "./art";
import type { SpellId } from "./gesture";

export type Speaker = "narr" | "rio" | "bello" | "kairen" | "serafin" | "noct" | "unknown";

export const SPEAKER_NAME: Record<Speaker, string> = {
  narr: "",
  rio: "리오",
  bello: "벨로 교수",
  kairen: "카이렌",
  serafin: "세라핀",
  noct: "녹트",
  unknown: "???",
};

export const SPEAKER_CHAR: Partial<Record<Speaker, CharId>> = {
  bello: "bello",
  kairen: "kairen",
  serafin: "serafin",
  noct: "noct",
};

export type Line = [Speaker, string];

export interface EnemySpell {
  name: string;
  kind: "attack" | "heal";
  charge: number;
  amount: number;
  weight: number;
  color: string;
  /** 체력이 이 비율 아래일 때만 사용 */
  belowHp?: number;
  once?: boolean;
}

export interface EnemyDef {
  char: CharId;
  name: string;
  hp: number;
  idle: [number, number];
  /** 내 주문이 날아올 때 방어막을 펼 확률 */
  shieldReact: number;
  /** 체력 절반 아래에서 빨라짐 */
  enrage?: boolean;
  spells: EnemySpell[];
}

export interface Chapter {
  title: string;
  bg: BgId;
  enemy: EnemyDef;
  unlock: SpellId[];
  intro: Line[];
  outro: Line[];
}

export const SPELL_INFO: Record<SpellId, { name: string; shape: string; cost: number; color: string; key: string }> = {
  bolt: { name: "번개 화살", shape: "Z", cost: 8, color: "#ffe066", key: "1" },
  shield: { name: "방어막", shape: "─", cost: 12, color: "#7fe0ff", key: "2" },
  fire: { name: "화염구", shape: "○", cost: 22, color: "#ff7a3a", key: "3" },
  frost: { name: "서리", shape: "V", cost: 18, color: "#a8e8ff", key: "4" },
  heal: { name: "치유", shape: "^", cost: 40, color: "#8aff9a", key: "5" },
};

export const CHAPTERS: Chapter[] = [
  {
    title: "제1장 · 입학식 날",
    bg: "hall",
    unlock: ["bolt", "shield"],
    enemy: {
      char: "dummy",
      name: "훈련용 허수아비",
      hp: 40,
      idle: [2.2, 3.2],
      shieldReact: 0,
      spells: [{ name: "짚 뭉치", kind: "attack", charge: 1.6, amount: 6, weight: 1, color: "#e0c060" }],
    },
    intro: [
      ["narr", "별이 가장 밝은 밤, 아스테리아 마법학교의 문이 열렸다."],
      ["bello", "어서 오게, 리오. 오늘부터 자네도 아스테리아의 견습 마법사일세."],
      ["bello", "이 지팡이를 받게. 자작나무에 별똥별 가루를 넣어 만든 것이지."],
      ["rio", "(지팡이를 쥐자 손끝이 찌릿했다.)"],
      ["bello", "아스테리아의 주문은 말이 아니라 '그림'으로 건다네. 허공에 모양을 그려 보게."],
      ["bello", "지그재그(Z)를 그리면 ⚡번개 화살, 가로선(─)을 그으면 🛡방어막이야."],
      ["bello", "저 허수아비가 짚 뭉치를 던질 거야. 방어막으로 막고, 번개로 쓰러뜨려 보게!"],
    ],
    outro: [
      ["bello", "훌륭해! 첫날부터 이 정도라니."],
      ["bello", "그런데… 요즘 금지된 탑 쪽에서 이상한 기운이 느껴진다네. 밤에는 조심하게."],
    ],
  },
  {
    title: "제2장 · 붉은 라이벌",
    bg: "court",
    unlock: ["fire"],
    enemy: {
      char: "kairen",
      name: "카이렌",
      hp: 85,
      idle: [1.1, 2.0],
      shieldReact: 0.25,
      spells: [
        { name: "불티", kind: "attack", charge: 1.1, amount: 8, weight: 3, color: "#ff9a4a" },
        { name: "붉은 화염", kind: "attack", charge: 1.9, amount: 15, weight: 2, color: "#ff4a2a" },
      ],
    },
    intro: [
      ["narr", "다음 날, 해 질 녘의 결투 연습장."],
      ["kairen", "네가 그 신입이야? 허수아비 하나 쓰러뜨렸다고 소문이 자자하던데."],
      ["kairen", "진짜 결투가 뭔지 보여주지. 내 불꽃은 짚 뭉치랑은 다르거든."],
      ["rio", "…좋아. 받아줄게."],
      ["bello", "(멀리서) 리오! 원(○)을 그리면 🔥화염구가 나간다네. 강하지만 마나를 많이 쓰지!"],
      ["narr", "새 주문을 배웠다 — 🔥 화염구 : 원(○) 그리기"],
    ],
    outro: [
      ["kairen", "칫… 운이 좋았을 뿐이야."],
      ["kairen", "그나저나 너도 봤어? 밤마다 숲 쪽에서 검은 그림자가 학교로 내려와."],
      ["kairen", "겁쟁이들은 못 가겠지만, 넌 어때?"],
    ],
  },
  {
    title: "제3장 · 검은 숲의 그림자",
    bg: "forest",
    unlock: ["frost"],
    enemy: {
      char: "wolf",
      name: "그림자 짐승",
      hp: 95,
      idle: [0.8, 1.6],
      shieldReact: 0,
      spells: [
        { name: "할퀴기", kind: "attack", charge: 0.85, amount: 9, weight: 3, color: "#a04aff" },
        { name: "돌진", kind: "attack", charge: 1.6, amount: 20, weight: 2, color: "#ff3355" },
      ],
    },
    intro: [
      ["narr", "자정. 학교 뒤편 검은 숲."],
      ["rio", "이 발자국… 늑대라기엔 너무 커."],
      ["narr", "어둠 속에서 붉은 눈 두 개가 번뜩였다."],
      ["bello", "(지팡이 속에서 교수의 목소리가 울린다) 리오, 들리나? 그건 누군가 어둠으로 빚어낸 그림자 짐승이야!"],
      ["bello", "V자를 그리면 ❄서리가 나가네. 놈이 힘을 모을 때 얼려버리면 공격이 끊기지!"],
      ["narr", "새 주문을 배웠다 — ❄ 서리 : V 그리기 (적이 힘을 모을 때 맞히면 끊긴다)"],
    ],
    outro: [
      ["narr", "그림자 짐승은 검은 연기가 되어 흩어졌다. 연기 속에 은빛 문양 하나가 남았다."],
      ["rio", "이 문양… 별이 거꾸로 뒤집혀 있어."],
      ["bello", "거꾸로 된 별… 녹트의 표식이로군. 오래전 이 학교에서 쫓겨난 내 제자일세."],
    ],
  },
  {
    title: "제4장 · 별빛 결투대회",
    bg: "arena",
    unlock: ["heal"],
    enemy: {
      char: "serafin",
      name: "세라핀",
      hp: 115,
      idle: [1.0, 1.8],
      shieldReact: 0.35,
      spells: [
        { name: "얼음 창", kind: "attack", charge: 1.2, amount: 11, weight: 3, color: "#8ad0ff" },
        { name: "푸른 폭풍", kind: "attack", charge: 2.4, amount: 24, weight: 1, color: "#3a7aff" },
        { name: "물빛 치유", kind: "heal", charge: 1.8, amount: 30, weight: 4, color: "#8aff9a", belowHp: 0.5, once: true },
      ],
    },
    intro: [
      ["narr", "한 달 뒤, 별빛 결투대회 결승전."],
      ["serafin", "신입이 결승까지 오다니, 대단하네. 하지만 여기서 끝이야."],
      ["serafin", "나는 쓰러질 것 같으면 스스로를 치유하거든. 오래 버틸 각오는 됐니?"],
      ["bello", "리오, ^ 모양을 그리면 ✨치유 주문이야. 마나를 아주 많이 먹으니 아껴 쓰게."],
      ["bello", "그리고 세라핀이 치유를 모을 때 서리로 끊어버리는 것도 방법이지."],
      ["narr", "새 주문을 배웠다 — ✨ 치유 : ^ 그리기"],
    ],
    outro: [
      ["serafin", "…졌어. 축하해, 올해의 별빛 결투사."],
      ["narr", "환호가 터지던 그 순간, 하늘의 별 하나가 검게 꺼졌다."],
      ["unknown", "축하하네, 꼬마 마법사. 하지만 오늘 밤 꺼질 별은 저것 하나가 아니야."],
      ["bello", "녹트! 별의 탑으로 가는구나. 리오, 탑의 별빛 수정을 빼앗기면 학교의 모든 마법이 꺼진다네!"],
    ],
  },
  {
    title: "제5장 · 별의 탑",
    bg: "tower",
    unlock: [],
    enemy: {
      char: "noct",
      name: "녹트",
      hp: 170,
      idle: [1.0, 1.7],
      shieldReact: 0.4,
      enrage: true,
      spells: [
        { name: "어둠의 창", kind: "attack", charge: 1.0, amount: 12, weight: 3, color: "#a04aff" },
        { name: "뒤집힌 별의 저주", kind: "attack", charge: 3.0, amount: 38, weight: 1.4, color: "#ff2a8a" },
      ],
    },
    intro: [
      ["narr", "별의 탑 꼭대기. 거대한 수정 앞에 검은 망토의 마법사가 서 있었다."],
      ["noct", "벨로 영감이 너를 보냈나? 늙더니 겁이 많아졌군."],
      ["noct", "이 학교는 마법을 '규칙' 속에 가뒀다. 나는 그걸 풀어주려는 것뿐이야."],
      ["rio", "모두의 마법을 꺼뜨리면서? 그건 해방이 아니라 도둑질이야."],
      ["noct", "…말로 해서는 안 되겠군. 와라!"],
      ["bello", "'뒤집힌 별의 저주'는 맞으면 치명적이야! 크게 모을 때 반드시 서리로 끊거나 방어막으로 막게!"],
    ],
    outro: [
      ["narr", "녹트의 지팡이가 부러지며, 꺼졌던 별들이 하나둘 다시 빛나기 시작했다."],
      ["noct", "…나도 한때는 너처럼 첫 주문에 손이 떨렸지."],
      ["bello", "녹트, 이제 그만 돌아오게. 벌은 받아야겠지만, 자네 자리는 아직 여기 있어."],
      ["kairen", "야, 리오! …뭐, 인정할게. 너 좀 하더라."],
      ["serafin", "내년 결투대회에선 내가 이길 거야. 기다려."],
      ["rio", "(지팡이 끝에서 작은 별빛이 반짝였다.)"],
      ["narr", "— 별의 지팡이 · 끝 —"],
    ],
  },
];

export function unlockedUpTo(chapterIdx: number): SpellId[] {
  const out: SpellId[] = [];
  for (let i = 0; i <= chapterIdx; i++) out.push(...CHAPTERS[i].unlock);
  return out;
}

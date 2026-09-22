// Quest data schema — matches GDD "퀘스트 데이터 (Quest JSON)" spec.
export interface QuestDef {
  quest_id: string;
  npc_id: string;
  min_stage: number;
  required_item: string;
  required_amount: number;
  reward_gold: number;
  title: string;
  flavor: string;
}

export const QUESTS: QuestDef[] = [
  {
    quest_id: "Q_DOG_001",
    npc_id: "NPC_DOG_MARO",
    min_stage: 1,
    required_item: "CROP_BONE_CARROT",
    required_amount: 3,
    reward_gold: 200,
    title: "마로의 첫 부탁",
    flavor: "마로: \"멍! 뼈다귀 모양 당근을 3개만 가져다 줄 수 있겠니?\"",
  },
  {
    quest_id: "Q_CAT_001",
    npc_id: "NPC_CAT_SASHA",
    min_stage: 1,
    required_item: "FISH_ANCHOVY",
    required_amount: 3,
    reward_gold: 180,
    title: "카페 식재료",
    flavor: "샤샤: \"항구에서 멸치 3마리만 잡아다 줄래? 카페 메뉴에 쓰고 싶어.\"",
  },
  {
    quest_id: "Q_HAM_001",
    npc_id: "NPC_HAM_BOLBOL",
    min_stage: 1,
    required_item: "ORE_COPPER",
    required_amount: 3,
    reward_gold: 220,
    title: "광산 재개장",
    flavor: "볼볼: \"찍찍! 구리 원석 3개만 있으면 갱도를 보수할 수 있어!\"",
  },
  {
    quest_id: "Q_CAT_002",
    npc_id: "NPC_CAT_SASHA",
    min_stage: 2,
    required_item: "CROP_STRAWBERRY",
    required_amount: 5,
    reward_gold: 400,
    title: "딸기 타르트",
    flavor: "샤샤: \"딸기 5개로 항구 명물 타르트를 만들어볼게!\"",
  },
  {
    quest_id: "Q_DOG_002",
    npc_id: "NPC_DOG_MARO",
    min_stage: 2,
    required_item: "CROP_BONE_CARROT",
    required_amount: 8,
    reward_gold: 500,
    title: "겨울 대비 비축",
    flavor: "마로: \"겨울이 오기 전에 뼈당근 8개를 창고에 채워야 해!\"",
  },
  {
    quest_id: "Q_HAM_002",
    npc_id: "NPC_HAM_BOLBOL",
    min_stage: 3,
    required_item: "ORE_GOLD",
    required_amount: 3,
    reward_gold: 700,
    title: "스프링클러 부품",
    flavor: "볼볼: \"황금 원석 3개로 자동 스프링클러를 만들 수 있어!\"",
  },
  {
    quest_id: "Q_CAT_003",
    npc_id: "NPC_CAT_SASHA",
    min_stage: 4,
    required_item: "GEM_BLUE",
    required_amount: 2,
    reward_gold: 1000,
    title: "축제의 보석",
    flavor: "샤샤: \"축제 장식에 쓸 푸른 보석 2개를 구해다 줄 수 있어?\"",
  },
];

export function questsForStage(stage: number): QuestDef[] {
  return QUESTS.filter((q) => q.min_stage <= stage);
}

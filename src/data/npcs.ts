export type NpcId = "NPC_DOG_MARO" | "NPC_CAT_SASHA" | "NPC_HAM_BOLBOL";

export interface NpcDef {
  npc_id: NpcId;
  name: string;
  role: string;
  species: "dog" | "cat" | "hamster";
  lovedGifts: string[];
  likedGifts: string[];
  tileX: number;
  tileY: number;
  dialogue: string[];
}

export const NPCS: NpcDef[] = [
  {
    npc_id: "NPC_DOG_MARO",
    name: "마로 (Maro)",
    role: "마을 이장 및 농경 안내자",
    species: "dog",
    lovedGifts: ["CROP_BONE_CARROT"],
    likedGifts: ["SEED_BONE_CARROT", "CROP_STRAWBERRY"],
    tileX: 14,
    tileY: 16,
    dialogue: [
      "멍! 어서 오게, 새로운 이웃.",
      "농장을 잘 가꾸면 이 마을도 다시 살아날 거야.",
      "밭에 물 주는 거 잊지 말라구!",
    ],
  },
  {
    npc_id: "NPC_CAT_SASHA",
    name: "샤샤 (Sasha)",
    role: "항구 카페 오너 겸 요리사",
    species: "cat",
    lovedGifts: ["FISH_DRIED", "CATNIP"],
    likedGifts: ["FISH_ANCHOVY"],
    tileX: 46,
    tileY: 10,
    dialogue: [
      "야옹~ 항구 카페에 온 걸 환영해.",
      "신선한 생선이 있으면 맛있는 요리를 해줄게.",
      "낚시할 땐 발바닥 리듬에 맞춰서 당겨봐!",
    ],
  },
  {
    npc_id: "NPC_HAM_BOLBOL",
    name: "볼볼 (Bolbol)",
    role: "광산 상인",
    species: "hamster",
    lovedGifts: ["ORE_GOLD", "GEM_BLUE"],
    likedGifts: ["ORE_COPPER"],
    tileX: 46,
    tileY: 30,
    dialogue: [
      "찍찍! 지하 굴에 볼일이 있나?",
      "원석을 캐 오면 후하게 쳐줄게.",
      "미로가 좀 복잡하니 조심하라구.",
    ],
  },
];

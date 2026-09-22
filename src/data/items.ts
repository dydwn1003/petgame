// Item data schema — matches GDD "아이템 데이터 (Item JSON)" spec.
export type ItemCategory = "Crop" | "Seed" | "Fish" | "Ore" | "Gift" | "Material";

export interface ItemDef {
  item_id: string;
  category: ItemCategory;
  sprite_id: string;
  growth_days?: number;
  sell_price: number;
  name: string;
  desc: string;
}

export const ITEMS: Record<string, ItemDef> = {
  CROP_BONE_CARROT: {
    item_id: "CROP_BONE_CARROT",
    category: "Crop",
    sprite_id: "spr_bone_carrot",
    growth_days: 4,
    sell_price: 65,
    name: "뼈다귀 모양 당근",
    desc: "강아지 캐릭터들이 사랑하는 뼈다귀 모양의 특별한 당근.",
  },
  SEED_BONE_CARROT: {
    item_id: "SEED_BONE_CARROT",
    category: "Seed",
    sprite_id: "spr_seed_bag",
    sell_price: 10,
    name: "뼈당근 씨앗",
    desc: "심으면 4일 후 수확할 수 있어요.",
  },
  CROP_STRAWBERRY: {
    item_id: "CROP_STRAWBERRY",
    category: "Crop",
    sprite_id: "spr_strawberry",
    growth_days: 3,
    sell_price: 55,
    name: "딸기",
    desc: "달콤한 향이 나는 붉은 딸기.",
  },
  SEED_STRAWBERRY: {
    item_id: "SEED_STRAWBERRY",
    category: "Seed",
    sprite_id: "spr_seed_bag",
    sell_price: 8,
    name: "딸기 씨앗",
    desc: "심으면 3일 후 수확할 수 있어요.",
  },
  FISH_ANCHOVY: {
    item_id: "FISH_ANCHOVY",
    category: "Fish",
    sprite_id: "spr_fish_small",
    sell_price: 20,
    name: "은빛 멸치",
    desc: "항구에서 흔히 잡히는 작은 물고기.",
  },
  FISH_DRIED: {
    item_id: "FISH_DRIED",
    category: "Fish",
    sprite_id: "spr_fish_dried",
    sell_price: 90,
    name: "고급 다랑어",
    desc: "샤샤가 가장 좋아하는 고급 생선.",
  },
  CATNIP: {
    item_id: "CATNIP",
    category: "Gift",
    sprite_id: "spr_catnip",
    sell_price: 30,
    name: "캣닙",
    desc: "고양이 캐릭터들이 환장하는 허브.",
  },
  ORE_COPPER: {
    item_id: "ORE_COPPER",
    category: "Ore",
    sprite_id: "spr_ore_copper",
    sell_price: 40,
    name: "구리 원석",
    desc: "지하 굴에서 캐낸 반짝이는 원석.",
  },
  ORE_GOLD: {
    item_id: "ORE_GOLD",
    category: "Ore",
    sprite_id: "spr_ore_gold",
    sell_price: 120,
    name: "황금 원석",
    desc: "매우 귀한 황금빛 원석.",
  },
  GEM_BLUE: {
    item_id: "GEM_BLUE",
    category: "Ore",
    sprite_id: "spr_gem_blue",
    sell_price: 200,
    name: "푸른 보석",
    desc: "깊은 굴에서만 발견되는 희귀 보석.",
  },
};

export function getItem(id: string): ItemDef {
  const it = ITEMS[id];
  if (!it) throw new Error(`Unknown item_id: ${id}`);
  return it;
}

import type { Species } from "../gfx/characters";

export type PatternKind = "tabby" | "calico" | "tuxedo" | "dorsalStripe" | "eyebrows" | "curly" | "fluffy" | "none";

export interface BreedPalette {
  body: string;
  bodyShade: string;
  belly: string;
  ear: string;
  nose: string;
  /** Secondary pattern color (stripes/patches); a second one for calico's third tone. */
  patternColor?: string;
  patternColor2?: string;
}

export interface BreedDef {
  id: string;
  species: Species;
  label: string;
  desc: string;
  palette: BreedPalette;
  pattern: PatternKind;
  /** Approximate real-world standing height (head to ground, cm) — used to
   * size this breed proportionally against the other breeds and the map art. */
  heightCm: number;
}

export const BREEDS: BreedDef[] = [
  // --- Dogs ---
  {
    id: "jindo",
    species: "dog",
    label: "진돗개",
    desc: "충직하고 씩씩한 토종견",
    palette: { body: "#e8b878", bodyShade: "#d1a05f", belly: "#fdf6ec", ear: "#c98f4a", nose: "#3d2314" },
    pattern: "none",
    heightCm: 48,
  },
  {
    id: "maltese",
    species: "dog",
    label: "말티즈",
    desc: "새하얗고 폭신폭신한 털",
    palette: { body: "#ffffff", bodyShade: "#e8e4e0", belly: "#ffffff", ear: "#e8e4e0", nose: "#2a1d15" },
    pattern: "fluffy",
    heightCm: 23,
  },
  {
    id: "poodle",
    species: "dog",
    label: "푸들",
    desc: "곱슬곱슬한 갈색 털",
    palette: { body: "#a86a42", bodyShade: "#8f5530", belly: "#c98f5f", ear: "#8f5530", nose: "#2a1d15" },
    pattern: "curly",
    heightCm: 28,
  },
  {
    id: "pomeranian",
    species: "dog",
    label: "포메라니안",
    desc: "풍성한 목털의 여우상 얼굴",
    palette: { body: "#e8923c", bodyShade: "#d1782a", belly: "#f7c98a", ear: "#d1782a", nose: "#2a1d15" },
    pattern: "fluffy",
    heightCm: 21,
  },

  // --- Cats ---
  {
    id: "cheese_tabby",
    species: "cat",
    label: "치즈 태비",
    desc: "주황빛 줄무늬 고양이",
    palette: {
      body: "#f2b878",
      bodyShade: "#d1863f",
      belly: "#fff6e0",
      ear: "#f2b878",
      nose: "#e0879c",
      patternColor: "#d1863f",
    },
    pattern: "tabby",
    heightCm: 28,
  },
  {
    id: "mackerel_tabby",
    species: "cat",
    label: "고등어 태비",
    desc: "회색 고등어 줄무늬",
    palette: {
      body: "#b8b4b0",
      bodyShade: "#8f8b87",
      belly: "#f5f3f0",
      ear: "#a8a49f",
      nose: "#8a6f6f",
      patternColor: "#8f8b87",
    },
    pattern: "tabby",
    heightCm: 28,
  },
  {
    id: "calico",
    species: "cat",
    label: "삼색이",
    desc: "흰색·주황·검정 삼색 무늬",
    palette: {
      body: "#ffffff",
      bodyShade: "#e8e4e0",
      belly: "#ffffff",
      ear: "#f2b8c6",
      nose: "#e0879c",
      patternColor: "#e8923c",
      patternColor2: "#3d3436",
    },
    pattern: "calico",
    heightCm: 27,
  },
  {
    id: "tuxedo",
    species: "cat",
    label: "턱시도",
    desc: "검은 턱시도를 입은 듯한 무늬",
    palette: {
      body: "#2a2430",
      bodyShade: "#1a1620",
      belly: "#ffffff",
      ear: "#2a2430",
      nose: "#e0879c",
      patternColor: "#ffffff",
    },
    pattern: "tuxedo",
    heightCm: 28,
  },

  // --- Hamsters ---
  {
    id: "syrian",
    species: "hamster",
    label: "시리안",
    desc: "골든빛 큰 몸집의 햄스터",
    palette: { body: "#e0b478", bodyShade: "#c99a5e", belly: "#f7e2bb", ear: "#f2c9c9", nose: "#a85d5d" },
    pattern: "none",
    heightCm: 13,
  },
  {
    id: "winter_white",
    species: "hamster",
    label: "정가리안",
    desc: "등줄무늬가 있는 회백색 햄스터",
    palette: {
      body: "#c9c2ba",
      bodyShade: "#a89f96",
      belly: "#f5f2ee",
      ear: "#e0d8ce",
      nose: "#8a6f6f",
      patternColor: "#6b625c",
    },
    pattern: "dorsalStripe",
    heightCm: 9,
  },
  {
    id: "roborovski",
    species: "hamster",
    label: "로보로브스키",
    desc: "하얀 눈썹이 매력적인 모래빛 햄스터",
    palette: {
      body: "#d9b98a",
      bodyShade: "#c2a274",
      belly: "#f2e6cc",
      ear: "#e0c9a0",
      nose: "#8a6f6f",
      patternColor: "#fff6e0",
    },
    pattern: "eyebrows",
    heightCm: 8,
  },
  {
    id: "campbell",
    species: "hamster",
    label: "캠벨",
    desc: "회갈색 등줄무늬 햄스터",
    palette: {
      body: "#a89a86",
      bodyShade: "#8f8271",
      belly: "#e8e0d0",
      ear: "#c2b49f",
      nose: "#6b5d52",
      patternColor: "#5c5248",
    },
    pattern: "dorsalStripe",
    heightCm: 9,
  },
];

export function breedsForSpecies(species: Species): BreedDef[] {
  return BREEDS.filter((b) => b.species === species);
}

export function getBreed(id: string): BreedDef {
  const b = BREEDS.find((bb) => bb.id === id);
  if (!b) throw new Error(`Unknown breed_id: ${id}`);
  return b;
}

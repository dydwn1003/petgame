import Phaser from "phaser";
import type { Species } from "../gfx/characters";
import { GameState } from "../state/GameState";
import { BREEDS, breedsForSpecies, type BreedDef } from "../data/breeds";
import { fitScale } from "../gfx/registerTextures";
import { PIXEL_FONT } from "../ui/theme";

const PREVIEW_WIDTH = 96;

const SPECIES_INFO: { id: Species; label: string }[] = [
  { id: "dog", label: "강아지" },
  { id: "cat", label: "고양이" },
  { id: "hamster", label: "햄스터" },
];

export class TitleScene extends Phaser.Scene {
  private species: Species = "dog";
  private breedId: string = BREEDS[0].id;
  private speciesTabs: Phaser.GameObjects.Rectangle[] = [];
  private breedCards: Phaser.GameObjects.Rectangle[] = [];
  private breedLayer!: Phaser.GameObjects.Container;

  constructor() {
    super("Title");
  }

  create(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    this.cameras.main.setBackgroundColor("#1a1625");

    this.add
      .text(w / 2, 46, "포근포근 펫빌리지", {
        fontFamily: PIXEL_FONT,
        fontSize: "34px",
        color: "#fdf6ec",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    this.add
      .text(w / 2, 82, "고양이 · 강아지 · 햄스터와 함께 가꾸는 힐링 도트 낙원", {
        fontFamily: PIXEL_FONT,
        fontSize: "13px",
        color: "#c9bfe0",
      })
      .setOrigin(0.5);

    this.add
      .text(w / 2, 116, "당신의 캐릭터를 선택하세요", {
        fontFamily: PIXEL_FONT,
        fontSize: "15px",
        color: "#ffcf8b",
      })
      .setOrigin(0.5);

    // --- species tabs ---
    const tabW = 140;
    const tabGap = 16;
    const tabTotal = SPECIES_INFO.length * tabW + (SPECIES_INFO.length - 1) * tabGap;
    const tabStartX = w / 2 - tabTotal / 2 + tabW / 2;
    SPECIES_INFO.forEach((info, i) => {
      const cx = tabStartX + i * (tabW + tabGap);
      const cy = 150;
      const tab = this.add
        .rectangle(cx, cy, tabW, 34, 0x241b2e, 0.9)
        .setStrokeStyle(2, 0x3d2314)
        .setInteractive({ useHandCursor: true });
      tab.on("pointerdown", () => this.selectSpecies(info.id));
      this.speciesTabs.push(tab);
      this.add
        .text(cx, cy, `[${i + 1}] ${info.label}`, { fontFamily: PIXEL_FONT, fontSize: "14px", color: "#fdf6ec" })
        .setOrigin(0.5);
    });

    this.breedLayer = this.add.container(0, 0);

    const hasSave = GameState.hasSave();
    const buttonY = 470;
    this.makeButton(hasSave ? w / 2 - 100 : w / 2, buttonY, "게임 시작", () => this.startNewGame());
    if (hasSave) {
      this.makeButton(w / 2 + 100, buttonY, "이어하기", () => this.continueGame());
    }

    this.add
      .text(w / 2, buttonY + 40, "숫자 1~3: 종족 탭   품종은 카드를 눌러 선택   Enter: 새 게임" + (hasSave ? "   C: 이어하기" : ""), {
        fontFamily: PIXEL_FONT,
        fontSize: "11px",
        color: "#786d8a",
        align: "center",
      })
      .setOrigin(0.5);

    this.add
      .text(w / 2, h - 24, "이동: WASD/방향키 (모바일: 화면 버튼)   상호작용: E   도구 선택: 1-4", {
        fontFamily: PIXEL_FONT,
        fontSize: "12px",
        color: "#786d8a",
      })
      .setOrigin(0.5);

    this.selectSpecies("dog");

    this.input.keyboard?.on("keydown", (e: KeyboardEvent) => {
      if (e.key === "1") this.selectSpecies("dog");
      if (e.key === "2") this.selectSpecies("cat");
      if (e.key === "3") this.selectSpecies("hamster");
      if (e.key === "Enter") this.startNewGame();
      if (e.key.toLowerCase() === "c" && GameState.hasSave()) this.continueGame();
    });
  }

  private selectSpecies(species: Species): void {
    this.species = species;
    const idx = SPECIES_INFO.findIndex((s) => s.id === species);
    this.speciesTabs.forEach((t, i) => t.setStrokeStyle(2, i === idx ? 0xffcf8b : 0x3d2314));
    this.buildBreedCards();
  }

  private buildBreedCards(): void {
    this.breedLayer.removeAll(true);
    this.breedCards = [];

    const breeds = breedsForSpecies(this.species);
    const w = this.scale.width;
    const cardW = 160;
    const gap = 20;
    const totalW = breeds.length * cardW + (breeds.length - 1) * gap;
    const startX = w / 2 - totalW / 2 + cardW / 2;
    const cy = 300;

    breeds.forEach((breed, i) => {
      const cx = startX + i * (cardW + gap);
      const card = this.add
        .rectangle(cx, cy, cardW, 190, 0x241b2e, 0.85)
        .setStrokeStyle(3, 0x3d2314)
        .setInteractive({ useHandCursor: true });
      card.on("pointerdown", () => this.selectBreed(breed));
      this.breedCards.push(card);

      const previewKey = `char_${breed.id}_down_0`;
      const preview = this.add.image(cx, cy - 40, previewKey).setScale(fitScale(this, previewKey, PREVIEW_WIDTH));
      const label = this.add
        .text(cx, cy + 44, breed.label, { fontFamily: PIXEL_FONT, fontSize: "15px", color: "#fdf6ec" })
        .setOrigin(0.5);
      const desc = this.add
        .text(cx, cy + 68, breed.desc, {
          fontFamily: PIXEL_FONT,
          fontSize: "10px",
          color: "#a89cad",
          align: "center",
          wordWrap: { width: cardW - 16 },
        })
        .setOrigin(0.5);

      this.breedLayer.add([card, preview, label, desc]);
    });

    this.selectBreed(breeds[0]);
  }

  private selectBreed(breed: BreedDef): void {
    this.breedId = breed.id;
    const breeds = breedsForSpecies(this.species);
    const idx = breeds.findIndex((b) => b.id === breed.id);
    this.breedCards.forEach((c, i) => c.setStrokeStyle(3, i === idx ? 0xffcf8b : 0x3d2314));
  }

  private makeButton(cx: number, cy: number, label: string, onTap: () => void): void {
    const bg = this.add
      .rectangle(cx, cy, 160, 40, 0xff9a4d, 0.95)
      .setStrokeStyle(3, 0x3d2314)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(cx, cy, label, { fontFamily: PIXEL_FONT, fontSize: "16px", color: "#241b2e", fontStyle: "bold" })
      .setOrigin(0.5);
    bg.on("pointerdown", () => {
      bg.setFillStyle(0xd97f36, 0.95);
      onTap();
    });
    bg.on("pointerup", () => bg.setFillStyle(0xff9a4d, 0.95));
  }

  private startNewGame(): void {
    GameState.newGame(this.species, this.breedId);
    this.scene.start("World");
  }

  private continueGame(): void {
    GameState.load();
    this.scene.start("World");
  }
}

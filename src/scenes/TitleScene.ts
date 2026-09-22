import Phaser from "phaser";
import type { Species } from "../gfx/characters";
import { GameState } from "../state/GameState";
import { BREEDS, breedsForSpecies, type BreedDef } from "../data/breeds";
import { fitScaleContain } from "../gfx/registerTextures";
import { PIXEL_FONT } from "../ui/theme";

const PREVIEW_MAX_W = 104;
const PREVIEW_MAX_H = 96;
const SPECIES_GAP = 18;

const SPECIES_INFO: { id: Species; label: string }[] = [
  { id: "dog", label: "강아지" },
  { id: "cat", label: "고양이" },
  { id: "hamster", label: "햄스터" },
];

export class TitleScene extends Phaser.Scene {
  private species: Species = "dog";
  private breedId: string = BREEDS[0].id;
  private speciesLabels: Phaser.GameObjects.Text[] = [];
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

    this.buildSpeciesRow();

    this.breedLayer = this.add.container(0, 0);

    const hasSave = GameState.hasSave();
    const buttonY = 470;
    this.makeButton(hasSave ? w / 2 - 100 : w / 2, buttonY, "게임 시작", () => this.startNewGame());
    if (hasSave) {
      this.makeButton(w / 2 + 100, buttonY, "이어하기", () => this.continueGame());
    }

    this.add
      .text(
        w / 2,
        buttonY + 40,
        "◀ ▶: 품종 선택   ▲ ▼: 종족 전환   Enter: 새 게임" + (hasSave ? "   C: 이어하기" : ""),
        {
          fontFamily: PIXEL_FONT,
          fontSize: "11px",
          color: "#786d8a",
          align: "center",
        },
      )
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
      // Ignore the browser's key-repeat auto-fire on held arrow keys —
      // without this a held press blows straight through every breed
      // card instead of landing on the one the player meant to stop at.
      if (e.repeat && e.key.startsWith("Arrow")) return;
      if (e.key === "1") this.selectSpecies("dog");
      if (e.key === "2") this.selectSpecies("cat");
      if (e.key === "3") this.selectSpecies("hamster");
      if (e.key === "ArrowUp") this.cycleSpecies(-1);
      if (e.key === "ArrowDown") this.cycleSpecies(1);
      if (e.key === "ArrowLeft") this.cycleBreed(-1);
      if (e.key === "ArrowRight") this.cycleBreed(1);
      if (e.key === "Enter") this.startNewGame();
      if (e.key.toLowerCase() === "c" && GameState.hasSave()) this.continueGame();
    });
  }

  /** A plain "강아지 | 고양이 | 햄스터" row — the selected one lights up,
   * separators are inert. Widths are measured after creation so the whole
   * row can be centered regardless of label length. */
  private buildSpeciesRow(): void {
    const w = this.scale.width;
    const cy = 152;
    type Part = { text: string; species?: Species };
    const parts: Part[] = [];
    SPECIES_INFO.forEach((info, i) => {
      parts.push({ text: info.label, species: info.id });
      if (i < SPECIES_INFO.length - 1) parts.push({ text: "|" });
    });

    const texts = parts.map((p) =>
      this.add
        .text(0, cy, p.text, {
          fontFamily: PIXEL_FONT,
          fontSize: p.species ? "20px" : "16px",
          color: p.species ? "#786d8a" : "#4a3f5c",
        })
        .setOrigin(0.5),
    );

    const totalW = texts.reduce((sum, t) => sum + t.width, 0) + SPECIES_GAP * (texts.length - 1);
    let x = w / 2 - totalW / 2;
    this.speciesLabels = [];
    texts.forEach((t, i) => {
      t.x = x + t.width / 2;
      x += t.width + SPECIES_GAP;
      const species = parts[i].species;
      if (species) {
        t.setInteractive({ useHandCursor: true });
        t.on("pointerdown", () => this.selectSpecies(species));
        this.speciesLabels.push(t);
      }
    });
  }

  private cycleSpecies(dir: number): void {
    const idx = SPECIES_INFO.findIndex((s) => s.id === this.species);
    const next = SPECIES_INFO[(idx + dir + SPECIES_INFO.length) % SPECIES_INFO.length];
    this.selectSpecies(next.id);
  }

  private selectSpecies(species: Species): void {
    this.species = species;
    const idx = SPECIES_INFO.findIndex((s) => s.id === species);
    this.speciesLabels.forEach((t, i) => {
      t.setColor(i === idx ? "#ffcf8b" : "#786d8a");
      t.setFontStyle(i === idx ? "bold" : "normal");
    });
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
    const previewCy = cy - 40;

    breeds.forEach((breed, i) => {
      const cx = startX + i * (cardW + gap);
      const card = this.add
        .rectangle(cx, cy, cardW, 190, 0x241b2e, 0.85)
        .setStrokeStyle(3, 0x3d2314)
        .setInteractive({ useHandCursor: true });
      card.on("pointerdown", () => this.selectBreed(breed));
      this.breedCards.push(card);

      // A soft rounded backdrop behind the preview art — the extracted
      // sprites' cutout edges can look a little rough on their own, and a
      // solid backing plate reads as an intentional "podium" instead.
      const backdrop = this.add.graphics();
      backdrop.fillStyle(0x35293f, 0.9);
      backdrop.fillRoundedRect(cx - 66, previewCy - 60, 132, 120, 14);
      backdrop.lineStyle(2, 0x4a3a55, 1);
      backdrop.strokeRoundedRect(cx - 66, previewCy - 60, 132, 120, 14);

      const previewKey = `char_${breed.id}_down_0`;
      const preview = this.add
        .image(cx, previewCy, previewKey)
        .setScale(fitScaleContain(this, previewKey, PREVIEW_MAX_W, PREVIEW_MAX_H));
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

      this.breedLayer.add([card, backdrop, preview, label, desc]);
    });

    this.selectBreed(breeds[0]);
  }

  private selectBreed(breed: BreedDef): void {
    this.breedId = breed.id;
    const breeds = breedsForSpecies(this.species);
    const idx = breeds.findIndex((b) => b.id === breed.id);
    this.breedCards.forEach((c, i) => c.setStrokeStyle(3, i === idx ? 0xffcf8b : 0x3d2314));
  }

  private cycleBreed(dir: number): void {
    const breeds = breedsForSpecies(this.species);
    const idx = breeds.findIndex((b) => b.id === this.breedId);
    const next = breeds[(idx + dir + breeds.length) % breeds.length];
    this.selectBreed(next);
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

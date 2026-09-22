import Phaser from "phaser";
import type { Species } from "../gfx/characters";
import { GameState } from "../state/GameState";
import { BREEDS, breedsForSpecies, type BreedDef } from "../data/breeds";
import { fitScaleContain } from "../gfx/registerTextures";
import { PIXEL_FONT } from "../ui/theme";

const PREVIEW_MAX_W = 150;
const PREVIEW_MAX_H = 140;
const SPECIES_GAP = 18;
const ARROW_OFFSET = 165;

const SPECIES_INFO: { id: Species; label: string }[] = [
  { id: "dog", label: "강아지" },
  { id: "cat", label: "고양이" },
  { id: "hamster", label: "햄스터" },
];

export class TitleScene extends Phaser.Scene {
  private species: Species = "dog";
  private breedId: string = BREEDS[0].id;
  private speciesLabels: Phaser.GameObjects.Text[] = [];
  private breedLayer!: Phaser.GameObjects.Container;
  private breedPreview!: Phaser.GameObjects.Image;
  private breedLabel!: Phaser.GameObjects.Text;
  private breedDesc!: Phaser.GameObjects.Text;
  private breedCounter!: Phaser.GameObjects.Text;

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

  /** One big preview with clickable ◀ ▶ arrows on either side, instead of a
   * row of cards — a row could only ever show as many breeds as fit the
   * screen at once, and needed a keyboard to move between them. This way
   * there's exactly one box, and it never depends on the keyboard. */
  private buildBreedCards(): void {
    this.breedLayer.removeAll(true);

    const w = this.scale.width;
    const cx = w / 2;
    const cy = 300;
    const previewCy = cy - 30;

    const backdrop = this.add.graphics();
    backdrop.fillStyle(0x35293f, 0.9);
    backdrop.fillRoundedRect(cx - 95, previewCy - 85, 190, 170, 16);
    backdrop.lineStyle(2, 0x4a3a55, 1);
    backdrop.strokeRoundedRect(cx - 95, previewCy - 85, 190, 170, 16);

    const firstBreed = breedsForSpecies(this.species)[0];
    this.breedPreview = this.add.image(cx, previewCy, `char_${firstBreed.id}_down_0`);
    this.breedLabel = this.add
      .text(cx, cy + 100, "", { fontFamily: PIXEL_FONT, fontSize: "17px", color: "#fdf6ec" })
      .setOrigin(0.5);
    this.breedDesc = this.add
      .text(cx, cy + 126, "", {
        fontFamily: PIXEL_FONT,
        fontSize: "11px",
        color: "#a89cad",
        align: "center",
        wordWrap: { width: 260 },
      })
      .setOrigin(0.5);
    this.breedCounter = this.add
      .text(cx, previewCy - 100, "", { fontFamily: PIXEL_FONT, fontSize: "11px", color: "#786d8a" })
      .setOrigin(0.5);

    const leftArrow = this.makeArrowButton(cx - ARROW_OFFSET, previewCy, "◀", () => this.cycleBreed(-1));
    const rightArrow = this.makeArrowButton(cx + ARROW_OFFSET, previewCy, "▶", () => this.cycleBreed(1));

    this.breedLayer.add([
      backdrop,
      this.breedPreview,
      this.breedLabel,
      this.breedDesc,
      this.breedCounter,
      leftArrow,
      rightArrow,
    ]);

    this.selectBreed(breedsForSpecies(this.species)[0]);
  }

  private makeArrowButton(cx: number, cy: number, label: string, onTap: () => void): Phaser.GameObjects.Container {
    const bg = this.add
      .circle(0, 0, 26, 0x241b2e, 0.9)
      .setStrokeStyle(2, 0x3d2314)
      .setInteractive({ useHandCursor: true });
    const txt = this.add
      .text(0, 0, label, { fontFamily: PIXEL_FONT, fontSize: "18px", color: "#ffcf8b" })
      .setOrigin(0.5);
    bg.on("pointerdown", () => {
      bg.setFillStyle(0x3d2314, 0.95);
      onTap();
    });
    const reset = () => bg.setFillStyle(0x241b2e, 0.9);
    bg.on("pointerup", reset);
    bg.on("pointerout", reset);
    return this.add.container(cx, cy, [bg, txt]);
  }

  private selectBreed(breed: BreedDef): void {
    this.breedId = breed.id;
    const breeds = breedsForSpecies(this.species);
    const idx = breeds.findIndex((b) => b.id === breed.id);
    const key = `char_${breed.id}_down_0`;
    this.breedPreview.setTexture(key).setScale(fitScaleContain(this, key, PREVIEW_MAX_W, PREVIEW_MAX_H));
    this.breedLabel.setText(breed.label);
    this.breedDesc.setText(breed.desc);
    this.breedCounter.setText(`${idx + 1} / ${breeds.length}`);
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

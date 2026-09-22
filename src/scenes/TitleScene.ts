import Phaser from "phaser";
import type { Species } from "../gfx/characters";
import { GameState } from "../state/GameState";

const SPECIES_INFO: { id: Species; label: string; desc: string }[] = [
  { id: "dog", label: "강아지", desc: "농경에 특화된 성실한 캐릭터" },
  { id: "cat", label: "고양이", desc: "낚시에 능한 여유로운 캐릭터" },
  { id: "hamster", label: "햄스터", desc: "채광에 강한 부지런한 캐릭터" },
];

export class TitleScene extends Phaser.Scene {
  private selected: Species = "dog";
  private boxes: Phaser.GameObjects.Rectangle[] = [];

  constructor() {
    super("Title");
  }

  create(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    this.cameras.main.setBackgroundColor("#1a1625");

    this.add
      .text(w / 2, 70, "포근포근 펫빌리지", {
        fontFamily: "monospace",
        fontSize: "40px",
        color: "#fdf6ec",
        fontStyle: "bold",
      })
      .setOrigin(0.5);
    this.add
      .text(w / 2, 112, "고양이 · 강아지 · 햄스터와 함께 가꾸는 힐링 도트 낙원", {
        fontFamily: "monospace",
        fontSize: "14px",
        color: "#c9bfe0",
      })
      .setOrigin(0.5);

    this.add
      .text(w / 2, 160, "당신의 캐릭터를 선택하세요", {
        fontFamily: "monospace",
        fontSize: "16px",
        color: "#ffcf8b",
      })
      .setOrigin(0.5);

    const boxW = 160;
    const gap = 24;
    const totalW = SPECIES_INFO.length * boxW + (SPECIES_INFO.length - 1) * gap;
    const startX = w / 2 - totalW / 2 + boxW / 2;

    SPECIES_INFO.forEach((info, i) => {
      const cx = startX + i * (boxW + gap);
      const cy = 260;
      const box = this.add
        .rectangle(cx, cy, boxW, 150, 0x241b2e, 0.85)
        .setStrokeStyle(3, 0x3d2314)
        .setInteractive({ useHandCursor: true });
      box.on("pointerdown", () => this.select(info.id));
      this.boxes.push(box);

      this.add.image(cx, cy - 30, `char_${info.id}_down_0`).setScale(2.2);
      this.add
        .text(cx, cy + 32, `[${i + 1}] ${info.label}`, {
          fontFamily: "monospace",
          fontSize: "16px",
          color: "#fdf6ec",
        })
        .setOrigin(0.5);
      this.add
        .text(cx, cy + 56, info.desc, {
          fontFamily: "monospace",
          fontSize: "11px",
          color: "#a89cad",
          align: "center",
          wordWrap: { width: boxW - 16 },
        })
        .setOrigin(0.5);
    });

    const hasSave = GameState.hasSave();
    const buttonY = 400;
    this.makeButton(hasSave ? w / 2 - 100 : w / 2, buttonY, "게임 시작", () => this.startNewGame());
    if (hasSave) {
      this.makeButton(w / 2 + 100, buttonY, "이어하기", () => this.continueGame());
    }

    this.add
      .text(w / 2, buttonY + 46, "숫자 1~3: 종족 선택   Enter: 새 게임" + (hasSave ? "   C: 이어하기" : ""), {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#786d8a",
        align: "center",
      })
      .setOrigin(0.5);

    this.add
      .text(
        w / 2,
        h - 40,
        "이동: WASD/방향키 (모바일: 화면 버튼)   상호작용: E   도구 선택: 1-4",
        { fontFamily: "monospace", fontSize: "12px", color: "#786d8a" }
      )
      .setOrigin(0.5);

    this.select("dog");

    this.input.keyboard?.on("keydown", (e: KeyboardEvent) => {
      if (e.key === "1") this.select("dog");
      if (e.key === "2") this.select("cat");
      if (e.key === "3") this.select("hamster");
      if (e.key === "Enter") this.startNewGame();
      if (e.key.toLowerCase() === "c" && GameState.hasSave()) this.continueGame();
    });
  }

  private makeButton(cx: number, cy: number, label: string, onTap: () => void): void {
    const bg = this.add
      .rectangle(cx, cy, 160, 40, 0xff9a4d, 0.95)
      .setStrokeStyle(3, 0x3d2314)
      .setInteractive({ useHandCursor: true });
    this.add
      .text(cx, cy, label, { fontFamily: "monospace", fontSize: "16px", color: "#241b2e", fontStyle: "bold" })
      .setOrigin(0.5);
    bg.on("pointerdown", () => {
      bg.setFillStyle(0xd97f36, 0.95);
      onTap();
    });
    bg.on("pointerup", () => bg.setFillStyle(0xff9a4d, 0.95));
  }

  private select(species: Species): void {
    this.selected = species;
    const idx = SPECIES_INFO.findIndex((s) => s.id === species);
    this.boxes.forEach((b, i) => b.setStrokeStyle(3, i === idx ? 0xffcf8b : 0x3d2314));
  }

  private startNewGame(): void {
    GameState.newGame(this.selected);
    this.scene.start("World");
  }

  private continueGame(): void {
    GameState.load();
    this.scene.start("World");
  }
}

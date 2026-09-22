import Phaser from "phaser";
import { createTapButton, isTouchDevice } from "../ui/TouchControls";

const WIN_HITS = 3;
const MAX_MISSES = 3;

export class FishingScene extends Phaser.Scene {
  private barX = 0;
  private barY = 0;
  private barW = 300;
  private marker!: Phaser.GameObjects.Image;
  private targetGfx!: Phaser.GameObjects.Rectangle;
  private targetStart = 0;
  private targetW = 60;
  private t = 0;
  private speed = 1.6;
  private hits = 0;
  private misses = 0;
  private hitText!: Phaser.GameObjects.Text;
  private resultText!: Phaser.GameObjects.Text;
  private finished = false;

  constructor() {
    super("Fishing");
  }

  create(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    this.hits = 0;
    this.misses = 0;
    this.t = 0;
    this.speed = 1.6;
    this.finished = false;

    this.add.rectangle(w / 2, h / 2, 480, 260, 0x0e2a33, 0.92).setStrokeStyle(3, 0x3d2314);
    this.add
      .text(w / 2, h / 2 - 100, "고양이 낚시", { fontFamily: "monospace", fontSize: "22px", color: "#fdf6ec" })
      .setOrigin(0.5);
    this.add
      .text(w / 2, h / 2 - 70, "파란 구간에 발바닥이 들어왔을 때 SPACE!", {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#a8d8e8",
      })
      .setOrigin(0.5);

    this.barX = w / 2 - this.barW / 2;
    this.barY = h / 2 + 10;

    this.add.rectangle(this.barX, this.barY, this.barW, 24, 0x1a3b44).setOrigin(0, 0.5).setStrokeStyle(2, 0x3d2314);

    this.spawnTarget();

    this.marker = this.add.image(this.barX, this.barY, "icon_spr_fish_small").setOrigin(0.5).setScale(1.3);

    this.hitText = this.add
      .text(w / 2, h / 2 + 60, "", { fontFamily: "monospace", fontSize: "16px", color: "#fdf6ec" })
      .setOrigin(0.5);
    this.updateHitText();

    this.resultText = this.add
      .text(w / 2, h / 2, "", { fontFamily: "monospace", fontSize: "26px", color: "#ffcf8b", fontStyle: "bold" })
      .setOrigin(0.5)
      .setDepth(10);

    this.add
      .text(w / 2, h / 2 + 100, "[ESC] 포기하고 나가기", { fontFamily: "monospace", fontSize: "12px", color: "#786d8a" })
      .setOrigin(0.5);

    this.input.keyboard!.on("keydown-SPACE", () => this.attempt());
    this.input.keyboard!.on("keydown-ESC", () => this.giveUp());

    if (isTouchDevice(this)) {
      createTapButton(this, w / 2, h / 2 + 140, "당기기!", () => this.attempt(), { radius: 40, fontSize: "16px" });
      createTapButton(this, w - 50, 40, "✕", () => this.giveUp(), { radius: 22, fontSize: "16px" });
    }
  }

  private spawnTarget(): void {
    this.targetW = Phaser.Math.Between(45, 70);
    this.targetStart = Phaser.Math.Between(0, this.barW - this.targetW);
    this.targetGfx?.destroy();
    this.targetGfx = this.add
      .rectangle(this.barX + this.targetStart, this.barY, this.targetW, 24, 0x6ec3e0, 0.55)
      .setOrigin(0, 0.5);
  }

  private updateHitText(): void {
    this.hitText.setText(`성공 ${this.hits}/${WIN_HITS}   실패 ${this.misses}/${MAX_MISSES}`);
  }

  update(_time: number, delta: number): void {
    if (this.finished) return;
    this.t += delta * 0.001 * this.speed;
    const pos = (Math.sin(this.t) + 1) / 2; // 0..1
    this.marker.x = this.barX + pos * this.barW;
  }

  private attempt(): void {
    if (this.finished) return;
    const markerRel = this.marker.x - this.barX;
    const inZone = markerRel >= this.targetStart && markerRel <= this.targetStart + this.targetW;
    if (inZone) {
      this.hits++;
      this.flash(0x7fd06a);
      this.speed += 0.35;
      if (this.hits >= WIN_HITS) return this.finish(true);
      this.spawnTarget();
    } else {
      this.misses++;
      this.flash(0xe0546a);
      if (this.misses >= MAX_MISSES) return this.finish(false);
    }
    this.updateHitText();
  }

  private flash(color: number): void {
    this.cameras.main.flash(120, (color >> 16) & 255, (color >> 8) & 255, color & 255);
  }

  private finish(win: boolean): void {
    this.finished = true;
    if (win) {
      const roll = Math.random();
      const itemId = roll < 0.78 ? "FISH_ANCHOVY" : "FISH_DRIED";
      this.resultText.setText("낚시 성공!");
      this.time.delayedCall(900, () => this.close([{ itemId, qty: 1 }]));
    } else {
      this.resultText.setText("놓쳤어요...");
      this.time.delayedCall(900, () => this.close([]));
    }
  }

  private giveUp(): void {
    if (this.finished) return;
    this.close([]);
  }

  private close(items: { itemId: string; qty: number }[]): void {
    this.scene.get("World").events.emit("minigame-result", { items });
    this.scene.stop();
  }
}

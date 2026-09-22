import Phaser from "phaser";
import { PIXEL_FONT } from "./theme";

export interface ModalOption {
  label: string;
  onSelect: () => void;
}

/** A simple camera-fixed modal panel: title + body lines + numbered options. Esc/close always available. */
export class Modal {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private bg: Phaser.GameObjects.Rectangle;
  private titleText: Phaser.GameObjects.Text;
  private bodyText: Phaser.GameObjects.Text;
  private optionTexts: Phaser.GameObjects.Text[] = [];
  private keyHandler?: (event: KeyboardEvent) => void;
  visible = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const w = 560;
    const h = 280;
    this.container = scene.add.container(0, 0).setScrollFactor(0).setDepth(1000).setVisible(false);
    this.bg = scene.add
      .rectangle(0, 0, w, h, 0x241b2e, 0.95)
      .setStrokeStyle(3, 0x3d2314)
      .setOrigin(0);
    this.titleText = scene.add.text(16, 12, "", {
      fontFamily: PIXEL_FONT,
      fontSize: "18px",
      color: "#ffcf8b",
      fontStyle: "bold",
    });
    this.bodyText = scene.add.text(16, 44, "", {
      fontFamily: PIXEL_FONT,
      fontSize: "14px",
      color: "#fdf6ec",
      wordWrap: { width: w - 32 },
    });
    this.container.add([this.bg, this.titleText, this.bodyText]);
    this.reposition();
    scene.scale.on("resize", () => this.reposition());
  }

  private reposition(): void {
    const cam = this.scene.cameras.main;
    this.container.setPosition(cam.width / 2 - 280, cam.height - 300);
  }

  open(title: string, body: string, options: ModalOption[]): void {
    this.close();
    this.reposition();
    this.titleText.setText(title);
    this.bodyText.setText(body);
    let y = 44 + this.bodyText.height + 12;
    this.optionTexts = options.map((opt, i) => {
      const t = this.scene.add.text(16, y, `[${i + 1}] ${opt.label}`, {
        fontFamily: PIXEL_FONT,
        fontSize: "14px",
        color: "#9be3ff",
      });
      // Wider/taller than the rendered glyphs so it's a comfortable tap target.
      t.setInteractive(new Phaser.Geom.Rectangle(0, -5, 520, 28), Phaser.Geom.Rectangle.Contains);
      t.on("pointerdown", () => {
        this.close();
        opt.onSelect();
      });
      y += 22;
      this.container.add(t);
      return t;
    });
    const closeHint = this.scene.add.text(16, y + 4, "[ESC] 닫기 / 탭하여 닫기", {
      fontFamily: PIXEL_FONT,
      fontSize: "12px",
      color: "#a89cad",
    });
    closeHint.setInteractive(new Phaser.Geom.Rectangle(0, -6, 200, 26), Phaser.Geom.Rectangle.Contains);
    closeHint.on("pointerdown", () => this.close());
    this.container.add(closeHint);
    this.optionTexts.push(closeHint);

    this.container.setVisible(true);
    this.visible = true;

    this.keyHandler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        this.close();
        return;
      }
      const n = parseInt(e.key, 10);
      if (!isNaN(n) && n >= 1 && n <= options.length) {
        const opt = options[n - 1];
        this.close();
        opt.onSelect();
      }
    };
    window.addEventListener("keydown", this.keyHandler);
  }

  close(): void {
    this.container.setVisible(false);
    this.visible = false;
    for (const t of this.optionTexts) t.destroy();
    this.optionTexts = [];
    if (this.keyHandler) {
      window.removeEventListener("keydown", this.keyHandler);
      this.keyHandler = undefined;
    }
  }
}

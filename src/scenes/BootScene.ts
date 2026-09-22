import Phaser from "phaser";
import { registerAllArt } from "../gfx/registerTextures";

export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  create(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    this.add
      .text(w / 2, h / 2, "포근포근 펫빌리지\n도트 그래픽 생성중...", {
        fontFamily: "monospace",
        fontSize: "20px",
        color: "#fdf6ec",
        align: "center",
      })
      .setOrigin(0.5);

    registerAllArt(this);
    this.scene.start("Title");
  }
}

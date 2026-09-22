import Phaser from "phaser";
import { registerAllArt } from "../gfx/registerTextures";
import { IMAGE_BREEDS } from "../gfx/spriteAssets";

const DIRS = ["down", "up", "left", "right"] as const;

export class BootScene extends Phaser.Scene {
  constructor() {
    super("Boot");
  }

  preload(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    this.add
      .text(w / 2, h / 2, "포근포근 펫빌리지\n도트 그래픽 불러오는 중...", {
        fontFamily: "monospace",
        fontSize: "20px",
        color: "#fdf6ec",
        align: "center",
      })
      .setOrigin(0.5);

    for (const [breedId, frames] of Object.entries(IMAGE_BREEDS)) {
      for (const dir of DIRS) {
        frames[dir].forEach((url, i) => {
          if (url) this.load.image(`char_${breedId}_${dir}_${i}`, url);
        });
      }
    }
  }

  create(): void {
    registerAllArt(this);
    this.scene.start("Title");
  }
}

import Phaser from "phaser";
import { registerAllArt } from "../gfx/registerTextures";
import { IMAGE_BREEDS } from "../gfx/spriteAssets";
import { PIXEL_FONT } from "../ui/theme";
import bgPlaza from "../assets/scenes/plaza.webp";
import bgFarm from "../assets/scenes/farm.webp";
import bgHarbor from "../assets/scenes/harbor.webp";
import bgMine from "../assets/scenes/mine.webp";

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
        fontFamily: PIXEL_FONT,
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

    this.load.image("bg_plaza", bgPlaza);
    this.load.image("bg_farm", bgFarm);
    this.load.image("bg_harbor", bgHarbor);
    this.load.image("bg_mine", bgMine);
  }

  create(): void {
    registerAllArt(this);
    this.scene.start("Title");
  }
}

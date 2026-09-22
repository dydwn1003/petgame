import { GameState, MAX_STAGE, type ToolId } from "../state/GameState";
import { PIXEL_FONT } from "./theme";

const STAGE_NAMES = ["", "잡초 우거진 마을", "북적북적 항구", "해바라기 지하터널", "동물들의 유토피아"];

export const TOOLS: { id: ToolId; label: string; icon: string }[] = [
  { id: "hoe", label: "호미", icon: "icon_spr_hoe" },
  { id: "water", label: "물뿌리개", icon: "icon_spr_watering_can" },
  { id: "seed_carrot", label: "뼈당근 씨앗", icon: "icon_spr_seed_bag" },
  { id: "seed_straw", label: "딸기 씨앗", icon: "icon_spr_seed_bag" },
];

export class HUD {
  private scene: Phaser.Scene;
  private topText: Phaser.GameObjects.Text;
  private goldBg: Phaser.GameObjects.Rectangle;
  private goldText: Phaser.GameObjects.Text;
  private staminaBarBg: Phaser.GameObjects.Rectangle;
  private staminaBar: Phaser.GameObjects.Rectangle;
  private hotbarSlots: Phaser.GameObjects.Rectangle[] = [];
  private hotbarIcons: Phaser.GameObjects.Image[] = [];
  private hotbarCounts: Phaser.GameObjects.Text[] = [];
  private hintText: Phaser.GameObjects.Text;
  private toastText: Phaser.GameObjects.Text;
  private toastTimer?: Phaser.Time.TimerEvent;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    const panelStyle = { fontFamily: PIXEL_FONT, fontSize: "14px", color: "#fdf6ec" };

    this.scene.add
      .rectangle(0, 0, 260, 54, 0x241b2e, 0.75)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(900)
      .setPosition(8, 8);
    this.topText = scene.add
      .text(16, 14, "", panelStyle)
      .setScrollFactor(0)
      .setDepth(901);

    this.goldBg = this.scene.add
      .rectangle(0, 0, 140, 34, 0x241b2e, 0.75)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDepth(900);
    this.goldText = scene.add.text(0, 0, "", { fontFamily: PIXEL_FONT, fontSize: "16px", color: "#ffcf8b" }).setScrollFactor(0).setDepth(901);

    this.staminaBarBg = scene.add.rectangle(0, 0, 160, 12, 0x3d2314).setOrigin(0).setScrollFactor(0).setDepth(901);
    this.staminaBar = scene.add.rectangle(0, 0, 160, 12, 0x7fd06a).setOrigin(0).setScrollFactor(0).setDepth(902);

    this.hintText = scene.add
      .text(0, 0, "", { fontFamily: PIXEL_FONT, fontSize: "13px", color: "#fdf6ec", backgroundColor: "#241b2eb0" })
      .setPadding(6, 4, 6, 4)
      .setScrollFactor(0)
      .setDepth(901);

    this.toastText = scene.add
      .text(0, 0, "", { fontFamily: PIXEL_FONT, fontSize: "15px", color: "#fff6e0", backgroundColor: "#241b2ecc" })
      .setPadding(10, 6, 10, 6)
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(950)
      .setVisible(false);

    for (let i = 0; i < TOOLS.length; i++) {
      const slot = scene.add
        .rectangle(0, 0, 44, 44, 0x241b2e, 0.85)
        .setStrokeStyle(2, 0x3d2314)
        .setScrollFactor(0)
        .setDepth(900)
        .setInteractive({ useHandCursor: true });
      slot.on("pointerdown", () => {
        GameState.data.selectedTool = TOOLS[i].id;
      });
      const icon = scene.add.image(0, 0, TOOLS[i].icon).setScale(2).setScrollFactor(0).setDepth(901);
      const count = scene.add
        .text(0, 0, "", { fontFamily: PIXEL_FONT, fontSize: "11px", color: "#fdf6ec" })
        .setScrollFactor(0)
        .setDepth(902);
      this.hotbarSlots.push(slot);
      this.hotbarIcons.push(icon);
      this.hotbarCounts.push(count);
    }

    scene.scale.on("resize", () => this.reposition());
    this.reposition();
  }

  private reposition(): void {
    const cam = this.scene.cameras.main;
    const w = cam.width;
    const h = cam.height;

    this.goldBg.setPosition(w - 148, 8);
    this.goldText.setPosition(w - 128, 16);
    this.staminaBarBg.setPosition(16, 70);
    this.staminaBar.setPosition(16, 70);

    this.hintText.setPosition(w / 2 - this.hintText.width / 2, h - 110);
    this.toastText.setPosition(w / 2, 100);

    const slotSize = 48;
    const totalW = TOOLS.length * slotSize;
    const startX = w / 2 - totalW / 2;
    for (let i = 0; i < TOOLS.length; i++) {
      const cx = startX + i * slotSize + slotSize / 2;
      const cy = h - 40;
      this.hotbarSlots[i].setPosition(cx, cy);
      this.hotbarIcons[i].setPosition(cx, cy);
      this.hotbarCounts[i].setPosition(cx + 8, cy + 8);
    }
  }

  setHint(text: string): void {
    this.hintText.setText(text).setVisible(text.length > 0);
    this.reposition();
  }

  toast(text: string, ms = 1800): void {
    this.toastText.setText(text).setVisible(true);
    this.toastTimer?.remove();
    this.toastTimer = this.scene.time.delayedCall(ms, () => this.toastText.setVisible(false));
    this.reposition();
  }

  update(): void {
    const d = GameState.data;
    this.topText.setText(
      `Day ${d.day}  ${GameState.timeString()}\nStage ${d.stage}/${MAX_STAGE}: ${STAGE_NAMES[d.stage]}`
    );
    this.goldText.setText(`${d.gold} G`);
    const pct = Math.max(0, d.stamina / d.maxStamina);
    this.staminaBar.width = 160 * pct;
    this.staminaBar.fillColor = pct > 0.3 ? 0x7fd06a : 0xe0546a;

    for (let i = 0; i < TOOLS.length; i++) {
      const tool = TOOLS[i];
      const selected = tool.id === GameState.data.selectedTool;
      this.hotbarSlots[i].setStrokeStyle(selected ? 3 : 2, selected ? 0xffcf8b : 0x3d2314);
      let count = "";
      if (tool.id === "seed_carrot") count = String(GameState.itemCount("SEED_BONE_CARROT"));
      if (tool.id === "seed_straw") count = String(GameState.itemCount("SEED_STRAWBERRY"));
      this.hotbarCounts[i].setText(count);
    }
  }
}

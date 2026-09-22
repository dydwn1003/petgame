import Phaser from "phaser";
import { HUD } from "../ui/HUD";
import { Modal } from "../ui/Modal";
import { createDPad, createTapButton, type DPadHandle } from "../ui/TouchControls";

/**
 * Runs in parallel with WorldScene using its own unzoomed camera, so HUD text
 * and modal panels render at a consistent screen size regardless of the
 * world camera's zoom level. Also owns the on-screen touch controls (d-pad +
 * interact button) used by WorldScene.
 */
export class UIScene extends Phaser.Scene {
  hud!: HUD;
  modal!: Modal;
  /** Shared, mutable — WorldScene reads this every frame and merges it with keyboard input. */
  touchDir = { x: 0, y: 0 };
  private dpad?: DPadHandle;

  constructor() {
    super("UI");
  }

  create(): void {
    this.hud = new HUD(this);
    this.modal = new Modal(this);

    // Always on, not just on devices we can positively detect as "touch" —
    // device/OS sniffing (Phaser's isTouchDevice) misses real touch
    // hardware often enough (iPadOS Safari reports as desktop, some
    // embedding contexts don't surface touch capability at all) that
    // gating this left touch users with no way to move at all. A small
    // on-screen d-pad in the corner costs keyboard/mouse players nothing.
    const w = this.scale.width;
    const h = this.scale.height;
    this.dpad = createDPad(this, 100, h - 170);
    this.touchDir = this.dpad.dir;
    createTapButton(this, w - 76, h - 170, "E", () => this.events.emit("touch-interact"), {
      radius: 34,
      fontSize: "18px",
    });
  }

  update(): void {
    this.hud.update();
  }

  setHint(text: string): void {
    this.hud.setHint(text);
  }

  toast(text: string, ms?: number): void {
    this.hud.toast(text, ms);
  }
}

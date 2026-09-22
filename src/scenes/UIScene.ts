import Phaser from "phaser";
import { HUD } from "../ui/HUD";
import { Modal } from "../ui/Modal";

/**
 * Runs in parallel with WorldScene using its own unzoomed camera, so HUD text
 * and modal panels render at a consistent screen size regardless of the
 * world camera's zoom level.
 */
export class UIScene extends Phaser.Scene {
  hud!: HUD;
  modal!: Modal;

  constructor() {
    super("UI");
  }

  create(): void {
    this.hud = new HUD(this);
    this.modal = new Modal(this);
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

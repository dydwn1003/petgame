import Phaser from "phaser";

export function isTouchDevice(scene: Phaser.Scene): boolean {
  const device = scene.sys.game.device;
  return device.input.touch || device.os.android || device.os.iOS;
}

export interface DPadHandle {
  dir: { x: number; y: number };
  destroy(): void;
}

/** A 4-direction on-screen d-pad (no diagonals) fixed to the camera. */
export function createDPad(scene: Phaser.Scene, cx: number, cy: number, depth = 950): DPadHandle {
  const size = 46;
  const gap = 4;
  const dir = { x: 0, y: 0 };
  const objs: Phaser.GameObjects.GameObject[] = [];

  const makeBtn = (dx: number, dy: number, label: string, ox: number, oy: number) => {
    const bg = scene.add
      .rectangle(cx + ox, cy + oy, size, size, 0x241b2e, 0.8)
      .setStrokeStyle(2, 0x3d2314)
      .setScrollFactor(0)
      .setDepth(depth)
      .setInteractive({ useHandCursor: true });
    const txt = scene.add
      .text(cx + ox, cy + oy, label, { fontFamily: "monospace", fontSize: "20px", color: "#fdf6ec" })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(depth + 1);
    const press = () => {
      dir.x = dx;
      dir.y = dy;
      bg.setFillStyle(0x3d2314, 0.9);
    };
    const release = () => {
      if (dir.x === dx && dir.y === dy) {
        dir.x = 0;
        dir.y = 0;
      }
      bg.setFillStyle(0x241b2e, 0.8);
    };
    bg.on("pointerdown", press);
    bg.on("pointerup", release);
    bg.on("pointerout", release);
    bg.on("pointerupoutside", release);
    objs.push(bg, txt);
  };

  makeBtn(0, -1, "▲", 0, -(size + gap));
  makeBtn(0, 1, "▼", 0, size + gap);
  makeBtn(-1, 0, "◀", -(size + gap), 0);
  makeBtn(1, 0, "▶", size + gap, 0);

  return {
    dir,
    destroy() {
      objs.forEach((o) => o.destroy());
    },
  };
}

export interface TapButtonOptions {
  radius?: number;
  fontSize?: string;
  depth?: number;
}

export interface TapButtonHandle {
  destroy(): void;
}

/** A round tap button fixed to the camera; fires onTap on press (not release). */
export function createTapButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  label: string,
  onTap: () => void,
  opts: TapButtonOptions = {}
): TapButtonHandle {
  const radius = opts.radius ?? 32;
  const depth = opts.depth ?? 950;
  const bg = scene.add
    .circle(x, y, radius, 0x241b2e, 0.85)
    .setStrokeStyle(3, 0xffcf8b)
    .setScrollFactor(0)
    .setDepth(depth)
    .setInteractive({ useHandCursor: true });
  const txt = scene.add
    .text(x, y, label, { fontFamily: "monospace", fontSize: opts.fontSize ?? "16px", color: "#fdf6ec" })
    .setOrigin(0.5)
    .setScrollFactor(0)
    .setDepth(depth + 1);
  bg.on("pointerdown", () => {
    bg.setFillStyle(0x3d2314, 0.95);
    onTap();
  });
  const reset = () => bg.setFillStyle(0x241b2e, 0.85);
  bg.on("pointerup", reset);
  bg.on("pointerout", reset);
  return {
    destroy() {
      bg.destroy();
      txt.destroy();
    },
  };
}

import Phaser from "phaser";
import { GameState } from "../state/GameState";
import { getItem } from "../data/items";
import { createTapButton, isTouchDevice } from "../ui/TouchControls";
import { PIXEL_FONT } from "../ui/theme";

const COLS = 7;
const ROWS = 6;
const CELL = 40;
const BUDGET = 16;

interface Cell {
  dug: boolean;
  itemId: string | null; // null = empty/rubble
}

function rollYield(): string | null {
  const r = Math.random();
  if (r < 0.5) return null;
  if (r < 0.82) return "ORE_COPPER";
  if (r < 0.96) return "ORE_GOLD";
  return "GEM_BLUE";
}

export class MiningScene extends Phaser.Scene {
  private grid: Cell[][] = [];
  private cellRects: Phaser.GameObjects.Rectangle[][] = [];
  private cellIcons: (Phaser.GameObjects.Image | null)[][] = [];
  private cursor = { x: Math.floor(COLS / 2), y: 0 };
  private cursorGfx!: Phaser.GameObjects.Rectangle;
  private budget = BUDGET;
  private collected: Record<string, number> = {};
  private originX = 0;
  private originY = 0;
  private infoText!: Phaser.GameObjects.Text;
  private finished = false;
  private closed = false;

  constructor() {
    super("Mining");
  }

  create(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    this.budget = BUDGET;
    this.collected = {};
    this.finished = false;
    this.closed = false;
    this.cursor = { x: Math.floor(COLS / 2), y: 0 };

    this.grid = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => ({ dug: false, itemId: null } as Cell)));
    this.grid[0][this.cursor.x].dug = true;

    const boardW = COLS * CELL;
    const boardH = ROWS * CELL;
    this.originX = w / 2 - boardW / 2;
    this.originY = h / 2 - boardH / 2 + 20;

    this.add.rectangle(w / 2, h / 2, boardW + 40, boardH + 90, 0x241522, 0.94).setStrokeStyle(3, 0x3d2314);
    this.add
      .text(w / 2, this.originY - 46, "햄스터 광산", { fontFamily: PIXEL_FONT, fontSize: "22px", color: "#fdf6ec" })
      .setOrigin(0.5);
    this.add
      .text(w / 2, this.originY - 22, "방향키로 이동, SPACE로 인접한 벽을 채굴하세요", {
        fontFamily: PIXEL_FONT,
        fontSize: "12px",
        color: "#c9bfe0",
      })
      .setOrigin(0.5);

    this.cellRects = [];
    this.cellIcons = [];
    for (let y = 0; y < ROWS; y++) {
      const rowRects: Phaser.GameObjects.Rectangle[] = [];
      const rowIcons: (Phaser.GameObjects.Image | null)[] = [];
      for (let x = 0; x < COLS; x++) {
        const px = this.originX + x * CELL + CELL / 2;
        const py = this.originY + y * CELL + CELL / 2;
        const rect = this.add
          .rectangle(px, py, CELL - 3, CELL - 3, this.grid[y][x].dug ? 0xbdb2b8 : 0x352b3a)
          .setStrokeStyle(1, 0x3d2314);
        rowRects.push(rect);
        rowIcons.push(null);
      }
      this.cellRects.push(rowRects);
      this.cellIcons.push(rowIcons);
    }

    this.cursorGfx = this.add
      .rectangle(0, 0, CELL - 3, CELL - 3, 0, 0)
      .setStrokeStyle(3, 0xffcf8b);
    this.updateCursorGfx();

    this.infoText = this.add
      .text(w / 2, this.originY + boardH + 30, "", { fontFamily: PIXEL_FONT, fontSize: "14px", color: "#fdf6ec" })
      .setOrigin(0.5);
    this.updateInfo();

    this.add
      .text(w / 2, this.originY + boardH + 52, "[ESC] 채굴 종료하고 나가기", {
        fontFamily: PIXEL_FONT,
        fontSize: "12px",
        color: "#786d8a",
      })
      .setOrigin(0.5);

    this.input.keyboard!.on("keydown-UP", () => this.move(0, -1));
    this.input.keyboard!.on("keydown-DOWN", () => this.move(0, 1));
    this.input.keyboard!.on("keydown-LEFT", () => this.move(-1, 0));
    this.input.keyboard!.on("keydown-RIGHT", () => this.move(1, 0));
    this.input.keyboard!.on("keydown-W", () => this.move(0, -1));
    this.input.keyboard!.on("keydown-S", () => this.move(0, 1));
    this.input.keyboard!.on("keydown-A", () => this.move(-1, 0));
    this.input.keyboard!.on("keydown-D", () => this.move(1, 0));
    this.input.keyboard!.on("keydown-ESC", () => this.close());

    if (isTouchDevice(this)) {
      // Placed off to the side of the panel (not below it) so it never runs
      // off the bottom of the screen regardless of board size.
      const bx = w - 140;
      const by = h - 110;
      const s = 40;
      createTapButton(this, bx, by - s, "▲", () => this.move(0, -1), { radius: 18 });
      createTapButton(this, bx, by + s, "▼", () => this.move(0, 1), { radius: 18 });
      createTapButton(this, bx - s, by, "◀", () => this.move(-1, 0), { radius: 18 });
      createTapButton(this, bx + s, by, "▶", () => this.move(1, 0), { radius: 18 });
      createTapButton(this, w - 40, 30, "✕", () => this.close(), { radius: 20 });
    }
  }

  private updateCursorGfx(): void {
    const px = this.originX + this.cursor.x * CELL + CELL / 2;
    const py = this.originY + this.cursor.y * CELL + CELL / 2;
    this.cursorGfx.setPosition(px, py);
  }

  private updateInfo(): void {
    const summary =
      Object.entries(this.collected)
        .map(([id, qty]) => `${getItem(id).name} x${qty}`)
        .join(", ") || "아직 없음";
    this.infoText.setText(`남은 채굴 횟수: ${this.budget}   체력: ${GameState.data.stamina}   획득: ${summary}`);
  }

  private inBounds(x: number, y: number): boolean {
    return x >= 0 && x < COLS && y >= 0 && y < ROWS;
  }

  private move(dx: number, dy: number): void {
    if (this.finished) return;
    const nx = this.cursor.x + dx;
    const ny = this.cursor.y + dy;
    if (!this.inBounds(nx, ny)) return;

    const target = this.grid[ny][nx];
    if (target.dug) {
      this.cursor = { x: nx, y: ny };
      this.updateCursorGfx();
      return;
    }

    // digging into a new cell
    if (this.budget <= 0) {
      this.finish();
      return;
    }
    if (!GameState.spendStamina(2)) {
      this.infoText.setText("체력이 부족해서 더 캘 수 없어요!");
      this.time.delayedCall(1000, () => this.finish());
      return;
    }
    this.budget--;
    target.dug = true;
    target.itemId = rollYield();
    this.cellRects[ny][nx].setFillStyle(0xbdb2b8);
    if (target.itemId) {
      const px = this.originX + nx * CELL + CELL / 2;
      const py = this.originY + ny * CELL + CELL / 2;
      const icon = this.add.image(px, py, `icon_${getItem(target.itemId).sprite_id}`).setScale(1.6);
      this.cellIcons[ny][nx] = icon;
      this.collected[target.itemId] = (this.collected[target.itemId] ?? 0) + 1;
    }
    this.cursor = { x: nx, y: ny };
    this.updateCursorGfx();
    this.updateInfo();

    if (this.budget <= 0) {
      this.time.delayedCall(400, () => this.finish());
    }
  }

  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    this.infoText.setText("채굴 종료! 지상으로 돌아갑니다...");
    this.time.delayedCall(1000, () => this.close());
  }

  private close(): void {
    if (this.closed) return;
    this.closed = true;
    const items = Object.entries(this.collected).map(([itemId, qty]) => ({ itemId, qty }));
    this.scene.get("World").events.emit("minigame-result", { items });
    this.scene.stop();
  }
}

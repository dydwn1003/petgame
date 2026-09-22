import Phaser from "phaser";
import "./fonts.css";
import { PIXEL_FONT } from "./ui/theme";
import { BootScene } from "./scenes/BootScene";
import { TitleScene } from "./scenes/TitleScene";
import { WorldScene } from "./scenes/WorldScene";
import { UIScene } from "./scenes/UIScene";
import { FishingScene } from "./scenes/FishingScene";
import { MiningScene } from "./scenes/MiningScene";
import { GameState } from "./state/GameState";

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: "app",
  width: 960,
  height: 600,
  pixelArt: true,
  backgroundColor: "#1a1625",
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: "arcade",
    arcade: { debug: false },
  },
  scene: [BootScene, TitleScene, WorldScene, UIScene, FishingScene, MiningScene],
};

function boot(): void {
  const game = new Phaser.Game(config);

  const flushSave = () => {
    if (GameState.started) GameState.save();
  };
  window.addEventListener("beforeunload", flushSave);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushSave();
  });

  if (import.meta.env.DEV) {
    (window as unknown as { __game: Phaser.Game; __gameState: typeof GameState }).__game = game;
    (window as unknown as { __game: Phaser.Game; __gameState: typeof GameState }).__gameState = GameState;
  }
}

// Make sure the pixel webfont is actually decoded before Phaser draws any
// text with it — canvas fillText() silently falls back to a system font if
// the requested family isn't ready yet, with no retry once it loads later.
const fontReady = Promise.all([
  document.fonts.load(`400 16px "${PIXEL_FONT}"`),
  document.fonts.load(`700 16px "${PIXEL_FONT}"`),
]).catch(() => undefined);
const timeout = new Promise((resolve) => setTimeout(resolve, 1500));
Promise.race([fontReady, timeout]).then(boot);

import Phaser from "phaser";
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

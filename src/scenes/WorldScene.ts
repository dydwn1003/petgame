import Phaser from "phaser";
import { buildMap, MAP_H, MAP_W, TILE_SIZE, type MapInfo } from "../data/mapData";
import { TILE_KEYS, SOLID_TILES } from "../gfx/tiles";
import { fitScale, spritePrefixFor, tileIndex, TILESET_KEY } from "../gfx/registerTextures";
import { NPCS, type NpcDef } from "../data/npcs";
import { GameState } from "../state/GameState";
import { getItem, ITEMS } from "../data/items";
import { TOOLS } from "../ui/HUD";
import type { ToolId } from "../state/GameState";
import type { UIScene } from "./UIScene";

type Facing = "down" | "up" | "left" | "right";

// Target on-screen width (in world pixels, pre-camera-zoom) for every
// character regardless of their art's native resolution — keeps a 64px
// procedural sprite and a ~130px extracted photo sprite the same size.
const TARGET_CHAR_WIDTH = 13;

const SEED_FOR_TOOL: Partial<Record<ToolId, string>> = {
  seed_carrot: "SEED_BONE_CARROT",
  seed_straw: "SEED_STRAWBERRY",
};
const CROP_FOR_SEED: Record<string, string> = {
  SEED_BONE_CARROT: "CROP_BONE_CARROT",
  SEED_STRAWBERRY: "CROP_STRAWBERRY",
};

export class WorldScene extends Phaser.Scene {
  private map!: MapInfo;
  private layer!: Phaser.Tilemaps.TilemapLayer;
  private player!: Phaser.Physics.Arcade.Sprite;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private npcSprites = new Map<string, Phaser.GameObjects.Sprite>();
  private cropIcons = new Map<string, Phaser.GameObjects.Image>();
  private ui!: UIScene;
  private facing: Facing = "down";
  private mineCooldown = false;
  private sleeping = false;
  private playerBaseScale = 1;
  private walkT = 0;

  constructor() {
    super("World");
  }

  create(): void {
    this.sleeping = false;
    this.map = buildMap();
    this.buildTilemap();
    this.buildPlayer();
    this.buildNpcs();
    this.refreshFarmTiles();

    this.cameras.main.setBounds(0, 0, MAP_W * TILE_SIZE, MAP_H * TILE_SIZE);
    this.cameras.main.startFollow(this.player, true, 0.15, 0.15);
    this.cameras.main.setZoom(2.4);
    this.cameras.main.setRoundPixels(true);

    this.physics.world.setBounds(0, 0, MAP_W * TILE_SIZE, MAP_H * TILE_SIZE);

    this.wasd = this.input.keyboard!.addKeys("W,A,S,D,UP,LEFT,DOWN,RIGHT") as Record<
      string,
      Phaser.Input.Keyboard.Key
    >;
    this.input.keyboard!.on("keydown", (e: KeyboardEvent) => this.onKey(e));
    this.input.keyboard!.on("keydown-SPACE", () => this.tryInteract());

    if (!this.scene.isActive("UI")) this.scene.launch("UI");
    this.ui = this.scene.get("UI") as UIScene;
    this.ui.events.off("touch-interact");
    this.ui.events.on("touch-interact", () => this.tryInteract());

    this.events.on("minigame-result", (payload: { items: { itemId: string; qty: number }[] }) => {
      this.onMinigameResult(payload);
    });
  }

  // ---------------- setup ----------------

  private buildTilemap(): void {
    const data = this.map.tiles.map((row) => row.map((t) => tileIndex(t)));
    const map = this.make.tilemap({ data, tileWidth: TILE_SIZE, tileHeight: TILE_SIZE });
    const tileset = map.addTilesetImage(TILESET_KEY, TILESET_KEY, TILE_SIZE, TILE_SIZE)!;
    const layer = map.createLayer(0, tileset, 0, 0)!;
    const solidIndices = TILE_KEYS.filter((k) => SOLID_TILES.has(k)).map((k) => tileIndex(k));
    layer.setCollision(solidIndices);
    layer.setDepth(0);
    this.layer = layer;
  }

  private buildPlayer(): void {
    const breed = GameState.data.breed;
    const startX = GameState.data.x || this.map.spawn.x * TILE_SIZE;
    const startY = GameState.data.y || this.map.spawn.y * TILE_SIZE;
    const textureKey = `char_${breed}_down_0`;
    const sprite = this.physics.add.sprite(startX, startY, textureKey);
    const scale = fitScale(this, textureKey, TARGET_CHAR_WIDTH);
    sprite.setScale(scale);
    this.playerBaseScale = scale;
    // Body size/offset are in the texture's own unscaled pixel space —
    // Phaser applies the sprite's scale automatically. A modest box near
    // the sprite's feet, since breed art varies in raw resolution/pose.
    const fw = sprite.frame.width;
    const fh = sprite.frame.height;
    sprite.setSize(fw * 0.5, fh * 0.28).setOffset(fw * 0.25, fh * 0.66);
    sprite.setDepth(startY);
    this.player = sprite;
    this.physics.add.collider(this.player, this.layer);
  }

  private buildNpcs(): void {
    for (const npc of NPCS) {
      const x = npc.tileX * TILE_SIZE + TILE_SIZE / 2;
      const y = npc.tileY * TILE_SIZE + TILE_SIZE / 2;
      const prefix = spritePrefixFor(npc.npc_id, npc.breedId);
      const textureKey = `${prefix}_down_0`;
      const sprite = this.add.sprite(x, y, textureKey);
      sprite.setScale(fitScale(this, textureKey, TARGET_CHAR_WIDTH));
      sprite.setDepth(y);
      this.npcSprites.set(npc.npc_id, sprite);
      this.time.addEvent({
        delay: 900,
        loop: true,
        callback: () => {
          const frame = sprite.texture.key.endsWith("_0")
            ? sprite.texture.key.replace(/_0$/, "_1")
            : sprite.texture.key.replace(/_1$/, "_0");
          if (this.textures.exists(frame)) sprite.setTexture(frame);
        },
      });
    }
  }

  // ---------------- farm tile rendering ----------------

  private refreshFarmTiles(): void {
    for (const [key, plot] of Object.entries(GameState.data.farmPlots)) {
      const [txs, tys] = key.split(",");
      const tx = parseInt(txs, 10);
      const ty = parseInt(tys, 10);
      if (!plot.tilled) continue;
      this.layer.putTileAt(tileIndex(plot.watered ? "tilled_wet" : "tilled_dry"), tx, ty);
      this.updateCropIcon(tx, ty, plot);
    }
  }

  private updateCropIcon(tx: number, ty: number, plot: { cropId?: string }): void {
    const key = GameState.plotKey(tx, ty);
    const existing = this.cropIcons.get(key);
    if (!plot.cropId) {
      existing?.destroy();
      this.cropIcons.delete(key);
      return;
    }
    const stage = GameState.cropGrowthStage(GameState.getPlot(tx, ty)!);
    const iconKey =
      stage >= 3
        ? `icon_${getItem(plot.cropId).sprite_id}`
        : stage === 2
          ? "icon_spr_sprout2"
          : stage === 1
            ? "icon_spr_sprout1"
            : "icon_spr_sprout0";
    const px = tx * TILE_SIZE + TILE_SIZE / 2;
    const py = ty * TILE_SIZE + TILE_SIZE / 2;
    if (existing) {
      existing.setTexture(iconKey);
    } else {
      // Fixed low depth (above the ground layer, always below any character)
      // so ripe crops never render on top of the player standing on them.
      const img = this.add.image(px, py, iconKey).setDepth(2);
      this.cropIcons.set(key, img);
    }
  }

  // ---------------- input ----------------

  private onKey(e: KeyboardEvent): void {
    if (this.ui.modal.visible) return;
    if (e.key === "1") GameState.data.selectedTool = "hoe";
    if (e.key === "2") GameState.data.selectedTool = "water";
    if (e.key === "3") GameState.data.selectedTool = "seed_carrot";
    if (e.key === "4") GameState.data.selectedTool = "seed_straw";
    if (e.key.toLowerCase() === "e") this.tryInteract();
  }

  private static readonly GAME_MINUTES_PER_MS = 1080 / (6 * 60 * 1000); // full 06:00-24:00 day in ~6 real minutes

  update(_time: number, delta: number): void {
    if (!this.player.body) return;

    if (this.sleeping) {
      this.player.setVelocity(0, 0);
      this.player.anims.stop();
      return;
    }

    if (!this.ui.modal.visible) {
      GameState.advanceMinutes(delta * WorldScene.GAME_MINUTES_PER_MS);
    }

    if (this.ui.modal.visible) {
      this.player.setVelocity(0, 0);
      this.player.anims.stop();
      return;
    }

    this.handleMovement(delta);
    this.updateHint();
    this.player.setDepth(this.player.y);
    GameState.data.x = this.player.x;
    GameState.data.y = this.player.y;

    if (GameState.isDayOver()) {
      this.forceSleep();
      return;
    }

    this.checkMineEntrance();
  }

  private handleMovement(delta: number): void {
    const speed = 110;
    let vx = 0;
    let vy = 0;
    if (this.wasd.A.isDown || this.wasd.LEFT.isDown) vx -= 1;
    if (this.wasd.D.isDown || this.wasd.RIGHT.isDown) vx += 1;
    if (this.wasd.W.isDown || this.wasd.UP.isDown) vy -= 1;
    if (this.wasd.S.isDown || this.wasd.DOWN.isDown) vy += 1;
    if (vx === 0 && vy === 0) {
      vx = this.ui.touchDir.x;
      vy = this.ui.touchDir.y;
    }

    const moving = vx !== 0 || vy !== 0;
    if (moving) {
      const len = Math.hypot(vx, vy) || 1;
      this.player.setVelocity((vx / len) * speed, (vy / len) * speed);
      if (vx < 0) this.facing = "left";
      else if (vx > 0) this.facing = "right";
      else if (vy < 0) this.facing = "up";
      else if (vy > 0) this.facing = "down";
    } else {
      this.player.setVelocity(0, 0);
    }

    const breed = GameState.data.breed;
    const animKey = `char_${breed}_walk_${this.facing}`;
    if (moving) {
      if (this.player.anims.currentAnim?.key !== animKey) this.player.play(animKey);
      // Cheap squash/stretch "hop" bob so movement reads as walking rather
      // than a static photo sliding around, even where the source art only
      // gave us one or two real frames per direction.
      this.walkT += delta;
      const bob = Math.sin(this.walkT * 0.016);
      this.player.setScale(this.playerBaseScale * (1 - bob * 0.05), this.playerBaseScale * (1 + bob * 0.09));
    } else {
      this.player.anims.stop();
      this.player.setTexture(`char_${breed}_${this.facing}_0`);
      this.walkT = 0;
      this.player.setScale(this.playerBaseScale);
    }
  }

  private targetTile(): { tx: number; ty: number } {
    const tx = Math.floor(this.player.x / TILE_SIZE);
    const ty = Math.floor(this.player.y / TILE_SIZE);
    switch (this.facing) {
      case "left":
        return { tx: tx - 1, ty };
      case "right":
        return { tx: tx + 1, ty };
      case "up":
        return { tx, ty: ty - 1 };
      default:
        return { tx, ty: ty + 1 };
    }
  }

  private updateHint(): void {
    const { tx, ty } = this.targetTile();
    const npc = this.npcAt(tx, ty);
    if (npc) {
      this.ui.setHint(`[E] ${npc.name}와 대화하기`);
      return;
    }
    if (tx === this.map.questBoard.x && ty === this.map.questBoard.y) {
      this.ui.setHint("[E] 게시판 확인하기");
      return;
    }
    if (tx === this.map.shippingBin.x && ty === this.map.shippingBin.y) {
      this.ui.setHint("[E] 출하 상자 열기");
      return;
    }
    if (tx === this.map.bed.x && ty === this.map.bed.y) {
      this.ui.setHint("[E] 잠자리에 들기");
      return;
    }
    if (this.isWater(tx, ty) && this.isNearFishingSpot(tx, ty)) {
      this.ui.setHint("[E] 낚시하기");
      return;
    }
    if (this.inFarmArea(tx, ty)) {
      const plot = GameState.getPlot(tx, ty);
      if (plot?.cropId && GameState.cropGrowthStage(plot) >= 3) {
        this.ui.setHint("[E] 수확하기");
        return;
      }
      const toolLabel = TOOLS.find((t) => t.id === GameState.data.selectedTool)?.label ?? "";
      this.ui.setHint(`[E] ${toolLabel} 사용하기  (1~4: 도구 변경)`);
      return;
    }
    this.ui.setHint("");
  }

  private npcAt(tx: number, ty: number): NpcDef | undefined {
    return NPCS.find((n) => Math.abs(n.tileX - tx) <= 0 && Math.abs(n.tileY - ty) <= 0);
  }

  private isWater(tx: number, ty: number): boolean {
    return this.map.tiles[ty]?.[tx] === "water";
  }

  private isNearFishingSpot(tx: number, ty: number): boolean {
    return this.map.fishingSpots.some((f) => Math.abs(f.x - tx) <= 1 && Math.abs(f.y - ty) <= 1);
  }

  private inFarmArea(tx: number, ty: number): boolean {
    const f = this.map.farmArea;
    return tx >= f.x0 && tx <= f.x1 && ty >= f.y0 && ty <= f.y1;
  }

  // ---------------- interaction ----------------

  private tryInteract(): void {
    if (this.ui.modal.visible || this.sleeping) return;
    const { tx, ty } = this.targetTile();

    const npc = this.npcAt(tx, ty);
    if (npc) return this.openNpcDialogue(npc);

    if (tx === this.map.questBoard.x && ty === this.map.questBoard.y) return this.openQuestBoard();
    if (tx === this.map.shippingBin.x && ty === this.map.shippingBin.y) return this.openShippingBin();
    if (tx === this.map.bed.x && ty === this.map.bed.y) return this.openSleepConfirm();

    if (this.isWater(tx, ty) && this.isNearFishingSpot(tx, ty)) return this.startFishing();

    if (this.inFarmArea(tx, ty)) return this.useFarmTool(tx, ty);
  }

  private useFarmTool(tx: number, ty: number): void {
    const plot = GameState.getPlot(tx, ty);
    if (plot?.cropId && GameState.cropGrowthStage(plot) >= 3) {
      const cropId = GameState.harvestPlot(tx, ty);
      if (cropId) {
        this.updateCropIcon(tx, ty, GameState.getPlot(tx, ty) ?? {});
        this.ui.toast(`+1 ${getItem(cropId).name}`);
      }
      return;
    }

    const groundTile = this.map.tiles[ty][tx];
    const tool = GameState.data.selectedTool;

    if (tool === "hoe") {
      if (plot?.tilled) return this.ui.toast("이미 갈아둔 밭이에요");
      if (groundTile !== "dirt") return;
      if (!GameState.spendStamina(5)) return this.ui.toast("체력이 부족해요");
      GameState.tillPlot(tx, ty);
      this.layer.putTileAt(tileIndex("tilled_dry"), tx, ty);
      this.ui.toast("밭을 갈았어요");
      return;
    }

    if (tool === "water") {
      if (!plot?.tilled) return this.ui.toast("먼저 밭을 갈아야 해요");
      if (plot.watered) return this.ui.toast("이미 물을 줬어요");
      if (!GameState.spendStamina(3)) return this.ui.toast("체력이 부족해요");
      GameState.waterPlot(tx, ty);
      this.layer.putTileAt(tileIndex("tilled_wet"), tx, ty);
      this.ui.toast("물을 주었어요");
      return;
    }

    const seedId = SEED_FOR_TOOL[tool];
    if (seedId) {
      if (!plot?.tilled) return this.ui.toast("먼저 밭을 갈아야 해요");
      if (plot.cropId) return this.ui.toast("이미 심어져 있어요");
      if (GameState.itemCount(seedId) <= 0) return this.ui.toast("씨앗이 없어요");
      if (!GameState.spendStamina(2)) return this.ui.toast("체력이 부족해요");
      GameState.removeItem(seedId, 1);
      GameState.plantSeed(tx, ty, CROP_FOR_SEED[seedId]);
      this.updateCropIcon(tx, ty, GameState.getPlot(tx, ty)!);
      this.ui.toast(`${getItem(seedId).name} 심었어요`);
    }
  }

  private openNpcDialogue(npc: NpcDef): void {
    const line = Phaser.Utils.Array.GetRandom(npc.dialogue);
    const affinity = GameState.affinity(npc.npc_id);
    this.ui.modal.open(npc.name, `${npc.role}\n호감도: ${affinity}\n\n"${line}"`, [
      { label: "선물 주기", onSelect: () => this.openGiftMenu(npc) },
    ]);
  }

  private openGiftMenu(npc: NpcDef): void {
    const entries = Object.entries(GameState.data.inventory).filter(([, qty]) => qty > 0);
    if (entries.length === 0) {
      this.ui.modal.open(npc.name, "선물할 아이템이 없어요.", []);
      return;
    }
    const options = entries.slice(0, 9).map(([itemId]) => {
      const def = getItem(itemId);
      return {
        label: `${def.name} x${GameState.itemCount(itemId)}`,
        onSelect: () => {
          const loved = npc.lovedGifts.includes(itemId);
          const liked = npc.likedGifts.includes(itemId);
          GameState.removeItem(itemId, 1);
          const gain = GameState.giveGift(npc.npc_id, itemId, loved, liked);
          if (gain < 0) {
            GameState.addItem(itemId, 1);
            this.ui.toast("오늘은 이미 선물을 줬어요");
          } else {
            const reaction = loved ? "정말 좋아해요! 💕" : liked ? "마음에 들어해요!" : "고마워하네요.";
            this.ui.toast(`${npc.name}: ${reaction} (+${gain} 호감도)`);
          }
        },
      };
    });
    this.ui.modal.open(npc.name, "무엇을 선물할까요?", options);
  }

  private openQuestBoard(): void {
    const quests = GameState.availableQuests();
    if (quests.length === 0) {
      this.ui.modal.open("게시판", "지금은 새로운 의뢰가 없어요.", []);
      return;
    }
    const options = quests.slice(0, 9).map((q) => {
      const have = GameState.itemCount(q.required_item);
      const ready = GameState.canTurnIn(q.quest_id);
      const itemName = getItem(q.required_item).name;
      return {
        label: `${q.title} (${itemName} ${have}/${q.required_amount}) ${ready ? "[완료 가능]" : ""} - 보상 ${q.reward_gold}G`,
        onSelect: () => {
          if (GameState.turnInQuest(q.quest_id)) {
            this.ui.toast(`퀘스트 완료! +${q.reward_gold}G`);
          } else {
            this.ui.toast("아직 아이템이 부족해요");
          }
        },
      };
    });
    const body = quests.map((q) => q.flavor).slice(0, 3).join("\n");
    this.ui.modal.open("마을 게시판", body, options);
  }

  private openShippingBin(): void {
    const sellable = Object.entries(GameState.data.inventory).filter(([id, qty]) => {
      const cat = ITEMS[id]?.category;
      return qty > 0 && (cat === "Crop" || cat === "Fish" || cat === "Ore" || cat === "Gift");
    });
    if (sellable.length === 0) {
      this.ui.modal.open("출하 상자", "출하할 아이템이 없어요.\n(씨앗은 출하할 수 없어요)", []);
      return;
    }
    const options = sellable.slice(0, 9).map(([itemId, qty]) => {
      const def = getItem(itemId);
      return {
        label: `${def.name} x${qty}  (개당 ${def.sell_price}G)`,
        onSelect: () => {
          GameState.shipItem(itemId, qty);
          this.ui.toast(`${def.name} ${qty}개를 출하 상자에 넣었어요`);
        },
      };
    });
    this.ui.modal.open("출하 상자", "다음날 아침 정산됩니다. 무엇을 출하할까요?", options);
  }

  private openSleepConfirm(): void {
    this.ui.modal.open("취침", "오늘 하루를 마치고 잠자리에 들까요?", [
      { label: "잠자기", onSelect: () => this.sleepNow() },
    ]);
  }

  private forceSleep(): void {
    if (this.sleeping) return;
    this.ui.modal.close();
    this.ui.toast("지쳐서 잠들어버렸어요...", 2200);
    this.sleepNow();
  }

  private sleepNow(): void {
    this.sleeping = true;
    this.player.setVelocity(0, 0);
    this.cameras.main.fadeOut(500, 20, 15, 25);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      const earned = GameState.sleepAndAdvance();
      this.player.setPosition(this.map.spawn.x * TILE_SIZE, this.map.spawn.y * TILE_SIZE);
      GameState.data.x = this.player.x;
      GameState.data.y = this.player.y;
      this.refreshFarmTiles();
      GameState.save();
      this.cameras.main.fadeIn(500, 20, 15, 25);
      this.ui.toast(`좋은 아침이에요! 정산 수익: +${earned}G`, 2500);
      this.sleeping = false;
    });
  }

  private startFishing(): void {
    if (!GameState.spendStamina(4)) {
      this.ui.toast("체력이 부족해요");
      return;
    }
    GameState.save();
    this.input.keyboard!.enabled = false;
    this.scene.pause();
    this.scene.launch("Fishing");
  }

  private checkMineEntrance(): void {
    const tx = Math.floor(this.player.x / TILE_SIZE);
    const ty = Math.floor(this.player.y / TILE_SIZE);
    const inside = tx === this.map.mineEntrance.x && ty === this.map.mineEntrance.y;
    if (inside && !this.mineCooldown) {
      this.mineCooldown = true;
      GameState.save();
      this.input.keyboard!.enabled = false;
      this.scene.pause();
      this.scene.launch("Mining");
    }
    if (!inside) this.mineCooldown = false;
  }

  private onMinigameResult(payload: { items: { itemId: string; qty: number }[] }): void {
    for (const it of payload.items) GameState.addItem(it.itemId, it.qty);
    this.input.keyboard!.enabled = true;
    this.scene.resume();
    const summary = payload.items.map((it) => `+${it.qty} ${getItem(it.itemId).name}`).join(", ");
    this.ui.toast(summary.length > 0 ? summary : "이번엔 빈손이에요...");
    GameState.save();
  }
}

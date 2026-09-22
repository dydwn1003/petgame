import Phaser from "phaser";
import { ROOMS, type RoomDef, type ZoneId } from "../data/rooms";
import { fitScaleByHeight, spritePrefixFor } from "../gfx/registerTextures";
import { NPCS, type NpcDef } from "../data/npcs";
import { GameState } from "../state/GameState";
import { getBreed } from "../data/breeds";
import { getItem, ITEMS } from "../data/items";
import { TOOLS } from "../ui/HUD";
import type { ToolId } from "../state/GameState";
import type { UIScene } from "./UIScene";

type Facing = "down" | "up" | "left" | "right";

// A character's on-screen height (in world pixels, pre-camera-zoom) comes
// from its breed's real-world height (data/breeds.ts), compressed with a
// square root so the spread between the biggest dog and the smallest
// hamster reads clearly without shrinking anything to an unreadable speck
// (a literal linear cm ratio made hamsters nearly invisible). jindo (the
// biggest breed) keeps its long-tuned ~33px reference size; every other
// breed is sized relative to that. The result is then scaled by the room's
// worldScale so it stays visually consistent now that every background is
// normalized to the same implied real-world scale (see data/rooms.ts).
const REFERENCE_BREED_ID = "jindo";
const REFERENCE_HEIGHT_PX = 42;
const MIN_CHAR_HEIGHT_PX = 17;
const INTERACT_RADIUS = 34;

function charTargetHeightPx(room: RoomDef, breedId: string): number {
  const refCm = getBreed(REFERENCE_BREED_ID).heightCm;
  const ratio = Math.sqrt(getBreed(breedId).heightCm / refCm);
  return Math.max(MIN_CHAR_HEIGHT_PX, REFERENCE_HEIGHT_PX * ratio) * room.worldScale;
}

const SEED_FOR_TOOL: Partial<Record<ToolId, string>> = {
  seed_carrot: "SEED_BONE_CARROT",
  seed_straw: "SEED_STRAWBERRY",
};
const CROP_FOR_SEED: Record<string, string> = {
  SEED_BONE_CARROT: "CROP_BONE_CARROT",
  SEED_STRAWBERRY: "CROP_STRAWBERRY",
};

interface EnterPayload {
  zone?: ZoneId;
  spawn?: { x: number; y: number };
}

export class WorldScene extends Phaser.Scene {
  private room!: RoomDef;
  private player!: Phaser.Physics.Arcade.Sprite;
  private wasd!: Record<string, Phaser.Input.Keyboard.Key>;
  private npcSprites = new Map<string, Phaser.GameObjects.Sprite>();
  private cropIcons = new Map<string, Phaser.GameObjects.Image>();
  private ui!: UIScene;
  private facing: Facing = "down";
  private mineCooldown = false;
  private sleeping = false;
  private transitioning = false;
  private playerBaseScale = 1;
  private playerTargetHeightPx = 1;
  private walkT = 0;
  private propColliders: Phaser.GameObjects.Rectangle[] = [];

  constructor() {
    super("World");
  }

  init(data: EnterPayload): void {
    const zone = data?.zone ?? GameState.data.zone ?? "plaza";
    this.room = ROOMS[zone];
    GameState.data.zone = zone;
    if (data?.spawn) {
      GameState.data.x = data.spawn.x;
      GameState.data.y = data.spawn.y;
    }
  }

  create(): void {
    this.sleeping = false;
    this.transitioning = false;
    this.buildBackground();
    this.buildSolids();
    this.buildPlayer();
    this.physics.add.collider(this.player, this.propColliders);
    this.buildNpcs();
    this.refreshFarmTiles();

    this.cameras.main.setBounds(0, 0, this.room.w, this.room.h);
    this.cameras.main.startFollow(this.player, true, 0.15, 0.15);
    this.cameras.main.setZoom(1.0);
    this.cameras.main.setRoundPixels(true);
    this.cameras.main.fadeIn(300, 20, 15, 25);

    this.physics.world.setBounds(0, 0, this.room.w, this.room.h);

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

  private buildBackground(): void {
    this.add.image(0, 0, this.room.bg).setOrigin(0, 0).setDepth(-1000);
  }

  private buildSolids(): void {
    this.propColliders = [];
    for (const r of this.room.solids) {
      const rect = this.add.rectangle(r.x + r.w / 2, r.y + r.h / 2, r.w, r.h);
      rect.setVisible(false);
      this.physics.add.existing(rect, true);
      this.propColliders.push(rect);
    }
  }

  private buildPlayer(): void {
    const breed = GameState.data.breed;
    const startX = GameState.data.x || this.room.defaultSpawn.x;
    const startY = GameState.data.y || this.room.defaultSpawn.y;
    const textureKey = `char_${breed}_down_0`;
    const sprite = this.physics.add.sprite(startX, startY, textureKey);
    this.playerTargetHeightPx = charTargetHeightPx(this.room, breed);
    const scale = fitScaleByHeight(this, textureKey, this.playerTargetHeightPx);
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
  }

  private buildNpcs(): void {
    this.npcSprites.clear();
    for (const npc of NPCS) {
      if (!this.room.npcIds.includes(npc.npc_id)) continue;
      const x = npc.tileX;
      const y = npc.tileY;
      const prefix = spritePrefixFor(npc.npc_id, npc.breedId);
      const textureKey = `${prefix}_down_0`;
      const sprite = this.add.sprite(x, y, textureKey);
      sprite.setScale(fitScaleByHeight(this, textureKey, charTargetHeightPx(this.room, npc.breedId)));
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

  private plotWorldPos(col: number, row: number): { x: number; y: number } {
    const g = this.room.farmGrid!;
    return { x: g.x0 + col * g.cell + g.cell / 2, y: g.y0 + row * g.cell + g.cell / 2 };
  }

  private refreshFarmTiles(): void {
    if (!this.room.farmGrid) return;
    for (const [key, plot] of Object.entries(GameState.data.farmPlots)) {
      const [txs, tys] = key.split(",");
      const tx = parseInt(txs, 10);
      const ty = parseInt(tys, 10);
      if (!plot.tilled) continue;
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
    const { x: px, y: py } = this.plotWorldPos(tx, ty);
    if (existing) {
      existing.setTexture(iconKey);
    } else {
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
    if (!this.player.body || this.transitioning) return;

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

    this.checkPortals();
    this.checkMineEntrance();
  }

  private handleMovement(delta: number): void {
    const speed = 110 * this.room.worldScale;
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
    const prevFacing = this.facing;
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
    if (this.facing !== prevFacing) {
      // A side-view pose's native image has a very different aspect ratio
      // from a front/back pose, so the scale factor (derived from height)
      // has to be recomputed per facing — otherwise the character's
      // apparent height would jump around depending which way it faces.
      this.playerBaseScale = fitScaleByHeight(this, `char_${breed}_${this.facing}_0`, this.playerTargetHeightPx);
    }
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

  private dist(x: number, y: number): number {
    return Phaser.Math.Distance.Between(this.player.x, this.player.y, x, y);
  }

  private interactRadius(): number {
    return INTERACT_RADIUS * this.room.worldScale;
  }

  private nearestFarmPlot(): { col: number; row: number } | null {
    const g = this.room.farmGrid;
    if (!g) return null;
    const col = Math.floor((this.player.x - g.x0) / g.cell);
    const row = Math.floor((this.player.y - g.y0) / g.cell);
    if (col < 0 || col >= g.cols || row < 0 || row >= g.rows) return null;
    const { x, y } = this.plotWorldPos(col, row);
    if (this.dist(x, y) > g.cell * 0.9) return null;
    return { col, row };
  }

  private nearestNpc(): NpcDef | undefined {
    let best: NpcDef | undefined;
    let bestDist = this.interactRadius();
    for (const npc of NPCS) {
      if (!this.room.npcIds.includes(npc.npc_id)) continue;
      const d = this.dist(npc.tileX, npc.tileY);
      if (d < bestDist) {
        bestDist = d;
        best = npc;
      }
    }
    return best;
  }

  private nearFishingSpot(): boolean {
    return (this.room.fishingSpots ?? []).some((f) => this.dist(f.x, f.y) < this.interactRadius());
  }

  private updateHint(): void {
    const npc = this.nearestNpc();
    if (npc) {
      this.ui.setHint(`[E] ${npc.name}와 대화하기`);
      return;
    }
    if (this.room.questBoard && this.dist(this.room.questBoard.x, this.room.questBoard.y) < this.interactRadius()) {
      this.ui.setHint("[E] 게시판 확인하기");
      return;
    }
    if (this.room.shippingBin && this.dist(this.room.shippingBin.x, this.room.shippingBin.y) < this.interactRadius()) {
      this.ui.setHint("[E] 출하 상자 열기");
      return;
    }
    if (this.room.bed && this.dist(this.room.bed.x, this.room.bed.y) < this.interactRadius()) {
      this.ui.setHint("[E] 잠자리에 들기");
      return;
    }
    if (this.nearFishingSpot()) {
      this.ui.setHint("[E] 낚시하기");
      return;
    }
    const plot = this.nearestFarmPlot();
    if (plot) {
      const state = GameState.getPlot(plot.col, plot.row);
      if (state?.cropId && GameState.cropGrowthStage(state) >= 3) {
        this.ui.setHint("[E] 수확하기");
        return;
      }
      const toolLabel = TOOLS.find((t) => t.id === GameState.data.selectedTool)?.label ?? "";
      this.ui.setHint(`[E] ${toolLabel} 사용하기  (1~4: 도구 변경)`);
      return;
    }
    this.ui.setHint("");
  }

  // ---------------- interaction ----------------

  private tryInteract(): void {
    if (this.ui.modal.visible || this.sleeping) return;

    const npc = this.nearestNpc();
    if (npc) return this.openNpcDialogue(npc);

    if (this.room.questBoard && this.dist(this.room.questBoard.x, this.room.questBoard.y) < this.interactRadius()) {
      return this.openQuestBoard();
    }
    if (this.room.shippingBin && this.dist(this.room.shippingBin.x, this.room.shippingBin.y) < this.interactRadius()) {
      return this.openShippingBin();
    }
    if (this.room.bed && this.dist(this.room.bed.x, this.room.bed.y) < this.interactRadius()) {
      return this.openSleepConfirm();
    }
    if (this.nearFishingSpot()) return this.startFishing();

    const plot = this.nearestFarmPlot();
    if (plot) return this.useFarmTool(plot.col, plot.row);
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

    const tool = GameState.data.selectedTool;

    if (tool === "hoe") {
      if (plot?.tilled) return this.ui.toast("이미 갈아둔 밭이에요");
      if (!GameState.spendStamina(5)) return this.ui.toast("체력이 부족해요");
      GameState.tillPlot(tx, ty);
      this.ui.toast("밭을 갈았어요");
      return;
    }

    if (tool === "water") {
      if (!plot?.tilled) return this.ui.toast("먼저 밭을 갈아야 해요");
      if (plot.watered) return this.ui.toast("이미 물을 줬어요");
      if (!GameState.spendStamina(3)) return this.ui.toast("체력이 부족해요");
      GameState.waterPlot(tx, ty);
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
      GameState.data.zone = "plaza";
      GameState.data.x = ROOMS.plaza.defaultSpawn.x;
      GameState.data.y = ROOMS.plaza.defaultSpawn.y;
      GameState.save();
      this.ui.toast(`좋은 아침이에요! 정산 수익: +${earned}G`, 2500);
      this.sleeping = false;
      this.transitioning = true;
      this.scene.restart({ zone: "plaza" } as EnterPayload);
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

  private checkPortals(): void {
    if (this.transitioning) return;
    for (const portal of this.room.portals) {
      const { rect } = portal;
      if (
        this.player.x >= rect.x &&
        this.player.x <= rect.x + rect.w &&
        this.player.y >= rect.y &&
        this.player.y <= rect.y + rect.h
      ) {
        this.transitioning = true;
        GameState.data.zone = portal.to;
        GameState.data.x = portal.spawn.x;
        GameState.data.y = portal.spawn.y;
        GameState.save();
        this.cameras.main.fadeOut(250, 20, 15, 25);
        this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
          this.scene.restart({ zone: portal.to, spawn: portal.spawn } as EnterPayload);
        });
        return;
      }
    }
  }

  private checkMineEntrance(): void {
    const entrance = this.room.mineEntrance;
    if (!entrance) return;
    const inside = this.dist(entrance.x, entrance.y) < this.interactRadius();
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

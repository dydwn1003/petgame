import "../fonts.css";
import "./style.css";
import {
  MAX_LEVEL,
  SWORD_NAMES,
  WORK_GOLD,
  canEnhance,
  enhance,
  freshSave,
  levelInfo,
  protectCost,
  sell,
  totalCost,
  type EnhanceResult,
  type SaveData,
} from "./game";

const SAVE_KEY = "sword_enhance_save_v1";

function load(): SaveData {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (raw) return { ...freshSave(), ...JSON.parse(raw) };
  } catch {
    /* 저장소를 못 쓰면 새로 시작 */
  }
  return freshSave();
}

function save(): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    /* 무시 */
  }
}

let state = load();
let busy = false;

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const el = {
  gold: $("gold"),
  best: $("best"),
  stage: $("stage"),
  level: $("level"),
  swordWrap: $("swordWrap"),
  name: $("name"),
  toast: $("toast"),
  rate: $("rate"),
  cost: $("cost"),
  failRule: $("failRule"),
  sellPrice: $("sellPrice"),
  protectRow: $("protectRow"),
  protect: $<HTMLInputElement>("protect"),
  protectCost: $("protectCost"),
  enhanceBtn: $<HTMLButtonElement>("enhanceBtn"),
  sellBtn: $<HTMLButtonElement>("sellBtn"),
  workBtn: $<HTMLButtonElement>("workBtn"),
  log: $("log"),
  tries: $("tries"),
  destroyed: $("destroyed"),
  sold: $("sold"),
  resetBtn: $<HTMLButtonElement>("resetBtn"),
};

const fmt = (n: number) => n.toLocaleString("ko-KR");

// ── 검 그림 ───────────────────────────────────────────────
interface Tier {
  blade: string;
  edge: string;
  guard: string;
  glow: string;
}

function tierFor(lv: number): Tier {
  if (lv === 0) return { blade: "#8b5a2b", edge: "#a8743d", guard: "#6b4422", glow: "#9aa4b5" };
  if (lv <= 2) return { blade: "#9a6f5c", edge: "#b88f78", guard: "#6e5446", glow: "#b0a59a" };
  if (lv <= 4) return { blade: "#c4cad3", edge: "#eef1f5", guard: "#7d8592", glow: "#d6dce6" };
  if (lv <= 6) return { blade: "#7fa8f0", edge: "#c8dcff", guard: "#c9a24a", glow: "#7fb0ff" };
  if (lv <= 8) return { blade: "#9fe0ff", edge: "#e8f8ff", guard: "#8fa8c8", glow: "#9fe7ff" };
  if (lv <= 10) return { blade: "#ff7a3d", edge: "#ffd08a", guard: "#8a2b1a", glow: "#ff8a4d" };
  if (lv <= 12) return { blade: "#46c97c", edge: "#b6ffd2", guard: "#2d5e44", glow: "#59e38f" };
  if (lv <= 14) return { blade: "#8a5cff", edge: "#d8c8ff", guard: "#3a2266", glow: "#a77bff" };
  if (lv <= 16) return { blade: "#ffc93d", edge: "#fff3c4", guard: "#b5651d", glow: "#ffd166" };
  if (lv <= 18) return { blade: "#ff3d8b", edge: "#ffc2dc", guard: "#4a1030", glow: "#ff4f9a" };
  return { blade: "#ffffff", edge: "#c8f4ff", guard: "#ffd166", glow: "#fff4b0" };
}

function swordSvg(lv: number): string {
  const t = tierFor(lv);
  const px = (x: number, y: number, w: number, h: number, c: string) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`;
  const parts: string[] = [];
  if (lv === 0) {
    // 나뭇가지
    parts.push(px(9, 4, 2, 44, t.blade), px(8, 10, 1, 6, t.blade), px(11, 22, 2, 1, t.edge), px(12, 20, 1, 2, t.blade));
    parts.push(px(10, 4, 1, 44, t.edge));
  } else {
    // 칼날
    parts.push(px(9, 2, 2, 1, t.edge));
    parts.push(px(8, 3, 4, 33, t.blade));
    parts.push(px(9, 3, 1, 33, t.edge));
    // 가드
    const gw = lv >= 10 ? 16 : 12;
    parts.push(px(10 - gw / 2, 36, gw, 3, t.guard));
    if (lv >= 10) parts.push(px(9, 36, 2, 3, t.glow));
    // 손잡이
    parts.push(px(9, 39, 2, 8, "#4a3326"), px(9, 41, 2, 1, "#2e1f17"), px(9, 44, 2, 1, "#2e1f17"));
    // 폼멜
    parts.push(px(8, 47, 4, 3, t.guard));
    if (lv >= 15) parts.push(px(9, 48, 2, 1, t.glow));
  }
  // 반짝이
  const sparkles = Math.min(6, Math.floor(lv / 3));
  for (let i = 0; i < sparkles; i++) {
    const sx = [3, 15, 2, 16, 4, 14][i];
    const sy = [8, 14, 24, 28, 40, 4][i];
    parts.push(px(sx, sy, 1, 1, t.glow));
  }
  return `<svg viewBox="0 0 20 52" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg">${parts.join("")}</svg>`;
}

// ── 화면 갱신 ─────────────────────────────────────────────
const FAIL_TEXT = { stay: "유지", down: "-1 하락", risk: "하락/파괴" } as const;

function render(): void {
  const lv = state.level;
  const info = levelInfo(lv);
  const tier = tierFor(lv);
  const maxed = lv >= MAX_LEVEL;

  el.gold.textContent = fmt(state.gold);
  el.best.textContent = `+${state.best}`;
  el.level.textContent = `+${lv}`;
  el.name.textContent = SWORD_NAMES[lv];
  el.swordWrap.innerHTML = swordSvg(lv);
  el.stage.style.setProperty("--glow", tier.glow);
  el.stage.style.setProperty("--glow-size", `${Math.min(18, lv)}px`);

  el.rate.textContent = maxed ? "-" : `${Math.round(info.rate * 100)}%`;
  el.cost.textContent = maxed ? "-" : `${fmt(info.cost)} G`;
  el.failRule.textContent = maxed
    ? "-"
    : info.fail === "risk"
      ? `파괴 ${Math.round(info.destroyChance * 100)}%`
      : FAIL_TEXT[info.fail];
  el.sellPrice.textContent = `${fmt(info.sell)} G`;

  const canProtect = info.fail === "risk" && !maxed;
  el.protectRow.classList.toggle("disabled", !canProtect);
  el.protect.disabled = !canProtect;
  el.protect.checked = state.protect;
  el.protectCost.textContent = fmt(protectCost(lv));

  el.enhanceBtn.disabled = busy || !canEnhance(state);
  el.enhanceBtn.textContent = maxed ? "🏆 최대 강화!" : `⚒️ 강화하기 (${fmt(totalCost(state))} G)`;
  el.sellBtn.disabled = busy || lv === 0;
  el.workBtn.disabled = busy;

  el.tries.textContent = fmt(state.tries);
  el.destroyed.textContent = fmt(state.destroyed);
  el.sold.textContent = fmt(state.sold);
}

function toast(text: string, color: string): void {
  el.toast.textContent = text;
  el.toast.style.color = color;
  el.toast.classList.remove("show");
  void el.toast.offsetWidth;
  el.toast.classList.add("show");
}

function flash(cls: string): void {
  el.stage.classList.remove("flash-success", "flash-fail", "flash-destroy");
  void el.stage.offsetWidth;
  el.stage.classList.add(cls);
}

function addLog(text: string, cls: string): void {
  const li = document.createElement("li");
  li.className = cls;
  li.textContent = text;
  el.log.prepend(li);
  while (el.log.children.length > 50) el.log.lastElementChild?.remove();
}

const RESULT_VIEW: Record<EnhanceResult["outcome"], { text: string; color: string; flash: string }> = {
  success: { text: "성공!", color: "var(--good)", flash: "flash-success" },
  stay: { text: "실패...", color: "var(--muted)", flash: "flash-fail" },
  down: { text: "하락!", color: "var(--warn)", flash: "flash-fail" },
  protected: { text: "방지권 발동!", color: "#7fc8ff", flash: "flash-fail" },
  destroy: { text: "💥 파괴!!", color: "var(--bad)", flash: "flash-destroy" },
};

function logText(r: EnhanceResult): string {
  const tag = `+${r.from}→+${r.to}`;
  switch (r.outcome) {
    case "success":
      return `✅ ${tag} 성공 (${SWORD_NAMES[r.to]})`;
    case "stay":
      return `➖ +${r.from} 실패, 유지`;
    case "down":
      return `⬇️ ${tag} 실패, 하락`;
    case "protected":
      return `🛡️ ${tag} 파괴될 뻔! 방지권으로 막음`;
    case "destroy":
      return `💥 +${r.from} ${SWORD_NAMES[r.from]} 파괴됨...`;
  }
}

// ── 입력 ─────────────────────────────────────────────────
el.enhanceBtn.addEventListener("click", () => {
  if (busy || !canEnhance(state)) return;
  busy = true;
  render();
  el.stage.classList.add("charging");
  const wait = 450 + Math.min(state.level, 15) * 40; // 높을수록 긴장감 ↑
  setTimeout(() => {
    el.stage.classList.remove("charging");
    const r = enhance(state);
    const view = RESULT_VIEW[r.outcome];
    flash(view.flash);
    toast(view.text, view.color);
    addLog(logText(r), r.outcome);
    save();
    const after = () => {
      busy = false;
      render();
    };
    if (r.outcome === "destroy") setTimeout(after, 700);
    else after();
  }, wait);
});

el.sellBtn.addEventListener("click", () => {
  if (busy || state.level === 0) return;
  const lv = state.level;
  const name = SWORD_NAMES[lv];
  if (lv >= 10 && !confirm(`+${lv} ${name}을(를) ${fmt(levelInfo(lv).sell)} G에 팔까요?`)) return;
  const price = sell(state);
  toast(`+${fmt(price)} G`, "var(--gold)");
  addLog(`💸 +${lv} ${name} 판매 → ${fmt(price)} G`, "sell");
  save();
  render();
});

el.workBtn.addEventListener("click", () => {
  state.gold += WORK_GOLD;
  save();
  render();
});

el.protect.addEventListener("change", () => {
  state.protect = el.protect.checked;
  save();
  render();
});

el.resetBtn.addEventListener("click", () => {
  if (!confirm("정말 처음부터 다시 할까요? 모든 기록이 사라져요.")) return;
  state = freshSave();
  el.log.innerHTML = "";
  save();
  render();
});

document.addEventListener("keydown", (e) => {
  if (e.repeat) return;
  if (e.code === "Space" || e.code === "Enter") {
    e.preventDefault();
    el.enhanceBtn.click();
  } else if (e.key.toLowerCase() === "s") {
    el.sellBtn.click();
  }
});

render();

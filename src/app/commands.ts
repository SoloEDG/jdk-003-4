import { enterRoute, resolveRoute, resetRoute, isTerminal } from "@/features/route";
import {
  battleState,
  beginBattle,
  playCard,
  endTurn,
  resetBattle,
} from "@/features/battle";
import {
  deckState,
  deckCards,
  addCard,
  earnGold,
  spendGold,
  setHp,
  heal,
  upgradeCard,
  removeCard,
  openCamp,
  useCamp,
  resetDeck,
} from "@/features/deck";
import { openReward, claimReward, resetReward } from "@/features/reward";
import {
  openShop,
  preparePurchase,
  completePurchase,
  closeShop,
  resetShop,
} from "@/features/shop";
import { versionById } from "@/features/rules/model/state";
import { bindRunPack, rememberMainRef } from "@/features/rules/lib/run";
import { createDefaultRulePack } from "@/shared/rules";
import type { RuleVersion } from "@/shared/rules";
import {
  session,
  switchTab,
  setContext,
  notify,
  finishRun,
  resetSession,
  type SessionMode,
} from "./session";
import {
  save,
  load,
  clearSave,
  setFrozenRule,
  frozenRule,
  ruleRefOf,
  rememberActiveSlot,
  type SaveSlot,
} from "./persistence";

export function activeSlot(): SaveSlot {
  return session.mode === "trial" ? "trial" : "main";
}

function persist() {
  if (!save(activeSlot())) notify("本地保存失败，请保留当前页面。");
}

function resetGame() {
  resetRoute();
  resetBattle();
  resetDeck();
  resetReward();
  resetShop();
}

function bindVersion(version: RuleVersion, slot: SaveSlot, mode: SessionMode) {
  setFrozenRule(slot, version.id, version.label, version.pack);
  bindRunPack(version.pack, ruleRefOf(slot));
  if (slot === "main") rememberMainRef(ruleRefOf("main"));
  resetGame();
  resetSession(mode);
  rememberActiveSlot(slot);
  persist();
}

/** 从已发布版本开始一次正式远征。若正在试跑，先保留试跑进度。 */
export function startExpedition(versionId: string) {
  const version = versionById(versionId);
  if (!version) return false;
  if (session.mode === "trial") save("trial");
  bindVersion(version, "main", "normal");
  setContext(null);
  switchTab("route");
  notify(`新的远征「${version.label}」已经启程。`);
  return true;
}

/** 在独立存档中使用已发布版本试跑，不会触碰正式远征。 */
export function startTrial(versionId: string) {
  const version = versionById(versionId);
  if (!version) return false;
  if (session.mode !== "trial") save("main");
  bindVersion(version, "trial", "trial");
  setContext(null);
  switchTab("route");
  notify(`试跑开始：规则版本「${version.label}」。`);
  return true;
}

/** 结束试跑并回到正式远征存档。 */
export function returnToMain() {
  if (session.mode !== "trial") return;
  save("trial");
  if (!load("main")) {
    const fallback = versionById(frozenRule("main")?.versionId);
    if (fallback) {
      bindVersion(fallback, "main", "normal");
    } else {
      setFrozenRule("main", "", "经典远征", createDefaultRulePack());
      bindRunPack(createDefaultRulePack());
      resetGame();
      resetSession("normal");
      persist();
    }
  }
  rememberActiveSlot("main");
  setContext(null);
  switchTab("route");
  notify("已回到正式远征。");
}

export function navigate(id: string) {
  if (session.ended) return;
  const c = enterRoute(id);
  if (!c) return;
  setContext(c);
  if (c.kind === "shop") {
    openShop(c);
    switchTab("shop");
  } else if (c.kind === "camp") {
    openCamp();
    switchTab("deck");
  } else {
    beginBattle(c, deckCards(), deckState.hero.hp, deckState.hero.maxHp);
    switchTab("battle");
  }
  notify(
    `进入 ${c.nodeId} · 威胁 ${c.influence.heat} / 好感 ${c.influence.favor}`,
  );
  persist();
}
export function play(id: string) {
  playCard(id);
  persist();
}
export function turn() {
  endTurn();
  persist();
}
export function settle() {
  const r = battleState.result;
  if (!r) return;
  if (!r.won) {
    setHp(r.hp);
    finishRun();
    notify("这次旅途已经结束。重新启程可保留你的经验。");
    persist();
    return;
  }
  if (openReward(JSON.parse(JSON.stringify(r)))) {
    setHp(r.hp);
    switchTab("reward");
    notify("胜利！选择一张牌或跳过卡牌，金币都会结算。");
  }
  persist();
}
export function claim(skip: boolean) {
  const grant = claimReward(skip);
  if (!grant) return;
  if (grant.card) addCard(grant.card);
  earnGold(grant.gold);
  heal(grant.heal);
  resolveRoute();
  finishIfTerminal();
  if (!session.ended) notify("奖励已结算，新的路线开放。");
  switchTab("route");
  persist();
}
export function buy(id: string) {
  const p = preparePurchase(id);
  if (!p || !spendGold(p.price)) {
    notify("无法购买：库存或金币不足。");
    return;
  }
  if (!completePurchase(p)) {
    earnGold(p.price);
    return;
  }
  addCard(p.card);
  notify("交易完成，卡牌已收入牌组。");
  persist();
}
export function leaveShop() {
  closeShop();
  resolveRoute();
  finishIfTerminal();
  switchTab("route");
  persist();
}
export function camp(action: "rest" | "upgrade") {
  if (
    !session.context ||
    session.context.kind !== "camp" ||
    !useCamp(action, session.context.influence.heat)
  )
    return;
  resolveRoute();
  finishIfTerminal();
  if (!session.ended) notify("篝火逐渐熄灭，你准备好继续上路。");
  persist();
}
export function upgrade(id: string) {
  if (battleState.phase === "playing") return;
  notify(upgradeCard(id) ? "卡牌强化完成。" : "无法强化：金币不足或已经强化。");
  persist();
}
export function remove(id: string) {
  if (battleState.phase === "playing") return;
  notify(
    removeCard(id)
      ? "已移除卡牌。"
      : "无法移除：至少保留五张牌，且需要足够金币。",
  );
  persist();
}
export function restart() {
  const slot = activeSlot();
  const mode = session.mode;
  const rule = frozenRule(slot);
  resetGame();
  resetSession(mode);
  if (rule) {
    bindRunPack(rule.pack, ruleRefOf(slot));
  }
  clearSave(slot);
  persist();
  setContext(null);
  notify(
    mode === "trial"
      ? "试跑已重置，仍使用同一冻结规则版本。"
      : "新的火种已点燃。",
  );
}

/** 抵达没有后继连接的地图终点时结束远征。 */
function finishIfTerminal() {
  const id = session.context?.nodeId;
  if (!id || !isTerminal(id)) return;
  finishRun();
  notify("这条路走到了尽头。远征完成。");
}

/** 规则编辑器改动后触发界面刷新（编辑器本身已就地更新，无需重载游戏）。 */
export function refresh() {
  // 草稿变化不触及运行中的远征；这里只保持两侧状态分离。
}

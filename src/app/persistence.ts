import { exportRoute, restoreRoute } from "@/features/route";
import { exportBattle, restoreBattle } from "@/features/battle";
import { exportDeck, restoreDeck } from "@/features/deck";
import { exportReward, restoreReward } from "@/features/reward";
import { exportShop, restoreShop } from "@/features/shop";
import { bindRunPack, rememberMainRef } from "@/features/rules/lib/run";
import type { RulePack } from "@/shared/rules";
import { exportSession, restoreSession } from "./session";
const KEY = "ember-path-v1";
const TRIAL_KEY = "ember-path-trial-v1";
const SLOT_KEY = "ember-path-active-slot";
const MAIN_REF_KEY = "ember-path-main-rule-ref";
const SAVE_VERSION = 2;

export type SaveSlot = "main" | "trial";

interface PersistedRule {
  versionId: string;
  label: string;
  pack: RulePack;
}

/** 远征开始时冻结的规则包跟随存档保存，恢复后仍按原版本运行。 */
const frozen: Record<SaveSlot, PersistedRule | null> = {
  main: null,
  trial: null,
};

export function setFrozenRule(
  slot: SaveSlot,
  versionId: string,
  label: string,
  pack: RulePack,
) {
  frozen[slot] = JSON.parse(
    JSON.stringify({ versionId, label, pack }),
  ) as PersistedRule;
  if (slot === "main") rememberMainRuleRef({ versionId, label });
}

export function rememberMainRuleRef(ref: { versionId: string; label: string }) {
  rememberMainRef(ref);
  try {
    localStorage.setItem(MAIN_REF_KEY, JSON.stringify(ref));
  } catch {
    // 忽略存储失败。
  }
}

/** 恢复正式远征的规则版本引用，与试跑无关。 */
export function hydrateMainRuleRef() {
  try {
    const raw = localStorage.getItem(MAIN_REF_KEY);
    if (!raw) return;
    const d = JSON.parse(raw);
    if (d && typeof d.label === "string")
      rememberMainRef({ versionId: String(d.versionId ?? ""), label: d.label });
  } catch {
    // 忽略损坏的数据。
  }
}

export function frozenRule(slot: SaveSlot) {
  return frozen[slot];
}

export function ruleRefOf(slot: SaveSlot) {
  const rule = frozen[slot];
  return {
    versionId: rule?.versionId ?? "",
    label: rule?.label ?? "经典远征 · 基础版",
  };
}

function snapshot(slot: SaveSlot) {
  return {
    version: SAVE_VERSION,
    rules: frozen[slot],
    route: exportRoute(),
    battle: exportBattle(),
    deck: exportDeck(),
    reward: exportReward(),
    shop: exportShop(),
    session: exportSession(),
  };
}

function keyFor(slot: SaveSlot) {
  return slot === "trial" ? TRIAL_KEY : KEY;
}

export function save(slot: SaveSlot = "main") {
  try {
    localStorage.setItem(keyFor(slot), JSON.stringify(snapshot(slot)));
    return true;
  } catch {
    return false;
  }
}

export function hasSave(slot: SaveSlot = "main") {
  return localStorage.getItem(keyFor(slot)) !== null;
}

/** 读取存档并把其中冻结的规则包绑定为当前远征规则。 */
export function load(slot: SaveSlot = "main") {
  const raw = localStorage.getItem(keyFor(slot));
  if (!raw) return false;
  try {
    const d = JSON.parse(raw);
    if (
      (d.version !== 1 && d.version !== SAVE_VERSION) ||
      !Array.isArray(d.deck?.cards) ||
      !Array.isArray(d.route?.visited) ||
      !d.battle?.piles ||
      !Array.isArray(d.reward?.history) ||
      !Array.isArray(d.shop?.stock) ||
      !d.session
    )
      return false;
    if (d.version === SAVE_VERSION && !d.rules?.pack) return false;
    const old = snapshot(slot);
    try {
      if (d.rules?.pack) {
        frozen[slot] = d.rules as PersistedRule;
        bindRunPack(frozen[slot].pack, ruleRefOf(slot));
        if (slot === "main") rememberMainRuleRef(ruleRefOf("main"));
      } else {
        // 旧版存档没有冻结规则，按经典规则继续运行。
        frozen[slot] = null;
        bindRunPack(null);
      }
      restoreRoute(d.route);
      restoreBattle(d.battle);
      restoreDeck(d.deck);
      restoreReward(d.reward);
      restoreShop(d.shop);
      restoreSession(d.session);
    } catch {
      frozen[slot] = old.rules;
      if (slot === "main" && old.rules)
        rememberMainRuleRef({
          versionId: old.rules.versionId,
          label: old.rules.label,
        });
      restoreRoute(old.route);
      restoreBattle(old.battle);
      restoreDeck(old.deck);
      restoreReward(old.reward);
      restoreShop(old.shop);
      restoreSession(old.session);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function clearSave(slot: SaveSlot = "main") {
  localStorage.removeItem(keyFor(slot));
  frozen[slot] = null;
}

export function rememberActiveSlot(slot: SaveSlot) {
  try {
    localStorage.setItem(SLOT_KEY, slot);
  } catch {
    // 忽略存储失败。
  }
}

export function rememberedSlot(): SaveSlot {
  try {
    return localStorage.getItem(SLOT_KEY) === "trial" ? "trial" : "main";
  } catch {
    return "main";
  }
}

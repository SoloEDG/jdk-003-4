import { loadLibrary, ensureLibrary, latestVersion } from "@/features/rules/model/state";
import { ruleLibrary } from "@/features/rules/model/state";
import { bindRunPack } from "@/features/rules/lib/run";
import type { RulePack } from "@/shared/rules";
import { resetRoute } from "@/features/route/model/state";
import { resetBattle } from "@/features/battle/model/state";
import { resetDeck } from "@/features/deck/model/state";
import { resetReward } from "@/features/reward/model/state";
import { resetShop } from "@/features/shop/model/state";
import {
  load,
  rememberedSlot,
  hasSave,
  setFrozenRule,
  ruleRefOf,
  rememberActiveSlot,
  hydrateMainRuleRef,
  save,
  type SaveSlot,
} from "./persistence";
import { resetSession } from "./session";

let booted = false;

/** 启动：先恢复规则库，再载入上次使用的存档槽（正式或试跑）。 */
export function boot() {
  if (booted) return;
  booted = true;
  loadLibrary();
  ensureLibrary();
  hydrateMainRuleRef();
  const slot: SaveSlot = rememberedSlot();
  if (hasSave(slot) && load(slot)) return;
  if (slot === "trial" && hasSave("main") && load("main")) return;
  // 没有任何存档：新建正式远征。优先使用最近发布版本，避免用未发布的草稿。
  const version = latestVersion() ?? ruleLibrary.versions.at(-1) ?? null;
  if (!version) return;
  const pack = JSON.parse(JSON.stringify(version.pack)) as RulePack;
  setFrozenRule("main", version.id, version.label, pack);
  bindRunPack(pack, ruleRefOf("main"));
  resetRoute();
  resetBattle();
  resetDeck();
  resetReward();
  resetShop();
  resetSession("normal");
  rememberActiveSlot("main");
  save("main");
}

import { shallowRef } from "vue";
import type { RulePack } from "@/shared/rules";
import { createDefaultRulePack } from "@/shared/rules";

export interface RunRuleRef {
  versionId: string;
  label: string;
}

/**
 * 当前远征冻结引用的规则包。试跑与正式开局都从这里读取，
 * 编辑器草稿的任何改动都不会波及这里。
 */
const runPack = shallowRef<RulePack | null>(null);
const runRef = shallowRef<RunRuleRef>({
  versionId: "",
  label: "经典远征 · 基础版",
});

/** 正式远征使用的规则引用，用于在试跑中展示“正式局仍在哪个版本”。 */
const mainRef = shallowRef<RunRuleRef>({
  versionId: "",
  label: "经典远征 · 基础版",
});

export function bindRunPack(pack: RulePack | null, ref?: RunRuleRef) {
  runPack.value = pack ? (JSON.parse(JSON.stringify(pack)) as RulePack) : null;
  runRef.value = ref ?? { versionId: "", label: pack?.name ?? "经典远征" };
}

export function rememberMainRef(ref: RunRuleRef) {
  mainRef.value = { ...ref };
}

export function activeMainRef(): RunRuleRef {
  return { ...mainRef.value };
}

export function activeRunRef(): RunRuleRef {
  return { ...runRef.value };
}

export function activeRulePack(): RulePack {
  return runPack.value ?? createDefaultRulePack();
}

export function ruleNode(id: string) {
  return activeRulePack().nodes.find((node) => node.id === id) ?? null;
}

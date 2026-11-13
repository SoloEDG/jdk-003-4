import { reactive, readonly } from "vue";
import type {
  EnemyRule,
  RuleNode,
  RulePack,
  RuleVersion,
  SharedRulePack,
  StockRule,
} from "@/shared/rules";
import {
  cloneRulePack,
  cloneRuleVersion,
  createDefaultRulePack,
  newRulePackId,
  newRuleVersionId,
  normalizeRulePack,
} from "@/shared/rules";
import { cards } from "@/shared/cards";
import { blockingIssues, validateRulePack, type RuleIssue } from "../lib/validate";

const LIBRARY_KEY = "ember-path-rule-library-v1";

interface RuleLibraryState {
  draft: RulePack | null;
  versions: RuleVersion[];
  selectedNodeId: string;
  publishLabel: string;
  notice: string;
}

const state = reactive<RuleLibraryState>({
  draft: null,
  versions: [],
  selectedNodeId: "",
  publishLabel: "",
  notice: "",
});

export const ruleLibrary = readonly(state);

export function libraryIssues(): RuleIssue[] {
  return state.draft ? validateRulePack(state.draft) : [];
}

export function canPublish() {
  return !!state.draft && blockingIssues(libraryIssues()).length === 0;
}

export function selectedNode(): RuleNode | null {
  return state.draft?.nodes.find((n) => n.id === state.selectedNodeId) ?? null;
}

export function selectNode(id: string) {
  state.selectedNodeId = id;
}

export function renameDraft(name: string) {
  if (!state.draft) return;
  state.draft.name = name;
  schedulePersist();
}

export function setPublishLabel(label: string) {
  state.publishLabel = label;
}

function touchNode(id: string) {
  state.notice = "";
  if (!state.selectedNodeId) state.selectedNodeId = id;
  schedulePersist();
}

let persistTimer: ReturnType<typeof setTimeout> | null = null;
/** 草稿改动防抖落盘，刷新页面后仍可继续编辑。 */
function schedulePersist() {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    persistTimer = null;
    persistLibrary();
  }, 150);
}

export function updateNode(id: string, patch: Partial<RuleNode>) {
  const node = state.draft?.nodes.find((n) => n.id === id);
  if (!node) return;
  Object.assign(node, patch);
  if (patch.kind && patch.kind !== "shop") node.stock = [];
  touchNode(id);
}

export function updateInfluence(
  id: string,
  patch: Partial<RuleNode["influence"]>,
) {
  const node = state.draft?.nodes.find((n) => n.id === id);
  if (!node) return;
  Object.assign(node.influence, patch);
  touchNode(id);
}

export function updateEnemy(id: string, patch: Partial<EnemyRule>) {
  const node = state.draft?.nodes.find((n) => n.id === id);
  if (node?.enemy) {
    Object.assign(node.enemy, patch);
    touchNode(id);
  }
}

export function toggleEnemy(id: string, enabled: boolean) {
  const node = state.draft?.nodes.find((n) => n.id === id);
  if (!node) return;
  if (enabled && !node.enemy)
    node.enemy = {
      name: "新敌人",
      hp: 30,
      attack: 6,
      intents: [1, 0.8, 1.2],
      strength: 0,
      thorns: 0,
      poison: 0,
      block: 0,
      blockEvery: 3,
      blockAmount: 5,
      gold: 20,
    };
  if (!enabled) node.enemy = null;
  touchNode(id);
}

export function setIntentPattern(id: string, value: string) {
  const node = state.draft?.nodes.find((n) => n.id === id);
  if (!node?.enemy) return;
  const parsed = value
    .split(/[,，\s]+/)
    .map((v) => Number.parseFloat(v))
    .filter((v) => Number.isFinite(v) && v > 0);
  node.enemy.intents = parsed;
  touchNode(id);
}

export function toggleLink(fromId: string, toId: string) {
  const node = state.draft?.nodes.find((n) => n.id === fromId);
  if (!node || fromId === toId) return;
  node.next = node.next.includes(toId)
    ? node.next.filter((id) => id !== toId)
    : [...node.next, toId];
  touchNode(fromId);
}

export function toggleReward(id: string, card: string) {
  const node = state.draft?.nodes.find((n) => n.id === id);
  if (!node) return;
  node.rewards = node.rewards.includes(card)
    ? node.rewards.filter((k) => k !== card)
    : [...node.rewards, card];
  touchNode(id);
}

export function addStock(id: string) {
  const node = state.draft?.nodes.find((n) => n.id === id);
  if (!node) return;
  const available = Object.keys(cards).find(
    (k) => !node.stock.some((s) => s.card === k),
  );
  if (!available) return;
  node.stock.push({
    card: available,
    price: cards[available]!.rarity === "rare" ? 48 : 32,
  });
  touchNode(id);
}

export function updateStock(id: string, index: number, patch: Partial<StockRule>) {
  const node = state.draft?.nodes.find((n) => n.id === id);
  const item = node?.stock[index];
  if (item) {
    Object.assign(item, patch);
    touchNode(id);
  }
}

export function removeStock(id: string, index: number) {
  const node = state.draft?.nodes.find((n) => n.id === id);
  if (node) {
    node.stock.splice(index, 1);
    touchNode(id);
  }
}

export function toggleStarterCard(card: string) {
  if (!state.draft) return;
  const deck = state.draft.starterDeck;
  const at = deck.indexOf(card);
  if (at >= 0) deck.splice(at, 1);
  else deck.push(card);
  schedulePersist();
}

export function addNode() {
  if (!state.draft) return;
  const depth = state.draft.nodes.length
    ? Math.max(...state.draft.nodes.map((n) => n.depth)) + 1
    : 0;
  const base = `n${depth}`;
  let id = `${base}-0`;
  let lane = 0;
  while (state.draft.nodes.some((n) => n.id === id)) {
    lane++;
    id = `${base}-${lane}`;
  }
  state.draft.nodes.push({
    id,
    region: "abyss",
    depth,
    lane,
    kind: "battle",
    title: "新节点",
    influence: { heat: 1, favor: 0, scarcity: 1 },
    next: [],
    enemy: {
      name: "新敌人",
      hp: 30,
      attack: 6,
      intents: [1, 0.8, 1.2],
      strength: 0,
      thorns: 0,
      poison: 0,
      block: 0,
      blockEvery: 3,
      blockAmount: 5,
      gold: 20,
    },
    rewards: ["strike", "guard"],
    stock: [],
  });
  state.selectedNodeId = id;
  schedulePersist();
}

export function removeNode(id: string) {
  if (!state.draft) return;
  state.draft.nodes = state.draft.nodes.filter((n) => n.id !== id);
  for (const node of state.draft.nodes)
    node.next = node.next.filter((target) => target !== id);
  state.selectedNodeId = state.draft.nodes[0]?.id ?? "";
  schedulePersist();
}

export function startDraft(name?: string) {
  const pack = createDefaultRulePack();
  pack.id = newRulePackId();
  pack.name = name || "自定义远征";
  state.draft = pack;
  state.selectedNodeId = pack.nodes[0]?.id ?? "";
  state.notice = "已基于经典远征创建草稿。";
  persistLibrary();
}

export function draftFromVersion(versionId: string) {
  const version = state.versions.find((v) => v.id === versionId);
  if (!version) return;
  const pack = cloneRulePack(version.pack);
  pack.id = newRulePackId();
  pack.name = `${version.pack.name} · 改版草稿`;
  state.draft = pack;
  state.selectedNodeId = pack.nodes[0]?.id ?? "";
  state.notice = `已复制「${version.label}」为草稿，原版本不受影响。`;
  persistLibrary();
}

export function publishDraft(): RuleVersion | null {
  if (!state.draft) return null;
  const issues = libraryIssues();
  const blocking = blockingIssues(issues);
  if (blocking.length) {
    state.notice = `发布被拒绝：${blocking.length} 项配置会阻止远征运行，请先修正。`;
    return null;
  }
  const seq = state.versions.length + 1;
  const pack = cloneRulePack(state.draft);
  pack.nodes.forEach((n) => {
    n.next = [...new Set(n.next)];
  });
  const version: RuleVersion = {
    id: newRuleVersionId(),
    label: state.publishLabel.trim() || `${pack.name} v${seq}`,
    createdAt: new Date().toISOString(),
    pack,
  };
  state.versions.push(version);
  state.publishLabel = "";
  state.notice = `已冻结规则版本「${version.label}」。之后的草稿修改不会影响它。`;
  persistLibrary();
  return cloneRuleVersion(version);
}

export function versionById(id: string | null | undefined) {
  return state.versions.find((v) => v.id === id) ?? null;
}

export function latestVersion() {
  return state.versions.at(-1) ?? null;
}

export function exportShared(
  source: RulePack | RuleVersion,
): SharedRulePack {
  const pack = "pack" in source ? source.pack : source;
  const versionLabel = "label" in source ? source.label : undefined;
  return {
    format: "ember-path-rulepack",
    schema: 1,
    pack: cloneRulePack(pack),
    ...(versionLabel ? { versionLabel } : {}),
  };
}

export function sharedText(source: RulePack | RuleVersion) {
  return JSON.stringify(exportShared(source), null, 2);
}

export function importShared(text: string): boolean {
  try {
    const data = JSON.parse(text) as SharedRulePack;
    if (
      data?.format !== "ember-path-rulepack" ||
      data.schema !== 1 ||
      !data.pack ||
      !Array.isArray(data.pack.nodes) ||
      !Array.isArray(data.pack.starterDeck)
    ) {
      state.notice = "导入失败：文件不是可识别的远征规则包。";
      return false;
    }
    const pack = normalizeRulePack(data.pack);
    state.draft = pack;
    state.selectedNodeId = pack.nodes[0]?.id ?? "";
    const blocking = blockingIssues(validateRulePack(pack)).length;
    state.notice = blocking
      ? `已导入规则包「${pack.name}」，其中 ${blocking} 项配置需要修正后才能发布。`
      : `已导入规则包「${pack.name}」，可继续编辑后发布。`;
    persistLibrary();
    return true;
  } catch {
    state.notice = "导入失败：内容不是有效的 JSON。";
    return false;
  }
}

export function importAsVersion(text: string): boolean {
  try {
    const data = JSON.parse(text) as SharedRulePack;
    if (
      data?.format !== "ember-path-rulepack" ||
      data.schema !== 1 ||
      !data.pack ||
      !Array.isArray(data.pack.nodes)
    ) {
      state.notice = "导入失败：文件不是可识别的远征规则包。";
      return false;
    }
    const pack = normalizeRulePack(data.pack);
    const blocking = blockingIssues(validateRulePack(pack));
    if (blocking.length) {
      state.notice = `导入被拒绝：该规则包有 ${blocking.length} 项配置会阻止远征运行。`;
      return false;
    }
    const version: RuleVersion = {
      id: newRuleVersionId(),
      label:
        data.versionLabel?.trim() || `${pack.name || "导入远征"}（导入）`,
      createdAt: new Date().toISOString(),
      pack,
    };
    state.versions.push(version);
    state.notice = `已将「${version.label}」登记为可用版本。`;
    persistLibrary();
    return true;
  } catch {
    state.notice = "导入失败：内容不是有效的 JSON。";
    return false;
  }
}

function persistLibrary() {
  try {
    localStorage.setItem(
      LIBRARY_KEY,
      JSON.stringify({
        version: 1,
        draft: state.draft,
        versions: state.versions,
      }),
    );
  } catch {
    state.notice = "规则库本地保存失败。";
  }
}

export function loadLibrary() {
  try {
    const raw = localStorage.getItem(LIBRARY_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    if (data.version !== 1) return false;
    state.draft = data.draft ? cloneRulePack(data.draft) : null;
    state.versions = Array.isArray(data.versions)
      ? (data.versions as RuleVersion[]).map(cloneRuleVersion)
      : [];
    state.selectedNodeId = state.draft?.nodes[0]?.id ?? "";
    return true;
  } catch {
    return false;
  }
}

export function ensureLibrary() {
  if (state.versions.length && state.draft) return;
  if (!state.versions.length) {
    const pack = createDefaultRulePack();
    const version: RuleVersion = {
      id: newRuleVersionId(),
      label: "经典远征 · 基础版",
      createdAt: new Date().toISOString(),
      pack: cloneRulePack(pack),
    };
    state.versions.push(version);
  }
  if (!state.draft) {
    state.draft = cloneRulePack(state.versions.at(-1)!.pack);
    state.draft.id = newRulePackId();
    state.draft.name = `${state.versions.at(-1)!.pack.name} · 草稿`;
  }
  state.selectedNodeId = state.draft.nodes[0]?.id ?? "";
  persistLibrary();
}


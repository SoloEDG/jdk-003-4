import type { RuleNode, RulePack } from "@/shared/rules";
import { cards } from "@/shared/cards";

export type RuleIssueCode =
  | "missing-entry"
  | "duplicate-node"
  | "missing-link"
  | "cycle"
  | "unreachable-end"
  | "unknown-card"
  | "empty-enemy";

export interface RuleIssue {
  severity: "error" | "warning";
  code: RuleIssueCode;
  message: string;
  /** 关联的节点 id，编辑器可直接定位。 */
  nodeIds: string[];
}

function labelOf(pack: RulePack, id: string) {
  const node = pack.nodes.find((n) => n.id === id);
  return node ? `${id}「${node.title}」` : id;
}

function combatNode(node: RuleNode) {
  return node.kind === "battle" || node.kind === "elite" || node.kind === "boss";
}

/**
 * 发布门槛。只把会造成规则包无法运行的配置视为错误：
 * 起点缺失、重复节点、连接指向不存在节点、循环连接、不可达终点、
 * 未知卡牌、战斗遭遇没有敌人。其他情况降级为提示。
 */
export function validateRulePack(pack: RulePack): RuleIssue[] {
  const issues: RuleIssue[] = [];
  const ids = new Set<string>();
  const duplicates = new Set<string>();
  for (const node of pack.nodes) {
    if (ids.has(node.id)) duplicates.add(node.id);
    ids.add(node.id);
  }
  for (const id of duplicates)
    issues.push({
      severity: "error",
      code: "duplicate-node",
      message: `节点 id "${id}" 重复，无法区分两个地区节点。`,
      nodeIds: [id],
    });

  const starts = pack.nodes.filter((n) => n.depth === 0);
  if (!pack.nodes.length)
    issues.push({
      severity: "error",
      code: "missing-entry",
      message: "规则包没有任何地区节点，远征无法开始。",
      nodeIds: [],
    });
  else if (!starts.length)
    issues.push({
      severity: "error",
      code: "missing-entry",
      message: "没有深度为 0 的起点节点，远征无法开始。",
      nodeIds: [],
    });

  for (const node of pack.nodes) {
    const missing = node.next.filter((id) => !ids.has(id));
    if (missing.length)
      issues.push({
        severity: "error",
        code: "missing-link",
        message: `节点 ${labelOf(pack, node.id)} 连接指向不存在的节点：${missing.join("、")}。`,
        nodeIds: [node.id, ...missing],
      });
  }

  // 循环连接：DFS 找回边并还原路径。
  const color = new Map<string, 0 | 1 | 2>();
  const stack: string[] = [];
  const reported = new Set<string>();
  const visit = (id: string) => {
    color.set(id, 1);
    stack.push(id);
    const node = pack.nodes.find((n) => n.id === id);
    for (const target of node?.next ?? []) {
      if (!ids.has(target)) continue;
      const state = color.get(target) ?? 0;
      if (state === 1) {
        const at = stack.indexOf(target);
        const path = [...stack.slice(at), target];
        const signature = [...path].sort().join("|");
        if (!reported.has(signature)) {
          reported.add(signature);
          issues.push({
            severity: "error",
            code: "cycle",
            message: `循环连接：${path.map((p) => labelOf(pack, p)).join(" → ")}`,
            nodeIds: [...new Set(path)],
          });
        }
      } else if (state === 0) visit(target);
    }
    stack.pop();
    color.set(id, 2);
  };
  for (const node of pack.nodes) if (!color.get(node.id)) visit(node.id);

  // 可达性：从深度 0 的起点出发。
  const reachable = new Set<string>();
  const queue = starts.map((n) => n.id);
  while (queue.length) {
    const id = queue.shift()!;
    if (reachable.has(id)) continue;
    reachable.add(id);
    const node = pack.nodes.find((n) => n.id === id);
    for (const target of node?.next ?? []) if (ids.has(target)) queue.push(target);
  }
  for (const node of pack.nodes) {
    if (node.next.length === 0 && !reachable.has(node.id))
      issues.push({
        severity: "error",
        code: "unreachable-end",
        message: `终点 ${labelOf(pack, node.id)} 无法从起点抵达。`,
        nodeIds: [node.id],
      });
  }
  for (const node of pack.nodes) {
    if (node.next.length > 0 && !reachable.has(node.id))
      issues.push({
        severity: "warning",
        code: "unreachable-end",
        message: `节点 ${labelOf(pack, node.id)} 无法从起点抵达。`,
        nodeIds: [node.id],
      });
  }

  // 未知卡牌：起始牌组、奖励池、商店库存都必须来自现有卡库。
  if (!pack.starterDeck.length)
    issues.push({
      severity: "warning",
      code: "unknown-card",
      message: "起始牌组为空，试跑时将没有可出的牌。",
      nodeIds: [],
    });
  for (const key of pack.starterDeck) {
    if (!cards[key])
      issues.push({
        severity: "error",
        code: "unknown-card",
        message: `起始牌组包含未知卡牌 "${key}"。`,
        nodeIds: [],
      });
  }
  for (const node of pack.nodes) {
    if (consideredRewards(node))
      for (const key of node.rewards) {
        if (!cards[key])
          issues.push({
            severity: "error",
            code: "unknown-card",
            message: `节点 ${labelOf(pack, node.id)} 的奖励池包含未知卡牌 "${key}"。`,
            nodeIds: [node.id],
          });
      }
    for (const item of node.stock) {
      if (!cards[item.card])
        issues.push({
          severity: "error",
          code: "unknown-card",
          message: `节点 ${labelOf(pack, node.id)} 的商店库存包含未知卡牌 "${item.card}"。`,
          nodeIds: [node.id],
        });
    }
  }

  // 空敌人：战斗 / 精英 / 首领必须有可交战的敌人。
  for (const node of pack.nodes) {
    if (!combatNode(node)) continue;
    if (!node.enemy || node.enemy.hp <= 0)
      issues.push({
        severity: "error",
        code: "empty-enemy",
        message: `战斗节点 ${labelOf(pack, node.id)} 没有可用的敌人（生命必须大于 0）。`,
        nodeIds: [node.id],
      });
    else if (!node.enemy.intents.filter((n) => n > 0).length)
      issues.push({
        severity: "warning",
        code: "empty-enemy",
        message: `战斗节点 ${labelOf(pack, node.id)} 的意图为空，将按固定倍率攻击。`,
        nodeIds: [node.id],
      });
  }

  return issues;
}

function consideredRewards(node: RuleNode) {
  return combatNode(node);
}

export function blockingIssues(issues: RuleIssue[]) {
  return issues.filter((i) => i.severity === "error");
}

export function issueForNode(issues: RuleIssue[], id: string) {
  return issues.filter((i) => i.nodeIds.includes(id) || i.nodeIds.length === 0);
}

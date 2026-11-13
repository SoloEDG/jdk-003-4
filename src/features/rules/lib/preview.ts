import type { Influence, JourneyContext } from "@/shared/domain";
import type { EnemyRule, RuleNode, RulePack } from "@/shared/rules";
import { hash, shuffle } from "@/shared/random";
import { accumulate } from "@/features/route/lib/rules";
import type { Enemy } from "@/features/battle/lib/enemies";

/** 由规则生成敌人生成逻辑的唯一来源，试跑、正式局与编辑器预览共用。 */
export function enemyFromRule(rule: EnemyRule | null): Enemy | null {
  if (!rule || rule.hp <= 0) return null;
  const pattern = rule.intents.filter((n) => Number.isFinite(n) && n > 0);
  return {
    name: rule.name.trim() || "无名敌人",
    hp: rule.hp,
    maxHp: rule.hp,
    block: Math.max(0, rule.block),
    strength: rule.strength,
    poison: rule.poison,
    thorns: rule.thorns,
    attack: rule.attack,
    reward: rule.gold,
    pattern: pattern.length ? pattern : [1],
    blockEvery: rule.blockEvery,
    blockAmount: rule.blockAmount,
  };
}

/** 当前草稿节点实际生成的敌人（不受已绑定远征影响）。 */
export function nodeEnemy(node: RuleNode): Enemy | null {
  return enemyFromRule(node.enemy);
}

export function intentsFor(enemy: Enemy, turns = 6) {
  return Array.from({ length: turns }, (_, i) => {
    const turn = i + 1;
    return {
      turn,
      amount: Math.floor(
        enemy.attack * enemy.pattern[(turn - 1) % enemy.pattern.length]!,
      ) + enemy.strength,
    };
  });
}

/**
 * 从起点 BFS 找到该节点的一条实际路径，累加路径影响。
 * 编辑器据此展示节点真实遭遇语境（影响数值、售价折扣等）。
 */
export function previewPathContext(
  pack: RulePack,
  nodeId: string,
): JourneyContext | null {
  const target = pack.nodes.find((n) => n.id === nodeId);
  if (!target) return null;
  const byId = new Map(pack.nodes.map((n) => [n.id, n]));
  const starts = pack.nodes.filter((n) => n.depth === 0);
  const queue: { id: string; influence: Influence }[] = starts.map((n) => ({
    id: n.id,
    influence: { heat: 0, favor: 0, scarcity: 0 },
  }));
  const seen = new Set<string>();
  while (queue.length) {
    const item = queue.shift()!;
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    const node = byId.get(item.id);
    if (!node) continue;
    const influence = accumulate(item.influence, node.influence);
    if (node.id === nodeId)
      return {
        nodeId: node.id,
        region: node.region,
        depth: node.depth,
        kind: node.kind,
        influence,
      };
    for (const next of node.next)
      if (byId.has(next)) queue.push({ id: next, influence });
  }
  return {
    nodeId: target.id,
    region: target.region,
    depth: target.depth,
    kind: target.kind,
    influence: target.influence,
  };
}

/** 与正式奖励结算完全一致的三选一结果。 */
export function nodeRewardCards(node: RuleNode) {
  return shuffle(node.rewards, hash(node.id)).slice(0, 3);
}

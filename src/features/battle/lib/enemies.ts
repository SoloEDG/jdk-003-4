import type { Actor, JourneyContext } from "@/shared/domain";
import { ruleNode } from "@/features/rules/lib/run";
import { enemyFromRule } from "@/features/rules/lib/preview";
export interface Enemy extends Actor {
  name: string;
  attack: number;
  reward: number;
  pattern: number[];
  blockEvery: number;
  blockAmount: number;
}
export function spawnEnemy(c: JourneyContext): Enemy | null {
  return enemyFromRule(ruleNode(c.nodeId)?.enemy ?? null);
}
export function enemyIntent(enemy: Enemy, turn: number) {
  return (
    Math.floor(
      enemy.attack * enemy.pattern[(turn - 1) % enemy.pattern.length]!,
    ) + enemy.strength
  );
}

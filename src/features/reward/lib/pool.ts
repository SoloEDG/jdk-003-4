import type { JourneyContext } from "@/shared/domain";
import { ruleNode } from "@/features/rules/lib/run";
import { shuffle, hash } from "@/shared/random";
export function rewardPool(context: JourneyContext) {
  const node = ruleNode(context.nodeId);
  const pool = node?.rewards ?? [];
  return shuffle(pool, hash(context.nodeId)).slice(0, 3);
}

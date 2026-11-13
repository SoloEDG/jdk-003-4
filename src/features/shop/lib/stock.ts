import type { JourneyContext } from "@/shared/domain";
import { ruleNode } from "@/features/rules/lib/run";
import { hash } from "@/shared/random";
export interface StockItem {
  id: string;
  card: string;
  basePrice: number;
  sold: boolean;
}
export function makeStock(c: JourneyContext): StockItem[] {
  const node = ruleNode(c.nodeId);
  return (node?.stock ?? []).map((item, i) => ({
    id: `${c.nodeId}-stock-${hash(item.card + i)}-${i}`,
    card: item.card,
    basePrice: item.price,
    sold: false,
  }));
}

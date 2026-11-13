import type { CardInstance } from "@/shared/domain";
import { uid } from "@/shared/random";
import { activeRulePack } from "@/features/rules/lib/run";
import { ruleHero } from "@/shared/rules";
export function starter(): CardInstance[] {
  return activeRulePack().starterDeck.map((key) => ({
    id: uid("card"),
    key,
    upgraded: false,
  }));
}
export function createCard(key: string): CardInstance {
  return { id: uid("card"), key, upgraded: false };
}
export function canRemove(size: number) {
  return size > 5;
}
export function heroStart() {
  return { hp: ruleHero.hp, maxHp: ruleHero.maxHp, gold: ruleHero.gold, scars: 0 };
}

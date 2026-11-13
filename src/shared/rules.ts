import type {
  Influence,
  NodeKind,
  Region,
  RouteNode,
} from "./domain";
import { hash, shuffle, uid } from "./random";

export interface EnemyRule {
  name: string;
  hp: number;
  attack: number;
  /** 每回合攻击倍率，循环使用；第一个值是第 1 回合的意图。 */
  intents: number[];
  strength: number;
  thorns: number;
  poison: number;
  block: number;
  /** 每隔多少回合重置护盾，0 表示不重置。 */
  blockEvery: number;
  blockAmount: number;
  gold: number;
}

export interface StockRule {
  card: string;
  /** 基础标价，实际售价仍会受好感 / 稀缺影响。 */
  price: number;
}

export interface RuleNode extends RouteNode {
  enemy: EnemyRule | null;
  rewards: string[];
  stock: StockRule[];
}

export interface RulePack {
  id: string;
  name: string;
  starterDeck: string[];
  nodes: RuleNode[];
}

export interface RuleVersion {
  id: string;
  label: string;
  createdAt: string;
  pack: RulePack;
}

export interface SharedRulePack {
  format: "ember-path-rulepack";
  schema: 1;
  pack: RulePack;
  versionLabel?: string;
}

export const ruleHero = { hp: 72, maxHp: 72, gold: 80 };

export const nodeKindNames: Record<NodeKind, string> = {
  battle: "战斗",
  elite: "精英",
  shop: "商店",
  camp: "篝火",
  boss: "首领",
};

const defaultRegions: Region[] = ["forest", "forge", "abyss"];
const defaultTitles: Record<NodeKind, string> = {
  battle: "失落哨站",
  elite: "危险的捷径",
  shop: "游商营地",
  camp: "熄风篝火",
  boss: "裂隙守望者",
};
const defaultRewardPools: Record<Region, string[]> = {
  forest: ["venom", "shelter", "guard", "focus"],
  forge: ["strike", "guard", "burst", "fury"],
  abyss: ["venom", "burst", "focus", "fury"],
};
const defaultStockCards = ["venom", "focus", "fury", "burst", "shelter", "guard"];

function kindForDepth(depth: number, lane: number): NodeKind {
  if (depth === 8) return "boss";
  if (depth % 3 === 1) return lane === 0 ? "shop" : "camp";
  return lane === 0 ? "battle" : "elite";
}

function enemyForNode(
  node: Pick<RouteNode, "region" | "depth" | "kind">,
  influence: Influence,
): EnemyRule {
  const elite = node.kind === "elite";
  const boss = node.kind === "boss";
  const hp =
    (boss ? 80 : elite ? 40 : 25) + node.depth * 4 + influence.heat * 2;
  return {
    name: boss
      ? "裂隙守望者"
      : node.region === "forest"
        ? "孢冠巡游者"
        : node.region === "forge"
          ? "熔炉卫兵"
          : "空洞回声",
    hp,
    attack: (elite ? 8 : 5) + Math.floor(node.depth / 2),
    intents: boss ? [1.5, 0.7, 1.2] : [1, 0.7, 1.3],
    strength: Math.floor(influence.heat / 2),
    thorns: node.region === "forge" ? 1 : 0,
    poison: 0,
    block: 0,
    blockEvery: 3,
    blockAmount: 5,
    gold: (elite ? 28 : 18) + influence.heat * 3,
  };
}

function stockForNode(nodeId: string): StockRule[] {
  return shuffle(defaultStockCards, hash(nodeId))
    .slice(0, 3)
    .map((card) => ({
      card,
      price: ["fury", "burst", "focus"].includes(card) ? 48 : 32,
    }));
}

/** 当前内置远征被序列化成一份规则包，作为编辑器与试跑的起点。 */
export function createDefaultRulePack(): RulePack {
  const nodes: RuleNode[] = [];
  for (let depth = 0; depth < 9; depth++) {
    const region = defaultRegions[Math.floor(depth / 3)]!;
    for (let lane = 0; lane < 2; lane++) {
      const kind = kindForDepth(depth, lane);
      const influence =
        lane === 0
          ? { heat: 0, favor: 1, scarcity: 0 }
          : { heat: 1, favor: 0, scarcity: 1 };
      const id = `n${depth}-${lane}`;
      const combat = kind === "battle" || kind === "elite" || kind === "boss";
      nodes.push({
        id,
        region,
        depth,
        lane,
        kind,
        title: defaultTitles[kind],
        influence,
        next: depth === 8 ? [] : [`n${depth + 1}-0`, `n${depth + 1}-1`],
        enemy: combat ? enemyForNode({ region, depth, kind }, influence) : null,
        rewards: combat ? [...defaultRewardPools[region]] : [],
        stock: kind === "shop" ? stockForNode(id) : [],
      });
    }
  }
  return {
    id: "classic-expedition",
    name: "经典远征",
    starterDeck: [
      "strike",
      "strike",
      "strike",
      "guard",
      "guard",
      "venom",
      "focus",
      "shelter",
    ],
    nodes,
  };
}

export function cloneRulePack(pack: RulePack): RulePack {
  return JSON.parse(JSON.stringify(pack)) as RulePack;
}

export function cloneRuleVersion(version: RuleVersion): RuleVersion {
  return JSON.parse(JSON.stringify(version)) as RuleVersion;
}

export function newRulePackId() {
  return uid("pack");
}

export function newRuleVersionId() {
  return uid("rules");
}

function num(value: unknown, fallback: number) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * 外部导入的规则包可能缺字段或类型不对。先补默认值再校验，
 * 避免残缺数据在运行时崩溃；未知卡牌等语义问题交给校验器报告。
 */
export function normalizeRulePack(input: unknown): RulePack {
  const raw = (input ?? {}) as Partial<RulePack>;
  const regions: Region[] = ["forest", "forge", "abyss"];
  const kinds: NodeKind[] = ["battle", "elite", "shop", "camp", "boss"];
  const nodes = Array.isArray(raw.nodes) ? raw.nodes : [];
  return {
    id: typeof raw.id === "string" && raw.id ? raw.id : uid("pack"),
    name: typeof raw.name === "string" && raw.name.trim() ? raw.name : "导入的远征",
    starterDeck: Array.isArray(raw.starterDeck)
      ? raw.starterDeck.filter((k): k is string => typeof k === "string")
      : [],
    nodes: nodes.map((node, index) => {
      const n = (node ?? {}) as Partial<RuleNode>;
      const influence = (n.influence ?? {}) as Partial<Influence>;
      const enemy = n.enemy
        ? {
            name: String((n.enemy as EnemyRule).name ?? "无名敌人"),
            hp: num((n.enemy as EnemyRule).hp, 0),
            attack: num((n.enemy as EnemyRule).attack, 0),
            intents: Array.isArray((n.enemy as EnemyRule).intents)
              ? (n.enemy as EnemyRule).intents.map((v) => num(v, 0))
              : [],
            strength: num((n.enemy as EnemyRule).strength, 0),
            thorns: num((n.enemy as EnemyRule).thorns, 0),
            poison: num((n.enemy as EnemyRule).poison, 0),
            block: num((n.enemy as EnemyRule).block, 0),
            blockEvery: num((n.enemy as EnemyRule).blockEvery, 0),
            blockAmount: num((n.enemy as EnemyRule).blockAmount, 0),
            gold: num((n.enemy as EnemyRule).gold, 0),
          }
        : null;
      return {
        id: typeof n.id === "string" && n.id ? n.id : uid("node"),
        region: regions.includes(n.region as Region) ? (n.region as Region) : "forest",
        depth: Math.max(0, Math.floor(num(n.depth, index))),
        lane: Math.floor(num(n.lane, 0)),
        kind: kinds.includes(n.kind as NodeKind) ? (n.kind as NodeKind) : "battle",
        title: typeof n.title === "string" && n.title ? n.title : "未命名节点",
        influence: {
          heat: num(influence.heat, 0),
          favor: num(influence.favor, 0),
          scarcity: num(influence.scarcity, 0),
        },
        next: Array.isArray(n.next)
          ? n.next.filter((id): id is string => typeof id === "string")
          : [],
        enemy,
        rewards: Array.isArray(n.rewards)
          ? n.rewards.filter((k): k is string => typeof k === "string")
          : [],
        stock: Array.isArray(n.stock)
          ? n.stock
              .filter((s) => s && typeof s === "object")
              .map((s) => ({
                card: String((s as StockRule).card ?? ""),
                price: num((s as StockRule).price, 0),
              }))
          : [],
      };
    }),
  };
}

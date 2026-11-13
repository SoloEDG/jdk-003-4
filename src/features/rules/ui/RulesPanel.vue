<script setup lang="ts">
import { computed, ref } from "vue";
import { cards } from "@/shared/cards";
import { regionNames } from "@/shared/domain";
import {
  nodeKindNames,
  type RuleNode,
  type RulePack,
  type RuleVersion,
} from "@/shared/rules";
import {
  ruleLibrary,
  selectedNode,
  libraryIssues,
  canPublish,
  selectNode,
  renameDraft,
  setPublishLabel,
  updateNode,
  updateInfluence,
  updateEnemy,
  toggleEnemy,
  setIntentPattern,
  toggleLink,
  toggleReward,
  toggleStarterCard,
  addNode,
  removeNode,
  addStock,
  updateStock,
  removeStock,
  startDraft,
  draftFromVersion,
  publishDraft,
  sharedText,
  importShared,
  importAsVersion,
} from "@/features/rules";
import {
  nodeEnemy,
  nodeRewardCards,
  previewPathContext,
  intentsFor,
} from "../lib/preview";
import { activeMainRef, activeRunRef } from "../lib/run";
import { session } from "@/app/session";
import { startTrial, startExpedition, returnToMain } from "@/app/commands";
import { priceFor } from "@/features/shop/lib/pricing";

const emit = defineEmits<{ changed: [] }>();
const share = ref("");
const shareTarget = ref<"draft" | "version">("draft");
const shareVersion = ref("");
const importText = ref("");
const importMode = ref<"draft" | "version">("draft");
const importError = ref("");

const issues = computed(() => libraryIssues());
const blocking = computed(() => issues.value.filter((i) => i.severity === "error"));
const warnings = computed(() => issues.value.filter((i) => i.severity === "warning"));
const node = computed<RuleNode | null>(
  () => (selectedNode() as unknown as RuleNode | null) ?? null,
);
/** 只读视图转成可编辑草稿类型，供预览函数使用。 */
const pack = computed<RulePack | null>(
  () => ruleLibrary.draft as unknown as RulePack | null,
);
const versions = computed<RuleVersion[]>(
  () => ruleLibrary.versions as unknown as RuleVersion[],
);
const enemy = computed(() => (node.value ? nodeEnemy(node.value) : null));
const context = computed(() =>
  pack.value && node.value ? previewPathContext(pack.value, node.value.id) : null,
);
const rewardCards = computed(() =>
  node.value ? nodeRewardCards(node.value) : [],
);
const patternText = computed(() => node.value?.enemy?.intents.join(", ") ?? "");
const combat = computed(
  () =>
    !!node.value &&
    (node.value.kind === "battle" ||
      node.value.kind === "elite" ||
      node.value.kind === "boss"),
);
const shop = computed(() => node.value?.kind === "shop");
const nodeIssueSet = computed(() => {
  const map = new Map<string, number>();
  for (const issue of issues.value)
    for (const id of issue.nodeIds) map.set(id, (map.get(id) ?? 0) + 1);
  return map;
});
const versionOptions = versions;
const currentRule = computed(() => activeRunRef());
const mainRule = computed(() => activeMainRef());

function afterEdit() {
  emit("changed");
}
function setKind(kind: RuleNode["kind"]) {
  if (!node.value) return;
  if (kind === "shop")
    updateNode(node.value.id, { kind, rewards: [], enemy: null });
  else if (kind === "camp")
    updateNode(node.value.id, { kind, rewards: [], stock: [], enemy: null });
  else if (!node.value.enemy) toggleEnemy(node.value.id, true);
  afterEdit();
}
function setPattern(value: string) {
  if (!node.value) return;
  setIntentPattern(node.value.id, value);
  afterEdit();
}
function chooseShare() {
  const version = versions.value.find((v) => v.id === shareVersion.value);
  const source = shareTarget.value === "draft"
    ? (pack.value as RuleVersion | null)
    : version ?? null;
  if (source) share.value = sharedText(source);
}
function copyShare() {
  if (!share.value) chooseShare();
  if (!share.value) return;
  navigator.clipboard?.writeText(share.value).catch(() => undefined);
}
function doImport() {
  importError.value = "";
  const ok =
    importMode.value === "draft"
      ? importShared(importText.value)
      : importAsVersion(importText.value);
  if (!ok) importError.value = ruleLibrary.notice;
  else {
    share.value = "";
    importText.value = "";
  }
  afterEdit();
}
function publish() {
  const version = publishDraft();
  if (version) shareVersion.value = version.id;
  afterEdit();
}
function trial(version: RuleVersion) {
  startTrial(version.id);
  afterEdit();
}
function launch(version: RuleVersion) {
  startExpedition(version.id);
  afterEdit();
}
</script>

<template>
  <section class="panel rules-panel">
    <div class="section-top">
      <span class="eyebrow">06 / THE RULE FORGE</span>
      <span v-if="session.mode === 'trial'" class="trial-tag">试跑中</span>
      <span v-else>正式远征 · {{ currentRule.label }}</span>
    </div>
    <h2>改写远征的骨架</h2>
    <p class="muted">
      草稿可随意修改；发布后冻结成不可变版本。试跑与正式开局都引用版本快照，已开始的远征不会被草稿改变。
    </p>

    <div class="rules-toolbar">
      <label class="field">
        <span>草稿名称</span>
        <input
          :value="pack?.name"
          data-rule="pack-name"
          @input="renameDraft(($event.target as HTMLInputElement).value)"
        />
      </label>
      <button data-action="new-draft" @click="startDraft()">新建草稿</button>
      <button data-action="reset-draft" @click="draftFromVersion(versions.at(-1)?.id ?? '')">
        从最近版本重建
      </button>
    </div>

    <div class="rules-grid">
      <div class="rules-col">
        <h3>地区节点</h3>
        <div class="rule-node-list">
          <button
            v-for="n in pack?.nodes ?? []"
            :key="n.id"
            :data-rule-node="n.id"
            :class="{
              selected: n.id === ruleLibrary.selectedNodeId,
              issue: nodeIssueSet.get(n.id),
            }"
            @click="selectNode(n.id)"
          >
            <b>{{ n.title }}</b>
            <small>{{ n.id }} · {{ nodeKindNames[n.kind] }} · 深度 {{ n.depth }}</small>
            <em v-if="nodeIssueSet.get(n.id)">⚠ {{ nodeIssueSet.get(n.id) }}</em>
          </button>
        </div>
        <p v-if="pack" class="muted tiny">
          {{ pack.nodes.length }} 个节点 · 起始牌组 {{ pack.starterDeck.length }} 张
        </p>
      </div>

      <div v-if="node" class="rules-col node-editor">
        <h3>{{ node.id }}「{{ node.title }}」</h3>
        <label class="field">
          <span>节点名称</span>
          <input
            :value="node.title"
            :data-node-field="'title'"
            @input="updateNode(node.id, { title: ($event.target as HTMLInputElement).value })"
          />
        </label>
        <div class="field-row">
          <label class="field">
            <span>地区</span>
            <select
              :value="node.region"
              data-node-field="region"
              @change="updateNode(node.id, { region: ($event.target as HTMLSelectElement).value as RuleNode['region'] })"
            >
              <option v-for="(label, key) in regionNames" :key="key" :value="key">{{ label }}</option>
            </select>
          </label>
          <label class="field">
            <span>类型</span>
            <select
              :value="node.kind"
              data-node-field="kind"
              @change="setKind(($event.target as HTMLSelectElement).value as RuleNode['kind'])"
            >
              <option v-for="(label, key) in nodeKindNames" :key="key" :value="key">{{ label }}</option>
            </select>
          </label>
          <label class="field short">
            <span>深度</span>
            <input
              type="number"
              :value="node.depth"
              data-node-field="depth"
              @input="updateNode(node.id, { depth: Number(($event.target as HTMLInputElement).value) })"
            />
          </label>
        </div>
        <div class="field-row">
          <label class="field short">
            <span>威胁增量</span>
            <input type="number" :value="node.influence.heat" @input="updateInfluence(node.id, { heat: Number(($event.target as HTMLInputElement).value) })" />
          </label>
          <label class="field short">
            <span>好感增量</span>
            <input type="number" :value="node.influence.favor" @input="updateInfluence(node.id, { favor: Number(($event.target as HTMLInputElement).value) })" />
          </label>
          <label class="field short">
            <span>稀缺增量</span>
            <input type="number" :value="node.influence.scarcity" @input="updateInfluence(node.id, { scarcity: Number(($event.target as HTMLInputElement).value) })" />
          </label>
        </div>

        <h4>连接</h4>
        <div class="link-chips">
          <button
            v-for="n in pack?.nodes ?? []"
            :key="n.id"
            :data-link="n.id"
            :class="{ selected: node.next.includes(n.id) }"
            :disabled="n.id === node.id"
            @click="toggleLink(node.id, n.id); afterEdit()"
          >
            {{ n.id }}
          </button>
        </div>
        <div v-if="node.next.length === 0" class="warn-line">该节点视为终点。</div>

        <h4>遭遇</h4>
        <template v-if="combat">
          <button v-if="!node.enemy" data-action="enable-enemy" @click="toggleEnemy(node.id, true); afterEdit()">添加敌人</button>
          <template v-else>
            <div class="field-row">
              <label class="field">
                <span>敌人名称</span>
                <input :value="node.enemy.name" data-enemy-field="name" @input="updateEnemy(node.id, { name: ($event.target as HTMLInputElement).value }); afterEdit()" />
              </label>
              <label class="field short">
                <span>生命</span>
                <input type="number" :value="node.enemy.hp" data-enemy-field="hp" @input="updateEnemy(node.id, { hp: Number(($event.target as HTMLInputElement).value) }); afterEdit()" />
              </label>
              <label class="field short">
                <span>攻击</span>
                <input type="number" :value="node.enemy.attack" data-enemy-field="attack" @input="updateEnemy(node.id, { attack: Number(($event.target as HTMLInputElement).value) }); afterEdit()" />
              </label>
            </div>
            <div class="field-row">
              <label class="field">
                <span>意图倍率（逗号分隔，循环）</span>
                <input :value="patternText" data-enemy-field="intents" @input="setPattern(($event.target as HTMLInputElement).value)" />
              </label>
              <label class="field short">
                <span>金币</span>
                <input type="number" :value="node.enemy.gold" data-enemy-field="gold" @input="updateEnemy(node.id, { gold: Number(($event.target as HTMLInputElement).value) }); afterEdit()" />
              </label>
            </div>
            <div class="field-row">
              <label class="field short">
                <span>力量</span>
                <input type="number" :value="node.enemy.strength" @input="updateEnemy(node.id, { strength: Number(($event.target as HTMLInputElement).value) }); afterEdit()" />
              </label>
              <label class="field short">
                <span>荆棘</span>
                <input type="number" :value="node.enemy.thorns" @input="updateEnemy(node.id, { thorns: Number(($event.target as HTMLInputElement).value) }); afterEdit()" />
              </label>
              <label class="field short">
                <span>初始中毒</span>
                <input type="number" :value="node.enemy.poison" @input="updateEnemy(node.id, { poison: Number(($event.target as HTMLInputElement).value) }); afterEdit()" />
              </label>
              <label class="field short">
                <span>初始护盾</span>
                <input type="number" :value="node.enemy.block" @input="updateEnemy(node.id, { block: Number(($event.target as HTMLInputElement).value) }); afterEdit()" />
              </label>
            </div>
            <div class="field-row">
              <label class="field short">
                <span>每 N 回合护盾</span>
                <input type="number" :value="node.enemy.blockEvery" @input="updateEnemy(node.id, { blockEvery: Number(($event.target as HTMLInputElement).value) }); afterEdit()" />
              </label>
              <label class="field short">
                <span>护盾量</span>
                <input type="number" :value="node.enemy.blockAmount" @input="updateEnemy(node.id, { blockAmount: Number(($event.target as HTMLInputElement).value) }); afterEdit()" />
              </label>
              <button data-action="disable-enemy" @click="toggleEnemy(node.id, false); afterEdit()">移除敌人</button>
            </div>
            <div class="preview-card" data-preview="enemy">
              <span class="eyebrow">遭遇预览 · 即时应答草稿</span>
              <p v-if="enemy">
                <b>{{ enemy.name }}</b> · {{ enemy.hp }} HP · 攻击 {{ enemy.attack }} · 力量 {{ enemy.strength }}
                · 荆棘 {{ enemy.thorns }} · 基础金币 {{ enemy.reward }}
              </p>
              <p v-if="enemy" class="muted tiny">
                意图：<span v-for="i in intentsFor(enemy)" :key="i.turn">第 {{ i.turn }} 回合 {{ i.amount }} 伤害　</span>
              </p>
              <p v-if="context" class="muted tiny">
                该节点实际遭遇影响：威胁 {{ context.influence.heat }} / 好感 {{ context.influence.favor }} / 稀缺 {{ context.influence.scarcity }}（按起点最短路径）
              </p>
            </div>
          </template>
          <h4>节点奖励池</h4>
          <div class="link-chips">
            <button
              v-for="(spec, key) in cards"
              :key="key"
              :data-reward-card="key"
              :class="{ selected: node.rewards.includes(key) }"
              @click="toggleReward(node.id, key); afterEdit()"
            >
              {{ spec.name }}
            </button>
          </div>
          <p class="muted tiny" data-preview="rewards">
            配置奖励池：<b>{{ node.rewards.map((k) => cards[k]?.name ?? k).join(" / ") || "（空）" }}</b>
            <br />
            实际三选一：<b>{{ rewardCards.map((k) => cards[k]?.name ?? k).join(" / ") || "（奖励池为空）" }}</b>
          </p>
        </template>
        <template v-else-if="shop">
          <h4>商店库存与价格</h4>
          <div
            v-for="(item, index) in node.stock"
            :key="index"
            class="stock-row"
            :data-stock-index="index"
          >
            <select :value="item.card" @change="updateStock(node.id, index, { card: ($event.target as HTMLSelectElement).value }); afterEdit()">
              <option v-for="(spec, key) in cards" :key="key" :value="key">{{ spec.name }}</option>
            </select>
            <input type="number" :value="item.price" @input="updateStock(node.id, index, { price: Number(($event.target as HTMLInputElement).value) }); afterEdit()" />
            <button data-action="remove-stock" @click="removeStock(node.id, index); afterEdit()">×</button>
          </div>
          <button data-action="add-stock" @click="addStock(node.id); afterEdit()">添加一项库存</button>
          <div v-if="node.stock.length" class="preview-card" data-preview="stock-prices">
            <span class="eyebrow">库存预览 · 按本路径实际售价</span>
            <p v-for="(item, index) in node.stock" :key="index">
              {{ cards[item.card]?.name ?? "未知卡牌" }} ·
              标价 {{ item.price }} 金
              <template v-if="context">
                → 实付 {{ priceFor(item.price, context.influence) }} 金
              </template>
            </p>
          </div>
          <p class="muted tiny" data-preview="stock">
            实际售价 = max(12, 标价 + 稀缺 ×5 − 好感 ×3)
            <template v-if="context">
              · 本路径好感 {{ context.influence.favor }} / 稀缺 {{ context.influence.scarcity }}
            </template>
          </p>
        </template>
        <p v-else class="muted tiny">篝火节点不包含遭遇、奖励或库存。</p>

        <button class="danger" data-action="remove-node" @click="removeNode(node.id); afterEdit()">删除节点</button>
      </div>
      <div v-else class="rules-col"><p class="muted">选择左侧节点开始编辑。</p></div>
    </div>

    <div class="rules-grid">
      <div class="rules-col">
        <h3>起始牌组</h3>
        <div class="link-chips">
          <button
            v-for="(spec, key) in cards"
            :key="key"
            :data-starter-card="key"
            :class="{ selected: pack?.starterDeck.includes(key) }"
            @click="toggleStarterCard(key); afterEdit()"
          >
            {{ spec.name }}
          </button>
        </div>
        <p v-if="pack" class="muted tiny" data-preview="starter">
          实际起始牌组：<b>{{ pack.starterDeck.map((k) => cards[k]?.name ?? k).join(" · ") || "（空）" }}</b>
        </p>
        <button data-action="add-node" @click="addNode(); afterEdit()">在末尾新增节点</button>
      </div>
      <div class="rules-col">
        <h3>发布前校验</h3>
        <div data-issues="blocking">
          <p v-if="!blocking.length" class="ok-line">✓ 没有阻止发布的配置。</p>
          <p v-for="(issue, i) in blocking" :key="'e' + i" class="error-line">
            ⚠ {{ issue.message }}
            <template v-if="issue.nodeIds.length">（关联 {{ issue.nodeIds.join("、") }}）</template>
          </p>
          <p v-for="(issue, i) in warnings" :key="'w' + i" class="warn-line">
            ◇ {{ issue.message }}
            <template v-if="issue.nodeIds.length">（关联 {{ issue.nodeIds.join("、") }}）</template>
          </p>
        </div>
        <label class="field">
          <span>版本标签</span>
          <input :value="ruleLibrary.publishLabel" data-rule="version-label" @input="setPublishLabel(($event.target as HTMLInputElement).value)" />
        </label>
        <button data-action="publish" :disabled="!canPublish()" @click="publish">
          发布并冻结版本
        </button>
        <p class="muted tiny">{{ ruleLibrary.notice }}</p>
      </div>
    </div>

    <h3>已发布版本</h3>
    <p v-if="!versionOptions.length" class="muted tiny">还没有版本。</p>
    <div class="version-list">
      <div v-for="version in versionOptions" :key="version.id" :data-version="version.id">
        <div>
          <b>{{ version.label }}</b>
          <small>{{ version.pack.nodes.length }} 节点 · 冻结于 {{ version.createdAt.slice(0, 16).replace('T', ' ') }}</small>
        </div>
        <div class="version-actions">
          <button data-action="clone-version" @click="draftFromVersion(version.id); afterEdit()">复制为草稿</button>
          <button data-action="trial" @click="trial(version)">试跑</button>
          <button data-action="launch" @click="launch(version)">开始正式远征</button>
        </div>
      </div>
    </div>

    <div class="rules-grid">
      <div class="rules-col">
        <h3>分享规则包</h3>
        <div class="field-row">
          <label class="field">
            <span>来源</span>
            <select v-model="shareTarget" data-share-target>
              <option value="draft">当前草稿</option>
              <option value="version">已发布版本</option>
            </select>
          </label>
          <label v-if="shareTarget === 'version'" class="field">
            <span>版本</span>
            <select v-model="shareVersion">
              <option v-for="v in versionOptions" :key="v.id" :value="v.id">{{ v.label }}</option>
            </select>
          </label>
        </div>
        <div class="toolbar">
          <button data-action="build-share" @click="chooseShare(); afterEdit()">生成分享文本</button>
          <button data-action="copy-share" @click="copyShare">复制</button>
        </div>
        <textarea v-model="share" rows="7" data-share-output readonly></textarea>
      </div>
      <div class="rules-col">
        <h3>导入规则包</h3>
        <label class="field">
          <span>导入方式</span>
          <select v-model="importMode" data-import-mode>
            <option value="draft">作为草稿打开</option>
            <option value="version">登记为新版本</option>
          </select>
        </label>
        <textarea v-model="importText" rows="7" data-share-input placeholder="粘贴分享文本"></textarea>
        <div class="toolbar">
          <button data-action="import" @click="doImport">导入</button>
          <button data-action="clear-import" @click="importText = ''; importError = ''">清空</button>
        </div>
        <p v-if="importError" class="error-line">{{ importError }}</p>
      </div>
    </div>

    <div v-if="session.mode === 'trial'" class="notice trial-notice">
      试跑使用「{{ currentRule.label }}」，正式远征仍停留在「{{ mainRule.label }}」。
      <button data-action="return-main" @click="returnToMain(); afterEdit()">返回正式远征</button>
    </div>
  </section>
</template>

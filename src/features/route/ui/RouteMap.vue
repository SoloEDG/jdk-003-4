<script setup lang="ts">
import { computed } from "vue";
import { routeState, choices, previewRoute, routeNodes, routeLength } from "../model/state";
import { regionNames } from "@/shared/domain";
import { activeRunRef } from "@/features/rules/lib/run";
import { session } from "@/app/session";
const emit = defineEmits<{ enter: [id: string] }>();
const allowed = computed(() => choices());
const layers = computed(() => {
  const nodes = routeNodes();
  const maxDepth = nodes.length ? Math.max(...nodes.map((n) => n.depth)) : -1;
  return Array.from({ length: maxDepth + 1 }, (_, d) =>
    nodes.filter((n) => n.depth === d),
  );
});
const symbols = { battle: "⚔", elite: "♜", shop: "⚖", camp: "♨", boss: "◈" };
const rule = computed(() => activeRunRef());
</script>
<template>
  <section class="panel route-panel">
    <div class="section-top">
      <span class="eyebrow">01 / THE PATH</span
      ><span>已走 {{ routeState.visited.length }} / {{ routeLength() }}</span>
    </div>
    <h2>每一步，留下回响</h2>
    <p class="muted">
      林地 → 熔铁边境 → 无声深渊。险路增加敌人力量与稀有奖励，安路积累商人好感。
    </p>
    <div class="route-scroll">
      <div v-for="(layer, d) in layers" :key="d" class="route-row">
        <span class="depth">{{ d + 1 }}</span
        ><button
          v-for="node in layer"
          :key="node.id"
          :data-node="node.id"
          class="route-node"
          :class="{
            available: allowed.includes(node.id),
            visited: routeState.visited.includes(node.id),
          }"
          :disabled="!allowed.includes(node.id)"
          @mouseenter="previewRoute(node.id)"
          @mouseleave="previewRoute('')"
          @click="emit('enter', node.id)"
        >
          <b>{{ symbols[node.kind] }}</b
          ><span
            >{{ node.title }}<small
              >{{ regionNames[node.region] }} ·
              {{ node.next.length ? "通往 " + node.next.join(" / ") : "旅途终点" }}</small
            ></span
          ><i>{{ routeState.visited.includes(node.id) ? "✓" : "↗" }}</i>
        </button>
      </div>
      <p v-if="!layers.length" class="muted">此规则版本没有可走的节点。</p>
    </div>
    <div v-if="routeState.preview" class="notice">
      路途预览 · 威胁 {{ routeState.preview.influence.heat }} / 好感
      {{ routeState.preview.influence.favor }} / 稀缺
      {{ routeState.preview.influence.scarcity }}
    </div>
    <p class="rule-ref">
      规则版本：{{ rule.label }}
      <span v-if="session.mode === 'trial'">（试跑）</span>
    </p>
  </section>
</template>

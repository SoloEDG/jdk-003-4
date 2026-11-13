import { reactive, readonly } from "vue";
import type { Influence, JourneyContext } from "@/shared/domain";
import type { RuleNode } from "@/shared/rules";
import { activeRulePack } from "@/features/rules/lib/run";
import { available, contextFor } from "../lib/rules";
const state = reactive({
  visited: [] as string[],
  resolved: true,
  influence: { heat: 0, favor: 0, scarcity: 0 } as Influence,
  preview: null as JourneyContext | null,
});
export const routeState = readonly(state);
/** 当前远征冻结规则中的路线节点。草稿改动不会影响这里。 */
export function routeNodes(): RuleNode[] {
  return activeRulePack().nodes;
}
export function routeLength() {
  const nodes = routeNodes();
  return nodes.length ? Math.max(...nodes.map((n) => n.depth)) + 1 : 0;
}
/** 终点由连接决定，而不是节点类型：没有后继即为旅途终点。 */
export function isTerminal(id: string) {
  const node = routeNodes().find((n) => n.id === id);
  return !!node && node.next.length === 0;
}
export function choices() {
  return available(routeNodes(), state.visited, state.resolved);
}
export function previewRoute(id: string) {
  const n = routeNodes().find((n) => n.id === id);
  state.preview = n ? contextFor(n, state.influence) : null;
}
export function enterRoute(id: string): JourneyContext | null {
  if (!choices().includes(id)) return null;
  const node = routeNodes().find((n) => n.id === id)!;
  const context = contextFor(node, state.influence);
  state.visited.push(id);
  state.influence = context.influence;
  state.resolved = false;
  state.preview = null;
  return context;
}
export function resolveRoute() {
  state.resolved = true;
}
export function exportRoute() {
  return JSON.parse(
    JSON.stringify({
      visited: state.visited,
      resolved: state.resolved,
      influence: state.influence,
    }),
  );
}
export function restoreRoute(data: ReturnType<typeof exportRoute>) {
  state.visited = data.visited;
  state.resolved = data.resolved;
  state.influence = data.influence;
  state.preview = null;
}
export function resetRoute() {
  state.visited = [];
  state.resolved = true;
  state.influence = { heat: 0, favor: 0, scarcity: 0 };
  state.preview = null;
}

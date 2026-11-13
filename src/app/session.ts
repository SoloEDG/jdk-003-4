import { reactive, readonly } from "vue";
import type { JourneyContext } from "@/shared/domain";
export type SessionMode = "normal" | "trial";
const state = reactive({
  tab: "route",
  context: null as JourneyContext | null,
  message: "在火熄灭之前，找到通向深渊的路。",
  ended: false,
  mode: "normal" as SessionMode,
});
export const session = readonly(state);
export function switchTab(tab: string) {
  state.tab = tab;
}
export function setContext(c: JourneyContext | null) {
  state.context = c;
}
export function notify(message: string) {
  state.message = message;
}
export function finishRun() {
  state.ended = true;
}
export function exportSession() {
  return JSON.parse(JSON.stringify(state));
}
export function restoreSession(d: ReturnType<typeof exportSession>) {
  Object.assign(state, d);
  state.mode = d.mode === "trial" ? "trial" : "normal";
}
export function resetSession(mode: SessionMode = "normal") {
  state.tab = "route";
  state.context = null;
  state.message =
    mode === "trial"
      ? "试跑模式：使用已冻结的规则版本，不影响正式远征。"
      : "新的火种已点燃。";
  state.ended = false;
  state.mode = mode;
}

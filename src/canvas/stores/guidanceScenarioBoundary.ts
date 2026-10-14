/**
 * ⭐ COACHING BELONGS TO ONE DECISION — cleared when the canvas leaves it.
 *
 * Served (R3-B, #72 5894061171, UI `6QzQPIIS`, guest): after "Start new model", the NEW model's Analysis showed
 * "Check an assumption Olumi made … the link from Customer success deployment to NPS change from today", although
 * neither node exists in it, and it survived a cold reload. The live `guidanceStore` was never cleared on a scenario
 * change (`rehydrateGuidance` guards only the sessionStorage adoption at mount), so the previous model's items stayed in
 * memory, were read by the recommender, and were then persisted under the NEW scenario id by the next write.
 *
 * The boundary is the one the conversation's own scenario-switch effect uses (`useConversation.ts`, `wasNull`):
 *  - an id → a DIFFERENT id, or an id → null, leaves the decision: its coaching is cleared (memory AND the persisted
 *    blob, via `clearGuidanceItems`, exactly what `rehydrateGuidance` does to another decision's blob);
 *  - null → an id is the SAME model getting its first id (the turn path and import registration mint one), so the
 *    coaching the first turn delivered is kept.
 */
import { useCanvasStore } from '../store'
import { useGuidanceStore } from './guidanceStore'

/** True when moving from `previous` to `next` leaves a decision. */
export function leavesDecision(previous: string | null | undefined, next: string | null | undefined): boolean {
  const from = previous ?? null
  const to = next ?? null
  return from !== null && from !== to
}

/** Installs the boundary; returns the uninstaller. Called from the canvas mount effect that rehydrates guidance. */
export function installGuidanceScenarioBoundary(): () => void {
  return useCanvasStore.subscribe((state, prev) => {
    if (!leavesDecision(prev.currentScenarioId, state.currentScenarioId)) return
    // Empty live turns and empty delivered records still carry origin that must not cross scenarios.
    useGuidanceStore.getState().clearGuidanceItems()
  })
}

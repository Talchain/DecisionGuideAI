import { useCanvasStore } from '../../canvas/store'
import { clearAllScenarioStorage, crossIdentityBoundaryInThisTab } from '../../canvas/store/scenarios'
// The non-boundary half of the identity-epoch contract, for the auth layer (CAN-F2g, #2516).
export { adoptIdentityEpochAtSignIn } from '../../canvas/store/scenarios'
import { clearAllTranscripts } from '../../canvas/conversation/utils/transcriptStore'
import { clearAllVersions } from '../../canvas/versions/versionStorage'
import { useLayoutStore } from '../../canvas/layoutStore'
import { clearDurableDissent } from '../../canvas/stores/dissentStore'
import { useStrengthenStore } from '../../canvas/stores/strengthenStore'
import { useDecisionRecordStore } from '../../components/results/modals/decisionRecordStore'
import { useSuccessMeasureStore } from '../../components/results/modals/successMeasureStore'
import { useGuidanceStore } from '../../canvas/stores/guidanceStore'
import { clearCitedEvidenceCache } from '../../collab/citedEvidenceCache'
import { clearRoundRosterCache } from '../../collab/roundRosterCache'

/** All browser state that belongs to an authenticated user's reasoning work. */
export const USER_SCOPED_STORAGE_KEYS = [
  'olumi-canvas-scenarios', 'olumi-canvas-autosave', 'olumi-canvas-current-scenario-id',
  'olumi-canvas-model-versions-v1', 'olumi-canvas-transcript',
  'defineSuccess.measure.v1', 'strengthen.lifecycle.v1', 'canvas-layout-options-v6',
  'canvas-layout-options-v5', 'canvas-layout-options-v4', 'olumi-cee-analysis-ready',
  'olumi-cee-analysis-ready-node-ids',
  // An unregistered import's node ids and edge pairs (`importRegistrationMarker.ts`): the previous identity's model shape.
  'olumi.import.pendingServerRegistration.v1',
] as const

// `olumi-canvas-autosave:` — a cold-load deep link's preserved copies (`scenarios.keyedAutosaveKey`): one per scenario,
// unbounded, and as private as the main slot above.
// `canvas-snapshot-` — manual snapshots (⌘S, Model ▸ Snapshots; `persist.saveSnapshot`) and their `-name` keys: whole
// graphs with labels, listed with no owner check (`persist.listSnapshots`), so the next account could restore one.
// `olumi.collab.pending-apply.` / `olumi.collab.open-round.` — a Panel round's pending model change and its participants,
// one per scenario (`collab/panelApplyHandoff.ts`, `collab/openRoundRecord.ts`).
export const USER_SCOPED_STORAGE_PREFIXES = [
  'olumi.dissent.v2.', 'olumi.dissent.', 'olumi-canvas-autosave:', 'canvas-snapshot-',
  'olumi.collab.pending-apply.', 'olumi.collab.open-round.',
] as const

/** Per-tab user work in sessionStorage: the analysis-ready mirror and the coaching blob (`guidanceStore.ts`). */
export const USER_SCOPED_SESSION_KEYS = [
  'olumi-cee-analysis-ready', 'olumi-cee-analysis-ready-node-ids', 'guidance.items.v1',
] as const

function freshIdentityEpoch(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
}

/** One identity boundary for sign-out and A→B auth transitions. */
/** `nextOwner`: the identity this boundary leads to (a user id; `null` = signed out); omitted = not known (the epoch always rotates). */
export function clearUserScopedState(nextOwner?: string | null): void {
  // Each step on its own: one that throws (`clearAllScenarioStorage` removes three keys unguarded) never stops the steps
  // after it, so the storage sweep below always runs.
  const step = (fn: () => void): void => {
    try { fn() } catch { /* the boundary goes on */ }
  }
  // CAN-F2w: a fresh identity epoch FIRST, so a slot this sweep cannot remove is already another identity's and is never
  // restored, remembered or promoted for the next account (`scenarios.IDENTITY_EPOCH_KEY`). The sweep never removes it.
  // CAN-F2g: THIS tab crosses the boundary and owns the resulting epoch (joining one another tab already rotated for
  // the same boundary); every tab that has not crossed it is stale and cannot write.
  step(() => crossIdentityBoundaryInThisTab(freshIdentityEpoch(), nextOwner))
  step(() => useCanvasStore.getState().resetCanvas())
  // The previous identity's graph also lives in undo/redo, the clipboard and the pre-draft snapshot, which `resetCanvas`
  // keeps (its empty-canvas branch keeps the pre-draft snapshot too). Undo, paste or undo-draft would bring it back,
  // and autosave would then write it for the next account (Codex, #2484 round 2).
  // …and its id: `resetCanvas`'s empty-canvas branch keeps `currentScenarioId`, so a late response for the previous
  // identity's scenario would still pass the scenario-id fence and be saved for the next account (Codex, #2484 r3).
  step(() => useCanvasStore.setState({
    history: { past: [], future: [] },
    clipboard: null,
    draftChatPreDraftSnapshot: null,
    currentScenarioId: null,
  }))
  step(clearAllScenarioStorage)
  step(clearAllTranscripts)
  step(clearAllVersions)
  step(() => useLayoutStore.getState().resetForAuth())
  step(clearDurableDissent)
  step(() => useStrengthenStore.getState()._reset())
  step(() => useDecisionRecordStore.getState()._reset())
  step(() => useSuccessMeasureStore.getState()._reset())
  // The coaching on screen is about the previous identity's model, and a later canvas mount adopts whatever the
  // singleton already holds without re-checking its scenario (`guidanceStore.rehydrateGuidance`). Clear it in memory;
  // the blob goes with the session keys below (its own clear needs a mounted canvas to name the scenario).
  step(() => useGuidanceStore.getState().clearGuidanceItems())
  // Panel participants' names and their cited evidence, fetched with the previous owner's token (in memory, 5-min TTL).
  step(clearRoundRosterCache)
  step(clearCitedEvidenceCache)
  // Each removal on its own: one that throws never leaves the keys after it behind (browser storage can be unavailable).
  const remove = (storage: () => Storage, key: string): void => {
    try { storage().removeItem(key) } catch { /* the sweep goes on */ }
  }
  for (const key of USER_SCOPED_STORAGE_KEYS) remove(() => localStorage, key)
  // Enumerate first, then remove: a removal neither shifts the index nor stops the sweep.
  const prefixed: string[] = []
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i)
      if (key && USER_SCOPED_STORAGE_PREFIXES.some(prefix => key.startsWith(prefix))) prefixed.push(key)
    }
  } catch { /* browser storage can be unavailable */ }
  for (const key of prefixed) remove(() => localStorage, key)
  for (const key of USER_SCOPED_SESSION_KEYS) remove(() => sessionStorage, key)
}

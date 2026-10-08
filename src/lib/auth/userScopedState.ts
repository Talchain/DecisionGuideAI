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
import { useServerConversationTurnsStore } from '../../canvas/stores/serverConversationTurnsStore'
import { clearCitedEvidenceCache } from '../../collab/citedEvidenceCache'
import { clearRoundRosterCache } from '../../collab/roundRosterCache'
import { noteIdentityBoundary } from './lapseBoundary'
import { freshIdentityEpoch, sweepUserScopedStorage } from './userScopedKeys'

// The key lists and the storage sweep live in a leaf with no imports, so the lapse boundary can sweep without this chunk
// (`userScopedKeys.ts`). Re-exported here for the boundary's existing readers.
export { USER_SCOPED_STORAGE_KEYS, USER_SCOPED_STORAGE_PREFIXES, USER_SCOPED_SESSION_KEYS } from './userScopedKeys'

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
  // CEE's stored chat turns offered to the panel (`serverConversationTurnsStore`), held in memory and keyed by scenario
  // only: an offer read under the previous identity and not yet taken would be handed to the next account's panel.
  step(() => useServerConversationTurnsStore.setState({ offer: null }))
  // Panel participants' names and their cited evidence, fetched with the previous owner's token (in memory, 5-min TTL).
  step(clearRoundRosterCache)
  step(clearCitedEvidenceCache)
  step(sweepUserScopedStorage)
  // The sweep removed `SIGNED_IN_HERE_KEY`: the next signed-in moment on this page records it again (`lapseBoundary.ts`).
  step(noteIdentityBoundary)
}

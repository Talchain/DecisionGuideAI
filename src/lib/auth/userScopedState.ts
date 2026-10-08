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
import { freshIdentityEpoch, sweepUserScopedSessionStorage, sweepUserScopedStorage } from './userScopedKeys'

// The key lists and the storage sweep live in a leaf with no imports, so the lapse boundary can sweep without this chunk
// (`userScopedKeys.ts`). Re-exported here for the boundary's existing readers.
export { USER_SCOPED_STORAGE_KEYS, USER_SCOPED_STORAGE_PREFIXES, USER_SCOPED_SESSION_KEYS } from './userScopedKeys'

/** One identity boundary for sign-out and A→B auth transitions. */
/** `nextOwner`: the next identity (a user id; `null` = signed out); omitted = unknown (never joins when rotating). */
export function clearUserScopedState(
  nextOwner?: string | null,
  { rotateEpoch = true }: { rotateEpoch?: boolean } = {},
): 'joined' | 'fresh' {
  // Each step on its own: one that throws never stops the memory resets after it; a fresh boundary also completes
  // its shared storage sweep. Joined boundaries reset this tab's memory and sessionStorage.
  const step = (fn: () => void): void => {
    try { fn() } catch { /* the boundary goes on */ }
  }
  // CAN-F2w: a fresh identity epoch FIRST, so a slot this sweep cannot remove is already another identity's and is never
  // restored, remembered or promoted for the next account (`scenarios.IDENTITY_EPOCH_KEY`). The sweep never removes it.
  // CAN-F2g: THIS tab crosses the boundary and owns the resulting epoch (joining one another tab already rotated for
  // the same boundary); every tab that has not crossed it is stale and cannot write.
  let boundary: 'joined' | 'fresh' = 'fresh'
  // A null-session tab that never held a signed-in user still performs its existing local cleanup, without claiming
  // an identity boundary. The provider supplies this tab-local knowledge; the shared era's owner is insufficient.
  if (rotateEpoch) {
    try { boundary = crossIdentityBoundaryInThisTab(freshIdentityEpoch(), nextOwner) } catch { /* cleanup still runs */ }
  }
  const preserveStorage = boundary === 'joined'
  step(() => useCanvasStore.getState().resetCanvas({ preserveStorage }))
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
  if (!preserveStorage) step(clearAllScenarioStorage)
  step(() => clearAllTranscripts({ preserveStorage }))
  if (!preserveStorage) step(clearAllVersions)
  step(() => useLayoutStore.getState().resetForAuth())
  if (!preserveStorage) step(clearDurableDissent)
  if (preserveStorage) step(() => useStrengthenStore.setState({ records: {}, priorityOrder: [] }))
  else step(() => useStrengthenStore.getState()._reset())
  step(() => useDecisionRecordStore.getState()._reset({ preserveStorage }))
  if (preserveStorage) step(() => useSuccessMeasureStore.setState({ isOpen: false, byScenario: {} }))
  else step(() => useSuccessMeasureStore.getState()._reset())
  // The coaching on screen is about the previous identity's model, and a later canvas mount adopts whatever the
  // singleton already holds without re-checking its scenario (`guidanceStore.rehydrateGuidance`). Clear it in memory;
  // the blob goes with the session keys below (its own clear needs a mounted canvas to name the scenario).
  if (preserveStorage) step(() => useGuidanceStore.setState({ guidanceItems: [], activeGuidanceItemId: null, deliveredFrom: null, liveGuidanceAuthored: false }))
  else step(() => useGuidanceStore.getState().clearGuidanceItems())
  // CEE's stored chat turns offered to the panel (`serverConversationTurnsStore`), held in memory and keyed by scenario
  // only: an offer read under the previous identity and not yet taken would be handed to the next account's panel.
  step(() => useServerConversationTurnsStore.setState({ offer: null }))
  // Panel participants' names and their cited evidence, fetched with the previous owner's token (in memory, 5-min TTL).
  step(clearRoundRosterCache)
  step(clearCitedEvidenceCache)
  // Another tab cannot remove this tab's sessionStorage. Joining preserves its shared work, but must discard our
  // previous account's reloadable measure, Strengthen history, guidance and analysis-ready mirrors.
  step(preserveStorage ? sweepUserScopedSessionStorage : sweepUserScopedStorage)
  // This tab crossed the boundary; a fresh sweep removed `SIGNED_IN_HERE_KEY`, while a join preserves shared records.
  step(noteIdentityBoundary)
  return boundary
}

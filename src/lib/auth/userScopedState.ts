import { lockStaleTab } from './staleTabLock'
import { useCanvasStore } from '../../canvas/store'
import { clearAllScenarioStorage, crossIdentityBoundaryInThisTab, getIdentityWriteBlockReason } from '../../canvas/store/scenarios'
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

/** Observer resets happen only after the reload lock, without any shared or session writes. */
export function resetUserScopedMemory(): void { resetUserScopedStores(true) }

function resetUserScopedStores(preserveStorage: boolean): void {
  const step = (fn: () => void): void => { try { fn() } catch { /* each reset remains independent */ } }
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
  // an originator sweeps its blob below; an observer retains it until the boot sidecar check on reload.
  if (preserveStorage) step(() => useGuidanceStore.setState({ guidanceItems: [], activeGuidanceItemId: null, deliveredFrom: null, liveGuidanceAuthored: false }))
  else step(() => useGuidanceStore.getState().clearGuidanceItems())
  // CEE's stored chat turns offered to the panel (`serverConversationTurnsStore`), held in memory and keyed by scenario
  // only: an offer read under the previous identity and not yet taken would be handed to the next account's panel.
  step(() => useServerConversationTurnsStore.setState({ offer: null }))
  // Panel participants' names and their cited evidence, fetched with the previous owner's token (in memory, 5-min TTL).
  step(clearRoundRosterCache)
  step(clearCitedEvidenceCache)
  if (!preserveStorage) {
    step(sweepUserScopedStorage)
    step(noteIdentityBoundary)
  }
}

/** One originating boundary for explicit sign-out, A→B and the first restore-lapse detector. */
export function clearUserScopedState(
  nextOwner: string | null = null,
  { rotateEpoch = true }: { rotateEpoch?: boolean } = {},
): 'fresh' | 'blocked' {
  // A tab that never held a user and had no stored session at boot is an exact no-op.
  if (!rotateEpoch) return 'fresh'
  if (getIdentityWriteBlockReason() === 'stale') {
    lockStaleTab()
    resetUserScopedMemory()
    return 'blocked'
  }
  const boundary = crossIdentityBoundaryInThisTab(freshIdentityEpoch(), nextOwner)
  if (boundary === 'blocked') {
    lockStaleTab()
    resetUserScopedMemory()
    return boundary
  }
  resetUserScopedStores(false)
  return boundary
}

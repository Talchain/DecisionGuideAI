/**
 * ⭐ UNDO AFTER A REOPEN (DL-3 ruling (b), 19 Oct 2026).
 *
 * The journal lives for one visit (`captureUndoReceipt.ts`), so a change made before a reload left Undo with nothing to
 * send (verifier, staging 1e37799f, C2 step 8: approve → cold reopen → Undo, restore ×0). CEE's version list already
 * holds what the journal would have: the current version, and the version it was written over. When the journal holds
 * nothing for this model, the next Undo is rebuilt from that list. No new store.
 *
 * Only a version CEE records as a committed change is stepped back this way. A restore (an Undo, or a Version history
 * restore) never is, so a second press after the rebuilt Undo writes nothing. An initial version, or a lineage CEE
 * does not know, has nothing to go back to.
 */
import type { ListModelVersionsResult } from '../../adapters/cee/modelVersions'
import type { UndoJournalState, UndoReceipt } from './undoJournal'

export const REBUILT_UNDO_LABEL = 'the last saved change'

/** The journal for this model: empty, or one step back from the current version when CEE says what it replaced. */
export function rebuiltUndoJournal(scenarioId: string, list: ListModelVersionsResult): UndoJournalState | null {
  if (list.status !== 'list' || list.currentVersionId === null) return null
  const current = list.versions.find((v) => v.id === list.currentVersionId)
  if (current === undefined || current.provenance !== 'committed_mutation') return null
  const parent = current.parentVersionId
  if (typeof parent !== 'string' || parent.length === 0) return null
  const receipt: UndoReceipt = {
    mutationId: `rebuilt:${current.id}`,
    versionId: current.id,
    fullHash: current.graphIdentityHash,
    undoVersionId: parent,
  }
  return {
    scenarioId,
    head: { versionId: current.id, fullHash: current.graphIdentityHash },
    undo: [{ kind: 'step', gestureId: current.sourceTurnId ?? current.id, label: REBUILT_UNDO_LABEL, first: receipt, last: receipt }],
    redo: [],
    seenMutationIds: [],
  }
}

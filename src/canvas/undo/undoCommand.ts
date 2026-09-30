/**
 * THE CANVAS UNDO / REDO COMMAND — ⌘Z, ⌘⇧Z / ⌘Y, the rail's Undo and the
 * context menu all end here.
 *
 * It is a SAVED change, never a screen revert: CEE's own rule is "undo is
 * 'restore the version the current head names as its undo pointer'"
 * (olumi-assistants-service `assist.v1.scenario-versions.ts`). The journal
 * (`undoJournal.ts`) names the version and the identity the server must still
 * hold; this file calls the existing restore route with them and applies the
 * result through the ONE restore path Version history uses
 * (`versions/applyRestoredModel.ts`).
 *
 * What it refuses, and says so (never queued, never silent):
 *  - a guest / unaddressable scenario — versions need an owned scenario;
 *  - an edit, a turn or another restore still in flight — the head is moving;
 *  - nothing to undo, or a barrier the journal cannot step past;
 *  - a stale head (409) — someone wrote since: the journal is emptied and the
 *    working model is untouched.
 */

import { useCanvasStore } from '../store'
import { restoreModelVersion } from '../../adapters/cee/modelVersions'
import { getSessionIdentity } from '../../lib/supabase'
import { canRestoreSharedVersions } from '../versions/sharedVersionsAvailability'
import { isPersistenceSessionActive } from '../../lib/persistenceSession'
import { editDeliveryHold } from '../registration/editDeliveryHold'
import { applyRestoredGraph, settleRestoredModel } from '../versions/applyRestoredModel'
import { newRestoreMutationId } from '../versions/restoreMutationId'
import { useUndoJournalStore } from './captureUndoReceipt'
import {
  nextRedo,
  nextUndo,
  redoSucceeded,
  restoreRefused,
  undoSucceeded,
  type NextRestore,
} from './undoJournal'
import { logger } from '../../lib/logger'

export type UndoDirection = 'undo' | 'redo'

export type UndoCommandOutcome =
  | 'done'
  | 'nothing'
  | 'barrier'
  | 'busy'
  | 'sign_in_required'
  | 'refused_stale'
  | 'failed'

export const UNDO_NOTICE = {
  nothingToUndo: 'Nothing to undo.',
  nothingToRedo: 'Nothing to redo.',
  barrier: "The last change can't be undone here. Version history can restore an earlier version.",
  busy: 'A change is still being saved. Try again in a moment.',
  signInRequired: 'Undo needs a saved model. Sign in to keep versions of this model.',
  notSaved: "Undo works on a saved model, and this one isn't saved yet.",
  stale:
    "The model changed since your last edit, so Undo can't step back safely. Version history can restore an earlier version.",
  failed: "That couldn't be undone right now. Nothing was changed.",
} as const

function notify(message: string, level: 'info' | 'warning' = 'info'): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('topbar:show-toast', { detail: { message, level } }))
}

/** A turn or restore is in flight. The restore flag is this module's own. */
let restoreInFlight = false

export function isCanvasUndoBusy(): boolean {
  if (restoreInFlight) return true
  const state = useCanvasStore.getState() as unknown as Parameters<typeof editDeliveryHold>[0]
  return editDeliveryHold(state) !== null
}

/** The next step, for enabling a button: never performs anything. */
export function peekCanvasUndo(direction: UndoDirection): NextRestore {
  const { journal } = useUndoJournalStore.getState()
  const scenarioId = useCanvasStore.getState().currentScenarioId
  if (journal.scenarioId !== scenarioId) return { kind: 'nothing' }
  return direction === 'undo' ? nextUndo(journal) : nextRedo(journal)
}

type RestoreResult = Awaited<ReturnType<typeof restoreModelVersion>>
const RETRYABLE: ReadonlySet<RestoreResult['status']> = new Set(['unavailable', 'unusable'])

export async function runCanvasUndo(direction: UndoDirection): Promise<UndoCommandOutcome> {
  const scenarioId = useCanvasStore.getState().currentScenarioId
  // ⭐ THE READER CLASS FIRST, before the journal (Undo S5). A guest's journal is always empty — versions are
  // owned-only (MV001), so no receipt is ever captured — and "Nothing to undo." after a guest's own edit would be
  // untrue. The SAME predicate `ServerVersionsSection` gates its Restore on (`canRestoreSharedVersions`), so undo
  // and Version history can never disagree about who may restore.
  const signedIn = isPersistenceSessionActive()
  // (`scenarioId === null` is already refused by the predicate; stated here so the type narrows below.)
  if (scenarioId === null || !canRestoreSharedVersions({ signedIn, scenarioId })) {
    notify(signedIn ? UNDO_NOTICE.notSaved : UNDO_NOTICE.signInRequired)
    return 'sign_in_required'
  }
  if (isCanvasUndoBusy()) {
    notify(UNDO_NOTICE.busy)
    return 'busy'
  }

  const next = peekCanvasUndo(direction)
  if (next.kind === 'nothing' || next.kind === 'unknown_head') {
    notify(direction === 'undo' ? UNDO_NOTICE.nothingToUndo : UNDO_NOTICE.nothingToRedo)
    return 'nothing'
  }
  if (next.kind === 'barrier') {
    notify(UNDO_NOTICE.barrier)
    return 'barrier'
  }

  const identity = await getSessionIdentity()
  if (!identity.userId) {
    notify(UNDO_NOTICE.signInRequired)
    return 'sign_in_required'
  }

  restoreInFlight = true
  try {
    // ONE mutation id per gesture; the single retry of an unknown outcome
    // reuses it, so a restore that did land is replayed, never repeated.
    const mutationId = newRestoreMutationId()
    const request = () =>
      restoreModelVersion(scenarioId, {
        userId: identity.userId,
        accessToken: identity.accessToken,
        versionId: next.targetVersionId,
        mutationId,
        expectedGraphIdentityHash: next.expectedFullHash,
        label: next.label,
      })
    let result = await request()
    if (RETRYABLE.has(result.status)) result = await request()

    // The scenario may have changed while the restore was on the wire.
    if (useCanvasStore.getState().currentScenarioId !== scenarioId) return 'failed'

    if (result.status === 'restored') {
      applyRestoredGraph(result.graph)
      const { journal } = useUndoJournalStore.getState()
      const head =
        typeof result.fullHash === 'string'
          ? { versionId: result.version.versionId, fullHash: result.fullHash }
          : null
      const moved =
        head === null
          ? restoreRefused(journal) // applied, but the next step's identity is unknown
          : direction === 'undo'
            ? undoSucceeded(journal, next.step, head)
            : redoSucceeded(journal, next.step, head)
      useUndoJournalStore.setState({ journal: moved })
      void settleRestoredModel(scenarioId, identity).catch((error: unknown) => {
        logger.warn('canvas_undo.settle_failed', {
          scenarioId,
          error: error instanceof Error ? error.message : String(error),
        })
      })
      notify(`${direction === 'undo' ? 'Undone' : 'Redone'}: ${next.step.label}.`)
      return 'done'
    }

    if (result.status === 'conflict') {
      useUndoJournalStore.setState({ journal: restoreRefused(useUndoJournalStore.getState().journal) })
      notify(UNDO_NOTICE.stale, 'warning')
      return 'refused_stale'
    }
    if (result.status === 'signInRequired') {
      notify(UNDO_NOTICE.signInRequired)
      return 'sign_in_required'
    }
    logger.warn('canvas_undo.restore_failed', { scenarioId, direction, status: result.status })
    notify(UNDO_NOTICE.failed, 'warning')
    return 'failed'
  } finally {
    restoreInFlight = false
  }
}

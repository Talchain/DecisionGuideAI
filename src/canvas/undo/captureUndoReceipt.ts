/**
 * CAPTURE — feed the undo journal from the turn responses the canvas sent.
 *
 * Called once per settled turn, after the response is routed. The ONLY thing
 * that makes a step undoable is CEE's own `model_version_receipt` on a
 * model-changing system event this canvas sent (see `undoJournal.ts`).
 *
 *  - A canvas edit with a receipt → a journal step.
 *  - A canvas edit WITHOUT a receipt (refused, no-op, guest, versions off) →
 *    nothing. Safe by construction: if it did commit, the head moved without
 *    the journal, and the next restore's identity check refuses it.
 *  - A judgement the journal cannot undo (a prior range, an edge verdict) →
 *    a barrier, so ⌘Z says so instead of reverting an OLDER graph edit.
 *  - Any other turn carrying a receipt (chat, a Run) → a foreign
 *    write: nothing before it can be undone from the canvas.
 *  - An Agent turn whose `_agent.receipts` name the versions it minted (an
 *    approved proposal, an adopted option) → ONE undo step for Olumi's change
 *    (P48, `captureAgentTurnForUndo.ts`).
 */

import { create } from 'zustand'
import {
  EMPTY_UNDO_JOURNAL,
  recordBarrier,
  recordEditReceipt,
  recordForeignWrite,
  type UndoJournalState,
  type UndoReceipt,
} from './undoJournal'
import { isModelChangingSystemEvent } from '../conversation/types'
import { captureAgentTurnForUndo, readAgentTurnReceipts } from './captureAgentTurnForUndo'

export const useUndoJournalStore = create<{ journal: UndoJournalState }>(() => ({
  journal: EMPTY_UNDO_JOURNAL,
}))

/** Judgements CEE records as facts, not graph writes: not undoable from the canvas. */
const UNDOABLE_NEVER_KINDS: ReadonlySet<string> = new Set(['prior_range_edit', 'edge_adjudication'])

/** The four receipt fields the journal needs; `null` if the response carries none. */
export function readUndoReceipt(response: unknown): UndoReceipt | null {
  const r = (response as { model_version_receipt?: unknown } | null | undefined)?.model_version_receipt as
    | { mutation_id?: unknown; version_id?: unknown; full_hash?: unknown; undo_version_id?: unknown }
    | null
    | undefined
  if (r == null) return null
  if (typeof r.mutation_id !== 'string' || typeof r.version_id !== 'string' || typeof r.full_hash !== 'string') {
    return null
  }
  const undo = r.undo_version_id
  if (undo !== null && typeof undo !== 'string') return null
  return { mutationId: r.mutation_id, versionId: r.version_id, fullHash: r.full_hash, undoVersionId: undo }
}

/** A short, plain name for the step: "Undo: <label>". */
export function undoLabelFor(event: { type: string; payload?: unknown }): string {
  const p = (event.payload ?? {}) as Record<string, unknown>
  const quoted = (v: unknown) => (typeof v === 'string' && v.trim().length > 0 ? ` "${v.trim()}"` : '')
  switch (event.type) {
    case 'structural_add':
      return `Add${quoted(p.label)}`
    case 'structural_add_edge':
      return 'Add link'
    case 'structural_delete':
      return Array.isArray(p.removed_node_ids) && p.removed_node_ids.length > 0 ? 'Delete' : 'Remove link'
    case 'structural_rename':
      return `Rename to${quoted(p.label)}`
    case 'factor_value_edit':
      return 'Change value'
    case 'option_intervention_edit':
      return 'Change option setting'
    case 'goal_target_edit':
      return 'Change goal target'
    case 'edge_strength_edit':
      return 'Change link strength'
    default:
      return 'Change'
  }
}

export function captureTurnForUndo(input: {
  readonly scenarioId: string
  readonly turnId: string
  readonly systemEvent: { type: string; payload?: unknown } | undefined
  readonly response: unknown
  /** Groups one gesture's receipts (a node add and its chained link). */
  readonly undoGestureId?: string
}): void {
  const receipt = readUndoReceipt(input.response)
  const { journal } = useUndoJournalStore.getState()
  const event = input.systemEvent

  // P48: the Agent's own versions (`_agent.receipts`) and no `model_version_receipt` → ONE undo step for the change,
  // whatever system event rode with the turn (buddy r1 P1: an exclusive chain skipped them). Async; fail-closed.
  if (receipt === null && readAgentTurnReceipts(input.response).length > 0) {
    void captureAgentTurnForUndo({
      scenarioId: input.scenarioId,
      turnId: input.undoGestureId ?? input.turnId,
      response: input.response,
      ...(event !== undefined && isModelChangingSystemEvent(event.type) ? { label: undoLabelFor(event) } : {}),
    })
    return
  }

  let next: UndoJournalState = journal
  if (event !== undefined && isModelChangingSystemEvent(event.type)) {
    if (receipt === null) return
    next = recordEditReceipt(journal, {
      scenarioId: input.scenarioId,
      receipt,
      gestureId: input.undoGestureId ?? input.turnId,
      label: undoLabelFor(event),
    })
  } else if (event !== undefined && UNDOABLE_NEVER_KINDS.has(event.type)) {
    next = recordBarrier(journal, { scenarioId: input.scenarioId, reason: 'not_undoable' })
  } else if (receipt !== null) {
    next = recordForeignWrite(journal, {
      scenarioId: input.scenarioId,
      head: { versionId: receipt.versionId, fullHash: receipt.fullHash },
    })
  }
  if (next !== journal) useUndoJournalStore.setState({ journal: next })
}

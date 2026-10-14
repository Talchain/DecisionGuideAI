/**
 * CAPTURE — feed the undo journal from the turn responses the canvas sent.
 *
 * Called once per settled turn, after the response is routed. The ONLY thing
 * that makes a step undoable is CEE's own `model_version_receipt` on a
 * model-changing system event this canvas sent (see `undoJournal.ts`).
 *
 *  - A canvas edit with a receipt → a journal step.
 *  - A canvas edit WITHOUT a receipt (refused, no-op, guest, versions off) →
 *    no journal step. Safe by construction: if it did commit, the head moved
 *    without the journal, and the next restore's identity check refuses it.
 *    If CEE's `graph_hash` shows it did commit (a guest), it is still noted as
 *    a canvas-local commit so its analysis re-runs.
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
import { noteCanvasLocalCommit } from '../analysis/useAnalyseAfterCommittedChange'

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

/**
 * CEE's own evidence that a canvas edit with no version receipt committed: the turn's `graph_hash` (the
 * analysis-affecting hash CEE stamps on what it holds) differs from the base the edit was sent against — the event's
 * CAS-checked `base_graph_hash`, else the hash the canvas held at dispatch. Returns the new hash, or `null` when there
 * is no claim: a refusal carries no `graph_hash`, a no-op answers at the base, and no base means nothing to compare.
 */
export function canvasEditMovedServerGraph(
  event: { type: string; payload?: unknown },
  response: unknown,
  serverGraphHashAtDispatch: string | null | undefined,
): string | null {
  const after = (response as { graph_hash?: unknown } | null | undefined)?.graph_hash
  if (typeof after !== 'string' || after.length === 0) return null
  const sentBase = (event.payload as { base_graph_hash?: unknown } | undefined)?.base_graph_hash
  const base = typeof sentBase === 'string' && sentBase.length > 0 ? sentBase : serverGraphHashAtDispatch
  if (typeof base !== 'string' || base.length === 0) return null
  return after === base ? null : after
}

export function captureTurnForUndo(input: {
  readonly scenarioId: string
  readonly turnId: string
  readonly systemEvent: { type: string; payload?: unknown } | undefined
  readonly response: unknown
  /** Groups one gesture's receipts (a node add and its chained link). */
  readonly undoGestureId?: string
  /** CEE's `graph_hash` the canvas held when this turn was sent (`lastServerGraphHash` at dispatch). */
  readonly serverGraphHashAtDispatch?: string | null
}): void {
  const receipt = readUndoReceipt(input.response)
  const { journal } = useUndoJournalStore.getState()
  const event = input.systemEvent

  // P48: the Agent's own versions (`_agent.receipts`) and no `model_version_receipt` → ONE undo step for the change,
  // whatever model-changing event rode with the turn (buddy r1 P1). A judgement the journal cannot undo keeps its
  // barrier first (buddy r2 P1). The step is keyed by the CHAT TURN, so the reply's "Undo this change" binds to it
  // (buddy r2 P1). Async; fail-closed.
  const neverUndoable = event !== undefined && UNDOABLE_NEVER_KINDS.has(event.type)
  const agentReceipts = readAgentTurnReceipts(input.response)
  if (!neverUndoable && receipt === null && (agentReceipts === null || agentReceipts.length > 0)) {
    void captureAgentTurnForUndo({
      scenarioId: input.scenarioId,
      turnId: input.turnId,
      response: input.response,
      ...(event !== undefined && isModelChangingSystemEvent(event.type) ? { label: undoLabelFor(event) } : {}),
    })
    return
  }

  let next: UndoJournalState = journal
  if (event !== undefined && isModelChangingSystemEvent(event.type)) {
    if (receipt === null) {
      // No versions (a guest, versions off): no journal step, but a direct canvas edit CEE saved is still a
      // canvas-local commit, and its analysis must re-run (witness 2026-10-14T174333Z turn #3: a guest's option edit
      // moved CEE's graph a1636315 → 9349dd99 with no receipt, and no Run ever started). The receipt path above and
      // this path are exclusive, so one commit is noted once.
      const committedHash = canvasEditMovedServerGraph(event, input.response, input.serverGraphHashAtDispatch)
      if (committedHash !== null) noteCanvasLocalCommit(committedHash)
      return
    }
    next = recordEditReceipt(journal, {
      scenarioId: input.scenarioId,
      receipt,
      gestureId: input.undoGestureId ?? input.turnId,
      label: undoLabelFor(event),
    })
    // A direct canvas edit CEE saved (a replayed receipt is not a new commit): analysed after it settles.
    if (next !== journal && next.head?.versionId === receipt.versionId) {
      useUndoJournalStore.setState({ journal: next })
      noteCanvasLocalCommit(receipt.versionId)
      return
    }
  } else if (event !== undefined && UNDOABLE_NEVER_KINDS.has(event.type)) {
    next = recordBarrier(journal, { scenarioId: input.scenarioId, reason: 'not_undoable' })
  } else if (receipt !== null) {
    const head = { versionId: receipt.versionId, fullHash: receipt.fullHash }
    // A version holding the very model the head holds (a Run's own turn) changed nothing: the steps stay undoable. Bound
    // by the model's identity hash, the one the restore route checks.
    next = journal.scenarioId === input.scenarioId && journal.head !== null && journal.head.fullHash === receipt.fullHash
      ? { ...journal, head }
      : recordForeignWrite(journal, { scenarioId: input.scenarioId, head })
  }
  if (next !== journal) useUndoJournalStore.setState({ journal: next })
}

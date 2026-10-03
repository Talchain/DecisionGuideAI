/**
 * THE CANVAS UNDO JOURNAL — which saved versions ⌘Z / ⌘⇧Z may restore.
 *
 * Undo is not a screen revert. It is CEE's own rule: "undo is 'restore the
 * version the current head names as its undo pointer'"
 * (olumi-assistants-service `assist.v1.scenario-versions.ts`). Every canvas
 * edit CEE commits on an owned scenario returns a `model_version_receipt`
 * carrying the version it created and the exact pre-edit version
 * (`undo_version_id`). This journal holds ONLY those receipts — the user's own
 * canvas edits — and answers one question: which version to restore, and with
 * which identity the server must still hold for the restore to be safe.
 *
 * PURE. No store, no network, no clock. The command layer (S4) calls the
 * restore route with `nextUndo`/`nextRedo`'s answer and reports the outcome
 * back through `undoSucceeded` / `redoSucceeded` / `restoreRefused`.
 *
 * THE INVARIANTS, and the function that holds each:
 *  - A restore always states the identity the journal last saw as HEAD
 *    (`expectedFullHash`). The server's always-on identity check then refuses
 *    it if anyone — another tab, the Agent, a chat turn — wrote since. Stale
 *    means refuse, never merge.
 *  - A receipt whose `undo_version_id` is not the journal's head means a write
 *    the journal did not see sits between them: history before it is dropped
 *    (`recordEditReceipt`), because stepping back past it would revert it.
 *  - A replayed receipt (same `mutation_id`) is the same write, not a new one.
 *  - A step the journal cannot undo truthfully is a BARRIER, answered with a
 *    notice — never skipped, because skipping would revert an OLDER edit
 *    while the newer one stays.
 *  - One gesture, one step: a link chained to a node add (`gestureId` = the
 *    node add's intent id) is undone together with its node.
 */

export interface UndoReceipt {
  readonly mutationId: string
  readonly versionId: string
  /** The 64-hex identity hash of the model this receipt's version holds. */
  readonly fullHash: string
  /** The exact pre-edit version; `null` means CEE holds no undo version. */
  readonly undoVersionId: string | null
}

export interface UndoStep {
  readonly kind: 'step'
  readonly gestureId: string
  readonly label: string
  /** The oldest receipt of the gesture — its `undoVersionId` is the undo target. */
  readonly first: UndoReceipt
  /** The newest receipt of the gesture — its `versionId` is the redo target. */
  readonly last: UndoReceipt
}

export interface UndoBarrier {
  readonly kind: 'barrier'
  readonly reason: UndoBarrierReason
}

export type UndoBarrierReason =
  /** The first edit on an empty model: CEE holds no version to go back to. */
  | 'no_undo_version'
  /** A committed canvas edit arrived without a receipt. */
  | 'no_receipt'
  /** An action that changes the model but is not a versioned canvas edit. */
  | 'not_undoable'

export interface UndoHead {
  readonly versionId: string
  readonly fullHash: string
}

export interface UndoJournalState {
  readonly scenarioId: string | null
  /** The version the server held after the journal's last write; `null` = unknown. */
  readonly head: UndoHead | null
  readonly undo: readonly (UndoStep | UndoBarrier)[]
  readonly redo: readonly UndoStep[]
  /** Replay dedupe, bounded. */
  readonly seenMutationIds: readonly string[]
}

export const MAX_UNDO_STEPS = 50
const MAX_SEEN = 200

export const EMPTY_UNDO_JOURNAL: UndoJournalState = {
  scenarioId: null,
  head: null,
  undo: [],
  redo: [],
  seenMutationIds: [],
}

function forScenario(state: UndoJournalState, scenarioId: string): UndoJournalState {
  return state.scenarioId === scenarioId ? state : { ...EMPTY_UNDO_JOURNAL, scenarioId }
}

function remember(seen: readonly string[], id: string): readonly string[] {
  const next = [...seen, id]
  return next.length > MAX_SEEN ? next.slice(next.length - MAX_SEEN) : next
}

function capped<T>(items: readonly T[]): readonly T[] {
  return items.length > MAX_UNDO_STEPS ? items.slice(items.length - MAX_UNDO_STEPS) : items
}

/**
 * The user's own canvas edit was committed and CEE returned its receipt.
 * `gestureId` groups receipts of one gesture; `label` names the step for the
 * notice and for the restore's version label ("Undo: <label>").
 */
export function recordEditReceipt(
  state: UndoJournalState,
  input: {
    readonly scenarioId: string
    readonly receipt: UndoReceipt
    readonly gestureId: string
    readonly label: string
  },
): UndoJournalState {
  const s = forScenario(state, input.scenarioId)
  const { receipt } = input
  if (s.seenMutationIds.includes(receipt.mutationId)) return s

  const head: UndoHead = { versionId: receipt.versionId, fullHash: receipt.fullHash }
  const seenMutationIds = remember(s.seenMutationIds, receipt.mutationId)

  if (receipt.undoVersionId === null) {
    return {
      ...s,
      head,
      seenMutationIds,
      undo: capped([...s.undo, { kind: 'barrier', reason: 'no_undo_version' }]),
      redo: [],
    }
  }

  // A write the journal did not see moved the head between its last receipt
  // and this one. Stepping back past it would revert it: drop the older steps.
  const contiguous = s.head !== null && receipt.undoVersionId === s.head.versionId
  const base = contiguous ? s.undo : []

  const top = base[base.length - 1]
  const undo =
    top !== undefined && top.kind === 'step' && top.gestureId === input.gestureId
      ? [...base.slice(0, -1), { ...top, last: receipt }]
      : [...base, { kind: 'step' as const, gestureId: input.gestureId, label: input.label, first: receipt, last: receipt }]

  return { ...s, head, seenMutationIds, undo: capped(undo), redo: [] }
}

/**
 * The model changed in a way the journal cannot undo (a fact edit, a committed
 * edit with no receipt). ⌘Z must answer this with a notice, never step past it.
 */
export function recordBarrier(
  state: UndoJournalState,
  input: { readonly scenarioId: string; readonly reason: UndoBarrierReason },
): UndoJournalState {
  const s = forScenario(state, input.scenarioId)
  return { ...s, undo: capped([...s.undo, { kind: 'barrier', reason: input.reason }]), redo: [] }
}

/**
 * Another writer (the Agent, a chat turn, a registration) committed a version.
 * Nothing before it can be undone from here; the head moves to theirs.
 */
export function recordForeignWrite(
  state: UndoJournalState,
  input: { readonly scenarioId: string; readonly head: UndoHead | null },
): UndoJournalState {
  const s = forScenario(state, input.scenarioId)
  return { ...s, head: input.head, undo: [], redo: [] }
}

export type NextRestore =
  | { readonly kind: 'nothing' }
  | { readonly kind: 'barrier'; readonly reason: UndoBarrierReason }
  | { readonly kind: 'unknown_head' }
  | {
      readonly kind: 'restore'
      readonly step: UndoStep
      readonly targetVersionId: string
      readonly expectedFullHash: string
      readonly label: string
    }

export function nextUndo(state: UndoJournalState): NextRestore {
  const top = state.undo[state.undo.length - 1]
  if (top === undefined) return { kind: 'nothing' }
  if (top.kind === 'barrier') return { kind: 'barrier', reason: top.reason }
  if (state.head === null || top.first.undoVersionId === null) return { kind: 'unknown_head' }
  return {
    kind: 'restore',
    step: top,
    targetVersionId: top.first.undoVersionId,
    expectedFullHash: state.head.fullHash,
    label: `Undo: ${top.label}`,
  }
}

export function nextRedo(state: UndoJournalState): NextRestore {
  const top = state.redo[state.redo.length - 1]
  if (top === undefined) return { kind: 'nothing' }
  if (state.head === null) return { kind: 'unknown_head' }
  return {
    kind: 'restore',
    step: top,
    targetVersionId: top.last.versionId,
    expectedFullHash: state.head.fullHash,
    label: `Redo: ${top.label}`,
  }
}

/** The restore for `nextUndo` committed; `head` is the restore receipt's version. */
export function undoSucceeded(state: UndoJournalState, step: UndoStep, head: UndoHead): UndoJournalState {
  const top = state.undo[state.undo.length - 1]
  if (top !== step) return state
  return { ...state, head, undo: state.undo.slice(0, -1), redo: [...state.redo, step] }
}

/** The restore for `nextRedo` committed; `head` is the restore receipt's version. */
export function redoSucceeded(state: UndoJournalState, step: UndoStep, head: UndoHead): UndoJournalState {
  const top = state.redo[state.redo.length - 1]
  if (top !== step) return state
  return { ...state, head, redo: state.redo.slice(0, -1), undo: capped([...state.undo, step]) }
}

/**
 * The server refused the restore as stale (409): someone wrote since the
 * journal's head. Nothing in the journal is safe any more.
 */
export function restoreRefused(state: UndoJournalState): UndoJournalState {
  return { ...state, head: null, undo: [], redo: [] }
}

export function clearUndoJournal(scenarioId: string | null = null): UndoJournalState {
  return { ...EMPTY_UNDO_JOURNAL, scenarioId }
}

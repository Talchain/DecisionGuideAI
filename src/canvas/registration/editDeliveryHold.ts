/**
 * ⭐⭐ ONE WRITER — the whole-graph registration waits for every Canvas edit.
 *
 * ## The defect this closes (witnessed on served staging, 22 Sep 2026)
 *
 * A factor value edit writes the canvas optimistically and sends a
 * `factor_value_edit` turn. The optimistic write moved the analytical digest, so
 * `useImportRegistration` armed a WHOLE-GRAPH `graph/register` and POSTed it in
 * the SAME millisecond as the edit turn — carrying the user's number under the
 * OLD provenance (`{value: 0.42, source: "cee_inference"}`). CEE's CAS then
 * rejected the edit (`GraphStaleWriteError`, HTTP 500
 * `system_event_commit_failed`), but the register had already stored the
 * user's number as Olumi's estimate. With the register blocked, the same edit
 * committed, settled `user_override` and survived reload.
 *
 * Two writers to one canonical model, and the one without receipts or
 * authorship won the race.
 *
 * ## What this module answers
 *
 * "Is any Canvas edit still between the user and the server?" — and while the
 * answer is yes, no registration may leave. Five signals, each the existing
 * owner of its own window, none re-derived here:
 *
 *  1. a model-changing `system_event` turn is ON THE WIRE — the dispatcher marks
 *     it (`beginModelEditDelivery`, called from `sendSystemEvent`) and releases
 *     it when the turn settles. The only signal that covers EVERY kind.
 *  2. a model edit is QUEUED behind another turn — `store.pendingEmittedEdits`,
 *     which the dispatcher derives from its deferral buffer (and which the flush
 *     PEEKS rather than shifts, so it stays up for the whole deferred dispatch).
 *  3. a structural gesture is CAPTURED but not yet drained —
 *     `store.pendingStructural{Deletes,Renames,Adds,AddEdges}`, written
 *     synchronously with the optimistic write. A rename queued waiting for its
 *     base hash is the case that matters: registering its label would make the
 *     rename's own `expected_label` stale and get it refused.
 *  4. the graph CARRIES a value the server has not confirmed — a node whose
 *     current value is still the one `pendingFactorEdit` records as sent and
 *     unanswered. That register is settled only by an applied receipt or a
 *     revert, so after the untyped 500 (value kept, "couldn't confirm") it
 *     stays up — and a registration must never launder that number into
 *     canonical state under Olumi's name.
 *  5. the graph CARRIES A LINK MAGNITUDE the server has not confirmed — the
 *     edge twin of 4 (`pendingEdgeEdit`). Witnessed 23 Sep 02:49Z: a refused
 *     `edge_strength_edit` left its magnitude on the canvas and, once the wire
 *     mark cleared, the side channel wrote the refused value into CEE. Settled
 *     by the applied receipt (the committed graph shows the magnitude) or by
 *     the carrier: reverted ONLY on a proven no-write, otherwise (500, or a 200
 *     that shows no committed graph) kept on screen and held off the side
 *     channel — absence of a confirmation is not a refusal.
 *
 * ⚠ SIGNAL 4 IS BOUND TO THE GRAPH, NOT TO THE REGISTER'S NON-EMPTINESS. The
 *   register is module-level and not scenario-scoped; "anything pending
 *   anywhere" would hold a DIFFERENT scenario's registration for the life of the
 *   page. The question asked is the one the rule states — does THIS graph carry
 *   an unconfirmed value?
 *
 * ⚠ WHAT THIS DOES NOT COVER, stated so nobody reads more into it:
 *   · the CONVERSE race — an edit dispatched while a registration POST is
 *     already in flight. The edit path does not consult this module. The
 *     receipt-acknowledgement in `optimisticFactorEdit.confirmOptimisticFactorEdit`
 *     removes the post-edit re-registration that made that race common.
 *   (An UNCONFIRMED structural edit after its turn settled — a rename whose
 *   turn 500'd keeps its label — IS covered: `unresolvedStructuralEditOnCanvas`
 *   reads `structuralRenameLifecycle` / `structuralAddLifecycle`. #1892 review.
 *   Its delete twin — a delete whose turn 500'd keeps the deletion — reads
 *   `unconfirmedStructuralDelete`. #1905 residual 1.)
 */
import { useSyncExternalStore } from 'react'

import { useCanvasStore } from '../store'
import { isModelChangingSystemEvent } from '../conversation/types'
import {
  pendingFactorEditValue,
  subscribePendingFactorEdits,
} from '../conversation/pendingFactorEdit'
import {
  graphCarriesUnconfirmedEdgeEdit,
  subscribePendingEdgeEdits,
} from '../conversation/pendingEdgeEdit'
import {
  subscribeUnconfirmedDeletes,
  unconfirmedDeleteStillOnCanvas,
} from '../conversation/unconfirmedStructuralDelete'

/** Model-changing system_event turns currently on the wire. */
let modelEditsOnTheWire = 0

type Listener = () => void
const listeners = new Set<Listener>()

function emit(): void {
  for (const l of [...listeners]) l()
}

/**
 * Mark a system_event turn as on the wire. Returns an IDEMPOTENT release — the
 * caller releases in a `finally`, so every exit (applied, refused, 500, abort,
 * deferred) ends the window exactly once.
 *
 * Non-model-changing kinds (acks, feedback, adjudications) write no graph, so
 * they cannot race a registration and are not counted — the same partition the
 * freshness hold uses (`MODEL_CHANGING_SYSTEM_EVENT_TYPES`).
 */
export function beginModelEditDelivery(eventType: string | undefined): () => void {
  if (!isModelChangingSystemEvent(eventType)) return () => {}
  modelEditsOnTheWire += 1
  emit()
  let released = false
  return () => {
    if (released) return
    released = true
    modelEditsOnTheWire = Math.max(0, modelEditsOnTheWire - 1)
    emit()
  }
}

/** The store slice this module reads. Structural so tests can pass a literal. */
export interface EditDeliveryState {
  readonly nodes: ReadonlyArray<{ id?: unknown; data?: unknown }>
  /** Read by signal 5 only (an unconfirmed link magnitude). */
  readonly edges?: ReadonlyArray<{ id?: unknown; data?: unknown }>
  readonly pendingEmittedEdits?: number
  readonly pendingStructuralDeletes?: ReadonlyArray<unknown>
  readonly pendingStructuralRenames?: ReadonlyArray<unknown>
  readonly pendingStructuralAdds?: ReadonlyArray<unknown>
  readonly pendingStructuralAddEdges?: ReadonlyArray<unknown>
  /** Settled structural attempts. An `unconfirmed` one is an edit CEE has not answered for. */
  readonly structuralRenameLifecycle?: ReadonlyArray<unknown>
  readonly structuralAddLifecycle?: ReadonlyArray<unknown>
  readonly currentScenarioId?: string | null
}

/** Why a registration is being held back. Log vocabulary only — never user copy. */
export type EditDeliveryHold =
  | 'edit_on_the_wire'
  | 'edit_queued'
  | 'structural_edit_queued'
  | 'unconfirmed_value_on_canvas'
  | 'unconfirmed_edge_on_canvas'
  | 'unresolved_structural_edit'

function currentValue(data: unknown): unknown {
  const d = (data ?? {}) as Record<string, unknown>
  const obs = (d.observedState ?? d.observed_state) as Record<string, unknown> | undefined
  return obs?.value
}

/**
 * ⛔ DELIVERY SETTLING IS NOT PROOF CEE ACCEPTED THE EDIT (#1892 review,
 * CHANGES_REQUIRED @ fc0c7d91). A rename whose turn ended in an untyped 500
 * settles `unconfirmed` and — deliberately — keeps its optimistic label (the
 * server may have committed). Once the queue and the wire mark clear, nothing
 * held registration, so the re-arm registered the canvas and CEE stored a label
 * its own edit protocol never confirmed. Reload then showed it as saved.
 *
 * So an `unconfirmed` structural attempt for THIS scenario holds registration
 * for as long as its optimistic state is still what the canvas shows:
 *   · rename — the node still carries the unconfirmed label;
 *   · add    — the added node is still on the canvas.
 * It releases when that state is gone (renamed again, a receipt overlaid CEE's
 * own label, the node removed) or on reload (the lifecycle is not persisted,
 * and the boot merge then shows CEE's graph). Fail closed: an edit nobody
 * confirmed is never promoted to canonical by the side channel.
 */
/**
 * ⛔ WHAT SUPERSEDES AN UNCONFIRMED ATTEMPT — ONLY A LATER COMMIT OF THE SAME
 * STATE (#1892 review, twice).
 *
 *   @ 846997a1 — every `unconfirmed` record held forever: rename "Foo" (500) →
 *     "Bar" (applied) → "Foo" (applied) left the first record matching the
 *     canvas, walling registration off although CEE had applied "Foo".
 *   @ 9dac7d3e — my fix ("only the latest attempt speaks") over-corrected: a
 *     later REFUSAL erased the hold. "Foo" (500) → "Bar" refused, which rolls
 *     the canvas back to the unconfirmed "Foo"; the latest record was the
 *     refusal, nothing held, and the side channel could make "Foo" canonical.
 *
 * The rule: an `unconfirmed` attempt holds while its optimistic state is still
 * on the canvas, UNLESS a later attempt on the same (scenario, node) was
 * `committed` with that SAME state — an authoritative receipt establishing what
 * the canvas shows. A refusal proves nothing about the earlier attempt, and a
 * commit of a different state does not establish this one.
 */
function unconfirmedAttemptsStillStanding(
  records: ReadonlyArray<unknown>,
  sameState: (later: Record<string, unknown>, earlier: Record<string, unknown>) => boolean,
): Array<Record<string, unknown>> {
  type Rec = { status?: unknown; scenarioId?: unknown; intent?: { nodeId?: unknown } }
  const list = records.map((raw) => (raw ?? {}) as Record<string, unknown> & Rec)
  return list.filter((r, i) => {
    if (r.status !== 'unconfirmed' || typeof r.intent?.nodeId !== 'string') return false
    return !list.slice(i + 1).some(
      (later) =>
        later.status === 'committed' &&
        (later.scenarioId ?? null) === (r.scenarioId ?? null) &&
        later.intent?.nodeId === r.intent!.nodeId &&
        sameState(later, r),
    )
  })
}

const labelOfIntent = (r: Record<string, unknown>) => (r.intent as { label?: unknown } | undefined)?.label

function unresolvedStructuralEditOnCanvas(state: EditDeliveryState): boolean {
  const scenario = state.currentScenarioId ?? null
  const labelOf = (id: unknown): unknown => {
    const node = state.nodes.find((n) => n.id === id)
    return node ? (node.data as { label?: unknown } | undefined)?.label : undefined
  }
  const renames = unconfirmedAttemptsStillStanding(
    state.structuralRenameLifecycle ?? [],
    (later, earlier) => labelOfIntent(later) === labelOfIntent(earlier),
  )
  for (const r of renames) {
    if ((r.scenarioId ?? null) !== scenario) continue
    const intent = r.intent as { nodeId?: unknown; label?: unknown }
    if (labelOf(intent.nodeId) === intent.label) return true
  }
  // An add's state is the node's existence: any later committed add of it establishes it.
  const adds = unconfirmedAttemptsStillStanding(state.structuralAddLifecycle ?? [], () => true)
  for (const r of adds) {
    if ((r.scenarioId ?? null) !== scenario) continue
    const nodeId = (r.intent as { nodeId?: unknown }).nodeId
    if (state.nodes.some((n) => n.id === nodeId)) return true
  }
  // The delete twin: an ambiguous 500 / transport loss keeps the deletion on
  // the canvas, and the side channel must not make it canonical
  // (`unconfirmedStructuralDelete.ts`; #1892 review residual row "Delete",
  // #1905 residual 1). Scenario-scoped there, read against THIS graph here.
  return unconfirmedDeleteStillOnCanvas(state)
}

/**
 * Non-null while any Canvas edit is still between the user and the server.
 * Pure over its argument plus the two module-level registers it names.
 */
export function editDeliveryHold(state: EditDeliveryState): EditDeliveryHold | null {
  if (modelEditsOnTheWire > 0) return 'edit_on_the_wire'
  if ((state.pendingEmittedEdits ?? 0) > 0) return 'edit_queued'
  if (
    (state.pendingStructuralDeletes?.length ?? 0) > 0 ||
    (state.pendingStructuralRenames?.length ?? 0) > 0 ||
    (state.pendingStructuralAdds?.length ?? 0) > 0 ||
    (state.pendingStructuralAddEdges?.length ?? 0) > 0
  ) {
    return 'structural_edit_queued'
  }
  if (unresolvedStructuralEditOnCanvas(state)) return 'unresolved_structural_edit'
  for (const node of state.nodes) {
    if (typeof node.id !== 'string') continue
    const pending = pendingFactorEditValue(node.id)
    if (pending !== null && currentValue(node.data) === pending) {
      return 'unconfirmed_value_on_canvas'
    }
  }
  if (graphCarriesUnconfirmedEdgeEdit((state.edges ?? []) as never)) return 'unconfirmed_edge_on_canvas'
  return null
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  const unsubscribePending = subscribePendingFactorEdits(listener)
  const unsubscribePendingEdges = subscribePendingEdgeEdits(listener)
  const unsubscribeDeletes = subscribeUnconfirmedDeletes(listener)
  const unsubscribeStore = useCanvasStore.subscribe(listener)
  return () => {
    listeners.delete(listener)
    unsubscribePending()
    unsubscribePendingEdges()
    unsubscribeDeletes()
    unsubscribeStore()
  }
}

function getSnapshot(): boolean {
  return editDeliveryHold(useCanvasStore.getState() as unknown as EditDeliveryState) !== null
}

/**
 * Reactive form, for effects that must RE-EVALUATE when delivery settles.
 * A primitive snapshot, so `useSyncExternalStore` cannot loop.
 */
export function useEditDeliveryHeld(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
}

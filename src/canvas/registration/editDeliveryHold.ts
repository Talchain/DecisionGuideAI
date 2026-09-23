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
 * answer is yes, no registration may leave. Four signals, each the existing
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
 *   reads `structuralRenameLifecycle` / `structuralAddLifecycle`. #1892 review.)
 */
import { useSyncExternalStore } from 'react'

import { useCanvasStore } from '../store'
import { isModelChangingSystemEvent } from '../conversation/types'
import {
  pendingFactorEditValue,
  subscribePendingFactorEdits,
} from '../conversation/pendingFactorEdit'

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
  readonly pendingEmittedEdits?: number
  readonly pendingStructuralDeletes?: ReadonlyArray<unknown>
  readonly pendingStructuralRenames?: ReadonlyArray<{ readonly baseGraphHash?: string | null } | unknown>
  /** The write base. A queued rename with no base of its own is sendable only once this exists. */
  readonly lastServerGraphHash?: string | null
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
  | 'unresolved_structural_edit'

function currentValue(data: unknown): unknown {
  const d = (data ?? {}) as Record<string, unknown>
  const obs = (d.observedState ?? d.observed_state) as Record<string, unknown> | undefined
  return obs?.value
}

/**
 * Queued renames that CAN be sent — the ones that genuinely stand between the
 * user and the server.
 *
 * ⛔ THE DEADLOCK THIS EXCLUDES (#1893 × #1892). A rename queued while NO write
 * base exists waits for a base. On a scenario CEE has not acknowledged yet, the
 * only thing that can produce that base is a registration's ack (#1893 seeds it
 * from the read that follows). Holding registration for such a rename closes
 * the loop: rename → base → ack → registration → rename. It is not "in
 * delivery" — it cannot be delivered — so it does not hold. The registration
 * that proceeds carries the rename ROLLED BACK (`withQueuedRenamesRolledBack`),
 * so the side channel stays shut and the rename travels the edit protocol once
 * the base arrives.
 */
function sendableQueuedRenames(state: EditDeliveryState): number {
  const queued = state.pendingStructuralRenames ?? []
  if (typeof state.lastServerGraphHash === 'string' && state.lastServerGraphHash.length > 0) {
    return queued.length
  }
  return queued.filter((intent) => {
    const base = (intent as { baseGraphHash?: unknown } | null)?.baseGraphHash
    return typeof base === 'string' && base.length > 0
  }).length
}

/**
 * The graph a registration may send while renames are queued: each queued
 * rename's node at the label CEE is expected to hold (`expectedLabel`), never
 * the unsent new one. The FIRST queued intent per node wins — its
 * `expectedLabel` is the label before any queued rename of that node.
 */
export function withQueuedRenamesRolledBack<N extends { id: string; data?: unknown }>(
  nodes: ReadonlyArray<N>,
  queued: ReadonlyArray<unknown> | undefined,
): ReadonlyArray<N> {
  if (!queued || queued.length === 0) return nodes
  const expected = new Map<string, string>()
  for (const raw of queued) {
    const intent = raw as { nodeId?: unknown; expectedLabel?: unknown } | null
    if (typeof intent?.nodeId !== 'string' || typeof intent.expectedLabel !== 'string') continue
    if (!expected.has(intent.nodeId)) expected.set(intent.nodeId, intent.expectedLabel)
  }
  if (expected.size === 0) return nodes
  return nodes.map((n) =>
    expected.has(n.id)
      ? ({ ...n, data: { ...(n.data as Record<string, unknown>), label: expected.get(n.id) } } as N)
      : n,
  )
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
function unresolvedStructuralEditOnCanvas(state: EditDeliveryState): boolean {
  const scenario = state.currentScenarioId ?? null
  const labelOf = (id: unknown): unknown => {
    const node = state.nodes.find((n) => n.id === id)
    return node ? (node.data as { label?: unknown } | undefined)?.label : undefined
  }
  for (const raw of state.structuralRenameLifecycle ?? []) {
    const r = raw as { status?: unknown; scenarioId?: unknown; intent?: { nodeId?: unknown; label?: unknown } }
    if (r?.status !== 'unconfirmed' || (r.scenarioId ?? null) !== scenario) continue
    if (r.intent && labelOf(r.intent.nodeId) === r.intent.label) return true
  }
  for (const raw of state.structuralAddLifecycle ?? []) {
    const r = raw as { status?: unknown; scenarioId?: unknown; intent?: { nodeId?: unknown } }
    if (r?.status !== 'unconfirmed' || (r.scenarioId ?? null) !== scenario) continue
    if (r.intent && state.nodes.some((n) => n.id === r.intent!.nodeId)) return true
  }
  return false
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
    sendableQueuedRenames(state) > 0 ||
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
  return null
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener)
  const unsubscribePending = subscribePendingFactorEdits(listener)
  const unsubscribeStore = useCanvasStore.subscribe(listener)
  return () => {
    listeners.delete(listener)
    unsubscribePending()
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

/**
 * ⭐⭐ A LINK-STRENGTH EDIT'S LIFE AFTER THE SEND — the edge twin of
 * `pendingFactorEdit` + `optimisticFactorEdit`, kept to the three questions the
 * one-writer seam has to ask of it.
 *
 * ## The defect this closes (witnessed on served staging, 23 Sep 02:49Z)
 *
 * The edge inspector writes the canvas optimistically and sends
 * `edge_strength_edit` (`useEdgeMutations().setStrength`). The carrier had NO
 * lifecycle after the send — its own header: "the sender has no revert
 * lifecycle". So once #1892's on-the-wire hold released, whatever the canvas
 * held went to CEE through the whole-graph `graph/register`:
 *
 *   · a REFUSED edit (409 `GRAPH_DIVERGED`, or a 200 that applied nothing) left
 *     its magnitude on the canvas and the side channel wrote the refused value
 *     into CEE — no receipt, no authorship, "You set this strength" on screen;
 *   · an APPLIED edit's own optimistic write made the pre-receipt canvas look
 *     unacknowledged, so #1895's chain (correctly) did not fire and a
 *     whole-graph registration followed the receipt.
 *
 * ## What this module answers
 *
 *  1. `graphCarriesUnconfirmedEdgeEdit` — does THIS graph show a magnitude the
 *     server has not confirmed? `editDeliveryHold` holds registration while it
 *     does (signal 5, the twin of signal 4 for factor values). Bound to the
 *     graph, not to the register's non-emptiness, for the reason signal 4 is.
 *  2. `withUnconfirmedEdgeEditsRolledBack` — what the canvas would be without
 *     the in-flight writes. The applied-receipt reconcile uses it to extend an
 *     acknowledgement exactly as #1893 rolls back a queued rename: the
 *     optimistic write is the receipt's OWN change, not a stranger.
 *  3. `resolveEdgeEditSettlement` — what the carrier does once the send
 *     settles: confirm, revert, or keep holding.
 *
 * ⚠ WHAT IT DOES NOT DECIDE. Whether the model changed comes from the turn's
 * committed graph (`serverStatedStrengthOf` after the reconcile), never from
 * the send settlement: `'sent'` only says a POST left.
 */
import type { Edge } from '@xyflow/react'

import { useCanvasStore } from '../store'
import { saveAutosave } from '../store/scenarios'
import { autosaveSourceFromStore, projectAutosaveData } from '../store/autosaveProjection'
import { serverStatedStrengthOf } from './edgeServerStatedStrength'
import type { SystemEventSendSettlement } from './settleSystemEventSend'

export interface PendingEdgeEdit {
  readonly edgeId: string
  /** The magnitude sent (`|mean|`) — what the canvas shows while it is pending. */
  readonly sentMagnitude: number
  /** The edge's data BEFORE the optimistic write — what a refusal restores. */
  readonly before: Readonly<Record<string, unknown>>
}

/** Keys the optimistic write can add or change (`setStrength`). A revert restores exactly these. */
const WRITTEN_KEYS = ['weight', 'weightSource', 'direction', 'directionSource'] as const

/** The in-flight edit per edge. A second edit to the same link replaces the first. */
const inFlight = new Map<string, PendingEdgeEdit>()

type Listener = () => void
const listeners = new Set<Listener>()

function emit(): void {
  for (const l of [...listeners]) l()
}

function magnitudeOf(edge: Edge | undefined): number | null {
  const w = (edge?.data as Record<string, unknown> | undefined)?.weight
  return typeof w === 'number' && Number.isFinite(w) ? Math.abs(w) : null
}

/** Record that `sentMagnitude` for `edgeId` is with the engine and unanswered. Called where the send is ADMITTED. */
export function markEdgeEditInFlight(
  edgeId: string,
  sentMagnitude: number,
  before: Readonly<Record<string, unknown>> | undefined,
): void {
  if (!edgeId || !Number.isFinite(sentMagnitude)) return
  const prior = inFlight.get(edgeId)
  // A newer edit to the same link keeps the ORIGINAL pre-edit data: that is
  // what the server still holds while both are unanswered.
  inFlight.set(edgeId, { edgeId, sentMagnitude, before: prior?.before ?? { ...(before ?? {}) } })
  emit()
}

/** End the pending state for `edgeId` — stands down if a newer edit superseded `sentMagnitude`. */
export function settleEdgeEdit(edgeId: string, sentMagnitude: number): boolean {
  const entry = inFlight.get(edgeId)
  if (!entry || entry.sentMagnitude !== sentMagnitude) return false
  inFlight.delete(edgeId)
  emit()
  return true
}

/** Signal 5: does THIS graph show a link magnitude the server has not confirmed? */
export function graphCarriesUnconfirmedEdgeEdit(edges: readonly Edge[]): boolean {
  if (inFlight.size === 0) return false
  for (const entry of inFlight.values()) {
    const edge = edges.find((e) => e.id === entry.edgeId)
    if (edge && magnitudeOf(edge) === entry.sentMagnitude) return true
  }
  return false
}

function revertedData(current: Record<string, unknown>, before: Readonly<Record<string, unknown>>) {
  const out: Record<string, unknown> = { ...current }
  // Explicit `undefined` for a key the edge did not have: the store MERGES
  // `{...e.data, ...updates.data}`, so omitting it would keep the stamp.
  for (const k of WRITTEN_KEYS) out[k] = before[k]
  return out
}

/** The canvas as it would be without the in-flight writes still on it. */
export function withUnconfirmedEdgeEditsRolledBack(edges: readonly Edge[]): Edge[] {
  if (inFlight.size === 0) return edges as Edge[]
  return edges.map((edge) => {
    const entry = inFlight.get(edge.id)
    if (!entry || magnitudeOf(edge) !== entry.sentMagnitude) return edge
    return { ...edge, data: revertedData((edge.data ?? {}) as Record<string, unknown>, entry.before) }
  })
}

function revertEdgeEdit(entry: PendingEdgeEdit): void {
  const store = useCanvasStore.getState()
  const edge = store.edges.find((e) => e.id === entry.edgeId)
  // Only while the canvas still shows the sent magnitude — a person who has
  // moved on keeps what they see.
  if (!edge || magnitudeOf(edge) !== entry.sentMagnitude) return
  // ⚠ A ROLLBACK, NOT A USER EDIT — the same framing the factor revert uses.
  store.beginExternalGraphMutation?.('envelope_apply')
  try {
    store.updateEdge(entry.edgeId, {
      data: revertedData((edge.data ?? {}) as Record<string, unknown>, entry.before),
    } as never)
  } finally {
    store.endExternalGraphMutation?.()
  }
  // The optimistic write is already in the autosave slot; an in-memory-only
  // revert would come back on the next reload (the factor revert's reasoning).
  try {
    saveAutosave(projectAutosaveData(autosaveSourceFromStore(useCanvasStore.getState())))
  } catch {
    // Best-effort: the periodic autosave remains the fallback writer.
  }
}

/**
 * The carrier's settlement, resolved against what the model now holds.
 *
 *   'refused'           → the server certified it wrote nothing: revert.
 *   'sent', confirmed   → the reconciled edge's server-stated strength is the
 *                         sent magnitude: the edit stands.
 *   'sent', unconfirmed → it answered without applying: revert, and say so
 *                         ('refused' drives the panel's "Not recorded" line).
 *   'unverified'/'queued' → it may still land: keep the number AND keep holding
 *                         it off the side channel.
 *   'blocked'           → nothing reached the server: nothing is pending.
 */
export function resolveEdgeEditSettlement(
  edgeId: string,
  sentMagnitude: number,
  settlement: SystemEventSendSettlement,
): SystemEventSendSettlement {
  const entry = inFlight.get(edgeId)
  if (!entry || entry.sentMagnitude !== sentMagnitude) return settlement
  if (settlement === 'unverified' || settlement === 'queued') return settlement
  if (settlement === 'blocked') {
    settleEdgeEdit(edgeId, sentMagnitude)
    return settlement
  }
  if (settlement === 'sent') {
    const edge = useCanvasStore.getState().edges.find((e) => e.id === edgeId)
    const stated = serverStatedStrengthOf(edge?.data as Record<string, unknown> | undefined)
    if (stated && Math.abs(stated.mean) === sentMagnitude) {
      settleEdgeEdit(edgeId, sentMagnitude)
      return 'sent'
    }
  }
  revertEdgeEdit(entry)
  settleEdgeEdit(edgeId, sentMagnitude)
  return 'refused'
}

export function subscribePendingEdgeEdits(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Test-only: forget every pending edge edit. */
export function __resetPendingEdgeEditsForTest(): void {
  inFlight.clear()
  emit()
}

/**
 * ⭐⭐ A LINK-STRENGTH EDIT'S LIFE AFTER THE SEND — the edge twin of
 * `pendingFactorEdit` + `optimisticFactorEdit`, kept to the questions the
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
 *   · a REFUSED edit (409 `GRAPH_DIVERGED`) left its magnitude on the canvas and
 *     the side channel wrote the refused value into CEE — no receipt, no
 *     authorship, "You set this strength" on screen;
 *   · an APPLIED edit's own optimistic write made the pre-receipt canvas look
 *     unacknowledged, so #1895's chain did not fire and a whole-graph
 *     registration followed the receipt (re-witnessed on 4c6ec07b at +58 ms,
 *     its edge WITHOUT the `provenance` CEE had just recorded). That half is
 *     answered at the receipt by `ownOptimisticWrite.ts`, keyed to the turn.
 *
 * ## What this module answers
 *
 *  1. `unconfirmedEdgeEditOnGraph` — does THIS graph show a magnitude the
 *     server has not confirmed? `editDeliveryHold` holds registration while it
 *     does (signal 5, the twin of signal 4 for factor values). Bound to the
 *     graph, not to the register's non-emptiness, for the reason signal 4 is.
 *  2. `resolveEdgeEditSettlement` — what the carrier does once the send
 *     settles: confirm, revert, or keep holding.
 *
 * ⚠ WHAT IT DOES NOT DECIDE. Whether the model changed comes from the turn's
 * committed graph (the applied receipt settles the entry at the reconcile, or
 * `serverStatedStrengthOf` after it), never from the send settlement: `'sent'`
 * only says a POST left.
 *
 * ⛔ AND ABSENCE OF A CONFIRMATION IS NOT A REFUSAL (independent audit of
 * 31880193, which inferred `'refused'` — "Not recorded — Olumi did not take
 * this change" — from a 200 whose committed graph did not show the magnitude).
 * A 200 with no committed graph proves nothing either way; only the producer's
 * own no-write line (`isProvenNoWriteConflict`, surfaced as the `'refused'`
 * settlement) licenses a revert. Everything else keeps the number on screen,
 * takes the cannot-confirm line, and stays off the side channel.
 */
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
  /**
   * The direction sent, set ONLY by a direction edit (`setDirection`). A flip
   * keeps `|mean|`, so every magnitude-keyed test below passes before the
   * server has said anything about the SIGN; with this set, each of them asks
   * the sign too. Absent on a strength edit, which is then judged exactly as
   * before.
   */
  readonly sentDirection?: 'positive' | 'negative'
}

/** Keys the optimistic write can add or change (`setStrength`). A revert restores exactly these. */
export const EDGE_EDIT_WRITTEN_KEYS = ['weight', 'weightSource', 'direction', 'directionSource'] as const

/**
 * Keys a DIRECTION edit writes (`setDirection`) — and so the only keys its
 * refusal may restore. Restoring the strength keys too would undo a strength
 * drag that is still pending beside it (independent review of #1950,
 * 5820664860, scenario B).
 */
export const EDGE_DIRECTION_WRITTEN_KEYS = ['direction', 'directionSource'] as const

/** The keys THIS edit wrote: a direction edit wrote only the direction. */
export function edgeEditWrittenKeys(edit: { readonly sentDirection?: unknown }): readonly string[] {
  return edit.sentDirection !== undefined ? EDGE_DIRECTION_WRITTEN_KEYS : EDGE_EDIT_WRITTEN_KEYS
}

/** The in-flight edit per edge. A second edit to the same link replaces the first. */
const inFlight = new Map<string, PendingEdgeEdit>()

/**
 * ⛔ ONE ENTRY PER EDGE **PER EDIT KIND** — never one per edge (independent
 * review of #1950 at `858d9159`, 5820986154). A flip and a strength drag on the
 * same link are two edits with two settlements. Keyed by edge alone, whichever
 * came second REPLACED the first: the first's refusal then reverted nothing,
 * its hold ended when the second settled, and its sign check was skipped
 * ("Sent" on a flip the model never took). Keyed by kind, each settlement finds
 * its own entry. A newer edit of the SAME kind still replaces the older one.
 */
type EdgeEditKind = 'strength' | 'direction'
const kindOf = (sentDirection: unknown): EdgeEditKind => (sentDirection !== undefined ? 'direction' : 'strength')
const entryKey = (edgeId: string, kind: EdgeEditKind) => `${kind}\u0000${edgeId}`

type Listener = () => void
const listeners = new Set<Listener>()

function emit(): void {
  for (const l of [...listeners]) l()
}

export function edgeMagnitudeOf(edge: { data?: unknown } | undefined): number | null {
  const w = (edge?.data as Record<string, unknown> | undefined)?.weight
  return typeof w === 'number' && Number.isFinite(w) ? Math.abs(w) : null
}

/** The direction the canvas shows — `'positive'` when unstated (UI-SEM-029's default). */
function edgeDirectionOf(edge: { data?: unknown } | undefined): 'positive' | 'negative' {
  return (edge?.data as Record<string, unknown> | undefined)?.direction === 'negative' ? 'negative' : 'positive'
}

/**
 * Does the canvas still show this pending write? A strength edit: its
 * magnitude. A DIRECTION edit: its SIGN, and only its sign — its
 * `sentMagnitude` is the SERVER's `|mean|` (`edgeStrengthEdit.ts`, "THE
 * MAGNITUDE IS THE SERVER'S, NOT THE CANVAS'S"), which the canvas weight need
 * not equal: an unconfirmed strength drag beside the flip is the natural case,
 * and comparing the two left a refused flip on screen (5820664860, A and B).
 */
export function edgeShowsPendingWrite(
  edge: { data?: unknown } | undefined,
  entry: { readonly sentMagnitude: number; readonly sentDirection?: 'positive' | 'negative' },
): boolean {
  if (!edge) return false
  if (entry.sentDirection !== undefined) return edgeDirectionOf(edge) === entry.sentDirection
  return edgeMagnitudeOf(edge) === entry.sentMagnitude
}

/** Record that `sentMagnitude` for `edgeId` is with the engine and unanswered. Called where the send is ADMITTED. */
export function markEdgeEditInFlight(
  edgeId: string,
  sentMagnitude: number,
  before: Readonly<Record<string, unknown>> | undefined,
  sentDirection?: 'positive' | 'negative',
): void {
  if (!edgeId || !Number.isFinite(sentMagnitude)) return
  const key = entryKey(edgeId, kindOf(sentDirection))
  const prior = inFlight.get(key)
  // A newer edit of the SAME KIND keeps the ORIGINAL pre-edit data of the edit
  // it replaces: that is what the server still holds while both are
  // unanswered. The rule is the same for both kinds, because with per-kind
  // entries a flip's predecessor can only be another flip, whose value is
  // optimistic (5821294085: "decreases" then "increases", both refused, ended
  // on the first flip's unconfirmed sign). A first flip beside a pending strength
  // drag has no same-kind predecessor, so it keeps the direction on screen when
  // it was pressed — which is what a drag that crossed zero needs (scenario C).
  inFlight.set(key, {
    edgeId,
    sentMagnitude,
    before: prior?.before ?? { ...(before ?? {}) },
    ...(sentDirection !== undefined ? { sentDirection } : {}),
  })
  emit()
}

/**
 * End the pending state for `edgeId` — stands down if a newer edit superseded
 * this one. A direction edit and a strength edit at the same magnitude are
 * different edits: the sign is part of the match.
 */
export function settleEdgeEdit(
  edgeId: string,
  sentMagnitude: number,
  sentDirection?: 'positive' | 'negative',
): boolean {
  const key = entryKey(edgeId, kindOf(sentDirection))
  const entry = inFlight.get(key)
  if (!entry || entry.sentMagnitude !== sentMagnitude || entry.sentDirection !== sentDirection) return false
  inFlight.delete(key)
  emit()
  return true
}

/**
 * Signal 5: the first edge of THIS graph showing a link magnitude the server
 * has not confirmed, or `null`. Returns WHICH link (it was a boolean) so the
 * hold sentence can name it (`heldReason`); no copy here.
 */
export function unconfirmedEdgeEditOnGraph(edges: ReadonlyArray<{ id?: unknown; data?: unknown }>): string | null {
  if (inFlight.size === 0) return null
  for (const entry of inFlight.values()) {
    const edge = edges.find((e) => e.id === entry.edgeId)
    if (edgeShowsPendingWrite(edge, entry)) return entry.edgeId
  }
  return null
}


/**
 * `current` with the keys the strength write touches put back as they were in
 * `before`. Explicit `undefined` for a key the edge did not have: the store
 * MERGES `{...e.data, ...updates.data}`, so omitting it would keep the stamp.
 */
export function edgeDataWithStrengthWriteUndone(
  current: Readonly<Record<string, unknown>>,
  before: Readonly<Record<string, unknown>>,
  keys: readonly string[] = EDGE_EDIT_WRITTEN_KEYS,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...current }
  for (const k of keys) out[k] = before[k]
  return out
}

/**
 * The keys THIS entry's refusal restores. A strength edit also writes the
 * direction keys (the signed slider can cross zero), but while a FLIP on the
 * same link is pending the direction is the flip's: the flip settles it, and a
 * strength refusal restoring it would undo a flip the model may already hold
 * (5820986154, scenario D).
 */
function revertKeysFor(entry: PendingEdgeEdit): readonly string[] {
  const keys = edgeEditWrittenKeys(entry)
  if (entry.sentDirection !== undefined) return keys
  if (!inFlight.has(entryKey(entry.edgeId, 'direction'))) return keys
  return keys.filter((k) => !(EDGE_DIRECTION_WRITTEN_KEYS as readonly string[]).includes(k))
}

function revertEdgeEdit(entry: PendingEdgeEdit): void {
  const store = useCanvasStore.getState()
  const edge = store.edges.find((e) => e.id === entry.edgeId)
  // Only while the canvas still shows the sent write — a person who has
  // moved on keeps what they see.
  if (!edge || !edgeShowsPendingWrite(edge, entry)) return
  // ⚠ A ROLLBACK, NOT A USER EDIT — the same framing the factor revert uses.
  store.beginExternalGraphMutation?.('envelope_apply')
  try {
    store.updateEdge(entry.edgeId, {
      data: edgeDataWithStrengthWriteUndone(
        (edge.data ?? {}) as Record<string, unknown>,
        entry.before,
        revertKeysFor(entry),
      ),
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
 *   'refused'             → the server certified it wrote nothing (a proven
 *                           no-write 409): revert, and say "Not recorded".
 *   'sent', confirmed     → the committed graph showed the sent magnitude —
 *                           either the applied receipt already settled the
 *                           entry at the reconcile (`ownOptimisticWrite`), or
 *                           the reconciled edge's server-stated strength is the
 *                           sent magnitude: the edit stands.
 *   'sent', unconfirmed   → it answered WITHOUT a committed graph showing the
 *                           edit. That is NOT evidence of a no-write (audit of
 *                           31880193): keep the number, keep holding it off the
 *                           side channel, and report `'unverified'` — the
 *                           cannot-confirm line, never "Not recorded".
 *   'unverified'/'queued' → it may still land: keep the number AND keep holding
 *                           it off the side channel.
 *   'blocked'             → nothing reached the server: nothing is pending.
 */
export function resolveEdgeEditSettlement(
  edgeId: string,
  sentMagnitude: number,
  settlement: SystemEventSendSettlement,
  sentDirection?: 'positive' | 'negative',
): SystemEventSendSettlement {
  const entry = inFlight.get(entryKey(edgeId, kindOf(sentDirection)))
  if (!entry || entry.sentMagnitude !== sentMagnitude || entry.sentDirection !== sentDirection) return settlement
  if (settlement === 'unverified' || settlement === 'queued') return settlement
  if (settlement === 'blocked') {
    settleEdgeEdit(edgeId, sentMagnitude, sentDirection)
    return settlement
  }
  if (settlement === 'refused') {
    revertEdgeEdit(entry)
    settleEdgeEdit(edgeId, sentMagnitude, sentDirection)
    return 'refused'
  }
  // 'sent' — for a direction edit the SIGN must be the model's too: a flip
  // keeps `|mean|`, so the magnitude alone is already true before it lands.
  const edge = useCanvasStore.getState().edges.find((e) => e.id === edgeId)
  const stated = serverStatedStrengthOf(edge?.data as Record<string, unknown> | undefined)
  if (
    stated &&
    Math.abs(stated.mean) === sentMagnitude &&
    (sentDirection === undefined || stated.effect_direction === sentDirection)
  ) {
    settleEdgeEdit(edgeId, sentMagnitude, sentDirection)
    return 'sent'
  }
  return 'unverified'
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

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
  /**
   * WHICH LINK, IN WHICH SCENARIO, `before` describes — recorded by a strength edit (`setStrength`). A restoration
   * borrows `before`'s stamps only while this still names the link (Codex #2489 r2 P1: a same-id link re-pointed, or
   * another scenario, must not inherit a departed link's provenance).
   */
  readonly identity?: PendingEdgeEditIdentity
}

export interface PendingEdgeEditIdentity {
  readonly scenarioId: string | null
  readonly from: string
  readonly to: string
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

/**
 * ⭐ F1 (red team #87 6006627551; DL ruling, cut 5) — A STRENGTH MOVE ANSWERED AT THE SAME ANALYSIS HASH DID NOT LAND.
 *
 * CEE refuses a move on a link that holds the user's own figure with a 200 and its own words ("This link holds your
 * figure: …") and writes nothing. A 200 alone proves nothing (audit 31880193: keep the number, say we cannot
 * confirm). What DOES prove it: the reply's `graph_hash` — CEE's analysis-affecting projection, which reads every
 * link strength — equals the hash the canvas held when it sent (`lastServerGraphHash`, captured on the send), while
 * the send MOVED the server-stated strength. The model provably does not hold the move, so the pill must not keep
 * showing it: the settlement reverts it and the panel shows CEE's own words. A stale or absent base never matches, so
 * every other reply fails closed to today's `'unverified'`.
 */
const producerRefusals = new Map<string, { readonly sentMagnitude: number; readonly sentDirection?: 'positive' | 'negative'; readonly text: string }>()
/** The producer's words for the latest refused strength edit on each link, read once by the panel. */
const refusalTextByEdge = new Map<string, string>()

export interface AnsweredEdgeEdit {
  readonly edgeId: string
  readonly sentMagnitude: number
  readonly sentDirection?: 'positive' | 'negative'
  /** `lastServerGraphHash` when the edit was sent; absent/null = no claim possible. */
  readonly baseGraphHash?: string | null
}

/** Whether this reply PROVES the in-flight strength move did not land (see the block above). */
export function edgeEditAnsweredUnmoved(edit: AnsweredEdgeEdit, responseGraphHash: unknown): boolean {
  const base = edit.baseGraphHash
  if (typeof base !== 'string' || base.length === 0 || responseGraphHash !== base) return false
  const entry = inFlight.get(entryKey(edit.edgeId, kindOf(edit.sentDirection)))
  if (!entry || entry.sentMagnitude !== edit.sentMagnitude || entry.sentDirection !== edit.sentDirection) return false
  // The ORIGINAL pre-edit data — what the server held when the first unanswered edit left.
  const stated = serverStatedStrengthOf(entry.before as Record<string, unknown>)
  if (!stated) return false
  return Math.abs(stated.mean) !== edit.sentMagnitude
    || (edit.sentDirection !== undefined && stated.effect_direction !== edit.sentDirection)
}

/** Record the producer's refusal of this exact in-flight edit; its settlement then reverts it. */
export function noteEdgeEditNotApplied(edit: AnsweredEdgeEdit, text: string): void {
  const key = entryKey(edit.edgeId, kindOf(edit.sentDirection))
  const entry = inFlight.get(key)
  if (!entry || entry.sentMagnitude !== edit.sentMagnitude || entry.sentDirection !== edit.sentDirection) return
  producerRefusals.set(key, {
    sentMagnitude: edit.sentMagnitude,
    ...(edit.sentDirection !== undefined ? { sentDirection: edit.sentDirection } : {}),
    text: text.trim(),
  })
}

/** The producer's words for the latest refused strength edit on `edgeId`, once; `null` if none. */
export function takeEdgeEditRefusalText(edgeId: string): string | null {
  const text = refusalTextByEdge.get(edgeId) ?? null
  refusalTextByEdge.delete(edgeId)
  return text
}

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
  identity?: PendingEdgeEditIdentity,
): void {
  if (!edgeId || !Number.isFinite(sentMagnitude)) return
  const key = entryKey(edgeId, kindOf(sentDirection))
  const prior = inFlight.get(key)
  producerRefusals.delete(key)
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
    // The identity travels with the `before` it describes: a newer edit keeps the original's.
    ...((prior ? prior.identity : identity) !== undefined ? { identity: prior ? prior.identity : identity } : {}),
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
 * ⭐ IS THIS LINK SETTLED — does the canvas show exactly the strength the server states, with no edit of its own
 * pending? (Codex on DGAI #2489 @c23042b5, P1.) Only then is choosing the server's value AGREEMENT. Otherwise it is a
 * RESTORATION — the server holds 0.4, 0.75 is on the wire, the user picks 0.4 — and the canvas must move back, through
 * the edit path's supersession, rebase and settlement, rather than be left showing 0.75.
 * A `direction` the canvas does not state is not a disagreement (a magnitude-only link).
 */
export function edgeShowsServerStatedStrength(edge: { id?: unknown; data?: unknown } | undefined): boolean {
  if (!edge || typeof edge.id !== 'string') return false
  if (inFlight.has(entryKey(edge.id, 'strength')) || inFlight.has(entryKey(edge.id, 'direction'))) return false
  const data = edge.data as Record<string, unknown> | undefined
  const stated = serverStatedStrengthOf(data)
  if (!stated || edgeMagnitudeOf(edge) !== Math.abs(stated.mean)) return false
  return data?.direction === undefined || data.direction === stated.effect_direction
}

/**
 * The provenance stamps a RESTORATION puts back: each taken from a pending edit's pre-edit data ONLY while that data
 * still describes the link's current authoritative state for that field — the same scenario and endpoints, the same
 * server tuple, and (for `weightSource`) its weight showing that tuple, (for `directionSource`) its direction showing
 * that sign. A stamp from a superseded state is never restored onto the current one (Codex #2489 r2/r3 P1); a key
 * with no describing snapshot is left out, so its stamp stands. While a direction edit is pending it owns the
 * direction keys (`revertKeysFor`), so `directionSource` is read from ITS pre-edit data.
 */
export function restoredEdgeStrengthStamps(
  edgeId: string,
  current: PendingEdgeEditIdentity & { readonly data: Record<string, unknown> | undefined },
  opts: { readonly includeDirection: boolean },
): Record<string, unknown> {
  const now = serverStatedStrengthOf(current.data)
  if (!now) return {}
  const describesNow = (entry: PendingEdgeEdit | undefined): entry is PendingEdgeEdit => {
    const id = entry?.identity
    if (!entry || !id || id.scenarioId !== current.scenarioId || id.from !== current.from || id.to !== current.to) return false
    const then = serverStatedStrengthOf(entry.before as Record<string, unknown>)
    return !!then && then.mean === now.mean && then.effect_direction === now.effect_direction
  }
  const out: Record<string, unknown> = {}
  const strength = inFlight.get(entryKey(edgeId, 'strength'))
  if (describesNow(strength) && edgeMagnitudeOf({ data: strength.before }) === Math.abs(now.mean)) {
    out.weightSource = strength.before.weightSource
  }
  if (opts.includeDirection) {
    const owner = inFlight.get(entryKey(edgeId, 'direction')) ?? strength
    if (describesNow(owner) && (owner.before.direction === undefined || owner.before.direction === now.effect_direction)) {
      out.directionSource = owner.before.directionSource
    }
  }
  return out
}

/**
 * What a Model-tab Review showed for a link, captured with its "from" (Codex #2489 P1): the endpoints, the server's
 * tuple and whether the canvas then showed exactly that. A confirmation ratifies THIS, never a re-read of the link.
 */
export interface ReviewedEdgeStrength {
  /** The scenario the Review was made in (Codex #2489 r2 P1): a same-id link in another scenario is not the one reviewed. */
  readonly scenarioId: string | null
  readonly from: string
  readonly to: string
  readonly mean: number
  readonly effect_direction: 'positive' | 'negative'
  readonly settled: boolean
}

export function reviewedEdgeStrengthOf(
  edge: { id?: unknown; source?: unknown; target?: unknown; data?: unknown } | undefined,
  scenarioId: string | null,
): ReviewedEdgeStrength | null {
  if (!edge || typeof edge.source !== 'string' || typeof edge.target !== 'string') return null
  const stated = serverStatedStrengthOf(edge.data as Record<string, unknown> | undefined)
  if (!stated) return null
  return {
    scenarioId,
    from: edge.source,
    to: edge.target,
    mean: stated.mean,
    effect_direction: stated.effect_direction,
    settled: edgeShowsServerStatedStrength(edge),
  }
}

/** Does the link still show exactly what a settled Review showed — same scenario, endpoints and server tuple, still settled? */
export function edgeStillShowsReview(
  edge: { id?: unknown; source?: unknown; target?: unknown; data?: unknown } | undefined,
  reviewed: ReviewedEdgeStrength,
  scenarioId: string | null,
): boolean {
  const now = reviewedEdgeStrengthOf(edge, scenarioId)
  return (
    now !== null && reviewed.settled && now.settled && now.scenarioId === reviewed.scenarioId &&
    now.from === reviewed.from && now.to === reviewed.to &&
    now.mean === reviewed.mean && now.effect_direction === reviewed.effect_direction
  )
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
  // ⭐ F1: the reply proved the move did not land (`edgeEditAnsweredUnmoved`) — a proven no-write, so the same
  // revert as a refusal, and the panel says the producer's own words.
  const key = entryKey(edgeId, kindOf(sentDirection))
  const refusedByProducer = producerRefusals.get(key)
  if (refusedByProducer && refusedByProducer.sentMagnitude === sentMagnitude && refusedByProducer.sentDirection === sentDirection) {
    producerRefusals.delete(key)
    revertEdgeEdit(entry)
    settleEdgeEdit(edgeId, sentMagnitude, sentDirection)
    if (refusedByProducer.text !== '') refusalTextByEdge.set(edgeId, refusedByProducer.text)
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
  producerRefusals.clear()
  refusalTextByEdge.clear()
  emit()
}

/**
 * modelEditCompletion — the PER-EDIT COMPLETION LEDGER.
 *
 * This is the receipt-bearing tail that `useModelEditAuthority`'s header has
 * pointed at since the 16 Aug mount train ("when the receipt-bearing
 * transaction API lands, this seam is where it plugs in") and that
 * `model-tab-v2/contracts.ts` §1 declared as `EditProposalHandle` and left
 * explicitly unimplemented. It is the implementation of that tail.
 *
 * ⚠⚠ THIS IS NOT A SECOND STORE, AND NOTHING MAY BUILD A PARALLEL ONE.
 * The PUBLIC interface is `useModelEditAuthority` — this module is its retained
 * state, in the same way `optimisticFactorEdit.ts` is the dispatcher's. It is a
 * module-scoped singleton for exactly ONE reason, contract point (4): a React
 * hook's state dies with the component, and the Model panel unmounts whenever
 * the user switches tabs. An outcome that vanishes because the panel remounted
 * is the defect this ledger exists to close (Codex's #1033 review: "remount can
 * expose optimistic user-edited without receipt").
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⭐⭐ THE LOAD-BEARING RULE: `committed` IS NOT REACHABLE FROM A RECEIPT.
 * ─────────────────────────────────────────────────────────────────────────────
 * A receipt says the server BELIEVES it applied the edit. It is not evidence
 * that the model HOLDS the value. The estate has the measured counter-example:
 * CEE `edit-graph.ts:2986-2992` wrote the user's number to a dead `data/value`
 * key while `observed_state.value` never moved, and the turn reported the edit
 * APPLIED — four false successes, pinned by
 * `persisted-false-success-2026-07-23.test.ts`. The UI's own
 * `responseAppliedFactorEdit` cannot see it either, and by design: it FAILS SAFE
 * TOWARD APPLIED (an unattributable patch counts as ours) because a false revert
 * would destroy accepted work. That is the right rule for deciding whether to
 * revert. It is the WRONG rule for deciding whether to tell the user "saved".
 *
 * So the phases are split, and the split IS the interface:
 *
 *   pending    → dispatched; nothing has answered.
 *   receipted  → a receipt arrived. NOT a success. The value on screen is still
 *                the optimistic one, and the false-success class lives here.
 *   committed  → a COLD READ of the persisted store proves the model holds the
 *                attempted value. Carries the canonical value and source.
 *   refused    → an authoritative refusal, OR a receipt that a cold read
 *                CONTRADICTED. Both are "the model does not hold your number",
 *                which is the only thing the user needs to be told.
 *   unresolved → we do not know and must not guess (transport uncertainty, an
 *                interrupted turn, or a local-only write with no server at all).
 *
 * The cold read is the known-good shape, witnessed:
 *   `POST /bff/cee/scenarios/<id>/graph` body `{}` → `raw_value 0.85,
 *   source user_override` (contrast arm on the same node: `value 0.5,
 *   cee_inference`). `fetchScenarioGraph` in `adapters/cee/scenarioGraph.ts`
 *   is that client; this module never fetches, it only ADJUDICATES the bytes.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠ WHY `provenance: "user_set"` IS NOT EVIDENCE OF ANYTHING
 * ─────────────────────────────────────────────────────────────────────────────
 * It is tempting, and it is theatre. `user_set` is NOT a member of
 * `OBSERVED_STATE_SOURCE_LITERALS` (derived at the pinned schemas dist, with a
 * contrast control: `user_set` → 0 hits, `user_override` → 3 hits in the same
 * sweep, so the probe was not blind). It lives on `NodeV3.provenance`, whose own
 * schema declares it RESPONSE-ONLY, RECOMPUTED ON EVERY RESPONSE. A field the
 * producer regenerates per response cannot witness that anything persisted, so a
 * completion signal derived from it would report "saved" for a value the store
 * never took. `CanonicalFactorValue.source` is read from `observed_state.source`
 * and from nowhere else — see `readCanonicalFactorValue`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CORRELATION (contract point 1) — why an attempt id and not a "last edit" flag
 * ─────────────────────────────────────────────────────────────────────────────
 * A per-node "last edit" flag cannot answer "which attempt is this?" when the
 * user edits A, switches to B, and A's answer lands late. The attempt id is
 * minted at dispatch and rides to the settle points on `OptimisticFactorEdit` —
 * the snapshot that ALREADY travels with the send through the deferral buffer,
 * so a deferred flush and an immediate dispatch correlate through one carrier
 * rather than two that must stay in sync. A late answer for a superseded attempt
 * settles THAT attempt and cannot touch a newer one; see `settle`'s terminal
 * guard.
 */

/** Opaque per-attempt correlation token. Minted here; never parsed by a caller. */
export type ModelEditAttemptId = string

/**
 * What the PERSISTED store holds — read from a cold read, never from a receipt
 * and never from `NodeV3.provenance`.
 */
export interface CanonicalFactorValue {
  /** Model-scale `observed_state.value`. */
  readonly value: number | null
  /** User-unit `observed_state.raw_value` — the number a person recognises. */
  readonly rawValue: number | null
  /** `observed_state.source` VERBATIM. Never `provenance`. */
  readonly source: string | null
}

export type ModelEditCompletion =
  /** Dispatched. Nothing has answered. */
  | { readonly phase: 'pending' }
  /**
   * A receipt arrived and nothing has contradicted it — but no canonical
   * evidence has confirmed it either. ⚠ NOT A SUCCESS. Rendering this as
   * "saved" is exactly the false-success defect.
   */
  | { readonly phase: 'receipted' }
  /** A cold read proves the model holds the attempted value. */
  | { readonly phase: 'committed'; readonly canonical: CanonicalFactorValue }
  /**
   * The model does not hold the attempted value. Either the authority refused,
   * or a receipt was contradicted by the cold read. `canonical` is what the
   * model holds INSTEAD, when a cold read established it.
   */
  | {
      readonly phase: 'refused'
      readonly reason: string
      readonly canonical: CanonicalFactorValue | null
    }
  /** Unknown, and must not be guessed either way. */
  | { readonly phase: 'unresolved'; readonly reason: string }

export interface ModelEditAttempt {
  readonly attemptId: ModelEditAttemptId
  /** The factor this attempt addressed — the `target_id` the wire event named. */
  readonly nodeId: string
  /** The scenario the attempt was dispatched under. Scopes A→B→A recovery. */
  readonly scenarioId: string | null
  /** MODEL-SCALE number that was SENT (`event.payload.value`). */
  readonly attemptedValue: number
  /** USER-UNIT magnitude that was sent, when the event carried one. */
  readonly attemptedRawValue: number | null
  readonly completion: ModelEditCompletion
}

// ─────────────────────────────────────────────────────────────────────────────
// The ledger
// ─────────────────────────────────────────────────────────────────────────────

const attempts = new Map<ModelEditAttemptId, ModelEditAttempt>()
const listeners = new Set<() => void>()
let version = 0
let seq = 0

function emit(): void {
  version += 1
  for (const listener of listeners) listener()
}

/** `useSyncExternalStore` subscribe half. */
export function subscribeModelEditCompletion(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * `useSyncExternalStore` snapshot half — a VERSION COUNTER, deliberately.
 *
 * Returning the Map would hand React a new identity on every read (or a stable
 * one that never signals a change); a monotonic integer is cheap, stable
 * between writes, and cannot lie about whether something moved.
 */
export function getModelEditCompletionVersion(): number {
  return version
}

/**
 * A terminal phase is FINAL. A late answer for an attempt that already settled
 * cannot re-open it, which is what stops A's slow reply from overwriting a
 * newer A attempt (or being mistaken for B's).
 */
function isTerminal(completion: ModelEditCompletion): boolean {
  return (
    completion.phase === 'committed' ||
    completion.phase === 'refused' ||
    completion.phase === 'unresolved'
  )
}

/** Mint an attempt. Called by the authority at dispatch, before the send. */
export function beginModelEditAttempt(input: {
  nodeId: string
  scenarioId: string | null
  attemptedValue: number
  attemptedRawValue?: number | null
}): ModelEditAttemptId {
  seq += 1
  const attemptId: ModelEditAttemptId = `mea_${seq}_${Math.random().toString(36).slice(2, 10)}`
  attempts.set(attemptId, {
    attemptId,
    nodeId: input.nodeId,
    scenarioId: input.scenarioId,
    attemptedValue: input.attemptedValue,
    attemptedRawValue: input.attemptedRawValue ?? null,
    completion: { phase: 'pending' },
  })
  emit()
  return attemptId
}

function settle(
  attemptId: ModelEditAttemptId | null | undefined,
  completion: ModelEditCompletion,
): void {
  if (!attemptId) return
  const existing = attempts.get(attemptId)
  if (!existing) return
  // Terminal is final — see `isTerminal`.
  if (isTerminal(existing.completion)) return
  attempts.set(attemptId, { ...existing, completion })
  emit()
}

/**
 * A receipt arrived. ⚠ THIS IS NOT A SUCCESS — it moves the attempt to
 * `receipted` and waits for canonical evidence. See the header.
 */
export function recordModelEditReceipt(attemptId: ModelEditAttemptId | null | undefined): void {
  settle(attemptId, { phase: 'receipted' })
}

/** An authoritative refusal: the reply carried no applied patch for this target. */
export function refuseModelEditAttempt(
  attemptId: ModelEditAttemptId | null | undefined,
  reason: string,
  canonical: CanonicalFactorValue | null = null,
): void {
  settle(attemptId, { phase: 'refused', reason, canonical })
}

/** We do not know: transport uncertainty, an interrupted turn, no server at all. */
export function markModelEditUnresolved(
  attemptId: ModelEditAttemptId | null | undefined,
  reason: string,
): void {
  settle(attemptId, { phase: 'unresolved', reason })
}

export function getModelEditAttempt(
  attemptId: ModelEditAttemptId | null | undefined,
): ModelEditAttempt | null {
  if (!attemptId) return null
  return attempts.get(attemptId) ?? null
}

/** Every attempt against one node in one scenario, oldest first. */
export function modelEditAttemptsForNode(
  nodeId: string,
  scenarioId: string | null,
): readonly ModelEditAttempt[] {
  const out: ModelEditAttempt[] = []
  for (const attempt of attempts.values()) {
    if (attempt.nodeId === nodeId && attempt.scenarioId === scenarioId) out.push(attempt)
  }
  return out
}

// ─────────────────────────────────────────────────────────────────────────────
// Canonical adjudication — the discriminator
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Are these two magnitudes the same number?
 *
 * A RELATIVE epsilon, not `===`: both sides have been through JSON and, on the
 * model-scale basis, through a divide-by-cap, so exact equality would report a
 * float artefact as a refusal — and a false refusal on an accepted edit is the
 * expensive direction. The tolerance is nowhere near any real divergence (the
 * measured false-success arm was 0.85 against 0.5). Same shape and same reason
 * as `optimisticFactorEdit.sameMagnitude`; not imported because that one is
 * module-private there and a shared export would couple two settle paths that
 * answer different questions (trap 21).
 */
function sameMagnitude(a: number, b: number): boolean {
  return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b))
}

function readNumber(field: unknown): number | null {
  return typeof field === 'number' && Number.isFinite(field) ? field : null
}

/**
 * Read one factor's canonical value out of a cold-read graph.
 *
 * ⚠ `source` COMES FROM `observed_state.source` AND NOWHERE ELSE. Both casings
 * are read because CEE and the legacy paths write either, but `provenance` is
 * NOT consulted at any casing — see the header for why `user_set` proves
 * nothing. Returns `null` when the node is absent or carries no observed state:
 * "I could not tell" is a distinct answer from "it did not move", and conflating
 * them would manufacture a refusal out of an unreadable graph.
 */
export function readCanonicalFactorValue(
  graph: unknown,
  nodeId: string,
): CanonicalFactorValue | null {
  if (!nodeId) return null
  const nodes = (graph as { nodes?: unknown })?.nodes
  if (!Array.isArray(nodes)) return null
  for (const raw of nodes) {
    const node = (raw ?? {}) as Record<string, unknown>
    if (node.id !== nodeId) continue
    const data = (node.data ?? node) as Record<string, unknown>
    const observed = (data.observed_state ?? data.observedState ?? node.observed_state) as
      | Record<string, unknown>
      | undefined
    if (!observed || typeof observed !== 'object') return null
    return {
      value: readNumber(observed.value),
      rawValue: readNumber(observed.raw_value ?? observed.rawValue),
      source: typeof observed.source === 'string' ? observed.source : null,
    }
  }
  return null
}

/**
 * ⭐ THE DISCRIMINATOR. Settle one attempt against canonical evidence.
 *
 * The test is written against the SPEC — "does the persisted model hold the
 * number this attempt sent?" — and not against the failure mode that motivated
 * it, so it is symmetric: a receipt whose value never landed refuses, and a
 * genuine commit commits, through one predicate rather than a special case for
 * the defect in hand.
 *
 * The comparison prefers `raw_value` when BOTH sides state one (that is the
 * user-unit magnitude, the number the person actually typed) and falls back to
 * model-scale `value`. A cold read that establishes neither returns without
 * settling: an unreadable graph is not evidence of refusal.
 */
export function settleModelEditAttemptFromCanonical(
  attemptId: ModelEditAttemptId | null | undefined,
  canonical: CanonicalFactorValue | null,
): void {
  if (!attemptId) return
  const attempt = attempts.get(attemptId)
  if (!attempt) return
  if (isTerminal(attempt.completion)) return
  if (!canonical) return

  const attemptedRaw = attempt.attemptedRawValue
  let held: number | null
  let sent: number
  if (attemptedRaw !== null && canonical.rawValue !== null) {
    held = canonical.rawValue
    sent = attemptedRaw
  } else if (canonical.value !== null) {
    held = canonical.value
    sent = attempt.attemptedValue
  } else {
    // Nothing comparable — say nothing rather than manufacture a verdict.
    return
  }

  if (held !== null && sameMagnitude(held, sent)) {
    settle(attemptId, { phase: 'committed', canonical })
    return
  }
  settle(attemptId, {
    phase: 'refused',
    reason: 'The model did not take this change.',
    canonical,
  })
}

/**
 * Settle every unsettled attempt for one scenario against a cold-read graph.
 *
 * This is the entry point a canonical read calls. It walks the ledger rather
 * than taking a list, so a caller cannot settle a subset and leave the rest
 * looking pending forever.
 */
export function settleModelEditAttemptsFromCanonicalGraph(
  scenarioId: string | null,
  graph: unknown,
): void {
  for (const attempt of [...attempts.values()]) {
    if (attempt.scenarioId !== scenarioId) continue
    if (isTerminal(attempt.completion)) continue
    settleModelEditAttemptFromCanonical(
      attempt.attemptId,
      readCanonicalFactorValue(graph, attempt.nodeId),
    )
  }
}

/** TEST SEAM ONLY. Module state is process-wide; specs must start from empty. */
export function __resetModelEditCompletionLedger(): void {
  attempts.clear()
  listeners.clear()
  seq = 0
  version = 0
}

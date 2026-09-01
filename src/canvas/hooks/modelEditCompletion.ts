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
 * ⚠⚠ AND THE SAME REASONING RUNS IN BOTH DIRECTIONS — WHICH THE FIRST CUT OF
 * THIS MODULE GOT WRONG (review of #1057, F3). It distrusted the receipt for
 * "saved" and then made that identical channel the SOLE AND FINAL authority for
 * "not saved": a receipt-derived `refused` was terminal, so canonical evidence
 * could never correct it. `responseAppliedFactorEdit` returns `false` when
 * `blocks` is not an array, and when every patch carries a NOT_APPLIED status —
 * a set that includes `'pending'`, i.e. a queued-then-applied patch. That minted
 * a permanent false accusation about the user's own model. Two opposite harms
 * under one predicate (trap 22b). So a receipt-derived refusal is now
 * PROVISIONAL, exactly as `receipted` is.
 *
 * The phases, and which are open to correction:
 *
 *   pending    → dispatched; the receipt channel has not answered.       (open)
 *   receipted  → a receipt arrived. NOT a success.                       (open)
 *   refused(receipt)   → the reply carried no applied patch. Provisional. (open)
 *   committed          → a cold read proves the model holds it.      (TERMINAL)
 *   refused(canonical) → cold reads prove it does not.               (TERMINAL,
 *                        but only after MIN_CANONICAL_READS_BEFORE_REFUSAL —
 *                        see below)
 *   unresolved         → no answer is coming.                        (TERMINAL)
 *
 * ⚠⚠ AND THE THIRD TIME THE SAME LESSON ARRIVED: A CANONICAL REFUSAL WAS
 * TERMINAL ON THE **FIRST** READ, WHICH RACED CEE'S WRITE-BACK.
 * Measured on deployed CEE `915da5a3`: an edit's value appears in the cold-read
 * projection at **t+1s**, and `runConfirmation` issues read 0 with NO delay —
 * so read 0 routinely sees the model BEFORE the write lands. A freshly drafted
 * graph carries no `observed_state` on any un-edited factor at all (0 of 3 at
 * t+50s), so `noValue` is the DEFAULT state a first edit is adjudicated
 * against. The result was a permanent "The model holds no value for this
 * factor" on edits that had just succeeded.
 *
 * This is the F2 harm through a different door. F2 declines bytes read BEFORE
 * the receipt; these bytes are read AFTER it and are still too early, because
 * the receipt says CEE ACCEPTED the edit, never that it has FINISHED PERSISTING
 * it. An ordering guard over the receipt cannot see a write-back window.
 * A refusal must now survive a re-read. `committed` need not — see
 * `MIN_CANONICAL_READS_BEFORE_REFUSAL` for why the asymmetry is sound.
 *
 * The cold read is the known-good shape, witnessed:
 *   `POST /bff/cee/scenarios/<id>/graph` body `{}` → `raw_value 0.85,
 *   source user_override` (contrast arm on the same node: `value 0.5,
 *   cee_inference`). `fetchScenarioGraph` in `adapters/cee/scenarioGraph.ts`
 *   is that client; this module never fetches, it only ADJUDICATES the bytes.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⭐ ORDERING — WHY EVERY ADJUDICATION NEEDS A `readIssuedAt`
 * ─────────────────────────────────────────────────────────────────────────────
 * (review of #1057, F2.) Boot hydration's read can still be in flight when the
 * user commits an edit: `scenarioGraph.ts:82-92` bounds it at 8s × 3 attempts,
 * and the `absent` retry schedule spans 100 seconds, all while the canvas is
 * interactive ("hydration is an improvement on what is already on screen, never
 * a precondition for it"). Those bytes PRE-DATE the edit. Adjudicating against
 * them settles an accepted edit `refused` — permanently.
 *
 * The scenario guard proves WHICH scenario the bytes describe. It proves nothing
 * about WHEN they were read, and the settle needs both. So both sides carry a
 * tick from ONE monotonic source — this module's own counter, which is already
 * incremented on every ledger event and needs no clock, no wire field and no
 * agreement between machines. An attempt is adjudicated only when the read was
 * ISSUED strictly after the receipt channel answered; otherwise it stays
 * `receipted`, which is the honest phase and already exists.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚠ WHY `provenance: "user_set"` IS NOT EVIDENCE OF ANYTHING
 * ─────────────────────────────────────────────────────────────────────────────
 * It is tempting, and it is theatre. `user_set` is not a member of the declared
 * vocabulary — read verbatim from the pinned dist rather than counted, because
 * A HIT COUNT CAN NEVER ESTABLISH ENUM MEMBERSHIP IN EITHER DIRECTION (and the
 * first cut of this comment cited counts that did not reproduce: default `rg`
 * honours ignore rules and never enters `dist/`, so it reported 0 where the
 * tree holds 30):
 *
 *   OBSERVED_STATE_SOURCE_LITERALS = ["brief_extraction", "explicit",
 *     "cee_inference", "inferred", "cee_repair", "user_override",
 *     "user_confirmed", "user", "user_edited", "user_calibration",
 *     "user_assumption", "panel_elicited"]      // graph.d.ts — `user_set` absent
 *
 * `user_set` lives on `NodeV3.provenance`, whose schema declares it
 * RESPONSE-ONLY, RECOMPUTED ON EVERY RESPONSE. A field the producer regenerates
 * per response cannot witness that anything persisted, so a completion signal
 * derived from it would report "saved" for a value the store never took.
 * `CanonicalFactorValue.source` is read from `observed_state.source` and from
 * nowhere else — see `readCanonicalFactor`.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * CORRELATION (contract point 1) — why an attempt id and not a "last edit" flag
 * ─────────────────────────────────────────────────────────────────────────────
 * A per-node "last edit" flag cannot answer "which attempt is this?" when the
 * user edits A, switches to B, and A's answer lands late. The attempt id is
 * minted at dispatch and rides to the settle points on `OptimisticFactorEdit` —
 * the snapshot that ALREADY travels with the send through the deferral buffer,
 * so a deferred flush and an immediate dispatch correlate through one carrier
 * rather than two that must stay in sync.
 */

/** Opaque per-attempt correlation token. Minted here; never parsed by a caller. */
export type ModelEditAttemptId = string

/**
 * A tick from this module's monotonic counter. The ONLY ordering source in the
 * completion path — see the ordering note in the header. Not a clock, not
 * comparable to anything outside this module.
 */
export type LedgerTick = number

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

/**
 * Where a settled answer came from.
 *
 * ⚠ LOAD-BEARING ON `refused`: a `receipt` refusal is PROVISIONAL and canonical
 * evidence may overturn it; a `canonical` refusal is terminal. See the header.
 */
export type CompletionEvidence = 'receipt' | 'canonical'

export type ModelEditCompletion =
  /** Dispatched. The receipt channel has not answered. */
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
   * The model does not hold the attempted value. `canonical` is what it holds
   * INSTEAD, when a cold read established it.
   */
  | {
      readonly phase: 'refused'
      readonly reason: string
      readonly evidence: CompletionEvidence
      readonly canonical: CanonicalFactorValue | null
    }
  /** No answer is coming, and none may be guessed. */
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
  /** Tick at dispatch. */
  readonly dispatchedAt: LedgerTick
  /**
   * Tick at which the RECEIPT CHANNEL answered, or `null` while it has not.
   * A cold read may only adjudicate this attempt if it was ISSUED after this —
   * see the ordering note in the header.
   */
  readonly receiptChannelAt: LedgerTick | null
  /**
   * How many cold reads have delivered EVIDENCE ABOUT THIS NODE (i.e. anything
   * other than `unreadable`). The count a canonical REFUSAL must clear before it
   * is believed — see `MIN_CANONICAL_READS_BEFORE_REFUSAL`.
   */
  readonly canonicalReadsSeen: number
  readonly completion: ModelEditCompletion
}

/**
 * ⭐⭐ HOW MANY CANONICAL READS A REFUSAL MUST SURVIVE BEFORE IT IS BELIEVED.
 *
 * MEASURED, not chosen. On deployed CEE `915da5a3`, wire-level, a factor edit
 * persisted `observed_state` and a cold read at **t+1s** returned
 * `{"unit":"%","value":0.3,"source":"user_override","raw_value":30}`. The value
 * IS written — but not instantly, and `runConfirmation` issues read 0 with NO
 * delay, so read 0 races the write.
 *
 * The same measurement established the other half: a freshly drafted graph
 * carries NO `observed_state` on ANY un-edited factor (12 nodes, 3 factors,
 * 0/3 present at t+50s). So the state a first edit is adjudicated against is
 * `noValue` BY DEFAULT, and waiting longer never helps — only re-reading does.
 *
 * ⚠ WHY 2 AND NOT A DELAY. A fixed delay before read 0 trades a false refusal
 * for a slower one and is still a race — the persistence window is not bounded
 * by anything this module can see. Re-reading is not a race: read 1 fires at
 * +3s (`CONFIRM_READ_DELAYS_MS[0]`), comfortably outside the measured ~1s, and
 * if persistence is slower still, reads 2..7 keep looking out to 282s.
 */
export const MIN_CANONICAL_READS_BEFORE_REFUSAL = 2

// ─────────────────────────────────────────────────────────────────────────────
// Cold-read readability
// ─────────────────────────────────────────────────────────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Can this scenario id be cold-read at all?
 *
 * ⚠ THIS IS THE SINGLE DEFINITION, and `serverGraphHydration` imports it rather
 * than keeping its own copy — two regexes deciding one question is the
 * hand-maintained mirror this estate keeps paying for.
 *
 * The gap it names is WIDER than "guest, never saved" (review of #1057, F5):
 * `hydrateCanvasFromServer` returns `'skipped'` before any fetch on anything
 * that is not a UUID, so an edit made under a LOCAL DRAFT ID is equally
 * unsettleable. Those attempts are resolved honestly at receipt time rather
 * than left looking like they are still waiting for an answer.
 *
 * ⚠ A TYPE PREDICATE, NOT A `boolean`. `hydrateCanvasFromServer` guards on this
 * and then passes `scenarioId` to callers that require a `string`; a plain
 * boolean does not narrow, so the guard would compile away into three
 * `string | null | undefined` errors downstream. The narrowing IS the contract.
 */
export function canColdReadScenario(
  scenarioId: string | null | undefined,
): scenarioId is string {
  return typeof scenarioId === 'string' && UUID_RE.test(scenarioId)
}

// ─────────────────────────────────────────────────────────────────────────────
// The ledger
// ─────────────────────────────────────────────────────────────────────────────

const attempts = new Map<ModelEditAttemptId, ModelEditAttempt>()
const listeners = new Set<() => void>()
let version = 0
let seq = 0
let tick = 0

/** The one monotonic source. Every ordering decision in this module uses it. */
function nextTick(): LedgerTick {
  tick += 1
  return tick
}

/**
 * Stamp the moment a cold read is ISSUED — call this BEFORE the request goes
 * out, never after the answer arrives. The tick must pre-date the bytes it will
 * be used to adjudicate, or the guard it feeds is worthless.
 */
export function markCanonicalReadIssued(): LedgerTick {
  return nextTick()
}

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

/** Settled beyond correction. Canonical evidence may not reopen these. */
function isTerminal(completion: ModelEditCompletion): boolean {
  if (completion.phase === 'committed' || completion.phase === 'unresolved') return true
  return completion.phase === 'refused' && completion.evidence === 'canonical'
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
    dispatchedAt: nextTick(),
    receiptChannelAt: null,
    canonicalReadsSeen: 0,
    completion: { phase: 'pending' },
  })
  emit()
  return attemptId
}

/**
 * Write an answer from the RECEIPT CHANNEL (the turn's own reply, its typed
 * errors, its aborts, the deferral buffer).
 *
 * ⚠ ONLY FROM `pending`. A late receipt-channel answer for an attempt that has
 * already been answered cannot win — which is what stops A's slow reply from
 * overwriting a newer verdict, and is the rule the "late answer" pin holds.
 */
function settleFromReceiptChannel(
  attemptId: ModelEditAttemptId | null | undefined,
  completion: ModelEditCompletion,
): void {
  if (!attemptId) return
  const existing = attempts.get(attemptId)
  if (!existing) return
  if (existing.completion.phase !== 'pending') return
  attempts.set(attemptId, { ...existing, receiptChannelAt: nextTick(), completion })
  emit()
}

/**
 * A receipt arrived. ⚠ THIS IS NOT A SUCCESS — it moves the attempt to
 * `receipted` and waits for canonical evidence.
 *
 * ⚠ EXCEPT WHERE NO CANONICAL EVIDENCE CAN EVER ARRIVE. An attempt made under a
 * scenario id that cannot be cold-read has no success path at all, and leaving
 * it `receipted` would render as "still working" for the life of the page. It
 * resolves honestly instead — see `canColdReadScenario`.
 */
export function recordModelEditReceipt(attemptId: ModelEditAttemptId | null | undefined): void {
  const attempt = attemptId ? attempts.get(attemptId) : undefined
  if (attempt && !canColdReadScenario(attempt.scenarioId)) {
    settleFromReceiptChannel(attemptId, {
      phase: 'unresolved',
      reason:
        'This model is not saved to the server, so the change cannot be confirmed against it.',
    })
    return
  }
  settleFromReceiptChannel(attemptId, { phase: 'receipted' })
}

/**
 * The reply carried no applied patch for this target.
 *
 * ⚠ PROVISIONAL (`evidence: 'receipt'`). See the header: the same predicate that
 * cannot be trusted to say "saved" cannot be the final word on "not saved".
 */
export function refuseModelEditAttempt(
  attemptId: ModelEditAttemptId | null | undefined,
  reason: string,
): void {
  settleFromReceiptChannel(attemptId, {
    phase: 'refused',
    reason,
    evidence: 'receipt',
    canonical: null,
  })
}

/** We do not know: transport uncertainty, an interrupted turn, no server at all. */
export function markModelEditUnresolved(
  attemptId: ModelEditAttemptId | null | undefined,
  reason: string,
): void {
  settleFromReceiptChannel(attemptId, { phase: 'unresolved', reason })
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

/**
 * Is there anything in this scenario that a cold read could settle?
 *
 * This is what makes the confirmation read DEMAND-DRIVEN rather than periodic —
 * `useModelEditCanonicalConfirm` asks before spending a request.
 */
export function hasAttemptsAwaitingCanonical(scenarioId: string | null): boolean {
  return modelEditAttemptIdsAwaitingCanonical(scenarioId).length > 0
}

/**
 * The ids a cold read would settle right now: this scenario, answered by the
 * receipt channel (so the ordering guard can admit a read issued from here on),
 * and not yet terminal.
 *
 * ⚠ DERIVED FROM THE SAME PREDICATE `hasAttemptsAwaitingCanonical` REPORTS, so
 * the "should I read?" question and the "who does this read serve?" question
 * cannot drift apart into two answers.
 */
export function modelEditAttemptIdsAwaitingCanonical(
  scenarioId: string | null,
): readonly ModelEditAttemptId[] {
  if (!canColdReadScenario(scenarioId)) return []
  const out: ModelEditAttemptId[] = []
  for (const attempt of attempts.values()) {
    if (attempt.scenarioId !== scenarioId) continue
    if (attempt.receiptChannelAt === null) continue
    if (isTerminal(attempt.completion)) continue
    out.push(attempt.attemptId)
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
 * float artefact as a refusal.
 *
 * ⚠ WHAT IT IS FOR, AND WHAT IT IS NOT. It absorbs float/JSON artefacts and
 * nothing else. CEE's persisted precision is now DERIVED rather than assumed:
 * `observed_state` is stored with full JSONB fidelity and no rounding is applied
 * on this path, so a round-trip that differs by more than an artefact is a real
 * difference and must be reported as one. This tolerance is therefore NOT a
 * hedge against producer rounding — an earlier version of this comment said it
 * was, and used that to justify a laxer agreement rule.
 */
function sameMagnitude(a: number, b: number): boolean {
  return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b))
}

function readNumber(field: unknown): number | null {
  return typeof field === 'number' && Number.isFinite(field) ? field : null
}

/**
 * What a cold read says about one factor. FOUR ANSWERS, NOT TWO — because
 * "I could not read the graph" and "the graph is fine and your factor is not in
 * it" are different facts and only the first is a reason to stay silent
 * (review of #1057, F5).
 */
export type CanonicalFactorRead =
  /** No graph, or nothing shaped like one. Say nothing. */
  | { readonly kind: 'unreadable' }
  /** The graph is readable and this node is not in it — deleted server-side. */
  | { readonly kind: 'nodeAbsent' }
  /** The node is there and states no observed value at all. */
  | { readonly kind: 'noValue'; readonly canonical: CanonicalFactorValue }
  | { readonly kind: 'value'; readonly canonical: CanonicalFactorValue }

/**
 * Read one factor's canonical value out of a cold-read graph.
 *
 * ⚠ `source` COMES FROM `observed_state.source` AND NOWHERE ELSE. Both casings
 * are read because CEE and the legacy paths write either, but `provenance` is
 * NOT consulted at any casing — see the header for why `user_set` proves
 * nothing.
 *
 * ⚠ TWO NODE SHAPES, AND THE PRODUCTION ONE IS THE TOP-LEVEL ONE. The WIRE node
 * (`scenarios.graph` verbatim, which is what `fetchScenarioGraph` returns)
 * carries `observed_state` at the TOP LEVEL with no `data` key — see
 * `adapters/cee/types.ts` and `applyDraftResult.ts`, which destructures
 * `n.observed_state`. The canvas node nests it under `data`. Both are read; the
 * wire shape is the one that executes in production and is pinned by name in
 * the spec, because the first cut of this module covered only the canvas shape.
 */
export function readCanonicalFactor(graph: unknown, nodeId: string): CanonicalFactorRead {
  if (!nodeId) return { kind: 'unreadable' }
  const nodes = (graph as { nodes?: unknown })?.nodes
  if (!Array.isArray(nodes)) return { kind: 'unreadable' }
  for (const raw of nodes) {
    const node = (raw ?? {}) as Record<string, unknown>
    if (node.id !== nodeId) continue
    const nested = (node.data ?? {}) as Record<string, unknown>
    const observed = (node.observed_state ??
      node.observedState ??
      nested.observed_state ??
      nested.observedState) as Record<string, unknown> | undefined
    if (!observed || typeof observed !== 'object') {
      return { kind: 'noValue', canonical: { value: null, rawValue: null, source: null } }
    }
    const canonical: CanonicalFactorValue = {
      value: readNumber(observed.value),
      rawValue: readNumber(observed.raw_value ?? observed.rawValue),
      source: typeof observed.source === 'string' ? observed.source : null,
    }
    if (canonical.value === null && canonical.rawValue === null) {
      return { kind: 'noValue', canonical }
    }
    return { kind: 'value', canonical }
  }
  return { kind: 'nodeAbsent' }
}

/**
 * The value-only reader, kept for callers that just want the numbers.
 * `null` means "no value established", collapsing the three non-value answers.
 */
export function readCanonicalFactorValue(
  graph: unknown,
  nodeId: string,
): CanonicalFactorValue | null {
  const read = readCanonicalFactor(graph, nodeId)
  return read.kind === 'value' ? read.canonical : null
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
 * ⭐⭐ EVERY COMPARABLE BASIS MUST AGREE. `some` WAS WRONG, AND IT WAS THE
 * FALSE-SUCCESS DEFECT REBUILT INSIDE THE MODULE THAT EXISTS TO CATCH IT.
 *
 * The earlier rule committed when ANY basis agreed, justified by CEE's
 * persisted precision being underived: a rounded `raw_value` round-trip should
 * not read as a refusal. That premise is now REFUTED — CEE stores
 * `observed_state` with full JSONB fidelity and applies no rounding on this
 * path (derived at the producer; 41 files use `toFixed` elsewhere, none here).
 * So the reason the rule stood on was false, and a true-looking rule standing
 * on a false reason is one refactor from being a wrong rule.
 *
 * And the rule itself was wrong, not merely unjustified. `raw_value` and
 * `value` are two statements of ONE fact (`value` is the magnitude over the
 * node's cap). When they DISAGREE the persisted state is internally incoherent
 * — one field moved and the other did not, or they were written against
 * different caps. That is a PARTIAL WRITE, which is the exact shape of the
 * measured CEE defect this module was built for: a number written to one key
 * while `observed_state` never moved, reported as applied. Committing on
 * "either one matches" hands the consumer a success receipt for a model that
 * does not coherently hold the number.
 *
 * ⚠ THE DIRECTION IS DELIBERATE. `committed` is the STRONG claim — #1033
 * renders it as "saved" — so it must be the hard one to earn. A refusal is
 * recoverable: it carries the canonical bytes, so the consumer shows what the
 * model actually holds and the user can see the truth for themselves. A false
 * `committed` shows them a number the model does not have and tells them it is
 * safe. Between an over-strict success and a confident lie, this module takes
 * the over-strict success every time.
 *
 * (`bases.length === 0` returns before this — `every` over an empty set is
 * `true`, and "nothing was comparable" must never read as agreement.)
 */
export function settleModelEditAttemptFromCanonical(
  attemptId: ModelEditAttemptId | null | undefined,
  read: CanonicalFactorRead,
  readIssuedAt: LedgerTick,
): void {
  if (!attemptId) return
  const attempt = attempts.get(attemptId)
  if (!attempt) return
  if (isTerminal(attempt.completion)) return

  // ⭐ THE ORDERING GUARD (F2). Bytes read before the receipt channel answered
  // describe a model that had not seen this edit yet. Adjudicating against them
  // manufactures a permanent false refusal, so they are declined and the
  // attempt stays in its honest, still-open phase.
  if (attempt.receiptChannelAt === null) return
  if (!(readIssuedAt > attempt.receiptChannelAt)) return

  // `unreadable` is not evidence ABOUT THE NODE — it does not count as a look.
  if (read.kind === 'unreadable') return

  const readsSeen = attempt.canonicalReadsSeen + 1
  const seen = { ...attempt, canonicalReadsSeen: readsSeen }

  const settleCanonical = (completion: ModelEditCompletion): void => {
    attempts.set(attemptId, { ...seen, completion })
    emit()
  }

  /**
   * ⭐⭐ A CANONICAL REFUSAL IS NOT BELIEVED ON THE FIRST READ.
   *
   * The count is banked and the attempt is left OPEN, so the existing retry
   * schedule looks again. No emit: nothing user-visible moved, and emitting
   * would churn every subscriber for a bookkeeping write.
   *
   * ⚠ THIS COVERS ALL THREE REFUSING READS, NOT JUST THE ABSENT ONES, AND THAT
   * IS DELIBERATE — the brief that prompted this fix named `noValue` and
   * `nodeAbsent`, which is right for a factor's FIRST edit (an un-edited node
   * has no `observed_state` at all, measured). But a SECOND edit to the same
   * factor races the value the FIRST one persisted: the pre-write bytes are
   * `kind: 'value'` holding the OLD number, the bases disagree, and that is the
   * identical false refusal through the `value` door. Exempting only absence
   * would fix the first edit and leave every subsequent one broken.
   *
   * ⭐ AND WHY `committed` IS NOT DEFERRED. Staleness can only ever make a read
   * DISAGREE with what was sent. For a stale read to AGREE, the old number and
   * the new number must be the same number — in which case the model does hold
   * the attempted value and the claim is true regardless. Agreement is safe to
   * accept early; disagreement and absence are not safe to reject early. That
   * asymmetry is the module's own rule ("between an over-strict success and a
   * confident lie, take the over-strict success") applied to TIME.
   */
  const refuseCanonically = (completion: ModelEditCompletion): void => {
    if (readsSeen < MIN_CANONICAL_READS_BEFORE_REFUSAL) {
      attempts.set(attemptId, seen)
      return
    }
    settleCanonical(completion)
  }

  if (read.kind === 'nodeAbsent') {
    // Knowable, and previously left unsaid: the graph is fine and the factor is
    // not in it. ⚠ But on the FIRST read this is indistinguishable from a node
    // CEE has not written back yet, so it must survive a re-read.
    refuseCanonically({
      phase: 'refused',
      reason: 'This factor is no longer in the model.',
      evidence: 'canonical',
      canonical: null,
    })
    return
  }
  if (read.kind === 'noValue') {
    refuseCanonically({
      phase: 'refused',
      reason: 'The model holds no value for this factor.',
      evidence: 'canonical',
      canonical: read.canonical,
    })
    return
  }

  const { canonical } = read
  const bases: Array<[held: number, sent: number]> = []
  if (attempt.attemptedRawValue !== null && canonical.rawValue !== null) {
    bases.push([canonical.rawValue, attempt.attemptedRawValue])
  }
  if (canonical.value !== null) {
    bases.push([canonical.value, attempt.attemptedValue])
  }
  if (bases.length === 0) {
    // Nothing comparable — say nothing. The count is still banked: a node that
    // keeps offering no comparable basis is not evidence of a refusal either.
    attempts.set(attemptId, seen)
    return
  }

  if (bases.every(([held, sent]) => sameMagnitude(held, sent))) {
    settleCanonical({ phase: 'committed', canonical })
    return
  }
  // ⚠ PROVISIONAL ON THE FIRST READ — these bytes may pre-date CEE's write-back
  // for THIS edit, in which case they are the value the PREVIOUS edit left.
  refuseCanonically({
    phase: 'refused',
    reason: 'The model did not take this change.',
    evidence: 'canonical',
    canonical,
  })
}

/**
 * Settle every open attempt for one scenario against a cold-read graph.
 *
 * `readIssuedAt` MUST be the tick taken before the request went out
 * (`markCanonicalReadIssued`). It walks the ledger rather than taking a list, so
 * a caller cannot settle a subset and leave the rest looking pending forever.
 */
export function settleModelEditAttemptsFromCanonicalGraph(
  scenarioId: string | null,
  graph: unknown,
  readIssuedAt: LedgerTick,
): void {
  for (const attempt of [...attempts.values()]) {
    if (attempt.scenarioId !== scenarioId) continue
    if (isTerminal(attempt.completion)) continue
    settleModelEditAttemptFromCanonical(
      attempt.attemptId,
      readCanonicalFactor(graph, attempt.nodeId),
      readIssuedAt,
    )
  }
}

/** TEST SEAM ONLY. Module state is process-wide; specs must start from empty. */
export function __resetModelEditCompletionLedger(): void {
  attempts.clear()
  listeners.clear()
  seq = 0
  version = 0
  tick = 0
}

/**
 * Failure-type retryability classifier.
 *
 * ⚠ AUTHORITY ORDER (Codex F6 fix): the SERVER's `retryable` marker on the
 * error envelope is authoritative — `BoundaryError.retryable` is a typed,
 * REQUIRED boolean on every non-2xx `/orchestrate/v2/turn` body, and CEE
 * computes it per-failure (e.g. `mapDraftGraphPipelineReason`:
 * CEE_LLM_VALIDATION_FAILED → false, CEE_TIMEOUT → true — both surface as
 * `INTERNAL_ERROR` at the envelope level). The client-side table below is
 * the FALLBACK for the marker's ABSENCE only (synthetic typed_errors from a
 * 200-response error block, or parse_errors where no envelope exists). It
 * must never override what the server said — a client-forced retry on a
 * server-non-retryable failure is a retry that cannot work.
 *
 * Retryable codes — transient, worth offering a retry action:
 *   UPSTREAM_TIMEOUT       — CEE → PLoT/LLM call timed out
 *   UPSTREAM_UNAVAILABLE   — CEE reached a dependency that returned 5xx
 *   LLM_UNAVAILABLE        — classifier produced unparseable output
 *   INTERNAL_ERROR         — catch-all internal failure; worth one retry
 *
 * Non-retryable codes — the request itself is wrong or policy blocks it:
 *   INGRESS_CONTRACT_VIOLATION — payload shape invalid; retry would fail
 *   EGRESS_CONTRACT_VIOLATION  — CEE response failed its own egress validator
 *   FEATURE_NOT_ENABLED        — flag gated
 *   TURN_BUDGET_EXCEEDED       — session limit hit; new decision required
 *
 * checkRetryableAgreement still surfaces a DEV warning when the table and
 * the server disagree, so drift stays visible in staging telemetry.
 */
import { FAILURE_USER_TEXT } from '@talchain/schemas/boundary'
import type { FailureTypeLiteral, BoundaryError } from '@talchain/schemas/boundary'

const RETRYABLE: ReadonlySet<FailureTypeLiteral> = new Set<FailureTypeLiteral>([
  'UPSTREAM_TIMEOUT',
  'UPSTREAM_UNAVAILABLE',
  'LLM_UNAVAILABLE',
  'INTERNAL_ERROR',
])

export function isRetryable(code: FailureTypeLiteral): boolean {
  return RETRYABLE.has(code)
}

/**
 * Resolve the effective retry decision for a typed error: the server's
 * envelope marker when it exists, the client table otherwise. See the
 * authority-order note at the top of this file. Absence resolves through
 * the table, never to a hard-coded default, so an unknown-marker envelope
 * still degrades to today's behaviour.
 */
export function resolveRetryable(
  code: FailureTypeLiteral,
  serverRetryable: boolean | undefined,
): boolean {
  return typeof serverRetryable === 'boolean' ? serverRetryable : isRetryable(code)
}

/**
 * Trailing sentence in FAILURE_USER_TEXT that instructs the user to retry.
 * When the retry affordance is withheld (server said non-retryable), copy
 * telling the user to "please retry" beside a missing Try-again chip
 * instructs an action the UI gives them no way to take — the same honesty
 * rule ceeRecovery.buildFailureRender enforces on the V4 path.
 *
 * This was three exact-suffix literals (' Please retry.', ' Please try
 * again.', ' Please retry shortly.') — a HAND-KEPT MIRROR of sentence endings
 * inside the vendored @talchain/schemas copy. A re-vendor phrasing a code
 * differently ("Please try again in a moment.") silently no-opped the strip
 * and FAILED OPEN, with no test to catch it. The pattern generalises over the
 * sentence instead: any trailing "Please retry…" / "Please try again…"
 * sentence, however it continues. `[^.]*` keeps it from crossing a sentence
 * boundary. Copy with no such sentence passes through unchanged (fail open).
 *
 * The derived guard in failureTypeRetryability.test.ts iterates every key of
 * FAILURE_USER_TEXT and asserts no retry language survives showRetry=false,
 * so the next re-vendor that drifts the phrasing fails loudly rather than
 * silently shipping copy that contradicts the UI.
 */
const RETRY_INSTRUCTION_SENTENCE = /\s*Please\s+(?:retry|try\s+again)\b[^.]*\.\s*$/i

/**
 * Base failure copy that AGREES with the retry decision. With the retry
 * affordance shown, this is exactly FAILURE_USER_TEXT[code]. With it
 * withheld, any trailing retry-instruction sentence is dropped so the copy
 * never tells the user to do something the UI won't offer.
 */
export function resolveFailureBaseCopy(
  code: FailureTypeLiteral,
  showRetry: boolean,
): string {
  const canonical = FAILURE_USER_TEXT[code]
  if (showRetry) return canonical
  const stripped = canonical.replace(RETRY_INSTRUCTION_SENTENCE, '')
  // Fail open rather than render nothing: copy that is ONLY a retry
  // instruction keeps its canonical text.
  return stripped.length > 0 ? stripped : canonical
}

/**
 * ── Fence-refusal copy (journey-walk 2026-08-03 gap #2) ────────────────────
 *
 * CEE rides turn-fence refusals on the SAME wire code as graph staleness —
 * `GRAPH_DIVERGED` — deliberately (olumi-assistants-service
 * `turn-executor.ts` at fee17e3a: "Rides the EXISTING 409-class envelope …
 * rather than minting a wire code"), carrying the distinguisher in
 * `details.conflict_category: 'turn_fence_${verdict}'` where verdict is the
 * closed `TurnFenceVerdict` enum (stopped | superseded | unclaimed |
 * unavailable; 'current' never refuses). Until this module read that field,
 * every fence refusal rendered the canonical staleness banner ("Your
 * decision has changed since this result was computed. Re-run the analysis
 * to refresh it.") — witnessed FALSE on the walk: it fired on a scenario
 * where nothing had ever been computed, and its remedy (Rerun) provably
 * does not clear the fence.
 *
 * A fence refusal is a WRITE conflict, never staleness: the one truth shared
 * by every verdict is "the change was not saved and the model is unchanged",
 * so every entry below states exactly that plus the verdict's own cause.
 *
 * NOT a hand-kept mirror (trap 12): the gate is the producer's own naming
 * scheme — the `turn_fence_` prefix is emitted as a template literal over
 * the closed verdict enum — so an UNKNOWN future verdict still routes to the
 * honest generic fence copy (fail closed against the staleness lie), never
 * back to the banner. Non-fence conflict categories (the graph-CAS class,
 * e.g. 'analysis_affecting_conflict') keep the canonical copy: for them the
 * graph genuinely diverged.
 */
const FENCE_CONFLICT_PREFIX = 'turn_fence_'

const FENCE_GENERIC_COPY =
  "That change couldn't be saved, so nothing in your decision changed. Try it again in a moment."

const FENCE_REFUSAL_COPY: Record<string, string> = {
  turn_fence_stopped:
    "That change wasn't saved because this turn was stopped. Nothing in your decision changed. Send the change again if you still want it.",
  turn_fence_superseded:
    "That change wasn't saved because a newer change to this decision got in first. Nothing was overwritten. Check the latest state, then make the edit again if it's still needed.",
  turn_fence_unclaimed: FENCE_GENERIC_COPY,
  turn_fence_unavailable: FENCE_GENERIC_COPY,
}

/**
 * Read `details.conflict_category` off a BoundaryError. Fail closed: absent,
 * non-string, or empty → ''. (details is a Zod passthrough object, so the
 * field survives strict parsing when CEE sends it.)
 */
export function extractConflictCategory(err: BoundaryError | undefined): string {
  const category = (err?.details as { conflict_category?: unknown } | undefined)
    ?.conflict_category
  return typeof category === 'string' ? category : ''
}

/**
 * Honest copy for a fence-class GRAPH_DIVERGED, or null when the error is not
 * fence-class (no conflict_category, or a non-fence category) — callers fall
 * back to `resolveFailureBaseCopy` for those.
 */
export function resolveFenceRefusalCopy(err: BoundaryError | undefined): string | null {
  const category = extractConflictCategory(err)
  if (!category.startsWith(FENCE_CONFLICT_PREFIX)) return null
  return FENCE_REFUSAL_COPY[category] ?? FENCE_GENERIC_COPY
}

/**
 * Base failure copy resolved WITH the error envelope in hand: fence-class
 * GRAPH_DIVERGED gets its honest write-refusal copy; everything else takes
 * the canonical `resolveFailureBaseCopy` path unchanged. Both live typed-
 * error surfaces (useConversation's V5 typed_error branch and
 * TypedErrorRenderer) resolve through here so they cannot drift.
 */
export function resolveFailureCopyForError(
  code: FailureTypeLiteral,
  showRetry: boolean,
  err: BoundaryError | undefined,
): string {
  if (code === 'GRAPH_DIVERGED') {
    const fenceCopy = resolveFenceRefusalCopy(err)
    if (fenceCopy !== null) return fenceCopy
  }
  return resolveFailureBaseCopy(code, showRetry)
}

/**
 * DEV-only check that server `retryable` agrees with the client table.
 * Fires a console.warn on disagreement so staging telemetry surfaces drift
 * between CEE and UI classifications. No-op in production builds.
 */
export function checkRetryableAgreement(err: BoundaryError): void {
  if (!import.meta.env.DEV) return
  const clientSays = isRetryable(err.error)
  if (err.retryable !== clientSays) {
    console.warn('[v5] retryable disagreement', {
      code: err.error,
      serverSays: err.retryable,
      clientSays,
      requestId: err.request_id,
    })
  }
}

/**
 * Extract a human-readable reason from BoundaryError.details.reason when
 * present. CEE layers a specific reason inside details for operators; the
 * UI surfaces it beneath the canonical FAILURE_USER_TEXT label to give
 * users context without losing the taxonomy. Returns empty string when
 * absent or not a string.
 */
export function extractReason(err: BoundaryError | undefined): string {
  if (!err) return ''
  const reason = (err.details as { reason?: unknown } | undefined)?.reason
  return typeof reason === 'string' && reason.trim().length > 0 ? reason.trim() : ''
}

/**
 * ── Ingress-violation taxonomy (ROADMAP 2.472) ─────────────────────────────
 *
 * CEE rides genuinely different failures on the single wire code
 * INGRESS_CONTRACT_VIOLATION, carrying the real class in `validator` +
 * `details.reason`. Until 2.472 the guidance line ignored both and told EVERY
 * ingress violation "Please rephrase your message and try again." — witnessed
 * false during the 4 Aug outage, when a server-side ownership-oracle failure
 * (`validator:'scenario_preflight'`, `reason:'scenario_ownership_unverifiable'`,
 * `retryable:false`) blamed the user's wording
 * (PHASE0-EVIDENCE-2026-07-28/rewalk-2459b-raw/run{1,2}-rewalk-wire.json).
 *
 * Class → copy, from the complete producer manifest at CEE staging tip
 * ac62fd4d (every non-test `INGRESS_CONTRACT_VIOLATION` emitter):
 *   - `scenario_preflight` (route-v2-preflight.ts — reasons are the closed
 *     union scenario_owned_by_other_user | scenario_requires_authenticated_owner
 *     | scenario_ownership_unverifiable) and the commit/pipeline validators
 *     (`turn_commit`, `chip_click_dispatch`, `draft_graph_pipeline`,
 *     `edit_graph_pipeline` — reachable under this code via route-v2.ts's
 *     `errorCode: failureType` passthrough) describe SERVER state. The user's
 *     message played no part → server-fault copy.
 *   ⚠ DORMANT ON THE WIRE TODAY: every emitter of `buildSignInRequiredError`
 *     is gated on `CEE_REQUIRE_USER_JWT`, config default `false`, documented
 *     "ships dark" (`config/index.ts:527`) — `resolveUserIdentity` returns
 *     `{ mode: 'off' }` before it can refuse, and both browser-proxy emitters
 *     test `config.auth?.requireUserJwt === true`. The DEPLOYED posture is
 *     UNPROVEN from the repo (Render dashboard owns staging env; never infer
 *     it from YAML or from this comment). With the flag down, an
 *     unauthenticated caller on an owned scenario does NOT yield
 *     `sign_in_required` — it yields `scenario_requires_authenticated_owner`,
 *     routed by OWNERSHIP_REASON_GUIDANCE above. That row, not this one, is
 *     what closes the live case.
 *   - `user_jwt` (user-identity.ts, reason `sign_in_required`) describes
 *     SESSION state; "rephrase" is false and "our side is broken" is also
 *     false — recovery is signing in → sign-in copy.
 *   - `OrchestratorTurnPayload` (validators/b1.ts) validates the turn payload
 *     itself, the user's `message` included — genuinely input-shaped →
 *     rephrase copy (unchanged).
 *   - ⚠ `V5RequestExtensions` (orchestrator-v5/boundary/request-extensions.ts)
 *     IS NOT IN THAT GROUP — and this line used to say it was, which is why
 *     the correction is spelled out rather than silently applied (2.496).
 *     Verified at the PRODUCER's bytes (CEE `request-extensions.ts` module
 *     header, staging), not from this comment: it parses FOUR OPTIONAL
 *     app-constructed extension fields — `graph_state`, `analysis_state`,
 *     `user_id`, `selected_elements` — and carries no user text whatsoever.
 *     "Rephrase your message" is therefore categorically false for it: the UI
 *     built the malformed request, not the person typing. It sits in
 *     `INGRESS_SERVER_STATE_VALIDATORS` below and resolves to the SERVER-FAULT
 *     copy, pinned by `failureTypeRetryability.test.ts`
 *     ("V5RequestExtensions → server-fault copy"). That set and that test are
 *     the authority; this sentence was round-1 text that review F3's pin
 *     correction superseded and nobody deleted.
 *
 *     ⚠ THE DOC WAS CORRECTED, NOT THE BEHAVIOUR. A doc block contradicting
 *     the executable set is 2.472's own lesson one level up — an expectation
 *     written from a reader's classification instead of the producer's
 *     semantics. Left standing, a false one-line description is exactly how a
 *     correct guard gets "tidied" back into the defect it was written to fix.
 *
 * ⚠ The validator set below is a documented MIRROR of CEE's producer
 * vocabulary (trap 12) with the drift direction chosen deliberately: an
 * unknown or absent validator/reason FAILS SAFE to the rephrase copy —
 * today's behaviour, never a crash, never a blank. The `scenario_ownership`
 * reason-prefix gate is derived from the producer's own closed-union naming
 * (same pattern as the `turn_fence_` prefix above), so the ownership family
 * routes honestly even under a future validator rename.
 */
const INGRESS_REPHRASE_GUIDANCE = 'Please rephrase your message and try again.'

/**
 * ⚠ The trailing "Please try again in a moment." is DELIBERATE here, and is
 * deliberately NOT the same thing as `RETRY_INSTRUCTION_SENTENCE` above.
 * That regex strips retry language from the CANONICAL FAILURE_USER_TEXT when
 * the retry CHIP is withheld, so the copy never points at an affordance the
 * UI is not rendering. This sentence points at no affordance: it tells the
 * user that the fault is transient and that re-sending later is worth doing,
 * which is true for an oracle-down / commit-failed class and is the only
 * honest next step available to them. The live-chain spec asserts zero retry
 * chips alongside this exact string, pinning that the two coexist on purpose.
 * It is applied ONLY to genuinely transient server faults — never to the
 * access-denied or sign-in classes, where waiting cannot help.
 */
const INGRESS_SERVER_FAULT_GUIDANCE =
  "Something on our side isn't working — your message was fine. Please try again in a moment."

/**
 * Access correctly refused: the scenario has a different owner. Blames
 * nobody, states plainly that the message was not the problem, prescribes no
 * futile wait, and names the one action that can actually change the outcome.
 */
const INGRESS_NO_ACCESS_GUIDANCE =
  "This decision belongs to someone else, so you can't make changes to it — nothing you typed was the problem. Ask its owner to share it with you if you need access."

/**
 * Auth-class copy. Deliberately neutral about WHY: `auth_reason` spans
 * "never signed in" (missing_token) and "session ended" (expired_token), so
 * asserting either would be a fresh untruth for the other half. It blames
 * nobody, exonerates the message explicitly, and names the next action —
 * pinned as a property of the string, not left to review.
 */
const INGRESS_SIGN_IN_GUIDANCE =
  "You'll need to sign in to continue — nothing was wrong with your message. Please sign in, then send it again."

const INGRESS_SERVER_STATE_VALIDATORS: ReadonlySet<string> = new Set([
  'scenario_preflight',
  'turn_commit',
  'chip_click_dispatch',
  'draft_graph_pipeline',
  'edit_graph_pipeline',
  // Validates ONLY app-constructed state — graph_state, analysis_state,
  // user_id, selected_elements (request-extensions.ts:8). It carries no user
  // text whatsoever, so "rephrase your message" is categorically false here:
  // the UI built the malformed request, not the person typing.
  'V5RequestExtensions',
])

/**
 * `scenario_preflight` is NOT one failure. Its reason is a closed 3-member
 * union (`build-turn-context.ts:1227-1235`) whose members need three
 * DIFFERENT copies, and CEE names the reason precisely so the UI can tell
 * them apart:
 *
 *   scenario_ownership_unverifiable        the oracle is down      → OUR FAULT
 *   scenario_requires_authenticated_owner  anonymous caller, owned scenario
 *                                          (IDOR fail-closed)      → SIGN IN
 *   scenario_owned_by_other_user           cross-tenant attempt    → NO ACCESS
 *
 * Collapsing these into the server-fault copy — as this module did until the
 * F1 review — tells a user whose access was CORRECTLY refused that our
 * systems are broken and that waiting will help. Both halves are false, and
 * the prescribed action can never succeed. That is a worse failure than the
 * bug this module was written to fix, so each member is routed explicitly and
 * an unknown future member falls back to the (blameless) server-fault copy.
 */
const OWNERSHIP_REASON_GUIDANCE: Record<string, string> = {
  scenario_ownership_unverifiable: INGRESS_SERVER_FAULT_GUIDANCE,
  scenario_requires_authenticated_owner: INGRESS_SIGN_IN_GUIDANCE,
  scenario_owned_by_other_user: INGRESS_NO_ACCESS_GUIDANCE,
}

const INGRESS_SIGN_IN_VALIDATOR = 'user_jwt'

/**
 * The producer's DECLARED stable mapping key for the auth class
 * (user-identity.ts `buildSignInRequiredError`, verbatim: "The stable UI
 * mapping key is `details.code === 'sign_in_required'`"). Keyed on first, so
 * a validator rename cannot silently drop this class back to "rephrase";
 * `validator === 'user_jwt'` stays as a secondary signal for envelopes that
 * omit the code.
 */
const SIGN_IN_REQUIRED_CODE = 'sign_in_required'

/**
 * The one `auth_reason` in the closed union (user-identity.ts:64-68) that is
 * NOT the user's to fix: the verifier itself is unavailable. Telling that
 * user to sign in prescribes an action that cannot work — precisely the
 * defect class this row exists to remove — so it takes the server-fault copy.
 */
const AUTH_REASON_VERIFIER_DOWN = 'verification_unavailable'

const SCENARIO_OWNERSHIP_REASON_PREFIX = 'scenario_ownership'

/** Read `details.code` off a BoundaryError. Fail closed: absent/non-string → ''. */
function extractDetailsCode(err: BoundaryError): string {
  const code = (err.details as { code?: unknown } | undefined)?.code
  return typeof code === 'string' ? code : ''
}

/** Read `details.auth_reason`. Fail closed: absent/non-string → ''. */
function extractAuthReason(err: BoundaryError): string {
  const reason = (err.details as { auth_reason?: unknown } | undefined)?.auth_reason
  return typeof reason === 'string' ? reason : ''
}

/**
 * Route an INGRESS_CONTRACT_VIOLATION to guidance that is true for its
 * actual class. Fail safe: no envelope, unknown validator, or malformed
 * fields → the rephrase copy (pre-2.472 behaviour).
 */
export function resolveIngressViolationGuidance(err: BoundaryError | undefined): string {
  if (!err) return INGRESS_REPHRASE_GUIDANCE
  const validator = typeof err.validator === 'string' ? err.validator : ''
  // Auth class first, keyed on the producer's declared stable key.
  if (extractDetailsCode(err) === SIGN_IN_REQUIRED_CODE || validator === INGRESS_SIGN_IN_VALIDATOR) {
    // …except when the verifier itself is what failed: that is our fault, and
    // signing in cannot clear it.
    return extractAuthReason(err) === AUTH_REASON_VERIFIER_DOWN
      ? INGRESS_SERVER_FAULT_GUIDANCE
      : INGRESS_SIGN_IN_GUIDANCE
  }
  const reason = extractReason(err)
  // Ownership/access reasons are routed by REASON first: they arrive under a
  // server-state validator but three of them are not server faults at all.
  const ownershipCopy = OWNERSHIP_REASON_GUIDANCE[reason]
  if (ownershipCopy !== undefined) return ownershipCopy

  if (
    INGRESS_SERVER_STATE_VALIDATORS.has(validator) ||
    reason.startsWith(SCENARIO_OWNERSHIP_REASON_PREFIX)
  ) {
    return INGRESS_SERVER_FAULT_GUIDANCE
  }
  return INGRESS_REPHRASE_GUIDANCE
}

/**
 * Guidance text for non-retryable errors. Retryable errors show a Try again
 * chip on the message bubble instead, so guidance is empty for them.
 *
 * Shared source of truth between TypedErrorRenderer (for rendering contexts
 * that use the full component) and useConversation's V5 typed_error branch
 * (which builds a plain-string message body for MessageBubble). Keeping
 * both paths on the same table prevents drift.
 *
 * 2.472: pass the BoundaryError when you have one — INGRESS_CONTRACT_VIOLATION
 * branches on its wire taxonomy (see resolveIngressViolationGuidance). Callers
 * without an envelope keep the pre-2.472 copy for every code.
 */
export function resolveGuidance(code: FailureTypeLiteral, err?: BoundaryError): string {
  if (isRetryable(code)) return ''
  switch (code) {
    case 'INGRESS_CONTRACT_VIOLATION':
      return resolveIngressViolationGuidance(err)
    case 'EGRESS_CONTRACT_VIOLATION':
      return 'The response could not be validated. Please try again or contact support.'
    case 'FEATURE_NOT_ENABLED':
      return 'This feature is not yet available in your session.'
    case 'TURN_BUDGET_EXCEEDED':
      return 'This session has reached its turn limit — start a new decision to continue.'
    case 'UPSTREAM_TIMEOUT':
    case 'UPSTREAM_UNAVAILABLE':
    case 'LLM_UNAVAILABLE':
    case 'INTERNAL_ERROR':
      return ''
    // GRAPH_DIVERGED (new in @talchain/schemas 0.22.0): the analysed graph
    // drifted from the current one. It is non-retryable — re-sending the same
    // turn would diverge again — but its canonical FAILURE_USER_TEXT copy
    // already carries the actionable "Re-run the analysis" instruction, so no
    // secondary guidance line is added.
    case 'GRAPH_DIVERGED':
      return ''
    default: {
      const _exhaustive: never = code
      return _exhaustive
    }
  }
}

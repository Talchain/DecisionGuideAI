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
 * Guidance text for non-retryable errors. Retryable errors show a Try again
 * chip on the message bubble instead, so guidance is empty for them.
 *
 * Shared source of truth between TypedErrorRenderer (for rendering contexts
 * that use the full component) and useConversation's V5 typed_error branch
 * (which builds a plain-string message body for MessageBubble). Keeping
 * both paths on the same table prevents drift.
 */
export function resolveGuidance(code: FailureTypeLiteral): string {
  if (isRetryable(code)) return ''
  switch (code) {
    case 'INGRESS_CONTRACT_VIOLATION':
      return 'Please rephrase your message and try again.'
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

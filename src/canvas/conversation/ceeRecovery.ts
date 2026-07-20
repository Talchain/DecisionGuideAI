/**
 * CEE failure-recovery reader.
 *
 * A1 brief item 2 (failure recovery on screen). When a draft/turn fails, CEE
 * returns an error envelope carrying two pieces the UI must honour:
 *   1. a `retryable` marker — whether offering "Try again" can actually work;
 *   2. a *specific recovery suggestion* — plain-language guidance on what to
 *      do instead of, or alongside, retrying.
 *
 * Wire provenance (RESOLVED — @talchain/schemas 0.19.0, wave-2 ask 7)
 * -------------------------------------------------------------------
 * The 0.18.0 SCHEMA ASK that used to live here has been answered. 0.19.0's
 * `CeeTypedErrorSchema` (a ROOT export — not under `/boundary`; placement
 * confirmed by design) types BOTH recovery shapes on the CEE error envelope:
 *   - flat  `recovery_suggestion?: string` — the pinned mirror of
 *     `recovery.suggestion`, present exactly when the structured object is
 *     (see CEE `buildCeeErrorResponse`, src/cee/validation/pipeline.ts);
 *   - nested `recovery?: { hints: string[]; suggestion: string;
 *     example?: string }` (`CeeErrorRecoverySchema`) — "hints are short
 *     actionable bullets, suggestion is the one display-safe sentence a UI
 *     surfaces next to the failure".
 *
 * On the LIVE V5 wire (`/orchestrate/v2/turn`), every non-2xx body is a
 * strict `BoundaryError` whose passthrough `details` carries the NESTED
 * shape at `details.recovery` (CEE route-v2.ts `postStageExtras.recovery`).
 * The FLAT mirror rides envelopes built directly from
 * `buildCeeErrorResponse` (assist/V4 endpoints, CEEErrorResponseV1). This
 * module therefore reads both, per the contract. The de-facto alias keys
 * below are retained for pre-0.19.0 producers and fail closed as before.
 *
 * Fail-closed contract (never strand the user)
 * --------------------------------------------
 *   - recovery suggestion absent → `undefined` → caller keeps today's generic copy
 *   - retryable marker absent     → `undefined` → caller keeps the retry affordance
 *
 * This module is a zero-dependency pure leaf on purpose: it operates on
 * `unknown` (duck-typed OrchestratorError.body / CEEError.details / raw body),
 * imports nothing, and is covered by the narrow CI typecheck gate.
 */

/** Field names, in priority order, under which CEE may place the retryable marker. */
const RETRYABLE_KEYS = ['retryable', 'retriable'] as const

/**
 * Field names, in priority order, under which CEE may place the recovery
 * suggestion as a plain string. `recovery_suggestion` is the 0.19.0-pinned
 * flat mirror; the rest are pre-0.19.0 de-facto aliases. The 0.19.0 NESTED
 * `recovery` object ({ hints, suggestion, example? }) is read separately in
 * `extractCeeRecovery` — the legacy `'recovery'` entry here only matches
 * when the value is itself a string.
 */
const SUGGESTION_KEYS = [
  'recovery_suggestion',
  'suggested_action',
  'recovery',
  'suggestedAction',
  'recoverySuggestion',
] as const

export interface CeeRecovery {
  /**
   * The wire retryable/retriable marker. `true` / `false` only when the wire
   * carried an actual boolean; `undefined` when absent (fail closed — the
   * caller keeps the retry affordance rather than guessing).
   */
  retryable?: boolean
  /**
   * Plain-language recovery suggestion from CEE, trimmed. `undefined` when
   * absent, empty, or when the value looks like a raw error code (we never
   * render codes to users). Fail closed → the caller keeps its generic copy.
   */
  suggestion?: string
  /**
   * Short actionable bullets from the 0.19.0 nested `recovery.hints[]`.
   * Only display-safe entries survive (trimmed, non-empty, not code-like).
   * `undefined` when the wire carried none (fail closed — callers render
   * nothing rather than inventing hints).
   */
  hints?: string[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Collect the candidate record containers to scan, in priority order.
 *
 * Draft/turn failures reach the UI as either an OrchestratorError (`.body` =
 * parsed CEE error body) or a CEEError (`.details` = raw error body), or as the
 * raw body object itself. Within any of those, the CEE envelope may be flat
 * (0.18.0 CeeTypedError), nested under `error` (Spec v04 CEEErrorResponseV1),
 * nested under `details`, or BFF-wrapped under `cee_response`.
 */
function collectContainers(err: unknown): Record<string, unknown>[] {
  const roots: unknown[] = []
  if (isRecord(err)) {
    // Prefer the transport-specific payloads over the wrapper object itself.
    if ('body' in err) roots.push(err.body)
    if ('details' in err) roots.push(err.details)
    roots.push(err)
  }

  const seen = new Set<Record<string, unknown>>()
  const out: Record<string, unknown>[] = []
  const push = (value: unknown): void => {
    if (!isRecord(value) || seen.has(value)) return
    seen.add(value)
    out.push(value)
  }

  for (const root of roots) {
    if (!isRecord(root)) continue
    push(root)
    push(root.error) // nested spec-v04 { error: { ... } }
    push(root.details) // { details: { ... } }
    if (isRecord(root.cee_response)) {
      push(root.cee_response) // BFF wrap
      push(root.cee_response.error)
      push(root.cee_response.details)
    }
  }
  return out
}

/**
 * True when the string looks like machine output rather than prose.
 *
 * Two rejections, both *reject-only* — this module never rewrites producer
 * copy (see the normalisation note at the bottom of this file):
 *
 *   1. a single upper-snake token: CEE_LLM_TIMEOUT, UPSTREAM_TIMEOUT, …
 *   2. any value with no lowercase letter at all, which catches multi-token
 *      code dumps the single-token test misses ("UPSTREAM_TIMEOUT:
 *      CEE_LLM_TIMEOUT", "ERR_A, ERR_B"). English prose always contains a
 *      lowercase letter, so this cannot reject a legitimate suggestion.
 *
 * Rejecting is safe: the caller falls back to its own generic copy, which is
 * already honest for the retry state.
 */
export function looksLikeCode(value: string): boolean {
  const trimmed = value.trim()
  if (/^[A-Z][A-Z0-9_]{2,}$/.test(trimmed)) return true
  return !/[a-z]/.test(trimmed)
}

/**
 * True when a wire `details.reason` value is safe to show a user as prose.
 *
 * Stricter than `looksLikeCode`'s reject-only rules because the reason field
 * is a DIFFERENT contract: CEE's live V5 wire populates it with typed
 * machine reasons in lower_snake_case (`draft_graph_cee_timeout`,
 * `draft_graph_cee_llm_validation_failed` — see CEE route-v2.ts
 * `mapDraftGraphPipelineReason`), which `looksLikeCode` alone cannot reject
 * (they contain lowercase letters). Genuine prose reasons ("turn_id must be
 * a UUID v4") contain whitespace; single-token values never do. Rejecting is
 * safe — the caller falls back to the canonical failure copy, which is
 * already honest.
 */
export function isDisplaySafeReason(value: string): boolean {
  const trimmed = value.trim()
  if (trimmed.length === 0) return false
  if (!/\s/.test(trimmed)) return false
  return !looksLikeCode(trimmed)
}

/**
 * Read the 0.19.0 nested `recovery` object ({ hints, suggestion, example? })
 * out of a container, applying the same reject-only display guards as the
 * flat path. Returns only the fields that survived the guards.
 */
function readNestedRecovery(container: Record<string, unknown>): {
  suggestion?: string
  hints?: string[]
} {
  const nested = container.recovery
  if (!isRecord(nested)) return {}
  const out: { suggestion?: string; hints?: string[] } = {}
  if (typeof nested.suggestion === 'string') {
    const trimmed = nested.suggestion.trim()
    if (trimmed.length > 0 && !looksLikeCode(trimmed)) {
      out.suggestion = trimmed
    }
  }
  if (Array.isArray(nested.hints)) {
    const safe = nested.hints
      .filter((h): h is string => typeof h === 'string')
      .map((h) => h.trim())
      .filter((h) => h.length > 0 && !looksLikeCode(h))
    if (safe.length > 0) out.hints = safe
  }
  return out
}

/**
 * Read the retryable + recovery-suggestion signals out of a draft/turn failure.
 * Always returns an object; both fields are optional and absent by design when
 * the wire did not carry them (fail closed).
 */
export function extractCeeRecovery(err: unknown): CeeRecovery {
  const containers = collectContainers(err)
  const result: CeeRecovery = {}

  for (const c of containers) {
    if (result.retryable === undefined) {
      for (const key of RETRYABLE_KEYS) {
        if (typeof c[key] === 'boolean') {
          result.retryable = c[key] as boolean
          break
        }
      }
    }
    if (result.suggestion === undefined) {
      for (const key of SUGGESTION_KEYS) {
        const raw = c[key]
        if (typeof raw === 'string') {
          const trimmed = raw.trim()
          if (trimmed.length > 0 && !looksLikeCode(trimmed)) {
            result.suggestion = trimmed
            break
          }
        }
      }
    }
    // 0.19.0 nested shape ({ recovery: { hints, suggestion, example? } }) —
    // the shape the LIVE V5 wire carries at BoundaryError.details.recovery.
    // The flat mirror (when both are present they agree by contract) has
    // priority via the loop above; the nested object fills whatever is
    // still missing.
    const nested = readNestedRecovery(c)
    if (result.suggestion === undefined && nested.suggestion !== undefined) {
      result.suggestion = nested.suggestion
    }
    if (result.hints === undefined && nested.hints !== undefined) {
      result.hints = nested.hints
    }
    if (
      result.retryable !== undefined &&
      result.suggestion !== undefined &&
      result.hints !== undefined
    ) break
  }

  return result
}

export interface FailureRender {
  /**
   * Message body to render: the caller's generic copy for this retry state,
   * with the specific CEE recovery suggestion appended when one is present
   * (never replacing it — layering keeps the honest fallback visible).
   */
  content: string
  /**
   * Whether to render the "Try again" affordance. Fail closed: `true` unless
   * the wire explicitly marked the failure `retryable: false`.
   */
  showRetry: boolean
}

/**
 * Builds the generic base copy for a given retry state.
 *
 * Deliberately a callback rather than a plain string. The retry decision is
 * made here, from the wire, and the base copy has to agree with it: copy that
 * says "please try again" beside a hidden retry chip instructs the user to do
 * something the UI gives them no way to do. Taking a resolver makes it
 * structurally impossible to compose the base copy without first knowing
 * whether the retry affordance will exist.
 */
export type FailureBaseBuilder = (showRetry: boolean) => string

/**
 * Compose the failure render from the CEE envelope plus retry-state-aware base
 * copy. Pure — the caller owns actually building the chip/button.
 *
 * Fail open is unchanged: an absent `retryable` marker yields `showRetry:true`,
 * so `buildBase(true)` is called and today's copy is returned verbatim.
 */
export function buildFailureRender(buildBase: FailureBaseBuilder, err: unknown): FailureRender {
  const { retryable, suggestion, hints } = extractCeeRecovery(err)
  const showRetry = retryable !== false
  const baseMessage = buildBase(showRetry)
  const hintsBlock = formatRecoveryHints(hints)
  const content = [baseMessage, suggestion ?? '', hintsBlock]
    .filter((s) => s.length > 0)
    .join('\n\n')
  return { content, showRetry }
}

/**
 * Render the 0.19.0 `recovery.hints[]` bullets as display lines. Pure string
 * assembly — the entries were already display-guarded in extraction. Empty
 * string when there is nothing to show, so callers can filter it out.
 */
export function formatRecoveryHints(hints: string[] | undefined): string {
  if (!hints || hints.length === 0) return ''
  return hints.map((h) => `• ${h}`).join('\n')
}

/**
 * Normalisation note (deliberate non-decision)
 * -------------------------------------------
 * The CEE recovery suggestion is rendered VERBATIM. House copy standards
 * (British English, no em dashes, no raw codes, sentence case) are therefore
 * delegated to the producer, guarded here only by the *reject-only* checks in
 * `looksLikeCode`.
 *
 * We deliberately do NOT rewrite producer prose — no en-dash substitution, no
 * -ize/-ise mapping, no case fixing. Any such rewrite is lossy on inputs it
 * cannot distinguish: an em dash inside a quoted user brief, a wire field name
 * like `analyze_sentiment` or a quoted identifier, a proper noun that must stay
 * capitalised. Corrupting a correct suggestion is worse than passing through
 * a stylistically off one, because the suggestion is the *only* specific
 * guidance the user gets on a non-retryable failure.
 *
 * Reject-only guards are safe because rejection degrades to the caller's own
 * generic copy. Rewriting has no such safe fallback. If house style needs
 * enforcing on this field, it belongs at the producer (see the SCHEMA ASK
 * above) or in a shared copy linter, not in a defensive UI reader.
 */

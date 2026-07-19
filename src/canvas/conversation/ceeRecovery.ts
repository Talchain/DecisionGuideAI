/**
 * CEE failure-recovery reader.
 *
 * A1 brief item 2 (failure recovery on screen). When a draft/turn fails, CEE
 * returns an error envelope carrying two pieces the UI must honour:
 *   1. a `retryable` marker — whether offering "Try again" can actually work;
 *   2. a *specific recovery suggestion* — plain-language guidance on what to
 *      do instead of, or alongside, retrying.
 *
 * Wire provenance / schema ask
 * ----------------------------
 * As of @talchain/schemas 0.18.0 the `CeeTypedErrorSchema` is `.passthrough()`
 * and types only { error, message, retryable, elapsed_ms?, request_id? }. The
 * `retryable` boolean IS typed (also `retriable` is the canonical PLoT run.v1
 * spelling — see src/types/cee.ts CeeError). The recovery suggestion is NOT
 * typed on the schema, and is absent from CEE Spec v04's CEEErrorResponseV1
 * ({ error: { code, message, details?, retryable } }). It rides on the wire as
 * an untyped passthrough sibling. Until the schema pins it, we read it
 * defensively from a small set of de-facto field names and fail closed.
 *
 * SCHEMA ASK: add a typed `recovery_suggestion?: string` (or confirm the real
 * producer field name) to CeeTypedErrorSchema so the UI can stop
 * passthrough-sniffing and gain a compile-time contract.
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

/** Field names, in priority order, under which CEE may place the recovery suggestion. */
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

/** True when the string looks like an enum/error code rather than prose. */
function looksLikeCode(value: string): boolean {
  // e.g. CEE_LLM_TIMEOUT, UPSTREAM_TIMEOUT, INGRESS_CONTRACT_VIOLATION — all
  // upper-snake, no lowercase, no spaces. Real suggestions are sentences.
  return /^[A-Z][A-Z0-9_]{2,}$/.test(value.trim())
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
    if (result.retryable !== undefined && result.suggestion !== undefined) break
  }

  return result
}

export interface FailureRender {
  /**
   * Message body to render: the caller's generic copy, with the specific CEE
   * recovery suggestion appended when one is present (never replacing it —
   * layering keeps the honest fallback visible).
   */
  content: string
  /**
   * Whether to render the "Try again" affordance. Fail closed: `true` unless
   * the wire explicitly marked the failure `retryable: false`.
   */
  showRetry: boolean
}

/**
 * Compose the failure render from the caller's generic message plus the CEE
 * envelope. Pure — the caller owns actually building the chip/button.
 */
export function buildFailureRender(baseMessage: string, err: unknown): FailureRender {
  const { retryable, suggestion } = extractCeeRecovery(err)
  const content = suggestion ? `${baseMessage}\n\n${suggestion}` : baseMessage
  const showRetry = retryable !== false
  return { content, showRetry }
}

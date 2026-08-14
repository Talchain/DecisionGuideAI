/**
 * P0.6 — User-Friendly Errors
 *
 * Transforms technical error messages into plain English for users.
 *
 * Rule: Every error panel includes:
 * - Plain-English headline
 * - One-sentence explanation
 * - One action button text
 *
 * Forbidden: Raw error codes, service names (ISL, CEE, PLoT), technical stack traces.
 */

import { sanitiseStatusReason } from '../utils/sanitiseStatusReason'

// =============================================================================
// Types
// =============================================================================

export interface UserFriendlyError {
  /** Plain-English headline */
  headline: string

  /** One-sentence explanation */
  explanation: string

  /** Primary action button text */
  actionText: string

  /** Secondary action (optional) */
  secondaryActionText?: string

  /** Severity for styling */
  severity: 'error' | 'warning' | 'info'

  /** Whether user can retry */
  canRetry: boolean
}

export interface ErrorInput {
  /** Error code from API */
  code?: string

  /** Raw error message */
  message?: string

  /** HTTP status code */
  status?: number

  /** Service that failed */
  service?: 'plot' | 'isl' | 'cee' | 'unknown'

  /** Whether this is a network error */
  isNetworkError?: boolean

  /** Whether results are still partially available */
  hasPartialResults?: boolean

  /** Explicit canRetry flag from error object (takes precedence) */
  canRetry?: boolean
}

// =============================================================================
// Error Mapping
// =============================================================================

/**
 * Map error codes to user-friendly messages
 */
const ERROR_MESSAGES: Record<string, Omit<UserFriendlyError, 'canRetry'>> = {
  // Network errors
  'NETWORK_ERROR': {
    headline: 'Connection issue',
    explanation: 'We couldn\'t reach our servers. Please check your internet connection.',
    actionText: 'Try Again',
    severity: 'error',
  },
  'TIMEOUT': {
    headline: 'Request took too long',
    explanation: 'The analysis is taking longer than expected. You can try again with a simpler model.',
    actionText: 'Try Again',
    severity: 'warning',
  },

  // Auth errors
  'UNAUTHORIZED': {
    headline: 'Session expired',
    explanation: 'Please refresh the page to continue.',
    actionText: 'Refresh Page',
    severity: 'error',
  },
  'FORBIDDEN': {
    headline: 'Access denied',
    explanation: 'You don\'t have permission for this action.',
    actionText: 'Go Back',
    severity: 'error',
  },

  // Validation errors
  'INVALID_INPUT': {
    headline: 'Model needs adjustment',
    explanation: 'Some parts of your model need to be updated before running analysis.',
    actionText: 'Review Model',
    severity: 'warning',
  },
  'EMPTY_GRAPH': {
    headline: 'Add elements first',
    explanation: 'Your model needs at least one factor before running analysis.',
    actionText: 'Add Elements',
    severity: 'info',
  },

  // Service errors
  'SERVICE_UNAVAILABLE': {
    headline: 'Service temporarily unavailable',
    explanation: 'We\'re experiencing high demand. Please try again in a moment.',
    actionText: 'Try Again',
    secondaryActionText: 'Continue Without',
    severity: 'warning',
  },
  'RATE_LIMITED': {
    headline: 'Too many requests',
    explanation: 'Please wait a moment before trying again.',
    actionText: 'Wait and Retry',
    severity: 'warning',
  },

  // ROADMAP 1.54 density wall (PLoT #209): graph refused at the engine's
  // complexity ceiling. Own entry so the copy is ours — the producer
  // message names node×edge budget maths and is debug-panel-only.
  'GRAPH_TOO_COMPLEX': {
    headline: 'Model too complex to analyse',
    explanation: 'This model has more factors and connections than the analysis engine can compute reliably. Remove weaker or duplicate influences, or split the decision into smaller models, then re-run.',
    actionText: 'Simplify Model',
    severity: 'warning',
  },

  // Validation errors from backend (422)
  'VALIDATION_BLOCKED': {
    headline: 'Model needs adjustment',
    explanation: 'Each option needs intervention values before analysis can run. Click an option node to configure.',
    actionText: 'Review Model',
    severity: 'warning',
  },

  // Analysis errors
  'ANALYSIS_FAILED': {
    headline: 'Analysis couldn\'t complete',
    explanation: 'Something went wrong during analysis. Your model is unchanged.',
    actionText: 'Try Again',
    severity: 'error',
  },
  // ⚠ ROADMAP 2.1127. This entry used to read "We received the analysis results
  // but had trouble displaying them." — a claim of RECEIPT the code cannot
  // support. `PROCESSING_ERROR` is minted by `ProcessingError.wrap(err)`
  // (api-errors.ts), which `useV2Run` uses as its RESIDUAL bucket: the
  // catch-all for a throw that is neither a typed API error nor a network
  // error.
  //
  // ⚠ AND IT MAY NOT CLAIM THE OPPOSITE EITHER. The first fix here said "so
  // this run produced no results" — false in a reachable cell: `useV2Run` calls
  // `resultsComplete` at `:991` and then runs ~120 UNGUARDED lines before its
  // success return, so a throw in `generateGraphHash` (`:1038`),
  // `persistAnalysisSuccess` (`:1039`), `setRunMeta` (`:1056`), `setGate`
  // (`:1073`/`:1079`/`:1090`) or `updateRobustnessGateFromV2` (`:1098`) lands in
  // the catch at `:1150` with THIS run's results already stored and on screen.
  // The copy asserts NOTHING about output, in either direction.
  'PROCESSING_ERROR': {
    headline: 'Something went wrong during this analysis',
    explanation: 'Something went wrong while processing this analysis.',
    actionText: 'Try Again',
    severity: 'warning',
  },
  'CEE_DEGRADED': {
    headline: 'Partial analysis available',
    explanation: 'The full review couldn\'t complete, but your core results are still valid.',
    actionText: 'View Results',
    secondaryActionText: 'Retry Full Analysis',
    severity: 'warning',
  },
  'ISL_DEGRADED': {
    headline: 'Some insights unavailable',
    explanation: 'We couldn\'t load all insights, but the main analysis is complete.',
    actionText: 'View Results',
    severity: 'warning',
  },

  // Comparison errors
  'COMPARISON_FAILED': {
    headline: 'Comparison couldn\'t complete',
    explanation: 'We couldn\'t compare your options. Try again or view individual results.',
    actionText: 'Try Again',
    secondaryActionText: 'View Individual Results',
    severity: 'error',
  },
}

/**
 * ROADMAP 2.1127 — the code set, DERIVED from the map rather than hand-listed,
 * so a guard over "every code" cannot go quietly short as codes are added
 * (CLAUDE.md trap 12). Exported for the copy↔affordance invariant.
 */
export const ALL_ERROR_CODES: readonly string[] = Object.keys(ERROR_MESSAGES)

// HTTP status code mapping
const STATUS_MESSAGES: Record<number, Omit<UserFriendlyError, 'canRetry'>> = {
  400: ERROR_MESSAGES['INVALID_INPUT'],
  401: ERROR_MESSAGES['UNAUTHORIZED'],
  403: ERROR_MESSAGES['FORBIDDEN'],
  404: {
    headline: 'Not found',
    explanation: 'The requested resource couldn\'t be found.',
    actionText: 'Go Back',
    severity: 'error',
  },
  429: ERROR_MESSAGES['RATE_LIMITED'],
  500: {
    headline: 'Something went wrong',
    explanation: 'An unexpected error occurred. Please try again.',
    actionText: 'Try Again',
    severity: 'error',
  },
  502: ERROR_MESSAGES['SERVICE_UNAVAILABLE'],
  503: ERROR_MESSAGES['SERVICE_UNAVAILABLE'],
  504: ERROR_MESSAGES['TIMEOUT'],
}

/** Companion to ALL_ERROR_CODES for the status-mapped entries. */
export const ALL_STATUS_CODES: readonly number[] = Object.keys(STATUS_MESSAGES).map(Number)

/**
 * ROADMAP 2.1127 — codes where the USER must change something before a re-run
 * could possibly succeed, so offering "Try Again" would be an empty affordance.
 * Everything else may be re-run by the user.
 *
 * ⚠ This is the "may the user re-run?" answer and it is deliberately SEPARATE
 * from `ApiError.retryable` ("would an automatic retry help?"). See the comment
 * at the `canRetry` derivation in `getUserFriendlyError`.
 */
export const USER_RERUN_BLOCKED_CODES: readonly string[] = [
  'UNAUTHORIZED',
  'FORBIDDEN',
  'INVALID_INPUT',
  'EMPTY_GRAPH',
  'VALIDATION_BLOCKED',
]

// Default error message
const DEFAULT_ERROR: Omit<UserFriendlyError, 'canRetry'> = {
  headline: 'Something went wrong',
  explanation: 'An unexpected error occurred. Please try again.',
  actionText: 'Try Again',
  severity: 'error',
}

// =============================================================================
// Main Export
// =============================================================================

/**
 * Transform technical error to user-friendly format
 *
 * @example
 * const error = getUserFriendlyError({
 *   code: 'NETWORK_ERROR',
 *   message: 'Failed to fetch',
 *   isNetworkError: true,
 * })
 * // => { headline: 'Connection issue', explanation: '...', actionText: 'Try Again', ... }
 */
export function getUserFriendlyError(input: ErrorInput): UserFriendlyError {
  let baseError: Omit<UserFriendlyError, 'canRetry'>

  // Priority: code > status > network error > default
  if (input.code && ERROR_MESSAGES[input.code]) {
    baseError = ERROR_MESSAGES[input.code]

    // For validation errors, use the backend's specific message if non-empty
    // Sanitise to strip internal field names — raw text remains in debug panel
    if (input.code === 'VALIDATION_BLOCKED' && input.message?.trim()) {
      baseError = {
        ...baseError,
        explanation: sanitiseStatusReason(input.message),
      }
    }
  } else if (input.status && STATUS_MESSAGES[input.status]) {
    baseError = STATUS_MESSAGES[input.status]
  } else if (input.isNetworkError) {
    baseError = ERROR_MESSAGES['NETWORK_ERROR']
  } else {
    baseError = DEFAULT_ERROR
  }

  // Modify for partial results.
  //
  // ⚠ ROADMAP 2.1127. This limb used to append "Your core results are still
  // valid." — a VALIDITY VERDICT that nothing in this module, or upstream of
  // it, ever assessed. `hasPartialResults` is a claim about how much of a run
  // came back; it is not, and cannot be, evidence that what came back is sound.
  // The affordances stay (a user with something on screen may want to carry on
  // rather than rerun); the verdict goes. Anything that genuinely wants to
  // describe partial results must say WHICH results and on what basis, at the
  // surface that owns them — see `stale-results-banner` in OutputsDock for the
  // shape that does this honestly.
  if (input.hasPartialResults) {
    return {
      ...baseError,
      secondaryActionText: 'Continue Without',
      canRetry: true,
    }
  }

  // ⚠ ROADMAP 2.1127 — TWO QUESTIONS, ONE NAME (CLAUDE.md trap 21).
  //
  //   `ApiError.retryable`  answers "would an AUTOMATIC retry plausibly help?"
  //                         It defaults to false, and `ProcessingError` and
  //                         `MalformedApiResponseError` hardcode false.
  //   this `canRetry`       answers "may the USER re-run this analysis?"
  //
  // They are not the same question and must not share an answer. Feeding the
  // banner from `retryable` removed "Try Again" from exactly the two classes
  // whose own copy tells the user to try again — an instruction with no
  // affordance. The user-facing decision is made HERE, from the code, by the
  // explicit list below: re-running is blocked only where the user must change
  // something first, and permitted everywhere else (including the recoverable
  // display/processing classes).
  //
  // `input.canRetry` is still honoured when a caller passes one, but the dock
  // deliberately does NOT pass the producer's `retryable` into it.
  const canRetry = input.canRetry !== undefined
    ? input.canRetry
    : !USER_RERUN_BLOCKED_CODES.includes(input.code || '')

  return {
    ...baseError,
    canRetry,
  }
}

/**
 * Check if error should block results display
 */
export function isBlockingError(input: ErrorInput): boolean {
  // These errors don't block partial results
  const nonBlockingCodes = ['CEE_DEGRADED', 'ISL_DEGRADED', 'RATE_LIMITED']

  if (input.code && nonBlockingCodes.includes(input.code)) {
    return false
  }

  if (input.hasPartialResults) {
    return false
  }

  return true
}

/**
 * Get error headline only (for compact displays)
 */
export function getErrorHeadline(input: ErrorInput): string {
  return getUserFriendlyError(input).headline
}

/**
 * Get action text based on error type
 */
export function getErrorActionText(input: ErrorInput): string {
  return getUserFriendlyError(input).actionText
}

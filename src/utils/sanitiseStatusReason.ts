/**
 * Sanitise backend status_reason text for user display.
 *
 * Strips internal field names, constraint identifiers, and technical jargon
 * that leak from PLoT/CEE validation error messages.
 *
 * IMPORTANT: This function is for user-facing display only. Raw status_reason
 * must remain accessible in the debug panel / diagnostic bundle — do not
 * sanitise values written to debug stores or console output.
 */

/**
 * Known node-type prefixes used in internal identifiers.
 * e.g. fac_revenue, opt_option_a, goal_profit, outcome_churn
 */
const NODE_ID_RE = /\b(?:fac|opt|goal|outcome|edge|node|constraint)_[a-z0-9_]+\b/gi

/**
 * Generic snake_case identifiers with 3+ segments (e.g. prior_distribution_alpha).
 * Two-segment names like "status_reason" are common in plain English so we
 * require three segments to reduce false positives.
 */
const SNAKE_ID_RE = /\b[a-z][a-z0-9]*(?:_[a-z0-9]+){2,}\b/g

/**
 * Phrase-level replacements: match technical sentence patterns and replace entirely.
 * Ordered most-specific first.
 */
const PHRASE_RULES: Array<[RegExp, string]> = [
  [/constraint[_\s]\S+\s+violated/gi, 'a model constraint was violated'],
  [/node[_\s]?id\s+\S+\s+not\s+found/gi, 'a referenced element was not found'],
]

const GENERIC_FALLBACK =
  'The model could not be validated. Please review your setup and try again.'

/**
 * Sanitise a raw status_reason for end-user display.
 *
 * - Applies phrase-level rewrites for known technical patterns
 * - Strips remaining internal identifiers (node IDs, snake_case field names)
 * - Collapses whitespace and capitalises the result
 * - Falls back to a generic message if the result is too short
 */
export function sanitiseStatusReason(reason: string): string {
  if (!reason || typeof reason !== 'string') return reason

  let s = reason

  // 1. Phrase-level rewrites (most specific)
  for (const [pattern, replacement] of PHRASE_RULES) {
    s = s.replace(pattern, replacement)
  }

  // 2. Strip remaining internal identifiers
  s = s.replace(NODE_ID_RE, '')
  s = s.replace(SNAKE_ID_RE, '')

  // 3. Cleanup: collapse whitespace, trim, strip leading/trailing punctuation artefacts
  s = s.replace(/\s{2,}/g, ' ').trim()
  s = s.replace(/^[,;:\s]+/, '').replace(/[,;:\s]+$/, '').trim()

  // 4. Capitalise first letter
  if (s.length > 0) {
    s = s.charAt(0).toUpperCase() + s.slice(1)
  }

  // 5. Ensure sentence ends with period
  if (s.length > 0 && !/[.!?]$/.test(s)) {
    s += '.'
  }

  // 6. Fallback if sanitisation collapsed to something unusably short
  if (s.length < 10) {
    return GENERIC_FALLBACK
  }

  return s
}

/**
 * Bundle Completeness Validation
 *
 * Checks that all expected components are present in a debug bundle.
 * Operates on the PayloadBundle + metadata available in DebugData (not the export DebugBundle).
 *
 * Returns key-like identifiers for missing/present items — the UI component
 * is responsible for translating these to human-readable labels.
 */

/** Minimal shape needed for validation — avoids coupling to full DebugData */
export interface BundleCompletenessInput {
  payloads: {
    plot_request?: unknown
    plot_response?: unknown
    isl_response?: unknown
    cee_response?: unknown
    cee_request?: unknown
  }
  request_id: string | null
  request_id_chain: { ui_generated: string | null } | null
}

export interface BundleCompletenessResult {
  complete: boolean
  missing: string[]
  /** Optional observability fields present in PLoT response */
  optional_present: string[]
  /** Optional observability fields absent from PLoT response */
  optional_absent: string[]
}

/** Keys that must be present for a bundle to be considered complete */
const REQUIRED_KEYS = [
  'plot_request',
  'plot_response',
  'isl_response',
  'request_id',
] as const

/** Optional observability fields checked on plot_response */
const OPTIONAL_KEYS = [
  'repairs_applied',
  'constraints_status',
  'review_status',
  'critiques',
] as const

/**
 * Validate that all expected debug bundle components are populated.
 *
 * Does NOT block or throw — incomplete bundles are still useful for debugging.
 */
export function validateBundleCompleteness(input: BundleCompletenessInput): BundleCompletenessResult {
  const missing: string[] = []

  for (const key of REQUIRED_KEYS) {
    if (key === 'request_id') {
      // Request ID can come from either direct field or chain
      if (!input.request_id && !input.request_id_chain?.ui_generated) {
        missing.push(key)
      }
    } else {
      if (input.payloads[key] == null) {
        missing.push(key)
      }
    }
  }

  // Check optional observability keys on plot_response
  const optionalPresent: string[] = []
  const optionalAbsent: string[] = []
  const plotResponse = input.payloads.plot_response as Record<string, unknown> | undefined

  for (const key of OPTIONAL_KEYS) {
    if (plotResponse && plotResponse[key] != null) {
      optionalPresent.push(key)
    } else {
      optionalAbsent.push(key)
    }
  }

  return {
    complete: missing.length === 0,
    missing,
    optional_present: optionalPresent,
    optional_absent: optionalAbsent,
  }
}

/** Human-readable labels for bundle component keys (used by CIL tab) */
export const BUNDLE_KEY_LABELS: Record<string, string> = {
  plot_request: 'PLoT request',
  plot_response: 'PLoT response',
  isl_response: 'ISL response',
  request_id: 'Request ID',
  cee_response: 'CEE response',
  cee_request: 'CEE request',
  repairs_applied: 'Repairs applied',
  constraints_status: 'Constraint status',
  review_status: 'Review status',
  critiques: 'Critiques',
}

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
}

/** Keys that must be present for a bundle to be considered complete */
const REQUIRED_KEYS = [
  'plot_request',
  'plot_response',
  'isl_response',
  'request_id',
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

  return {
    complete: missing.length === 0,
    missing,
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
}

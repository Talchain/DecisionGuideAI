/**
 * Error types for CEE and PLoT error handling.
 *
 * Pure TypeScript types — no runtime parsing.
 * UI uses these for compile-time safety when handling service errors.
 */

// =============================================================================
// CEE Error Codes
// =============================================================================

/**
 * Known CEE error codes for switch/case matching in UI error handling.
 * Superset of all codes observed across CEE, PLoT adapters, and debug panel.
 */
export type CeeErrorCodeType =
  | 'CEE_TIMEOUT'
  | 'CEE_UNAVAILABLE'
  | 'CEE_TEMPORARY'
  | 'CEE_RATE_LIMIT'
  | 'CEE_VALIDATION_ERROR'
  | 'CEE_INVALID_INPUT'
  | 'CEE_INTERNAL_ERROR'
  | 'CEE_MODEL_ERROR'
  | 'CEE_GRAPH_TOO_LARGE'
  | 'CEE_BRIEF_TOO_SHORT'
  | 'CEE_NETWORK_ERROR'
  | 'CEE_QUOTA_EXCEEDED'

// =============================================================================
// PLoT BFF Error Types
// =============================================================================

/**
 * Error envelope sent by PLoT when CEE fails upstream.
 * UI receives this through the PLoT response when CEE is unavailable.
 */
export interface PlotCeeUpstreamEnvelope {
  /** HTTP status (typically 502 or 503) */
  status: number
  /** Error code from PLoT (e.g., 'UPSTREAM_CEE_ERROR') */
  code: string
  /** Human-readable error message */
  message: string
  /** Original CEE error (if available) */
  upstream_error?: {
    code?: string
    message?: string
    retriable?: boolean
  }
  /** Trace ID for debugging */
  trace_id?: string
  /** Whether the caller should retry */
  retriable: boolean
}

/**
 * Timeout error from PLoT proxy layer.
 * Distinct from CEE timeouts — this is PLoT's own timeout.
 */
export interface PlotProxyTimeoutError {
  /** HTTP status (typically 504) */
  status: 504
  /** Error code */
  code: 'PLOT_PROXY_TIMEOUT'
  /** Human-readable message */
  message: string
  /** Time waited before timeout in ms */
  timeout_ms: number
  /** Trace ID for debugging */
  trace_id?: string
}

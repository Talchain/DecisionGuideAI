/**
 * Request ID chain types for tracking ID propagation across services.
 *
 * Used by the ContractIntegrityTab to verify request IDs match
 * at each boundary: UI → PLoT → ISL.
 */

// =============================================================================
// Analysis Request Chain
// =============================================================================

/**
 * Analysis request ID chain: UI → PLoT → ISL.
 * Hard invariant — ID mismatches indicate routing or proxy errors.
 */
export interface AnalysisRequestIdChain {
  /** Request ID sent by UI to PLoT */
  ui_sent: string | null
  /** Request ID received by PLoT */
  plot_received: string | null
  /** Request ID forwarded by PLoT to ISL */
  forwarded_to_isl: string | null
  /** Request ID echoed back by ISL */
  isl_echoed: string | null
  /** Whether all non-null IDs in the chain match */
  all_match: boolean
}

// =============================================================================
// Draft Graph Trace
// =============================================================================

/**
 * Draft graph trace for CEE request/response correlation.
 * Informational — does not affect analysis scoring.
 */
export interface DraftGraphTrace {
  /** CEE trace request ID (from CEE response) */
  cee_trace: string | null
}

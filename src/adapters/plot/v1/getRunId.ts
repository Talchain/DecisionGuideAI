/**
 * Run ID Helper
 *
 * Provides a single source of truth for extracting run identifiers from PLoT API responses.
 *
 * Temporary Fallback Strategy:
 * - Prefer: result.response_hash (future backend field)
 * - Fallback: model_card.response_hash (current backend field)
 *
 * When backend PR lands adding result.response_hash, this helper allows us to
 * switch without code churn - just update the priority here.
 */

import type { RunResponse } from '../../../types/plot'
import type { NormalizedReport } from './reportNormalizer'

/**
 * Extract run ID from raw API response
 *
 * @param response - Raw PLoT API response
 * @returns Response hash string, or undefined if not present
 *
 * @example
 * ```typescript
 * const response = await fetch('/api/plot/v1/run', { ... })
 * const runId = getRunIdFromResponse(response)
 * if (!runId) {
 *   throw new Error('Backend returned no response_hash - determinism broken')
 * }
 * ```
 */
export function getRunIdFromResponse(response: RunResponse): string | undefined {
  // Direct: response_hash at top level (when response.result is passed in)
  const directHash = (response as any)?.response_hash

  // Future: result.response_hash (when full response is passed)
  const futureHash = response?.result?.response_hash

  // Current: model_card.response_hash (temporary)
  const currentHash = response?.model_card?.response_hash

  // Fallback chain: direct → future → current → undefined
  return directHash ?? futureHash ?? currentHash
}

/**
 * Extract run ID from normalized UI report
 *
 * @param report - Normalized report from toUiReport()
 * @returns Response hash string, or undefined if not present
 *
 * @example
 * ```typescript
 * const report = toUiReport(rawResponse)
 * const runId = getRunId(report)
 * console.log(`Run ID: ${runId}`)
 * ```
 */
export function getRunId(report: NormalizedReport): string | undefined {
  return report.hash
}

/**
 * Validate that a response has a deterministic run ID
 *
 * @param response - Raw PLoT API response
 * @throws Error if response_hash is missing (determinism requirement violated)
 *
 * @example
 * ```typescript
 * const response = await fetch('/api/plot/v1/run', { ... })
 * validateRunId(response) // Throws if hash missing
 * ```
 */
export function validateRunId(response: RunResponse): void {
  const runId = getRunIdFromResponse(response)

  if (!runId) {
    throw {
      schema: 'error.v1',
      code: 'SERVER_ERROR',
      error: 'Backend returned no response_hash (determinism requirement violated)',
    }
  }
}

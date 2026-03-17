/**
 * useKeyInsight - Key insight hook (disabled)
 *
 * Audit F-38: httpV1Adapter.keyInsight() does not exist — the PLoT endpoint
 * /v1/assist/key-insight is not implemented. The original code called a
 * non-existent method, throwing TypeError at runtime.
 *
 * This hook now returns a stable disabled state. Re-enable when PLoT
 * implements the /v1/assist/key-insight endpoint and httpV1Adapter exposes it.
 */

import { useCallback } from 'react'
import type { KeyInsightResponse } from '../../adapters/plot/types'

interface UseKeyInsightOptions {
  /** Response hash from completed analysis */
  responseHash: string | null | undefined
  /** Optional scenario name for context */
  scenarioName?: string
  /** Auto-fetch on mount (default: true) */
  autoFetch?: boolean
  /** Include driver details (default: true) */
  includeDrivers?: boolean
}

interface UseKeyInsightResult {
  /** Key insight data */
  insight: KeyInsightResponse | null
  /** Loading state */
  loading: boolean
  /** Error message if fetch failed */
  error: string | null
  /** Manually refresh insight */
  refresh: () => Promise<void>
}

// Audit F-38: Disabled — httpV1Adapter.keyInsight() does not exist.
// Returns stable empty state to prevent runtime TypeError.
export function useKeyInsight(
  _options: UseKeyInsightOptions,
): UseKeyInsightResult {
  const noop = useCallback(async () => {}, [])

  return {
    insight: null,
    loading: false,
    error: null,
    refresh: noop,
  }
}

/**
 * Clear the insight cache (no-op, retained for API compatibility)
 */
export function clearInsightCache(): void {
  // no-op
}

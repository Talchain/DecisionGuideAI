/**
 * useComparisonDetection - Detects when comparison mode should be prompted
 *
 * Triggers comparison prompt when:
 * 1. CEE suggests comparison (via uiFlags.comparison_suggested)
 * 2. Graph structure has 1 decision node + 2+ option nodes
 */

import { useMemo } from 'react'
import { useCanvasStore } from '../store'

export type ComparisonReason = 'cee' | 'structure' | null

export interface ComparisonDetectionResult {
  /** Whether to show the comparison prompt */
  shouldPrompt: boolean
  /** Reason for the prompt */
  reason: ComparisonReason
  /** Whether comparison is structurally possible */
  canCompare: boolean
  /** Option nodes available for comparison */
  optionNodes: Array<{ id: string; label: string }>
}

/**
 * Hook to detect when scenario comparison should be prompted
 *
 * @example
 * ```tsx
 * const { shouldPrompt, reason, canCompare, optionNodes } = useComparisonDetection()
 *
 * if (shouldPrompt && canCompare) {
 *   // Show comparison prompt
 * }
 * ```
 */
export function useComparisonDetection(): ComparisonDetectionResult {
  const nodes = useCanvasStore((state) => state.nodes)
  const ceeReview = useCanvasStore((state) => state.runMeta.ceeReview)

  return useMemo(() => {
    // Check CEE suggestion
    const ceeSuggested = ceeReview?.uiFlags?.comparison_suggested === true

    // Check graph structure: 1 decision + 2+ options
    const decisions = nodes.filter((n) => n.type === 'decision')
    const options = nodes.filter((n) => n.type === 'option')

    const hasValidStructure = decisions.length === 1 && options.length >= 2
    const structureSuggested = hasValidStructure

    // Extract option labels for UI
    const optionNodes = options.map((opt) => ({
      id: opt.id,
      label: (opt.data?.label as string) || `Option ${opt.id}`,
    }))

    // Determine reason (CEE takes priority)
    let reason: ComparisonReason = null
    if (ceeSuggested) {
      reason = 'cee'
    } else if (structureSuggested) {
      reason = 'structure'
    }

    return {
      shouldPrompt: ceeSuggested || structureSuggested,
      reason,
      canCompare: hasValidStructure,
      optionNodes,
    }
  }, [nodes, ceeReview])
}

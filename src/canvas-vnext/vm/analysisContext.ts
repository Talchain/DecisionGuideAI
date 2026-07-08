// Analysis context builder — the fail-closed identity + freshness core.
// Pure function: no React, no store imports (testable without mocks).

import type { AnalysisContextVM, VNextAnalysisState } from './types'

interface MinimalNode {
  id: string
  type?: string
  data?: Record<string, unknown> | undefined
}

export interface AnalysisContextInputs {
  /** From useAnalysisDisplayState (canonical freshness vocabulary). */
  displayState: VNextAnalysisState
  /** The widened results report (store results.report), or null. */
  report: Record<string, any> | null
  nodes: readonly MinimalNode[]
  /** store.goalThreshold — the USER success target in user units. */
  goalThreshold: number | null
}

function isOptionNode(n: MinimalNode): boolean {
  return n.type === 'option' || n.data?.type === 'option'
}

/**
 * UI-SEM-072 (identity leg): resolve recommended_option_id fail-closed —
 * it must name an existing option node and at least two option nodes must be
 * visible (single-option runs never get a "Leading" chip; matches OptionNode's
 * ≥2 rule). Unlike OptionNode's isRecommended, there is deliberately NO
 * win-max fallback: an unresolved producer recommendation means NO leader
 * claim anywhere on this surface.
 */
export function buildAnalysisContext(inputs: AnalysisContextInputs): AnalysisContextVM {
  const { displayState, report, nodes, goalThreshold } = inputs

  const hasResults = report != null && (displayState === 'complete' || displayState === 'results_stale')
  const isStaleResult = report != null && displayState === 'results_stale'

  let leadingOptionId: string | null = null
  let leadingOptionLabel: string | null = null
  if (hasResults) {
    const recommendedId = report?.robustness?.recommended_option_id
    if (typeof recommendedId === 'string' && recommendedId) {
      const optionNodes = nodes.filter(isOptionNode)
      const match = optionNodes.find((n) => n.id === recommendedId)
      if (match && optionNodes.length >= 2) {
        leadingOptionId = recommendedId
        const label = match.data?.label
        leadingOptionLabel = typeof label === 'string' && label ? label : recommendedId
      }
    }
  }

  return {
    displayState,
    hasResults,
    isStaleResult,
    leadingOptionId,
    leadingOptionLabel,
    goalThreshold: typeof goalThreshold === 'number' ? goalThreshold : null,
  }
}

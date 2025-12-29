/**
 * Analysis Display State (P0-2)
 *
 * Single source of truth for what UI elements should be shown
 * based on analysis state and critical issues.
 *
 * Rule: Critical issues that block analysis should dominate the UI -
 * hide confident results and show clear action prompts instead.
 *
 * This prevents mixed messaging like showing "99% confidence" alongside
 * "Model not identifiable" which confuses users.
 */

import type { CritiqueItemV1 } from '../adapters/plot/types'

/**
 * Display state for analysis results UI
 */
export interface AnalysisDisplayState {
  /** Whether to show outcome range/percentages */
  showOutcomeRange: boolean
  /** Whether to show key insight summary */
  showKeyInsight: boolean
  /** Whether to show recommendation */
  showRecommendation: boolean
  /** Whether to show a blocking message instead */
  showBlockingMessage: boolean
  /** The blocking reason if applicable */
  blockingReason?: string
  /** Actions to resolve the blocker */
  actions: string[]
}

/**
 * Enrichment data structure for display state computation
 */
export interface EnrichmentForDisplayState {
  /** Issues from validation/analysis */
  issues?: Array<{
    severity: 'critical' | 'warning' | 'info'
    message: string
    suggested_action?: string
    blocks_analysis?: boolean
  }>
  /** Critique items from engine */
  critique?: CritiqueItemV1[]
  /** Model identifiability status */
  identifiability_tag?: 'identifiable' | 'not_identifiable' | 'partially_identifiable' | 'unknown'
}

/**
 * Determine what UI elements to show based on analysis state.
 *
 * When critical issues exist that block analysis:
 * - Hide outcome percentages (they may be misleading)
 * - Hide key insights (they may contradict the issue)
 * - Hide recommendations (they may not be valid)
 * - Show clear blocking message with actions
 *
 * @param enrichment - Enrichment data from PLoT response
 * @returns Display state for UI rendering
 */
export function getAnalysisDisplayState(
  enrichment: EnrichmentForDisplayState | null | undefined
): AnalysisDisplayState {
  // Default: show everything
  const defaultState: AnalysisDisplayState = {
    showOutcomeRange: true,
    showKeyInsight: true,
    showRecommendation: true,
    showBlockingMessage: false,
    actions: [],
  }

  if (!enrichment) {
    return defaultState
  }

  // Check for critical issues that block analysis
  const criticalIssues = enrichment.issues?.filter(
    (i) => i.severity === 'critical' && i.blocks_analysis
  ) ?? []

  // Check for BLOCKER-level critique from engine
  const blockerCritique = enrichment.critique?.filter(
    (c) => c.severity === 'BLOCKER'
  ) ?? []

  // Check for non-identifiable model (critical issue)
  const isNotIdentifiable = enrichment.identifiability_tag === 'not_identifiable'

  // Combine all blocking conditions
  const hasBlockingIssue =
    criticalIssues.length > 0 ||
    blockerCritique.length > 0 ||
    isNotIdentifiable

  if (!hasBlockingIssue) {
    return defaultState
  }

  // Determine the primary blocking reason
  let blockingReason: string
  const actions: string[] = []

  if (isNotIdentifiable) {
    blockingReason = 'Model is not identifiable from the current graph structure. Outcome estimates may be unreliable.'
    actions.push('Add instrumental variables or adjust for confounders')
  } else if (criticalIssues.length > 0) {
    blockingReason = criticalIssues[0].message
    criticalIssues.forEach((issue) => {
      if (issue.suggested_action) {
        actions.push(issue.suggested_action)
      }
    })
  } else if (blockerCritique.length > 0) {
    blockingReason = blockerCritique[0].message
    blockerCritique.forEach((critique) => {
      if (critique.suggested_fix) {
        actions.push(critique.suggested_fix)
      }
    })
  } else {
    blockingReason = 'Analysis cannot be completed due to critical issues'
  }

  // Critical issues present - gate the confident results
  return {
    showOutcomeRange: false,
    showKeyInsight: false,
    showRecommendation: false,
    showBlockingMessage: true,
    blockingReason,
    actions: actions.slice(0, 3), // Max 3 actions
  }
}

/**
 * Check if we should suppress outcome values due to blocking issues.
 * Simpler check for components that just need a boolean gate.
 */
export function shouldSuppressOutcomes(
  enrichment: EnrichmentForDisplayState | null | undefined
): boolean {
  const state = getAnalysisDisplayState(enrichment)
  return state.showBlockingMessage
}

/**
 * Create a log entry for debugging mixed messaging issues.
 * Call this in dev mode when rendering analysis results.
 */
export function logMixedMessagingCheck(
  componentName: string,
  enrichment: EnrichmentForDisplayState | null | undefined,
  outcomeValue?: number | null
): void {
  if (!import.meta.env.DEV) return

  const state = getAnalysisDisplayState(enrichment)

  console.log(`[${componentName}] Mixed messaging check:`, {
    hasBlockingIssue: state.showBlockingMessage,
    blockingReason: state.blockingReason,
    showOutcomeRange: state.showOutcomeRange,
    outcomeValue,
    identifiability: enrichment?.identifiability_tag,
    criticalIssueCount: enrichment?.issues?.filter(i => i.severity === 'critical').length ?? 0,
    blockerCritiqueCount: enrichment?.critique?.filter(c => c.severity === 'BLOCKER').length ?? 0,
  })
}

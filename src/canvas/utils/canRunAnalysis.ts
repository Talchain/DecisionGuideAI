// ============================================================================
// UNIFIED RUN GATING LOGIC
// ============================================================================
//
// PURPOSE: Single source of truth for "Can the user click Run?"
// This is the PRIMARY gating helper - use this for:
//   - Run button enabled/disabled state
//   - Run button tooltip text
//   - Keyboard shortcut gating (Ctrl+Enter)
//
// INPUTS REQUIRED:
//   - graphHealth: Validation issues (from store)
//   - readiness: CEE readiness assessment (from useGraphReadiness)
//   - hasBlockers: Critical unified actions (from useUnifiedActions)
//   - nodeCount: Basic graph structure check
//   - isRunning: Prevent double-run
//
// RELATED FILES:
//   - runEligibility.ts: Lower-level eligibility check (node/edge counts, limits)
//     Use runEligibility when you don't have CEE readiness available.
//   - useRunEligibilityCheck.ts: React hook that combines both
//
// USAGE:
//   import { canRunAnalysis, getRunButtonTooltip } from '@/canvas/utils/canRunAnalysis'
//
//   const result = canRunAnalysis({ graphHealth, readiness, hasBlockers, nodeCount })
//   <Button disabled={!result.allowed} title={getRunButtonTooltip(result)}>
//     Run Analysis
//   </Button>
// ============================================================================

/**
 * canRunAnalysis - Unified logic for determining if analysis can run
 *
 * Single source of truth for Run button gating and explanatory tooltips.
 * Combines validation state, readiness checks, and blocker detection.
 */

import type { GraphReadiness } from '../hooks/useGraphReadiness'

export interface CanRunAnalysisResult {
  /** Whether analysis can be run */
  allowed: boolean
  /** Human-readable reason why analysis cannot run (when allowed=false) */
  reason?: string
  /** Detailed reasons for blocking (for tooltips/debug) */
  blockingReasons?: string[]
  /** Warning message (when allowed but suboptimal) */
  warning?: string
}

export interface GraphHealthState {
  issues?: Array<{
    severity: string
    code?: string
    type?: string
    message?: string
  }>
}

export interface CanRunAnalysisParams {
  /** Graph health from validation */
  graphHealth: GraphHealthState | null
  /** Graph readiness from CEE */
  readiness: GraphReadiness | null
  /** Whether there are critical/blocking actions */
  hasBlockers: boolean
  /** Number of nodes in graph */
  nodeCount: number
  /** Whether analysis is currently running */
  isRunning?: boolean
}

/**
 * Determine if analysis can run based on current state
 *
 * @param params - State from store and hooks
 * @returns CanRunAnalysisResult with allowed status and reason
 */
export function canRunAnalysis(params: CanRunAnalysisParams): CanRunAnalysisResult {
  const { graphHealth, readiness, hasBlockers, nodeCount, isRunning = false } = params

  const blockingReasons: string[] = []

  // 1. Check if already running
  if (isRunning) {
    return {
      allowed: false,
      reason: 'Analysis is currently running',
      blockingReasons: ['Analysis in progress'],
    }
  }

  // 2. Check minimum requirements
  if (nodeCount === 0) {
    return {
      allowed: false,
      reason: 'Add some nodes to get started',
      blockingReasons: ['No nodes in graph'],
    }
  }

  // 3. Check for validation blockers
  const validationBlockers = graphHealth?.issues?.filter(
    (issue) => issue.severity === 'error' || issue.severity === 'blocker'
  ) || []

  if (validationBlockers.length > 0) {
    for (const blocker of validationBlockers) {
      const message = blocker.message || blocker.code || blocker.type || 'Validation error'
      blockingReasons.push(message)
    }
  }

  // 4. Check unified action blockers
  if (hasBlockers) {
    // hasBlockers is already computed from useUnifiedActions
    // Only add if we haven't already captured from validation
    if (blockingReasons.length === 0) {
      blockingReasons.push('Critical issues need to be resolved')
    }
  }

  // 5. Check CEE readiness
  if (readiness && !readiness.can_run_analysis) {
    if (!blockingReasons.includes(readiness.confidence_explanation)) {
      blockingReasons.push(readiness.confidence_explanation || 'Graph not ready for analysis')
    }
  }

  // Determine result
  if (blockingReasons.length > 0) {
    // Format the primary reason
    const primaryReason = blockingReasons[0]
    const additionalCount = blockingReasons.length - 1

    let reason = primaryReason
    if (additionalCount > 0) {
      reason += ` (+${additionalCount} more ${additionalCount === 1 ? 'issue' : 'issues'})`
    }

    return {
      allowed: false,
      reason,
      blockingReasons,
    }
  }

  // Analysis allowed - check for warnings
  let warning: string | undefined

  // Warn if readiness is low but not blocking
  if (readiness?.readiness_level === 'fair') {
    warning = 'Analysis available - consider improvements for better results'
  }

  // Warn if there are non-blocking validation warnings
  const validationWarnings = graphHealth?.issues?.filter(
    (issue) => issue.severity === 'warning'
  ) || []

  if (validationWarnings.length > 0 && !warning) {
    warning = `${validationWarnings.length} optional improvement${validationWarnings.length === 1 ? '' : 's'} available`
  }

  return {
    allowed: true,
    warning,
  }
}

/**
 * Get tooltip text for the Run button based on canRunAnalysis result
 */
export function getRunButtonTooltip(result: CanRunAnalysisResult): string | undefined {
  if (!result.allowed && result.reason) {
    return result.reason
  }
  if (result.warning) {
    return result.warning
  }
  return undefined
}

/**
 * Get aria-label for the Run button
 */
export function getRunButtonAriaLabel(result: CanRunAnalysisResult, isRunning: boolean): string {
  if (isRunning) {
    return 'Analysis running…'
  }
  if (!result.allowed) {
    return `Run analysis (blocked: ${result.reason || 'issues need to be resolved'})`
  }
  return 'Run analysis'
}

/**
 * Get the button label based on graph state.
 * Standardised to "Run analysis" sentence-case across all CTAs (matches
 * useAnalysisDisplayState helper output and CanvasToolbar tooltip).
 */
export function getRunButtonLabel(result: CanRunAnalysisResult, isRunning: boolean): string {
  if (isRunning) {
    return 'Running analysis…'
  }
  if (!result.allowed && result.blockingReasons && result.blockingReasons.length > 0) {
    return 'Fix issues'
  }
  return 'Run analysis'
}

// =============================================================================
// NUDGE PRIORITIZATION
// =============================================================================

export interface PrioritizedNudge {
  type: 'validation' | 'coaching'
  severity: 'critical' | 'warning' | 'info'
  message: string
  action?: string
  affectedIds?: string[]
}

/**
 * Prioritize nudges by severity
 * Brief: Validation issues first, then coaching suggestions
 * Sorted: critical > warning > info
 */
export function prioritizeNudges(
  validationIssues: Array<{ severity: string; message: string; suggestedFix?: { targetId: string } }>,
  coachingNudges: Array<{ severity: 'high' | 'medium' | 'low'; message: string; action?: string }>
): PrioritizedNudge[] {
  const severityOrder: Record<string, number> = {
    critical: 0,
    error: 0,
    high: 0,
    warning: 1,
    medium: 1,
    info: 2,
    low: 2,
  }

  // Convert validation issues to nudges
  const issueNudges: PrioritizedNudge[] = validationIssues.map(issue => ({
    type: 'validation' as const,
    severity: (issue.severity === 'error' ? 'critical' : issue.severity) as 'critical' | 'warning' | 'info',
    message: issue.message,
    action: issue.suggestedFix ? 'Fix' : undefined,
    affectedIds: issue.suggestedFix ? [issue.suggestedFix.targetId] : undefined,
  }))

  // Convert coaching nudges
  const coachNudges: PrioritizedNudge[] = coachingNudges.map(nudge => ({
    type: 'coaching' as const,
    severity: (nudge.severity === 'high' ? 'critical' : nudge.severity === 'medium' ? 'warning' : 'info') as 'critical' | 'warning' | 'info',
    message: nudge.message,
    action: nudge.action,
  }))

  // Combine and sort by severity
  return [...issueNudges, ...coachNudges].sort((a, b) => {
    return (severityOrder[a.severity] ?? 2) - (severityOrder[b.severity] ?? 2)
  })
}

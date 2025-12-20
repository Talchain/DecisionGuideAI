/**
 * Readiness Computation Module
 *
 * Pure functions for computing decision readiness from local state.
 * No API calls - works with cached/synced data from stores.
 *
 * Used by:
 * - ReadinessIndicator component
 * - CTA state machine
 * - OutputsDock for CTA gating
 */

import type { GraphHealth, ValidationIssue } from '../canvas/validation/types'

// =============================================================================
// Types
// =============================================================================

/**
 * Readiness levels for the UI
 * - not_ready: Critical blockers prevent meaningful analysis
 * - needs_review: Analysis possible but issues should be addressed
 * - ready: Model is in good shape for analysis
 */
export type ReadinessLevel = 'not_ready' | 'needs_review' | 'ready'

/**
 * Readiness reason category
 */
export type ReadinessReasonType =
  | 'structural'    // Graph structure issues (cycles, orphans)
  | 'completeness'  // Missing required elements
  | 'quality'       // Quality issues (low confidence, missing evidence)
  | 'validation'    // ISL/CEE validation failures

/**
 * Individual reason for readiness state
 */
export interface ReadinessReason {
  type: ReadinessReasonType
  severity: 'blocker' | 'warning' | 'info'
  message: string
  affectedIds?: string[]  // Node/edge IDs affected
}

/**
 * Complete readiness computation result
 */
export interface ReadinessResult {
  level: ReadinessLevel
  score: number          // 0-100 normalized score
  canRunAnalysis: boolean
  reasons: ReadinessReason[]
  summary: string        // Human-readable summary
}

/**
 * Discrimination signal from PLoT engine or fallback
 */
export interface DiscriminationSignal {
  status: 'ok' | 'low_discrimination'
  value: number      // Normalized spread value
  threshold: number  // Typically 0.05
  source: 'engine' | 'fallback'
}

/**
 * Input signals for readiness computation
 */
export interface ReadinessInput {
  nodeCount: number
  edgeCount: number
  graphHealth: GraphHealth | null
  hasOutcome: boolean
  hasDecision: boolean
  islWarnings?: string[]
  ceeScore?: number       // 0-100 from CEE endpoint
  ceeSuggestions?: number // Count of CEE suggestions
  discrimination?: DiscriminationSignal  // Discrimination signal from PLoT/fallback
}

// =============================================================================
// Constants
// =============================================================================

/** Minimum nodes required for meaningful analysis */
const MIN_NODES_FOR_ANALYSIS = 2

/** Minimum edges required for meaningful analysis */
const MIN_EDGES_FOR_ANALYSIS = 1

/** Score thresholds for readiness levels */
const SCORE_THRESHOLD_READY = 70
const SCORE_THRESHOLD_NEEDS_REVIEW = 40

// =============================================================================
// Core Computation Functions
// =============================================================================

/**
 * Count issues by severity from graph health
 */
function countIssuesBySeverity(issues: ValidationIssue[] | undefined): {
  blockers: number
  warnings: number
  info: number
} {
  if (!issues || issues.length === 0) {
    return { blockers: 0, warnings: 0, info: 0 }
  }

  return issues.reduce(
    (acc, issue) => {
      if (issue.severity === 'error' || issue.severity === 'blocker') {
        acc.blockers++
      } else if (issue.severity === 'warning') {
        acc.warnings++
      } else {
        acc.info++
      }
      return acc
    },
    { blockers: 0, warnings: 0, info: 0 }
  )
}

/**
 * Compute base score from graph structure
 */
function computeStructureScore(input: ReadinessInput): number {
  let score = 0

  // Base points for having a graph
  if (input.nodeCount > 0) score += 20
  if (input.nodeCount >= 3) score += 10
  if (input.nodeCount >= 5) score += 5

  // Points for connectivity
  if (input.edgeCount > 0) score += 15
  if (input.edgeCount >= input.nodeCount - 1) score += 10 // Well connected

  // Points for required elements
  if (input.hasOutcome) score += 15
  if (input.hasDecision) score += 10

  // Normalize to 0-50 range (structure is half the score)
  return Math.min(50, score)
}

/**
 * Compute quality score from health and validation
 */
function computeQualityScore(input: ReadinessInput): number {
  let score = 25 // Start with half of quality portion

  // Apply graph health score if available
  if (input.graphHealth?.score !== undefined) {
    // Convert graph health 0-100 to 0-25 contribution
    score = (input.graphHealth.score / 100) * 25
  }

  // CEE score contribution (0-25)
  if (input.ceeScore !== undefined) {
    score = (score + (input.ceeScore / 100) * 25) / 2
  }

  // Penalize for ISL warnings
  if (input.islWarnings && input.islWarnings.length > 0) {
    score -= Math.min(10, input.islWarnings.length * 2)
  }

  return Math.max(0, Math.min(50, score))
}

/**
 * Collect reasons from various inputs
 */
function collectReasons(input: ReadinessInput): ReadinessReason[] {
  const reasons: ReadinessReason[] = []

  // Check minimum requirements
  if (input.nodeCount < MIN_NODES_FOR_ANALYSIS) {
    reasons.push({
      type: 'completeness',
      severity: 'blocker',
      message: `Add at least ${MIN_NODES_FOR_ANALYSIS} nodes to run analysis`,
    })
  }

  if (input.edgeCount < MIN_EDGES_FOR_ANALYSIS && input.nodeCount >= MIN_NODES_FOR_ANALYSIS) {
    reasons.push({
      type: 'completeness',
      severity: 'blocker',
      message: 'Connect your nodes with edges to define relationships',
    })
  }

  // Check for outcome node
  if (!input.hasOutcome && input.nodeCount >= MIN_NODES_FOR_ANALYSIS) {
    reasons.push({
      type: 'completeness',
      severity: 'warning',
      message: 'Add an outcome node to see predictions',
    })
  }

  // Check graph health issues
  if (input.graphHealth?.issues) {
    for (const issue of input.graphHealth.issues) {
      reasons.push({
        type: 'structural',
        severity: issue.severity === 'error' || issue.severity === 'blocker' ? 'blocker' : 'warning',
        message: issue.message,
        affectedIds: issue.affectedNodeIds,
      })
    }
  }

  // Add ISL warnings
  if (input.islWarnings) {
    for (const warning of input.islWarnings) {
      reasons.push({
        type: 'validation',
        severity: 'warning',
        message: warning,
      })
    }
  }

  // CEE suggestions as info
  if (input.ceeSuggestions && input.ceeSuggestions > 0) {
    reasons.push({
      type: 'quality',
      severity: 'info',
      message: `${input.ceeSuggestions} improvement suggestion${input.ceeSuggestions > 1 ? 's' : ''} available`,
    })
  }

  // Add discrimination warning if present
  if (input.discrimination?.status === 'low_discrimination') {
    const spreadPercent = Math.round(input.discrimination.value * 100)
    reasons.push({
      type: 'quality',
      severity: 'warning',
      message: `Model may not clearly distinguish between options (${spreadPercent}% spread)`,
    })
  }

  return reasons
}

/**
 * Generate human-readable summary
 */
function generateSummary(level: ReadinessLevel, reasons: ReadinessReason[]): string {
  const blockers = reasons.filter(r => r.severity === 'blocker')
  const warnings = reasons.filter(r => r.severity === 'warning')

  switch (level) {
    case 'not_ready':
      if (blockers.length > 0) {
        return blockers[0].message
      }
      return 'Address critical issues before running analysis'

    case 'needs_review':
      if (warnings.length > 0) {
        return `${warnings.length} issue${warnings.length > 1 ? 's' : ''} to review`
      }
      return 'Analysis available - consider improvements'

    case 'ready':
      return 'Model ready for analysis'

    default:
      return 'Analysis available'
  }
}

// =============================================================================
// Main Export
// =============================================================================

/**
 * Compute readiness from local state signals
 *
 * @param input - Aggregated signals from stores
 * @returns Complete readiness result
 *
 * @example
 * const result = computeReadiness({
 *   nodeCount: nodes.length,
 *   edgeCount: edges.length,
 *   graphHealth: store.graphHealth,
 *   hasOutcome: nodes.some(n => n.type === 'outcome'),
 *   hasDecision: nodes.some(n => n.type === 'decision'),
 * })
 */
export function computeReadiness(input: ReadinessInput): ReadinessResult {
  // Compute scores
  const structureScore = computeStructureScore(input)
  const qualityScore = computeQualityScore(input)
  const totalScore = Math.round(structureScore + qualityScore)

  // Collect reasons
  const reasons = collectReasons(input)

  // Count severity levels
  const blockerCount = reasons.filter(r => r.severity === 'blocker').length

  // Determine level
  let level: ReadinessLevel
  let canRunAnalysis = true

  if (blockerCount > 0) {
    level = 'not_ready'
    canRunAnalysis = false
  } else if (totalScore < SCORE_THRESHOLD_NEEDS_REVIEW) {
    level = 'not_ready'
    canRunAnalysis = false
  } else if (totalScore < SCORE_THRESHOLD_READY) {
    level = 'needs_review'
    canRunAnalysis = true
  } else {
    level = 'ready'
    canRunAnalysis = true
  }

  // Generate summary
  const summary = generateSummary(level, reasons)

  return {
    level,
    score: totalScore,
    canRunAnalysis,
    reasons,
    summary,
  }
}

/**
 * Quick check if analysis can run (for gating buttons)
 */
export function canRunAnalysis(input: ReadinessInput): boolean {
  return computeReadiness(input).canRunAnalysis
}

/**
 * Get just the readiness level (for simple displays)
 */
export function getReadinessLevel(input: ReadinessInput): ReadinessLevel {
  return computeReadiness(input).level
}

/**
 * CTA State Machine
 *
 * P0.3: Single Primary CTA Per State
 *
 * Pure state machine for the primary CTA button in OutputsDock.
 * Determines button text, enabled state, and appearance based on analysis state.
 *
 * Rule: Exactly one primary button visible. Choose by state:
 * - Before any run: "Run Analysis"
 * - After run, 2+ options, compare-ready: "Compare Options"
 * - After run, low confidence OR not informative: "Strengthen Model"
 * - Error blocking results: "Try Again"
 *
 * State transitions:
 * - idle → running (on analyse click)
 * - running → done | degraded | error (on completion)
 * - done → running (on re-analyse)
 * - degraded → running (on retry)
 * - error → running (on retry)
 */

import type { ResultsStatus } from '../canvas/store'
import type { ReadinessLevel } from './readiness'

// =============================================================================
// Types
// =============================================================================

/**
 * CTA states matching analysis lifecycle
 */
export type CTAState = 'idle' | 'running' | 'done' | 'degraded' | 'error'

/**
 * Visual variant for the CTA button
 */
export type CTAVariant = 'primary' | 'secondary' | 'warning' | 'disabled'

/**
 * P0.3: Primary CTA type - determines which single primary action to show
 */
export type PrimaryCTAType = 'run_analysis' | 'compare_options' | 'strengthen_model' | 'try_again' | 'rerun'

/**
 * Complete CTA configuration
 */
export interface CTAConfig {
  state: CTAState
  text: string
  enabled: boolean
  variant: CTAVariant
  tooltip?: string
  icon?: 'play' | 'refresh' | 'alert' | 'loader' | 'compare'
  /** P0.3: The primary CTA type for this state */
  primaryType: PrimaryCTAType
}

/**
 * Input signals for CTA state computation
 */
export interface CTAInput {
  /** Current results status from store */
  resultsStatus: ResultsStatus

  /** Whether graph is non-empty */
  hasGraph: boolean

  /** Readiness level from readiness module */
  readinessLevel: ReadinessLevel

  /** Whether we're in degraded mode (offline/limited) */
  isDegraded?: boolean

  /** Optional error message */
  errorMessage?: string

  /** P0.3: Number of option nodes (for compare CTA) */
  optionCount?: number

  /** P0.3: Whether drivers are informative */
  driversInformative?: boolean

  /** P0.3: Confidence level */
  confidenceLevel?: 'high' | 'medium' | 'low'

  /** P0.3: Whether comparison is ready/available */
  canCompare?: boolean

  /** P0.3: Fallback message when drivers are not informative (for tooltip) */
  driversFallbackMessage?: string
}

// =============================================================================
// State Machine
// =============================================================================

/**
 * Map ResultsStatus to CTAState
 */
function mapResultsStatusToCTAState(status: ResultsStatus, isDegraded?: boolean): CTAState {
  switch (status) {
    case 'idle':
      return 'idle'

    case 'preparing':
    case 'connecting':
    case 'streaming':
      return 'running'

    case 'complete':
      return isDegraded ? 'degraded' : 'done'

    case 'error':
      return 'error'

    case 'cancelled':
      return 'idle'

    default:
      return 'idle'
  }
}

/**
 * P0.3: Determine primary CTA type based on state and conditions
 */
function determinePrimaryCTAType(
  state: CTAState,
  input: CTAInput
): PrimaryCTAType {
  // Error state always shows "Try Again"
  if (state === 'error') {
    return 'try_again'
  }

  // Running or idle states show run_analysis
  if (state === 'idle' || state === 'running') {
    return 'run_analysis'
  }

  // After run (done/degraded): check conditions for primary CTA
  // Priority: strengthen_model > compare_options > rerun

  // Low confidence OR not informative → "Strengthen Model"
  const needsStrengthening =
    input.confidenceLevel === 'low' ||
    input.driversInformative === false

  if (needsStrengthening) {
    return 'strengthen_model'
  }

  // 2+ options and compare-ready → "Compare Options"
  if (input.canCompare && (input.optionCount ?? 0) >= 2) {
    return 'compare_options'
  }

  // Default post-run: Rerun
  return 'rerun'
}

/**
 * Get CTA text based on state and primary type
 */
function getCTAText(state: CTAState, primaryType: PrimaryCTAType): string {
  switch (primaryType) {
    case 'run_analysis':
      return state === 'running' ? 'Running…' : 'Run Analysis'

    case 'compare_options':
      return 'Compare Options'

    case 'strengthen_model':
      return 'Strengthen Model'

    case 'try_again':
      return 'Try Again'

    case 'rerun':
      return 'Rerun'

    default:
      return 'Run Analysis'
  }
}

/**
 * Get CTA icon based on state and primary type
 */
function getCTAIcon(state: CTAState, primaryType: PrimaryCTAType): CTAConfig['icon'] {
  if (state === 'running') {
    return 'loader'
  }

  switch (primaryType) {
    case 'run_analysis':
      return 'play'

    case 'compare_options':
      return 'compare'

    case 'strengthen_model':
      return 'alert'

    case 'try_again':
      return 'alert'

    case 'rerun':
      return 'refresh'

    default:
      return 'play'
  }
}

/**
 * Get CTA variant based on state and readiness
 */
function getCTAVariant(state: CTAState, readinessLevel: ReadinessLevel, hasGraph: boolean): CTAVariant {
  // Running state is always secondary (subdued)
  if (state === 'running') {
    return 'secondary'
  }

  // Error or degraded states show warning
  if (state === 'error' || state === 'degraded') {
    return 'warning'
  }

  // Check if we can enable the button
  if (!hasGraph) {
    return 'disabled'
  }

  if (readinessLevel === 'not_ready') {
    return 'disabled'
  }

  // Ready states
  return 'primary'
}

/**
 * Determine if CTA should be enabled
 */
function isCTAEnabled(
  state: CTAState,
  hasGraph: boolean,
  readinessLevel: ReadinessLevel
): boolean {
  // Never enabled while running
  if (state === 'running') {
    return false
  }

  // Must have a graph
  if (!hasGraph) {
    return false
  }

  // Check readiness for initial analyse
  if (state === 'idle' && readinessLevel === 'not_ready') {
    return false
  }

  // Error and degraded always allow retry
  if (state === 'error' || state === 'degraded') {
    return true
  }

  // Done allows re-analyse
  if (state === 'done') {
    return true
  }

  // Idle with graph and not 'not_ready'
  return true
}

/**
 * Get tooltip based on state
 */
function getCTATooltip(
  state: CTAState,
  primaryType: PrimaryCTAType,
  readinessLevel: ReadinessLevel,
  hasGraph: boolean,
  errorMessage?: string,
  driversFallbackMessage?: string
): string | undefined {
  if (!hasGraph) {
    return 'Add nodes to your model to run analysis'
  }

  if (state === 'idle' && readinessLevel === 'not_ready') {
    return 'Address issues before running analysis'
  }

  if (state === 'running') {
    return 'Analysis in progress'
  }

  if (state === 'error' && errorMessage) {
    return errorMessage
  }

  if (state === 'degraded') {
    return 'Previous analysis had issues - try again'
  }

  // P0.3: Show context when CTA switches to "Strengthen Model"
  if (primaryType === 'strengthen_model' && driversFallbackMessage) {
    return driversFallbackMessage
  }

  return undefined
}

// =============================================================================
// Main Export
// =============================================================================

/**
 * Compute CTA configuration from input signals
 *
 * P0.3: Returns single primary CTA based on state:
 * - Before run: "Run Analysis"
 * - After run, 2+ options: "Compare Options"
 * - Low confidence/not informative: "Strengthen Model"
 * - Error: "Try Again"
 *
 * @param input - Current state signals
 * @returns Complete CTA configuration
 *
 * @example
 * const cta = computeCTA({
 *   resultsStatus: store.results.status,
 *   hasGraph: nodes.length > 0,
 *   readinessLevel: readiness.level,
 *   optionCount: 2,
 *   canCompare: true,
 *   confidenceLevel: 'high',
 *   driversInformative: true,
 * })
 *
 * <Button variant={cta.variant} disabled={!cta.enabled}>
 *   {cta.text}
 * </Button>
 */
export function computeCTA(input: CTAInput): CTAConfig {
  const state = mapResultsStatusToCTAState(input.resultsStatus, input.isDegraded)
  const primaryType = determinePrimaryCTAType(state, input)
  const text = getCTAText(state, primaryType)
  const icon = getCTAIcon(state, primaryType)
  const variant = getCTAVariant(state, input.readinessLevel, input.hasGraph)
  const enabled = isCTAEnabled(state, input.hasGraph, input.readinessLevel)
  const tooltip = getCTATooltip(
    state,
    primaryType,
    input.readinessLevel,
    input.hasGraph,
    input.errorMessage,
    input.driversFallbackMessage
  )

  return {
    state,
    text,
    enabled,
    variant,
    icon,
    tooltip,
    primaryType,
  }
}

/**
 * Quick check if analysis can be triggered
 */
export function canTriggerAnalysis(input: CTAInput): boolean {
  return computeCTA(input).enabled
}

/**
 * Get just the CTA text (for simple displays)
 */
export function getCTAButtonText(input: CTAInput): string {
  return computeCTA(input).text
}

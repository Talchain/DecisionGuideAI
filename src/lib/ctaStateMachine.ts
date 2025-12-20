/**
 * CTA State Machine
 *
 * Pure state machine for the primary CTA button in OutputsDock.
 * Determines button text, enabled state, and appearance based on analysis state.
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
 * Complete CTA configuration
 */
export interface CTAConfig {
  state: CTAState
  text: string
  enabled: boolean
  variant: CTAVariant
  tooltip?: string
  icon?: 'play' | 'refresh' | 'alert' | 'loader'
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
 * Get CTA text based on state
 */
function getCTAText(state: CTAState): string {
  switch (state) {
    case 'idle':
      return 'Analyse'

    case 'running':
      return 'Running…'

    case 'done':
      return 'Analyse again'

    case 'degraded':
      return 'Retry'

    case 'error':
      return 'Retry'

    default:
      return 'Analyse'
  }
}

/**
 * Get CTA icon based on state
 */
function getCTAIcon(state: CTAState): CTAConfig['icon'] {
  switch (state) {
    case 'idle':
      return 'play'

    case 'running':
      return 'loader'

    case 'done':
      return 'refresh'

    case 'degraded':
      return 'alert'

    case 'error':
      return 'alert'

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
  readinessLevel: ReadinessLevel,
  hasGraph: boolean,
  errorMessage?: string
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

  return undefined
}

// =============================================================================
// Main Export
// =============================================================================

/**
 * Compute CTA configuration from input signals
 *
 * @param input - Current state signals
 * @returns Complete CTA configuration
 *
 * @example
 * const cta = computeCTA({
 *   resultsStatus: store.results.status,
 *   hasGraph: nodes.length > 0,
 *   readinessLevel: readiness.level,
 * })
 *
 * <Button variant={cta.variant} disabled={!cta.enabled}>
 *   {cta.text}
 * </Button>
 */
export function computeCTA(input: CTAInput): CTAConfig {
  const state = mapResultsStatusToCTAState(input.resultsStatus, input.isDegraded)
  const text = getCTAText(state)
  const icon = getCTAIcon(state)
  const variant = getCTAVariant(state, input.readinessLevel, input.hasGraph)
  const enabled = isCTAEnabled(state, input.hasGraph, input.readinessLevel)
  const tooltip = getCTATooltip(state, input.readinessLevel, input.hasGraph, input.errorMessage)

  return {
    state,
    text,
    enabled,
    variant,
    icon,
    tooltip,
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

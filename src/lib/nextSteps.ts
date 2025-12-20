/**
 * Next Steps Computation Module
 *
 * Computes actionable next steps after analysis runs.
 * Combines CEE suggestions with driver-based recommendations.
 *
 * Used by:
 * - OutputsDock to show next actions
 * - GuidancePanel for coaching flow
 */

import type { ModelAction } from '../types/primitives'
import type { NormalizedDriver } from '../adapters/driversAdapter'

// =============================================================================
// Types
// =============================================================================

/**
 * Next step action for the user
 */
export interface NextStep {
  id: string
  label: string
  description?: string
  priority: 'high' | 'medium' | 'low'
  type: 'cee_suggestion' | 'driver_based' | 'readiness' | 'generic'
  /** Associated ModelAction if actionable */
  action?: ModelAction
  /** Node/edge IDs to highlight on hover */
  highlightIds?: string[]
}

/**
 * Input for next steps computation
 */
export interface NextStepsInput {
  /** CEE suggested actions (from /assist/v1/ask) */
  suggestedActions?: ModelAction[]

  /** Top drivers from analysis */
  drivers?: NormalizedDriver[]

  /** Readiness suggestions */
  readinessSuggestions?: string[]

  /** Graph quality score (0-100) */
  qualityScore?: number

  /** Whether analysis completed successfully */
  analysisComplete: boolean
}

/**
 * Configuration for next steps generation
 */
export interface NextStepsConfig {
  /** Maximum number of steps to return */
  maxSteps: number

  /** Prefer CEE suggestions over derived ones */
  preferCEESuggestions: boolean

  /** Include generic suggestions as fallback */
  includeGenericFallback: boolean
}

// =============================================================================
// Constants
// =============================================================================

export const DEFAULT_NEXT_STEPS_CONFIG: NextStepsConfig = {
  maxSteps: 3,
  preferCEESuggestions: true,
  includeGenericFallback: true,
}

/**
 * Generic fallback suggestions when no specific ones available
 */
const GENERIC_SUGGESTIONS: Omit<NextStep, 'id'>[] = [
  {
    label: 'Review top drivers',
    description: 'Examine factors with highest impact on the outcome',
    priority: 'medium',
    type: 'generic',
  },
  {
    label: 'Add supporting evidence',
    description: 'Strengthen edge weights with real data',
    priority: 'medium',
    type: 'generic',
  },
  {
    label: 'Consider missing factors',
    description: 'Are there factors that could influence the decision?',
    priority: 'low',
    type: 'generic',
  },
]

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Generate unique ID for a step
 */
function generateStepId(prefix: string, index: number): string {
  return `${prefix}_${index}_${Date.now()}`
}

/**
 * Convert CEE ModelAction to NextStep
 */
function modelActionToNextStep(action: ModelAction, index: number): NextStep {
  return {
    id: generateStepId('cee', index),
    label: action.label || actionOpToLabel(action.op),
    description: getActionDescription(action),
    priority: 'high',
    type: 'cee_suggestion',
    action,
    highlightIds: action.target_id ? [action.target_id] : undefined,
  }
}

/**
 * Convert operation type to human-readable label
 */
function actionOpToLabel(op: ModelAction['op']): string {
  switch (op) {
    case 'add_node':
      return 'Add a new element'
    case 'add_edge':
      return 'Add a connection'
    case 'update_node':
      return 'Update element'
    case 'update_edge':
      return 'Update connection'
    case 'delete_node':
      return 'Remove element'
    case 'delete_edge':
      return 'Remove connection'
    default:
      return 'Apply suggestion'
  }
}

/**
 * Generate description for action
 */
function getActionDescription(action: ModelAction): string {
  const target = action.payload.label as string || action.target_id || ''

  switch (action.op) {
    case 'add_node':
      return `Add "${target}" to strengthen your model`
    case 'add_edge':
      return `Connect elements to show relationship`
    case 'update_node':
      return `Improve "${target}" with better data`
    case 'update_edge':
      return `Refine connection weight or confidence`
    default:
      return ''
  }
}

/**
 * Convert driver to evidence suggestion
 */
function driverToNextStep(driver: NormalizedDriver, index: number): NextStep {
  return {
    id: generateStepId('driver', index),
    label: `Add evidence for "${driver.label}"`,
    description: `This ${driver.kind} has ${driver.impact}% impact on outcomes`,
    priority: driver.rank <= 2 ? 'high' : 'medium',
    type: 'driver_based',
    highlightIds: [driver.id],
  }
}

/**
 * Convert readiness suggestion to NextStep
 */
function readinessToNextStep(suggestion: string, index: number): NextStep {
  return {
    id: generateStepId('readiness', index),
    label: suggestion,
    priority: index === 0 ? 'high' : 'medium',
    type: 'readiness',
  }
}

// =============================================================================
// Main Export
// =============================================================================

/**
 * Compute next steps from various input sources
 *
 * Priority order:
 * 1. CEE suggested_actions (if preferCEESuggestions)
 * 2. Driver-based suggestions
 * 3. Readiness suggestions
 * 4. Generic fallback
 *
 * @param input - Input signals
 * @param config - Optional configuration
 * @returns Array of next steps
 *
 * @example
 * const steps = computeNextSteps({
 *   suggestedActions: ceeResponse.suggested_actions,
 *   drivers: normalizedDrivers,
 *   analysisComplete: true,
 * })
 */
export function computeNextSteps(
  input: NextStepsInput,
  config: Partial<NextStepsConfig> = {}
): NextStep[] {
  const mergedConfig = { ...DEFAULT_NEXT_STEPS_CONFIG, ...config }
  const steps: NextStep[] = []

  // 1. CEE suggestions (highest priority)
  if (mergedConfig.preferCEESuggestions && input.suggestedActions) {
    for (let i = 0; i < input.suggestedActions.length && steps.length < mergedConfig.maxSteps; i++) {
      steps.push(modelActionToNextStep(input.suggestedActions[i], i))
    }
  }

  // 2. Driver-based suggestions
  if (input.drivers && steps.length < mergedConfig.maxSteps) {
    const availableSlots = mergedConfig.maxSteps - steps.length
    const topDrivers = input.drivers.slice(0, availableSlots)

    for (let i = 0; i < topDrivers.length; i++) {
      steps.push(driverToNextStep(topDrivers[i], i))
    }
  }

  // 3. Readiness suggestions
  if (input.readinessSuggestions && steps.length < mergedConfig.maxSteps) {
    const availableSlots = mergedConfig.maxSteps - steps.length
    const suggestions = input.readinessSuggestions.slice(0, availableSlots)

    for (let i = 0; i < suggestions.length; i++) {
      steps.push(readinessToNextStep(suggestions[i], i))
    }
  }

  // 4. Generic fallback
  if (mergedConfig.includeGenericFallback && steps.length < mergedConfig.maxSteps) {
    const availableSlots = mergedConfig.maxSteps - steps.length

    for (let i = 0; i < GENERIC_SUGGESTIONS.length && i < availableSlots; i++) {
      steps.push({
        ...GENERIC_SUGGESTIONS[i],
        id: generateStepId('generic', i),
      })
    }
  }

  return steps
}

/**
 * Get just the top next step (for prominent display)
 */
export function getTopNextStep(input: NextStepsInput): NextStep | null {
  const steps = computeNextSteps(input, { maxSteps: 1, includeGenericFallback: false })
  return steps[0] || null
}

/**
 * Check if any actionable steps are available
 */
export function hasActionableSteps(input: NextStepsInput): boolean {
  return computeNextSteps(input, { includeGenericFallback: false }).length > 0
}

/**
 * Get steps with associated ModelActions (for one-tap apply)
 */
export function getActionableSteps(input: NextStepsInput): NextStep[] {
  return computeNextSteps(input).filter(step => step.action !== undefined)
}

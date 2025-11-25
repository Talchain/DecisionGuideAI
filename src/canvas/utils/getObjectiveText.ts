/**
 * Objective Text Utilities
 *
 * Extracts objective/goal text from scenario framing and canvas nodes.
 * Used by VerdictCard and DeltaInterpretation components for
 * objective-anchored analysis.
 */

import type { Node } from '@xyflow/react'
import type { ScenarioFraming } from '../store/scenarios'

/**
 * Extract the objective text from framing and nodes
 *
 * Priority:
 * 1. Framing goal (if present)
 * 2. Framing title (if present)
 * 3. First outcome node label (fallback)
 * 4. Default text
 */
export function getObjectiveText(params: {
  framing: ScenarioFraming | null | undefined
  nodes: Node[]
}): string {
  const { framing, nodes } = params

  // Priority 1: Use framing goal if available
  if (framing?.goal && framing.goal.trim()) {
    return framing.goal.trim()
  }

  // Priority 2: Use framing title if available
  if (framing?.title && framing.title.trim()) {
    return framing.title.trim()
  }

  // Priority 3: Find first outcome node and use its label
  const outcomeNode = nodes.find(
    (n) => n.type === 'outcome' || n.type === 'outcomeNode'
  )
  if (outcomeNode?.data?.label && typeof outcomeNode.data.label === 'string') {
    return outcomeNode.data.label
  }

  // Priority 4: Default fallback
  return 'Achieve the best possible outcome'
}

/**
 * Determine goal direction from framing text
 *
 * Analyzes the goal/title text for directional keywords.
 * Defaults to 'maximize' if direction cannot be determined.
 *
 * Minimize keywords: reduce, minimize, decrease, lower, cut, shrink, limit
 * Maximize keywords: maximize, increase, grow, raise, boost, expand, improve
 */
export function getGoalDirection(
  framing: ScenarioFraming | null | undefined
): 'maximize' | 'minimize' {
  const text = (framing?.goal || framing?.title || '').toLowerCase()

  // Check for minimize indicators
  const minimizePatterns = [
    'minimize',
    'reduce',
    'decrease',
    'lower',
    'cut',
    'shrink',
    'limit',
    'less',
    'fewer',
    'drop',
    'avoid',
    'prevent',
  ]

  for (const pattern of minimizePatterns) {
    if (text.includes(pattern)) {
      return 'minimize'
    }
  }

  // Default to maximize (most common goal direction)
  return 'maximize'
}

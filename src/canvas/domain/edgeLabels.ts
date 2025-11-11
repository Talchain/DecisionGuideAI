/**
 * Edge Label Utilities
 *
 * v1.2: Converts technical weight/belief pairs into meaningful human-readable labels.
 * Uses British English and plain language to make edges accessible to non-technical users.
 */

export type EdgeLabelMode = 'human' | 'numeric'

const STORAGE_KEY = 'canvas.edge-labels-mode'

/**
 * Get the current edge label mode from localStorage
 * Defaults to 'human' for better UX
 */
export function getEdgeLabelMode(): EdgeLabelMode {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return 'human'
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'numeric') return 'numeric'
    return 'human'
  } catch {
    return 'human'
  }
}

/**
 * Set the edge label mode in localStorage
 */
export function setEdgeLabelMode(mode: EdgeLabelMode): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return
  }

  try {
    localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    // Fail silently if storage is unavailable
  }
}

export interface EdgeDescription {
  label: string
  tooltip: string
}

/**
 * Describe an edge in human-readable terms based on weight and belief
 *
 * Weight scale:
 * - Strong: |w| >= 0.7
 * - Moderate: 0.3 <= |w| < 0.7
 * - Weak: |w| < 0.3
 *
 * Belief scale (confidence):
 * - High: b >= 80%
 * - Medium: 60% <= b < 80%
 * - Low: b < 60%
 * - Undefined: treat as uncertain
 *
 * Direction:
 * - Positive weight → boost/increase/push
 * - Negative weight → drag/decrease/hinder
 *
 * British English spelling throughout
 */
export function describeEdge(weight: number, belief?: number): EdgeDescription {
  const absWeight = Math.abs(weight)
  const isPositive = weight >= 0

  // Categorize strength
  let strength: 'strong' | 'moderate' | 'weak'
  if (absWeight >= 0.7) {
    strength = 'strong'
  } else if (absWeight >= 0.3) {
    strength = 'moderate'
  } else {
    strength = 'weak'
  }

  // Categorize confidence (if belief is provided)
  let confidence: 'high' | 'medium' | 'low' | 'uncertain'
  if (belief !== undefined) {
    if (belief >= 0.8) {
      confidence = 'high'
    } else if (belief >= 0.6) {
      confidence = 'medium'
    } else {
      confidence = 'low'
    }
  } else {
    confidence = 'uncertain'
  }

  // Build human-readable label
  const strengthLabel = strength === 'strong' ? 'Strong' : strength === 'moderate' ? 'Moderate' : 'Weak'
  const directionLabel = isPositive ? 'boost' : 'drag'

  // Add confidence qualifier if belief is low or missing
  let label: string
  if (confidence === 'low' || confidence === 'uncertain') {
    label = `${strengthLabel} ${directionLabel} (uncertain)`
  } else {
    label = `${strengthLabel} ${directionLabel}`
  }

  // Build tooltip with numeric details
  const sign = weight >= 0 ? '' : '−'
  const tooltip = belief !== undefined
    ? `Weight: ${sign}${absWeight.toFixed(2)}, Belief: ${Math.round(belief * 100)}%`
    : `Weight: ${sign}${absWeight.toFixed(2)}, Belief: not set`

  return { label, tooltip }
}

/**
 * Format edge label in numeric format (legacy)
 * Example: "w 0.60 • b 85%"
 */
export function formatNumericLabel(weight: number, belief?: number): string {
  const sign = weight >= 0 ? '' : '−' // Use proper minus sign
  const absWeight = Math.abs(weight)

  if (belief !== undefined) {
    return `w ${sign}${absWeight.toFixed(2)} • b ${Math.round(belief * 100)}%`
  }

  return `w ${sign}${absWeight.toFixed(2)}`
}

/**
 * Get the appropriate edge label based on current mode
 */
export function getEdgeLabel(weight: number, belief?: number, mode?: EdgeLabelMode): EdgeDescription {
  const actualMode = mode ?? getEdgeLabelMode()

  if (actualMode === 'numeric') {
    const numericLabel = formatNumericLabel(weight, belief)
    return {
      label: numericLabel,
      tooltip: numericLabel
    }
  }

  return describeEdge(weight, belief)
}

/**
 * Edge Label Utilities
 *
 * v1.2: Converts technical weight/belief pairs into meaningful human-readable labels.
 * Uses British English and plain language to make edges accessible to non-technical users.
 */

import type { EdgeDirectionDisplay } from './edgeValueProvenance'

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
 * ⚠⚠ THE DIRECTION IS AN ARGUMENT, NOT AN INFERENCE (ROADMAP 2.935, Codex MF5).
 * ----------------------------------------------------------------------------
 * This function used to compute `const isPositive = weight >= 0` and pick
 * "boost" or "drag" from it. Its only product caller — `StyledEdge` via
 * `getEdgeLabel` — passes `edgeData.weight`, and BOTH ingestion paths store that
 * as an UNSIGNED MAGNITUDE beside a separate direction field:
 *
 *     const weight = Math.max(0, Math.min(2, Math.abs(rawWeight)))   // UI-SEM-023
 *
 * So `weight >= 0` was true for every edge in the product, and every causal edge
 * on the canvas read "boost" — including the ones CEE sent a NEGATIVE
 * `strength.mean` for. A factor the model says REDUCES the goal was labelled
 * "Moderate boost (uncertain)" while the glyph beside it announced "Effect
 * direction: negative".
 *
 * `weight` is now used ONLY for its magnitude — the sign of the argument is
 * ignored deliberately, so no caller can smuggle a direction claim back in
 * through a number.
 *
 * The parameter is REQUIRED, and typed as `EdgeDirectionDisplay` rather than a
 * bare `'positive' | 'negative'`, for the same reason `computeDirectionStroke`
 * (ROADMAP 2.928) and `getDirectionalStrengthLabel` (2.263) take one: there is
 * no argument that means "positive, source unknown", so an unstated direction
 * cannot produce a signed word by accident and cannot be forgotten.
 * `resolveEdgeDirectionDisplay` is the ONE OWNER of that answer for canvas edge
 * data — do not add a second predicate here (CLAUDE.md trap 21).
 *
 * ⚠ Do NOT "fix" a caller by re-signing the weight from
 * `resolveEdgeSignedStrengthDisplay` instead. That module's header forbids it in
 * capitals — an unstated direction lands there as `+1`, so a word read off that
 * sign would fabricate "boost" on exactly the edges this gate exists to protect.
 *
 * Direction:
 * - Direction STATED positive → boost/increase/push
 * - Direction STATED negative → drag/decrease/hinder
 * - Direction NOT STATED      → name the magnitude, say the direction was never
 *   stated. Same vocabulary as `getDirectionalStrengthLabel`, deliberately: one
 *   phrase for one concept across the canvas and the Model tab.
 *
 * British English spelling throughout
 */
export function describeEdge(
  weight: number,
  belief: number | undefined,
  direction: EdgeDirectionDisplay,
): EdgeDescription {
  const absWeight = Math.abs(weight)

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
  // Absence stays absence: name the magnitude, and say plainly that the
  // direction was never stated rather than picking one.
  const claim = direction.show
    ? `${strengthLabel} ${direction.direction === 'positive' ? 'boost' : 'drag'}`
    : `${strengthLabel} effect, direction not stated`

  // Add confidence qualifier if belief is low or missing
  let label: string
  if (confidence === 'low' || confidence === 'uncertain') {
    label = `${claim} (uncertain)`
  } else {
    label = claim
  }

  return { label, tooltip: buildWeightTooltip(absWeight, belief, direction) }
}

/**
 * The numeric half of the tooltip, shared by both label modes so the sign rule
 * lives once. The minus sign is a DIRECTION CLAIM and is printed only when the
 * direction was stated; an unstated direction prints the bare magnitude, which
 * is all we are entitled to say about it.
 */
function buildWeightTooltip(
  absWeight: number,
  belief: number | undefined,
  direction: EdgeDirectionDisplay,
): string {
  const beliefText = belief !== undefined ? `${Math.round(belief * 100)}%` : 'not set'
  return `Weight: ${signPrefix(direction)}${absWeight.toFixed(2)}, Belief: ${beliefText}`
}

/** '−' (U+2212 MINUS SIGN) only for a STATED negative direction; '' otherwise. */
function signPrefix(direction: EdgeDirectionDisplay): string {
  return direction.show && direction.direction === 'negative' ? '−' : ''
}

/**
 * Format edge label in numeric format (legacy)
 * Example: "w −0.60 • b 85%"
 *
 * Same gate as `describeEdge`, for the same reason: the leading minus is a
 * direction claim, and `weight` reaches here as an unsigned magnitude. Before
 * ROADMAP 2.935 this printed `w 0.35` for an edge whose CEE mean was −0.35 —
 * the numeric channel did not invert the claim, it silently DELETED it.
 */
export function formatNumericLabel(
  weight: number,
  belief: number | undefined,
  direction: EdgeDirectionDisplay,
): string {
  const absWeight = Math.abs(weight)
  const sign = signPrefix(direction)

  if (belief !== undefined) {
    return `w ${sign}${absWeight.toFixed(2)} • b ${Math.round(belief * 100)}%`
  }

  return `w ${sign}${absWeight.toFixed(2)}`
}

/**
 * Get the appropriate edge label based on current mode.
 *
 * `direction` sits BEFORE the optional `mode` so it cannot be omitted — the
 * whole point of the ROADMAP 2.935 gate. See `describeEdge`'s header.
 */
export function getEdgeLabel(
  weight: number,
  belief: number | undefined,
  direction: EdgeDirectionDisplay,
  mode?: EdgeLabelMode,
): EdgeDescription {
  const actualMode = mode ?? getEdgeLabelMode()

  if (actualMode === 'numeric') {
    const numericLabel = formatNumericLabel(weight, belief, direction)
    return {
      label: numericLabel,
      tooltip: numericLabel
    }
  }

  return describeEdge(weight, belief, direction)
}

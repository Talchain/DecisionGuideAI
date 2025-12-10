/**
 * Edge domain types and schemas
 * British English: visualisation, colour, initialise
 */

import { z } from 'zod'

/**
 * Edge style options for visualisation
 */
export const EdgeStyleEnum = z.enum(['solid', 'dashed', 'dotted'])
export type EdgeStyle = z.infer<typeof EdgeStyleEnum>

/**
 * Edge path type options for connector rendering
 * - bezier: Smooth curved lines (default, best for most graphs)
 * - smoothstep: Right-angle paths with rounded corners
 * - straight: Direct diagonal lines
 */
export const EdgePathTypeEnum = z.enum(['bezier', 'smoothstep', 'straight'])
export type EdgePathType = z.infer<typeof EdgePathTypeEnum>

/**
 * Edge kind - semantic type of the edge
 * Determines how the label/confidence value is interpreted
 */
export const EdgeKindEnum = z.enum([
  'decision-probability',  // Default: probability split from a decision (must sum to 100%)
  'risk-likelihood',       // Future: probability a risk occurs
  'influence-weight',      // Future: strength of influence (no sum constraint)
  'deterministic',         // Future: always happens (100%, no label shown)
])
export type EdgeKind = z.infer<typeof EdgeKindEnum>

/**
 * Edge function type - how input values transform to output (Phase 3)
 * Allows non-linear relationships for more accurate modelling
 */
export const EdgeFunctionTypeEnum = z.enum([
  'linear',              // Default: y = x (proportional)
  'diminishing_returns', // y = x^c where c < 1 (early gains larger)
  'threshold',           // y = 0 if x < t, else 1 (step function)
  's_curve',             // Logistic curve (adoption/saturation)
])
export type EdgeFunctionType = z.infer<typeof EdgeFunctionTypeEnum>

/**
 * Parameters for non-linear edge functions
 */
export const EdgeFunctionParamsSchema = z.object({
  /** Threshold value for threshold function (0-1) */
  threshold: z.number().min(0).max(1).optional(),
  /** Curvature for diminishing returns (0.1-2, <1 = more diminishing) */
  curvature: z.number().min(0.1).max(2).optional(),
  /** Midpoint for s-curve (0-1, where steepest slope occurs) */
  midpoint: z.number().min(0).max(1).optional(),
  /** Steepness for s-curve (1-10, higher = sharper transition) */
  steepness: z.number().min(1).max(10).optional(),
})
export type EdgeFunctionParams = z.infer<typeof EdgeFunctionParamsSchema>

/**
 * Edge data schema (v3)
 * Extends React Flow's base edge with semantic properties
 *
 * v3 changes:
 * - Added belief: epistemic uncertainty (0-1, P1B API field)
 * - Added provenance: source/rationale (max 100 chars, P1B API field)
 *
 * Note: weight (0-1) represents edge strength/influence for backend API
 * 0 = no influence, 1 = strong influence
 * Visual stroke width is derived from weight via weightToStrokeWidth()
 */
export const EdgeDataSchema = z.object({
  // Visual properties
  weight: z.number().min(0).max(1).default(0.5),
  style: EdgeStyleEnum.default('solid'),
  // Note: curvature is currently only applied for smoothstep paths in StyledEdge.
  // Bezier paths use a fixed internal curvature value for now.
  curvature: z.number().min(0).max(0.5).default(0.15),
  pathType: EdgePathTypeEnum.default('bezier'),

  // Semantic properties
  kind: EdgeKindEnum.default('decision-probability'),
  label: z.string().max(50).optional(),
  // confidence: interpreted as branch probability (0-1). For decision nodes,
  // NodeInspectorCompact treats confidence on outgoing edges as a probability
  // distribution that should sum to ~1 across all branches.
  confidence: z.number().min(0).max(1).optional(),

  // P1B API metadata (Inspector-editable)
  belief: z.number().min(0).max(1).optional(),           // Epistemic uncertainty (0-1) for this connection
  provenance: z.string().max(100).optional(),             // Short source/rationale tag (e.g. "template", "user", "inferred")

  // Phase 3: Non-linear edge functions
  functionType: EdgeFunctionTypeEnum.default('linear'),   // How input transforms to output
  functionParams: EdgeFunctionParamsSchema.optional(),    // Parameters for non-linear functions

  // Template tracking
  templateId: z.string().optional(),

  // Schema version for migrations
  // Accept legacy v2 and current v3 values for backwards-compatible imports
  schemaVersion: z.union([z.literal(2), z.literal(3)]).default(3),
})

export type EdgeData = z.infer<typeof EdgeDataSchema>

/**
 * Default edge data for new edges
 */
export const DEFAULT_EDGE_DATA: EdgeData = {
  weight: 0.5,
  style: 'solid',
  curvature: 0.15,
  pathType: 'bezier',
  kind: 'decision-probability',
  functionType: 'linear',
  schemaVersion: 3,
}

/**
 * Edge visual property constraints
 * Used for validation and UI controls
 */
export const EDGE_CONSTRAINTS = {
  weight: {
    min: 0,
    max: 1,
    step: 0.05,
    default: 0.5,
  },
  curvature: {
    min: 0,
    max: 0.5,
    step: 0.05,
    default: 0.15,
  },
  confidence: {
    min: 0,
    max: 1,
    step: 0.05,
    default: 0.5,
  },
  belief: {
    min: 0,
    max: 1,
    step: 0.01,
    default: 0.5,
  },
  provenance: {
    maxLength: 100,
  },
  // Phase 3: Function parameters
  functionParams: {
    threshold: { min: 0, max: 1, step: 0.05, default: 0.5 },
    curvature: { min: 0.1, max: 2, step: 0.1, default: 0.5 },
    midpoint: { min: 0, max: 1, step: 0.05, default: 0.5 },
    steepness: { min: 1, max: 10, step: 0.5, default: 5 },
  },
} as const

/**
 * Map edge weight to stroke width (pixels)
 * Linear mapping: 0 → 1px, 1 → 6px
 */
export function weightToStrokeWidth(weight: number): number {
  const clamped = Math.max(0, Math.min(1, weight))
  return 1 + clamped * 5
}

/**
 * Map edge style to SVG stroke-dasharray
 */
export function styleToDashArray(style: EdgeStyle): string {
  switch (style) {
    case 'solid':
      return '0'
    case 'dashed':
      return '6 4'
    case 'dotted':
      return '2 3'
  }
}

/**
 * Clamp curvature to valid range
 */
export function clampCurvature(curvature: number): number {
  return Math.max(0, Math.min(0.5, curvature))
}

/**
 * Clamp belief to valid range (0-1)
 */
export function clampBelief(belief: number): number {
  return Math.max(0, Math.min(1, belief))
}

/**
 * Trim provenance to max length
 */
export function trimProvenance(provenance: string): string {
  return provenance.slice(0, EDGE_CONSTRAINTS.provenance.maxLength)
}

/**
 * Format confidence as percentage for UI
 */
export function formatConfidence(confidence: number | undefined): string {
  if (confidence === undefined) return 'Unknown'
  return `${Math.round(confidence * 100)}%`
}

/**
 * Determine if an edge label should be shown and how it should be styled
 * Implements tiered visibility system:
 * - Custom labels: Always visible, prominent
 * - Auto-generated %: Conditional, de-emphasized
 * - Implicit 100%: Hidden
 */
export interface LabelVisibility {
  show: boolean
  isCustom: boolean
  deEmphasize: boolean
}

export function shouldShowLabel(
  label: string | undefined,
  confidence: number | undefined,
  outgoingEdgeCount: number,
  kind: EdgeKind = 'decision-probability'
): LabelVisibility {
  // No label and no confidence - don't show anything
  if (!label && confidence === undefined) {
    return { show: false, isCustom: false, deEmphasize: false }
  }

  // Check if label is custom (not auto-generated percentage)
  const isAutoGenerated = label ? /^\d+%$/.test(label) : false
  const isCustom = label !== undefined && !isAutoGenerated

  // Custom labels: Always show prominently
  if (isCustom) {
    return { show: true, isCustom: true, deEmphasize: false }
  }

  // Handle different edge kinds with future-proof rules
  if (kind === 'deterministic') {
    // Deterministic edges (always happen, 100%) should hide auto-generated labels
    // Unless it's a custom label, which was already handled above
    return { show: false, isCustom: false, deEmphasize: false }
  }

  if (kind === 'influence-weight') {
    // Influence weights don't follow probability rules
    // Show them even for single edges, as they indicate strength
    if (confidence === 0) {
      return { show: false, isCustom: false, deEmphasize: false }
    }
    return { show: true, isCustom: false, deEmphasize: true }
  }

  // For decision-probability and risk-likelihood, use standard probability rules below

  // Legacy edge with auto-generated label but no confidence field
  // Parse the percentage from the label as fallback
  if (label && isAutoGenerated && confidence === undefined) {
    const percentMatch = label.match(/^(\d+)%$/)
    const parsedPercent = percentMatch ? parseInt(percentMatch[1], 10) : undefined

    // Treat like regular confidence-based logic
    if (outgoingEdgeCount === 1) {
      return { show: false, isCustom: false, deEmphasize: false }
    }
    if (parsedPercent === 0) {
      return { show: false, isCustom: false, deEmphasize: false }
    }
    // Show legacy percentage labels
    return { show: true, isCustom: false, deEmphasize: true }
  }

  // Single outgoing edge: Hide (implicit 100%)
  if (outgoingEdgeCount === 1) {
    return { show: false, isCustom: false, deEmphasize: false }
  }

  // Zero confidence: Hide
  if (confidence === 0) {
    return { show: false, isCustom: false, deEmphasize: false }
  }

  // Undefined confidence with no label: Hide
  if (confidence === undefined) {
    return { show: false, isCustom: false, deEmphasize: false }
  }

  // Auto-generated percentage: Show but de-emphasize
  return { show: true, isCustom: false, deEmphasize: true }
}

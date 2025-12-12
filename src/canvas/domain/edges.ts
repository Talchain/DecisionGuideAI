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
 *
 * Brief 5.4/5.5: Added noisy_or and logistic functional forms
 */
export const EdgeFunctionTypeEnum = z.enum([
  'linear',              // Default: y = x (proportional)
  'diminishing_returns', // y = x^c where c < 1 (early gains larger)
  'threshold',           // y = 0 if x < t, else 1 (step function)
  's_curve',             // Logistic curve (adoption/saturation)
  'noisy_or',            // Brief 5.4: P(Y|X) = 1 - (1-p_x)^(strength * X) for combining causes
  'noisy_and_not',       // Brief 19: P(Y|X) = baseRate * (1 - strength * X) for preventative/blocking
  'logistic',            // Brief 5.5: Standard logistic sigmoid with bias term
])
export type EdgeFunctionType = z.infer<typeof EdgeFunctionTypeEnum>

/**
 * Brief 11.9: Form confidence level from CEE recommendation
 * Drives UI behaviour according to Responsibility Map v1.1
 */
export const FormConfidenceEnum = z.enum(['high', 'medium', 'low'])
export type FormConfidence = z.infer<typeof FormConfidenceEnum>

/**
 * Brief 11.9: Form provenance - how the form was selected
 */
export const FormProvenanceEnum = z.enum([
  'cee_recommended',  // CEE auto-applied (high confidence)
  'user_selected',    // User manually selected
  'default',          // No recommendation, using default linear
])
export type FormProvenance = z.infer<typeof FormProvenanceEnum>

/**
 * Brief 11.4: Plain language form names for user display
 * Maps technical names to user-friendly descriptions
 */
export const FORM_DISPLAY_NAMES: Record<EdgeFunctionType, {
  name: string
  shortDescription: string
  icon?: string
}> = {
  linear: {
    name: 'Proportional',
    shortDescription: 'Each increase has the same effect',
    icon: '─',
  },
  diminishing_returns: {
    name: 'Diminishing',
    shortDescription: 'Effect gets smaller at higher levels',
    icon: '╭',
  },
  threshold: {
    name: 'Threshold',
    shortDescription: 'No effect until a minimum level is reached',
    icon: '╯',
  },
  s_curve: {
    name: 'Adoption curve',
    shortDescription: 'Slow start, rapid growth, then levels off',
    icon: '∿',
  },
  noisy_or: {
    name: 'Combined causes',
    shortDescription: 'Multiple factors each contribute independently',
    icon: '⊕',
  },
  noisy_and_not: {
    name: 'Preventative',
    shortDescription: 'Reduces or blocks the effect',
    icon: '⊖',
  },
  logistic: {
    name: 'Tipping point',
    shortDescription: 'Gradual build-up then rapid transition',
    icon: '⟋',
  },
}

/**
 * Parameters for non-linear edge functions
 *
 * Brief 5.4/5.5: Added parameters for noisy_or and logistic
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

  // Brief 5.4: Noisy-OR parameters
  /** Base probability for noisy-OR (probability effect occurs given cause present) */
  noisyOrStrength: z.number().min(0).max(1).optional(),
  /** Leak probability (effect can occur even without this cause) */
  noisyOrLeak: z.number().min(0).max(0.5).optional(),

  // Brief 19: Noisy-AND-NOT parameters (preventative/blocking)
  /** Base rate for noisy-AND-NOT (probability when no prevention active) */
  noisyAndNotBaseRate: z.number().min(0).max(1).optional(),
  /** Prevention strength (how much the factor reduces the base rate) */
  noisyAndNotStrength: z.number().min(0).max(1).optional(),

  // Brief 5.5: Logistic parameters
  /** Bias term for logistic (shifts the sigmoid left/right) */
  logisticBias: z.number().min(-5).max(5).optional(),
  /** Scale factor for logistic (controls steepness) */
  logisticScale: z.number().min(0.5).max(10).optional(),
})
export type EdgeFunctionParams = z.infer<typeof EdgeFunctionParamsSchema>

/**
 * Edge data schema (v4)
 * Extends React Flow's base edge with semantic properties
 *
 * v4 changes (Brief 5.1):
 * - Added beliefExists: probability that the causal relationship exists (0-1)
 * - Added beliefStrength: magnitude of effect given relationship exists (0-1)
 * - Added noisy_or and logistic function types
 * - Dual belief model enables proper uncertainty decomposition
 *
 * v3 changes:
 * - Added belief: epistemic uncertainty (0-1, P1B API field) - DEPRECATED, use beliefExists/beliefStrength
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
  /** @deprecated Use beliefExists and beliefStrength instead */
  belief: z.number().min(0).max(1).optional(),           // Legacy: Epistemic uncertainty (0-1)
  provenance: z.string().max(100).optional(),             // Short source/rationale tag (e.g. "template", "user", "inferred")

  // Brief 5.1: Dual belief parameters for proper uncertainty decomposition
  // beliefExists: "How sure am I this connection exists?" (structural uncertainty)
  // beliefStrength: "If it exists, how strong is the effect?" (parametric uncertainty)
  /** Probability that this causal relationship exists (0-1). High = confident connection exists. */
  beliefExists: z.number().min(0).max(1).optional(),
  /** Magnitude of effect given relationship exists (0-1). High = strong effect when present. */
  beliefStrength: z.number().min(0).max(1).optional(),

  // Phase 3: Non-linear edge functions
  functionType: EdgeFunctionTypeEnum.default('linear'),   // How input transforms to output
  functionParams: EdgeFunctionParamsSchema.optional(),    // Parameters for non-linear functions

  // Brief 11.9: Form confidence and provenance for CEE integration
  formConfidence: FormConfidenceEnum.optional(),          // CEE's confidence in recommended form
  formProvenance: FormProvenanceEnum.optional(),          // How the form was selected
  formRationale: z.string().max(200).optional(),          // CEE's explanation for the recommendation

  // Template tracking
  templateId: z.string().optional(),

  // Schema version for migrations
  // Accept legacy v2, v3, and current v4 values for backwards-compatible imports
  schemaVersion: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(4),
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
  // Brief 5.1: Default dual beliefs indicate moderate confidence in relationship existence
  beliefExists: 0.7,      // Default: moderately confident this relationship exists
  beliefStrength: 0.5,    // Default: moderate effect magnitude
  schemaVersion: 4,
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
  // Brief 5.1: Dual belief parameters
  beliefExists: {
    min: 0,
    max: 1,
    step: 0.05,
    default: 0.7,
  },
  beliefStrength: {
    min: 0,
    max: 1,
    step: 0.05,
    default: 0.5,
  },
  // Phase 3: Function parameters
  functionParams: {
    threshold: { min: 0, max: 1, step: 0.05, default: 0.5 },
    curvature: { min: 0.1, max: 2, step: 0.1, default: 0.5 },
    midpoint: { min: 0, max: 1, step: 0.05, default: 0.5 },
    steepness: { min: 1, max: 10, step: 0.5, default: 5 },
    // Brief 5.4: Noisy-OR parameters
    noisyOrStrength: { min: 0, max: 1, step: 0.05, default: 0.7 },
    noisyOrLeak: { min: 0, max: 0.5, step: 0.01, default: 0.05 },
    // Brief 19: Noisy-AND-NOT parameters (preventative)
    noisyAndNotBaseRate: { min: 0, max: 1, step: 0.05, default: 0.8 },
    noisyAndNotStrength: { min: 0, max: 1, step: 0.05, default: 0.7 },
    // Brief 5.5: Logistic parameters
    logisticBias: { min: -5, max: 5, step: 0.1, default: 0 },
    logisticScale: { min: 0.5, max: 10, step: 0.5, default: 4 },
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

// =============================================================================
// Brief 5.2: EdgeData Migration v3→v4
// =============================================================================

/**
 * Migrate edge data from v3 to v4 (in-place compatible)
 *
 * v3→v4 migration:
 * - Converts legacy `belief` field to dual belief model:
 *   - beliefExists = sqrt(belief) (gives higher structural confidence)
 *   - beliefStrength = belief (preserves effect magnitude)
 * - Bumps schemaVersion to 4
 *
 * @param data - Edge data (potentially v3 or earlier)
 * @returns Migrated edge data (v4)
 */
export function migrateEdgeDataToV4(data: Partial<EdgeData>): EdgeData {
  const version = data.schemaVersion ?? 3

  // Already v4, just return with defaults applied
  if (version === 4) {
    return {
      ...DEFAULT_EDGE_DATA,
      ...data,
      schemaVersion: 4,
    }
  }

  // v3 or earlier: convert legacy belief to dual beliefs
  const legacyBelief = data.belief ?? 0.5

  // Migration strategy:
  // - beliefExists = sqrt(belief): Higher confidence that relationship exists
  //   (e.g., belief=0.5 → beliefExists=0.71)
  // - beliefStrength = belief: Preserve effect magnitude directly
  const beliefExists = data.beliefExists ?? Math.sqrt(legacyBelief)
  const beliefStrength = data.beliefStrength ?? legacyBelief

  return {
    ...DEFAULT_EDGE_DATA,
    ...data,
    beliefExists,
    beliefStrength,
    schemaVersion: 4,
  }
}

/**
 * Check if edge data needs migration to v4
 */
export function needsMigrationToV4(data: Partial<EdgeData>): boolean {
  return (data.schemaVersion ?? 3) < 4
}

// =============================================================================
// Brief 5.3: Sampling Rules for Dual Beliefs
// =============================================================================

/**
 * Compute effective edge weight incorporating dual belief uncertainty.
 *
 * The dual belief model decomposes uncertainty into:
 * - beliefExists: P(relationship exists) - structural uncertainty
 * - beliefStrength: P(effect magnitude | exists) - parametric uncertainty
 *
 * Sampling rule: effectiveWeight = beliefExists * beliefStrength * baseWeight
 *
 * This means:
 * - If we're unsure a relationship exists (low beliefExists), the effect is dampened
 * - If we're sure it exists but uncertain about magnitude (low beliefStrength), effect is dampened
 * - Both must be high for full effect to be transmitted
 *
 * @param baseWeight - The base edge weight (0-1)
 * @param beliefExists - Probability relationship exists (0-1, default 1)
 * @param beliefStrength - Effect magnitude given exists (0-1, default 1)
 * @returns Effective weight after uncertainty adjustment
 */
export function computeEffectiveWeight(
  baseWeight: number,
  beliefExists = 1,
  beliefStrength = 1
): number {
  const clampedWeight = Math.max(0, Math.min(1, baseWeight))
  const clampedExists = Math.max(0, Math.min(1, beliefExists))
  const clampedStrength = Math.max(0, Math.min(1, beliefStrength))

  return clampedWeight * clampedExists * clampedStrength
}

/**
 * Sample from dual belief model for Monte Carlo simulation.
 *
 * Returns whether the edge should be "active" in this sample,
 * and if active, what the effective strength should be.
 *
 * @param beliefExists - P(relationship exists)
 * @param beliefStrength - Effect magnitude if exists
 * @param random - Random number 0-1 (for reproducibility in tests)
 * @returns { active: boolean, strength: number }
 */
export function sampleDualBelief(
  beliefExists: number,
  beliefStrength: number,
  random = Math.random()
): { active: boolean; strength: number } {
  const clampedExists = Math.max(0, Math.min(1, beliefExists))
  const clampedStrength = Math.max(0, Math.min(1, beliefStrength))

  // Sample whether relationship exists
  const active = random < clampedExists

  return {
    active,
    strength: active ? clampedStrength : 0,
  }
}

// =============================================================================
// Brief 5.4: Noisy-OR Functional Form Implementation
// =============================================================================

/**
 * Noisy-OR function for combining multiple independent causes.
 *
 * Noisy-OR is a canonical form for modelling situations where multiple
 * independent causes can each produce an effect (e.g., multiple risk factors
 * any of which could cause a failure).
 *
 * P(Y=1 | parents) = 1 - (1-leak) * ∏(1 - p_i * X_i)
 *
 * Where:
 * - leak = probability of Y=1 even with no causes active
 * - p_i = probability Y=1 given only cause i is active
 * - X_i = whether cause i is active (0 or 1, or probability for continuous)
 *
 * For a single edge: P(Y|X) = 1 - (1-leak) * (1 - strength * X)
 *
 * @param x - Input value (0-1)
 * @param strength - P(Y|X=1), probability effect occurs given cause present
 * @param leak - Probability of effect without this cause (background noise)
 * @returns Output probability (0-1)
 */
export function noisyOr(
  x: number,
  strength = EDGE_CONSTRAINTS.functionParams.noisyOrStrength.default,
  leak = EDGE_CONSTRAINTS.functionParams.noisyOrLeak.default
): number {
  const clampedX = Math.max(0, Math.min(1, x))
  const clampedStrength = Math.max(0, Math.min(1, strength))
  const clampedLeak = Math.max(0, Math.min(1, leak))

  // P(Y|X) = 1 - (1-leak) * (1 - strength * X)
  return 1 - (1 - clampedLeak) * (1 - clampedStrength * clampedX)
}

// =============================================================================
// Brief 5.5: Logistic Functional Form Implementation
// =============================================================================

/**
 * Standard logistic (sigmoid) function with configurable bias and scale.
 *
 * Logistic functions model saturation effects where response starts slow,
 * accelerates through a middle region, then saturates at high levels.
 *
 * σ(x) = 1 / (1 + exp(-scale * (x - bias)))
 *
 * Where:
 * - bias shifts the midpoint left (negative) or right (positive)
 * - scale controls the steepness of the transition
 *
 * Note: This differs from s_curve which uses midpoint/steepness parameterisation.
 * logistic uses bias/scale which maps directly to standard ML conventions.
 *
 * @param x - Input value (0-1)
 * @param bias - Shifts sigmoid left/right (negative = left, positive = right)
 * @param scale - Steepness of transition (higher = sharper)
 * @returns Output value (0-1)
 */
export function logistic(
  x: number,
  bias = EDGE_CONSTRAINTS.functionParams.logisticBias.default,
  scale = EDGE_CONSTRAINTS.functionParams.logisticScale.default
): number {
  const clampedX = Math.max(0, Math.min(1, x))
  const clampedScale = Math.max(0.5, Math.min(10, scale))
  const clampedBias = Math.max(-5, Math.min(5, bias))

  // Transform x from [0,1] to [-5,5] for meaningful sigmoid behaviour
  const scaledX = (clampedX * 10) - 5 - clampedBias

  // Standard logistic: σ(z) = 1 / (1 + exp(-z))
  return 1 / (1 + Math.exp(-clampedScale * scaledX / 5))
}

// =============================================================================
// Brief 19: Noisy-AND-NOT Functional Form Implementation
// =============================================================================

/**
 * Noisy-AND-NOT function for modelling preventative/blocking relationships.
 *
 * Noisy-AND-NOT models situations where a factor reduces or blocks an effect
 * that would otherwise occur. It's the complement to Noisy-OR.
 *
 * P(Y=1 | X) = baseRate * (1 - strength * X)
 *
 * Where:
 * - baseRate = probability of Y=1 when no prevention is active (X=0)
 * - strength = how effectively X prevents Y (0 = no prevention, 1 = complete block)
 * - X = prevention factor (0 = inactive, 1 = fully active)
 *
 * Examples:
 * - X=0: P(Y) = baseRate (no prevention, base probability applies)
 * - X=1: P(Y) = baseRate * (1 - strength) (full prevention, reduced probability)
 * - If strength=1, X=1 completely blocks the effect: P(Y) = 0
 *
 * Use cases:
 * - Safety measures reducing accident probability
 * - Vaccines reducing infection risk
 * - Quality controls reducing defect rates
 * - Mitigation factors in risk models
 *
 * @param x - Prevention factor (0-1, 0=inactive, 1=fully active)
 * @param baseRate - Probability when no prevention (0-1)
 * @param strength - Prevention effectiveness (0-1, 1=complete block)
 * @returns Output probability (0-1)
 */
export function noisyAndNot(
  x: number,
  baseRate = EDGE_CONSTRAINTS.functionParams.noisyAndNotBaseRate.default,
  strength = EDGE_CONSTRAINTS.functionParams.noisyAndNotStrength.default
): number {
  const clampedX = Math.max(0, Math.min(1, x))
  const clampedBaseRate = Math.max(0, Math.min(1, baseRate))
  const clampedStrength = Math.max(0, Math.min(1, strength))

  // P(Y|X) = baseRate * (1 - strength * X)
  return clampedBaseRate * (1 - clampedStrength * clampedX)
}

// =============================================================================
// Brief 5.6: Functional Form Validation
// =============================================================================

/**
 * Validate function parameters are appropriate for the function type.
 *
 * @param functionType - The edge function type
 * @param params - The function parameters
 * @returns { valid: boolean, errors: string[] }
 */
export function validateFunctionParams(
  functionType: EdgeFunctionType,
  params?: EdgeFunctionParams
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (!params) {
    // No params is valid for linear
    return { valid: functionType === 'linear', errors: functionType === 'linear' ? [] : ['Parameters required'] }
  }

  const constraints = EDGE_CONSTRAINTS.functionParams

  switch (functionType) {
    case 'linear':
      // Linear doesn't need params
      break

    case 'diminishing_returns':
      if (params.curvature !== undefined) {
        if (params.curvature < constraints.curvature.min || params.curvature > constraints.curvature.max) {
          errors.push(`Curvature must be between ${constraints.curvature.min} and ${constraints.curvature.max}`)
        }
      }
      break

    case 'threshold':
      if (params.threshold !== undefined) {
        if (params.threshold < constraints.threshold.min || params.threshold > constraints.threshold.max) {
          errors.push(`Threshold must be between ${constraints.threshold.min} and ${constraints.threshold.max}`)
        }
      }
      break

    case 's_curve':
      if (params.midpoint !== undefined) {
        if (params.midpoint < constraints.midpoint.min || params.midpoint > constraints.midpoint.max) {
          errors.push(`Midpoint must be between ${constraints.midpoint.min} and ${constraints.midpoint.max}`)
        }
      }
      if (params.steepness !== undefined) {
        if (params.steepness < constraints.steepness.min || params.steepness > constraints.steepness.max) {
          errors.push(`Steepness must be between ${constraints.steepness.min} and ${constraints.steepness.max}`)
        }
      }
      break

    case 'noisy_or':
      if (params.noisyOrStrength !== undefined) {
        if (params.noisyOrStrength < constraints.noisyOrStrength.min || params.noisyOrStrength > constraints.noisyOrStrength.max) {
          errors.push(`Noisy-OR strength must be between ${constraints.noisyOrStrength.min} and ${constraints.noisyOrStrength.max}`)
        }
      }
      if (params.noisyOrLeak !== undefined) {
        if (params.noisyOrLeak < constraints.noisyOrLeak.min || params.noisyOrLeak > constraints.noisyOrLeak.max) {
          errors.push(`Noisy-OR leak must be between ${constraints.noisyOrLeak.min} and ${constraints.noisyOrLeak.max}`)
        }
      }
      break

    case 'noisy_and_not':
      if (params.noisyAndNotBaseRate !== undefined) {
        if (params.noisyAndNotBaseRate < constraints.noisyAndNotBaseRate.min || params.noisyAndNotBaseRate > constraints.noisyAndNotBaseRate.max) {
          errors.push(`Noisy-AND-NOT base rate must be between ${constraints.noisyAndNotBaseRate.min} and ${constraints.noisyAndNotBaseRate.max}`)
        }
      }
      if (params.noisyAndNotStrength !== undefined) {
        if (params.noisyAndNotStrength < constraints.noisyAndNotStrength.min || params.noisyAndNotStrength > constraints.noisyAndNotStrength.max) {
          errors.push(`Noisy-AND-NOT strength must be between ${constraints.noisyAndNotStrength.min} and ${constraints.noisyAndNotStrength.max}`)
        }
      }
      break

    case 'logistic':
      if (params.logisticBias !== undefined) {
        if (params.logisticBias < constraints.logisticBias.min || params.logisticBias > constraints.logisticBias.max) {
          errors.push(`Logistic bias must be between ${constraints.logisticBias.min} and ${constraints.logisticBias.max}`)
        }
      }
      if (params.logisticScale !== undefined) {
        if (params.logisticScale < constraints.logisticScale.min || params.logisticScale > constraints.logisticScale.max) {
          errors.push(`Logistic scale must be between ${constraints.logisticScale.min} and ${constraints.logisticScale.max}`)
        }
      }
      break

    default:
      errors.push(`Unknown function type: ${functionType}`)
  }

  return { valid: errors.length === 0, errors }
}

/**
 * Evaluate an edge function at a given input value.
 *
 * @param x - Input value (0-1)
 * @param functionType - The edge function type
 * @param params - Optional function parameters
 * @returns Output value (0-1)
 */
export function evaluateEdgeFunction(
  x: number,
  functionType: EdgeFunctionType,
  params?: EdgeFunctionParams
): number {
  const clampedX = Math.max(0, Math.min(1, x))

  switch (functionType) {
    case 'linear':
      return clampedX

    case 'diminishing_returns': {
      const c = params?.curvature ?? EDGE_CONSTRAINTS.functionParams.curvature.default
      return Math.pow(clampedX, c)
    }

    case 'threshold': {
      const t = params?.threshold ?? EDGE_CONSTRAINTS.functionParams.threshold.default
      return clampedX >= t ? 1 : 0
    }

    case 's_curve': {
      const m = params?.midpoint ?? EDGE_CONSTRAINTS.functionParams.midpoint.default
      const s = params?.steepness ?? EDGE_CONSTRAINTS.functionParams.steepness.default
      return 1 / (1 + Math.exp(-s * (clampedX - m) * 10))
    }

    case 'noisy_or': {
      const strength = params?.noisyOrStrength ?? EDGE_CONSTRAINTS.functionParams.noisyOrStrength.default
      const leak = params?.noisyOrLeak ?? EDGE_CONSTRAINTS.functionParams.noisyOrLeak.default
      return noisyOr(clampedX, strength, leak)
    }

    case 'noisy_and_not': {
      const baseRate = params?.noisyAndNotBaseRate ?? EDGE_CONSTRAINTS.functionParams.noisyAndNotBaseRate.default
      const strength = params?.noisyAndNotStrength ?? EDGE_CONSTRAINTS.functionParams.noisyAndNotStrength.default
      return noisyAndNot(clampedX, baseRate, strength)
    }

    case 'logistic': {
      const bias = params?.logisticBias ?? EDGE_CONSTRAINTS.functionParams.logisticBias.default
      const scale = params?.logisticScale ?? EDGE_CONSTRAINTS.functionParams.logisticScale.default
      return logistic(clampedX, bias, scale)
    }

    default:
      return clampedX
  }
}

// =============================================================================
// Brief 19: Noisy-AND-NOT Validation
// =============================================================================

/**
 * Validate if noisy_and_not is appropriate for the given node types.
 *
 * Noisy-AND-NOT assumes binary (0/1) semantics for proper probabilistic
 * interpretation. While not strictly required, using it with non-binary
 * nodes may lead to unexpected results.
 *
 * @param sourceNodeType - Type of the source (cause/prevention) node
 * @param targetNodeType - Type of the target (effect) node
 * @returns Validation result with warning if applicable
 */
export interface NoisyAndNotValidation {
  valid: boolean
  warning?: string
  suggestion?: string
}

const BINARY_NODE_TYPES = ['risk', 'outcome', 'decision', 'goal']

export function validateNoisyAndNotUsage(
  sourceNodeType?: string,
  targetNodeType?: string
): NoisyAndNotValidation {
  const warnings: string[] = []
  const suggestions: string[] = []

  // Check if source is a binary-compatible type
  if (sourceNodeType && !BINARY_NODE_TYPES.includes(sourceNodeType.toLowerCase())) {
    warnings.push(`Source node type "${sourceNodeType}" may not have binary semantics`)
    suggestions.push('Consider using a Risk or Factor node as the prevention source')
  }

  // Check if target is a binary-compatible type
  if (targetNodeType && !BINARY_NODE_TYPES.includes(targetNodeType.toLowerCase())) {
    warnings.push(`Target node type "${targetNodeType}" may not have binary semantics`)
    suggestions.push('Consider using an Outcome or Risk node as the prevention target')
  }

  return {
    valid: warnings.length === 0,
    warning: warnings.length > 0 ? warnings.join('. ') : undefined,
    suggestion: suggestions.length > 0 ? suggestions.join('. ') : undefined,
  }
}

/**
 * Check if a form type requires binary node validation
 */
export function formRequiresBinaryValidation(form: EdgeFunctionType): boolean {
  return form === 'noisy_and_not' || form === 'noisy_or'
}

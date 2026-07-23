/**
 * Node domain types and schemas
 * British English: visualisation, colour, initialise
 */

import { z } from 'zod'
import { Target, Crosshair, Lightbulb, Settings, AlertTriangle, TrendingUp, Zap, Shield } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { devWarn } from '../../utils/debugLog'

/*
 * Node type taxonomy for decision trees
 * 🎯 Goal: Target outcome or objective
 * 🔀 Decision: Choice point requiring evaluation
 * 💡 Option: Specific alternative or path
 * ⚙️ Factor: Intermediate variable or driver
 * ⚠️ Risk: Potential hazard or concern
 * 📈 Outcome: Result or consequence
 * ⚡ Action: Concrete step or task to execute
 * 🛡️ Constraint: Boundary or limit (budget, time, resource)
 */
/**
 * All canvas node type identifiers.
 *
 * NOTE — 'constraint': schema-defined (kept for wire tolerance / ref resolution),
 * but CEE/PLoT never emits canvas nodes with type 'constraint'. Constraints surface as
 * badge data on GoalNode (store.goalConstraints + results.report.goal_constraints), not as
 * standalone canvas nodes. The dead ConstraintNode renderer + its registry entry were
 * removed (honesty sweep) — there is no 'constraint' ReactFlow renderer.
 * Do not add CEE-driven constraint node emission (or re-add a renderer) without a design review.
 */
export const NodeTypeEnum = z.enum(['goal', 'decision', 'option', 'factor', 'risk', 'outcome', 'action', 'constraint'])
export type NodeType = z.infer<typeof NodeTypeEnum>

/**
 * Base node data schema (v3)
 * All nodes share: label, type, optional description
 * v3 adds v1.2 API fields: kind, prior, utility, body
 */
export const NodeDataSchema = z.object({
  label: z.string().min(1).max(100),
  type: z.string().default('decision'), // Will be refined by NodeTypeEnum
  description: z.string().max(500).optional(),

  // v1.2 API fields (optional, for backend interop)
  kind: z.enum(['goal', 'decision', 'option', 'factor', 'risk', 'outcome', 'action', 'constraint']).optional(), // Backend node classification
  prior: z.number().min(0).max(1).optional(), // Probability (0..1)
  utility: z.number().min(-1).max(1).optional(), // Relative payoff (-1..+1)
  body: z.string().max(2000).optional(), // Longer text (distinct from description)

  // CEE display provenance (optional, threaded from /assist/v1/draft-graph response).
  // Drives "From brief" / "AI estimate" / "User set" pills. UI never invents this value.
  provenance: z.enum(['from_brief', 'ai_inferred', 'user_set']).optional(),
})

/**
 * Goal node: represents target outcome
 */
export const GoalNodeDataSchema = NodeDataSchema.extend({
  type: z.literal('goal'),
})

/**
 * Decision node: represents choice point
 */
export const DecisionNodeDataSchema = NodeDataSchema.extend({
  type: z.literal('decision'),
})

/**
 * ObservedState — canonical runtime shape for factor observed values.
 *
 * Canvas uses `observedState` (camelCase) on node.data; CEE/PLoT wire format
 * uses `observed_state` (snake_case). Fields inside are consistent across both.
 *
 * `display_value` is CEE-provided contextual text. As of the V5 stale-value-
 * protection fix (May 2026), a fresh `raw_value` + meaningful unit (e.g.
 * `26000` + `'£'`) outranks `display_value`, so a stale display string cannot
 * mask a user edit to observed_state. `display_value` still wins over the
 * unitless-raw numeric fallback and the value-only binary heuristic — see the
 * full priority order on `FactorDisplayInput.display_value` in
 * src/utils/formatFactorDisplayValue.ts.
 *
 * All fields are optional because factor observed state is progressively filled
 * in as the user confirms brief content. Validation is warning-only at the
 * mutation boundary — do not reject drafts that omit fields.
 */
export const ObservedStateSchema = z.object({
  display_value: z.string().nullable().optional(),
  value: z.number().nullable().optional(),
  raw_value: z.union([z.string(), z.number()]).nullable().optional(),
  baseline: z.number().nullable().optional(),
  unit: z.string().nullable().optional(),
  source: z.string().nullable().optional(),
  factor_type: z.string().nullable().optional(),
  cap: z.number().nullable().optional(),
  extractionType: z.enum(['explicit', 'inferred', 'external']).nullable().optional(),
  uncertainty_drivers: z.array(z.string()).nullable().optional(),
}).passthrough()
export type ObservedState = z.infer<typeof ObservedStateSchema>

/**
 * Intervention — rich CEE V3 intervention object.
 *
 * Mirrors CEEInterventionV3 in src/adapters/cee/types.ts:261-271. Canvas
 * tolerates both this object shape and plain numbers (the platform-canonical
 * `Record<string, number>` wire shape) via the union below on OptionNodeData.
 */
export const InterventionSchema = z.object({
  value: z.number(),
  source: z.enum(['brief_extraction', 'user_specified', 'cee_hypothesis']).optional(),
  target_match: z.object({
    node_id: z.string(),
    match_type: z.enum(['exact_id', 'exact_label', 'semantic']),
    confidence: z.enum(['high', 'medium', 'low']),
  }).optional(),
  value_confidence: z.enum(['high', 'medium', 'low']).optional(),
  reasoning: z.string().optional(),
}).passthrough()
export type Intervention = z.infer<typeof InterventionSchema>

/**
 * Option node: represents alternative
 *
 * - `is_baseline` is authoritative; the 13-keyword regex in
 *   src/canvas/utils/baselineDetection.ts runs only as nullish fallback.
 * - `interventions` is a union: canonical wire shape is `Record<string, number>`;
 *   CEE V3 object form is tolerated for backward compat.
 */
export const OptionNodeDataSchema = NodeDataSchema.extend({
  type: z.literal('option'),
  is_baseline: z.boolean().nullable().optional(),
  interventions: z.record(
    z.string(),
    z.union([z.number(), InterventionSchema]),
  ).nullable().optional(),
})

/**
 * Controllability type for factors
 * Decision Graph Display v2: Task 6
 * CEE V12.4: Added 'observable' and 'external' from explicit category field
 * - controllable: Options directly set this (solid border)
 * - observable: Known baseline, not changed by options (dashed border)
 * - external: Outside user control - market, regulations (dotted border)
 * - partial: Legacy - indirectly affected by interventions (dashed border)
 * - unknown: No controllability data available (solid border)
 */
export const ControllabilityEnum = z.enum(['controllable', 'observable', 'external', 'partial', 'unknown'])
export type Controllability = z.infer<typeof ControllabilityEnum>

/**
 * CEE factor category (maps to controllability for display)
 * CEE V12.4: Explicit category field from CEE analysis
 */
export const FactorCategoryEnum = z.enum(['controllable', 'observable', 'external'])
export type FactorCategory = z.infer<typeof FactorCategoryEnum>

/**
 * Factor node: represents intermediate variable or driver.
 *
 * `observedState` carries the runtime value/unit/source shape. `uncertainty_drivers`
 * lives inside observedState (not duplicated at the top level) to keep a single
 * source of truth — see ObservedStateSchema above.
 *
 * `display_value` is allowed at the top level because CEE emits it alongside
 * `observed_state` (see golden-path fixture). Readers should prefer top-level
 * and fall back to observedState for legacy data.
 */
export const FactorNodeDataSchema = NodeDataSchema.extend({
  type: z.literal('factor'),
  /** Controllability level for visual border style (Decision Graph Display v2) */
  controllability: ControllabilityEnum.optional(),
  /** CEE V12.4: Explicit category from CEE analysis (takes precedence over derived controllability) */
  category: FactorCategoryEnum.optional(),
  observedState: ObservedStateSchema.nullable().optional(),
  /** CEE wire-shape top-level display text (mirrored in ObservedStateSchema for legacy reads). */
  display_value: z.string().nullable().optional(),
})

/**
 * Risk impact level
 * Decision Graph Display v2: Task 9
 */
export const RiskImpactEnum = z.enum(['low', 'medium', 'high', 'critical'])
export type RiskImpact = z.infer<typeof RiskImpactEnum>

/**
 * Risk node: represents hazard or concern
 */
export const RiskNodeDataSchema = NodeDataSchema.extend({
  type: z.literal('risk'),
  /** Probability of risk occurring (0-1) - Decision Graph Display v2 */
  probability: z.number().min(0).max(1).optional(),
  /** Impact severity level - Decision Graph Display v2 */
  impact: RiskImpactEnum.optional(),
})

/**
 * Outcome node: represents result
 */
export const OutcomeNodeDataSchema = NodeDataSchema.extend({
  type: z.literal('outcome'),
})

/**
 * Action node: represents concrete step or task to execute
 */
export const ActionNodeDataSchema = NodeDataSchema.extend({
  type: z.literal('action'),
})

/**
 * Constraint type enumeration
 * Task 4.5: Structured constraint types
 */
export const ConstraintTypeEnum = z.enum(['upper_bound', 'lower_bound', 'deadline', 'resource', 'other'])
export type ConstraintType = z.infer<typeof ConstraintTypeEnum>

/**
 * Constraint node: represents a boundary or limit
 * Task 4.5: Structured constraint input
 */
export const ConstraintNodeDataSchema = NodeDataSchema.extend({
  type: z.literal('constraint'),
  /** Type of constraint (budget cap, minimum threshold, deadline) */
  constraintType: ConstraintTypeEnum.optional(),
  /** Threshold value for the constraint */
  thresholdValue: z.number().optional(),
  /** Unit for the threshold (dollars, hours, percent, etc.) */
  unit: z.string().max(50).optional(),
  /** Whether this is a hard (must meet) or soft (prefer to meet) constraint */
  hardConstraint: z.boolean().default(true),
})

/**
 * Discriminated union of all node data types
 */
export const AnyNodeDataSchema = z.discriminatedUnion('type', [
  GoalNodeDataSchema,
  DecisionNodeDataSchema,
  OptionNodeDataSchema,
  FactorNodeDataSchema,
  RiskNodeDataSchema,
  OutcomeNodeDataSchema,
  ActionNodeDataSchema,
  ConstraintNodeDataSchema,
])

export type NodeData = z.infer<typeof AnyNodeDataSchema>
export type GoalNodeData = z.infer<typeof GoalNodeDataSchema>
export type DecisionNodeData = z.infer<typeof DecisionNodeDataSchema>
export type OptionNodeData = z.infer<typeof OptionNodeDataSchema>
export type FactorNodeData = z.infer<typeof FactorNodeDataSchema>
export type RiskNodeData = z.infer<typeof RiskNodeDataSchema>
export type OutcomeNodeData = z.infer<typeof OutcomeNodeDataSchema>
export type ActionNodeData = z.infer<typeof ActionNodeDataSchema>
export type ConstraintNodeData = z.infer<typeof ConstraintNodeDataSchema>

/**
 * Node metadata for rendering and accessibility
 */
export interface NodeMetadata {
  icon: LucideIcon
  label: string
  ariaRole: string
  defaultSize: { width: number; height: number }
}

/**
 * Node type registry: maps types to metadata
 * Used for rendering, a11y, and inspector UI
 */
export const NODE_REGISTRY: Record<NodeType, NodeMetadata> = {
  goal: {
    icon: Target,
    label: 'Goal',
    ariaRole: 'group',
    defaultSize: { width: 240, height: 100 },
  },
  decision: {
    icon: Crosshair,
    label: 'Decision',
    ariaRole: 'group',
    defaultSize: { width: 240, height: 100 },
  },
  option: {
    icon: Lightbulb,
    label: 'Option',
    ariaRole: 'group',
    defaultSize: { width: 220, height: 100 },
  },
  factor: {
    icon: Settings,
    label: 'Factor',
    ariaRole: 'group',
    defaultSize: { width: 220, height: 100 },
  },
  risk: {
    icon: AlertTriangle,
    label: 'Risk',
    ariaRole: 'group',
    defaultSize: { width: 220, height: 100 },
  },
  outcome: {
    icon: TrendingUp,
    label: 'Outcome',
    ariaRole: 'group',
    defaultSize: { width: 220, height: 100 },
  },
  action: {
    icon: Zap,
    label: 'Action',
    ariaRole: 'group',
    defaultSize: { width: 220, height: 100 },
  },
  constraint: {
    icon: Shield,
    label: 'Constraint',
    ariaRole: 'group',
    defaultSize: { width: 220, height: 100 },
  },
}

// ---------------------------------------------------------------------------
// Graph Editing Experience Task 6c: Category auto-suggestion
// ---------------------------------------------------------------------------

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  controllable: ['cost', 'price', 'budget', 'revenue', 'spend', 'invest', 'hire', 'salary', 'fee', 'funding'],
  external: ['market', 'regulation', 'weather', 'competitor', 'economy', 'policy', 'demand', 'inflation', 'interest'],
  observable: ['satisfaction', 'quality', 'performance', 'retention', 'churn', 'engagement', 'nps', 'rating'],
}

/**
 * Suggest a category for a factor node based on keyword matching in the label.
 * Returns null if no keyword match is found.
 */
export function suggestCategory(label: string): 'controllable' | 'observable' | 'external' | null {
  const lower = label.toLowerCase()
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) {
      return category as 'controllable' | 'observable' | 'external'
    }
  }
  return null
}

// ---------------------------------------------------------------------------
// Schema validation (warning-only)
// ---------------------------------------------------------------------------

/**
 * Validate a node's `data` against its type-specific schema. Warning-only —
 * logs via devWarn in DEV builds, never throws. Call at mutation boundaries
 * (applyDraftResult, backfill, patch-apply), never on the render hot path.
 *
 * Unknown node types silently pass — we only validate types we have schemas for.
 */
export function validateNodeData(nodeId: string, data: unknown): void {
  if (!data || typeof data !== 'object') return
  const type = (data as { type?: unknown }).type
  let schema: z.ZodTypeAny | null = null
  switch (type) {
    case 'factor': schema = FactorNodeDataSchema; break
    case 'option': schema = OptionNodeDataSchema; break
    case 'goal': schema = GoalNodeDataSchema; break
    case 'decision': schema = DecisionNodeDataSchema; break
    case 'risk': schema = RiskNodeDataSchema; break
    case 'outcome': schema = OutcomeNodeDataSchema; break
    case 'action': schema = ActionNodeDataSchema; break
    case 'constraint': schema = ConstraintNodeDataSchema; break
    default: return
  }
  const result = schema.safeParse(data)
  if (!result.success) {
    devWarn('canvas/schema', `Node ${nodeId} (${String(type)}) data shape drift`, {
      nodeId,
      type,
      issues: result.error.issues,
    })
  }
}

/**
 * Validate a batch of nodes. Convenience wrapper — iterates and validates each.
 */
export function validateNodesBatch(nodes: Array<{ id: string; data?: unknown }>): void {
  for (const n of nodes) {
    if (n?.data) validateNodeData(n.id, n.data)
  }
}

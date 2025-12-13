/**
 * Node domain types and schemas
 * British English: visualisation, colour, initialise
 */

import { z } from 'zod'
import { Target, Crosshair, Lightbulb, Settings, AlertTriangle, TrendingUp, Zap, Shield } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

/**
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
 * Option node: represents alternative
 */
export const OptionNodeDataSchema = NodeDataSchema.extend({
  type: z.literal('option'),
})

/**
 * Factor node: represents intermediate variable or driver
 */
export const FactorNodeDataSchema = NodeDataSchema.extend({
  type: z.literal('factor'),
})

/**
 * Risk node: represents hazard or concern
 */
export const RiskNodeDataSchema = NodeDataSchema.extend({
  type: z.literal('risk'),
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
    defaultSize: { width: 200, height: 80 },
  },
  decision: {
    icon: Crosshair,
    label: 'Decision',
    ariaRole: 'group',
    defaultSize: { width: 200, height: 80 },
  },
  option: {
    icon: Lightbulb,
    label: 'Option',
    ariaRole: 'group',
    defaultSize: { width: 180, height: 70 },
  },
  factor: {
    icon: Settings,
    label: 'Factor',
    ariaRole: 'group',
    defaultSize: { width: 180, height: 70 },
  },
  risk: {
    icon: AlertTriangle,
    label: 'Risk',
    ariaRole: 'group',
    defaultSize: { width: 180, height: 70 },
  },
  outcome: {
    icon: TrendingUp,
    label: 'Outcome',
    ariaRole: 'group',
    defaultSize: { width: 200, height: 80 },
  },
  action: {
    icon: Zap,
    label: 'Action',
    ariaRole: 'group',
    defaultSize: { width: 180, height: 70 },
  },
  constraint: {
    icon: Shield,
    label: 'Constraint',
    ariaRole: 'group',
    defaultSize: { width: 180, height: 80 },
  },
}

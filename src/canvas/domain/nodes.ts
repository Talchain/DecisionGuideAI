/**
 * Node domain types and schemas
 * British English: visualisation, colour, initialise
 */

import { z } from 'zod'

/**
 * Node type taxonomy for decision trees
 * 🎯 Goal: Target outcome or objective
 * 🔀 Decision: Choice point requiring evaluation
 * 💡 Option: Specific alternative or path
 * ⚠️ Risk: Potential hazard or concern
 * 📈 Outcome: Result or consequence
 */
export const NodeTypeEnum = z.enum(['goal', 'decision', 'option', 'risk', 'outcome'])
export type NodeType = z.infer<typeof NodeTypeEnum>

/**
 * Base node data schema (v2)
 * All nodes share: label, type, optional description
 */
export const NodeDataSchema = z.object({
  label: z.string().min(1).max(100),
  type: z.string().default('decision'), // Will be refined by NodeTypeEnum
  description: z.string().max(500).optional(),
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
 * Discriminated union of all node data types
 */
export const AnyNodeDataSchema = z.discriminatedUnion('type', [
  GoalNodeDataSchema,
  DecisionNodeDataSchema,
  OptionNodeDataSchema,
  RiskNodeDataSchema,
  OutcomeNodeDataSchema,
])

export type NodeData = z.infer<typeof AnyNodeDataSchema>
export type GoalNodeData = z.infer<typeof GoalNodeDataSchema>
export type DecisionNodeData = z.infer<typeof DecisionNodeDataSchema>
export type OptionNodeData = z.infer<typeof OptionNodeDataSchema>
export type RiskNodeData = z.infer<typeof RiskNodeDataSchema>
export type OutcomeNodeData = z.infer<typeof OutcomeNodeDataSchema>

/**
 * Node metadata for rendering and accessibility
 */
export interface NodeMetadata {
  icon: string
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
    icon: '🎯',
    label: 'Goal',
    ariaRole: 'group',
    defaultSize: { width: 200, height: 80 },
  },
  decision: {
    icon: '🔀',
    label: 'Decision',
    ariaRole: 'group',
    defaultSize: { width: 200, height: 80 },
  },
  option: {
    icon: '💡',
    label: 'Option',
    ariaRole: 'group',
    defaultSize: { width: 180, height: 70 },
  },
  risk: {
    icon: '⚠️',
    label: 'Risk',
    ariaRole: 'group',
    defaultSize: { width: 180, height: 70 },
  },
  outcome: {
    icon: '📈',
    label: 'Outcome',
    ariaRole: 'group',
    defaultSize: { width: 200, height: 80 },
  },
}

/**
 * Node type registry
 * Maps node types to their renderers
 * British English: visualisation
 */

import type { NodeTypes } from '@xyflow/react'
import { GoalNode } from './GoalNode'
import DecisionNode from './DecisionNode'
import { OptionNode } from './OptionNode'
import { RiskNode } from './RiskNode'
import { OutcomeNode } from './OutcomeNode'

/**
 * React Flow node types registry
 * Used in ReactFlow component's nodeTypes prop
 */
export const nodeTypes: NodeTypes = {
  goal: GoalNode,
  decision: DecisionNode,
  option: OptionNode,
  risk: RiskNode,
  outcome: OutcomeNode,
}

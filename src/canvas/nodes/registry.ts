/**
 * Node type registry
 * Maps node types to their renderers
 * British English: visualisation
 */

import type { NodeTypes } from '@xyflow/react'
import { GoalNode } from './GoalNode'
import DecisionNode from './DecisionNode'
import { OptionNode } from './OptionNode'
import { FactorNode } from './FactorNode'
import { RiskNode } from './RiskNode'
import { OutcomeNode } from './OutcomeNode'
import { ActionNode } from './ActionNode'
import { GhostOptionNode } from './GhostOptionNode'

/**
 * React Flow node types registry
 * Used in ReactFlow component's nodeTypes prop
 */
export const nodeTypes: NodeTypes = {
  goal: GoalNode,
  decision: DecisionNode,
  option: OptionNode,
  factor: FactorNode,
  risk: RiskNode,
  outcome: OutcomeNode,
  action: ActionNode,
  // NOTE: no 'constraint' renderer. CEE/PLoT never emit type:'constraint' canvas
  // nodes — constraints surface as GoalNode badge data (store.goalConstraints +
  // results.report.goal_constraints), not standalone nodes. The dead ConstraintNode
  // renderer was removed (honesty sweep). See NodeTypeEnum JSDoc. Re-add a renderer
  // here only alongside a design review that introduces constraint-node emission.
  'ghost-option': GhostOptionNode,
}

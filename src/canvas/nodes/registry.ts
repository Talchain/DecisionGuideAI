/**
 * Node type registry
 * Maps node types to their renderers
 * British English: visualisation
 */

import type { NodeTypes } from '@xyflow/react'
// Node copy is never centred. This rule has to travel with the renderers
// rather than sit in a stylesheet someone has to remember to import, for the
// same reason the keyboard scope below is derived rather than listed. See the
// file's own header for the mechanism (the UA `button { text-align: center }`
// that no ancestor can override) and for why it carries two selectors.
import './nodeTextAlign.css'
// A card with keyboard focus shows the contract's Info ring (audit SI-4): React
// Flow's own sheet turns the outline off. Travels with the renderers, as above.
import './nodeFocusRing.css'
import { GoalNode } from './GoalNode'
import DecisionNode from './DecisionNode'
import { OptionNode } from './OptionNode'
import { FactorNode } from './FactorNode'
import { RiskNode } from './RiskNode'
import { OutcomeNode } from './OutcomeNode'
import { ActionNode } from './ActionNode'
import { GhostOptionNode } from './GhostOptionNode'
import { GhostTierNode } from './GhostTierNode'
import { withNodeKeyboardScope } from './nodeKeyboardScope'
import { ViewCardNode } from './ViewCardNode'
import { ViewQuestionNode } from './ViewQuestionNode'
import { previousCanvasSpike } from '../../olumiCore/lane'
import { CoreCard } from '../../olumiView/previous/CoreCard'

/**
 * The renderers, before the keyboard scope is applied.
 *
 * ⚠ NOT THE EXPORT. Consume `nodeTypes` below — this map exists so the wrapping
 * is DERIVED from it rather than written out a second time. It is exported only
 * so `registry.keyboardScope.spec.tsx` can assert that every entry here appears
 * wrapped in `nodeTypes`, in both directions.
 */
export const rawNodeTypes: NodeTypes = {
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
  'ghost-tier': GhostTierNode,
  // The olumi-core lane's one card for every View card (decision A, src/olumiView/canvas.ts).
  viewCard: ViewCardNode,
  viewQuestion: ViewQuestionNode,
  // SPIKE (UI restore, 11 Nov 2026; `?previous-canvas` on the olumi-core lane only, never served): every kind is a core card on the
  // previous frame, its body core's own words (olumiView/previous/CoreCard.tsx). `constraint` is core's limit; the previous product
  // has no card for it (see the note in domain/nodes.ts), and off the spike there is still none.
  ...(previousCanvasSpike() ? { goal: CoreCard, decision: CoreCard, option: CoreCard, factor: CoreCard, risk: CoreCard, outcome: CoreCard, constraint: CoreCard } : {}),
}

/**
 * React Flow node types registry
 * Used in ReactFlow component's nodeTypes prop
 *
 * ⭐ EVERY RENDERER IS WRAPPED IN A KEYBOARD SCOPE, AND THAT IS DERIVED FROM THE
 * MAP ABOVE, NOT LISTED. Without it, pressing Enter or Space on ANY control
 * inside a node also selects the node behind it and swings the dock to the
 * Inspector — React Flow's own node-level `onKeyDown` has no idea a descendant
 * handled the key. The full mechanism, the measurement, and why this is not
 * `disableKeyboardA11y`, are in `nodeKeyboardScope.tsx`.
 *
 * A node type added here gets the scope by construction. That is the point: a
 * per-component fix is a list someone has to remember to extend (CLAUDE.md
 * trap 12), and `GhostOptionNode` has no inner element to put a class on — its
 * root IS the control.
 */
export const nodeTypes: NodeTypes = Object.fromEntries(
  Object.entries(rawNodeTypes).map(([type, Renderer]) => [type, withNodeKeyboardScope(Renderer)]),
)

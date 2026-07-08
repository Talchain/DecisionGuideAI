// vNext nodeTypes registry — same type keys as the store's nodes (see
// src/canvas/nodes/registry.ts), so store nodes render without any mapping.
// Option gets its Stage-2 card; every other type falls back to
// BasicNodeVNext. Later stages swap entries here — this registry is the
// single edit point per node type.

import type { NodeTypes } from '@xyflow/react'
import { BasicNodeVNext } from './BasicNodeVNext'
import { OptionNodeVNext } from './OptionNodeVNext'
import { DecisionNodeVNext } from './DecisionNodeVNext'
import { FactorNodeVNext } from './FactorNodeVNext'
import { RiskNodeVNext } from './RiskNodeVNext'
import { OutcomeNodeVNext } from './OutcomeNodeVNext'
import { GoalNodeVNext } from './GoalNodeVNext'

export const vnextNodeTypes: NodeTypes = {
  goal: GoalNodeVNext,
  decision: DecisionNodeVNext,
  option: OptionNodeVNext,
  factor: FactorNodeVNext,
  risk: RiskNodeVNext,
  outcome: OutcomeNodeVNext,
  action: BasicNodeVNext,
  constraint: BasicNodeVNext,
  'ghost-option': BasicNodeVNext,
}

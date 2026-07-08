// Goal card (Stage 3): the USER success target, raw units, untransformed —
// or the set-a-target hint (UI-SEM-071 family: producer values never
// substitute for the user's target).

import { memo } from 'react'
import { type NodeProps } from '@xyflow/react'
import { useGraphExperienceVMContext } from '../vm/useGraphExperienceVM'
import { GOAL_NEEDS_TARGET_HINT } from '../vm/strings'
import { NodeCardShell } from './NodeCardShell'

function GoalNodeVNextInner(props: NodeProps) {
  const { id, data } = props
  const vm = useGraphExperienceVMContext()
  const card = vm.goalCards[id]
  const rawLabel = (data as Record<string, unknown> | undefined)?.label
  const label = card?.label ?? (typeof rawLabel === 'string' && rawLabel ? rawLabel : 'Untitled')

  return (
    <NodeCardShell nodeId={id} nodeKind="goal" label={label} testid={`vnext-goal-${id}`}>
      {card?.targetDisplay != null && (
        <p data-testid="vnext-goal-target" className="mt-1 text-xs text-text-body">
          {card.targetDisplay}
        </p>
      )}
      {card?.needsTargetHint && (
        <p data-testid="vnext-goal-hint" className="mt-1 text-xs italic text-text-light">
          {GOAL_NEEDS_TARGET_HINT}
        </p>
      )}
    </NodeCardShell>
  )
}

export const GoalNodeVNext = memo(GoalNodeVNextInner)

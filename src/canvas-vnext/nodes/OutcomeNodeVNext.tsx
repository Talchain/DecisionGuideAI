// Outcome card (Stage 3): goal-effect polarity from the model's own edge
// weights (computeSignedMean sign — model input, no stale treatment). NO
// per-node forecast: the producer sends none, so the card never invents one.

import { memo } from 'react'
import { type NodeProps } from '@xyflow/react'
import { useGraphExperienceVMContext } from '../vm/useGraphExperienceVM'
import { OUTCOME_EFFECT_LABELS } from '../vm/strings'
import { NodeCardShell } from './NodeCardShell'

function OutcomeNodeVNextInner(props: NodeProps) {
  const { id, data } = props
  const vm = useGraphExperienceVMContext()
  const card = vm.outcomeCards[id]
  const rawLabel = (data as Record<string, unknown> | undefined)?.label
  const label = card?.label ?? (typeof rawLabel === 'string' && rawLabel ? rawLabel : 'Untitled')

  return (
    <NodeCardShell nodeId={id} nodeKind="outcome" label={label} testid={`vnext-outcome-${id}`}>
      {card?.goalEffect != null && (
        <p
          data-testid="vnext-outcome-effect"
          className={`mt-1 text-xs ${card.goalEffect === 'helps' ? 'text-success' : 'text-danger'}`}
        >
          {OUTCOME_EFFECT_LABELS[card.goalEffect]}
        </p>
      )}
    </NodeCardShell>
  )
}

export const OutcomeNodeVNext = memo(OutcomeNodeVNextInner)

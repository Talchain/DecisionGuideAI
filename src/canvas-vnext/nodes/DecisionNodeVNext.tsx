// Decision card (Stage 3): canonical state line, fail-closed lead sentence,
// hinge-based sensitivity line. Renders ONLY what the DecisionCardVM carries.

import { memo } from 'react'
import { type NodeProps } from '@xyflow/react'
import { useGraphExperienceVMContext } from '../vm/useGraphExperienceVM'
import { NodeCardShell, ResultDimBlock } from './NodeCardShell'

function DecisionNodeVNextInner(props: NodeProps) {
  const { id, data } = props
  const vm = useGraphExperienceVMContext()
  const card = vm.decisionCards[id]
  const rawLabel = (data as Record<string, unknown> | undefined)?.label
  const label = card?.label ?? (typeof rawLabel === 'string' && rawLabel ? rawLabel : 'Untitled')

  const hasResultContent = card != null && (card.leadSentence != null || card.sensitiveTo != null)

  return (
    <NodeCardShell nodeId={id} nodeKind="decision" label={label} testid={`vnext-decision-${id}`}>
      {card?.stateLine != null && (
        <p data-testid="vnext-decision-state" className="mt-1 text-xs text-text-light">
          {card.stateLine}
        </p>
      )}
      {hasResultContent && (
        <ResultDimBlock dim={card.isStaleResult} markerTestId="vnext-decision-stale-marker">
          {card.leadSentence != null && (
            <p data-testid="vnext-decision-lead" className="mt-1 text-xs text-text-body">
              {card.leadSentence}
            </p>
          )}
          {card.sensitiveTo != null && (
            <p data-testid="vnext-decision-sensitive" className="mt-1 text-xs text-text-light">
              {card.sensitiveTo}
            </p>
          )}
        </ResultDimBlock>
      )}
    </NodeCardShell>
  )
}

export const DecisionNodeVNext = memo(DecisionNodeVNextInner)

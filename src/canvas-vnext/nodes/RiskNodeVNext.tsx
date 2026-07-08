// Risk card (Stage 3): likelihood/impact from the model (never dimmed),
// fragile-incidence note from results (dims when stale).

import { memo } from 'react'
import { type NodeProps } from '@xyflow/react'
import { useGraphExperienceVMContext } from '../vm/useGraphExperienceVM'
import { fragileLinkLine } from '../vm/strings'
import { NodeCardShell, ResultDimBlock } from './NodeCardShell'

function RiskNodeVNextInner(props: NodeProps) {
  const { id, data } = props
  const vm = useGraphExperienceVMContext()
  const card = vm.riskCards[id]
  const rawLabel = (data as Record<string, unknown> | undefined)?.label
  const label = card?.label ?? (typeof rawLabel === 'string' && rawLabel ? rawLabel : 'Untitled')

  const modelLine = [card?.likelihoodDisplay, card?.impactDisplay].filter(Boolean).join(' · ')

  return (
    <NodeCardShell nodeId={id} nodeKind="risk" label={label} testid={`vnext-risk-${id}`}>
      {modelLine && (
        <p data-testid="vnext-risk-model" className="mt-1 text-xs text-text-body">
          {modelLine}
        </p>
      )}
      {card != null && card.fragileLinkCount > 0 && (
        <ResultDimBlock dim={card.isStaleResult} markerTestId="vnext-risk-stale-marker">
          <p data-testid="vnext-risk-fragile" className="mt-1 text-xs text-text-light">
            {fragileLinkLine(card.fragileLinkCount)}
          </p>
        </ResultDimBlock>
      )}
    </NodeCardShell>
  )
}

export const RiskNodeVNext = memo(RiskNodeVNextInner)

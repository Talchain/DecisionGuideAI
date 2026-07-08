// Factor card (Stage 3): observed value (model input, never dimmed) + at most
// ONE flag pill from the UI-SEM-077 ladder (result-derived flags dim when
// stale; 'worth_discussing' only ever arrives from fixtures).

import { memo } from 'react'
import { type NodeProps } from '@xyflow/react'
import { useGraphExperienceVMContext } from '../vm/useGraphExperienceVM'
import { FACTOR_FLAG_LABELS } from '../vm/strings'
import { NodeCardShell, ResultDimBlock } from './NodeCardShell'
import type { FactorFlag } from '../vm/types'

const FLAG_BORDER: Record<FactorFlag, string> = {
  top_driver: 'border-info/30',
  could_flip: 'border-warning/30',
  weak_evidence: 'border-warning/30',
  worth_checking: 'border-panel-border',
  worth_discussing: 'border-info/30',
}

function FactorNodeVNextInner(props: NodeProps) {
  const { id, data } = props
  const vm = useGraphExperienceVMContext()
  const card = vm.factorCards[id]
  const rawLabel = (data as Record<string, unknown> | undefined)?.label
  const label = card?.label ?? (typeof rawLabel === 'string' && rawLabel ? rawLabel : 'Untitled')

  const pill = card?.flag != null && (
    <span
      data-testid="vnext-factor-flag"
      className={`mt-1.5 inline-block rounded-full border bg-transparent px-2 py-0.5 text-xs text-text-body ${FLAG_BORDER[card.flag]}`}
    >
      {FACTOR_FLAG_LABELS[card.flag]}
    </span>
  )

  return (
    <NodeCardShell nodeId={id} nodeKind="factor" label={label} testid={`vnext-factor-${id}`}>
      {card?.valueDisplay != null && (
        <p data-testid="vnext-factor-value" className="mt-1 text-xs text-text-body">
          {card.valueDisplay}
        </p>
      )}
      {card?.flag != null &&
        (card.flagIsResultDerived ? (
          <ResultDimBlock dim={card.isStaleResult} markerTestId="vnext-factor-stale-marker">
            {pill}
          </ResultDimBlock>
        ) : (
          pill
        ))}
    </NodeCardShell>
  )
}

export const FactorNodeVNext = memo(FactorNodeVNextInner)

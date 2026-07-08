// Option card — the Stage-2 representative node type.
//
// Renders ONLY what the OptionCardVM carries (honesty gates live in
// buildOptionCard, UI-SEM-072/073). One labelled probability maximum
// ("Wins in N% of scenarios"); at most one status pill; stale results render
// dimmed with the explicit "From a previous run" marker (UI-SEM-076 — the
// marker is never dimmed, amendment A7).

import { memo } from 'react'
import { type NodeProps } from '@xyflow/react'
import { NodeShapeIndicator } from '../../canvas/nodes/NodeShapeIndicator'
import { nodeColors } from '../../canvas/nodes/colors'
import { useGraphExperienceVMContext } from '../vm/useGraphExperienceVM'
import { useViewLevelStore } from '../state/viewLevelStore'
import { useVNextSelection } from '../mode/contexts'
import { STALE_CLAIM_MARKER } from '../vm/strings'
import { VNextHandles } from './BasicNodeVNext'
import type { OptionCardStatus } from '../vm/types'

const STATUS_PILL: Record<Exclude<OptionCardStatus, 'behind'>, { label: string; border: string }> = {
  leading: { label: 'Leading', border: 'border-success/30' },
  close_second: { label: 'Close second', border: 'border-info/30' },
  baseline: { label: 'Baseline', border: 'border-panel-border' },
}

function OptionNodeVNextInner(props: NodeProps) {
  const { id, data } = props
  const vm = useGraphExperienceVMContext()
  const level = useViewLevelStore((s) => s.level)
  const { selectedNodeId } = useVNextSelection()

  const card = vm.optionCards[id]
  const colors = nodeColors.option
  const rawLabel = (data as Record<string, unknown> | undefined)?.label
  const label = card?.label ?? (typeof rawLabel === 'string' && rawLabel ? rawLabel : 'Untitled')
  const isSelected = selectedNodeId === id

  const pill = card?.status && card.status !== 'behind' ? STATUS_PILL[card.status] : null
  const hasResultContent = card != null && (card.winDisplay != null || card.status != null || card.keyReason != null)
  const dimResults = card?.isStaleResult === true

  return (
    <div
      data-testid={`vnext-option-${id}`}
      className={`w-52 rounded-lg border-2 px-3 py-2 shadow-sm ${colors.bg} ${colors.border} ${isSelected ? colors.selected : ''}`}
    >
      <div className="flex items-center gap-2">
        <NodeShapeIndicator nodeKind="option" />
        <span className="text-sm font-medium text-text-body break-words">{label}</span>
      </div>

      {hasResultContent && (
        <>
          <div className={dimResults ? 'opacity-60' : undefined}>
            {pill && (
              <span
                data-testid="vnext-option-status-pill"
                className={`mt-1.5 inline-block rounded-full border bg-transparent px-2 py-0.5 text-xs text-text-body ${pill.border}`}
              >
                {pill.label}
              </span>
            )}
            {card?.winDisplay != null && (
              <p data-testid="vnext-option-win" className="mt-1 text-xs text-text-body">
                Wins in {card.winDisplay} of scenarios
              </p>
            )}
            {card?.keyReason != null && (
              <p data-testid="vnext-option-reason" className="mt-1 text-xs text-text-light">
                Behind: {card.keyReason}
              </p>
            )}
            {level === 'detailed' && card?.gapToLeaderPp != null && (
              <p data-testid="vnext-option-gap" className="mt-1 text-xs text-text-light">
                {card.gapToLeaderPp}pp behind the leader
              </p>
            )}
            {level === 'detailed' && card?.goalFitDisplay != null && (
              <p data-testid="vnext-option-goalfit" className="mt-1 text-xs text-text-light">
                Reaches the target in {card.goalFitDisplay} of scenarios
              </p>
            )}
          </div>
          {dimResults && (
            <p data-testid="vnext-option-stale-marker" className="mt-1 text-xs italic text-text-light">
              {STALE_CLAIM_MARKER}
            </p>
          )}
        </>
      )}

      <VNextHandles />
    </div>
  )
}

export const OptionNodeVNext = memo(OptionNodeVNextInner)

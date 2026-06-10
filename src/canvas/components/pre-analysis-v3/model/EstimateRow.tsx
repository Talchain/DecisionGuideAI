/**
 * EstimateRow — one influence-ranked estimate: name, display-scale value,
 * provenance pill, positional priority label and the calibrate affordance.
 */

import { memo } from 'react'
import { Check } from 'lucide-react'
import Tooltip from '../../../../components/Tooltip'
import { typography } from '../../../../styles/typography'
import { NodeShapeIndicator } from '../../../nodes/NodeShapeIndicator'
import { Pill } from '../../pre-analysis/primitives/Pill'
import { ATTRIBUTION_COPY, RANK_LABEL_COPY } from '../constants'
import { PanelIconButton } from '../ui/PanelIconButton'
import type { EstimateRowModel } from '../types'

interface EstimateRowProps {
  row: EstimateRowModel
  expanded: boolean
  onToggle: (nodeId: string) => void
}

export const EstimateRow = memo(function EstimateRow({ row, expanded, onToggle }: EstimateRowProps) {
  const pill = row.reviewed ? (
    <Pill variant="success" size="small">{ATTRIBUTION_COPY.checkedByYou}</Pill>
  ) : row.needsValue ? (
    <Pill variant="warning" size="small">{ATTRIBUTION_COPY.needsValue}</Pill>
  ) : (
    <Pill variant="default" size="small">{ATTRIBUTION_COPY.olumiEstimate}</Pill>
  )

  return (
    <div
      className="grid min-h-[30px] grid-cols-[1fr_auto] items-center gap-2"
      data-testid={`pre-analysis-v3-estimate-${row.nodeId}`}
      data-reviewed={row.reviewed || undefined}
      id={`pre-analysis-v3-estimate-${row.nodeId}`}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        <NodeShapeIndicator nodeKind="factor" size={10} className="flex-none" />
        <span className={`${typography.panelBody} truncate text-text-body`}>{row.label}</span>
        {row.displayText && (
          <span className={`${typography.panelMeta} flex-none text-text-light`}>{row.displayText}</span>
        )}
        {pill}
      </span>
      <span className="flex items-center gap-1.5">
        <span className={`${typography.panelMeta} whitespace-nowrap text-text-light`}>
          {RANK_LABEL_COPY[row.rankLabel]}
        </span>
        {row.reviewed ? (
          <span className="inline-flex h-7 w-7 items-center justify-center" aria-hidden>
            <Check className="h-3.5 w-3.5 text-success" />
          </span>
        ) : (
          <Tooltip content="Check this estimate: replace it with your judgement" delay={300}>
            <PanelIconButton
              variant="ghost"
              aria-label={`Check ${row.label}`}
              aria-expanded={expanded}
              onClick={() => onToggle(row.nodeId)}
            >
              <Check className="h-3.5 w-3.5" aria-hidden />
            </PanelIconButton>
          </Tooltip>
        )}
      </span>
    </div>
  )
})

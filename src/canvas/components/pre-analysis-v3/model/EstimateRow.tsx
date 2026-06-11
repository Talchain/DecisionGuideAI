/**
 * EstimateRow — one influence-ranked estimate, two-line layout:
 *   line 1: factor name, full width, wraps (never truncated to fragments);
 *   line 2: value · provenance pill · priority label.
 *
 * Action column (no false affordances):
 *   - reviewed       → quiet success check (no button)
 *   - needs a value  → "Add value" affordance (opens the editor; no check tick)
 *   - otherwise      → check affordance (opens the editor)
 */

import { memo } from 'react'
import { Check, Plus } from 'lucide-react'
import Tooltip from '../../../../components/Tooltip'
import { typography, typo } from '../../../../styles/typography'
import { NodeShapeIndicator } from '../../../nodes/NodeShapeIndicator'
import { Pill } from '../../pre-analysis/primitives/Pill'
import { ATTRIBUTION_COPY, FIELD_FEEDBACK_COPY, RANK_LABEL_COPY } from '../constants'
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

  const action = row.reviewed ? (
    <span className="inline-flex h-7 w-7 items-center justify-center" aria-hidden>
      <Check className="h-3.5 w-3.5 text-success" />
    </span>
  ) : row.needsValue ? (
    <button
      type="button"
      onClick={() => onToggle(row.nodeId)}
      aria-expanded={expanded}
      aria-label={`Add a value for ${row.label}`}
      className={typo(
        'panelMeta',
        'inline-flex items-center gap-1 whitespace-nowrap rounded-full border border-panel-border bg-transparent px-2 py-1 text-text-body outline-none transition-colors hover:bg-panel-hover focus-visible:bg-panel-hover focus-visible:ring-2 focus-visible:ring-info/40',
      )}
      data-testid={`pre-analysis-v3-add-value-${row.nodeId}`}
    >
      <Plus className="h-3 w-3" aria-hidden />
      {FIELD_FEEDBACK_COPY.addValue}
    </button>
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
  )

  return (
    <div
      className="grid grid-cols-[16px_1fr_auto] items-start gap-2 py-1"
      data-testid={`pre-analysis-v3-estimate-${row.nodeId}`}
      data-reviewed={row.reviewed || undefined}
      id={`pre-analysis-v3-estimate-${row.nodeId}`}
    >
      <span className="mt-1 flex justify-center">
        <NodeShapeIndicator nodeKind="factor" size={10} />
      </span>
      <span className="min-w-0">
        <span className={`${typography.panelBody} block text-text-body`}>{row.label}</span>
        <span className={`${typography.panelMeta} mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-text-light`}>
          {row.displayText && <span>{row.displayText}</span>}
          {pill}
          {/* Priority is a to-do label; a checked row's pill already says done. */}
          {!row.reviewed && (
            <span className="whitespace-nowrap">{RANK_LABEL_COPY[row.rankLabel]}</span>
          )}
        </span>
      </span>
      <span className="flex items-center">{action}</span>
    </div>
  )
})

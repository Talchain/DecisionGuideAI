/**
 * MissingData — Subgroup 3: Factors with no observed data.
 * Two-row layout (P1-1): factor name + "No data" + influence bar on row 1;
 * icon-only "Set value" (Pencil) at 44px touch height on row 2.
 * Technique hint kept as plain text. One sparkle (DiscussWithAiButton) per row.
 */

import { Pencil } from 'lucide-react'
import { SubgroupDivider } from '../primitives/SubgroupDivider'
import Tooltip from '../../../../components/Tooltip'
import { typography } from '@/styles/typography'
import type { ImprovementItem } from '../hooks/usePreAnalysisData'
import { DiscussWithAiButton } from '../DiscussWithAiButton'

interface MissingDataProps {
  items: ImprovementItem[]
  onFocusNode?: (nodeId: string) => void
  onSetValue?: (nodeId: string) => void
  onSendMessage?: (text: string) => void
  factorInfluenceMap?: Map<string, number>
  onHoverEnter?: (type: 'node' | 'edge', id: string) => void
  onHoverLeave?: () => void
}

function getTechniqueHint(label: string): { text: string; tooltip: string } {
  if (/rate|churn/i.test(label)) {
    return {
      text: 'Try: reference class forecasting',
      tooltip: 'Estimate by finding similar situations and using their outcomes as a baseline',
    }
  }
  return {
    text: 'Try: outside view technique',
    tooltip: 'Step back from the specifics and consider base rates from comparable cases',
  }
}

export function MissingData({
  items,
  onFocusNode,
  onSetValue,
  factorInfluenceMap,
  onHoverEnter,
  onHoverLeave,
}: MissingDataProps) {
  if (items.length === 0) return null

  return (
    <div className="space-y-1">
      <SubgroupDivider label={`Missing data (${items.length})`} />
      {items.map(item => {
        const nodeId = item.focus?.id
        const influence = nodeId ? factorInfluenceMap?.get(nodeId) : undefined
        const influencePct = influence != null ? Math.round(influence * 100) : null
        const technique = getTechniqueHint(item.label)

        return (
          // P1-1: two-row layout. Row 1: name + No data + influence bar.
          // Row 2: icon-only Set value (Pencil) + technique hint text.
          // One sparkle bottom-right (Fix 2/5).
          <div key={item.key} className="relative px-1 py-2 space-y-2 pr-7">
            {/* Row 1 — name (wraps) + No data label + influence bar */}
            <div className="flex items-start gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => nodeId && onFocusNode?.(nodeId)}
                onMouseEnter={() => nodeId && onHoverEnter?.('node', nodeId)}
                onMouseLeave={() => onHoverLeave?.()}
                className={`${typography.panelBody} text-info hover:underline cursor-pointer text-left flex-1 min-w-[12rem] break-words`}
              >
                {item.label}
              </button>
              <span className={`${typography.panelMeta} text-text-light shrink-0`}>No data</span>
              {influencePct != null && (
                <div className="flex items-center gap-1 shrink-0" style={{ width: 60 }}>
                  <div className="flex-1 h-1 bg-panel-border rounded-full overflow-hidden">
                    <div
                      className="h-full bg-danger rounded-full"
                      style={{ width: `${Math.min(100, influencePct)}%` }}
                    />
                  </div>
                  <span className={`${typography.panelMeta} text-text-light`}>{influencePct}%</span>
                </div>
              )}
            </div>
            {/* Row 2 — icon-only Set value + technique hint */}
            <div className="flex items-center gap-2 flex-wrap">
              <Tooltip delay={200} content="Set value">
                <button
                  type="button"
                  onClick={() => nodeId && onSetValue?.(nodeId)}
                  className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] rounded-full border border-info/30 text-info bg-transparent hover:bg-panel-hover cursor-pointer"
                  aria-label={`Set value for ${item.label}`}
                >
                  <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </Tooltip>
              <Tooltip delay={300} content={technique.tooltip}>
                <span className={`${typography.panelMeta} text-text-light cursor-help`}>
                  {technique.text}
                </span>
              </Tooltip>
            </div>
            {/* One sparkle — bottom-right of the row */}
            <div className="absolute bottom-1 right-1">
              <DiscussWithAiButton element={{ kind: 'factor', label: item.label }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

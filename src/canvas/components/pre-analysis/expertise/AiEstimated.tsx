/**
 * AiEstimated — Subgroup 2: Factors estimated by AI, needing user verification.
 * Two-row layout (P1-1): factor name (wraps) + value + Estimated pill + influence bar
 * on row 1; icon-only action buttons at 44px touch height on row 2.
 * One sparkle (DiscussWithAiButton) anchored bottom-right per row (Fix 2/5).
 */

import { Check, Pencil } from 'lucide-react'
import { Pill } from '../primitives'
import { SubgroupDivider } from '../primitives/SubgroupDivider'
import { typography } from '@/styles/typography'
import type { ImprovementItem } from '../hooks/usePreAnalysisData'
import { formatValueWithUnit } from '@/canvas/utils/formatValueWithUnit'
import { DiscussWithAiButton } from '../DiscussWithAiButton'
import Tooltip from '../../../../components/Tooltip'

interface AiEstimatedProps {
  items: ImprovementItem[]
  onFocusNode?: (nodeId: string) => void
  onConfirm?: (nodeId: string) => void
  onEdit?: (nodeId: string) => void
  onSendMessage?: (text: string) => void
  factorInfluenceMap?: Map<string, number>
  onHoverEnter?: (type: 'node' | 'edge', id: string) => void
  onHoverLeave?: () => void
}

export function AiEstimated({
  items,
  onFocusNode,
  onConfirm,
  onEdit,
  factorInfluenceMap,
  onHoverEnter,
  onHoverLeave,
}: AiEstimatedProps) {
  if (items.length === 0) return null

  return (
    <div className="space-y-1">
      <SubgroupDivider label={`Estimated (${items.length})`} />
      {items.map(item => {
        const nodeId = item.focus?.id
        const influence = nodeId ? factorInfluenceMap?.get(nodeId) : undefined
        const influencePct = influence != null ? Math.round(influence * 100) : null

        return (
          // P1-1: two-row layout. Row 1: name + value + pill + influence bar.
          // Row 2: icon-only actions at 44px touch height. One sparkle bottom-right.
          <div key={item.key} className="relative px-1 py-2 space-y-2 pr-7">
            {/* Row 1 */}
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
              {item.rawValue != null && item.detail !== 'Not set' && (() => {
                const num = typeof item.rawValue === 'number' ? item.rawValue : Number(item.rawValue)
                // Uses shared formatValueWithUnit: placeholder units (scale, score, etc.) with
                // 0–1 values render as qualitative labels; other placeholder values render bare
                // numbers; currency prefixes, percent suffixes, and thousand separators applied.
                const display = formatValueWithUnit(num, item.unit)
                return (
                  <button
                    type="button"
                    onClick={() => nodeId && onEdit?.(nodeId)}
                    className={`${typography.panelBody} text-text-body hover:text-info cursor-pointer shrink-0`}
                  >
                    {display}
                  </button>
                )
              })()}
              <Pill size="small" variant="warning">Estimated</Pill>
              {influencePct != null && (
                <div className="flex items-center gap-1 shrink-0" style={{ width: 60 }}>
                  <div className="flex-1 h-1 bg-panel-border rounded-full overflow-hidden">
                    <div
                      className="h-full bg-warning rounded-full"
                      style={{ width: `${Math.min(100, influencePct)}%` }}
                    />
                  </div>
                  <span className={`${typography.panelMeta} text-text-light`}>{influencePct}%</span>
                </div>
              )}
            </div>
            {/* Row 2 — icon-only actions, 44px touch targets */}
            <div className="flex items-center gap-2">
              <Tooltip delay={200} content="Confirm value">
                <button
                  type="button"
                  onClick={() => nodeId && onConfirm?.(nodeId)}
                  className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] text-success hover:text-success/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info/40 cursor-pointer"
                  aria-label={`Confirm value for ${item.label}`}
                >
                  <Check className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </Tooltip>
              <Tooltip delay={200} content="Edit value">
                <button
                  type="button"
                  onClick={() => nodeId && onEdit?.(nodeId)}
                  className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] text-text-light hover:text-text-body focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-info/40 cursor-pointer"
                  aria-label={`Edit value for ${item.label}`}
                >
                  <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
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

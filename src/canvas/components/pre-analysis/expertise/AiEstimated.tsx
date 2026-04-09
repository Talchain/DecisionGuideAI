/**
 * AiEstimated — Subgroup 2: Factors estimated by AI, needing user verification.
 * Factor name (clickable), value (inline edit), "Estimated" pill, influence bar, confirm/query/edit.
 */

import { useCallback } from 'react'
import { Check } from 'lucide-react'
import { Pill } from '../primitives'
import { SubgroupDivider } from '../primitives/SubgroupDivider'
import { typography } from '@/styles/typography'
import { useGuidanceStore } from '@/canvas/stores/guidanceStore'
import type { ImprovementItem } from '../hooks/usePreAnalysisData'
import { classifyUnit } from '@/canvas/utils/labelUtils'

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
  onSendMessage,
  factorInfluenceMap,
  onHoverEnter,
  onHoverLeave,
}: AiEstimatedProps) {
  const handleResearch = useCallback((nodeId: string | undefined, label: string) => {
    const dispatch = useGuidanceStore.getState()._dispatchAction
    if (dispatch) {
      dispatch({
        label: `Research ${label}`,
        message: `Can you research ${label} and suggest a reasonable estimate with sources?`,
        source: 'pre_analysis',
        ...(nodeId ? { parameters: { target_id: nodeId, target_label: label } } : {}),
      })
    } else {
      onSendMessage?.(`Can you research ${label} and suggest a reasonable estimate with sources?`)
    }
  }, [onSendMessage])
  if (items.length === 0) return null

  return (
    <div className="space-y-1">
      <SubgroupDivider label={`Estimated (${items.length})`} />
      {items.map(item => {
        const nodeId = item.focus?.id
        const influence = nodeId ? factorInfluenceMap?.get(nodeId) : undefined
        const influencePct = influence != null ? Math.round(influence * 100) : null

        return (
          // P1-1: two-row layout for readability.
          // Row 1: factor name (wraps, never truncates) + value + Estimated pill + small influence bar.
          // Row 2: action pills at 44px touch height with 8px gap.
          <div key={item.key} className="px-1 py-2 space-y-2">
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
              {item.rawValue != null && (
                <button
                  type="button"
                  onClick={() => nodeId && onEdit?.(nodeId)}
                  className={`${typography.panelBody} text-text-body hover:text-info cursor-pointer shrink-0`}
                >
                  {item.unit && classifyUnit(item.unit).kind !== 'placeholder'
                    ? `${item.rawValue} ${item.unit}`
                    : String(item.rawValue)}
                </button>
              )}
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
            {/* Row 2 — actions with 44px touch height */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => nodeId && onConfirm?.(nodeId)}
                className={`${typography.panelMeta} text-success border border-success/30 rounded-full inline-flex items-center justify-center min-h-[44px] min-w-[44px] px-3 bg-transparent hover:bg-panel-hover cursor-pointer`}
                aria-label={`Confirm value for ${item.label}`}
                title="Confirm value"
              >
                <Check className="w-4 h-4" aria-hidden="true" />
              </button>
              {(onSendMessage || useGuidanceStore.getState()._dispatchAction) && (
                <button
                  type="button"
                  onClick={() => handleResearch(nodeId, item.label)}
                  className={`${typography.panelMeta} text-info border border-info/30 rounded-full inline-flex items-center justify-center min-h-[44px] px-3 bg-transparent hover:bg-panel-hover cursor-pointer`}
                  aria-label={`Ask AI to research ${item.label}`}
                  title="Ask AI to research"
                >
                  Ask AI
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

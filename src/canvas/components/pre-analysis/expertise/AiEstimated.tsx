/**
 * AiEstimated — Subgroup 2: Factors estimated by AI, needing user verification.
 * Factor name (clickable), value (inline edit), "Estimated" pill, influence bar, confirm/query/edit.
 */

import { Pill } from '../primitives'
import { SubgroupDivider } from '../primitives/SubgroupDivider'
import { typography } from '@/styles/typography'
import type { ImprovementItem } from '../hooks/usePreAnalysisData'

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
  if (items.length === 0) return null

  return (
    <div className="space-y-1">
      <SubgroupDivider label={`Estimated by AI (${items.length})`} />
      {items.map(item => {
        const nodeId = item.focus?.id
        const influence = nodeId ? factorInfluenceMap?.get(nodeId) : undefined
        const influencePct = influence != null ? Math.round(influence * 100) : null

        return (
          <div key={item.key} className="flex items-center gap-2 py-1 px-1">
            <button
              type="button"
              onClick={() => nodeId && onFocusNode?.(nodeId)}
              onMouseEnter={() => nodeId && onHoverEnter?.('node', nodeId)}
              onMouseLeave={() => onHoverLeave?.()}
              className={`${typography.panelBody} text-info hover:underline cursor-pointer text-left truncate flex-1 min-w-0`}
            >
              {item.label}
            </button>
            {item.rawValue != null && (
              <button
                type="button"
                onClick={() => nodeId && onEdit?.(nodeId)}
                className={`${typography.panelMeta} text-text-body hover:text-info cursor-pointer shrink-0`}
              >
                {item.unit ? `${item.rawValue} ${item.unit}` : String(item.rawValue)}
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
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => nodeId && onConfirm?.(nodeId)}
                className={`${typography.panelMeta} text-success border border-success/30 rounded-full px-1.5 py-0.5 bg-transparent hover:bg-panel-hover cursor-pointer`}
                title="Confirm value"
              >
                ✓
              </button>
              {onSendMessage && (
                <button
                  type="button"
                  onClick={() => onSendMessage(`Can you research ${item.label} and suggest a reasonable estimate with sources?`)}
                  className={`${typography.panelMeta} text-info border border-info/30 rounded-full px-1.5 py-0.5 bg-transparent hover:bg-panel-hover cursor-pointer`}
                  title="Ask AI to research"
                >
                  ?
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

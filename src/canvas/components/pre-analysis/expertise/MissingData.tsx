/**
 * MissingData — Subgroup 3: Factors with no observed data.
 * Factor name, "No data" greyed, influence bar, "Set value" + "Ask AI to research" CTAs.
 */

import { useCallback } from 'react'
import { SubgroupDivider } from '../primitives/SubgroupDivider'
import Tooltip from '../../../../components/Tooltip'
import { typography } from '@/styles/typography'
import { useGuidanceStore } from '@/canvas/stores/guidanceStore'
import type { ImprovementItem } from '../hooks/usePreAnalysisData'

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
  onSendMessage,
  factorInfluenceMap,
  onHoverEnter,
  onHoverLeave,
}: MissingDataProps) {
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
      <SubgroupDivider label={`Missing data (${items.length})`} />
      {items.map(item => {
        const nodeId = item.focus?.id
        const influence = nodeId ? factorInfluenceMap?.get(nodeId) : undefined
        const influencePct = influence != null ? Math.round(influence * 100) : null
        const technique = getTechniqueHint(item.label)

        return (
          <div key={item.key} className="px-1 py-1.5 space-y-1">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => nodeId && onFocusNode?.(nodeId)}
                onMouseEnter={() => nodeId && onHoverEnter?.('node', nodeId)}
                onMouseLeave={() => onHoverLeave?.()}
                className={`${typography.panelBody} text-info hover:underline cursor-pointer text-left truncate flex-1 min-w-0`}
                title={item.label}
              >
                {item.label}
              </button>
              <span className={`${typography.panelMeta} text-text-light`}>No data</span>
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
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => nodeId && onSetValue?.(nodeId)}
                className={`${typography.panelMeta} text-info border border-info/30 rounded-full px-2 py-0.5 bg-transparent hover:bg-panel-hover cursor-pointer`}
              >
                Set value
              </button>
              {(onSendMessage || useGuidanceStore.getState()._dispatchAction) && (
                <button
                  type="button"
                  onClick={() => handleResearch(nodeId, item.label)}
                  className={`${typography.panelMeta} text-info border border-info/30 rounded-full px-2 py-0.5 bg-transparent hover:bg-panel-hover cursor-pointer`}
                >
                  Ask AI to research
                </button>
              )}
              <Tooltip delay={300} content={technique.tooltip}>
                <span className={`${typography.panelMeta} text-text-light cursor-help`}>
                  {technique.text}
                </span>
              </Tooltip>
            </div>
          </div>
        )
      })}
    </div>
  )
}

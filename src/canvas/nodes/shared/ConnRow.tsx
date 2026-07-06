/**
 * ConnRow — compact connection row rendered inside canvas node cards.
 * Shows: [NodeShapeIndicator 9px] [node name link] ["N% conf." right-aligned]
 * Click opens the edge inspector for that specific edge.
 *
 * Audit §8 P0-4 (strength vs confidence): the percentage here is
 * beliefExists/exists_probability — CONFIDENCE the link exists — while
 * EdgePills' percentage is link STRENGTH. Both used the same bare "%"
 * format, silently switching meaning between pre- and post-analysis. The
 * visible "conf." qualifier (+ title/aria) makes this number
 * self-identifying next to the strength pills.
 */
import { useCallback } from 'react'
import { NodeShapeIndicator } from '../NodeShapeIndicator'
import { useCanvasStore } from '../../store'
import { typography } from '../../../styles/typography'
import type { NodeType } from '../../domain/nodes'

interface ConnRowProps {
  edgeId: string
  nodeKind: NodeType
  label: string
  /** Confidence percentage (0-100), or null when unknown */
  confidencePct: number | null
}

export function ConnRow({ edgeId, nodeKind, label, confidencePct }: ConnRowProps) {
  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    const store = useCanvasStore.getState()
    store.selectEdgeWithoutHistory(edgeId)
    store.setShowInspectorPanel(true)
  }, [edgeId])

  const truncated = label.length > 30 ? `${label.slice(0, 30)}...` : label

  return (
    <div
      role="button"
      tabIndex={0}
      className="flex items-center gap-1 py-0.5 cursor-pointer nodrag nopan hover:bg-panel-hover rounded transition-colors"
      onClick={handleClick}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleClick(e as any) }}
    >
      <NodeShapeIndicator nodeKind={nodeKind} size={9} className="flex-shrink-0" />
      <span className={`${typography.edgeLabel} text-info underline flex-1 truncate`} title={label}>
        {truncated}
      </span>
      {confidencePct != null && (
        <span
          className={`${typography.edgeLabel} text-text-light text-right shrink-0 whitespace-nowrap`}
          title="Confidence the link exists"
          aria-label={`${confidencePct}% confidence the link exists`}
        >
          {confidencePct}% conf.
        </span>
      )}
    </div>
  )
}

/**
 * Plain-text overflow line for capped in-card lists (audit §8 P0-5 —
 * Detailed-view card containment). Rendered after exactly `shown` whole rows;
 * never a max-height clip. Returns null when nothing was truncated.
 */
export function ConnRowsOverflow({ total, shown }: { total: number; shown: number }) {
  if (total <= shown) return null
  return (
    <p className={`${typography.edgeLabel} text-text-light m-0 mt-0.5`}>
      +{total - shown} more in inspector
    </p>
  )
}

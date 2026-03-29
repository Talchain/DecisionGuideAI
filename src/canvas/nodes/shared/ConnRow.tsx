/**
 * ConnRow — compact connection row rendered inside canvas node cards.
 * Shows: [NodeShapeIndicator 9px] [node name link] [confidence % right-aligned]
 * Click opens the edge inspector for that specific edge.
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

  const truncated = label.length > 22 ? `${label.slice(0, 22)}...` : label

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
        <span className={`${typography.edgeLabel} text-text-light w-7 text-right shrink-0`}>
          {confidencePct}%
        </span>
      )}
    </div>
  )
}

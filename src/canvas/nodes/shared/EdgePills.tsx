/**
 * EdgePills — small outlined pills on factor nodes pre-analysis showing
 * connected edge data: entity shape (9px) + strength percentage.
 *
 * Per spec Section 14: 0.5px border, default colour, 10px font, border-radius 10px.
 */
import { useMemo } from 'react'
import { useCanvasStore } from '../../store'
import { NodeShapeIndicator } from '../NodeShapeIndicator'
import { computeSignedMean } from '../../domain/edges'
import type { NodeType } from '../../domain/nodes'

interface EdgePillsProps {
  nodeId: string
}

export function EdgePills({ nodeId }: EdgePillsProps) {
  const edges = useCanvasStore(s => s.edges)
  const nodes = useCanvasStore(s => s.nodes)

  const pills = useMemo(() => {
    const outbound = edges.filter(e => e.source === nodeId)
    return outbound
      .map(e => {
        const targetNode = nodes.find(n => n.id === e.target)
        if (!targetNode) return null
        const kind = (targetNode.type ?? targetNode.data?.type ?? 'factor') as NodeType
        // Only show pills for outcome and risk targets
        if (kind !== 'outcome' && kind !== 'risk') return null
        const strength = Math.abs(computeSignedMean(e.data as Record<string, unknown> | undefined))
        if (strength === 0) return null
        return {
          id: e.id,
          kind,
          pct: Math.round(strength * 100),
        }
      })
      .filter((p): p is NonNullable<typeof p> => p !== null)
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 4)
  }, [edges, nodes, nodeId])

  if (pills.length === 0) return null

  return (
    <div className="flex gap-[3px] mt-1 flex-wrap">
      {pills.map(p => (
        <span
          key={p.id}
          className="inline-flex items-center gap-0.5 text-[10px] font-sans leading-tight px-[5px] py-[1px] rounded-[10px] border-[0.5px] border-panel-border text-text-light"
        >
          <NodeShapeIndicator nodeKind={p.kind} size={9} />
          {p.pct}%
        </span>
      ))}
    </div>
  )
}

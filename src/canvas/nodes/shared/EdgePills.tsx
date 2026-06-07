/**
 * EdgePills — small outlined pills on factor nodes pre-analysis showing each
 * connected outcome/risk: entity shape (9px) + direction (raises/lowers) +
 * strength percentage + the target's label.
 *
 * The target label is read verbatim from the payload and is never inferred,
 * derived, abbreviated, or substituted with the id. A pill is only rendered
 * when its target has a non-empty label, so we never show a bare "65%" with
 * no decode path (brief scope 1); a missing label degrades gracefully to an
 * omitted pill rather than throwing (A2). Capped at 4.
 *
 * Per spec Section 14: 0.5px border, default colour, 10px font, border-radius 10px.
 */
import { useMemo } from 'react'
import { ArrowUp, ArrowDown } from 'lucide-react'
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
        // Target label read verbatim from the payload — never inferred, derived,
        // or substituted. Absent label ⇒ omit the pill (no bare "65%").
        const rawLabel = targetNode.data?.label
        const label = typeof rawLabel === 'string' ? rawLabel.trim() : ''
        if (!label) return null
        // Retain the sign so the pill can show direction (raises / lowers).
        const signed = computeSignedMean(e.data as Record<string, unknown> | undefined)
        const strength = Math.abs(signed)
        if (strength === 0) return null
        return {
          id: e.id,
          kind,
          label,
          direction: signed >= 0 ? ('up' as const) : ('down' as const),
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
          {/* Direction for screen readers — the arrow glyph below is aria-hidden,
              so without this the pill would announce only the % and label.
              Uses the approved "Raises"/"Lowers" vocabulary. `sr-only` is out of
              flow, so the visible pill layout is unchanged. */}
          <span className="sr-only">{p.direction === 'up' ? 'Raises' : 'Lowers'}</span>
          <NodeShapeIndicator nodeKind={p.kind} size={9} />
          {p.direction === 'up' ? (
            <ArrowUp size={9} className="text-success shrink-0" aria-hidden="true" />
          ) : (
            <ArrowDown size={9} className="text-danger shrink-0" aria-hidden="true" />
          )}
          {p.pct}%
          <span>{p.label}</span>
        </span>
      ))}
    </div>
  )
}

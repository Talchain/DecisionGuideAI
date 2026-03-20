/**
 * KeyRelationships — Quick-select edge strength for top causal edges.
 *
 * Shown within the Review assumptions area. Top 3 edges by connectivity
 * (in-degree + out-degree). Users can set qualitative strength (Weakly,
 * Moderately, Strongly) without opening the edge inspector.
 */

import { memo, useCallback } from 'react'
import type { Edge, Node } from '@xyflow/react'
import { typography } from '@/styles/typography'
import Tooltip from '../../../components/Tooltip'

interface KeyRelationshipsProps {
  edges: Edge[]
  nodes: Node[]
  onFocusEdge?: (edgeId: string) => void
  onHoverEnter?: (type: 'node' | 'edge', id: string) => void
  onHoverLeave?: () => void
  onUpdateEdgeStrength?: (edgeId: string, signedMean: number) => void
}

interface EdgeRow {
  edgeId: string
  sourceLabel: string
  targetLabel: string
  currentBand: 'weak' | 'moderate' | 'strong'
  direction: 'positive' | 'negative'
  weight: number
  basis?: string
}

const STRENGTH_BANDS = [
  { key: 'weak' as const, label: 'Weakly', value: 0.15 },
  { key: 'moderate' as const, label: 'Moderately', value: 0.40 },
  { key: 'strong' as const, label: 'Strongly', value: 0.70 },
]

function getBand(weight: number): 'weak' | 'moderate' | 'strong' {
  if (weight < 0.25) return 'weak'
  if (weight < 0.60) return 'moderate'
  return 'strong'
}

/** Derive top 3 edges by connectivity (in-degree + out-degree) */
function deriveTopEdges(edges: Edge[], nodes: Node[]): EdgeRow[] {
  if (!edges || !nodes || edges.length === 0) return []
  // Only include causal edges with a set direction
  const causalEdges = edges.filter(e => {
    const data = e.data as Record<string, unknown> | undefined
    const dir = data?.direction ?? data?.effect_direction
    return dir === 'positive' || dir === 'negative'
  })

  if (causalEdges.length === 0) return []

  // Score by connectivity (in-degree + out-degree per node, sum for edge endpoints)
  const degree = new Map<string, number>()
  for (const e of edges) {
    degree.set(e.source, (degree.get(e.source) ?? 0) + 1)
    degree.set(e.target, (degree.get(e.target) ?? 0) + 1)
  }

  const nodeMap = new Map(nodes.map(n => [n.id, n]))

  const scored = causalEdges.map(e => {
    const data = e.data as Record<string, unknown> | undefined
    const weight = typeof data?.weight === 'number' ? data.weight : 0.5
    const direction = (data?.direction ?? data?.effect_direction ?? 'positive') as 'positive' | 'negative'
    const sourceNode = nodeMap.get(e.source)
    const targetNode = nodeMap.get(e.target)
    const sourceLabel = String((sourceNode?.data as Record<string, unknown>)?.label ?? e.source)
    const targetLabel = String((targetNode?.data as Record<string, unknown>)?.label ?? e.target)
    const basis = (data?.validation as Record<string, unknown>)?.pass2
      ? String(((data?.validation as Record<string, unknown>)?.pass2 as Record<string, unknown>)?.basis ?? '')
      : undefined

    const score = (degree.get(e.source) ?? 0) + (degree.get(e.target) ?? 0)

    return {
      edgeId: e.id,
      sourceLabel,
      targetLabel,
      currentBand: getBand(weight),
      direction,
      weight,
      basis: basis || undefined,
      score,
    }
  })

  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, 3)
}

export const KeyRelationships = memo(function KeyRelationships({
  edges,
  nodes,
  onFocusEdge,
  onHoverEnter,
  onHoverLeave,
  onUpdateEdgeStrength,
}: KeyRelationshipsProps) {
  const topEdges = deriveTopEdges(edges, nodes)

  const handleStrengthSelect = useCallback((edgeId: string, value: number) => {
    onUpdateEdgeStrength?.(edgeId, value)
  }, [onUpdateEdgeStrength])

  if (topEdges.length === 0) return null

  return (
    <div className="space-y-2">
      {/* Subgroup divider */}
      <div className="flex items-center gap-2 pt-1">
        <span className={`${typography.panelMeta} text-text-light whitespace-nowrap`}>
          Key relationships ({topEdges.length})
        </span>
        <div className="flex-1 h-px bg-panel-border" />
      </div>

      {topEdges.map(row => (
        <div
          key={row.edgeId}
          className="rounded-md px-1 py-1 -mx-1"
          onMouseEnter={() => onHoverEnter?.('edge', row.edgeId)}
          onMouseLeave={() => onHoverLeave?.()}
        >
          {/* Edge label */}
          <button
            type="button"
            onClick={() => onFocusEdge?.(row.edgeId)}
            className={`${typography.panelBody} text-info hover:underline cursor-pointer text-left`}
          >
            {row.sourceLabel} → {row.targetLabel}
          </button>

          {/* Strength quick-select */}
          <Tooltip content="How strongly does this affect the outcome? Your expertise matters here">
            <div className="flex items-center gap-1.5 mt-1">
              {STRENGTH_BANDS.map(band => (
                <button
                  key={band.key}
                  type="button"
                  onClick={() => handleStrengthSelect(row.edgeId, band.value)}
                  className={`${typography.panelMeta} px-2.5 py-0.5 rounded-full border transition-colors ${
                    row.currentBand === band.key
                      ? 'bg-info/10 border-info/50 text-info'
                      : 'bg-transparent border-panel-border text-text-light hover:border-info/30 hover:text-text-body'
                  }`}
                >
                  {band.label}
                </button>
              ))}
            </div>
          </Tooltip>

          {/* Basis line */}
          {row.basis && (
            <p className={`${typography.panelMeta} text-text-light mt-0.5`}>
              Based on {row.basis}
            </p>
          )}
        </div>
      ))}
    </div>
  )
})

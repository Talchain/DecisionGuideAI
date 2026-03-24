/**
 * KeyRelationships — Quick-select edge strength for top causal edges.
 *
 * Shown within the Review assumptions area. Top 3 edges by connectivity
 * (in-degree + out-degree). Users can set qualitative strength (Weakly,
 * Moderately, Strongly) without opening the edge inspector.
 */

import { memo, useCallback, useState } from 'react'
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
  /** Edge influence map for sensitivity-based sorting (Task 4c) */
  edgeInfluenceMap?: Map<string, number>
}

interface EdgeRow {
  edgeId: string
  sourceLabel: string
  targetLabel: string
  currentBand: 'weak' | 'moderate' | 'strong'
  direction: 'positive' | 'negative'
  weight: number
  basis?: string
  strengthStd?: number
  beliefExists?: number
}

/** Confidence band from strength std */
function getConfidenceBand(std: number | undefined): { label: string; color: string } | null {
  if (std == null) return null
  if (std < 0.10) return { label: 'High confidence', color: 'bg-success' }
  if (std < 0.20) return { label: 'Moderate confidence', color: 'bg-warning' }
  return { label: 'Low confidence', color: 'bg-danger' }
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

/** Map CEE basis codes to human-readable labels */
const BASIS_LABELS: Record<string, string> = {
  brief_explicit: 'Based on your brief',
  structural_inference: 'Inferred from model structure',
  domain_prior: 'Based on general domain knowledge',
  weak_guess: 'Uncertain, your input would help',
}

/** Derive top 3 edges by influence (when available) or connectivity (in-degree + out-degree) */
function deriveTopEdges(edges: Edge[], nodes: Node[], edgeInfluenceMap?: Map<string, number>): EdgeRow[] {
  if (!edges || !nodes || edges.length === 0) return []

  const nodeMap = new Map(nodes.map(n => [n.id, n]))

  // Only include causal edges with a set direction; exclude decision→option edges
  const causalEdges = edges.filter(e => {
    const data = e.data as Record<string, unknown> | undefined
    const dir = data?.direction ?? data?.effect_direction
    if (dir !== 'positive' && dir !== 'negative') return false
    // Exclude structural decision→option edges
    const sourceType = (nodeMap.get(e.source)?.data as Record<string, unknown>)?.kind ?? nodeMap.get(e.source)?.type
    const targetType = (nodeMap.get(e.target)?.data as Record<string, unknown>)?.kind ?? nodeMap.get(e.target)?.type
    if (sourceType === 'decision' && targetType === 'option') return false
    return true
  })

  if (causalEdges.length === 0) return []

  // Score by connectivity (in-degree + out-degree per node, sum for edge endpoints)
  const degree = new Map<string, number>()
  for (const e of edges) {
    degree.set(e.source, (degree.get(e.source) ?? 0) + 1)
    degree.set(e.target, (degree.get(e.target) ?? 0) + 1)
  }

  const scored = causalEdges.map(e => {
    const data = e.data as Record<string, unknown> | undefined
    const weight = typeof data?.weight === 'number' ? data.weight : 0.5
    const direction = (data?.direction ?? data?.effect_direction ?? 'positive') as 'positive' | 'negative'
    const sourceNode = nodeMap.get(e.source)
    const targetNode = nodeMap.get(e.target)
    const sourceLabel = String((sourceNode?.data as Record<string, unknown>)?.label ?? e.source)
    const targetLabel = String((targetNode?.data as Record<string, unknown>)?.label ?? e.target)
    const basisRaw = ((data?.validation as Record<string, unknown>)?.pass2 as Record<string, unknown> | undefined)?.basis
    const basisKey = basisRaw ? String(basisRaw) : undefined
    const basis = basisKey ? (BASIS_LABELS[basisKey] ?? basisKey) : undefined

    // Canvas store canonical names — CEE ingestion (DraftChat, applyDraftResult, applyPatch)
    // normalises to camelCase before data reaches the store
    const strengthStd = typeof data?.strengthStd === 'number' ? data.strengthStd : undefined
    const beliefExists = typeof data?.beliefExists === 'number' ? data.beliefExists : undefined

    const score = (degree.get(e.source) ?? 0) + (degree.get(e.target) ?? 0)

    return {
      edgeId: e.id,
      sourceLabel,
      targetLabel,
      currentBand: getBand(weight),
      direction,
      weight,
      basis: basis || undefined,
      strengthStd,
      beliefExists,
      score,
    }
  })

  scored.sort((a, b) => {
    // Primary: edge influence from sensitivity data when available
    if (edgeInfluenceMap && edgeInfluenceMap.size > 0) {
      const aInfluence = edgeInfluenceMap.get(a.edgeId) ?? -1
      const bInfluence = edgeInfluenceMap.get(b.edgeId) ?? -1
      if (aInfluence !== bInfluence) return bInfluence - aInfluence
    }
    // Fallback: connectivity score
    return b.score - a.score
  })
  return scored.slice(0, 3)
}

export const KeyRelationships = memo(function KeyRelationships({
  edges,
  nodes,
  onFocusEdge,
  onHoverEnter,
  onHoverLeave,
  onUpdateEdgeStrength,
  edgeInfluenceMap,
}: KeyRelationshipsProps) {
  const topEdges = deriveTopEdges(edges, nodes, edgeInfluenceMap)
  const [expanded, setExpanded] = useState(false)

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

      {!expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className={`${typography.panelMeta} text-info hover:underline cursor-pointer`}
        >
          Show {topEdges.length} key relationship{topEdges.length !== 1 ? 's' : ''}
        </button>
      )}

      {expanded && topEdges.map(row => (
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

          {/* Edge meta: strength + confidence band + exists_probability */}
          {(() => {
            const band = getConfidenceBand(row.strengthStd)
            return (band || row.beliefExists != null) ? (
              <div className={`${typography.panelMeta} text-text-light mt-1 flex items-center gap-1.5 flex-wrap`}>
                <span>{row.direction === 'negative' ? 'Negatively' : 'Positively'} ({row.weight.toFixed(2)})</span>
                {band && (
                  <span className="inline-flex items-center gap-1">
                    <span className={`w-[5px] h-[5px] rounded-full ${band.color} shrink-0`} />
                    {band.label}
                  </span>
                )}
                {row.beliefExists != null && (
                  <Tooltip delay={300} content={`Probability this relationship exists in your decision. ${Math.round(row.beliefExists * 100)}% means ${Math.round((1 - row.beliefExists) * 100)}% of simulations will ignore it.`}>
                    <span className="cursor-help">· {Math.round(row.beliefExists * 100)}% likely</span>
                  </Tooltip>
                )}
              </div>
            ) : null
          })()}

          {/* Strength quick-select */}
          <Tooltip delay={300} content="How strongly does this affect the outcome? Your expertise matters here">
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

          {/* Basis line — label already includes full phrase from BASIS_LABELS */}
          {row.basis && (
            <p className={`${typography.panelMeta} text-text-light mt-0.5`}>
              {row.basis}
            </p>
          )}
        </div>
      ))}
      {expanded && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className={`${typography.panelMeta} text-info hover:underline cursor-pointer`}
        >
          Hide
        </button>
      )}
    </div>
  )
})

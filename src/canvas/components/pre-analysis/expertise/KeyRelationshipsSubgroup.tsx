/**
 * KeyRelationshipsSubgroup — Subgroup 5: Top causal edges with strength quick-select.
 * Collapsed by default.
 */

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { typography } from '@/styles/typography'
import type { EdgeRelationship } from '../hooks/deriveExpertiseGroups'

interface KeyRelationshipsSubgroupProps {
  items: EdgeRelationship[]
  onFocusEdge?: (edgeId: string) => void
  onUpdateEdgeStrength?: (edgeId: string, value: number) => void
  onHoverEnter?: (type: 'node' | 'edge', id: string) => void
  onHoverLeave?: () => void
}

const STRENGTH_BANDS = [
  { label: 'Weakly', value: 0.15 },
  { label: 'Moderately', value: 0.40 },
  { label: 'Strongly', value: 0.70 },
]

function getConfidenceBand(std: number | undefined): string {
  if (std == null) return ''
  if (std < 0.10) return 'High confidence'
  if (std < 0.20) return 'Moderate confidence'
  return 'Low confidence'
}

export function KeyRelationshipsSubgroup({
  items,
  onFocusEdge,
  onUpdateEdgeStrength,
  onHoverEnter,
  onHoverLeave,
}: KeyRelationshipsSubgroupProps) {
  const [expanded, setExpanded] = useState(false)
  if (items.length === 0) return null

  // Strongest influence context (top item when sorted by influence)
  const strongest = items[0]

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 w-full text-left cursor-pointer py-0.5"
      >
        {expanded ? (
          <ChevronDown className="w-3 h-3 text-text-light" />
        ) : (
          <ChevronRight className="w-3 h-3 text-text-light" />
        )}
        <span className={`${typography.panelMeta} text-text-light`}>
          {expanded ? 'Hide' : `Show key relationships`}
        </span>
      </button>
      {/* Strongest influence hint when collapsed */}
      {!expanded && strongest && (
        <p className={`${typography.panelMeta} text-text-light pl-4`}>
          Strongest influence: {strongest.sourceLabel} → {strongest.targetLabel}
        </p>
      )}
      {expanded && items.slice(0, 10).map(rel => {
        const confBand = getConfidenceBand(rel.std)
        const existsPct = rel.beliefExists != null ? `${Math.round(rel.beliefExists * 100)}%` : null

        return (
          <div key={rel.edgeId} className="px-1 py-1 space-y-1">
            <button
              type="button"
              onClick={() => onFocusEdge?.(rel.edgeId)}
              onMouseEnter={() => onHoverEnter?.('edge', rel.edgeId)}
              onMouseLeave={() => onHoverLeave?.()}
              className={`${typography.panelBody} text-info hover:underline cursor-pointer text-left`}
            >
              {rel.sourceLabel} → {rel.targetLabel}
            </button>
            <div className={`${typography.panelMeta} text-text-light flex items-center gap-2 flex-wrap`}>
              {rel.weight != null && (
                <span>{rel.direction === 'negative' ? '−' : '+'}{rel.weight.toFixed(2)}</span>
              )}
              {confBand && <span>{confBand}</span>}
              {existsPct && <span>{existsPct} likely</span>}
            </div>
            {onUpdateEdgeStrength && (
              <div className="flex items-center gap-1.5">
                {STRENGTH_BANDS.map(band => (
                  <button
                    key={band.label}
                    type="button"
                    onClick={() => onUpdateEdgeStrength(rel.edgeId, band.value)}
                    className={`${typography.panelMeta} text-info border border-info/30 rounded-full px-2 py-0.5 bg-transparent hover:bg-panel-hover cursor-pointer`}
                  >
                    {band.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

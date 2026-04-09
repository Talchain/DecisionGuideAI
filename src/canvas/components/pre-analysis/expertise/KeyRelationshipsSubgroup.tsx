/**
 * KeyRelationshipsSubgroup — Subgroup 5: Top causal edges with strength quick-select.
 * Collapsed by default.
 */

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import Tooltip from '../../../../components/Tooltip'
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

function getConfidenceBand(std: number | undefined): { label: string; dot: string } | null {
  if (std == null) return null
  if (std < 0.10) return { label: 'High confidence', dot: 'bg-success' }
  if (std < 0.20) return { label: 'Moderate confidence', dot: 'bg-warning' }
  return { label: 'Low confidence', dot: 'bg-danger' }
}

/** Qualitative strength label from weight magnitude */
function getStrengthLabel(weight: number | undefined, direction: string | undefined): string {
  if (weight == null) return ''
  const mag = weight >= 0.60 ? 'Strong' : weight >= 0.25 ? 'Moderate' : weight >= 0.05 ? 'Weak' : 'Slight'
  const dir = direction === 'negative' ? 'negative' : 'positive'
  return `${mag} ${dir}`
}

export function KeyRelationshipsSubgroup({
  items,
  onFocusEdge,
  onUpdateEdgeStrength,
  onHoverEnter,
  onHoverLeave,
}: KeyRelationshipsSubgroupProps) {
  const [expanded, setExpanded] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const INITIAL_CAP = 5
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
      {/* Causal count + strongest influence hint when collapsed */}
      {!expanded && (
        <div className={`${typography.panelMeta} text-text-light pl-4 space-y-0.5`}>
          <p>{items.length} causal relationship{items.length !== 1 ? 's' : ''}</p>
          {strongest && (
            <p>Strongest influence: {strongest.sourceLabel} → {strongest.targetLabel}</p>
          )}
        </div>
      )}
      {expanded && items.slice(0, showAll ? items.length : INITIAL_CAP).map(rel => {
        const strengthLabel = getStrengthLabel(rel.weight, rel.direction)
        const confBand = getConfidenceBand(rel.std)
        const existsPct = rel.beliefExists != null ? Math.round(rel.beliefExists * 100) : null

        // Build meta segments with dot separators
        const segments: Array<{ key: string; node: React.ReactNode }> = []
        if (strengthLabel && rel.weight != null) {
          segments.push({ key: 'strength', node: <>{strengthLabel} ({rel.weight.toFixed(2)})</> })
        } else if (rel.weight != null) {
          segments.push({ key: 'weight', node: <>{rel.direction === 'negative' ? '−' : '+'}{rel.weight.toFixed(2)}</> })
        }
        if (confBand) {
          segments.push({ key: 'conf', node: <><span className={`inline-block w-1.5 h-1.5 rounded-full ${confBand.dot}`} /> {confBand.label}</> })
        }
        if (existsPct != null) {
          segments.push({
            key: 'exists',
            node: (
              <Tooltip delay={300} content={`Probability this relationship exists in your decision. ${existsPct}% means ${100 - existsPct}% of simulations will ignore it.`}>
                <span>{existsPct}% likely</span>
              </Tooltip>
            ),
          })
        }

        return (
          <div key={rel.edgeId} className="px-1 py-2 space-y-1">
            {/* Row 1: source (full-width, wraps) → target (truncated with tooltip) */}
            <button
              type="button"
              onClick={() => onFocusEdge?.(rel.edgeId)}
              onMouseEnter={() => onHoverEnter?.('edge', rel.edgeId)}
              onMouseLeave={() => onHoverLeave?.()}
              className={`${typography.panelBody} text-info hover:underline cursor-pointer text-left w-full flex items-baseline gap-1 flex-wrap`}
            >
              <span className="break-words">{rel.sourceLabel}</span>
              <span className="text-text-light shrink-0">→</span>
              <Tooltip delay={300} content={rel.targetLabel}>
                <span className="truncate max-w-[8rem]">{rel.targetLabel}</span>
              </Tooltip>
            </button>
            <div className={`${typography.panelMeta} text-text-light flex items-center gap-1.5 flex-wrap`}>
              {segments.map((seg, i) => (
                <span key={seg.key} className="inline-flex items-center gap-1">
                  {i > 0 && <span className="text-text-light/50">·</span>}
                  {seg.node}
                </span>
              ))}
            </div>
            {/* Row 2: strength pills at 44px touch height */}
            {onUpdateEdgeStrength && (
              <div className="flex items-center gap-2">
                {STRENGTH_BANDS.map(band => (
                  <button
                    key={band.label}
                    type="button"
                    onClick={() => onUpdateEdgeStrength(rel.edgeId, band.value)}
                    className={`${typography.panelMeta} text-info border border-info/30 rounded-full px-3 min-h-[44px] bg-transparent hover:bg-panel-hover cursor-pointer inline-flex items-center justify-center`}
                  >
                    {band.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      })}
      {expanded && items.length > INITIAL_CAP && (
        <button
          type="button"
          onClick={() => setShowAll(prev => !prev)}
          className={`${typography.panelMeta} text-info hover:bg-panel-hover rounded px-1.5 py-0.5 cursor-pointer`}
        >
          {showAll ? 'Show fewer' : `Show ${items.length - INITIAL_CAP} more`}
        </button>
      )}
    </div>
  )
}

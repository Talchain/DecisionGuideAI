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
  if (std < 0.10) return { label: 'High confidence', dot: 'text-success' }
  if (std < 0.20) return { label: 'Moderate confidence', dot: 'text-warning' }
  return { label: 'Low confidence', dot: 'text-danger' }
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
      {expanded && items.slice(0, 10).map(rel => {
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
              <Tooltip delay={300} content={`Probability this relationship exists. ${existsPct}% means ${100 - existsPct}% of simulations will ignore it.`}>
                <span>{existsPct}% likely</span>
              </Tooltip>
            ),
          })
        }

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
            <div className={`${typography.panelMeta} text-text-light flex items-center gap-1.5 flex-wrap`}>
              {segments.map((seg, i) => (
                <span key={seg.key} className="inline-flex items-center gap-1">
                  {i > 0 && <span className="text-text-light/50">·</span>}
                  {seg.node}
                </span>
              ))}
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

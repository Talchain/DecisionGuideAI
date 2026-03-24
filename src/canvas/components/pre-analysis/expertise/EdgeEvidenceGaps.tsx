/**
 * EdgeEvidenceGaps — Subgroup 6: Edges without evidence metadata. Collapsed by default.
 * Absorbs content from the former standalone "More improvements" / WorthInvestigating sections.
 */

import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { typography } from '@/styles/typography'
import type { EdgeRelationship } from '../hooks/deriveExpertiseGroups'

interface EdgeEvidenceGapsProps {
  items: EdgeRelationship[]
  onFocusEdge?: (edgeId: string) => void
  onAddEvidence?: (edgeId: string, evidence: string) => void
  onHoverEnter?: (type: 'node' | 'edge', id: string) => void
  onHoverLeave?: () => void
}

export function EdgeEvidenceGaps({
  items,
  onFocusEdge,
  onAddEvidence,
  onHoverEnter,
  onHoverLeave,
}: EdgeEvidenceGapsProps) {
  const [expanded, setExpanded] = useState(false)
  if (items.length === 0) return null

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
          {expanded ? 'Hide' : `Show ${items.length} edge improvements`}
        </span>
      </button>
      {expanded && items.map(rel => {
        const influencePct = rel.influence != null ? Math.round(rel.influence * 100) : null
        return (
          <div key={rel.edgeId} className="flex items-center gap-2 py-0.5 px-1">
            <button
              type="button"
              onClick={() => onFocusEdge?.(rel.edgeId)}
              onMouseEnter={() => onHoverEnter?.('edge', rel.edgeId)}
              onMouseLeave={() => onHoverLeave?.()}
              className={`${typography.panelBody} text-info hover:underline cursor-pointer text-left truncate flex-1 min-w-0`}
            >
              {rel.sourceLabel} → {rel.targetLabel}
            </button>
            {influencePct != null && (
              <span className={`${typography.panelMeta} text-text-light shrink-0`}>{influencePct}%</span>
            )}
            <button
              type="button"
              onClick={() => onAddEvidence?.(rel.edgeId, 'user_provided')}
              className={`${typography.panelMeta} text-info hover:underline cursor-pointer shrink-0`}
            >
              Add evidence
            </button>
          </div>
        )
      })}
    </div>
  )
}

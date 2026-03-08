/**
 * WorthInvestigating — evidence gaps section in the pre-analysis panel.
 *
 * Shows factors ranked by importance where gathering evidence would
 * strengthen the analysis. Hides entirely if zero gaps.
 *
 * Phase 2B: Pre-analysis enrichment (Task 4b).
 */

import { memo, useState } from 'react'
import { ChevronDown, ChevronRight, Search } from 'lucide-react'
import { typography } from '../../../styles/typography'
import { trackEvent } from '../../../lib/posthog'
import type { Node, Edge } from '@xyflow/react'

// ---------------------------------------------------------------------------
// § 1 — Types
// ---------------------------------------------------------------------------

export interface EvidenceGap {
  factorId: string
  factorLabel: string
  description: string
  techniqueSuggestion?: string
  /** Graph connectivity score (higher = more important). For stable sort. */
  connectivityScore: number
}

export interface WorthInvestigatingProps {
  gaps: EvidenceGap[]
  onSetValue?: (factorId: string) => void
}

// ---------------------------------------------------------------------------
// § 2 — Gap derivation from graph (heuristic)
// ---------------------------------------------------------------------------

/**
 * Heuristic ranking by graph connectivity. Replace with pipeline VOI when available.
 *
 * Derives evidence gaps from factor nodes missing observed data.
 * Sorted by in-degree (number of edges targeting the factor), then alphabetically
 * by label for stability.
 */
export function deriveEvidenceGaps(nodes: Node[], edges: Edge[]): EvidenceGap[] {
  const factorNodes = nodes.filter(n => (n.data?.kind ?? n.type) === 'factor')

  // Build in-degree map
  const inDegree = new Map<string, number>()
  for (const e of edges) {
    inDegree.set(e.target, (inDegree.get(e.target) ?? 0) + 1)
  }

  const gaps: EvidenceGap[] = []
  for (const f of factorNodes) {
    const obs = f.data?.observedState as { value?: unknown } | undefined
    if (obs && obs.value != null) continue // Has data — not a gap

    const label = (f.data?.label as string) ?? 'Unknown factor'
    gaps.push({
      factorId: f.id,
      factorLabel: label,
      description: 'No observed data. Gathering evidence here would strengthen the analysis.',
      connectivityScore: inDegree.get(f.id) ?? 0,
    })
  }

  // Heuristic ranking by graph connectivity. Replace with pipeline VOI when available.
  gaps.sort((a, b) => {
    const diff = b.connectivityScore - a.connectivityScore
    if (diff !== 0) return diff
    return a.factorLabel.localeCompare(b.factorLabel) // Secondary sort for stability
  })

  return gaps
}

// ---------------------------------------------------------------------------
// § 3 — Component
// ---------------------------------------------------------------------------

const MAX_VISIBLE = 3

export const WorthInvestigating = memo(function WorthInvestigating({ gaps, onSetValue }: WorthInvestigatingProps) {
  const [expanded, setExpanded] = useState(false)

  // Hide entirely if zero gaps
  if (gaps.length === 0) return null

  const visible = expanded ? gaps : gaps.slice(0, MAX_VISIBLE)
  const remaining = gaps.length - MAX_VISIBLE

  return (
    <section className="space-y-2" aria-label="Worth investigating">
      <div className="flex items-center gap-1.5">
        <Search className="w-3.5 h-3.5 text-info" aria-hidden="true" />
        <h3 className={typography.panelHeader}>Worth investigating</h3>
      </div>

      <ul className="space-y-2" role="list">
        {visible.map((gap) => (
          <GapRow
            key={gap.factorId}
            gap={gap}
            onSetValue={onSetValue}
          />
        ))}
      </ul>

      {remaining > 0 && !expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className={`${typography.panelMeta} text-info hover:underline inline-flex items-center gap-1`}
        >
          and {remaining} more
          <ChevronDown className="w-3 h-3" aria-hidden="true" />
        </button>
      )}

      {expanded && remaining > 0 && (
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className={`${typography.panelMeta} text-info hover:underline inline-flex items-center gap-1`}
        >
          Show fewer
          <ChevronRight className="w-3 h-3" aria-hidden="true" />
        </button>
      )}
    </section>
  )
})

// ---------------------------------------------------------------------------
// § 4 — Individual gap row
// ---------------------------------------------------------------------------

function GapRow({ gap, onSetValue }: { gap: EvidenceGap; onSetValue?: (id: string) => void }) {
  const handleClick = () => {
    trackEvent('fix_shown', { fix_id: `set_value_${gap.factorId}` })
    onSetValue?.(gap.factorId)
  }

  return (
    <li className="bg-panel border border-panel-border rounded-lg p-2.5 space-y-1">
      <p className={`${typography.panelBody} font-medium text-text-body`}>
        {gap.factorLabel}
      </p>
      <p className={`${typography.panelMeta} text-text-light`}>
        {gap.description}
      </p>

      {gap.techniqueSuggestion && (
        <span className={`${typography.panelMeta} text-info border border-info/30 bg-transparent px-1.5 py-0.5 rounded-full inline-block`}>
          Try: {gap.techniqueSuggestion}
        </span>
      )}

      {onSetValue && (
        <button
          type="button"
          onClick={handleClick}
          className={`${typography.buttonSmall} text-info border border-info/30 bg-transparent px-2 py-1 rounded hover:bg-info/5 transition-colors`}
        >
          Set value
        </button>
      )}
    </li>
  )
}

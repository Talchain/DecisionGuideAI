/**
 * WorthInvestigating — evidence gaps section in the pre-analysis panel.
 *
 * Shows factors ranked by importance where gathering evidence would
 * strengthen the analysis. Hides entirely if zero gaps.
 *
 * Phase 2B: Pre-analysis enrichment (Task 4b).
 */

import { memo, useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronRight, Search } from 'lucide-react'
import { typography } from '../../../styles/typography'
import { useHighlightContext } from '../../highlighting/HighlightContext'
import { isCrossHighlightEnabled } from '../../../flags'
import { trackGuidance } from '../../../telemetry/guidanceEvents'
import { useCanvasStore } from '../../store'
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
  onAskAI?: (factorId: string, factorLabel: string) => void
}

// ---------------------------------------------------------------------------
// § 2 — Gap derivation from graph (heuristic)
// ---------------------------------------------------------------------------

/**
 * Derives evidence gaps from factor nodes missing observed data.
 *
 * Ranking priority:
 *   1. VoI score (when voiMap is provided) — higher VoI first.
 *   2. Fallback: in-degree (number of edges targeting the factor).
 *   3. Alphabetical label for stable tie-breaking.
 *
 * @param voiMap  Optional map of factorId → value_of_information score (0-1).
 *                When provided, factors with VoI scores are ranked above those without.
 */
export function deriveEvidenceGaps(nodes: Node[], edges: Edge[], voiMap?: Map<string, number>): EvidenceGap[] {
  const factorNodes = nodes.filter(n => (n.data?.kind ?? n.type) === 'factor')

  // Build in-degree map (fallback ranking)
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

  const hasVoi = voiMap != null && voiMap.size > 0

  gaps.sort((a, b) => {
    if (hasVoi) {
      const aVoi = voiMap!.get(a.factorId) ?? -1
      const bVoi = voiMap!.get(b.factorId) ?? -1
      if (aVoi !== bVoi) return bVoi - aVoi // Higher VoI first
    }
    // Fallback: connectivity (in-degree)
    const diff = b.connectivityScore - a.connectivityScore
    if (diff !== 0) return diff
    return a.factorLabel.localeCompare(b.factorLabel) // Stable tie-break
  })

  return gaps
}

// ---------------------------------------------------------------------------
// § 3 — Component
// ---------------------------------------------------------------------------

const MAX_VISIBLE = 3

export const WorthInvestigating = memo(function WorthInvestigating({ gaps, onSetValue, onAskAI }: WorthInvestigatingProps) {
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
            onAskAI={onAskAI}
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

function GapRow({ gap, onSetValue, onAskAI }: { gap: EvidenceGap; onSetValue?: (id: string) => void; onAskAI?: (factorId: string, factorLabel: string) => void }) {
  const { setHoveredFromPanel, hoveredElementId } = useHighlightContext()
  const crossHighlight = isCrossHighlightEnabled()

  // Highlight active when this item's factorId matches the current hovered element.
  // Works bidirectionally: panel hover or canvas hover both set hoveredElementId.
  const isHighlighted = crossHighlight && hoveredElementId === gap.factorId

  // Telemetry: fire EVIDENCE_GAP_SHOWN and FIX_SHOWN once per factorId on first render
  const shownRef = useRef(false)
  useEffect(() => {
    if (shownRef.current) return
    shownRef.current = true
    const state = useCanvasStore.getState()
    const basePayload = {
      item_id: gap.factorId,
      surface: 'pre_analysis' as const,
      scenario_id: state.currentScenarioId ?? undefined,
      profile_stage: (state.currentStage ?? undefined) as 'frame' | 'ideate' | 'evaluate' | 'decide' | undefined,
    }
    trackGuidance('EVIDENCE_GAP_SHOWN', { ...basePayload, item_type: 'evidence_gap' })
    if (onSetValue) {
      trackGuidance('FIX_SHOWN', { ...basePayload, item_id: `set_value_${gap.factorId}`, item_type: 'fix' })
    }
  }, [gap.factorId, onSetValue])

  // Cleanup on unmount: prevent stale highlight if component is removed while hovered.
  useEffect(() => {
    if (!crossHighlight) return
    return () => {
      setHoveredFromPanel(null)
    }
  }, [crossHighlight, setHoveredFromPanel])

  const handleTechniqueClick = () => {
    const state = useCanvasStore.getState()
    trackGuidance('EVIDENCE_GAP_TECHNIQUE_CLICKED', {
      item_id: gap.factorId,
      item_type: 'evidence_gap',
      surface: 'pre_analysis',
      scenario_id: state.currentScenarioId ?? undefined,
      profile_stage: (state.currentStage ?? undefined) as 'frame' | 'ideate' | 'evaluate' | 'decide' | undefined,
    })
  }

  const handleClick = () => {
    const state = useCanvasStore.getState()
    trackGuidance('FIX_CLICKED', {
      item_id: `set_value_${gap.factorId}`,
      item_type: 'fix',
      surface: 'pre_analysis',
      scenario_id: state.currentScenarioId ?? undefined,
      profile_stage: (state.currentStage ?? undefined) as 'frame' | 'ideate' | 'evaluate' | 'decide' | undefined,
    })
    onSetValue?.(gap.factorId)
  }

  return (
    <li
      className={`bg-panel border border-panel-border rounded-lg p-2.5 space-y-1 transition-colors ${
        isHighlighted ? 'ring-1 ring-info/50 bg-info/5' : ''
      }`}
      onMouseEnter={crossHighlight ? () => setHoveredFromPanel(gap.factorId) : undefined}
      onMouseLeave={crossHighlight ? () => setHoveredFromPanel(null) : undefined}
    >
      <p className={`${typography.panelBody} text-text-body`}>
        {gap.factorLabel}
      </p>
      <p className={`${typography.panelMeta} text-text-light`}>
        {gap.description}
      </p>

      {gap.techniqueSuggestion && (
        <button
          type="button"
          onClick={handleTechniqueClick}
          className={`${typography.panelMeta} text-info border border-info/30 bg-transparent px-1.5 py-0.5 rounded-full inline-block cursor-pointer hover:bg-info/5 transition-colors`}
        >
          Try: {gap.techniqueSuggestion}
        </button>
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
      {onAskAI && (
        <button
          type="button"
          onClick={() => onAskAI(gap.factorId, gap.factorLabel)}
          className={`${typography.panelMeta} text-info border border-info/30 bg-transparent px-2 py-1 rounded-full hover:bg-info/5 transition-colors`}
        >
          Ask AI to research
        </button>
      )}
    </li>
  )
}

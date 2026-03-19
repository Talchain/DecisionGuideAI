/**
 * ModelSummaryBar — node breakdown colour bar + health cards.
 *
 * Shows:
 *   - 6px segmented colour bar by node kind
 *   - Legend dots + counts
 *   - Connectivity card
 *   - Evidence coverage card
 */

import { useMemo } from 'react'
import type { Node, Edge } from '@xyflow/react'
import { typography } from '../../../styles/typography'
import { SectionErrorBoundary } from '../GraphTextView'
import { countEdgesWithEvidence } from '../../utils/evidenceCoverage'

// ── Entity colours (Design System v4 §3.8) ──────────────────────────────────

const SEGMENT_COLOURS: Record<string, string> = {
  goal:     'var(--color-goal, #f59e0b)',
  decision: 'var(--color-info, #3b82f6)',
  option:   'var(--color-option, #8b5cf6)',
  factor:   'var(--color-factor, #6b7280)',
  risk:     'var(--color-danger, #ef4444)',
  outcome:  'var(--color-success, #10b981)',
}

const DOT_CLASSES: Record<string, string> = {
  goal:     'bg-goal',
  decision: 'bg-info',
  option:   'bg-option',
  factor:   'bg-factor',
  risk:     'bg-danger',
  outcome:  'bg-success',
}

const KIND_ORDER = ['goal', 'decision', 'option', 'factor', 'risk', 'outcome'] as const
type KindKey = typeof KIND_ORDER[number]

const KIND_LABELS: Record<KindKey, string> = {
  goal:     'Goal',
  decision: 'Decision',
  option:   'Option',
  factor:   'Factor',
  risk:     'Risk',
  outcome:  'Outcome',
}

// ── Health card ───────────────────────────────────────────────────────────────

function HealthCard({
  label,
  value,
  subtext,
  subtextColour = 'text-text-light',
  progressPct,
  progressColour,
}: {
  label: string
  value: string
  subtext: string
  subtextColour?: string
  progressPct: number
  progressColour: string
}) {
  return (
    <div className="flex-1 min-w-0 bg-panel border border-panel-border rounded-xl px-2.5 py-2">
      <div className={`${typography.panelMeta} text-text-light mb-0.5`}>{label}</div>
      <div className={`${typography.panelHeader} text-text-header`}>{value}</div>
      <div className={`${typography.panelMeta} ${subtextColour} mt-0.5 mb-1`}>{subtext}</div>
      <div className="h-1 bg-panel-border rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${progressColour}`}
          style={{ width: `${Math.min(100, Math.max(0, progressPct))}%` }}
        />
      </div>
    </div>
  )
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface ModelSummaryBarProps {
  nodes: Node[]
  causalEdges: Edge[]
  causalNodes: Node[]
  grouped: Record<KindKey, Node[]>
}

function ModelSummaryBarInner({ nodes, causalEdges, causalNodes, grouped }: ModelSummaryBarProps) {
  if (nodes.length === 0) return null

  const totalCount = nodes.length

  // Connectivity heuristic: nodes mentioned in any causal edge
  const { connectedCount } = useMemo(() => {
    const mentioned = new Set<string>()
    for (const e of causalEdges) {
      mentioned.add(e.source)
      mentioned.add(e.target)
    }
    const connected = causalNodes.filter(n => mentioned.has(n.id) || causalNodes.length === 1).length
    return { connectedCount: connected }
  }, [causalNodes, causalEdges])

  const nodeTotal = causalNodes.length
  const connectivityPct = nodeTotal > 0 ? Math.round((connectedCount / nodeTotal) * 100) : 0
  const disconnectedCount = nodeTotal - connectedCount
  const connectivitySub = disconnectedCount === 0
    ? 'All nodes connected'
    : `${disconnectedCount} disconnected from goal`
  const connectivitySubColour = disconnectedCount === 0 ? 'text-success' : 'text-warning'

  const { evidenced, total: edgeTotal } = useMemo(
    () => countEdgesWithEvidence(causalEdges),
    [causalEdges]
  )
  const evidencePct = edgeTotal > 0 ? Math.round((evidenced / edgeTotal) * 100) : 0
  const evidenceProgressColour = evidencePct >= 50 ? 'bg-success' : evidencePct > 0 ? 'bg-warning' : 'bg-panel'
  const evidenceSub = edgeTotal === 0
    ? 'No edges yet'
    : evidencePct === 0
      ? 'No edges with user evidence'
      : `${evidencePct}% of edges have user evidence`

  return (
    <div className="space-y-3" data-testid="model-summary-bar">
      {/* Breakdown bar */}
      <div>
        <div className="flex h-[6px] rounded-[3px] overflow-hidden" style={{ gap: '1px' }}>
          {KIND_ORDER.map(kind => {
            const count = grouped[kind].length
            if (count === 0) return null
            const pct = (count / totalCount) * 100
            return (
              <div
                key={kind}
                style={{ width: `${pct}%`, backgroundColor: SEGMENT_COLOURS[kind] }}
                className="shrink-0"
                title={`${KIND_LABELS[kind]}s: ${count}`}
              />
            )
          })}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1.5">
          {KIND_ORDER.map(kind => {
            const count = grouped[kind].length
            if (count === 0) return null
            return (
              <div key={kind} className="flex items-center gap-1">
                <div className={`w-2 h-2 rounded-full ${DOT_CLASSES[kind]}`} aria-hidden="true" />
                <span className={`${typography.panelMeta} text-text-light`}>
                  {count} {KIND_LABELS[kind].toLowerCase()}{count !== 1 ? 's' : ''}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Health cards */}
      <div className="flex gap-2">
        <HealthCard
          label="Connectivity"
          value={`${connectedCount} of ${nodeTotal}`}
          subtext={connectivitySub}
          subtextColour={connectivitySubColour}
          progressPct={connectivityPct}
          progressColour={disconnectedCount === 0 ? 'bg-success' : 'bg-warning'}
        />
        <HealthCard
          label="Evidence coverage"
          value={`${evidenced} of ${edgeTotal}`}
          subtext={evidenceSub}
          progressPct={evidencePct}
          progressColour={evidenceProgressColour}
        />
      </div>
    </div>
  )
}

export function ModelSummaryBar(props: ModelSummaryBarProps) {
  return (
    <SectionErrorBoundary section="model summary bar">
      <ModelSummaryBarInner {...props} />
    </SectionErrorBoundary>
  )
}

export type { KindKey, ModelSummaryBarProps }

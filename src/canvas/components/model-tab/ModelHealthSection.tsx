/**
 * ModelHealthSection — model quality summary, collapsed by default.
 *
 * Collapsed state: "Model health" header with count of potential issues.
 * Expanded state:
 *   - Connectivity count (connected / total nodes)
 *   - Evidence coverage (edges with evidence / total edges)
 *   - Fragile edge count (post-analysis only)
 *   - CEE quality sub-scores (overall, structure, causality, coverage, safety) — 1–10 scale
 */

import { useMemo } from 'react'
import type { Node, Edge } from '@xyflow/react'
import { typography } from '../../../styles/typography'
import { SectionErrorBoundary } from '../GraphTextView'
import { Accordion } from '../../../components/results/Accordion'
import { countEdgesWithEvidence } from '../../utils/evidenceCoverage'
import type { CeeQualityDimensions } from '../../store'

interface ModelHealthSectionProps {
  nodes: Node[]
  edges: Edge[]
  fragileEdgeCount?: number
  ceeQuality?: CeeQualityDimensions | null
}

// ── Quality score row ──────────────────────────────────────────────────────────

function QualityRow({ label, score }: { label: string; score: number }) {
  const pct = Math.min(100, Math.max(0, (score / 10) * 100))
  const barColour = score >= 7 ? 'bg-success' : score >= 4 ? 'bg-warning' : 'bg-danger'
  return (
    <div className="flex items-center gap-2" data-testid={`quality-row-${label.toLowerCase()}`}>
      <span className={`${typography.panelMeta} text-text-light w-20 shrink-0`}>{label}</span>
      <div className="flex-1 h-1.5 bg-panel-border rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColour}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className={`${typography.panelMeta} text-text-body font-mono w-6 text-right tabular-nums`}>
        {score.toFixed(0)}
      </span>
    </div>
  )
}

// ── Stat row ───────────────────────────────────────────────────────────────────

function StatRow({ label, value, subtext, colour }: {
  label: string
  value: string
  subtext?: string
  colour?: string
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className={`${typography.panelMeta} text-text-light`}>{label}</span>
      <div className="flex items-center gap-1.5">
        {subtext && (
          <span className={`${typography.panelMeta} ${colour ?? 'text-text-light'}`}>{subtext}</span>
        )}
        <span className={`${typography.panelMeta} text-text-body font-medium`}>{value}</span>
      </div>
    </div>
  )
}

// ── Section inner ──────────────────────────────────────────────────────────────

function ModelHealthSectionInner({
  nodes,
  edges,
  fragileEdgeCount = 0,
  ceeQuality,
}: ModelHealthSectionProps) {
  // Connectivity: nodes mentioned in at least one edge
  const { connectedCount, totalCount } = useMemo(() => {
    const mentioned = new Set<string>()
    for (const e of edges) {
      mentioned.add(e.source)
      mentioned.add(e.target)
    }
    const connected = nodes.filter(n => mentioned.has(n.id) || nodes.length === 1).length
    return { connectedCount: connected, totalCount: nodes.length }
  }, [nodes, edges])

  const { evidenced, total: edgeTotal } = useMemo(
    () => countEdgesWithEvidence(edges),
    [edges]
  )

  // Issue count for badge: disconnected nodes + fragile edges + unevidenced edges
  const disconnectedCount = totalCount - connectedCount
  const unevidencedCount = edgeTotal - evidenced
  const issueCount = disconnectedCount + fragileEdgeCount + (unevidencedCount > 0 ? 1 : 0)

  return (
    <Accordion
      title="Model health"
      badgeCount={issueCount > 0 ? issueCount : undefined}
      badgeState={issueCount > 0 ? 'unresolved' : undefined}
      defaultExpanded={false}
      testId="model-health-section"
    >
      <div className="space-y-2.5">
        {/* Connectivity */}
        <StatRow
          label="Connected nodes"
          value={`${connectedCount} / ${totalCount}`}
          subtext={disconnectedCount > 0 ? `${disconnectedCount} disconnected` : 'All connected'}
          colour={disconnectedCount > 0 ? 'text-warning' : 'text-success'}
        />

        {/* Evidence coverage */}
        <StatRow
          label="Evidence coverage"
          value={`${evidenced} / ${edgeTotal}`}
          subtext={edgeTotal === 0 ? undefined : `${unevidencedCount} without evidence`}
          colour={unevidencedCount > 0 ? 'text-warning' : 'text-success'}
        />

        {/* Fragile edges (post-analysis) */}
        {fragileEdgeCount > 0 && (
          <StatRow
            label="Fragile edges"
            value={String(fragileEdgeCount)}
            subtext="sensitive to assumptions"
            colour="text-warning"
          />
        )}

        {/* CEE quality scores */}
        {ceeQuality && (
          <div>
            <div className={`${typography.panelMeta} text-text-light font-mono mb-1.5`}>CEE quality scores (1–10)</div>
            <div className="space-y-1.5">
              <QualityRow label="Overall" score={ceeQuality.overall} />
              <QualityRow label="Structure" score={ceeQuality.structure} />
              <QualityRow label="Causality" score={ceeQuality.causality} />
              <QualityRow label="Coverage" score={ceeQuality.coverage} />
              <QualityRow label="Safety" score={ceeQuality.safety} />
            </div>
          </div>
        )}
      </div>
    </Accordion>
  )
}

export function ModelHealthSection(props: ModelHealthSectionProps) {
  return (
    <SectionErrorBoundary section="model-health">
      <ModelHealthSectionInner {...props} />
    </SectionErrorBoundary>
  )
}

/**
 * ModelHealthSection — model quality summary, collapsed by default.
 *
 * Collapsed state: "Model health" header with count of potential issues.
 * Expanded state:
 *   - Connectivity count (connected / total nodes)
 *   - Evidence coverage (edges with evidence / total edges)
 *   - Fragile edge count (post-analysis only)
 *   - CEE quality sub-scores (overall, structure, causality, coverage, safety) — 1–10 scale
 *   - Root node warnings (from inference_warnings)
 *   - Audit trail (seed, response hash, n_samples, repairs summary)
 */

import { useContext, useMemo } from 'react'
import type { Node, Edge } from '@xyflow/react'
import { AlertTriangle } from 'lucide-react'
import { typography } from '../../../styles/typography'
import { SectionErrorBoundary } from '../GraphTextView'
import { Accordion } from '../../../components/results/Accordion'
import { countEdgesWithEvidence } from '../../utils/evidenceCoverage'
import type { CeeQualityDimensions } from '../../store'
import type { CritiqueItemV1 } from '../../../adapters/plot/types'
import { DetailToggleContext } from './DetailToggleContext'

/** Audit trail data from PLoT response */
export interface AuditTrailData {
  seedUsed: string | null
  responseHash: string | null
  nSamples: number | null
  repairsApplied: Array<{ code?: string; type?: string; field_path?: string; reason?: string }> | null
  inferenceWarnings: Array<{ code?: string; severity?: string; message?: string }> | null
  recommendationStability: number | null
  autoNoiseApplied: boolean | null
  stabilityPenaltyFactor: number | null
}

interface ModelHealthSectionProps {
  nodes: Node[]
  edges: Edge[]
  fragileEdgeCount?: number
  ceeQuality?: CeeQualityDimensions | null
  /** Audit trail from PLoT response metadata */
  auditTrail?: AuditTrailData
  /** PLoT critique items */
  critique?: CritiqueItemV1[] | null
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
  auditTrail,
  critique,
}: ModelHealthSectionProps) {
  const { showDetail } = useContext(DetailToggleContext)

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

  // Root node default value warnings from inference_warnings
  const rootNodeWarningCount = useMemo(() => {
    if (!auditTrail?.inferenceWarnings) return 0
    return auditTrail.inferenceWarnings.filter(
      w => w?.code === 'ROOT_NODE_DEFAULT_VALUE'
    ).length
  }, [auditTrail?.inferenceWarnings])

  // Repairs summary: aggregate by code
  const repairsSummary = useMemo(() => {
    if (!auditTrail?.repairsApplied || auditTrail.repairsApplied.length === 0) return null
    const counts = new Map<string, number>()
    for (const r of auditTrail.repairsApplied) {
      const code = r.code ?? 'UNKNOWN'
      counts.set(code, (counts.get(code) ?? 0) + 1)
    }
    return Array.from(counts.entries()).map(([code, count]) =>
      `${code} (x${count})`
    ).join(', ')
  }, [auditTrail?.repairsApplied])

  // Issue count for badge: disconnected nodes + fragile edges + unevidenced edges + root node warnings
  const disconnectedCount = totalCount - connectedCount
  const unevidencedCount = edgeTotal - evidenced
  const issueCount = disconnectedCount + fragileEdgeCount + (unevidencedCount > 0 ? 1 : 0) + rootNodeWarningCount

  return (
    <Accordion
      title="Model health"
      badgeCount={issueCount > 0 ? issueCount : undefined}
      badgeState={issueCount > 0 ? 'unresolved' : undefined}
      defaultExpanded={false}
      testId="model-health-section"
    >
      <div className="space-y-2.5">
        {/* Root node warnings */}
        {rootNodeWarningCount > 0 && (
          <div
            className="flex items-center gap-1.5"
            data-testid="root-node-warning"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-danger shrink-0" aria-hidden="true" />
            <span className={`${typography.panelMeta} text-danger`}>
              {rootNodeWarningCount} factor{rootNodeWarningCount !== 1 ? 's have' : ' has'} no value set. This reduces analysis reliability.
              {auditTrail?.stabilityPenaltyFactor != null && auditTrail.stabilityPenaltyFactor < 1.0 && (
                <> Penalty: {auditTrail.stabilityPenaltyFactor.toFixed(2)}x stability</>
              )}
            </span>
          </div>
        )}

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
            <div className={`${typography.panelMeta} text-text-light font-mono mb-1.5`}>CEE quality scores (1-10)</div>
            <div className="space-y-1.5">
              <QualityRow label="Overall" score={ceeQuality.overall} />
              <QualityRow label="Structure" score={ceeQuality.structure} />
              <QualityRow label="Causality" score={ceeQuality.causality} />
              <QualityRow label="Coverage" score={ceeQuality.coverage} />
              <QualityRow label="Safety" score={ceeQuality.safety} />
            </div>
          </div>
        )}

        {/* Full audit trail (detail toggle) */}
        {showDetail && auditTrail && (
          <div className="pt-2 border-t border-panel-border" data-testid="model-health-audit">
            <div className={`${typography.panelMeta} text-text-light font-mono mb-1.5`}>Audit trail</div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5">
              {auditTrail.seedUsed != null && (
                <>
                  <span className={`${typography.panelMeta} text-text-light`}>Seed</span>
                  <span className={`${typography.panelMeta} text-text-body font-mono text-right`}>{auditTrail.seedUsed}</span>
                </>
              )}
              {auditTrail.responseHash != null && (
                <>
                  <span className={`${typography.panelMeta} text-text-light`}>Response hash</span>
                  <span className={`${typography.panelMeta} text-text-body font-mono text-right truncate`}>
                    {auditTrail.responseHash.slice(0, 12)}
                  </span>
                </>
              )}
              {auditTrail.nSamples != null && (
                <>
                  <span className={`${typography.panelMeta} text-text-light`}>Simulations</span>
                  <span className={`${typography.panelMeta} text-text-body font-mono text-right`}>
                    {auditTrail.nSamples.toLocaleString('en-GB')}
                  </span>
                </>
              )}
              {auditTrail.recommendationStability != null && (
                <>
                  <span className={`${typography.panelMeta} text-text-light`}>Stability</span>
                  <span className={`${typography.panelMeta} text-text-body font-mono text-right`}>
                    {(auditTrail.recommendationStability * 100).toFixed(0)}%
                  </span>
                </>
              )}
              {auditTrail.autoNoiseApplied != null && (
                <>
                  <span className={`${typography.panelMeta} text-text-light`}>Auto-noise</span>
                  <span className={`${typography.panelMeta} text-text-body text-right`}>
                    {auditTrail.autoNoiseApplied ? 'Applied' : 'Not applied'}
                  </span>
                </>
              )}
              {auditTrail.stabilityPenaltyFactor != null && (
                <>
                  <span className={`${typography.panelMeta} text-text-light`}>Stability penalty</span>
                  <span className={`${typography.panelMeta} text-text-body font-mono text-right`}>
                    {auditTrail.stabilityPenaltyFactor.toFixed(2)}x
                  </span>
                </>
              )}
            </div>
            {/* Repairs summary */}
            {repairsSummary && (
              <div className="mt-2">
                <span className={`${typography.panelMeta} text-text-light`}>Repairs applied: </span>
                <span className={`${typography.panelMeta} text-text-body`}>{repairsSummary}</span>
              </div>
            )}
            {/* Inference warnings */}
            {auditTrail.inferenceWarnings && auditTrail.inferenceWarnings.length > 0 && (
              <div className="mt-2">
                <span className={`${typography.panelMeta} text-text-light`}>Inference warnings: </span>
                <span className={`${typography.panelMeta} text-text-body`}>
                  {auditTrail.inferenceWarnings.map(w => w?.code ?? 'UNKNOWN').join(', ')}
                </span>
              </div>
            )}
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

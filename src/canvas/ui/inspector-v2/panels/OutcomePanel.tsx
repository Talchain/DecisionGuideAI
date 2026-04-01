/**
 * OutcomePanel — Inspector for outcome nodes (spec §11)
 * Primarily read surface. Simple range bars + text (no density charts for PoC).
 */

import { memo, useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { useCanvasStore } from '../../../store'
import type { NodeType } from '../../../domain/nodes'
import { InspectorCoaching } from '../shared/InspectorCoaching'
import { typography } from '../../../../styles/typography'
import { useStaleGuard } from '../useStaleGuard'
import { SECTION_TITLES } from '../inspectorStrings'
import { SectionTitle } from '../shared/SectionTitle'
import { ConnectionRow } from '../shared/ConnectionRow'
import { StaleGuardBanner } from '../shared/StaleGuardBanner'
import { TechnicalDisclosure } from '../shared/TechnicalDisclosure'
import { DataBar } from '../../shared/DataBar'
import type { InspectorPanelProps } from '../types'
import { COACHING } from '../coachingConfig'
import { OutcomeAdvancedEditor } from '../editors/OutcomeAdvancedEditor'
import { ResultsLink } from '../shared/ResultsLink'

/** Check if option comparison analysis failed (used to hide entire section) */
function isOptionComparisonFailed(report: unknown): boolean {
  const r = report as Record<string, unknown> | null
  const status = r?.option_comparison_status as string | undefined
  return status === 'error' || status === 'failed'
}

/** Check if there is any option comparison data to display */
function hasOptionComparisonData(report: unknown): boolean {
  const r = report as Record<string, unknown> | null
  const status = r?.option_comparison_status as string | undefined
  if (status === 'pending' || status === 'running') return true
  const comparisons = r?.option_comparison as unknown[] | undefined
  return Array.isArray(comparisons) && comparisons.length > 0
}

// ─── Option comparison sub-component (A.3) ────────────────────────
interface OptionComparisonEntry {
  option_id: string
  option_label?: string
  win_probability?: number
  expected_outcome?: number
  outcome?: { mean?: number; p10?: number; p50?: number; p90?: number }
}

function OptionComparisonSection({
  report,
  techMode,
  onNavigate,
}: {
  report: unknown
  techMode: boolean
  onNavigate: (id: string) => void
}) {
  const r = report as Record<string, unknown> | null
  const status = r?.option_comparison_status as string | undefined
  const comparisons = r?.option_comparison as OptionComparisonEntry[] | undefined

  // Failed analysis: hide section
  if (status === 'error' || status === 'failed') return null

  // pending/running: outer gate passed this through, show progress state
  if (!comparisons || !Array.isArray(comparisons) || comparisons.length === 0) {
    return (
      <div className="bg-panel border border-panel-border rounded-lg p-3">
        <p className={`${typography.panelMeta} text-text-light`}>
          Analysis in progress...
        </p>
      </div>
    )
  }

  // Sort by win probability descending
  const sorted = [...comparisons].sort((a, b) =>
    (b.win_probability ?? 0) - (a.win_probability ?? 0)
  )

  return (
    <div className="space-y-1.5" data-testid="option-comparison-section">
      {sorted.map(opt => {
        const outcome = opt.outcome
        const hasPrediction = outcome && (outcome.mean != null || outcome.p10 != null)
        return (
          <button
            key={opt.option_id}
            type="button"
            onClick={() => onNavigate(opt.option_id)}
            className="w-full text-left bg-panel border border-panel-border rounded-lg p-2.5 hover:bg-panel-hover transition-colors"
          >
            <div className="flex items-center justify-between gap-2">
              <span className={`${typography.panelBody} text-text-body truncate`}>
                {opt.option_label ?? opt.option_id}
              </span>
              {opt.win_probability != null && (
                <span className={`${typography.panelMeta} shrink-0 text-option font-medium`}>
                  {Math.round(opt.win_probability * 100)}% win
                </span>
              )}
            </div>
            {hasPrediction && (
              <div className={`${typography.panelMeta} text-text-light mt-1`}>
                {outcome!.mean != null && (
                  <span>~{outcome!.mean.toFixed(1)}</span>
                )}
                {outcome!.p10 != null && outcome!.p90 != null && (
                  <span className="ml-1">
                    ({outcome!.p10.toFixed(1)} – {outcome!.p90.toFixed(1)})
                  </span>
                )}
              </div>
            )}
            {!hasPrediction && (
              <div className={`${typography.panelMeta} text-text-light mt-1`}>—</div>
            )}
            {opt.win_probability != null && (
              <div className="mt-1">
                <DataBar value={opt.win_probability} label="Win probability" colour="info" />
              </div>
            )}
            {techMode && opt.expected_outcome != null && (
              <div className={`${typography.panelMeta} text-text-light mt-0.5`}>
                expected_outcome: {opt.expected_outcome.toFixed(2)}
              </div>
            )}
          </button>
        )
      })}
    </div>
  )
}

export const OutcomePanel = memo(function OutcomePanel({
  nodeId,
  techMode,
  onClose,
  onNavigate,
}: InspectorPanelProps) {
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)
  const resultsStatus = useCanvasStore(s => s.results?.status)
  const resultsReport = useCanvasStore(s => s.results?.report)
  const isResultsMode = resultsStatus === 'complete'

  const node = nodeId ? nodes.find(n => n.id === nodeId) : undefined
  const { isStale } = useStaleGuard()

  const [driversOpen, setDriversOpen] = useState(false)

  // Outbound edge to goal — for contribution bar
  const goalContribution = useMemo(() => {
    const goalEdge = edges.find(e => {
      if (e.source !== nodeId) return false
      const tgt = nodes.find(n => n.id === e.target)
      const kind = tgt?.type || tgt?.data?.kind
      return kind === 'goal'
    })
    if (!goalEdge || goalEdge.data?.weight == null) return null
    return Math.round((goalEdge.data.weight as number) * 100)
  }, [edges, nodes, nodeId])

  // Inbound factors
  const inboundFactors = useMemo(() => {
    return edges
      .filter(e => e.target === nodeId)
      .map(e => {
        const src = nodes.find(n => n.id === e.source)
        const kind = (src?.type || src?.data?.kind || 'factor') as NodeType
        return {
          edgeId: e.id,
          nodeId: e.source,
          nodeKind: kind,
          label: String(src?.data?.label ?? e.source),
          strength: { weight: e.data?.weight ?? 0, direction: (e.data?.direction ?? 'positive') as 'positive' | 'negative' },
        }
      })
  }, [edges, nodes, nodeId])

  if (!nodeId || !node) return null

  const description = String(node.data?.description ?? '')

  return (
    <div>
      {description && (
        <p className={`${typography.panelBody} text-text-body mt-3`}>{description}</p>
      )}

      {/* Predicted range by option: shown pre-analysis always; post-analysis only when data exists */}
      {(!isResultsMode || (!isOptionComparisonFailed(resultsReport) && hasOptionComparisonData(resultsReport))) && (
        <>
          <SectionTitle icon={SECTION_TITLES.predictedRange.icon} label={SECTION_TITLES.predictedRange.label} />
          <StaleGuardBanner isStale={isStale} hasResults={isResultsMode}>
            {isResultsMode ? (
              <OptionComparisonSection report={resultsReport} techMode={techMode} onNavigate={onNavigate} />
            ) : (
              <div className="bg-panel border border-panel-border rounded-lg p-3">
                <p className={`${typography.panelMeta} text-text-light`}>
                  Run analysis to see predicted outcome ranges per option.
                </p>
              </div>
            )}
          </StaleGuardBanner>
        </>
      )}

      {/* Goal contribution bar — sourced from outcome→goal edge weight */}
      {goalContribution != null && (
        <div className="mt-3 px-3 py-2 bg-panel border border-success/30 rounded-lg">
          <div className="flex items-center gap-2">
            <span className={`${typography.panelHeader} text-xs`}>Contributes to your goal</span>
            <div className="flex-1 h-1.5 bg-panel-border rounded-full overflow-hidden">
              <div className="h-full bg-success rounded-full" style={{ width: `${Math.min(goalContribution, 100)}%` }} />
            </div>
            <span className={`${typography.panelHeader} text-sm`}>{goalContribution}%</span>
          </div>
          {!isResultsMode && (
            <p className={`${typography.panelMeta} text-text-light mt-1`}>Based on model structure</p>
          )}
          {isResultsMode && (
            <div className="mt-1"><ResultsLink label="See all contributions" tab="results" /></div>
          )}
        </div>
      )}

      {/* What drives this (behind disclosure for PoC) */}
      <button
        type="button"
        onClick={() => setDriversOpen(o => !o)}
        className={`${typography.panelMeta} mt-3 bg-transparent border-none cursor-pointer text-info flex items-center gap-1 p-0 hover:underline`}
        aria-expanded={driversOpen}
      >
        {driversOpen ? <ChevronDown size={12} className="text-info" /> : <ChevronRight size={12} className="text-info" />}
        What drives this
      </button>
      {driversOpen && (
        <div className="mt-1">
          {inboundFactors.map(conn => (
            <ConnectionRow
              key={conn.edgeId}
              nodeKind={conn.nodeKind}
              label={conn.label}
              strength={conn.strength}
              techMode={techMode}
              onClick={() => onNavigate(conn.nodeId)}
            />
          ))}
        </div>
      )}

      <InspectorCoaching
        elementId={nodeId}
        panelType="outcome"
        fallbackText={COACHING.outcomeCompleteness}
        labelContext={{ label: String(node.data?.label ?? '') }}
      />

      {/* Technical disclosure — structured advanced editor */}
      <TechnicalDisclosure visible={techMode}>
        <OutcomeAdvancedEditor nodeId={nodeId} />
      </TechnicalDisclosure>
    </div>
  )
})

/**
 * OutcomePanel — Inspector for outcome nodes (v6.2 three-group layout)
 *
 * Read-first panel. No primary editing surface (outcomes are computed).
 * Groups: Context → Predicted range → What drives this
 */

import { memo, useMemo } from 'react'
import { useCanvasStore } from '../../../store'
import type { NodeType } from '../../../domain/nodes'
import { InspectorCoaching } from '../shared/InspectorCoaching'
import { typography } from '../../../../styles/typography'
import {
  SECTION_TITLES,
  GROUP_LABELS,
  INLINE_LABELS,
  EMPTY_STATES,
  DESCRIPTION_PLACEHOLDERS,
} from '../inspectorStrings'
import { InlineSectionLabel } from '../shared/InlineSectionLabel'
import { PanelGroup } from '../shared/PanelGroup'
import { EmptyDescriptionPrompt } from '../shared/EmptyDescriptionPrompt'
import { DriversList, type DriverItem } from '../shared/DriversList'
import { StaleGuardBanner } from '../shared/StaleGuardBanner'
import { TechnicalDisclosure } from '../shared/TechnicalDisclosure'
import { DataBar } from '../../shared/DataBar'
import { ResultsLink } from '../shared/ResultsLink'
import type { InspectorPanelProps } from '../types'
import { COACHING } from '../coachingConfig'
import { OutcomeAdvancedEditor } from '../editors/OutcomeAdvancedEditor'

// ─── Option comparison helpers ─────────────────────────────────────

function isOptionComparisonFailed(report: unknown): boolean {
  const r = report as Record<string, unknown> | null
  const status = r?.option_comparison_status as string | undefined
  return status === 'error' || status === 'failed'
}

function hasOptionComparisonData(report: unknown): boolean {
  const r = report as Record<string, unknown> | null
  const status = r?.option_comparison_status as string | undefined
  if (status === 'pending' || status === 'running') return true
  const comparisons = r?.option_comparison as unknown[] | undefined
  return Array.isArray(comparisons) && comparisons.length > 0
}

// ─── Option comparison sub-component ───────────────────────────────

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

  if (status === 'error' || status === 'failed') return null

  if (!comparisons || !Array.isArray(comparisons) || comparisons.length === 0) {
    return (
      <div className="bg-panel border border-panel-border rounded-lg p-3">
        <p className={`${typography.panelMeta} text-text-light`}>
          Analysis in progress...
        </p>
      </div>
    )
  }

  const sorted = [...comparisons].sort((a, b) =>
    (b.win_probability ?? 0) - (a.win_probability ?? 0),
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
                {outcome!.mean != null && <span>~{outcome!.mean.toFixed(1)}</span>}
                {outcome!.p10 != null && outcome!.p90 != null && (
                  <span className="ml-1">({outcome!.p10.toFixed(1)} – {outcome!.p90.toFixed(1)})</span>
                )}
              </div>
            )}
            {!hasPrediction && (
              <div className={`${typography.panelMeta} text-text-light mt-1`}>{EMPTY_STATES.noPrediction}</div>
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

// ─── Main panel ────────────────────────────────────────────────────

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

  // Inbound factors (drivers)
  const inboundFactors: DriverItem[] = useMemo(() => {
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
      {/* ── Context group ─────────────────────────────────────── */}
      <PanelGroup kind="context" label={GROUP_LABELS.context}>
        {description
          ? <p className={`${typography.panelBody} text-text-body`}>{description}</p>
          : <EmptyDescriptionPrompt placeholder={DESCRIPTION_PLACEHOLDERS.outcome} />
        }

        {/* Goal contribution bar */}
        {goalContribution != null && (
          <div className="mt-2 px-3 py-2 bg-panel border border-success/30 rounded-lg">
            <div className="flex items-center gap-2">
              <span className={`${typography.panelMeta} font-medium text-text-body`}>
                {INLINE_LABELS.contributesToGoal}
              </span>
              <div className="flex-1 h-1.5 bg-panel-border rounded-full overflow-hidden">
                <div className="h-full bg-success rounded-full" style={{ width: `${Math.min(goalContribution, 100)}%` }} />
              </div>
              <span className={`${typography.panelMeta} font-medium text-text-body`}>{goalContribution}%</span>
            </div>
            {!isResultsMode && (
              <p className={`${typography.panelMeta} text-text-light mt-1`}>{INLINE_LABELS.basedOnModelStructure}</p>
            )}
            {isResultsMode && (
              <div className="mt-1"><ResultsLink label={INLINE_LABELS.seeContributions} tab="results" /></div>
            )}
          </div>
        )}
      </PanelGroup>

      {/* ── Predicted range group ─────────────────────────────── */}
      {(!isResultsMode || (!isOptionComparisonFailed(resultsReport) && hasOptionComparisonData(resultsReport))) && (
        <PanelGroup kind="impact">
          <InlineSectionLabel>{SECTION_TITLES.predictedRange.label}</InlineSectionLabel>
          <StaleGuardBanner hasResults={isResultsMode}>
            {isResultsMode ? (
              <OptionComparisonSection report={resultsReport} techMode={techMode} onNavigate={onNavigate} />
            ) : (
              <div className="bg-panel border border-panel-border rounded-lg p-3">
                <p className={`${typography.panelMeta} text-text-light`}>
                  {INLINE_LABELS.runAnalysisOutcome}
                </p>
              </div>
            )}
          </StaleGuardBanner>
        </PanelGroup>
      )}

      {/* ── What drives this group ────────────────────────────── */}
      <PanelGroup kind="connections" label={INLINE_LABELS.drivers}>
        <DriversList drivers={inboundFactors} techMode={techMode} onNavigate={onNavigate} />
        {inboundFactors.length === 0 && (
          <p className={`${typography.panelMeta} text-text-light`}>{EMPTY_STATES.noInboundConnections}</p>
        )}
        <InspectorCoaching
          elementId={nodeId}
          panelType="outcome"
          fallbackText={COACHING.outcomeCompleteness}
          labelContext={{ label: String(node.data?.label ?? '') }}
        />
      </PanelGroup>

      {/* ── Expert-only model detail ──────────────────────────── */}
      <TechnicalDisclosure visible={techMode}>
        <OutcomeAdvancedEditor nodeId={nodeId} />
      </TechnicalDisclosure>
    </div>
  )
})

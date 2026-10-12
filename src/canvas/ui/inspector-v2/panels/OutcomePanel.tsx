/**
 * OutcomePanel — Inspector for outcome nodes (v6.2 three-group layout)
 *
 * Read-first panel. No primary editing surface (outcomes are computed).
 * Groups: Context → Predicted range → What drives this
 */

import { memo, useMemo } from 'react'
import { useResultsSectionData } from '../../../../components/results/useResultsSectionData'
import { rankingWasWithheld } from '../../../../components/results/leaderDesignation'
import { useCanvasStore } from '../../../store'
import type { NodeType } from '../../../domain/nodes'
import { InspectorCoaching } from '../shared/InspectorCoaching'
import { RENAME_AUTHORITY_CLAUSE } from '../useInspectorMutations'
import { typography } from '../../../../styles/typography'
import {
  SECTION_TITLES,
  INLINE_LABELS,
  EMPTY_STATES,
} from '../inspectorStrings'
import { InlineSectionLabel } from '../shared/InlineSectionLabel'
import { PanelGroup } from '../shared/PanelGroup'
import { InspectorSummary } from '../shared/InspectorSummary'
import { InspectorMoreItems } from '../shared/InspectorMore'
import { DriversList, type DriverItem } from '../shared/DriversList'
import { InspectorConnectPicker } from '../shared/InspectorConnectPicker'
import { StaleGuardBanner } from '../shared/StaleGuardBanner'
import { TechnicalDisclosure } from '../shared/TechnicalDisclosure'
import type { InspectorPanelProps } from '../types'
import { COACHING } from '../coachingConfig'
import { OutcomeAdvancedEditor } from '../editors/OutcomeAdvancedEditor'
import { resolveEdgeSignedStrengthDisplay } from '../../../domain/edgeValueProvenance'
import { resolveElementLabel } from '../../../domain/elementLabel'

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
  rankingWithheld,
  canvasOptionOrder,
}: {
  report: unknown
  techMode: boolean
  onNavigate: (id: string) => void
  /** `rankingWasWithheld(recommendation)`: the dock's and Reasoning tab's reader. */
  rankingWithheld: boolean
  /** Option node ids in canvas order, for the withheld listing. */
  canvasOptionOrder: readonly string[]
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

  // ⛔ ORDER IS A RANKING. Sorting by share names a front-runner, so a run whose
  // ranking the producer WITHHELD lists options in canvas order instead, the
  // order the option cards themselves sit in (AI Quality audit of `b017e3c2`,
  // row L2; #69 5827943157). The shares stay: each card shows its own.
  const sorted = rankingWithheld
    ? [...comparisons].sort((a, b) => canvasRank(a.option_id) - canvasRank(b.option_id))
    // eslint-disable-next-line chance-gate/no-raw-chance-read -- chance-gate: win-share: a win share, said as a share of runs where the option comes out on top, never as a chance
    : [...comparisons].sort((a, b) => (b.win_probability ?? 0) - (a.win_probability ?? 0))
  function canvasRank(id: string): number {
    const i = canvasOptionOrder.indexOf(id)
    return i === -1 ? Number.MAX_SAFE_INTEGER : i
  }

  return (
    <div className="space-y-1.5" data-testid="option-comparison-section">
      {/* #2747 re-scope 2 (DL ruling (A)): no option's win share is said here in C (no "supported by N% of runs", no share
          bar); CEE serves no wording or Run authority for it. The order stays the producer's, under its leader licence. */}
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

/**
 * A10 — this pane is read-first BY DESIGN (its own docblock: "No primary
 * editing surface, outcomes are computed"). The Router's panel-wide wrap it
 * used to sit inside was disabling the coaching card's Ask/Dismiss buttons and
 * the option-comparison navigation rows, none of which writes to the shared
 * model.
 *
 * ⛔ BUT IT IS NOT WRITER-FREE (review 2038 on `1cd208f5`). An earlier version
 * of this note said the pane "owns no writer at all". The advanced editor under
 * "Show model detail" holds a Description textarea that commits
 * `setDescription` — a bare store write with no carrier — so the pane fences
 * that editor itself (`data-writer-fence="advanced-editor"`, the factor pane's
 * pattern). The notice below stays true only because that fence exists.
 */
export const INSPECTOR_OUTCOME_REASON =
  `Renaming ${RENAME_AUTHORITY_CLAUSE}. Description and technical fields here are read-only for now.`

export const OutcomePanel = memo(function OutcomePanel({
  nodeId,
  techMode,
  onClose,
  onNavigate,
  readOnly = false,
  summaryContext,
}: InspectorPanelProps) {
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)
  const resultsStatus = useCanvasStore(s => s.results?.status)
  const resultsReport = useCanvasStore(s => s.results?.report)
  const isResultsMode = resultsStatus === 'complete'
  // The SAME composed reader the dock and the Reasoning tab use: never a second
  // spelling of "may this run be ranked".
  const rankingWithheld = rankingWasWithheld(useResultsSectionData().recommendation)
  const canvasOptionOrder = useMemo(
    () => nodes.filter((n) => n.type === 'option' || (n.data as { type?: string } | undefined)?.type === 'option').map((n) => n.id),
    [nodes],
  )

  const node = nodeId ? nodes.find(n => n.id === nodeId) : undefined

  // A8 — a "Contributes to your goal N%" bar used to render here, computed as
  // `abs(strength) × 100` on the outbound goal edge. No producer field says
  // how much an outcome contributes to a goal; that was a UI-invented number
  // dressed as one. Removed rather than reworded.

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
          label: resolveElementLabel(src?.data),
          strength: resolveEdgeSignedStrengthDisplay(e.data as Record<string, unknown> | undefined),
        }
      })
  }, [edges, nodes, nodeId])

  if (!nodeId || !node) return null

  const description = String(node.data?.description ?? '')

  return (
    <div>
      <InspectorSummary sentence="Likelihood and impact are not recorded. That does not imply low risk." />
      {summaryContext}
      {readOnly && (
        <p data-testid="outcome-authority-route" className={`${typography.panelBody} text-text-body mt-2`}>
          To record likelihood or impact, ask Olumi.
        </p>
      )}
      {description.trim() && (
        <p className={`${typography.panelBody} text-text-body mt-2 whitespace-pre-wrap break-words`}>{description}</p>
      )}

      {/* ── Predicted range group ─────────────────────────────── */}
      {(!isResultsMode || (!isOptionComparisonFailed(resultsReport) && hasOptionComparisonData(resultsReport))) && (
        <PanelGroup kind="impact">
          <InlineSectionLabel>{SECTION_TITLES.predictedRange.label}</InlineSectionLabel>
          <StaleGuardBanner hasResults={isResultsMode}>
            {isResultsMode ? (
              <OptionComparisonSection
                report={resultsReport}
                techMode={techMode}
                onNavigate={onNavigate}
                rankingWithheld={rankingWithheld}
                canvasOptionOrder={canvasOptionOrder}
              />
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
        <InspectorConnectPicker nodeId={nodeId} />
        <InspectorCoaching
          elementId={nodeId}
          panelType="outcome"
          fallbackText={COACHING.outcomeCompleteness}
          labelContext={{ label: String(node.data?.label ?? '') }}
        />
      </PanelGroup>

      {/* ── Expert-only model detail ──────────────────────────── */}
      {/* ⚠ `OutcomeAdvancedEditor`'s Description field commits
          `setDescription`, a bare store write with no carrier — fenced here
          exactly as the factor pane fences its editor (review 2038). */}
      <InspectorMoreItems>
        <TechnicalDisclosure visible={techMode}>
          <fieldset disabled={readOnly} className="contents" data-writer-fence="advanced-editor">
            <OutcomeAdvancedEditor nodeId={nodeId} />
          </fieldset>
        </TechnicalDisclosure>
      </InspectorMoreItems>
    </div>
  )
})

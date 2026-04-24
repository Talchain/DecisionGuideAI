/**
 * ResultsBody — Pure-props results body extracted from OutputsDock.
 *
 * Renders the four-section v7 layout (Hero, Options Comparison, Drivers, Strengthen)
 * plus adjustments and spacer. Accepts all data via props — no canvas store dependency.
 *
 * Used by:
 * - OutputsDock (runtime, with real data from useResultsSectionData + canvas store)
 * - Storybook stories (with fixture data)
 */

import { useRef, useCallback, useMemo, memo, useState } from 'react'
import { Eye } from 'lucide-react'
import { typography } from '../../styles/typography'
import type { ResultsSectionDataReturn } from './useResultsSectionData'
import { buildResultsVM } from './buildResultsVM'
import type { GuidanceItem } from '../../canvas/stores/guidanceStore'
import { DriversSection } from './DriversSection'
import { TornadoChart, type TornadoRow } from './TornadoChart'
import { Accordion } from './Accordion'
import { SectionHeader } from './SectionHeader'
import { OptionCards } from './OptionCards'
import { WinGauge } from './WinGauge'
import { AdvancedSection } from './AdvancedSection'
import { ChallengeSection } from './ChallengeSection'
import { groupActionItems, type ActionItem } from './utils/groupActionItems'
import type { EvidenceGapItem } from './types'
import { SectionErrorBoundary } from '../../canvas/components/SectionErrorBoundary'
import { MissingKnowledgePrompt } from '../shared/MissingKnowledgePrompt'
import { ResultsFooter } from './ResultsFooter'
import { DecisionConfidencePanel } from './DecisionConfidencePanel'

type RiskAppetite = 'conservative' | 'neutral' | 'aggressive'

export interface StrengthCorrectionDisplay {
  edgeId: string
  from: string
  to: string
  original: number
  clamped: number
}

export interface ResultsBodyProps {
  resultsSectionData: ResultsSectionDataReturn
  tornadoData: { rows: TornadoRow[]; expectedOutcome: number | null }
  highlightedDriverId?: string | null
  registerDriverRef?: (factorKey: string, el: HTMLDivElement | null) => void
  strengthCorrections?: StrengthCorrectionDisplay[]
  onFocusNode?: (nodeId: string) => void
  isRunning?: boolean
  onAddStatusQuoBaseline?: () => void
  onApplyThreshold?: (threshold: number | null) => void
  onAddBaseline?: () => void
  onSetBaseline?: (optionId: string) => void
  nSamples?: number | null
  seedUsed?: number | null
  fragileEdgeCount?: number
  robustEdgeCount?: number
  responseHash?: string
  nodeCount?: number
  edgeCount?: number
  identifiability?: string | null
  /** Goal direction for tornado bar colouring — maximize means higher outcome = good */
  goalDirection?: 'maximize' | 'minimize'
  /**
   * Orchestrator guidance items for the results surface.
   * When present (length > 0), replaces NextActionItem list in "Your next steps".
   * Only items with target_object.type in {graph, option, framing} or no target_object
   * are passed here — node/edge items are filtered out by the caller.
   */
  guidanceItems?: GuidanceItem[]
  /** Callback to activate a guidance item (sets activeGuidanceItemId in store) */
  onActivateGuidanceItem?: (itemId: string) => void
  /** Transition bridge: count of items user verified pre-analysis */
  verifiedCount?: number
  /** Transition bridge: weighted influence fraction user covered */
  influenceCoverage?: number
  /** Controlled expansion state for Drivers accordion (for canvas sync) */
  driversExpanded?: boolean
  /** Callback when Drivers accordion expansion changes */
  onDriversExpandChange?: (expanded: boolean) => void
  /** Handler for sending a message to the conversation panel */
  onSendMessage?: (text: string) => void
  /** Handler for confirming a factor value (triage cards) */
  onConfirmFactor?: (nodeId: string) => void
  /** Handler for setting a factor value via inline editor (triage cards) */
  onSetFactorValue?: (nodeId: string, rawValue: number) => void
  /** Whether expert mode is active (shows technical details) */
  expertMode?: boolean
  /** Lookup: factor node ID → current observed value + unit/cap (for pre-filling triage card editors) */
  nodeValueLookup?: Record<string, { value: number | null; unit: string | null; cap: number | null; displayValue?: string | null }>
  /** When true, suppress mutation affordances (Set value, Confirm, action buttons) until rerun completes. */
  isStale?: boolean
}

export const ResultsBody = memo(function ResultsBody({
  resultsSectionData,
  tornadoData,
  highlightedDriverId,
  registerDriverRef,
  strengthCorrections = [],
  onFocusNode,
  isRunning,
  onAddStatusQuoBaseline,
  onApplyThreshold,
  onAddBaseline,
  onSetBaseline,
  nSamples,
  seedUsed,
  fragileEdgeCount,
  robustEdgeCount,
  responseHash,
  nodeCount,
  edgeCount,
  identifiability,
  goalDirection,
  guidanceItems,
  verifiedCount,
  influenceCoverage,
  driversExpanded,
  onDriversExpandChange,
  onSendMessage,
  onConfirmFactor,
  onSetFactorValue,
  expertMode,
  nodeValueLookup,
  isStale,
}: ResultsBodyProps) {
  // Brief 4 Task 13 + Phase 8 P0 #4: suppress mutation affordances while
  // results are stale so users don't edit a factor based on a display that
  // no longer matches the analysis. Read-only affordances (focus node,
  // hover highlights, AI discuss) remain active. Baseline/threshold
  // handlers are declared on this component but not currently wired to
  // the children that consume them, so we only gate the two that are.
  const staleOnConfirmFactor = isStale ? undefined : onConfirmFactor
  const staleOnSetFactorValue = isStale ? undefined : onSetFactorValue

  // Risk appetite toggle — Conservative: highest p10, Neutral: highest win prob, Aggressive: highest p90
  const [riskAppetite, setRiskAppetite] = useState<RiskAppetite>('neutral')

  const riskWinnerId = useMemo(() => {
    const opts = resultsSectionData.recommendation.allOptions
    if (opts.length <= 1) return resultsSectionData.recommendation.recommendedOption?.id
    if (riskAppetite === 'conservative') {
      const best = [...opts].sort((a, b) => (b.outcome?.p10 ?? b.p10 ?? 0) - (a.outcome?.p10 ?? a.p10 ?? 0))[0]
      return best?.id
    }
    if (riskAppetite === 'aggressive') {
      const best = [...opts].sort((a, b) => (b.outcome?.p90 ?? b.p90 ?? 0) - (a.outcome?.p90 ?? a.p90 ?? 0))[0]
      return best?.id
    }
    return resultsSectionData.recommendation.recommendedOption?.id
  }, [riskAppetite, resultsSectionData.recommendation])

  // V11: Build enriched view model — drives hero rows, colours, collapse behaviour
  // Evidence ratio: fragile / (fragile + robust) = robustness-assessed edges only
  const robustnessEdgeTotal = (fragileEdgeCount ?? 0) + (robustEdgeCount ?? 0)
  const vm = useMemo(
    () => buildResultsVM(resultsSectionData, {
      fragileEdgeCount,
      totalEdgeCount: robustnessEdgeTotal,
    }),
    [resultsSectionData, fragileEdgeCount, robustnessEdgeTotal],
  )

  // Guidance items present → replace NextActionItem system throughout results panel
  const hasGuidanceItems = (guidanceItems?.length ?? 0) > 0

// Phase 2.3: Cross-highlight — flash an option card when a GraphLink references it
  const optionCardRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const flashOptionCard = useCallback((optionId: string) => {
    const el = optionCardRefs.current.get(optionId)
    if (!el) return
    el.classList.remove('cflash')
    void el.offsetWidth // force reflow to restart animation
    el.classList.add('cflash')
  }, [])

  return (
    <div className="flex flex-col gap-4" data-testid="outputs-results-redesign">

      {/* ── DECISION CONFIDENCE TRIAGE ────────────────────────────── */}
      <SectionErrorBoundary section="Decision confidence">
        <DecisionConfidencePanel
          data={resultsSectionData}
          onFocusNode={onFocusNode}
          verifiedCount={verifiedCount}
          influenceCoverage={influenceCoverage}
          onSendMessage={onSendMessage}
          onConfirm={staleOnConfirmFactor}
          onSetValue={staleOnSetFactorValue}
          expertMode={expertMode}
          nodeValueLookup={nodeValueLookup}
        />
      </SectionErrorBoundary>

      {/* Old RecommendationSection/HeroSection suppressed — triage panel replaces it */}

      {/* ── SECTION 2: OPTIONS COMPARISON ────────────────────────── */}
      {!resultsSectionData.recommendation.isSingleOption &&
       resultsSectionData.recommendation.allOptions.length > 1 && (
        <SectionErrorBoundary section="Options comparison">
          <div className="space-y-2 border border-panel-border rounded-lg p-3">
            <SectionHeader
              title="Your options"
              testId="section-header-options"
              sectionColorMarker="bg-option"
            />
            {/* WinGauge — moved from hero to top of options section */}
            <WinGauge
              shares={resultsSectionData.recommendation.allOptions
                .filter((o): o is typeof o & { winProbability: number } => typeof o.winProbability === 'number')
                .map(o => ({
                  id: o.id,
                  label: o.label,
                  winProbability: o.winProbability,
                  isWinner: o.isRecommended,
                }))}
              decisionState={vm.decisionState}
            />
            {/* Brief 5 Task 6: display-filter control — reweights which option
                is surfaced as winner (p10/winProb/p90). Local state, not
                persisted. Label + helper disambiguate from the persistent
                "Risk profile" control in AdvancedSection. Extracted into an
                exported sub-component so the control can be rendered in
                isolation by the visual-regression harness. */}
            {resultsSectionData.recommendation.allOptions.some(o => (o.outcome?.p10 ?? o.p10) != null) && (
              <RiskAppetiteFilter value={riskAppetite} onChange={setRiskAppetite} />
            )}
            <OptionCards
              options={resultsSectionData.recommendation.allOptions}
              winnerId={riskWinnerId ?? resultsSectionData.recommendation.recommendedOption?.id}
              onSendMessage={onSendMessage}
              hasGoalThreshold={resultsSectionData.recommendation.goalThreshold != null}
              storyHeadlines={resultsSectionData.recommendation.storyHeadlines}
              cardRefMap={optionCardRefs}
              decisionState={riskAppetite === 'neutral' ? vm.decisionState : undefined}
              hinge={riskAppetite === 'neutral' ? vm.hinge : null}
              runnerId={
                // V12.2 Fix 1: Runner-up is highest by win_probability excluding winner
                [...resultsSectionData.recommendation.allOptions]
                  .filter(o => o.id !== (riskWinnerId ?? resultsSectionData.recommendation.recommendedOption?.id))
                  .sort((a, b) => (b.winProbability ?? 0) - (a.winProbability ?? 0))[0]?.id
              }
              expertMode={expertMode}
              confidenceTier={resultsSectionData.confidence.tier.tier}
              recommendationStability={resultsSectionData.recommendation.recommendationStability}
            />
            {/* TippingPoints removed — superseded by TornadoChart (Brief 5.4 Phase 1) */}
          </div>
        </SectionErrorBoundary>
      )}

      {/* ── SECTION 3: DRIVERS ──────────────────────────────────── */}
      <Accordion
        title="What's driving this"
        subtitle="Factors with the strongest current influence on the result"
        defaultExpanded={false}
        isExpanded={driversExpanded}
        onExpandChange={onDriversExpandChange}
        count={resultsSectionData.drivers.totalCount}
        badgeState={resultsSectionData.drivers.totalCount > 0 ? 'unresolved' : undefined}
        testId="accordion-drivers"
      >
        <SectionErrorBoundary section="Drivers">
          <DriversSection
            data={resultsSectionData.drivers}
            onFocusNode={onFocusNode}
            onSendMessage={onSendMessage}
            expertMode={expertMode}
            goalLabel={resultsSectionData.goalLabel}
            highlightedDriverId={highlightedDriverId}
            registerDriverRef={registerDriverRef}
            outcomeUnit={resultsSectionData.recommendation.outcomeUnit}
            outcomeUnitSymbol={resultsSectionData.recommendation.outcomeUnitSymbol}
            isNormalised={resultsSectionData.recommendation.isNormalised}
          />
        </SectionErrorBoundary>
      </Accordion>

      {/* ── SECTION 3b: WHAT COULD CHANGE THE RESULT ──────────── */}
      {tornadoData.rows.length > 0 && tornadoData.expectedOutcome != null && (
        <Accordion
          title="What could change the result"
          defaultExpanded={false}
          testId="accordion-tornado"
        >
          <SectionErrorBoundary section="Tornado">
            <TornadoChart
              rows={tornadoData.rows}
              expectedOutcome={tornadoData.expectedOutcome}
              outcomeUnit={resultsSectionData.recommendation.outcomeUnit}
              outcomeUnitSymbol={resultsSectionData.recommendation.outcomeUnitSymbol}
              onFocusNode={onFocusNode}
              isNormalised={resultsSectionData.recommendation.isNormalised}
              goalDirection={goalDirection}
              flipThresholds={resultsSectionData.recommendation.flipThresholds}
            />
          </SectionErrorBoundary>
        </Accordion>
      )}

      {/* ── SECTION 4: YOUR NEXT STEPS ──────────────────────────── */}
      {/* V11: Collapse behaviour driven by decisionState, not robustness level */}
      <SectionErrorBoundary section="Your next steps">
      {(() => {
        // "Your next steps" suppressed — triage panel (DecisionConfidencePanel) absorbs this function

        // V12 B5: ChallengeSection only visible when review_status === 'complete'
        const reviewComplete = resultsSectionData.confidence.reviewStatus === 'complete'
        let biasFindings: ActionItem[] = []
        let preMortemItems: ActionItem[] = []
        if (reviewComplete) {
          const m2Groups = groupActionItems({
            fragileEdges: [],
            evidenceGaps: [],
            biasFindings: resultsSectionData.confidence.m2BiasFindings ?? undefined,
            preMortem: resultsSectionData.confidence.m2DecisionQualityPrompts ?? undefined,
          })
          biasFindings = m2Groups[2].items
          preMortemItems = m2Groups[3].items
        }

        return (
          <>
            {/* ── SECTION 4b: STRESS-TEST YOUR DECISION (M2) ────── */}
            {(() => {
              // Merged fragile cards: capped at 3 (matches ChallengeSection logic)
              const mergedFragileCount = Math.min(3, (resultsSectionData.confidence.challengeFragileEdges ?? []).length)
              const warningCount = (resultsSectionData.confidence.inferenceWarnings ?? []).length
              const identCount = identifiability ? 1 : 0
              const challengeTotal = biasFindings.length + preMortemItems.length + mergedFragileCount + warningCount + identCount
              if (challengeTotal === 0) return null
              return (
              <div>
                <Accordion
                  title="Before you decide"
                  defaultExpanded={false}
                  testId="accordion-before-commit"
                  badgeCount={challengeTotal}
                  badgeState={challengeTotal > 0 ? 'unresolved' : undefined}
                >
                  <ChallengeSection
                    biasFindings={biasFindings}
                    preMortemItems={preMortemItems}
                    onFocusNode={onFocusNode}
                    onSendMessage={onSendMessage}
                    evidenceGaps={resultsSectionData.confidence.evidenceGaps as EvidenceGapItem[] | undefined}
                    drivers={resultsSectionData.drivers.drivers}
                    edgeEValues={resultsSectionData.confidence.edgeEValues}
                    fragileEdges={resultsSectionData.confidence.challengeFragileEdges}
                    identifiabilityTag={identifiability}
                    expertMode={expertMode}
                  />
                </Accordion>
              </div>
              )
            })()}
          </>
        )
      })()}
      </SectionErrorBoundary>

      {/* ── SOMETHING MISSING PROMPT ──────────────────────────── */}
      <MissingKnowledgePrompt context="results" />

      {/* ── SECTION 5: ADVANCED ───────────────────────────────── */}
      <SectionErrorBoundary section="Advanced">
      <div>
        <AdvancedSection
          stability={resultsSectionData.recommendation.recommendationStability}
          nSamples={nSamples}
          seedUsed={seedUsed}
          fragileEdgeCount={fragileEdgeCount}
          robustEdgeCount={robustEdgeCount}
          nodeCount={nodeCount}
          edgeCount={edgeCount}
          identifiability={identifiability}
          responseHash={responseHash}
          m2NarrativeSummary={resultsSectionData.recommendation.m2NarrativeSummary}
          coachingReadinessDimensions={resultsSectionData.recommendation.coachingReadinessDimensions}
          identifiabilityTag={identifiability}
          winnerWinProbability={resultsSectionData.recommendation.recommendedOption?.winProbability}
          robustnessLevel={resultsSectionData.recommendation.robustnessLevel}
          expertMode={expertMode}
          inferenceWarnings={resultsSectionData.confidence.inferenceWarnings}
        />
      </div>
      </SectionErrorBoundary>

      {/* Adjustments Made: Show any strength corrections applied during this run */}
      {strengthCorrections.length > 0 && (
        <SectionErrorBoundary section="Adjustments">
          <details className="border border-panel-border rounded-lg overflow-hidden">
            <summary className={`px-3 py-2 bg-panel cursor-pointer hover:bg-panel-hover ${typography.caption} text-text-body`}>
              {strengthCorrections.length} edge strength{strengthCorrections.length > 1 ? 's' : ''} adjusted
            </summary>
            <div className="p-3 space-y-1">
              {strengthCorrections.map((c, idx) => (
                <div key={idx} className={`${typography.code} text-text-light`}>
                  &quot;{c.from} → {c.to}&quot;: {c.original.toFixed(2)} → {c.clamped.toFixed(1)}
                </div>
              ))}
            </div>
          </details>
        </SectionErrorBoundary>
      )}

      {/* Footer metadata — replaces the 56px spacer */}
      <ResultsFooter
        stability={resultsSectionData.recommendation.recommendationStability}
        confidenceTier={resultsSectionData.confidence.tier.tier}
        coachingReadiness={resultsSectionData.recommendation.coachingReadiness}
      />

      {/* V14.3b: Dev-only build marker for deploy verification */}
      {import.meta.env.DEV && (
        <div className={`${typography.panelMeta} text-text-light/40 text-center py-1`} data-testid="dev-build-marker">
          {typeof __GIT_SHA__ !== 'undefined' ? __GIT_SHA__ : 'dev'}
        </div>
      )}
    </div>
  )
})

/**
 * Brief 5 Task 6: display-filter control ("Show winner by:") paired with the
 * persistent "Risk profile" control in AdvancedSection. Extracted from the
 * inline JSX in ResultsBody so it can be rendered in isolation by the
 * visual-regression harness (see analysis-tab.spec.ts).
 */
export interface RiskAppetiteFilterProps {
  value: RiskAppetite
  onChange: (next: RiskAppetite) => void
}

export function RiskAppetiteFilter({ value, onChange }: RiskAppetiteFilterProps) {
  return (
    <div data-testid="winner-by-control">
      <div className="flex items-center gap-1.5">
        {/* Brief 5.1 Task 6: eye icon signals "view filter" (what you see
            right now), distinguishing this display-only control from the
            persistent "Risk profile" radio group in AdvancedSection. */}
        <Eye size={12} className="text-text-light flex-shrink-0" aria-hidden="true" />
        <span className={`${typography.panelMeta} text-text-light`}>Show winner by:</span>
        {(['conservative', 'neutral', 'aggressive'] as const).map(appetite => (
          <button
            key={appetite}
            type="button"
            onClick={() => onChange(appetite)}
            className={`px-2 py-0.5 rounded-full ${typography.panelMeta} border cursor-pointer capitalize ${
              value === appetite
                ? 'border-info/60 text-info bg-transparent'
                : 'border-panel-border text-text-light bg-transparent hover:border-info/30 hover:text-text-body'
            }`}
          >
            {appetite.charAt(0).toUpperCase() + appetite.slice(1)}
          </button>
        ))}
      </div>
      <p className={`${typography.panelMeta} text-text-light italic mt-1`}>
        Display filter: reweights which option is shown as winner.
      </p>
    </div>
  )
}

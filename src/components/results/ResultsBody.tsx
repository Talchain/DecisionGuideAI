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

import { useRef, useMemo, memo, useState } from 'react'
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
import { AdvancedSection, RiskAppetiteFilter, type RiskAppetite } from './AdvancedSection'
import { StressTestSection } from './StressTestSection'
import { SectionErrorBoundary } from '../../canvas/components/SectionErrorBoundary'
import { DiscussWithAiButton } from '@/canvas/components/pre-analysis/DiscussWithAiButton'
import { DecisionConfidencePanel } from './DecisionConfidencePanel'
import { AnalysisHeroV17 } from './AnalysisHeroV17'
import { isAnalysisHeroV17Enabled, isAnalysisHeroCompareEnabled } from '@/flags'

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
  isRunning: _isRunning,
  onAddStatusQuoBaseline: _onAddStatusQuoBaseline,
  onApplyThreshold: _onApplyThreshold,
  onAddBaseline: _onAddBaseline,
  onSetBaseline: _onSetBaseline,
  nSamples,
  seedUsed,
  fragileEdgeCount,
  robustEdgeCount,
  responseHash,
  nodeCount,
  edgeCount,
  identifiability,
  goalDirection,
  guidanceItems: _guidanceItems,
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

// Phase 2.3: Cross-highlight — flash an option card when a GraphLink references it
  const optionCardRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  // Analysis hero v17 — flag-gated substitution. When `analysisHeroV17` is on,
  // AnalysisHeroV17 renders INSTEAD OF DecisionConfidencePanel. When
  // `analysisHeroCompare` is on (regardless of v17), BOTH render with v17 above
  // — opt-in comparison mode for internal review only.
  // See docs/brief-analysis-hero-v17-implementation.md §3 step 10.
  const showV17 = isAnalysisHeroV17Enabled()
  const showCompare = isAnalysisHeroCompareEnabled()

  const aiAffordance = (
    <DiscussWithAiButton
      element={{ kind: 'missing' }}
      ariaLabel="Tell AI about something missing from the results"
    />
  )

  const heroV17Element = (
    <AnalysisHeroV17
      data={resultsSectionData}
      vm={vm}
      fragileEdgeCount={fragileEdgeCount}
      onFocusNode={onFocusNode}
      verifiedCount={verifiedCount}
      influenceCoverage={influenceCoverage}
      onConfirm={staleOnConfirmFactor}
      onSetValue={staleOnSetFactorValue}
      expertMode={expertMode}
      nodeValueLookup={nodeValueLookup}
      onSendMessage={onSendMessage}
      aiAffordance={aiAffordance}
    />
  )

  const decisionConfidenceElement = (
    <DecisionConfidencePanel
      data={resultsSectionData}
      onFocusNode={onFocusNode}
      verifiedCount={verifiedCount}
      influenceCoverage={influenceCoverage}
      onConfirm={staleOnConfirmFactor}
      onSetValue={staleOnSetFactorValue}
      expertMode={expertMode}
      nodeValueLookup={nodeValueLookup}
      onSendMessage={onSendMessage}
      aiAffordance={aiAffordance}
    />
  )

  return (
    <div className="flex flex-col gap-4" data-testid="outputs-results-redesign">

      {/* ── DECISION CONFIDENCE TRIAGE ────────────────────────────── */}
      {/* Comparison mode: v17 ABOVE legacy panel. Opt-in only. */}
      {showCompare && (
        <SectionErrorBoundary section="Analysis hero v17">
          {heroV17Element}
        </SectionErrorBoundary>
      )}
      <SectionErrorBoundary section="Decision confidence">
        {showV17 && !showCompare ? heroV17Element : decisionConfidenceElement}
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
            {/* Brief 5.8B follow-up (P1.5): risk-appetite display filter
                relocated here from Advanced. Keeps the option-level toggle
                co-located with the option cards it reweights. */}
            {resultsSectionData.recommendation.allOptions.some(o => (o.outcome?.p10 ?? o.p10) != null) && (
              <RiskAppetiteFilter value={riskAppetite} onChange={setRiskAppetite} />
            )}
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
        // Brief 5.8B D4: legacy ChallengeSection accordion replaced with
        // StressTestSection ("Stress-test your decision"). The new T2 accordion
        // renders sensitive assumptions (node-based, rank_flip_rate ≥ 0.15),
        // two deterministic thinking-pattern cards, and the existing 5.7 D11
        // alt-winner fragile-factor grouping verbatim. See StressTestSection.tsx.
        return (
          <>
            {/* ── SECTION 4b: STRESS-TEST YOUR DECISION (M2) ────── */}
            {(() => {
              const winnerLabel = resultsSectionData.recommendation.recommendedOption?.label
              if (!winnerLabel) return null
              const allOptions = resultsSectionData.recommendation.allOptions
              const runnerUp = allOptions
                .filter(o => o.id !== resultsSectionData.recommendation.recommendedOption?.id)
                .sort((a, b) => (b.winProbability ?? 0) - (a.winProbability ?? 0))[0]
              const alternativeLabel = runnerUp?.label ?? 'an alternative option'
              return (
                <StressTestSection
                  drivers={resultsSectionData.drivers.drivers}
                  fragileEdges={resultsSectionData.confidence.challengeFragileEdges}
                  winnerLabel={winnerLabel}
                  alternativeLabel={alternativeLabel}
                  onFocusNode={onFocusNode}
                  onSendMessage={onSendMessage}
                  expertMode={expertMode}
                />
              )
            })()}
          </>
        )
      })()}
      </SectionErrorBoundary>

      {/* Brief 5.8B D2c: standalone MissingKnowledgePrompt removed —
          rendered inline inside the T1 checks footer (DecisionConfidencePanel)
          to avoid duplicating the affordance. */}

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
            <summary className={`px-3 py-2 bg-panel cursor-pointer hover:bg-panel-hover ${typography.panelBody} text-text-body`}>
              {strengthCorrections.length} edge strength{strengthCorrections.length > 1 ? 's' : ''} adjusted
            </summary>
            <div className="p-3 space-y-1">
              {/* typography.code: §2.1 exception — mono rendering for old→new correction values */}
              {strengthCorrections.map((c, idx) => (
                <div key={idx} className={`${typography.code} text-text-light`}>
                  &quot;{c.from} → {c.to}&quot;: {c.original.toFixed(2)} → {c.clamped.toFixed(1)}
                </div>
              ))}
            </div>
          </details>
        </SectionErrorBoundary>
      )}

      {/* Brief 5.8B D8: legacy ResultsFooter (the source of the
          "Stability sensitive · 62% of influence · 97%" orphan-text
          flagged in D6) deleted. The wireframe-aligned footer is owned
          by AnalysisFooter inside OutputsDock — re-skinned in D8 with
          deterministic stability bands + evidence-gap meta. */}

      {/* Brief 5.8B follow-up: build marker now also requires expert mode.
          The marker was previously visible on every dev/staging deploy and
          surfaced as an orphan SHA (e.g. "45fbb4a") in screenshots. Gate
          extracted into `DevBuildMarker` so the production-vs-expert
          combination is unit-testable. */}
      <DevBuildMarker isDev={import.meta.env.DEV} expertMode={!!expertMode} sha={typeof __GIT_SHA__ !== 'undefined' ? __GIT_SHA__ : 'dev'} />
    </div>
  )
})

/**
 * DevBuildMarker — Brief 5.8B post-D4 polish. Renders the SHA marker only
 * when `isDev && expertMode` to prevent the orphan hash from surfacing
 * by default on dev/staging deploys. Inputs supplied as props (rather
 * than read inline from `import.meta.env`) so the gate is unit-testable
 * without depending on Vite's pre-baked env.
 */
export function DevBuildMarker({
  isDev,
  expertMode,
  sha,
}: {
  isDev: boolean
  expertMode: boolean
  sha: string
}) {
  if (!isDev || !expertMode) return null
  return (
    <div className={`${typography.panelMeta} text-text-light/40 text-center py-1`} data-testid="dev-build-marker">
      {sha}
    </div>
  )
}

// RiskAppetiteFilter and RiskAppetiteFilterProps moved to AdvancedSection.tsx (D3).
export type { RiskAppetite, RiskAppetiteFilterProps } from './AdvancedSection'
export { RiskAppetiteFilter } from './AdvancedSection'

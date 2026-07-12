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
import { useCanvasStore } from '../../canvas/store'
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
import { AnalysisOrphanBanner } from './AnalysisOrphanBanner'
import { WhatChangedChip } from '../../canvas/components/WhatChangedChip'
import { InferenceWarningStrip } from './InferenceWarningStrip'
import { FocusNowContainer } from '@/canvas/components/coaching-panel/focus-now'
import { AnalysisHeroContainer } from './analysis-hero'
import { isAnalysisHeroV17Enabled, isAnalysisHeroCompareEnabled, isFocusNowPanelEnabled, isAnalysisHeroPanelEnabled } from '@/flags'

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
  onApplyThreshold,
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
  // UI-SEM-065 input: engine blocker/approximate critiques live on
  // graphHealth (ValidationPanel's source), not on confidence.uncertainties.
  const engineDegradedCritique = useCanvasStore(s =>
    (s.graphHealth?.issues ?? []).some(
      (i: { severity?: string; code?: string }) => i.code === 'GRAPH_TOO_LARGE' || i.severity === 'blocker',
    ),
  )
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

  // Wave 2 (§6.4): identity-anchored ordinals for the option cards — the
  // SAME store map the hero badges consume, provided all-or-nothing (a
  // partially registered set could render duplicate numbers next to
  // positional ranks) and ONLY inside the rebuild flag: flag-off cards are
  // byte-identical to today.
  const optionNumbering = useCanvasStore(s => s.optionNumbering)
  const stableNumbersForCards = useMemo(() => {
    if (!isAnalysisHeroPanelEnabled()) return undefined
    const all = resultsSectionData.recommendation.allOptions
    if (all.length === 0 || all.some(o => optionNumbering[o.id] == null)) return undefined
    return optionNumbering
  }, [optionNumbering, resultsSectionData.recommendation.allOptions])

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

      {/* Orphan banner — Results from a non-CEE path with no run_analysis
          fact for the scenario. Renders only when canonical flag is ON and
          there is no V5 fact attached. */}
      <AnalysisOrphanBanner />

      {/* Freshness/staleness — CEE analysis_ready.freshness verdict. Renders
          nothing until a verdict exists; never asserts a state we don't hold. */}
      {/* Freshness strip mounts in OutputsDock ABOVE the dim wrapper (Wave F-B review a) */}

      {/* Roadmap 1.12 (provisional_doctrine_v0): warning-severity producer
          inference_warnings surface as a compact honest-caveat strip beside
          the freshness area. Producer message verbatim; info-severity stays
          hidden; renders nothing when no warning-severity entries exist. */}
      <InferenceWarningStrip warnings={resultsSectionData.confidence.inferenceWarnings} />

      {/* Seamlessness R6 / ROADMAP 2.1 slice 1: run-over-run delta chip.
          Client-side diff of the two most recent stored runs; self-hides on
          first runs or zero delta; click pulses the surviving changes. */}
      <WhatChangedChip />

      {/* ── ANALYSIS HERO (answer-first lens hero) ─────────────────
          Feature-flagged (staging-on, production-off). Read-only
          presentation over the SAME resultsSectionData object the panels
          below consume — mounted ABOVE the existing hero block; flag off
          renders nothing and the tab is unchanged. */}
      {isAnalysisHeroPanelEnabled() && (
        <SectionErrorBoundary section="Analysis hero">
          <AnalysisHeroContainer
            data={resultsSectionData}
            isStale={isStale}
            onApplyTarget={onApplyThreshold}
          />
        </SectionErrorBoundary>
      )}

      {/* ── DECISION CONFIDENCE TRIAGE ────────────────────────────── */}
      {/* Wave 2 flag-scoped retirement: when the merged analysis panel is
          on, the hero above OWNS this slot — mounting both would be the
          §12.4 two-headline duplication the rebuild removes. Flag off,
          today's panel (and the v17 comparison machinery) render exactly
          as before; rollback is the flag. */}
      {!isAnalysisHeroPanelEnabled() && (
        <>
          {/* Comparison mode: v17 ABOVE legacy panel. Opt-in only. */}
          {showCompare && (
            <SectionErrorBoundary section="Analysis hero v17">
              {heroV17Element}
            </SectionErrorBoundary>
          )}
          <SectionErrorBoundary section="Decision confidence">
            {showV17 && !showCompare ? heroV17Element : decisionConfidenceElement}
          </SectionErrorBoundary>
        </>
      )}

      {/* ── SECOND PANEL: Strengthen your model (Focus) ───────────────
          Static / fail-closed coaching panel mounted directly after the hero.
          coaching_summary stays gated off; no server/dynamic/readiness/bias rows.
          Default-ON flag (kill switch); suppresses its own stale banner (the tab's
          AnalysisFreshnessNotice owns freshness). */}
      {isFocusNowPanelEnabled() && (
        <SectionErrorBoundary section="Strengthen your model">
          <FocusNowContainer />
        </SectionErrorBoundary>
      )}

      {/* Old RecommendationSection/HeroSection suppressed — triage panel replaces it */}

      {/* ── SECTION 2: OPTIONS COMPARISON ────────────────────────── */}
      {/* Critical analysis content — full options block renders identically
          regardless of V17 flag. CompactOptionSpread (kept in the repo as a
          potential supplementary affordance) is NOT used to replace this
          surface: users need WinGauge + RiskAppetiteFilter + OptionCards on
          the Analysis tab, including "What makes this lead" affordances and
          stability/range bars. (Reverted 2026-05-27, formerly Item 3 of the
          V17 power pass.) */}
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
            {/* Paul's ruling 2026-07-12: the risk-appetite view is an
                EXPLICITLY-LABELLED lens — it re-ranks only this section and
                never alters the recommendation, hero, graph or AI leader. */}
            {riskAppetite !== 'neutral' && (
              <p
                data-testid="risk-lens-label"
                className={`${typography.panelMeta} text-text-light`}
              >
                {riskAppetite === 'conservative'
                  ? 'Lens: cautious view, ranked by downside. The recommendation above is unchanged.'
                  : 'Lens: bold view, ranked by upside. The recommendation above is unchanged.'}
              </p>
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
              lensActive={riskAppetite !== 'neutral'}
              stableNumbers={stableNumbersForCards}
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
              leadingOptionDownsideFlag={resultsSectionData.recommendation.leadingOptionDownsideFlag}
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
            sensitivityReferenceLabel={resultsSectionData.sensitivityReference?.optionLabel ?? null}
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
            {/* Display-honesty: when PLoT classifies the post-denormalised
                flip_thresholds[] as all-no-effect or partial-no-effect,
                render one short explanatory line so absent markers do not
                read as actionable insight. Reuses panel typography only —
                no new colour or component. */}
            {resultsSectionData.recommendation.flipThresholdsStatus === 'all_no_effect' && (
              <p
                className={`${typography.panelBody} text-text-light mb-3`}
                data-testid="flip-thresholds-status-note"
                role="note"
              >
                No single tested factor changed the leading option within the current range.
              </p>
            )}
            {resultsSectionData.recommendation.flipThresholdsStatus === 'partial_no_effect' && (
              <p
                className={`${typography.panelBody} text-text-light mb-3`}
                data-testid="flip-thresholds-status-note"
                role="note"
              >
                {resultsSectionData.recommendation.flipThresholdsHasUnresolved
                  ? 'Some factors did not change the leading option within the current range, and others could not be resolved.'
                  : 'Some factors did not change the leading option within the current range.'}
              </p>
            )}
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
              // Audit §8 P1 (verdict honesty): pass the SAME robustness
              // signal the "Some analysis features unavailable … Robustness"
              // chip uses, plus a degraded flag (partial pass or
              // GRAPH_TOO_LARGE / blocker-severity engine critique), so the
              // empty state can distinguish didn't-run / degraded / clean.
              // UI-SEM-065: degraded-run derivation — remove when PLoT
              // provides a canonical degraded/approximate flag. Blocker
              // critiques never reach confidence.uncertainties (that list
              // ingests WARNING-severity only), so the approximate signal is
              // read from graphHealth — the same source ValidationPanel uses.
              const analysisDegraded =
                resultsSectionData.confidence.analysisStatus === 'partial'
                || engineDegradedCritique
              return (
                <StressTestSection
                  drivers={resultsSectionData.drivers.drivers}
                  fragileEdges={resultsSectionData.confidence.challengeFragileEdges}
                  winnerLabel={winnerLabel}
                  alternativeLabel={alternativeLabel}
                  robustnessStatus={resultsSectionData.confidence.robustnessStatus}
                  analysisDegraded={analysisDegraded}
                  onFocusNode={onFocusNode}
                  onSendMessage={onSendMessage}
                  expertMode={expertMode}
                  sensitivityReferenceLabel={resultsSectionData.sensitivityReference?.optionLabel ?? null}
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

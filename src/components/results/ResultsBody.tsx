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
import { deriveDefaultEstimateDisclosure } from './utils/defaultEstimateDisclosure'
import { flipThresholdStatusNote } from './utils/flipThresholdStatusNote'
import { DriversSection } from './DriversSection'
import { TornadoChart, type TornadoRow } from './TornadoChart'
import { Accordion } from './Accordion'
import { SectionHeader } from './SectionHeader'
import { OptionCards } from './OptionCards'
import { WinGauge } from './WinGauge'
import { AdvancedSection, RiskAppetiteFilter, LENS_ARM, type RiskAppetite } from './AdvancedSection'
import { selectLensOption } from './utils/selectLensOption'
import { LENS_COPY, runHasGoalNumbers } from './utils/goalAnchorCopy'
import { StressTestSection } from './StressTestSection'
import { SectionErrorBoundary } from '../../canvas/components/SectionErrorBoundary'
import { DiscussWithAiButton } from '@/canvas/components/pre-analysis/DiscussWithAiButton'
import { DecisionConfidencePanel } from './DecisionConfidencePanel'
import { AnalysisHeroV17 } from './AnalysisHeroV17'
import { WhatChangedChip } from '../../canvas/components/WhatChangedChip'
import { StrengthenContainer } from './strengthen/StrengthenContainer'
import { InferenceWarningStrip } from './InferenceWarningStrip'
import { FocusNowContainer } from '@/canvas/components/coaching-panel/focus-now'
import { AnalysisHeroContainer, KeyQuestionCard } from './analysis-hero'
import { V7TopMatter } from './v7/V7TopMatter'
import { openDefineSuccess, HowComputedTrigger } from './modals'
import { isAnalysisHeroV17Enabled, isAnalysisHeroCompareEnabled, isFocusNowPanelEnabled, isAnalysisHeroPanelEnabled, isStrengthenPanelEnabled } from '@/flags'

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
  onApplyThreshold?: (threshold: number | null) => void
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
  onApplyThreshold,
  nSamples,
  seedUsed,
  fragileEdgeCount,
  robustEdgeCount,
  responseHash,
  nodeCount,
  edgeCount,
  identifiability,
  goalDirection,
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
  // Lane 3 (SF2): the body now stays MOUNTED through a run — the same
  // rationale gates factor mutations mid-flight (don't commit edits against
  // a display whose run is being replaced).
  const suppressMutations = isStale || isRunning
  const staleOnConfirmFactor = suppressMutations ? undefined : onConfirmFactor
  const staleOnSetFactorValue = suppressMutations ? undefined : onSetFactorValue

  // ROADMAP 1.267 — QUOTED, never re-derived. `useResultsSectionData` already
  // resolved the one verdict (`deriveDecisionVerdict`, the same instance the
  // canvas reads) and returns it on `recommendation.verdict`; this body only
  // restates it as the boolean its two withheld-gated surfaces need (the
  // flip-threshold status note, and the UI-authored stress-test thinking
  // patterns). Absent verdict ⇒ NOT withheld, the same convention
  // `buildV7Lenses` and `buildHeroModel` use for a verdict-less caller, so no
  // fixture-driven mount changes behaviour.
  const designationsWithheld =
    resultsSectionData.recommendation.verdict != null
    && !resultsSectionData.recommendation.verdict.hasLeadingOption

  // Outcome-view lens — all three arms rank the SAME quantity family.
  const [riskAppetite, setRiskAppetite] = useState<RiskAppetite>('neutral')

  /**
   * ⭐ BEHAVIOUR CHANGE, accepted by Paul (§6.5 item 5). The middle arm used
   * to feature whichever option led on the COMPARATIVE quantity while the
   * other two arms ranked the outcome distribution — three quantities under
   * one control that said it was one view. It now ranks p50, so cautious /
   * middle / optimistic are p10 / p50 / p90 and nothing else.
   *
   * On runs where the p50 leader is not the comparative leader this changes
   * which option the middle arm features. That is the accepted change;
   * `utils/__tests__/selectLensOption.spec.ts` pins it on a fixture built to
   * make the two disagree.
   *
   * The Codex R3-SF3 discipline is preserved inside `selectLensOption`: a
   * missing metric is never defaulted to 0 (which let a data-less option
   * place in the ranking), and fewer than two comparable options reports
   * `comparable: false` rather than crowning anyone.
   *
   * ⚠ WHAT DID NOT CHANGE: the middle arm is still the default, un-overlaid
   * view — `lensActive` remains `riskAppetite !== 'neutral'` below, so the
   * middle arm's pick is derived but not painted. Making it overlay like the
   * other two would also flip the `decisionState` / `hinge` gating that keys
   * off the same value, which is a separate change.
   */
  // F3: whether this run has a goal ranking at all. The lens sentences and
  // the filter's own disclaimer both name what the lens leaves unchanged, and
  // on a no-target run that is NOT a goal ranking — ISL computes goal
  // probabilities only against a threshold.
  //
  // Derived INSIDE the lens memo, off the same dependency, rather than beside
  // it on every render: both are functions of the one option array, and the
  // one answer is then threaded to every consumer (the filter's disclaimer,
  // the lens sentences, and OptionCards) so no surface can re-derive a
  // different one.
  const { lensComparison, lensRunHasGoalNumbers } = useMemo(
    () => ({
      lensComparison: selectLensOption(
        resultsSectionData.recommendation.allOptions,
        LENS_ARM[riskAppetite],
      ),
      lensRunHasGoalNumbers: runHasGoalNumbers(resultsSectionData.recommendation.allOptions),
    }),
    [riskAppetite, resultsSectionData.recommendation],
  )

  // Wave 2 (§6.4): identity-anchored ordinals for the option cards — the
  // SAME store map the hero badges consume, provided all-or-nothing (a
  // partially registered set could render duplicate numbers next to
  // positional ranks) and ONLY inside the rebuild flag: flag-off cards are
  // byte-identical to today.
  const optionNumbering = useCanvasStore(s => s.optionNumbering)

  // B1 receipts: freshness reason (D1 'translate' branch input, unused while
  // the mode is 'omit') + local-hash provenance. Read directly from the store
  // here (same pattern as engineDegradedCritique / optionNumbering above) so
  // the receipts wiring needs no OutputsDock prop-plumbing (V2 cluster).
  const freshnessReason = useCanvasStore(s => s.analysisFreshness?.freshnessReason)
  const responseHashIsLocal = useCanvasStore(
    s => s.results?.report?.model_card?.response_hash_source === 'local',
  )
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

  // ── F10: the disclosure that existed and was wired to nothing ────────────
  // `AdvancedSection` has rendered "{N} of {M} factors use default confidence
  // values." since it was written, behind props NO CALL SITE PASSED —
  // `ResultsBody` omitted both and the only other caller passes neither. The
  // sentence the product should be showing about its own defaults was dead in
  // the tree while five surfaces printed the defaults themselves.
  //
  // Derived from the SAME `isDefaultedConfidence` flag the Drivers panel's
  // "Default estimate" pill uses (useResultsSectionData →
  // isDefaultedConfidenceFromRaw), so the count cannot disagree with the pills
  // it is counting. Omitted entirely when there are no drivers: "0 of 0" is
  // not a disclosure, it is noise.
  const defaultEstimateDisclosure = useMemo(
    () => deriveDefaultEstimateDisclosure(resultsSectionData.drivers.drivers),
    [resultsSectionData.drivers.drivers],
  )

  return (
    <div className="flex flex-col gap-4" data-testid="outputs-results-redesign">

      {/* ── P1-9 provenance: Model-Card-Lite entry point ───────────────────
          Sits above every number it explains so "where did that number come
          from?" is answerable without hunting. Gated on results being on
          screen — a method note for an analysis that has not run would be
          explaining numbers that do not exist. */}
      <HowComputedTrigger
        hasResults={(resultsSectionData.recommendation.allOptions?.length ?? 0) > 0}
      />

      {/* ══ V7 ASSESSMENT-MODE SCAFFOLD (V7 Lane L3) ═══════════════════════
          Paul's ruling (V6-RESPEC-2026-07-23 §1, "Option A GO — additive,
          never replace"): the panel renders in two stacked groups so Paul can
          assess new V7 components against today's live panel in one scroll.
          L3 is re-parenting + a divider ONLY — no component deleted, no logic
          changed, no flag. The Current-view group retires once Paul signs off
          (V6-RESPEC Paul-question P2). */}

      {/* ▛ V7 (new) top group ▟ — the L4–L6 mount point. `empty:hidden` keeps
          it out of layout until a lane fills it. L4 (V7 top matter — freshness
          strip, sharpen line, V7 hero + signal row + max-2 chips) mounts here;
          V7TopMatter returns null pre-analysis, so the group stays hidden until
          analysis data exists. Reads the SAME resultsSectionData + vm the live
          panel below consumes — additive, passthrough, no flag. */}
      <div className="flex flex-col gap-4 empty:hidden" data-testid="v7-top-group">
        <SectionErrorBoundary section="V7 top matter">
          <V7TopMatter
            resultsSectionData={resultsSectionData}
            decisionState={vm.decisionState}
            onFocusNode={onFocusNode}
            onSendMessage={onSendMessage}
          />
        </SectionErrorBoundary>
      </div>

      {/* ── "Current view" divider ─────────────────────────────────────────
          Plain SectionHeader-style separator (sentence case, muted, no accent
          fill). COMPLETE border only — the four-sided neutral border obeys the
          L1 rule (complete-borders guard); never a one-sided accent edge.
          Everything beneath is the shipped panel, re-parented, zero logic
          change. */}
      <div
        data-testid="assessment-current-view-divider"
        className="flex items-center rounded-lg border border-panel-border bg-panel px-3 py-1.5"
      >
        <h3 className={`${typography.panelMeta} text-text-light`}>Current view</h3>
      </div>

      {/* ── Current view group — today's components, UNCHANGED, pushed down ──
          Same order, same props, same stores as before L3. This wrapper only
          re-parents them beneath the divider; the inner `gap-4` preserves the
          exact inter-component spacing the outer container gave them. */}
      <div className="flex flex-col gap-4" data-testid="assessment-current-view-group">

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
        <>
          <SectionErrorBoundary section="Analysis hero">
            <AnalysisHeroContainer
              onDefineSuccess={openDefineSuccess}
              data={resultsSectionData}
              onApplyTarget={onApplyThreshold}
            />
          </SectionErrorBoundary>
          {/* ── 2.466 (P1): decision-quality KEY QUESTION + DSK grounding ──
              Fed from the LIVE turn state (runMeta.decisionReview030's
              verbatim DQP carry), presence-gated — never from the legacy
              m1ReviewAssumptions/reviewStatus pair that dark-shipped lane 1.
              Hosted INSIDE this flag arm on purpose: the V17 HeroKeyQuestion
              lives in the `!flag` arm below, so the two hosts are mutually
              exclusive by the same fork that owns the slot — no posture can
              double-render the grounding line. */}
          <SectionErrorBoundary section="Key question">
            <KeyQuestionCard />
          </SectionErrorBoundary>
        </>
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
      {/* Wave 3a: the adaptive Strengthen panel replaces the static FocusNow
          panel INSIDE VITE_FEATURE_STRENGTHEN_PANEL; flag off, FocusNow
          renders exactly as before (soak fallback — the focusNowPanel kill
          switch retires at 3a acceptance). */}
      {isStrengthenPanelEnabled() ? (
        <SectionErrorBoundary section="Strengthen your model">
          <StrengthenContainer data={resultsSectionData} />
        </SectionErrorBoundary>
      ) : (
        isFocusNowPanelEnabled() && (
          <SectionErrorBoundary section="Strengthen your model">
            <FocusNowContainer />
          </SectionErrorBoundary>
        )
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
              <RiskAppetiteFilter
                value={riskAppetite}
                onChange={setRiskAppetite}
                hasGoalNumbers={lensRunHasGoalNumbers}
              />
            )}
            {/* Paul's ruling 2026-07-12: the risk-appetite view is an
                EXPLICITLY-LABELLED lens — it re-ranks only this section and
                never alters the recommendation, hero, graph or AI leader. */}
            {riskAppetite !== 'neutral' && (
              <p
                data-testid="risk-lens-label"
                className={`${typography.panelMeta} text-text-light`}
              >
                {/*
                  ⭐ RE-ANCHORED 2026-08-01 (ROADMAP 2.237, P1-1) — "ranked by"
                  → "highlights".

                  The sentence claimed a RE-RANKING that never happens. The
                  option list below is ordered by `sortOptionsForDisplay`, which
                  takes NO lens argument and sorts by `winProbability`, and the
                  cards stamp that order as explicit ordinals. The lens reaches
                  the cards only as a CROWN on one card. So on
                  A(win .50, p10 10) B(win .30, p10 50) C(win .20, p10 90),
                  clicking "Cautious (p10)" printed "ranked by the low end
                  (p10)" over a list reading A(1), B(2) — identical to neutral —
                  with C, the p10 leader and the lens's OWN pick, not rendered
                  at all behind "Show all (1 more)". The user was told a ranking
                  existed and then could not see its result.

                  The copy is corrected to what the code does rather than the
                  code changed to match the copy: highlighting IS the shipped
                  behaviour and is a coherent feature, whereas threading the
                  lens through the comparator would change ordering, truncation
                  and the ordinal stamps together — a much larger behavioural
                  change than a false sentence warrants. `LENS_COPY.unchanged`
                  keeps its job of saying what the lens does NOT touch.
                */}
                {!lensComparison.comparable
                  ? 'Not enough range data to compare options under this lens.'
                  : riskAppetite === 'conservative'
                    ? `Cautious view: highlights the option with the strongest low end (p10). Order below is unchanged. ${LENS_COPY.unchanged(lensRunHasGoalNumbers)}`
                    : `Optimistic view: highlights the option with the strongest high end (p90). Order below is unchanged. ${LENS_COPY.unchanged(lensRunHasGoalNumbers)}`}
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
                  // Re-anchoring (§6 map row 1): the figure headlines the GOAL
                  // number and demotes the comparative one. Both anchors are
                  // already on `OptionResult` — the gauge's prop shape simply
                  // did not carry them, which is why it could only draw the
                  // comparative quantity. The possessive gate travels with the
                  // number so the label cannot assert "your goal" over a
                  // substituted joint value.
                  goalProbability: o.goalProbability,
                  // ROADMAP 2.334 — the resolution the goal readouts need.
                  nValidSamples: o.nValidSamples,
                  goalFitIsSubstitutedJoint: o.goalFitIsSubstitutedJoint,
                  // ⭐ L62 — lets the gauge tell "no target set" apart from
                  // "a goal figure was withheld from you"; they need different
                  // sentences and only the producer decision knows which.
                  goalFitWithheld: o.goalFitWithheld,
                }))}
              decisionState={vm.decisionState}
              designationsWithheld={
                resultsSectionData.recommendation.verdict?.hasLeadingOption === false
              }
              // ⭐ L65 — the same store-derived target signal the V7 goal
              // lens gates with (`recommendation.goalThreshold`). Lets the
              // gauge tell "no target set" from "target set, nothing scored":
              // post-#308 the producer suppresses the frame-broken joint
              // channel at source, so `goalFitWithheld` (which needs a joint
              // figure to ARRIVE) can no longer see that state.
              goalThreshold={resultsSectionData.recommendation.goalThreshold}
            />
            {/* Codex B1: winnerId is ALWAYS the canonical leader — every leader
                predicate (downside sentence, leader CTA/prompt) keys to it. The
                lens selection is a separate id that only crowns/relabels its card. */}
            <OptionCards
              options={resultsSectionData.recommendation.allOptions}
              winnerId={resultsSectionData.recommendation.recommendedOption?.id}
              // ROADMAP 1.223: the ENTITLEMENT, kept separate from the identity
              // above. `winnerId` deliberately still flows on a withheld turn
              // because identity is not entitlement.
              //
              // ⚠ CORRECTED 27 Jul (ROADMAP 1.267): this comment used to end
              // "it drives segment colours, the lens crown and card ordering,
              // none of which claim anything", and row 1.306 refutes that at
              // the screenshots. Ordering, ordinal colour and the crown ARE
              // claims; OptionCards now gates them off this same boolean.
              hasLeadingOption={resultsSectionData.recommendation.verdict?.hasLeadingOption}
              lensActive={riskAppetite !== 'neutral'}
              lensHighlightedId={riskAppetite !== 'neutral' && lensComparison.comparable ? lensComparison.id : undefined}
              stableNumbers={stableNumbersForCards}
              onSendMessage={onSendMessage}
              hasGoalThreshold={resultsSectionData.recommendation.goalThreshold != null}
              // F3: the SAME derivation the filter disclaimer and the lens
              // sentences above use — threaded, never re-derived downstream.
              hasGoalNumbers={lensRunHasGoalNumbers}
              storyHeadlines={resultsSectionData.recommendation.storyHeadlines}
              cardRefMap={optionCardRefs}
              decisionState={riskAppetite === 'neutral' ? vm.decisionState : undefined}
              hinge={riskAppetite === 'neutral' ? vm.hinge : null}
              runnerId={
                // V12.2 Fix 1: Runner-up is highest by win_probability excluding
                // the CANONICAL winner (Codex B1: lens never shifts this).
                [...resultsSectionData.recommendation.allOptions]
                  .filter(o => o.id !== resultsSectionData.recommendation.recommendedOption?.id)
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
                no new colour or component.

                ROADMAP 1.267: the three sentences moved into
                `flipThresholdStatusNote` — all three said "the leading
                option", which on a withheld run asserts what CEE declined to
                say, and as inline JSX they could not be unit-tested without
                mounting the whole panel. One call site, one pure function,
                pinned against the withheld/permitted fixture pair. */}
            {(() => {
              const note = flipThresholdStatusNote({
                status: resultsSectionData.recommendation.flipThresholdsStatus,
                hasUnresolved:
                  resultsSectionData.recommendation.flipThresholdsHasUnresolved === true,
                designationsWithheld,
              })
              return note == null ? null : (
                <p
                  className={`${typography.panelBody} text-text-light mb-3`}
                  data-testid="flip-thresholds-status-note"
                  role="note"
                >
                  {note}
                </p>
              )
            })()}
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
                  showThinkingPatterns={!isAnalysisHeroPanelEnabled()}
                  designationsWithheld={designationsWithheld}
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
          robustnessVerdict={resultsSectionData.recommendation.robustnessVerdict}
          freshnessReason={freshnessReason}
          responseHashIsLocal={responseHashIsLocal}
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
          {...defaultEstimateDisclosure}
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
      {/* ── end Current view group (V7 L3 assessment-mode scaffold) ── */}
      </div>
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
    <div className={`${typography.panelMeta} text-text-light text-center py-1`} data-testid="dev-build-marker">
      {sha}
    </div>
  )
}

// RiskAppetiteFilter and RiskAppetiteFilterProps moved to AdvancedSection.tsx (D3).
export type { RiskAppetite, RiskAppetiteFilterProps } from './AdvancedSection'
export { RiskAppetiteFilter } from './AdvancedSection'

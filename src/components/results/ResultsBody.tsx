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
import { LENS_COPY, deriveComparisonScope, runHasGoalNumbers } from './utils/goalAnchorCopy'
import { StressTestSection } from './StressTestSection'
import { SectionErrorBoundary } from '../../canvas/components/SectionErrorBoundary'
import { DiscussWithAiButton } from '@/canvas/components/pre-analysis/DiscussWithAiButton'
import { TriageActionCardsBody } from './TriageActionCardsBody'
import { WhatChangedChip } from '../../canvas/components/WhatChangedChip'
import { StrengthenContainer } from './strengthen/StrengthenContainer'
import { InferenceWarningStrip } from './InferenceWarningStrip'
import { CritiqueWarningStrip } from './CritiqueWarningStrip'
import { FocusNowContainer } from '@/canvas/components/coaching-panel/focus-now'
import { AnalysisHeroContainer, KeyQuestionCard } from './analysis-hero'
import { WhatIWasGivenSection } from './contextIntegrity/WhatIWasGivenSection'
import { openDefineSuccess, HowComputedTrigger } from './modals'
import { CANONICAL_EDIT_AUTHORITY, hasServerGraphAuthority } from '@/canvas/mutations/mutationAuthority'
import { isFocusNowPanelEnabled, isStrengthenPanelEnabled } from '@/flags'
import { DecisionBriefSectionContainer } from './decision-brief'

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
  // ⛔ ROADMAP 2.651 — Paul's Ruling 3, the UI half. The `isStale` limb of this
  // gate is RETIRED. It read `isStale || isRunning`, and because `isStale` is
  // the dock's `analysisNotConfirmedFresh` (displayed 'stale' OR 'unknown'),
  // and ANY analysis-affecting edit downgrades a retained 'fresh' verdict to
  // 'unknown', the user's FIRST edit switched "Confirm AI estimate" — pillar
  // P4's human-confirms-the-AI affordance — off for the rest of the session.
  //
  // The retired rationale (Brief 4 Task 13 / Phase 8 P0 #4) was "don't edit a
  // factor based on a display that no longer matches the analysis". That is an
  // argument about what the display CLAIMS, and the tab already answers it:
  // `AnalysisFreshnessNotice` says "Model changed since this analysis. Re-run
  // to update." above these cards. **Out-of-date results get labelled, never
  // withheld — staleness is a property of RESULTS, never a lock on what the
  // user may do.** CEE #834 built the same ruling server-side: the graph is
  // always editable. `isStale` stays on the props so the dock's derivation
  // remains visible at this seam and any re-introduced lock is a diff rather
  // than a silent addition — but it MUST NOT gate an affordance.
  //
  // ⭐ WHAT SURVIVES, byte-identically: `isRunning`. Lane 3 (SF2) keeps the
  // body MOUNTED through a run, and committing a factor edit against a display
  // whose run is being replaced is a genuine hazard the ruling does not touch.
  // Pinned + mutation-proved in `ResultsBody.staleMutationAffordances.spec.tsx`.
  //
  // `isStale` is kept on the props and marked INERT here rather than deleted —
  // the same idiom `OutputsDock` uses for `realMessageCount`. Deleting it would
  // remove the seam the dock's staleness arrives on, and with it the only
  // mutant that can prove this lock has not come back: the spec above asserts
  // that a body TOLD its results are stale still offers the affordance, which
  // is unprovable if the component can no longer be told. Re-attaching a gate
  // to this value must be a visible diff that turns those tests RED.
  void isStale
  const suppressMutations = isRunning
  const runGatedOnConfirmFactor = suppressMutations ? undefined : onConfirmFactor
  const runGatedOnSetFactorValue = suppressMutations ? undefined : onSetFactorValue

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
  // ⚠ The `if (!isAnalysisHeroPanelEnabled()) return undefined` guard that
  // used to open this memo is GONE with the fork. It only ever suppressed
  // identity-anchored ordinals on the flag-OFF posture — a posture no
  // deployment served (staging bakes the flag "1"), so live behaviour is
  // unchanged; the off-posture now gets the same numbering the on-posture
  // always had, which is the point of collapsing to one implementation.
  const stableNumbersForCards = useMemo(() => {
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

  // ══ THE FORK IS CLOSED (PX-C analysis-cockpit consolidation) ═════════════
  //
  // This block used to hold `showV17` / `showCompare` and TWO fully-built
  // alternative analysis panels (`AnalysisHeroV17`, `DecisionConfidencePanel`)
  // for the dark arm below. Deployed staging baked
  // `VITE_FEATURE_ANALYSIS_HERO_PANEL="1"` (read at the bytes from
  // `assets/flags-*.js`, not from netlify.toml — trap 18), so that arm was
  // STRUCTURALLY DARK: three generations of the same feature, none of them
  // reachable, all of them maintained. Both components and the whole
  // `analysisHeroV17/` directory are deleted; the one idea worth keeping —
  // acting on a factor from the row that reports it — is salvaged into
  // `analysis-hero/actOnIt/` and hosted INSIDE the cockpit.
  //
  // `verifiedCount` / `influenceCoverage` arrive on the props and had their
  // only consumers on the deleted arm (both panels accepted them; V17
  // destructured them to `_`-prefixed names and ignored them). They are kept
  // on the interface and marked INERT here rather than removed, so the
  // transition bridge OutputsDock derives stays visible at this seam and any
  // re-consumption is a diff rather than a silent addition.
  void verifiedCount
  void influenceCoverage

  const aiAffordance = (
    <DiscussWithAiButton
      element={{ kind: 'missing' }}
      ariaLabel="Tell AI about something missing from the results"
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

      {/* ══ V7 ASSESSMENT SCAFFOLD — GONE, NOT MOVED (adjudicated) ═════════
          HISTORY, because the intermediate state confused readers twice: the
          V7 top group (`V7TopMatter`) + "Current view" divider — the
          V6-RESPEC-2026-07-23 §1 side-by-side assessment scaffold — first
          MOVED off this tab (12 Aug 2026) to a temporary "Alt view" dock tab
          under "move, NOT delete", pending adjudication.
          That adjudication is now settled: the Alt view tab is RETIRED and
          `src/components/results/v7/` is DELETED. There is ONE Analysis
          surface and no A/B twin.
          What the fork uniquely rendered was re-homed rather than dropped —
          "what I was given" (ROADMAP 2.973's trigger), the bias
          micro-intervention steps, the canvas graph projection, the `est.`
          provenance tag and `evidence_view_opened`. Two capabilities were
          knowingly let go: the run-over-run comparison (prohibited by
          runHistory.ts:1-8 §19 AND data-unavailable on the live path — see
          buildHeroModel's whatChanged note) and the "You wrote:" quote-back
          (whose deletion resolves rowed honesty defect 2.993).
          The wrapper below is unchanged, so everything beneath the old
          divider still renders byte-identically. Re-mounting V7 here REDs
          `ResultsBody.v7Retired.spec.tsx`. */}
      <div className="flex flex-col gap-4" data-testid="assessment-current-view-group">

      {/* Freshness/staleness — CEE analysis_ready.freshness verdict. Renders
          nothing until a verdict exists; never asserts a state we don't hold. */}
      {/* Freshness strip mounts in OutputsDock ABOVE the dim wrapper (Wave F-B review a) */}

      {/* Roadmap 1.12 (provisional_doctrine_v0): warning-severity producer
          inference_warnings surface as a compact honest-caveat strip beside
          the freshness area. Copy is HUMANISED via humaniseInferenceWarningTitle
          (the V14.3 no-message-render guard — the strip keys off producer `code`
          and never renders the raw producer `message`; see
          InferenceWarningStrip.tsx:11-17,70). Info-severity stays hidden;
          renders nothing when no warning-severity entries exist. */}
      <InferenceWarningStrip warnings={resultsSectionData.confidence.inferenceWarnings} />

      {/* Lane 3 Car 1 residual (ROADMAP 2.358 closure): WARNING-severity
          engine critiques — the rows #585's mapper leg lands in
          report.run.critique — surface as a compact honest-disclosure strip
          beside the inference-warning strip. CEE-owned copy verbatim
          (humaniseCritique precedence); renders nothing when no warning
          critiques exist. Mounted in this UNCONDITIONAL group on purpose:
          both hero-flag postures show it (trap 3b — a disclosure hosted on
          a flag arm ships dark on the posture that matters). BLOCKER rows
          keep their own surface (ValidationPanel via OutputsDock). */}
      <CritiqueWarningStrip critiques={resultsSectionData.confidence.humanisedCritiques} />

      {/* C11 Decision Brief intelligence — the strategic-reading entry point
          for the producer's already-transported projected brief. Canonical
          warnings stay above it so caveats qualify the claims they govern;
          method, run delta, and the taller cockpit follow. This keeps the
          licensed groups on first paint without rebuilding winner, freshness
          or Compare authority. */}
      <SectionErrorBoundary section="Decision brief">
        <DecisionBriefSectionContainer
          leaderClaimPermitted={resultsSectionData.recommendation.verdict?.hasLeadingOption === true}
        />
      </SectionErrorBoundary>

      {/* ── P1-9 provenance: Model-Card-Lite entry point ───────────────────
          Sits above every numeric analysis surface it explains so "where did
          that number come from?" is answerable without hunting. The brief
          above renders labels/prose only. Gated on results being on screen —
          a method note for an analysis that has not run would be explaining
          numbers that do not exist. */}
      <HowComputedTrigger
        hasResults={(resultsSectionData.recommendation.allOptions?.length ?? 0) > 0}
      />

      {/* Seamlessness R6 / ROADMAP 2.1 slice 1: run-over-run delta chip.
          Client-side diff of the two most recent stored runs; self-hides on
          first runs or zero delta; click pulses the surviving changes. */}
      <WhatChangedChip />

      {/* ── THE ANALYSIS COCKPIT ────────────────────────────────────────
          ONE implementation, mounted UNCONDITIONALLY. Read-only presentation
          over the SAME resultsSectionData object every section below
          consumes.

          The `isAnalysisHeroPanelEnabled()` gate that used to wrap this is
          gone with the arm it forked against. On the deployed posture the
          flag was already "1", so nothing a user loads changes; what changes
          is that there is no longer an off-posture rendering a different,
          superseded analysis. */}
      <>
          <SectionErrorBoundary section="Analysis">
            <AnalysisHeroContainer
              onDefineSuccess={hasServerGraphAuthority(CANONICAL_EDIT_AUTHORITY.goalSuccessTarget)
                ? openDefineSuccess
                : undefined}
              data={resultsSectionData}
              onApplyTarget={hasServerGraphAuthority(CANONICAL_EDIT_AUTHORITY.goalSuccessTarget)
                ? onApplyThreshold
                : undefined}
              onFocusNode={onFocusNode}
              onConfirmFactor={runGatedOnConfirmFactor}
              fragileEdgeCount={fragileEdgeCount}
              // ── 2.661 (P4), RE-HOMED ────────────────────────────────────
              // "Confirm AI estimate" + the inline value editor are P4's
              // human-confirms-the-AI affordance, minted by
              // `TriageActionCardsBody` (`mapEvidenceGapsToActions` →
              // `TriageCard` → `InlineValueControls`). #2.661 rescued them
              // from the dark arm by wedging this body into a CHROMELESS div
              // beside the hero, conceding in its own comment that framing it
              // was "a design decision, not a wiring one". This is that
              // decision: the body now renders INSIDE the cockpit's
              // "What to act on next" section, beneath the act-on-it rows.
              //
              // ⭐ NO NEW WRITE PATH. Same component, same
              // `runGatedOnConfirmFactor` / `runGatedOnSetFactorValue`, so the
              // run-gating semantics #609 shipped are inherited rather than
              // re-derived (a re-derivation here is exactly how the retired
              // `isStale` lock would come back). The `hero-arm-triage-actions`
              // testid travels with it, so the mount path stays assertable and
              // a regression REDs `analysisCockpit.mountPath.spec.tsx`.
              actOnItQueueSlot={
                <TriageActionCardsBody
                  data={resultsSectionData}
                  onFocusNode={onFocusNode}
                  onConfirm={runGatedOnConfirmFactor}
                  onSetValue={runGatedOnSetFactorValue}
                  nodeValueLookup={nodeValueLookup}
                  aiAffordance={aiAffordance}
                />
              }
            />
          </SectionErrorBoundary>
          {/* ── 2.466 (P1): decision-quality KEY QUESTION + DSK grounding ──
              Fed from the LIVE turn state (runMeta.decisionReview030's
              verbatim DQP carry), presence-gated — never from the legacy
              m1ReviewAssumptions/reviewStatus pair that dark-shipped lane 1.
              Its former rival, the V17 `HeroKeyQuestion`, is DELETED with the
              fork, so this is now the product's only key-question surface —
              no posture can double-render the grounding line because there is
              no other posture. */}
          <SectionErrorBoundary section="Key question">
            <KeyQuestionCard />
          </SectionErrorBoundary>
          {/* ── 2.973: "what I was given" — RE-HOMED, not deleted ──────────
              This surface used to render ONLY on the temporary "Alt view"
              comparison tab. ROADMAP 2.973 carried an explicit trigger for
              this moment: "when that tab retires, this surface MUST be
              explicitly re-homed or it goes dark with it" (#673 review).
              The tab is now retired, so it is mounted here — on the one
              surviving Analysis surface — rather than dying with its host.
              It is the ONLY reader of the context-integrity manifest and of
              the user's verbatim brief; nothing else renders either.
              It self-gates: it renders nothing unless the context-integrity
              store's scenarioId matches the live decision (the identity gate
              that fixed it showing a PREVIOUS decision's brief verbatim), so
              mounting it unconditionally here is safe. */}
          {/* ⭐ L-10 FIX: `onSendMessage` was never passed, and the component
              renders its "Where does this fit?" action ONLY when it is
              (`WhatIWasGivenSection.tsx:515` → `onAdd={onSendMessage ? … :
              undefined}`). So this was not a dead BUTTON — the whole
              "not modelled yet" action column never rendered at all, which is
              why no click ever failed and nothing ever looked broken. The
              handler is the same `onSendMessage` every other section on this
              body already receives; there is no new write path. */}
          <SectionErrorBoundary section="What I was given">
            <WhatIWasGivenSection onSendMessage={onSendMessage} />
          </SectionErrorBoundary>
        </>

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
      {/* Critical analysis content — the full options block is unconditional;
          no flag has ever gated it. It was once proposed that CompactOptionSpread
          replace this surface; that was reverted on 2026-05-27 because users need
          WinGauge + RiskAppetiteFilter + OptionCards on the Analysis tab,
          including "What makes this lead" affordances and stability/range bars.
          CompactOptionSpread was then kept "as a potential supplementary
          affordance" and never wired to anything — it acquired zero importers and
          was DELETED on 18 Aug 2026. The ruling this comment records still
          stands; only the dormant component is gone. */}
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
              // ⭐ SUBSET DISCLOSURE — `shares` above is pre-filtered to
              // options carrying a finite winProbability, so the gauge cannot
              // see that an option was excluded. The comparison set is derived
              // HERE, from the unfiltered `allOptions`, and rendered inside the
              // gauge's COMPARATIVE block only (the goal block's quantity is
              // subset-invariant).
              comparisonScope={deriveComparisonScope(
                resultsSectionData.recommendation.allOptions,
              )}
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
              // ROADMAP 2.580 member 4 — the SAME unit trio already threaded to
              // DriversSection (:693) and TornadoChart (:741), reaching the
              // option cards' downside tail for the first time. `isNormalised`
              // travels with it so a normalised 0-1 score cannot be labelled
              // in the goal's unit.
              outcomeUnit={resultsSectionData.recommendation.outcomeUnit}
              outcomeUnitSymbol={resultsSectionData.recommendation.outcomeUnitSymbol}
              isNormalised={resultsSectionData.recommendation.isNormalised}
            />
            {/* TippingPoints removed — superseded by TornadoChart (Brief 5.4 Phase 1) */}
          </div>
        </SectionErrorBoundary>
      )}

      {/* ── SECTION 3: DRIVERS ──────────────────────────────────── */}
      {/* ⚠⚠ THE COUNT ON THIS ACCORDION HAS NEVER RENDERED, and finding out
          why is the L-57 "honest counts" item in miniature. The call site read
          `count={…}`; `Accordion` has no such prop — the badge is
          `badgeCount`. React drops an unknown prop on a function component
          without a word, so `badgeCount` stayed `undefined`, the
          `badgeCount !== undefined && badgeCount > 0` gate never opened, and
          the accompanying `badgeState` styled a badge that was not there. The
          drivers section has been collapsed with no indication of how much is
          inside it for as long as that line existed.
          It did not fail loudly because TypeScript's excess-property
          diagnostic for it is one of the three sitting in this file's
          typecheck BASELINE — a ratcheted error that was hiding a live display
          defect, not merely noise. Pinned by
          `Accordion.badgeCountProp.spec.tsx`, whose second case renders the
          WRONG prop name and asserts nothing appears. */}
      <Accordion
        title="What's driving this"
        subtitle="Factors with the strongest current influence on the result"
        defaultExpanded={false}
        isExpanded={driversExpanded}
        onExpandChange={onDriversExpandChange}
        badgeCount={resultsSectionData.drivers.totalCount}
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
      {/* ⭐ L-57: this was the ONE collapsed section on the tab with no count
          on its header, so a reader scanning the collapsed sections could see
          how many drivers there were but had no idea whether opening this one
          revealed two factors or twenty. The count is the rendered row count —
          the same array `TornadoChart` iterates, not a second derivation that
          could disagree with what opening it reveals. */}
      {tornadoData.rows.length > 0 && tornadoData.expectedOutcome != null && (
        <Accordion
          title="What could change the result"
          defaultExpanded={false}
          badgeCount={tornadoData.rows.length}
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
                  flipThresholds={resultsSectionData.recommendation.flipThresholds ?? null}
                  analysisDegraded={analysisDegraded}
                  onFocusNode={onFocusNode}
                  onSendMessage={onSendMessage}
                  expertMode={expertMode}
                  sensitivityReferenceLabel={resultsSectionData.sensitivityReference?.optionLabel ?? null}
                  // ⚠ Was `!isAnalysisHeroPanelEnabled()`. The deployed
                  // posture baked that flag "1", so this has evaluated FALSE
                  // on every build a user has ever loaded; pinning it to
                  // `false` preserves live behaviour exactly and removes the
                  // last reader of a flag whose other arm no longer exists.
                  // The UI-authored thinking-pattern cards stay retired: the
                  // cockpit's act-on-it rows are where a run's reflective
                  // prompts now surface, from `m2BiasFindings` — producer
                  // data, not UI-invented patterns.
                  showThinkingPatterns={false}
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
      {/* ── end current-view wrapper (scaffold retired 12 Aug 2026; wrapper
          kept so everything inside renders byte-identically) ── */}
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

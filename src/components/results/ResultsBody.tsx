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

import { useRef, useCallback, useMemo, memo } from 'react'
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
import { TippingPoints } from './TippingPoints'
import { AdvancedSection } from './AdvancedSection'
import { AttentionBanner } from './AttentionBanner'
import { ChallengeSection } from './ChallengeSection'
import { groupActionItems, type ActionItem } from './utils/groupActionItems'
import type { EvidenceGapItem } from './types'
import { SectionErrorBoundary } from '../../canvas/components/SectionErrorBoundary'
import { CoachingPrompt } from './CoachingPrompt'
import { ResultsFooter } from './ResultsFooter'
import { DecisionConfidencePanel } from './DecisionConfidencePanel'

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
}: ResultsBodyProps) {
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
    <div className="flex flex-col gap-[18px]" data-testid="outputs-results-redesign">

      {/* ── DECISION CONFIDENCE TRIAGE ────────────────────────────── */}
      <SectionErrorBoundary section="Decision confidence">
        <DecisionConfidencePanel
          data={resultsSectionData}
          onFocusNode={onFocusNode}
          verifiedCount={verifiedCount}
          influenceCoverage={influenceCoverage}
          onSendMessage={onSendMessage}
          onConfirm={onConfirmFactor}
          onSetValue={onSetFactorValue}
          expertMode={expertMode}
        />
      </SectionErrorBoundary>

      {/* Old RecommendationSection/HeroSection suppressed — triage panel replaces it */}

      {/* ── ATTENTION BANNER ──────────────────────────────────────── */}
      <SectionErrorBoundary section="Attention banner">
        <AttentionBanner
          items={(resultsSectionData.confidence.humanisedCritiques ?? []).filter(
            c => c.displayText != null && c.suggestion != null && c.factorId != null
          )}
          onFocusNode={onFocusNode}
        />
      </SectionErrorBoundary>

      {/* ── SECTION 2: OPTIONS COMPARISON ────────────────────────── */}
      {!resultsSectionData.recommendation.isSingleOption &&
       resultsSectionData.recommendation.allOptions.length > 1 && (
        <SectionErrorBoundary section="Options comparison">
          <div className="space-y-2">
            <SectionHeader
              title="Your options"
              testId="section-header-options"
              icon="option"
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
            <OptionCards
              options={resultsSectionData.recommendation.allOptions}
              winnerId={resultsSectionData.recommendation.recommendedOption?.id}
              onSendMessage={onSendMessage}
              hasGoalThreshold={resultsSectionData.recommendation.goalThreshold != null}
              storyHeadlines={resultsSectionData.recommendation.storyHeadlines}
              cardRefMap={optionCardRefs}
              decisionState={vm.decisionState}
              hinge={vm.hinge}
              runnerId={
                // V12.2 Fix 1: Runner-up is highest by win_probability excluding winner
                [...resultsSectionData.recommendation.allOptions]
                  .filter(o => o.id !== resultsSectionData.recommendation.recommendedOption?.id)
                  .sort((a, b) => (b.winProbability ?? 0) - (a.winProbability ?? 0))[0]?.id
              }
            />
            {/* Tipping points below option cards (kept until Phase 3.4 ships) */}
            <TippingPoints
              flipThresholds={resultsSectionData.recommendation.flipThresholds}
              drivers={resultsSectionData.drivers.topDrivers}
              outcomeUnit={resultsSectionData.recommendation.outcomeUnit}
              outcomeUnitSymbol={resultsSectionData.recommendation.outcomeUnitSymbol}
            />
          </div>
        </SectionErrorBoundary>
      )}

      {/* ── SECTION 3: DRIVERS ──────────────────────────────────── */}
      <Accordion
        title="What's driving this"
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
                  title="Stress-test your decision"
                  defaultExpanded={false}
                  testId="accordion-before-commit"
                  badgeCount={challengeTotal}
                  badgeState={challengeTotal > 0 ? 'unresolved' : undefined}
                >
                  <ChallengeSection
                    biasFindings={biasFindings}
                    preMortemItems={preMortemItems}
                    onFocusNode={onFocusNode}
                    evidenceGaps={resultsSectionData.confidence.evidenceGaps as EvidenceGapItem[] | undefined}
                    drivers={resultsSectionData.drivers.drivers}
                    edgeEValues={resultsSectionData.confidence.edgeEValues}
                    fragileEdges={resultsSectionData.confidence.challengeFragileEdges}
                    inferenceWarnings={resultsSectionData.confidence.inferenceWarnings}
                    identifiabilityTag={identifiability}
                  />
                </Accordion>
              </div>
              )
            })()}
          </>
        )
      })()}
      </SectionErrorBoundary>

      {/* ── COACHING PROMPT ────────────────────────────────────── */}
      <CoachingPrompt />

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
        />
      </div>
      </SectionErrorBoundary>

      {/* Adjustments Made: Show any strength corrections applied during this run */}
      {strengthCorrections.length > 0 && (
        <SectionErrorBoundary section="Adjustments">
          <details className="border border-sand-200 rounded-lg overflow-hidden">
            <summary className={`px-3 py-2 bg-sand-50 cursor-pointer hover:bg-sand-100 ${typography.caption} text-ink-600`}>
              {strengthCorrections.length} edge strength{strengthCorrections.length > 1 ? 's' : ''} adjusted
            </summary>
            <div className="p-3 space-y-1">
              {strengthCorrections.map((c, idx) => (
                <div key={idx} className={`${typography.code} text-ink-500 text-xs`}>
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
        resolvedCount={0}
        totalCount={hasGuidanceItems
          ? (guidanceItems?.length ?? 0)
          : resultsSectionData.confidence.nextActions?.length ?? 0}
      />

      {/* V14.3b: Dev-only build marker for deploy verification */}
      {import.meta.env.DEV && (
        <div className="text-[10px] text-text-light/40 text-center py-1" data-testid="dev-build-marker">
          {typeof __GIT_SHA__ !== 'undefined' ? __GIT_SHA__ : 'dev'}
        </div>
      )}
    </div>
  )
})

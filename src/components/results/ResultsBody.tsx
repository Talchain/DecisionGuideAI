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

import { useRef, useCallback, useMemo } from 'react'
import { typography } from '../../styles/typography'
import type { ResultsSectionDataReturn } from './useResultsSectionData'
import { buildResultsVM } from './buildResultsVM'
import { RecommendationSection } from './RecommendationSection'
import { DriversSection } from './DriversSection'
import type { TornadoRow } from './TornadoChart'
import { ConfidenceSection } from './ConfidenceSection'
import { Accordion } from './Accordion'
import { SectionHeader } from './SectionHeader'
import { OptionCards } from './OptionCards'
import { SuccessTargetRow } from './SuccessTargetRow'
import { TippingPoints } from './TippingPoints'
import { AdvancedSection } from './AdvancedSection'
import { AttentionBanner } from './AttentionBanner'
import { ChallengeSection } from './ChallengeSection'
import { groupActionItems, type ActionItem } from './utils/groupActionItems'

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
  registerDriverRef?: (factorKey: string, el: HTMLElement | null) => void
  strengthCorrections?: StrengthCorrectionDisplay[]
  onFocusNode?: (nodeId: string) => void
  isRunning?: boolean
  isThresholdFromBrief?: boolean
  onAddStatusQuoBaseline?: () => void
  onApplyThreshold?: (threshold: number) => void
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
}

export function ResultsBody({
  resultsSectionData,
  tornadoData,
  highlightedDriverId,
  registerDriverRef,
  strengthCorrections = [],
  onFocusNode,
  isRunning,
  isThresholdFromBrief,
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

      {/* ── ATTENTION BANNER ──────────────────────────────────────── */}
      {/* P0.1: Humanised critique items — coaching tone, no raw field names */}
      <AttentionBanner
        items={(resultsSectionData.confidence.humanisedCritiques ?? []).filter(
          c => c.suggestion != null && c.factorId != null
        )}
        onFocusNode={onFocusNode}
      />

      {/* ── SECTION 1: HERO ─────────────────────────────────────── */}
      {/* V11: Structured hero rows driven by decisionState from VM */}
      <div>
        <RecommendationSection
          data={resultsSectionData.recommendation}
          onFocusNode={onFocusNode}
          onAddStatusQuoBaseline={onAddStatusQuoBaseline}
          topDrivers={resultsSectionData.drivers.topDrivers}
          topFragileEdge={resultsSectionData.confidence.topFragileEdge}
          nSamples={nSamples ?? undefined}
          seedUsed={seedUsed ?? undefined}
          fragileEdgeCount={fragileEdgeCount}
          robustEdgeCount={robustEdgeCount}
          responseHash={responseHash}
          onApplyThreshold={onApplyThreshold}
          isRunning={isRunning}
          isThresholdFromBrief={isThresholdFromBrief}
          onAddBaseline={onAddBaseline}
          onSetBaseline={onSetBaseline}
          onFlashOption={flashOptionCard}
          decisionState={vm.decisionState}
          hinge={vm.hinge}
          evidenceLevel={vm.evidenceLevel}
          identifiabilityTag={identifiability}
        />
      </div>

      {/* ── SECTION 2: OPTIONS COMPARISON ────────────────────────── */}
      {/* V9.2: SuccessTargetRow + card-based option comparison */}
      {!resultsSectionData.recommendation.isSingleOption &&
       resultsSectionData.recommendation.allOptions.length > 1 && (
        <div className="space-y-2">
          <SectionHeader
            title="How the options compare"
            testId="section-header-options"
          />
          <SuccessTargetRow
            goalThreshold={resultsSectionData.recommendation.goalThreshold}
            isFromBrief={isThresholdFromBrief}
            isRunning={isRunning}
            onApplyThreshold={onApplyThreshold}
            constraintAnalysis={resultsSectionData.recommendation.recommendedOption?.constraintAnalysis}
            showHitsTarget={
              resultsSectionData.recommendation.goalThreshold != null &&
              resultsSectionData.recommendation.allOptions.every(o => o.goalProbability != null)
            }
          />
          <OptionCards
            options={resultsSectionData.recommendation.allOptions}
            winnerId={resultsSectionData.recommendation.recommendedOption?.id}
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
      )}

      {/* ── SECTION 3: DRIVERS ──────────────────────────────────── */}
      {/* Always visible — no accordion wrapper. Driver cards + TornadoChart. */}
      <div>
        <SectionHeader
          title="What's driving this"
          count={resultsSectionData.drivers.totalCount}
          testId="section-header-drivers"
        />
        <DriversSection
          data={resultsSectionData.drivers}
          onFocusNode={onFocusNode}
          goalLabel={resultsSectionData.goalLabel}
          highlightedDriverId={highlightedDriverId}
          registerDriverRef={registerDriverRef}
          expectedOutcome={tornadoData.expectedOutcome}
          tornadoRows={tornadoData.rows}
          outcomeUnit={resultsSectionData.recommendation.outcomeUnit}
          outcomeUnitSymbol={resultsSectionData.recommendation.outcomeUnitSymbol}
          isNormalised={resultsSectionData.recommendation.isNormalised}
          goalDirection={goalDirection}
        />
      </div>

      {/* ── SECTION 4: WHAT TO DO NEXT ───────────────────────────── */}
      {/* V11: Collapse behaviour driven by decisionState, not robustness level */}
      {(() => {
        // V11: Badge count accounting for hinge de-duplication
        const hingeNodeId = vm.hinge?.nodeId
        const hingeExcludeIds = hingeNodeId ? [hingeNodeId] : undefined
        const fragileEdgesForBadge = resultsSectionData.confidence.uncertainties.filter(u => u.code === 'SENSITIVE_ASSUMPTION')
        const evidenceGapsForBadge = resultsSectionData.confidence.evidenceGaps ?? []
        const nonFragileCount = resultsSectionData.confidence.uncertainties.filter(u => u.code !== 'SENSITIVE_ASSUMPTION').length
        let badgeCount = Math.min(3, fragileEdgesForBadge.length) + nonFragileCount + evidenceGapsForBadge.length
        if (hingeNodeId) {
          // Only subtract from fragile edges if hinge is in the visible top-3
          // (ConfidenceSection sorts by severity then slices to 3)
          const sevOrder: Record<string, number> = { blocker: 4, critical: 3, error: 2, warning: 1 }
          const sortedFragile = [...fragileEdgesForBadge].sort(
            (a, b) => (sevOrder[b.severity || 'warning'] || 0) - (sevOrder[a.severity || 'warning'] || 0),
          )
          const hingeInTop3Fragile = sortedFragile.slice(0, 3).some(u => u.affectedNodes?.[0] === hingeNodeId)
          const hingeInGaps = evidenceGapsForBadge.some(g => g.factorId === hingeNodeId)
          if (hingeInTop3Fragile || hingeInGaps) badgeCount = Math.max(0, badgeCount - 1)
        }
        // V11.1 Fix 7: Add 1 for VOI promoted block when visible (sensitive/indeterminate + hinge)
        const voiBlockVisible = (vm.decisionState === 'sensitive' || vm.decisionState === 'indeterminate') && vm.hinge != null
        if (voiBlockVisible) badgeCount += 1

        // V12: Include nextActions in badge count (capped at 3, hinge-deduped)
        const nextActionsForBadge = resultsSectionData.confidence.nextActions ?? []
        const filteredNextActionsCount = hingeNodeId
          ? nextActionsForBadge.filter(a => a.targetId !== hingeNodeId).length
          : nextActionsForBadge.length
        badgeCount += Math.min(3, filteredNextActionsCount)

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
            <div>
              <Accordion
                title="What to do next"
                defaultExpanded={
                  vm.decisionState === 'sensitive' || vm.decisionState === 'indeterminate'
                }
                testId="accordion-strengthen"
                badgeCount={badgeCount}
                badgeVariant={
                  vm.decisionState === 'indeterminate'
                    ? 'critical'
                    : vm.decisionState === 'sensitive'
                    ? 'warning'
                    : 'default'
                }
                tierLabel={
                  resultsSectionData.confidence.tier.tier === 'strong' ? 'Evidence: Good'
                    : resultsSectionData.confidence.tier.tier === 'fair' ? 'Evidence: Fair'
                    : resultsSectionData.confidence.tier.tier === 'needs_work' ? 'Evidence: Needs work'
                    : undefined
                }
                tierVariant={
                  resultsSectionData.confidence.tier.tier !== 'unknown'
                    ? resultsSectionData.confidence.tier.tier as 'strong' | 'fair' | 'needs_work'
                    : undefined
                }
              >
                <ConfidenceSection
                  data={resultsSectionData.confidence}
                  onFocusNode={onFocusNode}
                  topDriverLabel={resultsSectionData.drivers.topDrivers[0]?.factorLabel}
                  topDriverId={resultsSectionData.drivers.topDrivers[0]?.factorKey}
                  visibleDriverCount={resultsSectionData.drivers.totalCount}
                  winnerConstraintAnalysis={resultsSectionData.recommendation.recommendedOption?.constraintAnalysis}
                  hinge={vm.hinge}
                  decisionState={vm.decisionState}
                  topAction={vm.topAction}
                  excludeFactorIds={hingeExcludeIds}
                />
              </Accordion>
              {/* V11: Robust compact VOI affordance — below collapsed accordion */}
              {vm.decisionState === 'robust' && vm.hinge && (
                <p
                  className={`${typography.panelMeta} text-text-light mt-1.5 px-3`}
                  data-testid="robust-voi-compact"
                >
                  If you want extra confidence: validate {vm.hinge.label}
                </p>
              )}
            </div>

            {/* ── SECTION 4b: CHALLENGE YOUR ASSUMPTIONS (M2) ──────── */}
            {(biasFindings.length > 0 || preMortemItems.length > 0) && (
              <div>
                <Accordion
                  title="Challenge your assumptions"
                  defaultExpanded={false}
                  testId="accordion-challenge"
                  badgeCount={biasFindings.length + preMortemItems.length}
                >
                  <ChallengeSection
                    biasFindings={biasFindings}
                    preMortemItems={preMortemItems}
                    onFocusNode={onFocusNode}
                    evidenceGaps={resultsSectionData.confidence.evidenceGaps}
                    drivers={resultsSectionData.drivers.drivers}
                  />
                </Accordion>
              </div>
            )}
          </>
        )
      })()}

      {/* ── SECTION 5: ADVANCED ───────────────────────────────── */}
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
        />
      </div>

      {/* Adjustments Made: Show any strength corrections applied during this run */}
      {strengthCorrections.length > 0 && (
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
      )}

      {/* 56px spacer for sticky footer clearance */}
      <div style={{ height: 56 }} aria-hidden="true" />
    </div>
  )
}

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
import type { NextActionItem } from './types'
import { buildResultsVM } from './buildResultsVM'
import { GuidanceActionItemRow } from './GuidanceActionItemRow'
import type { GuidanceItem } from '../../canvas/stores/guidanceStore'
import { RecommendationSection } from './RecommendationSection'
import { DriversSection } from './DriversSection'
import type { TornadoRow } from './TornadoChart'
import { ConfidenceSection } from './ConfidenceSection'
import { Accordion } from './Accordion'
import { SectionHeader } from './SectionHeader'
import { OptionCards } from './OptionCards'
import { buildSegmentColorMap } from './HeroSection'
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
  /**
   * Orchestrator guidance items for the results surface.
   * When present (length > 0), replaces NextActionItem list in "What to do next".
   * Only items with target_object.type in {graph, option, framing} or no target_object
   * are passed here — node/edge items are filtered out by the caller.
   */
  guidanceItems?: GuidanceItem[]
  /** Callback to activate a guidance item (sets activeGuidanceItemId in store) */
  onActivateGuidanceItem?: (itemId: string) => void
}

export function ResultsBody({
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
  onActivateGuidanceItem,
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

      {/* ── ATTENTION BANNER ──────────────────────────────────────── */}
      {/* P0.1: Humanised critique items — coaching tone, no raw field names */}
      <AttentionBanner
        items={(resultsSectionData.confidence.humanisedCritiques ?? []).filter(
          c => c.displayText != null && c.suggestion != null && c.factorId != null
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
          topNextAction={hasGuidanceItems ? undefined : resultsSectionData.confidence.topNextActions?.[0]}
          nSamples={nSamples ?? undefined}
          seedUsed={seedUsed ?? undefined}
          fragileEdgeCount={fragileEdgeCount}
          robustEdgeCount={robustEdgeCount}
          responseHash={responseHash}
          onApplyThreshold={onApplyThreshold}
          isRunning={isRunning}
          onAddBaseline={onAddBaseline}
          onSetBaseline={onSetBaseline}
          onFlashOption={flashOptionCard}
          decisionState={vm.decisionState}
          hinge={vm.hinge}
          identifiabilityTag={identifiability}
          defaultEstimateCount={resultsSectionData.drivers.drivers.length > 0
            ? resultsSectionData.drivers.drivers.filter(d => d.isDefaultedConfidence).length
            : undefined}
          totalFactorCount={resultsSectionData.drivers.drivers.length > 0
            ? resultsSectionData.drivers.drivers.length
            : undefined}
        />
      </div>

      {/* ── SECTION 2: OPTIONS COMPARISON ────────────────────────── */}
      {!resultsSectionData.recommendation.isSingleOption &&
       resultsSectionData.recommendation.allOptions.length > 1 && (
        <div className="space-y-2">
          <SectionHeader
            title="How the options compare"
            testId="section-header-options"
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
            segmentColorMap={buildSegmentColorMap(
              resultsSectionData.recommendation.allOptions,
              resultsSectionData.recommendation.recommendedOption?.id,
              vm.decisionState,
            )}
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
        // V12.5: Badge count mirrors ConfidenceSection's rendered item count
        // Uses groupActionItems for dedup parity — badge can never diverge from content.
        const hingeNodeId = vm.hinge?.nodeId
        const hingeExcludeIds = hingeNodeId ? [hingeNodeId] : undefined

        // Replicate ConfidenceSection's fragile-edge preparation (top 3 by severity)
        const sevOrder: Record<string, number> = { blocker: 4, critical: 3, error: 2, warning: 1 }
        const fragileEdgesTop3 = resultsSectionData.confidence.uncertainties
          .filter(u => u.code === 'SENSITIVE_ASSUMPTION')
          .sort((a, b) => (sevOrder[b.severity || 'warning'] || 0) - (sevOrder[a.severity || 'warning'] || 0))
          .slice(0, 3)

        // Visible fragile edges after hinge exclusion
        const visibleFragileCount = hingeNodeId
          ? fragileEdgesTop3.filter(u => u.affectedNodes?.[0] !== hingeNodeId).length
          : fragileEdgesTop3.length

        // Hinge-filter nextActions (same as ConfidenceSection)
        const filteredNextActions = hingeNodeId
          ? (resultsSectionData.confidence.nextActions ?? []).filter(a => a.targetId !== hingeNodeId)
          : (resultsSectionData.confidence.nextActions ?? [])

        // Run groupActionItems for deduped evidence gaps + next-action items
        const actionGroups = groupActionItems({
          fragileEdges: fragileEdgesTop3,
          evidenceGaps: resultsSectionData.confidence.evidenceGaps ?? [],
          constraintAnalysis: resultsSectionData.recommendation.recommendedOption?.constraintAnalysis,
          excludeFactorIds: hingeExcludeIds,
          nextActions: filteredNextActions.length > 0 ? filteredNextActions : undefined,
        })

        // Next-action items from Group 1 (rendered separately from fragile edges)
        // V14.2: Only count items with specific targets — exclude generic preamble cards
        const nextActionCount = actionGroups[0].items.filter(i => i.id.startsWith('next-') && i.targetId).length

        // worthRefining: non-SENSITIVE_ASSUMPTION uncertainties, minus internal leaks
        // Must match ConfidenceSection's INTERNAL_PATTERN + humanised-override exemption
        const BADGE_INTERNAL_PATTERN = /constraint_|observed_state|intercept=|node_id=|edge_id=|fac_[a-z_]+|opt_[a-z_]+|goal_[a-z_]+|blocks_analysis/i
        // Build humanised lookup keys (same logic as ConfidenceSection)
        const humanisedKeys = new Set<string>()
        const plotCritiques = resultsSectionData.confidence.uncertainties.filter(u => u.code !== 'SENSITIVE_ASSUMPTION')
        const humanisedCritiques = resultsSectionData.confidence.humanisedCritiques
        if (humanisedCritiques) {
          plotCritiques.forEach((item, idx) => {
            if (humanisedCritiques[idx]) {
              humanisedKeys.add(`${item.code}::${item.affectedNodes?.[0] ?? ''}`)
            }
          })
        }
        const worthRefiningCount = resultsSectionData.confidence.uncertainties.filter(u => {
          if (u.code === 'SENSITIVE_ASSUMPTION') return false
          if (!BADGE_INTERNAL_PATTERN.test(u.message)) return true
          const key = `${u.code}::${u.affectedNodes?.[0] ?? ''}`
          return humanisedKeys.has(key)
        }).length

        // V16.2: VOI block visible for all decision states when hinge exists
        const voiBlockVisible = vm.decisionState != null && vm.hinge != null

        // Total badge = rendered items across all groups + VOI
        let badgeCount = visibleFragileCount + nextActionCount + actionGroups[1].items.length + worthRefiningCount
        if (voiBlockVisible) badgeCount += 1

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
                  || (vm.decisionState === 'robust' && badgeCount > 0)
                }
                testId="accordion-strengthen"
                badgeCount={hasGuidanceItems ? (guidanceItems?.length ?? 0) : badgeCount}
                badgeVariant={
                  vm.decisionState === 'indeterminate'
                    ? 'critical'
                    : vm.decisionState === 'sensitive'
                    ? 'warning'
                    : 'default'
                }
              >
                {/* Guidance items from orchestrator — replaces NextActionItem list when present */}
                {hasGuidanceItems ? (
                  <div className="flex flex-col gap-2 mb-3" data-testid="guidance-action-items">
                    {guidanceItems!.map((item) => (
                      <GuidanceActionItemRow
                        key={item.item_id}
                        item={item}
                        onActivate={onActivateGuidanceItem ?? (() => {})}
                      />
                    ))}
                  </div>
                ) : null}
                <ConfidenceSection
                  data={hasGuidanceItems
                    ? { ...resultsSectionData.confidence, nextActions: undefined, topNextActions: undefined }
                    : resultsSectionData.confidence}
                  onFocusNode={onFocusNode}
                  topDriverLabel={resultsSectionData.drivers.topDrivers[0]?.factorLabel}
                  topDriverId={resultsSectionData.drivers.topDrivers[0]?.factorKey}
                  visibleDriverCount={resultsSectionData.drivers.totalCount}
                  winnerConstraintAnalysis={resultsSectionData.recommendation.recommendedOption?.constraintAnalysis}
                  hinge={vm.hinge}
                  decisionState={vm.decisionState}
                  topAction={vm.topAction}
                  excludeFactorIds={hingeExcludeIds}
                  coachingReadiness={resultsSectionData.recommendation.coachingReadiness}
                  hasWinnerAbove50={resultsSectionData.recommendation.allOptions.some(o => (o.winProbability ?? 0) > 0.5)}
                />
              </Accordion>
              {/* V11: Robust compact VOI affordance — below collapsed accordion */}
              {/* V16.2: Only show when there are genuinely zero action items */}
              {vm.decisionState === 'robust' && vm.hinge && badgeCount === 0 && (
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

      {/* V14.3b: Dev-only build marker for deploy verification */}
      {import.meta.env.DEV && (
        <div className="text-[10px] text-text-light/40 text-center py-1" data-testid="dev-build-marker">
          {typeof __GIT_SHA__ !== 'undefined' ? __GIT_SHA__ : 'dev'}
        </div>
      )}
    </div>
  )
}

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

import { useRef, useCallback } from 'react'
import { typography } from '../../styles/typography'
import type { ResultsSectionDataReturn } from './useResultsSectionData'
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
        items={resultsSectionData.confidence.humanisedCritiques ?? []}
        onFocusNode={onFocusNode}
      />

      {/* ── SECTION 1: HERO ─────────────────────────────────────── */}
      {/* V9.2: Merged headline lives inside HeroSection. Goal label passed as prop. */}
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
          />
          <OptionCards
            options={resultsSectionData.recommendation.allOptions}
            winnerId={resultsSectionData.recommendation.recommendedOption?.id}
            hasGoalThreshold={resultsSectionData.recommendation.goalThreshold != null}
            storyHeadlines={resultsSectionData.recommendation.storyHeadlines}
            cardRefMap={optionCardRefs}
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

      {/* ── SECTION 4: STRENGTHEN ────────────────────────────────── */}
      {/* v7.10 T5: Auto-expand based on robustness.level === 'low' or 'very_low' */}
      <div>
        <Accordion
          title="What to do next"
          defaultExpanded={
            resultsSectionData.confidence.robustnessLevel === 'low' ||
            resultsSectionData.confidence.robustnessLevel === 'very_low'
          }
          testId="accordion-strengthen"
          badgeCount={
            // v7.6 Fix: Reflect visible cards — Group 1 capped at 3, Group 2 all visible
            Math.min(3, resultsSectionData.confidence.uncertainties.filter(u => u.code === 'SENSITIVE_ASSUMPTION').length) +
            resultsSectionData.confidence.uncertainties.filter(u => u.code !== 'SENSITIVE_ASSUMPTION').length +
            (resultsSectionData.confidence.evidenceGaps?.length ?? 0)
          }
          badgeVariant={
            resultsSectionData.confidence.tier.tier === 'needs_work'
              ? 'critical'
              : resultsSectionData.confidence.tier.tier === 'fair'
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
          />
        </Accordion>
      </div>

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

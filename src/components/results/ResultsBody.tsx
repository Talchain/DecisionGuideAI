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

import { typography } from '../../styles/typography'
import type { ResultsSectionDataReturn } from './useResultsSectionData'
import { RecommendationSection } from './RecommendationSection'
import { DriversSection } from './DriversSection'
import type { TornadoRow } from './TornadoChart'
import { ConfidenceSection } from './ConfidenceSection'
import { Accordion } from './Accordion'
import { SectionHeader } from './SectionHeader'
import { RangeVisualization } from './RangeVisualization'
import { TippingPoints } from './TippingPoints'

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
}: ResultsBodyProps) {
  return (
    <div className="flex flex-col gap-[18px]" data-testid="outputs-results-redesign">

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
          hideRangeVisualization
        />
      </div>

      {/* ── SECTION 2: OPTIONS COMPARISON ────────────────────────── */}
      {/* Standalone section with range bars — extracted from RecommendationSection */}
      {!resultsSectionData.recommendation.isSingleOption &&
       resultsSectionData.recommendation.allOptions.length > 1 && (
        <div>
          <SectionHeader
            title="How the options compare"
            testId="section-header-options"
          />
          <RangeVisualization
            options={resultsSectionData.recommendation.allOptions}
            goalThreshold={resultsSectionData.recommendation.goalThreshold}
            winnerId={resultsSectionData.recommendation.recommendedOption?.id}
            outcomeUnit={resultsSectionData.recommendation.outcomeUnit}
            outcomeUnitSymbol={resultsSectionData.recommendation.outcomeUnitSymbol}
            topDriverLabel={resultsSectionData.drivers.topDrivers?.[0]?.factorLabel}
            topDriverDirection={resultsSectionData.drivers.topDrivers?.[0]?.direction}
            winnerP10={resultsSectionData.recommendation.recommendedOption?.outcome?.p10 ?? null}
            isNormalised={resultsSectionData.recommendation.isNormalised}
            hasBaseline={resultsSectionData.recommendation.allOptions.some(o => o.isBaseline)}
          />
          {/* Tipping points below range bars */}
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
        />
      </div>

      {/* ── SECTION 4: STRENGTHEN ────────────────────────────────── */}
      {/* v7.10 T5: Auto-expand based on robustness.level === 'low' or 'very_low' */}
      <div>
        <Accordion
          title="Strengthen your analysis"
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
            resultsSectionData.confidence.tier.tier === 'strong' ? 'Good'
              : resultsSectionData.confidence.tier.tier === 'fair' ? 'Fair'
              : resultsSectionData.confidence.tier.tier === 'needs_work' ? 'Needs work'
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
          />
        </Accordion>
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

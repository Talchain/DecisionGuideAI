/**
 * DecisionSummary - Core decision synthesis card
 *
 * Answers: "What should I do?" by synthesizing:
 * - Success likelihood (p50)
 * - Confidence level with explanation
 * - Top driver (from CEE story)
 * - Comparison prompt (if 2+ options)
 *
 * Designed for quick scanning - user should understand
 * the recommendation in <10 seconds.
 */

import { useMemo, useEffect } from 'react'
import {
  Target,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Zap,
  Info,
  GitCompare,
} from 'lucide-react'
import { useCanvasStore } from '../store'
import { useISLConformal } from '../../hooks/useISLConformal'
import { useComparisonDetection } from '../hooks/useComparisonDetection'
import { useScenarioComparison } from '../hooks/useScenarioComparison'
import { buildRichGraphPayload } from '../utils/graphPayload'
import { formatOutcomeValue } from '../../lib/format'
import { typography } from '../../styles/typography'
import type { ConfidenceLevel } from '../../adapters/plot/types'

export interface RankingData {
  /** 1-indexed rank (1 = best) */
  rank: number
  /** Total number of options compared */
  totalOptions: number
  /** Percentage margin over second place (only for winner) */
  marginPct?: number
  /** Confidence in ranking */
  confidence: 'high' | 'medium' | 'low'
  /** Winner option name (when available) */
  winnerName?: string
  /** Current option name being viewed */
  currentOptionName?: string
}

interface DecisionSummaryProps {
  /** Baseline value for comparison display */
  baseline?: number | null
  /** Baseline name for context */
  baselineName?: string
  /** Goal direction for interpreting changes */
  goalDirection?: 'maximize' | 'minimize'
  /** Option ranking data (from run_bundle endpoint) */
  ranking?: RankingData | null
}

// Confidence styling
const confidenceConfig: Record<ConfidenceLevel, {
  icon: typeof CheckCircle
  bgColor: string
  borderColor: string
  textColor: string
  iconColor: string
  label: string
  guidance: string
}> = {
  high: {
    icon: CheckCircle,
    bgColor: 'bg-mint-50',
    borderColor: 'border-mint-200',
    textColor: 'text-mint-800',
    iconColor: 'text-mint-600',
    label: 'High Confidence',
    guidance: 'Proceed with confidence',
  },
  medium: {
    icon: AlertTriangle,
    bgColor: 'bg-banana-50',
    borderColor: 'border-banana-200',
    textColor: 'text-banana-800',
    iconColor: 'text-banana-600',
    label: 'Medium Confidence',
    guidance: 'Consider validating key assumptions',
  },
  low: {
    icon: AlertTriangle,
    bgColor: 'bg-carrot-50',
    borderColor: 'border-carrot-200',
    textColor: 'text-carrot-800',
    iconColor: 'text-carrot-600',
    label: 'Low Confidence',
    guidance: 'Gather more data before deciding',
  },
}

export function DecisionSummary({
  baseline,
  baselineName = 'baseline',
  goalDirection = 'maximize',
  ranking,
}: DecisionSummaryProps) {
  const results = useCanvasStore((s) => s.results)
  const runMeta = useCanvasStore((s) => s.runMeta)
  const nodes = useCanvasStore((s) => s.nodes)
  const edges = useCanvasStore((s) => s.edges)
  const report = results?.report

  // Comparison detection and orchestration
  const { canCompare, optionNodes } = useComparisonDetection()
  const { startComparison, loading: comparisonLoading } = useScenarioComparison()

  // Conformal predictions for specific guidance
  const { data: conformalData, loading: conformalLoading, predict } = useISLConformal()

  // Auto-fetch conformal predictions when results exist
  useEffect(() => {
    if (!report?.results || nodes.length === 0 || conformalData || conformalLoading) return

    const timer = setTimeout(() => {
      predict({
        graph: buildRichGraphPayload(nodes, edges),
        options: {
          enable_conformal: true,
          confidence_level: 0.95,
        },
      }).catch(() => {
        // Silently fail - specific guidance is optional
      })
    }, 500)

    return () => clearTimeout(timer)
  }, [report?.results, nodes, edges, conformalData, conformalLoading, predict])

  // Find worst calibrated node for specific guidance
  const worstCalibratedNode = useMemo(() => {
    if (!conformalData?.predictions) return null

    // Priority: poor > fair (only show for these)
    const calibrationOrder = { poor: 0, fair: 1, good: 2, excellent: 3 }
    const sorted = [...conformalData.predictions].sort(
      (a, b) => calibrationOrder[a.calibration_quality] - calibrationOrder[b.calibration_quality]
    )

    const worst = sorted[0]
    if (!worst || worst.calibration_quality === 'good' || worst.calibration_quality === 'excellent') {
      return null
    }

    // Find node label
    const node = nodes.find(n => n.id === worst.node_id)
    const nodeLabel = (node?.data as { label?: string })?.label || worst.node_id

    // Calculate range as ± percentage
    const range = Math.round((worst.confidence_interval.upper - worst.confidence_interval.lower) * 50)

    return {
      nodeId: worst.node_id,
      nodeLabel,
      quality: worst.calibration_quality,
      range,
    }
  }, [conformalData, nodes])

  // Extract key data
  const summaryData = useMemo(() => {
    if (!report?.results) return null

    const p50 = report.results.likely
    const p10 = report.results.conservative
    const p90 = report.results.optimistic
    const confidence = report.confidence
    const story = runMeta?.ceeReview?.story
    const topDriver = story?.key_drivers?.[0]

    // Calculate approximate 70% confidence band (p15-p85)
    // p15 = midpoint between p10 and p50
    // p85 = midpoint between p50 and p90
    let confidenceBand = null
    if (p10 !== undefined && p50 !== undefined && p90 !== undefined) {
      const p15 = p10 + (p50 - p10) * 0.5
      const p85 = p50 + (p90 - p50) * 0.5
      if (Math.abs(p85 - p15) >= 1) { // Only show if range is meaningful
        confidenceBand = { p15, p85 }
      }
    }

    // Calculate baseline comparison
    let baselineComparison = null
    const units = report.results.units || 'percent'

    if (baseline !== null && baseline !== undefined && p50 !== null && p50 !== undefined) {
      const delta = p50 - baseline

      // Detect if values are in 0-1 probability scale
      const isProbabilityScale = p50 >= 0 && p50 <= 1

      // Threshold for showing comparison:
      // - For 0-1 probability scale: 0.005 = 0.5 percentage points
      // - For 0-100 scale: 0.5 percentage points
      const threshold = isProbabilityScale ? 0.005 : 0.5

      if (Math.abs(delta) >= threshold) {
        const isIncrease = delta > 0
        const isPositive =
          (goalDirection === 'maximize' && isIncrease) ||
          (goalDirection === 'minimize' && !isIncrease)

        // For percentage/probability values, always show absolute change in pts
        // This avoids confusing "99% worse" when going from 100% to 1%
        let display: string
        if (units === 'percent' || isProbabilityScale) {
          // Convert to percentage points if in 0-1 scale
          const deltaPts = isProbabilityScale ? delta * 100 : delta
          display = `${isIncrease ? '+' : ''}${Math.round(deltaPts)} pts`
        } else {
          // For non-percentage units (currency, count), show relative change
          display = baseline === 0
            ? `${isIncrease ? '+' : ''}${Math.abs(delta).toFixed(0)}`
            : `${isIncrease ? '+' : ''}${((delta / Math.abs(baseline)) * 100).toFixed(0)}%`
        }

        baselineComparison = {
          delta,
          isIncrease,
          isPositive,
          display,
        }
      }
    }

    // Key insight fallback: CEE headline -> engine insights summary -> null
    // Suppress confusing backend-generated relative % change text for probability comparisons
    // The pattern "Outcome likely to (increase|decrease) by X%" is often misleading when
    // comparing probability values (e.g., 1% vs 99% shows as "-99%" which is confusing)
    const rawInsight = story?.headline ||
      report.insights?.summary?.trim() ||
      null

    // Filter out confusing relative percentage change headlines from backend
    // We show our own correctly-calculated baselineComparison.display instead
    const confusingPattern = /Outcome likely to (increase|decrease) by \d+%/i
    const keyInsight = rawInsight && confusingPattern.test(rawInsight) ? null : rawInsight

    return {
      p50,
      units: report.results.units || 'percent',
      unitSymbol: report.results.unitSymbol,
      confidence,
      headline: keyInsight,
      topDriver,
      baselineComparison,
      confidenceBand,
    }
  }, [report, runMeta, baseline, goalDirection])

  // Don't render if no results
  if (!summaryData) {
    return null
  }

  const confidenceLevel = (summaryData.confidence?.level || 'medium') as ConfidenceLevel
  const confConfig = confidenceConfig[confidenceLevel]
  const ConfidenceIcon = confConfig.icon

  // Determine outcome quality (for visual styling)
  const outcomeQuality =
    summaryData.p50 >= 60 ? 'strong' : summaryData.p50 >= 40 ? 'moderate' : 'weak'

  return (
    <div
      className="bg-paper-50 border border-sand-200 rounded-xl overflow-hidden shadow-sm"
      data-testid="decision-summary"
    >
      {/* Main outcome - prominent display */}
      <div className="px-4 py-4 border-b border-sand-100">
        {/* Header - show ranking badge inline, no "Recommended" label */}
        <div className="flex items-center gap-2 mb-2">
          <Target className="h-4 w-4 text-sky-600" aria-hidden="true" />
          <span className={`${typography.caption} font-medium text-sky-700 uppercase tracking-wide`}>
            Decision Summary
          </span>
          {ranking && (
            <span className={`${typography.caption} px-2 py-0.5 rounded-full ${
              ranking.rank === 1 ? 'bg-mint-100 text-mint-700' : 'bg-sand-100 text-sand-600'
            }`}>
              #{ranking.rank} of {ranking.totalOptions}
              {ranking.rank === 1 && ranking.marginPct !== undefined && ranking.marginPct > 0 && (
                <span> (+{ranking.marginPct.toFixed(0)}%)</span>
              )}
            </span>
          )}
          {ranking?.confidence === 'low' && (
            <span className={`${typography.caption} text-banana-700 bg-banana-50 px-2 py-0.5 rounded`}>
              Close call
            </span>
          )}
        </div>

        {/* Success likelihood - large, prominent */}
        <div className="flex items-baseline gap-3 mb-1">
          <span
            className={`text-3xl font-bold ${
              outcomeQuality === 'strong'
                ? 'text-mint-700'
                : outcomeQuality === 'moderate'
                  ? 'text-banana-700'
                  : 'text-carrot-700'
            }`}
          >
            {formatOutcomeValue(summaryData.p50, summaryData.units, summaryData.unitSymbol)}
          </span>
          <span className={`${typography.body} text-ink-600`}>
            {ranking?.currentOptionName || optionNodes[0]?.label
              ? `with '${ranking?.currentOptionName || optionNodes[0]?.label}'`
              : 'success likelihood'}
          </span>
        </div>

        {/* 70% confidence band */}
        {summaryData.confidenceBand && (
          <p className={`${typography.caption} text-ink-500 mb-2`}>
            70% likely: {formatOutcomeValue(summaryData.confidenceBand.p15, summaryData.units, summaryData.unitSymbol)}–{formatOutcomeValue(summaryData.confidenceBand.p85, summaryData.units, summaryData.unitSymbol)}
          </p>
        )}

        {/* Winner context - shown when NOT the winner but ranking available */}
        {ranking && ranking.rank !== 1 && ranking.winnerName && (
          <p className={`${typography.caption} text-ink-500 mb-2`}>
            Winner: {ranking.winnerName}
          </p>
        )}

        {/* Baseline comparison */}
        {summaryData.baselineComparison && (
          <div className="flex items-center gap-2 mb-2">
            {summaryData.baselineComparison.isIncrease ? (
              <TrendingUp
                className={`h-4 w-4 ${
                  summaryData.baselineComparison.isPositive ? 'text-mint-600' : 'text-carrot-600'
                }`}
              />
            ) : (
              <TrendingDown
                className={`h-4 w-4 ${
                  summaryData.baselineComparison.isPositive ? 'text-mint-600' : 'text-carrot-600'
                }`}
              />
            )}
            <span
              className={`${typography.bodySmall} font-medium ${
                summaryData.baselineComparison.isPositive ? 'text-mint-700' : 'text-carrot-700'
              }`}
            >
              {summaryData.baselineComparison.display}{' '}
              {summaryData.baselineComparison.isPositive ? 'better' : 'worse'} than {baselineName}
            </span>
          </div>
        )}

        {/* Headline from CEE story */}
        {summaryData.headline && (
          <p className={`${typography.body} text-ink-700 mt-2`}>{summaryData.headline}</p>
        )}
      </div>

      {/* Confidence section */}
      <div className={`px-4 py-3 ${confConfig.bgColor} border-b ${confConfig.borderColor}`}>
        <div className="flex items-start gap-3">
          <ConfidenceIcon
            className={`h-5 w-5 ${confConfig.iconColor} flex-shrink-0 mt-0.5`}
            aria-hidden="true"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`${typography.bodySmall} font-semibold ${confConfig.textColor}`}>
                {confConfig.label}
              </span>
              <span className={`${typography.caption} ${confConfig.textColor} opacity-70`}>
                {confConfig.guidance}
              </span>
            </div>
            {summaryData.confidence?.why && (
              <p className={`${typography.caption} ${confConfig.textColor} opacity-80`}>
                {summaryData.confidence.why}
              </p>
            )}
            {/* Specific node to validate - from conformal predictions */}
            {worstCalibratedNode && confidenceLevel !== 'high' && (
              <div className="mt-2 flex items-center gap-2">
                <Info className="h-3.5 w-3.5 text-sky-500 flex-shrink-0" aria-hidden="true" />
                <span className={`${typography.caption} text-sky-700`}>
                  Consider validating{' '}
                  <span className="font-medium">{worstCalibratedNode.nodeLabel}</span>
                  <span className={`ml-1 px-1.5 py-0.5 rounded text-xs ${
                    worstCalibratedNode.quality === 'poor'
                      ? 'bg-carrot-100 text-carrot-700'
                      : 'bg-banana-100 text-banana-700'
                  }`}>
                    {worstCalibratedNode.quality === 'poor' ? 'Low' : 'Fair'} ±{worstCalibratedNode.range}%
                  </span>
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Top driver - if available */}
      {summaryData.topDriver && (
        <div className="px-4 py-3 border-b border-sand-100">
          <div className="flex items-start gap-2">
            <Zap className="h-4 w-4 text-sky-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <span className={`${typography.caption} text-ink-500`}>Key driver: </span>
              <span className={`${typography.bodySmall} text-ink-800 font-medium`}>
                {summaryData.topDriver.label}
              </span>
              {summaryData.topDriver.why && (
                <p className={`${typography.caption} text-ink-500 mt-0.5`}>
                  {summaryData.topDriver.why}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Compare CTA - only when 2+ options */}
      {canCompare && optionNodes.length >= 2 && (
        <div className="px-4 py-3 border-t border-sand-100">
          <button
            type="button"
            onClick={() => startComparison()}
            disabled={comparisonLoading}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <GitCompare className="h-4 w-4" aria-hidden="true" />
            {comparisonLoading ? 'Comparing...' : `Compare ${optionNodes.length} Options`}
          </button>
        </div>
      )}

    </div>
  )
}

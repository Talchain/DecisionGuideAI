/**
 * DecisionSummary - Core decision synthesis card
 *
 * Answers: "What should I do?" by synthesizing:
 * - Objective (what we're trying to achieve)
 * - Success likelihood (p50)
 * - Why this option (plain English rationale from CEE)
 * - Confidence level with explanation
 *
 * Compare CTA is in OutputsDock action buttons row for single primary CTA pattern.
 * Designed for quick scanning - user should understand
 * the recommendation in <10 seconds.
 */

import { useMemo, useEffect, useState } from 'react'
import {
  Target,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Zap,
  Info,
  GitCompare,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { useCanvasStore } from '../store'
import { useISLConformal } from '../../hooks/useISLConformal'
import { useComparisonDetection } from '../hooks/useComparisonDetection'
import { buildRichGraphPayload } from '../utils/graphPayload'
import { formatOutcomeValue, type OutcomeUnits } from '../../lib/format'
import { typography } from '../../styles/typography'
import { computeBaselineComparison } from '../utils/baselineComparison'
// P0.2: Precision display for confidence-aware outcome formatting
import { getPrecisionDisplay, type PrecisionDisplayResult } from '../../lib/precisionDisplay'
import { getRationale, type Rationale } from '../utils/ceeDataAdapter'
import type { ConfidenceLevel } from '../../adapters/plot/types'
import type { CeeDecisionReviewPayloadV1 } from '../../types/cee'
import type { CeeDecisionReviewPayload } from '../decisionReview/types'

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

interface GoalProbabilityData {
  /** Probability of achieving the goal (0-1) */
  probability: number
  /** Confidence in the estimate (0-1) */
  confidence: number
  /** Goal node label */
  goalLabel: string
}

/** P0.5: Comparative delta between options */
interface ComparisonDelta {
  winnerName: string
  comparatorName: string
  deltaPts: number
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
  /** P0.5: Comparative delta between options */
  comparisonDelta?: ComparisonDelta | null
  /** Objective text (from getObjectiveText) */
  objectiveText?: string
  /** CEE V1 review data for rationale extraction */
  ceeReviewV1?: CeeDecisionReviewPayloadV1 | null
  /** Legacy CEE review data for fallback */
  ceeReview?: CeeDecisionReviewPayload | null
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
  comparisonDelta,
  objectiveText,
  ceeReviewV1,
  ceeReview,
}: DecisionSummaryProps) {
  const results = useCanvasStore((s) => s.results)
  const runMeta = useCanvasStore((s) => s.runMeta)
  const nodes = useCanvasStore((s) => s.nodes)
  const edges = useCanvasStore((s) => s.edges)
  const report = results?.report

  // State for expandable "Why this option" section
  const [showWhyDetails, setShowWhyDetails] = useState(false)

  // Extract rationale from CEE data (with fallbacks)
  const rationale = useMemo<Rationale>(() => {
    // Use props if provided, otherwise fall back to runMeta
    const v1Data = ceeReviewV1 ?? runMeta?.ceeReviewV1
    const legacyData = ceeReview ?? runMeta?.ceeReview
    return getRationale(v1Data, legacyData, report)
  }, [ceeReviewV1, ceeReview, runMeta, report])

  // Comparison detection for ranking display
  const { optionNodes } = useComparisonDetection()

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

    // Calculate baseline comparison using unified utility (fixes P0 - consistent logic)
    const units: OutcomeUnits = (report.results.units || 'percent') as OutcomeUnits
    const baselineComparison = computeBaselineComparison({
      value: p50,
      baseline: baseline ?? undefined,
      units,
      goalDirection,
    })

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

    // Brief E Task 1: Extract goal probability for the current option
    let goalProbability: GoalProbabilityData | null = null
    if (report.option_probabilities && report.goal_node) {
      // Find the first option node to get its probability
      const optionNodes = nodes.filter(n => (n.data as any)?.kind === 'option')
      const currentOptionId = optionNodes[0]?.id
      if (currentOptionId && report.option_probabilities[currentOptionId]) {
        const prob = report.option_probabilities[currentOptionId]
        goalProbability = {
          probability: prob.goal_probability,
          confidence: prob.confidence,
          goalLabel: report.goal_node.label || 'your goal',
        }
      }
    }

    // P0.2: Compute precision display based on confidence level
    const confidenceLevel = (confidence?.level || 'medium') as ConfidenceLevel
    const precisionDisplay = getPrecisionDisplay({
      confidenceLevel,
      quantiles: { p10, p50, p90 },
      units,
      unitSymbol: report.results.unitSymbol,
    })

    return {
      p50,
      p10,
      p90,
      units,
      unitSymbol: report.results.unitSymbol,
      confidence,
      headline: keyInsight,
      topDriver,
      baselineComparison,
      confidenceBand,
      goalProbability,
      precisionDisplay, // P0.2: Precision-aware display
    }
  }, [report, runMeta, baseline, goalDirection, nodes])

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
      {/* Objective section - what we're trying to achieve */}
      {objectiveText && (
        <div className="px-4 py-3 bg-sky-50 border-b border-sky-100">
          <div className="flex items-start gap-2">
            <Target className="h-4 w-4 text-sky-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <span className={`${typography.caption} font-medium text-sky-700 uppercase tracking-wide`}>
                Objective
              </span>
              <p className={`${typography.body} text-sky-900 mt-0.5`}>{objectiveText}</p>
            </div>
          </div>
        </div>
      )}

      {/* Main outcome - prominent display */}
      <div className="px-4 py-4 border-b border-sand-100">
        {/* Header - show ranking badge inline */}
        <div className="flex items-center gap-2 mb-2">
          <Zap className="h-4 w-4 text-mint-600" aria-hidden="true" />
          <span className={`${typography.caption} font-medium text-mint-700 uppercase tracking-wide`}>
            Recommended Option
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

        {/* Success likelihood - P0.2: Precision-aware display */}
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
            {summaryData.precisionDisplay.headline}
          </span>
          <span className={`${typography.body} text-ink-600`}>
            {/* Brief 26 Task 5: Use canvas node label as source of truth for consistency */}
            {optionNodes[0]?.label
              ? `with '${optionNodes[0].label}'`
              : summaryData.precisionDisplay.isPointEstimate ? 'success likelihood' : 'outcome range'}
          </span>
        </div>
        {/* P0.2: Secondary range display (for HIGH confidence) */}
        {summaryData.precisionDisplay.secondary && (
          <p className={`${typography.caption} text-ink-500 mb-1`}>
            Range: {summaryData.precisionDisplay.secondary}
          </p>
        )}
        {/* P0.2: Qualifier for LOW confidence */}
        {summaryData.precisionDisplay.qualifier && (
          <p className={`${typography.caption} text-carrot-600 font-medium mb-1`}>
            {summaryData.precisionDisplay.qualifier}
          </p>
        )}

        {/* Brief E Task 1: Goal probability display */}
        {summaryData.goalProbability && (
          <p className={`${typography.bodySmall} text-ink-600 mb-2`}>
            <span className="font-semibold">
              {Math.round(summaryData.goalProbability.probability * 100)}%
            </span>{' '}
            chance of achieving{' '}
            <span className="font-medium">{summaryData.goalProbability.goalLabel}</span>
            {summaryData.goalProbability.confidence < 0.7 && (
              <span className={`ml-2 ${typography.caption} text-banana-600`}>
                (low confidence)
              </span>
            )}
          </p>
        )}

        {/* 70% confidence band */}
        {summaryData.confidenceBand && (
          <p className={`${typography.caption} text-ink-500 mb-2`}>
            70% likely: {formatOutcomeValue(summaryData.confidenceBand.p15, summaryData.units, summaryData.unitSymbol)}–{formatOutcomeValue(summaryData.confidenceBand.p85, summaryData.units, summaryData.unitSymbol)}
          </p>
        )}

        {/* Winner context - shown when NOT the winner but ranking available */}
        {/* Brief 26 Task 5: Use canvas node label for consistency */}
        {ranking && ranking.rank !== 1 && (
          <p className={`${typography.caption} text-ink-500 mb-2`}>
            Winner: {optionNodes.find(o => o.label === ranking.winnerName)?.label || ranking.winnerName || 'Alternative option'}
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
        {/* P0.5: Comparative delta between options */}
        {comparisonDelta && (
          <div className="flex items-center gap-2 mb-2">
            <GitCompare className="h-4 w-4 text-sky-600" aria-hidden="true" />
            <span className={`${typography.bodySmall} text-ink-700`}>
              <span className="font-semibold">{comparisonDelta.winnerName}</span>
              {' vs '}
              <span>{comparisonDelta.comparatorName}</span>
              {': '}
              <span className={`font-semibold ${comparisonDelta.deltaPts >= 0 ? 'text-mint-700' : 'text-carrot-700'}`}>
                {comparisonDelta.deltaPts >= 0 ? '+' : ''}{comparisonDelta.deltaPts.toFixed(0)} pts
              </span>
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

      {/* Why this option - CEE rationale with expandable details */}
      {(rationale.source !== 'none' || summaryData.topDriver) && (
        <div className="px-4 py-3 border-b border-sand-100">
          {rationale.source !== 'none' ? (
            // CEE-based rationale
            <div>
              <button
                type="button"
                onClick={() => setShowWhyDetails(!showWhyDetails)}
                className="w-full text-left flex items-start gap-2 group"
              >
                <div className="flex items-center gap-1 flex-shrink-0 mt-0.5">
                  {showWhyDetails ? (
                    <ChevronDown className="h-4 w-4 text-ink-400" aria-hidden="true" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-ink-400" aria-hidden="true" />
                  )}
                  <Info className="h-4 w-4 text-sky-500" aria-hidden="true" />
                </div>
                <div className="flex-1">
                  <span className={`${typography.caption} font-medium text-sky-700 uppercase tracking-wide`}>
                    Why this option
                  </span>
                  <p className={`${typography.body} text-ink-700 mt-1`}>
                    {rationale.headline}
                  </p>
                </div>
              </button>

              {/* Expandable driver details */}
              {showWhyDetails && rationale.drivers.length > 0 && (
                <div className="mt-3 ml-6 space-y-2">
                  {rationale.drivers.map((driver, idx) => (
                    <div key={idx} className="flex items-start gap-2">
                      <Zap className="h-3.5 w-3.5 text-banana-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
                      <div>
                        <span className={`${typography.bodySmall} text-ink-800 font-medium`}>
                          {driver.label}
                        </span>
                        {driver.explanation && (
                          <p className={`${typography.caption} text-ink-500 mt-0.5`}>
                            {driver.explanation}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            // Fallback to legacy top driver
            <div className="flex items-start gap-2">
              <Zap className="h-4 w-4 text-sky-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <span className={`${typography.caption} text-ink-500`}>Key driver: </span>
                <span className={`${typography.bodySmall} text-ink-800 font-medium`}>
                  {summaryData.topDriver?.label}
                </span>
                {summaryData.topDriver?.why && (
                  <p className={`${typography.caption} text-ink-500 mt-0.5`}>
                    {summaryData.topDriver.why}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Compare CTA moved to OutputsDock action buttons row for single primary CTA pattern */}

    </div>
  )
}

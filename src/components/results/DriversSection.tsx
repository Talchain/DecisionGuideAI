/**
 * DriversSection Component - Redesigned
 *
 * "What's Influencing This" panel with column-based layout.
 *
 * Features:
 * - Panel title at top, separate from grid
 * - Column headers: "Sensitivity" and "Confidence" (right-aligned above bars)
 * - Direction arrows with matching bar colors (↘ orange, ↗ green)
 * - Two bars per row (Sensitivity + Confidence)
 * - Factor names can wrap, bars stay aligned
 * - Expanded view with contextual insights
 * - ISL unavailable error state with retry
 */

import { useState, useCallback, useEffect, useRef } from 'react'
import type { DriversSectionData, DriverItem } from './types'
import { focusNodeById } from '../../canvas/utils/focusHelpers'
import { EMPTY_STATES } from './emptyStates'
import { formatFlipRiskMessage } from './utils/formatScenarioRatio'
import { FactorInsights, hasEnrichmentContent } from './FactorInsights'
import { Info, ExternalLink } from 'lucide-react'

interface DriversSectionProps {
  data: DriversSectionData
  onFocusNode?: (nodeId: string) => void
  onRetry?: () => void
  /** Goal label for direction-based interpretation fallback (Task 3.5) */
  goalLabel?: string
}

// Bar colors (hex values as specified)
const BAR_COLORS = {
  green: '#10B981',   // Positive direction
  orange: '#F97316',  // Negative direction
  blue: '#3B82F6',    // Confidence (always)
  neutral: '#94A3B8', // slate-400, for unknown direction (Fix 4)
}

// Grid columns constant - shared between header and rows to avoid alignment drift
// Two data columns: Sensitivity (direction-colored) + Confidence (always blue)
const GRID_COLS = 'grid-cols-[minmax(120px,1fr)_85px_85px]'

// Zero reason display messages - explains why sensitivity is zero
const ZERO_REASON_MESSAGES: Record<string, string> = {
  intervention_override: 'Directly controlled by your options',
  disconnected: 'No causal path to goal',
  zero_outcome_diff: "Changes don't affect outcome",
}

// Tooltip component for secondary information
function FactorTooltip({
  content,
  isOpen,
  onClose,
  triggerRef,
  id,
}: {
  content: React.ReactNode
  isOpen: boolean
  onClose: () => void
  triggerRef: React.RefObject<HTMLButtonElement>
  id: string
}) {
  const tooltipRef = useRef<HTMLDivElement>(null)

  // Close on click outside and Escape key
  useEffect(() => {
    if (!isOpen) return
    function handleClickOutside(e: MouseEvent) {
      if (
        tooltipRef.current &&
        !tooltipRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        onClose()
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
        // Return focus to trigger button
        triggerRef.current?.focus()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose, triggerRef])

  if (!isOpen) return null

  return (
    <div
      ref={tooltipRef}
      id={id}
      className="absolute z-50 left-0 right-0 mt-1 p-3 bg-white border border-slate-200 rounded-lg shadow-lg text-xs text-slate-600 space-y-1.5"
      role="tooltip"
    >
      {content}
    </div>
  )
}

// Progress bar component with inline styles for precise colors
function ProgressBar({
  value,
  color,
  'aria-label': ariaLabel,
}: {
  value: number
  color: 'green' | 'orange' | 'blue' | 'neutral'
  'aria-label': string
}) {
  // Fix 3: Clamp value to [0,1] range before converting to percent
  const clampedValue = Math.max(0, Math.min(1, value))
  const percent = Math.round(clampedValue * 100)

  return (
    // P0 Fix: Reduced gap from gap-2 (8px) to gap-1 (4px) for tighter bar-percentage spacing
    <div className="flex items-center gap-1 w-full">
      <div
        className="flex-1 h-2 bg-sand-200 rounded-full overflow-hidden"
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={ariaLabel}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${percent}%`, backgroundColor: BAR_COLORS[color] }}
        />
      </div>
      <span className="text-xs font-mono text-slate-600 w-9 text-right">
        {percent}%
      </span>
    </div>
  )
}

// Expanded row details
function ExpandedDetails({
  driver,
  onFocus,
  goalLabel,
}: {
  driver: DriverItem
  onFocus?: (nodeId: string) => void
  /** Goal label for direction-based interpretation fallback (Task 3.5) */
  goalLabel?: string
}) {
  const handleFocusClick = useCallback(() => {
    if (driver.canFocus) {
      const nodeId = driver.matchedNodeId ?? driver.factorKey
      if (onFocus) {
        onFocus(nodeId)
      } else {
        focusNodeById(nodeId)
      }
    }
  }, [driver.canFocus, driver.matchedNodeId, driver.factorKey, onFocus])

  // Generate contextual insight copy only when we have real magnitude data
  const elasticityInsight = driver.rawElasticity > 0.001
    ? `A 10% change here shifts your goal by ~${Math.round(driver.rawElasticity * 10)}%`
    : null

  // Task 3.5: Direction-based interpretation fallback when no elasticity data
  // Priority: elasticity insight → direction-based interpretation → null
  const directionInterpretation = !elasticityInsight && goalLabel && driver.direction
    ? driver.direction === 'positive'
      ? `Increases ${goalLabel}`
      : driver.direction === 'negative'
        ? `Decreases ${goalLabel}`
        : null
    : null

  const alternativeWinnerLabel = driver.fragileEdgeInfo?.alternativeWinnerLabel

  // Task 2: Decision change risk display based on category with proper edge case guards
  // - isolated: can change decision alone → show scenario-tested percentage
  // - correlated: contributes to joint risk → show qualitative message
  // - negligible: unlikely to affect decision → no risk text
  // - undefined (fallback): use existing marginal-based display for older PLoT versions
  let decisionChangeRisk: string | null = null
  if (driver.flipRiskCategory === 'isolated') {
    // Show scenario-tested message for isolated factors (can change decision alone)
    // Uses formatFlipRiskMessage which handles edge cases: p<=0, p>1, NaN, null
    decisionChangeRisk = formatFlipRiskMessage(
      driver.fragileEdgeInfo?.switchProbability,
      alternativeWinnerLabel
    )
  } else if (driver.flipRiskCategory === 'correlated') {
    // Task 10: Align with "scenarios tested" terminology used throughout Results Panel
    decisionChangeRisk = 'In some scenarios tested, this factor can change which option is best'
  } else if (driver.flipRiskCategory === 'negligible') {
    // No risk text for negligible factors
    decisionChangeRisk = null
  } else {
    // Fallback: use existing behavior when category is undefined (old PLoT)
    // Uses formatFlipRiskMessage which handles edge cases: p<=0, p>1, NaN, null
    decisionChangeRisk = formatFlipRiskMessage(
      driver.fragileEdgeInfo?.switchProbability,
      alternativeWinnerLabel
    )
  }

  // Show "Could benefit from more evidence" when VOI > 0.05 (investigation could change decision)
  // VOI = 0 means "even if you gather more data, the decision won't change"
  const showQualityHint = typeof driver.valueOfInformation === 'number' && driver.valueOfInformation > 0.05

  return (
    <div className="px-4 pb-3 pt-1 border-t border-slate-100 bg-slate-50/50 text-xs text-slate-600 space-y-1.5">
      {elasticityInsight && <p>{elasticityInsight}</p>}
      {/* Task 3.5: Direction-based fallback when no elasticity data */}
      {directionInterpretation && <p className="text-slate-500">{directionInterpretation}</p>}
      {decisionChangeRisk && <p>{decisionChangeRisk}</p>}
      {showQualityHint && (
        <p className="text-xs text-slate-500 flex items-center gap-1">
          <span aria-hidden="true">⚠️</span>
          Could benefit from more evidence
        </p>
      )}
      {/* Zero reason message - explains why this factor shows zero sensitivity */}
      {driver.zeroReason && ZERO_REASON_MESSAGES[driver.zeroReason] && (
        <p className="text-xs text-slate-500 flex items-center gap-1">
          <span aria-hidden="true">ℹ️</span>
          {ZERO_REASON_MESSAGES[driver.zeroReason]}
        </p>
      )}

      {driver.canFocus && (
        <button
          onClick={handleFocusClick}
          className="text-xs text-sky-600 hover:text-sky-700 flex items-center gap-1 mt-2"
        >
          Focus on canvas <span aria-hidden="true">→</span>
        </button>
      )}

      {/* CEE-generated insights (observations, perspectives, confidence question) */}
      {driver.enrichment && hasEnrichmentContent(driver.enrichment) && (
        <FactorInsights enrichment={driver.enrichment} />
      )}
    </div>
  )
}

// Individual driver row - Compact 2-line structure
function DriverRow({
  driver,
  onFocus,
  goalLabel,
}: {
  driver: DriverItem
  onFocus?: (nodeId: string) => void
  /** Goal label for direction-based interpretation fallback (Task 3.5) */
  goalLabel?: string
}) {
  const [isTooltipOpen, setIsTooltipOpen] = useState(false)
  const infoButtonRef = useRef<HTMLButtonElement>(null)

  // Direction styling - arrow color matches bar color
  const directionIcon = driver.direction === 'positive' ? '↗' : driver.direction === 'negative' ? '↘' : '•'
  const directionColor = driver.direction === 'positive'
    ? BAR_COLORS.green
    : driver.direction === 'negative'
      ? BAR_COLORS.orange
      : BAR_COLORS.neutral
  const barColor: 'green' | 'orange' | 'neutral' = driver.direction === 'positive'
    ? 'green'
    : driver.direction === 'negative'
      ? 'orange'
      : 'neutral'

  // Use ISL influence_score (0-1) directly for Sensitivity column
  const sensitivityValue = driver.influenceScore ?? driver.normalisedInfluence
  const hasSensitivityData = sensitivityValue != null && sensitivityValue >= 0

  // Confidence value (0-1)
  const confidenceValue = typeof driver.confidence === 'number'
    ? Math.max(0, Math.min(1, driver.confidence))
    : null

  // Compact impact copy for second line
  const impactShift = driver.rawElasticity > 0.001
    ? Math.round(driver.rawElasticity * 10)
    : null
  const compactImpact = impactShift !== null
    ? `10% change → ~${impactShift}% shift`
    : driver.direction && goalLabel
      ? driver.direction === 'positive' ? `↗ ${goalLabel}` : `↘ ${goalLabel}`
      : null

  // Determine if we have secondary content for tooltip
  const alternativeWinnerLabel = driver.fragileEdgeInfo?.alternativeWinnerLabel
  const decisionChangeRisk = driver.flipRiskCategory === 'isolated'
    ? formatFlipRiskMessage(driver.fragileEdgeInfo?.switchProbability, alternativeWinnerLabel)
    : driver.flipRiskCategory === 'correlated'
      ? 'In some scenarios tested, this factor can change which option is best'
      : driver.flipRiskCategory !== 'negligible'
        ? formatFlipRiskMessage(driver.fragileEdgeInfo?.switchProbability, alternativeWinnerLabel)
        : null
  const showQualityHint = typeof driver.valueOfInformation === 'number' && driver.valueOfInformation > 0.05
  const hasEnrichment = driver.enrichment && hasEnrichmentContent(driver.enrichment)
  const hasZeroReason = driver.zeroReason && ZERO_REASON_MESSAGES[driver.zeroReason]
  const hasTooltipContent = decisionChangeRisk || showQualityHint || hasEnrichment || hasZeroReason

  const handleFocusClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (driver.canFocus) {
      const nodeId = driver.matchedNodeId ?? driver.factorKey
      if (onFocus) {
        onFocus(nodeId)
      } else {
        focusNodeById(nodeId)
      }
    }
  }, [driver.canFocus, driver.matchedNodeId, driver.factorKey, onFocus])

  const toggleTooltip = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setIsTooltipOpen(prev => !prev)
  }, [])

  // Tooltip content
  const tooltipContent = (
    <>
      {/* Full elasticity insight */}
      {driver.rawElasticity > 0.001 && (
        <p>A 10% change here shifts your goal by ~{Math.round(driver.rawElasticity * 10)}%</p>
      )}
      {/* Decision change risk */}
      {decisionChangeRisk && <p>{decisionChangeRisk}</p>}
      {/* Quality hint */}
      {showQualityHint && (
        <p className="flex items-center gap-1">
          <span aria-hidden="true">⚠️</span>
          Could benefit from more evidence
        </p>
      )}
      {/* Zero reason */}
      {hasZeroReason && (
        <p className="flex items-center gap-1">
          <span aria-hidden="true">ℹ️</span>
          {ZERO_REASON_MESSAGES[driver.zeroReason!]}
        </p>
      )}
      {/* CEE-generated insights */}
      {hasEnrichment && <FactorInsights enrichment={driver.enrichment!} />}
    </>
  )

  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden bg-white relative">
      {/* Line 1: Factor name + bars */}
      <div className={`grid ${GRID_COLS} gap-3 items-center p-3 pb-1`}>
        {/* Factor name with direction arrow */}
        <div className="flex items-start gap-1.5 min-w-0">
          <span
            className="text-sm flex-shrink-0 mt-0.5"
            style={{ color: directionColor }}
            aria-hidden="true"
          >
            {directionIcon}
          </span>
          <span className="text-sm text-slate-800 break-words leading-snug">
            {driver.factorLabel}
          </span>
        </div>

        {/* Sensitivity bar */}
        {hasSensitivityData ? (
          <ProgressBar
            value={sensitivityValue}
            color={barColor}
            aria-label={`${driver.factorLabel} sensitivity: ${Math.round(sensitivityValue * 100)}%`}
          />
        ) : (
          <div className="text-xs font-mono text-slate-400 w-9 text-right">—</div>
        )}

        {/* Confidence bar */}
        {confidenceValue !== null ? (
          <ProgressBar
            value={confidenceValue}
            color="blue"
            aria-label={`${driver.factorLabel} confidence: ${Math.round(confidenceValue * 100)}%`}
          />
        ) : (
          <div className="text-xs font-mono text-slate-400 w-9 text-right">—</div>
        )}
      </div>

      {/* Line 2: Compact impact + icons */}
      <div className="px-3 pb-2 flex items-center justify-between gap-2">
        <span className="text-xs text-slate-500 truncate">
          {compactImpact || '\u00A0'}
        </span>
        <div className="flex items-center gap-1 flex-shrink-0">
          {/* Info icon - reveals tooltip */}
          {hasTooltipContent && (
            <button
              ref={infoButtonRef}
              onClick={toggleTooltip}
              onMouseEnter={() => setIsTooltipOpen(true)}
              onMouseLeave={() => setIsTooltipOpen(false)}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded transition-colors"
              style={{ minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              aria-label="More information"
              aria-expanded={isTooltipOpen}
              aria-describedby={isTooltipOpen ? `tooltip-${driver.factorKey}` : undefined}
            >
              <Info className="w-4 h-4" />
            </button>
          )}
          {/* Focus icon - focuses on canvas */}
          {driver.canFocus && (
            <button
              onClick={handleFocusClick}
              className="p-1.5 text-sky-500 hover:text-sky-600 hover:bg-sky-50 rounded transition-colors"
              style={{ minWidth: '44px', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              aria-label={`Focus ${driver.factorLabel} on canvas`}
            >
              <ExternalLink className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Tooltip */}
      <FactorTooltip
        content={tooltipContent}
        isOpen={isTooltipOpen}
        onClose={() => setIsTooltipOpen(false)}
        triggerRef={infoButtonRef}
        id={`tooltip-${driver.factorKey}`}
      />
    </div>
  )
}

// Error state component
function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-center">
      <p className="text-sm text-amber-800 font-medium mb-2">
        Unable to calculate factor sensitivity — service unavailable
      </p>
      <p className="text-xs text-amber-600 mb-3">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-1.5 text-sm font-medium text-amber-700 bg-white border border-amber-300 rounded hover:bg-amber-50 transition-colors"
        >
          Retry
        </button>
      )}
    </div>
  )
}

export function DriversSection({
  data,
  onFocusNode,
  onRetry,
  goalLabel,
}: DriversSectionProps) {
  const [showAll, setShowAll] = useState(false)
  const { drivers, driversStatus, topDrivers, hasMagnitudeData, islError, hiddenZeroImpactCount } = data

  // Diagnostic logging for data issues (debug mode only)
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).__OLUMI_DEBUG && drivers.length > 0) {
      console.log('[DriversSection] Data diagnostic:', {
        driverCount: drivers.length,
        driversStatus,
        hasMagnitudeData,
        islError,
      })
    }
  }, [drivers, driversStatus, hasMagnitudeData, islError])

  // ISL error state - no mock data, clear error message
  if (islError) {
    return <ErrorState message={islError} onRetry={onRetry} />
  }

  // Unavailable state
  if (driversStatus !== 'computed') {
    return (
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
        <p className="text-sm text-slate-600 flex items-start gap-2">
          <span aria-hidden="true">ℹ️</span>
          {EMPTY_STATES.drivers}
        </p>
      </div>
    )
  }

  // No drivers
  if (drivers.length === 0) {
    return (
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
        <p className="text-sm text-slate-600 flex items-start gap-2">
          <span aria-hidden="true">ℹ️</span>
          {EMPTY_STATES.drivers}
        </p>
      </div>
    )
  }

  const displayDrivers = showAll ? drivers : topDrivers
  const hiddenCount = drivers.length - topDrivers.length

  return (
    <div className="space-y-4">
      {/* Column headers - right-aligned above bars only */}
      {/* NOTE: Panel title rendered by parent (OutputsDock section header) */}
      <div className={`grid ${GRID_COLS} gap-3 px-3`}>
        {/* Empty cell for factor name column */}
        <div />
        {/* Task 4: Renamed "Influence" → "Sensitivity" */}
        <div
          className="text-xs text-slate-500 text-right pr-6 cursor-help"
          title="How sensitive your goal is to changes in this factor"
        >
          Sensitivity
        </div>
        <div
          className="text-xs text-slate-500 text-right pr-6 cursor-help"
          title="How certain we are about this causal relationship"
        >
          Confidence
        </div>
      </div>

      {/* Driver rows */}
      <div className="space-y-2">
        {displayDrivers.map((driver) => (
          <DriverRow
            key={driver.factorKey}
            driver={driver}
            onFocus={onFocusNode}
            goalLabel={goalLabel}
          />
        ))}
      </div>

      {/* Expand/collapse */}
      {hiddenCount > 0 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="text-sm text-sky-600 hover:text-sky-700"
        >
          {showAll ? 'Show fewer factors' : `See all factors (+${hiddenCount} more)`}
        </button>
      )}

      {/* Zero-impact disclosure - only show when collapsed and there are hidden zero-impact factors */}
      {!showAll && hiddenZeroImpactCount !== undefined && hiddenZeroImpactCount > 0 && (
        <p className="text-xs text-slate-500 mt-1">
          {hiddenZeroImpactCount} zero-impact factor{hiddenZeroImpactCount === 1 ? '' : 's'} hidden by default
        </p>
      )}
    </div>
  )
}

export default DriversSection

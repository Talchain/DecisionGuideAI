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
import { cleanFactorLabel, stripEncodingNotation } from './utils/cleanFactorLabel'
import { TornadoChart, type TornadoRow } from './TornadoChart'
import { typography } from '../../styles/typography'
import { Info, AlertTriangle } from 'lucide-react'

interface DriversSectionProps {
  data: DriversSectionData
  onFocusNode?: (nodeId: string) => void
  onRetry?: () => void
  /** Goal label for direction-based interpretation fallback (Task 3.5) */
  goalLabel?: string
  /** Graph Interaction P1: ID of currently highlighted driver (from canvas selection sync) */
  highlightedDriverId?: string | null
  /** Graph Interaction P1: Ref callback to register driver row elements for scroll sync */
  registerDriverRef?: (factorKey: string, element: HTMLDivElement | null) => void
  /** Tornado chart: expected outcome (mean) for centre line */
  expectedOutcome?: number | null
  /** Tornado chart: p10/p90 outcome bounds per factor */
  tornadoRows?: TornadoRow[]
  /** Tornado chart: outcome unit type */
  outcomeUnit?: 'currency' | 'percent' | 'count'
  /** Tornado chart: outcome unit symbol */
  outcomeUnitSymbol?: string
  /** v7: When true, values are normalised model scores */
  isNormalised?: boolean
}

// Bar colors — use design system tokens, no hex literals
const BAR_COLORS = {
  green: 'var(--success)',    // Positive direction
  orange: 'var(--danger)',    // Negative direction
  blue: 'var(--info)',        // Confidence (always)
  neutral: 'var(--text-light)', // Unknown direction
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

/**
 * P1 Results Brief Item 7: Detect binary (0/1) factors from label pattern.
 * Binary factors need different sensitivity copy since "10% change" is incoherent.
 * Patterns detected: "(0/1)", "(0 or 1)", "yes/no", "(binary)"
 */
function isBinaryFactor(label: string): boolean {
  const binaryPatterns = [
    /\(0\/1\)/i,           // (0/1)
    /\(0 or 1\)/i,         // (0 or 1)
    /\(yes\/no\)/i,        // (yes/no)
    /\(binary\)/i,         // (binary)
    /\(on\/off\)/i,        // (on/off)
    /\(true\/false\)/i,    // (true/false)
  ]
  return binaryPatterns.some(pattern => pattern.test(label))
}

// Note: cleanFactorLabel imported from ./utils/cleanFactorLabel

/**
 * v7.5 T7: Softened sensitivity copy — "tends to shift" instead of causal assertions.
 * - Binary factors: "When true, outcome tends to shift by X%" (negative: "-X%")
 * - Continuous factors: "Higher values tend to shift outcome by X%" (negative: "-X%")
 * - Arrow icons provide direction context separately
 */
function getSensitivityCopy(
  label: string,
  rawElasticity: number,
  direction?: 'positive' | 'negative',
  goalLabel?: string
): string | null {
  // Only show copy when we have meaningful elasticity data
  if (rawElasticity <= 0.001) {
    // Fallback to direction-only when no elasticity
    if (direction && goalLabel) {
      return direction === 'positive' ? `↗ ${goalLabel}` : `↘ ${goalLabel}`
    }
    return null
  }

  const shiftPercent = Math.max(1, Math.round(rawElasticity * 10))
  const sign = direction === 'negative' ? '-' : ''

  if (isBinaryFactor(label)) {
    // Binary factor: softened phrasing
    return `When true, outcome tends to shift by ${sign}${shiftPercent}%`
  }

  // Continuous factor: softened phrasing
  return `Higher values tend to shift outcome by ${sign}${shiftPercent}%`
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
      className={`absolute z-50 left-0 right-0 mt-1 p-3 bg-white border border-slate-200 rounded-lg shadow-lg ${typography.panelBody} text-slate-600 space-y-1.5`}
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
      <span className={`${typography.panelBody} font-mono text-slate-600 w-9 text-right`}>
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

  // v7.5 T7: Softened elasticity copy
  const elasticityInsight = driver.rawElasticity > 0.001
    ? (() => {
        const shiftPercent = Math.max(1, Math.round(driver.rawElasticity * 10))
        const sign = driver.direction === 'negative' ? '-' : ''
        if (isBinaryFactor(driver.factorLabel)) {
          return `When true, outcome tends to shift by ${sign}${shiftPercent}%`
        }
        return `Higher values tend to shift outcome by ${sign}${shiftPercent}%`
      })()
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
    // Task 10: Align with "simulations" terminology used throughout Results Panel
    decisionChangeRisk = 'In some simulations, this factor can change which option is best'
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
    <div className={`px-4 pb-3 pt-1 border-t border-slate-100 bg-slate-50/50 ${typography.panelBody} text-slate-600 space-y-1.5`}>
      {elasticityInsight && <p>{elasticityInsight}</p>}
      {/* Task 3.5: Direction-based fallback when no elasticity data */}
      {directionInterpretation && <p className="text-slate-500">{directionInterpretation}</p>}
      {decisionChangeRisk && <p>{decisionChangeRisk}</p>}
      {showQualityHint && (
        <p className={`${typography.panelBody} text-slate-500 flex items-center gap-1`}>
          <span aria-hidden="true">⚠️</span>
          Could benefit from more evidence
        </p>
      )}
      {/* Zero reason message - explains why this factor shows zero sensitivity */}
      {driver.zeroReason && ZERO_REASON_MESSAGES[driver.zeroReason] && (
        <p className={`${typography.panelBody} text-slate-500 flex items-center gap-1`}>
          <span aria-hidden="true">ℹ️</span>
          {ZERO_REASON_MESSAGES[driver.zeroReason]}
        </p>
      )}

      {/* Task 2: Removed standalone "Focus on canvas" CTA - factor name is now clickable */}

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
  isHighlighted,
  registerRef,
}: {
  driver: DriverItem
  onFocus?: (nodeId: string) => void
  /** Goal label for direction-based interpretation fallback (Task 3.5) */
  goalLabel?: string
  /** Graph Interaction P1: Whether this row is highlighted from canvas selection */
  isHighlighted?: boolean
  /** Graph Interaction P1: Ref callback to register this row for scroll sync */
  registerRef?: (element: HTMLDivElement | null) => void
}) {
  const [isTooltipOpen, setIsTooltipOpen] = useState(false)
  const infoButtonRef = useRef<HTMLButtonElement>(null)

  // P1 Results Brief Item 6: Clean factor label encoding
  const { label: cleanedLabel, qualifier: labelQualifier } = cleanFactorLabel(driver.factorLabel)

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

  // P1 Results Brief Item 7: Use binary-aware sensitivity copy
  const compactImpact = getSensitivityCopy(driver.factorLabel, driver.rawElasticity, driver.direction, goalLabel)

  // Determine if we have secondary content for tooltip
  const alternativeWinnerLabel = driver.fragileEdgeInfo?.alternativeWinnerLabel
  const decisionChangeRisk = driver.flipRiskCategory === 'isolated'
    ? formatFlipRiskMessage(driver.fragileEdgeInfo?.switchProbability, alternativeWinnerLabel)
    : driver.flipRiskCategory === 'correlated'
      ? 'In some simulations, this factor can change which option is best'
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

  // v7.5 T7: Softened tooltip copy
  const tooltipElasticityCopy = driver.rawElasticity > 0.001
    ? (() => {
        const shiftPercent = Math.max(1, Math.round(driver.rawElasticity * 10))
        const sign = driver.direction === 'negative' ? '-' : ''
        if (isBinaryFactor(driver.factorLabel)) {
          return `When true, outcome tends to shift by ${sign}${shiftPercent}%`
        }
        return `Higher values tend to shift outcome by ${sign}${shiftPercent}%`
      })()
    : null

  // Tooltip content
  const tooltipContent = (
    <>
      {/* Full elasticity insight - P1: binary-aware copy */}
      {tooltipElasticityCopy && (
        <p>{tooltipElasticityCopy}</p>
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
    <div
      ref={registerRef}
      className={`rounded-lg border overflow-hidden bg-white relative transition-all duration-200 ${
        isHighlighted
          ? 'border-amber-400 ring-2 ring-amber-300 shadow-lg'
          : 'border-slate-200'
      }`}
    >
      {/* Line 1: Factor name + bars */}
      <div className={`grid ${GRID_COLS} gap-3 items-center p-3 pb-1`}>
        {/* Factor name with direction arrow - P1 Item 6: cleaned label */}
        {/* Task 2: Factor name is clickable instead of separate CTA */}
        <div className="flex items-start gap-1.5 min-w-0">
          <span
            className={`${typography.panelBody} flex-shrink-0 mt-0.5`}
            style={{ color: directionColor }}
            aria-hidden="true"
          >
            {directionIcon}
          </span>
          {driver.canFocus ? (
            <span
              role="link"
              tabIndex={0}
              onClick={handleFocusClick}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleFocusClick(e as unknown as React.MouseEvent) } }}
              className={`${typography.panelBody} text-text-body break-words leading-snug cursor-pointer hover:underline focus:outline-none focus:ring-2 focus:ring-info-500 focus:ring-offset-1 rounded`}
              aria-label={`Focus on ${cleanedLabel} in model`}
            >
              {cleanedLabel}
            </span>
          ) : (
            <span className={`${typography.panelBody} text-text-body break-words leading-snug`}>
              {cleanedLabel}
            </span>
          )}
        </div>

        {/* Sensitivity bar */}
        {hasSensitivityData ? (
          <ProgressBar
            value={sensitivityValue}
            color={barColor}
            aria-label={`${cleanedLabel} sensitivity: ${Math.round(sensitivityValue * 100)}%`}
          />
        ) : (
          <div className={`${typography.panelBody} font-mono text-slate-400 w-9 text-right`}>—</div>
        )}

        {/* Confidence bar */}
        {confidenceValue !== null ? (
          <ProgressBar
            value={confidenceValue}
            color="blue"
            aria-label={`${cleanedLabel} confidence: ${Math.round(confidenceValue * 100)}%`}
          />
        ) : (
          <div className={`${typography.panelBody} font-mono text-slate-400 w-9 text-right`}>—</div>
        )}
      </div>

      {/* Line 2: Compact impact + info icon */}
      <div className="px-3 pb-2 flex items-center justify-between gap-2">
        <span className={`${typography.panelBody} text-text-light truncate bg-sand-50/60 px-1.5 py-0.5 rounded`}>
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
          {/* Task 2: Removed standalone Focus icon - factor name is now clickable */}
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
      <p className={`${typography.panelHeader} text-amber-800 mb-2`}>
        Unable to calculate factor sensitivity — service unavailable
      </p>
      <p className={`${typography.panelBody} text-amber-600 mb-3`}>{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className={`px-4 py-2 ${typography.panelHeader} text-amber-700 bg-white border border-amber-300 rounded-lg hover:bg-amber-50 transition-colors`}
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
  highlightedDriverId,
  registerDriverRef,
  expectedOutcome,
  tornadoRows,
  outcomeUnit,
  outcomeUnitSymbol,
  isNormalised,
}: DriversSectionProps) {
  const [showAll, setShowAll] = useState(false)
  const { drivers, driversStatus, topDrivers, hasMagnitudeData, islError, hiddenZeroImpactCount, dominantFactorId, dominantFactorLabel } = data

  // Handle focus on dominant factor
  const handleDominantFactorFocus = useCallback(() => {
    if (dominantFactorId) {
      if (onFocusNode) {
        onFocusNode(dominantFactorId)
      } else {
        focusNodeById(dominantFactorId)
      }
    }
  }, [dominantFactorId, onFocusNode])

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
        <p className={`${typography.panelBody} text-slate-600 flex items-start gap-2`}>
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
        <p className={`${typography.panelBody} text-slate-600 flex items-start gap-2`}>
          <span aria-hidden="true">ℹ️</span>
          {EMPTY_STATES.drivers}
        </p>
      </div>
    )
  }

  // v7.5 T3: Single visibleDrivers array filtering on influenceScore >= 0.01
  // This ensures badge count, card rendering, "Show more/fewer", and tornado all use the same filtered set
  const INFLUENCE_THRESHOLD = 0.01
  const visibleDrivers = drivers.filter(d => {
    const influence = d.influenceScore ?? d.normalisedInfluence
    return typeof influence === 'number' && influence >= INFLUENCE_THRESHOLD
  })

  // v7.5 T3 Fix: Use visibleDrivers consistently (not topDrivers from data layer)
  const TOP_DRIVERS_COUNT = 3
  const displayDrivers = showAll ? visibleDrivers : visibleDrivers.slice(0, TOP_DRIVERS_COUNT)
  const hiddenCount = showAll ? 0 : Math.max(0, visibleDrivers.length - TOP_DRIVERS_COUNT)

  // Get dominant factor's influence percentage
  // Clamp to [0,1] before converting to percentage to handle out-of-range values
  const dominantFactorInfluence = dominantFactorId
    ? (() => {
        const driver = visibleDrivers.find(d => d.factorKey === dominantFactorId)
        if (!driver) return null
        const rawInfluence = driver.influenceScore ?? driver.normalisedInfluence
        const clampedInfluence = Math.max(0, Math.min(1, rawInfluence))
        return Math.round(clampedInfluence * 100)
      })()
    : null

  return (
    <div className="space-y-4">
      {/* M1 Coaching: Dominant factor warning callout */}
      {/* v7.2: GATED — coaching belongs in Strengthen section, not Drivers */}
      {/* Note: dominantFactorInfluence uses !== null to handle edge case of 0% (though detection requires >50%) */}
      {false && dominantFactorId && dominantFactorLabel && dominantFactorInfluence !== null && (
        <div className="p-3 bg-panel border border-warning rounded-lg flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className={`${typography.panelBody} text-text-body`}>
              {/* Patch 1: Clean encoding notation from dominant factor label */}
              <span>{stripEncodingNotation(dominantFactorLabel)}</span> dominates this decision ({dominantFactorInfluence}% influence). If this factor's weight is overestimated, the recommendation could change.
            </p>
            <button
              onClick={handleDominantFactorFocus}
              className={`${typography.panelBody} text-info hover:text-info-hover underline mt-1`}
            >
              Review on canvas
            </button>
          </div>
        </div>
      )}

      {/* Column headers - right-aligned above bars only */}
      {/* NOTE: Panel title rendered by parent (OutputsDock section header) */}
      <div className={`grid ${GRID_COLS} gap-3 px-3`}>
        {/* Empty cell for factor name column */}
        <div />
        {/* Task 4: Renamed "Influence" → "Sensitivity" */}
        <div
          className={`${typography.panelBody} text-slate-500 text-right pr-6 cursor-help`}
          title="How sensitive your goal is to changes in this factor"
        >
          Sensitivity
        </div>
        <div
          className={`${typography.panelBody} text-slate-500 text-right pr-6 cursor-help`}
          title="How certain the model is about this factor's influence, based on edge belief strength and evidence quality"
        >
          Confidence
        </div>
      </div>

      {/* Driver rows */}
      <div className="space-y-2.5">
        {displayDrivers.map((driver) => (
          <DriverRow
            key={driver.factorKey}
            driver={driver}
            onFocus={onFocusNode}
            goalLabel={goalLabel}
            isHighlighted={highlightedDriverId === driver.factorKey}
            registerRef={registerDriverRef
              ? (el) => registerDriverRef(driver.factorKey, el)
              : undefined
            }
          />
        ))}
      </div>

      {/* Expand/collapse */}
      {hiddenCount > 0 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className={`${typography.panelBody} text-sky-600 hover:text-sky-700`}
        >
          {showAll ? 'Show fewer factors' : `See all factors (+${hiddenCount} more)`}
        </button>
      )}

      {/* Zero-impact disclosure - only show when collapsed and there are hidden zero-impact factors */}
      {!showAll && hiddenZeroImpactCount !== undefined && hiddenZeroImpactCount > 0 && (
        <p className={`${typography.panelMeta} text-text-light italic mt-1`}>
          Some factors with minimal impact are not shown
        </p>
      )}

      {/* Tornado chart — always visible when data available */}
      {tornadoRows && tornadoRows.length > 0 && expectedOutcome != null && (() => {
        // v7.5 T3 Fix: Filter tornado rows to match visibleDrivers only
        const visibleFactorKeys = new Set(visibleDrivers.map(d => d.factorKey))
        const filteredTornadoRows = tornadoRows.filter(row => visibleFactorKeys.has(row.factorKey))

        return filteredTornadoRows.length > 0 && (
          <TornadoChart
            rows={filteredTornadoRows}
            expectedOutcome={expectedOutcome}
            outcomeUnit={outcomeUnit}
            outcomeUnitSymbol={outcomeUnitSymbol}
            onFocusNode={onFocusNode}
            isNormalised={isNormalised}
          />
        )
      })()}
    </div>
  )
}

export default DriversSection

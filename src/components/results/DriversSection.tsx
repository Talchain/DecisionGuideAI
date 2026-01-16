/**
 * DriversSection Component - Redesigned
 *
 * "What's Influencing This" panel with column-based layout.
 *
 * Features:
 * - Panel title at top, separate from grid
 * - Column headers: "Influence" and "Confidence" (right-aligned above bars)
 * - Direction arrows with matching bar colors (↘ orange, ↗ green)
 * - Two bars per row (Influence + Confidence)
 * - Factor names can wrap, bars stay aligned
 * - Expanded view with contextual insights
 * - ISL unavailable error state with retry
 */

import { useState, useCallback, useEffect } from 'react'
import type { DriversSectionData, DriverItem } from './types'
import { focusNodeById } from '../../canvas/utils/focusHelpers'

interface DriversSectionProps {
  data: DriversSectionData
  onFocusNode?: (nodeId: string) => void
  onRetry?: () => void
}

// Bar colors (hex values as specified)
const BAR_COLORS = {
  green: '#10B981',   // Positive direction
  orange: '#F97316',  // Negative direction
  blue: '#3B82F6',    // Confidence (always)
  neutral: '#94A3B8', // slate-400, for unknown direction (Fix 4)
}

// Grid columns constant - shared between header and rows to avoid alignment drift
// P0 Fix: Increased from 90px to 100px to prevent percentage text cut-off
const GRID_COLS = 'grid-cols-[minmax(140px,1fr)_100px_100px]'

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
        className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden"
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
      <span className="text-xs text-slate-600 font-mono w-9 text-right">
        {percent}%
      </span>
    </div>
  )
}

// Expanded row details
function ExpandedDetails({
  driver,
  totalCount,
  onFocus,
}: {
  driver: DriverItem
  totalCount: number
  onFocus?: (nodeId: string) => void
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

  // Generate contextual insight copy
  const elasticityInsight = driver.rawElasticity > 0.001
    ? `A 10% change here shifts your goal by ~${Math.round(driver.rawElasticity * 10)}%`
    : 'This factor affects your goal'

  const flipRisk = driver.fragileEdgeInfo?.switchProbability !== undefined
    ? `${Math.round((1 - driver.fragileEdgeInfo.switchProbability) * 100)}% chance this could flip to "${driver.fragileEdgeInfo.alternativeWinnerLabel ?? 'another option'}"`
    : null

  return (
    <div className="px-4 pb-3 pt-1 border-t border-slate-100 bg-slate-50/50 text-xs text-slate-600 space-y-1.5">
      <p>{elasticityInsight}</p>
      {flipRisk && <p>{flipRisk}</p>}

      {driver.canFocus && (
        <button
          onClick={handleFocusClick}
          className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 mt-2"
        >
          Focus on canvas <span aria-hidden="true">→</span>
        </button>
      )}
    </div>
  )
}

// Individual driver row
function DriverRow({
  driver,
  isExpanded,
  onToggleExpand,
  onFocus,
  totalCount,
}: {
  driver: DriverItem
  isExpanded: boolean
  onToggleExpand: () => void
  onFocus?: (nodeId: string) => void
  totalCount: number
}) {
  // Direction styling - arrow color matches bar color
  // P0 Fix: Single arrow serves as both direction indicator AND expand trigger
  // When expanded, arrow rotates to show expanded state
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

  // Confidence value (default to 0.7 if not available, matching DEFAULT_EDGE_DATA)
  const confidenceValue = driver.confidence ?? 0.7

  return (
    <div className="rounded-lg border border-slate-200 overflow-hidden bg-white">
      <button
        onClick={onToggleExpand}
        className="w-full text-left hover:bg-slate-50 transition-colors"
        aria-expanded={isExpanded}
      >
        {/* Grid layout: Factor name (flexible min-140px) | Influence bar (100px) | Confidence bar (100px) */}
        <div className={`grid ${GRID_COLS} gap-3 items-center p-3`}>
          {/* Factor name with single direction arrow (serves as expand trigger) */}
          <div className="flex items-start gap-1.5 min-w-0">
            {/* P0 Fix: Single arrow - direction indicator that also implies expand capability
                When expanded, arrow subtly changes (opacity) to indicate active state */}
            <span
              className={`text-sm flex-shrink-0 mt-0.5 transition-opacity ${isExpanded ? 'opacity-60' : ''}`}
              style={{ color: directionColor }}
              aria-hidden="true"
            >
              {directionIcon}
            </span>
            {/* Label - can wrap to multiple lines */}
            <span className="font-medium text-sm text-slate-800 break-words leading-snug">
              {driver.factorLabel}
            </span>
          </div>

          {/* Influence bar - color matches direction */}
          <ProgressBar
            value={driver.normalisedInfluence}
            color={barColor}
            aria-label={`${driver.factorLabel} influence: ${Math.round(driver.normalisedInfluence * 100)}%`}
          />

          {/* Confidence bar - always blue */}
          <ProgressBar
            value={confidenceValue}
            color="blue"
            aria-label={`${driver.factorLabel} confidence: ${Math.round(confidenceValue * 100)}%`}
          />
        </div>
      </button>

      {/* Expanded details */}
      {isExpanded && (
        <ExpandedDetails
          driver={driver}
          totalCount={totalCount}
          onFocus={onFocus}
        />
      )}
    </div>
  )
}

// Error state component
function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg text-center">
      <p className="text-sm text-amber-800 font-medium mb-2">
        Unable to calculate factor influence — service unavailable
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
}: DriversSectionProps) {
  const [showAll, setShowAll] = useState(false)
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set())
  const { drivers, driversStatus, topDrivers, totalCount, hasMagnitudeData, islError } = data

  // Diagnostic logging for data issues
  // Fix 3: Guard window access for SSR, Fix 5: Gate behind debug toggle
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).__OLUMI_DEBUG && drivers.length > 0) {
      console.log('[DriversSection] Data diagnostic:', {
        driverCount: drivers.length,
        driversStatus,
        hasMagnitudeData,
        islError,
        drivers: drivers.map(d => ({
          label: d.factorLabel,
          rawElasticity: d.rawElasticity,
          normalisedInfluence: d.normalisedInfluence,
          confidence: d.confidence,
          direction: d.direction,
        })),
      })

      // Check for data issues
      const driversWithZeroInfluence = drivers.filter(d => d.normalisedInfluence === 0)
      const driversWithDefaultConfidence = drivers.filter(d => d.confidence === undefined)

      if (driversWithZeroInfluence.length > 0) {
        console.warn('[DriversSection] Drivers with 0% influence:', driversWithZeroInfluence.map(d => d.factorLabel))
        console.warn('[DriversSection] Check if factor_sensitivity.elasticity is being returned from PLoT')
      }

      if (driversWithDefaultConfidence.length > 0) {
        console.warn('[DriversSection] Drivers missing confidence (using 70% default):', driversWithDefaultConfidence.map(d => d.factorLabel))
        console.warn('[DriversSection] Check if edge beliefExists is set for factor->goal edges')
      }
    }
  }, [drivers, driversStatus, hasMagnitudeData, islError])

  const toggleExpand = useCallback((key: string) => {
    setExpandedKeys(prev => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }, [])

  // ISL error state - no mock data, clear error message
  if (islError) {
    return <ErrorState message={islError} onRetry={onRetry} />
  }

  // Unavailable state
  if (driversStatus !== 'computed') {
    return (
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
        <p className="text-sm text-slate-600">
          We couldn't identify key factors. Try adding more detail to your model.
        </p>
      </div>
    )
  }

  // No drivers
  if (drivers.length === 0) {
    return (
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
        <p className="text-sm text-slate-600">
          No significant factors identified. Your model may need more connections.
        </p>
      </div>
    )
  }

  const displayDrivers = showAll ? drivers : topDrivers
  const hiddenCount = drivers.length - topDrivers.length

  return (
    <div className="space-y-3">
      {/* Column headers - right-aligned above bars only */}
      {/* NOTE: Panel title rendered by parent (OutputsDock section header) */}
      <div className={`grid ${GRID_COLS} gap-3 px-3`}>
        {/* Empty cell for factor name column */}
        <div />
        {/* Right-aligned headers over bar columns */}
        <div className="text-xs font-medium text-slate-500 text-right pr-6">Influence</div>
        <div className="text-xs font-medium text-slate-500 text-right pr-6">Confidence</div>
      </div>

      {/* Driver rows */}
      <div className="space-y-2">
        {displayDrivers.map((driver) => (
          <DriverRow
            key={driver.factorKey}
            driver={driver}
            isExpanded={expandedKeys.has(driver.factorKey)}
            onToggleExpand={() => toggleExpand(driver.factorKey)}
            onFocus={onFocusNode}
            totalCount={totalCount}
          />
        ))}
      </div>

      {/* Expand/collapse */}
      {hiddenCount > 0 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          {showAll ? 'Show fewer factors' : `See all factors (+${hiddenCount} more)`}
        </button>
      )}
    </div>
  )
}

export default DriversSection

/**
 * DriversSection Component
 *
 * Displays key factors influencing the decision outcome.
 * Part of the Results Panel redesign - "coaching over gates" approach.
 *
 * Features:
 * - Title: "What's influencing this" with microcopy
 * - Semantic labels: Biggest factor (rank 1), Strong/Moderate/Minor (threshold)
 * - Relative influence percentage (dynamic normalisation, max 100%)
 * - Direction arrows (positive/negative) or "Affects your goal" when unknown
 * - Expandable rows with raw elasticity and rank details
 * - Click-to-focus on canvas (gracefully disabled when no match)
 */

import { useState, useCallback } from 'react'
import type { DriversSectionData, DriverItem, DriverSemanticLabel } from './types'
import { focusNodeById } from '../../canvas/utils/focusHelpers'

interface DriversSectionProps {
  data: DriversSectionData
  onFocusNode?: (nodeId: string) => void
}

const SEMANTIC_LABELS: Record<DriverSemanticLabel, { label: string; color: string }> = {
  biggest: { label: 'Biggest factor', color: 'text-violet-700' },
  strong: { label: 'Strong influence', color: 'text-blue-700' },
  moderate: { label: 'Moderate influence', color: 'text-slate-600' },
  minor: { label: 'Minor influence', color: 'text-slate-400' },
}

/**
 * Direction-only row for when no magnitude data is available.
 * Shows direction arrow and "Affects your goal" instead of bars/percentages.
 */
function DirectionOnlyRow({
  driver,
  onFocus,
}: {
  driver: DriverItem
  onFocus?: (nodeId: string) => void
}) {
  const handleClick = useCallback(() => {
    if (driver.canFocus) {
      const nodeId = driver.matchedNodeId ?? driver.factorKey
      if (onFocus) {
        onFocus(nodeId)
      } else {
        focusNodeById(nodeId)
      }
    }
  }, [driver.canFocus, driver.matchedNodeId, driver.factorKey, onFocus])

  // Direction display
  const directionIcon = driver.direction === 'positive' ? '↗' : driver.direction === 'negative' ? '↘' : '→'
  const directionColor = driver.direction === 'positive'
    ? 'text-emerald-600'
    : driver.direction === 'negative'
      ? 'text-amber-600'
      : 'text-slate-400'
  const directionText = driver.direction === 'positive'
    ? 'Increases your goal'
    : driver.direction === 'negative'
      ? 'Decreases your goal'
      : 'Affects your goal'

  return (
    <div
      className={`
        rounded-lg bg-slate-50 border border-slate-200 p-3 flex items-center justify-between
        ${driver.canFocus ? 'hover:bg-slate-100 cursor-pointer' : ''}
      `}
      onClick={driver.canFocus ? handleClick : undefined}
      title={driver.canFocus ? `Click to focus ${driver.factorLabel} on canvas` : undefined}
    >
      <div className="flex items-center gap-2">
        <span className={`text-sm ${directionColor}`}>{directionIcon}</span>
        <span className="font-medium text-sm text-slate-800">
          {driver.factorLabel}
        </span>
      </div>
      <span className={`text-xs ${directionColor}`}>
        {directionText}
      </span>
    </div>
  )
}

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
  const handleClick = useCallback(() => {
    if (driver.canFocus) {
      const nodeId = driver.matchedNodeId ?? driver.factorKey
      if (onFocus) {
        onFocus(nodeId)
      } else {
        focusNodeById(nodeId)
      }
    }
  }, [driver.canFocus, driver.matchedNodeId, driver.factorKey, onFocus])

  const semanticInfo = SEMANTIC_LABELS[driver.semanticLabel]
  const influencePercent = Math.round(driver.normalisedInfluence * 100)
  const barWidth = influencePercent

  // Direction display
  const hasDirection = driver.direction !== undefined
  const directionIcon = driver.direction === 'positive' ? '↗' : driver.direction === 'negative' ? '↘' : ''
  const directionColor = driver.direction === 'positive'
    ? 'text-emerald-600'
    : driver.direction === 'negative'
      ? 'text-amber-600'
      : 'text-slate-400'
  const directionText = driver.direction === 'positive'
    ? 'Positive — increasing this improves your goal'
    : driver.direction === 'negative'
      ? 'Negative — increasing this reduces your goal'
      : 'Affects your goal'

  // Bar color based on direction
  const barColor = driver.direction === 'positive'
    ? 'bg-emerald-500'
    : driver.direction === 'negative'
      ? 'bg-amber-500'
      : 'bg-violet-500'

  return (
    <div className="rounded-lg bg-slate-50 border border-slate-200 overflow-hidden">
      {/* Main row - always visible */}
      <button
        onClick={onToggleExpand}
        className="w-full text-left p-3 hover:bg-slate-100 transition-colors"
        title="Click to expand for details"
        aria-expanded={isExpanded}
      >
        {/* Top line: Chevron + Label + Direction + Semantic label */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            {/* Expand/collapse chevron */}
            <span className={`text-slate-400 text-xs transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
              ▶
            </span>
            {hasDirection && (
              <span className={`text-sm ${directionColor}`}>{directionIcon}</span>
            )}
            <span className="font-medium text-sm text-slate-800">
              {driver.factorLabel}
            </span>
          </div>
          <span className={`text-xs font-medium ${semanticInfo.color}`}>
            {semanticInfo.label}
          </span>
        </div>

        {/* Influence bar + percentage */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${barColor}`}
              style={{ width: `${barWidth}%` }}
            />
          </div>
          <span className="text-xs text-slate-500 w-16 text-right">
            {influencePercent}%
          </span>
        </div>
      </button>

      {/* Expanded details */}
      {isExpanded && (
        <div className="px-3 pb-3 pt-1 border-t border-slate-200 bg-slate-100/50">
          <div className="space-y-2 text-xs text-slate-600">
            <div className="flex justify-between">
              <span>Raw elasticity:</span>
              <span className="font-mono">
                {driver.rawElasticity.toFixed(2)} (rank #{driver.rank} of {totalCount})
              </span>
            </div>
            <div className="flex justify-between">
              <span>Direction:</span>
              <span>{directionText}</span>
            </div>
          </div>

          {/* Focus button */}
          {driver.canFocus && (
            <button
              onClick={handleClick}
              className="mt-3 text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
            >
              <span>Focus on canvas</span>
              <span>→</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export function DriversSection({
  data,
  onFocusNode,
}: DriversSectionProps) {
  const [showAll, setShowAll] = useState(false)
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set())
  const { drivers, driversStatus, topDrivers, totalCount, hasMagnitudeData } = data

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

  // Unavailable state - header rendered by parent panel
  if (driversStatus !== 'computed') {
    return (
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
        <p className="text-sm text-slate-600">
          We couldn't identify key factors. Try adding more detail to your model.
        </p>
      </div>
    )
  }

  // No drivers - header rendered by parent panel
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

  // Direction-only fallback when no magnitude data available
  if (!hasMagnitudeData) {
    return (
      <div className="space-y-3">
        {/* Microcopy for direction-only view */}
        <p className="text-xs text-slate-500">
          These factors affect your goal. Add more detail for relative influence.
        </p>

        {/* Direction-only rows (no bars, no semantic labels) */}
        <div className="space-y-2">
          {displayDrivers.map((driver) => (
            <DirectionOnlyRow
              key={driver.factorKey}
              driver={driver}
              onFocus={onFocusNode}
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

  return (
    <div className="space-y-3">
      {/* Microcopy - header is rendered by parent panel */}
      <p className="text-xs text-slate-500">
        Relative influence compares factors within this model (top factor = 100%).
      </p>

      {/* Driver rows with magnitude bars */}
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

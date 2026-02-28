/**
 * TippingPoints Component
 *
 * @deprecated Superseded by tornado flip indicator (Phase 3.4). Kept until
 * tornado drag ships. Do not add new features here — migrate unique logic
 * (user-unit formatting) into TornadoChart before removal.
 *
 * Displays where the decision could flip — either as flip threshold tracks
 * (Mode A) or as relative driver strength bars (Mode B fallback).
 *
 * Mode A: flip_thresholds present — shows current (●) and flip (╳) markers on tracks
 * Mode B: flip_thresholds absent — horizontal bars by |elasticity|
 *
 * C4: Track domain uses observed_state.range when available, else padded [current, flip]
 * C5: Sorted by normalised margin (most fragile first)
 * C6: All values formatted via formatOutcomeValue
 */

import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { typography } from '../../styles/typography'
import { formatOutcomeValue } from '../../lib/format'
import { stripEncodingNotation } from './utils/cleanFactorLabel'
import { GraphLink } from './GraphLink'
import type { FlipThreshold, DriverItem, OutcomeUnitType } from './types'

// =============================================================================
// Mode A: Flip Threshold Tracks
// =============================================================================

export interface TippingPointsModeAProps {
  flipThresholds: FlipThreshold[]
  outcomeUnit?: OutcomeUnitType
  outcomeUnitSymbol?: string
}

function FlipThresholdRow({
  ft,
  outcomeUnit,
  outcomeUnitSymbol,
}: {
  ft: FlipThreshold & { _normalisedMargin?: number }
  outcomeUnit?: OutcomeUnitType
  outcomeUnitSymbol?: string
}) {
  const { current_value, flip_value, flip_reason, node_id, label, unit, alternative_winner_label } = ft

  // Determine unit type for formatting (C6)
  const effectiveUnit: OutcomeUnitType = (() => {
    if (unit === '%' || unit === 'percent') return 'percent'
    if (unit === '$' || unit === '£' || unit === '€') return 'currency'
    return outcomeUnit ?? 'count'
  })()
  const effectiveSymbol = (unit === '$' || unit === '£' || unit === '€')
    ? unit
    : outcomeUnitSymbol

  // C4: Track domain
  // flip_value: null or heuristic/no_bracket → no track, just "Stable across explored range"
  if (flip_value == null || flip_reason === 'heuristic' || flip_reason === 'no_bracket') {
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <GraphLink
            nodeId={node_id}
            label={stripEncodingNotation(label)}
            className={typography.panelHeader}
          />
        </div>
        <p className={`${typography.panelBody} text-text-light italic`}>
          Stable across explored range
        </p>
      </div>
    )
  }

  // Calculate track domain with 20% padding
  const lo = Math.min(current_value, flip_value)
  const hi = Math.max(current_value, flip_value)
  const span = hi - lo
  const padding = span > 0 ? span * 0.2 : Math.abs(lo) * 0.2 || 1
  const trackMin = lo - padding
  const trackMax = hi + padding
  const trackRange = trackMax - trackMin

  const currentPct = trackRange > 0 ? ((current_value - trackMin) / trackRange) * 100 : 50
  const flipPct = trackRange > 0 ? ((flip_value - trackMin) / trackRange) * 100 : 50

  return (
    <div className="space-y-1">
      {/* Factor label */}
      <GraphLink
        nodeId={node_id}
        label={stripEncodingNotation(label)}
        className={typography.panelHeader}
      />

      {/* Track with current (●) and flip (╳) markers */}
      <div className="relative h-1 bg-slate-200 rounded-full">
        {/* Current value marker (●) */}
        <div
          className="absolute w-2.5 h-2.5 -top-[3px] bg-info rounded-full border border-white"
          style={{ left: `${currentPct}%`, transform: 'translateX(-50%)' }}
          title={`Current: ${formatOutcomeValue(current_value, effectiveUnit, effectiveSymbol)}`}
        />
        {/* Flip value marker (╳) */}
        <div
          className="absolute w-2.5 h-2.5 -top-[3px] flex items-center justify-center"
          style={{ left: `${flipPct}%`, transform: 'translateX(-50%)' }}
          title={`Flips at: ${formatOutcomeValue(flip_value, effectiveUnit, effectiveSymbol)}`}
        >
          <span className={`${typography.panelMeta} text-danger leading-none`}>╳</span>
        </div>
      </div>

      {/* Value labels and alternative winner */}
      <div className="flex items-center justify-between">
        <span className={`${typography.panelBody} text-text-light tabular-nums`}>
          {formatOutcomeValue(current_value, effectiveUnit, effectiveSymbol)}
        </span>
        <span className={`${typography.panelBody} text-text-light tabular-nums`}>
          {formatOutcomeValue(flip_value, effectiveUnit, effectiveSymbol)}
        </span>
      </div>
      {alternative_winner_label && (
        <p className={`${typography.panelBody} text-danger`}>
          {stripEncodingNotation(alternative_winner_label)} becomes stronger
        </p>
      )}
    </div>
  )
}

function TippingPointsModeA({ flipThresholds, outcomeUnit, outcomeUnitSymbol }: TippingPointsModeAProps) {
  const [showAll, setShowAll] = useState(false)

  // C5: Sort by absolute margin, most fragile first (smallest distance to flip).
  // Without observed_state.range from the graph, normalisation against the
  // [current, flip] span is a no-op (margin === range). Use raw absolute
  // margin instead — this correctly surfaces factors closest to their flip point.
  // TODO: When PLoT provides observed_state.range per factor, normalise by that range.
  const sorted = useMemo(() => {
    return [...flipThresholds]
      .map(ft => {
        if (ft.flip_value == null) {
          return { ...ft, _normalisedMargin: Infinity }
        }
        const margin = Math.abs(ft.current_value - ft.flip_value)
        return { ...ft, _normalisedMargin: margin }
      })
      .sort((a, b) => a._normalisedMargin - b._normalisedMargin)
  }, [flipThresholds])

  const displayItems = showAll ? sorted : sorted.slice(0, 3)
  const hiddenCount = sorted.length - 3

  return (
    <div className="space-y-3 p-3 bg-panel border border-panel-border rounded-lg">
      {/* Header */}
      <div>
        <h4 className={`${typography.panelHeader} text-text-header`}>
          Where the decision could flip
        </h4>
        <p className={`${typography.panelBody} text-text-light`}>
          How far each factor can move before the recommendation changes
        </p>
      </div>

      {/* Threshold rows */}
      <div className="space-y-3">
        {displayItems.map((ft, idx) => (
          <FlipThresholdRow
            key={ft.node_id || idx}
            ft={ft}
            outcomeUnit={outcomeUnit}
            outcomeUnitSymbol={outcomeUnitSymbol}
          />
        ))}
      </div>

      {/* Show more/less toggle */}
      {hiddenCount > 0 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className={`flex items-center gap-1 ${typography.panelBody} text-info hover:text-info-hover transition-colors`}
        >
          {showAll ? (
            <>
              <ChevronDown className="w-3 h-3" />
              Show less
            </>
          ) : (
            <>
              <ChevronRight className="w-3 h-3" />
              Show all {sorted.length}
            </>
          )}
        </button>
      )}
    </div>
  )
}

// =============================================================================
// Main Component
// =============================================================================

export interface TippingPointsProps {
  /** Flip thresholds from PLoT (Mode A when present) */
  flipThresholds?: FlipThreshold[]
  /** Top drivers for fallback display (Mode B) */
  drivers?: DriverItem[]
  /** Outcome unit for formatting */
  outcomeUnit?: OutcomeUnitType
  /** Currency symbol */
  outcomeUnitSymbol?: string
}

export function TippingPoints({
  flipThresholds,
  drivers,
  outcomeUnit,
  outcomeUnitSymbol,
}: TippingPointsProps) {
  // Mode A: flip_thresholds with at least one usable flip (non-null value, non-heuristic, non-no_bracket)
  const hasUsableFlips = flipThresholds && flipThresholds.some(
    ft => ft.flip_value !== null && ft.flip_reason !== 'heuristic' && ft.flip_reason !== 'no_bracket'
  )
  if (hasUsableFlips) {
    return (
      <TippingPointsModeA
        flipThresholds={flipThresholds}
        outcomeUnit={outcomeUnit}
        outcomeUnitSymbol={outcomeUnitSymbol}
      />
    )
  }

  return null
}

export default TippingPoints

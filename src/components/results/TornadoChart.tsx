/**
 * TornadoChart Component
 *
 * Sensitivity tornado diagram showing how each factor's uncertainty
 * affects the expected outcome. Always visible in the Drivers section.
 *
 * Data source: derived in OutputsDock from driver influence scores and the
 * recommended option's p10/p90 range. This is a proportional presentation-layer
 * approximation, not authoritative per-factor outcome bounds from PLoT.
 *
 * Design: matches olumi-results-panel-v7.html prototype.
 */

import { useMemo } from 'react'
import { typography } from '../../styles/typography'
import { stripEncodingNotation } from './utils/cleanFactorLabel'
import { focusNodeById } from '../../canvas/utils/focusHelpers'

export interface TornadoRow {
  /** Factor key / node ID */
  factorKey: string
  /** Display label */
  label: string
  /** Outcome value when factor is at pessimistic end (p10) */
  lowOutcome: number
  /** Outcome value when factor is at optimistic end (p90) */
  highOutcome: number
  /** Whether this factor can be focused on canvas */
  canFocus: boolean
  /** Canvas node ID for click-to-focus */
  matchedNodeId?: string
}

export interface TornadoChartProps {
  /** Tornado rows sorted by influence descending */
  rows: TornadoRow[]
  /** Expected outcome (mean) — centre line value */
  expectedOutcome: number
  /** Unit type for formatting */
  outcomeUnit?: 'currency' | 'percent' | 'count'
  /** Symbol for currency display */
  outcomeUnitSymbol?: string
  /** Callback to focus a node on canvas */
  onFocusNode?: (nodeId: string) => void
  /** v7: When true, values are normalised model scores */
  isNormalised?: boolean
}

/** Format a value for tornado axis/labels. Shows 2dp relative score when normalised. */
function formatValue(
  value: number,
  unit?: 'currency' | 'percent' | 'count',
  symbol?: string,
  isNormalised?: boolean,
): string {
  if (isNormalised) {
    return value.toFixed(2)
  }
  if (unit === 'currency' && symbol) {
    return `${symbol}${Math.round(value).toLocaleString()}`
  }
  if (unit === 'percent') {
    const displayValue = Math.abs(value) <= 2 ? value * 100 : value
    return `${Math.round(displayValue)}%`
  }
  if (Math.abs(value) >= 10) {
    return Math.round(value).toLocaleString()
  }
  return value.toFixed(1)
}

export function TornadoChart({
  rows,
  expectedOutcome,
  outcomeUnit,
  outcomeUnitSymbol,
  onFocusNode,
  isNormalised,
}: TornadoChartProps) {
  // Compute the full range across all rows for scaling
  const { minVal, maxVal } = useMemo(() => {
    let min = expectedOutcome
    let max = expectedOutcome
    for (const row of rows) {
      min = Math.min(min, row.lowOutcome, row.highOutcome)
      max = Math.max(max, row.lowOutcome, row.highOutcome)
    }
    // Add 10% padding
    const padding = (max - min) * 0.1 || 1
    return { minVal: min - padding, maxVal: max + padding }
  }, [rows, expectedOutcome])

  const totalRange = maxVal - minVal

  // Position of the centre line (expected outcome) as percentage
  const centrePct = totalRange > 0 ? ((expectedOutcome - minVal) / totalRange) * 100 : 50

  if (rows.length === 0) return null

  return (
    <div
      className="p-3.5 bg-panel border border-panel-border rounded-xl shadow-sm"
      data-testid="tornado-chart"
    >
      <h4 className={`${typography.panelHeader} text-text-header mb-0.5`}>
        What if your estimates are wrong?
      </h4>
      <p className={`${typography.panelBody} text-text-light mb-3 leading-relaxed`}>
        Each row varies one factor while keeping others unchanged
      </p>

      {/* Tornado rows */}
      <div className="space-y-2">
        {rows.map((row) => {
          const lowPct = totalRange > 0 ? ((row.lowOutcome - minVal) / totalRange) * 100 : 0
          const highPct = totalRange > 0 ? ((row.highOutcome - minVal) / totalRange) * 100 : 0

          // Left bar: from centre leftward (worse outcome)
          const leftWidth = centrePct - Math.min(lowPct, centrePct)
          const leftLeft = Math.min(lowPct, centrePct)

          // Right bar: from centre rightward (better outcome)
          const rightWidth = Math.max(highPct, centrePct) - centrePct
          const rightLeft = centrePct

          const cleanLabel = stripEncodingNotation(row.label)

          const handleClick = () => {
            const nodeId = row.matchedNodeId ?? row.factorKey
            if (onFocusNode) {
              onFocusNode(nodeId)
            } else {
              focusNodeById(nodeId)
            }
          }

          return (
            <div key={row.factorKey} className="flex items-center gap-2">
              {/* Label */}
              <div className="w-24 flex-shrink-0 text-right">
                {row.canFocus ? (
                  <button
                    type="button"
                    onClick={handleClick}
                    className={`${typography.panelMeta} font-medium text-info hover:underline focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-1 rounded truncate max-w-full text-right`}
                    title={cleanLabel}
                  >
                    {cleanLabel}
                  </button>
                ) : (
                  <span
                    className={`${typography.panelMeta} font-medium text-text-light truncate block`}
                    title={cleanLabel}
                  >
                    {cleanLabel}
                  </span>
                )}
              </div>

              {/* Bar area */}
              <div className="flex-1 h-5 relative">
                {/* Centre line */}
                <div
                  className="absolute top-0 bottom-0 w-px"
                  style={{ left: `${centrePct}%`, backgroundColor: 'var(--border-emphasis)' }}
                />

                {/* Left (negative) bar */}
                {leftWidth > 0.5 && (
                  <div
                    className="absolute top-0 h-full rounded-l"
                    style={{
                      left: `${leftLeft}%`,
                      width: `${leftWidth}%`,
                      backgroundColor: 'var(--danger-light)',
                    }}
                  />
                )}

                {/* Right (positive) bar */}
                {rightWidth > 0.5 && (
                  <div
                    className="absolute top-0 h-full rounded-r"
                    style={{
                      left: `${rightLeft}%`,
                      width: `${rightWidth}%`,
                      backgroundColor: 'var(--success-light)',
                    }}
                  />
                )}

                {/* Low value label */}
                <span
                  className={`absolute top-1/2 -translate-y-1/2 ${typography.panelMeta} font-semibold text-danger whitespace-nowrap`}
                  style={{
                    right: `${100 - Math.min(lowPct, centrePct) + 1}%`,
                  }}
                >
                  {formatValue(row.lowOutcome, outcomeUnit, outcomeUnitSymbol, isNormalised)}
                </span>

                {/* High value label */}
                <span
                  className={`absolute top-1/2 -translate-y-1/2 ${typography.panelMeta} font-semibold text-success whitespace-nowrap`}
                  style={{
                    left: `${Math.max(highPct, centrePct) + 1}%`,
                  }}
                >
                  {formatValue(row.highOutcome, outcomeUnit, outcomeUnitSymbol, isNormalised)}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Axis labels */}
      <div className={`flex justify-between mt-1 ml-[104px] ${typography.panelMeta} text-text-light`}>
        <span>Worse</span>
        <span>Expected: {formatValue(expectedOutcome, outcomeUnit, outcomeUnitSymbol, isNormalised)}</span>
        <span>Better</span>
      </div>

      {/* Footer note — honest labelling: these are heuristic approximations */}
      <p className={`${typography.panelMeta} text-text-light mt-2 italic leading-relaxed`}>
        Approximate sensitivity — shows directional impact, not exact bounds.
      </p>
    </div>
  )
}

export default TornadoChart

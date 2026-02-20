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
 * Phase 3.3: Drag interaction — bars are draggable to preview outcome shifts.
 * Phase 3.4: Flip indicator — DISABLED. Requires factor-space bounds (factorLow/factorHigh)
 *   to map drag position to factor values for comparison against flip_value. Currently
 *   tornado data only has outcome-space values. Flip detection will be re-enabled when
 *   PLoT factor_sensitivity per-factor ranges are threaded through the data pipeline.
 * Phase 3.5: "Apply and rerun" — DISABLED. Same root cause as 3.4: writing outcome-space
 *   interpolated values into factor-space observedState.value produces incorrect results.
 *   Will be re-enabled alongside factor-space data availability.
 */

import { useMemo, useCallback, useRef, useState } from 'react'
import { typography } from '../../styles/typography'
import { formatPercent as formatPct } from '../../utils/formatPercent'
import { stripEncodingNotation } from './utils/cleanFactorLabel'
import { focusNodeById } from '../../canvas/utils/focusHelpers'

export interface TornadoRow {
  /** Factor key / node ID */
  factorKey: string
  /** Display label */
  label: string
  /** Outcome value when factor is at its low raw value */
  lowOutcome: number
  /** Outcome value when factor is at its high raw value */
  highOutcome: number
  /** Whether this factor can be focused on canvas */
  canFocus: boolean
  /** Canvas node ID for click-to-focus */
  matchedNodeId?: string
  /** Factor direction: positive = higher is better, negative = higher is worse (e.g. cost, churn) */
  direction?: 'positive' | 'negative'
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
  /** Goal direction — determines bar colour semantics (higher outcome = green for maximize, orange for minimize) */
  goalDirection?: 'maximize' | 'minimize'
}

/** Whether structured unit data is available (not just normalised model scores). */
function hasStructuredUnit(unit?: 'currency' | 'percent' | 'count', symbol?: string): boolean {
  if (unit === 'currency' && symbol) return true
  if (unit === 'percent') return true
  return false
}

/** Format a value for tornado axis/labels. Shows % shift when normalised (0.13 → "+13%"). */
function formatValue(
  value: number,
  unit?: 'currency' | 'percent' | 'count',
  symbol?: string,
  isNormalised?: boolean,
): string {
  if (isNormalised) {
    return formatPct(value, { fromDecimal: true, sign: true })
  }
  if (unit === 'currency' && symbol) {
    return `${symbol}${Math.round(value).toLocaleString()}`
  }
  if (unit === 'percent') {
    const displayValue = Math.abs(value) <= 2 ? value * 100 : value
    return formatPct(displayValue)
  }
  if (Math.abs(value) >= 10) {
    return Math.round(value).toLocaleString()
  }
  return value.toFixed(1)
}

/**
 * Format a bar-end value as relative change from expected.
 * Uses "pp" (percentage points) suffix to distinguish from outcome's own % unit.
 * Used when no structured unit is available.
 */
function formatRelativeChange(value: number, expected: number): string {
  if (expected === 0) return value >= 0 ? '+∞' : '−∞'
  const pct = ((value - expected) / Math.abs(expected)) * 100
  const rounded = Math.round(pct)
  if (rounded === 0) return '0 pp'
  return rounded > 0 ? `+${rounded} pp` : `${rounded} pp`.replace('-', '−')
}

/** Format the centre axis label. Includes "Expected" + value + unit context. */
function formatExpectedLabel(
  value: number,
  unit?: 'currency' | 'percent' | 'count',
  symbol?: string,
  isNormalised?: boolean,
): string {
  return `Expected: ${formatValue(value, unit, symbol, isNormalised)}`
}

// ─── Drag state management ──────────────────────────────────────────────────

interface DragState {
  isDragging: boolean
  activeFactorId: string | null
  /** Which bar the user is dragging ('left' or 'right') */
  activeSide: 'left' | 'right' | null
  /** Current interpolated outcome for the actively dragged factor */
  interpolatedOutcome: number
  /** True once any bar has been dragged (persists until reset) */
  hasUserDragged: boolean
  /** factorId → interpolated outcome at released position */
  modifiedFactors: Map<string, number>
  /** factorId → which side was dragged */
  modifiedSides: Map<string, 'left' | 'right'>
}

interface DragContext {
  factorId: string
  barContainerRect: DOMRect
  row: TornadoRow
  pointerId: number
}

export function TornadoChart({
  rows,
  expectedOutcome,
  outcomeUnit,
  outcomeUnitSymbol,
  onFocusNode,
  isNormalised,
  goalDirection,
}: TornadoChartProps) {
  // P0.2: Use relative % change when no structured unit is available
  const useRelativePct = !isNormalised && !hasStructuredUnit(outcomeUnit, outcomeUnitSymbol)

  // ── Drag state ──
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    activeFactorId: null,
    activeSide: null,
    interpolatedOutcome: expectedOutcome,
    hasUserDragged: false,
    modifiedFactors: new Map(),
    modifiedSides: new Map(),
  })
  const dragContextRef = useRef<DragContext | null>(null)

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

  // ── Drag handlers ──

  const handlePointerDown = useCallback((
    factorId: string,
    side: 'left' | 'right',
    e: React.PointerEvent,
  ) => {
    const row = rows.find(r => r.factorKey === factorId)
    if (!row) return

    const target = e.currentTarget as HTMLElement
    target.setPointerCapture(e.pointerId)

    // Get the bar container rect
    const barContainer = target.closest('[data-bar-container]') as HTMLElement | null
    if (!barContainer) return

    dragContextRef.current = {
      factorId,
      barContainerRect: barContainer.getBoundingClientRect(),
      row,
      pointerId: e.pointerId,
    }

    setDragState(prev => ({
      ...prev,
      isDragging: true,
      activeFactorId: factorId,
      activeSide: side,
    }))
  }, [rows])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const ctx = dragContextRef.current
    if (!ctx) return

    const { barContainerRect, row } = ctx
    const rawPosition = (e.clientX - barContainerRect.left) / barContainerRect.width
    const clampedPosition = Math.max(0, Math.min(1, rawPosition))

    // Linear interpolation: position 0 = chart left (minVal), position 1 = chart right (maxVal)
    // Map to the row's outcome range proportionally
    const interpolated = row.lowOutcome + clampedPosition * (row.highOutcome - row.lowOutcome)

    setDragState(prev => ({
      ...prev,
      interpolatedOutcome: interpolated,
    }))
  }, [])

  const handlePointerUp = useCallback(() => {
    const ctx = dragContextRef.current
    if (!ctx) return

    // Persist the final interpolated value and which side was dragged
    setDragState(prev => {
      const nextFactors = new Map(prev.modifiedFactors)
      nextFactors.set(ctx.factorId, prev.interpolatedOutcome)
      const nextSides = new Map(prev.modifiedSides)
      if (prev.activeSide) nextSides.set(ctx.factorId, prev.activeSide)
      return {
        ...prev,
        isDragging: false,
        activeFactorId: null,
        activeSide: null,
        hasUserDragged: true,
        modifiedFactors: nextFactors,
        modifiedSides: nextSides,
      }
    })

    dragContextRef.current = null
  }, [])

  const resetDrag = useCallback(() => {
    setDragState({
      isDragging: false,
      activeFactorId: null,
      activeSide: null,
      interpolatedOutcome: expectedOutcome,
      hasUserDragged: false,
      modifiedFactors: new Map(),
      modifiedSides: new Map(),
    })
    dragContextRef.current = null
  }, [expectedOutcome])

  // The outcome display: when dragging, show interpolated; when a factor was
  // previously dragged, show the most recently modified factor's value; else expected
  const displayOutcome = dragState.isDragging
    ? dragState.interpolatedOutcome
    : dragState.hasUserDragged
      ? Array.from(dragState.modifiedFactors.values()).at(-1) ?? expectedOutcome
      : expectedOutcome

  if (import.meta.env.DEV && !goalDirection && rows.length > 0) {
    console.warn('Tornado: goal direction unknown, using neutral colours')
  }

  if (rows.length === 0) return null

  return (
    <div
      className="p-3.5 bg-panel border border-panel-border rounded-xl shadow-sm"
      data-testid="tornado-chart"
    >
      {/* Tornado rows */}
      <div className="space-y-2">
        {rows.map((row) => {
          // Is this row actively being dragged or previously modified?
          const isActiveRow = dragState.isDragging && dragState.activeFactorId === row.factorKey
          const storedOutcome = dragState.modifiedFactors.get(row.factorKey)
          const isReactiveRow = isActiveRow || storedOutcome != null

          // Which side is being (or was) dragged for this row?
          const dragSide = isActiveRow
            ? dragState.activeSide
            : dragState.modifiedSides.get(row.factorKey) ?? null

          // Effective outcome for reactive bar widths:
          // - Active side: width interpolated from drag position
          // - Opposite side: stays at ORIGINAL static width (dimmed)
          // - Undragged: original lowOutcome/highOutcome range
          let effectiveLow = row.lowOutcome
          let effectiveHigh = row.highOutcome

          if (isReactiveRow && dragSide != null) {
            const interp = isActiveRow ? dragState.interpolatedOutcome : storedOutcome!
            if (dragSide === 'left') {
              // Left bar was dragged — adjust low end only, right stays original
              effectiveLow = Math.min(interp, expectedOutcome)
            } else {
              // Right bar was dragged — adjust high end only, left stays original
              effectiveHigh = Math.max(interp, expectedOutcome)
            }
          }

          const lowPct = totalRange > 0 ? ((effectiveLow - minVal) / totalRange) * 100 : 0
          const highPct = totalRange > 0 ? ((effectiveHigh - minVal) / totalRange) * 100 : 0

          // Left bar: from low end leftward to centre line
          const leftWidth = centrePct - Math.min(lowPct, centrePct)
          const leftLeft = Math.min(lowPct, centrePct)

          // Right bar: from centre line rightward to high end
          const rightWidth = Math.max(highPct, centrePct) - centrePct
          const rightLeft = centrePct

          // Colour mapping by goal direction (outcome-vs-goal, not factor polarity):
          // - maximize: right (higher outcome) = favourable (green), left (lower) = adverse (orange)
          // - minimize: left (lower outcome) = favourable (green), right (higher) = adverse (orange)
          // - unknown: neutral sky-200 for both bars
          const leftBarColour = !goalDirection ? 'var(--info-light)'
            : goalDirection === 'minimize' ? 'var(--success-light)' : 'var(--danger-light)'
          const rightBarColour = !goalDirection ? 'var(--info-light)'
            : goalDirection === 'minimize' ? 'var(--danger-light)' : 'var(--success-light)'
          const leftLabelColour = !goalDirection ? 'text-info'
            : goalDirection === 'minimize' ? 'text-success' : 'text-danger'
          const rightLabelColour = !goalDirection ? 'text-info'
            : goalDirection === 'minimize' ? 'text-danger' : 'text-success'

          const cleanLabel = stripEncodingNotation(row.label)

          // Reactive rows always render both bars to preserve pointer capture during drag
          const shouldRenderLeftBar = isReactiveRow || leftWidth > 0.5
          const shouldRenderRightBar = isReactiveRow || rightWidth > 0.5

          // CSS transitions: instant during active drag, smooth snap for released/reset bars
          const barTransition = isActiveRow ? 'none' : 'width 150ms ease-out, left 150ms ease-out'

          // Ring highlight on active bar, dim the opposite bar to preserve range context
          const leftBarExtra = isReactiveRow
            ? dragSide === 'left' ? 'ring-1 ring-text-light/30' : 'opacity-30'
            : ''
          const rightBarExtra = isReactiveRow
            ? dragSide === 'right' ? 'ring-1 ring-text-light/30' : 'opacity-30'
            : ''

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
                    className={`${typography.panelMeta} text-info hover:underline focus:outline-none focus:ring-2 focus:ring-info focus:ring-offset-1 rounded truncate max-w-full text-right`}
                    title={cleanLabel}
                  >
                    {cleanLabel}
                  </button>
                ) : (
                  <span
                    className={`${typography.panelMeta} text-text-light truncate block`}
                    title={cleanLabel}
                  >
                    {cleanLabel}
                  </span>
                )}
              </div>

              {/* Bar area — draggable */}
              <div
                className={`flex-1 h-5 relative ${isActiveRow ? 'opacity-90' : ''}`}
                data-bar-container
                style={{ touchAction: 'none' }}
              >
                {/* Centre line */}
                <div
                  className="absolute top-0 bottom-0 w-px"
                  style={{ left: `${centrePct}%`, backgroundColor: 'var(--border-emphasis)' }}
                />

                {/* Left bar — weaker than estimated */}
                {shouldRenderLeftBar && (
                  <div
                    className={`absolute top-0 h-full rounded-l ${leftBarExtra}`}
                    style={{
                      left: `${leftLeft}%`,
                      width: `${Math.max(0, leftWidth)}%`,
                      backgroundColor: leftBarColour,
                      cursor: dragState.isDragging ? 'grabbing' : 'grab',
                      transition: barTransition,
                    }}
                    onPointerDown={(e) => handlePointerDown(row.factorKey, 'left', e)}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    data-testid={`tornado-bar-left-${row.factorKey}`}
                  >
                    {/* Drag handle affordance — left edge */}
                    <div
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-2 flex flex-col justify-between pointer-events-none"
                      aria-hidden="true"
                    >
                      <div className="h-px w-full bg-text-light/40" />
                      <div className="h-px w-full bg-text-light/40" />
                      <div className="h-px w-full bg-text-light/40" />
                    </div>
                  </div>
                )}

                {/* Right bar — stronger than estimated */}
                {shouldRenderRightBar && (
                  <div
                    className={`absolute top-0 h-full rounded-r ${rightBarExtra}`}
                    style={{
                      left: `${rightLeft}%`,
                      width: `${Math.max(0, rightWidth)}%`,
                      backgroundColor: rightBarColour,
                      cursor: dragState.isDragging ? 'grabbing' : 'grab',
                      transition: barTransition,
                    }}
                    onPointerDown={(e) => handlePointerDown(row.factorKey, 'right', e)}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    data-testid={`tornado-bar-right-${row.factorKey}`}
                  >
                    {/* Drag handle affordance — right edge */}
                    <div
                      className="absolute right-0 top-1/2 -translate-y-1/2 w-[3px] h-2 flex flex-col justify-between pointer-events-none"
                      aria-hidden="true"
                    >
                      <div className="h-px w-full bg-text-light/40" />
                      <div className="h-px w-full bg-text-light/40" />
                      <div className="h-px w-full bg-text-light/40" />
                    </div>
                  </div>
                )}

                {/* Low value label — hidden when left bar is collapsed */}
                {leftWidth > 0.5 && (
                  <span
                    className={`absolute top-1/2 -translate-y-1/2 ${typography.panelMeta} ${leftLabelColour} whitespace-nowrap ${dragState.isDragging ? 'pointer-events-none' : ''} ${leftBarExtra.includes('opacity') ? 'opacity-30' : ''}`}
                    style={{
                      right: `${100 - Math.min(lowPct, centrePct) + 1}%`,
                      transition: isActiveRow ? 'none' : 'right 150ms ease-out',
                    }}
                  >
                    {useRelativePct
                      ? formatRelativeChange(effectiveLow, expectedOutcome)
                      : formatValue(effectiveLow, outcomeUnit, outcomeUnitSymbol, isNormalised)}
                  </span>
                )}

                {/* High value label — hidden when right bar is collapsed */}
                {rightWidth > 0.5 && (
                  <span
                    className={`absolute top-1/2 -translate-y-1/2 ${typography.panelMeta} ${rightLabelColour} whitespace-nowrap ${dragState.isDragging ? 'pointer-events-none' : ''} ${rightBarExtra.includes('opacity') ? 'opacity-30' : ''}`}
                    style={{
                      left: `${Math.max(highPct, centrePct) + 1}%`,
                      transition: isActiveRow ? 'none' : 'left 150ms ease-out',
                    }}
                  >
                    {useRelativePct
                      ? formatRelativeChange(effectiveHigh, expectedOutcome)
                      : formatValue(effectiveHigh, outcomeUnit, outcomeUnitSymbol, isNormalised)}
                  </span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Axis labels — outcome updates during drag. V11: unit-aware when count unit available. */}
      <div className="flex items-baseline gap-2 mt-1.5 ml-[104px] text-[10px] leading-tight text-text-light">
        <span className="flex-shrink-0 whitespace-nowrap" data-testid="tornado-axis-left">
          {outcomeUnitSymbol && outcomeUnit === 'count'
            ? `← Fewer ${outcomeUnitSymbol}`
            : '← Weaker'}
        </span>
        <span className="flex-1 text-center truncate" data-testid="tornado-expected-display">
          {formatExpectedLabel(displayOutcome, outcomeUnit, outcomeUnitSymbol, isNormalised)}
        </span>
        <span className="flex-shrink-0 whitespace-nowrap" data-testid="tornado-axis-right">
          {outcomeUnitSymbol && outcomeUnit === 'count'
            ? `More ${outcomeUnitSymbol} →`
            : 'Stronger →'}
        </span>
      </div>

      {/* Preview disclaimer + reset link */}
      <div className="flex items-baseline justify-between mt-2">
        <p className={`${typography.panelMeta} text-text-light italic leading-relaxed`}>
          Drag to explore. Approximate, showing directional impact.
        </p>
        {dragState.hasUserDragged && (
          <button
            type="button"
            onClick={resetDrag}
            className={`${typography.panelMeta} text-info hover:underline cursor-pointer flex-shrink-0 ml-2`}
            data-testid="tornado-reset-preview"
          >
            Reset preview
          </button>
        )}
      </div>
    </div>
  )
}

export default TornadoChart

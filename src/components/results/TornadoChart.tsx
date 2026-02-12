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
 * Phase 3.4: Flip indicator — warning when drag crosses a flip threshold.
 * Phase 3.5: "Apply and rerun" — persists dragged values and triggers rerun.
 */

import { useMemo, useCallback, useRef, useEffect, useState } from 'react'
import { typography } from '../../styles/typography'
import { formatPercent as formatPct } from '../../utils/formatPercent'
import { stripEncodingNotation } from './utils/cleanFactorLabel'
import { focusNodeById } from '../../canvas/utils/focusHelpers'
import type { FlipThreshold } from './types'

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
  /** Flip thresholds for flip indicator (Phase 3.4) */
  flipThresholds?: FlipThreshold[]
  /** Callback to apply dragged values and rerun (Phase 3.5) */
  onApplyAndRerun?: (modifiedFactors: Map<string, number>) => void
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

// ─── Drag state management ──────────────────────────────────────────────────

interface DragState {
  isDragging: boolean
  activeFactorId: string | null
  /** Current interpolated outcome for the actively dragged factor */
  interpolatedOutcome: number
  /** True once any bar has been dragged (persists until reset) */
  hasUserDragged: boolean
  /** factorId → interpolated outcome at released position */
  modifiedFactors: Map<string, number>
}

interface DragContext {
  factorId: string
  barContainerRect: DOMRect
  row: TornadoRow
  pointerId: number
}

// ─── Flip detection ─────────────────────────────────────────────────────────

interface ActiveFlip {
  factorLabel: string
  flipValue: number
  alternativeWinnerLabel: string
}

export function TornadoChart({
  rows,
  expectedOutcome,
  outcomeUnit,
  outcomeUnitSymbol,
  onFocusNode,
  isNormalised,
  flipThresholds,
  onApplyAndRerun,
}: TornadoChartProps) {
  // ── Drag state ──
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    activeFactorId: null,
    interpolatedOutcome: expectedOutcome,
    hasUserDragged: false,
    modifiedFactors: new Map(),
  })
  const dragContextRef = useRef<DragContext | null>(null)

  // ── Flip state ──
  const [activeFlip, setActiveFlip] = useState<ActiveFlip | null>(null)

  // ── Reduced motion ──
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (!mq) return
    setPrefersReducedMotion(mq.matches)
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

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

    // Check flip thresholds for this factor
    if (flipThresholds) {
      const flip = flipThresholds.find(ft =>
        ft.node_id === ctx.factorId && ft.flip_value != null
      )
      if (flip && flip.flip_value != null) {
        // Has the interpolated outcome crossed the flip threshold?
        // We check if the interpolated value has moved past the flip_value
        // relative to the current_value (baseline)
        const crossedFlip = (
          (row.lowOutcome <= flip.flip_value && interpolated >= flip.flip_value) ||
          (row.highOutcome >= flip.flip_value && interpolated <= flip.flip_value) ||
          (interpolated >= flip.flip_value && expectedOutcome < flip.flip_value) ||
          (interpolated <= flip.flip_value && expectedOutcome > flip.flip_value)
        )
        if (crossedFlip && flip.alternative_winner_label) {
          setActiveFlip({
            factorLabel: flip.label,
            flipValue: flip.flip_value,
            alternativeWinnerLabel: flip.alternative_winner_label,
          })
        } else {
          setActiveFlip(null)
        }
      }
    }
  }, [flipThresholds, expectedOutcome])

  const handlePointerUp = useCallback(() => {
    const ctx = dragContextRef.current
    if (!ctx) return

    // Persist the final interpolated value
    setDragState(prev => {
      const next = new Map(prev.modifiedFactors)
      next.set(ctx.factorId, prev.interpolatedOutcome)
      return {
        ...prev,
        isDragging: false,
        activeFactorId: null,
        hasUserDragged: true,
        modifiedFactors: next,
      }
    })

    dragContextRef.current = null
  }, [])

  const handleApplyClick = useCallback(() => {
    if (onApplyAndRerun && dragState.modifiedFactors.size > 0) {
      onApplyAndRerun(dragState.modifiedFactors)
      // Reset drag state after apply
      setDragState({
        isDragging: false,
        activeFactorId: null,
        interpolatedOutcome: expectedOutcome,
        hasUserDragged: false,
        modifiedFactors: new Map(),
      })
      setActiveFlip(null)
    }
  }, [onApplyAndRerun, dragState.modifiedFactors, expectedOutcome])

  // The outcome display: when dragging, show interpolated; when a factor was
  // previously dragged, show the most recently modified factor's value; else expected
  const displayOutcome = dragState.isDragging
    ? dragState.interpolatedOutcome
    : expectedOutcome

  if (rows.length === 0) return null

  return (
    <div
      className="p-3.5 bg-panel border border-panel-border rounded-xl shadow-sm"
      data-testid="tornado-chart"
    >
      <p className={`${typography.panelBody} text-text-light mb-3 leading-relaxed`}>
        Drag the bars to see how the outcome shifts when each factor is stronger or weaker than your estimate.
      </p>

      {/* Tornado rows */}
      <div className="space-y-2">
        {rows.map((row) => {
          const lowPct = totalRange > 0 ? ((row.lowOutcome - minVal) / totalRange) * 100 : 0
          const highPct = totalRange > 0 ? ((row.highOutcome - minVal) / totalRange) * 100 : 0

          // Left bar: from centre leftward
          const leftWidth = centrePct - Math.min(lowPct, centrePct)
          const leftLeft = Math.min(lowPct, centrePct)

          // Right bar: from centre rightward
          const rightWidth = Math.max(highPct, centrePct) - centrePct
          const rightLeft = centrePct

          // Colour mapping: for positive-direction factors, left (weaker) = worse = orange,
          // right (stronger) = better = green. For negative-direction factors (cost, churn),
          // weaker = better = green, stronger = worse = orange. Bar positions stay the same.
          const isNegativeDirection = row.direction === 'negative'
          const leftBarColour = isNegativeDirection ? 'var(--success-light)' : 'var(--danger-light)'
          const rightBarColour = isNegativeDirection ? 'var(--danger-light)' : 'var(--success-light)'
          const leftLabelColour = isNegativeDirection ? 'text-success' : 'text-danger'
          const rightLabelColour = isNegativeDirection ? 'text-danger' : 'text-success'

          const cleanLabel = stripEncodingNotation(row.label)
          const isActiveRow = dragState.activeFactorId === row.factorKey
          const wasModified = dragState.modifiedFactors.has(row.factorKey)

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
                {leftWidth > 0.5 && (
                  <div
                    className={`absolute top-0 h-full rounded-l ${isActiveRow || wasModified ? 'ring-1 ring-text-light/30' : ''}`}
                    style={{
                      left: `${leftLeft}%`,
                      width: `${leftWidth}%`,
                      backgroundColor: leftBarColour,
                      cursor: dragState.isDragging ? 'grabbing' : 'grab',
                    }}
                    onPointerDown={(e) => handlePointerDown(row.factorKey, e)}
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
                {rightWidth > 0.5 && (
                  <div
                    className={`absolute top-0 h-full rounded-r ${isActiveRow || wasModified ? 'ring-1 ring-text-light/30' : ''}`}
                    style={{
                      left: `${rightLeft}%`,
                      width: `${rightWidth}%`,
                      backgroundColor: rightBarColour,
                      cursor: dragState.isDragging ? 'grabbing' : 'grab',
                    }}
                    onPointerDown={(e) => handlePointerDown(row.factorKey, e)}
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

                {/* Low value label */}
                <span
                  className={`absolute top-1/2 -translate-y-1/2 ${typography.panelMeta} ${leftLabelColour} whitespace-nowrap ${dragState.isDragging ? 'pointer-events-none' : ''}`}
                  style={{
                    right: `${100 - Math.min(lowPct, centrePct) + 1}%`,
                  }}
                >
                  {formatValue(row.lowOutcome, outcomeUnit, outcomeUnitSymbol, isNormalised)}
                </span>

                {/* High value label */}
                <span
                  className={`absolute top-1/2 -translate-y-1/2 ${typography.panelMeta} ${rightLabelColour} whitespace-nowrap ${dragState.isDragging ? 'pointer-events-none' : ''}`}
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

      {/* Axis labels — outcome updates during drag */}
      <div className={`flex justify-between mt-1 ml-[104px] ${typography.panelMeta} text-text-light`}>
        <span>← Weaker than estimated</span>
        <span data-testid="tornado-expected-display">
          Expected: {formatValue(displayOutcome, outcomeUnit, outcomeUnitSymbol, isNormalised)}
        </span>
        <span>Stronger than estimated →</span>
      </div>

      {/* Flip indicator (Phase 3.4) */}
      {activeFlip && (
        <div
          className={`mt-2 p-2 border border-danger/30 rounded-lg ${!prefersReducedMotion ? 'animate-pulse' : ''}`}
          data-testid="tornado-flip-indicator"
        >
          <p className={`${typography.panelBody} text-danger`}>
            At {formatValue(activeFlip.flipValue, outcomeUnit, outcomeUnitSymbol, isNormalised)}, the recommendation flips to {activeFlip.alternativeWinnerLabel}
          </p>
        </div>
      )}

      {/* Apply and rerun button (Phase 3.5) */}
      {dragState.hasUserDragged && onApplyAndRerun && (
        <button
          type="button"
          onClick={handleApplyClick}
          className={`mt-2 px-4 py-1.5 bg-info text-white rounded-full ${typography.panelBody} hover:bg-info-hover transition-colors`}
          data-testid="tornado-apply-rerun"
        >
          Apply these estimates and rerun
        </button>
      )}

      {/* Preview disclaimer */}
      <p className={`${typography.panelMeta} text-text-light mt-2 italic leading-relaxed`}>
        Preview only — drag to explore. Approximate sensitivity, not exact bounds.
      </p>
    </div>
  )
}

export default TornadoChart

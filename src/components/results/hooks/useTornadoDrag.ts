/**
 * useTornadoDrag — Manages drag state for tornado chart bar interaction.
 *
 * Tracks which factor is being dragged, interpolates outcome values based on
 * pointer position, and accumulates modified factor values for "Apply and rerun".
 *
 * Uses unified pointer events (mouse + touch). Respects prefers-reduced-motion.
 */

import { useState, useCallback, useRef } from 'react'
import type { TornadoRow } from '../TornadoChart'

export interface TornadoDragState {
  /** Whether a drag is currently in progress */
  isDragging: boolean
  /** Factor ID of the bar currently being dragged */
  activeFactorId: string | null
  /** 0-1 normalised position within the bar range */
  dragPosition: number
  /** Interpolated outcome value at current drag position */
  interpolatedOutcome: number
  /** True once any bar has been dragged (persists until reset) */
  hasUserDragged: boolean
  /** factorId → new interpolated outcome value for each dragged factor */
  modifiedFactors: Map<string, number>
}

export interface UseTornadoDragReturn extends TornadoDragState {
  handlePointerDown: (factorId: string, side: 'low' | 'high', e: React.PointerEvent) => void
  handlePointerMove: (e: React.PointerEvent) => void
  handlePointerUp: () => void
  resetDrag: () => void
}

interface DragContext {
  factorId: string
  side: 'low' | 'high'
  /** The bar element's bounding rect at drag start */
  barRect: DOMRect
  /** Row data for interpolation */
  row: TornadoRow
}

export function useTornadoDrag(
  rows: TornadoRow[],
  expectedOutcome: number,
): UseTornadoDragReturn {
  const [isDragging, setIsDragging] = useState(false)
  const [activeFactorId, setActiveFactorId] = useState<string | null>(null)
  const [dragPosition, setDragPosition] = useState(0)
  const [interpolatedOutcome, setInterpolatedOutcome] = useState(expectedOutcome)
  const [hasUserDragged, setHasUserDragged] = useState(false)
  const [modifiedFactors, setModifiedFactors] = useState<Map<string, number>>(new Map())

  const dragContextRef = useRef<DragContext | null>(null)

  const handlePointerDown = useCallback((
    factorId: string,
    side: 'low' | 'high',
    e: React.PointerEvent,
  ) => {
    const row = rows.find(r => r.factorKey === factorId)
    if (!row) return

    // Capture the pointer for reliable tracking outside the element
    const target = e.currentTarget as HTMLElement
    target.setPointerCapture(e.pointerId)

    // Get the bar container rect (parent of the dragged bar)
    const barContainer = target.closest('[data-bar-container]') as HTMLElement | null
    if (!barContainer) return

    const barRect = barContainer.getBoundingClientRect()

    dragContextRef.current = { factorId, side, barRect, row }
    setIsDragging(true)
    setActiveFactorId(factorId)
  }, [rows])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    const ctx = dragContextRef.current
    if (!ctx) return

    const { barRect, row } = ctx

    // Compute normalised position (0 = left edge, 1 = right edge) within the bar container
    const rawPosition = (e.clientX - barRect.left) / barRect.width
    const clampedPosition = Math.max(0, Math.min(1, rawPosition))

    setDragPosition(clampedPosition)

    // Linear interpolation between lowOutcome and highOutcome based on position
    // The bar container spans from minVal to maxVal of the chart. The row's
    // lowOutcome and highOutcome sit within that range. We interpolate linearly:
    // position 0 (left edge) = lowOutcome, position 1 (right edge) = highOutcome
    const interpolated = row.lowOutcome + clampedPosition * (row.highOutcome - row.lowOutcome)
    setInterpolatedOutcome(interpolated)
  }, [])

  const handlePointerUp = useCallback(() => {
    const ctx = dragContextRef.current
    if (!ctx) return

    // Persist the final interpolated value for this factor
    const { row } = ctx
    const finalPosition = Math.max(0, Math.min(1,
      dragContextRef.current ? dragPosition : 0
    ))
    const finalValue = row.lowOutcome + finalPosition * (row.highOutcome - row.lowOutcome)

    setModifiedFactors(prev => {
      const next = new Map(prev)
      next.set(ctx.factorId, finalValue)
      return next
    })

    setHasUserDragged(true)
    setIsDragging(false)
    setActiveFactorId(null)
    dragContextRef.current = null
  }, [dragPosition])

  const resetDrag = useCallback(() => {
    setIsDragging(false)
    setActiveFactorId(null)
    setDragPosition(0)
    setInterpolatedOutcome(expectedOutcome)
    setHasUserDragged(false)
    setModifiedFactors(new Map())
    dragContextRef.current = null
  }, [expectedOutcome])

  return {
    isDragging,
    activeFactorId,
    dragPosition,
    interpolatedOutcome,
    hasUserDragged,
    modifiedFactors,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    resetDrag,
  }
}

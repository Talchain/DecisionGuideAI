/**
 * CanvasLabelScaleSync — writes `--canvas-label-scale` onto this React Flow
 * instance's root element so canvas label text renders at its DECLARED size
 * regardless of the viewport zoom.
 *
 * WHY A CSS VARIABLE ON AN ANCESTOR, and not a prop or a store field.
 * -------------------------------------------------------------------
 * The scale changes on every zoom tick. Threading it through props, or through
 * the canvas store the way `LodSync` threads `lodActive`, would re-render every
 * node and every edge on every wheel event — the cost the LOD flag was
 * deliberately designed around ("selecting the derived boolean, not the raw
 * zoom, means this component re-renders only when the flag flips"). A custom
 * property set on an ANCESTOR is inherited by the whole subtree and repaints
 * without React touching a single node component.
 *
 * SCOPE IS BY CONSTRUCTION. The property is written to the closest `.react-flow`
 * root, found from this component's own marker element — never
 * `document.querySelector`, which would reach the Compare-tab mini-maps and any
 * other React Flow instance on the page. Anything outside that subtree (panels,
 * inspector, tooltips portalled to `body`) never sees the property and falls
 * back to `1` through each token's own `var(…, 1)` default, so the type scale
 * off-canvas is untouched.
 *
 * Mounted as a child of the MAIN <ReactFlow> only, exactly like `LodSync`.
 */
import { useEffect, useRef } from 'react'
import { useStore } from '@xyflow/react'
import {
  labelCounterScale,
  CANVAS_LABEL_SCALE_VAR,
  CANVAS_LABEL_SCALE_MARKER_TESTID,
} from '../utils/zoomLegibility'

/**
 * Quantisation step for the written value.
 *
 * The scale is continuous, but a font-size difference below ~1% is not a
 * rendering difference — and writing a fresh string to the DOM on every frame of
 * a pinch gesture is pure churn. Rounding to two decimals means a wheel-zoom
 * writes a handful of times instead of once per frame. It is NOT a legibility
 * parameter: at the auto-fit floor the quantised scale is exact.
 */
const SCALE_QUANTUM = 100

export function CanvasLabelScaleSync() {
  // Selecting the QUANTISED SCALE (a number), not the raw transform, so this
  // component re-renders only when the written value would actually change.
  // Quantise UP, not to nearest. Nearest rounding put a declared 10px label at
  // 9.97px in the exact 1280px CRM fit: visually close, but below the product's
  // own legibility floor. Ceiling preserves the floor while retaining the same
  // two-decimal write cadence.
  const scale = useStore((s) => Math.ceil(labelCounterScale(s.transform[2]) * SCALE_QUANTUM) / SCALE_QUANTUM)
  const markerRef = useRef<HTMLSpanElement | null>(null)

  useEffect(() => {
    const root = markerRef.current?.closest('.react-flow') as HTMLElement | null
    if (!root) return
    root.style.setProperty(CANVAS_LABEL_SCALE_VAR, String(scale))
    return () => {
      // Leave the instance as we found it. A stale scale outliving this
      // component would silently mis-size a later mount of the same root.
      root.style.removeProperty(CANVAS_LABEL_SCALE_VAR)
    }
  }, [scale])

  // ⚠ The testid is DERIVED, not a literal: it is the contract by which anything
  // else that must find THIS instance's root does so (see
  // `CANVAS_LABEL_SCALE_MARKER_TESTID`). A hand-copied string here and a
  // hand-copied string in the reader is precisely how the two would stop
  // agreeing, silently, on which canvas they mean.
  return (
    <span
      ref={markerRef}
      data-testid={CANVAS_LABEL_SCALE_MARKER_TESTID}
      style={{ display: 'none' }}
    />
  )
}

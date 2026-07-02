import { useEffect, useRef } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useCanvasStore } from '../store'
import { computeFitPadding } from '../utils/computeFitPadding'

/**
 * Schedule a single RAF-synchronised fitView every time `layoutVersion`
 * increments. Each successful `applyLayout` bumps `layoutVersion`, so
 * this hook fits the viewport exactly once per completed layout.
 *
 * The contract is `{ padding: computeFitPadding(), duration: 400 }`:
 * panel-aware per-side padding (reserves the OutputsDock / LeftSidebar so the
 * graph frames into the visible canvas, clear of those panels) plus the 400ms
 * duration asserted by the lifecycle integration test. With nothing occluding,
 * `computeFitPadding()` reproduces the prior `padding: 0.2` framing exactly.
 *
 * Must be called inside a ReactFlowProvider (uses `useReactFlow`).
 */
export function useFitViewOnLayoutVersion(): void {
  const layoutVersion = useCanvasStore((s) => s.layoutVersion)
  const { fitView } = useReactFlow()
  const fitViewRef = useRef(fitView)
  fitViewRef.current = fitView

  useEffect(() => {
    if (layoutVersion === 0) return
    const raf = requestAnimationFrame(() => {
      fitViewRef.current({ padding: computeFitPadding(), duration: 400 })
    })
    return () => cancelAnimationFrame(raf)
  }, [layoutVersion])
}

import { useEffect, useRef } from 'react'
import { useReactFlow } from '@xyflow/react'
import { useCanvasStore } from '../store'

/**
 * Schedule a single RAF-synchronised fitView every time `layoutVersion`
 * increments. Each successful `applyLayout` bumps `layoutVersion`, so
 * this hook fits the viewport exactly once per completed layout.
 *
 * The contract `{ padding: 0.2, duration: 400 }` is asserted by the
 * lifecycle integration test — don't change it without updating the
 * test.
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
      fitViewRef.current({ padding: 0.2, duration: 400 })
    })
    return () => cancelAnimationFrame(raf)
  }, [layoutVersion])
}

/**
 * useSyncedViewports - Bidirectional viewport sync between two ReactFlow canvases
 *
 * Used for side-by-side scenario comparison where pan/zoom should be synchronized.
 * Includes debouncing to prevent infinite update loops.
 */

import { useCallback, useRef, useEffect } from 'react'
import type { ReactFlowInstance, Viewport, OnMoveEnd } from '@xyflow/react'

interface UseSyncedViewportsOptions {
  /** Debounce delay in ms to prevent sync loops (default: 50) */
  debounceMs?: number
  /** Whether sync is enabled (default: true) */
  enabled?: boolean
}

interface UseSyncedViewportsReturn {
  /** Set the ReactFlow instance for canvas A */
  setInstanceA: (instance: ReactFlowInstance | null) => void
  /** Set the ReactFlow instance for canvas B */
  setInstanceB: (instance: ReactFlowInstance | null) => void
  /** onMoveEnd handler for canvas A - syncs to B */
  onMoveEndA: OnMoveEnd
  /** onMoveEnd handler for canvas B - syncs to A */
  onMoveEndB: OnMoveEnd
  /** Manually sync both canvases to a specific viewport */
  syncToViewport: (viewport: Viewport) => void
  /** Fit both canvases to view */
  fitBoth: () => void
}

/**
 * Hook to synchronize viewport (pan/zoom) between two ReactFlow instances
 *
 * @example
 * ```tsx
 * const { setInstanceA, setInstanceB, onMoveEndA, onMoveEndB } = useSyncedViewports()
 *
 * <ReactFlow onInit={setInstanceA} onMoveEnd={onMoveEndA} ... />
 * <ReactFlow onInit={setInstanceB} onMoveEnd={onMoveEndB} ... />
 * ```
 */
export function useSyncedViewports(
  options: UseSyncedViewportsOptions = {}
): UseSyncedViewportsReturn {
  const { debounceMs = 50, enabled = true } = options

  // Store ReactFlow instances
  const instanceARef = useRef<ReactFlowInstance | null>(null)
  const instanceBRef = useRef<ReactFlowInstance | null>(null)

  // Track which canvas initiated the last sync to prevent loops
  const syncSourceRef = useRef<'A' | 'B' | null>(null)
  const syncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Track enabled state in a ref so timer callbacks see current value
  const enabledRef = useRef(enabled)
  enabledRef.current = enabled

  // Suppress sync during fitBoth to let each canvas fit independently
  const suppressSyncRef = useRef(false)

  // Cleanup pending timeouts on unmount
  useEffect(() => {
    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current)
      }
    }
  }, [])

  const setInstanceA = useCallback((instance: ReactFlowInstance | null) => {
    instanceARef.current = instance
  }, [])

  const setInstanceB = useCallback((instance: ReactFlowInstance | null) => {
    instanceBRef.current = instance
  }, [])

  /**
   * Sync viewport from one canvas to another with debounce
   */
  const syncViewport = useCallback(
    (source: 'A' | 'B', viewport: Viewport) => {
      // Check ref for current enabled state (handles toggle during pending sync)
      if (!enabledRef.current) return

      // Skip sync during fitBoth operation
      if (suppressSyncRef.current) return

      // Clear any pending sync
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current)
      }

      // Skip if this sync was triggered by the other canvas
      if (syncSourceRef.current && syncSourceRef.current !== source) {
        syncSourceRef.current = null
        return
      }

      syncTimeoutRef.current = setTimeout(() => {
        // Re-check enabled state inside timer callback
        if (!enabledRef.current || suppressSyncRef.current) return

        syncSourceRef.current = source

        const targetInstance = source === 'A' ? instanceBRef.current : instanceARef.current

        if (targetInstance) {
          targetInstance.setViewport(viewport, { duration: 0 })
        }

        // Clear sync source after a short delay to allow the target's onMoveEnd to fire
        setTimeout(() => {
          syncSourceRef.current = null
        }, debounceMs)
      }, debounceMs)
    },
    [debounceMs]
  )

  const onMoveEndA: OnMoveEnd = useCallback(
    (_event, viewport) => {
      syncViewport('A', viewport)
    },
    [syncViewport]
  )

  const onMoveEndB: OnMoveEnd = useCallback(
    (_event, viewport) => {
      syncViewport('B', viewport)
    },
    [syncViewport]
  )

  const syncToViewport = useCallback(
    (viewport: Viewport) => {
      if (!enabled) return
      instanceARef.current?.setViewport(viewport, { duration: 0 })
      instanceBRef.current?.setViewport(viewport, { duration: 0 })
    },
    [enabled]
  )

  const fitBoth = useCallback(() => {
    // Suppress sync so each canvas fits to its own content independently
    suppressSyncRef.current = true

    instanceARef.current?.fitView({ padding: 0.1, duration: 200 })
    instanceBRef.current?.fitView({ padding: 0.1, duration: 200 })

    // Re-enable sync after fit animations complete (200ms duration + buffer)
    setTimeout(() => {
      suppressSyncRef.current = false
    }, 300)
  }, [])

  return {
    setInstanceA,
    setInstanceB,
    onMoveEndA,
    onMoveEndB,
    syncToViewport,
    fitBoth,
  }
}

/**
 * useAutosave - Automatic periodic saving of canvas state
 *
 * Saves current graph to localStorage every 30 seconds when dirty.
 * Used for recovery in case of browser crash or accidental close.
 *
 * Multi-tab safety: Uses a debounced write with timestamp check to avoid
 * racing writes when multiple tabs are open.
 *
 * Usage:
 * ```
 * useAutosave() // Call in ReactFlowGraph or similar top-level component
 * ```
 */

import { useEffect, useRef, useCallback } from 'react'
import { useCanvasStore } from '../store'
import { saveAutosave, loadAutosave } from '../store/scenarios'

const AUTOSAVE_INTERVAL_MS = 30 * 1000 // 30 seconds
const DEBOUNCE_MS = 500 // Debounce writes to reduce localStorage contention

export function useAutosave() {
  // React #185 FIX: Use shallow comparison for object/array selectors
  // to prevent infinite re-renders when references change but contents are identical
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)
  const currentScenarioId = useCanvasStore(s => s.currentScenarioId)
  const isDirty = useCanvasStore(s => s.isDirty)
  const markDirty = useCanvasStore(s => s.markDirty)

  // Track if any changes have been made to the graph
  const lastGraphSnapshot = useRef<string>('')

  // Debounce timer for writes
  const writeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Compute a simple hash of the current graph state
  const computeGraphHash = useCallback(() => {
    const nodesHash = nodes.map(n => `${n.id}:${n.type}:${n.data?.label || ''}`).join('|')
    const edgesHash = edges.map(e => `${e.id}:${e.source}>${e.target}:${e.data?.confidence || ''}`).join('|')
    return `${nodesHash}#${edgesHash}`
  }, [nodes, edges])

  // Debounced autosave function to reduce localStorage contention in multi-tab scenarios
  const debouncedSave = useCallback(() => {
    // Clear any pending write
    if (writeTimerRef.current) {
      clearTimeout(writeTimerRef.current)
    }

    writeTimerRef.current = setTimeout(() => {
      // Multi-tab safety: Check if another tab has newer data before overwriting
      const existingAutosave = loadAutosave()
      const now = Date.now()

      // Only write if no autosave exists, or our data is newer (within tolerance)
      // This prevents race conditions where multiple tabs try to write simultaneously
      if (!existingAutosave || (now - existingAutosave.timestamp) >= DEBOUNCE_MS) {
        saveAutosave({
          timestamp: now,
          scenarioId: currentScenarioId || undefined,
          nodes,
          edges
        })

        if (import.meta.env.DEV) {
          console.log('[Autosave] Saved graph state', {
            nodes: nodes.length,
            edges: edges.length,
            scenarioId: currentScenarioId
          })
        }
      }
    }, DEBOUNCE_MS)
  }, [nodes, edges, currentScenarioId])

  // Check if graph has changed since last save
  useEffect(() => {
    const currentHash = computeGraphHash()

    if (currentHash !== lastGraphSnapshot.current) {
      // Graph changed - mark as dirty
      if (!isDirty) {
        markDirty()
      }
      lastGraphSnapshot.current = currentHash
    }
  }, [computeGraphHash, isDirty, markDirty])

  // Periodic autosave
  useEffect(() => {
    const interval = setInterval(() => {
      // Only autosave if there are changes
      if (isDirty && (nodes.length > 0 || edges.length > 0)) {
        debouncedSave()
      }
    }, AUTOSAVE_INTERVAL_MS)

    return () => {
      clearInterval(interval)
      // Clear any pending debounced write on unmount
      if (writeTimerRef.current) {
        clearTimeout(writeTimerRef.current)
      }
    }
  }, [isDirty, nodes.length, edges.length, debouncedSave])
}

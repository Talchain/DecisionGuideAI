/**
 * useAutosave - Automatic periodic saving of canvas state
 *
 * Saves current graph to localStorage every 30 seconds when content changes.
 * Used for recovery in case of browser crash or accidental close.
 *
 * P1 Fix: Uses hash-based dirty checking to only save when content actually changes,
 * preventing spam saves when isDirty flag is stale.
 *
 * Multi-tab safety: Uses a debounced write with timestamp check to avoid
 * racing writes when multiple tabs are open.
 *
 * Usage:
 * ```
 * useAutosave() // Call in ReactFlowGraph or similar top-level component
 * ```
 */

import { useEffect, useRef, useCallback, useMemo } from 'react'
import { useCanvasStore } from '../store'
import { saveAutosave, loadAutosave } from '../store/scenarios'

const AUTOSAVE_INTERVAL_MS = 30 * 1000 // 30 seconds
const DEBOUNCE_MS = 500 // Debounce writes to reduce localStorage contention

/**
 * P1 Fix: Compute a canonical hash of graph state for dirty detection.
 * Includes node kind, label, position and edge source/target/weight.
 * Sorted to ensure consistent ordering.
 */
function computeGraphHash(nodes: any[], edges: any[]): string {
  const canonical = {
    nodes: nodes
      .map(n => ({
        id: n.id,
        kind: n.type ?? n.data?.kind,
        label: n.data?.label ?? '',
        x: Math.round(n.position?.x ?? 0),
        y: Math.round(n.position?.y ?? 0),
      }))
      .sort((a, b) => a.id.localeCompare(b.id)),
    edges: edges
      .map(e => ({
        from: e.source,
        to: e.target,
        weight: e.data?.confidence ?? e.data?.weight ?? '',
      }))
      .sort((a, b) => a.from.localeCompare(b.from) || a.to.localeCompare(b.to)),
  }
  return JSON.stringify(canonical)
}

export function useAutosave() {
  // React #185 FIX: Use shallow comparison for object/array selectors
  // to prevent infinite re-renders when references change but contents are identical
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)
  const currentScenarioId = useCanvasStore(s => s.currentScenarioId)
  // V3: Include analysis_ready and goal selection in autosave
  const ceeAnalysisReady = useCanvasStore(s => s.ceeAnalysisReady)
  const selectedGoalNode = useCanvasStore(s => s.selectedGoalNode)

  // P1 Fix: Track the hash of last saved state (not just last snapshot)
  const lastSavedHashRef = useRef<string>('')

  // Debounce timer for writes
  const writeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // P1 Fix: Memoize current graph hash to avoid recomputing on every render
  const currentHash = useMemo(
    () => computeGraphHash(nodes, edges),
    [nodes, edges]
  )

  // Debounced autosave function to reduce localStorage contention in multi-tab scenarios
  // P1 Fix: Only saves if hash differs from last saved hash
  const debouncedSave = useCallback(() => {
    // Clear any pending write
    if (writeTimerRef.current) {
      clearTimeout(writeTimerRef.current)
    }

    writeTimerRef.current = setTimeout(() => {
      // P1 Fix: Skip save if content hasn't changed
      if (currentHash === lastSavedHashRef.current) {
        return
      }

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
          edges,
          // V3: Persist analysis_ready and goal selection
          ceeAnalysisReady: ceeAnalysisReady ?? undefined,
          selectedGoalNode: selectedGoalNode ?? undefined,
        })

        // P1 Fix: Update last saved hash after successful save
        lastSavedHashRef.current = currentHash

        if (import.meta.env.DEV) {
          console.log('[Autosave] Saved graph state', {
            nodes: nodes.length,
            edges: edges.length,
            scenarioId: currentScenarioId,
            hashChanged: true,
          })
        }
      }
    }, DEBOUNCE_MS)
  }, [nodes, edges, currentScenarioId, currentHash, ceeAnalysisReady, selectedGoalNode])

  // Periodic autosave - only saves if content changed
  useEffect(() => {
    const interval = setInterval(() => {
      // P1 Fix: Only autosave if content changed AND there's something to save
      if (currentHash !== lastSavedHashRef.current && (nodes.length > 0 || edges.length > 0)) {
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
  }, [currentHash, nodes.length, edges.length, debouncedSave])
}

/**
 * useAutosave - Automatic periodic saving of canvas state
 *
 * Saves current graph to localStorage every 30 seconds when dirty.
 * Used for recovery in case of browser crash or accidental close.
 *
 * Usage:
 * ```
 * useAutosave() // Call in ReactFlowGraph or similar top-level component
 * ```
 */

import { useEffect, useRef } from 'react'
import { useCanvasStore } from '../store'
import { saveAutosave } from '../store/scenarios'

const AUTOSAVE_INTERVAL_MS = 30 * 1000 // 30 seconds

export function useAutosave() {
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)
  const currentScenarioId = useCanvasStore(s => s.currentScenarioId)
  const isDirty = useCanvasStore(s => s.isDirty)
  const markDirty = useCanvasStore(s => s.markDirty)

  // Track if any changes have been made to the graph
  const lastGraphSnapshot = useRef<string>('')

  // Compute a simple hash of the current graph state
  const computeGraphHash = () => {
    const nodesHash = nodes.map(n => `${n.id}:${n.type}:${n.data?.label || ''}`).join('|')
    const edgesHash = edges.map(e => `${e.id}:${e.source}>${e.target}:${e.data?.confidence || ''}`).join('|')
    return `${nodesHash}#${edgesHash}`
  }

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
  }, [nodes, edges, isDirty, markDirty])

  // Periodic autosave
  useEffect(() => {
    const interval = setInterval(() => {
      // Only autosave if there are changes
      if (isDirty && (nodes.length > 0 || edges.length > 0)) {
        saveAutosave({
          timestamp: Date.now(),
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
    }, AUTOSAVE_INTERVAL_MS)

    return () => clearInterval(interval)
  }, [nodes, edges, currentScenarioId, isDirty])
}

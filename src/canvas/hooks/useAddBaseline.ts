/**
 * useAddBaseline Hook (P2 Task 2)
 *
 * Shared hook for creating a "Status Quo" baseline option.
 * Extracted from PreAnalysisPanel.handleAddBaseline for reuse in Results panel.
 *
 * Features:
 * - Creates a new option node with is_baseline: true
 * - Auto-populates interventions from factor observed states
 * - Guards against duplicate baselines
 * - Invalidates CEE analysis ready state
 */

import { useCallback } from 'react'
import { useCanvasStore } from '../store'
import { focusNodeById } from '../utils/focusHelpers'

interface UseAddBaselineOptions {
  /** Callback to highlight nodes visually */
  onHighlight?: (nodeIds: string[]) => void
  /** Callback after baseline is added (for auto re-run) */
  onBaselineAdded?: () => void
}

interface UseAddBaselineReturn {
  /** Add a "Status Quo" baseline option to the graph */
  addBaseline: () => boolean
  /** Check if a baseline already exists */
  hasBaseline: boolean
}

/**
 * Hook for creating a "Status Quo" baseline option.
 * Returns a function that creates the baseline and a flag indicating if one exists.
 */
export function useAddBaseline(options: UseAddBaselineOptions = {}): UseAddBaselineReturn {
  const { onHighlight, onBaselineAdded } = options

  const nodes = useCanvasStore(s => s.nodes)

  // Check if baseline already exists
  const hasBaseline = nodes.some(
    n => n.type === 'option' &&
         (n.data as { is_baseline?: boolean })?.is_baseline === true
  )

  const addBaseline = useCallback(() => {
    const { nodes, addNode, updateNode, addEdge, setCeeAnalysisReady } = useCanvasStore.getState()

    // Guard: Check if baseline option already exists
    const existingBaseline = nodes.find(
      n => n.type === 'option' &&
           (n.data as { is_baseline?: boolean })?.is_baseline === true
    )
    if (existingBaseline) {
      // Focus existing baseline instead of creating duplicate
      if (onHighlight) {
        onHighlight([existingBaseline.id])
        setTimeout(() => onHighlight([]), 3000)
      }
      focusNodeById(existingBaseline.id)
      console.info('[useAddBaseline] Baseline already exists, focusing:', existingBaseline.id)
      return false
    }

    // Find decision node for connection
    const decisionNode = nodes.find(n => n.type === 'decision')
    const anchorNode = decisionNode || nodes[0]

    if (!anchorNode) {
      console.warn('[useAddBaseline] Cannot add baseline: no nodes to connect to')
      return false
    }

    // Calculate position near anchor
    const newPosition = {
      x: (anchorNode.position?.x || 200) + 200,
      y: (anchorNode.position?.y || 200) + 50,
    }

    // Create new option node
    addNode(newPosition, 'option')

    // Get the newly created node
    const newNodes = useCanvasStore.getState().nodes
    const newNode = newNodes[newNodes.length - 1]
    if (!newNode) return false

    // Collect current observed state values for interventions
    const factorNodes = nodes.filter(n => n.type === 'factor')
    const interventions: Record<string, number> = {}
    for (const factor of factorNodes) {
      const observedState = (factor.data as { observed_state?: { value?: number } })?.observed_state
      if (observedState?.value != null) {
        interventions[factor.id] = observedState.value
      }
    }

    // Update node with baseline properties
    updateNode(newNode.id, {
      data: {
        ...newNode.data,
        label: 'Status Quo',
        kind: 'option',
        is_baseline: true,
        interventions,
        status: 'ready',
      },
    })

    // Connect to decision node if available
    if (decisionNode) {
      addEdge({
        source: decisionNode.id,
        target: newNode.id,
        type: 'default',
        data: { confidence: 0 },
      })
    }

    // Invalidate CEE analysis ready state
    setCeeAnalysisReady(null)

    console.info('[useAddBaseline] Added baseline option:', newNode.id)

    // Call callback if provided (for auto re-run)
    if (onBaselineAdded) {
      onBaselineAdded()
    }

    return true
  }, [onHighlight, onBaselineAdded])

  return { addBaseline, hasBaseline }
}

/**
 * useHighlightDispatch - Manage visual highlights on canvas elements
 *
 * Provides methods to highlight nodes and edges for coaching/guidance.
 * Supports the new Highlight type from primitives with timeout auto-clear.
 *
 * Features:
 * - ID mapping from PLoT format to UI format
 * - Automatic viewport adjustment to show highlighted elements
 * - Timeout-based auto-clear
 * - Store-backed edge highlights for UI reactivity
 *
 * Usage:
 * const { dispatchHighlight, clearHighlights, highlightFromResponse } = useHighlightDispatch()
 * dispatchHighlight({ type: 'node', ids: ['node_001'], style: 'warning' })
 */

import { useCallback, useRef, useEffect } from 'react'
import { useReactFlow, type Node } from '@xyflow/react'
import { useCanvasStore } from '../store'
import type { Highlight, HighlightGroup } from '../../types/primitives'
import { mapHighlightIds } from '../../lib/idMapping'

/**
 * Hook return type
 */
interface UseHighlightDispatchReturn {
  /** Dispatch a single highlight (with ID mapping and viewport adjustment) */
  dispatchHighlight: (highlight: Highlight) => void

  /** Dispatch a group of related highlights */
  dispatchHighlightGroup: (group: HighlightGroup) => void

  /** Clear all highlights */
  clearHighlights: () => void

  /** Clear specific highlight by ID */
  clearHighlight: (id: string) => void

  /** Process highlights from CEE response (maps IDs, clears existing, adjusts viewport) */
  highlightFromResponse: (highlights: Highlight[] | undefined) => void

  /** Current highlighted node IDs */
  highlightedNodeIds: Set<string>

  /** Current highlighted edge IDs */
  highlightedEdgeIds: Set<string>
}

/**
 * Map Highlight style to CSS class variants
 */
export function getHighlightStyleClass(style: Highlight['style'] = 'primary'): string {
  switch (style) {
    case 'primary':
      return 'border-info shadow-info/60 bg-info/15'
    case 'secondary':
      return 'border-gray-400 shadow-gray-400/40 bg-gray-400/10'
    case 'warning':
      return 'border-warning shadow-warning/50 bg-warning/15'
    case 'error':
      return 'border-danger shadow-danger/60 bg-danger/15'
    default:
      return 'border-info shadow-info/60 bg-info/15'
  }
}

/**
 * useHighlightDispatch hook
 *
 * Manages highlight state for canvas elements with:
 * - ID mapping from PLoT format to UI format
 * - Viewport adjustment to show highlighted elements
 * - Timeout support for auto-clear
 * - Store-backed state for both nodes AND edges (UI reactive)
 */
export function useHighlightDispatch(): UseHighlightDispatchReturn {
  const setHighlightedNodes = useCanvasStore(s => s.setHighlightedNodes)
  const setHighlightedEdges = useCanvasStore(s => s.setHighlightedEdges)
  const highlightedNodes = useCanvasStore(s => s.highlightedNodes)
  const highlightedEdges = useCanvasStore(s => s.highlightedEdges)
  const nodes = useCanvasStore(s => s.nodes)
  const edges = useCanvasStore(s => s.edges)

  // ReactFlow viewport controls
  const { fitView, setCenter, getNodes } = useReactFlow()

  // Track timeouts for auto-clear
  const timeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach(timeout => clearTimeout(timeout))
      timeoutsRef.current.clear()
    }
  }, [])

  /**
   * Pan viewport to show highlighted nodes
   */
  const panToNodes = useCallback((nodeIds: string[]) => {
    if (nodeIds.length === 0) return

    try {
      const targetNodes = getNodes().filter(n => nodeIds.includes(n.id))
      if (targetNodes.length > 0) {
        fitView({
          nodes: targetNodes,
          padding: 0.2,
          duration: 300,
          maxZoom: 1.5, // Don't zoom in too much
        })
      }
    } catch (error) {
      // ReactFlow might not be ready, ignore error
      if (import.meta.env.DEV) {
        console.warn('[HighlightDispatch] Could not pan to nodes:', error)
      }
    }
  }, [fitView, getNodes])

  /**
   * Pan viewport to show highlighted edges
   */
  const panToEdges = useCallback((edgeIds: string[]) => {
    if (edgeIds.length === 0) return

    try {
      // Find connected nodes for each edge
      const connectedNodeIds = new Set<string>()
      edges
        .filter(e => edgeIds.includes(e.id))
        .forEach(e => {
          connectedNodeIds.add(e.source)
          connectedNodeIds.add(e.target)
        })

      if (connectedNodeIds.size === 0) return

      const connectedNodes = getNodes().filter(n => connectedNodeIds.has(n.id))
      if (connectedNodes.length === 0) return

      // Calculate center point of connected nodes
      const avgX = connectedNodes.reduce((sum, n) => sum + n.position.x, 0) / connectedNodes.length
      const avgY = connectedNodes.reduce((sum, n) => sum + n.position.y, 0) / connectedNodes.length

      setCenter(avgX, avgY, { duration: 300, zoom: 1 })
    } catch (error) {
      // ReactFlow might not be ready, ignore error
      if (import.meta.env.DEV) {
        console.warn('[HighlightDispatch] Could not pan to edges:', error)
      }
    }
  }, [edges, getNodes, setCenter])

  /**
   * Dispatch a single highlight to the canvas
   * Maps IDs from PLoT format and adjusts viewport
   */
  const dispatchHighlight = useCallback((highlight: Highlight) => {
    // Map IDs from PLoT format to UI format
    const mappedHighlight = mapHighlightIds(highlight, nodes, edges)

    if (mappedHighlight.ids.length === 0) {
      if (import.meta.env.DEV) {
        console.warn('[HighlightDispatch] No valid IDs after mapping:', highlight.ids)
      }
      return
    }

    const { type, ids, timeout_ms } = mappedHighlight

    if (type === 'node' || type === 'path') {
      // Use functional update pattern to avoid race conditions
      const currentIds = Array.from(useCanvasStore.getState().highlightedNodes)
      const newIds = [...new Set([...currentIds, ...ids])]
      setHighlightedNodes(newIds)

      // Pan to nodes
      panToNodes(ids)

      // Set up timeout if specified
      if (timeout_ms && timeout_ms > 0) {
        ids.forEach(id => {
          // Clear existing timeout for this ID
          const existingTimeout = timeoutsRef.current.get(`node_${id}`)
          if (existingTimeout) clearTimeout(existingTimeout)

          // Set new timeout with functional update to avoid stale state
          const timeout = setTimeout(() => {
            const current = Array.from(useCanvasStore.getState().highlightedNodes)
            setHighlightedNodes(current.filter(nid => nid !== id))
            timeoutsRef.current.delete(`node_${id}`)
          }, timeout_ms)

          timeoutsRef.current.set(`node_${id}`, timeout)
        })
      }
    }

    if (type === 'edge' || type === 'path') {
      // Use store for edge highlights (previously used ref, now reactive)
      const currentEdgeIds = Array.from(useCanvasStore.getState().highlightedEdges)
      const newEdgeIds = [...new Set([...currentEdgeIds, ...ids])]
      setHighlightedEdges(newEdgeIds)

      // Pan to edges
      panToEdges(ids)

      // Set up timeout if specified
      if (timeout_ms && timeout_ms > 0) {
        ids.forEach(id => {
          const existingTimeout = timeoutsRef.current.get(`edge_${id}`)
          if (existingTimeout) clearTimeout(existingTimeout)

          // Set new timeout with functional update to avoid stale state
          const timeout = setTimeout(() => {
            const current = Array.from(useCanvasStore.getState().highlightedEdges)
            setHighlightedEdges(current.filter(eid => eid !== id))
            timeoutsRef.current.delete(`edge_${id}`)
          }, timeout_ms)

          timeoutsRef.current.set(`edge_${id}`, timeout)
        })
      }
    }
  }, [nodes, edges, setHighlightedNodes, setHighlightedEdges, panToNodes, panToEdges])

  /**
   * Dispatch a group of related highlights
   */
  const dispatchHighlightGroup = useCallback((group: HighlightGroup) => {
    group.highlights.forEach(highlight => dispatchHighlight(highlight))
  }, [dispatchHighlight])

  /**
   * Clear all highlights
   */
  const clearHighlights = useCallback(() => {
    setHighlightedNodes([])
    setHighlightedEdges([])

    // Clear all timeouts
    timeoutsRef.current.forEach(timeout => clearTimeout(timeout))
    timeoutsRef.current.clear()
  }, [setHighlightedNodes, setHighlightedEdges])

  /**
   * Clear a specific highlight by ID
   */
  const clearHighlight = useCallback((id: string) => {
    // Try clearing from nodes (use getState to avoid stale closure)
    const currentNodes = Array.from(useCanvasStore.getState().highlightedNodes)
    if (currentNodes.includes(id)) {
      setHighlightedNodes(currentNodes.filter(nid => nid !== id))
    }

    // Try clearing from edges
    const currentEdges = Array.from(useCanvasStore.getState().highlightedEdges)
    if (currentEdges.includes(id)) {
      setHighlightedEdges(currentEdges.filter(eid => eid !== id))
    }

    // Clear associated timeouts
    const nodeTimeout = timeoutsRef.current.get(`node_${id}`)
    if (nodeTimeout) {
      clearTimeout(nodeTimeout)
      timeoutsRef.current.delete(`node_${id}`)
    }

    const edgeTimeout = timeoutsRef.current.get(`edge_${id}`)
    if (edgeTimeout) {
      clearTimeout(edgeTimeout)
      timeoutsRef.current.delete(`edge_${id}`)
    }
  }, [setHighlightedNodes, setHighlightedEdges])

  /**
   * Process highlights from CEE response
   * Maps IDs, clears existing, and adjusts viewport
   */
  const highlightFromResponse = useCallback((highlights: Highlight[] | undefined) => {
    if (!highlights || highlights.length === 0) return

    // Clear existing highlights before applying new ones
    clearHighlights()

    // Apply each highlight (ID mapping and viewport adjustment happen in dispatchHighlight)
    highlights.forEach(highlight => dispatchHighlight(highlight))
  }, [clearHighlights, dispatchHighlight])

  return {
    dispatchHighlight,
    dispatchHighlightGroup,
    clearHighlights,
    clearHighlight,
    highlightFromResponse,
    highlightedNodeIds: highlightedNodes,
    highlightedEdgeIds: highlightedEdges,
  }
}

export default useHighlightDispatch

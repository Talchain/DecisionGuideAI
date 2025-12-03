/**
 * useGhostSuggestions Hook
 *
 * Manages ghost edge suggestions lifecycle:
 * - Shows on hover (building stage only)
 * - Accepts on Tab (creates real edge)
 * - Dismisses on Esc/leave
 * - 300ms delay before showing (avoids flashing)
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { useReactFlow } from '@xyflow/react'
import {
  generateGhostSuggestions,
  shouldShowGhosts,
  type GhostSuggestion,
} from '../utils/ghostSuggestions'
import { useCanvasStore } from '../../../canvas/store'
import { useGuideStore } from './useCopilotStore'

/**
 * Manages ghost edge suggestions lifecycle
 * - Shows on hover (building stage only)
 * - Accepts on Tab (creates real edge)
 * - Dismisses on Esc/leave
 */
export function useGhostSuggestions() {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<GhostSuggestion[]>([])
  const hoverTimeoutRef = useRef<NodeJS.Timeout>()

  const addEdge = useCanvasStore((state) => state.addEdge)
  const reactFlowInstance = useReactFlow()
  const journeyStage = useGuideStore((state) => state.journeyStage)

  const handleNodeMouseEnter = useCallback(
    (nodeId: string) => {
      const nodes = reactFlowInstance.getNodes()
      const edges = reactFlowInstance.getEdges()

      // Check if should show ghosts
      if (!shouldShowGhosts(journeyStage, nodes.length)) {
        return
      }

      // Delay to avoid flashing on quick hover
      hoverTimeoutRef.current = setTimeout(() => {
        setHoveredNode(nodeId)
        const newSuggestions = generateGhostSuggestions(nodeId, nodes, edges)
        setSuggestions(newSuggestions)
      }, 300) // 300ms delay before showing
    },
    [reactFlowInstance, journeyStage]
  )

  const handleNodeMouseLeave = useCallback(() => {
    // Clear timeout if leaving before ghosts appear
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
    }
    setHoveredNode(null)
    setSuggestions([])
  }, [])

  const acceptSuggestion = useCallback(
    (suggestion: GhostSuggestion) => {
      // Create real edge
      addEdge({
        source: suggestion.from,
        target: suggestion.to,
        data: {
          weight: suggestion.suggestedWeight,
          belief: Math.round(suggestion.confidence * 100),
        },
      })

      // Clear ghosts
      setSuggestions([])
      setHoveredNode(null)

      // Telemetry
      console.log('[Ghost] Accepted:', suggestion)
    },
    [addEdge]
  )

  const dismissSuggestions = useCallback(() => {
    setSuggestions([])
    setHoveredNode(null)

    // Telemetry
    console.log('[Ghost] Dismissed')
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current)
      }
    }
  }, [])

  return {
    hoveredNode,
    suggestions,
    handleNodeMouseEnter,
    handleNodeMouseLeave,
    acceptSuggestion,
    dismissSuggestions,
  }
}

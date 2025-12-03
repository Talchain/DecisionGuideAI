/**
 * Ghost Suggestions Overlay
 *
 * Standalone overlay component that adds ghost edge suggestions to the canvas.
 * Uses event delegation for node hover detection and renders visual hints.
 *
 * Features:
 * - Detects node hover via DOM events (no ReactFlow context required)
 * - 300ms delay before showing suggestions
 * - Tab-to-accept, Esc-to-dismiss keyboard shortcuts
 * - Only active in building stage with ≥2 nodes
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useCanvasStore } from '@/canvas/store'
import { useGuideStore } from '../../hooks/useGuideStore'
import { generateGhostSuggestions, shouldShowGhosts, type GhostSuggestion } from '../../utils/ghostSuggestions'

export function GhostSuggestionsOverlay(): JSX.Element | null {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<GhostSuggestion[]>([])
  const hoverTimeoutRef = useRef<NodeJS.Timeout>()

  const addEdge = useCanvasStore((state) => state.addEdge)
  const nodes = useCanvasStore((state) => state.nodes)
  const edges = useCanvasStore((state) => state.edges)
  const journeyStage = useGuideStore((state) => state.journeyStage)

  // DEBUG: Log component mount and unmount
  useEffect(() => {
    console.log('[GhostOverlay] 🚀 Component MOUNTED', {
      journeyStage,
      nodeCount: nodes.length,
      edgeCount: edges.length,
      timestamp: new Date().toISOString()
    })
    return () => console.log('[GhostOverlay] 💀 Component UNMOUNTED')
  }, [])

  // DEBUG: Log state changes
  useEffect(() => {
    console.log('[GhostOverlay] 📊 State update:', {
      journeyStage,
      nodeCount: nodes.length,
      edgeCount: edges.length,
      suggestionCount: suggestions.length,
      hoveredNode,
      shouldShow: shouldShowGhosts(journeyStage, nodes.length)
    })
  }, [journeyStage, nodes.length, edges.length, suggestions.length, hoveredNode])

  // Handle node mouse enter
  const handleNodeMouseEnter = useCallback(
    (nodeId: string) => {
      console.log('[GhostOverlay] 🖱️ Mouse enter node:', nodeId)

      // Check if should show ghosts
      const canShow = shouldShowGhosts(journeyStage, nodes.length)
      console.log('[GhostOverlay] 🔍 Can show ghosts?', {
        canShow,
        journeyStage,
        nodeCount: nodes.length,
        requiredStage: 'building',
        requiredNodes: 2
      })

      if (!canShow) {
        return
      }

      // Clear any existing timeout
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current)
      }

      // Delay to avoid flashing on quick hover
      console.log('[GhostOverlay] ⏱️ Starting 300ms delay timer...')
      hoverTimeoutRef.current = setTimeout(() => {
        console.log('[GhostOverlay] ⏰ Timer fired! Generating suggestions...')
        setHoveredNode(nodeId)
        const newSuggestions = generateGhostSuggestions(nodeId, nodes, edges)
        console.log('[GhostOverlay] ✨ Generated suggestions:', newSuggestions)
        setSuggestions(newSuggestions)
      }, 300) // 300ms delay before showing
    },
    [nodes, edges, journeyStage]
  )

  // Handle node mouse leave
  const handleNodeMouseLeave = useCallback(() => {
    // Clear timeout if leaving before ghosts appear
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current)
    }
    setHoveredNode(null)
    setSuggestions([])
  }, [])

  // Accept suggestion
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

      console.log('[Ghost] Accepted:', suggestion)
    },
    [addEdge]
  )

  // Dismiss suggestions
  const dismissSuggestions = useCallback(() => {
    setSuggestions([])
    setHoveredNode(null)

    console.log('[Ghost] Dismissed')
  }, [])

  // Set up DOM event listeners for node hover
  useEffect(() => {
    console.log('[GhostOverlay] 🎣 Setting up event listeners...')

    const handleMouseOver = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      const nodeElement = target.closest('.react-flow__node')
      if (nodeElement) {
        const nodeId = nodeElement.getAttribute('data-id')
        if (nodeId) {
          handleNodeMouseEnter(nodeId)
        }
      }
    }

    const handleMouseOut = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      const relatedTarget = event.relatedTarget as HTMLElement | null

      // Only trigger leave if we're actually leaving all nodes
      const nodeElement = target.closest('.react-flow__node')
      if (nodeElement && relatedTarget && !nodeElement.contains(relatedTarget)) {
        handleNodeMouseLeave()
      }
    }

    const canvas = document.querySelector('.react-flow')
    console.log('[GhostOverlay] 🎨 Canvas element found:', !!canvas)

    if (canvas) {
      canvas.addEventListener('mouseover', handleMouseOver)
      canvas.addEventListener('mouseout', handleMouseOut)
      console.log('[GhostOverlay] ✅ Event listeners attached')
    } else {
      console.warn('[GhostOverlay] ⚠️ Canvas element NOT found!')
    }

    return () => {
      if (canvas) {
        canvas.removeEventListener('mouseover', handleMouseOver)
        canvas.removeEventListener('mouseout', handleMouseOut)
        console.log('[GhostOverlay] 🧹 Event listeners cleaned up')
      }
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current)
      }
    }
  }, [handleNodeMouseEnter, handleNodeMouseLeave])

  // Set up keyboard listeners for Tab/Esc
  useEffect(() => {
    if (suggestions.length === 0) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab' && suggestions.length > 0) {
        e.preventDefault()
        // Accept first suggestion
        acceptSuggestion(suggestions[0])
      } else if (e.key === 'Escape' && suggestions.length > 0) {
        e.preventDefault()
        dismissSuggestions()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [suggestions, acceptSuggestion, dismissSuggestions])

  // Don't render anything if no suggestions
  if (suggestions.length === 0) {
    return null
  }

  // Render ghost suggestion hint
  return (
    <div className="absolute inset-0 pointer-events-none z-[100]">
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
        <div className="animate-fade-in bg-white border-2 border-analytical-400 rounded-lg shadow-xl px-5 py-4 max-w-sm pointer-events-auto">
          <div className="flex items-start gap-3 mb-3">
            <span className="text-2xl">✨</span>
            <div className="flex-1">
              <div className="text-sm font-medium text-charcoal-900 mb-1">
                Suggested connection
              </div>
              <div className="text-sm text-storm-700">
                {suggestions[0].reasoning}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs text-storm-600 border-t border-storm-100 pt-3">
            <div className="flex items-center gap-1.5">
              <kbd className="px-2 py-1 bg-mist-100 border border-storm-300 rounded font-mono text-charcoal-800">
                Tab
              </kbd>
              <span>to accept</span>
            </div>
            <span className="text-storm-300">·</span>
            <div className="flex items-center gap-1.5">
              <kbd className="px-2 py-1 bg-mist-100 border border-storm-300 rounded font-mono text-charcoal-800">
                Esc
              </kbd>
              <span>to dismiss</span>
            </div>
          </div>
          {suggestions.length > 1 && (
            <div className="mt-2 text-xs text-storm-500">
              +{suggestions.length - 1} more suggestion{suggestions.length > 2 ? 's' : ''}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * useCanvasKeyboardShortcuts - Global keyboard shortcuts for canvas
 *
 * Shortcuts:
 * - P: Edit probabilities for selected edge's parent decision
 * - Alt+V: Cycle through validation errors
 * - Cmd/Ctrl+Enter: Run simulation
 * - ?: Show keyboard map
 */

import { useEffect, useCallback } from 'react'
import { useCanvasStore, getNextInvalidNode } from '../store'

interface UseCanvasKeyboardShortcutsOptions {
  onFocusNode?: (nodeId: string) => void
  onRunSimulation?: () => void
  onShowKeyboardMap?: () => void
  onEditProbabilities?: (nodeId: string) => void
}

export function useCanvasKeyboardShortcuts({
  onFocusNode,
  onRunSimulation,
  onShowKeyboardMap,
  onEditProbabilities
}: UseCanvasKeyboardShortcutsOptions = {}) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // P: Edit probabilities for selected edge's parent decision
    if (e.key === 'p' && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
      e.preventDefault()
      const state = useCanvasStore.getState()
      const { selection, edges } = state

      // Check if exactly one edge is selected
      if (selection.edgeIds.size === 1) {
        const edgeId = [...selection.edgeIds][0]
        const edge = edges.find(e => e.id === edgeId)

        if (edge && edge.source && onEditProbabilities) {
          onEditProbabilities(edge.source)
        }
      }

      return
    }

    // ?: Show keyboard map
    if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault()

      if (onShowKeyboardMap) {
        onShowKeyboardMap()
      }

      return
    }

    // Alt+V: Cycle through validation errors
    if (e.altKey && e.key === 'v') {
      e.preventDefault()
      const state = useCanvasStore.getState()
      const { selection } = state

      // Get current selected node (if any)
      const currentNodeId = selection.nodeIds.size === 1
        ? [...selection.nodeIds][0]
        : undefined

      // Get next invalid node
      const nextInvalid = getNextInvalidNode(state, currentNodeId)

      if (nextInvalid && onFocusNode) {
        onFocusNode(nextInvalid.nodeId)
      }

      return
    }

    // Cmd/Ctrl+Enter: Run simulation
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()

      if (onRunSimulation) {
        onRunSimulation()
      }

      return
    }
  }, [onFocusNode, onRunSimulation, onShowKeyboardMap, onEditProbabilities])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}

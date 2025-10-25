/**
 * useCanvasKeyboardShortcuts - Global keyboard shortcuts for canvas
 *
 * Shortcuts:
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
}

export function useCanvasKeyboardShortcuts({
  onFocusNode,
  onRunSimulation,
  onShowKeyboardMap
}: UseCanvasKeyboardShortcutsOptions = {}) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
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
  }, [onFocusNode, onRunSimulation, onShowKeyboardMap])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}

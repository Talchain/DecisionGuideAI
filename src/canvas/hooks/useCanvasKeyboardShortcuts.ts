/**
 * useCanvasKeyboardShortcuts - Global keyboard shortcuts for canvas
 *
 * Shortcuts:
 * - P: Focus inline probabilities editor for selected decision
 * - Alt+V: Cycle through validation errors
 * - Cmd/Ctrl+Enter: Run simulation
 * - Cmd/Ctrl+3: Toggle Results panel
 * - ? or Cmd/Ctrl+/: Show help panel
 */

import { useEffect, useCallback } from 'react'
import { useCanvasStore, getNextInvalidNode } from '../store'

interface UseCanvasKeyboardShortcutsOptions {
  onFocusNode?: (nodeId: string) => void
  onRunSimulation?: () => void
  onToggleResults?: () => void
  onShowKeyboardMap?: () => void
  onShowHelpPanel?: () => void
  onShowToast?: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void
}

export function useCanvasKeyboardShortcuts({
  onFocusNode,
  onRunSimulation,
  onToggleResults,
  onShowKeyboardMap,
  onShowHelpPanel,
  onShowToast
}: UseCanvasKeyboardShortcutsOptions = {}) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // P: Focus inline probabilities editor for selected decision
    if (e.key === 'p' && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
      e.preventDefault()
      const state = useCanvasStore.getState()
      const { selection, nodes, edges } = state

      // Check if exactly one node is selected
      if (selection.nodeIds.size === 1) {
        const nodeId = [...selection.nodeIds][0]
        const node = nodes.find(n => n.id === nodeId)

        // Check if node has outgoing edges (is a decision point)
        const outgoingEdges = edges.filter(e => e.source === nodeId)

        if (outgoingEdges.length > 0) {
          // Find the probabilities section in the DOM and focus first slider
          // The section has data-node-id attribute set by NodeInspector
          const probabilitiesSection = document.querySelector(`[data-node-id="${nodeId}"]`) as HTMLElement
          if (probabilitiesSection) {
            probabilitiesSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
            // Focus first slider in the section
            const firstSlider = probabilitiesSection.querySelector('input[type="range"]') as HTMLInputElement
            if (firstSlider) {
              setTimeout(() => firstSlider.focus(), 100) // Small delay for smooth scroll
            }
          } else {
            // Probabilities section not found in DOM (inspector panel may not be mounted)
            if (onShowToast) {
              onShowToast('Decision inspector not visible. Make sure the properties panel is open.', 'info')
            }
          }
        } else {
          // Node has no outgoing edges
          if (onShowToast) {
            onShowToast('This decision has no outgoing connectors to edit probabilities.', 'info')
          }
        }
      } else {
        // No decision selected
        if (onShowToast) {
          onShowToast('Select a decision to edit probabilities.', 'info')
        }
      }

      return
    }

    // ? or Cmd/Ctrl+/: Show help panel
    if (e.key === '?' && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault()

      if (onShowHelpPanel) {
        onShowHelpPanel()
      } else if (onShowKeyboardMap) {
        onShowKeyboardMap()
      }

      return
    }

    // Cmd/Ctrl+/: Show help panel (alternative shortcut)
    if ((e.metaKey || e.ctrlKey) && e.key === '/') {
      e.preventDefault()

      if (onShowHelpPanel) {
        onShowHelpPanel()
      } else if (onShowKeyboardMap) {
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

    // Cmd/Ctrl+3: Toggle Results panel
    if ((e.metaKey || e.ctrlKey) && e.key === '3') {
      e.preventDefault()

      if (onToggleResults) {
        onToggleResults()
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
  }, [onFocusNode, onRunSimulation, onToggleResults, onShowKeyboardMap, onShowHelpPanel, onShowToast])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}

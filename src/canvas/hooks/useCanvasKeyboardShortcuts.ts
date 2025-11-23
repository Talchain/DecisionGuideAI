/**
 * useCanvasKeyboardShortcuts - Global keyboard shortcuts for canvas
 *
 * Shortcuts:
 * - P: Focus inline probabilities editor for selected decision
 * - T: Open Templates panel
 * - Alt+V: Cycle through validation errors
 * - Cmd/Ctrl+Enter: Run simulation
 * - Cmd/Ctrl+3: Open Results view in Outputs dock
 * - Cmd/Ctrl+I: Toggle Inspector panel
 * - Cmd/Ctrl+D: Toggle Documents drawer (M5)
 * - ?: Show keyboard map
 */

import { useEffect, useCallback } from 'react'
import { useCanvasStore, getNextInvalidNode } from '../store'

interface UseCanvasKeyboardShortcutsOptions {
  onFocusNode?: (nodeId: string) => void
  onRunSimulation?: () => void
  onToggleResults?: () => void
  onToggleInspector?: () => void
  onToggleDocuments?: () => void
  onShowToast?: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void
}

export function useCanvasKeyboardShortcuts({
  onFocusNode,
  onRunSimulation,
  onToggleResults,
  onToggleInspector,
  onToggleDocuments,
  onShowToast
}: UseCanvasKeyboardShortcutsOptions = {}) {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Ignore plain-key shortcuts when typing in text inputs/areas or editable content
    const target = e.target as HTMLElement | null
    const tagName = target?.tagName
    const isTextInputTarget = !!target && (
      tagName === 'INPUT' ||
      tagName === 'TEXTAREA' ||
      target.isContentEditable
    )

    if (!e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey && isTextInputTarget) {
      return
    }

    // P: Focus inline probabilities editor for selected decision
    if (e.key === 'p' && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
      e.preventDefault()
      const state = useCanvasStore.getState()
      const { selection, edges } = state

      // Check if exactly one node is selected
      if (selection.nodeIds.size === 1) {
        const nodeId = [...selection.nodeIds][0]
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

    // T: Open Templates panel
    if (e.key === 't' && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
      e.preventDefault()
      const state = useCanvasStore.getState()
      const { showTemplatesPanel, openTemplatesPanel } = state

      // Idempotent: only open if not already open
      if (!showTemplatesPanel) {
        openTemplatesPanel(document.activeElement as HTMLElement | undefined)
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

    // Cmd/Ctrl+3: Open docked Results view
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

    // Cmd/Ctrl+I: Toggle Inspector panel
    if ((e.metaKey || e.ctrlKey) && e.key === 'i') {
      e.preventDefault()

      if (onToggleInspector) {
        onToggleInspector()
      }

      return
    }

    // Cmd/Ctrl+D: Toggle Documents drawer (M5)
    if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
      e.preventDefault()

      if (onToggleDocuments) {
        onToggleDocuments()
      }

      return
    }
  }, [onFocusNode, onRunSimulation, onToggleResults, onToggleInspector, onToggleDocuments, onShowToast])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}

/**
 * useCanvasKeyboardShortcuts - Global keyboard shortcuts for canvas
 *
 * Shortcuts:
 * - P: Focus inline probabilities editor for selected decision
 * - T: Open Templates panel
 * - L: Toggle Graph Lens dropdown
 * - ArrowLeft/ArrowRight: Cycle lens option (when option isolation active)
 * - Alt+V: Cycle through validation errors
 * - Cmd/Ctrl+Enter: Run simulation
 * - Cmd/Ctrl+3: Open Results view in Outputs dock
 * - Cmd/Ctrl+I: Toggle Inspector panel
 * - Cmd/Ctrl+D: Toggle Documents drawer (M5)
 * - Shift+A: Auto-arrange layout
 * - ?: Show keyboard map
 */

import { useEffect, useCallback } from 'react'
import { useCanvasStore, getNextInvalidNode } from '../store'
import { isGraphLensEnabled } from '../../flags'

/** Custom event dispatched by L key — TopBar listens to toggle the lens dropdown */
export const LENS_TOGGLE_EVENT = 'topbar:toggle-lens'

interface UseCanvasKeyboardShortcutsOptions {
  onFocusNode?: (nodeId: string) => void
  onRunSimulation?: () => void
  onToggleResults?: () => void
  onToggleInspector?: () => void
  onToggleDocuments?: () => void
  onShowToast?: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void
  /** Shift+F10: open context menu at the focused element's position */
  onOpenContextMenu?: (screenPos: { x: number; y: number }) => void
  /** Shift+A: auto-arrange layout */
  onAutoArrange?: () => void
}

export function useCanvasKeyboardShortcuts({
  onFocusNode,
  onRunSimulation,
  onToggleResults,
  onToggleInspector,
  onToggleDocuments,
  onShowToast,
  onOpenContextMenu,
  onAutoArrange,
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

    // Shift+A: Auto-arrange layout
    if (e.key === 'A' && e.shiftKey && !e.metaKey && !e.ctrlKey && !e.altKey) {
      if (isTextInputTarget) return
      e.preventDefault()
      if (onAutoArrange) {
        onAutoArrange()
      }
      return
    }

    // L: Toggle Graph Lens dropdown
    if (e.key === 'l' && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
      if (isGraphLensEnabled()) {
        e.preventDefault()
        window.dispatchEvent(new CustomEvent(LENS_TOGGLE_EVENT))
      }
      return
    }

    // ArrowLeft/ArrowRight: Cycle lens option (when option isolation is active)
    // Only consume the event when lens actually handles it — otherwise let React Flow process arrows
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !e.metaKey && !e.ctrlKey && !e.altKey && !e.shiftKey) {
      const state = useCanvasStore.getState()
      if (isGraphLensEnabled() && state.lens.active === 'option') {
        e.preventDefault()
        state.cycleLensOption(e.key === 'ArrowLeft' ? 'prev' : 'next')
        return
      }
    }

    // Shift+F10: Open context menu at selected element position
    if (e.shiftKey && e.key === 'F10') {
      e.preventDefault()

      if (onOpenContextMenu) {
        const state = useCanvasStore.getState()
        const { selection } = state

        // Find the DOM element for the selected node/edge to get screen position
        let screenPos = { x: window.innerWidth / 2, y: window.innerHeight / 2 }

        if (selection.nodeIds.size > 0) {
          const nodeId = [...selection.nodeIds][0]
          const el = document.querySelector(`[data-id="${nodeId}"]`)
          if (el) {
            const rect = el.getBoundingClientRect()
            screenPos = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
          }
        } else if (selection.edgeIds.size > 0) {
          const edgeId = [...selection.edgeIds][0]
          const el = document.querySelector(`[data-testid="rf__edge-${edgeId}"]`)
          if (el) {
            const rect = el.getBoundingClientRect()
            screenPos = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
          }
        }

        onOpenContextMenu(screenPos)
      }

      return
    }
  }, [onFocusNode, onRunSimulation, onToggleResults, onToggleInspector, onToggleDocuments, onShowToast, onOpenContextMenu, onAutoArrange])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}

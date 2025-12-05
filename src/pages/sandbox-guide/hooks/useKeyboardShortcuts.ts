/**
 * Keyboard Shortcuts Hook
 *
 * Provides keyboard shortcuts for common guide actions:
 * - ? = Show help
 * - Escape = Close inspector/return to main view
 * - r = Run analysis (when ready)
 * - c = Clear selection
 */

import { useEffect, useState } from 'react'
import { useGuideStore } from './useGuideStore'
import { useResultsRun } from '@/canvas/hooks/useResultsRun'
import { useCanvasStore } from '@/canvas/store'
import { findBlockers } from '../utils/journeyDetection'

export function useKeyboardShortcuts() {
  const [showHelp, setShowHelp] = useState(false)
  const selectElement = useGuideStore((state) => state.selectElement)
  const selectedElement = useGuideStore((state) => state.selectedElement)
  const journeyStage = useGuideStore((state) => state.journeyStage)
  const nodes = useCanvasStore((state) => state.nodes)
  const edges = useCanvasStore((state) => state.edges)
  const outcomeNodeId = useCanvasStore((state) => state.outcomeNodeId)
  const { run } = useResultsRun()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger if user is typing in an input
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return
      }

      switch (e.key) {
        case '?':
          e.preventDefault()
          setShowHelp((prev) => !prev)
          break

        case 'Escape':
          e.preventDefault()
          if (selectedElement) {
            selectElement(null)
          } else if (showHelp) {
            setShowHelp(false)
          }
          break

        case 'r':
        case 'R':
          e.preventDefault()
          // Only run if ready
          const blockers = findBlockers({ nodes, edges })
          if (blockers.length === 0 && nodes.length > 0) {
            run({
              graph: {
                nodes: nodes.map((n) => ({ id: n.id, data: n.data })),
                edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target, data: e.data })),
              },
              outcome_node: outcomeNodeId || undefined,
              seed: 1337,
            })
          }
          break

        case 'c':
        case 'C':
          e.preventDefault()
          if (selectedElement) {
            selectElement(null)
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedElement, showHelp, nodes, edges, outcomeNodeId, selectElement, run])

  return {
    showHelp,
    setShowHelp,
  }
}

export const KEYBOARD_SHORTCUTS = [
  { key: '?', description: 'Show/hide keyboard shortcuts' },
  { key: 'Esc', description: 'Close inspector or help' },
  { key: 'R', description: 'Run analysis (when ready)' },
  { key: 'C', description: 'Clear selection' },
]

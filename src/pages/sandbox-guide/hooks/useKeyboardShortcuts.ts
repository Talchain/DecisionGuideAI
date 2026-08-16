/**
 * Keyboard Shortcuts Hook
 *
 * Provides keyboard shortcuts for common guide actions:
 * - ? = Show help
 * - Escape = Close inspector/return to main view
 * - c = Clear selection
 *
 * The 'r' run shortcut was removed with the direct browser->PLoT run path
 * (useResultsRun): analysis is orchestrated by CEE, not by this surface.
 */

import { useEffect, useState } from 'react'
import { useGuideStore } from './useGuideStore'

export function useKeyboardShortcuts() {
  const [showHelp, setShowHelp] = useState(false)
  const selectElement = useGuideStore((state) => state.selectElement)
  const selectedElement = useGuideStore((state) => state.selectedElement)

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
  }, [selectedElement, showHelp, selectElement])

  return {
    showHelp,
    setShowHelp,
  }
}

export const KEYBOARD_SHORTCUTS = [
  { key: '?', description: 'Show/hide keyboard shortcuts' },
  { key: 'Esc', description: 'Close inspector or help' },
  { key: 'C', description: 'Clear selection' },
]

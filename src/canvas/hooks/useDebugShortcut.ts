/**
 * useDebugShortcut Hook
 *
 * Phase 1A.5: Keyboard shortcut (Shift+D) to toggle debug controls visibility.
 * Stores state in localStorage for persistence across sessions.
 */

import { useEffect, useState } from 'react'

const DEBUG_VISIBILITY_KEY = 'ui.showDebugControls'

/**
 * Load debug visibility from localStorage
 */
function loadDebugVisibility(): boolean {
  if (typeof localStorage === 'undefined') return false

  try {
    const stored = localStorage.getItem(DEBUG_VISIBILITY_KEY)
    return stored === 'true'
  } catch {
    return false
  }
}

/**
 * Save debug visibility to localStorage
 */
function saveDebugVisibility(visible: boolean): void {
  if (typeof localStorage === 'undefined') return

  try {
    localStorage.setItem(DEBUG_VISIBILITY_KEY, String(visible))
  } catch {
    // Ignore storage errors
  }
}

/**
 * Hook for debug controls visibility with Shift+D toggle
 */
export function useDebugShortcut() {
  const [showDebug, setShowDebug] = useState<boolean>(loadDebugVisibility)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Shift+D to toggle debug controls
      if (event.shiftKey && event.key === 'D') {
        event.preventDefault()
        setShowDebug(prev => {
          const next = !prev
          saveDebugVisibility(next)
          return next
        })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return { showDebug, setShowDebug }
}

/**
 * useFirstTimeHints - Onboarding hints for first-time users
 *
 * Manages first-time hints for discoverability (e.g., edge editing).
 * Persists shown state to localStorage to avoid repeat hints.
 *
 * Part of P1.6: EdgeInspector Discoverability
 */

import { useState, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'olumi.firstTimeHints'

interface HintState {
  edgeEditShown: boolean
  guidanceTabShown: boolean
}

const DEFAULT_STATE: HintState = {
  edgeEditShown: false,
  guidanceTabShown: false,
}

/**
 * Load hint state from localStorage
 */
function loadHintState(): HintState {
  if (typeof localStorage === 'undefined') return DEFAULT_STATE
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return { ...DEFAULT_STATE, ...JSON.parse(stored) }
    }
  } catch {
    // Ignore parse errors
  }
  return DEFAULT_STATE
}

/**
 * Save hint state to localStorage
 */
function saveHintState(state: HintState): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // Ignore storage errors
  }
}

/**
 * Hook to manage first-time edge editing hint
 * Shows a pulse animation on the first edge after 3s delay
 */
export function useEdgeEditHint() {
  const [showHint, setShowHint] = useState(false)
  const [hintDismissed, setHintDismissed] = useState(() => loadHintState().edgeEditShown)

  // Show hint after 3s delay if not already dismissed
  useEffect(() => {
    if (hintDismissed) return

    const timer = setTimeout(() => {
      setShowHint(true)
    }, 3000)

    return () => clearTimeout(timer)
  }, [hintDismissed])

  // Auto-hide hint after 5s
  useEffect(() => {
    if (!showHint) return

    const timer = setTimeout(() => {
      setShowHint(false)
      dismissHint()
    }, 5000)

    return () => clearTimeout(timer)
  }, [showHint])

  const dismissHint = useCallback(() => {
    setShowHint(false)
    setHintDismissed(true)
    const state = loadHintState()
    saveHintState({ ...state, edgeEditShown: true })
  }, [])

  return {
    showHint: showHint && !hintDismissed,
    dismissHint,
    hintDismissed,
  }
}

/**
 * Hook to check if guidance tab hint should be shown
 */
export function useGuidanceTabHint() {
  const [hintDismissed, setHintDismissed] = useState(() => loadHintState().guidanceTabShown)

  const dismissHint = useCallback(() => {
    setHintDismissed(true)
    const state = loadHintState()
    saveHintState({ ...state, guidanceTabShown: true })
  }, [])

  return {
    showHint: !hintDismissed,
    dismissHint,
  }
}

/**
 * Reset all hints (for testing/dev)
 */
export function resetAllHints(): void {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(STORAGE_KEY)
}

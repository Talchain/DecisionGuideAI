/**
 * Visual Diff Hook
 *
 * Manages visual diff state and keyboard shortcuts.
 *
 * Features:
 * - D key to toggle diff overlay
 * - Load snapshot for comparison
 * - Clear comparison
 *
 * Usage:
 * const { isDiffEnabled, setDiffEnabled, compareSnapshot, clearComparison, diffSnapshot } = useVisualDiff()
 */

import { useState, useEffect, useCallback } from 'react'
import type { Snapshot } from './snapshots'
import { getSnapshot } from './snapshots'

export interface VisualDiffState {
  /** Whether diff overlay is enabled */
  isDiffEnabled: boolean

  /** Snapshot being compared (ghost overlay) */
  diffSnapshot: Snapshot | null

  /** Toggle diff overlay on/off */
  setDiffEnabled: (enabled: boolean) => void

  /** Load snapshot for comparison */
  compareSnapshot: (snapshotId: string) => void

  /** Clear comparison */
  clearComparison: () => void
}

export function useVisualDiff(): VisualDiffState {
  const [isDiffEnabled, setIsDiffEnabled] = useState(false)
  const [diffSnapshot, setDiffSnapshot] = useState<Snapshot | null>(null)

  // Load snapshot for comparison
  const compareSnapshot = useCallback((snapshotId: string) => {
    const snapshot = getSnapshot(snapshotId)
    if (snapshot) {
      setDiffSnapshot(snapshot)
      setIsDiffEnabled(true)
    }
  }, [])

  // Clear comparison
  const clearComparison = useCallback(() => {
    setDiffSnapshot(null)
    setIsDiffEnabled(false)
  }, [])

  // Keyboard shortcut: D to toggle
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return
      }

      // D key toggles diff overlay (only if a snapshot is loaded)
      if (e.key === 'd' || e.key === 'D') {
        if (diffSnapshot) {
          e.preventDefault()
          setIsDiffEnabled(prev => !prev)
        }
      }

      // Escape key clears comparison
      if (e.key === 'Escape' && diffSnapshot) {
        e.preventDefault()
        clearComparison()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [diffSnapshot, clearComparison])

  return {
    isDiffEnabled,
    diffSnapshot,
    setDiffEnabled,
    compareSnapshot,
    clearComparison,
  }
}

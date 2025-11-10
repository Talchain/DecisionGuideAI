/**
 * Edge Label Mode Store (P1 Polish - Task D)
 *
 * Manages edge label display mode with:
 * - Persistent storage (localStorage)
 * - Cross-tab synchronisation
 * - Type-safe Zustand store
 *
 * Modes:
 * - 'human': "Strong boost", "Moderate drag (uncertain)"
 * - 'numeric': "w 0.60 • b 85%"
 */

import { create } from 'zustand'
import type { EdgeLabelMode } from '../domain/edgeLabels'

const STORAGE_KEY = 'canvas.edge-labels-mode'

interface EdgeLabelModeState {
  mode: EdgeLabelMode
  setMode: (mode: EdgeLabelMode) => void
}

/**
 * Safe localStorage read with SSR/test fallback
 */
function getStoredMode(): EdgeLabelMode {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return 'human'
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'numeric') return 'numeric'
    return 'human'
  } catch {
    return 'human'
  }
}

/**
 * Safe localStorage write
 */
function setStoredMode(mode: EdgeLabelMode): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return
  }

  try {
    localStorage.setItem(STORAGE_KEY, mode)
  } catch {
    // Fail silently if storage is unavailable
  }
}

/**
 * Zustand store for edge label mode
 * Persists to localStorage and syncs across tabs
 */
export const useEdgeLabelMode = create<EdgeLabelModeState>((set) => ({
  mode: getStoredMode(),
  setMode: (mode) => {
    set({ mode })
    setStoredMode(mode)
  },
}))

/**
 * Hook to synchronise store with storage events (cross-tab)
 * Call once at app root
 */
export function useEdgeLabelModeSync() {
  if (typeof window === 'undefined') return

  const handleStorageChange = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) {
      const newMode = getStoredMode()
      useEdgeLabelMode.setState({ mode: newMode })
    }
  }

  window.addEventListener('storage', handleStorageChange)

  return () => {
    window.removeEventListener('storage', handleStorageChange)
  }
}

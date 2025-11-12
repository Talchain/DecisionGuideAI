/**
 * Limits Store (M1.2)
 * Manages engine limits from PLoT service
 */

import { create } from 'zustand'
import type { V1LimitsResponse } from '../adapters/plot/v1/types'
import { fetchLimits } from '../adapters/plot/v1/limits'

interface LimitsState {
  limits: V1LimitsResponse | null
  loading: boolean
  error: string | null
  lastFetch: number | null

  // Actions
  loadLimits: () => Promise<void>
  clearError: () => void
}

export const useLimitsStore = create<LimitsState>((set, get) => ({
  limits: null,
  loading: false,
  error: null,
  lastFetch: null,

  loadLimits: async () => {
    // Skip if already loading
    if (get().loading) return

    set({ loading: true, error: null })

    try {
      const limits = await fetchLimits()
      set({ limits, loading: false, lastFetch: Date.now() })
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load limits',
      })
    }
  },

  clearError: () => set({ error: null }),
}))

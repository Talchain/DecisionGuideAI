/**
 * Session ledger for panel signals. Session-local, never persisted — a
 * resolved signal renders as a quiet confirmation rather than vanishing,
 * but only within the session that saw it (matches draftCoaching semantics).
 * Reset on scenario change/reset via usePreAnalysisModel.
 */

import { create } from 'zustand'
import type { PanelSignalId } from '../types'

export interface SeenEntry {
  firstSeenAt: number
}

interface SignalSessionState {
  seen: Partial<Record<PanelSignalId, SeenEntry>>
  /** The scenario the ledger belongs to (module-level state outlives mounts). */
  scenarioId: string | null
  markSeen: (ids: ReadonlyArray<PanelSignalId>, at: number) => void
  /**
   * Bind the ledger to a scenario: a mismatch clears it. Handles scenario
   * switches that happen while the panel is unmounted — without this, a
   * previous scenario's entries would fabricate quiet confirmations in a
   * scenario that never showed those signals.
   */
  ensureScenario: (scenarioId: string | null) => void
  reset: () => void
}

export const useSignalSessionStore = create<SignalSessionState>(set => ({
  seen: {},
  scenarioId: null,
  markSeen: (ids, at) =>
    set(state => {
      const unseen = ids.filter(id => !state.seen[id])
      if (unseen.length === 0) return state
      const next = { ...state.seen }
      for (const id of unseen) next[id] = { firstSeenAt: at }
      return { seen: next }
    }),
  ensureScenario: scenarioId =>
    set(state =>
      state.scenarioId === scenarioId ? state : { scenarioId, seen: {} },
    ),
  reset: () => set({ seen: {}, scenarioId: null }),
}))

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
  markSeen: (ids: ReadonlyArray<PanelSignalId>, at: number) => void
  reset: () => void
}

export const useSignalSessionStore = create<SignalSessionState>(set => ({
  seen: {},
  markSeen: (ids, at) =>
    set(state => {
      const unseen = ids.filter(id => !state.seen[id])
      if (unseen.length === 0) return state
      const next = { ...state.seen }
      for (const id of unseen) next[id] = { firstSeenAt: at }
      return { seen: next }
    }),
  reset: () => set({ seen: {} }),
}))

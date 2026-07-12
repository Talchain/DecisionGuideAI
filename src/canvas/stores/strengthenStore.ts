/**
 * strengthenStore — Wave 3a recommendation lifecycle (brief §8.5, §8.9).
 *
 * RED-phase inert stub: compiles with the full API surface; the GREEN
 * implementation follows __tests__/strengthenStore.spec.ts.
 */
import { create } from 'zustand'
import type { Recommendation, RecStatus } from '../../components/results/strengthen/strengthenTypes'

export interface RecHistoryEvent {
  at: number
  event: 'recommended' | 'in_progress' | 'addressed' | 'dismissed' | 'reopened' | 'auto_addressed'
  whatChanged?: string
  reopenReason?: string
}

export interface RecRecord {
  id: string
  status: RecStatus
  /** Display snapshot captured at generation — renders even when the live
   * source is gone (visible-but-stale, plan §3 Wave 3a). */
  snapshot: Recommendation
  /** The completed analysis this snapshot is grounded in. */
  analysisHash: string | null
  /** True when the model changed after this snapshot (label, never hide). */
  isStale: boolean
  history: RecHistoryEvent[]
}

export interface StrengthenState {
  records: Record<string, RecRecord>
  priorityOrder: string[]
  /** Reconcile-by-id on a COMPLETED analysis — never wholesale replace. */
  reconcile: (recs: Recommendation[], analysisHash: string, now?: number) => void
  /** The model changed since the last completed analysis — label, never evict. */
  markAllStale: () => void
  markInProgress: (id: string, now?: number) => void
  markAddressed: (id: string, whatChanged?: string, now?: number) => void
  dismiss: (id: string, now?: number) => void
  /** Test/reset seam. */
  _reset: () => void
}

export const useStrengthenStore = create<StrengthenState>(() => ({
  records: {},
  priorityOrder: [],
  reconcile: () => {},
  markAllStale: () => {},
  markInProgress: () => {},
  markAddressed: () => {},
  dismiss: () => {},
  _reset: () => {},
}))

/** Active list: gate-passing, not yet addressed/dismissed, in priority order. */
export function selectActive(state: StrengthenState): RecRecord[] {
  return state.priorityOrder
    .map((id) => state.records[id])
    .filter((r): r is RecRecord => r != null && (r.status === 'recommended' || r.status === 'in_progress' || r.status === 'reopened'))
}

/** History: addressed or dismissed, most recent event first. */
export function selectHistory(state: StrengthenState): RecRecord[] {
  return Object.values(state.records)
    .filter((r) => r.status === 'addressed' || r.status === 'dismissed')
    .sort((a, b) => (b.history[b.history.length - 1]?.at ?? 0) - (a.history[a.history.length - 1]?.at ?? 0))
}

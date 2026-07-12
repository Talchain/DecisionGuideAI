/**
 * strengthenStore — Wave 3a recommendation lifecycle (brief §8.5, §8.9;
 * plan §3 visible-but-stale ownership).
 *
 * Reconcile-by-id, NEVER wholesale replace:
 * - new ids insert as 'recommended';
 * - existing ids refresh their snapshot + grounding hash and clear the stale
 *   label, but PRESERVE status and history — a new analysis response never
 *   resets progress;
 * - 'addressed'/'dismissed' ids whose trigger fires again under a NEW
 *   analysis hash become 'reopened' with a recorded reason (the model
 *   changed); the SAME hash never nags;
 * - 'in_progress'/'reopened' ids whose trigger stops firing are auto-
 *   addressed with an explanation (the model change resolved them);
 * - 'recommended' ids that stop firing drop from the active list, but the
 *   record is retained — nothing is silently deleted.
 *
 * Visible-but-stale: between completed analyses (graph edited, upstream
 * guidance evicted fail-stale), records keep rendering from their SNAPSHOT;
 * markAllStale labels them ('from your last completed analysis') instead of
 * evicting — this store deliberately owns that override (plan §3).
 *
 * Persistence: sessionStorage (survives reloads, dies with the session —
 * matching the unpersisted scenario identity's scope). Manual, version-keyed.
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

const STORAGE_KEY = 'strengthen.lifecycle.v1'

function loadPersisted(): Pick<StrengthenState, 'records' | 'priorityOrder'> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return { records: {}, priorityOrder: [] }
    const parsed = JSON.parse(raw)
    if (parsed?.version !== 1) return { records: {}, priorityOrder: [] }
    return {
      records: parsed.records ?? {},
      priorityOrder: parsed.priorityOrder ?? [],
    }
  } catch {
    return { records: {}, priorityOrder: [] }
  }
}

function persist(records: Record<string, RecRecord>, priorityOrder: string[]): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, records, priorityOrder }))
  } catch {
    // sessionStorage unavailable — lifecycle degrades to in-memory only.
  }
}

export const useStrengthenStore = create<StrengthenState>((set, get) => ({
  ...loadPersisted(),

  reconcile: (recs, analysisHash, now = Date.now()) => {
    const records = { ...get().records }
    const firingIds = new Set(recs.map((r) => r.id))

    for (const rec of recs) {
      const existing = records[rec.id]
      if (!existing) {
        records[rec.id] = {
          id: rec.id,
          status: 'recommended',
          snapshot: rec,
          analysisHash,
          isStale: false,
          history: [{ at: now, event: 'recommended' }],
        }
        continue
      }
      const hashChanged = existing.analysisHash !== analysisHash
      let status: RecStatus = existing.status
      const history = [...existing.history]
      if ((existing.status === 'addressed' || existing.status === 'dismissed') && hashChanged) {
        // §8.5: a later graph/brief change may reopen an item — explain why.
        status = 'reopened'
        history.push({
          at: now,
          event: 'reopened',
          reopenReason: 'the signal returned after the model changed',
        })
      }
      records[rec.id] = {
        ...existing,
        status,
        snapshot: rec, // re-grounded display copy
        analysisHash,
        isStale: false,
        history,
      }
    }

    // Ids that no longer fire in THIS completed analysis.
    for (const record of Object.values(records)) {
      if (firingIds.has(record.id)) continue
      if (record.analysisHash === analysisHash) continue // already handled above
      if (record.status === 'in_progress' || record.status === 'reopened') {
        records[record.id] = {
          ...record,
          status: 'addressed',
          isStale: false,
          history: [
            ...record.history,
            { at: now, event: 'auto_addressed', whatChanged: 'resolved by a model change' },
          ],
        }
      }
      // 'recommended' records simply leave the active order (retained below);
      // addressed/dismissed history is untouched.
    }

    const priorityOrder = [...recs].sort((a, b) => a.priority - b.priority).map((r) => r.id)
    persist(records, priorityOrder)
    set({ records, priorityOrder })
  },

  markAllStale: () => {
    const records = { ...get().records }
    for (const id of Object.keys(records)) {
      records[id] = { ...records[id], isStale: true }
    }
    persist(records, get().priorityOrder)
    set({ records })
  },

  markInProgress: (id, now = Date.now()) => {
    const record = get().records[id]
    if (!record) return
    const records = {
      ...get().records,
      [id]: {
        ...record,
        status: 'in_progress' as RecStatus,
        history: [...record.history, { at: now, event: 'in_progress' as const }],
      },
    }
    persist(records, get().priorityOrder)
    set({ records })
  },

  markAddressed: (id, whatChanged, now = Date.now()) => {
    const record = get().records[id]
    if (!record) return
    const records = {
      ...get().records,
      [id]: {
        ...record,
        status: 'addressed' as RecStatus,
        history: [...record.history, { at: now, event: 'addressed' as const, whatChanged }],
      },
    }
    persist(records, get().priorityOrder)
    set({ records })
  },

  dismiss: (id, now = Date.now()) => {
    const record = get().records[id]
    if (!record) return
    const records = {
      ...get().records,
      [id]: {
        ...record,
        status: 'dismissed' as RecStatus,
        history: [...record.history, { at: now, event: 'dismissed' as const }],
      },
    }
    persist(records, get().priorityOrder)
    set({ records })
  },

  _reset: () => {
    try { sessionStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
    set({ records: {}, priorityOrder: [] })
  },
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

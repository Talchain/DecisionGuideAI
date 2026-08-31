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
  event: 'recommended' | 'in_progress' | 'addressed' | 'dismissed' | 'reopened' | 'auto_addressed' | 'restored' | 'disputed'
  whatChanged?: string
  reopenReason?: string
  /** The user's own words on why they disagree. Only on a 'disputed' event. */
  disputeReason?: string
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
  /** Undo affordance for 'Not relevant': restores a dismissed record to the
   * active status it held before dismissal. No-op unless status is dismissed. */
  restoreDismissed: (id: string, now?: number) => void
  /**
   * ⭐⭐ CREATE A RECORD FOR A FINDING THE USER IS ABOUT TO ACT ON.
   *
   * WHY THIS EXISTS, measured on the deployed build `fdeb08d2`: `reconcile` is
   * called from exactly ONE place — `StrengthenContainer`, which mounts only on
   * the OLD Analysis tab. Analysis (New) runs the same engine but is
   * deliberately READ-ONLY, because a surface that writes on mount would make
   * the two tabs an A/B test on different data rather than a presentation
   * comparison. That constraint is correct and is preserved.
   *
   * The consequence was not: a live run rendered SIX findings while the store
   * held FOUR, from the previous run viewed on the other tab. Every control
   * gated on "does the store hold this id" — dismiss, and now disagree — was
   * therefore present on some cards and absent on others, for a reason
   * invisible to the reader. An affordance that appears at random is worse than
   * one that is simply missing.
   *
   * ⚠ THE LINE THIS DOES NOT CROSS. It writes on a DELIBERATE USER ACTION and
   * never on mount, so visiting the tab still changes nothing. `reconcile`
   * remains the single owner of bulk lifecycle state; this only ensures the row
   * the user just acted on exists to be acted upon.
   *
   * No-op when a record is already held — it must never overwrite lifecycle
   * state that `reconcile` owns.
   */
  seedIfAbsent: (rec: Recommendation, analysisHash: string | null, now?: number) => void
  /**
   * ⭐⭐ THE USER DISAGREES, AND SAYS WHY. Deliberately NOT A STATUS.
   *
   * A dispute is an ACT, not a terminal state: the finding stays exactly as
   * active as it was, and can still be worked through or set aside afterwards.
   * Modelling it as a `RecStatus` would have dropped the record out of
   * `selectActive` — whose filter is an explicit triple — so disagreeing would
   * have made the card VANISH, which is the precise failure this exists to
   * fix. The product's only answer to "I think this is wrong" was "Not
   * relevant", i.e. deletion: a reasoning act converted into a disappearance,
   * unrecorded.
   *
   * An empty or whitespace-only reason is a no-op. A recorded disagreement
   * with no stated ground is the same silence in a different costume.
   */
  dispute: (id: string, reason: string, now?: number) => void
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

  seedIfAbsent: (rec, analysisHash, now = Date.now()) => {
    if (get().records[rec.id]) return
    const records = {
      ...get().records,
      // ⚠ SHAPED EXACTLY AS `reconcile`'s INSERT PATH. Two ways of minting the
      // same record is how the two diverge (trap 12); if that shape changes,
      // this must change with it.
      [rec.id]: {
        id: rec.id,
        status: 'recommended' as RecStatus,
        snapshot: rec,
        analysisHash,
        isStale: false,
        history: [{ at: now, event: 'recommended' as const }],
      },
    }
    // Appended, never inserted: `priorityOrder` is the ENGINE's ordering and
    // this row's rank is not ours to assert. `selectActive` reads that order,
    // so a guess here would silently re-rank the other surface's panel.
    persist(records, [...get().priorityOrder, rec.id])
    set({ records, priorityOrder: [...get().priorityOrder, rec.id] })
  },

  dispute: (id, reason, now = Date.now()) => {
    const record = get().records[id]
    if (!record) return
    const trimmed = reason.trim()
    if (!trimmed) return
    const records = {
      ...get().records,
      // ⚠ `status` IS UNTOUCHED, ON PURPOSE. See the note on the declaration.
      [id]: {
        ...record,
        history: [...record.history, { at: now, event: 'disputed' as const, disputeReason: trimmed }],
      },
    }
    persist(records, get().priorityOrder)
    set({ records })
  },

  restoreDismissed: (id, now = Date.now()) => {
    const record = get().records[id]
    if (!record || record.status !== 'dismissed') return
    // Restore the ACTIVE status held before dismissal (scan history backwards
    // for the last active-status event — 'restored' markers are transparent
    // because they carry no status of their own); default to 'recommended'.
    let previous: RecStatus = 'recommended'
    for (let i = record.history.length - 1; i >= 0; i--) {
      const e = record.history[i].event
      if (e === 'in_progress') { previous = 'in_progress'; break }
      if (e === 'reopened') { previous = 'reopened'; break }
      if (e === 'recommended') { previous = 'recommended'; break }
    }
    const records = {
      ...get().records,
      [id]: {
        ...record,
        status: previous,
        history: [...record.history, { at: now, event: 'restored' as const, whatChanged: 'dismiss undone' }],
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
export function selectActive(state: Pick<StrengthenState, 'records' | 'priorityOrder'>): RecRecord[] {
  return state.priorityOrder
    .map((id) => state.records[id])
    .filter((r): r is RecRecord => r != null && (r.status === 'recommended' || r.status === 'in_progress' || r.status === 'reopened'))
}

/** History: addressed or dismissed, most recent event first. */
export function selectHistory(state: Pick<StrengthenState, 'records' | 'priorityOrder'>): RecRecord[] {
  return Object.values(state.records)
    .filter((r) => r.status === 'addressed' || r.status === 'dismissed')
    .sort((a, b) => (b.history[b.history.length - 1]?.at ?? 0) - (a.history[a.history.length - 1]?.at ?? 0))
}

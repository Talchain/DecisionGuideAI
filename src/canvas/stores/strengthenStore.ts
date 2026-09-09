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
  /**
   * ⭐⭐ THE DECISION THIS RECORD WAS AUTHORED UNDER. `null` when the identity
   * was unavailable at mint time, which is an HONEST UNKNOWN and is treated as
   * unattributable rather than as "belongs to whatever is open now".
   *
   * Stamped at mint and NEVER re-stamped. It answers *which decision was this
   * reasoning act about?*, not *which decision is open?* — re-stamping on a
   * later write would launder a record into the decision that happened to be
   * on screen, which is precisely the harm. (`guidanceStore`'s `minting` note
   * records the same distinction, learned there the expensive way.)
   */
  scenarioId?: string | null
  history: RecHistoryEvent[]
}

export interface StrengthenState {
  records: Record<string, RecRecord>
  priorityOrder: string[]
  /** Reconcile-by-id on a COMPLETED analysis — never wholesale replace. */
  reconcile: (
    recs: Recommendation[],
    analysisHash: string,
    /** The decision these findings are about. `null` = unattributable. */
    scenarioId: string | null,
    now?: number,
  ) => void
  /**
   * The model changed since the last completed analysis — label, never evict.
   *
   * ⚠ SCOPED TO ONE DECISION. It labelled EVERY record in the store, so editing
   * the graph on decision B marked decision A's findings "from your last
   * completed analysis" — a claim about an analysis that had not moved. Same
   * root cause as the key: one store, many decisions, no identity in the write.
   */
  markAllStale: (scenarioId: string | null) => void
  /**
   * ⭐⭐ EVERY MUTATOR NAMES THE DECISION IT ACTS UNDER, AND IT IS REQUIRED.
   *
   * These took a bare finding id, which does not address a record any more —
   * two decisions can hold the same finding. Passing the decision is not
   * defensive plumbing: it is the difference between "set THIS finding aside on
   * THIS decision" and "set aside whatever record happens to own that id".
   *
   * ⚠ REQUIRED, NEVER DEFAULTED TO WHAT IS OPEN. A store-side lookup of the
   * current decision would put the identity back where the caller cannot see
   * it, and an act filed under the wrong decision is exactly the harm.
   *
   * ⚠⚠ AND IT IS A BRANDED KEY RATHER THAN TWO ARGUMENTS, BECAUSE TWO
   * ARGUMENTS DID NOT ACTUALLY ENFORCE ANYTHING. The first version of this
   * repair used `(scenarioId: string | null, id: string, …)`. Both are strings,
   * so an un-migrated call site — `markAddressed('strengthen:commit',
   * 'decision recorded')` — TYPECHECKS PERFECTLY while filing the act under a
   * decision named after a finding. A silent, plausible, wrong write: precisely
   * the defect class being repaired, re-entered through the repair.
   *
   * `RecordKey` is a nominal type that only `recordKey()` can produce, so a
   * bare string is a compile error and every call site must NAME the decision
   * it is acting under. The type system now enforces what the comment asks for.
   */
  markInProgress: (key: RecordKey, now?: number) => void
  markAddressed: (key: RecordKey, whatChanged?: string, now?: number) => void
  dismiss: (key: RecordKey, now?: number) => void
  /** Undo affordance for 'Not relevant': restores a dismissed record to the
   * active status it held before dismissal. No-op unless status is dismissed. */
  restoreDismissed: (key: RecordKey, now?: number) => void
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
  seedIfAbsent: (
    rec: Recommendation,
    analysisHash: string | null,
    /** The decision this finding is about. `null` = unattributable. */
    scenarioId: string | null,
    now?: number,
  ) => void
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
  dispute: (key: RecordKey, reason: string, now?: number) => void
  /** Test/reset seam. */
  _reset: () => void
}

const STORAGE_KEY = 'strengthen.lifecycle.v1'

/**
 * ⭐⭐ THE STORAGE KEY IS (DECISION, FINDING) — NOT THE FINDING ALONE.
 *
 * ⚠⚠ THIS IS THE REPAIR FOR A REGRESSION THE FIRST VERSION OF THIS FIX SHIPPED,
 * confirmed by execution in two independent seats before it merged.
 *
 * Stamping `scenarioId` on the record and filtering READS by it looked like
 * enough. It is not, because the records were still keyed by `rec.id` ALONE,
 * and a finding id is not unique across decisions — `strengthen:robustness`
 * means "this model is fragile" and two different decisions can both be
 * fragile. So:
 *
 *   reconcile([strengthen:robustness], 'hash-a', DECISION_A)  // A mints it
 *   seedIfAbsent(strengthen:robustness, 'hash-b', DECISION_B) // NO-OPS: id taken
 *   dismiss(strengthen:robustness)                            // files under A
 *   selectHistory(DECISION_B)  →  []      ← the act B performed is invisible
 *
 * B's own reasoning act lands in A's trail and vanishes from B's. The
 * status-only filter showed a FALSE trail; a reader-side scenario filter on a
 * SHARED key removes the false attribution and the true one together. **A
 * reader cannot isolate what the key conflated** — the record for B was never
 * created, so there is nothing for any filter to find.
 *
 * The key therefore carries the identity. `JSON.stringify` of a pair is used
 * rather than a delimiter string because a decision id is opaque: any separator
 * character could in principle occur inside one, and a key collision here
 * re-creates the exact defect being fixed. An array encoding cannot collide.
 *
 * ⚠ `null` IS A REAL BUCKET, NOT AN ERROR. A record minted when the identity
 * was unavailable is UNATTRIBUTABLE — it keys under `null`, is never claimed by
 * any decision's trail, and is never deleted.
 */
export type RecordKey = string & { readonly __recordKey: unique symbol }

export function recordKey(scenarioId: string | null | undefined, recId: string): RecordKey {
  return JSON.stringify([scenarioId ?? null, recId]) as RecordKey
}

/**
 * The decision a storage key names, or `undefined` for a key this function
 * cannot read.
 *
 * ⚠ PARSED, NOT SLICED. The first draft compared string prefixes with an offset
 * arithmetic derived from `JSON.stringify([id, ''])`. It was correct and it was
 * the kind of cleverness that becomes the next defect: nothing about the
 * expression says what it means, and any change to the key encoding silently
 * turns it into a filter that matches the wrong records rather than none.
 *
 * ⚠ `undefined` FOR AN UNREADABLE KEY, NEVER `null`. `null` is a REAL decision
 * bucket here — the unattributable one — so returning it for a malformed key
 * would file unreadable records into a bucket that legitimately renders.
 */
export function decisionOfKey(key: string): string | null | undefined {
  try {
    const parsed = JSON.parse(key)
    return Array.isArray(parsed) && parsed.length === 2 ? (parsed[0] as string | null) : undefined
  } catch {
    return undefined
  }
}

/**
 * ⭐⭐ THE DECISION IDENTITY IS PASSED IN, NOT LOOKED UP — and the first draft
 * of this fix got that wrong in a way worth recording.
 *
 * `guidanceStore` states the hazard this closes in as many words: *"an
 * unidentified blob could be adopted by the wrong decision, and a silent write
 * with a wrong key is worse than no persistence at all."* This store wrote
 * exactly such a blob — one fixed `sessionStorage` key, no decision stamp
 * anywhere — and its history selector filtered on STATUS ALONE. So within one
 * session, opening a second decision showed the findings retired on the FIRST
 * one as that decision's own reasoning trail. Nothing in product code has ever
 * cleared the key: `_reset` is its only remover and every caller is a spec.
 *
 * ⚠ THE FIRST DRAFT COPIED THE SIBLING'S *MECHANISM* — a provider installed on
 * the canvas boot path — AND THAT WAS THE WRONG SHAPE HERE. It made the stamp
 * depend on a mount ordering this store cannot see: with no provider installed
 * every record mints unattributed, and an unattributed record is shown NOWHERE,
 * so a boot-order change would silently empty the whole trail. Nine specs went
 * red on exactly that, which is the failure mode arriving as a warning rather
 * than as a defect. Both callers already hold the identity — the panel
 * subscribes to it and compares against it three lines away — so it is a
 * PARAMETER. Fewer moving parts, and it cannot be absent without the call site
 * saying so.
 */

function loadPersisted(): Pick<StrengthenState, 'records' | 'priorityOrder'> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return { records: {}, priorityOrder: [] }
    const parsed = JSON.parse(raw)
    if (parsed?.version !== 1) return { records: {}, priorityOrder: [] }
    return migrateLegacyKeys(parsed.records ?? {}, parsed.priorityOrder ?? [])
  } catch {
    return { records: {}, priorityOrder: [] }
  }
}

/**
 * ⭐ RECORDS WRITTEN BEFORE THE KEY CARRIED THE DECISION ARE RE-KEYED, NOT
 * DROPPED — and re-keyed from THEIR OWN STAMP, never from what is open now.
 *
 * A live session upgrading mid-flight holds records under bare finding ids.
 * Discarding them would delete a reader's own reasoning trail on a deploy; and
 * adopting them into the current decision is the laundering this whole fix
 * exists to refuse. So each legacy record moves to the key its own
 * `scenarioId` names — which for a record minted before the stamp existed is
 * `null`, i.e. the unattributable bucket. Honest, and lossless.
 *
 * ⚠ A LEGACY KEY IS IDENTIFIED BY SHAPE, NOT BY A VERSION BUMP. The persisted
 * `version` stays 1 deliberately: bumping it would make every existing session
 * fall through `loadPersisted`'s version guard and lose the trail outright,
 * which is the harm this function exists to prevent. A composite key parses as
 * a two-element JSON array; a legacy key does not.
 */
export function migrateLegacyKeys(
  records: Record<string, RecRecord>,
  priorityOrder: string[],
): Pick<StrengthenState, 'records' | 'priorityOrder'> {
  const isComposite = (k: string): boolean => {
    try {
      const parsed = JSON.parse(k)
      return Array.isArray(parsed) && parsed.length === 2
    } catch {
      return false
    }
  }
  const remap = new Map<string, string>()
  const next: Record<string, RecRecord> = {}
  for (const [key, record] of Object.entries(records)) {
    if (record == null) continue
    if (isComposite(key)) {
      next[key] = record
      continue
    }
    const moved = recordKey(record.scenarioId ?? null, record.id ?? key)
    remap.set(key, moved)
    // ⚠ FIRST WRITER WINS. Two legacy records cannot share a key unless they
    // already shared a finding id AND a decision, in which case they were the
    // same record; but a defensive check keeps the migration total.
    if (!(moved in next)) next[moved] = record
  }
  return {
    records: next,
    priorityOrder: priorityOrder.map((k) => remap.get(k) ?? k),
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

  reconcile: (recs, analysisHash, scenarioId, now = Date.now()) => {
    const records = { ...get().records }
    const firingIds = new Set(recs.map((r) => r.id))

    for (const rec of recs) {
      const key = recordKey(scenarioId, rec.id)
      const existing = records[key]
      if (!existing) {
        records[key] = {
          id: rec.id,
          status: 'recommended',
          snapshot: rec,
          analysisHash,
          isStale: false,
          scenarioId,
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
      records[recordKey(scenarioId, rec.id)] = {
        ...existing,
        status,
        snapshot: rec, // re-grounded display copy
        analysisHash,
        isStale: false,
        history,
      }
    }

    /* Ids that no longer fire in THIS completed analysis.
       ⚠⚠ SCOPED TO THIS DECISION, AND THE COMPOSITE KEY IS WHAT MADE THAT
       VISIBLE. This swept EVERY record in the store, so completing an analysis
       on decision B auto-addressed decision A's in-progress findings — writing
       "resolved by a model change" into a trail about a model that had not
       changed. It was invisible while one shared key made the store look like
       one decision's worth of state; naming the decision in the key makes the
       unscoped sweep obvious. A latent second harm of the same root cause, so
       it is repaired in the same change rather than left to be found. */
    for (const [key, record] of Object.entries(records)) {
      if ((record.scenarioId ?? null) !== scenarioId) continue
      if (firingIds.has(record.id)) continue
      if (record.analysisHash === analysisHash) continue // already handled above
      if (record.status === 'in_progress' || record.status === 'reopened') {
        records[key] = {
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

    /* ⚠ KEYS, NOT IDS — `selectActive` reads records through this list, and a
       bare id no longer addresses a record. */
    const priorityOrder = [...recs]
      .sort((a, b) => a.priority - b.priority)
      .map((r) => recordKey(scenarioId, r.id))
    persist(records, priorityOrder)
    set({ records, priorityOrder })
  },

  markAllStale: (scenarioId) => {
    const records = { ...get().records }
    for (const [key, record] of Object.entries(records)) {
      if ((record.scenarioId ?? null) !== scenarioId) continue
      records[key] = { ...record, isStale: true }
    }
    persist(records, get().priorityOrder)
    set({ records })
  },

  markInProgress: (key, now = Date.now()) => {
    const record = get().records[key]
    if (!record) return
    const records = {
      ...get().records,
      [key]: {
        ...record,
        status: 'in_progress' as RecStatus,
        history: [...record.history, { at: now, event: 'in_progress' as const }],
      },
    }
    persist(records, get().priorityOrder)
    set({ records })
  },

  markAddressed: (key, whatChanged, now = Date.now()) => {
    const record = get().records[key]
    if (!record) return
    const records = {
      ...get().records,
      [key]: {
        ...record,
        status: 'addressed' as RecStatus,
        history: [...record.history, { at: now, event: 'addressed' as const, whatChanged }],
      },
    }
    persist(records, get().priorityOrder)
    set({ records })
  },

  dismiss: (key, now = Date.now()) => {
    const record = get().records[key]
    if (!record) return
    const records = {
      ...get().records,
      [key]: {
        ...record,
        status: 'dismissed' as RecStatus,
        history: [...record.history, { at: now, event: 'dismissed' as const }],
      },
    }
    persist(records, get().priorityOrder)
    set({ records })
  },

  seedIfAbsent: (rec, analysisHash, scenarioId, now = Date.now()) => {
    /* ⚠⚠ THE NO-OP IS NOW SCOPED, AND THAT WAS THE WHOLE REGRESSION. Keyed by
       the finding id alone, this returned early whenever ANY decision already
       held that id — so a user acting on the same finding under a second
       decision minted no record, and every act they then performed was filed
       against the FIRST decision's record. */
    const key = recordKey(scenarioId, rec.id)
    if (get().records[key]) return
    const records = {
      ...get().records,
      // ⚠ SHAPED EXACTLY AS `reconcile`'s INSERT PATH. Two ways of minting the
      // same record is how the two diverge (trap 12); if that shape changes,
      // this must change with it.
      [key]: {
        id: rec.id,
        status: 'recommended' as RecStatus,
        snapshot: rec,
        analysisHash,
        isStale: false,
        scenarioId,
        history: [{ at: now, event: 'recommended' as const }],
      },
    }
    // Appended, never inserted: `priorityOrder` is the ENGINE's ordering and
    // this row's rank is not ours to assert. `selectActive` reads that order,
    // so a guess here would silently re-rank the other surface's panel.
    const priorityOrder = [...get().priorityOrder, key]
    persist(records, priorityOrder)
    set({ records, priorityOrder })
  },

  dispute: (key, reason, now = Date.now()) => {
    const record = get().records[key]
    if (!record) return
    const trimmed = reason.trim()
    if (!trimmed) return
    const records = {
      ...get().records,
      // ⚠ `status` IS UNTOUCHED, ON PURPOSE. See the note on the declaration.
      [key]: {
        ...record,
        history: [...record.history, { at: now, event: 'disputed' as const, disputeReason: trimmed }],
      },
    }
    persist(records, get().priorityOrder)
    set({ records })
  },

  restoreDismissed: (key, now = Date.now()) => {
    const record = get().records[key]
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
      [key]: {
        ...record,
        status: previous,
        history: [...record.history, { at: now, event: 'restored' as const, whatChanged: 'dismiss undone' }],
      },
    }
    /**
     * ⚠⚠ THE ID MUST BE PUT BACK IN THE ORDER, OR RESTORING DELETES THE
     * FINDING FROM EVERY SURFACE.
     *
     * `reconcile` REBUILDS `priorityOrder` from the firing set alone, so a
     * record that stopped firing is dropped from it while its record survives.
     * `selectActive` maps over `priorityOrder` — so restoring such a record
     * makes it active-but-invisible there, and it simultaneously leaves
     * `selectHistory`, whose filter is dismissed|addressed. Active list: gone.
     * Trail: gone. Store: still there, reachable by nobody.
     *
     * Appended rather than inserted, for the reason `seedIfAbsent` gives: this
     * row's engine rank is not ours to assert.
     */
    const order = get().priorityOrder
    const priorityOrder = order.includes(key) ? order : [...order, key]
    persist(records, priorityOrder)
    set({ records, priorityOrder })
  },

  _reset: () => {
    try { sessionStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
    set({ records: {}, priorityOrder: [] })
  },
}))

/** Active list: gate-passing, not yet addressed/dismissed, in priority order. */
export function selectActive(state: Pick<StrengthenState, 'records' | 'priorityOrder'>): RecRecord[] {
  return state.priorityOrder
    // ⚠ `key`, not `id` — `priorityOrder` holds RECORD KEYS. The old parameter
    // name outlived the thing it named, which is how a bare id gets written
    // back in by someone reading this line for the idiom.
    .map((key) => state.records[key])
    .filter((r): r is RecRecord => r != null && (r.status === 'recommended' || r.status === 'in_progress' || r.status === 'reopened'))
}

/**
 * History: addressed or dismissed **on THIS decision**, most recent event first.
 *
 * ⭐⭐ THE SCENARIO ARGUMENT IS THE FIX, AND IT IS REQUIRED ON PURPOSE.
 *
 * This filtered on STATUS ALONE while the store persists under one fixed
 * session key that nothing in product code clears. So a reader who set two
 * findings aside on one decision and then opened another was shown those
 * findings as the NEW decision's reasoning trail — a record of thinking that
 * never happened about it. The worst part is not the noise: the trail is the
 * surface a reader trusts to say what they have already considered here.
 *
 * ⚠ FAIL CLOSED, IN BOTH DIRECTIONS. An unknown current decision (`null`) shows
 * NOTHING, and a record with no stamp is shown NOWHERE. Both are records this
 * function cannot attribute, and attributing them to whatever is open is the
 * defect itself. Nothing is deleted — an unattributable record stays in the
 * store and in storage; it is simply not claimed as this decision's history.
 *
 * ⚠ `selectActive` IS DELIBERATELY UNTOUCHED. It answers a different question —
 * *what is live now?* — and is read by the parked hero, which is out of scope.
 * Its records are re-grounded by `reconcile` against the current analysis, so
 * it does not carry the same staleness. Widening this fix into it would change
 * a surface this lane does not own (trap 21: name the questions apart).
 */
export function selectHistory(
  state: Pick<StrengthenState, 'records' | 'priorityOrder'>,
  scenarioId: string | null,
): RecRecord[] {
  if (scenarioId == null) return []
  /* ⚠ THE KEY ISOLATES; THE STAMP IS STILL CHECKED, AND THAT IS NOT BELT-AND-
     BRACES. They answer different questions: the KEY says where this record is
     filed, the STAMP says which decision the reasoning act was ABOUT. They
     agree by construction today because `recordKey` is fed the same value that
     is stamped — and a future write that filed a record under one decision
     while stamping another would be a defect this filter makes visible instead
     of serving. A record whose two answers disagree is claimed by neither. */
  return Object.entries(state.records)
    .filter(([key]) => decisionOfKey(key) === scenarioId)
    .map(([, r]) => r)
    .filter((r) => r.status === 'addressed' || r.status === 'dismissed')
    .filter((r) => r.scenarioId === scenarioId)
    .sort((a, b) => (b.history[b.history.length - 1]?.at ?? 0) - (a.history[a.history.length - 1]?.at ?? 0))
}

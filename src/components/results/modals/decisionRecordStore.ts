/**
 * decisionRecordStore — the decision record captured by the
 * Record-the-decision modal (prototype #decisionModal, build-ready v6).
 *
 * ⭐ HONESTY CONTRACT, REWRITTEN FOR CALIBRATION R0 — AND THE OLD ONE WAS
 * BECOMING FALSE IN THE OTHER DIRECTION. It used to read "NO backend
 * persistence exists — durable saving is blocked on identity + Model
 * Management". That is no longer true for a signed-in user: the chosen
 * option, the user's stated confidence, their expectation and the review date
 * now persist durably in CEE's `decision_records` under owner-only RLS. What
 * is STILL local-only is the set of fields the shared contract has no home
 * for — `rationale`, `assumptionToWatch` and a non-date `revisitTrigger`
 * (`DecisionRecordDecisionSchema`/`…PredictionSchema` are `.strict()`).
 *
 * So the split, exactly:
 *   DURABLE (signed in)  chosen option · confidence · expectation ·
 *                        review date · the analysed graph anchor
 *   THIS DEVICE ONLY     rationale · assumption to watch · the revisit
 *                        trigger TEXT (a trigger is not a date)
 *   GUESTS               everything stays local, by design — decision
 *                        records require sign-in (CEE refuses an unowned
 *                        scenario with DR001).
 *
 * A surface rendering a "Decision recorded" state must label which of those
 * it is showing; `DecisionRecord.remote` is how it can tell.
 *
 * ⭐⭐ PERSISTENCE IS `localStorage`, AND THAT IS A DELIBERATE DIVERGENCE FROM
 * ITS SIBLINGS. Superseded text: ~~Persistence mirrors strengthenStore: zustand
 * + manual, version-keyed sessionStorage, keyed per scenario id.~~ The shape
 * still mirrors strengthenStore — zustand + manual, version-keyed, keyed per
 * scenario id — but the STORE does not, because the two hold different kinds of
 * thing.
 *
 * `sessionStorage` is cleared when the tab closes. A decision record whose
 * whole purpose is to be read back on a LATER visit — "what did we decide, and
 * what were we watching for?" — cannot live in a store that empties between
 * visits. The guest half of the honesty split above ("everything stays local")
 * was, under sessionStorage, closer to "everything is discarded": the surface
 * offered to record a decision and then dropped it at the end of the session,
 * which is a worse failure than refusing to record one.
 *
 * ⚠ THE SCOPE CLAIM CHANGES WITH IT, AND SO DOES THE COPY. Under sessionStorage
 * the honest sentence was "this ends with the browser session"; under
 * localStorage it is "on this device" — and it must be exactly that, never
 * "saved" without qualification. `localStorage` is per browser profile: it does
 * not follow the user to another machine, another browser, or a private window.
 *
 * Durable records are now per scenario, scoped to the resolved account and a
 * revocable storage generation. Sign-out clears memory and disk; an old tab
 * cannot write into the next generation. Two anonymous guests in one browser
 * are still one identity — this does not invent guest authentication.
 * Acknowledgements have separate capture-specific keys, so a delayed response
 * cannot rewrite or confirm a newer capture. Different scenarios never share
 * a read/modify/write storage key. Ownerless v1 records are not migrated: their
 * owner cannot be established safely. They remain quarantined under their
 * original key until explicit auth cleanup, rather than being assigned to the
 * next account or silently erased by an ordinary reload.
 *
 * ⚠⚠ THE DURABLE HALF CANNOT BE READ BACK EITHER — BUT STATE THAT AT THE SCOPE
 * IT WAS DERIVED AT. What is measured is about THIS REPO: the only
 * `decision-records` path anywhere in `src/` is
 * `decisionRecordCommitService.ts:40`'s `/decision-records/commit`, a WRITE —
 * and the sweep is not blind, because the same sweep finds the sibling
 * `/bff/cee/*` route families. So the UI has no read path, and no surface here
 * can render an account-held record.
 *
 * ⚠ IT IS NOT A CLAIM THAT CEE HAS NO SUCH ENDPOINT. An earlier draft of this
 * paragraph said there is "no read/list endpoint on CEE"; that was not derived
 * and is WITHDRAWN. An unauthenticated probe cannot settle it —
 * `/decision-records/list` on `cee-staging` returns 401 and so does a
 * deliberately FABRICATED control route, so the auth gate sits in front of
 * routing and 401 proves nothing about registration (measured 7 Sep 2026).
 * The consequence for this store is identical either way, which is why the
 * narrower claim is the one worth having: CROSS-DEVICE READ-BACK IS NOT
 * AVAILABLE TO THIS UI, AND NO SURFACE MAY IMPLY IT IS.
 *
 * ⚠ THE SIBLING STORES ARE UNCHANGED. `successMeasureStore` stays on
 * sessionStorage; this file is not a template for it, and `scenarioKey.ts`'s
 * header records the divergence so the shared helper does not read as a claim
 * about both.
 *
 * ⚠ `analysisHash` IS NOT THE DURABLE RECORD'S ANCHOR AND MUST NEVER BE SENT
 * AS ONE. It is `results.hash`, annotated `// response_hash` in the canvas
 * store — PLoT's response hash, a different regime from the
 * `aag_v1:sha256:` analysis-affecting graph hash the record is anchored to.
 * CEE derives that anchor server-side from its OWN run_analysis fact. This
 * field stays for local "does the record still match what's on screen"
 * comparisons only.
 */
import { create } from 'zustand'
import { v5 as uuidv5 } from 'uuid'

import { resolveScenarioKey, UNSCOPED_SCENARIO_KEY } from './scenarioKey'

/**
 * Proof that this record reached CEE — the durable half. `null` while the
 * record is local-only (guest, offline, or a failed commit), so no surface
 * can claim "saved to your account" without the record id that says so.
 */
export interface DecisionRecordRemote {
  /** `decision_records.record_id` — the durable identity. */
  recordId: string
  /** ISO timestamptz stored on the record. */
  reviewDate: string
  /** Which rung of CEE's ladder set it — `user_set` means the user chose it. */
  reviewDateSource: 'user_set' | 'default_horizon' | 'default_horizon_after_unparsed_trigger'
}

export interface DecisionRecord {
  /** Canvas node id of the chosen option (from the analysed option set). */
  optionId: string
  /** Display label snapshot at capture time. */
  optionLabel: string
  /** Stable option number (optionNumbering) when the full set was numbered; null otherwise. */
  optionNumber: number | null
  /** 0-100 inclusive. Validated non-empty at capture (the prototype's Number('')===0 hole is closed). */
  confidence: number
  /**
   * The user's FORWARD-LOOKING claim — "What do you expect to happen?" — and
   * the only field the eventual outcome is scored against.
   *
   * ⚠ DELIBERATELY NOT `rationale`. A rationale is backward-looking
   * justification for the choice; scoring it as if it were a prediction would
   * be a semantic lie, and a calibration number built on it would be
   * meaningless. Optional on the type only because records persisted before
   * this field existed are still readable.
   */
  expectation?: string
  rationale: string
  assumptionToWatch: string
  /** Free text: a trigger condition or a date ("Revisit trigger or date"). */
  revisitTrigger: string
  /** results.hash of the completed analysis on screen at capture time, if any. */
  analysisHash: string | null
  savedAt: number
  /** Set once the record is durable in CEE; null while local-only. */
  remote?: DecisionRecordRemote | null
}

export interface DecisionRecordState {
  isOpen: boolean
  byScenario: Record<string, DecisionRecord>
  open: () => void
  close: () => void
  saveRecord: (scenarioKey: string, record: DecisionRecord, clientCommitId?: string) => DecisionRecordCapture | null
  /**
   * Promote an already-saved local record to DURABLE once CEE has confirmed
   * the write. A no-op when no record exists for the key — a remote marker
   * with no record behind it would be a claim about nothing.
   */
  attachRemote: (scenarioKey: string, capture: DecisionRecordCapture, remote: DecisionRecordRemote) => boolean
  isCurrentCapture: (scenarioKey: string, capture: DecisionRecordCapture) => boolean
  /** Test/reset seam — clears memory AND storage. */
  _reset: () => void
  /** Test seam — re-reads localStorage (simulates a reload, or a new tab). */
  _rehydrateForTests: () => void
}

export interface DecisionRecordCapture { clientCommitId: string; ownerEpoch: string; ownerId: string | null }
interface Boundary { ownerId: string | null; epoch: string }
interface StoredRecord { version: 2; scenarioKey: string; clientCommitId: string; record: DecisionRecord }

const PREFIX = 'decisionRecord.v2:'
const BOUNDARY_KEY = `${PREFIX}owner`
let boundary: Boundary | null = null // unresolved auth must not expose a previous person's record
let captures: Record<string, string> = {}
const volatileCaptures = new Set<string>()

function id(): string { return crypto.randomUUID() }
function readBoundary(): Boundary | null | undefined {
  let raw: string | null
  try { raw = localStorage.getItem(BOUNDARY_KEY) }
  catch { return undefined } // blocked storage: this tab can still keep an in-memory record
  try {
    const parsed = JSON.parse(raw ?? 'null')
    return parsed && typeof parsed.epoch === 'string' &&
      (parsed.ownerId === null || typeof parsed.ownerId === 'string') ? parsed : null
  } catch { return null } // corruption is not authority to retain the previous owner
}
function keys(): string[] {
  try { return Array.from({ length: localStorage.length }, (_, i) => localStorage.key(i)).filter((k): k is string => k !== null) }
  catch { return [] }
}
function eraseRecords(keepEpoch: string, clearLegacy = false): void {
  for (const key of keys()) if ((clearLegacy && key === 'decisionRecord.v1') || (key.startsWith(PREFIX) && key !== BOUNDARY_KEY && !key.startsWith(`${PREFIX}${keepEpoch}:`))) {
    try { localStorage.removeItem(key) } catch { /* memory is still cleared */ }
  }
}
function isActive(): boolean {
  const current = readBoundary()
  return boundary !== null && (current === undefined || current?.epoch === boundary.epoch)
}
function invalidate(): void {
  boundary = null
  captures = {}
  volatileCaptures.clear()
  useDecisionRecordStore.setState({ byScenario: {}, isOpen: false })
}
function recordKey(epoch: string, scenarioKey: string): string {
  return `${PREFIX}${epoch}:record:${encodeURIComponent(scenarioKey)}`
}
function ackKey(epoch: string, scenarioKey: string, captureId: string): string {
  return `${PREFIX}${epoch}:ack:${encodeURIComponent(scenarioKey)}:${encodeURIComponent(captureId)}`
}
function readRecord(scenarioKey: string): StoredRecord | null {
  if (!boundary) return null
  try {
    const parsed = JSON.parse(localStorage.getItem(recordKey(boundary.epoch, scenarioKey)) ?? 'null')
    return parsed?.version === 2 && parsed.scenarioKey === scenarioKey &&
      typeof parsed.clientCommitId === 'string' && parsed.record && typeof parsed.record === 'object' ? parsed : null
  } catch { return null }
}
function loadPersisted(): Pick<DecisionRecordState, 'byScenario'> {
  const byScenario: Record<string, DecisionRecord> = {}
  captures = Object.fromEntries(Object.entries(captures).filter(([key]) => volatileCaptures.has(key)))
  if (!boundary || !isActive()) return { byScenario }
  const recordPrefix = `${PREFIX}${boundary.epoch}:record:`
  for (const key of keys()) {
    if (!key.startsWith(recordPrefix)) continue
    let scenarioKey: string
    try { scenarioKey = decodeURIComponent(key.slice(recordPrefix.length)) } catch { continue }
    const stored = readRecord(scenarioKey)
    if (!stored || scenarioKey === UNSCOPED_SCENARIO_KEY) continue
    let remote: DecisionRecordRemote | null = null
    try {
      const ack = JSON.parse(localStorage.getItem(ackKey(boundary.epoch, scenarioKey, stored.clientCommitId)) ?? 'null')
      if (ack && typeof ack.recordId === 'string' && typeof ack.reviewDate === 'string' &&
          ['user_set', 'default_horizon', 'default_horizon_after_unparsed_trigger'].includes(ack.reviewDateSource)) remote = ack
    } catch { /* no confirmation */ }
    byScenario[scenarioKey] = { ...stored.record, remote }
    captures[scenarioKey] = stored.clientCommitId
  }
  return { byScenario }
}
function write(key: string, value: unknown): 'persisted' | false {
  // A write without a readable ownership fence cannot establish retention.
  if (readBoundary() === undefined) return false
  if (!isActive()) { invalidate(); return false }
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { return false }
  // Sign-out may interleave in another tab between the fence and the write.
  if (!isActive()) {
    try { localStorage.removeItem(key) } catch { /* prior generation is never read */ }
    invalidate()
    return false
  }
  return 'persisted'
}

/** Existing auth adoption calls this before exposing the next user's UI. */
export function observeDecisionRecordOwner(ownerId: string | null): void {
  const current = readBoundary()
  // Tabs observing the same transition must choose the same generation. A
  // random initial epoch let the later publisher erase the first tab's notes.
  // Explicit sign-out still rotates to a random epoch before deleting records.
  const next: Boundary = current && current.ownerId === ownerId ? current : {
    ownerId, epoch: uuidv5(JSON.stringify([current?.epoch ?? null, ownerId]), uuidv5.URL),
  }
  if (!current || current.ownerId !== ownerId) {
    // Publish revocation first, so a stale tab cannot refill the cleared generation.
    try { localStorage.setItem(BOUNDARY_KEY, JSON.stringify(next)) } catch { /* memory only */ }
    eraseRecords(next.epoch, !!current && current.ownerId !== ownerId)
  }
  if (boundary?.epoch === next.epoch) return
  boundary = next
  captures = {}
  volatileCaptures.clear()
  useDecisionRecordStore.setState({ ...loadPersisted(), isOpen: false })
}

/** Joins clearAuthStates; does not replace or alter the dissent cleanup hook. */
export function clearDecisionRecords(): void {
  const epoch = id()
  try { localStorage.setItem(BOUNDARY_KEY, JSON.stringify({ ownerId: null, epoch })) } catch { /* memory only */ }
  eraseRecords(epoch, true)
  invalidate()
}

export const useDecisionRecordStore = create<DecisionRecordState>((set, get) => ({
  isOpen: false,
  ...loadPersisted(),

  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),

  saveRecord: (scenarioKey, record, clientCommitId = id()) => {
    if (!boundary || !isActive()) { invalidate(); return null }
    const capture = { clientCommitId, ownerEpoch: boundary.epoch, ownerId: boundary.ownerId }
    const outcome = scenarioKey === UNSCOPED_SCENARIO_KEY ? 'memory' : write(recordKey(boundary.epoch, scenarioKey), {
      version: 2, scenarioKey, clientCommitId, record: { ...record, remote: null },
    })
    if (!outcome) return null
    if (outcome === 'memory') { volatileCaptures.add(scenarioKey); captures[scenarioKey] = clientCommitId }
    else volatileCaptures.delete(scenarioKey)
    const persisted = loadPersisted().byScenario
    const byScenario = { ...get().byScenario, ...persisted,
      ...(outcome === 'memory' ? { [scenarioKey]: { ...record, remote: null } } : {}),
    }
    set({ byScenario })
    return capture
  },

  isCurrentCapture: (scenarioKey, capture) => {
    if (!boundary || !isActive() || capture.ownerEpoch !== boundary.epoch) return false
    return (volatileCaptures.has(scenarioKey) ? captures[scenarioKey] : readRecord(scenarioKey)?.clientCommitId) === capture.clientCommitId
  },
  attachRemote: (scenarioKey, capture, remote) => {
    if (!get().isCurrentCapture(scenarioKey, capture)) return false
    if (!write(ackKey(capture.ownerEpoch, scenarioKey, capture.clientCommitId), remote)) return false
    // An intervening newer capture has its own key; this acknowledgement can
    // never lend it proof, even when its write occurs during our storage write.
    const existing = get().byScenario[scenarioKey]
    const persisted = loadPersisted().byScenario
    const stillCurrent = get().isCurrentCapture(scenarioKey, capture)
    set({ byScenario: { ...get().byScenario, ...persisted,
      ...(stillCurrent && existing && !persisted[scenarioKey] ? { [scenarioKey]: { ...existing, remote } } : {}),
    } })
    return stillCurrent
  },

  _reset: () => {
    clearDecisionRecords()
    observeDecisionRecordOwner(null)
  },

  _rehydrateForTests: () => {
    set({ ...loadPersisted() })
  },
}))

if (typeof window !== 'undefined') window.addEventListener('storage', (event) => {
  if (event.key !== null && !event.key.startsWith(PREFIX)) return
  if (!isActive()) { invalidate(); return }
  const unscoped = useDecisionRecordStore.getState().byScenario[UNSCOPED_SCENARIO_KEY]
  useDecisionRecordStore.setState({ byScenario: { ...loadPersisted().byScenario,
    ...(unscoped ? { [UNSCOPED_SCENARIO_KEY]: unscoped } : {}),
  } })
})

/**
 * The captured record for a scenario key, or null. This is the selector the
 * overview/strengthen surfaces use to render a "Decision recorded" state
 * (wiring happens in another lane).
 */
export function selectDecisionRecord(
  state: Pick<DecisionRecordState, 'byScenario'>,
  scenarioKey: string,
): DecisionRecord | null {
  return state.byScenario[scenarioKey] ?? null
}

/**
 * Open the Record-the-decision modal from any surface without prop drilling
 * (the commit rec's primary action per the spec's intended wiring — NOT the
 * prototype's mis-wired 'ask' branch). The modal itself must be mounted
 * once — see DecisionRecordModal.
 */
export function openDecisionRecord(): void {
  useDecisionRecordStore.getState().open()
}

export function closeDecisionRecord(): void {
  useDecisionRecordStore.getState().close()
}

/**
 * Reactive record lookup per scenario. Callers subscribe to
 * `useCanvasStore(s => s.currentScenarioId)` themselves and pass it in —
 * keeps this store decoupled from the canvas store.
 */
export function useDecisionRecordForScenario(
  scenarioId: string | null | undefined,
): DecisionRecord | null {
  return useDecisionRecordStore(
    (s) => s.byScenario[resolveScenarioKey(scenarioId)] ?? null,
  )
}

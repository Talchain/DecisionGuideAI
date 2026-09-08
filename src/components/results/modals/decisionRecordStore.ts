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
 * ⚠⚠ AND `localStorage` BOUGHT TWO DEFECTS WITH THE LIFETIME, BOTH CLOSED HERE
 * RATHER THAN LEFT FOR THE READ-BACK TO EXPOSE. `sessionStorage` was per-tab,
 * so it hid them both. (1) The `__unscoped__` fallback key would have become a
 * permanent, browser-global, identity-independent slot — see `persist` for why
 * it is now never written. (2) A whole-map write from a once-read snapshot
 * would have let two tabs clobber each other — see `saveRecord`. Neither was a
 * bug in the move; both are what the move made reachable.
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
  saveRecord: (scenarioKey: string, record: DecisionRecord) => void
  /**
   * Promote an already-saved local record to DURABLE once CEE has confirmed
   * the write. A no-op when no record exists for the key — a remote marker
   * with no record behind it would be a claim about nothing.
   */
  attachRemote: (scenarioKey: string, remote: DecisionRecordRemote) => void
  /** Test/reset seam — clears memory AND storage. */
  _reset: () => void
  /** Test seam — re-reads localStorage (simulates a reload, or a new tab). */
  _rehydrateForTests: () => void
}

const STORAGE_KEY = 'decisionRecord.v1'

function loadPersisted(): Pick<DecisionRecordState, 'byScenario'> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { byScenario: {} }
    const parsed = JSON.parse(raw)
    if (parsed?.version !== 1) return { byScenario: {} }
    return { byScenario: parsed.byScenario ?? {} }
  } catch {
    return { byScenario: {} }
  }
}

/**
 * ⭐⭐ THE UNSCOPED RECORD IS NEVER WRITTEN TO DURABLE STORAGE, AND THAT IS A
 * PRIVACY BOUNDARY, NOT A TIDINESS RULE.
 *
 * `resolveScenarioKey` folds "no scenario yet" onto the single literal
 * `__unscoped__`. Under `sessionStorage` that shared key was bounded by the
 * tab: it died when the tab did. Under `localStorage` it would be a PERMANENT,
 * browser-global, identity-independent slot — so a decision recorded on an
 * unsaved canvas would be read back, indefinitely, by the next person to open
 * an unsaved canvas in that browser profile, rendered as "for this scenario".
 *
 * ⚠ AND NO SIGN-OUT HOOK CAN CLOSE THAT. On the deployed staging posture
 * (`VITE_AUTH_MODE = "guest"`) the optional-auth `signOut` opens
 * `if (!session) return` (`AuthContext.tsx:625-627`), so a visitor who never
 * signed in never runs a sign-out path at all. Two guests sharing a machine
 * are one identity to this product; the only defence available at this layer
 * is not to write the shared key.
 *
 * The record still SAVES — it stays in memory for the session, which is every
 * bit of the life it can honestly have. A capture with no scenario cannot be
 * read back "for this scenario" on a later visit, because there is no scenario
 * for it to be read back against; persisting it durably would buy nothing and
 * cost a cross-user read.
 *
 * ⚠ THE RESIDUAL, STATED RATHER THAN GLOSSED: a record keyed to a REAL
 * scenario id still survives a sign-out, because nothing in this product
 * clears product data on sign-out today (measured — `clearAuthStates` clears a
 * hand-listed set of nine AUTH keys and no product key; PR #1299 is building
 * that seam for a sibling store). Its exposure is bounded by the scenario's
 * own: `olumi-canvas-autosave`, `olumi-canvas-current-scenario-id` and the
 * scenario list are already permanent, un-namespaced `localStorage`, so anyone
 * who can open that scenario can already see the graph the record belongs to.
 * That is the estate-wide gap, not this store's to invent a second mechanism
 * for.
 */
function persist(byScenario: Record<string, DecisionRecord>): void {
  try {
    const { [UNSCOPED_SCENARIO_KEY]: _unscoped, ...durable } = byScenario
    void _unscoped
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, byScenario: durable }))
  } catch {
    // localStorage unavailable (private mode, quota, blocked site data) —
    // the record degrades to in-memory only rather than throwing at the user.
  }
}

export const useDecisionRecordStore = create<DecisionRecordState>((set, get) => ({
  isOpen: false,
  ...loadPersisted(),

  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),

  /**
   * ⚠⚠ THE WRITE MERGES ONTO WHAT IS ON DISK RIGHT NOW, NOT ONTO THIS TAB'S
   * MODULE-INIT SNAPSHOT — and that only became necessary with `localStorage`.
   *
   * `sessionStorage` is per-tab, so a whole-map write could not lose another
   * tab's work. `localStorage` is shared across every tab on the profile, and
   * this store reads it ONCE (the `...loadPersisted()` spread in the factory
   * below) and has no `storage` listener. Writing `get().byScenario` wholesale
   * would therefore take a snapshot that could be minutes old and stamp it
   * back over the shared map: two tabs on two scenarios, and the second save
   * silently deletes the first — while both users are told "Decision recorded
   * on this device."
   *
   * Disk wins over this tab's memory, because every in-memory entry was
   * persisted the moment it was made, so a divergence means another tab moved
   * on. The record being written wins over both, because it is the newest fact
   * in the system. The unscoped entry survives the merge without being written
   * — `loadPersisted` can never return that key, so nothing overrides it.
   */
  saveRecord: (scenarioKey, record) => {
    const byScenario = {
      ...get().byScenario,
      ...loadPersisted().byScenario,
      [scenarioKey]: record,
    }
    persist(byScenario)
    set({ byScenario })
  },

  attachRemote: (scenarioKey, remote) => {
    const merged = { ...get().byScenario, ...loadPersisted().byScenario }
    const existing = merged[scenarioKey]
    if (!existing) return
    const byScenario = { ...merged, [scenarioKey]: { ...existing, remote } }
    persist(byScenario)
    set({ byScenario })
  },

  _reset: () => {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignore */
    }
    set({ isOpen: false, byScenario: {} })
  },

  _rehydrateForTests: () => {
    set({ ...loadPersisted() })
  },
}))

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

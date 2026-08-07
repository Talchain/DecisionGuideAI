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
 * Persistence mirrors strengthenStore: zustand + manual, version-keyed
 * sessionStorage, keyed per scenario id.
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

import { resolveScenarioKey } from './scenarioKey'

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
  /** Test seam — re-reads sessionStorage (simulates a reload). */
  _rehydrateForTests: () => void
}

const STORAGE_KEY = 'decisionRecord.v1'

function loadPersisted(): Pick<DecisionRecordState, 'byScenario'> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return { byScenario: {} }
    const parsed = JSON.parse(raw)
    if (parsed?.version !== 1) return { byScenario: {} }
    return { byScenario: parsed.byScenario ?? {} }
  } catch {
    return { byScenario: {} }
  }
}

function persist(byScenario: Record<string, DecisionRecord>): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, byScenario }))
  } catch {
    // sessionStorage unavailable — the record degrades to in-memory only.
  }
}

export const useDecisionRecordStore = create<DecisionRecordState>((set, get) => ({
  isOpen: false,
  ...loadPersisted(),

  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),

  saveRecord: (scenarioKey, record) => {
    const byScenario = { ...get().byScenario, [scenarioKey]: record }
    persist(byScenario)
    set({ byScenario })
  },

  attachRemote: (scenarioKey, remote) => {
    const existing = get().byScenario[scenarioKey]
    if (!existing) return
    const byScenario = { ...get().byScenario, [scenarioKey]: { ...existing, remote } }
    persist(byScenario)
    set({ byScenario })
  },

  _reset: () => {
    try {
      sessionStorage.removeItem(STORAGE_KEY)
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

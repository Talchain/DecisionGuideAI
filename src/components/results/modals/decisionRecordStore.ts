/**
 * decisionRecordStore — the prototype-only decision record captured by the
 * Record-the-decision modal (prototype #decisionModal, build-ready v6).
 *
 * HONESTY CONTRACT: NO backend persistence exists — durable saving is
 * blocked on identity + Model Management (the prototype's own disclaimer).
 * Records live in sessionStorage on THIS device for THIS scenario and die
 * with the browser session. Any surface rendering a "Decision recorded"
 * state from this store must label it accordingly.
 *
 * Persistence mirrors strengthenStore: zustand + manual, version-keyed
 * sessionStorage, keyed per scenario id. The analysed graph hash
 * (results.hash at capture time) is stored so later surfaces can say
 * whether the record still matches the current analysis.
 */
import { create } from 'zustand'

import { resolveScenarioKey } from './scenarioKey'

export interface DecisionRecord {
  /** Canvas node id of the chosen option (from the analysed option set). */
  optionId: string
  /** Display label snapshot at capture time. */
  optionLabel: string
  /** Stable option number (optionNumbering) when the full set was numbered; null otherwise. */
  optionNumber: number | null
  /** 0-100 inclusive. Validated non-empty at capture (the prototype's Number('')===0 hole is closed). */
  confidence: number
  rationale: string
  assumptionToWatch: string
  /** Free text: a trigger condition or a date ("Revisit trigger or date"). */
  revisitTrigger: string
  /** results.hash of the completed analysis on screen at capture time, if any. */
  analysisHash: string | null
  savedAt: number
}

export interface DecisionRecordState {
  isOpen: boolean
  byScenario: Record<string, DecisionRecord>
  open: () => void
  close: () => void
  saveRecord: (scenarioKey: string, record: DecisionRecord) => void
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

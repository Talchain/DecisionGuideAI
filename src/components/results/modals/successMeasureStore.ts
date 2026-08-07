/**
 * successMeasureStore — the structured success measure captured by the
 * Define-success modal (prototype #successModal, build-ready v6).
 *
 * HONESTY CONTRACT: only the numeric `threshold` flows into the analysis
 * request today, through the EXISTING canonical path (canvas
 * store.setGoalThreshold → executeCanonicalRun → UI-SEM-058 raw/cap
 * normalisation in useV2Run/httpV1Adapter). The richer fields — metric,
 * direction, unit, timeframe, baseline — are DISPLAY/RECORD ONLY: nothing in
 * the store, request adapters, or wire contract can represent them yet (a
 * "keep churn below 4% within 6 months" measure is not expressible). The
 * modal states this to the user; consumers of this store must not pretend
 * otherwise.
 *
 * Persistence mirrors strengthenStore: zustand + manual, version-keyed
 * sessionStorage (survives reloads, dies with the session — matching the
 * unpersisted scenario identity's scope), keyed per scenario id.
 */
import { create } from 'zustand'

import { resolveScenarioKey } from './scenarioKey'

export type SuccessDirection =
  | 'increase_by_at_least'
  | 'reach_at_least'
  | 'keep_below'

export interface SuccessMeasure {
  /** "What outcome should improve?" — display/record only. */
  metric: string
  /** Display/record only — NOT representable on the analysis wire today. */
  direction: SuccessDirection
  /** The ONE field that affects the analysis (via the canonical goal-threshold path). Raw user units. */
  threshold: number
  /** Display/record only. */
  unit: string
  /** Display/record only. */
  timeframe: string
  /** Optional baseline or evidence — display/record only. */
  baseline: string | null
  savedAt: number
}

export interface SuccessMeasureState {
  isOpen: boolean
  byScenario: Record<string, SuccessMeasure>
  open: () => void
  close: () => void
  saveMeasure: (scenarioKey: string, measure: SuccessMeasure) => void
  /** Test/reset seam — clears memory AND storage. */
  _reset: () => void
  /** Test seam — re-reads sessionStorage (simulates a reload). */
  _rehydrateForTests: () => void
}

const STORAGE_KEY = 'defineSuccess.measure.v1'

function loadPersisted(): Pick<SuccessMeasureState, 'byScenario'> {
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

function persist(byScenario: Record<string, SuccessMeasure>): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, byScenario }))
  } catch {
    // sessionStorage unavailable — the measure degrades to in-memory only.
  }
}

export const useSuccessMeasureStore = create<SuccessMeasureState>((set, get) => ({
  isOpen: false,
  ...loadPersisted(),

  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),

  saveMeasure: (scenarioKey, measure) => {
    const byScenario = { ...get().byScenario, [scenarioKey]: measure }
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

/** The saved measure for a scenario key, or null. */
export function selectSuccessMeasure(
  state: Pick<SuccessMeasureState, 'byScenario'>,
  scenarioKey: string,
): SuccessMeasure | null {
  return state.byScenario[scenarioKey] ?? null
}

/**
 * Open the Define-success modal from any surface without prop drilling
 * (rec-card primary action, goal-lens empty state, brief chip...).
 * The modal itself must be mounted once — see DefineSuccessModal.
 */
export function openDefineSuccess(): void {
  useSuccessMeasureStore.getState().open()
}

export function closeDefineSuccess(): void {
  useSuccessMeasureStore.getState().close()
}

/**
 * Reactive saved-measure lookup for the CURRENT scenario — for the surfaces
 * that render the measure summary (goal brief chip, goal-lens caption).
 * Deliberately takes the scenario id as an argument so this store stays
 * decoupled from the canvas store; callers subscribe to
 * `useCanvasStore(s => s.currentScenarioId)` themselves.
 */
export function useSuccessMeasureForScenario(
  scenarioId: string | null | undefined,
): SuccessMeasure | null {
  return useSuccessMeasureStore(
    (s) => s.byScenario[resolveScenarioKey(scenarioId)] ?? null,
  )
}

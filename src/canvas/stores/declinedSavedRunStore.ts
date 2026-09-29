/**
 * ⭐ A SAVED RUN THE BOOT COULD NOT CONFIRM — recorded so the Run control never says "first pass" over it.
 *
 * When a fresh browser opens a scenario whose read carries a `complete_current` / `complete_stale` Run, the boot
 * restores that Run only under proof that the canvas equals the model the Run was made on
 * (`restoreRunCurrency` in `serverGraphHydration.ts`). When that proof fails, the boot rightly writes NO verdict, and
 * the Run control fell back to "Analysis available · Analyse first pass": a claim that no Run exists. Served on saved
 * Run `c96fc4bb` (Canvas #72 5893089961); P0 Shared Data asked that Canvas "explain the incompatibility rather than
 * imply no first Run" (#72 5893379882).
 *
 * This store holds only what the read said (a Run of that kind exists) and why the boot declined it. It is not a
 * verdict and nothing reads it as one: it changes the run control's words and one explanatory sentence, nothing else.
 */
import { create } from 'zustand'

export type DeclinedSavedRunKind = 'complete_current' | 'complete_stale'

export interface DeclinedSavedRun {
  readonly scenarioId: string
  readonly runStateKind: DeclinedSavedRunKind
  /** The boot's own decline reason (`applyBootRunCurrency`), kept for the console and tests; never shown. */
  readonly reason: string
}

interface DeclinedSavedRunState {
  declined: DeclinedSavedRun | null
  record: (declined: DeclinedSavedRun) => void
  clear: () => void
}

export const useDeclinedSavedRunStore = create<DeclinedSavedRunState>((set) => ({
  declined: null,
  record: (declined) => set({ declined }),
  clear: () => set({ declined: null }),
}))

/** The read's run-state kinds that mean "a Run exists on record". Anything else records nothing. */
export function declinedSavedRunKindOf(kind: unknown): DeclinedSavedRunKind | null {
  return kind === 'complete_current' || kind === 'complete_stale' ? kind : null
}

/**
 * True only for the scenario on screen, and only while this browser holds no Run of its own
 * (`runOnRecordLocally` is `selectRunOnRecord(analysisStateV1)`): once a Run lands, the declined one is history.
 */
export function selectSavedRunUnconfirmed(
  declined: DeclinedSavedRun | null,
  currentScenarioId: string | null | undefined,
  runOnRecordLocally: boolean,
): boolean {
  return declined !== null && !runOnRecordLocally && typeof currentScenarioId === 'string' &&
    declined.scenarioId === currentScenarioId
}

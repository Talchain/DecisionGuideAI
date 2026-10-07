/**
 * ⭐ ONE RERUN CONTROL, DERIVED FROM MODEL-CHANGED STATE — the single owner of "which control reruns the analysis".
 *
 * Paul, 7 Oct 2026, after an approved change: "get rid of the pill inside the chat and just have the re-analyse
 * button". The Olumi tab was showing THREE ways to do one thing, each deciding for itself:
 *   · the shell footer's `ReanalyseBar` — "Model changed. Results may be out of date. [Re-analyse]";
 *   · the composer's quiet "Re-run analysis" icon (`OutputsDock` → `PersistentInputStrip` → `AIInputBar`), shown in
 *     every post-first-Run state;
 *   · CEE's "Run analysis" chip under the approve reply, relabelled "Rerun" by `SuggestedChips`.
 *
 * The rule (per host, after the first Run — before it, a run control is a RUN, not a rerun, and is untouched):
 *   · the model changed (the bar shows) → the bar's Re-analyse is the ONLY rerun control;
 *   · otherwise → the composer icon is (the bar is null when nothing changed);
 *   · on a host whose shell carries those two (the docked Olumi tab), the chat's run chip is never a rerun control.
 *     A host with no shell controls (the floating panel mounts neither) keeps the chip: there it is the only one.
 *
 * Every consumer reads this module; none re-derives the bar's condition (CLAUDE.md trap 12).
 */
import type { FreshnessDisplaySemantic } from '../../store/analysisFreshness'
import { useAnalysisTrust } from '../../hooks/useAnalysisTrust'
import { useCanvasStore } from '../../store'

export interface ReanalyseBarInputs {
  /** `useAnalysisTrust().semantic`. */
  semantic: FreshnessDisplaySemantic
  /** `importPendingServerRegistration`: the canvas holds an import the server has not registered. */
  importHold: boolean
  /** Whether a Run has EVER completed for this model (read from the store, never inferred from `semantic`). */
  hasCompletedFirstRun: boolean
}

/**
 * Whether `ReanalyseBar` renders. Moved here verbatim from the bar's own null so the bar and every control that must
 * stand aside for it read ONE predicate: never run → the bar (as "Analyse"); a held import it cannot confirm → the bar
 * ("Can't confirm…"); the model changed → the bar ("Model changed…"); anything else → no bar.
 */
export function reanalyseBarShows({ semantic, importHold, hasCompletedFirstRun }: ReanalyseBarInputs): boolean {
  const neverRun = !hasCompletedFirstRun
  const heldUnsure = !neverRun && importHold && semantic === 'cannot_confirm'
  return semantic === 'changed' || heldUnsure || neverRun
}

/** The live inputs, read the way `ReanalyseBar` reads them. */
export function useReanalyseBarInputs(): ReanalyseBarInputs {
  const { semantic } = useAnalysisTrust()
  const importHold = useCanvasStore((s) => s.importPendingServerRegistration)
  // `?? true`: the same defensive default `composeAnalysisState` applies to this field (`analysisStateSelector.ts`).
  const hasCompletedFirstRun = useCanvasStore((s) => s.hasCompletedFirstRun) ?? true
  return { semantic, importHold, hasCompletedFirstRun }
}

/** Which control on a shell host (footer bar + composer) reruns the analysis. 'none' = no Run yet (not a rerun). */
export type ShellRerunControl = 'bar' | 'composer' | 'none'

export function shellRerunControl(inputs: ReanalyseBarInputs): ShellRerunControl {
  if (!inputs.hasCompletedFirstRun) return 'none'
  return reanalyseBarShows(inputs) ? 'bar' : 'composer'
}

/**
 * Whether the chat's run chip may stand as a rerun control on this host. `shellOwnsRerun` is the HOST's declaration
 * that its shell carries the bar and the composer icon (the docked Olumi tab); after the first Run the shell then owns
 * every rerun and the chip stands aside. Before the first Run the chip is a run control and is left as it was.
 */
export function chatRunChipStandsAside(shellOwnsRerun: boolean, hasCompletedFirstRun: boolean): boolean {
  return shellOwnsRerun && hasCompletedFirstRun
}

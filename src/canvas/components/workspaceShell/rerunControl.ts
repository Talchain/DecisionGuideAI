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
 *   · the chat's run chip is never a rerun control while its host shows (or defers to) one: the docked Olumi tab
 *     (its shell), the floating panel (its own bar, or the open dock surface beside it) — `hostRerunControl`.
 *
 * Every consumer reads this module; none re-derives the bar's condition (CLAUDE.md trap 12).
 */
import type { FreshnessDisplaySemantic } from '../../store/analysisFreshness'
import type { OutputTab } from '../../../stores/uiStore'
import { WORKSPACE_SURFACES } from './shellContract'
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
 * Which surface can host the chat, for the rerun rule.
 *   · 'docked'   — the dock's Olumi tab: its shell carries the footer bar and the composer icon.
 *   · 'floating' — the floating panel with no dock surface beside it that owns rerun: it shows its OWN bar.
 *   · 'floating-beside-dock' — the floating panel while the open dock shows a surface that owns rerun
 *     (`dockSurfaceOwnsRerun`): that surface's control is the one on screen.
 */
export type RerunHost = 'docked' | 'floating' | 'floating-beside-dock'

/** 'elsewhere' = another visible surface owns the rerun; 'none' = no rerun control (no Run yet, or nothing changed). */
export type HostRerunControl = ShellRerunControl | 'elsewhere'

export function hostRerunControl(host: RerunHost, inputs: ReanalyseBarInputs): HostRerunControl {
  const shell = shellRerunControl(inputs)
  if (host === 'docked') return shell
  if (host === 'floating-beside-dock') return shell === 'none' ? 'none' : 'elsewhere'
  // The floating panel has no composer icon: it shows its own bar while the bar would show, and nothing otherwise
  // (a current analysis needs no rerun).
  return shell === 'bar' ? 'bar' : 'none'
}

/**
 * Whether the chat's run chip stands aside: whenever the host shows (or defers to) a rerun control. Before the
 * first Run every host answers 'none' and the chip — a RUN control then, not a rerun — is left as it was.
 */
export function chatRunChipStandsAside(control: HostRerunControl): boolean {
  return control !== 'none'
}

/**
 * Whether an open dock surface owns the rerun once a Run exists: every surface whose shell footer is not 'none'
 * (Olumi, Reasoning, Model) plus the Analysis tab, whose body footer carries its own Rerun.
 */
export function dockSurfaceOwnsRerun(tab: OutputTab): boolean {
  return WORKSPACE_SURFACES[tab].footerBar !== 'none' || tab === 'results'
}

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
 * The rule (per host):
 *   · before the first Run, the dock readiness Analyse owns the run when it renders; otherwise the chat chip stays;
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
  /** The readiness bar's pre-run window; absent means this caller offers no readiness button. */
  preRunWithModel?: boolean
}

/** AnalysisReadinessBar renders its Analyse button throughout this window, even when disabled. */
export function readinessBarShowsAnalyse(preRunWithModel: boolean): boolean {
  return preRunWithModel
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
export function useReanalyseBarInputs(): ReanalyseBarInputs & { preRunWithModel: boolean } {
  const { semantic } = useAnalysisTrust()
  const importHold = useCanvasStore((s) => s.importPendingServerRegistration)
  // `?? true`: the same defensive default `composeAnalysisState` applies to this field (`analysisStateSelector.ts`).
  const hasCompletedFirstRun = useCanvasStore((s) => s.hasCompletedFirstRun) ?? true
  const nodeCount = useCanvasStore((s) => s.nodes.length)
  return { semantic, importHold, hasCompletedFirstRun, preRunWithModel: !hasCompletedFirstRun && nodeCount > 0 }
}

/** Which shell control owns the run. Before the first Run, 'none' leaves the chat chip available. */
export type ShellRerunControl = 'readiness' | 'bar' | 'composer' | 'none'

export function shellRerunControl(inputs: ReanalyseBarInputs): ShellRerunControl {
  if (!inputs.hasCompletedFirstRun) return readinessBarShowsAnalyse(inputs.preRunWithModel ?? false) ? 'readiness' : 'none'
  return reanalyseBarShows(inputs) ? 'bar' : 'composer'
}

/**
 * Which surface can host the chat, for the rerun rule.
 *   · 'docked'   — the dock's Olumi tab: its shell carries the footer bar and the composer icon.
 *   · 'floating' — the floating panel with no dock surface beside it that owns rerun: it shows its OWN bar.
 *   · 'floating-beside-dock' — the floating panel while the open dock surface is SHOWING a rerun control
 *     (`dockSurfaceShowsRerun`): that surface's control is the one on screen.
 */
export type RerunHost = 'docked' | 'floating' | 'floating-beside-dock'

/** 'elsewhere' = another visible surface owns the run; 'none' = this host offers no run control, so the chip stays. */
export type HostRerunControl = ShellRerunControl | 'elsewhere'

export function hostRerunControl(host: RerunHost, inputs: ReanalyseBarInputs): HostRerunControl {
  const shell = shellRerunControl(inputs)
  if (host === 'docked') return shell
  // The floating host mounts no pre-run Analyse. 'beside-dock' is selected only when the dock shows a control.
  if (!inputs.hasCompletedFirstRun) return host === 'floating-beside-dock' ? 'elsewhere' : 'none'
  if (host === 'floating-beside-dock') return shell === 'none' ? 'none' : 'elsewhere'
  // The floating panel has no composer icon: it shows its own bar while the bar would show, and nothing otherwise
  // (a current analysis needs no rerun).
  return shell === 'bar' ? 'bar' : 'none'
}

/**
 * Whether the chat's run chip stands aside: whenever the host shows (or defers to) a rerun control. Before the
 * first Run the chip yields only when a host control is actually shown.
 */
export function chatRunChipStandsAside(control: HostRerunControl): boolean {
  return control !== 'none'
}

/**
 * Whether an open dock surface is SHOWING a rerun control right now — derived from the control it actually renders,
 * never from the tab alone (buddy r2 P2: on Model with a plain cannot-confirm the bar is null, and deferring to it
 * left zero controls). Surfaces whose shell footer hosts `ReanalyseBar` (Olumi, Reasoning, Model) show it exactly
 * when the bar shows; the Analysis tab's body footer carries its Rerun once a Run exists.
 */
export function dockSurfaceShowsRerun(tab: OutputTab, inputs: ReanalyseBarInputs): boolean {
  if (tab === 'results') return inputs.hasCompletedFirstRun
  const footerBar = WORKSPACE_SURFACES[tab].footerBar
  if (!inputs.hasCompletedFirstRun) {
    if (footerBar === 'readiness') return readinessBarShowsAnalyse(inputs.preRunWithModel ?? false)
    // Model mounts the never-run ReanalyseBar; Reasoning's after-first-run arm does not.
    return footerBar === 'reanalyse' && reanalyseBarShows(inputs)
  }
  return footerBar !== 'none' && shellRerunControl(inputs) === 'bar'
}

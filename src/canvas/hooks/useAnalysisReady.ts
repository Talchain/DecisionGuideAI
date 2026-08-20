/**
 * Selector hooks over the canvas store's `ceeAnalysisReady` slice.
 *
 * The slice is a nested object (`CEEAnalysisReady | null`) that carries the
 * full CEE payload. Surfaces that only need the readiness status or option
 * list use these narrow selectors instead of reaching into the object,
 * which keeps the single-source-of-truth (nested slice) intact and avoids
 * the write-race risk that would come with flat duplicate state.
 *
 * See docs/ui-v5-alpha-hardening-evidence.md — Phase 2.1 slice-naming
 * decision — for why the codebase uses nested state + selectors rather
 * than flat `analysis_status` / `analysis_ready_options` slices.
 */

import { useCanvasStore } from '../store'
import type { CEEOptionV3 } from '../../adapters/cee/types'

/**
 * Returns the wire-format `analysis_ready.status` string, or `'missing'`
 * when the slice is null (no CEE response has landed yet, or it was
 * cleared by the explicit-unknown branch on an analyse turn). Use to
 * gate executable affordances like the "Run analysis" chip.
 */
export function useAnalysisStatus(): string {
  return useCanvasStore((s) => s.ceeAnalysisReady?.status ?? 'missing')
}

/** Readiness-gate helper: true only when the wire status is exactly `'ready'`. */
export function useIsAnalysisReady(): boolean {
  return useCanvasStore((s) => s.ceeAnalysisReady?.status === 'ready')
}

/**
 * CEE's own admission verdict for this turn (`analysis_ready.may_run`), or
 * `undefined` when the producer did not send one.
 *
 * `undefined` is load-bearing and must not be collapsed to `false`: it means a
 * pre-`may_run` CEE, and the consumer's job is then to fall back to whatever it
 * did before. See {@link admitsRunAffordance}.
 */
export function useAnalysisMayRun(): boolean | undefined {
  return useCanvasStore((s) => s.ceeAnalysisReady?.may_run)
}

/**
 * May a Run affordance be offered on this turn?
 *
 *     admitted = status === 'ready' || may_run === true
 *
 * ⭐ A DISJUNCTION, ON PURPOSE — THIS IS A WIDENING, NOT A REPLACEMENT.
 *
 * `status === 'ready'` is the historical gate and is left exactly as it was, so
 * every affordance that renders today still renders — including when CEE sends
 * no `may_run` at all, which makes the two services deploy-order independent.
 * The second term can only ever ADD, never remove.
 *
 * WHY THE SECOND TERM IS NEEDED. `status` answers *"is this model ready as it
 * stands?"*; `may_run` answers *"will the run proceed if asked?"* — which is
 * also true when the run proceeds by excluding the options the user left open.
 * That is the readiness loop's payoff turn: `needs_user_input` AND admissible.
 * Measured in CEE on the `live-4day-week` capture, ONE status value carries BOTH
 * admission verdicts, so no reading of `status` can recover the answer.
 *
 * WHY `=== true` AND NOT `!== false`. The route-level `may_run` is three-valued
 * (`true | false | 'unknown'`) because a caller can fail to REACH that route; on
 * the turn payload there is no such case, and ABSENCE already carries "producer
 * did not say". Strict `=== true` therefore means an unexpected or malformed
 * value can never widen the gate by accident.
 *
 * ⚠ It is deliberately NOT this function's job to decide that a run is a good
 * idea — only that CEE would accept it. `may_run` IS the predicate CEE's own run
 * path admits on, so a chip shown on it cannot lead to a refusal.
 */
export function admitsRunAffordance(
  analysisStatus: string,
  mayRun: boolean | undefined,
): boolean {
  return analysisStatus === 'ready' || mayRun === true
}

/**
 * Returns the option array from the slice, or `null` when no readiness
 * state is present. Consumers that need option count / status breakdown
 * (e.g. pre-analysis panel) use this instead of reading the whole slice.
 */
export function useAnalysisReadyOptions(): readonly CEEOptionV3[] | null {
  return useCanvasStore((s) => s.ceeAnalysisReady?.options ?? null)
}

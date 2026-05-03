/** Default timeout for ordinary V5 conversation turns (ms). */
export const DEFAULT_TIMEOUT_MS = 60_000

/** Extended timeout for turns that invoke heavy CEE pipelines (draft_graph, analysis). */
export const EXTENDED_TIMEOUT_MS = 130_000

/**
 * Select the appropriate fetch timeout for a V5 turn.
 *
 * Extended timeout (130s) applies when the turn will likely trigger a long-running
 * CEE pipeline (draft graph generation or analysis):
 * - `explicit_generate` / `run_analysis` turn types — direct pipeline calls
 * - `analyse_now` trigger surface — user-initiated analysis
 * - `derivedStage === 'frame'` — composer first-turn on an empty canvas; CEE
 *   dispatches draft_graph for all 'frame' turns when no graph exists, routinely
 *   taking 40-60s
 *
 * 130s is chosen to be > BROWSER_PROXY_TIMEOUT_MS (125s), ensuring the browser
 * stays alive long enough to receive the proxy's structured timeout error.
 *
 * All other turns use the default 60s budget.
 */
export function getTimeoutMs(
  turnType?: string,
  triggerSurface?: string,
  derivedStage?: string,
): number {
  if (
    turnType === 'explicit_generate' ||
    turnType === 'run_analysis' ||
    triggerSurface === 'analyse_now' ||
    derivedStage === 'frame'
  ) return EXTENDED_TIMEOUT_MS
  return DEFAULT_TIMEOUT_MS
}

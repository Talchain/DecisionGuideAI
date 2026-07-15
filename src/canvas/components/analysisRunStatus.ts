/**
 * Wave1-L2 (seam D-M) — which run-status live region the dock narrates with.
 *
 * The dock has two ways to speak about an in-flight run, and both render
 * role=status aria-live=polite:
 *
 *  - `slowRunMessage` — the pre-existing 20s/40s escalation, the only
 *    narration available while the results skeleton is up (no report yet).
 *  - `AnalysisRunningBanner` — the staged narration, mounted only while a
 *    PREVIOUS report is still on screen.
 *
 * They used to stack: from ~20s the slow-run line rendered directly above the
 * banner, two live regions making opposing progress claims in exactly the
 * 20-30s window. A screen-reader user heard both.
 *
 * Reconciliation: the banner SUBSUMES the slow-run thresholds into its own
 * stage table (see NARRATION_STAGES — same 20s/40s escalation points), so
 * whenever the banner is mounted the standalone slow-run region yields and
 * the user loses nothing. Where the banner does not mount (no report), the
 * slow-run region keeps its existing behaviour untouched.
 *
 * Expressing this as ONE decision with ONE return value makes "exactly one
 * run-status live region" structurally true rather than merely tested: the
 * dock drives both render sites from this function alone.
 */

/** The single run-status live region to render, if any. */
export type RunStatusRegion = 'banner' | 'slow-run' | 'none'

export interface RunStatusInput {
  /** A run is in flight (preparing | connecting | streaming). */
  isRunning: boolean
  /** A previous report is still on screen (the banner's mount condition). */
  hasReport: boolean
  /** The dock's 20s/40s escalation copy, or null before the first threshold. */
  slowRunMessage: string | null
}

/**
 * Resolve the one region that narrates run status. Order matters: the banner
 * wins wherever it mounts, because its stage table already carries the
 * long-wait acknowledgement the slow-run line would have duplicated.
 */
export function runStatusRegion({
  isRunning,
  hasReport,
  slowRunMessage,
}: RunStatusInput): RunStatusRegion {
  if (isRunning && hasReport) return 'banner'
  // slowRunMessage is cleared on completion/error, but gate on isRunning too
  // so a stale value can never narrate a run that is no longer in flight.
  if (isRunning && slowRunMessage) return 'slow-run'
  return 'none'
}

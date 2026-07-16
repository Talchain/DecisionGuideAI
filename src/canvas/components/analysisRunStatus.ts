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

/**
 * F9 (UI brief 2026-07-16 item 3) — the same single-live-region rule,
 * extended from ONGOING narration to run START and SETTLE transitions.
 *
 * The dock now mounts one always-present announcer (AnalysisRunAnnouncer)
 * so a run is audible whichever tab is fronted. But the Analysis tab's own
 * furniture already speaks there:
 *
 *  - START: the running banner's narration div (role=status) mounts with
 *    "Analysing your decision…", and the no-report skeleton carries its own
 *    sr-only loading line. A dock announcement on top would be heard twice.
 *  - SETTLE: AnalysisFreshnessNotice fires the completion toast
 *    (role=alert) on the running→complete transition, and the error banner
 *    mounts as role=alert on failure.
 *
 * So the rule is: while the Analysis tab is fronted, the announcer YIELDS
 * every transition to that tab's furniture; everywhere else it is the one
 * voice. Expressed as one pure function, like runStatusRegion above, so
 * "exactly one announcement per transition" is structural, not per-consumer
 * discipline.
 *
 * FIRST runs are a special case of the same rule. The dock's I.1 auto-switch
 * fronts the Analysis tab whenever status transitions from idle/cancelled
 * into an active state, so on a FIRST run the user lands on the Analysis
 * tab (and its furniture) in the same breath as the start — but the
 * announcer's effect observes the transition BEFORE the dock's auto-switch
 * effect re-renders, so its `analysisTabFronted` input is one commit stale.
 * Rather than race that commit, the rule encodes the auto-switch contract:
 * a start from idle/cancelled yields unconditionally. RERUNS (from
 * complete/error) do not auto-switch — that is exactly the case F9 exists
 * for (rerun dispatched while Compare/Model is fronted stayed silent and
 * frozen) — so there the current frontedness decides.
 *
 * Settle copy never fabricates an outcome: only statuses the store actually
 * settles into ('complete' | 'error' | 'cancelled') get a line; anything
 * else (a reset to 'idle', an unknown value) announces nothing.
 */
export interface RunAnnouncementInput {
  /** Which transition just happened. */
  transition: 'start' | 'settle'
  /** The results status the run settled into (settle transitions only). */
  settledStatus?: string | null
  /**
   * The results status held BEFORE the run started (start transitions
   * only). idle/cancelled marks a FIRST run, which the dock auto-switches
   * to the Analysis tab (see above).
   */
  preRunStatus?: string | null
  /** The Analysis tab is fronted (dock open, results tab active). */
  analysisTabFronted: boolean
}

export function runAnnouncementForTransition({
  transition,
  settledStatus,
  preRunStatus,
  analysisTabFronted,
}: RunAnnouncementInput): string | null {
  if (analysisTabFronted) return null
  if (transition === 'start') {
    // First run: the dock's auto-switch is about to front the Analysis tab,
    // whose own furniture speaks. Announcing here would double up.
    if (preRunStatus === 'idle' || preRunStatus === 'cancelled') return null
    return 'Analysis started.'
  }
  switch (settledStatus) {
    case 'complete':
      return 'Analysis complete.'
    case 'error':
      return 'Analysis failed.'
    case 'cancelled':
      return 'Analysis cancelled.'
    default:
      return null
  }
}

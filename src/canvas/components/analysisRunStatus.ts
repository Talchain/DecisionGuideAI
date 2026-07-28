/**
 * Wave1-L2 (seam D-M) — which run-status region the dock narrates with.
 *
 * ⚠ REVISED (first-five-minutes cluster) — the previous reconciliation was
 * correct about STACKING and wrong about COVERAGE, and the gap it left fell
 * entirely on first-time users.
 *
 * The dock used to have two ways to speak about an in-flight run:
 *
 *  - `slowRunMessage` — a 20s/40s escalation owned by OutputsDock, the only
 *    narration available while the results skeleton was up (no report yet).
 *  - `AnalysisRunningBanner` — the staged narration, mounted only while a
 *    PREVIOUS report was still on screen.
 *
 * They used to stack from ~20s, so the first fix made the banner win wherever
 * it mounted. But the banner's mount condition was `hasReport`, so the
 * narration a user got depended on whether they had run an analysis BEFORE:
 *
 *  - returning user (report on screen) → staged copy from second 0;
 *  - FIRST run (no report) → nothing at all until 20s, then the slow-run
 *    line — exactly inverted from what a first-time user needs, in the one
 *    session where the 60s+ wait is least explicable.
 *
 * And the copy that survived on that path was the copy the banner's own
 * honesty doctrine had already rejected: `'Taking longer than expected...'`
 * at 20s, when 20-30s IS the typical wait (see NARRATION_STAGES, which drops
 * the comparative family precisely because the client holds no distribution
 * of past run durations to compare against). The Wave1-L2 honesty fix was
 * applied to the banner and never to the region it "subsumed" — and because
 * the subsume only happened where the banner mounted, the un-fixed line was
 * exactly what survived, on exactly the first run.
 *
 * That is the hand-maintained-mirror class: two implementations of one stage
 * table, sharing thresholds by convention, drifting the moment one was fixed.
 *
 * Resolution: there is now ONE narration implementation. The banner mounts
 * for every in-flight run, first or not, and the slow-run message, its timer
 * and its render site are deleted rather than yielded to. Nothing is lost:
 * the banner's stage table carries the same 20s/40s escalation points, from a
 * strictly more honest clock (the run's true `startedAt`, durable across
 * remounts, rather than a ref stamped when an effect happened to fire).
 *
 * The seam stays because the guarantee is still worth expressing structurally:
 * ONE decision, ONE return value, ONE call site drives the render, so "exactly
 * one run-status region" cannot regress into two by local edit.
 */

/** The single run-status region to render, if any. */
export type RunStatusRegion = 'banner' | 'none'

export interface RunStatusInput {
  /** A run is in flight (preparing | connecting | streaming). */
  isRunning: boolean
}

/**
 * Resolve the one region that narrates run status.
 *
 * Deliberately NOT conditioned on whether a previous report is on screen: that
 * condition is what made a first run silent. The banner renders above the
 * results skeleton when there is no report and above the retained report when
 * there is — the same narration either way.
 */
export function runStatusRegion({ isRunning }: RunStatusInput): RunStatusRegion {
  return isRunning ? 'banner' : 'none'
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
 *    "Analysing your decision…". A dock announcement on top would be heard
 *    twice. (This used to read "…and the no-report skeleton carries its own
 *    sr-only loading line" — the yield's cover on the no-report path. That
 *    line is gone: the skeleton is decorative now and the banner mounts on
 *    BOTH paths, so the premise holds through one mechanism instead of two.)
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
 * FIRST runs are a special case with an ASYMMETRY between the two
 * transitions (review-folds C6):
 *
 *  - START: the dock's I.1 auto-switch fronts the Analysis tab whenever
 *    status transitions from idle/cancelled into an active state, so on a
 *    FIRST run the user lands on the Analysis tab (and its furniture) in
 *    the same breath as the start — but the announcer's effect observes
 *    the transition BEFORE the dock's auto-switch effect re-renders, so
 *    its `analysisTabFronted` input is one commit stale. Rather than race
 *    that commit, the rule encodes the auto-switch contract: a start from
 *    idle/cancelled yields unconditionally.
 *  - SETTLE: a FIRST-run settle does NOT yield, even while fronted —
 *    NOTHING else announces it. The completion toast
 *    (AnalysisFreshnessNotice) mounts post-settle with
 *    wasRunningRef = false, so it only fires on RERUNS it watched from the
 *    start; the first run's settle was fully silent before this rule.
 *    Rerun settles keep the yield (the toast genuinely fires there).
 *
 * RERUNS (from complete/error) do not auto-switch — that is exactly the
 * case F9 exists for (rerun dispatched while Compare/Model is fronted
 * stayed silent and frozen) — so there the current frontedness decides.
 *
 * Settle copy never fabricates an outcome: only statuses the store actually
 * settles into ('complete' | 'error' | 'cancelled') get a line; anything
 * else (a reset to 'idle', an unknown value) announces nothing. A settle
 * that restored the OLD report (results.settledWithoutNewReport — abort or
 * timeout) never claims completion: it announces the same honest copy the
 * completion toast uses, from the shared constant below (review-folds C2).
 */

/**
 * The honest resultless-settle copy — ONE constant shared by the
 * AnalysisFreshnessNotice toast and the run announcer so the two surfaces
 * can never drift (review-folds C2).
 */
export const RUN_ENDED_WITHOUT_NEW_RESULTS_COPY =
  'The run ended without new results. Showing your previous analysis.'

export interface RunAnnouncementInput {
  /** Which transition just happened. */
  transition: 'start' | 'settle'
  /** The results status the run settled into (settle transitions only). */
  settledStatus?: string | null
  /**
   * The results status held BEFORE the run started. idle/cancelled marks a
   * FIRST run: its start yields to the auto-switch furniture, but its
   * settle must NOT yield (see the asymmetry above).
   */
  preRunStatus?: string | null
  /** The Analysis tab is fronted (dock open, results tab active). */
  analysisTabFronted: boolean
  /**
   * The settle restored the previous report without new results
   * (results.settledWithoutNewReport — abort/timeout). Settle transitions
   * only.
   */
  settledWithoutNewReport?: boolean
}

export function runAnnouncementForTransition({
  transition,
  settledStatus,
  preRunStatus,
  analysisTabFronted,
  settledWithoutNewReport,
}: RunAnnouncementInput): string | null {
  const firstRun = preRunStatus === 'idle' || preRunStatus === 'cancelled'
  // The C6 asymmetry as ONE expression (/simplify item 8), so the two
  // transitions' yield rules sit side by side and cannot drift:
  //  - START yields when the tab is fronted OR the run is a first run (the
  //    dock's auto-switch is about to front the Analysis tab, whose own
  //    furniture speaks — announcing here would double up).
  //  - SETTLE yields only when fronted AND it is NOT a first run: nothing
  //    else announces a first-run settle (the completion toast mounts
  //    post-settle with wasRunningRef = false).
  const yieldsToTabFurniture =
    transition === 'start' ? analysisTabFronted || firstRun : analysisTabFronted && !firstRun
  if (yieldsToTabFurniture) return null
  if (transition === 'start') return 'Analysis started.'
  // settledStatus is a raw store string — keep the switch. An object lookup
  // would reintroduce the prototype-chain hazard fix set A just closed.
  switch (settledStatus) {
    case 'complete':
      // C2: a settle that carried no new report must not claim completion.
      return settledWithoutNewReport
        ? RUN_ENDED_WITHOUT_NEW_RESULTS_COPY
        : 'Analysis complete.'
    case 'error':
      return 'Analysis failed.'
    case 'cancelled':
      return 'Analysis cancelled.'
    default:
      return null
  }
}

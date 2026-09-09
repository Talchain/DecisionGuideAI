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
 * FIRST runs USED TO BE a special case on BOTH transitions. They are one on
 * the SETTLE transition only (review-folds C6, narrowed 9 Sep 2026):
 *
 *  - START: frontedness alone decides, first run or not. ⚠ This arm used to
 *    carry `|| firstRun`, on the premise that the dock's I.1 auto-switch
 *    fronted the Analysis tab in the same breath as a start from
 *    idle/cancelled, so the rule encoded that contract rather than racing the
 *    commit that would have shown it. THE DEFAULT-TAB RULING DELETED THE
 *    AUTO-SWITCH (`navigatesToAnalysisTab = Boolean(showResultsPanel)`), and
 *    a yield whose premise has been deleted is silence, not deference — see
 *    the note at the predicate itself.
 *  - SETTLE: a FIRST-run settle does NOT yield, even while fronted —
 *    NOTHING else announces it. The completion toast
 *    (AnalysisFreshnessNotice) mounts post-settle with
 *    wasRunningRef = false, so it only fires on RERUNS it watched from the
 *    start; the first run's settle was fully silent before this rule.
 *    Rerun settles keep the yield (the toast genuinely fires there).
 *
 * So on START the current frontedness decides for EVERY run — which is also
 * the case F9 exists for (a rerun dispatched while Compare/Model is fronted
 * stayed silent and frozen); first runs simply stopped being an exception to
 * it once nothing moved the user on their behalf.
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

/**
 * ⭐ THE HONEST EMPTY-RESULT SETTLE — a run that FINISHED and produced a report
 * with nothing renderable in it.
 *
 * ⚠ NOT the same state as `RUN_ENDED_WITHOUT_NEW_RESULTS_COPY`, and the two
 * must not be merged. That one means "no NEW report arrived, you are looking at
 * the previous one". This one means "a new report DID arrive and it carries no
 * value the product can show". A user in the second state has nothing to fall
 * back on, so telling them their previous analysis is showing would be false.
 *
 * The wording deliberately matches `deriveAnalysisDisplayState`'s
 * 'Analysis finished without a result' headline — one vocabulary for one state
 * across the two surfaces, so a rewording of either cannot leave them saying
 * different things about the same run.
 */
export const RUN_FINISHED_WITHOUT_RESULT_COPY = 'Analysis finished without a result.'

export interface RunAnnouncementInput {
  /** Which transition just happened. */
  transition: 'start' | 'settle'
  /** The results status the run settled into (settle transitions only). */
  settledStatus?: string | null
  /**
   * The results status held BEFORE the run started. idle/cancelled marks a
   * FIRST run, which now matters on the SETTLE transition ONLY: a first-run
   * settle must NOT yield, because nothing else announces it. It is
   * deliberately NOT consulted on START any more — see the asymmetry above.
   */
  preRunStatus?: string | null
  /** The Analysis tab is fronted (dock open, results tab active). */
  analysisTabFronted: boolean
  /**
   * Does the settled report carry ANY value the product can render?
   *
   * ⚠ THIS IS NOT `hasReport`, AND THE DIFFERENCE IS THE WHOLE POINT. A report
   * can be POPULATED and carry all-null probabilities — an engine "I tried
   * per-option and failed" state, which is not a result. Measured on build
   * `acd3db4d`: the product announced completion while 5/5 factors and 3/3
   * options read `unmatched`, with no PLoT or ISL leg at all.
   *
   * Optional and DEFAULTS TRUE so a caller that does not know keeps today's
   * behaviour rather than silently claiming emptiness.
   */
  hasRenderableResult?: boolean
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
  hasRenderableResult = true,
}: RunAnnouncementInput): string | null {
  const firstRun = preRunStatus === 'idle' || preRunStatus === 'cancelled'
  // ⚠⚠ THE START ARM LOST ITS `|| firstRun` DISJUNCT ON 9 Sep 2026, BECAUSE
  // THE PREMISE THAT JUSTIFIED IT WAS DELETED. Do not restore it.
  //
  // It read `analysisTabFronted || firstRun`, and this comment stated the
  // premise aloud: *"the dock's auto-switch is about to front the Analysis
  // tab, whose own furniture speaks"*. The default-tab ruling removed that
  // auto-switch — `navigatesToAnalysisTab = Boolean(showResultsPanel)`
  // (`OutputsDock.tsx`) — so a fresh, unchosen session's run start fronts
  // nothing and leaves the user on `analysisNew`.
  //
  // From then on the disjunct yielded to furniture that never arrives, and it
  // did so on the journey that ruling makes DEFAULT. Nothing else covered it:
  // `AnalysisRunStateCover` is visual-only by ruling — `AnalysisRunningBanner`
  // with `announces={false}` omits role/aria-live, and the alternative is an
  // `aria-hidden` skeleton (UI #1198) — and the dock's tab-name live region
  // does not change because the tab does not change. A first run was silent to
  // assistive technology until SETTLE, 20-40s later by this file's own slow-run
  // thresholds, while sighted users watched the cover.
  //
  // The two arms are now symmetrical on frontedness, and `firstRun` survives on
  // the arm where it is still TRUE — the SETTLE arm:
  //  - START yields when the Analysis tab is fronted. Its banner mounts as a
  //    real live region there, so announcing on top would be heard twice.
  //  - SETTLE yields only when fronted AND it is NOT a first run: nothing else
  //    announces a first-run settle (the completion toast mounts post-settle
  //    with wasRunningRef = false).
  const yieldsToTabFurniture =
    transition === 'start' ? analysisTabFronted : analysisTabFronted && !firstRun
  if (yieldsToTabFurniture) return null
  if (transition === 'start') return 'Analysis started.'
  // settledStatus is a raw store string — keep the switch. An object lookup
  // would reintroduce the prototype-chain hazard fix set A just closed.
  switch (settledStatus) {
    case 'complete':
      // C2: a settle that carried no new report must not claim completion.
      if (settledWithoutNewReport) return RUN_ENDED_WITHOUT_NEW_RESULTS_COPY
      // ⭐ AND NEITHER MAY A SETTLE WHOSE NEW REPORT IS EMPTY. `hasReport` and
      // `settledWithoutNewReport` both answer "did a report ARRIVE"; neither
      // answers "does it CONTAIN anything", and this announcement is the
      // surface a user actually hears say the word complete.
      //
      // ORDER MATTERS AND IS DELIBERATE. `settledWithoutNewReport` is the more
      // specific statement — it tells the user their PREVIOUS analysis is
      // showing, which is a real fallback. The empty-result case has no such
      // fallback, so it must not borrow that copy.
      if (!hasRenderableResult) return RUN_FINISHED_WITHOUT_RESULT_COPY
      return 'Analysis complete.'
    case 'error':
      return 'Analysis failed.'
    case 'cancelled':
      return 'Analysis cancelled.'
    default:
      return null
  }
}

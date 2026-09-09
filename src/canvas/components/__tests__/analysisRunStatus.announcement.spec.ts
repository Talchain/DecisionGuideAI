/**
 * F9 (UI brief 2026-07-16 item 3): the single-live-region rule, extended to
 * run START and SETTLE announcements.
 *
 * `runStatusRegion` already guarantees at most one ONGOING narration region
 * (banner vs slow-run) inside the Analysis tab. F9 adds a dock-level
 * announcer so a run is audible from ANY tab. The extension must keep the
 * one-voice invariant: while the Analysis tab is fronted, its own furniture
 * already speaks (the running banner's narration div at start, the
 * completion toast and error alert at settle), so the announcer must yield
 * there. Everywhere else the announcer is the only voice.
 *
 * These cases pin the pure rule; AnalysisRunAnnouncer.spec.tsx pins the
 * component wiring on top of it.
 */
import { describe, it, expect } from 'vitest'

import * as analysisRunStatus from '../analysisRunStatus'

// Typed indirection keeps this spec compiling RED-first (the export does not
// exist yet); the assertions below fail loudly until it lands.
const runAnnouncementForTransition = (
  analysisRunStatus as unknown as {
    runAnnouncementForTransition?: (input: {
      transition: 'start' | 'settle'
      settledStatus?: string | null
      preRunStatus?: string | null
      analysisTabFronted: boolean
      settledWithoutNewReport?: boolean
    }) => string | null
  }
).runAnnouncementForTransition

// Review-folds C2: the honest resultless-settle copy, shared with the
// AnalysisFreshnessNotice toast so the two can never drift.
const RUN_ENDED_WITHOUT_NEW_RESULTS_COPY = (
  analysisRunStatus as unknown as { RUN_ENDED_WITHOUT_NEW_RESULTS_COPY?: string }
).RUN_ENDED_WITHOUT_NEW_RESULTS_COPY

describe('F9: runAnnouncementForTransition (one voice per transition)', () => {
  it('is exported from the analysisRunStatus module (the single-live-region rule lives in ONE place)', () => {
    expect(typeof runAnnouncementForTransition).toBe('function')
  })

  it('announces a RERUN start when the Analysis tab is NOT fronted', () => {
    expect(
      runAnnouncementForTransition!({
        transition: 'start',
        preRunStatus: 'complete',
        analysisTabFronted: false,
      }),
    ).toBe('Analysis started.')
    expect(
      runAnnouncementForTransition!({
        transition: 'start',
        preRunStatus: 'error',
        analysisTabFronted: false,
      }),
    ).toBe('Analysis started.')
  })

  it('yields run start to the Analysis tab furniture when it is fronted (the narration div already speaks)', () => {
    expect(
      runAnnouncementForTransition!({
        transition: 'start',
        preRunStatus: 'complete',
        analysisTabFronted: true,
      }),
    ).toBeNull()
  })

  /**
   * ⚠⚠ INVERTED 9 Sep 2026 (UI #1403 blocking review) — DO NOT READ THE OLD
   * ASSERTION BACK IN.
   *
   * This case read `yields a FIRST-run start unconditionally: the dock
   * auto-switch fronts the Analysis tab in the same breath`, and asserted
   * `null` for both idle and cancelled at `analysisTabFronted: false`. It was
   * TRUE, and correct, for as long as its premise held.
   *
   * The premise was the dock's I.1 run-start auto-switch. The default-tab
   * ruling removed it — `navigatesToAnalysisTab = Boolean(showResultsPanel)`
   * (`OutputsDock.tsx`), so a fresh, unchosen session's run start fronts
   * nothing and leaves the user where they are. With the premise gone, the
   * `|| firstRun` disjunct in the START arm was yielding to furniture that
   * never arrives, and a first run started from Reasoning / Model / Compare
   * was announced by NOBODY: `AnalysisRunStateCover` is visual-only by ruling
   * (`AnalysisRunningBanner` with `announces={false}`, or an `aria-hidden`
   * skeleton — UI #1198), and the tab-name live region does not change
   * because the tab does not change. Sighted users saw the cover; assistive
   * technology heard silence until the SETTLE, 20–40s later.
   *
   * The START arm now yields on `analysisTabFronted` alone, symmetrical with
   * the SETTLE arm's `analysisTabFronted && !firstRun`. `firstRun` remains a
   * real discriminator — on SETTLE only, where it still earns its keep.
   */
  it('announces a FIRST-run start when the Analysis tab is NOT fronted (nothing fronts it any more)', () => {
    expect(
      runAnnouncementForTransition!({
        transition: 'start',
        preRunStatus: 'idle',
        analysisTabFronted: false,
      }),
    ).toBe('Analysis started.')
    expect(
      runAnnouncementForTransition!({
        transition: 'start',
        preRunStatus: 'cancelled',
        analysisTabFronted: false,
      }),
    ).toBe('Analysis started.')
  })

  /**
   * ⭐ THE JOURNEY THE DEFAULT-TAB RULING MAKES DEFAULT, pinned by name.
   *
   * The case above states the rule; this one states the USER PATH the rule
   * exists for, so a later reader cannot price the population as "a minority
   * path". Fresh session, nothing chosen, `showResultsPanel` false → the dock
   * fronts `analysisNew`. The user presses Run. This is now the ORDINARY first
   * run, not an edge case, and it must be audible.
   */
  it('announces the fresh-session first run started from the Reasoning tab (the default surface, not an edge case)', () => {
    expect(
      runAnnouncementForTransition!({
        transition: 'start',
        // A fresh session has never run: the store sits at 'idle'.
        preRunStatus: 'idle',
        // The dock fronts `analysisNew`, so the Analysis tab is NOT fronted.
        analysisTabFronted: false,
      }),
    ).toBe('Analysis started.')
  })

  /**
   * ⭐ THE OPPOSITE-DIRECTION TWIN — the fix must not trade a silence for a
   * DOUBLE announcement.
   *
   * Where the Analysis tab IS fronted, its running banner mounts as a real
   * live region (`AnalysisRunningBanner` with `announces` defaulting true —
   * see `AnalysisRunStateCover`'s `contentRetained` path and the Analysis
   * tab's own mount). A dock announcement on top of it would be heard twice.
   * The START arm keeps yielding there, first run or not.
   *
   * Paired with the case above this is a DISCRIMINATING pair: the fix changes
   * the answer for `analysisTabFronted: false` and must leave
   * `analysisTabFronted: true` exactly as it was.
   */
  it('still yields a FIRST-run start while the Analysis tab IS fronted (its banner is the voice there)', () => {
    expect(
      runAnnouncementForTransition!({
        transition: 'start',
        preRunStatus: 'idle',
        analysisTabFronted: true,
      }),
    ).toBeNull()
    expect(
      runAnnouncementForTransition!({
        transition: 'start',
        preRunStatus: 'cancelled',
        analysisTabFronted: true,
      }),
    ).toBeNull()
  })

  it('announces completion when the Analysis tab is NOT fronted', () => {
    expect(
      runAnnouncementForTransition!({
        transition: 'settle',
        settledStatus: 'complete',
        analysisTabFronted: false,
      }),
    ).toBe('Analysis complete.')
  })

  it('yields a RERUN settle to the Analysis tab furniture when it is fronted (the completion toast already speaks)', () => {
    expect(
      runAnnouncementForTransition!({
        transition: 'settle',
        settledStatus: 'complete',
        preRunStatus: 'complete',
        analysisTabFronted: true,
      }),
    ).toBeNull()
  })

  // Review-folds C6: on a FIRST run (preRunStatus idle/cancelled) NOTHING
  // else announces the settle — AnalysisFreshnessNotice mounts post-settle
  // with wasRunningRef=false, so its toast never fires. The settle must NOT
  // yield there, even though the Analysis tab is fronted (the auto-switch
  // fronted it at start). Rerun settles keep the yield (the toast genuinely
  // fires there).
  it('does NOT yield a FIRST-run settle to the fronted Analysis tab (nothing else announces it)', () => {
    expect(
      runAnnouncementForTransition!({
        transition: 'settle',
        settledStatus: 'complete',
        preRunStatus: 'idle',
        analysisTabFronted: true,
      }),
    ).toBe('Analysis complete.')
    expect(
      runAnnouncementForTransition!({
        transition: 'settle',
        settledStatus: 'complete',
        preRunStatus: 'cancelled',
        analysisTabFronted: true,
      }),
    ).toBe('Analysis complete.')
  })

  // Review-folds C2: a settle that restored the OLD report (abort/timeout —
  // settledWithoutNewReport) must never claim "Analysis complete." — it
  // announces the same honest copy the completion toast uses, from ONE
  // shared constant so the two can never drift.
  it('exports the honest resultless-settle copy as a shared constant (the toast reuses it verbatim)', () => {
    expect(RUN_ENDED_WITHOUT_NEW_RESULTS_COPY).toBe(
      'The run ended without new results. Showing your previous analysis.',
    )
  })

  it('announces the honest copy — never "Analysis complete." — on a resultless settle', () => {
    const announcement = runAnnouncementForTransition!({
      transition: 'settle',
      settledStatus: 'complete',
      preRunStatus: 'complete',
      analysisTabFronted: false,
      settledWithoutNewReport: true,
    })
    expect(announcement).toBe(RUN_ENDED_WITHOUT_NEW_RESULTS_COPY)
    expect(announcement).not.toBe('Analysis complete.')
  })

  it('a resultless FIRST-run settle announces the honest copy even while fronted (C2 + C6 together)', () => {
    expect(
      runAnnouncementForTransition!({
        transition: 'settle',
        settledStatus: 'complete',
        preRunStatus: 'idle',
        analysisTabFronted: true,
        settledWithoutNewReport: true,
      }),
    ).toBe(RUN_ENDED_WITHOUT_NEW_RESULTS_COPY)
  })

  it('announces failure honestly when the Analysis tab is NOT fronted', () => {
    expect(
      runAnnouncementForTransition!({
        transition: 'settle',
        settledStatus: 'error',
        analysisTabFronted: false,
      }),
    ).toBe('Analysis failed.')
  })

  it('announces cancellation when the Analysis tab is NOT fronted', () => {
    expect(
      runAnnouncementForTransition!({
        transition: 'settle',
        settledStatus: 'cancelled',
        analysisTabFronted: false,
      }),
    ).toBe('Analysis cancelled.')
  })

  it('says nothing for a settle into an unrecognised or reset status (never fabricate an outcome)', () => {
    expect(
      runAnnouncementForTransition!({
        transition: 'settle',
        settledStatus: 'idle',
        analysisTabFronted: false,
      }),
    ).toBeNull()
    expect(
      runAnnouncementForTransition!({
        transition: 'settle',
        settledStatus: null,
        analysisTabFronted: false,
      }),
    ).toBeNull()
  })
})

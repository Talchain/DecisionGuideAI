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
      willFrontAnalysisTab?: boolean
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

/**
 * ⭐⭐ THE PREDICATE'S DOMAIN, ENUMERATED — added 10 Sep 2026 after this one
 * rule was got wrong TWICE by reasoning from the cases in hand.
 *
 * Round 1 read `analysisTabFronted || firstRun` and went silent on a fresh
 * session. Round 2 dropped the disjunct and DOUBLED the announcement for
 * anyone whose run start carries a navigation. Both rounds were correct about
 * the population they named and blind to the other, and the reason is that
 * every case in this file shared ONE value of the variable that selects the
 * harm: whether anything was about to front the Analysis tab.
 *
 * ⚠ AND THE POPULATION LABELS BOTH ROUNDS USED WERE THE WRONG AXIS. The
 * blocking review framed it as fresh-vs-returning, via localStorage
 * `ui.showResultsPanel`. That is ONE instance. Derived at the bytes 10 Sep:
 * `ReactFlowGraph.tsx:1446` — the ⌘Enter Run shortcut — calls
 * `setShowResultsPanel(true)` in the same synchronous gesture as
 * `executeCanonicalRun`, and so do the palette's `action:results`
 * (`usePalette.ts:269,316`), ⌘/Ctrl+3 (`ReactFlowGraph.tsx:1034`) and the
 * template insert (`CanvasMVP.tsx:132`). So a run start carries a navigation
 * intent for a COMPLETELY FRESH session with empty localStorage, and for
 * RERUNS as well as first runs — which `|| firstRun` never covered either.
 *
 * The axis is therefore not WHO the user is. It is: WILL THE ANALYSIS TAB BE
 * FRONTED AS A RESULT OF THIS RUN START? Frontedness-right-now cannot answer
 * it, because `analysisTabFronted` is one commit stale at START by
 * construction (`OutputsDock.tsx:2063-2074` moves the tab in the effect
 * flush that the announcer's own effect runs inside — and as a child, the
 * announcer's effect runs FIRST).
 *
 * These four cases are the complete cross-product of the two signals, each
 * pinning its own precondition, each asserting EXACTLY ONE voice. "Announces"
 * and "announces twice" are different outcomes and the old suite could not
 * tell them apart.
 */
describe('runAnnouncementForTransition START: one voice per POPULATION, not per boolean', () => {
  /**
   * The voice count, derived from the population's own inputs rather than
   * asserted in a comment.
   *
   *  - the announcer speaks iff the rule returns a string;
   *  - the Analysis tab's running banner is a real live region iff that tab
   *    is fronted now OR is about to be fronted by this very run start
   *    (`AnalysisRunningBanner.tsx:169` attaches role/aria-live when
   *    `announces`; the `AnalysisRunStateCover` variant on every other
   *    surface passes `announces={false}` and is visual-only by ruling).
   *
   * Summing them is what distinguishes silence (0) from a double (2).
   */
  function startVoices(input: {
    preRunStatus: string
    analysisTabFronted: boolean
    willFrontAnalysisTab: boolean
  }): { total: number; announcer: string | null; tabFurniture: boolean } {
    const announcer = runAnnouncementForTransition!({
      transition: 'start',
      preRunStatus: input.preRunStatus,
      analysisTabFronted: input.analysisTabFronted,
      willFrontAnalysisTab: input.willFrontAnalysisTab,
    })
    const tabFurniture = input.analysisTabFronted || input.willFrontAnalysisTab
    return {
      total: (announcer === null ? 0 : 1) + (tabFurniture ? 1 : 0),
      announcer,
      tabFurniture,
    }
  }

  /**
   * POPULATION 1 — FRESH / UNCHOSEN, run pressed on the DOCK's own Run
   * control. `ui.showResultsPanel` is false (its store default,
   * `store.ts:2733`) and the dock's Run control never raises it: OutputsDock's
   * only writers are `:2137`/`:2417` (both `false`) and the tab-click sync at
   * `:2456`/`:2518`. So nothing fronts the Analysis tab, and the announcer is
   * the only voice there is. This is the journey the default-tab ruling makes
   * DEFAULT, and round 1 left it silent for 20-40s.
   */
  it('POPULATION fresh/unchosen (nothing will front Analysis): the announcer is the ONE voice', () => {
    const v = startVoices({
      preRunStatus: 'idle',
      analysisTabFronted: false,
      willFrontAnalysisTab: false,
    })
    // PRECONDITION, PINNED IN-TEST: this population really has no tab
    // furniture, so a silent announcer here is silence, not deference.
    expect(v.tabFurniture, 'population precondition broken: something fronts Analysis').toBe(false)
    expect(v.announcer).toBe('Analysis started.')
    expect(v.total, 'exactly one voice — not zero (round 1) and not two').toBe(1)
  })

  /**
   * POPULATION 2 — A RUN START THAT CARRIES A NAVIGATION. ⌘Enter from
   * Reasoning / Model / Compare, the palette's `action:results`, ⌘/Ctrl+3, a
   * template insert, or a new browser session rehydrating `showResultsPanel`
   * from localStorage while the dock tab comes from the EMPTY sessionStorage
   * (`useDockState.ts:12` — different storage scopes, so they genuinely
   * diverge).
   *
   * `analysisTabFronted` reads FALSE here and that reading is unreliable by
   * construction: the navigation is scheduled in the same effect flush. The
   * banner mounts one commit later as a real live region and speaks. Round 2
   * announced on top of it.
   */
  it('POPULATION navigation-in-flight (Analysis is ABOUT to be fronted): the banner is the ONE voice', () => {
    const v = startVoices({
      preRunStatus: 'idle',
      analysisTabFronted: false,
      willFrontAnalysisTab: true,
    })
    // PRECONDITION, PINNED IN-TEST: the stale reading really is false, which
    // is the whole reason frontedness-alone cannot serve.
    expect(v.tabFurniture, 'population precondition broken: nothing will front Analysis').toBe(true)
    expect(v.announcer, 'the banner speaks one commit later — announcing here is the double').toBeNull()
    expect(v.total, 'exactly one voice — not two (round 2)').toBe(1)
  })

  /**
   * POPULATION 2b — THE SAME NAVIGATION ON A RERUN. `|| firstRun` never
   * covered this cell, so the double was reachable before round 2 as well for
   * anyone who pressed ⌘Enter from Compare with a report already on screen.
   * Pinned separately so a future reader cannot price it as a first-run-only
   * concern and reintroduce a `firstRun` conjunct.
   */
  it('POPULATION navigation-in-flight on a RERUN (the cell `|| firstRun` never covered)', () => {
    const v = startVoices({
      preRunStatus: 'complete',
      analysisTabFronted: false,
      willFrontAnalysisTab: true,
    })
    expect(v.announcer).toBeNull()
    expect(v.total).toBe(1)
  })

  /**
   * POPULATION 3 — ALREADY ON ANALYSIS. The steady state, unchanged by either
   * round: the banner is on screen as a live region, so the announcer yields.
   * Kept as the discriminating twin of populations 1 and 2 — without it,
   * "announce when not fronted" could be satisfied by an unconditional arm.
   */
  it('POPULATION already-fronted: the banner is the ONE voice, first run or rerun', () => {
    for (const preRunStatus of ['idle', 'cancelled', 'complete', 'error']) {
      const withIntent = startVoices({
        preRunStatus,
        analysisTabFronted: true,
        willFrontAnalysisTab: true,
      })
      // POPULATION 4, the fourth cell: fronted with the intent already
      // cleared (reachable via `OutputsDock.tsx:2417`'s floating-Olumi path
      // and the 2.204 return at `:2131`, both of which set it false).
      const withoutIntent = startVoices({
        preRunStatus,
        analysisTabFronted: true,
        willFrontAnalysisTab: false,
      })
      expect(withIntent.announcer, `fronted + intent, preRunStatus=${preRunStatus}`).toBeNull()
      expect(withoutIntent.announcer, `fronted, no intent, preRunStatus=${preRunStatus}`).toBeNull()
      expect(withIntent.total).toBe(1)
      expect(withoutIntent.total).toBe(1)
    }
  })

  /**
   * ⚠ THE SIGNAL DEFAULTS TO FALSE, AND THE DIRECTION IS DELIBERATE. A caller
   * that does not know whether a navigation is pending must fall back to
   * SPEAKING, never to silence: an extra announcement is a nuisance, an
   * unannounced run is inaccessible. Pins the optionality so a later change
   * cannot flip the default and buy a silence by omission.
   */
  it('omitting willFrontAnalysisTab falls back to ANNOUNCING, never to silence', () => {
    expect(
      runAnnouncementForTransition!({
        transition: 'start',
        preRunStatus: 'idle',
        analysisTabFronted: false,
      }),
    ).toBe('Analysis started.')
  })

  /**
   * ⚠ THE SETTLE ARM MUST NOT CONSUME THIS SIGNAL. By settle time the
   * navigation has long since committed, so `willFrontAnalysisTab` carries no
   * information about who speaks — and the SETTLE arm's own discriminator
   * (`firstRun`) is still doing real work there. If a later edit threads the
   * new signal into SETTLE "for symmetry", this REDs.
   */
  it('SETTLE ignores willFrontAnalysisTab entirely (its discriminator is firstRun)', () => {
    for (const willFrontAnalysisTab of [true, false]) {
      // A first-run settle never yields — nothing else announces it.
      expect(
        runAnnouncementForTransition!({
          transition: 'settle',
          settledStatus: 'complete',
          preRunStatus: 'idle',
          analysisTabFronted: true,
          willFrontAnalysisTab,
        }),
      ).toBe('Analysis complete.')
      // A rerun settle yields while fronted — the completion toast fires.
      expect(
        runAnnouncementForTransition!({
          transition: 'settle',
          settledStatus: 'complete',
          preRunStatus: 'complete',
          analysisTabFronted: true,
          willFrontAnalysisTab,
        }),
      ).toBeNull()
    }
  })
})

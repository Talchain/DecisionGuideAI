/**
 * `shouldRenderFirstUseRail` — the rule deciding whether the OutputsDock renders
 * as its 40px rail or claims its full width — and `resolveDockWidthForAnalysisState`,
 * the width rule that is its other half.
 *
 * Written against the STATED RULE, not against the 1280x800 measurement that
 * motivated it — the measurement is evidence for the rule, and a spec pinned to
 * the measurement would go stale the moment the viewport or the graph changed
 * while the rule stayed correct.
 *
 * ⚠⚠ THE RULE HAS NOW FLIPPED TWICE IN ONE DAY, AND THIS FILE RECORDS BOTH.
 * Until 16 Aug the input was `!hasGraphContent`. #728 replaced it with
 * `!hasAnalysisResult`, because a drafted model expanded the dock to show an
 * Analysis tab containing no analysis and cost the canvas 361px of fit padding.
 * **Ruling R1 (Paul, 16 Aug) overturns that**: the right panel is visible
 * immediately when the model appears, and starts NARROW so the graph keeps
 * priority. The veto was about VISIBILITY; the 843px measurement was about
 * WIDTH; R1 answers the second with width rather than with hiding.
 *
 * So the rail input is model content again — AND the width half is now a real
 * rule rather than an implicit "full width or nothing". The two are a PAIR: the
 * predicate tests below are honest only because the width tests below them
 * exist. Delete either and the 843px clamp comes back.
 */

import { describe, it, expect } from 'vitest'
import {
  shouldRenderFirstUseRail,
  forcedActivationEndsRail,
  resolveDockWidthForAnalysisState,
} from '../OutputsDock'
import { DOCK_MIN_WIDTH, resolveDockWidth } from '../dockWidth'

describe('shouldRenderFirstUseRail', () => {
  const base = {
    aiPanelV2On: true,
    hasModelContent: false,
    analysisActive: false,
    userExplicitlyOpened: false,
  }

  it('rails when there is no model yet', () => {
    expect(shouldRenderFirstUseRail(base)).toBe(true)
  })

  it('R1: releases the rail as soon as a MODEL exists, analysis or not', () => {
    // THE RULING, and the discriminating case against the rule this replaced.
    // A drafted-but-never-analysed session is exactly the state #728 railed and
    // Paul vetoed: the panel must be visible the moment the model appears.
    expect(shouldRenderFirstUseRail({ ...base, hasModelContent: true })).toBe(false)
  })

  it('releases the rail on an explicit open, model or not', () => {
    // The override is unconditional by design: the rail's chevron, a started
    // run, and the collapsed-response signal all raise it, and none of them
    // should be second-guessed by this rule.
    expect(shouldRenderFirstUseRail({ ...base, userExplicitlyOpened: true })).toBe(false)
    expect(
      shouldRenderFirstUseRail({ ...base, hasModelContent: true, userExplicitlyOpened: true }),
    ).toBe(false)
  })

  it('releases the rail while a run is IN FLIGHT, before any model is on canvas', () => {
    // The reachable case this input exists for: a run that is ALREADY active
    // when the dock mounts (page reload mid-analysis, resumed session) never
    // fires the idle→active transition the run-start override rides, so without
    // this the user would watch their running analysis from behind the rail.
    expect(shouldRenderFirstUseRail({ ...base, analysisActive: true })).toBe(false)
  })

  it('never rails when aiPanelV2 is off', () => {
    // The rail is a floating-first-UX affordance; with the flag off the legacy
    // dock owns its own open state and this rule must be inert. Swept over
    // every combination of the other two inputs so the claim is about the flag,
    // not about the one combination that happened to be tried.
    for (const hasModelContent of [true, false]) {
      for (const analysisActive of [true, false]) {
        for (const userExplicitlyOpened of [true, false]) {
          expect(
            shouldRenderFirstUseRail({
              aiPanelV2On: false,
              hasModelContent,
              analysisActive,
              userExplicitlyOpened,
            }),
            `aiPanelV2Off/${hasModelContent}/${analysisActive}/${userExplicitlyOpened}`,
          ).toBe(false)
        }
      }
    }
  })

  it('is NOT a function of whether an analysis has run — the input R1 removed', () => {
    // A DISCRIMINATING assertion, not a restatement. The signature no longer
    // admits an analysis-result input at all, so the only way to observe the
    // difference is that a model with NO analysis releases the rail — the exact
    // combination the previous rule railed. If someone reintroduces a
    // has-analysis input, this is the test that has to be deleted to do it.
    const draftedButNotAnalysed = {
      aiPanelV2On: true,
      hasModelContent: true,
      analysisActive: false,
      userExplicitlyOpened: false,
    }
    expect(shouldRenderFirstUseRail(draftedButNotAnalysed)).toBe(false)
    expect(Object.keys(draftedButNotAnalysed)).not.toContain('hasAnalysisResult')
  })
})

describe('resolveDockWidthForAnalysisState — R1\'s "starts NARROW" half', () => {
  // 1280x800 is the viewport the 843px clamp was measured at, so it is the
  // width at which the pair has to hold.
  const VIEWPORT = 1280

  it('opens NARROW while no analysis exists', () => {
    // The claim is "narrow", and narrow is defined as the module's own usable
    // floor — not a fresh constant, which would be a second authority on the
    // same question and would drift from the bound the drag path clamps to.
    expect(
      resolveDockWidthForAnalysisState({
        viewportWidth: VIEWPORT,
        storedWidth: null,
        hasAnalysisResult: false,
      }),
    ).toBe(DOCK_MIN_WIDTH)
  })

  it('widens to the normal responsive width once an analysis exists', () => {
    // DISCRIMINATING PAIR with the case above: same viewport, same absence of a
    // stored width, opposite analysis state, and the widths must DIFFER. A
    // mutant that returns the full width in both cases passes the first test
    // only if the floor happens to equal the responsive width — which at this
    // viewport it does not, and that is asserted rather than assumed.
    const full = resolveDockWidthForAnalysisState({
      viewportWidth: VIEWPORT,
      storedWidth: null,
      hasAnalysisResult: true,
    })
    expect(full).toBe(resolveDockWidth(VIEWPORT, null))
    expect(full).toBeGreaterThan(DOCK_MIN_WIDTH)
  })

  it('never overrides a width the user set for themselves', () => {
    // Someone who has dragged the dock has given a direct instruction.
    // Narrowing it under them because an analysis has not run yet is the
    // product overruling the user, and no layout ruling asks for that.
    const stored = 460
    expect(
      resolveDockWidthForAnalysisState({
        viewportWidth: VIEWPORT,
        storedWidth: stored,
        hasAnalysisResult: false,
      }),
    ).toBe(resolveDockWidth(VIEWPORT, stored))
  })

  it('never returns a width below the usable floor, at any viewport', () => {
    // Swept, because the narrow arm is a `Math.min` and a `min` against a
    // pathologically small viewport is exactly where a floor gets lost.
    for (const viewportWidth of [320, 768, 1024, 1280, 1600, 2560]) {
      for (const hasAnalysisResult of [true, false]) {
        expect(
          resolveDockWidthForAnalysisState({ viewportWidth, storedWidth: null, hasAnalysisResult }),
          `${viewportWidth}/${hasAnalysisResult}`,
        ).toBeGreaterThanOrEqual(DOCK_MIN_WIDTH)
      }
    }
  })
})

describe('forcedActivationEndsRail', () => {
  it('ends the rail for a forced OLUMI activation — the class-8 reveal', () => {
    // Revealing a thread the user cannot see is meaningless behind a 40px rail.
    expect(forcedActivationEndsRail(true, 'olumi')).toBe(true)
  })

  it('does NOT end the rail for a forced RESULTS activation', () => {
    // Kept after R1, and deliberately. R1 changed WHICH input ends the rail; it
    // did not make every programmatic tab switch an implicit user intent, and
    // `userExplicitlyOpened` is a session-scoped override that, once raised,
    // wins outright. Letting a forced 'results' raise it would hand that
    // permanent override to a navigation event.
    expect(forcedActivationEndsRail(true, 'results')).toBe(false)
  })

  it('ends the rail for no other tab', () => {
    // Swept rather than sampled: 'results' is the one that actually bit, but the
    // claim is about every non-Olumi tab, and a future forced activation of any
    // of these must not silently re-open the dock either.
    for (const tab of ['results', 'compare', 'diagnostics', 'journey']) {
      expect(forcedActivationEndsRail(true, tab), tab).toBe(false)
    }
  })

  it('requires the version counter to have changed', () => {
    // A plain `setActiveOutputTab` does not bump the counter, and must leave a
    // dock the user collapsed for themselves exactly where they put it.
    expect(forcedActivationEndsRail(false, 'olumi')).toBe(false)
  })
})

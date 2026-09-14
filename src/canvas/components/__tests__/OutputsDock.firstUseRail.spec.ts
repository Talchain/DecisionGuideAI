/**
 * `shouldRenderFirstUseRail` — the rule deciding whether the OutputsDock renders
 * as its 40px rail or claims its full width.
 *
 * ⚠ It once had a width companion, `resolveDockWidthForAnalysisState`. That is
 * DELETED (17 Aug 2026) and the last block in this file pins its absence; the
 * width itself is pinned against the mounted dock in
 * `OutputsDock.dockWidth.dom.spec.tsx`.
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
 * So the rail input is model content again. R1's VISIBILITY half stands and is
 * pinned below. Its WIDTH half — narrow until an analysis exists — is
 * withdrawn: it was buying a graph legibility that the fit box never reaches
 * at ANY dock width (760 / 843 / 896 against a 1008px requirement), at the
 * price of 35% of the panel's content budget. The two were briefed as a pair;
 * only one of them was doing anything.
 */

import { describe, it, expect } from 'vitest'
import { shouldRenderFirstUseRail, forcedActivationEndsRail } from '../OutputsDock'
// Namespace import as well as the named ones: the withdrawal block below binds
// to the module's EXPORT LIST by identity, which a named import cannot express
// (a named import of a deleted symbol is a compile error, not an assertion).
import * as OutputsDockModule from '../OutputsDock'
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

describe('the WIDTH half is withdrawn — the dock has no analysis-state input at all', () => {
  // ⚠ THIS BLOCK REPLACES FOUR TESTS OF `resolveDockWidthForAnalysisState`,
  // WHICH IS DELETED (17 Aug 2026). Those tests were correct about the rule
  // they pinned; the rule was the defect. It clamped the dock to
  // `dockWidthBounds().min` — an UNCONDITIONAL 280 — until an analysis
  // existed, so the pre-analysis dock was 280px at 1280, at 1920 and at 3840
  // alike, a 35% cut in content budget, in exchange for graph legibility that
  // the fit-box arithmetic shows was never available at any dock width.
  //
  // Coverage is not dropped, it MOVES, and it moves UP a level: the width is
  // now pinned against the MOUNTED dock in
  // `OutputsDock.dockWidth.dom.spec.tsx`, where a pure helper cannot be
  // correct-in-isolation while the component does something else. What stays
  // HERE is the claim this file is the right home for: the rail predicate and
  // the width rule no longer share an input.

  const VIEWPORT = 1280

  it('the module exports no analysis-state width rule', () => {
    // Bound by IDENTITY to the export name, not to a behaviour another
    // function could satisfy. Reintroducing the clamp means reintroducing this
    // symbol (or a renamed twin — see the sibling assertion below), and this
    // is the test that has to be deleted to do it.
    expect(Object.keys(OutputsDockModule)).not.toContain('resolveDockWidthForAnalysisState')
    // CONTRAST CONTROL: the same probe DOES see the exports that are still
    // here, so a zero here is real absence rather than a blind instrument.
    expect(Object.keys(OutputsDockModule)).toContain('shouldRenderFirstUseRail')
    expect(Object.keys(OutputsDockModule)).toContain('forcedActivationEndsRail')
  })

  it('no exported width rule takes an analysis-state argument under any name', () => {
    // The rename escape hatch, closed. A twin called
    // `resolveDockWidthForRunState` would satisfy the assertion above and
    // reopen the defect, so this sweeps every export whose name mentions width
    // and asserts none of them exists. Written against the CLASS, not the one
    // identifier that happened to bite.
    const widthExports = Object.keys(OutputsDockModule).filter((k) => /width/i.test(k))
    expect(widthExports).toEqual([])
  })

  it('the surviving width authority is a function of viewport and stored width ONLY', () => {
    // `resolveDockWidth` is the whole rule now. Its signature admits no
    // analysis input, and at the founder-facing viewport it returns the
    // restored default rather than the drag floor.
    expect(resolveDockWidth(VIEWPORT, null)).toBe(416)
    expect(resolveDockWidth(VIEWPORT, null)).toBeGreaterThan(DOCK_MIN_WIDTH)
    expect(resolveDockWidth.length).toBe(2)
  })

  it('280 survives as the floor a manual drag clamps to — a floor, never a default', () => {
    // The containment boundary. Removing the clamp must not remove the bound:
    // a user may still drag the dock to 280, and a stored width below it is
    // still raised to it.
    expect(resolveDockWidth(VIEWPORT, 280)).toBe(DOCK_MIN_WIDTH)
    expect(resolveDockWidth(VIEWPORT, 120)).toBe(DOCK_MIN_WIDTH)
    // …and the product does not choose it: same viewport, no stored width.
    expect(resolveDockWidth(VIEWPORT, null)).not.toBe(DOCK_MIN_WIDTH)
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

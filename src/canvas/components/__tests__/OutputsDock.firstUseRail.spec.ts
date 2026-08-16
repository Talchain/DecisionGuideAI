/**
 * `shouldRenderFirstUseRail` — the rule deciding whether the OutputsDock renders
 * as its 40px rail or claims its full width.
 *
 * Written against the STATED RULE ("the dock is a rail until it has outputs to
 * show, unless something has explicitly opened it"), not against the 1280x800
 * measurement that motivated the change — the measurement is evidence for the
 * rule, and a spec pinned to the measurement would go stale the moment the
 * viewport or the graph changed while the rule stayed correct.
 *
 * The behaviour change this pins: the input used to be "does a graph exist",
 * so a drafted model expanded the dock to show an Analysis tab containing no
 * analysis. It is now "does an analysis RESULT exist".
 */

import { describe, it, expect } from 'vitest'
import { shouldRenderFirstUseRail, forcedActivationEndsRail } from '../OutputsDock'

describe('shouldRenderFirstUseRail', () => {
  const base = {
    aiPanelV2On: true,
    hasAnalysisResult: false,
    analysisActive: false,
    userExplicitlyOpened: false,
  }

  it('rails when there is no analysis result yet', () => {
    expect(shouldRenderFirstUseRail(base)).toBe(true)
  })

  it('releases the rail once an analysis result exists', () => {
    expect(shouldRenderFirstUseRail({ ...base, hasAnalysisResult: true })).toBe(false)
  })

  it('releases the rail on an explicit open, result or not', () => {
    // The override is unconditional by design: the rail's chevron, a started
    // run, and the collapsed-response signal all raise it, and none of them
    // should be second-guessed by this rule.
    expect(shouldRenderFirstUseRail({ ...base, userExplicitlyOpened: true })).toBe(false)
    expect(
      shouldRenderFirstUseRail({ ...base, hasAnalysisResult: true, userExplicitlyOpened: true }),
    ).toBe(false)
  })

  it('releases the rail while a run is IN FLIGHT, before any result exists', () => {
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
    for (const hasAnalysisResult of [true, false]) {
      for (const analysisActive of [true, false]) {
        for (const userExplicitlyOpened of [true, false]) {
          expect(
            shouldRenderFirstUseRail({
              aiPanelV2On: false,
              hasAnalysisResult,
              analysisActive,
              userExplicitlyOpened,
            }),
            `aiPanelV2Off/${hasAnalysisResult}/${analysisActive}/${userExplicitlyOpened}`,
          ).toBe(false)
        }
      }
    }
  })

  it('is NOT a function of graph content — the defect this replaced', () => {
    // A DISCRIMINATING assertion, not a restatement: the old rule released the
    // rail as soon as nodes existed. The signature no longer admits graph
    // content at all, so the only way to observe the difference is that a
    // drafted-but-unanalysed session — every input the old rule would have
    // flipped on — still rails. If someone reintroduces a node-count input,
    // this is the test that has to be deleted to do it.
    const draftedButNotAnalysed = {
      aiPanelV2On: true,
      hasAnalysisResult: false,
      analysisActive: false,
      userExplicitlyOpened: false,
    }
    expect(shouldRenderFirstUseRail(draftedButNotAnalysed)).toBe(true)
    expect(Object.keys(draftedButNotAnalysed)).not.toContain('hasGraphContent')
  })
})

describe('forcedActivationEndsRail', () => {
  it('ends the rail for a forced OLUMI activation — the class-8 reveal', () => {
    // Revealing a thread the user cannot see is meaningless behind a 40px rail.
    expect(forcedActivationEndsRail(true, 'olumi')).toBe(true)
  })

  it('does NOT end the rail for a forced RESULTS activation — the measured regression', () => {
    // THE DISCRIMINATING CASE. `FirstUseComposer` forces 'results' on the 0→N
    // draft transition, so a rule that fired on any forced tab let the DRAFT
    // clear the rail: the dock re-claimed its full width with no analysis in it
    // and the post-draft fit returned to the clamped 843px this lane removes.
    // The full suite was green with that defect present — it is a two-effect
    // interaction no unit test saw — so this case is the pin.
    expect(forcedActivationEndsRail(true, 'results')).toBe(false)
  })

  it('ends the rail for no other tab', () => {
    // Swept rather than sampled: 'results' is the one that actually bit, but the
    // claim is about every non-Olumi tab, and a future forced activation of any
    // of these must not silently re-open the dock either.
    for (const tab of ['results', 'altview', 'compare', 'diagnostics', 'journey']) {
      expect(forcedActivationEndsRail(true, tab), tab).toBe(false)
    }
  })

  it('requires the version counter to have changed', () => {
    // A plain `setActiveOutputTab` does not bump the counter, and must leave a
    // dock the user collapsed for themselves exactly where they put it.
    expect(forcedActivationEndsRail(false, 'olumi')).toBe(false)
  })
})

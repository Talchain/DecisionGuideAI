/**
 * Goal-threshold refusal codes get goal-scoped humanised copy — ROADMAP 2.300
 * item 1 (extends 2.271's named-reason last mile).
 *
 * THE DEFECT: ISL's two goal-threshold refusal codes survive every transport
 * hop (PLoT keeps the code; `inference_warnings` is on CEE's keep-list;
 * InferenceWarningStrip mounts unconditionally) but `humaniseCritique.ts`
 * `CODE_TEMPLATES` has no entry for either, so a GOAL-level refusal renders
 * the generic FACTOR-framed fallback "Review this factor's inputs"
 * (humaniseCritique.ts:270-274 at pristine 43fd19e1) — mislabelling the
 * condition and discarding the actionable remedy.
 *
 * PRODUCER SEMANTICS, derived at ISL staging tip (robustness_analyzer_v2.py,
 * `_resolve_goal_threshold` refuse() sites):
 *   · GOAL_THRESHOLD_FRAME_UNSPECIFIED — the threshold was supplied without a
 *     frame ('level' vs 'delta'), so ISL omits probability_of_goal rather
 *     than guess (witnessed verbatim in witness-2258).
 *   · GOAL_THRESHOLD_NOT_CONVERTIBLE — a level threshold could not be
 *     converted into the goal samples' frame (reasons include
 *     missing_goal_baseline — no recorded current level — plus structural
 *     ones: goal pinned by an intervention, root goal, parameter uncertainty
 *     on the goal, auto-noise). Copy states the withhold factually and names
 *     the user-actionable remedy (state the current level) without claiming
 *     it is the only cause.
 *
 * RED-first at pristine 43fd19e1: both codes fall through to the generic
 * factor-framed fallback, so every assertion on goal-scoped copy fails.
 */

import { describe, it, expect } from 'vitest'
import { humaniseCritique } from '../utils/humaniseCritique'
import type { UncertaintyItem } from '../types'

function item(code: string): UncertaintyItem {
  return {
    code,
    severity: 'warning',
    message: 'raw producer prose — must never render',
  } as UncertaintyItem
}

describe('humaniseCritique — goal-threshold refusals are goal-scoped, never factor-framed', () => {
  it('GOAL_THRESHOLD_NOT_CONVERTIBLE: goal-scoped title, honest withhold description, actionable current-level remedy', () => {
    const result = humaniseCritique(item('GOAL_THRESHOLD_NOT_CONVERTIBLE'))
    // Not the generic factor-framed fallback.
    expect(result.title).not.toBe("Review this factor's inputs")
    expect(result.title.toLowerCase()).toContain('goal')
    expect(result.title.toLowerCase()).not.toContain('factor')
    // The honest substance: withheld, not guessed.
    expect(result.description).toMatch(/withheld|left out/i)
    // The actionable remedy the walk's tester needed.
    expect(result.suggestion?.toLowerCase()).toContain('current level')
    // Banner-eligible: goal-scoped copy carries no internal tokens.
    expect(result.displayText).toBe(result.title)
  })

  it('GOAL_THRESHOLD_FRAME_UNSPECIFIED: names the level-vs-change ambiguity and how to resolve it', () => {
    const result = humaniseCritique(item('GOAL_THRESHOLD_FRAME_UNSPECIFIED'))
    expect(result.title).not.toBe("Review this factor's inputs")
    expect(result.title.toLowerCase()).toContain('goal')
    expect(result.title.toLowerCase()).not.toContain('factor')
    expect(result.description).toMatch(/level/i)
    expect(result.description).toMatch(/change/i)
    expect(result.description).toMatch(/withheld|left out/i)
    expect(result.suggestion).toMatch(/level|change/i)
    expect(result.displayText).toBe(result.title)
  })

  it('neither template leaks the raw producer message', () => {
    for (const code of ['GOAL_THRESHOLD_NOT_CONVERTIBLE', 'GOAL_THRESHOLD_FRAME_UNSPECIFIED']) {
      const result = humaniseCritique(item(code))
      expect(result.title).not.toContain('raw producer prose')
      expect(result.description).not.toContain('raw producer prose')
    }
  })
})

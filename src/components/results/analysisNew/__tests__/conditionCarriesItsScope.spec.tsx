/**
 * A FLIP CONDITION IS A SET-DEPENDENT CLAIM AND MUST CARRY ITS SCOPE
 * (ROADMAP 2.1340 row F, deferred from the round-3 review of #921).
 *
 * ## The mechanism, derived at the bytes on `origin/staging` 18d681c2
 *
 * `comparativeClaim` (`buildAnalysisNewViewModel.ts`) enumerated exactly three
 * set-dependent claims — the win share, the headline superlative and the
 * robustness ordering verdict — and resolved to `'none'` when none of the
 * three was on screen. `condition` was computed SEPARATELY, inside the
 * returned object literal and textually AFTER `comparativeClaim`, so the
 * enumeration could not consult it even in principle.
 *
 * `AtAGlance` gates the comparison-scope note on
 * `comparisonScope.kind === 'partial' && comparativeClaim !== 'none'`.
 *
 * So a run whose only glance content was a flip condition, over a candidate
 * set that excluded some of the user's options, printed
 *
 *     "Could change if Two-month timeframe moves from 2 to 3"
 *
 * with NOTHING anywhere saying the comparison covered 1 of 2 options. ISL
 * computes the flip thresholds OVER THE CANDIDATE SET, exactly as it does
 * `win_probability` and `rank` — so a threshold derived from a subset is not a
 * threshold over the user's option set, and the reader supplies the wrong one.
 * That is the same defect the win share carried before #921, reached through a
 * field that change did not enumerate.
 *
 * ## ⚠ WHAT THIS FILE DOES NOT CLAIM
 *
 * Reachability is derived COMPONENT-SIDE and producer-side reachability is
 * NOT established: it is not shown here that the producer emits a partial
 * comparison scope together with a computed flip threshold on a run that
 * withholds both the leader and the robustness verdict. `AtAGlance`'s own
 * header records that limit and keeps an open re-surface trigger for it. This
 * file pins the SURFACE's obligation — if that state arrives, the scope is
 * disclosed — and is silent about how often it arrives.
 *
 * ## The twin is the load-bearing half
 *
 * A fix that simply always rendered the note would pass case 1 and FABRICATE a
 * scope note on a run with no condition, which is worse than the defect. Case
 * 2 is the discrimination: no condition, no claim, no note. Case 3 pins the
 * REGISTER — a condition takes `ComparisonScopeNote`'s neutral sentence and
 * NOT its `detail` line, because "ranks and comparative percentages" describes
 * two things that are not on screen in this state.
 */

import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { AtAGlance } from '../sections/AtAGlance'
import type { OptionResult } from '../../types'
import { genuineDecision } from './analysisNewFixtures'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'

afterEach(() => cleanup())

/** Typed as the producer's own record, so the compiler owns the shape. */
const option = (over: Partial<OptionResult> & { id: string; label: string }): OptionResult =>
  ({ winProbability: 0.5, ...over }) as OptionResult

/**
 * The producer row `atAGlance.spec.tsx` already pins as yielding the
 * no-unit, paired-with-baseline form. Reused so the LITERAL sentence below is
 * one this repo has measured rather than one I composed.
 */
const FLIP_ROW = { label: 'Two-month timeframe', node_id: 'n_time', current_value: 2, flip_value: 3 }

/**
 * A partial candidate set — Beta was never scored — with every OTHER
 * set-dependent claim withheld. Only the flip threshold varies between the two
 * cases, so a difference in output is attributable to the condition and to
 * nothing else.
 */
const glanceWith = (over: Record<string, unknown>) => {
  const base = genuineDecision()
  return buildAnalysisNewViewModel({
    data: {
      ...base,
      recommendation: {
        ...base.recommendation,
        allOptions: [
          option({ id: 'o_a', label: 'Alpha', winProbability: 0.55 }),
          option({ id: 'o_b', label: 'Beta', notAnalysed: true, notAnalysedReason: 'not_returned' }),
        ],
        verdict: { hasLeadingOption: false },
        leaderDesignationPermitted: false,
        robustnessVerdict: undefined,
        robustnessVerdictReason: undefined,
        ...over,
      },
    } as ResultsSectionDataReturn,
    recommendations: [],
    isPreRun: false,
    isRunning: false,
    isStale: false,
  }).atAGlance
}

const withCondition = () =>
  glanceWith({ flipThresholdsStatus: 'computed', flipThresholds: [FLIP_ROW] })

const withoutCondition = () => glanceWith({})

const mount = (glance: ReturnType<typeof glanceWith>) =>
  render(
    <AtAGlance
      isRunning={false}
      reanalyseBlocked={false}
      reanalyseBlockedReason={null}
      glance={glance}
    />,
  )

/**
 * The sanctioned sentence for this exact set, spelled out rather than recomputed.
 *
 * ⚠ SPELLED OUT ON PURPOSE, AND IT MUST STAY THAT WAY. Recomputing it through
 * `COMPARISON_SCOPE_COPY.sentence(scope)` would make this a tautology — the
 * assertion would agree with whatever the producer emits, including a producer
 * that had stopped emitting the exclusions at all. A literal is what gives the
 * pin its bite.
 *
 * ⚠ TWO SENTENCES SINCE 11 Sep 2026. It read
 *   "Comparing 1 of your 2 options — Beta was left out."
 * until `COMPARISON_SCOPE_COPY.sentence` split the dash out under Paul's
 * no-em-dashes-in-product-copy ruling. BOTH HALVES SURVIVED the split — the
 * scope arithmetic from `phrase()`, the named exclusion from
 * `excludedClause()` — so this constant gains a full stop and loses nothing.
 * Anything shorter than both halves is a regression, not a re-wording.
 */
const SCOPE_SENTENCE = 'Comparing 1 of your 2 options. Beta was left out.'
const DETAIL_SENTENCE = 'Ranks and comparative percentages describe those 1 only.'
const CONDITION_SENTENCE = 'Could change if Two-month timeframe moves from 2 to 3'

describe('a flip condition carries the scope of the set it was computed over', () => {
  it('DISCLOSES the scope when the condition is the only claim on screen', () => {
    const glance = withCondition()

    // Preconditions, pinned in-test so the outcome below is provably the
    // gate's doing and not a fixture that quietly stopped reproducing the
    // state (trap 13b — a discriminator whose precondition nothing pins).
    expect(glance.headline, 'precondition: no superlative').toBeNull()
    expect(glance.winShare, 'precondition: no percentage').toBeNull()
    expect(glance.verdict, 'precondition: no ordering verdict').toBeNull()
    expect(glance.condition?.text, 'precondition: a flip condition IS made').toBe(
      'Two-month timeframe moves from 2 to 3',
    )
    expect(glance.comparisonScope.kind, 'precondition: the set IS partial').toBe('partial')

    mount(glance)

    // The claim is on screen...
    expect(screen.getByTestId('analysis-new-glance-condition')).toHaveTextContent(
      CONDITION_SENTENCE,
    )
    // ...and so is the scope that bounds it.
    expect(screen.getByTestId('comparison-scope-note-analysisNew')).toHaveTextContent(
      SCOPE_SENTENCE,
    )
    // The option outside the set is named, as it is beside every other claim.
    expect(screen.getByTestId('analysis-new-glance-excluded-option')).toHaveTextContent('Beta')
  })

  it('a condition takes the SENTENCE ALONE — no "comparative percentages" line', () => {
    // `ComparisonScopeNote`'s own documented rule. A flip threshold puts no
    // rank and no percentage on screen, so `detail` would describe magnitudes
    // that are not there — an untruth in the opposite direction, and the
    // round-1 defect of #921 in miniature.
    mount(withCondition())
    const note = screen.getByTestId('comparison-scope-note-analysisNew')

    // Positive control: the sentence IS present, so the absence below is a
    // real discrimination and not a query that matched nothing (trap 13).
    expect(note).toHaveTextContent(SCOPE_SENTENCE)
    expect(note.textContent).not.toContain(DETAIL_SENTENCE)
    expect(note.textContent).not.toContain('comparative percentages')
  })

  it('INVENTS NOTHING when there is no condition and no other claim', () => {
    // ⭐ THE OPPOSITE-DIRECTION TWIN. An implementation that rendered the note
    // whenever the scope is partial would pass both cases above and fabricate
    // a qualifier here, on a panel making no set-dependent claim at all. That
    // is worse than the defect being fixed: it qualifies nothing.
    const glance = withoutCondition()

    expect(glance.condition, 'precondition: NO condition on this run').toBeNull()
    expect(glance.headline).toBeNull()
    expect(glance.winShare).toBeNull()
    expect(glance.verdict).toBeNull()
    expect(glance.comparativeClaim).toBe('none')

    mount(glance)

    expect(screen.queryByTestId('analysis-new-glance-condition')).toBeNull()
    expect(screen.queryByTestId('comparison-scope-note-analysisNew')).toBeNull()

    // The suppression is the GATE's, not an empty model: the scope is still
    // classified partial and still holds the excluded option. Suppression is
    // not reclassification, and this is the control that says so.
    expect(glance.comparisonScope.kind).toBe('partial')
  })
})

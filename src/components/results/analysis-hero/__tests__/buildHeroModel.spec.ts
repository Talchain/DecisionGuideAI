/**
 * buildHeroModel — boundary-value and gating tests.
 *
 * The point of this suite (per the brief): every value in the model must
 * EQUAL the adapted response value it came from — no UI-created quantities,
 * bands, deltas or thresholds — and every lens/state gate must fail closed.
 */
import { describe, expect, it } from 'vitest'
import { buildHeroModel } from '../buildHeroModel'
import type { HeroChartModel } from '../heroTypes'
import {
  FULL_COMPLETENESS,
  makeHeroData,
  makeOption,
  OPTION_A,
  OPTION_B,
} from '../__fixtures__/hero.fixtures'
import type { ResultCompleteness } from '../../useResultCompleteness'

function chart(model: ReturnType<typeof buildHeroModel>): HeroChartModel {
  expect(model.kind).toBe('chart')
  return model as HeroChartModel
}

const CONSTRAINT = {
  constraints: [
    {
      node_id: 'fac_cost',
      operator: '<=',
      threshold: 100,
      label: 'Cost',
      prob_satisfied: 0.7,
      failure_margin_median: 0,
      near_miss_fraction: 0.1,
      binding: true,
    },
  ],
  joint_probability: 0.49,
}

describe('buildHeroModel — boundary values', () => {
  it('goal-fit values equal the adapted goalProbability exactly', () => {
    const m = chart(buildHeroModel(makeHeroData()))
    expect(m.rows[0].goal.value).toBe(OPTION_A.goalProbability)
    expect(m.rows[1].goal.value).toBe(OPTION_B.goalProbability)
    expect(m.rows[0].goal.readout).toBe('34%')
    expect(m.rows[1].goal.readout).toBe('49%')
  })

  it('outcome values equal the adapted outcome fields exactly', () => {
    const m = chart(buildHeroModel(makeHeroData()))
    expect(m.rows[0].outcome.p10).toBe(OPTION_A.outcome.p10)
    expect(m.rows[0].outcome.p90).toBe(OPTION_A.outcome.p90)
    expect(m.rows[0].outcome.centre).toBe(OPTION_A.expected)
    expect(m.rows[1].outcome.centre).toBe(OPTION_B.expected)
  })

  it('target equals goalThreshold when unit-compatible (isNormalised === false)', () => {
    const m = chart(buildHeroModel(makeHeroData()))
    expect(m.targetValue).toBe(62)
    // Threshold participates in the layout domain (62 < max already, min unaffected here)
    expect(m.outcomeDomain).not.toBeNull()
  })

  it('omits the target AND excludes it from the domain when isNormalised is true', () => {
    const m = chart(
      buildHeroModel(makeHeroData({ recommendation: { isNormalised: true, goalThreshold: 1000 } })),
    )
    expect(m.targetValue).toBeNull()
    expect(m.targetReadout).toBeNull()
    // 1000 excluded: domain max stays near the option p90 (82 + 5% pad), far below 1000.
    expect(m.outcomeDomain!.max).toBeLessThan(100)
  })

  it('omits the target when isNormalised is undefined (uncertainty fails closed)', () => {
    const m = chart(
      buildHeroModel(makeHeroData({ recommendation: { isNormalised: undefined } })),
    )
    expect(m.targetValue).toBeNull()
  })

  it('includes a compatible out-of-range threshold in the layout domain', () => {
    const m = chart(
      buildHeroModel(makeHeroData({ recommendation: { goalThreshold: 95, isNormalised: false } })),
    )
    expect(m.targetValue).toBe(95)
    expect(m.outcomeDomain!.max).toBeGreaterThanOrEqual(95)
  })
})

describe('buildHeroModel — leaders and headline', () => {
  it('headline leader is the Results Panel recommended option, not a goal argmax', () => {
    // Option A gets the HIGHER goalProbability, but B stays recommended:
    // the headline must follow B (reconciles with the panels below).
    const a = makeOption({ ...OPTION_A, goalProbability: 0.9 })
    const m = chart(buildHeroModel(makeHeroData({ options: [a, OPTION_B] })))
    expect(m.headline).toContain('Upskill the team')
    expect(m.leaders.goal).toBe('opt_b')
  })

  it('outcome leader is the highest existing centre, independent of the recommendation', () => {
    const m = chart(buildHeroModel(makeHeroData()))
    expect(m.leaders.outcome).toBe('opt_a')
  })

  it('tied outcome centres break to the earliest option in allOptions[] order', () => {
    const a = makeOption({ ...OPTION_A, expected: 62, outcome: { ...OPTION_A.outcome, mean: 62 } })
    const m = chart(buildHeroModel(makeHeroData({ options: [a, OPTION_B] })))
    expect(m.leaders.outcome).toBe('opt_a')
  })

  it('diverged leaders produce the tension subline (goal-alone wording without constraints)', () => {
    const m = chart(buildHeroModel(makeHeroData()))
    expect(m.subline).toBe(
      'Two developers has the highest expected outcome, but Upskill the team best fits your goal.',
    )
    expect(m.headline).toBe('Upskill the team best fits your goal.')
  })

  it('constraint presence switches to goal-and-limits wording', () => {
    // Constraints are request-level, so every option carries its analysis.
    const a = makeOption({ ...OPTION_A, constraintAnalysis: CONSTRAINT })
    const b = makeOption({ ...OPTION_B, constraintAnalysis: CONSTRAINT })
    const m = chart(buildHeroModel(makeHeroData({ options: [a, b] })))
    expect(m.hasConstraints).toBe(true)
    expect(m.headline).toBe('Upskill the team best meets the goal and your limits.')
    expect(m.subline).toContain('best meets the goal and your limits')
  })

  it('mixed constraint coverage falls back to goal-alone wording (never overstates)', () => {
    // Anomalous shape: only one goal-bearing option carries constraint
    // analysis. The collapsed goalProbability is joint for that option but
    // goal-alone for the other, so the shared copy must not claim "and
    // limits" for every bar.
    const b = makeOption({ ...OPTION_B, constraintAnalysis: CONSTRAINT })
    const m = chart(buildHeroModel(makeHeroData({ options: [OPTION_A, b] })))
    expect(m.hasConstraints).toBe(false)
    expect(m.headline).toBe('Upskill the team best fits your goal.')
  })

  it('does not headline or highlight a recommended option that lacks its own goal value', () => {
    // Recommended option B has no goalProbability while A has one: the hero
    // must not claim B "best fits your goal" beside a "—" readout for B.
    const b = makeOption({ ...OPTION_B, goalProbability: undefined })
    const m = chart(buildHeroModel(makeHeroData({ options: [OPTION_A, b] })))
    expect(m.lenses).toContain('goal')
    expect(m.leaders.goal).toBeNull()
    expect(m.headline).toBe('Upskill the team currently looks strongest.')
    expect(m.subline).toBeNull()
  })

  it('omits the subline when the outcome lens is hidden (centres without ranges)', () => {
    // Options carry an expected centre but no p10-p90 range: the outcome
    // lens is unavailable, so the hero must not assert an expected-outcome
    // comparison it cannot show.
    const strip = (o: ReturnType<typeof makeOption>) =>
      makeOption({
        ...o,
        outcome: { mean: o.outcome.mean, p10: null, p50: null, p90: null },
        p10: null,
        p50: null,
        p90: null,
      })
    const m = chart(buildHeroModel(makeHeroData({ options: [strip(OPTION_A), strip(OPTION_B)] })))
    expect(m.lenses).toEqual(['goal'])
    expect(m.subline).toBeNull()
    // The goal-fit headline itself is still honest and allowed.
    expect(m.headline).toBe('Upskill the team best fits your goal.')
  })

  it('equal leaders produce the aligned subline', () => {
    // Make the recommended option also the outcome leader.
    const b = makeOption({ ...OPTION_B, expected: 90, outcome: { ...OPTION_B.outcome, mean: 90 } })
    const m = chart(buildHeroModel(makeHeroData({ options: [OPTION_A, b] })))
    expect(m.subline).toBe('Upskill the team also has the strongest expected outcome.')
  })

  it('recommended id missing from analysed rows claims no leader (recovered-session guard)', () => {
    const m = chart(
      buildHeroModel(
        makeHeroData({
          recommendation: {
            recommendedOption: makeOption({ id: 'canvas_ghost', label: 'Ghost' }),
          },
        }),
      ),
    )
    expect(m.leaders.goal).toBeNull()
    // Headline falls back to the outcome leader with "looks strongest" copy.
    expect(m.headline).toBe('Two developers currently looks strongest.')
  })

  it('single option uses the only-option headline and no subline', () => {
    const m = chart(buildHeroModel(makeHeroData({ options: [OPTION_B] })))
    expect(m.headline).toBe('Upskill the team is your only option.')
    expect(m.subline).toBeNull()
  })
})

describe('buildHeroModel — lens gating and numbering', () => {
  it('launch surface is exactly goal + outcome; no other lens can exist', () => {
    const m = chart(buildHeroModel(makeHeroData()))
    expect(m.lenses).toEqual(['goal', 'outcome'])
    expect(m.defaultLens).toBe('goal')
  })

  it('hides Goal fit when no option has goalProbability, defaulting to outcome', () => {
    const a = makeOption({ ...OPTION_A, goalProbability: undefined })
    const b = makeOption({ ...OPTION_B, goalProbability: undefined })
    const m = chart(buildHeroModel(makeHeroData({ options: [a, b] })))
    expect(m.lenses).toEqual(['outcome'])
    expect(m.defaultLens).toBe('outcome')
    // Without a goal basis the headline may not claim goal fit.
    expect(m.headline).toBe('Upskill the team currently looks strongest.')
    expect(m.subline).toBeNull()
  })

  it('hides Likely outcome when no option has a p10-p90 range', () => {
    const strip = (o: ReturnType<typeof makeOption>) =>
      makeOption({
        ...o,
        expected: null,
        outcome: { mean: null, p10: null, p50: null, p90: null },
        p10: null,
        p50: null,
        p90: null,
      })
    const m = chart(buildHeroModel(makeHeroData({ options: [strip(OPTION_A), strip(OPTION_B)] })))
    expect(m.lenses).toEqual(['goal'])
    expect(m.outcomeDomain).toBeNull()
  })

  it('returns empty when options exist but nothing is displayable', () => {
    const bare = [
      makeOption({ id: 'x', label: 'X' }),
      makeOption({ id: 'y', label: 'Y' }),
    ]
    expect(buildHeroModel(makeHeroData({ options: bare })).kind).toBe('empty')
  })

  it('numbers rows by allOptions[] presentation order, identically for every lens', () => {
    const m = chart(buildHeroModel(makeHeroData()))
    // Presentation numbering: index follows array order, not any per-lens ranking.
    expect(m.rows.map((r) => [r.index, r.id])).toEqual([
      [1, 'opt_a'],
      [2, 'opt_b'],
    ])
    // Rows are shared across lenses (single array) — numbering cannot change
    // when the lens changes because the model carries no per-lens row order.
    expect(Object.keys(m.leaders)).toEqual(['goal', 'outcome'])
  })
})

describe('buildHeroModel — states', () => {
  it('returns empty while loading', () => {
    expect(buildHeroModel(makeHeroData({ isLoading: true })).kind).toBe('empty')
  })

  it('fails closed (empty, no throw) on partially-shaped objects', () => {
    // Review fix: the type promises these fields, but hydrated older state
    // may not — the hero must render nothing rather than crash the tab.
    expect(buildHeroModel(undefined as never).kind).toBe('empty')
    expect(buildHeroModel({} as never).kind).toBe('empty')
    expect(buildHeroModel({ recommendation: {} } as never).kind).toBe('empty')
    const noDrivers = { ...makeHeroData(), drivers: undefined } as never
    expect(buildHeroModel(noDrivers)).toMatchObject({ kind: 'chart', mainReason: null })
  })

  it('returns empty before any analysis (no options, full completeness)', () => {
    expect(buildHeroModel(makeHeroData({ options: [] })).kind).toBe('empty')
  })

  it('renders the failed status state on hook error (not null)', () => {
    const failed: ResultCompleteness = { ...FULL_COMPLETENESS, status: 'failed' }
    const m = buildHeroModel(makeHeroData({ isError: true, completeness: failed }))
    expect(m).toMatchObject({ kind: 'status', variant: 'failed' })
  })

  it('renders the partial status state from completeness', () => {
    const partial: ResultCompleteness = { ...FULL_COMPLETENESS, status: 'partial' }
    const m = buildHeroModel(makeHeroData({ completeness: partial }))
    expect(m).toMatchObject({ kind: 'status', variant: 'partial' })
  })

  it('renders the partial status state from analysisStatus', () => {
    const m = buildHeroModel(makeHeroData({ recommendation: { analysisStatus: 'partial' } }))
    expect(m).toMatchObject({ kind: 'status', variant: 'partial' })
  })

  it('renders the blocked status state from analysisStatus', () => {
    const m = buildHeroModel(makeHeroData({ recommendation: { analysisStatus: 'blocked' } }))
    expect(m).toMatchObject({ kind: 'status', variant: 'blocked' })
  })
})

describe('buildHeroModel — detail lines and footer (sourced or omitted)', () => {
  it('maps Why from storyHeadlines verbatim and omits it when absent', () => {
    const m = chart(buildHeroModel(makeHeroData()))
    expect(m.rows[1].detail.why).toBe('Best placed once the goal and limits are both counted.')
    expect(m.rows[0].detail.why).toBeUndefined()
  })

  it('maps Could-change-if from producer flip thresholds only', () => {
    const m = chart(buildHeroModel(makeHeroData()))
    // Recommended option (B): first resolvable threshold.
    expect(m.rows[1].detail.couldChangeIf).toBe('Team capacity crosses 30%.')
    // Option A is the named alternative winner → same threshold line.
    expect(m.rows[0].detail.couldChangeIf).toBe('Team capacity crosses 30%.')
  })

  it('matches the alternative winner across encoding notation differences', () => {
    // Review fix: labels are normalised for the MATCH only — an option label
    // carrying encoding notation still receives its sourced line.
    const a = makeOption({ ...OPTION_A, label: 'Two developers (0=no, 1=yes)' })
    const m = chart(buildHeroModel(makeHeroData({ options: [a, OPTION_B] })))
    expect(m.rows[0].detail.couldChangeIf).toBe('Team capacity crosses 30%.')
  })

  it('renders a unitless 0-1 flip value as a number, never a qualitative word', () => {
    // Regression: formatValueWithUnit would render 0.3 with no unit as a
    // qualitative band word; a "crosses <value>" sentence must stay numeric.
    const m = chart(
      buildHeroModel(
        makeHeroData({
          recommendation: {
            flipThresholds: [
              {
                label: 'Team capacity',
                node_id: 'fac_capacity',
                current_value: 0.5,
                flip_value: 0.3,
                alternative_winner_label: 'Two developers',
              },
            ],
          },
        }),
      ),
    )
    expect(m.rows[1].detail.couldChangeIf).toBe('Team capacity crosses 0.3.')
  })

  it('floors sub-1% goal readouts at "< 1%" (OptionCards parity, UI-SEM-057)', () => {
    const a = makeOption({ ...OPTION_A, goalProbability: 0.004 })
    const m = chart(buildHeroModel(makeHeroData({ options: [a, OPTION_B] })))
    expect(m.rows[0].goal.value).toBe(0.004)
    expect(m.rows[0].goal.readout).toBe('< 1%')
  })

  it('omits Could-change-if when no flip thresholds resolve', () => {
    const m = chart(
      buildHeroModel(makeHeroData({ recommendation: { flipThresholds: undefined } })),
    )
    expect(m.rows[0].detail.couldChangeIf).toBeUndefined()
    expect(m.rows[1].detail.couldChangeIf).toBeUndefined()
  })

  it('formats win probability with the display-honesty formatter', () => {
    const m = chart(buildHeroModel(makeHeroData()))
    expect(m.rows[0].detail.winChance).toBe('30% chance it is the strongest option overall.')
  })

  it('omits the win line when winProbability is absent', () => {
    const a = makeOption({ ...OPTION_A, winProbability: undefined })
    const m = chart(buildHeroModel(makeHeroData({ options: [a, OPTION_B] })))
    expect(m.rows[0].detail.winChance).toBeUndefined()
  })

  it('main reason names the Drivers section top driver; omitted when none', () => {
    const withDriver = chart(buildHeroModel(makeHeroData()))
    expect(withDriver.mainReason).toBe(
      'Main reason: Developer capacity has the strongest effect on this result.',
    )
    const without = chart(buildHeroModel(makeHeroData({ topDriverLabel: null })))
    expect(without.mainReason).toBeNull()
  })

  it('omits main reason instead of interpolating a glossary-tripping label', () => {
    const m = chart(buildHeroModel(makeHeroData({ topDriverLabel: 'edge weight graph' })))
    expect(m.mainReason).toBeNull()
  })
})

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

  it('the outcome-axis domain is derived from option values only (bars, dots)', () => {
    // Fixture p10/p90 span 46..82; the padded domain hugs those extremes so
    // the bars use the full track width.
    const m = chart(buildHeroModel(makeHeroData()))
    expect(m.outcomeDomain).not.toBeNull()
    expect(m.outcomeDomain!.min).toBeGreaterThan(40)
    expect(m.outcomeDomain!.min).toBeLessThan(46)
    expect(m.outcomeDomain!.max).toBeGreaterThan(82)
    expect(m.outcomeDomain!.max).toBeLessThan(90)
  })

  it('the goal threshold never stretches the outcome domain (comparison discrimination preserved)', () => {
    // Even a far-above-spread target (goalThreshold 1000) must not widen the
    // domain — the target is not a member of the outcome chart at all.
    const m = chart(
      buildHeroModel(makeHeroData({ recommendation: { goalThreshold: 1000, isNormalised: false } })),
    )
    expect(m.outcomeDomain!.max).toBeLessThan(90)
  })

  it('carries no target fields on the model (target lives on Goal fit, not the chart)', () => {
    const m = chart(buildHeroModel(makeHeroData()))
    expect('targetValue' in m).toBe(false)
    expect('targetReadout' in m).toBe(false)
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

  it('diverged leaders produce the tension subline naming the outcome leader', () => {
    const m = chart(buildHeroModel(makeHeroData()))
    expect(m.subline).toBe('Two developers has the highest expected outcome.')
    expect(m.headline).toBe('Upskill the team best fits your goal.')
  })

  it('constraint presence switches the headline to goal-and-limits wording', () => {
    // Constraints are request-level, so every option carries its analysis.
    const a = makeOption({ ...OPTION_A, constraintAnalysis: CONSTRAINT })
    const b = makeOption({ ...OPTION_B, constraintAnalysis: CONSTRAINT })
    const m = chart(buildHeroModel(makeHeroData({ options: [a, b] })))
    expect(m.hasConstraints).toBe(true)
    expect(m.headline).toBe('Upskill the team best meets the goal and your limits.')
    // The tension subline stays the single outcome-leader sentence.
    expect(m.subline).toBe('Two developers has the highest expected outcome.')
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

  it('does not goal-headline a recommended option that lacks its own goal value', () => {
    // Recommended option B has no goalProbability while A has one: the hero
    // must not claim B "best fits your goal" beside a "—" readout for B.
    // The leader claim reframes to the analysis basis, and the divergence
    // subline is PERSISTENT — B is not the outcome leader, so the tension
    // is stated even without a goal basis.
    const b = makeOption({ ...OPTION_B, goalProbability: undefined })
    const m = chart(buildHeroModel(makeHeroData({ options: [OPTION_A, b] })))
    expect(m.lenses).toContain('goal')
    expect(m.leaders.goal).toBeNull()
    expect(m.headline).toBe('Upskill the team currently leads the overall analysis.')
    expect(m.subline).toBe('Two developers has the highest expected outcome.')
  })

  it('does not goal-headline a recommended option whose goal value floors below 1% (mixed coverage)', () => {
    // A carries no goal value; recommended B sits below the sub-1% floor.
    // "Best fits your goal" beside a "< 1%" readout would be false — the
    // headline falls through to the analysis-leader wording.
    const a = makeOption({ ...OPTION_A, goalProbability: undefined })
    const b = makeOption({ ...OPTION_B, goalProbability: 0.004 })
    const m = chart(buildHeroModel(makeHeroData({ options: [a, b] })))
    expect(m.leaders.goal).toBeNull()
    expect(m.headline).toBe('Upskill the team currently leads the overall analysis.')
  })

  it('no-option-on-track headline is constraint-aware (goal and limits wording)', () => {
    // Under constraints the floored figure is the JOINT probability and the
    // axis/caption say "goal and limits" — the headline must describe the
    // same quantity, not claim "your goal" alone.
    const a = makeOption({ ...OPTION_A, goalProbability: 0, constraintAnalysis: CONSTRAINT })
    const b = makeOption({ ...OPTION_B, goalProbability: 0.004, constraintAnalysis: CONSTRAINT })
    const m = chart(buildHeroModel(makeHeroData({ options: [a, b] })))
    expect(m.hasConstraints).toBe(true)
    expect(m.headline).toBe('No option is currently on track to meet your goal and limits.')
  })

  it('never headlines an outcome claim when the outcome lens is hidden (no recommended option)', () => {
    // Ghost recommendation + goal values + centres WITHOUT ranges: only the
    // goal lens renders, so the "highest expected outcome" headline would
    // assert a comparison the chart cannot show (an outcome leader exists
    // via the centres) — it must fall through to the neutral no-leader
    // headline, mirroring the subline's outcomeAvailable gate.
    const strip = (o: ReturnType<typeof makeOption>) =>
      makeOption({
        ...o,
        outcome: { mean: o.outcome.mean, p10: null, p50: null, p90: null },
        p10: null,
        p50: null,
        p90: null,
      })
    const m = chart(
      buildHeroModel(
        makeHeroData({
          options: [strip(OPTION_A), strip(OPTION_B)],
          recommendation: {
            recommendedOption: makeOption({ id: 'canvas_ghost', label: 'Ghost' }),
          },
        }),
      ),
    )
    expect(m.lenses).toEqual(['goal'])
    expect(m.headline).toBe('Here is how your options compare.')
    expect(m.subline).toBeNull()
  })

  it('all goal values below the sub-1% floor produce the no-option-on-track headline', () => {
    // Staging shape: every option carried probability_of_joint_goal 0 —
    // crowning any option "best fits your goal" would be false. The hero
    // states the decision-relevant truth, drops the goal-lens leader ring,
    // and keeps the outcome fact as the subline (user-approved pairing).
    const a = makeOption({ ...OPTION_A, goalProbability: 0 })
    const b = makeOption({ ...OPTION_B, goalProbability: 0 })
    const m = chart(buildHeroModel(makeHeroData({ options: [a, b] })))
    expect(m.headline).toBe('No option is currently on track to reach your goal.')
    expect(m.subline).toBe('Two developers has the highest expected outcome.')
    expect(m.leaders.goal).toBeNull()
    // Goal lens stays available AND default — the "< 1%" rows ARE the story.
    expect(m.defaultLens).toBe('goal')
    expect(m.rows.every((r) => r.goal.readout === '< 1%')).toBe(true)
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
    // No recommended option among the rows: the headline states the outcome
    // fact itself, and the subline stays null (it would only repeat it).
    expect(m.headline).toBe('Two developers has the highest expected outcome.')
    expect(m.subline).toBeNull()
  })

  it('single option uses the only-option headline and no subline', () => {
    const m = chart(buildHeroModel(makeHeroData({ options: [OPTION_B] })))
    expect(m.headline).toBe('Upskill the team is your only option.')
    expect(m.subline).toBeNull()
  })
})

describe('buildHeroModel — close-call calibration (UI-SEM-060)', () => {
  // No goal values anywhere: the headline takes the analysis-leader branch,
  // where close-call calibration applies.
  const noGoal = (o: ReturnType<typeof makeOption>) =>
    makeOption({ ...o, goalProbability: undefined })

  it('clear leader (no top-two range overlap) keeps the flat claim and aligned subline', () => {
    // B recommended AND outcome leader; ranges disjoint: B 70..90, A 40..60.
    const a = noGoal(makeOption({ ...OPTION_A, expected: 50, outcome: { mean: 50, p10: 40, p50: 50, p90: 60 } }))
    const b = noGoal(makeOption({ ...OPTION_B, expected: 80, outcome: { mean: 80, p10: 70, p50: 80, p90: 90 } }))
    const m = chart(buildHeroModel(makeHeroData({ options: [a, b] })))
    expect(m.headline).toBe('Upskill the team currently leads the overall analysis.')
    expect(m.subline).toBe('Upskill the team also has the strongest expected outcome.')
  })

  it('top-two range overlap tempers the claim and names the runner-up', () => {
    // B recommended AND outcome leader; ranges overlap: B 55..85, A 45..70.
    const a = noGoal(makeOption({ ...OPTION_A, expected: 60, outcome: { mean: 60, p10: 45, p50: 60, p90: 70 } }))
    const b = noGoal(makeOption({ ...OPTION_B, expected: 68, outcome: { mean: 68, p10: 55, p50: 68, p90: 85 } }))
    const m = chart(buildHeroModel(makeHeroData({ options: [a, b] })))
    expect(m.headline).toBe('Upskill the team currently leads, but the top options are close.')
    expect(m.subline).toBe(
      'Upskill the team has the highest expected outcome, with Two developers close behind.',
    )
  })

  it('names the leader and runner-up from the rendered outcome ranking, not the input order', () => {
    // Three options; recommended C is the outcome leader; runner-up by
    // centre is A (62) not B (50) — the copy must name A.
    const a = noGoal(makeOption({ id: 'opt_a2', label: 'Alpha', winProbability: 0.3, expected: 62, outcome: { mean: 62, p10: 50, p50: 62, p90: 74 } }))
    const b = noGoal(makeOption({ id: 'opt_b2', label: 'Beta', winProbability: 0.2, expected: 50, outcome: { mean: 50, p10: 40, p50: 50, p90: 60 } }))
    const c = noGoal(makeOption({ id: 'opt_c2', label: 'Gamma', winProbability: 0.5, isRecommended: true, expected: 70, outcome: { mean: 70, p10: 58, p50: 70, p90: 82 } }))
    const m = chart(buildHeroModel(makeHeroData({ options: [b, a, c] })))
    // Rendered rows are in shared display order (win-prob desc).
    expect(m.rows.map((r) => r.label)).toEqual(['Gamma', 'Alpha', 'Beta'])
    expect(m.headline).toBe('Gamma currently leads, but the top options are close.')
    expect(m.subline).toBe('Gamma has the highest expected outcome, with Alpha close behind.')
  })

  it('never invents closeness when a top-two range is missing', () => {
    // Centres are near-identical but the runner-up carries no p10/p90 —
    // the trigger must stay false (plain claim, aligned subline).
    const a = noGoal(makeOption({ ...OPTION_A, expected: 67.9, outcome: { mean: 67.9, p10: null, p50: 67.9, p90: null }, p10: null, p90: null }))
    const b = noGoal(makeOption({ ...OPTION_B, expected: 68, outcome: { mean: 68, p10: 55, p50: 68, p90: 85 } }))
    const m = chart(buildHeroModel(makeHeroData({ options: [a, b] })))
    expect(m.headline).toBe('Upskill the team currently leads the overall analysis.')
    expect(m.subline).toBe('Upskill the team also has the strongest expected outcome.')
  })
})

describe('buildHeroModel — grounded detail lines and goal hint', () => {
  it('maps range and goal-fit detail lines from the row fields (same formatters as readouts)', () => {
    const m = chart(buildHeroModel(makeHeroData()))
    // OPTION_A: p10 54, p90 82, count unit; goal 0.34 without constraints.
    expect(m.rows[0].detail.range).toBe('Realistic range: 54 to 82.')
    expect(m.rows[0].detail.goalFit).toBe('34% chance of hitting your goal.')
  })

  it('uses the goal-and-limits wording when every goal-bearing option is constrained', () => {
    const a = makeOption({ ...OPTION_A, constraintAnalysis: CONSTRAINT })
    const b = makeOption({ ...OPTION_B, constraintAnalysis: CONSTRAINT })
    const m = chart(buildHeroModel(makeHeroData({ options: [a, b] })))
    expect(m.rows[0].detail.goalFit).toBe('34% chance of meeting your goal and limits.')
  })

  it('omits the range and goal-fit lines when the sourcing fields are absent', () => {
    const bare = makeOption({
      ...OPTION_A,
      goalProbability: undefined,
      outcome: { mean: 68, p10: null, p50: 67, p90: null },
      p10: null,
      p90: null,
    })
    const m = chart(buildHeroModel(makeHeroData({ options: [bare, OPTION_B] })))
    expect(m.rows.find((r) => r.id === 'opt_a')!.detail.range).toBeUndefined()
    expect(m.rows.find((r) => r.id === 'opt_a')!.detail.goalFit).toBeUndefined()
  })

  it('shows the goal hint ONLY when the goal lens is absent because no target exists', () => {
    const noGoalOpts = [
      makeOption({ ...OPTION_A, goalProbability: undefined }),
      makeOption({ ...OPTION_B, goalProbability: undefined }),
    ]
    // No goal values + no threshold → hint.
    const hinted = chart(
      buildHeroModel(makeHeroData({ options: noGoalOpts, recommendation: { goalThreshold: null } })),
    )
    expect(hinted.showGoalHint).toBe(true)
    // No goal values but a target EXISTS (producer gap) → no hint.
    const targeted = chart(buildHeroModel(makeHeroData({ options: noGoalOpts })))
    expect(targeted.showGoalHint).toBe(false)
    // Goal lens available → no hint.
    expect(chart(buildHeroModel(makeHeroData())).showGoalHint).toBe(false)
  })

  it('reports whether any rendered row draws a range line (caption gating)', () => {
    expect(chart(buildHeroModel(makeHeroData())).outcomeRangesShown).toBe(true)
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
    // Without a goal basis the headline claims the analysis leader (the
    // canonical Results Panel leader), never a "strongest" outcome claim —
    // and the persistent subline names the diverging outcome leader.
    expect(m.headline).toBe('Upskill the team currently leads the overall analysis.')
    expect(m.subline).toBe('Two developers has the highest expected outcome.')
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

  it('renders the CHART (not partial) when completeness is partial but core data is present', () => {
    // Staging repro: a fully-computed PLoT run whose OPTIONAL enrichment is
    // absent (e.g. the decision review is skipped with coaching autofire off)
    // reads `completeness.status === 'partial'`. The hero consumes none of
    // that enrichment, so it must render its answer-first chart, NOT the
    // "some steps did not complete" card. Completeness must not gate the chart.
    const partial: ResultCompleteness = {
      ...FULL_COMPLETENESS,
      status: 'partial',
      missing: ['decision_review'],
      reasons: ['decision_review_unavailable'],
    } as ResultCompleteness
    const m = buildHeroModel(makeHeroData({ completeness: partial }))
    expect(m.kind).toBe('chart')
    expect((m as HeroChartModel).lenses).toEqual(['goal', 'outcome'])
  })

  it('renders the partial status state from a PLoT-reported partial analysisStatus', () => {
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
      'Main driver: Developer capacity.',
    )
    const without = chart(buildHeroModel(makeHeroData({ topDriverLabel: null })))
    expect(without.mainReason).toBeNull()
  })

  it('omits main reason instead of interpolating a glossary-tripping label', () => {
    const m = chart(buildHeroModel(makeHeroData({ topDriverLabel: 'edge weight graph' })))
    expect(m.mainReason).toBeNull()
  })
})

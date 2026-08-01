/**
 * buildHeroModel — boundary-value and gating tests.
 *
 * The point of this suite (per the brief): every value in the model must
 * EQUAL the adapted response value it came from — no UI-created quantities,
 * bands, deltas or thresholds — and every lens/state gate must fail closed.
 */
import { describe, expect, it } from 'vitest'
import { buildHeroModel } from '../buildHeroModel'
import { sortOptionsForDisplay } from '../../utils/optionDisplayOrder'
import { HERO_COPY } from '../heroCopy'
import { COMPARATIVE_COPY } from '../../utils/goalAnchorCopy'
import type { HeroChartModel } from '../heroTypes'
import {
  FULL_COMPLETENESS,
  makeDriver,
  makeHeroData,
  makeOption,
  OPTION_A,
  OPTION_B,
} from '../__fixtures__/hero.fixtures'
import type { ResultCompleteness } from '../../useResultCompleteness'
import type { DecisionResultData } from '../../types'

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

/**
 * The PRODUCER's leader verdict — the one authority entitled to say whether a
 * decision has a leading option (src/lib/decisionVerdict.ts). ROADMAP 1.223
 * deleted the UI's residual win-probability banding, so a run that carries no
 * producer signal gets NO leader claim however decisive its raw numbers look:
 * every test below that asserts banded copy must supply this, and every test
 * that omits it is asserting the no-claim contract.
 */
const producerVerdict = (
  separation: 'clear' | 'slight' | 'tied',
  gapPp: number,
  leaderId = 'opt_b',
) => ({
  leaderId,
  separation,
  hasLeadingOption: separation !== 'tied',
  gapPp,
  source: 'producer_near_tie' as const,
})

/**
 * The magnitudes the re-anchored leader sentences carry, read back off the
 * MODEL rather than hard-coded — so these assertions stay template checks
 * (does the builder select the right copy for the right row?) and do not
 * quietly become string fixtures that pass whatever the builder emits.
 */
function winReadoutOf(
  m: { rows: Array<{ label: string; comparativeReadout?: string | null }> },
  label: string,
): string | null {
  const row = m.rows.find((r) => r.label === label)
  if (!row) throw new Error(`no row for ${label}`)
  // Mirrors the builder exactly: a row with no comparative probability yields
  // null, and the copy drops its magnitude clause rather than printing a
  // placeholder glyph inside the sentence.
  return row.comparativeReadout ?? null
}
function goalReadoutOf(m: { rows: Array<{ label: string; goal: { readout: string } }> }, label: string): string {
  const row = m.rows.find((r) => r.label === label)
  if (!row) throw new Error(`no row for ${label}`)
  return row.goal.readout
}
function outcomeReadoutOf(m: { rows: Array<{ label: string; outcome: { readout: string } }> }, label: string): string {
  const row = m.rows.find((r) => r.label === label)
  if (!row) throw new Error(`no row for ${label}`)
  return row.outcome.readout
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
  it('goal-fit crown follows the goal argmax even when it diverges from the recommendation (UI-SEM-072)', () => {
    // Option A gets the HIGHER goalProbability while B stays recommended:
    // the goal-fit claim describes the GOAL view, so it must crown A — the
    // recommendation must never be re-crowned onto a view it does not lead
    // (lane 35; live staging crowned a 4% fit over 7%/6%).
    const a = makeOption({ ...OPTION_A, goalProbability: 0.9 })
    const m = chart(buildHeroModel(makeHeroData({ options: [a, OPTION_B] })))
    expect(m.headline).toBe(HERO_COPY.headline.goalOnly('Two developers', goalReadoutOf(m, 'Two developers')))
    expect(m.leaders.goal).toBe('opt_a')
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
    expect(m.subline).toBe(HERO_COPY.subline.highestOutcome('Two developers', outcomeReadoutOf(m, 'Two developers')))
    expect(m.headline).toBe(HERO_COPY.headline.goalOnly('Upskill the team', goalReadoutOf(m, 'Upskill the team')))
  })

  it('constraint presence switches the headline to goal-and-limits wording', () => {
    // Constraints are request-level, so every option carries its analysis.
    const a = makeOption({ ...OPTION_A, constraintAnalysis: CONSTRAINT })
    const b = makeOption({ ...OPTION_B, constraintAnalysis: CONSTRAINT })
    const m = chart(buildHeroModel(makeHeroData({ options: [a, b] })))
    expect(m.hasConstraints).toBe(true)
    expect(m.headline).toBe(HERO_COPY.headline.goalWithLimits('Upskill the team', goalReadoutOf(m, 'Upskill the team')))
    // The tension subline stays the single outcome-leader sentence.
    expect(m.subline).toBe(HERO_COPY.subline.highestOutcome('Two developers', outcomeReadoutOf(m, 'Two developers')))
  })

  it('mixed constraint coverage falls back to goal-alone wording (never overstates)', () => {
    // Anomalous shape: only one goal-bearing option carries constraint
    // analysis. The collapsed goalProbability is joint for that option but
    // goal-alone for the other, so the shared copy must not claim "and
    // limits" for every bar.
    const b = makeOption({ ...OPTION_B, constraintAnalysis: CONSTRAINT })
    const m = chart(buildHeroModel(makeHeroData({ options: [OPTION_A, b] })))
    expect(m.hasConstraints).toBe(false)
    expect(m.headline).toBe(HERO_COPY.headline.goalOnly('Upskill the team', goalReadoutOf(m, 'Upskill the team')))
  })

  /**
   * ⭐ UNCHANGED, AND DELIBERATELY SO (ROADMAP 2.233).
   *
   * This test is the PARTIAL-COVERAGE case, and it pins BOTH directions at
   * once: the goal lens is AVAILABLE (option A's measured value is shown, B's
   * absence renders as `'—'`) while the goal crown is ABSENT (`leaders.goal`
   * null, the headline reframed to the analysis basis).
   *
   * A revision of 2.233 briefly flipped the first assertion to `not.toContain`
   * by tightening availability to `.every` — and this test is what caught it.
   * The reasoning behind that tightening was about protecting the CLAIM, but
   * the claim was already protected by `selectGoalLeader`'s complete-field
   * gate, as the `leaders.goal` assertion below has always shown. So the
   * tightening bought no honesty and cost real data: it blanked the whole goal
   * view, including the option the producer HAD measured, on a surface that
   * discloses the gap with `'—'`.
   *
   * The two questions are now named apart (`hasAnyGoalValue` for display,
   * `hasCompleteGoalField` inside `selectGoalLeader` for the claim). This pair
   * of assertions is what stops them being re-merged: any future change that
   * conflates them must break one of these two lines.
   */
  it('does not goal-headline a recommended option that lacks its own goal value', () => {
    // Recommended option B has no goalProbability while A has one: the hero
    // must not claim B "is most likely to meet every target this run scored" beside a "—" readout for B.
    // The leader claim reframes to the analysis basis, and the divergence
    // subline is PERSISTENT — B is not the outcome leader, so the tension
    // is stated even without a goal basis. The reframed claim is the
    // PRODUCER's verdict naming B (ROADMAP 1.223 — the UI bands nothing
    // itself); winProbability is stripped so the claim can only be sourced,
    // never derived, which isolates the goal-honesty behaviour under test.
    const b = makeOption({ ...OPTION_B, goalProbability: undefined, winProbability: undefined })
    const m = chart(
      buildHeroModel(
        makeHeroData({
          options: [OPTION_A, b],
          recommendation: { verdict: producerVerdict('slight', 12) },
        }),
      ),
    )
    // ① AVAILABILITY — the lens IS shown. B's missing value is disclosed as
    //    '—' (goalReadout), not hidden by blanking the whole view.
    expect(m.lenses).toContain('goal')
    // ② ENTITLEMENT — and yet NO crown. This is the pair; neither line means
    //    much without the other.
    expect(m.leaders.goal).toBeNull()
    expect(m.headline).toBe(HERO_COPY.headline.slightlyAhead('Upskill the team'))
    expect(m.subline).toBe(
      HERO_COPY.subline.highestOutcome(
        'Two developers',
        m.rows.find((r) => r.label === 'Two developers')!.outcome.readout,
      ),
    )
  })

  it('does not goal-headline a recommended option whose goal value floors below 1% (mixed coverage)', () => {
    // A carries no goal value; recommended B sits below the sub-1% floor.
    // "Best fits your goal" beside a "< 1%" readout would be false — the
    // headline falls through to the analysis-leader wording, banded by the
    // PRODUCER's verdict (winProbability stripped so the claim can only be
    // sourced, which isolates the goal-honesty behaviour under test).
    const a = makeOption({ ...OPTION_A, goalProbability: undefined })
    const b = makeOption({ ...OPTION_B, goalProbability: 0.004, winProbability: undefined })
    const m = chart(
      buildHeroModel(
        makeHeroData({
          options: [a, b],
          recommendation: { verdict: producerVerdict('slight', 12) },
        }),
      ),
    )
    expect(m.leaders.goal).toBeNull()
    expect(m.headline).toBe(HERO_COPY.headline.slightlyAhead('Upskill the team'))
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
    // Ghost recommendation + UNIFORM goal values (no goal crown — UI-SEM-072
    // ties crown nobody) + centres WITHOUT ranges: only the goal lens
    // renders, so the "highest expected outcome" headline would assert a
    // comparison the chart cannot show (an outcome leader exists via the
    // centres) — it must fall through to the neutral no-leader headline,
    // mirroring the subline's outcomeAvailable gate.
    const strip = (o: ReturnType<typeof makeOption>) =>
      makeOption({
        ...o,
        goalProbability: 0.4,
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
    // crowning any option "is most likely to meet every target this run scored" would be false. The hero
    // states the decision-relevant truth, drops the goal-lens leader ring,
    // and keeps the outcome fact as the subline (user-approved pairing).
    const a = makeOption({ ...OPTION_A, goalProbability: 0 })
    const b = makeOption({ ...OPTION_B, goalProbability: 0 })
    const m = chart(buildHeroModel(makeHeroData({ options: [a, b] })))
    expect(m.headline).toBe('No option is currently on track to meet every target this run scored.')
    expect(m.subline).toBe(HERO_COPY.subline.highestOutcome('Two developers', outcomeReadoutOf(m, 'Two developers')))
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
    expect(m.headline).toBe(HERO_COPY.headline.goalOnly('Upskill the team', goalReadoutOf(m, 'Upskill the team')))
  })

  it('equal leaders produce the aligned subline', () => {
    // Make the recommended option also the outcome leader.
    const b = makeOption({ ...OPTION_B, expected: 90, outcome: { ...OPTION_B.outcome, mean: 90 } })
    const m = chart(buildHeroModel(makeHeroData({ options: [OPTION_A, b] })))
    expect(m.subline).toBe('Upskill the team also has the strongest expected outcome.')
  })

  it('recommended id missing from analysed rows still crowns the goal argmax (recovered-session guard)', () => {
    // The recovered-session guard blocks ANALYSIS-leader claims for a ghost
    // id — but the goal-fit crown (UI-SEM-072) is grounded in the analysed
    // rows themselves, not the recommendation, so it survives: B holds the
    // unique goal maximum and is crowned, while the divergence subline still
    // names the outcome leader (A).
    const m = chart(
      buildHeroModel(
        makeHeroData({
          recommendation: {
            recommendedOption: makeOption({ id: 'canvas_ghost', label: 'Ghost' }),
          },
        }),
      ),
    )
    expect(m.leaders.goal).toBe('opt_b')
    expect(m.headline).toBe(HERO_COPY.headline.goalOnly('Upskill the team', goalReadoutOf(m, 'Upskill the team')))
    expect(m.subline).toBe(HERO_COPY.subline.highestOutcome('Two developers', outcomeReadoutOf(m, 'Two developers')))
  })

  it('recommended id missing from analysed rows claims no analysis leader when no goal crown exists', () => {
    // Same guard with UNIFORM fits (no goal crown): no leader is claimable
    // at all, so the headline states the outcome fact itself and the
    // subline stays null (it would only repeat it).
    const a = makeOption({ ...OPTION_A, goalProbability: 0.4 })
    const b = makeOption({ ...OPTION_B, goalProbability: 0.4 })
    const m = chart(
      buildHeroModel(
        makeHeroData({
          options: [a, b],
          recommendation: {
            recommendedOption: makeOption({ id: 'canvas_ghost', label: 'Ghost' }),
          },
        }),
      ),
    )
    expect(m.leaders.goal).toBeNull()
    expect(m.headline).toBe(HERO_COPY.headline.outcomeLeader('Two developers', outcomeReadoutOf(m, 'Two developers')))
    expect(m.subline).toBeNull()
  })

  it('single option uses the only-option headline and no subline', () => {
    const m = chart(buildHeroModel(makeHeroData({ options: [OPTION_B] })))
    expect(m.headline).toBe('Upskill the team is your only option.')
    expect(m.subline).toBeNull()
  })
})

describe('buildHeroModel — leader-claim banding (UI-SEM-060)', () => {
  // No goal values anywhere: the headline takes the no-goal-basis leader
  // branch, where the leader claim is banded.
  //
  // ROADMAP 1.223: the band is the PRODUCER's (the shared verdict, or
  // decision_brief.headline_banded) — the UI's own win-probability banding is
  // DELETED, so these tests supply the producer claim whose COPY SELECTION
  // (and the subline calibration that hangs off it) is under test. The win
  // probabilities stay in the fixtures because they still drive the row detail
  // lines and the display order; they no longer authorise any claim. The runs
  // that deliberately carry NO producer signal assert the no-claim contract
  // instead, at both ends of the win-probability range.
  const noGoal = (o: ReturnType<typeof makeOption>) =>
    makeOption({ ...o, goalProbability: undefined })

  it('range overlap alone NEVER produces a close-call: a 77% leader with a wide outcome gap keeps the strong claim (staging Tech Lead shape)', () => {
    // The exact miscalibration from the staging screenshot: leader wins 77%,
    // centres +22 vs +8, yet the p10-p90 ranges overlap (-1..45 vs -5..25).
    // Overlap must only append the advisory — never "top options are close".
    const a = noGoal(makeOption({ ...OPTION_A, winProbability: 0.2, expected: 8, outcome: { mean: 8, p10: -5, p50: 8, p90: 25 } }))
    const b = noGoal(makeOption({ ...OPTION_B, winProbability: 0.77, expected: 22, outcome: { mean: 22, p10: -1, p50: 22, p90: 45 } }))
    const m = chart(buildHeroModel(makeHeroData({
      options: [a, b],
      recommendation: { verdict: producerVerdict('clear', 57) },
    })))
    expect(m.headline).toBe(
      HERO_COPY.headline.mostLikelyStrongest('Upskill the team', winReadoutOf(m, 'Upskill the team')),
    )
    expect(m.subline).toBe(
      `${HERO_COPY.subline.highestOutcome('Upskill the team', outcomeReadoutOf(m, 'Upskill the team'))} ${HERO_COPY.subline.overlapAdvisory}`,
    )
    expect(`${m.headline} ${m.subline}`).not.toMatch(/close/i)
  })

  it('strong leader without range overlap gets the plain outcome subline (no advisory)', () => {
    // Ranges disjoint: B 70..90, A 40..60.
    const a = noGoal(makeOption({ ...OPTION_A, winProbability: 0.2, expected: 50, outcome: { mean: 50, p10: 40, p50: 50, p90: 60 } }))
    const b = noGoal(makeOption({ ...OPTION_B, winProbability: 0.8, expected: 80, outcome: { mean: 80, p10: 70, p50: 80, p90: 90 } }))
    const m = chart(buildHeroModel(makeHeroData({
      options: [a, b],
      recommendation: { verdict: producerVerdict('clear', 60) },
    })))
    expect(m.headline).toBe(
      HERO_COPY.headline.mostLikelyStrongest('Upskill the team', winReadoutOf(m, 'Upskill the team')),
    )
    expect(m.subline).toBe(
      HERO_COPY.subline.highestOutcome('Upskill the team', outcomeReadoutOf(m, 'Upskill the team')),
    )
  })

  it('strong but diverged leader keeps the persistent divergence subline', () => {
    // Recommended B wins 80% but A has the higher centre; disjoint ranges.
    const a = noGoal(makeOption({ ...OPTION_A, winProbability: 0.2, expected: 80, outcome: { mean: 80, p10: 70, p50: 80, p90: 90 } }))
    const b = noGoal(makeOption({ ...OPTION_B, winProbability: 0.8, expected: 50, outcome: { mean: 50, p10: 40, p50: 50, p90: 60 } }))
    const m = chart(buildHeroModel(makeHeroData({
      options: [a, b],
      recommendation: { verdict: producerVerdict('clear', 60) },
    })))
    expect(m.headline).toBe(
      HERO_COPY.headline.mostLikelyStrongest('Upskill the team', winReadoutOf(m, 'Upskill the team')),
    )
    expect(m.subline).toBe(
      HERO_COPY.subline.highestOutcome(
        'Two developers',
        m.rows.find((r) => r.label === 'Two developers')!.outcome.readout,
      ),
    )
  })

  it('sub-strong majority leader is "slightly ahead", naming the runner-up ONLY when the outcome gap is genuinely small', () => {
    // Win 55%; centres 68 vs 67 (gap 1 ≤ 15% of 68) → runner-up named.
    const a = noGoal(makeOption({ ...OPTION_A, winProbability: 0.45, expected: 67, outcome: { mean: 67, p10: 55, p50: 67, p90: 80 } }))
    const b = noGoal(makeOption({ ...OPTION_B, winProbability: 0.55, expected: 68, outcome: { mean: 68, p10: 56, p50: 68, p90: 82 } }))
    const m = chart(buildHeroModel(makeHeroData({
      options: [a, b],
      recommendation: { verdict: producerVerdict('slight', 10) },
    })))
    expect(m.headline).toBe(HERO_COPY.headline.slightlyAhead('Upskill the team'))
    expect(m.subline).toBe(HERO_COPY.subline.closeOnOutcome('Two developers'))
  })

  it('"close on expected outcome" never fires from range overlap when the outcome gap is wide', () => {
    // Win 55%; centres 22 vs 8 (gap 14 > 15% of 22) with OVERLAPPING ranges:
    // the closeness line must not appear — overlap is not outcome closeness.
    const a = noGoal(makeOption({ ...OPTION_A, winProbability: 0.45, expected: 8, outcome: { mean: 8, p10: -5, p50: 8, p90: 25 } }))
    const b = noGoal(makeOption({ ...OPTION_B, winProbability: 0.55, expected: 22, outcome: { mean: 22, p10: -1, p50: 22, p90: 45 } }))
    const m = chart(buildHeroModel(makeHeroData({
      options: [a, b],
      recommendation: { verdict: producerVerdict('slight', 10) },
    })))
    expect(m.headline).toBe(HERO_COPY.headline.slightlyAhead('Upskill the team'))
    expect(m.subline).toBe(HERO_COPY.subline.aligned('Upskill the team'))
    expect(m.subline).not.toMatch(/close|overlap/i)
  })

  it('runner-up naming comes from the rendered outcome ranking, not the input order', () => {
    // Recommended Gamma at 55% win; runner-up by CENTRE is Alpha (69) not
    // Beta (50) — the copy must name Alpha, matching the rendered rows.
    const a = noGoal(makeOption({ id: 'opt_a2', label: 'Alpha', winProbability: 0.25, expected: 69, outcome: { mean: 69, p10: 57, p50: 69, p90: 81 } }))
    const b = noGoal(makeOption({ id: 'opt_b2', label: 'Beta', winProbability: 0.2, expected: 50, outcome: { mean: 50, p10: 40, p50: 50, p90: 60 } }))
    const c = noGoal(makeOption({ id: 'opt_c2', label: 'Gamma', winProbability: 0.55, isRecommended: true, expected: 70, outcome: { mean: 70, p10: 58, p50: 70, p90: 82 } }))
    const m = chart(buildHeroModel(makeHeroData({
      options: [b, a, c],
      recommendation: { verdict: producerVerdict('slight', 30, 'opt_c2') },
    })))
    expect(m.rows.map((r) => r.label)).toEqual(['Gamma', 'Alpha', 'Beta'])
    expect(m.headline).toBe(HERO_COPY.headline.slightlyAhead('Gamma'))
    expect(m.subline).toBe(HERO_COPY.subline.closeOnOutcome('Alpha'))
  })

  // ── ROADMAP 1.223: raw win probabilities authorise NOTHING ───────────────
  // These two used to assert the UI's own banding at either end of the range
  // (near-tie → "No option is clearly ahead"; a clear sub-majority gap →
  // "slightly ahead"). That banding is deleted, so both now pin the contract
  // that replaced it: with no producer claim the hero makes none either.
  it('near-tied win probabilities with NO producer signal stay SILENT — silence, never a denial', () => {
    // 30% vs 28%. The UI used to band this "No option is clearly ahead." —
    // itself an unearned claim. Denying a leader is as much a claim as
    // asserting one, and the UI has authority for neither.
    const a = noGoal(makeOption({ ...OPTION_A, winProbability: 0.28, expected: 67, outcome: { mean: 67, p10: 55, p50: 67, p90: 80 } }))
    const b = noGoal(makeOption({ ...OPTION_B, winProbability: 0.3, expected: 68, outcome: { mean: 68, p10: 56, p50: 68, p90: 82 } }))
    const m = chart(buildHeroModel(makeHeroData({ options: [a, b] })))
    expect(m.headline).toBe(HERO_COPY.headline.noLeader)
    expect(m.headline).not.toBe(HERO_COPY.headline.noClearLeader)
    expect(m.subline).toBe(HERO_COPY.subline.compareTop)
  })

  it('a decisive win gap with NO producer signal earns NO leader claim (the CEE #711 withheld-turn shape)', () => {
    // 45% vs 20% — decisive by any threshold, and exactly the shape a
    // withheld turn puts on the wire: the win probabilities keep riding it
    // because the DATA is not withheld, only the CLAIM. Re-banding them here
    // is what reconstructed the withheld claim in nine places.
    const a = noGoal(makeOption({ ...OPTION_A, winProbability: 0.2, expected: 67, outcome: { mean: 67, p10: 55, p50: 67, p90: 80 } }))
    const b = noGoal(makeOption({ ...OPTION_B, winProbability: 0.45, expected: 68, outcome: { mean: 68, p10: 56, p50: 68, p90: 82 } }))
    const m = chart(buildHeroModel(makeHeroData({ options: [a, b] })))
    expect(m.headline).toBe(HERO_COPY.headline.noLeader)
    expect(m.subline).toBe(HERO_COPY.subline.compareTop)
    expect(`${m.headline} ${m.subline}`).not.toMatch(/slightly|most likely|strongest|highest/i)
  })

  it('missing win probabilities claim nothing — banded copy is never guessed', () => {
    const a = noGoal(makeOption({ ...OPTION_A, winProbability: undefined, expected: 60, outcome: { mean: 60, p10: 45, p50: 60, p90: 70 } }))
    const b = noGoal(makeOption({ ...OPTION_B, winProbability: undefined, expected: 68, outcome: { mean: 68, p10: 55, p50: 68, p90: 85 } }))
    const m = chart(buildHeroModel(makeHeroData({ options: [a, b] })))
    expect(m.headline).toBe(HERO_COPY.headline.noLeader)
    expect(m.subline).toBe(HERO_COPY.subline.compareTop)
    expect(`${m.headline} ${m.subline}`).not.toMatch(/close|overlap|slightly|most likely/i)
  })
})

describe('buildHeroModel — producer band consumption (PLoT decision_brief.headline_banded)', () => {
  // Producer leg of UI-SEM-060 (PLoT #200): when the producer emits its own
  // leader-confidence band naming the SAME leader the hero headlines, the
  // producer band drives the banded copy. ROADMAP 1.223 removed the other
  // leg entirely — there is no UI fallback left, so a band that is absent,
  // names a different leader, or fails the normaliser upstream now yields NO
  // leader claim at all. Bands map onto the existing copy — no new wording.
  const noGoal = (o: ReturnType<typeof makeOption>) =>
    makeOption({ ...o, goalProbability: undefined })

  // Leader B at 55% win — a shape the deleted UI banding would have called
  // 'ahead' on its own. Every claim below must now come from the producer.
  const options = () => [
    noGoal(makeOption({ ...OPTION_A, winProbability: 0.45, expected: 50, outcome: { mean: 50, p10: 40, p50: 50, p90: 60 } })),
    noGoal(makeOption({ ...OPTION_B, winProbability: 0.55, expected: 80, outcome: { mean: 80, p10: 70, p50: 80, p90: 90 } })),
  ]

  it('producer clearly_ahead → strong claim on a run whose raw win probabilities are merely 55/45', () => {
    const m = chart(buildHeroModel(makeHeroData({
      options: options(),
      recommendation: {
        headlineBanded: { band: 'clearly_ahead', leaderOptionId: 'opt_b', robustnessGated: false },
      },
    })))
    expect(m.headline).toBe(HERO_COPY.headline.mostLikelyStrongest('Upskill the team', winReadoutOf(m, 'Upskill the team')))
  })

  it('producer very_close → no-clear-leader claim on a run whose leader wins 80%', () => {
    // An 80% win reads as a strong lead in the raw numbers; only the
    // producer's near-tie band may speak (producer-first, no second opinion).
    const a = noGoal(makeOption({ ...OPTION_A, winProbability: 0.2, expected: 50, outcome: { mean: 50, p10: 40, p50: 50, p90: 60 } }))
    const b = noGoal(makeOption({ ...OPTION_B, winProbability: 0.8, expected: 80, outcome: { mean: 80, p10: 70, p50: 80, p90: 90 } }))
    const m = chart(buildHeroModel(makeHeroData({
      options: [a, b],
      recommendation: {
        headlineBanded: { band: 'very_close', leaderOptionId: 'opt_b', robustnessGated: false },
      },
    })))
    expect(m.headline).toBe('No option is clearly ahead.')
    expect(m.subline).toBe('Compare the top options before deciding.')
  })

  it('producer slightly_ahead → "slightly ahead" copy (robustness_gated downgrade already producer-applied)', () => {
    const m = chart(buildHeroModel(makeHeroData({
      options: options(),
      recommendation: {
        headlineBanded: { band: 'slightly_ahead', leaderOptionId: 'opt_b', robustnessGated: true },
      },
    })))
    expect(m.headline).toBe('Upskill the team is slightly ahead.')
  })

  it('producer band naming a DIFFERENT leader than the hero headline is not applied (identity gate → NO claim)', () => {
    // The producer claim is about opt_a; the hero headlines opt_b (the
    // Results Panel leader). Applying opt_a's band to opt_b would transform
    // meaning, so the band is dropped — and with ROADMAP 1.223 there is
    // nothing behind it: the gate fails closed to NO leader claim, not to a
    // UI-derived one. The load-bearing half is unchanged: opt_a's
    // "clearly ahead" is never spoken about either option.
    const m = chart(buildHeroModel(makeHeroData({
      options: options(),
      recommendation: {
        headlineBanded: { band: 'clearly_ahead', leaderOptionId: 'opt_a', robustnessGated: false },
      },
    })))
    expect(m.headline).toBe(HERO_COPY.headline.noLeader)
    // Negative assertions: no comparative leader sentence for EITHER label at
    // ANY magnitude. Asserting against one interpolation would pass simply
    // because the number differed, which is not what is being denied.
    for (const label of ['Upskill the team', 'Two developers']) {
      expect(m.headline).not.toContain(`${label} came out ahead in`)
    }
    expect(m.subline).toBe(HERO_COPY.subline.compareTop)
  })

  // ── SINGLE VERDICT (2026-07-25) ──────────────────────────────────────────
  // The hero now quotes the shared verdict (src/lib/decisionVerdict.ts) — the
  // SAME answer the canvas badge, the results-panel headline and the checks
  // footer use — instead of resolving the producer band and banding win
  // probabilities itself. It takes precedence over both local paths.
  it('SINGLE VERDICT: a tied verdict denies a leader even where the local banding would claim one', () => {
    const m = chart(buildHeroModel(makeHeroData({
      options: options(),
      recommendation: {
        // Local paths would BOTH claim a leader here; the shared verdict wins.
        headlineBanded: { band: 'clearly_ahead', leaderOptionId: 'opt_b', robustnessGated: false },
        verdict: { leaderId: 'opt_b', separation: 'tied', hasLeadingOption: false, gapPp: 3, source: 'producer_near_tie' },
      },
    })))
    expect(m.headline).toBe('No option is clearly ahead.')
  })

  it('SINGLE VERDICT: a clear verdict claims a leader even where the producer band said very_close', () => {
    const m = chart(buildHeroModel(makeHeroData({
      options: options(),
      recommendation: {
        headlineBanded: { band: 'very_close', leaderOptionId: 'opt_b', robustnessGated: false },
        verdict: { leaderId: 'opt_b', separation: 'clear', hasLeadingOption: true, gapPp: 52, source: 'producer_near_tie' },
      },
    })))
    expect(m.headline).toBe(HERO_COPY.headline.mostLikelyStrongest('Upskill the team', winReadoutOf(m, 'Upskill the team')))
  })

  it('SINGLE VERDICT identity gate: a verdict naming a different leader is not applied (→ NO claim)', () => {
    const m = chart(buildHeroModel(makeHeroData({
      options: options(),
      recommendation: {
        verdict: { leaderId: 'opt_a', separation: 'tied', hasLeadingOption: false, gapPp: 1, source: 'producer_near_tie' },
      },
    })))
    // The verdict is about opt_a; the hero headlines opt_b. Neither the tie
    // it declares nor any UI-derived substitute may be spoken about opt_b —
    // the gate fails closed to silence (ROADMAP 1.223).
    expect(m.headline).toBe(HERO_COPY.headline.noLeader)
    expect(m.headline).not.toBe(HERO_COPY.headline.noClearLeader)
    expect(m.headline).not.toBe(HERO_COPY.headline.slightlyAhead('Upskill the team'))
    expect(m.subline).toBe(HERO_COPY.subline.compareTop)
  })

  it('absent producer band → NO leader claim (the UI-SEM-060 residual fallback is deleted)', () => {
    // The residual fallback this test used to pin ("55% win → slightly
    // ahead") is gone: an absent band is now indistinguishable from a
    // withheld claim, so the hero declines to speak rather than degrade.
    const m = chart(buildHeroModel(makeHeroData({ options: options() })))
    expect(m.headline).toBe(HERO_COPY.headline.noLeader)
    expect(m.subline).toBe(HERO_COPY.subline.compareTop)
  })

  it('producer band never invents a leader claim on the goal-basis headline branch', () => {
    // With a goal basis the headline stays the goal-fit claim; the banded
    // no-goal-basis path (and therefore the producer band) is not in play.
    const m = chart(buildHeroModel(makeHeroData({
      recommendation: {
        headlineBanded: { band: 'very_close', leaderOptionId: 'opt_b', robustnessGated: false },
      },
    })))
    expect(m.headline).toBe(HERO_COPY.headline.goalOnly('Upskill the team', goalReadoutOf(m, 'Upskill the team')))
  })
})

describe('buildHeroModel — readout-tie coherence (UI-SEM-070) and span floor (UI-SEM-054)', () => {
  const noGoal = (o: ReturnType<typeof makeOption>) =>
    makeOption({ ...o, goalProbability: undefined, winProbability: undefined })

  // The reported staging run: unitless outcomes (goal node carries no unit),
  // no win probabilities, four options whose expected outcomes all round to
  // "100". The old subline crowned one as "strongest expected outcome" while
  // every rendered readout was identical.
  //
  // The runs below carry a PRODUCER verdict (ROADMAP 1.223: nothing else may
  // author a leader claim). That is load-bearing for this suite, not
  // decoration: UI-SEM-070 is a gate ON the subline the leader claim would
  // otherwise produce, so without a claim the "never says strongest/highest"
  // assertions would pass by testing nothing — the neutral no-claim subline
  // contains neither word by construction (trap 13).
  const tiedRun = (recommendationOverrides: Partial<DecisionResultData> = {}) =>
    makeHeroData({
      recommendation: {
        goalLabel: 'Ship v2 within 6 months',
        goalThreshold: null,
        outcomeUnit: undefined,
        outcomeUnitSymbol: undefined,
        isNormalised: false,
        storyHeadlines: undefined,
        flipThresholds: undefined,
        ...recommendationOverrides,
      },
      options: [
        noGoal(makeOption({ id: 'opt_contractor', label: 'Outsourced Contractor Team', isRecommended: true, expected: 100.4, outcome: { mean: 100.4, p10: 99.7, p50: 100.4, p90: 101.1 } })),
        noGoal(makeOption({ id: 'opt_status_quo', label: 'Continue with Current Team', expected: 100.2, outcome: { mean: 100.2, p10: 99.5, p50: 100.2, p90: 100.9 } })),
        noGoal(makeOption({ id: 'opt_juniors', label: 'Hire Two Junior Engineers', expected: 100.0, outcome: { mean: 100.0, p10: 99.3, p50: 100.0, p90: 100.7 } })),
        noGoal(makeOption({ id: 'opt_senior', label: 'Hire One Senior Engineer', expected: 99.8, outcome: { mean: 99.8, p10: 99.1, p50: 99.8, p90: 100.5 } })),
      ],
    })

  it('all four outcomes render the same readout — the chart shows no strongest option', () => {
    const m = chart(buildHeroModel(tiedRun()))
    expect(m.rows.map((r) => r.outcome.readout)).toEqual(['100', '100', '100', '100'])
  })

  it('never claims "strongest/highest expected outcome" when the top readouts are identical', () => {
    // The producer claims a clear leader — the strongest pressure on the
    // subline there is (it is the branch that says "has the highest expected
    // outcome"). The headline still carries the claim and still names the
    // panel's recommended leader (no cross-surface contradiction); only the
    // over-claiming subline is gated.
    const m = chart(buildHeroModel(tiedRun({ verdict: producerVerdict('clear', 12, 'opt_contractor') })))
    expect(m.headline).toBe(
      HERO_COPY.headline.mostLikelyStrongest(
        'Outsourced Contractor Team',
        winReadoutOf(m, 'Outsourced Contractor Team'),
      ),
    )
    expect(m.subline).toBe(HERO_COPY.subline.outcomesClose)
    expect(m.subline).not.toMatch(/strongest|highest/i)
  })

  it('coherence invariant: identical rendered readouts ⇒ no strongest/highest claim (any recommended row)', () => {
    // Rotate which option is recommended; the invariant must hold every time.
    // The verdict follows the rotation so every pass actually reaches the
    // claim-bearing subline branches the gate has to suppress.
    for (const recId of ['opt_contractor', 'opt_status_quo', 'opt_juniors', 'opt_senior']) {
      const data = tiedRun({ verdict: producerVerdict('clear', 12, recId) })
      const opts = data.recommendation.allOptions!.map((o) => ({ ...o, isRecommended: o.id === recId }))
      ;(data.recommendation as { allOptions: unknown }).allOptions = opts
      ;(data.recommendation as { recommendedOption: unknown }).recommendedOption =
        opts.find((o) => o.id === recId) ?? null
      const m = chart(buildHeroModel(data))
      const readouts = new Set(m.rows.map((r) => r.outcome.readout))
      expect(readouts.size, `readouts should be tied for ${recId}`).toBe(1)
      expect(m.subline ?? '', `subline over-claims for ${recId}`).not.toMatch(/strongest|highest/i)
    }
  })

  it('span floor: a spread tiny relative to the values does not zoom the axis (dots stay clustered)', () => {
    const m = chart(buildHeroModel(tiedRun()))
    const span = m.outcomeDomain!.max - m.outcomeDomain!.min
    // Raw coord span is ~2 (99.1..101.1); floored to ≥ 0.15 × ~100 = 15.
    expect(span).toBeGreaterThan(14)
    // The centres (99.8..100.4) therefore occupy only a sliver of the track.
    const centreSpread = 100.4 - 99.8
    expect(centreSpread / span).toBeLessThan(0.1)
  })

  it('span floor leaves a genuine spread untouched (no compression of real differences)', () => {
    // Centres/ranges spanning 40..90 (span 50, > 0.15 × 90 = 13.5) — unfloored.
    const a = noGoal(makeOption({ id: 'w_a', label: 'A', isRecommended: true, expected: 85, outcome: { mean: 85, p10: 80, p50: 85, p90: 90 } }))
    const b = noGoal(makeOption({ id: 'w_b', label: 'B', expected: 45, outcome: { mean: 45, p10: 40, p50: 45, p90: 50 } }))
    const m = chart(buildHeroModel(makeHeroData({ recommendation: { goalThreshold: null, outcomeUnit: undefined, isNormalised: false }, options: [a, b] })))
    // Domain hugs 40..90 with only the 5% pad — span well under the ×2 a
    // floor would have produced.
    expect(m.outcomeDomain!.min).toBeGreaterThan(37)
    expect(m.outcomeDomain!.max).toBeLessThan(93)
  })

  it('no-option-on-track run with tied readouts does not claim "highest expected outcome"', () => {
    // Goal lens available, every option below the sub-1% floor (no-on-track
    // headline) AND tied outcomes — the subline must not crown an outcome
    // leader either.
    const belowFloor = (o: ReturnType<typeof makeOption>) =>
      makeOption({ ...o, goalProbability: 0.004, winProbability: undefined })
    const m = chart(
      buildHeroModel(
        makeHeroData({
          recommendation: { goalThreshold: 50, outcomeUnit: undefined, isNormalised: false, storyHeadlines: undefined, flipThresholds: undefined },
          options: [
            belowFloor(makeOption({ id: 'o1', label: 'Alpha', isRecommended: true, expected: 100.3, outcome: { mean: 100.3, p10: 99.6, p50: 100.3, p90: 101.0 } })),
            belowFloor(makeOption({ id: 'o2', label: 'Beta', expected: 100.1, outcome: { mean: 100.1, p10: 99.4, p50: 100.1, p90: 100.8 } })),
            belowFloor(makeOption({ id: 'o3', label: 'Gamma', expected: 99.9, outcome: { mean: 99.9, p10: 99.2, p50: 99.9, p90: 100.6 } })),
          ],
        }),
      ),
    )
    expect(m.headline).toBe('No option is currently on track to meet every target this run scored.')
    expect(m.subline).toBe('The top options are close on expected outcome.')
    expect(m.subline).not.toMatch(/highest|strongest/i)
  })

  it('no recommended option + tied readouts falls through to the neutral compare headline', () => {
    const opt = (id: string, label: string, expected: number) =>
      makeOption({ id, label, expected, winProbability: undefined, goalProbability: undefined, outcome: { mean: expected, p10: expected - 0.6, p50: expected, p90: expected + 0.6 } })
    const m = chart(
      buildHeroModel(
        makeHeroData({
          recommendation: { goalThreshold: null, outcomeUnit: undefined, isNormalised: false, storyHeadlines: undefined, flipThresholds: undefined },
          options: [opt('a', 'Alpha', 100.2), opt('b', 'Beta', 100.0), opt('c', 'Gamma', 99.8)],
        }),
      ),
    )
    // No recommendedOption → no leader headline; tied readouts → the outcome
    // headline must not crown a winner. Neutral pairing instead.
    expect(m.headline).toBe('Here is how your options compare.')
    expect(m.subline).toBe('The top options are close on expected outcome.')
    expect(`${m.headline} ${m.subline}`).not.toMatch(/highest|strongest/i)
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

  it('goal-fit detail wording is PER ROW under mixed constraint coverage', () => {
    // The selector collapses goalProbability per option (joint only for
    // options carrying their own constraint analysis), so in a mixed set the
    // constrained row's joint figure must say "goal and limits" while the
    // unconstrained row stays goal-alone — even though the SHARED
    // axis/caption fall back to goal-alone (hasConstraints false).
    const b = makeOption({ ...OPTION_B, constraintAnalysis: CONSTRAINT })
    const m = chart(buildHeroModel(makeHeroData({ options: [OPTION_A, b] })))
    expect(m.hasConstraints).toBe(false)
    expect(m.rows.find((r) => r.id === 'opt_a')!.detail.goalFit).toBe(
      '34% chance of hitting your goal.',
    )
    expect(m.rows.find((r) => r.id === 'opt_b')!.detail.goalFit).toBe(
      '49% chance of meeting your goal and limits.',
    )
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

  it('targetUnit passes through the existing outcome unit fields (never invented)', () => {
    // Fixture default: 'count' — no honest unit glyph exists.
    expect(chart(buildHeroModel(makeHeroData())).targetUnit).toBeNull()
    // Percent outcomes label the editor with %.
    expect(
      chart(buildHeroModel(makeHeroData({ recommendation: { outcomeUnit: 'percent' } })))
        .targetUnit,
    ).toBe('%')
    // Currency outcomes reuse the existing symbol.
    expect(
      chart(
        buildHeroModel(
          makeHeroData({
            recommendation: { outcomeUnit: 'currency', outcomeUnitSymbol: '£' },
          }),
        ),
      ).targetUnit,
    ).toBe('£')
  })

  it('counts the rows that draw a range line (caption wording gate)', () => {
    // Both fixture rows carry p10/p90.
    expect(chart(buildHeroModel(makeHeroData())).outcomeRangedRowCount).toBe(2)
    // Stripping one row's range drops the count to 1 (overlap sentence off).
    const stripped = makeOption({
      ...OPTION_A,
      outcome: { mean: 68, p10: null, p50: 67, p90: null },
      p10: null,
      p90: null,
    })
    expect(
      chart(buildHeroModel(makeHeroData({ options: [stripped, OPTION_B] }))).outcomeRangedRowCount,
    ).toBe(1)
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
    const b = makeOption({ ...OPTION_B, goalProbability: undefined, winProbability: undefined })
    const m = chart(buildHeroModel(makeHeroData({ options: [a, b] })))
    expect(m.lenses).toEqual(['outcome'])
    expect(m.defaultLens).toBe('outcome')
    // Incidental to the lens gate under test, but pinned so a leader claim
    // cannot creep back in through it: this run carries no producer verdict
    // or band, so the hero claims no leader at all (ROADMAP 1.223) and never
    // an outcome-lens "strongest" claim in its place.
    expect(m.headline).toBe(HERO_COPY.headline.noLeader)
    expect(m.subline).toBe(HERO_COPY.subline.compareTop)
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
    expect(Object.keys(m.leaders)).toEqual(['goal', 'outcome', 'stability', 'whatChanged'])
  })

  it('four-option order is the SHARED comparator, NOT the active-lens metric (trust invariant)', () => {
    // Reproduces the reviewer's four-option observation and the earlier
    // staging #1-vs-#4 defect it guards against: win probability descends
    // A>B>C>D, but BOTH lens metrics rank D above C — so per-lens values are
    // legitimately out of descending order because rows follow the shared
    // overall comparator (sortOptionsForDisplay), never the active lens.
    const opts = [
      makeOption({ id: 'opt_a', label: 'A', winProbability: 0.5, expected: 30, outcome: { mean: 30, p10: 20, p50: 30, p90: 40 }, goalProbability: 0.6 }),
      makeOption({ id: 'opt_b', label: 'B', winProbability: 0.3, expected: 20, outcome: { mean: 20, p10: 12, p50: 20, p90: 28 }, goalProbability: 0.3 }),
      // C ranks 3rd by win, but LOWER on both lenses than D (4th by win).
      makeOption({ id: 'opt_c', label: 'C', winProbability: 0.1, expected: 4, outcome: { mean: 4, p10: 1, p50: 4, p90: 7 }, goalProbability: 0.11 }),
      makeOption({ id: 'opt_d', label: 'D', winProbability: 0.05, expected: 6, outcome: { mean: 6, p10: 2, p50: 6, p90: 10 }, goalProbability: 0.22 }),
    ]
    // Input deliberately scrambled — the hero must re-derive the order, not
    // trust the array it was handed.
    const scrambled = [opts[2], opts[0], opts[3], opts[1]]
    const m = chart(buildHeroModel(makeHeroData({ options: scrambled })))

    // (1) Row order equals the shared comparator applied independently.
    const expectedOrder = sortOptionsForDisplay(scrambled, { designationsWithheld: false }).map((o) => o.id)
    expect(m.rows.map((r) => r.id)).toEqual(expectedOrder)
    expect(expectedOrder).toEqual(['opt_a', 'opt_b', 'opt_c', 'opt_d']) // win desc
    // (2) Row NUMBER tokens match row order (1..4), independent of lens.
    expect(m.rows.map((r) => r.index)).toEqual([1, 2, 3, 4])
    // (3) Proof it is NOT lens-sorted: on BOTH lenses row 3 (C) sits below
    //     row 4 (D) — descending-by-lens would have swapped them.
    expect(m.rows[2].outcome.centre! < m.rows[3].outcome.centre!).toBe(true) // +4 vs +6
    expect(m.rows[2].goal.value! < m.rows[3].goal.value!).toBe(true) // 11% vs 22%
  })

})

describe('buildHeroModel — states', () => {
  it('DELIBERATE PIN FLIP (Lane 3 / SF2): loading with RETAINED rows keeps the chart — the panel must not unmount on a rerun', () => {
    // The store retains the previous report through a rerun; returning
    // 'empty' here unmounted AnalysisHeroPanel every run, wiping the lens
    // choice and the goal-lens auto-switch's transition ref (the review
    // blocker: the SF2 continuity claim was unmet for the hero itself).
    expect(buildHeroModel(makeHeroData({ isLoading: true })).kind).toBe('chart')
  })

  it('returns empty while loading with NO renderable rows (first run)', () => {
    expect(buildHeroModel(makeHeroData({ isLoading: true, options: [] })).kind).toBe('empty')
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

  it('DELIBERATE PIN FLIP (Lane 3 / SF2): a FAILED RERUN with retained rows keeps the chart — the failure story belongs to the banner/strip', () => {
    // Post-SF2 the body renders the retained previous report at status
    // 'error'; a hero card saying "The analysis did not complete / Run the
    // analysis again to see results here" directly above those retained
    // results contradicted the "Showing results from previous analysis"
    // banner (review blocker, second half).
    const failed: ResultCompleteness = { ...FULL_COMPLETENESS, status: 'failed' }
    const m = buildHeroModel(makeHeroData({ isError: true, completeness: failed }))
    expect(m.kind).toBe('chart')
  })

  it('renders the failed status state on hook error with NO renderable rows', () => {
    const failed: ResultCompleteness = { ...FULL_COMPLETENESS, status: 'failed' }
    const m = buildHeroModel(makeHeroData({ isError: true, options: [], completeness: failed }))
    expect(m).toMatchObject({ kind: 'status', variant: 'failed' })
  })

  it('a DISPLAYED report whose own analysisStatus is failed still shows the failed card (retained rows or not)', () => {
    const m = buildHeroModel(makeHeroData({ recommendation: { analysisStatus: 'failed' } }))
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
    expect(m.rows[0].detail.winChance).toBe(COMPARATIVE_COPY.sentence('30%'))
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

describe('buildHeroModel — goal-fit crown follows the goal argmax (UI-SEM-072)', () => {
  // Live staging evidence (acceptance-evidence/goal-fit/6b-browser, 2026-07-08):
  // the WIN-probability leader carried the LOWEST goal fit (4% vs 7%/6%) yet was
  // crowned "is most likely to meet every target this run scored" + "(Highest on this view)" on the Goal fit lens.
  // The crown must follow the highest goalProbability (= the collapsed
  // probability_of_joint_goal when constraints exist) — never the recommendation
  // re-crowned onto a view it does not lead.
  const relocate = makeOption({
    id: 'opt_relocate_manchester',
    label: 'Relocate to Manchester',
    expected: 88,
    outcome: { mean: 88, p10: 70, p50: 87, p90: 99 },
    winProbability: 0.52,
    isRecommended: true,
    goalProbability: 0.043,
  })
  const statusQuo = makeOption({
    id: 'opt_status_quo',
    label: 'Stay in London',
    expected: 62,
    outcome: { mean: 62, p10: 50, p50: 61, p90: 74 },
    winProbability: 0.26,
    goalProbability: 0.07375,
  })
  const hybrid = makeOption({
    id: 'opt_hybrid',
    label: 'Hybrid hub',
    expected: 70,
    outcome: { mean: 70, p10: 55, p50: 69, p90: 85 },
    winProbability: 0.22,
    goalProbability: 0.05875,
  })

  it('crowns the max goal probability, never the win-probability leader (live 4/7/6 shape)', () => {
    const m = chart(buildHeroModel(makeHeroData({ options: [relocate, statusQuo, hybrid] })))
    expect(m.leaders.goal).toBe('opt_status_quo')
    expect(m.headline).toBe(HERO_COPY.headline.goalOnly('Stay in London', goalReadoutOf(m, 'Stay in London')))
  })

  it('states the tension against the crowned row, not the recommended option', () => {
    // Crowned Status Quo (7%) is not the outcome leader (Relocate is): the
    // persistent divergence subline names the outcome leader.
    const m = chart(buildHeroModel(makeHeroData({ options: [relocate, statusQuo, hybrid] })))
    expect(m.subline).toBe(HERO_COPY.subline.highestOutcome('Relocate to Manchester', outcomeReadoutOf(m, 'Relocate to Manchester')))
  })

  it('uniform fits crown nobody (no crown rather than a wrong crown)', () => {
    const a = makeOption({ ...OPTION_A, goalProbability: 0.34 })
    const b = makeOption({ ...OPTION_B, goalProbability: 0.34 })
    const m = chart(buildHeroModel(makeHeroData({ options: [a, b] })))
    expect(m.leaders.goal).toBeNull()
    expect(m.headline).not.toContain('has the highest chance of meeting every target this run scored')
  })

  it('a tie at the max crowns nobody even when other fits differ', () => {
    const a = makeOption({ ...OPTION_A, goalProbability: 0.4 })
    const b = makeOption({ ...OPTION_B, goalProbability: 0.4 })
    const c = makeOption({
      id: 'opt_c',
      label: 'Option C',
      expected: 50,
      outcome: { mean: 50, p10: 40, p50: 50, p90: 60 },
      winProbability: 0.1,
      goalProbability: 0.2,
    })
    const m = chart(buildHeroModel(makeHeroData({ options: [a, b, c] })))
    expect(m.leaders.goal).toBeNull()
    expect(m.headline).not.toContain('has the highest chance of meeting every target this run scored')
  })

  it('partial fit coverage crowns nobody (a max over unmeasured rivals is not "best")', () => {
    const a = makeOption({ ...OPTION_A, goalProbability: 0.34 })
    const b = makeOption({ ...OPTION_B, goalProbability: undefined })
    const m = chart(buildHeroModel(makeHeroData({ options: [a, b] })))
    expect(m.leaders.goal).toBeNull()
    expect(m.headline).not.toContain('has the highest chance of meeting every target this run scored')
  })

  it('a unique max still gets no crown below the sub-1% floor', () => {
    const a = makeOption({ ...OPTION_A, goalProbability: 0.004 })
    const b = makeOption({ ...OPTION_B, goalProbability: 0.002 })
    const m = chart(buildHeroModel(makeHeroData({ options: [a, b] })))
    // All rows below the floor: the no-option-on-track honesty takes over.
    expect(m.leaders.goal).toBeNull()
    expect(m.headline).toBe('No option is currently on track to meet every target this run scored.')
  })
})
describe('Wave 2: identity-anchored stable numbers (brief §6.4)', () => {
  it('rows carry stableNumber from the numbering map alongside the positional index', () => {
    const m = chart(buildHeroModel(makeHeroData(), { opt_a: 1, opt_b: 2 }))
    expect(m.rows.map((r) => [r.id, r.index, r.stableNumber])).toEqual([
      ['opt_a', 1, 1],
      ['opt_b', 2, 2],
    ])
  })

  it('a rerun rank flip keeps stableNumber anchored to the option id', () => {
    const a = makeOption({ ...OPTION_A, winProbability: 0.3 })
    const b = makeOption({ ...OPTION_B, winProbability: 0.7 })
    const m = chart(buildHeroModel(makeHeroData({ options: [a, b] }), { opt_a: 1, opt_b: 2 }))
    expect(m.rows.map((r) => [r.id, r.index, r.stableNumber])).toEqual([
      ['opt_b', 1, 2],
      ['opt_a', 2, 1],
    ])
  })

  it('falls back to null for ALL rows when any id is unregistered (no positional/stable mixing)', () => {
    const m = chart(buildHeroModel(makeHeroData(), { opt_a: 1 }))
    expect(m.rows.map((r) => r.stableNumber)).toEqual([null, null])
  })

  it('omitting the numbering map keeps every stableNumber null (back-compat)', () => {
    const m = chart(buildHeroModel(makeHeroData()))
    expect(m.rows.map((r) => r.stableNumber)).toEqual([null, null])
  })
})
describe('Wave 2 (§6.5): quick evidence links', () => {
  const focusableTop = {
    ...makeDriver('Developer capacity'),
    canFocus: true,
    matchedNodeId: 'node_dev_capacity',
  }
  const fragile = {
    ...makeDriver('Salary cost'),
    factorKey: 'fac_salary',
    canFocus: true,
    matchedNodeId: 'node_salary',
    fragileEdgeInfo: { switchProbability: 0.62, alternativeWinnerLabel: 'Two developers' },
  }

  it('mainDriver carries the top driver focus target when focusable', () => {
    const m = chart(buildHeroModel(makeHeroData({ drivers: { topDrivers: [focusableTop], drivers: [focusableTop] } })))
    expect(m.quickLinks.mainDriver).toEqual({ label: 'Developer capacity', targetId: 'node_dev_capacity' })
  })

  it('mainDriver is null when the top driver cannot focus (static main reason remains)', () => {
    const m = chart(buildHeroModel(makeHeroData()))
    expect(m.quickLinks.mainDriver).toBeNull()
    expect(m.mainReason).toBe('Main driver: Developer capacity.')
  })

  it('topFlipRisk picks the highest switch-probability fragile driver above the visibility floor', () => {
    const weaker = {
      ...makeDriver('Hiring speed'),
      factorKey: 'fac_hiring',
      canFocus: true,
      matchedNodeId: 'node_hiring',
      fragileEdgeInfo: { switchProbability: 0.3 },
    }
    const m = chart(buildHeroModel(makeHeroData({ drivers: { topDrivers: [focusableTop], drivers: [focusableTop, weaker, fragile] } })))
    expect(m.quickLinks.topFlipRisk).toEqual({ label: 'Salary cost', targetId: 'node_salary' })
  })

  it('topFlipRisk is null when no fragile driver clears the floor or can focus', () => {
    const below = { ...fragile, fragileEdgeInfo: { switchProbability: 0.1 } }
    const unfocusable = { ...fragile, canFocus: false, matchedNodeId: undefined }
    expect(chart(buildHeroModel(makeHeroData({ drivers: { drivers: [below] } }))).quickLinks.topFlipRisk).toBeNull()
    expect(chart(buildHeroModel(makeHeroData({ drivers: { drivers: [unfocusable] } }))).quickLinks.topFlipRisk).toBeNull()
  })

  it('quick-link labels are glossary-gated like the main reason', () => {
    const banned = { ...fragile, factorLabel: 'edge weight graph' }
    const m = chart(buildHeroModel(makeHeroData({ drivers: { drivers: [banned] } })))
    expect(m.quickLinks.topFlipRisk).toBeNull()
  })
})
describe('Wave 2 (§6.6): evidence disclosure model', () => {
  const focusable = {
    ...makeDriver('Developer capacity'),
    canFocus: true,
    matchedNodeId: 'node_dev',
  }
  const unfocusable = { ...makeDriver('Team morale'), factorKey: 'fac_morale', rank: 2 }

  it('drivers view: producer rank order, null target when unfocusable, banned labels dropped', () => {
    const banned = { ...makeDriver('edge weight graph'), factorKey: 'fac_banned', rank: 3 }
    const m = chart(buildHeroModel(makeHeroData({ drivers: { drivers: [focusable, unfocusable, banned] } })))
    expect(m.evidence.drivers).toEqual([
      { rank: 1, label: 'Developer capacity', targetId: 'node_dev', direction: null, influence: 1 },
      { rank: 2, label: 'Team morale', targetId: null, direction: null, influence: 1 },
    ])
  })

  it('flip risks: falls-below sentence with user unit and alternative winner', () => {
    const m = chart(buildHeroModel(makeHeroData()))
    expect(m.evidence.flipRisks).toEqual([
      {
        text: 'If Team capacity falls below 30%, Two developers becomes the likely leader.',
        targetId: 'fac_capacity',
        switchMeta: null,
        magnitude: null,
      },
    ])
  })

  it('flip risks: rises-above branch and the no-alternative fallback', () => {
    const m = chart(buildHeroModel(makeHeroData({ recommendation: {
      flipThresholds: [
        { label: 'Salary cost', node_id: 'fac_salary', current_value: 50000, flip_value: 60000, unit: '$' },
      ],
    } })))
    expect(m.evidence.flipRisks).toEqual([
      {
        text: 'If Salary cost rises above $60,000, the leading option is likely to change.',
        targetId: 'fac_salary',
        switchMeta: null,
        magnitude: null,
      },
    ])
  })

  it('flip risks: equality earns no direction claim — neutral crosses wording (UI-SEM-074)', () => {
    const m = chart(buildHeroModel(makeHeroData({ recommendation: {
      flipThresholds: [
        { label: 'Team capacity', node_id: 'fac_capacity', current_value: 40, flip_value: 40, unit: '%' },
      ],
    } })))
    expect(m.evidence.flipRisks[0].text).toBe(
      'If Team capacity crosses 40%, the leading option is likely to change.',
    )
  })

  it('Codex B3: no producer baseline → neutral crosses wording, never a fabricated direction', () => {
    for (const flip of [10, -10]) {
      const m = chart(buildHeroModel(makeHeroData({ recommendation: {
        flipThresholds: [
          { label: 'Revenue potential', node_id: 'fac_rev', current_value: null as unknown as number, flip_value: flip, unit: '%' },
        ],
      } })))
      expect(m.evidence.flipRisks[0].text).toContain('crosses')
      expect(m.evidence.flipRisks[0].text).not.toMatch(/rises above|falls below/)
    }
  })

  it('flip risks: undetermined thresholds are skipped; none → empty list', () => {
    const m = chart(buildHeroModel(makeHeroData({ recommendation: {
      flipThresholds: [
        { label: 'Team capacity', node_id: 'fac_capacity', current_value: 40, flip_value: null, flip_reason: 'no_bracket' },
      ],
    } })))
    expect(m.evidence.flipRisks).toEqual([])
    const none = chart(buildHeroModel(makeHeroData({ recommendation: { flipThresholds: [] } })))
    expect(none.evidence.flipRisks).toEqual([])
  })

  it('trade-offs are a producer gap: always null on live models', () => {
    const m = chart(buildHeroModel(makeHeroData()))
    expect(m.evidence.tradeOffs).toBeNull()
  })

  it('driver rows carry the producer direction and the DISPLAYED influence metric (never a re-rank)', () => {
    const withDirection = {
      ...makeDriver('Developer capacity'),
      canFocus: true,
      matchedNodeId: 'node_dev',
      direction: 'negative' as const,
      displayInfluence: 0.4,
      influenceScore: 0.9,
    }
    const m = chart(buildHeroModel(makeHeroData({ drivers: { drivers: [withDirection] } })))
    // displayInfluence wins (Codex R3-B1 complete-metric-set policy) — the
    // bar must show the SAME value DriversSection displays, never a blend.
    expect(m.evidence.drivers).toEqual([
      { rank: 1, label: 'Developer capacity', targetId: 'node_dev', direction: 'negative', influence: 0.4 },
    ])
  })

  it('flip rows join the switch probability from the SAME fragile-edge values the quick link ranks by', () => {
    const fragileDriver = {
      ...makeDriver('Team capacity'),
      factorKey: 'fac_capacity',
      canFocus: true,
      matchedNodeId: 'fac_capacity',
      fragileEdgeInfo: { switchProbability: 0.48 },
    }
    const m = chart(buildHeroModel(makeHeroData({ drivers: { drivers: [fragileDriver] } })))
    expect(m.evidence.flipRisks[0].switchMeta).toBe('48% switch')
    expect(m.evidence.flipRisks[0].magnitude).toBe(0.48)
  })

  it('flip rows with NO measured switch probability render no meta and no bar — the sentence still reads (schemas 0.30.0)', () => {
    // Presence branch: fragileEdgesMap now leaves switchProbability absent for
    // marginal-only edges (never the marginal substitute), and this mapper's
    // own guard must degrade honestly — no "NN% switch", no empty "( )", no
    // zero-width bar, sentence intact. Pinned end-to-end (hook → model) in
    // switchProbabilityPresence.spec.tsx; this is the mapper-level guarantee.
    const unmeasured = {
      ...makeDriver('Team capacity'),
      factorKey: 'fac_capacity',
      canFocus: true,
      matchedNodeId: 'fac_capacity',
      fragileEdgeInfo: { alternativeWinnerLabel: 'Two developers' },
    }
    const m = chart(buildHeroModel(makeHeroData({ drivers: { drivers: [unmeasured] } })))
    expect(m.evidence.flipRisks).toHaveLength(1)
    expect(m.evidence.flipRisks[0].text).toContain('Team capacity')
    expect(m.evidence.flipRisks[0].switchMeta).toBeNull()
    expect(m.evidence.flipRisks[0].magnitude).toBeNull()
  })

  it('a measured 0 still renders "0% switch" (0 is a measurement, not absence)', () => {
    const zeroMeasured = {
      ...makeDriver('Team capacity'),
      factorKey: 'fac_capacity',
      canFocus: true,
      matchedNodeId: 'fac_capacity',
      fragileEdgeInfo: { switchProbability: 0 },
    }
    const m = chart(buildHeroModel(makeHeroData({ drivers: { drivers: [zeroMeasured] } })))
    expect(m.evidence.flipRisks[0].switchMeta).toBe('0% switch')
    expect(m.evidence.flipRisks[0].magnitude).toBe(0)
  })

  it('flip-risk focus pre-gate: a node absent from the canvas yields a null target (fail-closed)', () => {
    // With canvas knowledge supplied, fac_capacity not on the canvas → text
    // row (null target); present → target passes through. The sentence and
    // meta are unaffected either way.
    const absent = chart(buildHeroModel(makeHeroData(), undefined, new Set(['other_node'])))
    expect(absent.evidence.flipRisks[0].targetId).toBeNull()
    const present = chart(buildHeroModel(makeHeroData(), undefined, new Set(['fac_capacity'])))
    expect(present.evidence.flipRisks[0].targetId).toBe('fac_capacity')
    // Back-compat: no canvas knowledge → passthrough (container resolver
    // remains the fail-closed layer).
    const unknown = chart(buildHeroModel(makeHeroData()))
    expect(unknown.evidence.flipRisks[0].targetId).toBe('fac_capacity')
  })
})
describe('Wave 2 (§6.2): pause-read state is producer-gated', () => {
  it('no live analysis status ever emits the paused variant (no producer contradiction signal exists)', () => {
    for (const analysisStatus of ['computed', 'partial', 'failed', 'blocked'] as const) {
      const m = buildHeroModel(makeHeroData({ recommendation: { analysisStatus } }))
      if (m.kind === 'status') expect(m.variant).not.toBe('paused')
    }
  })
})

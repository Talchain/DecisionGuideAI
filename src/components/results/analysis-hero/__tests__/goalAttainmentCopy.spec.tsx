/**
 * Goal-attainment copy — ONE claim across THREE hero surfaces.
 *
 * THE DEFECT THIS PINS (family 2, slice −1). On every live V5 analysis the
 * shared selector resolves `basis === 'joint_goal_substituted'`, because both
 * of that branch's discriminating inputs are pinned constants on the wire:
 *
 *   - `probability_of_goal` never arrives (PLoT synthesises an auto goal
 *     constraint whenever a finite threshold exists and then CLEARS the
 *     threshold it forwards to ISL, so the scalar is unreachable); and
 *   - `hasConstraints` is always false (`mapV5AnalysisToReport` maps no
 *     `constraint_analysis` at all, and the V2 mapper nulls it behind
 *     `PLOT_PER_OPTION_CONSTRAINTS_SUSPECT`).
 *
 * So `goalFitIsSubstitutedJoint === true` and `hasConstraints === false` on
 * 100% of live runs — which produced a SELF-CONTRADICTION inside one render:
 * the row detail withheld the possessive ("meeting all targets together")
 * while the headline and caption above it, gated on the same always-false
 * `hasConstraints`, asserted it ("best fits your goal", "hits your goal").
 * Same number, same render, every run.
 *
 * The UI cannot tell the two live cases apart — (A) one auto-derived
 * constraint that IS the user's goal threshold, (B) user constraints present,
 * where PLoT DISCARDS the goal threshold so the number does not involve the
 * goal at all. PLoT's attestation (`_meta.constraint_sources`) is stripped at
 * CEE's transport keep-list, and the only local signal is an undeclared magic
 * string. So the copy must be true in BOTH cases and assert neither a count
 * nor a possessive; these tests pin exactly that, on all three surfaces, in
 * ONE render.
 *
 * SCOPE. "Goal-attainment surface" here means the three hero surfaces that
 * designate FROM the goal-probability number: the headline, the goal-lens
 * caption, and the per-row goal-fit detail line. Legitimate uses of "your
 * goal" elsewhere in the app (pre-analysis coaching, inspector strings,
 * guardrails, the internal fixture gallery) are OUT of scope — they are not
 * claims about this number.
 */
import { describe, expect, it } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { AnalysisHeroPanel } from '../AnalysisHeroPanel'
import { buildHeroModel } from '../buildHeroModel'
import { HERO_COPY } from '../heroCopy'
import type { HeroChartModel } from '../heroTypes'
import { makeHeroData, makeOption, OPTION_A, OPTION_B } from '../__fixtures__/hero.fixtures'
import type { OptionResult } from '../../types'

/**
 * The two things a goal-attainment surface must not assert, because neither is
 * true in both live cases.
 *
 * POSSESSIVE — "your goal". False in case B, where PLoT discards the goal
 * threshold and the number does not involve the goal at all.
 *
 * PLURALITY — a plural definite or universal over the target set ("all
 * targets", "the targets"). Presupposes a count of two or more; false in case
 * A, where there is exactly ONE target. This is the SECOND half of the defect
 * and it needs its own predicate: the row detail's old wording ("meeting all
 * targets together") carried no possessive at all, so a possessive-only scan
 * cannot see it — and a change no test can see is not a fix.
 * "Every target" is deliberately NOT matched: a distributive universal is true
 * over a singleton and over a set, which is why all four surfaces use it.
 */
const POSSESSIVE = /your goal/i
const PLURALITY = /\ball targets\b|\bthe targets\b/i

/**
 * The LIVE record shape, per the trace above: the row's number is the
 * substituted joint figure and NO option carries per-option constraint
 * analysis. Every live analysis produces exactly this.
 */
function liveJointOnly(base: OptionResult): OptionResult {
  return makeOption({
    ...(base as OptionResult & { id: string; label: string }),
    goalFitIsSubstitutedJoint: true,
    constraintAnalysis: undefined,
  })
}

function chart(data = makeHeroData()): HeroChartModel {
  const model = buildHeroModel(data)
  expect(model.kind).toBe('chart')
  return model as HeroChartModel
}

interface Surfaces {
  headline: string
  caption: string
  rowDetails: string[]
}

/**
 * Renders the panel ONCE on its default (goal) lens and returns the three
 * goal-attainment surfaces from that SINGLE mount — the self-contradiction is
 * a one-render property, so the assertion has to read them together rather
 * than three models apart.
 *
 * The row list is an accordion (`openRowId`, one row at a time), so each row's
 * detail is opened in turn WITHIN the same mount; the headline and caption are
 * read while a detail is open, which is precisely the co-render the defect
 * lived in.
 */
function readSurfaces(model: HeroChartModel): Surfaces {
  const view = render(<AnalysisHeroPanel model={model} rerunDisabled={false} />)
  expect(model.defaultLens).toBe('goal')
  const rowDetails = model.rows.map((row) => {
    fireEvent.click(screen.getByRole('button', { name: new RegExp(row.label) }))
    const scope = within(screen.getByTestId(`hero-option-row-${row.index}`))
    // The detail region must actually be open — otherwise every assertion
    // below would pass over an absent node rather than over the copy.
    expect(scope.getByTestId('hero-option-detail')).toBeInTheDocument()
    return scope.queryByTestId('hero-detail-goal-fit')?.textContent ?? ''
  })
  const surfaces: Surfaces = {
    headline: screen.getByTestId('hero-headline').textContent ?? '',
    caption: screen.getByTestId('hero-caption').textContent ?? '',
    rowDetails,
  }
  view.unmount()
  return surfaces
}

/**
 * The whole claim, on all three surfaces at once: neither a possessive nor a
 * count, anywhere. Both predicates on every surface — the defect had two
 * halves and a scan for one is blind to the other.
 */
function expectHonest(s: Surfaces): void {
  expect(s.headline, 'headline possessive').not.toMatch(POSSESSIVE)
  expect(s.headline, 'headline count').not.toMatch(PLURALITY)
  expect(s.caption, 'caption possessive').not.toMatch(POSSESSIVE)
  expect(s.caption, 'caption count').not.toMatch(PLURALITY)
  s.rowDetails.forEach((detail, i) => {
    expect(detail, `row ${i + 1} detail possessive`).not.toMatch(POSSESSIVE)
    expect(detail, `row ${i + 1} detail count`).not.toMatch(PLURALITY)
  })
}

/** Live two-option run: a goal leader exists, so the headline crowns one. */
function liveLeaderModel(): HeroChartModel {
  return chart(
    makeHeroData({ options: [liveJointOnly(OPTION_A), liveJointOnly(OPTION_B)] }),
  )
}

/** Live run where every option is below the sub-1% floor (UI-SEM-057). */
function liveNoneOnTrackModel(): HeroChartModel {
  return chart(
    makeHeroData({
      options: [
        liveJointOnly(makeOption({ ...OPTION_A, goalProbability: 0.004 })),
        liveJointOnly(makeOption({ ...OPTION_B, goalProbability: 0.002 })),
      ],
    }),
  )
}

/** Live run with three options — plural rows, one shared caption. */
function liveMultiOptionModel(): HeroChartModel {
  const c = makeOption({
    id: 'opt_c',
    label: 'Hire a contractor',
    expected: 55,
    outcome: { mean: 55, p10: 40, p50: 54, p90: 70 },
    winProbability: 0.41,
    goalProbability: 0.27,
  })
  return chart(
    makeHeroData({
      options: [liveJointOnly(OPTION_A), liveJointOnly(OPTION_B), liveJointOnly(c)],
    }),
  )
}

describe('hero goal-attainment copy — POSITIVE CONTROLS (the absence assertion can see a presence)', () => {
  it('reads three genuinely populated surfaces from one render', () => {
    // Trap 13: an absence assertion over empty strings passes by testing
    // nothing. Prove every surface the next describe scans is non-empty and
    // that the row-detail lookup actually resolves a node per row.
    const s = readSurfaces(liveLeaderModel())
    expect(s.headline.length).toBeGreaterThan(0)
    expect(s.caption.length).toBeGreaterThan(0)
    expect(s.rowDetails).toHaveLength(2)
    for (const detail of s.rowDetails) expect(detail.length).toBeGreaterThan(0)
  })

  it('the possessive predicate fires on every string it is asked to exclude', () => {
    expect(POSSESSIVE.test('No option is currently on track to reach your goal.')).toBe(true)
    expect(POSSESSIVE.test('Upskill the team best fits your goal.')).toBe(true)
    expect(POSSESSIVE.test('Each value is the chance that option hits your goal.')).toBe(true)
  })

  it('the plurality predicate fires on the shipped wordings it is asked to exclude', () => {
    // The row detail's own former string — no possessive, so the scan above
    // is blind to it. Without this predicate, reverting the row detail alone
    // leaves the whole spec green (verified by mutation).
    expect(PLURALITY.test('34% chance of meeting all targets together.')).toBe(true)
    // And the headline wording this PR refuted: "the targets" is a plural
    // definite, so it presupposes the count case A does not have.
    expect(PLURALITY.test('Upskill the team comes closest to the targets this run scored.')).toBe(
      true,
    )
  })

  it('the plurality predicate does NOT fire on a distributive universal', () => {
    // Negative control: "every target" is the anchor all four surfaces share,
    // and it must stay assertable. A predicate that banned it would force the
    // copy back into either a count or a possessive.
    expect(PLURALITY.test('34% chance of meeting every target this run scored.')).toBe(false)
    expect(
      PLURALITY.test('No option is currently on track to meet every target this run scored.'),
    ).toBe(false)
  })

  it('the row-detail surface CAN carry a possessive, so its absence below is a real result', () => {
    // The non-substituted row still takes HERO_COPY.detail.goalFit, which is
    // possessive by design (it is the scalar-goal sentence, dead on the V5
    // path but deliberately not deleted — trap 5). Seeing it here proves the
    // extraction reaches the actual copy, not a missing node.
    const m = chart(
      makeHeroData({
        options: [
          makeOption({ ...OPTION_A, goalFitIsSubstitutedJoint: false }),
          makeOption({ ...OPTION_B, goalFitIsSubstitutedJoint: false }),
        ],
      }),
    )
    const s = readSurfaces(m)
    expect(s.rowDetails[0]).toMatch(POSSESSIVE)
  })
})

describe('hero goal-attainment copy — no surface asserts the possessive on the live record', () => {
  it('leader case: headline, caption and every row detail are possessive-free', () => {
    const s = readSurfaces(liveLeaderModel())
    expectHonest(s)
  })

  it('none-on-track case: headline, caption and every row detail are possessive-free', () => {
    const s = readSurfaces(liveNoneOnTrackModel())
    expectHonest(s)
  })

  it('multi-option case: headline, caption and every row detail are possessive-free', () => {
    const s = readSurfaces(liveMultiOptionModel())
    expect(s.rowDetails).toHaveLength(3)
    expectHonest(s)
  })

  it('the three surfaces agree — no surface claims what another withholds', () => {
    // The harm was a contradiction, not a single wrong string: the row said
    // "all targets", the headline and caption said "your goal", about one
    // number in one render. Pin agreement directly.
    const s = readSurfaces(liveLeaderModel())
    const all = [s.headline, s.caption, ...s.rowDetails]
    expect(all.filter((t) => POSSESSIVE.test(t)), 'surfaces asserting the possessive').toEqual([])
    expect(all.filter((t) => PLURALITY.test(t)), 'surfaces asserting a count').toEqual([])
  })
})

describe('hero goal-attainment copy — no over-suppression, no value change', () => {
  it('the goal line still APPEARS on every row (a rewording, never a removal)', () => {
    const m = liveLeaderModel()
    const s = readSurfaces(m)
    expect(s.rowDetails).toHaveLength(2)
    for (const detail of s.rowDetails) {
      expect(detail.length).toBeGreaterThan(0)
      expect(detail).toMatch(/chance/i)
    }
  })

  it('every row detail still carries its OWN readout verbatim', () => {
    const m = liveLeaderModel()
    const s = readSurfaces(m)
    m.rows.forEach((row, i) => {
      expect(s.rowDetails[i]).toContain(row.goal.readout)
    })
  })

  it('the numbers are byte-identical to the non-substituted control', () => {
    // Copy switch, never a value transform: values and rendered readouts must
    // not move when the identity flag flips.
    const live = liveLeaderModel()
    const control = chart(makeHeroData())
    expect(live.rows.map((r) => r.goal.value)).toEqual(
      control.rows.map((r) => r.goal.value),
    )
    expect(live.rows.map((r) => r.goal.readout)).toEqual(
      control.rows.map((r) => r.goal.readout),
    )
    expect(live.rows.map((r) => r.outcome.readout)).toEqual(
      control.rows.map((r) => r.outcome.readout),
    )
  })

  it('renders the same percentages the response carried (0.34 -> 34%, 0.49 -> 49%)', () => {
    render(<AnalysisHeroPanel model={liveLeaderModel()} rerunDisabled={false} />)
    expect(within(screen.getByTestId('hero-option-row-1')).getByText('34%')).toBeInTheDocument()
    expect(within(screen.getByTestId('hero-option-row-2')).getByText('49%')).toBeInTheDocument()
  })

  it('the goal lens is still available and still the default lens', () => {
    const m = liveLeaderModel()
    expect(m.lenses).toContain('goal')
    expect(m.defaultLens).toBe('goal')
  })
})

describe('hero goal-attainment copy — the copy lives in the central module', () => {
  it('each surface renders its HERO_COPY primitive, not a local literal', () => {
    const m = liveLeaderModel()
    const s = readSurfaces(m)
    const leader = m.rows.find((r) => r.id === m.leaders.goal)
    expect(leader, 'a goal leader is crowned in this fixture').toBeTruthy()
    expect(s.headline).toBe(HERO_COPY.headline.goalOnly(leader!.label, leader!.goal.readout))
    expect(s.caption).toBe(HERO_COPY.caption.goalOnly)
    m.rows.forEach((row, i) => {
      expect(s.rowDetails[i]).toBe(HERO_COPY.detail.goalFitJointBasis(row.goal.readout))
    })
  })

  it('none-on-track renders the central noneOnTrack primitive', () => {
    const s = readSurfaces(liveNoneOnTrackModel())
    expect(s.headline).toBe(HERO_COPY.headline.noneOnTrack)
  })
})

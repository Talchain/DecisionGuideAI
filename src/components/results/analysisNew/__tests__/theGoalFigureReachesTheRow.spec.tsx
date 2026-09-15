/**
 * ⭐⭐ THE QUESTION THE PERSON ACTUALLY ASKED, FINALLY ON THE ROW.
 *
 * ── WHAT WAS MISSING, DERIVED AT THE BYTES ─────────────────────────────────
 * The Reasoning tab's option rows draw ONE number: the comparative share — how
 * often this option out-ranked the others. The other quantity, the probability
 * this option reaches the target the USER set, has been on the option object
 * the whole time (`OptionResult.goalProbability`, resolved by the estate's
 * registered owner `selectGoalProbability`) and the panel spent it on ONE
 * thing: choosing which option `ModelImplication` names in a sentence. Every
 * per-option value was discarded.
 *
 * Contract-checked, with contrast controls in the same sweep:
 * `probability_of_joint_goal` 8 files · `win_probability` 19 · `robustness` 19.
 * The quantity is real, declared and mapped.
 *
 * ── THE TWO NUMBERS ARE NOT THE SAME KIND, AND THAT IS THE POINT ───────────
 * Comparative shares PARTITION the simulated runs and sum to 1. Goal
 * probabilities are computed independently per option and sum to nothing — so
 * an option can be behind on one and ahead on the other, which is exactly the
 * tension a person needs to see and could not. `WinGauge` states the same rule
 * from the other side and is why it refuses to stack them.
 *
 * ── THE FOUR GATES, EACH A REAL STATE AND EACH PINNED BELOW ────────────────
 *   1 · NO USER TARGET (UI-SEM-071). Without one the engine synthesises a
 *       target and the figure describes something nobody asked for.
 *   2 · THE COMPLETE-FIELD RULE, verbatim from `buildGoalFitRows`: a partial
 *       set is a ranking over a SUBSET presented as a ranking over the options.
 *       One analysed option without a figure silences every row.
 *   3 · A SUBSTITUTED JOINT FIGURE is suppressed, not relabelled — the only
 *       name this surface has is possessive, and it names the user's own
 *       target, which a joint substitution does not answer.
 *   4 · THE MODELLED-BASIS CAVEAT renders adjacent to the number it qualifies
 *       (ROADMAP 1.6b / PLoT #204), from the shared constant.
 *
 * ⭐ AND THE LABEL PAIR IS ITS OWN ASSERTION. One bare percentage under "How
 * the options compare" is unambiguous enough to live unlabelled — that is what
 * shipped. TWO bare percentages on one row is worse than one. So the naming
 * appears exactly when the second figure does, and a run with no target must
 * still render with no label at all.
 *
 * ⚠ BOUND BY TESTID AND BY VALUE-DISTINCTNESS. `-goal` must carry the GOAL
 * number, not a second rendering of the share: the fixtures below keep the two
 * quantities apart on every option so a test cannot pass by reading the wrong
 * field (trap 19).
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import { GOAL_FIT_BASIS_CAVEAT_COPY } from '../../utils/goalFitBasisCaveatCopy'
import { genuineDecision } from './analysisNewFixtures'
import { openAllSections } from './openNamedGroups'

/**
 * ⛔ EVERY SECTION IS OPENED BEFORE ANY QUERY. `SectionShell` UNMOUNTS a closed
 * region, so a spec that queried an inner row without this would be reading a
 * panel the reader cannot see — and, worse here, a run with NO goal figure and
 * a run with an UNMOUNTED section produce the identical empty result. The
 * shared fixed-point helper, never a local copy of the list.
 */
const renderBody = (data: ResultsSectionDataReturn) => {
  const r = render(
    <AnalysisNewTabBody
      resultsSectionData={data}
      isPreRun={false}
      isRunning={false}
      isStale={false}
      responseHash="goal_figure_on_the_row"
    />,
  )
  openAllSections()
  return r
}

/**
 * ⚠ THE TWO QUANTITIES ARE KEPT APART ON EVERY OPTION. `opt_a` is BEHIND on the
 * share (31%) and AHEAD on the goal (82%); `opt_b` is the reverse. That is not
 * decoration — it is what makes the assertions below capable of failing if the
 * render ever reads `winProbability` where it means `goalProbability`, and it
 * is also the state the section exists to surface.
 */
const WIN = { opt_a: 0.31, opt_b: 0.69 }
const GOAL = { opt_a: 0.82, opt_b: 0.44 }

/**
 * ⚠ THE FIXTURE IS THE SOURCE AND THE EXPECTATION IS DERIVED FROM IT — never a
 * second hand-written copy of the same numbers. A literal expectation beside a
 * literal fixture is two mirrors of one fact, and the day one moves the other
 * says nothing (trap 12). `withGoals` writes both maps onto the options below,
 * so these are the only four numbers in the file.
 *
 * ⚠ This local formatter is NOT a second display authority. It is the
 * arithmetic the assertion needs, and it is deliberately trivial: if it ever
 * diverges from the estate's formatter for these values the test fails loud,
 * which is the correct outcome — a rounding difference between the fixture's
 * expectation and the product's render is exactly what this should catch.
 */
const pct = (v: number) => `${Math.round(v * 100)}%`
const width = (v: number) => `${v * 100}%`

type Opts = {
  target?: number | null
  goal?: Partial<Record<'opt_a' | 'opt_b', number | null>>
  modelledBasis?: boolean
  substitutedJoint?: boolean
}
const withGoals = ({
  target = 20000,
  goal = GOAL,
  modelledBasis = false,
  substitutedJoint = false,
}: Opts = {}): ResultsSectionDataReturn => {
  const data = genuineDecision()
  const allOptions = (data.recommendation.allOptions ?? []).map((o) => {
    const g = goal[o.id as 'opt_a' | 'opt_b']
    return {
      ...o,
      winProbability: WIN[o.id as 'opt_a' | 'opt_b'],
      ...(g === null || g === undefined ? {} : { goalProbability: g }),
      goalFitIsModelledBasis: modelledBasis,
      goalFitIsSubstitutedJoint: substitutedJoint,
    }
  })
  return {
    ...data,
    recommendation: {
      ...data.recommendation,
      allOptions,
      ...(target === null ? {} : { goalThreshold: target }),
    },
  } as ResultsSectionDataReturn
}

const goalReadouts = () =>
  screen.queryAllByTestId('analysis-new-options-goal').map((e) => e.textContent?.trim())
const winReadouts = () =>
  screen.queryAllByTestId('analysis-new-options-win').map((e) => e.textContent?.trim())
const barWidths = (testId: string) =>
  screen
    .queryAllByTestId(testId)
    .map((track) => (track.firstElementChild as HTMLElement | null)?.style.width)

afterEach(cleanup)

describe('the goal figure reaches the option row', () => {
  it('⭐ WITH A TARGET — every analysed row draws the goal figure, and it is the GOAL number', () => {
    renderBody(withGoals())

    expect(goalReadouts(), 'one goal readout per analysed option').toEqual([
      pct(GOAL.opt_a),
      pct(GOAL.opt_b),
    ])
    // The discriminator: reading `winProbability` here would give 31% / 69%.
    expect(winReadouts()).toEqual([pct(WIN.opt_a), pct(WIN.opt_b)])

    // Two tracks per row, and the goal bar's geometry is the goal fraction —
    // not the share's, and not a segment of it.
    expect(barWidths('analysis-new-options-goal-bar')).toEqual([
      width(GOAL.opt_a),
      width(GOAL.opt_b),
    ])
    expect(barWidths('analysis-new-options-bar')).toEqual([width(WIN.opt_a), width(WIN.opt_b)])
  })

  it('⭐ THE LABELS ARRIVE WITH THE SECOND FIGURE, NOT BEFORE IT', () => {
    renderBody(withGoals())
    expect(screen.getAllByTestId('analysis-new-options-goal-label')).toHaveLength(2)
    expect(
      screen.getAllByTestId('analysis-new-options-win-label'),
      'two bare percentages on one row is worse than one — both get named',
    ).toHaveLength(2)
  })

  it('⛔ NO USER TARGET — nothing is drawn, and the row is unchanged (UI-SEM-071)', () => {
    renderBody(withGoals({ target: null }))

    expect(
      goalReadouts(),
      'without a user threshold the engine synthesises one, and the figure would describe a target nobody set',
    ).toEqual([])
    expect(screen.queryAllByTestId('analysis-new-options-goal-bar')).toHaveLength(0)
    expect(
      screen.queryAllByTestId('analysis-new-options-win-label'),
      'with one number on the row there is nothing to disambiguate — this run must render as it always did',
    ).toHaveLength(0)
    // The share itself is untouched by any of this.
    expect(winReadouts()).toEqual([pct(WIN.opt_a), pct(WIN.opt_b)])
  })

  it('⛔ THE COMPLETE-FIELD RULE — one option short silences EVERY row, not just its own', () => {
    renderBody(withGoals({ goal: { opt_a: GOAL.opt_a, opt_b: null } }))

    expect(
      goalReadouts(),
      'a partial set is a ranking over a subset presented as a ranking over the options',
    ).toEqual([])
    expect(screen.queryAllByTestId('analysis-new-options-goal-bar')).toHaveLength(0)
    expect(screen.queryAllByTestId('analysis-new-options-win-label')).toHaveLength(0)
  })

  it('⛔ A SUBSTITUTED JOINT FIGURE IS SUPPRESSED, NOT RELABELLED', () => {
    renderBody(withGoals({ substitutedJoint: true }))

    expect(
      goalReadouts(),
      'the only name this surface has is possessive, and it names the target the USER set',
    ).toEqual([])
  })

  it('⭐ THE MODELLED-BASIS CAVEAT RENDERS BESIDE THE NUMBER IT QUALIFIES', () => {
    renderBody(withGoals({ modelledBasis: true }))
    const caveats = screen.getAllByTestId('analysis-new-options-goal-basis-caveat')
    expect(caveats).toHaveLength(2)
    expect(
      caveats[0].textContent,
      'the shared constant, never a re-wording of it',
    ).toBe(GOAL_FIT_BASIS_CAVEAT_COPY)
  })

  it('⭐ OPPOSITE-DIRECTION TWIN — no caveat when the basis is not modelled', () => {
    // Without this the assertion above is indistinguishable from a caveat that
    // always renders.
    renderBody(withGoals({ modelledBasis: false }))
    expect(goalReadouts(), 'precondition: the figures ARE on screen').toEqual([
      pct(GOAL.opt_a),
      pct(GOAL.opt_b),
    ])
    expect(screen.queryAllByTestId('analysis-new-options-goal-basis-caveat')).toHaveLength(0)
  })
})

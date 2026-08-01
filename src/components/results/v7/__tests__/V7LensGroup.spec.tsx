/**
 * V7LensGroup — V7 Lane L5 pins for the single lens control + four lens bodies
 * (spec rows 6/6a/6b/6c/6d).
 *
 * Pins: all four tabs render; each lens body renders its live data OR its
 * honest gate on switch; the goal lens gates (no-target) vs shows bars; the
 * stability lens is ALWAYS the honest gap; the What-changed lens shows the
 * honest empty state on empty run history; the group renders nothing with no
 * analysed options.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { V7LensGroup } from '../V7LensGroup'
import { buildV7Lenses } from '../buildV7Lenses'
import { V7_LENS_COPY } from '../v7LensCopy'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import type { OptionResult } from '../../types'

function opt(
  id: string,
  label: string,
  o: Partial<{ win: number; p10: number; p50: number; p90: number; goalProb: number | null }> = {},
): OptionResult {
  return {
    id,
    label,
    expected: null,
    outcome: { mean: null, p10: o.p10 ?? null, p50: o.p50 ?? null, p90: o.p90 ?? null },
    p10: null,
    p50: null,
    p90: null,
    isRecommended: false,
    winProbability: o.win,
    goalProbability: o.goalProb ?? null,
  } as unknown as OptionResult
}

function data(partial: {
  allOptions: OptionResult[]
  recommendedId?: string
  goalThreshold?: number | null
}): ResultsSectionDataReturn {
  const recommendedOption = partial.allOptions.find((o) => o.id === partial.recommendedId) ?? null
  return {
    recommendation: {
      allOptions: partial.allOptions,
      recommendedOption,
      goalThreshold: partial.goalThreshold ?? null,
      outcomeUnit: 'count',
    },
    drivers: { drivers: [] },
    confidence: { challengeFragileEdges: [], conditionalWinners: [] },
  } as unknown as ResultsSectionDataReturn
}

const WITH_RANGE = data({
  allOptions: [
    opt('a', 'Option A', { win: 0.7, p10: 10, p50: 20, p90: 30 }),
    opt('b', 'Option B', { win: 0.3, p10: 5, p50: 12, p90: 25 }),
  ],
  recommendedId: 'a',
})

beforeEach(() => {
  localStorage.clear()
})

describe('V7LensGroup (V7 L5)', () => {
  it('renders all four lens tabs', () => {
    render(<V7LensGroup model={buildV7Lenses(WITH_RANGE)} />)
    expect(screen.getByTestId('v7-lens-tab-outcome')).toBeInTheDocument()
    expect(screen.getByTestId('v7-lens-tab-goal')).toBeInTheDocument()
    expect(screen.getByTestId('v7-lens-tab-stability')).toBeInTheDocument()
    expect(screen.getByTestId('v7-lens-tab-whatChanged')).toBeInTheDocument()
  })

  it('defaults to the Likely outcome lens with range bars and win readouts', () => {
    render(<V7LensGroup model={buildV7Lenses(WITH_RANGE)} />)
    expect(screen.getByTestId('v7-lens-outcome')).toBeInTheDocument()
    expect(screen.getAllByTestId('v7-range-bar').length).toBe(2)
    // ROADMAP 1.239: the readout is relabelled from the leader VERB to the
    // metric NOUN, per #493's WinGauge precedent. The number is unchanged —
    // this is a wording fix, and the data it carries is the point of the test.
    expect(screen.getByText(/Came out ahead in 70% of simulated scenarios/)).toBeInTheDocument()
  })

  it('shows the no-target gate on the Goal fit lens when no success target is set', () => {
    render(<V7LensGroup model={buildV7Lenses(WITH_RANGE)} />)
    fireEvent.click(screen.getByTestId('v7-lens-tab-goal'))
    expect(screen.getByTestId('v7-lens-goal-gate')).toHaveTextContent('Set a success target to see which option is most likely to reach it.')
  })

  it('shows per-option goal bars on the Goal fit lens when a target and probabilities exist', () => {
    const withGoal = data({
      allOptions: [
        opt('a', 'Option A', { win: 0.7, goalProb: 0.6 }),
        opt('b', 'Option B', { win: 0.3, goalProb: 0.2 }),
      ],
      recommendedId: 'a',
      goalThreshold: 80,
    })
    render(<V7LensGroup model={buildV7Lenses(withGoal)} />)
    fireEvent.click(screen.getByTestId('v7-lens-tab-goal'))
    expect(screen.getByTestId('v7-lens-goal')).toBeInTheDocument()
    expect(screen.getAllByTestId('v7-goal-row').length).toBe(2)
    expect(screen.getByText(/60% chance of hitting your goal/)).toBeInTheDocument()
  })

  it('always shows the honest gap on the Stability lens', () => {
    render(<V7LensGroup model={buildV7Lenses(WITH_RANGE)} />)
    fireEvent.click(screen.getByTestId('v7-lens-tab-stability'))
    expect(screen.getByTestId('v7-lens-stability-gate')).toHaveTextContent('will not infer it')
  })

  it('shows the honest empty state on the What-changed lens with empty run history', () => {
    render(<V7LensGroup model={buildV7Lenses(WITH_RANGE)} />)
    fireEvent.click(screen.getByTestId('v7-lens-tab-whatChanged'))
    expect(screen.getByTestId('v7-what-changed-empty')).toBeInTheDocument()
    expect(screen.getByText('Snapshot unavailable — rerun to compare.')).toBeInTheDocument()
  })

  it('renders nothing when there are no analysed options (pre-analysis)', () => {
    const { container } = render(<V7LensGroup model={buildV7Lenses(data({ allOptions: [] }))} />)
    expect(container.firstChild).toBeNull()
  })
})

// ─────────────────────────────────────────────────────────────────────────
// THE V7 GOAL CAPTION'S POSSESSIVE WAS UNGATED.
//
// The rows in this lens print `hitReadout(formatted, isSubstitutedJoint)` —
// gated, because on a substituted-joint basis the number answers a different
// question from the one "your goal" asserts. The CAPTION directly beneath
// them was a static string reading "…reaches your success target." So on the
// live V5 wire — where the basis is `joint_goal_substituted` on EVERY run
// (`heroCopy`'s own note: "which, on the live V5 wire, is EVERY run") — the
// lens rendered de-possessed rows under a possessive caption about the same
// numbers.
//
// RED-first: the substituted assertions fail on `48adda75`.
// ─────────────────────────────────────────────────────────────────────────
describe('V7LensGroup — the goal caption carries the same possessive gate as its rows', () => {
  function goalData(substituted: boolean) {
    const a = {
      ...opt('a', 'Option A', { win: 0.7, goalProb: 0.6 }),
      goalFitIsSubstitutedJoint: substituted,
    } as unknown as OptionResult
    const b = {
      ...opt('b', 'Option B', { win: 0.3, goalProb: 0.2 }),
      goalFitIsSubstitutedJoint: substituted,
    } as unknown as OptionResult
    return data({ allOptions: [a, b], recommendedId: 'a', goalThreshold: 80 })
  }

  function renderGoalLens(substituted: boolean) {
    render(<V7LensGroup model={buildV7Lenses(goalData(substituted))} />)
    fireEvent.click(screen.getByTestId('v7-lens-tab-goal'))
    return screen.getByTestId('v7-lens-goal')
  }

  it('the register exposes the caption as a function of the basis flag, not a static string', () => {
    expect(typeof V7_LENS_COPY.goal.caption).toBe('function')
    expect(V7_LENS_COPY.goal.caption(true)).not.toBe(V7_LENS_COPY.goal.caption(false))
  })

  it('substituted basis ⇒ the caption withholds the possessive, exactly as the rows do', () => {
    const lens = renderGoalLens(true)
    expect(lens.textContent?.toLowerCase()).not.toContain('your goal')
    expect(lens.textContent?.toLowerCase()).not.toContain('your success target')
    expect(lens).toHaveTextContent(V7_LENS_COPY.goal.caption(true))
  })

  it('permitted basis ⇒ the caption keeps the possessive, byte-identical to the shipped string', () => {
    const lens = renderGoalLens(false)
    expect(lens).toHaveTextContent(V7_LENS_COPY.goal.caption(false))
    expect(V7_LENS_COPY.goal.caption(false)).toBe(
      'Each value is the chance that option reaches your success target.',
    )
  })

  it('the caption is driven by the SAME flag the rows are, so the two cannot disagree', () => {
    const lens = renderGoalLens(true)
    // Rows: de-possessed A-register phrasing.
    expect(lens).toHaveTextContent(V7_LENS_COPY.goal.hitReadout('60%', true))
    // Caption: same voice.
    expect(lens).toHaveTextContent(V7_LENS_COPY.goal.caption(true))
  })
})

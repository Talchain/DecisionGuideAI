/**
 * UI-SEM-071 — null-target goal-claim suppression (display-coherence hotfix).
 *
 * Evidence chain under test: with no USER success target the PLoT request
 * omits goal_threshold, ISL synthesizes auto_goal_threshold, and the
 * selector fallback still adopts probability_of_joint_goal as
 * goalProbability — so "goal fit" values can exist that describe a target
 * the user never set. The hero must gate every goal-fit display on the USER
 * threshold (recommendation.goalThreshold), never on producer value
 * presence: no fit bars/percentages, no goal axis, no "best fits your
 * goal" / "on track" claim, needs-target state on the goal lens, and the
 * default lens falls back to Likely outcome. With a real threshold the
 * existing behaviour is preserved exactly.
 */
import { describe, expect, it } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { AnalysisHeroPanel } from '../AnalysisHeroPanel'
import { buildHeroModel } from '../buildHeroModel'
import type { HeroChartModel } from '../heroTypes'
import { makeHeroData, makeOption, OPTION_A, OPTION_B } from '../__fixtures__/hero.fixtures'

function chart(model: ReturnType<typeof buildHeroModel>): HeroChartModel {
  expect(model.kind).toBe('chart')
  return model as HeroChartModel
}

/** The demo shape: NO user target, yet synthesized goal values near 98%. */
function nullTargetSynthesizedData(goalThreshold: number | null | undefined = null) {
  return makeHeroData({
    recommendation: { goalThreshold },
    options: [
      makeOption({ ...OPTION_A, goalProbability: 0.98 }),
      makeOption({ ...OPTION_B, goalProbability: 0.98 }),
    ],
  })
}

function renderPanel(model: HeroChartModel) {
  return render(
    <AnalysisHeroPanel
      model={model}
      isStale={false}
      onRerun={() => {}}
      rerunDisabled={false}
      focusPanelMounted={false}
    />,
  )
}

describe('buildHeroModel — null-target suppression (model truth)', () => {
  it('suppresses every row goal slot when no user target exists (synthesized values cannot bypass)', () => {
    const m = chart(buildHeroModel(nullTargetSynthesizedData(null)))
    for (const row of m.rows) {
      expect(row.goal.value).toBeNull()
      expect(row.goal.readout).toBe('—')
      expect(row.detail.goalFit).toBeUndefined()
    }
  })

  it('treats an undefined threshold the same as null (absent is absent)', () => {
    const m = chart(buildHeroModel(nullTargetSynthesizedData(undefined)))
    expect(m.rows.every((r) => r.goal.value == null)).toBe(true)
    expect(m.lenses).not.toContain('goal')
  })

  it('goal lens is unavailable and the default lens is Likely outcome', () => {
    const m = chart(buildHeroModel(nullTargetSynthesizedData(null)))
    expect(m.lenses).toEqual(['outcome'])
    expect(m.defaultLens).toBe('outcome')
    expect(m.leaders.goal).toBeNull()
  })

  it('makes no goal claim in the headline or subline (falls to the analysis-leader branch)', () => {
    const m = chart(buildHeroModel(nullTargetSynthesizedData(null)))
    expect(m.headline).not.toMatch(/goal/i)
    expect(m.subline ?? '').not.toMatch(/goal/i)
    // Not the no-option-on-track claim either — that is also a goal claim.
    expect(m.headline).not.toMatch(/on track/i)
  })

  it('below-floor synthesized values do NOT produce the no-option-on-track goal claim without a target', () => {
    // Staging joint-goal shape (goalProbability 0) but with NO user target:
    // "No option is currently on track to reach your goal" would reference a
    // goal the user never set — it must not render.
    const m = chart(
      buildHeroModel(
        makeHeroData({
          recommendation: { goalThreshold: null },
          options: [
            makeOption({ ...OPTION_A, goalProbability: 0 }),
            makeOption({ ...OPTION_B, goalProbability: 0 }),
          ],
        }),
      ),
    )
    expect(m.headline).not.toMatch(/on track|goal/i)
    expect(m.defaultLens).toBe('outcome')
  })

  it('flags the needs-target unlock hint (showGoalHint) when the target is null', () => {
    const m = chart(buildHeroModel(nullTargetSynthesizedData(null)))
    expect(m.showGoalHint).toBe(true)
  })

  it('outcome/win display is unchanged by the gate (Likely outcome untouched)', () => {
    const gated = chart(buildHeroModel(nullTargetSynthesizedData(null)))
    const baseline = chart(buildHeroModel(makeHeroData()))
    expect(gated.rows.map((r) => r.outcome)).toEqual(baseline.rows.map((r) => r.outcome))
    expect(gated.rows.map((r) => r.detail.winChance)).toEqual(
      baseline.rows.map((r) => r.detail.winChance),
    )
    expect(gated.outcomeDomain).toEqual(baseline.outcomeDomain)
    expect(gated.leaders.outcome).toBe(baseline.leaders.outcome)
  })

  it('with a REAL threshold the existing goal-fit behaviour is fully preserved', () => {
    // Default fixture: goalThreshold 62 with real goal values.
    const m = chart(buildHeroModel(makeHeroData()))
    expect(m.lenses).toEqual(['goal', 'outcome'])
    expect(m.defaultLens).toBe('goal')
    expect(m.headline).toBe('Upskill the team best fits your goal.')
    expect(m.leaders.goal).toBe('opt_b')
    expect(m.rows[0].goal.value).toBe(OPTION_A.goalProbability)
    expect(m.rows[0].goal.readout).toBe('34%')
    expect(m.rows[0].detail.goalFit).toBe('34% chance of hitting your goal.')
    expect(m.showGoalHint).toBe(false)
  })

  it('with a REAL threshold the below-floor no-option-on-track claim still fires (honesty preserved)', () => {
    const m = chart(
      buildHeroModel(
        makeHeroData({
          options: [
            makeOption({ ...OPTION_A, goalProbability: 0 }),
            makeOption({ ...OPTION_B, goalProbability: 0 }),
          ],
        }),
      ),
    )
    expect(m.headline).toBe('No option is currently on track to reach your goal.')
    expect(m.defaultLens).toBe('goal')
  })
})

describe('AnalysisHeroPanel — null-target suppression (rendered)', () => {
  it('renders no fit percentages, no goal axis, and no goal claim on load (default lens is outcome)', () => {
    renderPanel(chart(buildHeroModel(nullTargetSynthesizedData(null))))
    // No identical "98% fit" bars/readouts anywhere (the tab strip's
    // "Goal fit" lens NAME legitimately remains — names a view, claims
    // nothing about this run — so the "fit" check is scoped to the rows).
    expect(screen.queryByText(/98%/)).toBeNull()
    expect(
      within(screen.getByTestId('hero-chart-rows')).queryByText(/fit/),
    ).toBeNull()
    // No "chance of hitting goal" axis fragment.
    expect(screen.queryByText(/chance of hitting goal/)).toBeNull()
    // No goal claim in the headline.
    expect(screen.getByTestId('hero-headline')).not.toHaveTextContent(/goal/i)
    // The outcome readouts render instead (default lens = outcome).
    expect(within(screen.getByTestId('hero-option-row-1')).getByText('68')).toBeInTheDocument()
  })

  it('selecting the Goal fit tab shows the needs-target state, never synthesized bars', () => {
    renderPanel(chart(buildHeroModel(nullTargetSynthesizedData(null))))
    fireEvent.click(screen.getByTestId('hero-lens-tab-goal'))
    expect(screen.getByTestId('hero-lens-unavailable')).toHaveTextContent(
      'Set a success target to unlock Goal fit.',
    )
    // No chart rows, no axis, no percentages on the unavailable lens.
    expect(screen.queryByTestId('hero-chart-rows')).toBeNull()
    expect(screen.queryByText(/chance of hitting goal/)).toBeNull()
    expect(screen.queryByText(/98%/)).toBeNull()
  })

  it('with a real threshold the goal lens still renders the fit readouts and caption (preserved)', () => {
    // Prototype v6: the goal lens is a readout-only table (no tracks, no
    // axis) — the preserved behaviour is the honest fit percentages plus
    // the value-based caption.
    renderPanel(chart(buildHeroModel(makeHeroData())))
    expect(screen.getByTestId('hero-headline')).toHaveTextContent(
      'Upskill the team best fits your goal.',
    )
    expect(within(screen.getByTestId('hero-option-row-1')).getByText('34%')).toBeInTheDocument()
    expect(screen.getByTestId('hero-caption')).toHaveTextContent(
      'Each value is the chance that option hits your goal.',
    )
    // No goal tracks and no goal axis exist any more (v6 readout-only table).
    expect(screen.queryAllByTestId('hero-range-bar')).toHaveLength(0)
    expect(screen.queryByText(/chance of hitting goal$/)).toBeNull()
  })

  it('axis fragments are laid out in flow with a gap — they can no longer overlap into a run-on sentence', () => {
    renderPanel(chart(buildHeroModel(makeHeroData())))
    // The (sole remaining) outcome axis renders on the Likely outcome lens.
    fireEvent.click(screen.getByTestId('hero-lens-tab-outcome'))
    const mid = screen.getByText('expected outcome')
    // The run-on defect came from absolute positioning over the end labels;
    // the mid descriptor must now be an in-flow, truncating flex item inside
    // a gapped justify-between row (fragments cannot collide).
    expect(mid.className).not.toMatch(/absolute/)
    expect(mid.className).toMatch(/truncate/)
    const rowContainer = mid.parentElement!
    expect(rowContainer.className).toMatch(/justify-between/)
    expect(rowContainer.className).toMatch(/gap-2/)
    expect(within(rowContainer).getByText('lower')).toBeInTheDocument()
    expect(within(rowContainer).getByText('higher')).toBeInTheDocument()
  })
})

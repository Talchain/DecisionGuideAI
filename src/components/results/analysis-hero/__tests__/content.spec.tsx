/**
 * Content and boundary rendering — the panel shows adapted response values
 * verbatim, omits everything unsourced, and never renders trust wording,
 * raw floats, a goal-alone marker, or the retired lenses.
 */
import { describe, expect, it } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { AnalysisHeroPanel } from '../AnalysisHeroPanel'
import { buildHeroModel } from '../buildHeroModel'
import type { HeroChartModel, HeroStatusModel } from '../heroTypes'
import { makeHeroData, makeOption, OPTION_A, OPTION_B } from '../__fixtures__/hero.fixtures'

function chartModel(data = makeHeroData()): HeroChartModel {
  const model = buildHeroModel(data)
  expect(model.kind).toBe('chart')
  return model as HeroChartModel
}

function renderPanel(model: HeroChartModel | HeroStatusModel, props: Partial<Parameters<typeof AnalysisHeroPanel>[0]> = {}) {
  return render(
    <AnalysisHeroPanel
      model={model}
      isStale={false}
      onRerun={() => {}}
      rerunDisabled={false}
      focusPanelMounted={false}
      {...props}
    />,
  )
}

describe('AnalysisHeroPanel — content', () => {
  it('renders the headline, tension subline, and goal readouts from response values', () => {
    renderPanel(chartModel())
    expect(screen.getByTestId('hero-headline')).toHaveTextContent(
      'Upskill the team best fits your goal.',
    )
    expect(screen.getByTestId('hero-subline')).toHaveTextContent(
      'Two developers has the highest expected outcome.',
    )
    // Goal-fit is the default lens: rendered joint probabilities equal the
    // response values (0.34 → 34%, 0.49 → 49%).
    expect(within(screen.getByTestId('hero-option-row-1')).getByText('34%')).toBeInTheDocument()
    expect(within(screen.getByTestId('hero-option-row-2')).getByText('49%')).toBeInTheDocument()
  })

  it('switching to Likely outcome shows outcome centres in the readouts', () => {
    renderPanel(chartModel())
    fireEvent.click(screen.getByTestId('hero-lens-tab-outcome'))
    expect(within(screen.getByTestId('hero-option-row-1')).getByText('68')).toBeInTheDocument()
    expect(within(screen.getByTestId('hero-option-row-2')).getByText('62')).toBeInTheDocument()
  })

  it('shows win probability ONLY inside an opened option detail', () => {
    renderPanel(chartModel())
    expect(screen.queryByText(/chance it is the strongest option overall/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /Two developers/ }))
    expect(screen.getByTestId('hero-detail-win')).toHaveTextContent(
      '30% chance it is the strongest option overall.',
    )
  })

  it('Likely outcome lens renders no target marker and never mentions the target', () => {
    // Product decision: the outcome lens owns option comparison — the target
    // line is not drawn (it would compress the chart) and the caption does
    // not name a target. Target attainment lives on Goal fit.
    renderPanel(chartModel())
    fireEvent.click(screen.getByTestId('hero-lens-tab-outcome'))
    expect(screen.queryByTestId('hero-target-marker')).toBeNull()
    expect(screen.getByTestId('hero-caption')).not.toHaveTextContent(/target/i)
    // The outcome caption still describes the range bars.
    expect(screen.getByTestId('hero-caption')).toHaveTextContent(
      'Lines show the realistic range',
    )
  })

  it('range bars are visible on the outcome lens when p10/p90 exist (P0 regression)', () => {
    renderPanel(chartModel())
    fireEvent.click(screen.getByTestId('hero-lens-tab-outcome'))
    const bars = screen.getAllByTestId('hero-range-bar')
    expect(bars.length).toBeGreaterThan(0)
    for (const bar of bars) {
      expect(bar).toHaveAttribute('data-visible', 'true')
      // Solid light-token fills — never opacity-modifier classes, which do
      // not compile with this theme (see chartClassesCompile.spec).
      expect(bar.className).toMatch(/bg-(option|info)-light/)
    }
  })

  it('caption switches to the dots-only variant when no row draws a range', () => {
    // 0 ranged rows is unreachable through buildHeroModel today (the
    // outcome lens is only offered when some row has a range) — the
    // defensive branch is pinned directly so the gate stays honest if the
    // lens gating ever changes.
    const model = chartModel()
    renderPanel({ ...model, outcomeRangedRowCount: 0 })
    fireEvent.click(screen.getByTestId('hero-lens-tab-outcome'))
    expect(screen.getByTestId('hero-caption')).toHaveTextContent(
      'Dots show the expected outcome for each option.',
    )
    expect(screen.getByTestId('hero-caption')).not.toHaveTextContent(/lines|overlap/i)
  })

  it('caption drops the overlap sentence when only ONE row draws a range', () => {
    // A single range line cannot overlap anything — the sentence would
    // over-describe the chart.
    const model = chartModel()
    renderPanel({ ...model, outcomeRangedRowCount: 1 })
    fireEvent.click(screen.getByTestId('hero-lens-tab-outcome'))
    expect(screen.getByTestId('hero-caption')).toHaveTextContent(
      'Dots show expected outcome. Lines show the realistic range.',
    )
    expect(screen.getByTestId('hero-caption')).not.toHaveTextContent(/overlap/i)
  })

  it('opened detail recovers the full label and shows the grounded range and goal-fit lines', () => {
    renderPanel(chartModel())
    fireEvent.click(screen.getByRole('button', { name: /Two developers/ }))
    expect(screen.getByTestId('hero-detail-label')).toHaveTextContent('Two developers')
    expect(screen.getByTestId('hero-detail-range')).toHaveTextContent('Realistic range: 54 to 82.')
    expect(screen.getByTestId('hero-detail-goal-fit')).toHaveTextContent(
      '34% chance of hitting your goal.',
    )
  })

  it('win-only rows are not expandable and keep the win line as persistent meta', () => {
    // Strip everything except winProbability from B; A keeps its range so
    // the outcome lens stays available.
    const winOnly = makeOption({
      ...OPTION_B,
      goalProbability: undefined,
      outcome: { mean: 62, p10: null, p50: 61, p90: null },
      p10: null,
      p90: null,
    })
    const a = makeOption({ ...OPTION_A, goalProbability: undefined })
    renderPanel(
      chartModel(
        makeHeroData({
          options: [a, winOnly],
          recommendation: { storyHeadlines: undefined, flipThresholds: undefined },
        }),
      ),
    )
    // B has no disclosure button; its win probability is persistent meta.
    expect(screen.queryByRole('button', { name: /Upskill the team/ })).toBeNull()
    expect(screen.getByTestId('hero-win-meta')).toHaveTextContent(
      '29% chance it is the strongest option overall.',
    )
    // A (range detail exists) is still expandable.
    expect(screen.getByRole('button', { name: /Two developers/ })).toBeInTheDocument()
  })

  it('goal hint renders only when the goal lens is missing because no target exists', () => {
    const noGoal = [
      makeOption({ ...OPTION_A, goalProbability: undefined }),
      makeOption({ ...OPTION_B, goalProbability: undefined }),
    ]
    const { unmount } = renderPanel(
      chartModel(makeHeroData({ options: noGoal, recommendation: { goalThreshold: null } })),
    )
    expect(screen.getByTestId('hero-goal-hint')).toHaveTextContent(
      'Set a success target to see goal fit.',
    )
    unmount()
    // Target exists (producer gap) → no hint. Goal lens present → no hint.
    renderPanel(chartModel(makeHeroData({ options: noGoal })))
    expect(screen.queryByTestId('hero-goal-hint')).toBeNull()
  })

  it('Goal fit surfaces the target-attainment truth (per-option goal readouts)', () => {
    // Goal fit owns target attainment: each bar is the chance of hitting the
    // goal, so the readouts ARE the target-shortfall communication.
    renderPanel(chartModel())
    expect(within(screen.getByTestId('hero-option-row-1')).getByText('34%')).toBeInTheDocument()
    expect(within(screen.getByTestId('hero-option-row-2')).getByText('49%')).toBeInTheDocument()
    // No target marker on Goal fit either — the bars themselves carry it.
    expect(screen.queryByTestId('hero-target-marker')).toBeNull()
  })

  it('never renders a goal-alone marker (collapsed selector — one bar only)', () => {
    const { container } = renderPanel(chartModel())
    expect(screen.queryByTestId('hero-goal-alone')).toBeNull()
    expect(container.textContent).not.toMatch(/goal alone/i)
  })

  it('never renders trust or stability wording, and no raw 0-1 floats', () => {
    const { container } = renderPanel(chartModel())
    const text = container.textContent ?? ''
    expect(text).not.toMatch(/\btrust\b/i)
    expect(text).not.toMatch(/\b(firm|fragile|provisional|robust|stability|confidence)\b/i)
    expect(text).not.toMatch(/\b0\.\d+\b/)
  })

  it('renders only the two launch lenses — Stability and What changed do not exist', () => {
    renderPanel(chartModel())
    expect(screen.getAllByRole('tab')).toHaveLength(2)
    expect(screen.queryByText(/stability/i)).toBeNull()
    expect(screen.queryByText(/what changed/i)).toBeNull()
  })

  it('hides the tab strip when only one lens is available', () => {
    const noGoal = [
      makeOption({ ...OPTION_A, goalProbability: undefined }),
      makeOption({ ...OPTION_B, goalProbability: undefined }),
    ]
    renderPanel(chartModel(makeHeroData({ options: noGoal })))
    expect(screen.queryByRole('tablist')).toBeNull()
    // The single available lens still renders its rows.
    expect(screen.getByTestId('hero-option-row-1')).toBeInTheDocument()
  })

  it('omits unsourced detail lines instead of fabricating copy', () => {
    const data = makeHeroData({
      recommendation: { storyHeadlines: undefined, flipThresholds: undefined },
    })
    renderPanel(chartModel(data))
    // Row 1 still has a win line, so it stays expandable — open it.
    fireEvent.click(screen.getByRole('button', { name: /Two developers/ }))
    expect(screen.queryByTestId('hero-detail-why')).toBeNull()
    expect(screen.queryByTestId('hero-detail-could-change')).toBeNull()
    expect(screen.getByTestId('hero-detail-win')).toBeInTheDocument()
  })

  it('renders the footer main reason from the top driver and neutral focus-next text', () => {
    renderPanel(chartModel())
    expect(screen.getByTestId('hero-main-reason')).toHaveTextContent(
      'Main driver: Developer capacity.',
    )
    const focusNext = screen.getByTestId('hero-focus-next')
    expect(focusNext).toHaveTextContent('Focus next: review the top actions below.')
    // Coaching panel not mounted → plain text, not a dead link.
    expect(focusNext.tagName).toBe('P')
  })

  it.each(['partial', 'failed', 'blocked'] as const)(
    'renders the curated %s non-chart state (no rows, no fabricated numbers)',
    (variant) => {
      // Non-chart states are driven by the real analysis lifecycle
      // (analysisStatus / hook error), never by completeness enrichment.
      const data =
        variant === 'blocked'
          ? makeHeroData({ recommendation: { analysisStatus: 'blocked' } })
          : variant === 'failed'
            ? makeHeroData({ isError: true })
            : makeHeroData({ recommendation: { analysisStatus: 'partial' } })
      const model = buildHeroModel(data)
      expect(model.kind).toBe('status')
      renderPanel(model as HeroStatusModel)
      expect(screen.getByTestId(`hero-status-${variant}`)).toBeInTheDocument()
      expect(screen.queryByTestId('hero-option-row-1')).toBeNull()
      expect(screen.queryByRole('tablist')).toBeNull()
    },
  )
})

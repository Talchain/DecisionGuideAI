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
import { FULL_COMPLETENESS, makeHeroData, makeOption, OPTION_A, OPTION_B } from '../__fixtures__/hero.fixtures'

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
      'Two developers has the highest expected outcome, but Upskill the team best fits your goal.',
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

  it('caption names the target with its response value when unit-compatible', () => {
    renderPanel(chartModel())
    fireEvent.click(screen.getByTestId('hero-lens-tab-outcome'))
    expect(screen.getByTestId('hero-caption')).toHaveTextContent('your target of 62')
    // Marker positioners exist per row and are visible on this lens.
    for (const marker of screen.getAllByTestId('hero-target-marker')) {
      expect(marker).toHaveAttribute('data-visible', 'true')
    }
  })

  it('omits the target entirely when units are not compatible (isNormalised)', () => {
    renderPanel(chartModel(makeHeroData({ recommendation: { isNormalised: true } })))
    fireEvent.click(screen.getByTestId('hero-lens-tab-outcome'))
    expect(screen.getByTestId('hero-caption')).not.toHaveTextContent('target')
    for (const marker of screen.getAllByTestId('hero-target-marker')) {
      expect(marker).toHaveAttribute('data-visible', 'false')
    }
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
      'Main reason: Developer capacity has the strongest effect on this result.',
    )
    const focusNext = screen.getByTestId('hero-focus-next')
    expect(focusNext).toHaveTextContent('Focus next: review the top actions below.')
    // Coaching panel not mounted → plain text, not a dead link.
    expect(focusNext.tagName).toBe('P')
  })

  it.each(['partial', 'failed', 'blocked'] as const)(
    'renders the curated %s non-chart state (no rows, no fabricated numbers)',
    (variant) => {
      const data =
        variant === 'blocked'
          ? makeHeroData({ recommendation: { analysisStatus: 'blocked' } })
          : variant === 'failed'
            ? makeHeroData({ isError: true, completeness: { ...FULL_COMPLETENESS, status: 'failed' } })
            : makeHeroData({ completeness: { ...FULL_COMPLETENESS, status: 'partial' } })
      const model = buildHeroModel(data)
      expect(model.kind).toBe('status')
      renderPanel(model as HeroStatusModel)
      expect(screen.getByTestId(`hero-status-${variant}`)).toBeInTheDocument()
      expect(screen.queryByTestId('hero-option-row-1')).toBeNull()
      expect(screen.queryByRole('tablist')).toBeNull()
    },
  )
})

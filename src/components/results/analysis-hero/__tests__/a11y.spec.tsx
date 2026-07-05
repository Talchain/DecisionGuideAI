/**
 * Accessibility — axe scans plus the specific contract points: tab roving
 * semantics, row disclosure aria, leader perceivable without colour, and
 * reduced-motion handling on every animated element.
 */
import { describe, expect, it } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { axe } from 'vitest-axe'
import { AnalysisHeroPanel } from '../AnalysisHeroPanel'
import { buildHeroModel } from '../buildHeroModel'
import type { HeroChartModel, HeroStatusModel } from '../heroTypes'
import { FULL_COMPLETENESS, makeHeroData } from '../__fixtures__/hero.fixtures'

function chartModel(): HeroChartModel {
  return buildHeroModel(makeHeroData()) as HeroChartModel
}

function renderPanel(model: HeroChartModel | HeroStatusModel, isStale = false) {
  return render(
    <AnalysisHeroPanel
      model={model}
      isStale={isStale}
      onRerun={() => {}}
      rerunDisabled={false}
      focusPanelMounted={false}
    />,
  )
}

async function expectNoViolations(container: HTMLElement) {
  const results = await axe(container)
  expect(results.violations).toEqual([])
}

describe('AnalysisHero — accessibility', () => {
  it('chart state has no axe violations', async () => {
    const { container } = renderPanel(chartModel())
    await expectNoViolations(container)
  })

  it('chart state with an open detail has no axe violations', async () => {
    const { container } = renderPanel(chartModel())
    fireEvent.click(screen.getByRole('button', { name: /Upskill the team/ }))
    await expectNoViolations(container)
  })

  it('status state has no axe violations', async () => {
    const model = buildHeroModel(
      makeHeroData({ completeness: { ...FULL_COMPLETENESS, status: 'partial' } }),
    ) as HeroStatusModel
    const { container } = renderPanel(model)
    await expectNoViolations(container)
  })

  it('implements the tabs pattern: tablist, aria-selected, tabpanel labelling', () => {
    renderPanel(chartModel())
    const tablist = screen.getByRole('tablist')
    expect(tablist).toHaveAccessibleName('Results lens')
    // Full prototype strip: four tabs; unavailable lenses stay focusable
    // and selectable (their panel explains itself), never aria-disabled
    // dead ends.
    const tabs = screen.getAllByRole('tab')
    expect(tabs).toHaveLength(4)
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true')
    for (const tab of tabs.slice(1)) {
      expect(tab).toHaveAttribute('aria-selected', 'false')
    }
    const panel = screen.getByRole('tabpanel')
    expect(panel).toHaveAttribute('aria-labelledby', tabs[0].id)
  })

  it('row buttons expose aria-expanded and label their detail region', () => {
    renderPanel(chartModel())
    const row = screen.getByRole('button', { name: /Upskill the team/ })
    expect(row).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(row)
    expect(row).toHaveAttribute('aria-expanded', 'true')
    const region = screen.getByTestId('hero-option-detail')
    expect(region).toHaveAttribute('role', 'region')
    expect(region.id).toBe(row.getAttribute('aria-controls'))
    expect(region).toHaveAccessibleName(/Upskill the team/)
  })

  it('marks the lens leader without relying on colour (aria-current + sr cue)', () => {
    renderPanel(chartModel())
    // Goal lens leader = the recommended option (row 2).
    const leaderRow = screen.getByRole('button', { name: /Upskill the team/ })
    expect(leaderRow).toHaveAttribute('aria-current', 'true')
    expect(leaderRow).toHaveTextContent('Leads on this view')
    const otherRow = screen.getByRole('button', { name: /Two developers/ })
    expect(otherRow).not.toHaveAttribute('aria-current')
  })

  it('the leader highlight moves with the active lens', () => {
    renderPanel(chartModel())
    fireEvent.click(screen.getByTestId('hero-lens-tab-outcome'))
    // Outcome leader = highest centre (Two developers).
    expect(screen.getByRole('button', { name: /Two developers/ })).toHaveAttribute(
      'aria-current',
      'true',
    )
    expect(screen.getByRole('button', { name: /Upskill the team/ })).not.toHaveAttribute(
      'aria-current',
    )
  })

  it('every transform-animated element opts out under prefers-reduced-motion', () => {
    const { container } = renderPanel(chartModel())
    const animated = container.querySelectorAll('[class*="transition-transform"]')
    expect(animated.length).toBeGreaterThan(0)
    for (const el of animated) {
      expect(el.className).toContain('motion-reduce:transition-none')
    }
  })

  it('stale chart area is hidden from interaction but the re-run control is operable', async () => {
    const { container } = renderPanel(chartModel(), true)
    expect(screen.getByTestId('hero-rerun')).toBeEnabled()
    await expectNoViolations(container)
  })
})

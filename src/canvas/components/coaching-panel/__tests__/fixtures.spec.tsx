/**
 * Fixture coverage — every fixture in the corpus renders and is axe-clean.
 * A cheap guard that the whole taxonomy stays valid as the panel evolves.
 */
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { axe, configureAxe } from 'vitest-axe'
import { CoachingPanel } from '../CoachingPanel'
import { coachingFixtures } from '../__fixtures__/coaching.fixtures'

configureAxe({ rules: { 'color-contrast': { enabled: false } } })

const entries = Object.entries(coachingFixtures)

describe('CoachingPanel fixture corpus', () => {
  it.each(entries)('renders %s without throwing', (_name, fixture) => {
    const { getByTestId } = render(<CoachingPanel coaching={fixture} />)
    expect(getByTestId('coaching-panel')).toBeInTheDocument()
  })

  it.each(entries)('has no axe violations for %s', async (_name, fixture) => {
    const { container } = render(<CoachingPanel coaching={fixture} />)
    const results = await axe(container)
    expect(results.violations).toEqual([])
  })
})

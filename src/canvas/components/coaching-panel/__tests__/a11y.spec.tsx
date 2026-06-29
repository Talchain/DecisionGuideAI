/**
 * Accessibility — no axe violations across key visual states; role/name checks.
 *
 * color-contrast is disabled (consistent with the repo's a11y suites): the
 * entity colours and primary/info hit the known DS contrast landmine, which is
 * a flagged token-level issue, not a panel defect.
 */
import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { axe, configureAxe } from 'vitest-axe'
import { CoachingPanel } from '../CoachingPanel'
import { typicalPanel, withAllFuture, emptySignals } from '../__fixtures__/coaching.fixtures'

configureAxe({ rules: { 'color-contrast': { enabled: false } } })

async function expectNoViolations(container: HTMLElement) {
  const results = await axe(container)
  expect(results.violations).toEqual([])
}

describe('CoachingPanel accessibility', () => {
  it('has no violations when collapsed', async () => {
    const { container } = render(<CoachingPanel coaching={typicalPanel} />)
    await expectNoViolations(container)
  })

  it('has no violations with a row expanded', async () => {
    const { container } = render(<CoachingPanel coaching={typicalPanel} />)
    fireEvent.click(screen.getByRole('button', { name: /retention estimate rests/i }))
    await expectNoViolations(container)
  })

  it('has no violations with all future fields shown', async () => {
    const { container } = render(<CoachingPanel coaching={withAllFuture} showStaleBanner />)
    fireEvent.click(screen.getByRole('button', { name: /most influential estimate/i }))
    await expectNoViolations(container)
  })

  it('has no violations in the empty state', async () => {
    const { container } = render(<CoachingPanel coaching={emptySignals} />)
    await expectNoViolations(container)
  })

  it('names the panel region and the icon-only Ask Olumi affordance', () => {
    render(<CoachingPanel coaching={typicalPanel} />)
    expect(screen.getByRole('region', { name: 'Coaching' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /retention estimate rests/i }))
    expect(screen.getByRole('button', { name: 'Ask Olumi' })).toBeInTheDocument()
  })
})

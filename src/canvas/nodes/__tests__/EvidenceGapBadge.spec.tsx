/**
 * EvidenceGapBadge unit tests
 * Verifies: rendering, accessible attributes, pointer-events-none, no deps on store.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EvidenceGapBadge } from '../EvidenceGapBadge'

describe('EvidenceGapBadge', () => {
  it('renders with data-testid="evidence-gap-badge"', () => {
    const { container } = render(<EvidenceGapBadge label="Revenue" />)
    const badge = container.querySelector('[data-testid="evidence-gap-badge"]')
    expect(badge).not.toBeNull()
  })

  it('aria-label contains the factor label', () => {
    render(<EvidenceGapBadge label="Market rate" />)
    // aria-label is on the wrapper element
    const badge = document.querySelector('[data-testid="evidence-gap-badge"]')
    expect(badge?.getAttribute('aria-label')).toContain('Market rate')
  })

  it('title attribute contains the factor label', () => {
    const { container } = render(<EvidenceGapBadge label="Hiring rate" />)
    const badge = container.querySelector('[data-testid="evidence-gap-badge"]')
    expect(badge?.getAttribute('title')).toContain('Hiring rate')
  })

  it('has pointer-events-none class so node clicks pass through', () => {
    const { container } = render(<EvidenceGapBadge label="Cost" />)
    const badge = container.querySelector('[data-testid="evidence-gap-badge"]')
    expect(badge?.className).toContain('pointer-events-none')
  })

  it('renders the "?" character', () => {
    const { container } = render(<EvidenceGapBadge label="X" />)
    expect(container.textContent).toContain('?')
  })

  it('positions at bottom-right (absolute class)', () => {
    const { container } = render(<EvidenceGapBadge label="X" />)
    const badge = container.querySelector('[data-testid="evidence-gap-badge"]')
    expect(badge?.className).toContain('absolute')
    expect(badge?.className).toContain('-bottom-1.5')
    expect(badge?.className).toContain('-right-1.5')
  })

  it('is a circle (rounded-full)', () => {
    const { container } = render(<EvidenceGapBadge label="X" />)
    const badge = container.querySelector('[data-testid="evidence-gap-badge"]')
    expect(badge?.className).toContain('rounded-full')
  })

  it('renders without crash when label is empty string', () => {
    expect(() => render(<EvidenceGapBadge label="" />)).not.toThrow()
  })
})

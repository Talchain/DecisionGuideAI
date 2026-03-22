/**
 * EvidenceGapBadge unit tests
 * Verifies: rendering, accessible attributes, pointer-events-none, hover zone, no deps on store.
 */
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { EvidenceGapBadge } from '../EvidenceGapBadge'

describe('EvidenceGapBadge', () => {
  it('renders with data-testid="evidence-gap-badge"', () => {
    const { container } = render(<EvidenceGapBadge label="Revenue" />)
    const badge = container.querySelector('[data-testid="evidence-gap-badge"]')
    expect(badge).not.toBeNull()
  })

  it('hover zone aria-label contains the factor label', () => {
    const { container } = render(<EvidenceGapBadge label="Market rate" />)
    const hover = container.querySelector('[data-testid="evidence-gap-badge-hover"]')
    expect(hover?.getAttribute('aria-label')).toContain('Market rate')
  })

  it('hover zone title attribute contains the factor label', () => {
    const { container } = render(<EvidenceGapBadge label="Hiring rate" />)
    const hover = container.querySelector('[data-testid="evidence-gap-badge-hover"]')
    expect(hover?.getAttribute('title')).toContain('Hiring rate')
  })

  it('visual badge has pointer-events-none class so node clicks pass through', () => {
    const { container } = render(<EvidenceGapBadge label="Cost" />)
    const badge = container.querySelector('[data-testid="evidence-gap-badge"]')
    expect(badge?.className).toContain('pointer-events-none')
  })

  it('hover zone does NOT have pointer-events-none (allows tooltip)', () => {
    const { container } = render(<EvidenceGapBadge label="Cost" />)
    const hover = container.querySelector('[data-testid="evidence-gap-badge-hover"]')
    expect(hover?.className).not.toContain('pointer-events-none')
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

  // A.9: Escalation tests
  describe('escalation prop', () => {
    it('defaults to no pulse class when escalation is omitted', () => {
      const { container } = render(<EvidenceGapBadge label="X" />)
      const badge = container.querySelector('[data-testid="evidence-gap-badge"]')
      expect(badge?.className).not.toContain('evidence-gap-pulse')
    })

    it('defaults to no pulse class when escalation is "none"', () => {
      const { container } = render(<EvidenceGapBadge label="X" escalation="none" />)
      const badge = container.querySelector('[data-testid="evidence-gap-badge"]')
      expect(badge?.className).not.toContain('evidence-gap-pulse')
    })

    it('applies pulse class when escalation is "warning"', () => {
      const { container } = render(<EvidenceGapBadge label="X" escalation="warning" />)
      const badge = container.querySelector('[data-testid="evidence-gap-badge"]')
      expect(badge?.className).toContain('evidence-gap-pulse')
    })

    it('applies pulse class when escalation is "critical"', () => {
      const { container } = render(<EvidenceGapBadge label="X" escalation="critical" />)
      const badge = container.querySelector('[data-testid="evidence-gap-badge"]')
      expect(badge?.className).toContain('evidence-gap-pulse')
    })

    it('uses danger colour classes for critical escalation', () => {
      const { container } = render(<EvidenceGapBadge label="X" escalation="critical" />)
      const badge = container.querySelector('[data-testid="evidence-gap-badge"]')
      expect(badge?.className).toContain('border-danger')
      expect(badge?.className).toContain('bg-danger-light')
      const questionMark = badge?.querySelector('span')
      expect(questionMark?.className).toContain('text-danger')
    })

    it('uses warning colour classes for warning escalation', () => {
      const { container } = render(<EvidenceGapBadge label="X" escalation="warning" />)
      const badge = container.querySelector('[data-testid="evidence-gap-badge"]')
      expect(badge?.className).toContain('border-warning')
      expect(badge?.className).toContain('bg-warning-light')
    })

    it('includes escalation-specific tooltip text for warning', () => {
      const { container } = render(<EvidenceGapBadge label="Revenue" escalation="warning" />)
      const hover = container.querySelector('[data-testid="evidence-gap-badge-hover"]')
      expect(hover?.getAttribute('title')).toContain('High investigation value')
    })

    it('includes escalation-specific tooltip text for critical', () => {
      const { container } = render(<EvidenceGapBadge label="Revenue" escalation="critical" />)
      const hover = container.querySelector('[data-testid="evidence-gap-badge-hover"]')
      expect(hover?.getAttribute('title')).toContain('Critical evidence gap')
    })
  })
})

/**
 * ConstraintBadge unit tests (A.6)
 * Verifies: rendering, accessible attributes, pointer-events-none, hover zone, no deps on store.
 */
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { ConstraintBadge } from '../ConstraintBadge'

describe('ConstraintBadge', () => {
  it('renders with data-testid="constraint-badge"', () => {
    const { container } = render(<ConstraintBadge tooltip="Constrained: Revenue >= 1000" />)
    const badge = container.querySelector('[data-testid="constraint-badge"]')
    expect(badge).not.toBeNull()
  })

  it('hover zone title attribute contains constraint description', () => {
    const { container } = render(<ConstraintBadge tooltip="Constrained: Cost <= 500" />)
    const hover = container.querySelector('[data-testid="constraint-badge-hover"]')
    expect(hover?.getAttribute('title')).toBe('Constrained: Cost <= 500')
  })

  it('hover zone aria-label matches the tooltip', () => {
    const { container } = render(<ConstraintBadge tooltip="Constrained: Time >= 10" />)
    const hover = container.querySelector('[data-testid="constraint-badge-hover"]')
    expect(hover?.getAttribute('aria-label')).toBe('Constrained: Time >= 10')
  })

  it('visual badge has pointer-events-none class', () => {
    const { container } = render(<ConstraintBadge tooltip="test" />)
    const badge = container.querySelector('[data-testid="constraint-badge"]')
    expect(badge?.className).toContain('pointer-events-none')
  })

  it('hover zone does NOT have pointer-events-none (allows tooltip)', () => {
    const { container } = render(<ConstraintBadge tooltip="test" />)
    const hover = container.querySelector('[data-testid="constraint-badge-hover"]')
    expect(hover?.className).not.toContain('pointer-events-none')
  })

  it('positions at bottom-left (complementing EvidenceGapBadge at bottom-right)', () => {
    const { container } = render(<ConstraintBadge tooltip="test" />)
    const badge = container.querySelector('[data-testid="constraint-badge"]')
    expect(badge?.className).toContain('absolute')
    expect(badge?.className).toContain('-bottom-1.5')
    expect(badge?.className).toContain('-left-1.5')
  })

  it('is a circle (rounded-full)', () => {
    const { container } = render(<ConstraintBadge tooltip="test" />)
    const badge = container.querySelector('[data-testid="constraint-badge"]')
    expect(badge?.className).toContain('rounded-full')
  })
})

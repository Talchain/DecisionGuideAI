/**
 * StalenessPill — freshness indicator above an assistant message bubble.
 * Verifies copy, ARIA roles, and DS-token classes for both variants.
 */
import { describe, it, expect, vi } from 'vitest'

vi.mock('../../../styles/typography', () => ({
  typography: { panelMeta: 'panelMeta' },
}))

import { render, screen } from '@testing-library/react'
import { StalenessPill } from '../StalenessPill'

describe('StalenessPill', () => {
  it('renders stale variant with warning copy, role=status and aria-live=polite', () => {
    render(<StalenessPill freshness="stale" />)
    const pill = screen.getByTestId('staleness-pill')
    expect(pill.getAttribute('data-freshness')).toBe('stale')
    expect(pill.getAttribute('role')).toBe('status')
    expect(pill.getAttribute('aria-live')).toBe('polite')
    expect(pill.textContent).toContain('Model changed since last analysis')
  })

  it('renders unknown variant with info copy, role=status and aria-live=polite', () => {
    render(<StalenessPill freshness="unknown" />)
    const pill = screen.getByTestId('staleness-pill')
    expect(pill.getAttribute('data-freshness')).toBe('unknown')
    expect(pill.getAttribute('role')).toBe('status')
    expect(pill.getAttribute('aria-live')).toBe('polite')
    expect(pill.textContent).toContain('Based on latest available analysis')
  })

  it('uses outlined warning border on stale; icon carries semantic colour, text stays text-body', () => {
    render(<StalenessPill freshness="stale" />)
    const pill = screen.getByTestId('staleness-pill')
    const cls = pill.className
    expect(cls).toContain('border-warning/30')
    expect(cls).toContain('bg-transparent')
    expect(cls).toContain('text-text-body')
    expect(cls).toContain('rounded-pill')
    expect(cls).toContain('panelMeta')
    // Icon (svg) should carry the semantic state colour, sized at the DS
    // panel-inline icon size (14px = w-3.5/h-3.5).
    const icon = pill.querySelector('svg')
    expect(icon).toBeTruthy()
    expect(icon!.getAttribute('class')).toContain('text-warning')
    expect(icon!.getAttribute('class')).toContain('w-3.5')
    expect(icon!.getAttribute('class')).toContain('h-3.5')
  })

  it('uses outlined info border on unknown; icon carries info colour', () => {
    render(<StalenessPill freshness="unknown" />)
    const pill = screen.getByTestId('staleness-pill')
    const cls = pill.className
    expect(cls).toContain('border-info/30')
    expect(cls).toContain('bg-transparent')
    expect(cls).toContain('text-text-body')
    const icon = pill.querySelector('svg')
    expect(icon).toBeTruthy()
    expect(icon!.getAttribute('class')).toContain('text-info')
    expect(icon!.getAttribute('class')).toContain('w-3.5')
    expect(icon!.getAttribute('class')).toContain('h-3.5')
  })
})

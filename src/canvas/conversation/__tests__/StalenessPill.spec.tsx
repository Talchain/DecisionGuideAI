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

  it('uses outlined warning border on stale (no filled background, no coloured text)', () => {
    render(<StalenessPill freshness="stale" />)
    const pill = screen.getByTestId('staleness-pill')
    const cls = pill.className
    expect(cls).toContain('border-warning/30')
    expect(cls).toContain('bg-transparent')
    expect(cls).toContain('text-text-body')
    expect(cls).toContain('rounded-pill')
    expect(cls).toContain('panelMeta')
  })

  it('uses outlined info border on unknown', () => {
    render(<StalenessPill freshness="unknown" />)
    const pill = screen.getByTestId('staleness-pill')
    const cls = pill.className
    expect(cls).toContain('border-info/30')
    expect(cls).toContain('bg-transparent')
    expect(cls).toContain('text-text-body')
  })
})

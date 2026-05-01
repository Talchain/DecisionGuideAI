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

  it('uses outlined warning border on stale; pill text and icon stay text-body (DS strict)', () => {
    render(<StalenessPill freshness="stale" />)
    const pill = screen.getByTestId('staleness-pill')
    const cls = pill.className
    expect(cls).toContain('border-warning/30')
    expect(cls).toContain('bg-transparent')
    expect(cls).toContain('text-text-body')
    expect(cls).toContain('rounded-pill')
    expect(cls).toContain('panelMeta')
    // Brief: padding 4×12px → py-1 px-3
    expect(cls).toContain('px-3')
    expect(cls).toContain('py-1')
    // Icon at DS panel-inline size, NO semantic colour class on the icon
    // (DS v5 §8.5 + CLAUDE.md: never text-{colour} on pills — the icon's
    // shape, not colour, differentiates state).
    const icon = pill.querySelector('svg')
    expect(icon).toBeTruthy()
    const iconCls = icon!.getAttribute('class') ?? ''
    expect(iconCls).toContain('w-3.5')
    expect(iconCls).toContain('h-3.5')
    expect(iconCls).not.toContain('text-warning')
    expect(iconCls).not.toContain('text-info')
  })

  it('uses outlined info border on unknown; same DS strict rules apply', () => {
    render(<StalenessPill freshness="unknown" />)
    const pill = screen.getByTestId('staleness-pill')
    const cls = pill.className
    expect(cls).toContain('border-info/30')
    expect(cls).toContain('bg-transparent')
    expect(cls).toContain('text-text-body')
    expect(cls).toContain('px-3')
    expect(cls).toContain('py-1')
    const icon = pill.querySelector('svg')
    expect(icon).toBeTruthy()
    const iconCls = icon!.getAttribute('class') ?? ''
    expect(iconCls).toContain('w-3.5')
    expect(iconCls).toContain('h-3.5')
    expect(iconCls).not.toContain('text-info')
    expect(iconCls).not.toContain('text-warning')
  })
})

/**
 * AnalysisFreshnessNotice — four-state rendering, hidden-when-unset, store-read.
 *
 * Copy is asserted via the exported FRESHNESS_COPY constant (the single source
 * of truth) rather than duplicated string literals.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { configureAxe } from 'vitest-axe'

// Controllable store stub so the no-prop (store-read) path is deterministic.
const h = vi.hoisted(() => ({ slice: null as unknown }))
vi.mock('@/canvas/store', () => ({
  useCanvasStore: (sel: (s: { analysisFreshness: unknown }) => unknown) =>
    sel({ analysisFreshness: h.slice }),
}))

import { AnalysisFreshnessNotice, FRESHNESS_COPY } from '../AnalysisFreshnessNotice'

const axeConfigured = configureAxe({ rules: { 'color-contrast': { enabled: false } } })
const TESTID = 'analysis-freshness-notice'

beforeEach(() => {
  h.slice = null
})

describe('AnalysisFreshnessNotice — four states (prop-driven)', () => {
  it.each(['fresh', 'stale', 'unknown', 'none'] as const)('renders the %s message', (freshness) => {
    render(<AnalysisFreshnessNotice state={{ freshness }} />)
    const el = screen.getByTestId(TESTID)
    expect(el).toHaveTextContent(FRESHNESS_COPY[freshness])
    expect(el).toHaveAttribute('data-freshness', freshness)
  })
})

describe('AnalysisFreshnessNotice — never asserts a state it does not hold', () => {
  it('renders nothing when the slice is unset (prop null)', () => {
    render(<AnalysisFreshnessNotice state={null} />)
    expect(screen.queryByTestId(TESTID)).toBeNull()
  })

  it('renders nothing when the store slice is unset (no prop)', () => {
    h.slice = null
    render(<AnalysisFreshnessNotice />)
    expect(screen.queryByTestId(TESTID)).toBeNull()
  })
})

describe('AnalysisFreshnessNotice — store-read fallback', () => {
  it('reads the verdict from the store when no prop is given', () => {
    h.slice = { freshness: 'stale', freshnessReason: 'graph_hash_match' }
    render(<AnalysisFreshnessNotice />)
    expect(screen.getByTestId(TESTID)).toHaveTextContent(FRESHNESS_COPY.stale)
  })

  it('does not surface the technical reason as user copy', () => {
    h.slice = { freshness: 'stale', freshnessReason: 'graph_hash_match' }
    render(<AnalysisFreshnessNotice />)
    const el = screen.getByTestId(TESTID)
    expect(el.textContent ?? '').not.toContain('graph_hash_match') // reason is data-* only
    expect(el).toHaveAttribute('data-freshness-reason', 'graph_hash_match')
  })
})

describe('AnalysisFreshnessNotice — accessibility', () => {
  it.each(['fresh', 'stale', 'unknown', 'none'] as const)('has no axe violations: %s', async (freshness) => {
    const { container } = render(<AnalysisFreshnessNotice state={{ freshness }} />)
    expect((await axeConfigured(container)).violations).toEqual([])
  })
})

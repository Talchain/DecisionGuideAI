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
const h = vi.hoisted(() => ({ slice: null as unknown, dirty: false as boolean }))
vi.mock('@/canvas/store', () => ({
  useCanvasStore: (sel: (s: { analysisFreshness: unknown; analysisFreshnessDirty: boolean }) => unknown) =>
    sel({ analysisFreshness: h.slice, analysisFreshnessDirty: h.dirty }),
}))

import { AnalysisFreshnessNotice, FRESHNESS_COPY } from '../AnalysisFreshnessNotice'

const axeConfigured = configureAxe({ rules: { 'color-contrast': { enabled: false } } })
const TESTID = 'analysis-freshness-notice'

beforeEach(() => {
  h.slice = null
  h.dirty = false
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

describe('AnalysisFreshnessNotice — local dirty overlay (display rule)', () => {
  it('downgrades a fresh verdict to the unknown message when dirty (prop)', () => {
    render(<AnalysisFreshnessNotice state={{ freshness: 'fresh' }} dirty />)
    const el = screen.getByTestId(TESTID)
    expect(el).toHaveTextContent(FRESHNESS_COPY.unknown)
    expect(el).toHaveAttribute('data-freshness', 'unknown')
    // CEE's true verdict is preserved for traceability; the downgrade is flagged.
    expect(el).toHaveAttribute('data-cee-freshness', 'fresh')
    expect(el).toHaveAttribute('data-freshness-dirty', 'true')
  })

  it('does not downgrade a CEE stale verdict when dirty (stays stale)', () => {
    render(<AnalysisFreshnessNotice state={{ freshness: 'stale' }} dirty />)
    const el = screen.getByTestId(TESTID)
    expect(el).toHaveTextContent(FRESHNESS_COPY.stale)
    expect(el).toHaveAttribute('data-freshness', 'stale')
    expect(el).not.toHaveAttribute('data-freshness-dirty')
  })

  it('shows the clean fresh message when fresh and not dirty', () => {
    render(<AnalysisFreshnessNotice state={{ freshness: 'fresh' }} dirty={false} />)
    const el = screen.getByTestId(TESTID)
    expect(el).toHaveTextContent(FRESHNESS_COPY.fresh)
    expect(el).toHaveAttribute('data-freshness', 'fresh')
  })

  it('reads the dirty overlay from the store (no prop) and downgrades fresh', () => {
    h.slice = { freshness: 'fresh' }
    h.dirty = true
    render(<AnalysisFreshnessNotice />)
    const el = screen.getByTestId(TESTID)
    expect(el).toHaveTextContent(FRESHNESS_COPY.unknown)
    expect(el).toHaveAttribute('data-freshness', 'unknown')
  })
})

describe('AnalysisFreshnessNotice — accessibility', () => {
  it.each(['fresh', 'stale', 'unknown', 'none'] as const)('has no axe violations: %s', async (freshness) => {
    const { container } = render(<AnalysisFreshnessNotice state={{ freshness }} />)
    expect((await axeConfigured(container)).violations).toEqual([])
  })

  it('has no axe violations in the dirty-downgraded state', async () => {
    const { container } = render(<AnalysisFreshnessNotice state={{ freshness: 'fresh' }} dirty />)
    expect((await axeConfigured(container)).violations).toEqual([])
  })
})

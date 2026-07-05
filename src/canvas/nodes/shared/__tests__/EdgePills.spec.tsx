/**
 * EdgePills — brief scope 1: always-on factor-card pills now carry direction +
 * the target's label (verbatim) alongside the strength %, with graceful
 * omission (never a throw, never a bare "%") when a label is absent.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EdgePills } from '../EdgePills'

type AnyState = Record<string, unknown>
const makeState = (over: AnyState = {}): AnyState => ({ edges: [], nodes: [], ...over })

vi.mock('../../../store', () => ({
  useCanvasStore: vi.fn((sel) => sel(makeState())),
}))

import { useCanvasStore } from '../../../store'

const mockStore = (state: AnyState) =>
  vi.mocked(useCanvasStore).mockImplementation((sel) => sel(state as never))

describe('EdgePills', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('renders direction + percentage + the verbatim target label (decode path)', () => {
    mockStore(makeState({
      edges: [{ id: 'e1', source: 'f1', target: 'o1', data: { weight: 0.45, direction: 'positive' } }],
      nodes: [{ id: 'o1', type: 'outcome', data: { label: 'Market position' } }],
    }))
    const { container } = render(<EdgePills nodeId="f1" />)
    expect(screen.getByText('Market position')).toBeDefined()
    expect(container.textContent).toContain('45%')
    // Positive → "raises" → success-coloured arrow.
    expect(container.querySelector('.text-success')).toBeTruthy()
  })

  it('uses a danger (lowers) arrow for negative edges', () => {
    mockStore(makeState({
      edges: [{ id: 'e1', source: 'f1', target: 'r1', data: { weight: 0.65, direction: 'negative' } }],
      nodes: [{ id: 'r1', type: 'risk', data: { label: 'Burn rate' } }],
    }))
    const { container } = render(<EdgePills nodeId="f1" />)
    expect(screen.getByText('Burn rate')).toBeDefined()
    expect(container.textContent).toContain('65%')
    expect(container.querySelector('.text-danger')).toBeTruthy()
  })

  it('omits the pill (no bare value, no throw) when the target label is absent', () => {
    mockStore(makeState({
      edges: [{ id: 'e1', source: 'f1', target: 'o1', data: { weight: 0.65, direction: 'negative' } }],
      nodes: [{ id: 'o1', type: 'risk', data: {} }], // no label
    }))
    const { container } = render(<EdgePills nodeId="f1" />)
    expect(screen.queryByText('65%')).toBeNull()
    expect(container.textContent).toBe('')
  })

  it('caps visible pills at 4 (top by strength)', () => {
    const edges = Array.from({ length: 6 }, (_, i) => ({
      id: `e${i}`, source: 'f1', target: `o${i}`, data: { weight: 0.9 - i * 0.1, direction: 'positive' },
    }))
    const nodes = Array.from({ length: 6 }, (_, i) => ({
      id: `o${i}`, type: 'outcome', data: { label: `Outcome ${i}` },
    }))
    mockStore(makeState({ edges, nodes }))
    render(<EdgePills nodeId="f1" />)
    expect(screen.queryAllByText(/^Outcome \d$/).length).toBe(4)
  })

  it('only pills outcome/risk targets (skips other kinds)', () => {
    mockStore(makeState({
      edges: [{ id: 'e1', source: 'f1', target: 'g1', data: { weight: 0.5, direction: 'positive' } }],
      nodes: [{ id: 'g1', type: 'goal', data: { label: 'My goal' } }],
    }))
    const { container } = render(<EdgePills nodeId="f1" />)
    expect(container.textContent).toBe('')
  })

  // Brief amendment A6: target labels render VERBATIM — never truncated,
  // abbreviated, or rewritten. A long label must appear in full.
  it('renders a long target label verbatim (no truncation)', () => {
    const longLabel = 'Founder Equity Dilution Across Multiple Funding Rounds'
    mockStore(makeState({
      edges: [{ id: 'e1', source: 'f1', target: 'o1', data: { weight: 0.45, direction: 'positive' } }],
      nodes: [{ id: 'o1', type: 'risk', data: { label: longLabel } }],
    }))
    render(<EdgePills nodeId="f1" />)
    expect(screen.getByText(longLabel)).toBeDefined()
  })

  // A11y: the arrow glyph is aria-hidden, so direction is exposed to screen
  // readers via visually-hidden approved "Raises"/"Lowers" text. Visible UI
  // is unchanged (the text is sr-only / out of flow).
  it('exposes direction to screen readers as "Raises"/"Lowers"', () => {
    mockStore(makeState({
      edges: [
        { id: 'e1', source: 'f1', target: 'o1', data: { weight: 0.45, direction: 'positive' } },
        { id: 'e2', source: 'f1', target: 'r1', data: { weight: 0.65, direction: 'negative' } },
      ],
      nodes: [
        { id: 'o1', type: 'outcome', data: { label: 'Revenue Growth' } },
        { id: 'r1', type: 'risk', data: { label: 'Cash Runway Pressure' } },
      ],
    }))
    const { container } = render(<EdgePills nodeId="f1" />)
    expect(screen.getByText('Raises')).toBeDefined()
    expect(screen.getByText('Lowers')).toBeDefined()
    // Visually hidden (sr-only) — present for assistive tech, out of visible flow.
    expect(container.querySelector('.sr-only')).toBeTruthy()
  })
})

// Audit §8 P0-4: strength vs confidence labelling — the pill % is link
// STRENGTH and must be self-identifying (title + aria), distinguishable from
// ConnRow's "N% conf." confidence format.
describe('EdgePills — strength labelling (audit §8 P0-4)', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('exposes the strength title and aria label on the percentage', () => {
    mockStore(makeState({
      edges: [{ id: 'e1', source: 'f1', target: 'o1', data: { weight: 0.3, direction: 'positive' } }],
      nodes: [{ id: 'o1', type: 'outcome', data: { label: 'Shipping speed' } }],
    }))
    render(<EdgePills nodeId="f1" />)
    const pct = screen.getByText('30%')
    expect(pct.getAttribute('title')).toBe('Link strength')
    expect(pct.getAttribute('aria-label')).toBe('30% link strength')
  })
})

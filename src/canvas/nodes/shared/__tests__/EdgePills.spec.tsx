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
})

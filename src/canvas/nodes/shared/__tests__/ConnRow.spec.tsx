/**
 * ConnRow — audit §8 P0-4 (strength vs confidence labelling).
 *
 * The percentage in a ConnRow is beliefExists/exists_probability — confidence
 * the link exists — and must be visibly qualified ("N% conf." + title/aria)
 * so it can never be silently read as the same number family as EdgePills'
 * link-strength percentage.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ConnRow } from '../ConnRow'

vi.mock('../../../store', () => ({
  useCanvasStore: { getState: vi.fn(() => ({ selectEdgeWithoutHistory: vi.fn(), setShowInspectorPanel: vi.fn() })) },
}))

describe('ConnRow', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('renders the confidence percentage with a visible "conf." qualifier', () => {
    render(<ConnRow edgeId="e1" nodeKind="outcome" label="Shipping speed" confidencePct={85} />)
    expect(screen.getByText('85% conf.')).toBeDefined()
    // No unlabelled bare "85%" text node anywhere.
    expect(screen.queryByText(/^85%$/)).toBeNull()
  })

  it('exposes the full meaning via title and aria label', () => {
    render(<ConnRow edgeId="e1" nodeKind="risk" label="Burn rate" confidencePct={62} />)
    const pct = screen.getByText('62% conf.')
    expect(pct.getAttribute('title')).toBe('Confidence the link exists')
    expect(pct.getAttribute('aria-label')).toBe('62% confidence the link exists')
  })

  it('renders no percentage cell when confidence is unknown', () => {
    render(<ConnRow edgeId="e1" nodeKind="outcome" label="Shipping speed" confidencePct={null} />)
    expect(screen.queryByText(/conf\./)).toBeNull()
    expect(screen.queryByText(/%/)).toBeNull()
  })
})

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

/**
 * An unknown confidence is DISCLOSED, not omitted.
 *
 * ⭐ THE TWO CASES ABOVE ARE DELIBERATELY LEFT BYTE-UNCHANGED. They are the
 * P0-4 anti-conflation ruling — no bare "%", no "conf." text — and they still
 * pass over the new branch. That is the evidence that this fills the silence
 * rather than reopening the conflation; had the affordance borrowed either
 * token, the existing suite would have gone red without anyone adding a case.
 *
 * WHY THE NULL BRANCH IS REACHABLE (its own precondition, pinned in prose
 * because the gate lives upstream): `useNodeConnections` resolves this through
 * `isEdgeValueSet(data, 'beliefExists')`. A CEE-drafted edge carries the raw
 * `exists_probability`, which counts as evidence, so it renders a figure —
 * these rows are the user's OWN hand-drawn edges, whose `USER_EDGE_DEFAULTS`
 * carry `beliefExists: 0.8` with no source stamp by explicit design.
 */
describe('ConnRow — an unknown confidence is disclosed, not omitted', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('renders a "Not set" affordance bound to THIS edge, naming the quantity', () => {
    render(<ConnRow edgeId="e_user_drawn" nodeKind="outcome" label="Shipping speed" confidencePct={null} />)

    // Bound by identity (edge id), never by the visible words — "Not set" is a
    // string several surfaces use, and a row for a different edge would satisfy
    // a text query while proving nothing about this one.
    const cell = screen.getByTestId('conn-row-confidence-unset-e_user_drawn')
    expect(cell.textContent).toBe('Not set')
    expect(cell.getAttribute('aria-label')).toBe('Confidence the link exists is not set')
  })

  it('does NOT borrow the link-strength wording (P0-4 holds where no figure disambiguates)', () => {
    render(<ConnRow edgeId="e1" nodeKind="risk" label="Burn rate" confidencePct={null} />)
    const cell = screen.getByTestId('conn-row-confidence-unset-e1')

    // The pre-analysis lane says "Link strength not set". This cell reports a
    // DIFFERENT number family, and the unset state is the one place with no
    // figure present to tell them apart.
    expect(cell.getAttribute('title')).not.toMatch(/strength/i)
    expect(cell.getAttribute('aria-label')).not.toMatch(/strength/i)
  })

  it('discloses without inviting — the control that would resolve it is still fenced', () => {
    render(<ConnRow edgeId="e1" nodeKind="risk" label="Burn rate" confidencePct={null} />)
    const cell = screen.getByTestId('conn-row-confidence-unset-e1')
    const words = `${cell.getAttribute('title')} ${cell.getAttribute('aria-label')}`

    // ⛔ This is the case that reds if someone "harmonises" this with
    // PreAnalysisInboundRows' "…open this connection to estimate it". Existence
    // probability has no wire carrier, so its inspector control is disabled:
    // an invitation here would advertise an action the product cannot perform.
    expect(words).not.toMatch(/open this connection|estimate it|set it|click to/i)
  })

  it('the row is still an actionable target in the unset state', () => {
    render(<ConnRow edgeId="e1" nodeKind="outcome" label="Shipping speed" confidencePct={null} />)
    // The affordance must not have displaced the click target the row already had.
    expect(screen.getByRole('button')).toBeDefined()
  })

  it('CONTROL — a row WITH a figure renders no unset affordance', () => {
    render(<ConnRow edgeId="e1" nodeKind="outcome" label="Shipping speed" confidencePct={85} />)

    // Anti-vacuity: the cell IS rendered and DOES carry the number…
    expect(screen.getByText('85% conf.')).toBeDefined()
    // …and only then is the absence of the unset marker meaningful. Without
    // this, a component that rendered the affordance unconditionally would
    // satisfy every case above.
    expect(screen.queryByTestId('conn-row-confidence-unset-e1')).toBeNull()
    expect(screen.queryByText('Not set')).toBeNull()
  })
})

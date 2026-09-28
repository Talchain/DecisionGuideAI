/**
 * POM-8 (27 Sep 2026) — THE EDGE INSPECTOR NEVER CALLS A PLACEHOLDER AN ESTIMATE.
 *
 * Measured on Paul's MRR board: clicking "Pro plan price → MRR" (a 0.5
 * `olumi_placeholder`) opened a panel reading "Olumi estimated this strength
 * from your description.", "0.50 ± 0.25 — Anywhere from moderate to very strong
 * fits this estimate", "Olumi's current estimate is 0.5." and a "Confirm this
 * estimate" button. The word "placeholder" appeared 0 times. The Model tab, on
 * the same edge, said "a placeholder, not an estimate".
 *
 * Owner decision: the inspector must not say Olumi estimated it, nor offer to
 * confirm it as an estimate. The strength control is how it gets set.
 *
 * Edge data comes from the real `mapDraftEdgeToCanvas` over the fixture (Paul's
 * served draft), plus the `serverStrength` tuple the confirm gate also requires —
 * so the CONTRAST case (the same edge relabelled `olumi_estimate`) renders the
 * confirm row, and its absence on the placeholder is measured, not vacuous.
 * Rendered text only; jsdom proves no layout.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import fixture from '../../../../../e2e/geometry/fixtures/mrr-17d1cd3a.fixture.json'
import { EdgePanel } from '../panels/EdgePanel'
import { useCanvasStore } from '../../../store'
import { useGuidanceStore } from '../../../stores/guidanceStore'
import { mapDraftEdgeToCanvas } from '../../../utils/applyDraftResult'

type WireEdge = Record<string, unknown> & { from: string; to: string }
const WIRE = (fixture as unknown as { draft: { edges: WireEdge[] } }).draft.edges
const PRICE_TO_MRR = WIRE.find((w) => w.from === 'pro_plan_price' && w.to === 'mrr')!

const panelProps = { edgeId: 'e1', techMode: false, onClose: vi.fn(), onNavigate: vi.fn() }

function seed(wire: WireEdge) {
  const mapped = mapDraftEdgeToCanvas({ ...wire }, 0)
  useCanvasStore.setState({
    ...useCanvasStore.getState(),
    nodes: [
      { id: 'pro_plan_price', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Pro plan price' } },
      { id: 'mrr', type: 'goal', position: { x: 0, y: 200 }, data: { label: 'MRR' } },
    ],
    edges: [{ ...mapped, id: 'e1' }],
    results: { status: 'none', report: null },
  } as never)
}

const relabelled = (magnitude: string): WireEdge => ({
  ...PRICE_TO_MRR,
  provenance: { ...(PRICE_TO_MRR.provenance as Record<string, unknown>), magnitude },
})

beforeEach(() => {
  useCanvasStore.setState(useCanvasStore.getState(), true)
  useGuidanceStore.setState({ guidanceItems: [], _prefillChat: null, _sendMessage: null })
})

describe('EdgePanel — a placeholder strength (POM-8)', () => {
  it('PRECONDITION / CONTRAST: the same edge as an olumi_estimate says "estimated" and offers the confirm', () => {
    seed(relabelled('olumi_estimate'))
    render(<EdgePanel {...panelProps} />)
    expect(screen.getByTestId('edge-values-provenance').textContent).toContain('Olumi estimated this strength')
    expect(screen.getByTestId('edge-confirm-current-strength')).toBeTruthy()
    expect(screen.getByTestId('edge-strength-spans-bands').textContent).toContain('fits this estimate')
  })

  it('says it is a placeholder, and not that Olumi estimated it', () => {
    seed(PRICE_TO_MRR)
    render(<EdgePanel {...panelProps} />)
    const provenance = screen.getByTestId('edge-values-provenance').textContent ?? ''
    expect(provenance).toContain('placeholder')
    expect(provenance).toContain('not an estimate')
    expect(provenance).not.toContain('Olumi estimated this strength')
  })

  it('offers no "Confirm this estimate" and no "Olumi\'s current estimate is …"', () => {
    seed(PRICE_TO_MRR)
    const { container } = render(<EdgePanel {...panelProps} />)
    expect(screen.queryByTestId('edge-confirm-current-strength')).toBeNull()
    expect(container.textContent).not.toMatch(/current estimate is/)
    expect(container.textContent).not.toMatch(/Confirm this estimate/)
  })

  it('the spread sentence calls it a placeholder, not an estimate', () => {
    seed(PRICE_TO_MRR)
    render(<EdgePanel {...panelProps} />)
    const spans = screen.getByTestId('edge-strength-spans-bands').textContent ?? ''
    expect(spans).toContain('fits this placeholder')
    expect(spans).not.toContain('estimate')
  })
})

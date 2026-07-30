/**
 * V7EvidenceDisclosure — analysis-graph projection pins.
 *
 * These assert the "graph-as-explanation-surface" behaviour end-to-end through
 * the real canvas store: viewing the Flip-risks tab marks exactly the resolvable
 * fragile edges; the Drivers tab marks the driver nodes; switching tabs swaps
 * the marks; closing the disclosure clears them; unresolvable ids no-op; and a
 * graph with no evidence produces zero marks.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { V7EvidenceDisclosure } from '../V7EvidenceDisclosure'
import { useCanvasStore } from '@/canvas/store'
import { v7EvidenceModel as model } from '@/__fixtures__/v7EvidenceModel'

// A minimal canvas: two factors → one outcome, plus a second outgoing edge from
// fac_price so a bare from_id would be ambiguous.
function seedCanvas() {
  useCanvasStore.setState({
    nodes: [
      { id: 'fac_price', position: { x: 0, y: 0 }, data: {}, type: 'factor' },
      { id: 'fac_demand', position: { x: 0, y: 0 }, data: {}, type: 'factor' },
      { id: 'out_mrr', position: { x: 0, y: 0 }, data: {}, type: 'outcome' },
      { id: 'out_cost', position: { x: 0, y: 0 }, data: {}, type: 'outcome' },
    ] as never,
    edges: [
      { id: 'e1', source: 'fac_price', target: 'out_mrr', data: {} },
      { id: 'e2', source: 'fac_price', target: 'out_cost', data: {} },
      { id: 'e3', source: 'fac_demand', target: 'out_mrr', data: {} },
    ] as never,
  })
}

const openDisclosure = () =>
  fireEvent.click(screen.getByRole('button', { name: /Why, and what could change it/i }))

const highlight = () => useCanvasStore.getState().analysisHighlight

beforeEach(() => {
  cleanup()
  seedCanvas()
  useCanvasStore.getState().clearAnalysisHighlight()
})

describe('V7EvidenceDisclosure — analysis-graph projection', () => {
  it('viewing the Flip risks tab marks EXACTLY the resolvable fragile edges', () => {
    render(
      <V7EvidenceDisclosure
        evidence={model({
          flipRisks: [
            { fromId: 'fac_price', toId: 'out_mrr', fromLabel: 'Price', toLabel: 'MRR', switchProbability: 0.4 },
            { fromId: 'fac_demand', toId: 'out_mrr', fromLabel: 'Demand', toLabel: 'MRR', switchProbability: 0.3 },
          ],
        })}
      />,
    )
    openDisclosure()
    fireEvent.click(screen.getByTestId('v7-evidence-tab-flipRisks'))

    const h = highlight()
    expect(h.source).toBe('flip_risks')
    expect([...h.edgeIds].sort()).toEqual(['e1', 'e3'])
    expect(h.nodeIds.size).toBe(0)
  })

  it('viewing the Drivers tab marks the resolvable driver nodes', () => {
    render(
      <V7EvidenceDisclosure
        evidence={model({
          drivers: [
            { factorKey: 'f1', label: 'Price', direction: null, isEstimate: false, focusId: 'fac_price' },
            { factorKey: 'f2', label: 'Demand', direction: null, isEstimate: false, focusId: 'fac_demand' },
          ],
        })}
      />,
    )
    // Default view is Drivers — opening projects immediately.
    openDisclosure()

    const h = highlight()
    expect(h.source).toBe('drivers')
    expect([...h.nodeIds].sort()).toEqual(['fac_demand', 'fac_price'])
    expect(h.edgeIds.size).toBe(0)
  })

  it('switching tabs SWAPS the marks (drivers → flip risks)', () => {
    render(
      <V7EvidenceDisclosure
        evidence={model({
          drivers: [{ factorKey: 'f1', label: 'Price', direction: null, isEstimate: false, focusId: 'fac_price' }],
          flipRisks: [{ fromId: 'fac_demand', toId: 'out_mrr', fromLabel: 'Demand', toLabel: 'MRR', switchProbability: 0.4 }],
        })}
      />,
    )
    openDisclosure()
    expect(highlight().source).toBe('drivers')
    expect([...highlight().nodeIds]).toEqual(['fac_price'])

    fireEvent.click(screen.getByTestId('v7-evidence-tab-flipRisks'))
    const h = highlight()
    expect(h.source).toBe('flip_risks')
    expect([...h.edgeIds]).toEqual(['e3'])
    expect(h.nodeIds.size).toBe(0)
  })

  it('closing the disclosure CLEARS the marks', () => {
    render(
      <V7EvidenceDisclosure
        evidence={model({
          drivers: [{ factorKey: 'f1', label: 'Price', direction: null, isEstimate: false, focusId: 'fac_price' }],
        })}
      />,
    )
    openDisclosure()
    expect(highlight().source).toBe('drivers')

    openDisclosure() // toggle closed
    const h = highlight()
    expect(h.source).toBeNull()
    expect(h.edgeIds.size).toBe(0)
    expect(h.nodeIds.size).toBe(0)
  })

  it('switching to the Trade-offs tab CLEARS the marks (only drivers/flip-risks project)', () => {
    render(
      <V7EvidenceDisclosure
        evidence={model({
          drivers: [{ factorKey: 'f1', label: 'Price', direction: null, isEstimate: false, focusId: 'fac_price' }],
          tradeOffs: [
            { factorLabel: 'Rate', factorId: 'n7', splitValue: 5, splitUnit: '%', highWinnerLabel: 'A', lowWinnerLabel: 'B' },
          ],
        })}
      />,
    )
    openDisclosure()
    expect(highlight().source).toBe('drivers')

    fireEvent.click(screen.getByTestId('v7-evidence-tab-tradeOffs'))
    expect(highlight().source).toBeNull()
  })

  it('unresolvable ids no-op: a flip risk naming no canvas edge marks nothing', () => {
    render(
      <V7EvidenceDisclosure
        evidence={model({
          flipRisks: [
            // ghost endpoints — no matching canvas edge
            { fromId: 'ghost_a', toId: 'ghost_b', fromLabel: 'Ghost', toLabel: 'Nowhere', switchProbability: 0.9 },
            // bare from_id — ambiguous (fac_price has two outgoing edges) → never guessed
            { fromId: 'fac_price', fromLabel: 'Price', toLabel: 'MRR', switchProbability: 0.5 },
          ],
        })}
      />,
    )
    openDisclosure()
    fireEvent.click(screen.getByTestId('v7-evidence-tab-flipRisks'))

    const h = highlight()
    expect(h.source).toBe('flip_risks')
    expect(h.edgeIds.size).toBe(0)
  })

  it('a graph with no evidence renders nothing and produces zero marks', () => {
    const { container } = render(<V7EvidenceDisclosure evidence={model({})} />)
    expect(container.firstChild).toBeNull()
    const h = highlight()
    expect(h.source).toBeNull()
    expect(h.edgeIds.size).toBe(0)
    expect(h.nodeIds.size).toBe(0)
  })

  it('unmounting clears the marks (no projection outlives the panel)', () => {
    const { unmount } = render(
      <V7EvidenceDisclosure
        evidence={model({
          drivers: [{ factorKey: 'f1', label: 'Price', direction: null, isEstimate: false, focusId: 'fac_price' }],
        })}
      />,
    )
    openDisclosure()
    expect(highlight().source).toBe('drivers')
    unmount()
    expect(highlight().source).toBeNull()
  })
})

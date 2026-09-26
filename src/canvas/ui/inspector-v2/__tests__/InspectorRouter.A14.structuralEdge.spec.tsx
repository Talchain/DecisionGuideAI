/**
 * A14 — a structural link's inspector used to show "✓ 100%" (its canonical
 * `beliefExists: 1.0` signature read back as a confidence measurement) and
 * "The link strength saves to the shared model" (a claim about a strength it
 * does not have). Both are gone for a structural edge; the ordinary edge
 * inspector is unaffected.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

import { InspectorRouter } from '../InspectorRouter'
import { useCanvasStore } from '../../../store'

vi.mock('@xyflow/react', () => ({
  useViewport: () => ({ x: 0, y: 0, zoom: 1 }),
}))

function setStoreState(nodes: unknown[], edges: unknown[] = []) {
  useCanvasStore.setState({
    nodes: nodes as never[],
    edges: edges as never[],
    results: { status: 'idle' },
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
    goalThreshold: null,
    confirmedNodeIds: new Set(),
    _internal: {},
  } as never)
}

beforeEach(() => {
  vi.clearAllMocks()
  cleanup()
})
afterEach(cleanup)

const STRUCTURAL_NODES = [
  { id: 'd1', type: 'decision', data: { label: 'Enter the EU market', kind: 'decision' }, position: { x: 0, y: 0 } },
  { id: 'o1', type: 'option', data: { label: 'Direct sales', kind: 'option' }, position: { x: 100, y: 0 } },
]
const STRUCTURAL_EDGES = [
  { id: 'e1', source: 'd1', target: 'o1', data: { weight: 1.0, strengthStd: 0.01, beliefExists: 1.0, beliefExistsSource: 'cee' } },
]

const CAUSAL_NODES = [
  { id: 'f1', type: 'factor', data: { label: 'Marketing budget', kind: 'factor' }, position: { x: 0, y: 0 } },
  { id: 'g1', type: 'goal', data: { label: 'Revenue target', kind: 'goal' }, position: { x: 100, y: 0 } },
]
const CAUSAL_EDGES = [
  { id: 'e1', source: 'f1', target: 'g1', data: { weight: 0.6, direction: 'positive', weightSource: 'user', beliefExists: 0.8, beliefExistsSource: 'user' } },
]

describe('a structural link shows no invented confidence or strength claim', () => {
  beforeEach(() => setStoreState(STRUCTURAL_NODES, STRUCTURAL_EDGES))

  it('shows no confidence badge', () => {
    render(<InspectorRouter nodeId={null} edgeId="e1" onClose={vi.fn()} />)
    expect(screen.queryByTestId('inspector-confidence-badge')).toBeNull()
  })

  it('does not claim the link strength saves to the shared model', () => {
    render(<InspectorRouter nodeId={null} edgeId="e1" onClose={vi.fn()} />)
    const notice = screen.getByTestId('inspector-authority-notice')
    expect(notice.textContent).not.toMatch(/link strength saves/i)
    expect(notice.textContent).toMatch(/structural link, not a causal claim/i)
  })
})

describe('CONTRAST — an ordinary causal edge keeps its badge and strength claim', () => {
  beforeEach(() => setStoreState(CAUSAL_NODES, CAUSAL_EDGES))

  it('still shows its stated existence figure — in the body, since v3.1 moved it out of the head', () => {
    // v3.1 (DESIGN-GAP-v31 rows 7, 12): the head is the kind, the title and
    // Close; the header "✓ 80%" badge repeated the body's own readout. The
    // CONTRAST still discriminates: the causal edge's figure is readable, the
    // structural link above shows none.
    render(<InspectorRouter nodeId={null} edgeId="e1" onClose={vi.fn()} />)
    expect(screen.queryByTestId('inspector-confidence-badge')).toBeNull()
    expect(screen.getByTestId('edge-existence-readout').textContent ?? '').toMatch(/80%/)
  })

  it('does not get the structural-link reason — it is a causal claim', () => {
    render(<InspectorRouter nodeId={null} edgeId="e1" onClose={vi.fn()} />)
    expect(screen.getByTestId('inspector-authority-notice').textContent).not.toMatch(
      /structural link, not a causal claim/i,
    )
  })
})

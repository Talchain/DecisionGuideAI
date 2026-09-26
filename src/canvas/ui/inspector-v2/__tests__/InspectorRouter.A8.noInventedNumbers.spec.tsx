/**
 * A8 — two numbers the inspector used to show that no producer field carries.
 *
 * 1. The header badge "✓ N%" on goal/outcome/risk nodes: the MEAN of inbound
 *    edges' `exists_probability`. `InspectorRouter.tsx` computed it;
 *    `nodeConfidenceBadge.ts` banded it. Neither reads a field the data
 *    carries — it is a UI aggregate over `belief_exists`, a different
 *    question (does the edge exist) dressed as this one (how confident is
 *    the model in this node).
 * 2. "Contributes to your goal N%" on the outcome panel: `abs(strength) × 100`
 *    on the outbound goal edge. `OutcomePanel.tsx` computed it. No field named
 *    "contribution" exists on the wire.
 *
 * THIN UI LAYER: render only what the data carries. Both numbers are gone,
 * not reworded or re-banded.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
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

describe('the node header badge never renders — it was an invented mean', () => {
  it.each(['goal', 'outcome', 'risk'] as const)(
    'a %s node with varying, well-provenanced inbound edges shows no confidence badge',
    (kind) => {
      setStoreState(
        [
          { id: 'f1', type: 'factor', data: { label: 'Price', kind: 'factor' }, position: { x: 0, y: 0 } },
          { id: 'f2', type: 'factor', data: { label: 'Demand', kind: 'factor' }, position: { x: 0, y: 0 } },
          { id: 'n1', type: kind, data: { label: 'Target', kind }, position: { x: 0, y: 0 } },
        ],
        [
          { id: 'e1', source: 'f1', target: 'n1', data: { weight: 0.3, direction: 'positive', beliefExists: 0.9, beliefExistsSource: 'user' } },
          { id: 'e2', source: 'f2', target: 'n1', data: { weight: 0.3, direction: 'positive', beliefExists: 0.7, beliefExistsSource: 'user' } },
        ],
      )
      render(<InspectorRouter nodeId="n1" edgeId={null} onClose={vi.fn()} />)
      expect(screen.queryByTestId('inspector-confidence-badge')).toBeNull()
      expect(screen.queryByText(/^80%$/)).toBeNull()
    },
  )

  it('CONTRAST — a characterised edge still shows its own value (in the body since v3.1)', () => {
    setStoreState(
      [
        { id: 'f1', type: 'factor', data: { label: 'Price', kind: 'factor' }, position: { x: 0, y: 0 } },
        { id: 'g1', type: 'goal', data: { label: 'Revenue target', kind: 'goal' }, position: { x: 0, y: 0 } },
      ],
      [{ id: 'e1', source: 'f1', target: 'g1', data: { weight: 0.3, direction: 'positive', beliefExists: 0.8, beliefExistsSource: 'user' } }],
    )
    render(<InspectorRouter nodeId={null} edgeId="e1" onClose={vi.fn()} />)
    // v3.1: the head badge is gone (it repeated this readout); the carried
    // figure is still readable where the body states it.
    expect(screen.getByTestId('edge-existence-readout').textContent ?? '').toMatch(/80%/)
  })
})

describe('the outcome panel never shows an invented goal-contribution figure', () => {
  it('an outcome with a strong outbound goal edge shows no "Contributes to your goal" bar', () => {
    setStoreState(
      [
        { id: 'out1', type: 'outcome', data: { label: 'Revenue', kind: 'outcome' }, position: { x: 0, y: 0 } },
        { id: 'g1', type: 'goal', data: { label: 'Target', kind: 'goal' }, position: { x: 100, y: 0 } },
      ],
      [{ id: 'e1', source: 'out1', target: 'g1', data: { weight: 0.65, direction: 'positive', weightSource: 'cee' } }],
    )
    render(<InspectorRouter nodeId="out1" edgeId={null} onClose={vi.fn()} />)
    expect(screen.queryByText('Contributes to your goal')).toBeNull()
    expect(screen.queryByText('65%')).toBeNull()
  })
})

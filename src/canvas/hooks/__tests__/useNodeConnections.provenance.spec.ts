/**
 * useNodeConnections — the ConnRow confidence provenance gate.
 *
 * ConnRow renders `{confidencePct}% conf.` with aria "N% confidence the link
 * exists". Because `DEFAULT_EDGE_DATA`/`USER_EDGE_DEFAULTS` pin
 * `beliefExists: 0.8`, EVERY edge used to produce a confidence — so the canvas
 * told the user "80% confidence the link exists" about a hardcoded constant.
 *
 * ESCAPE THIS TEST MUST NOT MAKE: asserting only `confidencePct === null` would
 * also pass if the hook returned NO ROWS AT ALL (wrong node id, wrong direction,
 * results not complete). Every absence case below therefore asserts the ROW
 * exists and is correctly resolved first, so the null is a null IN A REAL ROW.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { useNodeConnections } from '../useNodeConnections'
import { DEFAULT_EDGE_DATA, USER_EDGE_DEFAULTS } from '../../domain/edges'

let mockState: {
  edges: unknown[]
  nodes: unknown[]
  results: { status: string }
}

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector: (s: typeof mockState) => unknown) => selector(mockState)),
}))

import { useCanvasStore } from '../../store'

const NODES = [
  { id: 'fac_price', type: 'factor', data: { label: 'Price' } },
  { id: 'out_revenue', type: 'outcome', data: { label: 'Revenue' } },
]

function setup(edgeData: Record<string, unknown>) {
  mockState = {
    nodes: NODES,
    edges: [{ id: 'e1', source: 'fac_price', target: 'out_revenue', data: edgeData }],
    results: { status: 'complete' },
  }
  vi.mocked(useCanvasStore).mockImplementation((selector: any) => selector(mockState))
  return renderHook(() => useNodeConnections('fac_price', 'outbound')).result.current
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('useNodeConnections — a UI default is not a confidence', () => {
  it('reports NO confidence for a user-drawn edge (USER_EDGE_DEFAULTS, beliefExists 0.8)', () => {
    const rows = setup({ ...USER_EDGE_DEFAULTS })

    // The row IS resolved — this is what stops the null below being vacuous.
    expect(rows).toHaveLength(1)
    expect(rows[0].connectedNodeLabel).toBe('Revenue')
    expect(rows[0].edgeId).toBe('e1')

    // …and the fabricated 0.8 does not reach the renderer.
    expect(USER_EDGE_DEFAULTS.beliefExists).toBe(0.8)
    expect(rows[0].confidencePct).toBeNull()
  })

  it('reports NO confidence for an adapter-default edge (DEFAULT_EDGE_DATA)', () => {
    const rows = setup({ ...DEFAULT_EDGE_DATA })
    expect(rows).toHaveLength(1)
    expect(rows[0].connectedNodeLabel).toBe('Revenue')
    expect(rows[0].confidencePct).toBeNull()
  })
})

describe('useNodeConnections — a real producer/user value IS reported (positive control)', () => {
  // Without these, the gate could be `confidencePct = null` unconditionally and
  // every assertion above would still pass.
  it('reports a CEE-stamped belief', () => {
    const rows = setup({ ...DEFAULT_EDGE_DATA, beliefExists: 0.65, beliefExistsSource: 'cee' })
    expect(rows).toHaveLength(1)
    expect(rows[0].confidencePct).toBe(65)
  })

  it('reports a user-set belief', () => {
    const rows = setup({ ...USER_EDGE_DEFAULTS, beliefExists: 0.42, beliefExistsSource: 'user' })
    expect(rows[0].confidencePct).toBe(42)
  })

  it('reports a legacy CEE edge via exists_probability, with no stamp', () => {
    // Back-compat: graphs saved before the marker existed must not all regress.
    const rows = setup({ ...DEFAULT_EDGE_DATA, beliefExists: 0.68, exists_probability: 0.68 })
    expect(rows[0].confidencePct).toBe(68)
  })

  it('prefers exists_probability over beliefExists when both are present', () => {
    // Guards the pre-existing precedence rule while the gate is layered on top.
    const rows = setup({
      ...DEFAULT_EDGE_DATA,
      beliefExists: 0.5,
      exists_probability: 0.9,
      beliefExistsSource: 'cee',
    })
    expect(rows[0].confidencePct).toBe(90)
  })
})

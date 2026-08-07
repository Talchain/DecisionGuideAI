/**
 * usePreAnalysisInbound — the pre-analysis strength provenance gate (F4).
 *
 * `OutcomeNode` / `RiskNode` spoke *"Strongest: Price at 30%."* pre-analysis
 * with no gate at all. `USER_EDGE_DEFAULTS.weight` is `0.3`, so that sentence
 * was a hardcoded constant delivered as a comparative finding.
 *
 * ESCAPE THIS TEST MUST NOT MAKE (trap 13): asserting only
 * `topSetItem === null` would also pass if the hook returned NOTHING —
 * wrong node id, post-analysis, no source node. Every absence case below
 * first proves the ROW resolved (label + edgeId), so the null is a null
 * IN A REAL ROW. Each describe block also carries a PRESENCE case.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { usePreAnalysisInbound } from '../usePreAnalysisInbound'
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
  { id: 'fac_churn', type: 'factor', data: { label: 'Churn' } },
  { id: 'out_revenue', type: 'outcome', data: { label: 'Revenue' } },
]

function setup(
  edges: Array<{ id: string; source: string; data: Record<string, unknown> }>,
  status = 'idle',
) {
  mockState = {
    nodes: NODES,
    edges: edges.map(e => ({ ...e, target: 'out_revenue' })),
    results: { status },
  }
  vi.mocked(useCanvasStore).mockImplementation((selector: any) => selector(mockState))
  return renderHook(() => usePreAnalysisInbound('out_revenue')).result.current
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('usePreAnalysisInbound — a UI default is not a strength', () => {
  it('POSITIVE CONTROL: a stamped edge DOES produce a number and a "strongest"', () => {
    const { items, topSetItem } = setup([
      { id: 'e1', source: 'fac_price', data: { weight: 0.42, direction: 'positive', weightSource: 'cee' } },
    ])

    expect(items).toHaveLength(1)
    expect(items[0].nodeLabel).toBe('Price')
    expect(items[0].strengthPct).toBe(42)
    expect(topSetItem).not.toBeNull()
    expect(topSetItem!.nodeLabel).toBe('Price')
    expect(topSetItem!.strengthPct).toBe(42)
  })

  it('reports NO strength for a user-drawn edge (USER_EDGE_DEFAULTS.weight = 0.3)', () => {
    const { items, topSetItem } = setup([
      { id: 'e1', source: 'fac_price', data: { ...USER_EDGE_DEFAULTS } },
    ])

    // The row IS resolved — this is what stops the nulls below being vacuous.
    expect(items).toHaveLength(1)
    expect(items[0].nodeLabel).toBe('Price')
    expect(items[0].edgeId).toBe('e1')

    // …and the fabricated 0.3 reaches neither the row nor the prose.
    expect(USER_EDGE_DEFAULTS.weight).toBe(0.3)
    expect(items[0].strengthPct).toBeNull()
    expect(topSetItem).toBeNull()
  })

  it('reports NO strength for DEFAULT_EDGE_DATA (weight = 0.5)', () => {
    const { items, topSetItem } = setup([
      { id: 'e1', source: 'fac_price', data: { ...DEFAULT_EDGE_DATA } },
    ])

    expect(items).toHaveLength(1)
    expect(items[0].nodeLabel).toBe('Price')
    expect(DEFAULT_EDGE_DATA.weight).toBe(0.5)
    expect(items[0].strengthPct).toBeNull()
    expect(topSetItem).toBeNull()
  })

  it('accepts CEE back-compat evidence (strength_mean) with no explicit stamp', () => {
    const { items, topSetItem } = setup([
      { id: 'e1', source: 'fac_price', data: { ...DEFAULT_EDGE_DATA, strength_mean: -0.6 } },
    ])

    expect(items[0].strengthPct).toBe(60)
    expect(topSetItem!.strengthPct).toBe(60)
  })
})

describe('usePreAnalysisInbound — ranking is itself a claim', () => {
  it('never crowns a defaulted edge over a set one, even when the default is larger', () => {
    // Defaulted 0.9 vs a genuinely set 0.2. Sorting on the raw numbers would
    // name the fabrication the "strongest" driver of this outcome.
    const { items, topSetItem } = setup([
      { id: 'e_default', source: 'fac_price', data: { weight: 0.9, direction: 'positive' } },
      { id: 'e_set', source: 'fac_churn', data: { weight: 0.2, direction: 'positive', weightSource: 'user' } },
    ])

    expect(items).toHaveLength(2)
    // Both rows resolved…
    expect(items.map(i => i.nodeLabel).sort()).toEqual(['Churn', 'Price'])
    // …the set one sorts first, the defaulted one is unset and last.
    expect(items[0].nodeLabel).toBe('Churn')
    expect(items[0].strengthPct).toBe(20)
    expect(items[1].nodeLabel).toBe('Price')
    expect(items[1].strengthPct).toBeNull()

    expect(topSetItem!.nodeLabel).toBe('Churn')
    expect(topSetItem!.strengthPct).toBe(20)
  })

  it('returns every row but NO topSetItem when nothing at all was set', () => {
    const { items, topSetItem } = setup([
      { id: 'e1', source: 'fac_price', data: { ...USER_EDGE_DEFAULTS } },
      { id: 'e2', source: 'fac_churn', data: { ...USER_EDGE_DEFAULTS } },
    ])

    // "Driven by 2 factors." stays true — the user really drew two edges.
    expect(items).toHaveLength(2)
    expect(items.every(i => i.strengthPct === null)).toBe(true)
    // "Strongest: … at N%." does not.
    expect(topSetItem).toBeNull()
  })
})

describe('usePreAnalysisInbound — scope', () => {
  it('is empty post-analysis (the post lane is useNodeConnections)', () => {
    const { items, topSetItem } = setup(
      [{ id: 'e1', source: 'fac_price', data: { weight: 0.42, weightSource: 'cee' } }],
      'complete',
    )
    expect(items).toEqual([])
    expect(topSetItem).toBeNull()
  })

  it('keys rows by edge id so parallel edges from one source do not collide', () => {
    const { items } = setup([
      { id: 'e1', source: 'fac_price', data: { weight: 0.42, weightSource: 'cee' } },
      { id: 'e2', source: 'fac_price', data: { weight: 0.31, weightSource: 'cee' } },
    ])
    expect(items.map(i => i.edgeId)).toEqual(['e1', 'e2'])
    expect(items.map(i => i.strengthPct)).toEqual([42, 31])
  })
})

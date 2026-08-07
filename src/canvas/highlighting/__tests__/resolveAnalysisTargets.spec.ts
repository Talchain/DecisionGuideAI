/**
 * resolveAnalysisTargets — pure id-resolution for the analysis-graph projection.
 *
 * These are the honesty pins for "mark ONLY producer-named ids that resolve to
 * real canvas elements". Resolution is PURE id mapping — no fabricated values,
 * no thresholds, no guessing. Unresolvable references are silently dropped.
 */
import { describe, it, expect } from 'vitest'
import {
  resolveFragileEdgeIds,
  resolveDriverNodeIds,
  type FlipRiskRef,
  type ProjectionEdge,
  type ProjectionNode,
} from '../resolveAnalysisTargets'

const EDGES: ProjectionEdge[] = [
  { id: 'e1', source: 'fac_price', target: 'out_mrr', data: { edge_id: 'plot-e-1' } },
  { id: 'e2', source: 'fac_price', target: 'out_cost', data: {} },
  { id: 'e3', source: 'fac_demand', target: 'out_mrr', data: { plot_edge_id: 'plot-e-3' } },
]

const NODES: ProjectionNode[] = [
  { id: 'fac_price' },
  { id: 'fac_demand' },
  { id: 'out_mrr' },
]

describe('resolveFragileEdgeIds', () => {
  it('resolves a flip risk by its from/to endpoint pair to the canvas RF edge id', () => {
    const refs: FlipRiskRef[] = [{ fromId: 'fac_price', toId: 'out_mrr' }]
    expect(resolveFragileEdgeIds(refs, EDGES)).toEqual(['e1'])
  })

  it('resolves a flip risk by producer edge_id matched on the canvas edge RF id', () => {
    const refs: FlipRiskRef[] = [{ edgeId: 'e3' }]
    expect(resolveFragileEdgeIds(refs, EDGES)).toEqual(['e3'])
  })

  it('resolves a flip risk by producer edge_id matched on edge.data.edge_id / plot_edge_id', () => {
    expect(resolveFragileEdgeIds([{ edgeId: 'plot-e-1' }], EDGES)).toEqual(['e1'])
    expect(resolveFragileEdgeIds([{ edgeId: 'plot-e-3' }], EDGES)).toEqual(['e3'])
  })

  it('never guesses: a from_id alone (no to_id, no edge_id) does NOT mark any edge', () => {
    // fac_price has TWO outgoing edges (e1, e2) — marking either would be a guess.
    expect(resolveFragileEdgeIds([{ fromId: 'fac_price' }], EDGES)).toEqual([])
  })

  it('silently drops an unresolvable reference (no matching endpoint pair)', () => {
    expect(resolveFragileEdgeIds([{ fromId: 'ghost', toId: 'out_mrr' }], EDGES)).toEqual([])
  })

  it('resolves the specific edge when a factor has multiple outgoing edges', () => {
    // Endpoint pair disambiguates fac_price → out_cost to e2 (not e1).
    expect(resolveFragileEdgeIds([{ fromId: 'fac_price', toId: 'out_cost' }], EDGES)).toEqual(['e2'])
  })

  it('deduplicates and preserves first-seen order across multiple refs', () => {
    const refs: FlipRiskRef[] = [
      { fromId: 'fac_price', toId: 'out_mrr' }, // e1
      { fromId: 'fac_demand', toId: 'out_mrr' }, // e3
      { edgeId: 'plot-e-1' }, // e1 again → deduped
    ]
    expect(resolveFragileEdgeIds(refs, EDGES)).toEqual(['e1', 'e3'])
  })

  it('returns [] for empty refs and for a graph with no edges', () => {
    expect(resolveFragileEdgeIds([], EDGES)).toEqual([])
    expect(resolveFragileEdgeIds([{ fromId: 'fac_price', toId: 'out_mrr' }], [])).toEqual([])
  })
})

describe('resolveDriverNodeIds', () => {
  it('keeps a driver focusId that names a real canvas node', () => {
    expect(resolveDriverNodeIds(['fac_price'], NODES)).toEqual(['fac_price'])
  })

  it('silently drops a focusId with no matching canvas node', () => {
    expect(resolveDriverNodeIds(['ghost_factor'], NODES)).toEqual([])
  })

  it('skips undefined focusIds (driver could not be focused upstream)', () => {
    expect(resolveDriverNodeIds([undefined, 'fac_demand', undefined], NODES)).toEqual(['fac_demand'])
  })

  it('deduplicates repeated focusIds, preserving first-seen order', () => {
    expect(resolveDriverNodeIds(['out_mrr', 'fac_price', 'out_mrr'], NODES)).toEqual(['out_mrr', 'fac_price'])
  })

  it('returns [] for empty input and for a graph with no nodes', () => {
    expect(resolveDriverNodeIds([], NODES)).toEqual([])
    expect(resolveDriverNodeIds(['fac_price'], [])).toEqual([])
  })
})

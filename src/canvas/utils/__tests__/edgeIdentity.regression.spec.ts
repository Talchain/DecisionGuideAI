/**
 * C1 regression: fragile edge threshold consistency across edgeIdentity.ts
 *
 * Verifies that findFragileEdge and buildFragileEdgeLookup apply the same
 * 0.3 switch_probability threshold as isEdgeFragile in fragileEdgeMatch.ts.
 * An edge at 0.25 must be excluded everywhere.
 */

import { describe, it, expect } from 'vitest'
import type { Edge } from '@xyflow/react'
import type { MappedFragileEdge } from '../../../lib/mappers/types'
import { findFragileEdge, buildFragileEdgeLookup } from '../edgeIdentity'

function makeEdge(id: string, source: string, target: string): Edge {
  return { id, source, target, type: 'default' } as Edge
}

function makeFragile(
  edgeId: string,
  fromId: string,
  toId: string,
  switchProbability: number,
): MappedFragileEdge {
  return {
    edgeId,
    fromId,
    toId,
    fromLabel: undefined,
    toLabel: undefined,
    switchProbability,
    alternativeWinnerId: undefined,
    alternativeWinnerLabel: undefined,
  }
}

describe('findFragileEdge — C1 threshold consistency', () => {
  it('returns undefined for edge with switch_probability=0.25 (below threshold)', () => {
    const edge = makeEdge('e1', 'a', 'b')
    const fragile = [makeFragile('e1', 'a', 'b', 0.25)]
    expect(findFragileEdge(edge, fragile)).toBeUndefined()
  })

  it('returns the entry for edge with switch_probability=0.35 (above threshold)', () => {
    const edge = makeEdge('e1', 'a', 'b')
    const fragile = [makeFragile('e1', 'a', 'b', 0.35)]
    expect(findFragileEdge(edge, fragile)).toBeDefined()
  })

  it('returns undefined for edge with switch_probability=0.30 (at threshold, <=)', () => {
    const edge = makeEdge('e1', 'a', 'b')
    const fragile = [makeFragile('e1', 'a', 'b', 0.30)]
    expect(findFragileEdge(edge, fragile)).toBeUndefined()
  })

  it('matches by source/target fallback above threshold', () => {
    const edge = makeEdge('rf-5', 'fac_a', 'out_b')
    const fragile = [makeFragile('canonical-id', 'fac_a', 'out_b', 0.42)]
    expect(findFragileEdge(edge, fragile)).toBeDefined()
  })
})

describe('buildFragileEdgeLookup — C1 threshold consistency', () => {
  it('excludes edges below 0.3 threshold from lookup', () => {
    const edges = [makeEdge('e1', 'a', 'b'), makeEdge('e2', 'c', 'd')]
    const fragile = [
      makeFragile('e1', 'a', 'b', 0.25), // below threshold
      makeFragile('e2', 'c', 'd', 0.42), // above threshold
    ]
    const lookup = buildFragileEdgeLookup(edges, fragile)
    expect(lookup.has('e1')).toBe(false) // must be excluded
    expect(lookup.has('e2')).toBe(true)  // must be included
  })

  it('returns empty map when all edges below threshold', () => {
    const edges = [makeEdge('e1', 'a', 'b')]
    const fragile = [makeFragile('e1', 'a', 'b', 0.10)]
    const lookup = buildFragileEdgeLookup(edges, fragile)
    expect(lookup.size).toBe(0)
  })
})

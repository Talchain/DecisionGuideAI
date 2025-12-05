import { describe, it, expect } from 'vitest'
import {
  graphToV1Request,
  validateGraphLimits,
  computeClientHash,
  toCanonicalRun,
  type ReactFlowGraph,
} from '../mapper'
import { V1_LIMITS } from '../types'

describe('graphToV1Request - v1.2 Node Fields', () => {
  it('preserves kind field when present', () => {
    const graph: ReactFlowGraph = {
      nodes: [
        { id: 'n1', data: { label: 'Test', kind: 'decision' } },
        { id: 'n2', data: { label: 'Outcome', kind: 'outcome' } },
      ],
      edges: [],
    }

    const request = graphToV1Request(graph)
    expect(request.graph.nodes[0].kind).toBe('decision')
    expect(request.graph.nodes[1].kind).toBe('outcome')
  })

  it('preserves prior field when present (clamped to 0-1)', () => {
    const graph: ReactFlowGraph = {
      nodes: [
        { id: 'n1', data: { label: 'Test', prior: 0.75 } },
        { id: 'n2', data: { label: 'Invalid', prior: 1.5 } }, // Should clamp to 1
        { id: 'n3', data: { label: 'Negative', prior: -0.5 } }, // Should clamp to 0
      ],
      edges: [],
    }

    const request = graphToV1Request(graph)
    expect(request.graph.nodes[0].prior).toBe(0.75)
    expect(request.graph.nodes[1].prior).toBe(1.0)
    expect(request.graph.nodes[2].prior).toBe(0.0)
  })

  it('preserves utility field when present (clamped to -1..+1)', () => {
    const graph: ReactFlowGraph = {
      nodes: [
        { id: 'n1', data: { label: 'Positive', utility: 0.5 } },
        { id: 'n2', data: { label: 'Negative', utility: -0.3 } },
        { id: 'n3', data: { label: 'TooHigh', utility: 2.0 } }, // Should clamp to 1
        { id: 'n4', data: { label: 'TooLow', utility: -2.0 } }, // Should clamp to -1
      ],
      edges: [],
    }

    const request = graphToV1Request(graph)
    expect(request.graph.nodes[0].utility).toBe(0.5)
    expect(request.graph.nodes[1].utility).toBe(-0.3)
    expect(request.graph.nodes[2].utility).toBe(1.0)
    expect(request.graph.nodes[3].utility).toBe(-1.0)
  })

  it('preserves body field within limit', () => {
    const graph: ReactFlowGraph = {
      nodes: [
        { id: 'n1', data: { label: 'Short', body: 'Brief description' } },
        { id: 'n2', data: { label: 'Long', body: 'a'.repeat(1000) } },
      ],
      edges: [],
    }

    const request = graphToV1Request(graph)
    expect(request.graph.nodes[0].body).toBe('Brief description')
    expect(request.graph.nodes[1].body?.length).toBe(1000)
  })

  it('rejects body exceeding limit', () => {
    const longBody = 'a'.repeat(V1_LIMITS.MAX_BODY_LENGTH + 1)
    const graph: ReactFlowGraph = {
      nodes: [
        { id: 'n1', data: { label: 'TooLong', body: longBody } },
      ],
      edges: [],
    }

    expect(() => graphToV1Request(graph)).toThrow()
  })

  it('handles nodes without v1.2 fields gracefully', () => {
    const graph: ReactFlowGraph = {
      nodes: [
        { id: 'n1', data: { label: 'Minimal' } },
      ],
      edges: [],
    }

    const request = graphToV1Request(graph)
    expect(request.graph.nodes[0].kind).toBeUndefined()
    expect(request.graph.nodes[0].prior).toBeUndefined()
    expect(request.graph.nodes[0].utility).toBeUndefined()
  })
})

describe('graphToV1Request - v1.2 Edge Fields', () => {
  it('preserves belief field when present (clamped to 0-1)', () => {
    const graph: ReactFlowGraph = {
      nodes: [{ id: 'n1', data: { label: 'A' } }, { id: 'n2', data: { label: 'B' } }],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2', data: { belief: 0.85 } },
        { id: 'e2', source: 'n1', target: 'n2', data: { belief: 1.5 } }, // Should clamp to 1
      ],
    }

    const request = graphToV1Request(graph)
    expect(request.graph.edges[0].belief).toBe(0.85)
    expect(request.graph.edges[1].belief).toBe(1.0)
  })

  it('preserves provenance field with length limit', () => {
    const longProvenance = 'a'.repeat(200)
    const graph: ReactFlowGraph = {
      nodes: [{ id: 'n1', data: { label: 'A' } }, { id: 'n2', data: { label: 'B' } }],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2', data: { provenance: 'template' } },
        { id: 'e2', source: 'n1', target: 'n2', data: { provenance: longProvenance } },
      ],
    }

    const request = graphToV1Request(graph)
    expect(request.graph.edges[0].provenance).toBe('template')
    expect(request.graph.edges[1].provenance?.length).toBe(100)
  })

  it('preserves stable edge IDs', () => {
    const graph: ReactFlowGraph = {
      nodes: [{ id: 'n1', data: { label: 'A' } }, { id: 'n2', data: { label: 'B' } }],
      edges: [
        { id: 'stable-edge-123', source: 'n1', target: 'n2', data: {} }, // No confidence to avoid validation
      ],
    }

    const request = graphToV1Request(graph)
    expect(request.graph.edges[0].id).toBe('stable-edge-123')
  })

  it('handles edges without v1.2 fields gracefully', () => {
    const graph: ReactFlowGraph = {
      nodes: [{ id: 'n1', data: { label: 'A' } }, { id: 'n2', data: { label: 'B' } }],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2', data: {} },
      ],
    }

    const request = graphToV1Request(graph)
    expect(request.graph.edges[0].belief).toBeUndefined()
    expect(request.graph.edges[0].provenance).toBeUndefined()
  })
})

describe('validateGraphLimits - v1.2 Enhancements', () => {
  it('validates body length limit', () => {
    const longBody = 'a'.repeat(V1_LIMITS.MAX_BODY_LENGTH + 1)
    const graph: ReactFlowGraph = {
      nodes: [
        { id: 'n1', data: { label: 'Test', body: longBody } },
      ],
      edges: [],
    }

    const error = validateGraphLimits(graph)
    expect(error).not.toBeNull()
    expect(error?.code).toBe('BAD_INPUT')
    expect(error?.field).toBe('body')
    expect(error?.max).toBe(V1_LIMITS.MAX_BODY_LENGTH)
  })

  it('validates outgoing probability totals (within ±1% tolerance)', () => {
    const graph: ReactFlowGraph = {
      nodes: [
        { id: 'n1', data: { label: 'Decision' } },
        { id: 'n2', data: { label: 'Option A' } },
        { id: 'n3', data: { label: 'Option B' } },
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2', data: { confidence: 0.40 } },
        { id: 'e2', source: 'n1', target: 'n3', data: { confidence: 0.60 } },
      ],
    }

    const error = validateGraphLimits(graph)
    expect(error).toBeNull() // Should pass: 40% + 60% = 100%
  })

  it('rejects outgoing probabilities that do not sum to 100% ±1%', () => {
    const graph: ReactFlowGraph = {
      nodes: [
        { id: 'n1', data: { label: 'Decision' } },
        { id: 'n2', data: { label: 'Option A' } },
        { id: 'n3', data: { label: 'Option B' } },
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2', data: { confidence: 0.30 } },
        { id: 'e2', source: 'n1', target: 'n3', data: { confidence: 0.60 } },
      ],
    }

    const error = validateGraphLimits(graph)
    expect(error).not.toBeNull()
    expect(error?.code).toBe('BAD_INPUT')
    expect(error?.field).toBe('confidence')
    expect(error?.message).toContain('90.0%') // Should show actual total
    expect(error?.message).toContain('100% ±1%')
  })

  it('accepts probabilities within ±1% tolerance', () => {
    const graph: ReactFlowGraph = {
      nodes: [
        { id: 'n1', data: { label: 'Decision' } },
        { id: 'n2', data: { label: 'Option A' } },
        { id: 'n3', data: { label: 'Option B' } },
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2', data: { confidence: 0.495 } },
        { id: 'e2', source: 'n1', target: 'n3', data: { confidence: 0.500 } },
      ],
    }

    const error = validateGraphLimits(graph)
    expect(error).toBeNull() // Should pass: 49.5% + 50% = 99.5% (within ±1%)
  })

  it('normalizes percentage values (> 1) before validation', () => {
    const graph: ReactFlowGraph = {
      nodes: [
        { id: 'n1', data: { label: 'Decision' } },
        { id: 'n2', data: { label: 'Option A' } },
        { id: 'n3', data: { label: 'Option B' } },
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2', data: { confidence: 40 } }, // Percentage format
        { id: 'e2', source: 'n1', target: 'n3', data: { confidence: 60 } },
      ],
    }

    const error = validateGraphLimits(graph)
    expect(error).toBeNull() // Should pass after normalization: 40% + 60% = 100%
  })
})

describe('computeClientHash - Determinism', () => {
  it('produces same hash for identical graphs', () => {
    const graph: ReactFlowGraph = {
      nodes: [
        { id: 'n1', data: { label: 'Test', body: 'Description' } },
        { id: 'n2', data: { label: 'Another' } },
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2', data: { confidence: 0.8, weight: 0.5 } },
      ],
    }

    const hash1 = computeClientHash(graph, 1337)
    const hash2 = computeClientHash(graph, 1337)

    expect(hash1).toBe(hash2)
  })

  it('produces different hash when body changes', () => {
    const graph1: ReactFlowGraph = {
      nodes: [{ id: 'n1', data: { label: 'Test', body: 'Original' } }],
      edges: [],
    }

    const graph2: ReactFlowGraph = {
      nodes: [{ id: 'n1', data: { label: 'Test', body: 'Modified' } }],
      edges: [],
    }

    const hash1 = computeClientHash(graph1, 1337)
    const hash2 = computeClientHash(graph2, 1337)

    expect(hash1).not.toBe(hash2)
  })

  it('produces different hash when weight changes', () => {
    const graph1: ReactFlowGraph = {
      nodes: [{ id: 'n1', data: { label: 'A' } }, { id: 'n2', data: { label: 'B' } }],
      edges: [{ id: 'e1', source: 'n1', target: 'n2', data: { weight: 0.5 } }],
    }

    const graph2: ReactFlowGraph = {
      nodes: [{ id: 'n1', data: { label: 'A' } }, { id: 'n2', data: { label: 'B' } }],
      edges: [{ id: 'e1', source: 'n1', target: 'n2', data: { weight: 0.8 } }],
    }

    const hash1 = computeClientHash(graph1, 1337)
    const hash2 = computeClientHash(graph2, 1337)

    expect(hash1).not.toBe(hash2)
  })

  it('produces different hash when seed changes', () => {
    const graph: ReactFlowGraph = {
      nodes: [{ id: 'n1', data: { label: 'Test' } }],
      edges: [],
    }

    const hash1 = computeClientHash(graph, 1337)
    const hash2 = computeClientHash(graph, 9999)

    expect(hash1).not.toBe(hash2)
  })

  it('produces consistent hash regardless of node order', () => {
    const graph1: ReactFlowGraph = {
      nodes: [
        { id: 'n1', data: { label: 'A' } },
        { id: 'n2', data: { label: 'B' } },
      ],
      edges: [],
    }

    const graph2: ReactFlowGraph = {
      nodes: [
        { id: 'n2', data: { label: 'B' } },
        { id: 'n1', data: { label: 'A' } },
      ],
      edges: [],
    }

    const hash1 = computeClientHash(graph1, 1337)
    const hash2 = computeClientHash(graph2, 1337)

    expect(hash1).toBe(hash2) // Should be same after sorting
  })

  it('produces consistent hash regardless of edge order', () => {
    const graph1: ReactFlowGraph = {
      nodes: [
        { id: 'n1', data: { label: 'A' } },
        { id: 'n2', data: { label: 'B' } },
        { id: 'n3', data: { label: 'C' } },
      ],
      edges: [
        { id: 'e1', source: 'n1', target: 'n2', data: { confidence: 0.5 } },
        { id: 'e2', source: 'n2', target: 'n3', data: { confidence: 0.8 } },
      ],
    }

    const graph2: ReactFlowGraph = {
      nodes: [
        { id: 'n1', data: { label: 'A' } },
        { id: 'n2', data: { label: 'B' } },
        { id: 'n3', data: { label: 'C' } },
      ],
      edges: [
        { id: 'e2', source: 'n2', target: 'n3', data: { confidence: 0.8 } },
        { id: 'e1', source: 'n1', target: 'n2', data: { confidence: 0.5 } },
      ],
    }

    const hash1 = computeClientHash(graph1, 1337)
    const hash2 = computeClientHash(graph2, 1337)

    expect(hash1).toBe(hash2) // Should be same after sorting
  })
})

describe('toCanonicalRun - v1.2 Response Normalization', () => {
  it('normalizes v1.2 response format with result.summary.*', () => {
    const response = {
      result: {
        summary: {
          p10: 1000,
          p50: 5000,
          p90: 10000,
        },
        response_hash: 'abc123',
      },
    }

    const canonical = toCanonicalRun(response)

    expect(canonical.responseHash).toBe('abc123')
    expect(canonical.bands.p10).toBe(1000)
    expect(canonical.bands.p50).toBe(5000)
    expect(canonical.bands.p90).toBe(10000)
  })

  it('falls back to legacy results.*.outcome format', () => {
    const response = {
      results: {
        conservative: { outcome: 1000 },
        most_likely: { outcome: 5000 },
        optimistic: { outcome: 10000 },
      },
      model_card: {
        response_hash: 'legacy123',
      },
    }

    const canonical = toCanonicalRun(response)

    expect(canonical.responseHash).toBe('legacy123')
    expect(canonical.bands.p10).toBe(1000)
    expect(canonical.bands.p50).toBe(5000)
    expect(canonical.bands.p90).toBe(10000)
  })

  it('prefers v1.2 format over legacy when both present', () => {
    const response = {
      result: {
        summary: {
          p10: 2000,
          p50: 6000,
          p90: 12000,
        },
        response_hash: 'v1.2-hash',
      },
      results: {
        conservative: { outcome: 1000 },
        most_likely: { outcome: 5000 },
        optimistic: { outcome: 10000 },
      },
      model_card: {
        response_hash: 'legacy-hash',
      },
    }

    const canonical = toCanonicalRun(response)

    expect(canonical.responseHash).toBe('v1.2-hash')
    expect(canonical.bands.p10).toBe(2000)
    expect(canonical.bands.p50).toBe(6000)
    expect(canonical.bands.p90).toBe(12000)
  })

  it('returns null for missing bands', () => {
    const response = {
      result: {
        response_hash: 'partial123',
      },
    }

    const canonical = toCanonicalRun(response)

    expect(canonical.responseHash).toBe('partial123')
    expect(canonical.bands.p10).toBeNull()
    expect(canonical.bands.p50).toBeNull()
    expect(canonical.bands.p90).toBeNull()
  })

  it('extracts confidence when present', () => {
    const response = {
      result: {
        summary: { p50: 5000 },
        response_hash: 'conf123',
      },
      confidence: {
        level: 'high',
        reason: 'Strong data support',
        score: 0.85,
      },
    }

    const canonical = toCanonicalRun(response)

    expect(canonical.confidence).toEqual({
      level: 'high',
      reason: 'Strong data support',
      score: 0.85,
    })
  })

  it('falls back to "why" field for confidence reason', () => {
    const response = {
      result: {
        summary: { p50: 5000 },
        response_hash: 'why123',
      },
      confidence: {
        level: 'medium',
        why: 'Legacy reason field',
        score: 0.6,
      },
    }

    const canonical = toCanonicalRun(response)

    expect(canonical.confidence?.reason).toBe('Legacy reason field')
  })

  it('extracts critique when present', () => {
    const response = {
      result: {
        summary: { p50: 5000 },
        response_hash: 'critique123',
      },
      critique: [
        { severity: 'INFO', message: 'Graph is well-formed' },
        { severity: 'WARNING', message: 'Low confidence on edge E1' },
        { severity: 'BLOCKER', message: 'Cycle detected in graph' },
      ],
    }

    const canonical = toCanonicalRun(response)

    expect(canonical.critique).toHaveLength(3)
    expect(canonical.critique?.[0]).toMatchObject({ severity: 'INFO', message: 'Graph is well-formed' })
    expect(canonical.critique?.[1]).toMatchObject({ severity: 'WARNING', message: 'Low confidence on edge E1' })
    expect(canonical.critique?.[2]).toMatchObject({ severity: 'BLOCKER', message: 'Cycle detected in graph' })
  })

  it('extracts v1.1 critique fields (node_id, code, suggested_fix, auto_fixable)', () => {
    const response = {
      result: {
        summary: { p50: 5000 },
        response_hash: 'critique-v11',
      },
      critique: [
        {
          severity: 'BLOCKER',
          message: 'Probability sum invalid',
          code: 'PROBABILITY_SUM_INVALID',
          node_id: 'goal_revenue',
          suggested_fix: 'Normalize edge probabilities',
          auto_fixable: true,
        },
        {
          severity: 'WARNING',
          message: 'Orphan nodes detected',
          code: 'ORPHAN_NODES',
          edge_id: 'edge_orphan_1',
        },
      ],
    }

    const canonical = toCanonicalRun(response)

    expect(canonical.critique).toHaveLength(2)
    expect(canonical.critique?.[0]).toEqual({
      severity: 'BLOCKER',
      message: 'Probability sum invalid',
      code: 'PROBABILITY_SUM_INVALID',
      node_id: 'goal_revenue',
      edge_id: undefined,
      suggested_fix: 'Normalize edge probabilities',
      auto_fixable: true,
    })
    expect(canonical.critique?.[1]).toEqual({
      severity: 'WARNING',
      message: 'Orphan nodes detected',
      code: 'ORPHAN_NODES',
      node_id: undefined,
      edge_id: 'edge_orphan_1',
      suggested_fix: undefined,
      auto_fixable: undefined,
    })
  })

  it('handles empty critique array gracefully', () => {
    const response = {
      result: {
        summary: { p50: 5000 },
        response_hash: 'empty-critique',
      },
      critique: [],
    }

    const canonical = toCanonicalRun(response)

    expect(canonical.critique).toBeUndefined()
  })

  it('returns empty string for missing response_hash', () => {
    const response = {
      result: {
        summary: { p50: 5000 },
      },
    }

    const canonical = toCanonicalRun(response)

    expect(canonical.responseHash).toBe('')
  })
})

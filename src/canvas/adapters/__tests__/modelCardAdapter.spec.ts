/**
 * Contract-style tests for modelCardAdapter — data mapping + formatting.
 * Phase 2A: Model Card Lite.
 */

import { describe, it, expect } from 'vitest'
import {
  fieldPathToLabel,
  formatRepair,
  formatRepairs,
  countNodesByKind,
  formatNodeCounts,
  deriveConfidenceLabel,
  selectModelCardData,
  selectModelReceiptData,
} from '../modelCardAdapter'

// ---------------------------------------------------------------------------
// § fieldPathToLabel
// ---------------------------------------------------------------------------

describe('fieldPathToLabel', () => {
  it('converts edge field_path to human-readable label', () => {
    expect(fieldPathToLabel('edges[3].exists_probability')).toBe('Existence probability of relationship')
  })

  it('converts node field_path with label from nodes array', () => {
    const nodes = [
      { id: 'n0', data: { label: 'Revenue' } },
      { id: 'n1', data: { label: 'Cost' } },
    ] as any[]
    expect(fieldPathToLabel('nodes[1].baseline', nodes)).toBe('Baseline of "Cost"')
  })

  it('returns generic label for node when label unavailable', () => {
    expect(fieldPathToLabel('nodes[5].std')).toBe('Standard deviation of node')
  })

  it('returns "Model parameter" for undefined field_path', () => {
    expect(fieldPathToLabel(undefined)).toBe('Model parameter')
  })

  it('humanises unknown paths', () => {
    expect(fieldPathToLabel('some.nested.path')).toBe('some › nested › path')
  })
})

// ---------------------------------------------------------------------------
// § formatRepair / formatRepairs
// ---------------------------------------------------------------------------

describe('formatRepair', () => {
  it('formats a DEFAULT_EXISTS_PROB repair', () => {
    const result = formatRepair({
      code: 'DEFAULT_EXISTS_PROB',
      field_path: 'edges[0].exists_probability',
      before: undefined,
      after: 0.7,
      reason: 'No value supplied',
    })
    expect(result.action).toBe('Defaulted')
    expect(result.label).toBe('Existence probability of relationship')
    expect(result.after).toBe('0.7')
    expect(result.reason).toBe('No value supplied')
  })

  it('falls back to type when code is unknown', () => {
    const result = formatRepair({ type: 'edge_parameter' })
    expect(result.action).toBe('edge_parameter')
  })

  it('falls back to "Adjusted" when both code and type are missing', () => {
    const result = formatRepair({})
    expect(result.action).toBe('Adjusted')
  })
})

describe('formatRepairs', () => {
  it('returns empty array for null input', () => {
    expect(formatRepairs(null)).toEqual([])
    expect(formatRepairs(undefined)).toEqual([])
    expect(formatRepairs([])).toEqual([])
  })

  it('formats multiple repairs', () => {
    const result = formatRepairs([
      { code: 'FLOOR_STD', field_path: 'edges[0].strength_std', before: 0, after: 0.01 },
      { code: 'DEFAULT_BASELINE', field_path: 'nodes[0].baseline' },
    ])
    expect(result).toHaveLength(2)
    expect(result[0].action).toBe('Floored')
    expect(result[1].action).toBe('Defaulted')
  })
})

// ---------------------------------------------------------------------------
// § countNodesByKind / formatNodeCounts
// ---------------------------------------------------------------------------

describe('countNodesByKind', () => {
  it('counts nodes by kind', () => {
    const nodes = [
      { id: '1', data: { kind: 'factor' } },
      { id: '2', data: { kind: 'factor' } },
      { id: '3', data: { kind: 'option' } },
      { id: '4', data: { kind: 'goal' } },
      { id: '5', data: { kind: 'risk' } },
    ] as any[]
    const counts = countNodesByKind(nodes)
    expect(counts).toEqual({ factor: 2, option: 1, goal: 1, decision: 0, risk: 1, outcome: 0 })
  })

  it('maps "intervention" to option', () => {
    const nodes = [{ id: '1', data: { kind: 'intervention' } }] as any[]
    expect(countNodesByKind(nodes).option).toBe(1)
  })

  it('returns zeros for empty array', () => {
    const counts = countNodesByKind([])
    expect(counts).toEqual({ factor: 0, option: 0, goal: 0, decision: 0, risk: 0, outcome: 0 })
  })
})

describe('formatNodeCounts', () => {
  it('formats counts as a comma-separated string', () => {
    const result = formatNodeCounts({ factor: 3, option: 2, goal: 1, decision: 0, risk: 0, outcome: 0 })
    expect(result).toBe('3 factors, 2 options, 1 goal')
  })

  it('returns "0 nodes" for all zeros', () => {
    expect(formatNodeCounts({ factor: 0, option: 0, goal: 0, decision: 0, risk: 0, outcome: 0 })).toBe('0 nodes')
  })

  it('uses singular form for count of 1', () => {
    expect(formatNodeCounts({ factor: 1, option: 0, goal: 0, decision: 0, risk: 0, outcome: 0 })).toBe('1 factor')
  })
})

// ---------------------------------------------------------------------------
// § deriveConfidenceLabel
// ---------------------------------------------------------------------------

describe('deriveConfidenceLabel', () => {
  it('returns "Robust" for stability >= 0.85', () => {
    expect(deriveConfidenceLabel({ recommendation_stability: 0.90 })).toBe('Robust')
  })

  it('returns "Moderate" for stability >= 0.70', () => {
    expect(deriveConfidenceLabel({ recommendation_stability: 0.75 })).toBe('Moderate')
  })

  it('returns "Low" for stability < 0.70', () => {
    expect(deriveConfidenceLabel({ recommendation_stability: 0.55 })).toBe('Low')
  })

  it('returns null for null robustness', () => {
    expect(deriveConfidenceLabel(null)).toBeNull()
    expect(deriveConfidenceLabel(undefined)).toBeNull()
  })

  it('falls back to ranking_stability when recommendation_stability is missing', () => {
    expect(deriveConfidenceLabel({ ranking_stability: 0.9 })).toBe('Robust')
  })
})

// ---------------------------------------------------------------------------
// § selectModelCardData (contract test)
// ---------------------------------------------------------------------------

describe('selectModelCardData', () => {
  const baseStore = {
    nodes: [
      { id: '1', data: { kind: 'factor', label: 'Revenue' } },
      { id: '2', data: { kind: 'goal', label: 'Profit' } },
    ] as any[],
    edges: [{ id: 'e1', source: '1', target: '2' }] as any[],
    currentGraphHash: 'abc12345def',
    lastAnalysisSeed: null as number | null,
    lastQualityMode: null as string | null,
    repairsApplied: null as any,
    results: { status: 'idle' as string },
    hasCompletedFirstRun: false,
  }

  it('produces correct shape pre-analysis', () => {
    const data = selectModelCardData(baseStore)
    expect(data.graphHash).toBe('abc12345def')
    expect(data.seed).toBeNull()
    expect(data.qualityMode).toBeNull()
    expect(data.hasResults).toBe(false)
    expect(data.nodeCounts.factor).toBe(1)
    expect(data.nodeCounts.goal).toBe(1)
    expect(data.edgeCount).toBe(1)
    expect(data.confidenceLabel).toBeNull()
    expect(data.repairsApplied).toEqual([])
  })

  it('produces correct shape post-analysis', () => {
    const data = selectModelCardData({
      ...baseStore,
      lastAnalysisSeed: 42,
      lastQualityMode: 'deep',
      repairsApplied: [{ code: 'FLOOR_STD', field_path: 'edges[0].strength_std', before: 0, after: 0.01 }],
      results: { status: 'complete', report: { robustness: { recommendation_stability: 0.90 } } },
      hasCompletedFirstRun: true,
    })
    expect(data.seed).toBe(42)
    expect(data.qualityMode).toBe('deep')
    expect(data.hasResults).toBe(true)
    expect(data.confidenceLabel).toBe('Robust')
    expect(data.repairsApplied).toHaveLength(1)
    expect(data.repairsApplied[0].action).toBe('Floored')
  })

  it('returns null graphHash when currentGraphHash is undefined', () => {
    const data = selectModelCardData({ ...baseStore, currentGraphHash: undefined })
    expect(data.graphHash).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// § selectModelReceiptData (contract test)
// ---------------------------------------------------------------------------

describe('selectModelReceiptData', () => {
  it('returns null when no nodes exist', () => {
    const data = selectModelReceiptData({
      nodes: [],
      edges: [],
      ceeAnalysisReady: null,
      repairsApplied: null,
    })
    expect(data).toBeNull()
  })

  it('produces correct shape from store state', () => {
    const data = selectModelReceiptData({
      nodes: [
        { id: '1', data: { kind: 'factor', label: 'Revenue' } },
        { id: '2', data: { kind: 'factor', label: 'Cost', observedState: { value: 100 } } },
        { id: '3', data: { kind: 'goal', label: 'Profit' } },
        { id: '4', data: { kind: 'option', label: 'Option A' } },
      ] as any[],
      edges: [{ id: 'e1' }, { id: 'e2' }] as any[],
      ceeAnalysisReady: {
        status: 'ready',
        coaching_summary: 'The model looks good. Consider adding evidence.',
        model_critiques: [{ message: 'Missing time horizon' }],
      },
      repairsApplied: [{ code: 'FLOOR_STD', field_path: 'edges[0].strength_std' }],
    })

    expect(data).not.toBeNull()
    expect(data!.factorCount).toBe(2)
    expect(data!.edgeCount).toBe(2)
    expect(data!.optionCount).toBe(1)
    expect(data!.goalLabel).toBe('Profit')
    expect(data!.readiness).toBe('ready')
    expect(data!.topInsight).toBe('Missing time horizon')
    expect(data!.topEvidenceGap).toContain('Revenue')
    expect(data!.adjustments).toHaveLength(1)
  })

  it('uses coaching summary when no critiques', () => {
    const data = selectModelReceiptData({
      nodes: [{ id: '1', data: { kind: 'factor', label: 'A' } }] as any[],
      edges: [],
      ceeAnalysisReady: {
        status: 'incomplete',
        coaching_summary: 'First sentence. Second sentence.',
      },
      repairsApplied: null,
    })
    expect(data!.topInsight).toBe('First sentence.')
    expect(data!.readiness).toBe('incomplete')
  })
})

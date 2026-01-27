/**
 * V2 Response Mapper Tests (P0-UI Integration)
 *
 * Tests for mapping V2RunResponse to ReportV1 format.
 */

import { describe, it, expect } from 'vitest'
import { mapV2ResponseToReportV1, createErrorReport, detectComputedButEmpty, createEnrichmentFromV2Response } from '../responseMapper'
import type { V2RunResponse, V2Critique } from '../types'

// ============================================================================
// Test Fixtures
// ============================================================================

function makeSuccessResponse(overrides: Partial<V2RunResponse> = {}): V2RunResponse {
  return {
    analysis_status: 'computed',
    option_comparison_status: 'computed',
    robustness_status: 'computed',
    drivers_status: 'computed',
    // PLoT returns option_comparison (not options)
    option_comparison: [
      {
        option_id: 'opt1',
        option_label: 'Option 1',
        confidence_interval: [30, 70], // [low, high] tuple
      },
    ],
    critiques: [],
    drivers: [
      {
        node_id: 'driver1',
        label: 'Key Driver',
        contribution: 0.8,
        direction: 'positive',
      },
    ],
    // PLoT returns edge_sensitivity for robustness analysis
    edge_sensitivity: [
      {
        edge_id: 'edge1',
        from: 'a',
        to: 'b',
        elasticity: 0.5,
        importance_rank: 1,
        sensitivity_type: 'magnitude' as const,
        interpretation: 'Key impact',
      },
    ],
    // PLoT returns factor_sensitivity for drivers when drivers_status is computed
    factor_sensitivity: [
      {
        factor_id: 'factor1',
        elasticity: 0.5,
        importance_rank: 1,
      },
    ],
    // PLoT returns fragile_edges/robust_edges (not level/confidence)
    robustness: {
      fragile_edges: [],
      robust_edges: ['edge1', 'edge2', 'edge3'],
    },
    response_hash: 'abc123',
    meta: { seed_used: '42', n_samples: 1000, detail_level: 'deep', latency_ms: 100 },
    ...overrides,
  }
}

// ============================================================================
// mapV2ResponseToReportV1 Tests
// ============================================================================

describe('mapV2ResponseToReportV1', () => {
  it('maps basic response to ReportV1 format', () => {
    const v2Response = makeSuccessResponse()

    const report = mapV2ResponseToReportV1(v2Response, { seed: 42 })

    expect(report.schema).toBe('report.v1')
    expect(report.meta.seed).toBe(42)
    expect(report.meta.response_id).toBe('abc123')
  })

  it('maps primary option outcome to results', () => {
    const v2Response = makeSuccessResponse()

    const report = mapV2ResponseToReportV1(v2Response, { seed: 42 })

    expect(report.results.conservative).toBe(30) // p10
    expect(report.results.likely).toBe(50) // p50
    expect(report.results.optimistic).toBe(70) // p90
  })

  it('maps outcome bands', () => {
    const v2Response = makeSuccessResponse()

    const report = mapV2ResponseToReportV1(v2Response, { seed: 42, elapsed_ms: 1500 })

    expect(report.run?.bands).toEqual({
      p10: 30,
      p50: 50,
      p90: 70,
    })
    expect(report.meta.elapsed_ms).toBe(1500)
  })

  it('maps drivers to V1 format', () => {
    const v2Response = makeSuccessResponse({
      drivers: [
        { node_id: 'd1', label: 'Driver 1', contribution: 0.9, direction: 'positive' },
        { node_id: 'd2', label: 'Driver 2', contribution: 0.5, direction: 'negative' },
        { node_id: 'd3', label: 'Driver 3', contribution: 0.1, direction: 'positive' },
      ],
    })

    const report = mapV2ResponseToReportV1(v2Response, { seed: 42 })

    expect(report.drivers).toHaveLength(3)
    expect(report.drivers[0]).toEqual({
      label: 'Driver 1',
      polarity: 'up',
      strength: 'high', // 0.9 >= 0.7
    })
    expect(report.drivers[1]).toEqual({
      label: 'Driver 2',
      polarity: 'down',
      strength: 'medium', // 0.5 >= 0.3
    })
    expect(report.drivers[2]).toEqual({
      label: 'Driver 3',
      polarity: 'up',
      strength: 'low', // 0.1 < 0.3
    })
  })

  it('maps critiques to V1 format', () => {
    const v2Response = makeSuccessResponse({
      critiques: [
        {
          code: 'CYCLE_DETECTED',
          severity: 'blocker',
          message: 'Graph contains a cycle',
          suggestion: 'Remove edge X',
          affected_nodes: ['node1', 'node2'],
        },
        {
          code: 'LOW_CONFIDENCE',
          severity: 'warning',
          message: 'Low confidence on edge',
        },
        {
          code: 'INFO_NOTE',
          severity: 'info',
          message: 'Graph is well-formed',
        },
      ],
    })

    const report = mapV2ResponseToReportV1(v2Response, { seed: 42 })

    expect(report.run?.critique).toHaveLength(3)
    expect(report.run?.critique?.[0]).toMatchObject({
      code: 'CYCLE_DETECTED',
      severity: 'BLOCKER',
      message: 'Graph contains a cycle',
      suggested_fix: 'Remove edge X',
      node_id: 'node1', // First affected node
      source: 'isl',
    })
    expect(report.run?.critique?.[1].severity).toBe('WARNING')
    expect(report.run?.critique?.[2].severity).toBe('INFO')
  })

  it('maps robustness to confidence', () => {
    // 1 fragile, 2 robust = 2/3 = 66.7% robust ratio → 'medium' (0.3-0.7)
    const v2Response = makeSuccessResponse({
      robustness: { fragile_edges: ['weak-edge'], robust_edges: ['edge1', 'edge2'] },
    })

    const report = mapV2ResponseToReportV1(v2Response, { seed: 42 })

    expect(report.confidence).toEqual({
      level: 'medium',
      why: '1 fragile edges, 2 robust edges',
    })
  })

  it('handles missing robustness', () => {
    const v2Response = makeSuccessResponse({ robustness: undefined })

    const report = mapV2ResponseToReportV1(v2Response, { seed: 42 })

    expect(report.confidence).toEqual({
      level: 'medium', // Default
      why: 'Based on available data',
    })
  })

  it('maps all options to option_probabilities', () => {
    const v2Response = makeSuccessResponse({
      option_comparison: [
        { option_id: 'opt1', option_label: 'Option 1', confidence_interval: [30, 70] },
        { option_id: 'opt2', option_label: 'Option 2', confidence_interval: [45, 75] },
      ],
    })

    const report = mapV2ResponseToReportV1(v2Response, { seed: 42 })

    // goal_probability = midpoint of confidence_interval
    // expected and outcome contain distribution data
    expect(report.option_probabilities).toEqual({
      opt1: {
        goal_probability: 50, // (30+70)/2 = 50
        confidence: 0.5,
        win_probability: undefined,
        expected: 50, // Falls back to CI midpoint when no mean
        outcome: {
          mean: null, // No outcome.mean in input
          p10: 30, // CI low
          p50: null, // True median - null when not provided
          p90: 70, // CI high
        },
      },
      opt2: {
        goal_probability: 60, // (45+75)/2 = 60
        confidence: 0.5,
        win_probability: undefined,
        expected: 60, // Falls back to CI midpoint
        outcome: {
          mean: null,
          p10: 45,
          p50: null,
          p90: 75,
        },
      },
    })
  })

  it('extracts outcome distribution when provided (fixes 0% bug)', () => {
    // Test case: mean=0.038 but p50=0 (skewed distribution)
    // The UI should display mean (3.8%), not p50 (0%)
    const v2Response = makeSuccessResponse({
      option_comparison: [
        {
          option_id: 'opt1',
          option_label: 'Option 1',
          confidence_interval: [-0.05, 0.12] as [number, number],
          expected_outcome: 0.038,
          outcome: {
            mean: 0.038,
            p10: -0.05,
            p50: 0,
            p90: 0.12,
          },
        },
      ],
    })

    const report = mapV2ResponseToReportV1(v2Response, { seed: 42 })

    // Verify expected is extracted from mean (not p50)
    expect(report.option_probabilities.opt1.expected).toBe(0.038)

    // Verify outcome preserves true percentiles
    expect(report.option_probabilities.opt1.outcome).toEqual({
      mean: 0.038,
      p10: -0.05,
      p50: 0, // True median is 0 (semantically different from expected)
      p90: 0.12,
    })
  })

  it('separates expected (mean) from p50 (median) in skewed distributions', () => {
    // This test explicitly verifies that expected and p50 are kept separate
    const v2Response = makeSuccessResponse({
      option_comparison: [
        {
          option_id: 'skewed',
          option_label: 'Skewed Option',
          confidence_interval: [0, 0.5] as [number, number],
          expected_outcome: 0.15, // Mean is 15%
          outcome: {
            mean: 0.15,
            p10: 0,
            p50: 0.05, // Median is only 5% (positively skewed)
            p90: 0.5,
          },
        },
      ],
    })

    const report = mapV2ResponseToReportV1(v2Response, { seed: 42 })

    // expected = mean = 15%
    expect(report.option_probabilities.skewed.expected).toBe(0.15)
    // p50 (median) = 5% — kept separate, NOT used for expected
    expect(report.option_probabilities.skewed.outcome?.p50).toBe(0.05)
    // They are different values
    expect(report.option_probabilities.skewed.expected).not.toBe(
      report.option_probabilities.skewed.outcome?.p50
    )
  })

  it('extracts warnings from critiques', () => {
    const v2Response = makeSuccessResponse({
      critiques: [
        { code: 'BLOCKER', severity: 'blocker', message: 'Blocked' },
        { code: 'WARN1', severity: 'warning', message: 'Warning message' },
        { code: 'INFO1', severity: 'info', message: 'Info message' },
      ],
    })

    const report = mapV2ResponseToReportV1(v2Response, { seed: 42 })

    expect(report.warnings).toEqual(['Warning message', 'Info message'])
  })

  it('handles empty option_comparison array', () => {
    const v2Response = makeSuccessResponse({ option_comparison: [] })

    const report = mapV2ResponseToReportV1(v2Response, { seed: 42 })

    // P2 Fix: Returns null instead of fabricating 0 when no CI data available
    expect(report.results.conservative).toBeNull()
    expect(report.results.likely).toBeNull()
    expect(report.results.optimistic).toBeNull()
  })

  describe('drivers_payload creation (P0 Fix)', () => {
    it('creates drivers_payload from factor_sensitivity', () => {
      const v2Response = makeSuccessResponse({
        drivers: [], // No legacy drivers
        factor_sensitivity: [
          { factor_id: 'fac_market_risk', elasticity: 1.5, importance_rank: 1 },
          { factor_id: 'fac_cost', elasticity: 0.8, importance_rank: 2 },
          { factor_id: 'fac_time', elasticity: 0.3, importance_rank: 3 },
        ],
      })

      const report = mapV2ResponseToReportV1(v2Response, { seed: 42 })

      // Should create drivers_payload for gating logic
      expect(report.drivers_payload).toBeDefined()
      expect(report.drivers_payload?.status).toBe('ok')
      expect(report.drivers_payload?.informative).toBe(true)
      expect(report.drivers_payload?.drivers).toHaveLength(3)
      // Check labels are formatted from factor IDs
      expect(report.drivers_payload?.drivers?.[0].label).toBe('Market Risk')
    })

    it('creates drivers_payload from legacy drivers array', () => {
      const v2Response = makeSuccessResponse({
        drivers: [
          { node_id: 'd1', label: 'Driver A', contribution: 0.8, direction: 'positive' },
        ],
        factor_sensitivity: [], // No factor_sensitivity
      })

      const report = mapV2ResponseToReportV1(v2Response, { seed: 42 })

      // Should create drivers_payload from legacy drivers
      expect(report.drivers_payload).toBeDefined()
      expect(report.drivers_payload?.status).toBe('ok')
      expect(report.drivers_payload?.informative).toBe(true)
      expect(report.drivers_payload?.drivers?.[0].label).toBe('Driver A')
    })

    it('returns unavailable state when no factor_sensitivity or drivers', () => {
      const v2Response = makeSuccessResponse({
        drivers: [],
        factor_sensitivity: [],
        drivers_status: 'unavailable',
      })

      const report = mapV2ResponseToReportV1(v2Response, { seed: 42 })

      expect(report.drivers_payload).toBeDefined()
      expect(report.drivers_payload?.status).toBe('cannot_compute')
      expect(report.drivers_payload?.informative).toBe(false)
    })

    it('limits drivers_payload to 5 items', () => {
      const v2Response = makeSuccessResponse({
        drivers: [],
        factor_sensitivity: [
          { factor_id: 'fac_1', elasticity: 1.0 },
          { factor_id: 'fac_2', elasticity: 0.9 },
          { factor_id: 'fac_3', elasticity: 0.8 },
          { factor_id: 'fac_4', elasticity: 0.7 },
          { factor_id: 'fac_5', elasticity: 0.6 },
          { factor_id: 'fac_6', elasticity: 0.5 },
          { factor_id: 'fac_7', elasticity: 0.4 },
        ],
      })

      const report = mapV2ResponseToReportV1(v2Response, { seed: 42 })

      expect(report.drivers_payload?.drivers).toHaveLength(5)
    })
  })
})

// ============================================================================
// createErrorReport Tests
// ============================================================================

describe('createErrorReport', () => {
  it('creates error report with status reason', () => {
    const critiques: V2Critique[] = [
      { code: 'ERR1', severity: 'blocker', message: 'Critical error' },
    ]

    const report = createErrorReport('Analysis failed due to validation', critiques, { seed: 42 })

    expect(report.schema).toBe('report.v1')
    expect(report.meta.seed).toBe(42)
    expect(report.meta.response_id).toBe('error')
    expect(report.confidence.level).toBe('low')
    expect(report.confidence.why).toBe('Analysis failed due to validation')
  })

  it('includes critiques in run.critique', () => {
    const critiques: V2Critique[] = [
      { code: 'ERR1', severity: 'blocker', message: 'Error 1', suggestion: 'Fix it' },
      { code: 'ERR2', severity: 'warning', message: 'Error 2' },
    ]

    const report = createErrorReport('Failed', critiques, { seed: 42 })

    expect(report.run?.critique).toHaveLength(2)
    expect(report.run?.critique?.[0]).toMatchObject({
      code: 'ERR1',
      severity: 'BLOCKER',
      message: 'Error 1',
      suggested_fix: 'Fix it',
    })
  })

  it('sets zero values for results', () => {
    const report = createErrorReport('Failed', [], { seed: 42 })

    expect(report.results).toEqual({
      conservative: 0,
      likely: 0,
      optimistic: 0,
    })
    expect(report.drivers).toEqual([])
  })
})

// ============================================================================
// detectComputedButEmpty Tests
// ============================================================================

// ============================================================================
// mapDriversFromResponse Tests - Factor Sensitivity with node_id alias
// ============================================================================

describe('mapDriversFromResponse (factor_sensitivity)', () => {
  it('maps factor_sensitivity when edge_sensitivity is empty', () => {
    const v2Response = makeSuccessResponse({
      drivers: [], // Clear default drivers
      edge_sensitivity: [],
      factor_sensitivity: [
        { factor_id: 'factor1', elasticity: 1.2, direction: 'positive' },
        { factor_id: 'factor2', elasticity: -0.4, direction: 'negative' },
      ],
    })

    const report = mapV2ResponseToReportV1(v2Response, { seed: 42 })

    expect(report.drivers).toHaveLength(2)
    expect(report.drivers[0].polarity).toBe('up')
    expect(report.drivers[0].strength).toBe('high') // 1.2 >= 1.0
    expect(report.drivers[1].polarity).toBe('down')
    expect(report.drivers[1].strength).toBe('low') // abs(-0.4) < 0.5
  })

  it('supports node_id as alias for factor_id', () => {
    const v2Response = makeSuccessResponse({
      drivers: [], // Clear default drivers
      edge_sensitivity: [],
      factor_sensitivity: [
        { node_id: 'market_size', elasticity: 0.6 },
        { node_id: 'competitor_count', elasticity: -0.3 },
      ],
    })

    const report = mapV2ResponseToReportV1(v2Response, { seed: 42 })

    expect(report.drivers).toHaveLength(2)
    // formatNodeName produces Title Case
    expect(report.drivers[0].label).toBe('Market Size')
    expect(report.drivers[1].label).toBe('Competitor Count')
  })

  it('prefers factor_id over node_id when both present', () => {
    const v2Response = makeSuccessResponse({
      drivers: [], // Clear default drivers
      edge_sensitivity: [],
      factor_sensitivity: [
        { factor_id: 'primary_label', node_id: 'fallback_label', elasticity: 0.5 },
      ],
    })

    const report = mapV2ResponseToReportV1(v2Response, { seed: 42 })

    expect(report.drivers).toHaveLength(1)
    // Uses factor_id (formatNodeName produces Title Case)
    expect(report.drivers[0].label).toBe('Primary Label')
  })

  it('orders by elasticity magnitude (highest first)', () => {
    const v2Response = makeSuccessResponse({
      drivers: [], // Clear default drivers
      edge_sensitivity: [],
      factor_sensitivity: [
        { factor_id: 'low_factor', elasticity: 0.1 },
        { factor_id: 'high_factor', elasticity: 0.9 },
        { factor_id: 'medium_factor', elasticity: -0.5 },
      ],
    })

    const report = mapV2ResponseToReportV1(v2Response, { seed: 42 })

    expect(report.drivers[0].label).toBe('High Factor') // 0.9
    expect(report.drivers[1].label).toBe('Medium Factor') // abs(-0.5) = 0.5
    expect(report.drivers[2].label).toBe('Low Factor') // 0.1
  })

  it('uses importance_rank when available', () => {
    const v2Response = makeSuccessResponse({
      drivers: [], // Clear default drivers
      edge_sensitivity: [],
      factor_sensitivity: [
        { factor_id: 'third_item', elasticity: 0.9, importance_rank: 3 },
        { factor_id: 'first_item', elasticity: 0.2, importance_rank: 1 },
        { factor_id: 'second_item', elasticity: 0.5, importance_rank: 2 },
      ],
    })

    const report = mapV2ResponseToReportV1(v2Response, { seed: 42 })

    expect(report.drivers[0].label).toBe('First Item') // importance_rank: 1
    expect(report.drivers[1].label).toBe('Second Item') // importance_rank: 2
    expect(report.drivers[2].label).toBe('Third Item') // importance_rank: 3
  })

  it('returns empty array when both edge_sensitivity and factor_sensitivity are empty', () => {
    const v2Response = makeSuccessResponse({
      drivers: [], // Clear default drivers
      edge_sensitivity: [],
      factor_sensitivity: [],
    })

    const report = mapV2ResponseToReportV1(v2Response, { seed: 42 })

    expect(report.drivers).toHaveLength(0)
  })
})

// ============================================================================
// detectComputedButEmpty Tests
// ============================================================================

describe('detectComputedButEmpty', () => {
  it('returns empty array when no anomalies detected', () => {
    const v2Response = makeSuccessResponse()
    const anomalies = detectComputedButEmpty(v2Response)
    expect(anomalies).toEqual([])
  })

  it('detects empty option_comparison when status is computed', () => {
    const v2Response = makeSuccessResponse({
      option_comparison_status: 'computed',
      option_comparison: [],
    })
    const anomalies = detectComputedButEmpty(v2Response)
    expect(anomalies).toHaveLength(1)
    expect(anomalies[0]).toMatchObject({
      field: 'option_comparison',
      status: 'computed',
    })
  })

  it('detects empty robustness when status is computed', () => {
    const v2Response = makeSuccessResponse({
      robustness_status: 'computed',
      robustness: { fragile_edges: [], robust_edges: [] },
    })
    const anomalies = detectComputedButEmpty(v2Response)
    expect(anomalies).toHaveLength(1)
    expect(anomalies[0]).toMatchObject({
      field: 'robustness',
      status: 'computed',
    })
  })

  it('detects empty drivers when factor_sensitivity is empty', () => {
    // Anomaly fires when drivers_status is computed but factor_sensitivity is empty
    // (edge_sensitivity is not checked - it's for robustness, not drivers)
    const v2Response = makeSuccessResponse({
      drivers_status: 'computed',
      edge_sensitivity: [],
      factor_sensitivity: [],
    })
    const anomalies = detectComputedButEmpty(v2Response)
    expect(anomalies).toHaveLength(1)
    expect(anomalies[0]).toMatchObject({
      field: 'factor_sensitivity',
      status: 'computed',
    })
    expect(anomalies[0].message).toContain('factor_sensitivity array is empty')
  })

  it('does NOT fire anomaly when factor_sensitivity has data', () => {
    const v2Response = makeSuccessResponse({
      drivers_status: 'computed',
      edge_sensitivity: [], // Not checked for drivers anomaly
      factor_sensitivity: [{ factor_id: 'f1', elasticity: 0.5, importance_rank: 1 }],
    })
    const anomalies = detectComputedButEmpty(v2Response)
    const driverAnomalies = anomalies.filter(a => a.field === 'factor_sensitivity')
    expect(driverAnomalies).toHaveLength(0)
  })

  it('does not flag when status is unavailable', () => {
    const v2Response = makeSuccessResponse({
      option_comparison_status: 'unavailable',
      option_comparison: [],
      robustness_status: 'unavailable',
      robustness: undefined,
      drivers_status: 'unavailable',
      edge_sensitivity: [],
    })
    const anomalies = detectComputedButEmpty(v2Response)
    expect(anomalies).toEqual([])
  })

  it('detects multiple anomalies at once', () => {
    const v2Response = makeSuccessResponse({
      option_comparison_status: 'computed',
      option_comparison: [],
      robustness_status: 'computed',
      robustness: { fragile_edges: [], robust_edges: [] },
      drivers_status: 'computed',
      edge_sensitivity: [],
      factor_sensitivity: [],
    })
    const anomalies = detectComputedButEmpty(v2Response)
    expect(anomalies).toHaveLength(3)
    expect(anomalies.map(a => a.field)).toContain('option_comparison')
    expect(anomalies.map(a => a.field)).toContain('robustness')
    expect(anomalies.map(a => a.field)).toContain('factor_sensitivity')
  })

  it('adds synthetic warnings to report when anomalies detected', () => {
    const v2Response = makeSuccessResponse({
      drivers_status: 'computed',
      edge_sensitivity: [],
      factor_sensitivity: [],
    })
    const report = mapV2ResponseToReportV1(v2Response, { seed: 42 })

    // Should have a warning about empty factor_sensitivity
    expect(report.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining('factor_sensitivity array is empty')
      ])
    )
    expect(report._computedButEmptyAnomalies).toBeDefined()
    expect(report._computedButEmptyAnomalies).toHaveLength(1)
  })
})

// =============================================================================
// Probability Fields Tests (Unified Outcome Display)
// =============================================================================

describe('probability_of_goal and win_probability mapping', () => {
  it('maps probability_of_goal from V2 option_comparison', () => {
    const v2Response = makeSuccessResponse({
      option_comparison: [
        {
          option_id: 'opt1',
          option_label: 'Option A',
          confidence_interval: [40, 80],
          probability_of_goal: 0.75,
        },
      ],
    })

    const report = mapV2ResponseToReportV1(v2Response, { seed: 42 })

    expect(report.option_probabilities).toBeDefined()
    expect(report.option_probabilities!['opt1'].goal_probability).toBe(0.75)
  })

  it('falls back to CI midpoint when probability_of_goal not provided', () => {
    const v2Response = makeSuccessResponse({
      option_comparison: [
        {
          option_id: 'opt1',
          option_label: 'Option A',
          confidence_interval: [30, 70], // midpoint = 50
        },
      ],
    })

    const report = mapV2ResponseToReportV1(v2Response, { seed: 42 })

    expect(report.option_probabilities).toBeDefined()
    expect(report.option_probabilities!['opt1'].goal_probability).toBe(50) // CI midpoint
  })

  it('maps win_probability from V2 option_comparison', () => {
    const v2Response = makeSuccessResponse({
      option_comparison: [
        {
          option_id: 'opt1',
          option_label: 'Option A',
          confidence_interval: [40, 80],
          win_probability: 0.85,
        },
      ],
    })

    const report = mapV2ResponseToReportV1(v2Response, { seed: 42 })

    expect(report.option_probabilities).toBeDefined()
    expect(report.option_probabilities!['opt1'].win_probability).toBe(0.85)
  })

  it('handles missing win_probability gracefully', () => {
    const v2Response = makeSuccessResponse({
      option_comparison: [
        {
          option_id: 'opt1',
          option_label: 'Option A',
          confidence_interval: [40, 80],
          // no win_probability
        },
      ],
    })

    const report = mapV2ResponseToReportV1(v2Response, { seed: 42 })

    expect(report.option_probabilities).toBeDefined()
    expect(report.option_probabilities!['opt1'].win_probability).toBeUndefined()
  })

  it('maps multiple options with probability fields', () => {
    const v2Response = makeSuccessResponse({
      option_comparison: [
        {
          option_id: 'opt1',
          option_label: 'Option A',
          confidence_interval: [40, 80],
          probability_of_goal: 0.75,
          win_probability: 0.6,
        },
        {
          option_id: 'opt2',
          option_label: 'Option B',
          confidence_interval: [30, 70],
          probability_of_goal: 0.65,
          win_probability: 0.4,
        },
      ],
    })

    const report = mapV2ResponseToReportV1(v2Response, { seed: 42 })

    expect(report.option_probabilities).toBeDefined()
    expect(report.option_probabilities!['opt1'].goal_probability).toBe(0.75)
    expect(report.option_probabilities!['opt1'].win_probability).toBe(0.6)
    expect(report.option_probabilities!['opt2'].goal_probability).toBe(0.65)
    expect(report.option_probabilities!['opt2'].win_probability).toBe(0.4)
  })
})

// ============================================================================
// P0 Fix: Robustness object passthrough tests
// ============================================================================

describe('robustness passthrough to report (P0 Fix)', () => {
  it('includes robustness object in report when present', () => {
    const v2Response = makeSuccessResponse({
      robustness: {
        fragile_edges: ['edge1::edge2', 'edge3::edge4'],
        robust_edges: ['edge5::edge6'],
      },
      robustness_status: 'computed',
    })

    const report = mapV2ResponseToReportV1(v2Response, { seed: 42 })

    // P0 Fix: robustness object should be passed through
    expect((report as any).robustness).toBeDefined()
    expect((report as any).robustness.fragile_edges).toEqual(['edge1::edge2', 'edge3::edge4'])
    expect((report as any).robustness.robust_edges).toEqual(['edge5::edge6'])
  })

  it('includes robustness_status in report when present', () => {
    const v2Response = makeSuccessResponse({
      robustness: { fragile_edges: [], robust_edges: ['edge1'] },
      robustness_status: 'computed',
    })

    const report = mapV2ResponseToReportV1(v2Response, { seed: 42 })

    // P0 Fix: robustness_status should be passed through
    expect((report as any).robustness_status).toBe('computed')
  })

  it('sets robustness to undefined when absent in V2 response', () => {
    const v2Response = makeSuccessResponse({
      robustness: undefined,
      robustness_status: 'unavailable',
    })

    const report = mapV2ResponseToReportV1(v2Response, { seed: 42 })

    expect((report as any).robustness).toBeUndefined()
    expect((report as any).robustness_status).toBe('unavailable')
  })

  it('handles truncated array wrapper format for fragile_edges', () => {
    // P0 Fix: safeArray handles { __truncated: true, items: [...] } format
    const v2Response = makeSuccessResponse({
      robustness: {
        fragile_edges: { __truncated: true, items: ['edge1', 'edge2'], totalCount: 10 } as unknown as string[],
        robust_edges: ['edge3'],
      },
      robustness_status: 'computed',
    })

    const report = mapV2ResponseToReportV1(v2Response, { seed: 42 })

    // safeArray should unwrap the truncated format
    expect((report as any).robustness.fragile_edges).toEqual(['edge1', 'edge2'])
    expect((report as any).robustness.robust_edges).toEqual(['edge3'])
  })

  it('includes ranking_stability when present', () => {
    const v2Response = makeSuccessResponse({
      robustness: {
        fragile_edges: [],
        robust_edges: ['edge1'],
        ranking_stability: 0.85,
      } as any,
      robustness_status: 'computed',
    })

    const report = mapV2ResponseToReportV1(v2Response, { seed: 42 })

    expect((report as any).robustness.ranking_stability).toBe(0.85)
  })

  it('includes recommendation_stability when present (P0 stability chip fix)', () => {
    const v2Response = makeSuccessResponse({
      robustness: {
        fragile_edges: [],
        robust_edges: ['edge1'],
        recommendation_stability: 0.9765,
      } as any,
      robustness_status: 'computed',
    })

    const report = mapV2ResponseToReportV1(v2Response, { seed: 42 })

    // P0 Fix: recommendation_stability should be passed through for stability chip
    expect((report as any).robustness.recommendation_stability).toBe(0.9765)
  })

  it('includes is_robust, level, and recommended_option_id when present (P0 TopBar chips fix)', () => {
    const v2Response = makeSuccessResponse({
      robustness: {
        fragile_edges: ['edge1'],
        robust_edges: ['edge2', 'edge3'],
        is_robust: false,
        level: 'low',
        recommended_option_id: 'opt_hire_developer',
        recommendation_stability: 0.553,
      } as any,
      robustness_status: 'computed',
    })

    const report = mapV2ResponseToReportV1(v2Response, { seed: 42 })

    // P0 Fix: These fields are needed by useAnalysisMetadata for TopBar chips
    expect((report as any).robustness.is_robust).toBe(false)
    expect((report as any).robustness.level).toBe('low')
    expect((report as any).robustness.recommended_option_id).toBe('opt_hire_developer')
  })
})

// ============================================================================
// P0 Fix: Meta fields passthrough for TopBar chips
// ============================================================================

describe('meta passthrough for TopBar chips (P0 Fix)', () => {
  it('includes n_samples and computed_at when present in V2 response', () => {
    const v2Response = makeSuccessResponse({
      meta: {
        seed_used: '42',
        n_samples: 1000,
        detail_level: 'deep',
        latency_ms: 100,
        computed_at: '2026-01-27T14:04:36.561Z',
      } as any,
    })

    const report = mapV2ResponseToReportV1(v2Response, { seed: 42 })

    // P0 Fix: These fields are needed by useAnalysisMetadata for TopBar chips
    expect((report as any).meta.n_samples).toBe(1000)
    expect((report as any).meta.computed_at).toBe('2026-01-27T14:04:36.561Z')
  })

  it('sets n_samples and computed_at to undefined when not present', () => {
    const v2Response = makeSuccessResponse({
      meta: {
        seed_used: '42',
        detail_level: 'deep',
        latency_ms: 100,
        // n_samples and computed_at intentionally omitted
      } as any,
    })

    const report = mapV2ResponseToReportV1(v2Response, { seed: 42 })

    expect((report as any).meta.n_samples).toBeUndefined()
    expect((report as any).meta.computed_at).toBeUndefined()
  })
})

describe('createEnrichmentFromV2Response - P0 Fix: Robustness with empty edge_sensitivity', () => {
  it('returns enrichment when robustness has fragile_edges but edge_sensitivity is empty', () => {
    const v2Response = makeSuccessResponse({
      edge_sensitivity: [],
      factor_sensitivity: [],
      robustness: {
        fragile_edges: ['edge_1', 'edge_2', 'edge_3'],
        robust_edges: ['edge_4', 'edge_5'],
      },
      robustness_status: 'computed',
    })

    const enrichment = createEnrichmentFromV2Response(v2Response)

    expect(enrichment).not.toBeNull()
    expect(enrichment?.sensitivity_analysis.fragile_edges).toHaveLength(3)
    expect(enrichment?.sensitivity_analysis.robust_edges).toHaveLength(2)
    expect(enrichment?.sensitivity_analysis.overall_robustness).toBe('moderate')
    // Required metadata fields for hasEnrichment() type guard
    expect(enrichment?.metadata.isl_enabled).toBe(true)
    expect(enrichment?.metadata.detail_level).toBe('deep')
  })

  it('derives overall_robustness as "robust" when robust_edges > 70%', () => {
    const v2Response = makeSuccessResponse({
      edge_sensitivity: [],
      robustness: {
        fragile_edges: ['edge_1'],
        robust_edges: ['edge_2', 'edge_3', 'edge_4', 'edge_5', 'edge_6', 'edge_7', 'edge_8'],
      },
      robustness_status: 'computed',
    })

    const enrichment = createEnrichmentFromV2Response(v2Response)

    expect(enrichment?.sensitivity_analysis.overall_robustness).toBe('robust')
  })

  it('derives overall_robustness as "fragile" when robust_edges < 30%', () => {
    const v2Response = makeSuccessResponse({
      edge_sensitivity: [],
      robustness: {
        fragile_edges: ['edge_1', 'edge_2', 'edge_3', 'edge_4', 'edge_5', 'edge_6', 'edge_7'],
        robust_edges: ['edge_8'],
      },
      robustness_status: 'computed',
    })

    const enrichment = createEnrichmentFromV2Response(v2Response)

    expect(enrichment?.sensitivity_analysis.overall_robustness).toBe('fragile')
  })

  it('returns null when no edge_sensitivity AND no robustness edges', () => {
    const v2Response = makeSuccessResponse({
      edge_sensitivity: [],
      factor_sensitivity: [],
      robustness: {
        fragile_edges: [],
        robust_edges: [],
      },
      robustness_status: 'computed',
    })

    const enrichment = createEnrichmentFromV2Response(v2Response)

    expect(enrichment).toBeNull()
  })
})

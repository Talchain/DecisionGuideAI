/**
 * V2 Response Mapper Tests (P0-UI Integration)
 *
 * Tests for mapping V2RunResponse to ReportV1 format.
 */

import { describe, it, expect } from 'vitest'
import { mapV2ResponseToReportV1, createErrorReport, detectComputedButEmpty } from '../responseMapper'
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
    // PLoT returns edge_sensitivity for drivers when drivers_status is computed
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
    expect(report.option_probabilities).toEqual({
      opt1: { goal_probability: 50, confidence: 0.5 }, // (30+70)/2 = 50
      opt2: { goal_probability: 60, confidence: 0.5 }, // (45+75)/2 = 60
    })
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

    expect(report.results.conservative).toBe(0)
    expect(report.results.likely).toBe(0)
    expect(report.results.optimistic).toBe(0)
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

  it('detects empty edge_sensitivity when drivers_status is computed', () => {
    const v2Response = makeSuccessResponse({
      drivers_status: 'computed',
      edge_sensitivity: [],
    })
    const anomalies = detectComputedButEmpty(v2Response)
    expect(anomalies).toHaveLength(1)
    expect(anomalies[0]).toMatchObject({
      field: 'edge_sensitivity',
      status: 'computed',
    })
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
    })
    const anomalies = detectComputedButEmpty(v2Response)
    expect(anomalies).toHaveLength(3)
    expect(anomalies.map(a => a.field)).toContain('option_comparison')
    expect(anomalies.map(a => a.field)).toContain('robustness')
    expect(anomalies.map(a => a.field)).toContain('edge_sensitivity')
  })

  it('adds synthetic warnings to report when anomalies detected', () => {
    const v2Response = makeSuccessResponse({
      drivers_status: 'computed',
      edge_sensitivity: [],
    })
    const report = mapV2ResponseToReportV1(v2Response, { seed: 42 })

    // Should have a warning about empty edge_sensitivity
    expect(report.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining('edge_sensitivity array is empty')
      ])
    )
    expect(report._computedButEmptyAnomalies).toBeDefined()
    expect(report._computedButEmptyAnomalies).toHaveLength(1)
  })
})

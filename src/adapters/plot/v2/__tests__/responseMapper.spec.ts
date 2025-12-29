/**
 * V2 Response Mapper Tests (P0-UI Integration)
 *
 * Tests for mapping V2RunResponse to ReportV1 format.
 */

import { describe, it, expect } from 'vitest'
import { mapV2ResponseToReportV1, createErrorReport } from '../responseMapper'
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
    options: [
      {
        id: 'opt1',
        label: 'Option 1',
        outcome: {
          mean: 50,
          std: 10,
          p10: 30,
          p50: 50,
          p90: 70,
        },
        status: 'computed',
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
    robustness: {
      level: 'high',
      confidence: 0.85,
    },
    response_hash: 'abc123',
    seed_used: '42',
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
    const v2Response = makeSuccessResponse({
      robustness: { level: 'medium', confidence: 0.65 },
    })

    const report = mapV2ResponseToReportV1(v2Response, { seed: 42 })

    expect(report.confidence).toEqual({
      level: 'medium',
      why: 'Robustness: medium (65%)',
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
      options: [
        { id: 'opt1', label: 'Option 1', outcome: { mean: 50, std: 10, p10: 30, p50: 50, p90: 70 }, status: 'computed' },
        { id: 'opt2', label: 'Option 2', outcome: { mean: 60, std: 8, p10: 45, p50: 60, p90: 75 }, status: 'computed' },
      ],
      robustness: { level: 'high', confidence: 0.9 },
    })

    const report = mapV2ResponseToReportV1(v2Response, { seed: 42 })

    expect(report.option_probabilities).toEqual({
      opt1: { goal_probability: 50, confidence: 0.9 },
      opt2: { goal_probability: 60, confidence: 0.9 },
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

  it('handles empty options array', () => {
    const v2Response = makeSuccessResponse({ options: [] })

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

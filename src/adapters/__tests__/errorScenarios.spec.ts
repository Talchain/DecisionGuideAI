/**
 * Wave 1 Task 8: Error scenario tests
 *
 * Validates graceful degradation when backend services fail.
 * Covers: malformed responses, timeouts, HTTP errors, network failures.
 */

import { describe, it, expect } from 'vitest'
import { mapV2ResponseToReportV1, createErrorReport } from '../plot/v2/responseMapper'
import type { V2RunResponse } from '../plot/v2/types'
import {
  validateV2RunResponseFull,
  sanitizeV2RunResponse,
  isValidV2RunResponse,
  isBlockedResponse,
  isSuccessfulAnalysis,
} from '../plot/v2/types'
import { adaptDraftResponse } from '../cee/client'
import { mapErrorType } from '../../lib/errorTaxonomy'
import type { ErrorType } from '../../lib/errorTaxonomy'

// =============================================================================
// PLoT response error scenarios
// =============================================================================
describe('PLoT response — error scenarios', () => {
  it('createErrorReport returns a valid report for service failures', () => {
    const report = createErrorReport('PLoT returned HTTP 500', [], { seed: 42 })
    expect(report).toBeDefined()
    expect(report.schema).toBe('report.v1')
    expect(report.confidence.why).toBe('PLoT returned HTTP 500')
    expect(report.confidence.level).toBe('low')
  })

  it('handles V2 response with all statuses "failed"', () => {
    const failedResponse: V2RunResponse = {
      analysis_status: 'failed',
      option_comparison_status: 'failed',
      robustness_status: 'failed',
      drivers_status: 'failed',
      option_comparison: [],
      critiques: [],
      drivers: [],
    }
    const report = mapV2ResponseToReportV1(failedResponse, [])
    expect(report).toBeDefined()
    // Report should not crash — it may have empty results but still valid schema
    expect(report.schema).toBe('report.v1')
  })

  it('handles V2 response with empty option_comparison array', () => {
    const emptyResponse: V2RunResponse = {
      analysis_status: 'computed',
      option_comparison_status: 'computed',
      robustness_status: 'computed',
      drivers_status: 'computed',
      option_comparison: [],
      critiques: [],
      drivers: [],
    }
    const report = mapV2ResponseToReportV1(emptyResponse, [])
    expect(report).toBeDefined()
    expect(report.schema).toBe('report.v1')
  })

  it('handles V2 response with missing optional fields', () => {
    const minimalResponse: V2RunResponse = {
      analysis_status: 'computed',
      option_comparison_status: 'computed',
      robustness_status: 'computed',
      drivers_status: 'computed',
      option_comparison: [
        { option_id: 'opt1', option_label: 'A', confidence_interval: [30, 70] },
      ],
      critiques: [],
      drivers: [],
      // No enrichment, no robustness, no fragile_edges
    }
    const report = mapV2ResponseToReportV1(minimalResponse, ['opt1'])
    expect(report).toBeDefined()
  })

  it('handles V2 response with NaN/Infinity in numeric fields', () => {
    const badNumbers: V2RunResponse = {
      analysis_status: 'computed',
      option_comparison_status: 'computed',
      robustness_status: 'computed',
      drivers_status: 'computed',
      option_comparison: [
        {
          option_id: 'opt1',
          option_label: 'A',
          win_probability: NaN as any,
          confidence_interval: [Infinity as any, -Infinity as any],
        },
      ],
      critiques: [],
      drivers: [],
    }
    // Should not throw
    expect(() => mapV2ResponseToReportV1(badNumbers, ['opt1'])).not.toThrow()
  })
})

// =============================================================================
// CEE response error scenarios
// =============================================================================
describe('CEE adaptDraftResponse — error scenarios', () => {
  it('handles completely empty response gracefully', () => {
    const result = adaptDraftResponse({})
    expect(result).toBeDefined()
    expect(result.nodes).toBeDefined()
    expect(result.edges).toBeDefined()
  })

  it('handles response with null nodes array', () => {
    const result = adaptDraftResponse({ nodes: null, edges: [] })
    expect(result).toBeDefined()
    expect(Array.isArray(result.nodes)).toBe(true)
  })

  it('handles nodes with missing required fields', () => {
    const result = adaptDraftResponse({
      nodes: [{ id: 'n1' }],  // No kind, no label
      edges: [],
    })
    expect(result).toBeDefined()
    expect(result.nodes.length).toBeGreaterThanOrEqual(0)
  })

  it('handles edges with invalid from/to references', () => {
    const result = adaptDraftResponse({
      nodes: [{ id: 'n1', kind: 'factor', label: 'A' }],
      edges: [{ from: 'n1', to: 'nonexistent' }],
    })
    expect(result).toBeDefined()
  })
})

// =============================================================================
// Error taxonomy — mapErrorType produces user-friendly messages
// =============================================================================
describe('Error taxonomy — mapErrorType', () => {
  const allTypes: ErrorType[] = ['TIMEOUT', 'RETRYABLE', 'INTERNAL', 'BAD_INPUT', 'RATE_LIMIT', 'BREAKER_OPEN']

  it.each(allTypes)('maps %s to a user-friendly message', (errorType) => {
    const result = mapErrorType(errorType)
    expect(result.label).toBeTruthy()
    expect(result.message).toBeTruthy()
    expect(result.suggestion).toBeTruthy()
  })

  it('TIMEOUT produces timeout-specific guidance', () => {
    const result = mapErrorType('TIMEOUT')
    expect(result.label.toLowerCase()).toContain('timeout')
  })

  it('RETRYABLE produces a transient-error message', () => {
    const result = mapErrorType('RETRYABLE')
    expect(result.message.toLowerCase()).toMatch(/temporary|transient|network/)
  })

  it('BAD_INPUT tells the user to check their input', () => {
    const result = mapErrorType('BAD_INPUT')
    expect(result.suggestion.toLowerCase()).toContain('check')
  })

  it('no message contains stack trace fragments', () => {
    for (const t of allTypes) {
      const result = mapErrorType(t)
      expect(result.message).not.toContain('at ')
      expect(result.message).not.toContain('Error:')
      expect(result.suggestion).not.toContain('at ')
    }
  })
})

// =============================================================================
// Wave 2 Task 7: Integration-level error scenario tests
// V2 response validation pipeline
// =============================================================================
describe('V2 response validation pipeline — malformed responses', () => {
  it('rejects null root as hard error', () => {
    const result = validateV2RunResponseFull(null)
    expect(result.valid).toBe(false)
    expect(result.hardErrors.length).toBeGreaterThan(0)
    expect(result.hardErrors[0].field).toBe('root')
  })

  it('rejects non-object root as hard error', () => {
    const result = validateV2RunResponseFull('not an object')
    expect(result.valid).toBe(false)
    expect(result.hardErrors[0].field).toBe('root')
  })

  it('rejects missing analysis_status as hard error', () => {
    const result = validateV2RunResponseFull({ option_comparison: [], critiques: [], response_hash: 'abc' })
    expect(result.valid).toBe(false)
    expect(result.hardErrors.some(e => e.field === 'analysis_status')).toBe(true)
  })

  it('rejects non-array option_comparison as hard error', () => {
    const result = validateV2RunResponseFull({
      analysis_status: 'computed',
      response_hash: 'abc',
      option_comparison: 'not an array',
      critiques: [],
    })
    expect(result.valid).toBe(false)
    expect(result.hardErrors.some(e => e.field === 'option_comparison')).toBe(true)
  })

  it('produces soft warning for non-array critiques', () => {
    const result = validateV2RunResponseFull({
      analysis_status: 'computed',
      response_hash: 'abc',
      option_comparison: [],
      critiques: 'not an array',
    })
    // Soft warning, not hard error
    expect(result.valid).toBe(true)
    expect(result.softWarnings.some(w => w.field === 'critiques')).toBe(true)
  })

  it('accepts valid minimal response', () => {
    const result = validateV2RunResponseFull({
      analysis_status: 'computed',
      response_hash: 'abc',
      option_comparison: [],
      critiques: [],
    })
    expect(result.valid).toBe(true)
    expect(result.hardErrors).toHaveLength(0)
  })

  it('accepts empty arrays for optional fields', () => {
    const result = validateV2RunResponseFull({
      analysis_status: 'computed',
      response_hash: 'abc',
      option_comparison: [],
      critiques: [],
      drivers: [],
      factor_sensitivity: [],
    })
    expect(result.valid).toBe(true)
  })
})

describe('V2 response sanitisation — fixes soft anomalies', () => {
  it('converts non-array critiques to empty array', () => {
    const broken = {
      analysis_status: 'computed' as const,
      option_comparison_status: 'computed' as const,
      robustness_status: 'computed' as const,
      drivers_status: 'computed' as const,
      option_comparison: [],
      critiques: 'not an array' as any,
      drivers: [],
      response_hash: 'abc',
    } satisfies Partial<V2RunResponse> as V2RunResponse
    const fixed = sanitizeV2RunResponse(broken)
    expect(Array.isArray(fixed.critiques)).toBe(true)
    expect(fixed.critiques).toHaveLength(0)
  })

  it('preserves valid arrays unchanged', () => {
    const valid: V2RunResponse = {
      analysis_status: 'computed',
      option_comparison_status: 'computed',
      robustness_status: 'computed',
      drivers_status: 'computed',
      option_comparison: [{ option_id: 'a', option_label: 'A', confidence_interval: [10, 90] }],
      critiques: [{ code: 'TEST', severity: 'info', message: 'test' }],
      drivers: [],
      response_hash: 'abc',
    }
    const result = sanitizeV2RunResponse(valid)
    expect(result.option_comparison).toHaveLength(1)
    expect(result.critiques).toHaveLength(1)
  })
})

describe('V2 type guards — blocked vs success', () => {
  it('isBlockedResponse identifies blocked analysis', () => {
    expect(isBlockedResponse({
      analysis_status: 'blocked',
      status_reason: 'Missing goal node',
      critiques: [],
    })).toBe(true)
  })

  it('isBlockedResponse returns false for computed', () => {
    expect(isBlockedResponse({
      analysis_status: 'computed',
      option_comparison_status: 'computed',
      robustness_status: 'computed',
      drivers_status: 'computed',
      option_comparison: [],
      critiques: [],
      drivers: [],
      response_hash: 'abc',
    })).toBe(false)
  })

  it('isSuccessfulAnalysis identifies computed response', () => {
    expect(isSuccessfulAnalysis({
      analysis_status: 'computed',
      option_comparison_status: 'computed',
      robustness_status: 'computed',
      drivers_status: 'computed',
      option_comparison: [],
      critiques: [],
      drivers: [],
      response_hash: 'abc',
    })).toBe(true)
  })

  it('isSuccessfulAnalysis identifies partial response', () => {
    expect(isSuccessfulAnalysis({
      analysis_status: 'partial',
      option_comparison_status: 'computed',
      robustness_status: 'unavailable',
      drivers_status: 'unavailable',
      option_comparison: [],
      critiques: [],
      response_hash: 'abc',
    })).toBe(true)
  })

  it('isValidV2RunResponse rejects garbage data', () => {
    expect(isValidV2RunResponse(null)).toBe(false)
    expect(isValidV2RunResponse(42)).toBe(false)
    expect(isValidV2RunResponse({})).toBe(false)
    expect(isValidV2RunResponse({ analysis_status: 'computed' })).toBe(false) // missing response_hash
  })
})

describe('End-to-end: malformed V2 → ReportV1 pipeline', () => {
  it('handles response with extra unexpected fields gracefully', () => {
    const response: V2RunResponse = {
      analysis_status: 'computed',
      option_comparison_status: 'computed',
      robustness_status: 'computed',
      drivers_status: 'computed',
      option_comparison: [
        { option_id: 'opt1', option_label: 'Option A', confidence_interval: [20, 80] },
      ],
      critiques: [],
      drivers: [],
      response_hash: 'abc123',
      // @ts-expect-error — testing unknown fields from future PLoT versions
      unknown_future_field: { data: 'should not crash' },
    }
    const report = mapV2ResponseToReportV1(response, { seed: 42 })
    expect(report.schema).toBe('report.v1')
    expect(report.option_probabilities).toBeDefined()
    expect(report.option_probabilities!['opt1']).toBeDefined()
  })

  it('handles response where all sub-statuses are error', () => {
    const response: V2RunResponse = {
      analysis_status: 'computed',
      option_comparison_status: 'error',
      robustness_status: 'error',
      drivers_status: 'error',
      option_comparison: [],
      critiques: [{ code: 'ENGINE_FAILURE', severity: 'blocker', message: 'Computation failed' }],
      drivers: [],
      response_hash: 'def456',
    }
    const report = mapV2ResponseToReportV1(response, { seed: 99 })
    expect(report.schema).toBe('report.v1')
    expect(report.confidence.level).toBeDefined()
  })

  it('handles response with malformed option_comparison entries', () => {
    const response: V2RunResponse = {
      analysis_status: 'computed',
      option_comparison_status: 'computed',
      robustness_status: 'computed',
      drivers_status: 'computed',
      option_comparison: [
        null as any, // Malformed entry
        { option_id: 'opt1', option_label: 'A', confidence_interval: [30, 70] },
      ],
      critiques: [],
      drivers: [],
      response_hash: 'ghi789',
    }
    // Should not throw — malformed entries should be filtered out
    expect(() => mapV2ResponseToReportV1(response, { seed: 1 })).not.toThrow()
    const report = mapV2ResponseToReportV1(response, { seed: 1 })
    expect(report.option_probabilities!['opt1']).toBeDefined()
  })
})

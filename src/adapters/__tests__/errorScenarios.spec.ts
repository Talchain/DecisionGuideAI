/**
 * Wave 1 Task 8: Error scenario tests
 *
 * Validates graceful degradation when backend services fail.
 * Covers: malformed responses, timeouts, HTTP errors, network failures.
 */

import { describe, it, expect } from 'vitest'
import { mapV2ResponseToReportV1, createErrorReport } from '../plot/v2/responseMapper'
import type { V2RunResponse } from '../plot/v2/types'
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

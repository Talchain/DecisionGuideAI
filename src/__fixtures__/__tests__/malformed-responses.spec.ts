/**
 * Contract Test: Malformed Response Handling
 *
 * Tests that validation and sanitization functions handle
 * malformed API responses gracefully.
 */

import { describe, it, expect } from 'vitest'
import {
  V2_OPTION_COMPARISON_NULL,
  V2_MISSING_RESPONSE_HASH,
  V2_WRONG_TYPE_ANALYSIS_STATUS,
  V2_CRITIQUES_OBJECT,
  V2_DRIVERS_STRING,
  V2_NOT_OBJECT,
  V2_NULL_RESPONSE,
  V2_ERROR_MISSING_REASON,
  V2_ERROR_CRITIQUES_NULL,
  CEE_INVALID_BLOCK,
  CEE_INVALID_READINESS_FACTOR,
  CEE_BLOCKS_OBJECT,
  CEE_MISSING_FACTORS,
  PIPELINE_TRACE_INCOMPLETE,
} from '../malformed-responses'
import {
  validateV2RunResponseFull,
  validateV2RunError,
  isValidV2RunResponse,
  sanitizeV2RunResponse,
  type V2RunResponse,
} from '../../adapters/plot/v2/types'
import {
  sanitizeCeeReviewPayload,
  isValidReviewBlock,
  isValidReadinessFactor,
} from '../../canvas/utils/ceeDataAdapter'
import { isCeePipelineTrace } from '../../adapters/cee/types'
import type { CeeDecisionReviewPayloadV1 } from '../../types/cee'

// =============================================================================
// V2RunResponse Validation Tests
// =============================================================================

describe('V2RunResponse Validation', () => {
  describe('Hard Errors', () => {
    it('detects missing response_hash', () => {
      const result = validateV2RunResponseFull(V2_MISSING_RESPONSE_HASH)
      expect(result.valid).toBe(false)
      expect(result.hardErrors.length).toBeGreaterThan(0)
      expect(result.hardErrors.some(e => e.field === 'response_hash')).toBe(true)
    })

    it('detects wrong type for analysis_status', () => {
      const result = validateV2RunResponseFull(V2_WRONG_TYPE_ANALYSIS_STATUS)
      expect(result.valid).toBe(false)
      expect(result.hardErrors.some(e => e.field === 'analysis_status')).toBe(true)
    })

    it('detects non-object response', () => {
      const result = validateV2RunResponseFull(V2_NOT_OBJECT)
      expect(result.valid).toBe(false)
      expect(result.hardErrors.some(e => e.field === 'root')).toBe(true)
    })

    it('detects null response', () => {
      const result = validateV2RunResponseFull(V2_NULL_RESPONSE)
      expect(result.valid).toBe(false)
      expect(result.hardErrors.some(e => e.field === 'root')).toBe(true)
    })
  })

  describe('Soft Warnings', () => {
    it('allows null option_comparison (validation passes, sanitization handles)', () => {
      // The fixture already has response_hash
      const result = validateV2RunResponseFull(V2_OPTION_COMPARISON_NULL)
      // null is explicitly allowed by validation (not an array but also not a non-array value)
      // Runtime code should use optional chaining or sanitization to handle
      expect(result.valid).toBe(true)
      // No hard error for null (only non-array values trigger hard error)
      expect(result.hardErrors.some(e => e.field === 'option_comparison')).toBe(false)
    })

    it('warns on critiques being object instead of array', () => {
      const result = validateV2RunResponseFull(V2_CRITIQUES_OBJECT)
      expect(result.valid).toBe(true) // Object critiques is soft warning
      expect(result.softWarnings.some(e => e.field === 'critiques')).toBe(true)
    })

    it('warns on drivers being string instead of array', () => {
      const result = validateV2RunResponseFull(V2_DRIVERS_STRING)
      expect(result.valid).toBe(true) // String drivers is soft warning
      expect(result.softWarnings.some(e => e.field === 'drivers')).toBe(true)
    })
  })

  describe('isValidV2RunResponse', () => {
    it('returns false for responses with hard errors', () => {
      expect(isValidV2RunResponse(V2_MISSING_RESPONSE_HASH)).toBe(false)
      expect(isValidV2RunResponse(V2_WRONG_TYPE_ANALYSIS_STATUS)).toBe(false)
      expect(isValidV2RunResponse(V2_NOT_OBJECT)).toBe(false)
    })

    it('returns true for responses with only soft warnings', () => {
      expect(isValidV2RunResponse(V2_CRITIQUES_OBJECT)).toBe(true)
      expect(isValidV2RunResponse(V2_DRIVERS_STRING)).toBe(true)
    })
  })
})

// =============================================================================
// V2RunResponse Sanitization Tests
// =============================================================================

describe('V2RunResponse Sanitization', () => {
  it('converts object critiques to empty array', () => {
    const sanitized = sanitizeV2RunResponse(V2_CRITIQUES_OBJECT as V2RunResponse)
    expect(Array.isArray(sanitized.critiques)).toBe(true)
    expect(sanitized.critiques).toEqual([])
  })

  it('converts string drivers to empty array', () => {
    const sanitized = sanitizeV2RunResponse(V2_DRIVERS_STRING as V2RunResponse)
    expect(sanitized.drivers).toEqual([])
  })

  it('preserves valid arrays', () => {
    const validResponse: V2RunResponse = {
      analysis_status: 'computed',
      option_comparison_status: 'computed',
      robustness_status: 'computed',
      drivers_status: 'computed',
      option_comparison: [{ option_id: 'opt1', option_label: 'Option 1', confidence_interval: [0.3, 0.7] }],
      critiques: [{ code: 'test', severity: 'info', message: 'Test' }],
      response_hash: 'abc123',
    }
    const sanitized = sanitizeV2RunResponse(validResponse)
    expect(sanitized.option_comparison).toEqual(validResponse.option_comparison)
    expect(sanitized.critiques).toEqual(validResponse.critiques)
  })
})

// =============================================================================
// V2RunError Validation Tests
// =============================================================================

describe('V2RunError Validation', () => {
  it('detects missing status_reason', () => {
    const failures = validateV2RunError(V2_ERROR_MISSING_REASON)
    expect(failures.length).toBeGreaterThan(0)
    expect(failures.some(f => f.field === 'status_reason')).toBe(true)
  })

  it('detects null critiques', () => {
    const failures = validateV2RunError(V2_ERROR_CRITIQUES_NULL)
    expect(failures.length).toBeGreaterThan(0)
    expect(failures.some(f => f.field === 'critiques')).toBe(true)
  })
})

// =============================================================================
// CEE Review Payload Sanitization Tests
// =============================================================================

describe('CEE Review Payload Sanitization', () => {
  describe('isValidReviewBlock', () => {
    it('rejects blocks without id', () => {
      const invalidBlock = { status: 'ok', source: 'analysis' }
      expect(isValidReviewBlock(invalidBlock)).toBe(false)
    })

    it('accepts valid blocks', () => {
      const validBlock = { id: 'block1', status: 'ok', source: 'analysis' }
      expect(isValidReviewBlock(validBlock)).toBe(true)
    })
  })

  describe('isValidReadinessFactor', () => {
    it('rejects factors with invalid status', () => {
      const invalidFactor = { label: 'Test', status: 'invalid' }
      expect(isValidReadinessFactor(invalidFactor)).toBe(false)
    })

    it('accepts factors with valid status', () => {
      expect(isValidReadinessFactor({ label: 'Test', status: 'ok' })).toBe(true)
      expect(isValidReadinessFactor({ label: 'Test', status: 'warning' })).toBe(true)
      expect(isValidReadinessFactor({ label: 'Test', status: 'blocking' })).toBe(true)
    })
  })

  describe('sanitizeCeeReviewPayload', () => {
    it('filters out invalid blocks', () => {
      const sanitized = sanitizeCeeReviewPayload(CEE_INVALID_BLOCK as unknown as CeeDecisionReviewPayloadV1)
      expect(sanitized?.blocks.length).toBe(1)
      expect(sanitized?.blocks[0].id).toBe('valid_block')
    })

    it('filters out invalid readiness factors', () => {
      const sanitized = sanitizeCeeReviewPayload(CEE_INVALID_READINESS_FACTOR as unknown as CeeDecisionReviewPayloadV1)
      expect(sanitized?.readiness?.factors.length).toBe(1)
      expect(sanitized?.readiness?.factors[0].label).toBe('Valid Factor')
    })

    it('converts object blocks to empty array', () => {
      const sanitized = sanitizeCeeReviewPayload(CEE_BLOCKS_OBJECT as unknown as CeeDecisionReviewPayloadV1)
      expect(Array.isArray(sanitized?.blocks)).toBe(true)
      expect(sanitized?.blocks.length).toBe(0)
    })

    it('handles missing factors array', () => {
      const sanitized = sanitizeCeeReviewPayload(CEE_MISSING_FACTORS as unknown as CeeDecisionReviewPayloadV1)
      expect(Array.isArray(sanitized?.readiness?.factors)).toBe(true)
      expect(sanitized?.readiness?.factors.length).toBe(0)
    })

    it('returns null for null input', () => {
      expect(sanitizeCeeReviewPayload(null)).toBe(null)
      expect(sanitizeCeeReviewPayload(undefined)).toBe(null)
    })
  })
})

// =============================================================================
// Pipeline Trace Validation Tests
// =============================================================================

describe('Pipeline Trace Validation', () => {
  it('accepts trace missing optional llm_call_count', () => {
    // isCeePipelineTrace only requires status, total_duration_ms, and stages[]
    expect(isCeePipelineTrace(PIPELINE_TRACE_INCOMPLETE)).toBe(true)
  })

  it('accepts valid trace', () => {
    const validTrace = {
      status: 'success',
      total_duration_ms: 1234,
      llm_call_count: 1,
      stages: [],
    }
    expect(isCeePipelineTrace(validTrace)).toBe(true)
  })

  it('rejects non-object', () => {
    expect(isCeePipelineTrace('not an object')).toBe(false)
    expect(isCeePipelineTrace(null)).toBe(false)
    expect(isCeePipelineTrace(undefined)).toBe(false)
  })
})

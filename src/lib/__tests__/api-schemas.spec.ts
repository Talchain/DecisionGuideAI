import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  CEEDraftResponseSchema,
  V1SyncRunResponseSchema,
  warnOnInvalidApiResponse,
} from '../api-schemas'
import { logger } from '../logger'

describe('API Response Validation', () => {
  describe('CEEDraftResponseSchema', () => {
    it('should pass validation for valid response', () => {
      const validResponse = {
        quality_overall: 7,
        nodes: [
          { id: 'n1', label: 'Decision', type: 'decision' },
          { id: 'n2', label: 'Option A', type: 'option' },
        ],
        edges: [
          { from: 'n1', to: 'n2' },
        ],
        draft_warnings: {
          structural: [],
          completeness: [],
        },
      }

      const result = CEEDraftResponseSchema.safeParse(validResponse)
      expect(result.success).toBe(true)
    })

    it('should pass with extra fields (passthrough)', () => {
      const responseWithExtras = {
        quality_overall: 8,
        nodes: [{ id: 'n1', label: 'Test', type: 'factor', extraField: 'allowed' }],
        edges: [{ from: 'n1', to: 'n2', weight: 0.5 }],
        schema_version: '2.2',
        analysis_ready: { options: [] },
      }

      const result = CEEDraftResponseSchema.safeParse(responseWithExtras)
      expect(result.success).toBe(true)
      if (result.success) {
        // Extra fields should be preserved
        expect((result.data as any).schema_version).toBe('2.2')
        expect((result.data as any).analysis_ready).toEqual({ options: [] })
      }
    })

    it('should pass with nested graph structure', () => {
      const nestedResponse = {
        graph: {
          nodes: [{ id: 'n1', label: 'Goal', type: 'goal' }],
          edges: [{ from: 'n1', to: 'n2' }],
        },
      }

      const result = CEEDraftResponseSchema.safeParse(nestedResponse)
      expect(result.success).toBe(true)
    })

    it('should fail for invalid node structure', () => {
      const invalidResponse = {
        quality_overall: 5,
        nodes: [{ id: 123, label: 'Test' }], // id should be string
        edges: [],
      }

      const result = CEEDraftResponseSchema.safeParse(invalidResponse)
      expect(result.success).toBe(false)
    })
  })

  describe('V1SyncRunResponseSchema', () => {
    it('should pass validation for valid response', () => {
      const validResponse = {
        result: {
          answer: 'Option A is recommended',
          confidence: 0.85,
          explanation: 'Based on analysis...',
        },
        execution_ms: 1234,
      }

      const result = V1SyncRunResponseSchema.safeParse(validResponse)
      expect(result.success).toBe(true)
    })

    it('should pass with extra fields (passthrough)', () => {
      const responseWithExtras = {
        result: {
          answer: 'Test',
          confidence: 0.9,
          explanation: 'Details',
          summary: { conservative: 0.7, likely: 0.8, optimistic: 0.9 },
          extra_field: 'allowed',
        },
        execution_ms: 500,
        ceeReview: { someData: true },
      }

      const result = V1SyncRunResponseSchema.safeParse(responseWithExtras)
      expect(result.success).toBe(true)
      if (result.success) {
        expect((result.data as any).ceeReview).toEqual({ someData: true })
      }
    })

    it('should fail for missing result', () => {
      const invalidResponse = {
        execution_ms: 1000,
      }

      const result = V1SyncRunResponseSchema.safeParse(invalidResponse)
      expect(result.success).toBe(false)
    })

    it('should fail for missing required fields in result', () => {
      const invalidResponse = {
        result: {
          answer: 'Test',
          // missing confidence
        },
        execution_ms: 1000,
      }

      const result = V1SyncRunResponseSchema.safeParse(invalidResponse)
      expect(result.success).toBe(false)
    })
  })

  describe('warnOnInvalidApiResponse', () => {
    beforeEach(() => {
      vi.spyOn(logger, 'warn').mockImplementation(() => {})
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('should not warn for valid response', () => {
      const data = {
        result: { answer: 'Test', confidence: 0.8 },
        execution_ms: 100,
      }

      warnOnInvalidApiResponse(V1SyncRunResponseSchema, data, 'test')
      expect(logger.warn).not.toHaveBeenCalled()
    })

    it('should log warning for invalid response', () => {
      const invalidData = {
        result: { answer: 'Test' }, // missing confidence
        execution_ms: 100,
      }

      warnOnInvalidApiResponse(V1SyncRunResponseSchema, invalidData, 'test')
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('[API Validation] test response has unexpected shape'),
        expect.objectContaining({
          errors: expect.any(Array),
        })
      )
    })

    it('should not crash on null data', () => {
      warnOnInvalidApiResponse(V1SyncRunResponseSchema, null, 'test')
      expect(logger.warn).toHaveBeenCalled()
    })

    it('should not crash on undefined data', () => {
      warnOnInvalidApiResponse(V1SyncRunResponseSchema, undefined, 'test')
      expect(logger.warn).toHaveBeenCalled()
    })
  })
})

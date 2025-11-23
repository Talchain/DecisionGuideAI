import { describe, it, expect } from 'vitest'
import type { V1CompleteData, V1LimitsResponse } from '../types'
import { V1_LIMITS } from '../types'
import { getDiagnosticsFromCompleteEvent, getGraphCaps, isScmLiteActive } from '../sdkHelpers'

describe('sdkHelpers', () => {
  describe('getDiagnosticsFromCompleteEvent', () => {
    it('returns undefined when diagnostics payload is missing', () => {
      const event: V1CompleteData = {
        result: {
          answer: 'test',
          confidence: 0.5,
          explanation: 'test',
        },
        execution_ms: 100,
      }

      const diagnostics = getDiagnosticsFromCompleteEvent(event)
      expect(diagnostics).toBeUndefined()
    })

    it('normalises diagnostics payload with defaults', () => {
      const event: V1CompleteData = {
        result: {
          answer: 'test',
          confidence: 0.9,
          explanation: 'test',
        },
        execution_ms: 123,
        diagnostics: {
          resumes: 2,
          trims: 1,
          recovered_events: 3,
          correlation_id: 'corr-1',
        },
      }

      const diagnostics = getDiagnosticsFromCompleteEvent(event)

      expect(diagnostics).toEqual({
        resumes: 2,
        trims: 1,
        recovered_events: 3,
        correlation_id: 'corr-1',
      })
    })

    it('applies safe defaults for missing numeric fields', () => {
      const event: V1CompleteData = {
        result: {
          answer: 'test',
          confidence: 0.9,
          explanation: 'test',
        },
        execution_ms: 123,
        diagnostics: {
          // no resumes / recovered_events / correlation_id
          trims: 0,
        },
      }

      const diagnostics = getDiagnosticsFromCompleteEvent(event)

      expect(diagnostics).toEqual({
        resumes: 0,
        trims: 0,
        recovered_events: 0,
        correlation_id: undefined,
      })
    })
  })

  describe('getGraphCaps', () => {
    it('uses top-level max_nodes / max_edges / max_body_kb when present', () => {
      const limits: V1LimitsResponse = {
        schema: 'limits.v1',
        max_nodes: 50,
        max_edges: 200,
        max_body_kb: 96,
        rate_limit_rpm: 60,
      }

      const caps = getGraphCaps(limits)

      expect(caps).toEqual({
        maxNodes: 50,
        maxEdges: 200,
        maxBodyKb: 96,
      })
    })

    it('falls back to nested nodes/edges max when top-level fields are missing', () => {
      const limits: V1LimitsResponse = {
        schema: 'limits.v1',
        max_nodes: undefined as any,
        max_edges: undefined as any,
        max_body_kb: undefined as any,
        rate_limit_rpm: 60,
        nodes: { max: 123 },
        edges: { max: 456 },
      }

      const caps = getGraphCaps(limits)

      expect(caps.maxNodes).toBe(123)
      expect(caps.maxEdges).toBe(456)
      expect(caps.maxBodyKb).toBeUndefined()
    })

    it('falls back to V1_LIMITS when no limits are present', () => {
      const limits: V1LimitsResponse = {
        schema: 'limits.v1',
        max_nodes: undefined as any,
        max_edges: undefined as any,
        max_body_kb: undefined as any,
        rate_limit_rpm: 60,
      }

      const caps = getGraphCaps(limits)

      expect(caps.maxNodes).toBe(V1_LIMITS.MAX_NODES)
      expect(caps.maxEdges).toBe(V1_LIMITS.MAX_EDGES)
      expect(caps.maxBodyKb).toBeUndefined()
    })
  })

  describe('isScmLiteActive', () => {
    it('returns true when scm_lite flag is 1', () => {
      const limits: V1LimitsResponse = {
        schema: 'limits.v1',
        max_nodes: 10,
        max_edges: 10,
        max_body_kb: 96,
        rate_limit_rpm: 60,
        flags: { scm_lite: 1 },
      }

      expect(isScmLiteActive(limits)).toBe(true)
    })

    it('returns false when scm_lite flag is 0 or missing', () => {
      const limitsZero: V1LimitsResponse = {
        schema: 'limits.v1',
        max_nodes: 10,
        max_edges: 10,
        max_body_kb: 96,
        rate_limit_rpm: 60,
        flags: { scm_lite: 0 },
      }

      const limitsMissing: V1LimitsResponse = {
        schema: 'limits.v1',
        max_nodes: 10,
        max_edges: 10,
        max_body_kb: 96,
        rate_limit_rpm: 60,
      }

      expect(isScmLiteActive(limitsZero)).toBe(false)
      expect(isScmLiteActive(limitsMissing)).toBe(false)
    })
  })
})

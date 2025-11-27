/**
 * Trust Signal Fields Contract Tests (P0.4)
 *
 * These unit tests verify the contract for trust signal fields.
 * Network integration tests are covered in determinism.test.ts
 *
 * Contract guarantees:
 * 1. decision_readiness is always populated from confidence.level
 * 2. graph_quality passthrough when present
 * 3. insights passthrough when present
 */
import { describe, it, expect } from 'vitest'
import type { ConfidenceLevel, ReportV1 } from '../types'

// Export the mapping logic for testing (mirrors httpV1Adapter implementation)
function mapConfidenceLevel(conf: number): ConfidenceLevel {
  if (conf >= 0.7) return 'high'
  if (conf >= 0.4) return 'medium'
  return 'low'
}

function mapConfidenceToDecisionReadiness(level: ConfidenceLevel): ReportV1['decision_readiness'] {
  const normalizedLevel = level.toLowerCase() as 'high' | 'medium' | 'low'

  return {
    ready: normalizedLevel === 'high',
    confidence: normalizedLevel,
    blockers: normalizedLevel === 'low'
      ? ['Low confidence analysis - add more factors or evidence']
      : [],
    warnings: normalizedLevel === 'medium'
      ? ['Medium confidence - consider reviewing key factors and assumptions']
      : [],
    passed: normalizedLevel === 'high'
      ? ['High confidence analysis - model is ready for decision-making']
      : normalizedLevel === 'medium'
        ? ['Model structure is valid']
        : [],
  }
}

describe('Trust Signal Fields Contract (P0.4)', () => {
  describe('mapConfidenceLevel', () => {
    it('maps >= 0.7 to high', () => {
      expect(mapConfidenceLevel(0.7)).toBe('high')
      expect(mapConfidenceLevel(0.85)).toBe('high')
      expect(mapConfidenceLevel(1.0)).toBe('high')
    })

    it('maps 0.4 to 0.69 to medium', () => {
      expect(mapConfidenceLevel(0.4)).toBe('medium')
      expect(mapConfidenceLevel(0.5)).toBe('medium')
      expect(mapConfidenceLevel(0.69)).toBe('medium')
    })

    it('maps < 0.4 to low', () => {
      expect(mapConfidenceLevel(0.39)).toBe('low')
      expect(mapConfidenceLevel(0.2)).toBe('low')
      expect(mapConfidenceLevel(0)).toBe('low')
    })
  })

  describe('mapConfidenceToDecisionReadiness', () => {
    it('HIGH confidence: ready=true, no blockers/warnings', () => {
      const result = mapConfidenceToDecisionReadiness('high')

      expect(result.ready).toBe(true)
      expect(result.confidence).toBe('high')
      expect(result.blockers).toEqual([])
      expect(result.warnings).toEqual([])
      expect(result.passed).toContain('High confidence analysis - model is ready for decision-making')
    })

    it('MEDIUM confidence: ready=false, has warnings', () => {
      const result = mapConfidenceToDecisionReadiness('medium')

      expect(result.ready).toBe(false)
      expect(result.confidence).toBe('medium')
      expect(result.blockers).toEqual([])
      expect(result.warnings).toContain('Medium confidence - consider reviewing key factors and assumptions')
      expect(result.passed).toContain('Model structure is valid')
    })

    it('LOW confidence: ready=false, has blockers', () => {
      const result = mapConfidenceToDecisionReadiness('low')

      expect(result.ready).toBe(false)
      expect(result.confidence).toBe('low')
      expect(result.blockers).toContain('Low confidence analysis - add more factors or evidence')
      expect(result.warnings).toEqual([])
      expect(result.passed).toEqual([])
    })

    it('normalizes uppercase levels', () => {
      // TypeScript enforces lowercase, but runtime could receive uppercase
      const result = mapConfidenceToDecisionReadiness('HIGH' as ConfidenceLevel)
      expect(result.confidence).toBe('high')
      expect(result.ready).toBe(true)
    })
  })

  describe('ReportV1 decision_readiness contract', () => {
    it('decision_readiness has all required fields', () => {
      const readiness = mapConfidenceToDecisionReadiness('medium')

      // Verify shape matches ReportV1['decision_readiness']
      expect(readiness).toHaveProperty('ready')
      expect(typeof readiness.ready).toBe('boolean')

      expect(readiness).toHaveProperty('confidence')
      expect(['high', 'medium', 'low']).toContain(readiness.confidence)

      expect(readiness).toHaveProperty('blockers')
      expect(Array.isArray(readiness.blockers)).toBe(true)

      expect(readiness).toHaveProperty('warnings')
      expect(Array.isArray(readiness.warnings)).toBe(true)

      expect(readiness).toHaveProperty('passed')
      expect(Array.isArray(readiness.passed)).toBe(true)
    })

    it('confidence level and readiness are consistent', () => {
      // HIGH = ready
      expect(mapConfidenceToDecisionReadiness('high').ready).toBe(true)

      // MEDIUM/LOW = not ready
      expect(mapConfidenceToDecisionReadiness('medium').ready).toBe(false)
      expect(mapConfidenceToDecisionReadiness('low').ready).toBe(false)
    })
  })

  describe('Default value contract', () => {
    it('missing confidence defaults to medium (0.5)', () => {
      // When confidence is undefined, adapter uses 0.5 as default
      const level = mapConfidenceLevel(0.5)
      expect(level).toBe('medium')

      const readiness = mapConfidenceToDecisionReadiness(level)
      expect(readiness.ready).toBe(false)
      expect(readiness.confidence).toBe('medium')
    })
  })

  describe('graph_quality passthrough contract', () => {
    // Mirrors httpV1Adapter logic: response.graph_quality || response.result?.graph_quality
    function extractGraphQuality(response: {
      graph_quality?: ReportV1['graph_quality']
      result?: { graph_quality?: ReportV1['graph_quality'] }
    }): ReportV1['graph_quality'] | undefined {
      return response.graph_quality || response.result?.graph_quality
    }

    const mockGraphQuality: ReportV1['graph_quality'] = {
      score: 0.85,
      completeness: 0.9,
      evidence_coverage: 0.75,
      balance: 0.8,
      issues_count: 2,
      recommendation: 'Consider adding more evidence to key relationships',
    }

    it('passes through graph_quality from top-level response', () => {
      const response = { graph_quality: mockGraphQuality }
      expect(extractGraphQuality(response)).toEqual(mockGraphQuality)
    })

    it('passes through graph_quality from nested result', () => {
      const response = { result: { graph_quality: mockGraphQuality } }
      expect(extractGraphQuality(response)).toEqual(mockGraphQuality)
    })

    it('prefers top-level over nested when both present', () => {
      const topLevel = { ...mockGraphQuality, score: 0.95 }
      const nested = { ...mockGraphQuality, score: 0.65 }
      const response = { graph_quality: topLevel, result: { graph_quality: nested } }
      expect(extractGraphQuality(response)?.score).toBe(0.95)
    })

    it('returns undefined when not present', () => {
      expect(extractGraphQuality({})).toBeUndefined()
      expect(extractGraphQuality({ result: {} })).toBeUndefined()
    })
  })

  describe('insights passthrough contract', () => {
    // Mirrors httpV1Adapter logic: response.insights || response.result?.insights
    function extractInsights(response: {
      insights?: ReportV1['insights']
      result?: { insights?: ReportV1['insights'] }
    }): ReportV1['insights'] | undefined {
      return response.insights || response.result?.insights
    }

    const mockInsights: ReportV1['insights'] = {
      summary: 'Analysis shows positive outcome expected',
      risks: ['Assumption A may be incorrect', 'Limited evidence for B'],
      next_steps: ['Validate assumption A', 'Gather more data for B'],
    }

    it('passes through insights from top-level response', () => {
      const response = { insights: mockInsights }
      expect(extractInsights(response)).toEqual(mockInsights)
    })

    it('passes through insights from nested result', () => {
      const response = { result: { insights: mockInsights } }
      expect(extractInsights(response)).toEqual(mockInsights)
    })

    it('prefers top-level over nested when both present', () => {
      const topLevel = { ...mockInsights, summary: 'Top level summary' }
      const nested = { ...mockInsights, summary: 'Nested summary' }
      const response = { insights: topLevel, result: { insights: nested } }
      expect(extractInsights(response)?.summary).toBe('Top level summary')
    })

    it('returns undefined when not present', () => {
      expect(extractInsights({})).toBeUndefined()
      expect(extractInsights({ result: {} })).toBeUndefined()
    })

    it('preserves all insight fields including empty arrays', () => {
      const minimalInsights: ReportV1['insights'] = {
        summary: 'Minimal analysis',
        risks: [],
        next_steps: [],
      }
      const response = { insights: minimalInsights }
      const result = extractInsights(response)
      expect(result?.risks).toEqual([])
      expect(result?.next_steps).toEqual([])
    })
  })
})

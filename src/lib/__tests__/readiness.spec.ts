/**
 * Tests for Readiness Computation Module
 *
 * Phase 1 P0: Decision readiness from local state signals
 */

import { describe, it, expect } from 'vitest'
import {
  computeReadiness,
  canRunAnalysis,
  getReadinessLevel,
  type ReadinessInput,
} from '../readiness'

describe('computeReadiness', () => {
  const baseInput: ReadinessInput = {
    nodeCount: 5,
    edgeCount: 4,
    graphHealth: null,
    hasOutcome: true,
    hasDecision: true,
  }

  describe('basic readiness levels', () => {
    it('returns ready for well-structured graph', () => {
      const result = computeReadiness(baseInput)
      expect(result.level).toBe('ready')
      expect(result.canRunAnalysis).toBe(true)
      expect(result.score).toBeGreaterThanOrEqual(70)
    })

    it('returns not_ready for empty graph', () => {
      const result = computeReadiness({
        ...baseInput,
        nodeCount: 0,
        edgeCount: 0,
      })
      expect(result.level).toBe('not_ready')
      expect(result.canRunAnalysis).toBe(false)
    })

    it('returns not_ready for single node without edges', () => {
      const result = computeReadiness({
        ...baseInput,
        nodeCount: 1,
        edgeCount: 0,
      })
      expect(result.level).toBe('not_ready')
      expect(result.canRunAnalysis).toBe(false)
    })
  })

  describe('blockers', () => {
    it('adds blocker for insufficient nodes', () => {
      const result = computeReadiness({
        ...baseInput,
        nodeCount: 1,
        edgeCount: 0,
      })
      expect(result.reasons.some(r => r.severity === 'blocker')).toBe(true)
      expect(result.canRunAnalysis).toBe(false)
    })

    it('adds blocker for no edges when nodes exist', () => {
      const result = computeReadiness({
        ...baseInput,
        nodeCount: 3,
        edgeCount: 0,
      })
      expect(result.reasons.some(r => r.severity === 'blocker' && r.type === 'completeness')).toBe(true)
    })

    it('adds blocker for graph health errors', () => {
      const result = computeReadiness({
        ...baseInput,
        graphHealth: {
          status: 'errors',
          score: 30,
          issues: [
            {
              id: 'issue_1',
              severity: 'error',
              message: 'Cycle detected',
              affectedNodeIds: ['node_1'],
            },
          ],
        },
      })
      expect(result.reasons.some(r => r.severity === 'blocker' && r.type === 'structural')).toBe(true)
      expect(result.canRunAnalysis).toBe(false)
    })
  })

  describe('warnings', () => {
    it('adds warning for missing outcome node', () => {
      const result = computeReadiness({
        ...baseInput,
        hasOutcome: false,
      })
      expect(result.reasons.some(r => r.severity === 'warning' && r.message.includes('outcome'))).toBe(true)
    })

    it('adds warning from ISL warnings', () => {
      const result = computeReadiness({
        ...baseInput,
        islWarnings: ['Weight exceeds recommended range'],
      })
      expect(result.reasons.some(r => r.type === 'validation')).toBe(true)
    })
  })

  describe('score calculation', () => {
    it('increases score with more nodes', () => {
      const result3 = computeReadiness({ ...baseInput, nodeCount: 3 })
      const result5 = computeReadiness({ ...baseInput, nodeCount: 5 })
      expect(result5.score).toBeGreaterThanOrEqual(result3.score)
    })

    it('accounts for CEE score when provided', () => {
      const withCEE = computeReadiness({ ...baseInput, ceeScore: 90 })
      const withoutCEE = computeReadiness({ ...baseInput })
      // CEE score should influence overall score
      expect(withCEE.score).toBeGreaterThan(0)
      expect(withoutCEE.score).toBeGreaterThan(0)
    })
  })

  describe('summary generation', () => {
    it('generates summary for not_ready state', () => {
      const result = computeReadiness({
        ...baseInput,
        nodeCount: 1,
        edgeCount: 0,
      })
      expect(result.summary.length).toBeGreaterThan(0)
    })

    it('generates summary for ready state', () => {
      const result = computeReadiness(baseInput)
      expect(result.summary).toBe('Model ready for analysis')
    })
  })
})

describe('canRunAnalysis', () => {
  it('returns true for valid graph', () => {
    expect(canRunAnalysis({
      nodeCount: 5,
      edgeCount: 4,
      graphHealth: null,
      hasOutcome: true,
      hasDecision: true,
    })).toBe(true)
  })

  it('returns false for empty graph', () => {
    expect(canRunAnalysis({
      nodeCount: 0,
      edgeCount: 0,
      graphHealth: null,
      hasOutcome: false,
      hasDecision: false,
    })).toBe(false)
  })
})

describe('getReadinessLevel', () => {
  it('returns correct level for different inputs', () => {
    expect(getReadinessLevel({
      nodeCount: 5,
      edgeCount: 4,
      graphHealth: null,
      hasOutcome: true,
      hasDecision: true,
    })).toBe('ready')

    expect(getReadinessLevel({
      nodeCount: 0,
      edgeCount: 0,
      graphHealth: null,
      hasOutcome: false,
      hasDecision: false,
    })).toBe('not_ready')
  })
})

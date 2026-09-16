import { describe, it, expect } from 'vitest'
import type { GraphHealth } from '../../validation/types'
import type { LimitsStatusResult } from '../limitsStatus'
import { deriveRunEligibility } from '../runEligibility'

function makeHealth(status: GraphHealth['status'], errorCount: number = 0): GraphHealth {
  return {
    status,
    score: status === 'healthy' ? 100 : status === 'warnings' ? 80 : 40,
    issues: Array.from({ length: errorCount }).map((_, i) => ({
      id: `e-${i}`,
      type: 'cycle',
      severity: 'error',
      message: 'Test error'
    }))
  }
}

function makeLimits(zone: LimitsStatusResult['zone']): LimitsStatusResult {
  return {
    zone,
    zoneLabel: zone === 'comfortable' ? 'Comfortable' : zone === 'getting_complex' ? 'Getting complex' : 'At limit',
    message: '',
    nodes: { current: 10, max: 100, percent: 10 },
    edges: { current: 10, max: 100, percent: 10 }
  }
}

describe('deriveRunEligibility', () => {
  it('blocks runs on empty graphs', () => {
    const result = deriveRunEligibility({
      nodeCount: 0,
      edgeCount: 0,
      hasValidationErrors: false,
      graphHealth: null,
      limitsStatus: null
    })

    expect(result.canRun).toBe(false)
    expect(result.reason).toBe('empty')
    expect(result.message).toMatch(/add at least one node/i)
  })

  it('blocks when validation errors are present', () => {
    const result = deriveRunEligibility({
      nodeCount: 3,
      edgeCount: 2,
      hasValidationErrors: true,
      graphHealth: null,
      limitsStatus: null
    })

    expect(result.canRun).toBe(false)
    expect(result.reason).toBe('validation')
    expect(result.message).toMatch(/fix validation issues/i)
  })

  it('blocks when graph health status is errors', () => {
    const health = makeHealth('errors', 2)

    const result = deriveRunEligibility({
      nodeCount: 3,
      edgeCount: 2,
      hasValidationErrors: false,
      graphHealth: health,
      limitsStatus: null
    })

    expect(result.canRun).toBe(false)
    expect(result.reason).toBe('health')
    expect(result.message).toMatch(/resolve 2 graph errors?/i)
  })

  /**
   * ⛔ REWRITTEN 15 Sep 2026, AND THE OLD VERSION IS WHY THE DEFECT SHIPPED.
   *
   * It read `makeLimits('at_limit')` — a fixture that sets the zone STRING
   * directly while leaving `nodes: { current: 10, max: 100, percent: 10 }`.
   * That is a state `deriveLimitsStatus` cannot produce, and the test therefore
   * asserted that **a graph using a tenth of the engine's capacity is correctly
   * refused**. It passed, on a fixture outside the producer's domain, while the
   * product withheld analysis from models the engine could take.
   *
   * The gate now reads the producer's own `max`, so the fixture is built from
   * counts that genuinely exceed it. `makeLimits` is kept for the tests that are
   * about the OTHER block reasons, where the limits object is incidental.
   */
  it('blocks when the graph exceeds the engine’s stated maximum', () => {
    const limits: LimitsStatusResult = {
      ...makeLimits('at_limit'),
      // 120 of 100 edges — over what the producer said it will take.
      edges: { current: 120, max: 100, percent: 120 }
    }

    const result = deriveRunEligibility({
      nodeCount: 10,
      edgeCount: 120,
      hasValidationErrors: false,
      graphHealth: null,
      limitsStatus: limits
    })

    expect(result.canRun).toBe(false)
    expect(result.reason).toBe('limits')
    // The refusal states the producer's figure rather than re-asserting a band.
    expect(result.message).toContain('120')
    expect(result.message).toContain('100')
  })

  it('allows runs when graph is non-empty, healthy, and within limits', () => {
    const limits = makeLimits('comfortable')

    const result = deriveRunEligibility({
      nodeCount: 5,
      edgeCount: 4,
      hasValidationErrors: false,
      graphHealth: makeHealth('healthy', 0),
      limitsStatus: limits
    })

    expect(result.canRun).toBe(true)
    expect(result.reason).toBe('ok')
    expect(result.message).toBe('')
  })
})

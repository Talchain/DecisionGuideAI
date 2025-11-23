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

  it('blocks when limits zone is at_limit', () => {
    const limits = makeLimits('at_limit')

    const result = deriveRunEligibility({
      nodeCount: 10,
      edgeCount: 5,
      hasValidationErrors: false,
      graphHealth: null,
      limitsStatus: limits
    })

    expect(result.canRun).toBe(false)
    expect(result.reason).toBe('limits')
    expect(result.message).toMatch(/simplify this graph/i)
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

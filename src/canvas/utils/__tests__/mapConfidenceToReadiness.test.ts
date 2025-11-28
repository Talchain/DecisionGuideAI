import { describe, it, expect } from 'vitest'
import { mapConfidenceToReadiness } from '../mapConfidenceToReadiness'

describe('mapConfidenceToReadiness', () => {
  it('returns null for undefined confidence', () => {
    expect(mapConfidenceToReadiness(undefined)).toBeNull()
  })

  it('maps HIGH confidence to ready state', () => {
    const result = mapConfidenceToReadiness({ level: 'HIGH', score: 0.8 })
    expect(result).toEqual({
      ready: true,
      confidence: 'high',
      blockers: [],
      warnings: [],
      passed: expect.arrayContaining(['High confidence analysis']),
    })
  })

  it('maps MEDIUM confidence to ready with warnings', () => {
    const result = mapConfidenceToReadiness({
      level: 'MEDIUM',
      reason: 'Some assumptions unverified',
    })
    expect(result?.ready).toBe(true)
    expect(result?.warnings.length).toBeGreaterThan(0)
  })

  it('maps LOW confidence to not ready with blockers', () => {
    const result = mapConfidenceToReadiness({ level: 'LOW' })
    expect(result?.ready).toBe(false)
    expect(result?.blockers.length).toBeGreaterThan(0)
  })

  it('uses reason field when present', () => {
    const reason = 'Key drivers are uncertain'
    const result = mapConfidenceToReadiness({ level: 'LOW', reason })
    expect(result?.blockers).toContain(reason)
  })
})

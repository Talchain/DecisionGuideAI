import { describe, it, expect } from 'vitest'
import type { LimitsV1 } from '../../../adapters/plot/types'
import { deriveLimitsStatus } from '../limitsStatus'

const baseLimits: LimitsV1 = {
  nodes: { max: 200 },
  edges: { max: 500 },
}

describe('deriveLimitsStatus', () => {
  it('returns null when limits are null', () => {
    const result = deriveLimitsStatus(null, 10, 20)
    expect(result).toBeNull()
  })

  it('returns comfortable zone when usage < 70%', () => {
    const result = deriveLimitsStatus(baseLimits, 50, 100) // 25% / 20%
    expect(result).not.toBeNull()
    expect(result!.zone).toBe('comfortable')
    expect(result!.zoneLabel).toBe('Comfortable')
    expect(result!.nodes.percent).toBe(25)
    expect(result!.edges.percent).toBe(20)
  })

  it('returns getting_complex zone when max usage is between 70% and 89%', () => {
    const result = deriveLimitsStatus(baseLimits, 150, 200) // 75% / 40%
    expect(result).not.toBeNull()
    expect(result!.zone).toBe('getting_complex')
    expect(result!.zoneLabel).toBe('Getting complex')
    expect(result!.nodes.percent).toBe(75)
  })

  it('returns at_limit zone when max usage is >= 90%', () => {
    const result = deriveLimitsStatus(baseLimits, 190, 480) // 95% / 96%
    expect(result).not.toBeNull()
    expect(result!.zone).toBe('at_limit')
    expect(result!.zoneLabel).toBe('At limit')
    expect(result!.nodes.percent).toBe(95)
    expect(result!.edges.percent).toBe(96)
  })

  it('uses the highest of node and edge usage to determine zone', () => {
    const result = deriveLimitsStatus(baseLimits, 50, 480) // 25% / 96%
    expect(result).not.toBeNull()
    expect(result!.zone).toBe('at_limit')
  })

  it('provides calm, reassuring messages aligned with zone', () => {
    const comfortable = deriveLimitsStatus(baseLimits, 20, 40)
    const gettingComplex = deriveLimitsStatus(baseLimits, 150, 200)
    const atLimit = deriveLimitsStatus(baseLimits, 190, 480)

    expect(comfortable!.message).toMatch(/comfortably within the engine's recommended range/i)
    expect(gettingComplex!.message).toMatch(/getting complex/i)
    expect(atLimit!.message).toMatch(/at the engine's recommended limit/i)
  })
})

import { describe, expect, it } from 'vitest'
import { readEventRisk } from '../eventRisk'

const valid = {
  version: 1,
  occurrence: {
    p_low: 0.1,
    p_high: 0.3,
    basis: 'user',
    meaning: 'at_least_once_within_horizon',
  },
  horizon: { months: 6 },
}

describe('readEventRisk', () => {
  it('reads a valid event risk', () => {
    expect(readEventRisk({ event_risk: valid })).toEqual({ pLow: 0.1, pHigh: 0.3, months: 6, basis: 'user' })
  })

  it('returns null for an inverted range', () => {
    expect(readEventRisk({ event_risk: { ...valid, occurrence: { ...valid.occurrence, p_low: 0.4 } } })).toBeNull()
  })

  it('returns null for an extra key', () => {
    expect(readEventRisk({ event_risk: { ...valid, extra: true } })).toBeNull()
  })

  it('returns null when the horizon is missing', () => {
    const { horizon: _horizon, ...withoutHorizon } = valid
    expect(readEventRisk({ event_risk: withoutHorizon })).toBeNull()
  })
})

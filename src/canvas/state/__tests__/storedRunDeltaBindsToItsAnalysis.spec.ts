/**
 * A delta must be invisible unless it is about the analysis on screen.
 *
 * Every case here fails SILENTLY in production if the predicate is wrong: the
 * reader sees a real, producer-computed comparison sitting under numbers it was
 * never about, and nothing goes red.
 */
import { describe, it, expect } from 'vitest'
import type { RunDelta } from '@talchain/schemas/boundary'
import { runDeltaDescribesDisplayedAnalysis, type StoredRunDelta } from '../storedRunDelta'

const DELTA = { attribution_case: 'C1_attributable' } as unknown as RunDelta
const stored = (over: Partial<StoredRunDelta> = {}): StoredRunDelta =>
  ({ delta: DELTA, analysisHash: 'hash-A', scenarioId: 'scn-1', ...over })

describe('it describes the displayed analysis', () => {
  it('matches on the same hash and scenario', () => {
    expect(runDeltaDescribesDisplayedAnalysis(stored(), 'hash-A', 'scn-1')).toBe(true)
  })

  it('REFUSES a delta about a superseded analysis', () => {
    expect(runDeltaDescribesDisplayedAnalysis(stored(), 'hash-B', 'scn-1')).toBe(false)
  })

  it('REFUSES a delta from another scenario', () => {
    expect(runDeltaDescribesDisplayedAnalysis(stored(), 'hash-A', 'scn-2')).toBe(false)
  })
})

describe('every absence is fail-closed', () => {
  it('no stored delta', () => {
    expect(runDeltaDescribesDisplayedAnalysis(null, 'hash-A', 'scn-1')).toBe(false)
    expect(runDeltaDescribesDisplayedAnalysis(undefined, 'hash-A', 'scn-1')).toBe(false)
  })

  it('an UNKNOWN displayed hash is not "probably still the same run"', () => {
    expect(runDeltaDescribesDisplayedAnalysis(stored(), undefined, 'scn-1')).toBe(false)
    expect(runDeltaDescribesDisplayedAnalysis(stored(), null, 'scn-1')).toBe(false)
  })

  it('an EMPTY displayed hash is not a match, even against an empty stored one', () => {
    expect(runDeltaDescribesDisplayedAnalysis(stored({ analysisHash: '' }), '', 'scn-1')).toBe(false)
  })
})

describe('a null scenario is a value, not a wildcard', () => {
  it('null stored matches null current', () => {
    expect(runDeltaDescribesDisplayedAnalysis(stored({ scenarioId: null }), 'hash-A', null)).toBe(true)
  })

  it('null stored matches an undefined host (no scenario concept)', () => {
    expect(runDeltaDescribesDisplayedAnalysis(stored({ scenarioId: null }), 'hash-A', undefined)).toBe(true)
  })

  it('⛔ a null stored scenario does NOT match a real one', () => {
    expect(runDeltaDescribesDisplayedAnalysis(stored({ scenarioId: null }), 'hash-A', 'scn-1')).toBe(false)
  })

  it('⛔ a real stored scenario does NOT match a null current', () => {
    expect(runDeltaDescribesDisplayedAnalysis(stored({ scenarioId: 'scn-1' }), 'hash-A', null)).toBe(false)
  })
})

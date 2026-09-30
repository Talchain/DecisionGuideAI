/**
 * ⛔ R3 5903852225 (DL signed-in MRR `8b7f151e`): the wire's 0.9999 printed "100%" on four surfaces. The floor already
 * said "< 1%" at the low end; the high end now mirrors it: a value below 1 never prints "100%".
 */
import { describe, it, expect } from 'vitest'
import { formatGoalProbability } from '../displayFloors'
import { formatProbabilityWithResolution } from '../../../../utils/formatPercent'

describe('a chance below certainty never prints "100%"', () => {
  it('RED: 0.9999 and 0.995 → "> 99%" (goal register, no sample count)', () => {
    expect(formatGoalProbability(0.9999)).toBe('> 99%')
    expect(formatGoalProbability(0.995)).toBe('> 99%')
  })
  it('RED: the comparative register\'s no-count arm too', () => {
    expect(formatProbabilityWithResolution(0.9999, null)).toBe('> 99%')
  })
  it('CONTROL: an exact 1 still prints "100%"; 0.99 prints "99%"; the floor is unchanged', () => {
    expect(formatGoalProbability(1)).toBe('100%')
    expect(formatGoalProbability(0.99)).toBe('99%')
    expect(formatGoalProbability(0.004)).toBe('< 1%')
  })
  it('CONTROL: with a sample count the resolution arm already bounds it', () => {
    expect(formatGoalProbability(0.9999, 10000)).not.toBe('100%')
  })
})

import { describe, it, expect } from 'vitest'
import { maxStdDev01, computeAlignmentPRD } from '@/sandbox/state/voting'

describe('Alignment PRD formula', () => {
  it('maxStdDev01 small N table', () => {
    // n=0,1 => 0
    expect(maxStdDev01(0)).toBe(0)
    expect(maxStdDev01(1)).toBe(0)
    // n=2 => [0,1] mean=0.5 var=(0.25+0.25)/2=0.25 => sd=0.5
    expect(maxStdDev01(2)).toBeCloseTo(0.5, 6)
    // n=3 => [0,1,1]: mean=2/3 var=( (4/9)+ (1/9)+ (1/9) )/3 = 6/27 = 2/9 => sd = sqrt(2/9)
    expect(maxStdDev01(3)).toBeCloseTo(Math.sqrt(2/9), 6)
    // n=4 => [0,0,1,1]: mean=0.5 var=(.25*.5 + .25*.5)=.25 => sd=.5
    expect(maxStdDev01(4)).toBeCloseTo(0.5, 6)
  })

  it('computeAlignmentPRD returns 100 for identical votes and 0 for maximally dispersed', () => {
    const same = computeAlignmentPRD([0.4, 0.4, 0.4], [1, 1, 1])
    expect(same.scoreProb).toBe(100)
    expect(same.scoreConf).toBe(100)
    expect(same.score).toBe(100)

    const maxP = computeAlignmentPRD([0, 1, 1], [1, 1, 1])
    expect(maxP.scoreProb).toBe(0)
    expect(maxP.scoreConf).toBe(100)
    expect(maxP.score).toBe(0)
  })

  it('clamps out-of-range votes into [0,1] before computing std dev', () => {
    const res = computeAlignmentPRD([-1, 2], [2, -1])
    expect(res.scoreProb).toBe(0) // effectively [0,1] => max dispersion => 0
    expect(res.scoreConf).toBe(0)
  })
})

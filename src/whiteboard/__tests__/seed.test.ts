import { describe, it, expect } from 'vitest'
import { pickAssumptions, evenSplit } from '../seed'

describe('seed helpers', () => {
  it('pickAssumptions prefers analysis.frame.assumptions over decision.step_data.assumptions', () => {
    const analysis = { frame: { assumptions: ['A1', 'A2'] } }
    const decision = { step_data: { assumptions: ['B1'] } }
    expect(pickAssumptions(analysis, decision)).toEqual(['A1', 'A2'])
  })

  it('pickAssumptions falls back to decision.step_data.assumptions', () => {
    const analysis = { frame: { } }
    const decision = { step_data: { assumptions: ['B1', 'B2'] } }
    expect(pickAssumptions(analysis, decision)).toEqual(['B1', 'B2'])
  })

  it('pickAssumptions returns [] when none found', () => {
    const analysis = {}
    const decision = {}
    expect(pickAssumptions(analysis, decision)).toEqual([])
  })

  it('evenSplit distributes probability evenly and sums to ~1', () => {
    const n = 3
    const probs = evenSplit(n)
    expect(probs).toHaveLength(n)
    const sum = probs.reduce((a, b) => a + b, 0)
    expect(Math.abs(sum - 1)).toBeLessThan(1e-9)
    // Values should be close to 1/3
    probs.forEach((p) => expect(Math.abs(p - 1 / 3)).toBeLessThan(0.002))
  })
})

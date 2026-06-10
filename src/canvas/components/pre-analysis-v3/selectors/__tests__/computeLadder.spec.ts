import { describe, it, expect } from 'vitest'
import { computeLadder } from '../computeLadder'
import type { LadderInput } from '../../types'

function input(overrides: Partial<LadderInput> = {}): LadderInput {
  return {
    goalPresent: true,
    successSet: true,
    topUncalibrated: null,
    canRunAnalysis: true,
    readinessExplanation: null,
    ...overrides,
  }
}

describe('computeLadder — deterministic priority ladder', () => {
  it('rung 1: goal missing', () => {
    const step = computeLadder(input({ goalPresent: false, successSet: false }))
    expect(step.kind).toBe('set_goal')
  })

  it('rung 2: success unset (goal present)', () => {
    const step = computeLadder(input({ successSet: false }))
    expect(step.kind).toBe('set_success')
  })

  it('rung 3: highest-influence uncalibrated estimate, hedged copy', () => {
    const step = computeLadder(
      input({ topUncalibrated: { id: 'f1', label: 'Tech lead impact' } }),
    )
    expect(step.kind).toBe('calibrate_top')
    expect(step.targetFactorId).toBe('f1')
    expect(step.copy).toContain('Tech lead impact')
    expect(step.copy).toContain('may matter most')
  })

  it('rung 4: readiness blocker mirrors the CEE explanation verbatim', () => {
    const step = computeLadder(
      input({ canRunAnalysis: false, readinessExplanation: 'Two options need target values before analysis.' }),
    )
    expect(step.kind).toBe('readiness_blocker')
    expect(step.copy).toBe('Two options need target values before analysis.')
  })

  it('rung 4 fallback copy when CEE gives no explanation', () => {
    const step = computeLadder(input({ canRunAnalysis: false, readinessExplanation: '  ' }))
    expect(step.kind).toBe('readiness_blocker')
    expect(step.copy).toBe('Analysis is not available yet.')
  })

  it('rung 5: run first', () => {
    expect(computeLadder(input()).kind).toBe('run_first')
  })

  it('precedence: goal beats success beats estimate beats readiness', () => {
    const all = input({
      goalPresent: false,
      successSet: false,
      topUncalibrated: { id: 'f1', label: 'X' },
      canRunAnalysis: false,
    })
    expect(computeLadder(all).kind).toBe('set_goal')
    expect(computeLadder({ ...all, goalPresent: true }).kind).toBe('set_success')
    expect(computeLadder({ ...all, goalPresent: true, successSet: true }).kind).toBe('calibrate_top')
    expect(
      computeLadder({ ...all, goalPresent: true, successSet: true, topUncalibrated: null }).kind,
    ).toBe('readiness_blocker')
  })

  it('loading readiness (null) never gates the ladder', () => {
    expect(computeLadder(input({ canRunAnalysis: null })).kind).toBe('run_first')
  })
})

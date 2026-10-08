import { describe, expect, it } from 'vitest'
import type { AnalysisStateV1 } from '@talchain/schemas/boundary'
import { selectHasRunOnRecord } from '../hasRunOnRecord'

describe('selectHasRunOnRecord: the shared routing fact', () => {
  it.each([
    ['complete_current', true],
    ['complete_stale', true],
    ['never_run', false],
    ['running', false],
    ['failed', false],
    ['refused', false],
    ['queued', false],
  ])('%s with no locally completed Run → %s', (kind, expected) => {
    const analysisStateV1 = { run_state: { kind } } as AnalysisStateV1
    expect(selectHasRunOnRecord({ hasCompletedFirstRun: false, analysisStateV1 })).toBe(expected)
  })

  it('keeps a locally completed Run even without a server verdict', () => {
    expect(selectHasRunOnRecord({ hasCompletedFirstRun: true, analysisStateV1: null })).toBe(true)
  })

  it('no local Run and no server verdict is truly never-run', () => {
    expect(selectHasRunOnRecord({ hasCompletedFirstRun: false, analysisStateV1: null })).toBe(false)
    expect(selectHasRunOnRecord({ hasCompletedFirstRun: false })).toBe(false)
  })
})

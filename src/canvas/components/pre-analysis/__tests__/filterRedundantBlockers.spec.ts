import { describe, it, expect } from 'vitest'
import { filterRedundantBlockers } from '../filterRedundantBlockers'
import type { EnrichedBlocker } from '../blockerEnrichment'

function makeBlocker(code: string): EnrichedBlocker {
  return {
    blocker: { code, message: `${code} message` } as any,
    display: {
      title: code,
      description: '',
      severity: 'warning',
      supportsRetry: false,
      suggestedActions: [],
    },
    sortOrder: 50,
  }
}

describe('filterRedundantBlockers', () => {
  it('returns input unchanged when lastDraftError is null', () => {
    const blockers = [makeBlocker('OPTIONS_NEED_MAPPING')]
    expect(filterRedundantBlockers(blockers, null)).toEqual(blockers)
  })

  it('returns input unchanged when lastDraftError has no code', () => {
    const blockers = [makeBlocker('OPTIONS_NEED_MAPPING')]
    expect(filterRedundantBlockers(blockers, { code: undefined })).toEqual(blockers)
    expect(filterRedundantBlockers(blockers, { code: null })).toEqual(blockers)
  })

  it('returns input unchanged when error code is unknown', () => {
    const blockers = [makeBlocker('OPTIONS_NEED_MAPPING')]
    expect(filterRedundantBlockers(blockers, { code: 'WAT' })).toEqual(blockers)
  })

  it('removes OPTIONS_NEED_MAPPING when draft error is MISSING_INTERVENTIONS', () => {
    const blockers = [
      makeBlocker('OPTIONS_NEED_MAPPING'),
      makeBlocker('CEE_BLOCKER'),
    ]
    const result = filterRedundantBlockers(blockers, { code: 'MISSING_INTERVENTIONS' })
    expect(result).toHaveLength(1)
    expect(result[0].blocker.code).toBe('CEE_BLOCKER')
  })

  it('removes EMPTY_INTERVENTIONS when draft error is MISSING_INTERVENTIONS', () => {
    const blockers = [
      makeBlocker('OPTIONS_NEED_MAPPING'),
      makeBlocker('EMPTY_INTERVENTIONS'),
      makeBlocker('CEE_BLOCKER'),
    ]
    const result = filterRedundantBlockers(blockers, { code: 'MISSING_INTERVENTIONS' })
    expect(result.map(b => b.blocker.code)).toEqual(['CEE_BLOCKER'])
  })

  it('removes self-coded blockers when draft error matches the code', () => {
    const blockers = [makeBlocker('ANALYSIS_NOT_READY'), makeBlocker('CEE_BLOCKER')]
    const result = filterRedundantBlockers(blockers, { code: 'ANALYSIS_NOT_READY' })
    expect(result.map(b => b.blocker.code)).toEqual(['CEE_BLOCKER'])
  })

  it('does not mutate the input array', () => {
    const blockers = [makeBlocker('OPTIONS_NEED_MAPPING'), makeBlocker('CEE_BLOCKER')]
    const before = [...blockers]
    filterRedundantBlockers(blockers, { code: 'MISSING_INTERVENTIONS' })
    expect(blockers).toEqual(before)
  })

  it('removes OPTIONS_NEED_MAPPING when run error is MISSING_INTERVENTIONS (UI-BUG-2)', () => {
    const blockers = [
      makeBlocker('OPTIONS_NEED_MAPPING'),
      makeBlocker('EMPTY_INTERVENTIONS'),
      makeBlocker('CEE_BLOCKER'),
    ]
    const result = filterRedundantBlockers(blockers, null, 'MISSING_INTERVENTIONS')
    expect(result.map(b => b.blocker.code)).toEqual(['CEE_BLOCKER'])
  })

  it('combines draft and run error suppression', () => {
    const blockers = [
      makeBlocker('OPTIONS_NEED_MAPPING'),
      makeBlocker('ANALYSIS_NOT_READY'),
      makeBlocker('CEE_BLOCKER'),
    ]
    const result = filterRedundantBlockers(
      blockers,
      { code: 'ANALYSIS_NOT_READY' },
      'MISSING_INTERVENTIONS',
    )
    expect(result.map(b => b.blocker.code)).toEqual(['CEE_BLOCKER'])
  })

  it('ignores unknown run error codes', () => {
    const blockers = [makeBlocker('OPTIONS_NEED_MAPPING')]
    const result = filterRedundantBlockers(blockers, null, 'WAT')
    expect(result).toEqual(blockers)
  })
})

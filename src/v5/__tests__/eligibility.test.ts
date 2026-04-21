/**
 * V5 eligibility predicate — unit tests.
 *
 * v5-ui-exclusive-path brief (Phase 2): eligibility collapsed to flag-only.
 * Every previously-excluded turn class (system events, chip clicks, retries,
 * post-analysis, prior-tool-calls) is now eligible when the flag is on.
 */

import { describe, it, expect } from 'vitest'
import { isV5Eligible } from '../eligibility'

describe('isV5Eligible (v5-ui-exclusive-path: flag-only)', () => {
  it('returns eligible=true when flag === "true"', () => {
    expect(isV5Eligible({ flag: 'true' })).toEqual({ eligible: true })
  })

  describe('flag-off states', () => {
    it.each([
      ['undefined', undefined],
      ['empty string', ''],
      ['"false"', 'false'],
      ['"1"', '1'],
      ['"True" (wrong case)', 'True'],
      ['"TRUE" (wrong case)', 'TRUE'],
    ])('returns flag_off when flag is %s', (_label, flag) => {
      expect(isV5Eligible({ flag })).toEqual({
        eligible: false,
        reason: 'flag_off',
      })
    })
  })

  describe('previously-gated inputs now all return eligible=true', () => {
    // Pre-brief, these inputs would have returned {eligible:false,reason:<X>}.
    // Post-brief, eligibility is flag-only, so all of them must be eligible
    // when flag === 'true'. These tests lock the behaviour against regression.
    it('eligible when flag is on regardless of mode, chipMeta, turnType, source, analysis state, history', () => {
      // The predicate signature is now {flag} only — callers that used to
      // pass mode/chipMeta/turnType/source/analysisStateReady/resultsStatus/
      // messages no longer provide them. The flag-on result is the only
      // outcome that matters.
      expect(isV5Eligible({ flag: 'true' })).toEqual({ eligible: true })
    })
  })
})

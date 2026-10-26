/**
 * The CEE `analysis_ready.status` vocabulary: ONE recorded list, and every consumer reads it.
 *
 * CEE's `AnalysisReadyStatus` is not exported by `@talchain/schemas`, so `ANALYSIS_READY_STATUSES` is a RECORDED mirror,
 * and per trap 12 it must fail LOUD rather than assume good. These rows pin it to the producer's exact five and check the
 * two consumers that kept their own copies (the display-state helper and the coherence module) derive from it.
 *
 * Kept from `usePreRunValidation.blockedStatus.spec.ts` (U2, 26 Oct 2026): its other rows went with the client run
 * validator.
 */
import { describe, it, expect } from 'vitest'
import {
  ANALYSIS_READY_STATUSES,
  ANALYSIS_READY_STATUS_UNSUPPLIED,
  RECOGNISED_ANALYSIS_READY_STATUSES,
} from '../../../adapters/cee/types'
import { KNOWN_READINESS_STATUSES } from '../../../lib/coherence/crossSurfaceCoherence'
import { deriveAnalysisDisplayState } from '../../utils/deriveAnalysisDisplayState'

describe('THE DRIFT GUARD — one recorded vocabulary', () => {
  it('pins the recorded vocabulary to CEE AnalysisReadyStatus — exactly five, in producer order', () => {
    // cee src/schemas/analysis-ready.ts:220-227, read at CEE staging 83a11574.
    expect([...ANALYSIS_READY_STATUSES]).toEqual([
      'ready',
      'needs_user_mapping',
      'needs_encoding',
      'needs_user_input',
      'blocked',
    ])
  })

  it("'unknown' is the UI's own sentinel and is NOT part of the producer vocabulary", () => {
    // applyV5State.ts:262 mints it when CEE sends no usable status. Recording
    // it as a producer value would assert CEE emits a verdict it never emits.
    expect(ANALYSIS_READY_STATUSES as readonly string[]).not.toContain(
      ANALYSIS_READY_STATUS_UNSUPPLIED,
    )
    expect(RECOGNISED_ANALYSIS_READY_STATUSES).toContain(ANALYSIS_READY_STATUS_UNSUPPLIED)
    expect(RECOGNISED_ANALYSIS_READY_STATUSES).toHaveLength(
      ANALYSIS_READY_STATUSES.length + 1,
    )
  })

  it('the display-state helper derives its not-ready set from the SAME vocabulary', () => {
    // `deriveAnalysisDisplayState` kept a fifth copy of the producer enum (its
    // negative half). Deriving the complement means a status CEE adds later
    // renders not-ready rather than a green "Analysis complete".
    for (const status of ANALYSIS_READY_STATUSES) {
      const { state } = deriveAnalysisDisplayState({
        ceeAnalysisReadyStatus: status,
        hasReport: true,
        analysisChanged: false,
      })
      if (status === 'ready') {
        expect(state, `"${status}" must not be forced not_ready`).not.toBe('not_ready')
      } else {
        expect(state, `"${status}" must render not_ready even with a prior report`).toBe('not_ready')
      }
    }
  })

  it('the coherence module reads the SAME vocabulary — the two lists cannot disagree', () => {
    // crossSurfaceCoherence kept a second copy of the producer enum. It now
    // spreads this one, so a change here reaches both surfaces at once.
    for (const status of ANALYSIS_READY_STATUSES) {
      expect(KNOWN_READINESS_STATUSES).toContain(status)
    }
    expect(KNOWN_READINESS_STATUSES).toHaveLength(ANALYSIS_READY_STATUSES.length + 1)
  })
})

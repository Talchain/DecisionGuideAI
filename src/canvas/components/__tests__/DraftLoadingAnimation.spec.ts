/**
 * Tests for DraftLoadingAnimation status messaging.
 *
 * Tests the pure `messageForElapsed` function that resolves time-based
 * status messages without needing React rendering.
 *
 * The HONESTY properties of this copy (no pipeline-phase claim, no claim
 * about the user's decision, no comparative/forecast, no completion
 * proximity) are pinned separately and CROSS-SURFACE in
 * `narrationHonesty.invariant.spec.ts`, which holds this table and the
 * analysis banner's table to the same bar. This file pins resolution
 * mechanics and the exact strings.
 */

import { describe, it, expect } from 'vitest'
import { messageForElapsed, PROGRESSIVE_STAGES } from '../DraftLoadingAnimation'

const STAGE_1 = 'Drafting your decision model…'
const STAGE_2 = 'Still drafting your decision model…'
const STAGE_3 = 'Still drafting — complex decisions can take a while…'

describe('messageForElapsed', () => {
  it('returns stage 1 message at 0 seconds', () => {
    expect(messageForElapsed(0)).toBe(STAGE_1)
  })

  it('returns stage 1 message at 19 seconds', () => {
    expect(messageForElapsed(19)).toBe(STAGE_1)
  })

  it('returns stage 2 message at 20 seconds', () => {
    expect(messageForElapsed(20)).toBe(STAGE_2)
  })

  it('returns stage 2 message at 44 seconds', () => {
    expect(messageForElapsed(44)).toBe(STAGE_2)
  })

  it('returns stage 3 message at 45 seconds', () => {
    expect(messageForElapsed(45)).toBe(STAGE_3)
  })

  /**
   * The last line has to hold all the way to the client timeout — it is the
   * one the user stares at on a bad draft, and it must still be true there.
   */
  it('holds the final message indefinitely, including past the client timeout', () => {
    expect(messageForElapsed(60)).toBe(STAGE_3)
    expect(messageForElapsed(120)).toBe(STAGE_3)
    expect(messageForElapsed(130)).toBe(STAGE_3)
    expect(messageForElapsed(600)).toBe(STAGE_3)
  })

  it('handles negative elapsed time gracefully', () => {
    expect(messageForElapsed(-1)).toBe(STAGE_1)
  })
})

describe('PROGRESSIVE_STAGES', () => {
  it('exposes exactly the three honest stages, in order', () => {
    expect(PROGRESSIVE_STAGES.map((s) => s.message)).toEqual([STAGE_1, STAGE_2, STAGE_3])
    expect(PROGRESSIVE_STAGES.map((s) => s.afterSeconds)).toEqual([0, 20, 45])
  })

  it('stages are in ascending order by afterSeconds', () => {
    for (let i = 1; i < PROGRESSIVE_STAGES.length; i++) {
      expect(PROGRESSIVE_STAGES[i].afterSeconds).toBeGreaterThan(
        PROGRESSIVE_STAGES[i - 1].afterSeconds
      )
    }
  })

  it('first stage starts at 0 seconds', () => {
    expect(PROGRESSIVE_STAGES[0].afterSeconds).toBe(0)
  })
})

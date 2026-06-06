/**
 * Tests for DraftLoadingAnimation progressive status messaging.
 *
 * Tests the pure `messageForElapsed` function that resolves
 * time-based status messages without needing React rendering.
 */

import { describe, it, expect } from 'vitest'
import { messageForElapsed, PROGRESSIVE_STAGES } from '../DraftLoadingAnimation'

describe('messageForElapsed', () => {
  it('returns stage 1 message at 0 seconds', () => {
    expect(messageForElapsed(0)).toBe('Generating your decision model…')
  })

  it('returns stage 1 message at 14 seconds', () => {
    expect(messageForElapsed(14)).toBe('Generating your decision model…')
  })

  it('returns stage 2 message at 15 seconds', () => {
    expect(messageForElapsed(15)).toBe('Mapping factors and causal relationships…')
  })

  it('returns stage 2 message at 29 seconds', () => {
    expect(messageForElapsed(29)).toBe('Mapping factors and causal relationships…')
  })

  it('returns stage 3 message at 30 and 44 seconds', () => {
    expect(messageForElapsed(30)).toBe('Assessing options, risks and potential outcomes')
    expect(messageForElapsed(44)).toBe('Assessing options, risks and potential outcomes')
  })

  it('returns stage 4 message at 45 and 59 seconds', () => {
    expect(messageForElapsed(45)).toBe(
      'This is a complex decision - building a thorough model…'
    )
    expect(messageForElapsed(59)).toBe(
      'This is a complex decision - building a thorough model…'
    )
  })

  it('returns stage 5 message at 60 and 120 seconds', () => {
    expect(messageForElapsed(60)).toBe(
      'Still working - complex briefs can take up to two minutes.'
    )
    expect(messageForElapsed(120)).toBe(
      'Still working - complex briefs can take up to two minutes.'
    )
  })

  it('handles negative elapsed time gracefully', () => {
    expect(messageForElapsed(-1)).toBe('Generating your decision model…')
  })
})

describe('PROGRESSIVE_STAGES', () => {
  it('has exactly 5 stages', () => {
    expect(PROGRESSIVE_STAGES).toHaveLength(5)
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

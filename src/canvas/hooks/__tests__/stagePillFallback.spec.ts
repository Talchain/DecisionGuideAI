/**
 * Tests for useStagePill fallback stage derivation (UI-SEM-020)
 *
 * Tests the pure deriveStageFromState function which maps
 * (hasNodes, isComplete) → ScenarioStage.
 */

import { describe, it, expect } from 'vitest'
import { deriveStageFromState } from '../useStagePill'

describe('deriveStageFromState (UI-SEM-020)', () => {
  it('returns "frame" when there are no nodes', () => {
    expect(deriveStageFromState(false, false)).toBe('frame')
  })

  it('returns "frame" when no nodes even if complete', () => {
    // Edge case: complete with no nodes shouldn't happen, but fallback is safe
    expect(deriveStageFromState(false, true)).toBe('frame')
  })

  it('returns "ideate" when nodes exist but analysis is not complete', () => {
    expect(deriveStageFromState(true, false)).toBe('ideate')
  })

  it('returns "evaluate" when nodes exist and analysis is complete', () => {
    expect(deriveStageFromState(true, true)).toBe('evaluate')
  })

  it('never returns "decide" or "optimise" (requires orchestrator)', () => {
    const allCombinations = [
      [false, false],
      [false, true],
      [true, false],
      [true, true],
    ] as const

    for (const [hasNodes, isComplete] of allCombinations) {
      const stage = deriveStageFromState(hasNodes, isComplete)
      expect(stage).not.toBe('decide')
      expect(stage).not.toBe('optimise')
    }
  })
})

/**
 * stateSelection — deterministic hero-state selection tests.
 * Per investigation §10 + §15.2. Covers each state branch and every
 * threshold + data-absence fallback.
 */

import { describe, it, expect } from 'vitest'
import { selectHeroState, type StateSelectionInputs } from '../stateSelection'

function base(overrides: Partial<StateSelectionInputs> = {}): StateSelectionInputs {
  return {
    hasWinner: true,
    decisionState: 'robust',
    stability: 0.9,
    evidenceGapCount: 0,
    fragileEdgeCount: 0,
    optionCount: 3,
    biasFindings: 0,
    framingFlag: false,
    ...overrides,
  }
}

describe('selectHeroState', () => {
  describe('WEAK', () => {
    it('no winner → weak', () => {
      expect(selectHeroState(base({ hasWinner: false }))).toBe('weak')
    })

    it('low stability AND many gaps → weak', () => {
      expect(selectHeroState(base({ stability: 0.4, evidenceGapCount: 3 }))).toBe('weak')
    })

    it('low stability AND just enough gaps (exactly 3) → weak', () => {
      expect(selectHeroState(base({ stability: 0.49, evidenceGapCount: 3 }))).toBe('weak')
    })

    it('many gaps regardless of stability → weak', () => {
      expect(selectHeroState(base({ stability: 0.9, evidenceGapCount: 4 }))).toBe('weak')
    })

    it('single option → weak', () => {
      expect(selectHeroState(base({ optionCount: 1 }))).toBe('weak')
    })

    it('zero options → weak', () => {
      expect(selectHeroState(base({ optionCount: 0 }))).toBe('weak')
    })
  })

  describe('STRONG', () => {
    // Trust fix (ROBUSTNESS-VERDICT-CONTRACT): the confident 'strong' posture
    // now also requires the display-safe robustnessVerdict === 'robust'. The
    // strong-expecting cases below pass it explicitly; the no-verdict / non-high
    // cases are covered in "STRONG requires the display-safe verdict" below.
    it('high stability + no gaps + no fragile edges + verdict high → strong', () => {
      expect(selectHeroState(base({ stability: 0.9, evidenceGapCount: 0, fragileEdgeCount: 0, robustnessVerdict: 'robust' }))).toBe('strong')
    })

    it('exactly 0.85 stability + 1 gap + no fragile + verdict high → strong (boundary)', () => {
      expect(selectHeroState(base({ stability: 0.85, evidenceGapCount: 1, fragileEdgeCount: 0, robustnessVerdict: 'robust' }))).toBe('strong')
    })

    it('just below 0.85 stability → NOT strong', () => {
      expect(selectHeroState(base({ stability: 0.849, evidenceGapCount: 0, robustnessVerdict: 'robust' }))).not.toBe('strong')
    })

    it('any fragile edge breaks strong', () => {
      expect(selectHeroState(base({ stability: 0.9, evidenceGapCount: 0, fragileEdgeCount: 1, robustnessVerdict: 'robust' }))).not.toBe('strong')
    })

    it('2+ gaps breaks strong', () => {
      expect(selectHeroState(base({ stability: 0.9, evidenceGapCount: 2, robustnessVerdict: 'robust' }))).not.toBe('strong')
    })
  })

  describe('STRONG requires the display-safe verdict (trust fix)', () => {
    it('high stability + no gaps + no fragile but NO verdict → NOT strong (neutral moderate)', () => {
      // Raw stability alone must not unlock the confident "ready to brief"
      // posture. With robustnessVerdict undefined (the live contract today) the
      // hero falls back to the neutral 'moderate' state.
      const state = selectHeroState(base({ stability: 0.95, evidenceGapCount: 0, fragileEdgeCount: 0, robustnessVerdict: undefined, decisionState: 'sensitive' }))
      expect(state).not.toBe('strong')
      expect(state).toBe('moderate')
    })

    it('high stability + good signals but verdict is "low"/"moderate"/"very_low" → NOT strong', () => {
      for (const verdict of ['low', 'moderate', 'very_low'] as const) {
        expect(
          selectHeroState(base({ stability: 0.95, evidenceGapCount: 0, fragileEdgeCount: 0, robustnessVerdict: verdict, decisionState: 'sensitive' })),
        ).not.toBe('strong')
      }
    })
  })

  describe('REFLECT', () => {
    it('robust + bias findings → reflect', () => {
      expect(selectHeroState(base({ decisionState: 'robust', biasFindings: 1, stability: 0.7 }))).toBe('reflect')
    })

    it('robust + framing flag → reflect', () => {
      expect(selectHeroState(base({ decisionState: 'robust', framingFlag: true, stability: 0.7 }))).toBe('reflect')
    })

    it('sensitive decisionState + bias findings → NOT reflect (drops to moderate)', () => {
      expect(selectHeroState(base({ decisionState: 'sensitive', biasFindings: 2, stability: 0.7 }))).toBe('moderate')
    })

    it('indeterminate decisionState + bias findings → moderate (not reflect)', () => {
      expect(selectHeroState(base({ decisionState: 'indeterminate', biasFindings: 1, stability: 0.7 }))).toBe('moderate')
    })

    it('robust but reflect signals would also satisfy strong → strong wins (with display-safe verdict)', () => {
      expect(selectHeroState(base({ decisionState: 'robust', biasFindings: 1, stability: 0.9, evidenceGapCount: 0, fragileEdgeCount: 0, robustnessVerdict: 'robust' }))).toBe('strong')
    })
  })

  describe('MODERATE', () => {
    it('default mid-range → moderate', () => {
      expect(selectHeroState(base({ stability: 0.6, evidenceGapCount: 2 }))).toBe('moderate')
    })

    it('sensitive decisionState without weak triggers → moderate', () => {
      expect(selectHeroState(base({ decisionState: 'sensitive', stability: 0.7, evidenceGapCount: 1 }))).toBe('moderate')
    })
  })

  describe('null stability', () => {
    it('null stability + many gaps still triggers weak (4+)', () => {
      expect(selectHeroState(base({ stability: null, evidenceGapCount: 4 }))).toBe('weak')
    })

    it('null stability + 3 gaps does NOT trigger weak (low-stability rule needs a number)', () => {
      expect(selectHeroState(base({ stability: null, evidenceGapCount: 3 }))).toBe('moderate')
    })

    it('null stability cannot satisfy strong', () => {
      expect(selectHeroState(base({ stability: null, evidenceGapCount: 0, fragileEdgeCount: 0 }))).toBe('moderate')
    })
  })
})

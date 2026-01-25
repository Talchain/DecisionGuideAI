import { describe, it, expect } from 'vitest'
import { formatScenarioRatio, formatFlipRiskMessage } from '../formatScenarioRatio'

// =============================================================================
// Task 1.8: Scenario Ratio Formatting Tests
// =============================================================================

describe('formatScenarioRatio', () => {
  describe('percentage format (probability >= 0.5)', () => {
    it('formats 0.6 as "~60% of scenarios tested"', () => {
      expect(formatScenarioRatio(0.6)).toBe('~60% of scenarios tested')
    })

    it('formats 0.5 as "~50% of scenarios tested"', () => {
      expect(formatScenarioRatio(0.5)).toBe('~50% of scenarios tested')
    })

    it('formats 0.85 as "~85% of scenarios tested"', () => {
      expect(formatScenarioRatio(0.85)).toBe('~85% of scenarios tested')
    })

    it('formats 1.0 as "~100% of scenarios tested"', () => {
      expect(formatScenarioRatio(1.0)).toBe('~100% of scenarios tested')
    })
  })

  describe('boundary at 0.5', () => {
    it('returns percentage format for exactly 0.5', () => {
      expect(formatScenarioRatio(0.5)).toBe('~50% of scenarios tested')
    })

    it('returns ratio format for 0.49 (just below boundary)', () => {
      expect(formatScenarioRatio(0.49)).toBe('~1 in 2 scenarios tested')
    })

    it('returns percentage format for 0.51 (just above boundary)', () => {
      expect(formatScenarioRatio(0.51)).toBe('~51% of scenarios tested')
    })
  })

  describe('ratio format (probability < 0.5)', () => {
    it('formats 0.2 as "~1 in 5 scenarios tested"', () => {
      expect(formatScenarioRatio(0.2)).toBe('~1 in 5 scenarios tested')
    })

    it('formats 0.1 as "~1 in 10 scenarios tested"', () => {
      expect(formatScenarioRatio(0.1)).toBe('~1 in 10 scenarios tested')
    })

    it('formats 0.25 as "~1 in 4 scenarios tested"', () => {
      expect(formatScenarioRatio(0.25)).toBe('~1 in 4 scenarios tested')
    })

    it('formats 0.33 as "~1 in 3 scenarios tested"', () => {
      expect(formatScenarioRatio(0.33)).toBe('~1 in 3 scenarios tested')
    })
  })

  describe('edge case guards', () => {
    it('returns null for probability = 0', () => {
      expect(formatScenarioRatio(0)).toBeNull()
    })

    it('returns null for probability < 0', () => {
      expect(formatScenarioRatio(-0.5)).toBeNull()
    })

    it('clamps probability > 1 to 100%', () => {
      expect(formatScenarioRatio(1.5)).toBe('~100% of scenarios tested')
    })

    it('returns null for undefined', () => {
      expect(formatScenarioRatio(undefined)).toBeNull()
    })

    it('returns null for null', () => {
      expect(formatScenarioRatio(null)).toBeNull()
    })

    it('returns null for NaN', () => {
      expect(formatScenarioRatio(NaN)).toBeNull()
    })
  })
})

describe('formatFlipRiskMessage', () => {
  describe('valid inputs - scenario-tested language', () => {
    it('formats probability < 0.5 with ratio format', () => {
      expect(formatFlipRiskMessage(0.35, 'Option B')).toBe(
        'In ~1 in 3 scenarios tested, "Option B" becomes the better choice'
      )
    })

    it('formats probability >= 0.5 with percentage format', () => {
      expect(formatFlipRiskMessage(0.6, 'Alternative Plan')).toBe(
        'In ~60% of scenarios tested, "Alternative Plan" becomes the better choice'
      )
    })

    it('formats exactly 0.5 with percentage format', () => {
      expect(formatFlipRiskMessage(0.5, 'Status Quo')).toBe(
        'In ~50% of scenarios tested, "Status Quo" becomes the better choice'
      )
    })
  })

  describe('edge case guards', () => {
    it('returns null for probability = 0', () => {
      expect(formatFlipRiskMessage(0, 'Option B')).toBeNull()
    })

    it('returns null for probability < 0', () => {
      expect(formatFlipRiskMessage(-0.1, 'Option B')).toBeNull()
    })

    it('clamps probability > 1 to 100%', () => {
      expect(formatFlipRiskMessage(1.5, 'Option B')).toBe(
        'In ~100% of scenarios tested, "Option B" becomes the better choice'
      )
    })

    it('returns null for undefined probability', () => {
      expect(formatFlipRiskMessage(undefined, 'Option B')).toBeNull()
    })

    it('returns null for null probability', () => {
      expect(formatFlipRiskMessage(null, 'Option B')).toBeNull()
    })

    it('returns null for NaN probability', () => {
      expect(formatFlipRiskMessage(NaN, 'Option B')).toBeNull()
    })
  })

  describe('alternative label validation', () => {
    it('returns null when alternative is undefined', () => {
      expect(formatFlipRiskMessage(0.5, undefined)).toBeNull()
    })

    it('returns null when alternative is empty string', () => {
      expect(formatFlipRiskMessage(0.5, '')).toBeNull()
    })

    it('returns null when alternative is whitespace only', () => {
      expect(formatFlipRiskMessage(0.5, '   ')).toBeNull()
    })

    it('returns null when alternative is "another option" (generic fallback)', () => {
      expect(formatFlipRiskMessage(0.5, 'another option')).toBeNull()
    })
  })
})

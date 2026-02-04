/**
 * Tests for cleanFactorLabel utility
 * Task 7: Encoding leak fix - strips technical encoding patterns from labels
 */

import { describe, it, expect } from 'vitest'
import { cleanFactorLabel, stripEncodingNotation } from '../cleanFactorLabel'

describe('cleanFactorLabel', () => {
  describe('binary patterns', () => {
    it('strips (0/1) and adds Yes/No qualifier', () => {
      const result = cleanFactorLabel('Tech Lead Hired (0/1)')
      expect(result.label).toBe('Tech Lead Hired')
      expect(result.qualifier).toBe('Yes/No')
    })

    it('strips (0 or 1) and adds Yes/No qualifier', () => {
      const result = cleanFactorLabel('Feature Enabled (0 or 1)')
      expect(result.label).toBe('Feature Enabled')
      expect(result.qualifier).toBe('Yes/No')
    })

    it('strips (yes/no) and adds Yes/No qualifier', () => {
      const result = cleanFactorLabel('Approval Status (yes/no)')
      expect(result.label).toBe('Approval Status')
      expect(result.qualifier).toBe('Yes/No')
    })

    it('strips (binary) and adds Yes/No qualifier', () => {
      const result = cleanFactorLabel('Switch State (binary)')
      expect(result.label).toBe('Switch State')
      expect(result.qualifier).toBe('Yes/No')
    })

    it('strips (on/off) and adds On/Off qualifier', () => {
      const result = cleanFactorLabel('Feature Toggle (on/off)')
      expect(result.label).toBe('Feature Toggle')
      expect(result.qualifier).toBe('On/Off')
    })

    it('strips (true/false) and adds True/False qualifier', () => {
      const result = cleanFactorLabel('Debug Mode (true/false)')
      expect(result.label).toBe('Debug Mode')
      expect(result.qualifier).toBe('True/False')
    })
  })

  describe('range patterns with context', () => {
    it('strips (0-1, relative scale)', () => {
      const result = cleanFactorLabel('Confidence Level (0–1, relative scale)')
      expect(result.label).toBe('Confidence Level')
      expect(result.qualifier).toBeUndefined()
    })

    it('strips (0-1, share of £20k cap)', () => {
      const result = cleanFactorLabel('Advertising Budget (0–1, share of £20k cap)')
      expect(result.label).toBe('Advertising Budget')
      expect(result.qualifier).toBeUndefined()
    })

    it('strips (0-1, share of $50k cap)', () => {
      const result = cleanFactorLabel('Marketing Spend (0-1, share of $50k cap)')
      expect(result.label).toBe('Marketing Spend')
      expect(result.qualifier).toBeUndefined()
    })
  })

  describe('simple range patterns', () => {
    it('strips (0-1)', () => {
      const result = cleanFactorLabel('Probability (0–1)')
      expect(result.label).toBe('Probability')
      expect(result.qualifier).toBeUndefined()
    })

    it('strips (0-100)', () => {
      const result = cleanFactorLabel('Market Size (0–100)')
      expect(result.label).toBe('Market Size')
      expect(result.qualifier).toBeUndefined()
    })

    it('strips (0-10)', () => {
      const result = cleanFactorLabel('Rating (0–10)')
      expect(result.label).toBe('Rating')
      expect(result.qualifier).toBeUndefined()
    })

    it('strips generic numeric ranges like (1-5)', () => {
      const result = cleanFactorLabel('Score (1-5)')
      expect(result.label).toBe('Score')
      expect(result.qualifier).toBeUndefined()
    })

    it('strips ranges with en-dash', () => {
      const result = cleanFactorLabel('Value (10–20)')
      expect(result.label).toBe('Value')
      expect(result.qualifier).toBeUndefined()
    })
  })

  describe('edge cases', () => {
    it('returns original label when no pattern matches', () => {
      const result = cleanFactorLabel('Simple Label')
      expect(result.label).toBe('Simple Label')
      expect(result.qualifier).toBeUndefined()
    })

    it('handles empty string', () => {
      const result = cleanFactorLabel('')
      expect(result.label).toBe('')
      expect(result.qualifier).toBeUndefined()
    })

    it('handles null-like input', () => {
      const result = cleanFactorLabel(null as unknown as string)
      expect(result.label).toBe('')
    })

    it('handles undefined input', () => {
      const result = cleanFactorLabel(undefined as unknown as string)
      expect(result.label).toBe('')
    })

    it('trims whitespace after stripping', () => {
      const result = cleanFactorLabel('  Tech Lead  (0/1)  ')
      expect(result.label).toBe('Tech Lead')
      expect(result.qualifier).toBe('Yes/No')
    })

    it('is case insensitive', () => {
      const result = cleanFactorLabel('Toggle (BINARY)')
      expect(result.label).toBe('Toggle')
      expect(result.qualifier).toBe('Yes/No')
    })

    it('only strips first matching pattern', () => {
      // This shouldn't happen in practice, but tests the break behavior
      const result = cleanFactorLabel('Label (0/1)')
      expect(result.label).toBe('Label')
      expect(result.qualifier).toBe('Yes/No')
    })
  })
})

describe('stripEncodingNotation', () => {
  it('returns just the cleaned label string', () => {
    expect(stripEncodingNotation('Tech Lead Hired (0/1)')).toBe('Tech Lead Hired')
  })

  it('returns original for non-matching labels', () => {
    expect(stripEncodingNotation('Simple Label')).toBe('Simple Label')
  })

  it('handles empty string', () => {
    expect(stripEncodingNotation('')).toBe('')
  })
})

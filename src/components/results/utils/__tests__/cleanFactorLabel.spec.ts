/**
 * Tests for cleanFactorLabel utility
 * Task 7: Encoding leak fix - strips technical encoding patterns from labels
 */

import { describe, it, expect } from 'vitest'
import { cleanFactorLabel, stripEncodingNotation, sanitizeCoachingText } from '../cleanFactorLabel'

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

/**
 * P1 Brief Task B: Comprehensive production payload tests
 * These exact strings are from real production payloads
 */
describe('production payload patterns (P1 Task B)', () => {
  it('strips (0–1, share of £200k cap) with en-dash', () => {
    const result = cleanFactorLabel('Regulatory Compliance Cost (0–1, share of £200k cap)')
    expect(result.label).toBe('Regulatory Compliance Cost')
  })

  it('strips (0–1 qualitative scale) without comma', () => {
    const result = cleanFactorLabel('Competitive Response Intensity (0–1 qualitative scale)')
    expect(result.label).toBe('Competitive Response Intensity')
  })

  it('strips another (0–1 qualitative scale) variant', () => {
    const result = cleanFactorLabel('Currency Fluctuation Impact (0–1 qualitative scale)')
    expect(result.label).toBe('Currency Fluctuation Impact')
  })

  it('strips (0/1) boolean encoding', () => {
    expect(stripEncodingNotation('Tech Lead Hired (0/1)')).toBe('Tech Lead Hired')
  })

  it('strips another (0/1) boolean encoding', () => {
    expect(stripEncodingNotation('Developers Hired (0/1)')).toBe('Developers Hired')
  })

  it('strips (0–1, share of £100k cap)', () => {
    const result = cleanFactorLabel('Advertising Spend (0–1, share of £100k cap)')
    expect(result.label).toBe('Advertising Spend')
  })

  it('strips (0-1) with ASCII hyphen', () => {
    const result = cleanFactorLabel('Some Factor (0-1)')
    expect(result.label).toBe('Some Factor')
  })

  it('preserves labels without encoding', () => {
    const result = cleanFactorLabel('No Encoding Here')
    expect(result.label).toBe('No Encoding Here')
  })

  // Additional edge cases from production
  it('strips (0–1) bare encoding with en-dash', () => {
    const result = cleanFactorLabel('Market Share (0–1)')
    expect(result.label).toBe('Market Share')
  })

  it('strips pattern in middle of label (edge case)', () => {
    // Should not happen in production, but test defensively
    const result = cleanFactorLabel('Factor A (0/1) Description')
    expect(result.label).toBe('Factor A Description')
  })
})

// V12.1 Fix 2: Discrete encoding pattern
describe('discrete encoding patterns (V12.1 Fix 2)', () => {
  it('strips (0=Developers, 1=Tech Lead)', () => {
    const result = cleanFactorLabel('Team Structure (0=Developers, 1=Tech Lead)')
    expect(result.label).toBe('Team Structure')
  })

  it('strips (0=Low, 1=Medium, 2=High)', () => {
    const result = cleanFactorLabel('Priority (0=Low, 1=Medium, 2=High)')
    expect(result.label).toBe('Priority')
  })

  it('strips (0=No, 1=Yes)', () => {
    const result = cleanFactorLabel('Approval (0=No, 1=Yes)')
    expect(result.label).toBe('Approval')
  })

  it('preserves labels with parenthetical non-encoding text', () => {
    // Parenthetical text that does NOT start with digit= should be preserved
    const result = cleanFactorLabel('Revenue (annual)')
    expect(result.label).toBe('Revenue (annual)')
  })

  // V14.1: Decimal encoding patterns
  it('strips (0=Cat, 0.94=Dog) with decimal keys', () => {
    const result = cleanFactorLabel('Pet Type (0=Cat, 0.94=Dog)')
    expect(result.label).toBe('Pet Type')
  })

  it('strips (0=Low, 0.5=Med, 1=High) with decimal keys', () => {
    const result = cleanFactorLabel('Risk (0=Low, 0.5=Med, 1=High)')
    expect(result.label).toBe('Risk')
  })

  it('strips (0=Off, 1=On) integer case still works', () => {
    const result = cleanFactorLabel('Status (0=Off, 1=On)')
    expect(result.label).toBe('Status')
  })
})

// V12: sanitizeCoachingText
describe('sanitizeCoachingText', () => {
  it('replaces Unicode right arrow (U+2192) with "to"', () => {
    expect(sanitizeCoachingText('Factor A \u2192 Factor B')).toBe('Factor A to Factor B')
  })

  it('replaces ASCII arrow (->) with "to"', () => {
    expect(sanitizeCoachingText('Factor A -> Factor B')).toBe('Factor A to Factor B')
  })

  it('handles multiple arrows', () => {
    expect(sanitizeCoachingText('A \u2192 B \u2192 C')).toBe('A to B to C')
  })

  it('returns empty string for empty input', () => {
    expect(sanitizeCoachingText('')).toBe('')
  })

  it('trims whitespace', () => {
    expect(sanitizeCoachingText('  Factor A  ')).toBe('Factor A')
  })

  it('leaves non-arrow text unchanged', () => {
    expect(sanitizeCoachingText('Validate your pricing model')).toBe('Validate your pricing model')
  })

  // V12.1 Fix 2: sanitizeCoachingText now also strips encoding notation
  it('strips encoding notation alongside arrows', () => {
    expect(sanitizeCoachingText('Factor A (0/1) \u2192 Outcome B')).toBe('Factor A to Outcome B')
  })

  it('strips discrete encoding from coaching text', () => {
    expect(sanitizeCoachingText('Team Structure (0=Developers, 1=Tech Lead) matters')).toBe('Team Structure matters')
  })

  it('strips (0-1, share of N) from coaching text', () => {
    expect(sanitizeCoachingText('Engineering Capacity (0\u20131, share of 20 engineers) is key')).toBe('Engineering Capacity is key')
  })

  it('V12.5: replaces em dash (\u2014) with comma', () => {
    expect(sanitizeCoachingText('criteria \u2014 margin')).toBe('criteria, margin')
  })

  // V14.1: Decimal encoding in coaching text
  it('strips decimal encoding (0=Cat, 0.94=Dog) from coaching text', () => {
    expect(sanitizeCoachingText('Pet Type (0=Cat, 0.94=Dog) drives the outcome')).toBe('Pet Type drives the outcome')
  })

  it('strips multi-entry decimal encoding from coaching text', () => {
    expect(sanitizeCoachingText('Risk (0=Low, 0.5=Med, 1=High) is uncertain')).toBe('Risk is uncertain')
  })
})

/**
 * Unit tests for formatTargetValue.
 * Tests B-series formatting scenarios.
 */
import { describe, it, expect } from 'vitest'
import { formatTargetValue } from '../formatTargetValue'

describe('formatTargetValue', () => {
  // B4: No unit → plain number
  it('returns locale-formatted number with no unit', () => {
    expect(formatTargetValue(200)).toBe('200')
  })

  // B3: Percent
  it('returns percentage string for percent unit', () => {
    expect(formatTargetValue(95, 'percent')).toBe('95%')
  })

  // B1: Currency with thousands separator
  it('returns currency-prefixed string with thousands separator', () => {
    const result = formatTargetValue(20000, 'currency', '£')
    expect(result).toContain('£')
    expect(result).toContain('20,000')
  })

  it('returns currency-prefixed string for $', () => {
    const result = formatTargetValue(500, 'currency', '$')
    expect(result).toContain('$')
    expect(result).toContain('500')
  })

  // Large numbers get locale formatting
  it('formats large count values with locale separator', () => {
    const result = formatTargetValue(1000000)
    expect(result).toContain('1,000,000')
  })

  // Zero is a valid value
  it('formats 0 correctly', () => {
    expect(formatTargetValue(0)).toBe('0')
    expect(formatTargetValue(0, 'percent')).toBe('0%')
  })

  // No symbol → currency unit without symbol just returns the number
  it('returns locale number when currency unit but no symbol', () => {
    // symbol is undefined → falls through to toLocaleString
    const result = formatTargetValue(200, 'currency', undefined)
    expect(result).toContain('200')
  })
})

/**
 * Tests for Debug Panel Formatters
 */

import { describe, it, expect } from 'vitest'
import {
  formatNumber,
  formatMs,
  formatMsShort,
  formatPercent,
  formatCoeff,
  formatDelta,
  formatRawDelta,
} from '../formatters'

describe('formatNumber', () => {
  it('formats valid numbers', () => {
    expect(formatNumber(1.234)).toBe('1.23')
    expect(formatNumber(1.234, 1)).toBe('1.2')
    expect(formatNumber(0)).toBe('0.00')
  })

  it('returns fallback for null', () => {
    expect(formatNumber(null)).toBe('—')
  })

  it('returns fallback for undefined', () => {
    expect(formatNumber(undefined)).toBe('—')
  })

  it('returns fallback for NaN', () => {
    expect(formatNumber(NaN)).toBe('—')
  })

  it('returns fallback for Infinity', () => {
    expect(formatNumber(Infinity)).toBe('—')
    expect(formatNumber(-Infinity)).toBe('—')
  })

  it('uses custom fallback', () => {
    expect(formatNumber(null, 2, 'N/A')).toBe('N/A')
  })
})

describe('formatMs', () => {
  it('formats milliseconds as seconds', () => {
    expect(formatMs(1000)).toBe('1.00s')
    expect(formatMs(1500)).toBe('1.50s')
    expect(formatMs(45678)).toBe('45.68s')
  })

  it('returns fallback for invalid values', () => {
    expect(formatMs(null)).toBe('—')
    expect(formatMs(undefined)).toBe('—')
    expect(formatMs(NaN)).toBe('—')
  })
})

describe('formatMsShort', () => {
  it('formats with 1 decimal place', () => {
    expect(formatMsShort(1000)).toBe('1.0s')
    expect(formatMsShort(1560)).toBe('1.6s')
  })

  it('returns fallback for invalid values', () => {
    expect(formatMsShort(null)).toBe('—')
  })
})

describe('formatPercent', () => {
  it('formats 0-1 values as percentages', () => {
    expect(formatPercent(0.5)).toBe('50.0%')
    expect(formatPercent(0.038)).toBe('3.8%')
    expect(formatPercent(1)).toBe('100.0%')
  })

  it('handles custom decimal places', () => {
    expect(formatPercent(0.5, 0)).toBe('50%')
    expect(formatPercent(0.123456, 2)).toBe('12.35%')
  })

  it('returns fallback for invalid values', () => {
    expect(formatPercent(null)).toBe('—')
    expect(formatPercent(undefined)).toBe('—')
    expect(formatPercent(NaN)).toBe('—')
  })
})

describe('formatCoeff', () => {
  it('formats coefficient values', () => {
    expect(formatCoeff(0.85)).toBe('0.85')
    expect(formatCoeff(1.234)).toBe('1.23')
  })

  it('returns fallback for invalid values', () => {
    expect(formatCoeff(null)).toBe('—')
    expect(formatCoeff(undefined)).toBe('—')
  })
})

describe('formatDelta', () => {
  it('formats positive deltas with plus sign', () => {
    expect(formatDelta(0.038)).toBe('+3.8%')
    expect(formatDelta(0.1)).toBe('+10.0%')
  })

  it('formats negative deltas', () => {
    expect(formatDelta(-0.05)).toBe('-5.0%')
  })

  it('formats zero without plus sign', () => {
    expect(formatDelta(0)).toBe('0.0%')
  })

  it('returns fallback for invalid values', () => {
    expect(formatDelta(null)).toBe('—')
    expect(formatDelta(undefined)).toBe('—')
  })
})

describe('formatRawDelta', () => {
  it('formats raw deltas with sign', () => {
    expect(formatRawDelta(0.123)).toBe('+0.123')
    expect(formatRawDelta(-0.456)).toBe('-0.456')
  })

  it('returns fallback for invalid values', () => {
    expect(formatRawDelta(null)).toBe('—')
  })
})

/**
 * Tests for formatJourneyTime — deterministic date formatter.
 *
 * All tests pass a fixed `now` value. No Date.now() calls.
 */

import { describe, it, expect } from 'vitest'
import { formatJourneyTime } from '../formatJourneyTime'

// Fixed reference: 2026-03-08 14:30:00 UTC
const NOW = new Date('2026-03-08T14:30:00Z')

describe('formatJourneyTime', () => {
  it('returns "just now" for timestamps less than 60 seconds ago', () => {
    expect(formatJourneyTime('2026-03-08T14:29:30Z', NOW)).toBe('just now')
  })

  it('returns "just now" for timestamps exactly at now', () => {
    expect(formatJourneyTime('2026-03-08T14:30:00Z', NOW)).toBe('just now')
  })

  it('returns "just now" for future timestamps', () => {
    expect(formatJourneyTime('2026-03-08T15:00:00Z', NOW)).toBe('just now')
  })

  it('returns minutes ago for timestamps 1-59 minutes ago', () => {
    // 3 minutes ago
    expect(formatJourneyTime('2026-03-08T14:27:00Z', NOW)).toBe('3 min ago')
  })

  it('returns "1 min ago" at exactly 60 seconds', () => {
    expect(formatJourneyTime('2026-03-08T14:29:00Z', NOW)).toBe('1 min ago')
  })

  it('returns "59 min ago" at 59 minutes', () => {
    expect(formatJourneyTime('2026-03-08T13:31:00Z', NOW)).toBe('59 min ago')
  })

  it('returns time only (HH:MM) for same calendar day, 1+ hours ago', () => {
    // 2 hours ago, same day
    expect(formatJourneyTime('2026-03-08T12:15:00Z', NOW)).toBe('12:15')
  })

  it('returns "day month, HH:MM" for previous days', () => {
    // Yesterday
    expect(formatJourneyTime('2026-03-07T09:05:00Z', NOW)).toBe('7 Mar, 09:05')
  })

  it('returns "day month, HH:MM" for dates in a different month', () => {
    expect(formatJourneyTime('2026-02-15T16:45:00Z', NOW)).toBe('15 Feb, 16:45')
  })

  it('zero-pads hours and minutes', () => {
    expect(formatJourneyTime('2026-03-06T03:07:00Z', NOW)).toBe('6 Mar, 03:07')
  })
})

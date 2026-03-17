/**
 * formatRelativeTime tests — C.1b utility
 */

import { describe, it, expect, vi, afterEach } from 'vitest'
import { formatRelativeTime } from '../formatRelativeTime'

describe('formatRelativeTime', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns "just now" for recent timestamps', () => {
    const now = new Date().toISOString()
    expect(formatRelativeTime(now)).toBe('just now')
  })

  it('returns minutes ago', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-15T12:05:00Z'))
    expect(formatRelativeTime('2026-01-15T12:00:00Z')).toBe('5m ago')
  })

  it('returns hours ago', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-15T14:00:00Z'))
    expect(formatRelativeTime('2026-01-15T12:00:00Z')).toBe('2h ago')
  })

  it('returns "Yesterday" for 1 day ago', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-16T12:00:00Z'))
    expect(formatRelativeTime('2026-01-15T12:00:00Z')).toBe('Yesterday')
  })

  it('returns days ago', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-18T12:00:00Z'))
    expect(formatRelativeTime('2026-01-15T12:00:00Z')).toBe('3 days ago')
  })

  it('returns weeks ago', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-29T12:00:00Z'))
    expect(formatRelativeTime('2026-01-15T12:00:00Z')).toBe('2 weeks ago')
  })

  it('returns "just now" for future timestamps', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-15T12:00:00Z'))
    expect(formatRelativeTime('2026-01-15T13:00:00Z')).toBe('just now')
  })
})
